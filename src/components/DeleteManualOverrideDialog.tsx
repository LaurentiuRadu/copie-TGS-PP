import React, { useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { formatRomania } from '@/lib/timezone';
import { getSegmentIcon, getSegmentLabel } from '@/lib/segments';

interface OverrideEmployee {
  id: string;
  employee_id: string;
  full_name: string;
  username: string;
  work_date: string;
  hours_regular: number;
  hours_night: number;
  hours_passenger: number;
  hours_driving: number;
  hours_equipment: number;
  hours_saturday: number;
  hours_sunday: number;
  hours_holiday: number;
  notes: string;
  calculated_hours: number;
}

interface DeleteManualOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string; // Format: YYYY-MM-DD
}

export const DeleteManualOverrideDialog: React.FC<DeleteManualOverrideDialogProps> = ({
  open,
  onOpenChange,
  selectedDate,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOverrides, setSelectedOverrides] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Query pentru override-uri
  const { data: overrides, isLoading } = useQuery({
    queryKey: ['manual-overrides', selectedDate],
    queryFn: async () => {
      const { data: timesheets, error: timesheetsError } = await supabase
        .from('daily_timesheets')
        .select(`
          id,
          employee_id,
          work_date,
          hours_regular,
          hours_night,
          hours_passenger,
          hours_driving,
          hours_equipment,
          hours_saturday,
          hours_sunday,
          hours_holiday,
          notes
        `)
        .eq('work_date', selectedDate)
        .like('notes', '%[OVERRIDE MANUAL%');

      if (timesheetsError) throw timesheetsError;

      // Pentru fiecare override, obținem și datele calculate din time_entries
      const enrichedData = await Promise.all(
        (timesheets || []).map(async (ts) => {
          // Obține profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, username')
            .eq('id', ts.employee_id)
            .single();

          // Calculează ore din time_entry_segments
          const { data: segments } = await supabase
            .from('time_entry_segments')
            .select(`
              hours_decimal,
              time_entries!inner(user_id, clock_in_time)
            `)
            .eq('time_entries.user_id', ts.employee_id)
            .gte('time_entries.clock_in_time', `${selectedDate}T00:00:00`)
            .lt('time_entries.clock_in_time', `${selectedDate}T23:59:59`);

          const calculatedHours = segments?.reduce((sum, s) => sum + (s.hours_decimal || 0), 0) || 0;

          return {
            ...ts,
            full_name: profile?.full_name || 'Necunoscut',
            username: profile?.username || 'N/A',
            calculated_hours: calculatedHours,
          } as OverrideEmployee;
        })
      );

      return enrichedData;
    },
    enabled: open && !!selectedDate,
  });

  const handleToggleOverride = (overrideId: string) => {
    const newSet = new Set(selectedOverrides);
    if (newSet.has(overrideId)) {
      newSet.delete(overrideId);
    } else {
      newSet.add(overrideId);
    }
    setSelectedOverrides(newSet);
  };

  const handleDeleteSelected = async () => {
    if (selectedOverrides.size === 0) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('daily_timesheets')
        .delete()
        .in('id', Array.from(selectedOverrides));

      if (error) throw error;

      toast({
        title: '✅ Override-uri șterse',
        description: `${selectedOverrides.size} override-uri au fost șterse cu succes. Orele vor fi recalculate din pontaje.`,
      });

      // Invalidate caches
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dailyTimesheets() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.teamPendingApprovals() });
      queryClient.invalidateQueries({ queryKey: ['manual-overrides'] });

      // Reset selection și închide dialog
      setSelectedOverrides(new Set());
      onOpenChange(false);
    } catch (error: any) {
      console.error('[Delete Overrides] Error:', error);
      toast({
        title: '❌ Eroare',
        description: error.message || 'Nu s-au putut șterge override-urile',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getTotalOverrideHours = (override: OverrideEmployee): number => {
    return (
      (override.hours_regular || 0) +
      (override.hours_night || 0) +
      (override.hours_passenger || 0) +
      (override.hours_driving || 0) +
      (override.hours_equipment || 0) +
      (override.hours_saturday || 0) +
      (override.hours_sunday || 0) +
      (override.hours_holiday || 0)
    );
  };

  const getHourTypes = (override: OverrideEmployee): Array<{ type: string; value: number }> => {
    const types = [
      { key: 'hours_regular', label: 'Normal' },
      { key: 'hours_night', label: 'Noapte' },
      { key: 'hours_passenger', label: 'Pasager' },
      { key: 'hours_driving', label: 'Condus' },
      { key: 'hours_equipment', label: 'Utilaj' },
      { key: 'hours_saturday', label: 'Sâmbătă' },
      { key: 'hours_sunday', label: 'Duminică' },
      { key: 'hours_holiday', label: 'Sărbătoare' },
    ];

    return types
      .map((t) => ({
        type: t.label,
        value: (override as any)[t.key] || 0,
      }))
      .filter((t) => t.value > 0);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            🗑️ Șterge Override-uri Manuale
          </AlertDialogTitle>
          <AlertDialogDescription>
            Selectează angajații pentru care dorești să ștergi override-ul manual din{' '}
            <strong>{formatRomania(selectedDate, 'd MMMM yyyy')}</strong>. Orele vor fi recalculate
            automat din pontaje.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : overrides && overrides.length > 0 ? (
            overrides.map((override) => {
              const totalOverride = getTotalOverrideHours(override);
              const hourTypes = getHourTypes(override);

              return (
                <div
                  key={override.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    selectedOverrides.has(override.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedOverrides.has(override.id)}
                      onCheckedChange={() => handleToggleOverride(override.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{override.full_name}</span>
                        <Badge variant="outline" className="text-xs">
                          @{override.username}
                        </Badge>
                      </div>

                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Override:</span>
                          <Badge variant="secondary" className="font-mono">
                            {totalOverride.toFixed(2)}h
                          </Badge>
                          {hourTypes.map((ht) => (
                            <Badge key={ht.type} variant="outline" className="text-xs gap-1">
                              {getSegmentIcon(ht.type.toLowerCase())}
                              {ht.type}
                              <span className="font-mono">{ht.value.toFixed(1)}h</span>
                            </Badge>
                          ))}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Ore calculate din pontaje:</span>
                          <Badge variant="default" className="font-mono">
                            {override.calculated_hours.toFixed(2)}h
                          </Badge>
                          {Math.abs(totalOverride - override.calculated_hours) > 0.1 && (
                            <Badge variant="destructive" className="text-xs">
                              Diferență: {(override.calculated_hours - totalOverride).toFixed(2)}h
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nu există override-uri manuale pentru această zi.</p>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Anulează</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDeleteSelected}
            disabled={selectedOverrides.size === 0 || isDeleting}
            className="gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Se șterge...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Șterge {selectedOverrides.size > 0 ? selectedOverrides.size : ''} override
                {selectedOverrides.size !== 1 ? '-uri' : ''} selectat{selectedOverrides.size !== 1 ? 'e' : ''}
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
