import { useState, useRef, useCallback, useEffect } from 'react';
import { VisionVoiceSpeechManager } from '../services/visionVoiceSpeechManager';
import type { Observation } from '../services/visionVoiceSpeechManager';

interface UseVisionVoiceSpeechConfig {
  dedupeWindowMs?: number;
  speechRate?: number;
}

interface UseVisionVoiceSpeechReturn {
  addObservation: (observation: Observation) => void;
  interrupt: (text: string) => void;
  stop: () => void;
  isSpeaking: boolean;
  queueLength: number;
}

export function useVisionVoiceSpeech(
  config: UseVisionVoiceSpeechConfig = {}
): UseVisionVoiceSpeechReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  const managerRef = useRef<VisionVoiceSpeechManager | null>(null);

  // Initialize manager
  if (!managerRef.current) {
    managerRef.current = new VisionVoiceSpeechManager(config);
  }

  // Sync state with manager
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;

    const checkInterval = setInterval(() => {
      setIsSpeaking(manager.getIsSpeaking());
      setQueueLength(manager.getQueueLength());
    }, 100);

    return () => {
      clearInterval(checkInterval);
    };
  }, []);

  const addObservation = useCallback((observation: Observation) => {
    if (managerRef.current) {
      managerRef.current.addObservation(observation);
      setIsSpeaking(managerRef.current.getIsSpeaking());
      setQueueLength(managerRef.current.getQueueLength());
    }
  }, []);

  const interrupt = useCallback((text: string) => {
    if (managerRef.current) {
      managerRef.current.interrupt(text);
      setIsSpeaking(managerRef.current.getIsSpeaking());
      setQueueLength(managerRef.current.getQueueLength());
    }
  }, []);

  const stop = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.stop();
      setIsSpeaking(false);
      setQueueLength(0);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (managerRef.current) {
        managerRef.current.stop();
      }
    };
  }, []);

  return {
    addObservation,
    interrupt,
    stop,
    isSpeaking,
    queueLength,
  };
}
