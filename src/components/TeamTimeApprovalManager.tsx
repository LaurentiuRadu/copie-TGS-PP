import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Check, X, AlertCircle, CheckCheck, MapPin, Activity, Car, FileText, Moon, Sun, Pencil, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { useTeamApprovalWorkflow, type TimeEntryForApproval } from '@/hooks/useTeamApprovalWorkflow';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TimeEntryApprovalEditDialog } from '@/components/TimeEntryApprovalEditDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
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
import { Textarea } from '@/components/ui/textarea';
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
    teamStats,
    isLoading,
    detectDiscrepancies,
    approveMutation,
    approveBatchMutation,
    rejectMutation,
    requestCorrectionMutation,
  } = useTeamApprovalWorkflow(selectedTeam, selectedWeek);

  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'correct'>('approve');
  const [actionEntryId, setActionEntryId] = useState<string | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<TimeEntryForApproval | null>(null);
  const [expandedSchedules, setExpandedSchedules] = useState<Set<string>>(new Set());
  const [expandedCalculatedHours, setExpandedCalculatedHours] = useState<Set<string>>(new Set());
  const [recalculating, setRecalculating] = useState<Set<string>>(new Set());
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

  const toggleCalculatedHours = (entryId: string) => {
    setExpandedCalculatedHours(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const isCalculatedHoursExpanded = (entryId: string) => expandedCalculatedHours.has(entryId);

  const handleRecalculate = async (entry: TimeEntryForApproval) => {
    setRecalculating(prev => new Set(prev).add(entry.id));
    
    try {
      const { error } = await supabase.functions.invoke('calculate-time-segments', {
        body: { time_entry_id: entry.id }
      });

      if (error) throw error;

      toast({
        title: '✅ Recalculat cu succes',
        description: `Orele pentru ${entry.profiles.full_name} au fost recalculate.`,
      });

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['team-pending-approvals'] });
    } catch (error: any) {
      console.error('Error recalculating:', error);
      toast({
        title: '❌ Eroare la recalculare',
        description: error.message || 'Nu s-au putut recalcula orele.',
        variant: 'destructive',
      });
    } finally {
      setRecalculating(prev => {
        const newSet = new Set(prev);
        newSet.delete(entry.id);
        return newSet;
      });
    }
  };

  const handleRecalculateAll = async () => {
    const entriesToRecalc = pendingEntries.filter(e => 
      !e.calculated_hours || e.calculated_hours.total === 0
    );

    if (entriesToRecalc.length === 0) {
      toast({
        title: 'ℹ️ Nicio acțiune necesară',
        description: 'Toate pontajele au orele calculate.',
      });
      return;
    }

    toast({
      title: '🔄 Recalculare în curs...',
      description: `Se recalculează ${entriesToRecalc.length} pontaj(e)...`,
    });

    let successCount = 0;
    let errorCount = 0;

    for (const entry of entriesToRecalc) {
      try {
        await supabase.functions.invoke('calculate-time-segments', {
          body: { time_entry_id: entry.id }
        });
        successCount++;
      } catch (error) {
        console.error(`Error recalculating entry ${entry.id}:`, error);
        errorCount++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ['team-pending-approvals'] });

    toast({
      title: successCount > 0 ? '✅ Recalculare completă' : '❌ Eroare',
      description: `${successCount} pontaj(e) recalculat(e) cu succes${errorCount > 0 ? `, ${errorCount} erori` : ''}.`,
      variant: errorCount > 0 ? 'destructive' : 'default',
    });
  };

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

  const handleSingleAction = (
    entryId: string,
    type: 'approve' | 'reject' | 'correct'
  ) => {
    setActionEntryId(entryId);
    setActionType(type);
    setActionDialogOpen(true);
  };

  const handleEdit = (entry: TimeEntryForApproval) => {
    setEditEntry(entry);
    setEditDialogOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!actionEntryId) return;

    try {
      if (actionType === 'approve') {
        await approveMutation.mutateAsync({ entryId: actionEntryId, notes: actionNotes });
      } else if (actionType === 'reject') {
        await rejectMutation.mutateAsync({ entryId: actionEntryId, reason: actionNotes });
      } else if (actionType === 'correct') {
        await requestCorrectionMutation.mutateAsync({ entryId: actionEntryId, notes: actionNotes });
      }
      setActionDialogOpen(false);
      setActionNotes('');
      setActionEntryId(null);
    } catch (error) {
      console.error('[Action Error]', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-green-100 text-green-800 border-green-300';
    }
  };

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
            {pendingEntries.length > 0 && pendingEntries.some(e => !e.calculated_hours || e.calculated_hours.total === 0) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRecalculateAll}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Recalculează Toate
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Selector echipă */}
          <div className="mb-6">
            <Label htmlFor="team-select">Selectează Echipa</Label>
            <Select value={selectedTeam || ''} onValueChange={setSelectedTeam}>
              <SelectTrigger id="team-select" className="w-[200px]">
                <SelectValue placeholder="Selectează echipa" />
              </SelectTrigger>
              <SelectContent>
                {Array.from(availableTeams).sort().map(team => (
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
            </div>
          )}

          {/* Action buttons */}
          {pendingEntries.length > 0 && (
            <div className="flex items-center gap-2 mb-6">
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
          {pendingEntries.length === 0 ? (
            <div className="text-center py-8">
              <CheckCheck className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-lg font-medium">Toate pontajele sunt aprobate!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Nu există pontaje în așteptare pentru această echipă
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingEntries.map((entry) => {
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

                          {/* Pontaj Real */}
                          <div className="mb-3 p-3 bg-muted/30 rounded-md">
                            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                              ⏱️ Pontaj Real
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

                          {/* Calcul Ore - COLLAPSIBLE (NOU) */}
                          {entry.calculated_hours && (
                            <Collapsible
                              open={isCalculatedHoursExpanded(entry.id)}
                              onOpenChange={() => toggleCalculatedHours(entry.id)}
                              className="mb-3"
                            >
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full justify-between hover:bg-green-50 dark:hover:bg-green-950/20 border-green-200 dark:border-green-800"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-green-700 dark:text-green-400">
                                      📊 Calcul Ore
                                    </span>
                                    {!isCalculatedHoursExpanded(entry.id) && (
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400">
                                        Total: {entry.calculated_hours.total.toFixed(2)}h
                                      </Badge>
                                    )}
                                  </div>
                                  {isCalculatedHoursExpanded(entry.id) ? (
                                    <ChevronUp className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-green-600" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                              
                              <CollapsibleContent className="pt-3 px-3 pb-2 bg-green-50/30 dark:bg-green-950/10 rounded-b-md border border-t-0 border-green-200 dark:border-green-800">
                                <div className="space-y-2 text-sm">
                                  {entry.calculated_hours.hours_regular > 0 && (
                                    <div className="flex justify-between items-center">
                                      <span className="text-muted-foreground">✅ Ore Regular</span>
                                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400">
                                        {entry.calculated_hours.hours_regular.toFixed(2)}h
                                      </Badge>
                                    </div>
                                  )}
                                  
                                  {entry.calculated_hours.hours_night > 0 && (
                                    <div className="flex justify-between items-center">
                                      <span className="text-muted-foreground">🌙 Ore Noapte</span>
                                      <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-400">
                                        {entry.calculated_hours.hours_night.toFixed(2)}h
                                      </Badge>
                                    </div>
                                  )}
                                  
                                  {entry.calculated_hours.hours_saturday > 0 && (
                                    <div className="flex justify-between items-center">
                                      <span className="text-muted-foreground">📅 Ore Sâmbătă</span>
                                      <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-400">
                                        {entry.calculated_hours.hours_saturday.toFixed(2)}h
                                      </Badge>
                                    </div>
                                  )}
                                  
                                  {entry.calculated_hours.hours_sunday > 0 && (
                                    <div className="flex justify-between items-center">
                                      <span className="text-muted-foreground">📅 Ore Duminică</span>
                                      <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-400">
                                        {entry.calculated_hours.hours_sunday.toFixed(2)}h
                                      </Badge>
                                    </div>
                                  )}
                                  
                                  {entry.calculated_hours.hours_holiday > 0 && (
                                    <div className="flex justify-between items-center">
                                      <span className="text-muted-foreground">🎉 Ore Sărbătoare</span>
                                      <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400">
                                        {entry.calculated_hours.hours_holiday.toFixed(2)}h
                                      </Badge>
                                    </div>
                                  )}
                                  
                                  <Separator className="my-2" />
                                  
                                  <div className="flex justify-between items-center font-semibold">
                                    <span>📊 Total Ore Lucrate</span>
                                    <Badge className="bg-green-600 text-white dark:bg-green-700">
                                      {entry.calculated_hours.total.toFixed(2)}h
                                    </Badge>
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          )}

          {!entry.calculated_hours && entry.clock_out_time && (
            <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-2">
                    ⚠️ Orele nu au fost calculate încă.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRecalculate(entry)}
                  disabled={recalculating.has(entry.id)}
                  className="shrink-0"
                >
                  {recalculating.has(entry.id) ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  <span className="ml-1 text-xs">Recalculează</span>
                </Button>
              </div>
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
                            <div className="mt-2 flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded border border-yellow-200 dark:border-yellow-800">
                              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-600" />
                              <p className="text-xs">
                                Discrepanță: {discrepancy.discrepancy_type === 'late_arrival' ? 'Întârziere' : 'Sosire timpurie'} 
                                {' '}(așteptat: {discrepancy.expected_value}, real: {discrepancy.actual_value})
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {(!entry.calculated_hours || entry.calculated_hours.total === 0) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRecalculate(entry)}
                            disabled={recalculating.has(entry.id)}
                            title="Recalculează ore"
                          >
                            {recalculating.has(entry.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                            ) : (
                              <RefreshCw className="h-4 w-4 text-blue-600" />
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(entry)}
                          title="Editează orele"
                        >
                          <Pencil className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSingleAction(entry.id, 'approve')}
                          disabled={approveMutation.isPending}
                          title="Aprobă"
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSingleAction(entry.id, 'correct')}
                          disabled={requestCorrectionMutation.isPending}
                          title="Solicită corectare"
                        >
                          <AlertCircle className="h-4 w-4 text-yellow-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSingleAction(entry.id, 'reject')}
                          disabled={rejectMutation.isPending}
                          title="Respinge"
                        >
                          <X className="h-4 w-4 text-red-600" />
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

      {/* Action Dialog */}
      <AlertDialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'approve' && 'Aprobă pontaj'}
              {actionType === 'reject' && 'Respinge pontaj'}
              {actionType === 'correct' && 'Solicită corectare'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'approve' && 'Confirmați aprobarea acestui pontaj?'}
              {actionType === 'reject' && 'Introduceți motivul respingerii:'}
              {actionType === 'correct' && 'Introduceți ce trebuie corectat:'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(actionType === 'reject' || actionType === 'correct') && (
            <div className="py-4">
              <Label htmlFor="notes">Notițe</Label>
              <Textarea
                id="notes"
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Introduceți detalii..."
                className="mt-2"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction}>
              Confirmă
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
    </>
  );
};
