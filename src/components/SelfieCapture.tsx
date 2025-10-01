import { useState, useRef } from 'react';
import { Camera, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface SelfieCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (photoDataUrl: string) => void;
  onQualityFailed?: (error: string) => void;
  title?: string;
}

export const SelfieCapture = ({ open, onClose, onCapture, onQualityFailed, title = "Fă un selfie" }: SelfieCaptureProps) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const MAX_RETRIES = 3;

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 1280, height: 720 }
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Eroare cameră",
        description: "Nu se poate accesa camera. Verifică permisiunile browserului.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const photoDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedPhoto(photoDataUrl);
      stopCamera();
    }
  };

  const confirmPhoto = () => {
    if (capturedPhoto) {
      onCapture(capturedPhoto);
      setCapturedPhoto(null);
      setRetryCount(0);
      setLastError(null);
      // Don't close here - let parent handle closing
    }
  };

  const retakePhoto = () => {
    if (retryCount < MAX_RETRIES) {
      setCapturedPhoto(null);
      setLastError(null);
      setRetryCount(prev => prev + 1);
      startCamera();
      
      toast({
        title: "Reîncearcă",
        description: `Încercare ${retryCount + 1}/${MAX_RETRIES}. Asigură-te că lumina este bună și fața e clară.`,
      });
    } else {
      toast({
        title: "Prea multe încercări",
        description: "Te rugăm contactează un administrator.",
        variant: "destructive",
      });
      handleClose();
    }
  };

  const handleClose = () => {
    stopCamera();
    setCapturedPhoto(null);
    setRetryCount(0);
    setLastError(null);
    onClose();
  };

  const handleQualityError = (error: string) => {
    setLastError(error);
    if (onQualityFailed) {
      onQualityFailed(error);
    }
    
    if (retryCount < MAX_RETRIES) {
      retakePhoto();
    } else {
      toast({
        title: "Prea multe încercări",
        description: "Te rugăm contactează un administrator.",
        variant: "destructive",
      });
      handleClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{title}</DialogTitle>
            {retryCount > 0 && (
              <Badge variant="secondary">
                Încercare {retryCount + 1}/{MAX_RETRIES}
              </Badge>
            )}
          </div>
        </DialogHeader>
        
        <div className="space-y-4">
          {lastError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
              {lastError}
            </div>
          )}

          {!stream && !capturedPhoto && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Camera className="w-16 h-16 text-muted-foreground" />
              <p className="text-center text-sm text-muted-foreground">
                Fă un selfie pentru verificare
              </p>
              <Button onClick={startCamera}>
                <Camera className="w-4 h-4 mr-2" />
                Deschide camera
              </Button>
            </div>
          )}
          
          {stream && !capturedPhoto && (
            <div className="space-y-4">
              <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
              
              <div className="flex gap-2">
                <Button onClick={capturePhoto} className="flex-1">
                  <Camera className="w-4 h-4 mr-2" />
                  Capturează
                </Button>
                <Button onClick={handleClose} variant="outline">
                  <X className="w-4 h-4 mr-2" />
                  Anulează
                </Button>
              </div>
            </div>
          )}
          
          {capturedPhoto && (
            <div className="space-y-4">
              <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
                <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover" />
              </div>
              
              <div className="flex gap-2">
                <Button onClick={confirmPhoto} className="flex-1">
                  Confirmă
                </Button>
                <Button onClick={retakePhoto} variant="outline" disabled={retryCount >= MAX_RETRIES}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {retryCount >= MAX_RETRIES ? "Limită atinsă" : `Refă (${MAX_RETRIES - retryCount} rămase)`}
                </Button>
              </div>
            </div>
          )}
          
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </DialogContent>
    </Dialog>
  );
};
