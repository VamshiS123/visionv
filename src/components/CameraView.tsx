import { useEffect, useRef, useState } from 'react';

interface CameraViewProps {
  isActive: boolean;
}

export function CameraView({ isActive }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only try to access camera if active and mediaDevices is available
    if (!isActive || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return;
    }

    let isMounted = true;

    // The Overshoot SDK handles the camera stream internally,
    // but we can optionally show a preview
    // Use a timeout to avoid conflicts with SDK initialization
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
            // Component unmounted, stop the stream
            stream.getTracks().forEach(track => track.stop());
            return;
          }
          
          streamRef.current = stream;
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setError(null);
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          
          console.warn('Camera preview not available (Overshoot SDK may be using camera):', err);
          // Don't show error if it's a NotAllowedError or NotFoundError - SDK handles it
          if (err.name !== 'NotAllowedError' && err.name !== 'NotFoundError' && err.name !== 'NotReadableError') {
            setError('Camera preview unavailable');
          }
        });
    }, 500); // Small delay to let SDK initialize first

    return () => {
      isMounted = false;
      clearTimeout(timer);
      
      // Clean up stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
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
        <div className="camera-error">
          <p>{error}</p>
          <p className="camera-error-note">Camera is being used by Overshoot SDK</p>
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
