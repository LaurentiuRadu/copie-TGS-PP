import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle } from "lucide-react";

export function VersionManager() {
  const [newVersion, setNewVersion] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const queryClient = useQueryClient();

  const { data: versions } = useQuery({
    queryKey: ["appVersions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_versions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createVersionMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("app_versions").insert({
        version: newVersion,
        release_notes: releaseNotes,
        is_current: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Versiune creată!");
      queryClient.invalidateQueries({ queryKey: ["appVersions"] });
      setNewVersion("");
      setReleaseNotes("");
    },
  });

  const setCurrentMutation = useMutation({
    mutationFn: async (versionId: string) => {
      await supabase.rpc("set_current_version", { _version_id: versionId });
    },
    onSuccess: () => {
      toast.success("Versiune activată! Toți utilizatorii vor primi notificare.");
      queryClient.invalidateQueries({ queryKey: ["appVersions"] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Management Versiuni Aplicație</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Input
            placeholder="Ex: 1.0.1"
            value={newVersion}
            onChange={(e) => setNewVersion(e.target.value)}
          />
          <Textarea
            placeholder="Note versiune..."
            value={releaseNotes}
            onChange={(e) => setReleaseNotes(e.target.value)}
            rows={2}
          />
          <Button onClick={() => createVersionMutation.mutate()} disabled={!newVersion}>
            Creează Versiune
          </Button>
        </div>

        <div className="space-y-2">
          {versions?.map((v) => (
            <div key={v.id} className="flex items-center justify-between p-3 border rounded">
              <div>
                <span className="font-bold">{v.version}</span>
                {v.is_current && <Badge className="ml-2">Curent</Badge>}
                {v.release_notes && <p className="text-sm text-muted-foreground">{v.release_notes}</p>}
              </div>
              {!v.is_current && (
                <Button size="sm" onClick={() => setCurrentMutation.mutate(v.id)}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Activează
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
