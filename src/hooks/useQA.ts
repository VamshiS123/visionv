import { useState, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { fetchRecentObservations } from '../services/observationStorage';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// Initialize Gemini client
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

export interface UseQAReturn {
  askQuestion: (question: string) => Promise<string>;
  answer: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useQA(): UseQAReturn {
  const [answer, setAnswer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const askQuestion = useCallback(async (question: string): Promise<string> => {
    if (!genAI) {
      const errorMsg = 'Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your .env file.';
      setError(errorMsg);
      return errorMsg;
    }

    if (!question.trim()) {
      const errorMsg = 'Please enter a question.';
      setError(errorMsg);
      return errorMsg;
    }

    setIsLoading(true);
    setError(null);
    setAnswer(null);

    try {
      // Fetch recent observations for context
      const observations = await fetchRecentObservations(20);
      
      // Build context from observations
      const contextText = observations.length > 0
        ? observations
            .map((obs, idx) => `${idx + 1}. ${obs.narration}${obs.priority ? ` (${obs.priority})` : ''}`)
            .join('\n')
        : 'No previous observations available.';

      // Create prompt with context
      const prompt = `You are a helpful assistant for a visually impaired person. Answer their question based on the following recent observations of their environment:

Recent Observations:
${contextText}

User Question: ${question}

Provide a clear, concise answer that is helpful for someone who is visually impaired. If the question cannot be answered based on the observations, say so politely.`;

      // Get Gemini model
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      
      // Generate response
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      setAnswer(text);
      return text;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get answer. Please try again.';
      setError(errorMsg);
      console.error('Error asking question:', err);
      return errorMsg;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    askQuestion,
    answer,
    isLoading,
    error,
  };
}
