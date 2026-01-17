import { useState, useEffect } from 'react';

interface DescriptionDisplayProps {
  description: string | null;
  isActive: boolean;
  showText?: boolean;
}

export function DescriptionDisplay({ description, isActive, showText = true }: DescriptionDisplayProps) {
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    if (description) {
      setHistory((prev) => {
        const newHistory = [description, ...prev].slice(0, 5); // Keep last 5 descriptions
        return newHistory;
      });
    }
  }, [description]);

  useEffect(() => {
    if (!isActive) {
      setHistory([]);
    }
  }, [isActive]);

  if (!showText) {
    return null;
  }

  return (
    <div className="description-display">
      <div className="description-current">
        {description ? (
          <p className="description-text">{description}</p>
        ) : isActive ? (
          <p className="description-placeholder">Analyzing environment...</p>
        ) : (
          <p className="description-placeholder">Press Start to begin describing the environment</p>
        )}
      </div>
      {history.length > 1 && (
        <div className="description-history">
          <h3>Recent descriptions:</h3>
          <ul>
            {history.slice(1).map((desc, index) => (
              <li key={index} className="history-item">
                {desc}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
