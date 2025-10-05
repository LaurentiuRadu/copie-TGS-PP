import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RefreshCw, Download } from "lucide-react";

export function UpdateBadge() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    // Check for updates on mount
    checkForUpdate();

    // Listen for update events from service worker
    const handleUpdateAvailable = () => {
      setHasUpdate(true);
    };

    window.addEventListener("app-update-available", handleUpdateAvailable);

    // Check periodically
    const interval = setInterval(checkForUpdate, 6 * 60 * 60 * 1000); // Check every 6 hours

    return () => {
      window.removeEventListener("app-update-available", handleUpdateAvailable);
      clearInterval(interval);
    };
  }, []);

  const checkForUpdate = () => {
    const updateAvailable = localStorage.getItem("new-version-available") === "true";
    if (updateAvailable) {
      setHasUpdate(true);
    }
  };

  const handleUpdate = async () => {
    // Trimite mesaj la service worker să activeze versiunea nouă
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      
      // Așteaptă ca noul SW să preia controlul
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🔄 New service worker activated, reloading...');
        localStorage.removeItem("new-version-available");
        window.location.reload();
      }, { once: true });
    } else {
      // Fallback: reload simplu
      localStorage.removeItem("new-version-available");
      window.location.reload();
    }
  };

  if (!hasUpdate) return null;

  return (
    <>
      <div className="fixed bottom-20 right-4 z-50 md:bottom-4">
        <Button
          variant="default"
          size="sm"
          onClick={() => setShowDialog(true)}
          className="relative h-10 w-10 p-0 rounded-full shadow-lg animate-pulse bg-primary hover:bg-primary/90"
        >
          <RefreshCw className="h-5 w-5" />
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full"
          >
            !
          </Badge>
        </Button>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <Download className="h-5 w-5 text-primary" />
              <DialogTitle>Update Disponibil</DialogTitle>
            </div>
            <DialogDescription>
              O versiune nouă a aplicației este disponibilă. Actualizează acum pentru a beneficia de cele mai recente funcționalități și îmbunătățiri.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 pt-4">
            <Button onClick={handleUpdate} className="w-full gap-2">
              <RefreshCw className="h-4 w-4" />
              Actualizează Acum
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              className="w-full"
            >
              Mai Târziu
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
