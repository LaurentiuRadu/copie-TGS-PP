import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileTableCard, MobileTableRow } from "@/components/MobileTableCard";

interface CorrectionRequest {
  id: string;
  user_id: string;
  work_date: string;
  request_type: string;
  description: string;
  proposed_clock_in: string | null;
  proposed_clock_out: string | null;
  proposed_shift_type: string | null;
  status: string;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  user_profile?: {
    full_name: string | null;
    username: string | null;
  };
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  forgot_clock_in: "Uitat pontare intrare",
  forgot_clock_out: "Uitat pontare ieșire",
  wrong_time: "Oră greșită",
  wrong_shift_type: "Tip tură greșit",
  duplicate_entry: "Pontaj duplicat",
  other: "Altă problemă",
};

export function TimeEntryCorrectionRequestsManager() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<CorrectionRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve");
  const [adminNotes, setAdminNotes] = useState("");

  const { data: requests, isLoading } = useQuery({
    queryKey: ["correctionRequests", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("time_entry_correction_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data: requestsData, error: requestsError } = await query;
      if (requestsError) throw requestsError;

      // Fetch user profiles separately
      const userIds = [...new Set(requestsData?.map(r => r.user_id) || [])];
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, username")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Combine data
      const combined: CorrectionRequest[] = (requestsData || []).map(request => ({
        ...request,
        user_profile: profilesData?.find(p => p.id === request.user_id),
      }));

      return combined;
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({
      requestId,
      status,
      notes,
    }: {
      requestId: string;
      status: "approved" | "rejected";
      notes: string;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("time_entry_correction_requests")
        .update({
          status,
          admin_notes: notes,
          reviewed_by: user.user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.status === "approved"
          ? "Cerere aprobată! Nu uita să creezi/editezi pontajul manual."
          : "Cerere respinsă"
      );
      queryClient.invalidateQueries({ queryKey: ["correctionRequests"] });
      setReviewDialogOpen(false);
      setSelectedRequest(null);
      setAdminNotes("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Eroare la procesarea cererii");
    },
  });

  const openReviewDialog = (request: CorrectionRequest, action: "approve" | "reject") => {
    setSelectedRequest(request);
    setReviewAction(action);
    setAdminNotes("");
    setReviewDialogOpen(true);
  };

  const handleReview = () => {
    if (!selectedRequest) return;
    if (reviewAction === "reject" && adminNotes.trim().length < 10) {
      toast.error("Te rog adaugă o motivație pentru respingere (minim 10 caractere)");
      return;
    }

    reviewMutation.mutate({
      requestId: selectedRequest.id,
      status: reviewAction === "approve" ? "approved" : "rejected",
      notes: adminNotes,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
            <Clock className="mr-1 h-3 w-3" />
            În așteptare
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
            <CheckCircle className="mr-1 h-3 w-3" />
            Aprobată
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
            <XCircle className="mr-1 h-3 w-3" />
            Respinsă
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cereri de Corecție Pontaje</CardTitle>
              <CardDescription>Gestionează cererile de corecție ale angajaților</CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">În așteptare</SelectItem>
                <SelectItem value="approved">Aprobate</SelectItem>
                <SelectItem value="rejected">Respinse</SelectItem>
                <SelectItem value="all">Toate</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !requests || requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nu există cereri {statusFilter !== "all" && `cu status "${statusFilter}"`}
            </div>
          ) : isMobile ? (
            <div className="space-y-3">
              {requests.map((request) => (
                <MobileTableCard key={request.id}>
                  <MobileTableRow
                    label="Data"
                    value={format(new Date(request.work_date), "dd MMM yyyy", { locale: ro })}
                  />
                  <MobileTableRow
                    label="Angajat"
                    value={request.user_profile?.full_name || request.user_profile?.username || "—"}
                  />
                  <MobileTableRow
                    label="Tip Problemă"
                    value={REQUEST_TYPE_LABELS[request.request_type] || request.request_type}
                  />
                  <MobileTableRow
                    label="Status"
                    value={getStatusBadge(request.status)}
                  />
                  {request.status === "pending" ? (
                    <div className="flex flex-col gap-2 pt-2">
                      <Button
                        className="w-full"
                        variant="default"
                        onClick={() => openReviewDialog(request, "approve")}
                      >
                        Aprobă
                      </Button>
                      <Button
                        className="w-full"
                        variant="destructive"
                        onClick={() => openReviewDialog(request, "reject")}
                      >
                        Respinge
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className="w-full mt-2"
                      variant="outline"
                      onClick={() => {
                        setSelectedRequest(request);
                        setReviewDialogOpen(true);
                      }}
                    >
                      Vezi Detalii
                    </Button>
                  )}
                </MobileTableCard>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Angajat</TableHead>
                    <TableHead>Tip Problemă</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Acțiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        {format(new Date(request.work_date), "dd MMM yyyy", { locale: ro })}
                      </TableCell>
                      <TableCell>
                        {request.user_profile?.full_name || request.user_profile?.username || "—"}
                      </TableCell>
                      <TableCell>{REQUEST_TYPE_LABELS[request.request_type] || request.request_type}</TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>
                        {request.status === "pending" ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => openReviewDialog(request, "approve")}
                            >
                              Aprobă
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openReviewDialog(request, "reject")}
                            >
                              Respinge
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedRequest(request);
                              setReviewDialogOpen(true);
                            }}
                          >
                            Vezi Detalii
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl sm:max-w-[95vw] max-h-[90vh] overflow-y-auto mx-4">
          <DialogHeader>
            <DialogTitle>
              {selectedRequest?.status === "pending"
                ? reviewAction === "approve"
                  ? "Aprobă Cerere"
                  : "Respinge Cerere"
                : "Detalii Cerere"}
            </DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Angajat</Label>
                  <p className="font-medium">
                    {selectedRequest.user_profile?.full_name || selectedRequest.user_profile?.username || "—"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Data Pontajului</Label>
                  <p className="font-medium">
                    {format(new Date(selectedRequest.work_date), "dd MMMM yyyy", { locale: ro })}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Tip Problemă</Label>
                <p className="font-medium">{REQUEST_TYPE_LABELS[selectedRequest.request_type]}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Descriere</Label>
                <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">
                  {selectedRequest.description}
                </p>
              </div>

              {(selectedRequest.proposed_clock_in || selectedRequest.proposed_clock_out) && (
                <div>
                  <Label className="text-muted-foreground">Propunere Ore</Label>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    {selectedRequest.proposed_clock_in && (
                      <div>
                        <p className="text-xs text-muted-foreground">Intrare</p>
                        <p className="font-medium">
                          {format(new Date(selectedRequest.proposed_clock_in), "HH:mm")}
                        </p>
                      </div>
                    )}
                    {selectedRequest.proposed_clock_out && (
                      <div>
                        <p className="text-xs text-muted-foreground">Ieșire</p>
                        <p className="font-medium">
                          {format(new Date(selectedRequest.proposed_clock_out), "HH:mm")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedRequest.proposed_shift_type && (
                <div>
                  <Label className="text-muted-foreground">Propunere Tip Tură</Label>
                  <p className="font-medium">{selectedRequest.proposed_shift_type}</p>
                </div>
              )}

              {selectedRequest.status === "pending" && (
                <>
                  {reviewAction === "approve" && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div className="text-sm text-yellow-800">
                        <p className="font-medium mb-1">Important!</p>
                        <p>
                          După aprobare, va trebui să creezi sau să editezi manual pontajul în sistemul
                          de pontaje. Aprobarea nu modifică automat datele.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>
                      {reviewAction === "approve" ? "Notițe (opțional)" : "Motivație Respingere *"}
                    </Label>
                    <Textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder={
                        reviewAction === "approve"
                          ? "Adaugă notițe despre această aprobare..."
                          : "Explică motivul respingerii (minim 10 caractere)..."
                      }
                      rows={4}
                      className="resize-none"
                    />
                    {reviewAction === "reject" && (
                      <p className="text-xs text-muted-foreground">
                        {adminNotes.length}/10 caractere minime
                      </p>
                    )}
                  </div>
                </>
              )}

              {selectedRequest.status !== "pending" && (
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-2">{getStatusBadge(selectedRequest.status)}</div>
                  {selectedRequest.admin_notes && (
                    <div className="mt-2">
                      <Label className="text-muted-foreground">Notițe Admin</Label>
                      <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md mt-1">
                        {selectedRequest.admin_notes}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              {selectedRequest?.status === "pending" ? "Anulează" : "Închide"}
            </Button>
            {selectedRequest?.status === "pending" && (
              <Button
                onClick={handleReview}
                disabled={reviewMutation.isPending}
                variant={reviewAction === "reject" ? "destructive" : "default"}
              >
                {reviewMutation.isPending
                  ? "Se procesează..."
                  : reviewAction === "approve"
                  ? "Aprobă Cererea"
                  : "Respinge Cererea"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
