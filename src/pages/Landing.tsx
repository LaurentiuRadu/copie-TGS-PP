import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Smartphone, Monitor } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full space-y-8">
        {/* Logo & Title */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-primary">
              <Clock className="h-10 w-10 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">
            TimeTrack - Time Tracking & Productivity Management
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Time Tracking & Productivity Management
          </p>
        </div>

        {/* Selection Cards */}
        <div className="grid md:grid-cols-2 gap-6 mt-12">
          {/* Mobile View Card */}
          <Card 
            className="cursor-pointer hover:border-primary transition-all hover:shadow-lg"
            onClick={() => navigate("/mobile")}
          >
            <CardContent className="p-8 text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Smartphone className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-foreground">Angajat</h2>
              <p className="text-muted-foreground">
                Interfață mobilă optimizată pentru înregistrarea timpului din teren
              </p>
              <Button 
                className="w-full bg-gradient-primary"
                size="lg"
              >
                Intră ca Angajat
              </Button>
            </CardContent>
          </Card>

          {/* Admin View Card */}
          <Card 
            className="cursor-pointer hover:border-primary transition-all hover:shadow-lg"
            onClick={() => navigate("/admin")}
          >
            <CardContent className="p-8 text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Monitor className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-foreground">Administrator</h2>
              <p className="text-muted-foreground">
                Dashboard complet pentru management și monitorizare echipă
              </p>
              <Button 
                className="w-full bg-gradient-primary"
                size="lg"
              >
                Intră ca Admin
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Info */}
        <div className="text-center text-sm text-muted-foreground mt-8">
          <p>Alege tipul de acces pentru a continua</p>
        </div>
      </div>
    </div>
  );
};

export default Landing;
