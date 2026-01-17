export interface OvershootResult {
  result: string;
  inference_latency_ms?: number;
  total_latency_ms?: number;
}

export interface UseOvershootReturn {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  updatePrompt: (newPrompt: string) => void;
  isActive: boolean;
  description: string | null;
  error: string | null;
  isLoading: boolean;
}

export interface OvershootConfig {
  apiUrl: string;
  apiKey: string;
  prompt: string;
  source?: {
    type: 'camera' | 'video';
    cameraFacing?: 'user' | 'environment';
    file?: File;
  };
  processing?: {
    clip_length_seconds?: number;
    delay_seconds?: number;
    fps?: number;
    sampling_ratio?: number;
  };
  model?: string;
  onResult: (result: OvershootResult) => void;
}
