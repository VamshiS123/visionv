import type { Observation, ObservationPriority, BatchedSpeechConfig } from '../types/batching';

const DEFAULT_BATCH_INTERVAL = 3000; // 3 seconds - allows time for speech to play
const DEFAULT_VOICE_ID = 'en-US-natalie'; // Default Murf AI voice
const MURF_API_URL = 'https://api.murf.ai/v1/speech/generate';

export class BatchedSpeechManager {
  private pendingObservations: Observation[];
  private isSpeaking: boolean;
  private batchInterval: number;
  private batchTimer: ReturnType<typeof setInterval> | null = null;
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
  private minSpeechDuration: number = 500; // Minimum 0.5 seconds before allowing interruption for new objects
  private currentNarrationText: string | null = null; // Track what's currently being spoken
  private lastSpoken: Map<string, number>; // Track recently spoken narrations: text -> timestamp
  private dedupeWindowMs: number = 6000; // Don't repeat same thing within 6 seconds (reduced for faster updates)

  constructor(config: BatchedSpeechConfig = {}) {
    this.pendingObservations = [];
    this.isSpeaking = false;
    this.batchInterval = config.batchInterval ?? DEFAULT_BATCH_INTERVAL;
    this.apiKey = config.apiKey;
    this.voiceId = config.voiceId ?? DEFAULT_VOICE_ID;
    this.format = config.format ?? 'MP3';
    this.sampleRate = config.sampleRate ?? 44100;
    this.pitch = config.pitch ?? 0;
    this.rate = config.rate ?? 0;
    this.lastSpoken = new Map();
    
    this.startBatching();
    
    // Clean up old entries periodically
    setInterval(() => {
      this.cleanupOldEntries();
    }, 30000); // Every 30 seconds
  }

  /**
   * Check if a narration was recently spoken (within dedupe window)
   */
  private wasRecentlySpoken(narration: string): boolean {
    const key = narration.toLowerCase().trim();
    const lastTime = this.lastSpoken.get(key);
    
    if (lastTime && Date.now() - lastTime < this.dedupeWindowMs) {
      return true;
    }
    
    // Also check for similar narrations (not exact matches)
    for (const [spokenText, time] of this.lastSpoken.entries()) {
      if (Date.now() - time < this.dedupeWindowMs) {
        if (this.isSimilarNarration(key, spokenText)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check if two narrations are similar (likely the same observation)
   */
  private isSimilarNarration(a: string, b: string): boolean {
    // If first 25 characters match, likely the same
    if (a.slice(0, 25) === b.slice(0, 25)) {
      return true;
    }
    
    // Extract key words (longer words are more meaningful)
    const wordsA = a.split(/\s+/).filter(w => w.length > 3).map(w => w.toLowerCase());
    const wordsB = b.split(/\s+/).filter(w => w.length > 3).map(w => w.toLowerCase());
    
    if (wordsA.length === 0 || wordsB.length === 0) {
      return false;
    }
    
    // If more than 50% of key words match, consider it similar
    const commonWords = wordsA.filter(w => wordsB.includes(w));
    const overlapRatio = commonWords.length / Math.min(wordsA.length, wordsB.length);
    
    return overlapRatio > 0.5;
  }

  /**
   * Check if a narration mentions a new/different object compared to current narration
   */
  private isNewObject(narration: string): boolean {
    if (!this.currentNarrationText) {
      return true; // No current narration, so this is new
    }

    const current = this.currentNarrationText.toLowerCase();
    const newNarration = narration.toLowerCase();

    // If they're very similar (first 30 chars match), it's not a new object
    if (current.slice(0, 30) === newNarration.slice(0, 30)) {
      return false;
    }

    // Check if they mention different objects by comparing key words
    // Extract potential object words (nouns) - simple heuristic
    const currentWords = current.split(/\s+/).filter(w => w.length > 3);
    const newWords = newNarration.split(/\s+/).filter(w => w.length > 3);
    
    // If less than 30% word overlap, likely a new object
    const commonWords = currentWords.filter(w => newWords.includes(w));
    const overlapRatio = commonWords.length / Math.max(currentWords.length, newWords.length);
    
    return overlapRatio < 0.3;
  }

  /**
   * Clean up old entries from lastSpoken map
   */
  private cleanupOldEntries(): void {
    const now = Date.now();
    for (const [text, time] of this.lastSpoken.entries()) {
      if (now - time > this.dedupeWindowMs * 2) {
        this.lastSpoken.delete(text);
      }
    }
  }

  /**
   * Add an observation to the batch queue
   */
  addObservation(observation: Omit<Observation, 'id' | 'timestamp'>): void {
    console.log('Adding observation:', observation.priority, observation.narration);
    
    // First check if this was recently spoken - skip if so (unless critical)
    if (observation.priority !== 'critical' && this.wasRecentlySpoken(observation.narration)) {
      console.log('Skipping observation - was recently spoken:', observation.narration);
      return;
    }
    
    const isCurrentlySpeaking = this.isSpeaking || this.isProcessingRef || 
      (this.currentAudioRef !== null && !this.currentAudioRef.paused && !this.currentAudioRef.ended);
    const isNewObject = this.isNewObject(observation.narration);
    
    // Critical: interrupt immediately if speech has been playing long enough
    if (observation.priority === 'critical') {
      const speechDuration = Date.now() - this.speechStartTime;
      // Only interrupt if speech has been playing for at least minimum duration
      if (isCurrentlySpeaking && speechDuration >= this.minSpeechDuration) {
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
    } else if (observation.priority === 'high') {
      // High priority new object: interrupt immediately if speech has been playing for a short time
      if (isCurrentlySpeaking && isNewObject) {
        const speechDuration = Date.now() - this.speechStartTime;
        // Allow interruption after just 0.3 seconds for new objects (faster response)
        if (speechDuration >= 300) {
          console.log('High priority new object - interrupting immediately');
          this.interrupt(observation.narration, 300); // Use shorter minimum duration for new objects
          return;
        } else {
          // If speech just started (< 0.5s), queue it to play next
          console.log('High priority new object - queuing (speech just started)');
          const fullObservation: Observation = {
            ...observation,
            id: `${Date.now()}-${Math.random()}`,
            timestamp: Date.now(),
          };
          this.pendingObservations.unshift(fullObservation);
          console.log(`Added high priority new object to queue. Total pending: ${this.pendingObservations.length}`);
          return;
        }
      }
      
      // High priority: speak immediately if not currently speaking
      if (!isCurrentlySpeaking) {
        console.log('High priority observation - speaking immediately');
        this.speakNow(observation.narration);
        return;
      }
      
      // If speaking same object, add to batch (will be processed soon)
      console.log('High priority observation - queuing (currently speaking)');
      const fullObservation: Observation = {
        ...observation,
        id: `${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
      };
      // Add to front of queue for high priority items
      this.pendingObservations.unshift(fullObservation);
      console.log(`Added high priority to batch. Total pending: ${this.pendingObservations.length}`);
    } else {
      // Medium/Low priority: if new object and currently speaking, allow faster interruption
      if (isCurrentlySpeaking && isNewObject) {
        const speechDuration = Date.now() - this.speechStartTime;
        // Allow interruption after 0.5 seconds for new objects (faster than normal)
        if (speechDuration >= 500) {
          console.log('New object detected - interrupting to speak immediately');
          this.interrupt(observation.narration, 500); // Use shorter minimum duration for new objects
          return;
        } else {
          // If speech just started, queue it
          console.log('New object detected - queuing (speech just started)');
          const fullObservation: Observation = {
            ...observation,
            id: `${Date.now()}-${Math.random()}`,
            timestamp: Date.now(),
          };
          this.pendingObservations.push(fullObservation);
          console.log(`Added new object to queue. Total pending: ${this.pendingObservations.length}`);
          return;
        }
      }
      
      // Check for duplicates in pending queue
      const isDuplicate = this.pendingObservations.some(existing => {
        return this.isSimilarNarration(
          existing.narration.toLowerCase().trim(),
          observation.narration.toLowerCase().trim()
        );
      });

      if (isDuplicate) {
        console.log('Skipping duplicate observation in queue:', observation.narration);
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

    console.log(`Starting batch timer with interval: ${this.batchInterval}ms`);
    this.batchTimer = setInterval(() => {
      console.log(`Batch timer tick - Pending: ${this.pendingObservations.length}, Speaking: ${this.isSpeaking}, Processing: ${this.isProcessingRef}`);
      
      if (this.pendingObservations.length === 0) {
        return;
      }
      
      // Check if actually speaking or processing
      if (this.isSpeaking || this.isProcessingRef) {
        console.log('Skipping batch - currently speaking/processing. Pending:', this.pendingObservations.length);
        return;
      }

      // Check if audio is actually playing
      const audioPlaying = this.currentAudioRef !== null && !this.currentAudioRef.paused && !this.currentAudioRef.ended;
      if (audioPlaying) {
        console.log('Skipping batch - audio is playing. Pending:', this.pendingObservations.length);
        return;
      }

      // Small delay to ensure previous speech has fully stopped
      // This prevents rapid-fire batch processing
      // Only check if speechStartTime is recent (within last 100ms)
      if (this.speechStartTime > 0 && Date.now() - this.speechStartTime < 100) {
        console.log('Speech just ended, waiting before processing next batch');
        return;
      }

      const batch = [...this.pendingObservations];
      this.pendingObservations = [];

      console.log(`Processing batch of ${batch.length} observations:`, batch.map(o => o.narration));
      const summary = this.summarizeBatch(batch);
      console.log('Batch summary:', summary);
      
      // Skip if summary is empty (all observations were recently spoken)
      if (!summary || summary.trim().length === 0) {
        console.log('Skipping batch - all observations were recently spoken');
        return;
      }
      
      // Check if summary was recently spoken - skip if so
      if (this.wasRecentlySpoken(summary)) {
        console.log('Skipping batch summary - was recently spoken:', summary);
        return;
      }
      
      this.speakNow(summary);
    }, this.batchInterval);
  }

  /**
   * Summarize a batch of observations into natural speech
   */
  summarizeBatch(observations: Observation[]): string {
    // Filter out observations that were recently spoken
    const notRecentlySpoken = observations.filter(obs => !this.wasRecentlySpoken(obs.narration));
    
    // If all were recently spoken, return empty string (will be skipped)
    if (notRecentlySpoken.length === 0) {
      return '';
    }
    
    // If only one observation remains, just use it
    if (notRecentlySpoken.length === 1) {
      return notRecentlySpoken[0].narration;
    }

    // Deduplicate similar observations
    const unique = this.deduplicateObservations(notRecentlySpoken);

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
  interrupt(text: string, minDurationOverride?: number): void {
    // Use override duration if provided (for new objects), otherwise use default
    const minDuration = minDurationOverride ?? this.minSpeechDuration;
    const speechDuration = Date.now() - this.speechStartTime;
    
    if (this.isSpeaking && speechDuration < minDuration) {
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
    }, 25); // Reduced delay for faster response
  }

  /**
   * Speak text immediately using Murf AI API
   */
  speakNow(text: string): void {
    if (!text || text.trim().length === 0) {
      return;
    }

    if (!this.apiKey) {
      console.error('Murf AI API key is required');
      return;
    }

    // Always stop any ongoing speech first to prevent overlapping audio
    this.stopCurrentSpeech();

    // Minimal delay to ensure audio cleanup completes
    setTimeout(() => {
      this.processSpeech(text);
    }, 25); // Reduced delay for faster response
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
    this.currentNarrationText = null; // Clear current narration
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
      
      // Ensure audio is not muted and volume is set
      audio.muted = false;
      audio.volume = 1.0;

      this.currentAudioRef = audio;
      this.currentAudioUrlRef = audioUrl;

      // Track current narration text
      this.currentNarrationText = text;
      
      // Record that this was spoken
      const key = text.toLowerCase().trim();
      this.lastSpoken.set(key, Date.now());
      
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
          this.currentNarrationText = null; // Clear current narration
          
          // Process pending batch after speech ends (reduced delay for faster updates)
          setTimeout(() => {
            if (this.pendingObservations.length > 0 && !this.isSpeaking) {
              this.forceProcessBatch();
            }
          }, 25); // Reduced for faster response
          
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
          this.currentNarrationText = null; // Clear current narration
          reject(new Error('Audio playback failed'));
        };
        audio.onplay = () => {
          console.log('Audio playback started:', text);
          this.speechStartTime = Date.now();
        };
        
        // Play audio with error handling
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('Audio play() succeeded');
            })
            .catch((err) => {
              console.error('Audio play() failed:', err);
              this.isSpeaking = false;
              this.isProcessingRef = false;
              this.speechStartTime = 0;
              this.currentNarrationText = null; // Clear current narration
              reject(err);
            });
        }
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
    const audioPlaying = this.currentAudioRef !== null && !this.currentAudioRef.paused && !this.currentAudioRef.ended ? true : false;
    return this.isSpeaking || this.isProcessingRef || audioPlaying;
  }

  /**
   * Force process pending batch (useful when speech was canceled)
   */
  forceProcessBatch(): void {
    if (this.pendingObservations.length === 0) {
      console.log('Force process called but no pending observations');
      return;
    }

    if (this.isSpeaking || this.isProcessingRef) {
      console.log('Cannot force process - currently speaking');
      return;
    }

    // Check if audio is actually playing
    const audioPlaying = this.currentAudioRef !== null && !this.currentAudioRef.paused && !this.currentAudioRef.ended;
    if (audioPlaying) {
      console.log('Cannot force process - audio is playing');
      return;
    }

    const batch = [...this.pendingObservations];
    this.pendingObservations = [];

    console.log(`Force processing batch of ${batch.length} observations:`, batch.map(o => o.narration));
    const summary = this.summarizeBatch(batch);
    console.log('Batch summary:', summary);
    
    // Skip if summary is empty (all observations were recently spoken)
    if (!summary || summary.trim().length === 0) {
      console.log('Skipping force batch - all observations were recently spoken');
      return;
    }
    
    // Check if summary was recently spoken - skip if so
    if (this.wasRecentlySpoken(summary)) {
      console.log('Skipping force batch summary - was recently spoken:', summary);
      return;
    }
    
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
    this.speakNow(text);
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
