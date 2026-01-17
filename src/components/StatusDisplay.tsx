interface StatusDisplayProps {
  isActive: boolean;
  isSpeaking: boolean;
  pendingCount: number;
  isTransitioning?: boolean;
}

export function StatusDisplay({
  isActive,
  isSpeaking,
  pendingCount,
  isTransitioning = false,
}: StatusDisplayProps) {
  return (
    <div className="status-display">
      <div className="status-row">
        <span className={`status-indicator ${isActive ? 'active' : 'inactive'}`}>
          {isActive ? '● Active' : '○ Inactive'}
        </span>
        {isActive && (
          <>
            {isTransitioning ? (
              <span className="status-indicator transitioning">
                <span className="pulse-dot"></span> Processing...
              </span>
            ) : isSpeaking ? (
              <span className="status-indicator speaking">
                <span className="pulse-dot"></span> Speaking
              </span>
            ) : pendingCount > 0 ? (
              <span className="status-indicator batching">
                Batching ({pendingCount})
              </span>
            ) : (
              <span className="status-indicator ready">Ready</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
