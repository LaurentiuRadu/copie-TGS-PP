import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useTheme } from "next-themes";
import { Palette, Moon, Sun, Monitor, Sunrise } from "lucide-react";
import { useEffect, useState } from "react";

type ThemeMode = "auto" | "light" | "dark" | "system";

export function ThemeSettings() {
  const { setTheme } = useTheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem("theme-preference") as ThemeMode) || "system";
  });

  useEffect(() => {
    localStorage.setItem("theme-preference", themeMode);
    
    // Aplicăm tema curentă (auto va fi gestionat de hook în App.tsx)
    if (themeMode !== "auto") {
      setTheme(themeMode);
    }
  }, [themeMode, setTheme]);

  const handleThemeChange = (value: ThemeMode) => {
    setThemeMode(value);
    
    // Trigger re-render pentru App.tsx să preia noua valoare
    window.dispatchEvent(new Event("storage"));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          <CardTitle>🎨 Tema Aplicației</CardTitle>
        </div>
        <CardDescription>
          Alege cum vrei să arate aplicația
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup value={themeMode} onValueChange={handleThemeChange}>
          {/* Auto (Sunrise/Sunset România) */}
          <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="auto" id="auto" />
            <Label htmlFor="auto" className="flex-1 cursor-pointer space-y-1">
              <div className="flex items-center gap-2">
                <Sunrise className="h-4 w-4 text-orange-500" />
                <span className="font-medium">🌓 Auto (Sunrise/Sunset România)</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Light: 06:00-20:00 | Dark: 20:00-06:00
              </p>
            </Label>
          </div>

          {/* Light Mode */}
          <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="light" id="light" />
            <Label htmlFor="light" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-yellow-500" />
                <span className="font-medium">🌞 Light Mode (mereu luminos)</span>
              </div>
            </Label>
          </div>

          {/* Dark Mode */}
          <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="dark" id="dark" />
            <Label htmlFor="dark" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-blue-500" />
                <span className="font-medium">🌙 Dark Mode (mereu întunecat)</span>
              </div>
            </Label>
          </div>

          {/* System */}
          <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="system" id="system" />
            <Label htmlFor="system" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-gray-500" />
                <span className="font-medium">💻 System (preferințe OS)</span>
              </div>
            </Label>
          </div>
        </RadioGroup>

        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg border">
          <Sunrise className="h-4 w-4 text-muted-foreground mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Modul <span className="font-medium">Auto</span> schimbă automat tema pe baza 
            timpilor de răsărit/apus din România. Tema se verifică la fiecare 30 minute.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}