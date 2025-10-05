import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, X, Share } from "lucide-react";
import { isStandalone } from "@/lib/registerServiceWorker";
import { useContext } from "react";
import { AuthContext } from "@/contexts/AuthContext";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Detectează dacă este iOS
const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
};

// Detectează dacă este iOS Safari (nu Chrome sau alt browser)
const isIOSSafari = () => {
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const webkit = /WebKit/.test(ua);
  const notChrome = !/CriOS/.test(ua);
  return iOS && webkit && notChrome && !isStandalone();
};

export function PWAInstallPrompt() {
  // Use optional auth context - don't throw if not available yet
  const authContext = useContext(AuthContext);
  const user = authContext?.user ?? null;
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Nu arăta prompt-ul dacă aplicația rulează deja în standalone mode
    if (isStandalone()) {
      return;
    }

    // Verifică dacă utilizatorul a respins permanent (când era autentificat)
    const permanentlyDismissed = localStorage.getItem('pwa-install-permanently-dismissed');
    if (permanentlyDismissed === 'true') {
      setDismissed(true);
      return;
    }

    // Verifică dacă utilizatorul a respins temporar (când nu era autentificat)
    const dismissedTime = localStorage.getItem('pwa-install-dismissed');
    if (dismissedTime && !user) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24);
      // Arată din nou după 7 zile
      if (daysSinceDismissed < 7) {
        setDismissed(true);
        return;
      }
    }

    // Pentru iOS Safari, arată instrucțiunile după 2 secunde
    if (isIOSSafari()) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
        setShowIOSInstructions(true);
      }, 2000);
      return () => clearTimeout(timer);
    }

    // Pentru Android/Chrome, folosește beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Dacă după 3 secunde nu s-a declanșat evenimentul, arată oricum prompt-ul
    const fallbackTimer = setTimeout(() => {
      if (!deferredPrompt && !isIOS()) {
        setShowPrompt(true);
      }
    }, 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(fallbackTimer);
    };
  }, [deferredPrompt]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    
    if (import.meta.env.DEV) {
      const { outcome } = await deferredPrompt.userChoice;
      console.info(outcome === 'accepted' ? '✅ PWA installed' : '❌ PWA install declined');
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Dacă utilizatorul e autentificat, ascunde definitiv
    if (user) {
      localStorage.setItem('pwa-install-permanently-dismissed', 'true');
    } else {
      // Altfel, ascunde pentru 7 zile
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    }
  };

  const handleIOSInstall = () => {
    setShowIOSInstructions(true);
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
            
            {showIOSInstructions ? (
              <>
                <p className="text-xs text-muted-foreground mb-2">
                  Pentru a instala aplicația pe iPhone/iPad:
                </p>
                <ol className="text-xs text-muted-foreground space-y-1 mb-3 list-decimal list-inside">
                  <li>Apasă butonul <Share className="inline h-3 w-3" /> (Share)</li>
                  <li>Selectează "Add to Home Screen"</li>
                  <li>Apasă "Add" pentru confirmare</li>
                </ol>
                <Button 
                  onClick={handleDismiss}
                  size="sm"
                  variant="outline"
                  className="w-full"
                >
                  Am înțeles
                </Button>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  Obține acces rapid și funcționează fullscreen fără tab-uri de browser
                </p>
                
                <div className="flex gap-2">
                  {deferredPrompt ? (
                    <Button 
                      onClick={handleInstall}
                      size="sm"
                      className="flex-1 bg-gradient-primary-action text-primary-foreground shadow-md hover:shadow-lg transition-all"
                    >
                      Instalează
                    </Button>
                  ) : isIOS() ? (
                    <Button 
                      onClick={handleIOSInstall}
                      size="sm"
                      className="flex-1 bg-gradient-primary-action text-primary-foreground shadow-md hover:shadow-lg transition-all"
                    >
                      Vezi cum se instalează
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleDismiss}
                      size="sm"
                      className="flex-1 bg-gradient-primary-action text-primary-foreground shadow-md hover:shadow-lg transition-all"
                    >
                      Ok
                    </Button>
                  )}
                </div>
                <Button
                  onClick={handleDismiss}
                  size="sm"
                  variant="ghost"
                  className="w-full mt-2"
                >
                  Mai târziu
                </Button>
              </>
            )}
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
