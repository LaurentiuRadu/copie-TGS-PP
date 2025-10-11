import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, AlertCircle, CheckCheck } from 'lucide-react';
import { useTeamApprovalWorkflow } from '@/hooks/useTeamApprovalWorkflow';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Intrare</p>
                              <p className="font-medium">
                                {entry.clock_in_time
                                  ? format(new Date(entry.clock_in_time), 'HH:mm', { locale: ro })
                                  : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Ieșire</p>
                              <p className="font-medium">
                                {entry.clock_out_time
                                  ? format(new Date(entry.clock_out_time), 'HH:mm', { locale: ro })
                                  : '-'}
                              </p>
                            </div>
                          </div>
                          {discrepancy && (
                            <div className="mt-2 flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              <p className="text-xs">
                                Discrepanță: {discrepancy.discrepancy_type === 'late_arrival' ? 'Întârziere' : 'Sosire timpurie'} 
                                {' '}(așteptat: {discrepancy.expected_value}, real: {discrepancy.actual_value})
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSingleAction(entry.id, 'approve')}
                          disabled={approveMutation.isPending}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSingleAction(entry.id, 'correct')}
                          disabled={requestCorrectionMutation.isPending}
                        >
                          <AlertCircle className="h-4 w-4 text-yellow-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSingleAction(entry.id, 'reject')}
                          disabled={rejectMutation.isPending}
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
    </>
  );
};
