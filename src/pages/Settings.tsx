
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Upload, Database, HardDrive, Info, Shield, Bell, Users, Settings as SettingsIcon, Palette } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ThemeSettings } from "@/components/ThemeSettings";
import UserManagement from "./UserManagement";
import { AllScheduleNotifications } from "@/components/AllScheduleNotifications";

export default function Settings() {
  const handleBackup = () => {
    toast({
      title: "Backup în curs",
      description: "Datele sunt în curs de salvare...",
    });
    // TODO: Implementează logica de backup
  };

  const handleRestore = () => {
    toast({
      title: "Restore",
      description: "Funcționalitatea de restore va fi implementată curând.",
    });
    // TODO: Implementează logica de restore
  };

  return (
    <div className="container max-w-6xl mx-auto p-4 md:p-6">
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-[800px]">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Setări Generale</span>
              <span className="sm:hidden">General</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Utilizatori</span>
              <span className="sm:hidden">Useri</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notificări</span>
              <span className="sm:hidden">Notif</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Aspect</span>
              <span className="sm:hidden">Aspect</span>
            </TabsTrigger>
          </TabsList>

          {/* Setări Generale Tab */}
          <TabsContent value="general" className="space-y-6">
            {/* Backup & Restore Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-primary" />
                  <CardTitle>Backup & Restore</CardTitle>
                </div>
                <CardDescription>
                  Gestionează backup-urile aplicației și restaurează date salvate
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Download className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">Creează Backup</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Salvează o copie completă a datelor aplicației (utilizatori, pontaje, concedii)
                    </p>
                    <Button onClick={handleBackup} className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      Descarcă Backup
                    </Button>
                  </div>

                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">Restaurează Backup</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Încarcă și restaurează date dintr-un backup anterior
                    </p>
                    <Button onClick={handleRestore} variant="outline" className="w-full">
                      <Upload className="h-4 w-4 mr-2" />
                      Încarcă Backup
                    </Button>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Backup-urile includ: profiluri utilizatori, pontaje, cereri concedii, 
                    programări săptămânale și setări de locații.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Database Info */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  <CardTitle>Informații Bază de Date</CardTitle>
                </div>
                <CardDescription>
                  Statistici și informații despre baza de date
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 border rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <Badge variant="default" className="bg-green-600">Activ</Badge>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Tip</p>
                    <p className="text-sm font-semibold">PostgreSQL</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Regiune</p>
                    <p className="text-sm font-semibold">EU-Central</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Backup Auto</p>
                    <Badge variant="outline">Zilnic</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security Settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <CardTitle>Securitate & Confidențialitate</CardTitle>
                </div>
                <CardDescription>
                  Configurări de securitate și protecție date
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Autentificare cu 2 factori</p>
                    <p className="text-sm text-muted-foreground">Securitate suplimentară pentru contul tău</p>
                  </div>
                  <Badge variant="outline">În curând</Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Conformitate GDPR</p>
                    <p className="text-sm text-muted-foreground">Gestionare consimțăminte și drepturi utilizatori</p>
                  </div>
                  <Badge variant="default" className="bg-green-600">Activ</Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Audit Log</p>
                    <p className="text-sm text-muted-foreground">Înregistrare acțiuni sensibile</p>
                  </div>
                  <Badge variant="default" className="bg-green-600">Activ</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Notifications Settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  <CardTitle>Notificări</CardTitle>
                </div>
                <CardDescription>
                  Configurări pentru notificări și alerte
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Notificări programare</p>
                    <p className="text-sm text-muted-foreground">Alertă când se publică programul săptămânal</p>
                  </div>
                  <Badge variant="default" className="bg-green-600">Activ</Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Alerte securitate</p>
                    <p className="text-sm text-muted-foreground">Notificări pentru evenimente de securitate</p>
                  </div>
                  <Badge variant="default" className="bg-green-600">Activ</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Gestionare Utilizatori Tab */}
          <TabsContent value="users">
            <UserManagement embedded={true} />
          </TabsContent>

          {/* Notificări Tab */}
          <TabsContent value="notifications">
            <AllScheduleNotifications />
          </TabsContent>

          {/* Aspect Tab */}
          <TabsContent value="appearance">
            <ThemeSettings />
          </TabsContent>
        </Tabs>
      </div>
  );
}
