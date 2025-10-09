import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle, Clock, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { TimeEntryManualCorrectionDialog } from "./TimeEntryManualCorrectionDialog";

interface SuspiciousEntry {
  id: string;
  user_id: string;
  clock_in_time: string;
  clock_out_time: string;
  needs_reprocessing: boolean;
  profiles: {
    id: string;
    full_name: string;
    username: string;
  };
}

export function SuspiciousEntriesManager() {
  const [selectedEntry, setSelectedEntry] = useState<SuspiciousEntry | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch suspicious entries (needs_reprocessing = true)
  const { data: entries, isLoading } = useQuery({
    queryKey: ['suspicious-entries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_entries')
        .select(`
          id,
          user_id,
          clock_in_time,
          clock_out_time,
          needs_reprocessing
        `)
        .eq('needs_reprocessing', true)
        .not('clock_out_time', 'is', null)
        .order('clock_in_time', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch profiles separately (batched pentru performanță)
      const userIds = [...new Set(data?.map(e => e.user_id) || [])];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Merge profiles with entries
      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
      return data?.map(entry => ({
        ...entry,
        profiles: profilesMap.get(entry.user_id) || { id: entry.user_id, full_name: '', username: 'Unknown' }
      })) as SuspiciousEntry[];
    },
  });

  // Mark as reviewed (clear needs_reprocessing flag)
  const markAsReviewed = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from('time_entries')
        .update({ needs_reprocessing: false })
        .eq('id', entryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suspicious-entries'] });
      toast({
        title: "✅ Marcat ca verificat",
        description: "Pontajul a fost marcat ca verificat și va fi reprocesar.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "❌ Eroare",
        description: `Nu am putut marca pontajul: ${error.message}`,
      });
    },
  });

  const calculateDuration = (clockIn: string, clockOut: string) => {
    const ms = new Date(clockOut).getTime() - new Date(clockIn).getTime();
    return (ms / (1000 * 60 * 60)).toFixed(1);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Pontaje Suspicioase
          </CardTitle>
          <CardDescription>Se încarcă...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Pontaje Suspicioase
          </CardTitle>
          <CardDescription>
            Pontaje care necesită verificare manuală (durata &gt;24h sau alte anomalii)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!entries || entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-success" />
              <p>Nu există pontaje suspicioase 🎉</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => {
                const duration = calculateDuration(entry.clock_in_time, entry.clock_out_time);
                const isSuspicious = parseFloat(duration) > 24;

                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {entry.profiles.full_name || entry.profiles.username}
                        </span>
                        {isSuspicious && (
                          <Badge variant="destructive" className="ml-2">
                            {duration}h
                          </Badge>
                        )}
                      </div>

                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(entry.clock_in_time), "dd MMM yyyy", { locale: ro })}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(entry.clock_in_time), "HH:mm")} →{" "}
                          {format(new Date(entry.clock_out_time), "HH:mm")}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedEntry(entry)}
                      >
                        Corectează
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markAsReviewed.mutate(entry.id)}
                        disabled={markAsReviewed.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        OK
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedEntry && (
        <TimeEntryManualCorrectionDialog
          entry={selectedEntry}
          open={!!selectedEntry}
          onOpenChange={(open) => !open && setSelectedEntry(null)}
        />
      )}
    </>
  );
}