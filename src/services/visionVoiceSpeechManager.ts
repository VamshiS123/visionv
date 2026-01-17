export type ObservationPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Observation {
  narration: string;
  priority: ObservationPriority;
}

interface QueuedObservation extends Observation {
  timestamp: number;
}

export class VisionVoiceSpeechManager {
  private synth: SpeechSynthesis;
  private queue: QueuedObservation[];
  private isSpeaking: boolean;
  private lastSpoken: Map<string, number>; // text -> timestamp
  private dedupeWindowMs: number;
  private speechRate: number;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor(config: {
    dedupeWindowMs?: number;
    speechRate?: number;
  } = {}) {
    this.synth = window.speechSynthesis;
    this.queue = [];
    this.isSpeaking = false;
    this.lastSpoken = new Map();
    this.dedupeWindowMs = config.dedupeWindowMs ?? 8000; // Don't repeat same thing within 8s
    this.speechRate = config.speechRate ?? 1.15;
  }

  addObservation(observation: Observation): void {
    const { narration, priority } = observation;

    console.log('Adding observation:', priority, narration);

    // 1. Critical: interrupt immediately
    if (priority === 'critical') {
      this.interrupt(narration);
      return;
    }

    // 2. Dedupe: skip if we said this recently
    if (this.isDuplicate(narration)) {
      console.log('Skipping duplicate:', narration);
      return;
    }

    // 3. If speaking, only queue high priority
    if (this.isSpeaking) {
      if (priority === 'high') {
        this.queue.push({ ...observation, timestamp: Date.now() });
        // Keep queue small - only keep high priority items
        if (this.queue.length > 3) {
          this.queue = this.queue
            .filter(q => q.priority === 'high')
            .slice(-2);
        }
        console.log(`Queued high priority. Queue length: ${this.queue.length}`);
      }
      return;
    }

    // 4. Not speaking: say it now
    this.speak(narration);
  }

  isDuplicate(text: string): boolean {
    const key = text.toLowerCase().trim();
    const lastTime = this.lastSpoken.get(key);
    
    if (lastTime && Date.now() - lastTime < this.dedupeWindowMs) {
      return true;
    }
    
    // Also check for similar (not exact) text
    for (const [spokenText, time] of this.lastSpoken.entries()) {
      if (Date.now() - time < this.dedupeWindowMs) {
        if (this.isSimilar(key, spokenText)) {
          return true;
        }
      }
    }
    
    return false;
  }

  isSimilar(a: string, b: string): boolean {
    // Simple similarity: check if first 15 chars match
    return a.slice(0, 15) === b.slice(0, 15);
  }

  speak(text: string): void {
    if (!text || text.trim().length === 0) {
      return;
    }

    // Stop any current speech
    this.synth.cancel();
    this.isSpeaking = true;
    
    const key = text.toLowerCase().trim();
    this.lastSpoken.set(key, Date.now());
    
    // Clean old entries
    for (const [mapKey, time] of this.lastSpoken.entries()) {
      if (Date.now() - time > this.dedupeWindowMs * 2) {
        this.lastSpoken.delete(mapKey);
      }
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.speechRate;
    utterance.pitch = 1;
    utterance.volume = 1.0;

    this.currentUtterance = utterance;

    utterance.onend = () => {
      console.log('Speech ended:', text);
      this.isSpeaking = false;
      this.currentUtterance = null;
      this.processQueue();
    };

    utterance.onerror = (event) => {
      console.error('Speech error:', event.error);
      this.isSpeaking = false;
      this.currentUtterance = null;
      this.processQueue();
    };

    utterance.onstart = () => {
      console.log('Speech started:', text);
    };

    try {
      this.synth.speak(utterance);
      console.log('Speech queued:', text);
    } catch (error) {
      console.error('Error speaking:', error);
      this.isSpeaking = false;
      this.currentUtterance = null;
    }
  }

  interrupt(text: string): void {
    console.log('Interrupting with:', text);
    this.synth.cancel();
    this.queue = [];
    this.isSpeaking = false;
    this.currentUtterance = null;
    this.speak(text);
  }

  processQueue(): void {
    if (this.queue.length === 0) {
      return;
    }
    
    // Get highest priority
    this.queue.sort((a, b) => {
      const order: Record<ObservationPriority, number> = { 
        critical: 0, 
        high: 1, 
        medium: 2, 
        low: 3 
      };
      return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
    });

    const next = this.queue.shift();
    if (!next) {
      return;
    }
    
    // Skip if it became a duplicate while waiting
    if (!this.isDuplicate(next.narration)) {
      console.log('Processing queued observation:', next.narration);
      this.speak(next.narration);
    } else {
      console.log('Skipping duplicate from queue:', next.narration);
      this.processQueue();
    }
  }

  stop(): void {
    this.synth.cancel();
    this.queue = [];
    this.isSpeaking = false;
    this.currentUtterance = null;
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking || this.synth.speaking || this.synth.pending;
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}
