import { useEffect, useRef, useState } from 'react';

interface CameraViewProps {
  isActive: boolean;
}

export function CameraView({ isActive }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasTriedAccess, setHasTriedAccess] = useState(false);

  // Try to access camera immediately when component mounts (before SDK starts)
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || hasTriedAccess) {
      return;
    }

    // Try to get camera access immediately when component mounts
    console.log('Attempting to access camera for preview...');
    navigator.mediaDevices
      .getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      })
      .then((stream) => {
        console.log('Camera preview accessed successfully (before SDK)');
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setError(null);
        }
        setHasTriedAccess(true);
      })
      .catch((err) => {
        console.log('Initial camera access failed, will retry:', err.name);
        setHasTriedAccess(true);
        // Don't set error yet - will retry when isActive becomes true
      });
  }, [hasTriedAccess]);

  useEffect(() => {
    if (!isActive) {
      // Clean up when inactive
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setError(null);
      setHasTriedAccess(false); // Reset to allow retry on next activation
      return;
    }

    // If we already have a stream, don't try again
    if (streamRef.current) {
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera not supported in this browser');
      return;
    }

    let isMounted = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const startCamera = (attempt: number = 0) => {
      // Try immediately first, then retry with delays
      const delay = attempt === 0 ? 0 : Math.min(500 * attempt, 2000);
      
      const timer = setTimeout(() => {
        if (!isMounted) return;
        
        navigator.mediaDevices
          .getUserMedia({ 
            video: { 
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            } 
          })
          .then((stream) => {
            if (!isMounted) {
              stream.getTracks().forEach(track => track.stop());
              return;
            }
            
            console.log('Camera preview accessed successfully');
            streamRef.current = stream;
            
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              setError(null);
            }
          })
          .catch((err) => {
            if (!isMounted) return;
            
            console.log(`Camera access attempt ${attempt + 1} failed:`, err.name);
            
            // If camera is busy, try again with exponential backoff
            if (err.name === 'NotReadableError' || err.name === 'TrackStartError' || err.name === 'AbortError') {
              if (attempt < 5) {
                console.log(`Camera busy, retrying in ${delay}ms... (${attempt + 1}/5)`);
                retryTimer = setTimeout(() => {
                  if (isMounted) {
                    startCamera(attempt + 1);
                  }
                }, delay);
              } else {
                console.warn('Camera preview unavailable after retries - SDK may be using camera exclusively');
                setError('Camera preview unavailable');
              }
            } else if (err.name === 'NotAllowedError') {
              setError('Camera permission denied');
            } else if (err.name === 'NotFoundError') {
              setError('No camera found');
            } else {
              console.warn('Camera preview error:', err);
              // Still retry for unknown errors
              if (attempt < 3) {
                retryTimer = setTimeout(() => {
                  if (isMounted) {
                    startCamera(attempt + 1);
                  }
                }, 1000 * (attempt + 1));
              } else {
                setError('Camera preview unavailable');
              }
            }
          });
      }, delay);

      return timer;
    };

    const timer = startCamera();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      if (retryTimer) clearTimeout(retryTimer);
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [isActive]);

  if (!isActive) {
    return null;
  }

  return (
    <div className="camera-view">
      {error && (
        <div className="camera-status">
          <p>{error}</p>
          <p className="camera-status-note">Overshoot SDK is still processing video</p>
        </div>
      )}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="camera-preview"
        style={{ display: error ? 'none' : 'block' }}
      />
    </div>
  );
}
