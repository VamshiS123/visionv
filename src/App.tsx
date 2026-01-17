import { useState, useEffect, useRef } from 'react';
import { useOvershoot } from './hooks/useOvershoot';
import { useBatchedSpeech } from './hooks/useBatchedSpeech';
import { CameraView } from './components/CameraView';
import { DescriptionDisplay } from './components/DescriptionDisplay';
import { NarrationControls } from './components/NarrationControls';
import { StatusDisplay } from './components/StatusDisplay';
import './App.css';

const API_URL = import.meta.env.VITE_OVERSHOOT_API_URL || 'https://cluster1.overshoot.ai/api/v0.2';
const API_KEY = import.meta.env.VITE_OVERSHOOT_API_KEY || '';
const MURF_API_KEY = import.meta.env.VITE_MURF_API_KEY || '';
const MURF_VOICE_ID = import.meta.env.VITE_MURF_VOICE_ID || 'en-US-natalie';
const DEFAULT_PROMPT = 'Describe navigation info for a blind person. Be concise (under 12 words). Use clock positions and distances. If the environment hasn\'t changed significantly, respond with just "unchanged".';

function App() {
  const [showCamera, setShowCamera] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [textDisplayEnabled, setTextDisplayEnabled] = useState(true);
  
  // Use refs to always get current values in callbacks
  const voiceEnabledRef = useRef(voiceEnabled);
  const isActiveRef = useRef(false);
  
  // Keep refs in sync with state
  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);
  
  const {
    addObservation,
    stop: stopSpeech,
    isSpeaking,
    pendingCount,
    testSpeech,
  } = useBatchedSpeech({
    batchInterval: 1000, // 1 second - reduced from 3 seconds for faster speech
    apiKey: MURF_API_KEY,
    voiceId: MURF_VOICE_ID,
    format: 'MP3',
    sampleRate: 44100,
    pitch: 0,
    rate: 0,
  });

  const {
    start,
    stop,
    isActive,
    description,
    error,
    isLoading,
  } = useOvershoot({
    apiUrl: API_URL,
    apiKey: API_KEY,
    prompt: DEFAULT_PROMPT,
    cameraFacing: 'environment',
    processing: {
      clip_length_seconds: 1.0,  // Reduced from 1.5 for faster processing (0.5 was too low for API)
      delay_seconds: 0.8,         // Reduced from 1.5 for faster updates (minimum likely ~0.8)
      fps: 30,
      sampling_ratio: 0.1,
    },
    outputSchema: {
      type: 'object',
      properties: {
        narration: { type: 'string' },
        priority: { 
          type: 'string', 
          enum: ['critical', 'high', 'medium', 'low'] 
        }
      },
      required: ['narration', 'priority']
    },
    onResult: (result) => {
      // Use refs to get current values instead of stale closure values
      const currentVoiceEnabled = voiceEnabledRef.current;
      const currentIsActive = isActiveRef.current;
      console.log('Overshoot onResult called:', { voiceEnabled: currentVoiceEnabled, isActive: currentIsActive, result });
      if (!currentVoiceEnabled || !currentIsActive) {
        console.log('Skipping observation - voice not enabled or not active');
        return;
      }

      try {
        // Try to parse as JSON (structured output)
        const observation = JSON.parse(result.result);
        console.log('Parsed observation:', observation);
        
        // Skip if unchanged
        if (observation.narration === 'unchanged' || 
            observation.narration?.toLowerCase() === 'unchanged') {
          console.log('Skipping unchanged observation');
          return;
        }

        if (observation.narration && observation.priority) {
          console.log('Adding structured observation to speech manager:', observation);
          addObservation({
            narration: observation.narration,
            priority: observation.priority,
          });
        } else {
          // Fallback: if not structured, treat as medium priority
          console.log('Received unstructured result, treating as medium priority');
          addObservation({
            narration: result.result,
            priority: 'medium',
          });
        }
      } catch (e) {
        // If parsing fails, treat as plain text with medium priority
        console.log('Parse error, treating as plain text:', e, result.result);
        if (result.result && result.result.toLowerCase() !== 'unchanged') {
          addObservation({
            narration: result.result,
            priority: 'medium',
          });
        }
      }
    },
  });

  // Keep isActive ref in sync
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // Clear speech when stopping
  useEffect(() => {
    if (!isActive) {
      stopSpeech();
    }
  }, [isActive, stopSpeech]);

  const handleStart = async () => {
    // Check if running on HTTPS (required for camera access)
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      alert('Camera access requires HTTPS. Please access this app via HTTPS.');
      return;
    }

    // Check if mediaDevices API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Camera access is not supported in this browser. Please use a modern browser like Chrome, Safari, or Firefox.');
      return;
    }

    if (!API_KEY) {
      alert('Overshoot API key is not configured. Please set VITE_OVERSHOOT_API_KEY in your Vercel environment variables.');
      return;
    }
    
    try {
      await start();
      setShowCamera(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start camera';
      alert(`Failed to start: ${errorMsg}. Please check your browser console for details.`);
    }
  };

  const handleStop = async () => {
    // Stop Overshoot SDK
    await stop();
    
    // Stop any ongoing speech
    stopSpeech();
    
    setShowCamera(false);
  };

  const handleVoiceToggle = () => {
    const newVoiceEnabled = !voiceEnabled;
    setVoiceEnabled(newVoiceEnabled);
    
    if (!newVoiceEnabled) {
      // Disabling voice - stop speech
      stopSpeech();
    } else {
      // Enabling voice - check if Murf AI API key is configured
      if (!MURF_API_KEY) {
        alert('Murf AI API key is required for voice narration. Please set VITE_MURF_API_KEY in your .env file.');
        setVoiceEnabled(false);
        return;
      }
      
      // Test speech synthesis with a simple phrase
      setTimeout(() => {
        testSpeech('Voice narration enabled');
      }, 100);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>VisionVoice</h1>
        <p className="subtitle">Continuous ambient narration with Overshoot SDK</p>
      </header>

      <main className="app-main">
        {(error) && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {showCamera && <CameraView isActive={isActive} />}

        {!MURF_API_KEY && (
          <div className="error-message" style={{ marginBottom: '1rem' }}>
            <strong>Warning:</strong> Murf AI API key is not configured. Please set VITE_MURF_API_KEY in your Vercel environment variables for voice narration.
          </div>
        )}

        {!API_KEY && (
          <div className="error-message" style={{ marginBottom: '1rem' }}>
            <strong>Error:</strong> Overshoot API key is not configured. Please set VITE_OVERSHOOT_API_KEY in your Vercel environment variables.
          </div>
        )}

        <NarrationControls
          isActive={isActive}
          isLoading={isLoading}
          voiceEnabled={voiceEnabled}
          textDisplayEnabled={textDisplayEnabled}
          isSpeaking={isSpeaking}
          pendingCount={pendingCount}
          onStart={handleStart}
          onStop={handleStop}
          onVoiceToggle={handleVoiceToggle}
          onTextToggle={() => setTextDisplayEnabled(!textDisplayEnabled)}
          onStopSpeech={() => {
            stopSpeech();
          }}
        />

        <StatusDisplay
          isActive={isActive}
          isSpeaking={isSpeaking}
          pendingCount={pendingCount}
          isTransitioning={false}
        />

        <DescriptionDisplay 
          description={description} 
          isActive={isActive} 
          showText={textDisplayEnabled}
        />
      </main>
    </div>
  );
}

export default App;
