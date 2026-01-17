import { useState, useRef, useEffect } from 'react';
import { useQA } from '../hooks/useQA';
import './QASection.css';

export function QASection() {
  const [question, setQuestion] = useState('');
  const { askQuestion, answer, isLoading, error } = useQA();
  const questionInputRef = useRef<HTMLInputElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  // Announce status changes to screen readers
  useEffect(() => {
    if (statusRef.current) {
      if (isLoading) {
        statusRef.current.textContent = 'Thinking...';
      } else if (error) {
        statusRef.current.textContent = `Error: ${error}`;
      } else if (answer) {
        statusRef.current.textContent = 'Answer received';
      } else {
        statusRef.current.textContent = '';
      }
    }
  }, [isLoading, error, answer]);

  // Focus answer region when answer is received
  useEffect(() => {
    if (answer && answerRef.current) {
      answerRef.current.focus();
    }
  }, [answer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim() && !isLoading) {
      await askQuestion(question);
      // Keep focus on input for next question
      setTimeout(() => {
        questionInputRef.current?.focus();
      }, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setQuestion('');
      questionInputRef.current?.focus();
    }
  };

  return (
    <section 
      className="qa-section" 
      aria-labelledby="qa-heading"
    >
      <h2 id="qa-heading">Ask Questions About Your Environment</h2>
      
      {/* Screen reader status announcement */}
      <div 
        ref={statusRef}
        className="sr-only" 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
      />

      <form onSubmit={handleSubmit} className="qa-form">
        <label htmlFor="question-input" className="qa-label">
          Enter your question:
        </label>
        <div className="qa-input-group">
          <input
            id="question-input"
            ref={questionInputRef}
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., What obstacles are ahead?"
            disabled={isLoading}
            className="qa-input"
            aria-label="Question input"
            aria-describedby="question-hint"
            aria-required="true"
          />
          <button
            type="submit"
            disabled={isLoading || !question.trim()}
            className="qa-submit-button"
            aria-label="Submit question"
          >
            {isLoading ? 'Asking...' : 'Ask'}
          </button>
        </div>
        <p id="question-hint" className="qa-hint">
          Press Enter to submit, Escape to clear
        </p>
      </form>

      {error && (
        <div 
          className="qa-error" 
          role="alert"
          aria-live="assertive"
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {answer && (
        <div 
          ref={answerRef}
          className="qa-answer"
          role="region"
          aria-label="Answer"
          tabIndex={-1}
        >
          <h3 className="qa-answer-heading">Answer:</h3>
          <p className="qa-answer-text">{answer}</p>
        </div>
      )}
    </section>
  );
}
