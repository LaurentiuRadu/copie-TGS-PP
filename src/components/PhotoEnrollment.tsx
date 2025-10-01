import { useState } from 'react';
import { Camera, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SelfieCapture } from './SelfieCapture';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PhotoEnrollmentProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
}

export const PhotoEnrollment = ({ open, onClose, onSuccess, userId }: PhotoEnrollmentProps) => {
  const [showCamera, setShowCamera] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<{
    isValid: boolean;
    quality: string;
    score: number;
    reason: string;
  } | null>(null);
  const { toast } = useToast();

  const handlePhotoCapture = async (photoDataUrl: string) => {
    setShowCamera(false);
    setVerifying(true);
    setResult(null);

    try {
      // Verify photo quality using AI
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-face', {
        body: { currentImage: photoDataUrl, action: 'enroll' }
      });

      if (verifyError) throw verifyError;

      console.log('Enrollment verification result:', verifyData);

      if (verifyData.isValid) {
        // Upload photo to storage
        const fileName = `${userId}/reference-${Date.now()}.jpg`;
        const base64Data = photoDataUrl.split(',')[1];
        const blob = await fetch(photoDataUrl).then(r => r.blob());

        const { error: uploadError } = await supabase.storage
          .from('profile-photos')
          .upload(fileName, blob, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('profile-photos')
          .getPublicUrl(fileName);

        // Update profile with reference photo
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            reference_photo_url: publicUrl,
            reference_photo_enrolled_at: new Date().toISOString(),
            photo_quality_score: verifyData.score
          })
          .eq('id', userId);

        if (updateError) throw updateError;

        setResult(verifyData);
        toast({
          title: "Înrolare reușită",
          description: "Poza ta de referință a fost salvată cu succes.",
        });

        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } else {
        setResult(verifyData);
        toast({
          title: "Poză neacceptată",
          description: verifyData.reason,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error during enrollment:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut înrola poza. Încearcă din nou.",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <>
      <Dialog open={open && !showCamera} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Înrolare Poză Profil</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Pentru a putea pontare, trebuie să înregistrezi o poză de referință.
                Asigură-te că:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Fața ta este clar vizibilă</li>
                  <li>Ești pe lumină bună (nu prea întuneric)</li>
                  <li>Privești direct în cameră</li>
                  <li>Poza nu este blurată</li>
                </ul>
              </AlertDescription>
            </Alert>

            {verifying && (
              <div className="text-center py-4">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Verificăm calitatea pozei...</p>
              </div>
            )}

            {result && (
              <Alert variant={result.isValid ? "default" : "destructive"}>
                <div className="flex items-start gap-2">
                  {result.isValid ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium">
                      {result.isValid ? 'Poză acceptată!' : 'Poză respinsă'}
                    </p>
                    <p className="text-sm mt-1">{result.reason}</p>
                    <p className="text-sm mt-1">Scor calitate: {result.score}/100</p>
                  </div>
                </div>
              </Alert>
            )}

            {!verifying && !result?.isValid && (
              <Button onClick={() => setShowCamera(true)} className="w-full">
                <Camera className="w-4 h-4 mr-2" />
                {result ? 'Încearcă din nou' : 'Fă poza de referință'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SelfieCapture
        open={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handlePhotoCapture}
        title="Poză de Referință - Înrolare"
      />
    </>
  );
};