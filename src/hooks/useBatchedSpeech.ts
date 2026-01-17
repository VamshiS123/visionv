import { useState, useRef, useCallback, useEffect } from 'react';
import { BatchedSpeechManager } from '../services/batchedSpeechManager';
import type { UseBatchedSpeechReturn, ObservationPriority, BatchedSpeechConfig } from '../types/batching';

export function useBatchedSpeech(config: BatchedSpeechConfig = {}): UseBatchedSpeechReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const managerRef = useRef<BatchedSpeechManager | null>(null);

  // Initialize manager
  if (!managerRef.current) {
    managerRef.current = new BatchedSpeechManager(config);
  }

  // Sync state with manager
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;

    const checkInterval = setInterval(() => {
      const speaking = manager.getIsSpeaking();
      const pending = manager.getPendingCount();
      setIsSpeaking(speaking);
      setPendingCount(pending);
    }, 100);

    return () => {
      clearInterval(checkInterval);
    };
  }, []);

  const addObservation = useCallback((observation: { narration: string; priority: ObservationPriority }) => {
    if (managerRef.current) {
      managerRef.current.addObservation(observation);
      setIsSpeaking(managerRef.current.getIsSpeaking());
      setPendingCount(managerRef.current.getPendingCount());
    }
  }, []);

  const interrupt = useCallback((text: string) => {
    if (managerRef.current) {
      managerRef.current.interrupt(text);
      setIsSpeaking(managerRef.current.getIsSpeaking());
      setPendingCount(managerRef.current.getPendingCount());
    }
  }, []);

  const stop = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.stop();
      setIsSpeaking(false);
      setPendingCount(0);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (managerRef.current) {
        managerRef.current.destroy();
      }
    };
  }, []);

  const testSpeech = useCallback((text?: string) => {
    if (managerRef.current) {
      managerRef.current.testSpeech(text);
    }
  }, []);

  const forceProcessBatch = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.forceProcessBatch();
      setIsSpeaking(managerRef.current.getIsSpeaking());
      setPendingCount(managerRef.current.getPendingCount());
    }
  }, []);

  return {
    addObservation,
    interrupt,
    stop,
    testSpeech,
    forceProcessBatch,
    isSpeaking,
    pendingCount,
  };
}
