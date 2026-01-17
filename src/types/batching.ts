export type ObservationPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Observation {
  id: string;
  narration: string;
  priority: ObservationPriority;
  timestamp: number;
}

export interface BatchedSpeechConfig {
  batchInterval?: number; // milliseconds
  apiKey?: string; // Murf AI API key
  voiceId?: string; // Murf AI voice ID (e.g., "en-US-natalie", "Matthew")
  format?: string; // Audio format: MP3, WAV, etc. (default: MP3)
  sampleRate?: number; // Sample rate: 8000, 24000, 44100, 48000 (default: 44100)
  pitch?: number; // Pitch adjustment: -50 to +50 (default: 0)
  rate?: number; // Rate adjustment: -50 to +50 (default: 0)
}

export interface UseBatchedSpeechReturn {
  addObservation: (observation: Omit<Observation, 'id' | 'timestamp'>) => void;
  interrupt: (text: string) => void;
  stop: () => void;
  testSpeech: (text?: string) => void;
  forceProcessBatch: () => void;
  isSpeaking: boolean;
  pendingCount: number;
}
