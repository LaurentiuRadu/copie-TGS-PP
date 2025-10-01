import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { RomaniaTimeClock } from "./RomaniaTimeClock";

interface AppHeaderProps {
  title: string;
  showNavigation?: boolean;
  children?: React.ReactNode;
}

export const AppHeader = ({ title, showNavigation = true, children }: AppHeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border">
      <div className="flex items-center justify-between p-3 xs:p-4 gap-2">
        {showNavigation && (
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-10 w-10 flex-shrink-0 touch-target border-2 border-primary bg-primary/10 hover:bg-primary/20"
              title="Înapoi"
            >
              <ArrowLeft className="h-5 w-5 text-primary" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(1)}
              className="h-10 w-10 flex-shrink-0 touch-target border-2 border-primary bg-primary/10 hover:bg-primary/20"
              title="Înainte"
            >
              <ArrowRight className="h-5 w-5 text-primary" />
            </Button>
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <h1 className="text-lg xs:text-xl font-semibold text-foreground truncate">{title}</h1>
        </div>
        
        <RomaniaTimeClock />
        
        {children}
      </div>
    </header>
  );
};
