import {
  TransitionType,
} from '../types/narration';
import type {
  NarrationContext,
  RefinedDescription,
  DescriptionEntry,
  OrchestratorConfig,
} from '../types/narration';

const DEFAULT_TRANSITION_DELAY = 500; // 0.5 seconds
const DEFAULT_CONTEXT_SIZE = 5;

export class NarrationOrchestrator {
  private context: NarrationContext;
  private transitionDelayMs: number;
  private transitionTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingDescription: string | null = null;
  private onRefinedReady: ((refined: RefinedDescription) => void) | null = null;

  constructor(config: OrchestratorConfig = {}) {
    this.transitionDelayMs = config.transitionDelayMs ?? DEFAULT_TRANSITION_DELAY;
    this.context = {
      descriptions: [],
      maxSize: config.contextSize ?? DEFAULT_CONTEXT_SIZE,
    };
  }

  /**
   * Process a new description with transition delay and refinement
   */
  processDescription(
    text: string,
    onReady: (refined: RefinedDescription) => void
  ): void {
    // Cancel any pending transition
    this.cancelPendingTransition();

    // Store the callback and description
    this.pendingDescription = text;
    this.onRefinedReady = onReady;

    // Start transition delay timer
    this.transitionTimer = setTimeout(() => {
      if (this.pendingDescription && this.onRefinedReady) {
        const refined = this.refineDescription(this.pendingDescription);
        this.addToContext(this.pendingDescription, refined.refinedText);
        this.onRefinedReady(refined);
        
        // Clear pending state
        this.pendingDescription = null;
        this.onRefinedReady = null;
      }
    }, this.transitionDelayMs);
  }

  /**
   * Cancel any pending transition
   */
  cancelPendingTransition(): void {
    if (this.transitionTimer) {
      clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }
    this.pendingDescription = null;
    this.onRefinedReady = null;
  }

  /**
   * Refine description based on context
   */
  private refineDescription(text: string): RefinedDescription {
    if (this.context.descriptions.length === 0) {
      // First description - no refinement needed
      return {
        originalText: text,
        refinedText: text,
        transitionType: TransitionType.NEW,
      };
    }

    const lastDescription = this.context.descriptions[this.context.descriptions.length - 1];
    const lastText = lastDescription.refinedText || lastDescription.text;

    // Simple text comparison
    const similarity = this.calculateSimilarity(text, lastText);
    
    if (similarity > 0.8) {
      // Very similar - likely continuation
      return this.handleContinuation(text, lastText);
    } else if (similarity > 0.3) {
      // Some similarity - likely update
      return this.handleUpdate(text, lastText);
    } else {
      // Very different - new scene
      return this.handleNew(text, lastText);
    }
  }

  /**
   * Handle continuation scenario
   */
  private handleContinuation(newText: string, lastText: string): RefinedDescription {
    const newElements = this.extractNewElements(newText, lastText);
    
    if (newElements.length > 0) {
      const refined = `The scene continues. ${newElements.join(', ')}`;
      return {
        originalText: newText,
        refinedText: refined,
        transitionType: TransitionType.CONTINUE,
        metadata: {
          newElements,
        },
      };
    }
    
    // Very similar, return original
    return {
      originalText: newText,
      refinedText: newText,
      transitionType: TransitionType.CONTINUE,
    };
  }

  /**
   * Handle update scenario
   */
  private handleUpdate(newText: string, lastText: string): RefinedDescription {
    const newElements = this.extractNewElements(newText, lastText);
    const removedElements = this.extractRemovedElements(newText, lastText);
    
    let refined = newText;
    
    if (removedElements.length > 0 && newElements.length > 0) {
      refined = `${removedElements.join(' and ')} ${removedElements.length === 1 ? 'has' : 'have'} changed. ${newElements.join(', ')}`;
    } else if (newElements.length > 0) {
      refined = `Now I see ${newElements.join(', ')}`;
    }
    
    return {
      originalText: newText,
      refinedText: refined,
      transitionType: TransitionType.UPDATE,
      metadata: {
        newElements,
        removedElements,
      },
    };
  }

  /**
   * Handle new scene scenario
   */
  private handleNew(newText: string, _lastText: string): RefinedDescription {
    return {
      originalText: newText,
      refinedText: newText,
      transitionType: TransitionType.NEW,
    };
  }

  /**
   * Extract new elements from text comparison
   */
  private extractNewElements(newText: string, lastText: string): string[] {
    const newWords = this.extractKeyPhrases(newText);
    const lastWords = this.extractKeyPhrases(lastText);
    
    return newWords.filter(phrase => !lastWords.includes(phrase));
  }

  /**
   * Extract removed elements from text comparison
   */
  private extractRemovedElements(newText: string, lastText: string): string[] {
    const newWords = this.extractKeyPhrases(newText);
    const lastWords = this.extractKeyPhrases(lastText);
    
    return lastWords.filter(phrase => !newWords.includes(phrase));
  }

  /**
   * Extract key phrases from text (simple implementation)
   */
  private extractKeyPhrases(text: string): string[] {
    // Extract common patterns: "a person", "a door", "text on board", etc.
    const phrases: string[] = [];
    
    // Match patterns like "a person", "the door", "menu board", etc.
    const patterns = [
      /(?:a|an|the)\s+(\w+(?:\s+\w+){0,2})/gi,
      /(\w+\s+board|\w+\s+sign|\w+\s+door|\w+\s+window)/gi,
      /(person|people|man|woman|child)/gi,
    ];
    
    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        phrases.push(...matches.map(m => m.toLowerCase().trim()));
      }
    });
    
    return [...new Set(phrases)]; // Remove duplicates
  }

  /**
   * Calculate similarity between two texts (simple word overlap)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }

  /**
   * Add description to context
   */
  private addToContext(text: string, refinedText: string): void {
    const entry: DescriptionEntry = {
      id: `${Date.now()}-${Math.random()}`,
      text,
      timestamp: Date.now(),
      refinedText,
    };

    this.context.descriptions.push(entry);
    
    // Maintain sliding window
    if (this.context.descriptions.length > this.context.maxSize) {
      this.context.descriptions.shift();
    }
  }

  /**
   * Clear context
   */
  clearContext(): void {
    this.cancelPendingTransition();
    this.context.descriptions = [];
  }

  /**
   * Get current context
   */
  getContext(): NarrationContext {
    return { ...this.context };
  }

  /**
   * Check if there's a pending transition
   */
  hasPendingTransition(): boolean {
    return this.transitionTimer !== null;
  }

  /**
   * Check if a new description is significantly different from the last one
   * Returns true if similarity is below threshold (meaning it's different enough to interrupt)
   */
  isSignificantlyDifferent(newText: string, similarityThreshold: number = 0.7): boolean {
    if (this.context.descriptions.length === 0) {
      return true; // First description is always "different"
    }

    const lastDescription = this.context.descriptions[this.context.descriptions.length - 1];
    const lastText = lastDescription.refinedText || lastDescription.text;
    const similarity = this.calculateSimilarity(newText, lastText);
    
    // If similarity is below threshold, it's significantly different
    return similarity < similarityThreshold;
  }
}
