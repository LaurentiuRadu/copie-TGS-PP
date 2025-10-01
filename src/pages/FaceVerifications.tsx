import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Camera, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FaceVerificationLog {
  id: string;
  user_id: string;
  time_entry_id: string | null;
  verification_type: 'enrollment' | 'clock_in' | 'clock_out';
  photo_url: string;
  quality_score: number | null;
  match_score: number | null;
  is_match: boolean | null;
  is_quality_pass: boolean;
  failure_reason: string | null;
  created_at: string;
  profiles: {
    full_name: string;
    username: string;
  };
}

export default function FaceVerifications() {
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: verifications, isLoading } = useQuery({
    queryKey: ["face-verifications", filterType, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("face_verification_logs")
        .select(`
          *,
          profiles:user_id (
            full_name,
            username
          )
        `)
        .order("created_at", { ascending: false });

      if (filterType !== "all") {
        query = query.eq("verification_type", filterType);
      }

      if (filterStatus === "success") {
        query = query.eq("is_quality_pass", true).eq("is_match", true);
      } else if (filterStatus === "failed") {
        query = query.or("is_quality_pass.eq.false,is_match.eq.false");
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return (data || []) as any as FaceVerificationLog[];
    },
  });

  const getVerificationTypeIcon = (type: string) => {
    switch (type) {
      case "enrollment":
        return <Camera className="h-4 w-4" />;
      case "clock_in":
      case "clock_out":
        return <Clock className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getVerificationTypeLabel = (type: string) => {
    switch (type) {
      case "enrollment":
        return "Înrolare";
      case "clock_in":
        return "Intrare";
      case "clock_out":
        return "Ieșire";
      default:
        return type;
    }
  };

  const getStatusBadge = (log: FaceVerificationLog) => {
    if (!log.is_quality_pass) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Calitate Slabă
        </Badge>
      );
    }
    
    if (log.verification_type === "enrollment") {
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Înrolat
        </Badge>
      );
    }
    
    if (log.is_match === false) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Nu Corespunde
        </Badge>
      );
    }
    
    if (log.is_match === true) {
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Verificat
        </Badge>
      );
    }
    
    return <Badge variant="secondary">Necunoscut</Badge>;
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Istoricul Verificărilor Faciale</h1>
          <p className="text-muted-foreground mt-2">
            Monitorizare completă a tuturor verificărilor faciale
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtre</CardTitle>
          <CardDescription>Filtrează verificările după tip și status</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Tip verificare" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toate Tipurile</SelectItem>
              <SelectItem value="enrollment">Înrolare</SelectItem>
              <SelectItem value="clock_in">Intrare</SelectItem>
              <SelectItem value="clock_out">Ieșire</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toate Statusurile</SelectItem>
              <SelectItem value="success">Succes</SelectItem>
              <SelectItem value="failed">Eșuat</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verificări Recente</CardTitle>
          <CardDescription>
            {verifications?.length || 0} verificări găsite
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Se încarcă...</p>
          ) : verifications && verifications.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilizator</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scor Calitate</TableHead>
                  <TableHead>Scor Potrivire</TableHead>
                  <TableHead>Dată</TableHead>
                  <TableHead>Motiv Eșec</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {verifications.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={log.photo_url} />
                          <AvatarFallback>
                            {log.profiles?.full_name?.[0] || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {log.profiles?.full_name || "Necunoscut"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {log.profiles?.username}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getVerificationTypeIcon(log.verification_type)}
                        {getVerificationTypeLabel(log.verification_type)}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(log)}</TableCell>
                    <TableCell>
                      {log.quality_score !== null ? (
                        <span className={log.quality_score >= 0.7 ? "text-green-600" : "text-orange-600"}>
                          {(log.quality_score * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.match_score !== null ? (
                        <span className={log.match_score >= 0.7 ? "text-green-600" : "text-red-600"}>
                          {(log.match_score * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(log.created_at), "PPp", { locale: ro })}
                    </TableCell>
                    <TableCell>
                      {log.failure_reason ? (
                        <span className="text-sm text-destructive">
                          {log.failure_reason}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Nu există verificări înregistrate
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
