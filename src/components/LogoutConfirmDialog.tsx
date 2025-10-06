import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LogOut, Heart } from "lucide-react";

interface LogoutConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function LogoutConfirmDialog({ open, onOpenChange, onConfirm }: LogoutConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
              <div className="relative bg-primary/10 p-4 rounded-full">
                <LogOut className="h-8 w-8 text-primary" />
              </div>
            </div>
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Ieși din aplicație?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center space-y-2">
            <p className="text-base">
              Ești sigur că vrei să te deconectezi?
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Heart className="h-4 w-4 text-primary animate-pulse" />
              <span>Te așteptăm înapoi curând!</span>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel className="w-full sm:w-auto">
            Anulează
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90"
          >
            Da, deconectează-mă
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
