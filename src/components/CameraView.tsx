import { useEffect, useRef } from 'react';

interface CameraViewProps {
  isActive: boolean;
}

export function CameraView({ isActive }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isActive && videoRef.current) {
      // The Overshoot SDK handles the camera stream internally,
      // but we can optionally show a preview
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.error('Error accessing camera:', err);
          // Provide user-friendly error messages
          let errorMessage = 'Camera access failed. ';
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            errorMessage += 'Please allow camera access in your browser settings.';
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            errorMessage += 'No camera found on this device.';
          } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            errorMessage += 'Camera is already in use by another application.';
          } else {
            errorMessage += `Error: ${err.message || err.name}`;
          }
          alert(errorMessage);
        });
    } else {
      // Stop the stream when inactive
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
    }

    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, [isActive]);

  if (!isActive) {
    return null;
  }

  return (
    <div className="camera-view">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="camera-preview"
      />
    </div>
  );
}
