import { useEffect, useRef, useState } from 'react';

interface CameraViewProps {
  isActive: boolean;
}

export function CameraView({ isActive }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

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
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera not supported in this browser');
      return;
    }

    let isMounted = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const startCamera = () => {
      // Try to access camera with a delay to let SDK initialize first
      const timer = setTimeout(() => {
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
            
            streamRef.current = stream;
            
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              setError(null);
              setRetryCount(0);
            }
          })
          .catch((err) => {
            if (!isMounted) return;
            
            // If camera is busy (likely SDK using it), try again after a delay
            if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
              if (retryCount < 3) {
                console.log(`Camera busy, retrying... (${retryCount + 1}/3)`);
                setRetryCount(prev => prev + 1);
                retryTimer = setTimeout(() => {
                  if (isMounted) {
                    startCamera();
                  }
                }, 1000 * (retryCount + 1)); // Exponential backoff
              } else {
                console.warn('Camera preview unavailable - SDK may be using camera');
                setError('Camera preview unavailable');
              }
            } else if (err.name === 'NotAllowedError') {
              setError('Camera permission denied');
            } else if (err.name === 'NotFoundError') {
              setError('No camera found');
            } else {
              console.warn('Camera preview error:', err);
              setError('Camera preview unavailable');
            }
          });
      }, 1000); // Wait 1 second for SDK to initialize

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
  }, [isActive, retryCount]);

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
