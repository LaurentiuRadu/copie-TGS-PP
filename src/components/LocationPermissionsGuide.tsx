import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MapPin, Smartphone, Settings, Info } from "lucide-react";

interface LocationPermissionsGuideProps {
  trigger?: React.ReactNode;
}

export function LocationPermissionsGuide({ trigger }: LocationPermissionsGuideProps) {
  const [open, setOpen] = useState(false);
  
  // Detectează platforma
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Info className="h-4 w-4" />
            Ghid Locație
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto glass-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Activare "Always Allow" Locație
          </DialogTitle>
          <DialogDescription>
            Pentru a evita cereri repetate de locație
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info general */}
          <Alert className="border-primary/20">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription>
              Pentru funcționare optimă, activează permisiunea de locație permanent.
            </AlertDescription>
          </Alert>

          {/* Instrucțiuni iOS */}
          {isIOS && (
            <div className="space-y-3 p-4 rounded-lg bg-muted/50 border border-primary/10">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <Smartphone className="h-5 w-5" />
                iOS (Safari/PWA)
              </div>
              
              <ol className="space-y-2 text-sm list-decimal list-inside">
                <li>Deschide <strong>Setări</strong> → <strong>Safari</strong></li>
                <li>Scroll până la <strong>Locație</strong></li>
                <li>Selectează <strong>Întreabă Următoarea Dată</strong> sau <strong>Permis</strong></li>
                <li className="text-primary font-semibold">
                  Pentru PWA: Setări → TimeTrack → Locație → <strong>Întotdeauna</strong>
                </li>
              </ol>

              <div className="mt-3 p-3 bg-warning/10 border border-warning/20 rounded-md">
                <p className="text-xs text-muted-foreground">
                  💡 <strong>Tip iOS PWA:</strong> Dacă ai instalat aplicația pe Home Screen, 
                  găsești setările în <strong>Setări → TimeTrack</strong>
                </p>
              </div>
            </div>
          )}

          {/* Instrucțiuni Android */}
          {isAndroid && (
            <div className="space-y-3 p-4 rounded-lg bg-muted/50 border border-primary/10">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <Smartphone className="h-5 w-5" />
                Android (Chrome/Firefox/PWA)
              </div>
              
              <ol className="space-y-2 text-sm list-decimal list-inside">
                <li>Deschide <strong>Setări</strong> → <strong>Aplicații</strong></li>
                <li>Găsește <strong>Chrome</strong> sau <strong>Firefox</strong> (sau TimeTrack dacă e instalat)</li>
                <li>Apasă pe <strong>Permisiuni</strong> → <strong>Locație</strong></li>
                <li className="text-primary font-semibold">
                  Selectează <strong>Permite tot timpul</strong>
                </li>
              </ol>

              <div className="mt-3 p-3 bg-info/10 border border-info/20 rounded-md">
                <p className="text-xs text-muted-foreground">
                  💡 <strong>Tip Android PWA:</strong> Dacă ai instalat aplicația, 
                  găsești direct <strong>TimeTrack</strong> în lista de aplicații
                </p>
              </div>
            </div>
          )}

          {/* Fallback pentru alte platforme */}
          {!isIOS && !isAndroid && (
            <div className="space-y-3 p-4 rounded-lg bg-muted/50 border border-primary/10">
              <div className="flex items-center gap-2 font-semibold">
                <Settings className="h-5 w-5" />
                Browser Desktop
              </div>
              
              <p className="text-sm text-muted-foreground">
                În browser, click pe iconița <strong>🔒</strong> din bara de adrese 
                → Permisiuni Site → <strong>Locație: Permis</strong>
              </p>
            </div>
          )}

          {/* Beneficii */}
          <div className="p-3 bg-success/10 border border-success/20 rounded-md">
            <p className="text-sm font-semibold text-success mb-2">✅ Beneficii:</p>
            <ul className="text-xs space-y-1 text-muted-foreground list-disc list-inside">
              <li>Fără întreruperi la pontaj</li>
              <li>Funcționare mai rapidă</li>
              <li>Baterie optimizată (cache inteligent)</li>
              <li>Experiență fluidă</li>
            </ul>
          </div>

          <Button 
            onClick={() => setOpen(false)} 
            className="w-full glass-button"
          >
            Am înțeles
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
