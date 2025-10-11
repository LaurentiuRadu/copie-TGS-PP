import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Check, AlertCircle, CheckCheck, MapPin, Activity, Car, FileText, Moon, Sun, Pencil, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useTeamApprovalWorkflow, type TimeEntryForApproval } from '@/hooks/useTeamApprovalWorkflow';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TimeEntryApprovalEditDialog } from '@/components/TimeEntryApprovalEditDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
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
  availableTeams: Set<string>;
}

export const TeamTimeApprovalManager = ({ selectedWeek, availableTeams }: TeamTimeApprovalManagerProps) => {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  // Reset selected team when week or available teams change
  useEffect(() => {
    if (availableTeams.size > 0) {
      const firstTeam = Array.from(availableTeams)[0];
      setSelectedTeam(firstTeam);
    } else {
      setSelectedTeam(null);
    }
  }, [selectedWeek, availableTeams]);

  const {
    pendingEntries,
    teamLeader,
    coordinator,
    teamMembers = [],
    teamStats,
    isLoading,
    detectDiscrepancies,
    approveMutation,
    approveBatchMutation,
  } = useTeamApprovalWorkflow(selectedTeam, selectedWeek);

  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionEntryId, setActionEntryId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<TimeEntryForApproval | null>(null);
  const [expandedSchedules, setExpandedSchedules] = useState<Set<string>>(new Set());
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [bulkEditMinutes, setBulkEditMinutes] = useState<number>(0);
  const [bulkEditTarget, setBulkEditTarget] = useState<'clock_in' | 'clock_out'>('clock_in');
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

  const handleToggleSelect = (entryId: string) => {
    const newSelected = new Set(selectedEntries);
    if (newSelected.has(entryId)) {
      newSelected.delete(entryId);
    } else {
      newSelected.add(entryId);
    }
    setSelectedEntries(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedEntries.size === pendingEntries.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(pendingEntries.map(e => e.id)));
    }
  };

  const handleBatchApprove = async () => {
    if (selectedEntries.size === 0) return;
    await approveBatchMutation.mutateAsync(Array.from(selectedEntries));
    setSelectedEntries(new Set());
  };

  const handleApprove = (entryId: string) => {
    setActionEntryId(entryId);
    setActionDialogOpen(true);
  };

  const handleEdit = (entry: TimeEntryForApproval) => {
    setEditEntry(entry);
    setEditDialogOpen(true);
  };

  const handleConfirmApproval = async () => {
    if (!actionEntryId) return;

    try {
      await approveMutation.mutateAsync({ entryId: actionEntryId });
      setActionDialogOpen(false);
      setActionEntryId(null);
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

  const displayedEntries = pendingEntries;

  const bulkEditMutation = useMutation({
    mutationFn: async () => {
      const selectedEntriesData = pendingEntries.filter(e => selectedEntries.has(e.id));
      
      const updates = selectedEntriesData.map(async (entry) => {
        const adjustedClockIn = bulkEditTarget === 'clock_in'
          ? new Date(new Date(entry.clock_in_time).getTime() + bulkEditMinutes * 60 * 1000)
          : new Date(entry.clock_in_time);

        const adjustedClockOut = bulkEditTarget === 'clock_out' && entry.clock_out_time
          ? new Date(new Date(entry.clock_out_time).getTime() + bulkEditMinutes * 60 * 1000)
          : entry.clock_out_time ? new Date(entry.clock_out_time) : null;

        // Save originals if first edit
        const updateData: any = {
          clock_in_time: adjustedClockIn.toISOString(),
          clock_out_time: adjustedClockOut?.toISOString(),
          was_edited_by_admin: true,
        };

        if (!entry.original_clock_in_time) {
          updateData.original_clock_in_time = entry.clock_in_time;
        }
        if (!entry.original_clock_out_time && entry.clock_out_time) {
          updateData.original_clock_out_time = entry.clock_out_time;
        }

        return supabase
          .from('time_entries')
          .update(updateData)
          .eq('id', entry.id);
      });

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-pending-approvals'] });
      setBulkEditDialogOpen(false);
      setSelectedEntries(new Set());
      toast({
        title: '✅ Editare în lot finalizată',
        description: `${selectedEntries.size} pontaje au fost corectate`,
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '❌ Eroare editare în lot',
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
          {/* Info Alert */}
          <Alert className="mb-4 bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
              💡 După aprobare, pontajele editate pot fi vizualizate în <strong>Istoric Aprobări</strong> cu orele originale și cele corectate.
            </AlertDescription>
          </Alert>

          {/* Selector echipă */}
          <div className="mb-6">
            <Label htmlFor="team-select">Selectează Echipa</Label>
            <Select value={selectedTeam || ''} onValueChange={setSelectedTeam}>
              <SelectTrigger id="team-select" className="w-[200px]">
                <SelectValue placeholder="Selectează echipa" />
              </SelectTrigger>
              <SelectContent>
                {Array.from(availableTeams).sort((a, b) => {
                  const numA = parseInt(a.replace(/\D/g, ''), 10);
                  const numB = parseInt(b.replace(/\D/g, ''), 10);
                  return numA - numB;
                }).map(team => (
                  <SelectItem key={team} value={team}>
                    Echipa {team}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Informații Echipă */}
          {(teamLeader || coordinator) && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex flex-wrap items-center gap-4">
                {teamLeader && (
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-blue-600">
                      Șef Echipă
                    </Badge>
                    <span className="font-medium">{teamLeader.full_name}</span>
                    <Badge variant="outline" className="text-xs">
                      {teamLeader.username}
                    </Badge>
                  </div>
                )}
                {coordinator && (
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-purple-600">
                      Coordonator
                    </Badge>
                    <span className="font-medium">{coordinator.full_name}</span>
                    <Badge variant="outline" className="text-xs">
                      {coordinator.username}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Membri Echipă */}
              {teamMembers.length > 0 && (
                <div className="mt-4 pt-4 border-t border-blue-300 dark:border-blue-700">
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
                    👥 Membri Echipă ({teamMembers.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {teamMembers.map(member => (
                      <Badge 
                        key={member.id} 
                        variant="secondary"
                        className="text-xs"
                      >
                        {member.full_name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          {pendingEntries.length > 0 && (
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedEntries.size === pendingEntries.length ? 'Deselectează tot' : 'Selectează tot'}
              </Button>
              <Button
                onClick={handleBatchApprove}
                disabled={selectedEntries.size === 0 || approveBatchMutation.isPending}
                size="sm"
              >
                {approveBatchMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCheck className="h-4 w-4 mr-2" />
                )}
                Aprobă selectate ({selectedEntries.size})
              </Button>
              {selectedEntries.size > 0 && (
                <Button
                  onClick={() => setBulkEditDialogOpen(true)}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  Editare în Lot ({selectedEntries.size})
                </Button>
              )}
            </div>
          )}
          {/* Statistici echipă */}
          {teamStats.totalEntries > 0 && (
            <div className="mb-6 p-4 bg-muted/50 rounded-lg flex items-center gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Total pontaje</p>
                <p className="text-2xl font-bold">{teamStats.totalEntries}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">În așteptare</p>
                <p className="text-2xl font-bold text-yellow-600">{teamStats.pendingCount}</p>
              </div>
              {teamStats.avgClockIn && (
                <div>
                  <p className="text-sm text-muted-foreground">Medie intrare</p>
                  <p className="text-2xl font-bold">{teamStats.avgClockIn}</p>
                </div>
              )}
              {teamStats.avgClockOut && (
                <div>
                  <p className="text-sm text-muted-foreground">Medie ieșire</p>
                  <p className="text-2xl font-bold">{teamStats.avgClockOut}</p>
                </div>
              )}
            </div>
          )}

          {/* Lista pontaje */}
          {displayedEntries.length === 0 ? (
            <div className="text-center py-8">
              {pendingEntries.length === 0 ? (
                <>
                  <CheckCheck className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="text-lg font-medium">Toate pontajele sunt aprobate!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Nu există pontaje în așteptare pentru această echipă
                  </p>
                </>
              ) : (
                <>
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-lg font-medium">Niciun pontaj găsit</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Încearcă să modifici filtrele de căutare
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {displayedEntries.map((entry) => {
                const discrepancy = detectDiscrepancies(entry);
                const isSelected = selectedEntries.has(entry.id);

                return (
                  <div
                    key={entry.id}
                    className={`p-4 border rounded-lg transition-colors ${
                      isSelected ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                    } ${discrepancy ? getSeverityColor(discrepancy.severity) : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(entry.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="font-medium">{entry.profiles.full_name}</p>
                            <Badge variant="outline">{entry.profiles.username}</Badge>
                          </div>
                          {/* Data */}
                          <div className="mb-3">
                            <p className="text-xs text-muted-foreground mb-1">Data</p>
                            <p className="text-sm font-medium">
                              {entry.clock_in_time
                                ? format(new Date(entry.clock_in_time), 'EEEE, dd MMM yyyy', { locale: ro })
                                : '-'}
                            </p>
                          </div>

                          {/* Pontaj Original (dacă a fost editat) */}
                          {entry.was_edited_by_admin && entry.original_clock_in_time && (
                            <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-md border border-amber-200 dark:border-amber-800">
                              <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-2 uppercase tracking-wide">
                                ⚠️ Pontaj Original (Angajat)
                              </p>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground text-xs">Intrare</p>
                                  <p className="font-mono text-amber-800 dark:text-amber-200">
                                    {format(new Date(entry.original_clock_in_time), 'HH:mm')}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-xs">Ieșire</p>
                                  <p className="font-mono text-amber-800 dark:text-amber-200">
                                    {entry.original_clock_out_time
                                      ? format(new Date(entry.original_clock_out_time), 'HH:mm')
                                      : '-'}
                                  </p>
                                </div>
                              </div>
                              {entry.approval_notes && (
                                <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800">
                                  <p className="text-xs text-amber-700 dark:text-amber-300">
                                    <span className="font-medium">Motiv:</span> {entry.approval_notes}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Pontaj Curent (corectat sau original) */}
                          <div className="mb-3 p-3 bg-muted/30 rounded-md">
                            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-2">
                              ⏱️ Pontaj {entry.was_edited_by_admin ? 'Corectat' : 'Real'}
                              {entry.was_edited_by_admin && (
                                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                                  ✏️ Editat
                                </Badge>
                              )}
                            </p>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground text-xs">Intrare</p>
                                <p className="font-medium">
                                  {entry.clock_in_time
                                    ? format(new Date(entry.clock_in_time), 'HH:mm', { locale: ro })
                                    : '-'}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Ieșire</p>
                                <p className="font-medium">
                                  {entry.clock_out_time
                                    ? format(new Date(entry.clock_out_time), 'HH:mm', { locale: ro })
                                    : '-'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Total Ore Brute */}
                          {entry.calculated_hours && entry.calculated_hours.total > 0 ? (
                            <div className="mb-3 flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground">📊 Total Ore Brute:</span>
                              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400">
                                {entry.calculated_hours.total.toFixed(2)}h
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                (pauza se aplică automat după aprobare)
                              </span>
                            </div>
                          ) : (
                            <div className="mb-3 text-sm text-amber-600">
                              ⚠️ Clock-out lipsește
                            </div>
                          )}

                          {/* Programare - COLLAPSIBLE */}
                          {(entry.scheduled_shift || entry.scheduled_location || entry.scheduled_activity) && (
                            <Collapsible
                              open={isScheduleExpanded(entry.id)}
                              onOpenChange={() => toggleSchedule(entry.id)}
                              className="mb-3"
                            >
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full justify-between hover:bg-blue-50 dark:hover:bg-blue-950/20 border-blue-200 dark:border-blue-800"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                                      📋 Programare
                                    </span>
                                    {/* Badges compacte când e collapsed */}
                                    {!isScheduleExpanded(entry.id) && (
                                      <div className="flex items-center gap-1">
                                        {entry.scheduled_shift && (
                                          <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                            {entry.scheduled_shift.toLowerCase() === 'zi' ? '⭐' : '🌙'}
                                          </Badge>
                                        )}
                                        {entry.scheduled_location && (
                                          <Badge variant="outline" className="text-[10px] px-1 py-0 max-w-[80px] truncate">
                                            {entry.scheduled_location}
                                          </Badge>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {isScheduleExpanded(entry.id) ? (
                                    <ChevronUp className="h-4 w-4 text-blue-600" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-blue-600" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>

                              <CollapsibleContent className="mt-2">
                                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
                                  <div className="space-y-2 text-sm">
                                    {entry.scheduled_shift && (
                                      <div className="flex items-center gap-2">
                                        {entry.scheduled_shift.toLowerCase() === 'zi' ? (
                                          <Sun className="h-3.5 w-3.5 text-yellow-600" />
                                        ) : (
                                          <Moon className="h-3.5 w-3.5 text-blue-600" />
                                        )}
                                        <span className="text-muted-foreground text-xs">Tură:</span>
                                        <Badge variant={entry.scheduled_shift.toLowerCase() === 'zi' ? 'default' : 'secondary'} className="text-xs">
                                          {entry.scheduled_shift}
                                        </Badge>
                                      </div>
                                    )}
                                    {entry.scheduled_location && (
                                      <div className="flex items-start gap-2">
                                        <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-red-600" />
                                        <div className="flex-1">
                                          <span className="text-muted-foreground text-xs">Locație:</span>
                                          <p className="text-xs mt-0.5">{entry.scheduled_location}</p>
                                        </div>
                                      </div>
                                    )}
                                    {entry.scheduled_activity && (
                                      <div className="flex items-start gap-2">
                                        <Activity className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-purple-600" />
                                        <div className="flex-1">
                                          <span className="text-muted-foreground text-xs">Proiect:</span>
                                          <p className="text-xs mt-0.5">{entry.scheduled_activity}</p>
                                        </div>
                                      </div>
                                    )}
                                    {entry.scheduled_vehicle && (
                                      <div className="flex items-center gap-2">
                                        <Car className="h-3.5 w-3.5 text-green-600" />
                                        <span className="text-muted-foreground text-xs">Mașină:</span>
                                        <p className="text-xs font-medium">{entry.scheduled_vehicle}</p>
                                      </div>
                                    )}
                                    {entry.scheduled_observations && (
                                      <div className="flex items-start gap-2">
                                        <FileText className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-gray-600" />
                                        <div className="flex-1">
                                          <span className="text-muted-foreground text-xs">Observații:</span>
                                          <p className="text-xs mt-0.5 italic">{entry.scheduled_observations}</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          )}

                          {/* Discrepancy */}
                          {discrepancy && (
                            <>
                              <div className="mt-2 flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded border border-yellow-200 dark:border-yellow-800">
                                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-600" />
                                <p className="text-xs">
                                  Discrepanță: {discrepancy.discrepancy_type === 'late_arrival' ? 'Întârziere' : 'Sosire timpurie'} 
                                  {' '}(așteptat: {discrepancy.expected_value}, real: {discrepancy.actual_value})
                                </p>
                              </div>
                              {discrepancy.severity === 'critical' && (
                                <Alert variant="destructive" className="mt-2">
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertDescription>
                                    ⚠️ <strong>ATENȚIE:</strong> Diferență de peste 2 ore față de media echipei!
                                    <br />
                                    Verifică dacă angajatul a uitat să bată cartela.
                                  </AlertDescription>
                                </Alert>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(entry)}
                          title="Editează orele și aprobă automat"
                        >
                          <Pencil className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleApprove(entry.id)}
                          disabled={approveMutation.isPending}
                          title="Aprobă pontajul așa cum este"
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Confirmation Dialog */}
      <AlertDialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>✅ Aprobă pontaj</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmați aprobarea acestui pontaj? Orele vor fi fragmentate automat (zi/noapte/sâmbătă/duminică) și pauza va fi aplicată conform regulamentului.
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

      {/* Edit Dialog */}
      {editEntry && (
        <TimeEntryApprovalEditDialog
          entry={editEntry}
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setEditEntry(null);
          }}
        />
      )}

      {/* Bulk Edit Dialog */}
      <AlertDialog open={bulkEditDialogOpen} onOpenChange={setBulkEditDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>✏️ Editare în Lot</AlertDialogTitle>
            <AlertDialogDescription>
              Aplică aceeași corectare la {selectedEntries.size} pontaje selectate
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Ajustează</Label>
              <Select value={bulkEditTarget} onValueChange={(v: any) => setBulkEditTarget(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clock_in">Clock-In</SelectItem>
                  <SelectItem value="clock_out">Clock-Out</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Ajustare (minute)</Label>
              <Input
                type="number"
                value={bulkEditMinutes}
                onChange={(e) => setBulkEditMinutes(parseInt(e.target.value) || 0)}
                placeholder="Ex: -15 (înainte), +30 (după)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Valori negative pentru mai devreme, pozitive pentru mai târziu
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Exemplu: +30 min la Clock-In = toți vor fi corectați cu +30 minute
              </AlertDescription>
            </Alert>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkEditMutation.mutate()}
              disabled={bulkEditMutation.isPending || bulkEditMinutes === 0}
            >
              {bulkEditMutation.isPending ? 'Salvez...' : `Aplică la ${selectedEntries.size} pontaje`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
