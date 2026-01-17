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
        apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'MISSING',
        prompt: currentPromptRef.current, 
        cameraFacing,
        processing,
        model,
        outputSchema,
      });
      
      // Validate API key is present
      if (!apiKey || apiKey.trim() === '') {
        throw new Error('API key is empty. Please set VITE_OVERSHOOT_API_KEY in your Vercel environment variables.');
      }
      
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

      // Add error event listeners before starting
      if (vision && typeof vision.on === 'function') {
        vision.on('error', (error: any) => {
          console.error('RealtimeVision error event:', error);
          setError(`Vision error: ${error?.message || JSON.stringify(error)}`);
          setIsLoading(false);
          setIsActive(false);
        });
        
        vision.on('close', () => {
          console.log('RealtimeVision connection closed');
          setIsActive(false);
        });
      }

      visionRef.current = vision;
      console.log('Starting vision...');
      console.log('API URL:', apiUrl);
      console.log('API Key present:', !!apiKey);
      
      // Add timeout to prevent hanging
      const startPromise = vision.start().catch((err) => {
        console.error('vision.start() rejected:', err);
        throw err;
      });
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Vision start timed out after 15 seconds. This usually means:\n1. API key is invalid or not set in Vercel\n2. Network connection issue\n3. Overshoot API is unreachable\n\nCheck Vercel environment variables and browser console for details.'));
        }, 15000);
      });
      
      try {
        await Promise.race([startPromise, timeoutPromise]);
        console.log('Vision started successfully');
        setIsActive(true);
        setIsLoading(false);
      } catch (err) {
        // If it's our timeout error, provide more context
        if (err instanceof Error && err.message.includes('timed out')) {
          console.error('Vision start timeout. Possible causes:');
          console.error('- API key not set in Vercel environment variables');
          console.error('- Invalid API key');
          console.error('- Network/CORS issue');
          console.error('- Overshoot API endpoint unreachable');
        }
        throw err;
      }
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
