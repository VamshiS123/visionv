import { useState, useEffect, useRef } from 'react';
import { useOvershoot } from './hooks/useOvershoot';
import { useBatchedSpeech } from './hooks/useBatchedSpeech';
import { useNarrationTransition } from './hooks/useNarrationTransition';
import { CameraView } from './components/CameraView';
import { DescriptionDisplay } from './components/DescriptionDisplay';
import { NarrationControls } from './components/NarrationControls';
import { StatusDisplay } from './components/StatusDisplay';
import type { ObservationPriority } from './types/batching';
import type { RefinedDescription } from './types/narration';
import './App.css';

const API_URL = import.meta.env.VITE_OVERSHOOT_API_URL || 'https://cluster1.overshoot.ai/api/v0.2';
const API_KEY = import.meta.env.VITE_OVERSHOOT_API_KEY || '';
const MURF_API_KEY = import.meta.env.VITE_MURF_API_KEY || '';
const MURF_VOICE_ID = import.meta.env.VITE_MURF_VOICE_ID || 'en-US-natalie';
const TRANSITION_DELAY = parseInt(import.meta.env.VITE_NARRATION_TRANSITION_DELAY || '500', 10);
const CONTEXT_SIZE = parseInt(import.meta.env.VITE_NARRATION_CONTEXT_SIZE || '5', 10);
const DEFAULT_PROMPT = 'Describe what you see in the environment, focusing on navigation-critical information';

function App() {
  const [showCamera, setShowCamera] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [textDisplayEnabled, setTextDisplayEnabled] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  
  const {
    start,
    stop,
    updatePrompt,
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
      clip_length_seconds: 1,
      delay_seconds: 1,
      fps: 30,
      sampling_ratio: 0.1,
    },
  });

  const {
    addObservation,
    interrupt,
    stop: stopSpeech,
    testSpeech,
    isSpeaking,
    pendingCount,
  } = useBatchedSpeech({
    batchInterval: 3000, // Increased to 3 seconds to allow speech to play
    apiKey: MURF_API_KEY,
    voiceId: MURF_VOICE_ID,
    format: 'MP3',
    sampleRate: 44100,
    rate: 10, // Slightly faster speech (0-50 range)
  });

  const {
    processDescription,
    clearContext,
    hasPendingTransition,
    cancelPendingTransition,
    isSignificantlyDifferent,
  } = useNarrationTransition({
    transitionDelayMs: TRANSITION_DELAY,
    contextSize: CONTEXT_SIZE,
    similarityThreshold: 0.7,
    onRefinedReady: (refined: RefinedDescription) => {
      console.log('Refined description ready:', refined.refinedText);
      setIsTransitioning(false);
      
      // Determine priority based on transition type and content
      // Use 'medium' by default to allow batching instead of interrupting
      let priority: ObservationPriority = 'medium';
      
      // Only mark as critical for truly urgent items
      const criticalKeywords = ['hazard', 'danger', 'obstacle', 'step', 'stairs', 'exit', 'door', 'stop', 'warning'];
      const textLower = refined.refinedText.toLowerCase();
      const hasCritical = criticalKeywords.some(keyword => textLower.includes(keyword));
      
      if (hasCritical) {
        priority = 'critical';
      } else if (refined.transitionType === 'NEW') {
        // New scenes get high priority but still batch
        priority = 'high';
      }
      
      console.log(`Adding observation with priority: ${priority}`);
      
      // Add to batched speech
      addObservation({
        narration: refined.refinedText,
        priority,
      });
    },
  });

  // Use refs to avoid stale closures
  const processDescriptionRef = useRef(processDescription);
  const isSignificantlyDifferentRef = useRef(isSignificantlyDifferent);
  const cancelPendingTransitionRef = useRef(cancelPendingTransition);
  const stopSpeechRef = useRef(stopSpeech);
  const addObservationRef = useRef(addObservation);

  useEffect(() => {
    processDescriptionRef.current = processDescription;
    isSignificantlyDifferentRef.current = isSignificantlyDifferent;
    cancelPendingTransitionRef.current = cancelPendingTransition;
    stopSpeechRef.current = stopSpeech;
    addObservationRef.current = addObservation;
  }, [processDescription, isSignificantlyDifferent, cancelPendingTransition, stopSpeech, addObservation]);

  // Track previous description to detect changes
  const previousDescriptionRef = useRef<string | null>(null);

  // Process description through orchestrator when it arrives
  useEffect(() => {
    if (description && voiceEnabled && isActive) {
      const isFirstDescription = previousDescriptionRef.current === null;
      const isCurrentlySpeaking = isSpeaking || isTransitioning;
      
      // Check if description is significantly different (similarity < 0.7)
      const descriptionIsDifferent = isFirstDescription || 
        isSignificantlyDifferentRef.current(description, 0.7);
      
      // Only interrupt if:
      // 1. It's the first description, OR
      // 2. Description is significantly different AND we're currently speaking
      const shouldInterrupt = isFirstDescription || (descriptionIsDifferent && isCurrentlySpeaking);
      
      if (shouldInterrupt) {
        console.log('Processing significantly different description:', description);
        
        // For first description, always process
        // For subsequent descriptions, only interrupt if we're actually speaking
        // (not just transitioning or processing)
        if (isFirstDescription) {
          // First description - process immediately
          setIsTransitioning(true);
          processDescriptionRef.current(description, 'high');
          previousDescriptionRef.current = description;
        } else if (isCurrentlySpeaking) {
          // Currently speaking - add to batch with high priority instead of interrupting
          // This allows current speech to finish while queuing the new one
          console.log('Currently speaking, adding to batch instead of interrupting');
          setIsTransitioning(true);
          processDescriptionRef.current(description, 'high');
          previousDescriptionRef.current = description;
        } else {
          // Not speaking - process normally
          setIsTransitioning(true);
          processDescriptionRef.current(description, 'high');
          previousDescriptionRef.current = description;
        }
      } else if (!isCurrentlySpeaking && descriptionIsDifferent) {
        // Not currently speaking, but description is different - start processing
        console.log('Starting processing for new description:', description);
        setIsTransitioning(true);
        
        processDescriptionRef.current(description, 'medium');
        
        previousDescriptionRef.current = description;
      } else {
        // Description is similar - don't add to batch to avoid duplicates
        console.log('Description is similar, skipping to avoid duplicates');
        // Still update previous description for future comparisons
        previousDescriptionRef.current = description;
      }
    } else if (!description) {
      // Clear previous description when description is cleared
      previousDescriptionRef.current = null;
    }
  }, [description, voiceEnabled, isActive, isSpeaking, isTransitioning]);

  // Clear context and speech when stopping
  useEffect(() => {
    if (!isActive) {
      stopSpeechRef.current();
      clearContext();
      setIsTransitioning(false);
      previousDescriptionRef.current = null;
    }
  }, [isActive, clearContext]);

  const handleStart = async () => {
    if (!API_KEY) {
      alert('Please set VITE_OVERSHOOT_API_KEY in your .env file');
      return;
    }
    await start();
    setShowCamera(true);
  };

  const handleStop = async () => {
    // Stop Overshoot SDK
    await stop();
    
    // Stop any ongoing speech
    stopSpeechRef.current();
    
    // Clear all state
    clearContext();
    cancelPendingTransition();
    setIsTransitioning(false);
    previousDescriptionRef.current = null;
    setShowCamera(false);
  };

  // Check Murf AI API key on mount
  useEffect(() => {
    if (!MURF_API_KEY) {
      setSpeechSupported(false);
      console.warn('Murf AI API key not configured');
    } else {
      setSpeechSupported(true);
      console.log('Murf AI API key configured');
    }
  }, []);

  const handleVoiceToggle = () => {
    const newVoiceEnabled = !voiceEnabled;
    setVoiceEnabled(newVoiceEnabled);
    
    if (!newVoiceEnabled) {
      // Disabling voice - stop speech and clear context
      stopSpeechRef.current();
      clearContext();
      cancelPendingTransition();
      setIsTransitioning(false);
    } else {
      // Enabling voice - check if Murf AI API key is configured
      if (!speechSupported || !MURF_API_KEY) {
        alert('Murf AI API key is required. Please set VITE_MURF_API_KEY in your .env file.');
        setVoiceEnabled(false);
        return;
      }
      
      // Test speech synthesis with a simple phrase
      // Use a small delay to ensure the manager is ready
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

        {!speechSupported && (
          <div className="error-message" style={{ marginBottom: '1rem' }}>
            <strong>Warning:</strong> Murf AI API key is not configured. Please set VITE_MURF_API_KEY in your .env file.
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
            stopSpeechRef.current();
            cancelPendingTransition();
            setIsTransitioning(false);
          }}
        />

        <StatusDisplay
          isActive={isActive}
          isSpeaking={isSpeaking}
          pendingCount={pendingCount}
          isTransitioning={isTransitioning}
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
