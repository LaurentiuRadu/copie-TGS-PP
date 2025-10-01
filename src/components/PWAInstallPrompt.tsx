import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, X } from "lucide-react";
import { isStandalone } from "@/lib/registerServiceWorker";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Nu arăta prompt-ul dacă aplicația rulează deja în standalone mode
    if (isStandalone()) {
      return;
    }

    // Verifică dacă utilizatorul a respins deja prompt-ul
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      setDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('✅ Utilizatorul a acceptat instalarea PWA');
    } else {
      console.log('❌ Utilizatorul a refuzat instalarea PWA');
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!showPrompt || dismissed || isStandalone()) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 shadow-elegant border-primary/20 animate-slide-up">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Download className="h-5 w-5 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1">
              Instalează TimeTrack
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Obține acces rapid și funcționează fullscreen fără tab-uri de browser
            </p>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleInstall}
                size="sm"
                className="flex-1 bg-gradient-primary shadow-md hover:shadow-lg transition-all"
              >
                Instalează
              </Button>
              <Button 
                onClick={handleDismiss}
                size="sm"
                variant="ghost"
              >
                Mai târziu
              </Button>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 -mt-1 -mr-1"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
