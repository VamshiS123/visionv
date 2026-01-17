import { useState, useRef, useCallback } from 'react';
import { RealtimeVision } from '@overshoot/sdk';
import type { UseOvershootReturn, OvershootResult } from '../types/overshoot';

interface UseOvershootOptions {
  apiUrl: string;
  apiKey: string;
  prompt: string;
  cameraFacing?: 'user' | 'environment';
  processing?: {
    clip_length_seconds?: number;
    delay_seconds?: number;
    fps?: number;
    sampling_ratio?: number;
  };
  model?: string;
  outputSchema?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
  onResult?: (result: OvershootResult) => void;
}

export function useOvershoot({
  apiUrl,
  apiKey,
  prompt,
  cameraFacing = 'environment',
  processing,
  model,
  outputSchema,
  onResult,
}: UseOvershootOptions): UseOvershootReturn {
  const [isActive, setIsActive] = useState(false);
  const [description, setDescription] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const visionRef = useRef<RealtimeVision | null>(null);
  const descriptionRef = useRef<string | null>(null);
  const currentPromptRef = useRef<string>(prompt);


  const start = useCallback(async () => {
    if (isActive || !apiKey) {
      if (!apiKey) {
        setError('API key is required. Please set VITE_OVERSHOOT_API_KEY in your .env file.');
      }
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('Creating RealtimeVision with:', { 
        apiUrl, 
        prompt: currentPromptRef.current, 
        cameraFacing,
        processing,
        model,
        outputSchema,
      });
      
      const resultCallback = (result: OvershootResult) => {
        try {
          if (result && result.result) {
            descriptionRef.current = result.result;
            setDescription(result.result);
            setError(null);
            
            if (onResult) {
              onResult(result);
            }
          } else {
            console.warn('Result missing or invalid:', result);
          }
        } catch (err) {
          console.error('Error in onResult handler:', err);
          setError(`Error processing result: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      };
      
      const visionConfig: any = {
        apiUrl,
        apiKey,
        prompt: currentPromptRef.current,
        source: {
          type: 'camera',
          cameraFacing,
        },
        processing: processing || {
          clip_length_seconds: 1,
          delay_seconds: 1,
          fps: 30,
          sampling_ratio: 0.1,
        },
        model,
        onResult: resultCallback,
      };

      // Add outputSchema if provided
      if (outputSchema) {
        visionConfig.outputSchema = outputSchema;
      }
      
      const vision = new RealtimeVision(visionConfig);

      visionRef.current = vision;
      console.log('Starting vision...');
      await vision.start();
      console.log('Vision started successfully');
      setIsActive(true);
      setIsLoading(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start camera';
      console.error('Error starting vision:', err);
      setError(errorMessage);
      setIsLoading(false);
      setIsActive(false);
      visionRef.current = null;
    }
  }, [apiUrl, apiKey, cameraFacing, processing, model, outputSchema, onResult, isActive]);

  const stop = useCallback(async () => {
    if (visionRef.current) {
      try {
        await visionRef.current.stop();
      } catch (err) {
        console.error('Error stopping vision:', err);
      }
      visionRef.current = null;
    }
    setIsActive(false);
    setIsLoading(false);
    setDescription(null);
    descriptionRef.current = null;
  }, []);

  const updatePrompt = useCallback((newPrompt: string) => {
    if (!visionRef.current || !isActive) {
      currentPromptRef.current = newPrompt;
      return;
    }

    try {
      console.log('Updating prompt to:', newPrompt);
      currentPromptRef.current = newPrompt;
      
      // Use the updatePrompt method if available
      if (visionRef.current && 'updatePrompt' in visionRef.current) {
        (visionRef.current as any).updatePrompt(newPrompt);
      } else {
        console.warn('updatePrompt method not available on RealtimeVision instance');
      }
    } catch (err) {
      console.error('Error updating prompt:', err);
      setError(`Failed to update prompt: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [isActive]);

  return {
    start,
    stop,
    updatePrompt,
    isActive,
    description,
    error,
    isLoading,
  };
}
