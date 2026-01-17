import type { Observation, ObservationPriority, BatchedSpeechConfig } from '../types/batching';

const DEFAULT_BATCH_INTERVAL = 3000; // 3 seconds - allows time for speech to play
const DEFAULT_VOICE_ID = 'en-US-natalie'; // Default Murf AI voice
const MURF_API_URL = 'https://api.murf.ai/v1/speech/generate';

export class BatchedSpeechManager {
  private pendingObservations: Observation[];
  private isSpeaking: boolean;
  private batchInterval: number;
  private batchTimer: ReturnType<typeof setInterval> | null = null;
  private criticalQueue: string[];
  private apiKey: string | undefined;
  private voiceId: string;
  private format: string;
  private sampleRate: number;
  private pitch: number;
  private rate: number;
  private currentAudioRef: HTMLAudioElement | null = null;
  private currentAudioUrlRef: string | null = null;
  private isProcessingRef: boolean = false;
  private speechStartTime: number = 0;
  private minSpeechDuration: number = 5000; // Minimum 5 seconds before allowing interruption

  constructor(config: BatchedSpeechConfig = {}) {
    this.pendingObservations = [];
    this.isSpeaking = false;
    this.batchInterval = config.batchInterval ?? DEFAULT_BATCH_INTERVAL;
    this.criticalQueue = [];
    this.apiKey = config.apiKey;
    this.voiceId = config.voiceId ?? DEFAULT_VOICE_ID;
    this.format = config.format ?? 'MP3';
    this.sampleRate = config.sampleRate ?? 44100;
    this.pitch = config.pitch ?? 0;
    this.rate = config.rate ?? 0;
    
    this.startBatching();
  }

  /**
   * Add an observation to the batch queue
   */
  addObservation(observation: Omit<Observation, 'id' | 'timestamp'>): void {
    console.log('Adding observation:', observation.priority, observation.narration);
    
    // Only interrupt for truly critical items, and only if speech has been playing long enough
    if (observation.priority === 'critical') {
      const speechDuration = Date.now() - this.speechStartTime;
      // Only interrupt if speech has been playing for at least minimum duration
      if (this.isSpeaking && speechDuration >= this.minSpeechDuration) {
        console.log('Critical observation - interrupting after minimum duration');
        this.interrupt(observation.narration);
      } else {
        // Queue critical items if speech just started
        console.log('Critical observation - queuing (speech just started or not speaking)');
        const fullObservation: Observation = {
          ...observation,
          id: `${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
        };
        // Add to front of queue for critical items
        this.pendingObservations.unshift(fullObservation);
        console.log(`Added critical to batch. Total pending: ${this.pendingObservations.length}`);
      }
    } else {
      // Check if we already have a very similar observation in the batch
      const isDuplicate = this.pendingObservations.some(existing => {
        const existingKey = existing.narration.toLowerCase().slice(0, 30);
        const newKey = observation.narration.toLowerCase().slice(0, 30);
        return existingKey === newKey;
      });

      if (isDuplicate) {
        console.log('Skipping duplicate observation:', observation.narration);
        return;
      }

      const fullObservation: Observation = {
        ...observation,
        id: `${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
      };
      this.pendingObservations.push(fullObservation);
      console.log(`Added to batch. Total pending: ${this.pendingObservations.length}`);
    }
  }

  /**
   * Start the periodic batching process
   */
  startBatching(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    this.batchTimer = setInterval(() => {
      if (this.pendingObservations.length === 0) {
        return;
      }
      
      // Check if actually speaking or processing
      if (this.isSpeaking || this.isProcessingRef) {
        console.log('Skipping batch - currently speaking/processing. Pending:', this.pendingObservations.length);
        return;
      }

      // Check if audio is actually playing
      if (this.currentAudioRef && !this.currentAudioRef.paused) {
        console.log('Skipping batch - audio is playing. Pending:', this.pendingObservations.length);
        return;
      }

      // Small delay to ensure previous speech has fully stopped
      // This prevents rapid-fire batch processing
      if (Date.now() - this.speechStartTime < 500 && this.speechStartTime > 0) {
        console.log('Speech just ended, waiting before processing next batch');
        return;
      }

      const batch = [...this.pendingObservations];
      this.pendingObservations = [];

      console.log(`Processing batch of ${batch.length} observations`);
      const summary = this.summarizeBatch(batch);
      console.log('Batch summary:', summary);
      this.speakNow(summary);
    }, this.batchInterval);
  }

  /**
   * Summarize a batch of observations into natural speech
   */
  summarizeBatch(observations: Observation[]): string {
    // If only one observation, just use it
    if (observations.length === 1) {
      return observations[0].narration;
    }

    // Deduplicate similar observations
    const unique = this.deduplicateObservations(observations);

    // Prioritize: hazards > navigation > orientation > social
    const priorityOrder: ObservationPriority[] = ['critical', 'high', 'medium', 'low'];
    unique.sort((a, b) => 
      priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority)
    );

    // Take top 2-3 most important
    const top = unique.slice(0, 3);
    
    // Combine into natural sentence
    if (top.length === 1) {
      return top[0].narration;
    } else if (top.length === 2) {
      return `${top[0].narration}. Also, ${top[1].narration.toLowerCase()}`;
    } else {
      return `${top[0].narration}. ${top[1].narration}. ${top[2].narration}`;
    }
  }

  /**
   * Deduplicate similar observations
   */
  private deduplicateObservations(observations: Observation[]): Observation[] {
    const unique: Observation[] = [];
    const seen = new Set<string>();
    
    for (const obs of observations) {
      // Simple dedup: skip if we've seen similar text
      const key = obs.narration.toLowerCase().slice(0, 30);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(obs);
      }
    }

    return unique;
  }

  /**
   * Interrupt current speech and speak immediately
   */
  interrupt(text: string): void {
    // Only interrupt if speech has been playing for minimum duration
    const speechDuration = Date.now() - this.speechStartTime;
    if (this.isSpeaking && speechDuration < this.minSpeechDuration) {
      console.log(`Speech only played for ${speechDuration}ms, queuing interruption instead`);
      // Queue the interruption instead of canceling immediately
      this.addObservation({ narration: text, priority: 'critical' });
      return;
    }
    
    // Stop all audio first
    this.stopCurrentSpeech();
    
    // Small delay to ensure cleanup completes
    setTimeout(() => {
      this.processSpeech(text);
    }, 100);
  }

  /**
   * Speak text immediately using Murf AI API
   */
  speakNow(text: string, cancelPrevious: boolean = true): void {
    if (!text || text.trim().length === 0) {
      return;
    }

    if (!this.apiKey) {
      console.error('Murf AI API key is required');
      return;
    }

    // Always stop any ongoing speech first to prevent overlapping audio
    this.stopCurrentSpeech();

    // Small delay to ensure audio cleanup completes
    setTimeout(() => {
      this.processSpeech(text);
    }, 50);
  }

  /**
   * Stop current speech
   */
  private stopCurrentSpeech(): void {
    if (this.currentAudioRef) {
      console.log('Stopping current audio');
      this.currentAudioRef.pause();
      this.currentAudioRef.currentTime = 0; // Reset to beginning
      // Remove event listeners to prevent callbacks
      this.currentAudioRef.onended = null;
      this.currentAudioRef.onerror = null;
      this.currentAudioRef.onplay = null;
      this.currentAudioRef = null;
    }
    if (this.currentAudioUrlRef) {
      URL.revokeObjectURL(this.currentAudioUrlRef);
      this.currentAudioUrlRef = null;
    }
    this.isProcessingRef = false;
    this.isSpeaking = false;
    this.speechStartTime = 0;
  }

  /**
   * Process speech using Murf AI API
   */
  private async processSpeech(text: string): Promise<void> {
    // Double-check we're not already processing or speaking
    if (this.isProcessingRef || this.isSpeaking) {
      console.log('Already processing/speaking, skipping:', text);
      // Add to batch instead of processing immediately
      const fullObservation: Observation = {
        id: `${Date.now()}-${Math.random()}`,
        narration: text,
        priority: 'medium',
        timestamp: Date.now(),
      };
      this.pendingObservations.push(fullObservation);
      console.log(`Queued instead. Total pending: ${this.pendingObservations.length}`);
      return;
    }

    // Also check if audio is actually playing
    if (this.currentAudioRef && !this.currentAudioRef.paused) {
      console.log('Audio is currently playing, skipping:', text);
      const fullObservation: Observation = {
        id: `${Date.now()}-${Math.random()}`,
        narration: text,
        priority: 'medium',
        timestamp: Date.now(),
      };
      this.pendingObservations.push(fullObservation);
      return;
    }

    this.isProcessingRef = true;
    this.isSpeaking = true;

    try {
      console.log('Calling Murf AI API with voiceId:', this.voiceId);
      const response = await fetch(MURF_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey!,
        },
        body: JSON.stringify({
          text: text.trim(),
          voiceId: this.voiceId,
          format: this.format,
          channelType: 'STEREO',
          sampleRate: this.sampleRate,
          pitch: this.pitch,
          rate: this.rate,
          variation: 1,
          multiNativeLocale: 'en-US',
        }),
      });

      console.log('Murf AI API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message || errorData.error || `TTS API error: ${response.status}`;
        console.error('Murf AI API error:', errorMsg, errorData);
        throw new Error(errorMsg);
      }

      const result = await response.json();
      console.log('Murf AI API response:', result);

      // Murf AI returns an audioFile URL
      if (!result.audioFile) {
        throw new Error('No audio file URL in response');
      }

      // Fetch the audio file from the URL
      console.log('Fetching audio from URL:', result.audioFile);
      const audioResponse = await fetch(result.audioFile);
      
      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio file: ${audioResponse.status}`);
      }

      const audioBlob = await audioResponse.blob();
      console.log('Received audio blob, size:', audioBlob.size);
      
      // Double-check we're still supposed to play this (might have been canceled)
      if (!this.isProcessingRef) {
        console.log('Speech was canceled while fetching audio, aborting');
        return;
      }
      
      // Stop any existing audio before starting new one
      this.stopCurrentSpeech();
      
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      this.currentAudioRef = audio;
      this.currentAudioUrlRef = audioUrl;

      console.log('Starting audio playback:', text);
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          console.log('Audio playback ended:', text);
          if (this.currentAudioUrlRef) {
            URL.revokeObjectURL(this.currentAudioUrlRef);
            this.currentAudioUrlRef = null;
          }
          this.currentAudioRef = null;
          this.isSpeaking = false;
          this.isProcessingRef = false;
          this.speechStartTime = 0;
          
          // Process pending batch after speech ends
          setTimeout(() => {
            if (this.pendingObservations.length > 0 && !this.isSpeaking) {
              this.forceProcessBatch();
            }
          }, 100);
          
          resolve();
        };
        audio.onerror = (err) => {
          console.error('Audio playback error:', err);
          if (this.currentAudioUrlRef) {
            URL.revokeObjectURL(this.currentAudioUrlRef);
            this.currentAudioUrlRef = null;
          }
          this.currentAudioRef = null;
          this.isSpeaking = false;
          this.isProcessingRef = false;
          this.speechStartTime = 0;
          reject(new Error('Audio playback failed'));
        };
        audio.onplay = () => {
          console.log('Audio playback started:', text);
          this.speechStartTime = Date.now();
        };
        audio.play().catch((err) => {
          console.error('Audio play() failed:', err);
          this.isSpeaking = false;
          this.isProcessingRef = false;
          this.speechStartTime = 0;
          reject(err);
        });
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate speech';
      console.error('TTS error:', errorMessage);
      this.isSpeaking = false;
      this.isProcessingRef = false;
    }
  }

  /**
   * Stop current speech
   */
  stop(): void {
    this.stopCurrentSpeech();
    this.pendingObservations = [];
    this.criticalQueue = [];
  }

  /**
   * Get current pending observations count
   */
  getPendingCount(): number {
    return this.pendingObservations.length;
  }

  /**
   * Check if currently speaking
   */
  getIsSpeaking(): boolean {
    // Check flags and actual audio playback state
    const audioPlaying = this.currentAudioRef && !this.currentAudioRef.paused && !this.currentAudioRef.ended;
    return this.isSpeaking || this.isProcessingRef || audioPlaying;
  }

  /**
   * Force process pending batch (useful when speech was canceled)
   */
  forceProcessBatch(): void {
    if (this.pendingObservations.length === 0) {
      return;
    }

    if (this.isSpeaking || this.isProcessingRef) {
      console.log('Cannot force process - currently speaking');
      return;
    }

    const batch = [...this.pendingObservations];
    this.pendingObservations = [];

    console.log(`Force processing batch of ${batch.length} observations`);
    const summary = this.summarizeBatch(batch);
    console.log('Batch summary:', summary);
    this.speakNow(summary);
  }

  /**
   * Test speech synthesis (useful for debugging)
   */
  testSpeech(text: string = 'Speech synthesis test'): void {
    console.log('Testing speech synthesis');
    if (!this.apiKey) {
      console.error('Murf AI API key is required for speech');
      return;
    }
    // Don't cancel previous speech for test - just queue it
    this.speakNow(text, false);
  }

  /**
   * Cleanup - stop timers and speech
   */
  destroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    this.stop();
  }
}
