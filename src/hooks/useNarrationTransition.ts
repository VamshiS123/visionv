import { useRef, useCallback, useEffect } from 'react';
import { NarrationOrchestrator } from '../services/narrationOrchestrator';
import type { RefinedDescription, OrchestratorConfig } from '../types/narration';
import type { ObservationPriority } from '../types/batching';

interface UseNarrationTransitionOptions extends OrchestratorConfig {
  onRefinedReady?: (refined: RefinedDescription) => void;
  similarityThreshold?: number;
}

interface UseNarrationTransitionReturn {
  processDescription: (text: string, priority?: ObservationPriority) => void;
  clearContext: () => void;
  hasPendingTransition: () => boolean;
  cancelPendingTransition: () => void;
  isSignificantlyDifferent: (text: string, threshold?: number) => boolean;
}

export function useNarrationTransition(
  config: UseNarrationTransitionOptions = {}
): UseNarrationTransitionReturn {
  const orchestratorRef = useRef<NarrationOrchestrator | null>(null);
  const onRefinedReadyRef = useRef(config.onRefinedReady);

  // Update callback ref when it changes
  useEffect(() => {
    onRefinedReadyRef.current = config.onRefinedReady;
  }, [config.onRefinedReady]);

  // Initialize orchestrator
  if (!orchestratorRef.current) {
    orchestratorRef.current = new NarrationOrchestrator({
      transitionDelayMs: config.transitionDelayMs,
      contextSize: config.contextSize,
    });
  }

  const processDescription = useCallback(
    (text: string, _priority: ObservationPriority = 'medium') => {
      if (orchestratorRef.current) {
        const callback = (refined: RefinedDescription) => {
          if (onRefinedReadyRef.current) {
            onRefinedReadyRef.current(refined);
          }
        };
        orchestratorRef.current.processDescription(text, callback);
      }
    },
    []
  );

  const clearContext = useCallback(() => {
    if (orchestratorRef.current) {
      orchestratorRef.current.clearContext();
    }
  }, []);

  const hasPendingTransition = useCallback((): boolean => {
    if (orchestratorRef.current) {
      return orchestratorRef.current.hasPendingTransition();
    }
    return false;
  }, []);

  const cancelPendingTransition = useCallback(() => {
    if (orchestratorRef.current) {
      orchestratorRef.current.cancelPendingTransition();
    }
  }, []);

  const isSignificantlyDifferent = useCallback((text: string, threshold?: number): boolean => {
    if (orchestratorRef.current) {
      return orchestratorRef.current.isSignificantlyDifferent(text, threshold ?? config.similarityThreshold);
    }
    return true; // Default to true if orchestrator not initialized
  }, [config.similarityThreshold]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (orchestratorRef.current) {
        orchestratorRef.current.clearContext();
      }
    };
  }, []);

  return {
    processDescription,
    clearContext,
    hasPendingTransition,
    cancelPendingTransition,
    isSignificantlyDifferent,
  };
}
