interface CameraViewProps {
  isActive: boolean;
}

export function CameraView({ isActive }: CameraViewProps) {
  // The Overshoot SDK handles the camera stream internally
  // We don't need a separate camera preview to avoid conflicts
  // This component is kept for potential future use but doesn't access the camera
  
  if (!isActive) {
    return null;
  }

  return (
    <div className="camera-view">
      <div className="camera-status">
        <p>Camera is active - Overshoot SDK is processing video</p>
        <p className="camera-status-note">Video preview disabled to prevent camera access conflicts</p>
      </div>
    </div>
  );
}
