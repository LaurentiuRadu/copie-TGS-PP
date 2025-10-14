import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, AlertCircle, Calendar, MapPin, Activity, Car, FileText, Moon, Sun, Pencil, ChevronDown, ChevronUp, Info, CheckCircle2, RefreshCw, Trash2, RotateCcw } from 'lucide-react';
import { useTeamApprovalWorkflow, type TimeEntryForApproval } from '@/hooks/useTeamApprovalWorkflow';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { formatRomania } from '@/lib/timezone';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TimeEntryApprovalEditDialog } from '@/components/TimeEntryApprovalEditDialog';
import { DeleteTimeEntryDialog } from '@/components/DeleteTimeEntryDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';

interface TeamTimeApprovalManagerProps {
  selectedWeek: string;
  selectedDayOfWeek: number;
  availableTeams: Set<string>;
  selectedTeam: string | null;
  editedTeams: Set<string>;
  onTeamEdited: (teamId: string) => void;
  onTeamChange: (teamId: string) => void;
}

export const TeamTimeApprovalManager = ({ 
  selectedWeek, 
  selectedDayOfWeek, 
  availableTeams,
  selectedTeam,
  editedTeams,
  onTeamEdited,
  onTeamChange
}: TeamTimeApprovalManagerProps) => {
  // Găsește următoarea echipă needitată
  const getNextUneditedTeam = (): string | null => {
    const sortedTeams = Array.from(availableTeams).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10);
      const numB = parseInt(b.replace(/\D/g, ''), 10);
      return numA - numB;
    });
    
    return sortedTeams.find(team => !editedTeams.has(team)) || null;
  };

  const {
    pendingEntries,
    teamLeader,
    coordinator,
    teamMembers = [],
    teamStats,
    isLoading,
    detectDiscrepancies,
    approveMutation,
  } = useTeamApprovalWorkflow(selectedTeam, selectedWeek, selectedDayOfWeek);

  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionEntryId, setActionEntryId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<TimeEntryForApproval | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteEntry, setDeleteEntry] = useState<TimeEntryForApproval | null>(null);
  const [expandedSchedules, setExpandedSchedules] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const toggleSchedule = (entryId: string) => {
    setExpandedSchedules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const isScheduleExpanded = (entryId: string) => expandedSchedules.has(entryId);

  const handleApprove = (entryId: string) => {
    setActionEntryId(entryId);
    setActionDialogOpen(true);
  };

  const handleEdit = (entry: TimeEntryForApproval) => {
    setEditEntry(entry);
    setEditDialogOpen(true);
  };

  const handleDelete = (entry: TimeEntryForApproval) => {
    setDeleteEntry(entry);
    setDeleteDialogOpen(true);
  };

  const handleConfirmApproval = async () => {
    if (!actionEntryId) return;

    try {
      await approveMutation.mutateAsync({ entryId: actionEntryId });
      setActionDialogOpen(false);
      setActionEntryId(null);
      
      // Auto-scroll la următoarea echipă needitată
      if (selectedTeam) {
        onTeamEdited(selectedTeam);
        
        const nextTeam = getNextUneditedTeam();
        if (nextTeam) {
          onTeamChange(nextTeam);
          toast({
            title: '✅ Pontaj aprobat',
            description: `Trecem automat la echipa ${nextTeam}`,
          });
        } else {
          toast({
            title: '🎉 Toate echipele verificate!',
            description: 'Poți schimba ziua acum sau continua editarea.',
          });
          // NU schimbăm ziua automat - user decide manual
        }
      }
    } catch (error) {
      console.error('[Approval Error]', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-600/20 text-red-900 dark:text-red-200 border-red-600/40 dark:bg-red-950/50 dark:border-red-700';
      case 'high':
        return 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20 dark:bg-red-950/30 dark:border-red-800';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/20 dark:bg-yellow-950/20 dark:border-yellow-800';
      default:
        return 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20 dark:bg-green-950/20 dark:border-green-800';
    }
  };

  // Filtrare pontaje invalide (< 1h durata)
  const validPendingEntries = pendingEntries.filter(entry => {
    if (!entry.clock_in_time || !entry.clock_out_time) return false;
    const duration = (new Date(entry.clock_out_time).getTime() - new Date(entry.clock_in_time).getTime()) / (1000 * 60 * 60);
    return duration >= 1; // Exclude pontaje < 1h
  });

  const approvedEntries = validPendingEntries.filter(e => e.approval_status === 'approved');
  const pendingOnlyEntries = validPendingEntries.filter(e => e.approval_status === 'pending_review');
  const displayedEntries = [...pendingOnlyEntries, ...approvedEntries];

  const reprocessMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('reprocess-missing-segments', {
        body: { 
          mode: 'missing_segments',
          batch_size: 100
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['team-pending-approvals'] });
      toast({
        title: '✅ Recalculare finalizată',
        description: `${data.success}/${data.total} pontaje procesate cu succes`,
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '❌ Eroare recalculare',
        description: error.message,
      });
    },
  });

  if (availableTeams.size === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center">
            Nu există echipe programate în această săptămână
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!selectedTeam) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center">
            Selectați o echipă pentru a vedea pontajele în așteptare
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Aprobare Pontaje</CardTitle>
              <CardDescription>
                Săptămâna {format(new Date(selectedWeek), 'dd MMM yyyy', { locale: ro })}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4 bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
              💡 Fiecare pontaj poate fi editat, aprobat sau șters individual.
            </AlertDescription>
          </Alert>

          {coordinator && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-purple-600">
                  Coordonator
                </Badge>
                <span className="font-medium">{coordinator.full_name}</span>
                <Badge variant="outline" className="text-xs">
                  {coordinator.username}
                </Badge>
              </div>
            </div>
          )}

          {(teamLeader || teamMembers.length > 0) && (
            <div className="mb-6 p-4 bg-muted/30 rounded-lg border">
              <div className="space-y-2">
                {teamLeader && (
                  <div className="flex items-center gap-2 pb-2">
                    <Badge variant="default" className="bg-blue-600">
                      Șef Echipă
                    </Badge>
                    <span className="font-medium">{teamLeader.full_name}</span>
                    <Badge variant="outline" className="text-xs">
                      {teamLeader.username}
                    </Badge>
                  </div>
                )}
                
                {teamMembers
                  .filter(m => m.id !== teamLeader?.id)
                  .map(member => (
                    <div key={member.id} className="flex items-center gap-2 text-sm">
                      <span>{member.full_name}</span>
                      <Badge variant="outline" className="text-xs opacity-60">
                        {member.username}
                      </Badge>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          <div className="flex justify-end mb-4">
            <Button
              onClick={() => reprocessMutation.mutate()}
              disabled={reprocessMutation.isPending}
              variant="secondary"
              size="sm"
              className="gap-2"
            >
              {reprocessMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Recalculează Segmente
            </Button>
          </div>

          {validPendingEntries.length > 0 && (
            <div className="mb-6 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-6 flex-wrap">
                <div>
                  <p className="text-sm text-muted-foreground">Total pontaje valide</p>
                  <p className="text-2xl font-bold">{validPendingEntries.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">În așteptare</p>
                  <p className="text-2xl font-bold text-yellow-600">{pendingOnlyEntries.length}</p>
                </div>
                {approvedEntries.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Deja aprobate</p>
                    <p className="text-2xl font-bold text-green-600">{approvedEntries.length}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {displayedEntries.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-lg font-medium">Nu există pontaje</p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedEntries.map((entry) => {
                const discrepancy = detectDiscrepancies(entry);
                const isApproved = entry.approval_status === 'approved';
                const hasMultiplePontaje = entry.pontajNumber && entry.pontajNumber > 1;
                const isComplete = !!entry.clock_out_time;

                return (
                  <div
                    key={entry.id}
                    className={`p-4 border rounded-lg transition-colors relative ${
                      isApproved
                        ? 'bg-green-50/30 dark:bg-green-950/10 border-green-200 dark:border-green-800 opacity-70'
                        : 'hover:bg-muted/50'
                    } ${discrepancy && !isApproved ? getSeverityColor(discrepancy.severity) : ''}`}
                  >
                    {isApproved && (
                      <div className="absolute top-2 right-2 z-10">
                        <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Deja Aprobat
                        </Badge>
                      </div>
                    )}

                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <p className="font-medium">{entry.profiles.full_name}</p>
                          <Badge variant="outline">{entry.profiles.username}</Badge>
                          {hasMultiplePontaje && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                              Pontaj #{entry.pontajNumber}
                            </Badge>
                          )}
                          {isComplete ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 dark:bg-green-950/30 dark:text-green-300">
                              ✅ COMPLET
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300 dark:bg-yellow-950/30 dark:text-yellow-300">
                              ⏳ ÎN CURS
                            </Badge>
                          )}
                          {(() => {
                            if (!entry.clock_in_time || !entry.clock_out_time) return null;
                            const duration = (new Date(entry.clock_out_time).getTime() - new Date(entry.clock_in_time).getTime()) / (1000 * 60 * 60);
                            if (duration < 1) {
                              return (
                                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-400 dark:bg-red-950/30 dark:text-red-300 dark:border-red-700">
                                  ⚠️ INVALID ({duration.toFixed(1)}h)
                                </Badge>
                              );
                            }
                            if (duration > 24) {
                              return (
                                <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-400 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-700">
                                  ⚠️ SUSPECT ({duration.toFixed(1)}h)
                                </Badge>
                              );
                            }
                            return null;
                          })()}
                        </div>

                        
                        <div className="mb-3 p-3 bg-muted/30 rounded-md">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground text-xs">Intrare</p>
                              <p className="font-medium">
                                {entry.clock_in_time ? formatRomania(entry.clock_in_time, 'HH:mm') : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Ieșire</p>
                              <p className="font-medium">
                                {entry.clock_out_time ? formatRomania(entry.clock_out_time, 'HH:mm') : '-'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {entry.calculated_hours && entry.calculated_hours.total > 0 && (
                          <div className="mb-3 flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">📊 Total Ore:</span>
                            <Badge variant="secondary">{entry.calculated_hours.total.toFixed(2)}h</Badge>
                          </div>
                        )}
                      </div>

                      {!isApproved && (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(entry)}
                            className="gap-1"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="hidden sm:inline">Editează</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApprove(entry.id)}
                            disabled={approveMutation.isPending || !entry.clock_out_time}
                            className="gap-1"
                            title={!entry.clock_out_time ? "❌ Nu poți aproba - lipsește clock-out. Editează pontajul pentru a seta manual." : "Aprobă pontaj"}
                          >
                            <Check className="h-4 w-4" />
                            <span className="hidden sm:inline">Aprobă</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(entry)}
                            className="gap-1"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="hidden sm:inline">Șterge</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>✅ Aprobă pontaj</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmați aprobarea acestui pontaj?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmApproval}>
              Aprobă
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editEntry && (
        <TimeEntryApprovalEditDialog
          entry={editEntry}
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setEditEntry(null);
          }}
          onSuccess={() => {
            // Auto-scroll la următoarea echipă needitată după editare
            if (selectedTeam) {
              onTeamEdited(selectedTeam);
              
              const nextTeam = getNextUneditedTeam();
              if (nextTeam) {
                onTeamChange(nextTeam);
                toast({
                  title: '✅ Pontaj editat și aprobat',
                  description: `Trecem automat la echipa ${nextTeam}`,
                });
              } else {
                toast({
                  title: '🎉 Toate echipele verificate!',
                  description: 'Poți schimba ziua acum sau continua editarea.',
                });
                // NU schimbăm ziua automat - user decide manual
              }
            }
          }}
        />
      )}

      {deleteEntry && (
        <DeleteTimeEntryDialog
          entry={deleteEntry}
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) setDeleteEntry(null);
          }}
          onSuccess={() => {
            // Reîmprospătare automată + navigare la următoarea echipă
            if (selectedTeam) {
              onTeamEdited(selectedTeam);
              
              const nextTeam = getNextUneditedTeam();
              if (nextTeam) {
                onTeamChange(nextTeam);
                toast({
                  title: '🗑️ Pontaj șters',
                  description: `Trecem automat la echipa ${nextTeam}`,
                });
              } else {
                toast({
                  title: '🗑️ Pontaj șters',
                  description: 'Toate echipele au fost verificate.',
                });
              }
            }
            
            // Reîmprospătare forțată a query-urilor locale
            queryClient.invalidateQueries({ 
              queryKey: ['team-pending-approvals', selectedTeam, selectedWeek, selectedDayOfWeek] 
            });
          }}
        />
      )}
    </>
  );
};

