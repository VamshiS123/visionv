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
