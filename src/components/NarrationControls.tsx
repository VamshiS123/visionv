interface NarrationControlsProps {
  isActive: boolean;
  isLoading: boolean;
  voiceEnabled: boolean;
  textDisplayEnabled: boolean;
  isSpeaking: boolean;
  pendingCount: number;
  onStart: () => void;
  onStop: () => void;
  onVoiceToggle: () => void;
  onTextToggle: () => void;
  onStopSpeech: () => void;
}

export function NarrationControls({
  isActive,
  isLoading,
  voiceEnabled,
  textDisplayEnabled,
  isSpeaking,
  pendingCount,
  onStart,
  onStop,
  onVoiceToggle,
  onTextToggle,
  onStopSpeech,
}: NarrationControlsProps) {
  return (
    <div className="narration-controls">
      <div className="controls-row">
        <button
          onClick={isActive ? onStop : onStart}
          disabled={isLoading}
          className={`control-button ${isActive ? 'stop' : 'start'}`}
        >
          {isLoading ? 'Starting...' : isActive ? 'Stop' : 'Start'}
        </button>
      </div>

      <div className="controls-row">
        <label className="control-toggle">
          <input
            type="checkbox"
            checked={voiceEnabled}
            onChange={onVoiceToggle}
            className="toggle-input"
            disabled={!isActive}
          />
          <span className="toggle-label">
            <span className="toggle-icon">🔊</span>
            Voice Narration
          </span>
        </label>

        <label className="control-toggle">
          <input
            type="checkbox"
            checked={textDisplayEnabled}
            onChange={onTextToggle}
            className="toggle-input"
            disabled={!isActive}
          />
          <span className="toggle-label">
            <span className="toggle-icon">📝</span>
            Show Text
          </span>
        </label>
      </div>

      {voiceEnabled && isActive && (isSpeaking || pendingCount > 0) && (
        <div className="voice-controls-row">
          <button onClick={onStopSpeech} className="stop-speech-button">
            Stop Speech
          </button>
        </div>
      )}
    </div>
  );
}
