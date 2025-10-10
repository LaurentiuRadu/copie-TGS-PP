import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { Clock, MapPin, Smartphone, User, ChevronDown, LogOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

import { useOptimizedTimeEntries } from "@/hooks/useOptimizedTimeEntries";
import { useRealtimeTimeEntries } from "@/hooks/useRealtimeTimeEntries";

interface TimeEntry {
  id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  clock_in_latitude: number;
  clock_in_longitude: number;
  clock_out_latitude: number | null;
  clock_out_longitude: number | null;
  clock_in_photo_url: string | null;
  clock_out_photo_url: string | null;
  device_id: string | null;
  notes: string | null;
  profiles: {
    full_name: string | null;
  } | null;
  time_entry_segments: Array<{
    segment_type: string;
    hours_decimal: number;
    multiplier: number;
    start_time: string;
    end_time: string;
  }>;
}

const TimeEntries = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  const [showClockOutDialog, setShowClockOutDialog] = useState(false);
  const [isClockingOut, setIsClockingOut] = useState(false);
  const { isAdmin } = useUserRole();

  // ✅ Folosim hook-urile optimizate - eliminare N+1 + duplicate logic
  const { data: entries = [], isLoading: loading, refetch } = useOptimizedTimeEntries(selectedDate);
  
  // ✅ Real-time updates automat gestionat
  useRealtimeTimeEntries(true);

  // Helper functions - folosim function declarations pentru hoisting
  function calculateTotalHours(entry: TimeEntry) {
    if (!entry.time_entry_segments || entry.time_entry_segments.length === 0) {
      if (!entry.clock_out_time) return 0;
      const duration = new Date(entry.clock_out_time).getTime() - new Date(entry.clock_in_time).getTime();
      return duration / (1000 * 60 * 60);
    }
    
    return entry.time_entry_segments.reduce((sum, seg) => sum + seg.hours_decimal, 0);
  }

  function getSegmentLabel(type: string) {
    const labels: Record<string, string> = {
      normal_day: 'Regular',
      normal_night: 'Noapte',
      saturday: 'Sâmbătă',
      sunday: 'Duminică',
      holiday: 'Sărbătoare',
    };
    return labels[type] || type;
  }

  function getSegmentColor(type: string) {
    if (type === 'holiday') return 'bg-red-500/20 text-red-900 dark:text-red-100';
    if (type === 'sunday') return 'bg-purple-500/20 text-purple-900 dark:text-purple-100';
    if (type === 'saturday') return 'bg-blue-500/20 text-blue-900 dark:text-blue-100';
    if (type === 'normal_night') return 'bg-indigo-500/20 text-indigo-900 dark:text-indigo-100';
    return 'bg-green-500/20 text-green-900 dark:text-green-100';
  }

  function groupEntriesByUser(entries: TimeEntry[]) {
    const grouped = entries.reduce((acc, entry) => {
      const userId = entry.profiles?.full_name || 'Necunoscut';
      if (!acc[userId]) {
        acc[userId] = [];
      }
      acc[userId].push(entry);
      return acc;
    }, {} as Record<string, TimeEntry[]>);
    
    return Object.entries(grouped).map(([userName, userEntries]) => ({
      userName,
      entries: userEntries,
      totalEntries: userEntries.length,
      totalHours: userEntries.reduce((sum, e) => sum + calculateTotalHours(e), 0),
      hasActiveEntry: userEntries.some(e => !e.clock_out_time),
    })).sort((a, b) => {
      if (a.hasActiveEntry && !b.hasActiveEntry) return -1;
      if (!a.hasActiveEntry && b.hasActiveEntry) return 1;
      return a.userName.localeCompare(b.userName);
    });
  }

  const groupedUsers = groupEntriesByUser(entries);

  // Funcție pentru închiderea pontajului de către admin
  const handleAdminClockOut = async () => {
    if (!selectedEntry || !isAdmin) return;

    setIsClockingOut(true);
    try {
      const { error } = await supabase
        .from('time_entries')
        .update({ 
          clock_out_time: new Date().toISOString(),
          clock_out_latitude: selectedEntry.clock_in_latitude,
          clock_out_longitude: selectedEntry.clock_in_longitude,
        })
        .eq('id', selectedEntry.id);

      if (error) throw error;

      toast.success('Pontaj închis cu succes');
      setShowClockOutDialog(false);
      setSelectedEntry(null);
      refetch();
    } catch (error) {
      console.error('Error closing time entry:', error);
      toast.error('Eroare la închiderea pontajului');
    } finally {
      setIsClockingOut(false);
    }
  };

  return (
    <div className="w-full p-4 md:p-6 space-y-6">

        {/* Entries List */}
        <Card>
          <CardHeader>
            <CardTitle>
              Pontaje ({entries.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Se încarcă...
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nu există pontaje pentru această dată
              </div>
            ) : (
              groupedUsers.map((group) => (
                <Collapsible key={group.userName} defaultOpen={false}>
                  <Card className="overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <User className="h-5 w-5 text-muted-foreground" />
                            <span className="font-semibold text-lg">{group.userName}</span>
                            <Badge variant="outline">
                              {group.totalEntries} {group.totalEntries === 1 ? 'pontaj' : 'pontaje'}
                            </Badge>
                            {group.hasActiveEntry && (
                              <Badge className="bg-green-500">Activ</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-muted-foreground">
                              Total: {group.totalHours.toFixed(2)}h
                            </span>
                            <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <div className="border-t p-4 space-y-3 bg-muted/30">
                        {group.entries.map((entry) => {
                          const totalHours = calculateTotalHours(entry);
                          const hasSegments = entry.time_entry_segments?.length > 0;

                          return (
                            <Card 
                              key={entry.id}
                              className="cursor-pointer hover:bg-accent/50 transition-colors"
                              onClick={() => setSelectedEntry(entry)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                  <div className="space-y-2 flex-1">
                                    <div className="flex items-center gap-2">
                                      {!entry.clock_out_time && (
                                        <Badge variant="default" className="bg-green-500">Activ</Badge>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                      <div className="flex items-center gap-1">
                                        <Clock className="w-4 h-4" />
                                        {format(new Date(entry.clock_in_time), 'HH:mm')}
                                        {entry.clock_out_time && ` - ${format(new Date(entry.clock_out_time), 'HH:mm')}`}
                                      </div>
                                      
                                      {entry.device_id && (
                                        <div className="flex items-center gap-1">
                                          <Smartphone className="w-4 h-4" />
                                          Device
                                        </div>
                                      )}
                                    </div>

                                    {hasSegments ? (
                                      <div className="space-y-1">
                                        <div className="text-sm font-medium">
                                          Total: {totalHours.toFixed(2)}h
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          {entry.time_entry_segments.map((seg, idx) => (
                                            <Badge key={idx} className={getSegmentColor(seg.segment_type)}>
                                              {getSegmentLabel(seg.segment_type)}: {seg.hours_decimal.toFixed(2)}h
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-sm">
                                        {entry.clock_out_time ? (
                                          <span className="text-muted-foreground">
                                            Total: {totalHours.toFixed(2)}h (nesegmentat)
                                          </span>
                                        ) : (
                                          <span className="text-green-600 font-medium">În desfășurare</span>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex gap-2">
                                    {entry.clock_in_photo_url && (
                                      <img 
                                        src={entry.clock_in_photo_url} 
                                        alt="Clock in" 
                                        className="w-12 h-12 rounded object-cover border-2 border-green-500"
                                      />
                                    )}
                                    {entry.clock_out_photo_url && (
                                      <img 
                                        src={entry.clock_out_photo_url} 
                                        alt="Clock out" 
                                        className="w-12 h-12 rounded object-cover border-2 border-red-500"
                                      />
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))
            )}
          </CardContent>
        </Card>

      {/* Detail Modal */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Detalii Pontaj</DialogTitle>
              {/* Buton pentru admin să închidă pontajul activ */}
              {isAdmin && selectedEntry && !selectedEntry.clock_out_time && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowClockOutDialog(true)}
                  className="flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Închide Pontaj
                </Button>
              )}
            </div>
          </DialogHeader>
          
          {selectedEntry && (
            <div className="space-y-6">
              {/* User Info */}
              <div>
                <h3 className="font-semibold mb-2">Angajat</h3>
                <p className="text-lg">{selectedEntry.profiles?.full_name}</p>
                {selectedEntry.notes && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedEntry.notes}</p>
                )}
              </div>

              {/* Time Info */}
              <div>
                <h3 className="font-semibold mb-2">Interval Lucrat</h3>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>
                    {format(new Date(selectedEntry.clock_in_time), 'dd MMM yyyy HH:mm', { locale: ro })}
                    {selectedEntry.clock_out_time && 
                      ` → ${format(new Date(selectedEntry.clock_out_time), 'dd MMM yyyy HH:mm', { locale: ro })}`
                    }
                  </span>
                </div>
              </div>

              {/* Segments */}
              {selectedEntry.time_entry_segments && selectedEntry.time_entry_segments.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Segmente Ore (Splitting Automat)</h3>
                  <div className="space-y-2">
                    {selectedEntry.time_entry_segments.map((seg, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                        <div className="space-y-1">
                          <div className="font-medium">{getSegmentLabel(seg.segment_type)}</div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(seg.start_time), 'HH:mm')} - {format(new Date(seg.end_time), 'HH:mm')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{seg.hours_decimal.toFixed(2)}h</div>
                        </div>
                      </div>
                    ))}
                    <div className="pt-3 border-t flex justify-between items-center font-semibold">
                      <span>Total:</span>
                      <span className="text-xl text-primary">
                        {calculateTotalHours(selectedEntry).toFixed(2)}h
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Photos */}
              <div>
                <h3 className="font-semibold mb-3">Fotografii Verificare</h3>
                <div className="grid grid-cols-2 gap-4">
                  {selectedEntry.clock_in_photo_url && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Intrare</p>
                      <img 
                        src={selectedEntry.clock_in_photo_url} 
                        alt="Clock in" 
                        className="w-full rounded-lg border-2 border-green-500"
                      />
                    </div>
                  )}
                  {selectedEntry.clock_out_photo_url && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Ieșire</p>
                      <img 
                        src={selectedEntry.clock_out_photo_url} 
                        alt="Clock out" 
                        className="w-full rounded-lg border-2 border-red-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* GPS */}
              <div>
                <h3 className="font-semibold mb-2">Locație GPS</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-green-500" />
                    <span>Intrare: {selectedEntry.clock_in_latitude.toFixed(6)}, {selectedEntry.clock_in_longitude.toFixed(6)}</span>
                  </div>
                  {selectedEntry.clock_out_latitude && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-red-500" />
                      <span>Ieșire: {selectedEntry.clock_out_latitude.toFixed(6)}, {selectedEntry.clock_out_longitude.toFixed(6)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Device Info */}
              {selectedEntry.device_id && (
                <div>
                  <h3 className="font-semibold mb-2">Informații Dispozitiv</h3>
                   <div className="text-sm space-y-1 font-mono text-muted-foreground">
                    <p>Device ID: {selectedEntry.device_id.slice(0, 32)}...</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmare închidere pontaj */}
      <AlertDialog open={showClockOutDialog} onOpenChange={setShowClockOutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmare Închidere Pontaj</AlertDialogTitle>
            <AlertDialogDescription>
              Ești sigur că vrei să închizi pontajul pentru <strong>{selectedEntry?.profiles?.full_name}</strong>?
              <br /><br />
              Ora de ieșire va fi setată la ora curentă: <strong>{format(new Date(), 'dd MMM yyyy HH:mm', { locale: ro })}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClockingOut}>Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAdminClockOut}
              disabled={isClockingOut}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isClockingOut ? 'Se procesează...' : 'Închide Pontaj'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TimeEntries;