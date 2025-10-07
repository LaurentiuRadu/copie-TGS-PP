import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Users, Calendar, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ro } from "date-fns/locale";

interface TeamDiscrepancy {
  team_id: string;
  week_start_date: string;
  day_of_week: number;
  membri: number;
  diferenta_ore: number;
}

const DAY_NAMES = ["Duminică", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă"];

export function TeamDiscrepancyReport() {
  const { data: discrepancies, isLoading, error } = useQuery({
    queryKey: ["team-discrepancies"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_team_discrepancies");
      
      if (error) throw error;
      return data as TeamDiscrepancy[];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Eroare la încărcarea raportului: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  const getSeverityColor = (diferenta: number) => {
    if (diferenta >= 3) return "destructive";
    if (diferenta >= 2) return "default";
    return "secondary";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Raport Discrepanțe Echipe
        </CardTitle>
        <CardDescription>
          Echipe cu diferențe mari (peste 1h) între orele lucrate de membri
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!discrepancies || discrepancies.length === 0 ? (
          <Alert>
            <AlertDescription>
              Nu există discrepanțe semnificative între echipe în perioada curentă.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {discrepancies.map((disc, index) => (
              <Card key={index} className="border-l-4 border-l-amber-500">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">Echipa {disc.team_id}</span>
                        <Badge variant="outline">{disc.membri} membri</Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            Săptămâna {format(new Date(disc.week_start_date), "dd MMM yyyy", { locale: ro })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{DAY_NAMES[disc.day_of_week]}</span>
                        </div>
                      </div>
                    </div>

                    <Badge variant={getSeverityColor(disc.diferenta_ore)} className="text-lg px-3 py-1">
                      {disc.diferenta_ore.toFixed(1)}h
                    </Badge>
                  </div>

                  <Alert className="mt-3">
                    <AlertDescription className="text-sm">
                      <strong>Diferență:</strong> Între membrii acestei echipe există o diferență de{" "}
                      <strong>{disc.diferenta_ore.toFixed(1)} ore</strong> lucrate în aceeași zi.
                      {disc.diferenta_ore >= 3 && (
                        <span className="block mt-1 text-destructive font-medium">
                          ⚠️ Diferență critică - necesită investigare!
                        </span>
                      )}
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}