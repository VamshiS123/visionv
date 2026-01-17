export enum TransitionType {
  NEW = 'NEW',
  UPDATE = 'UPDATE',
  CONTINUE = 'CONTINUE',
  REMOVAL = 'REMOVAL',
}

export interface DescriptionEntry {
  id: string;
  text: string;
  timestamp: number;
  refinedText?: string;
}

export interface NarrationContext {
  descriptions: DescriptionEntry[];
  maxSize: number;
}

export interface RefinedDescription {
  originalText: string;
  refinedText: string;
  transitionType: TransitionType;
  metadata?: {
    newElements?: string[];
    unchangedElements?: string[];
    removedElements?: string[];
  };
}

export interface OrchestratorConfig {
  transitionDelayMs?: number;
  contextSize?: number;
}
