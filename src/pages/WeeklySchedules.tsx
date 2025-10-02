import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Calendar, Plus, Trash2, Edit } from 'lucide-react';
import { format, startOfWeek, addDays, getWeek } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

import { useRealtimeSchedules } from '@/hooks/useRealtimeSchedules';

interface ScheduleEntry {
  id?: string;
  team_id: string;
  week_start_date: string;
  user_id: string;
  day_of_week: number;
  location: string;
  activity: string;
  vehicle: string;
  observations: string;
  shift_type: string;
}

const dayNames = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];

const AVAILABLE_VEHICLES = [
  'B-119-ARF',
  'B-169-TGS',
  'B-777-TGS',
  'B-997-TGS',
  'BC-19-TGS',
  'BC-29-CUL',
  'BC-37-CUL',
  'BC-61-CUL',
  'BC-81-TGS',
  'BC-99-CUL'
];

export default function WeeklySchedules() {
  const queryClient = useQueryClient();
  useRealtimeSchedules(true);
  const [selectedWeek, setSelectedWeek] = useState(() => format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [selectedTeam, setSelectedTeam] = useState('E1');
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [formData, setFormData] = useState({
    team_id: 'E1',
    week_start_date: selectedWeek,
    day_of_week: 1,
    location: '',
    activity: '',
    observations: '',
    shift_type: 'zi'
  });

  const weekNumber = getWeek(new Date(selectedWeek), { weekStartsOn: 1 });

  // Fetch employees
  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .order('full_name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch schedules
  const { data: schedules, isLoading } = useQuery({
    queryKey: ['weekly-schedules', selectedWeek, selectedTeam],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_schedules')
        .select('*, profiles!weekly_schedules_user_id_fkey(full_name)')
        .eq('week_start_date', selectedWeek)
        .eq('team_id', selectedTeam)
        .order('day_of_week');
      if (error) throw error;
      return data;
    }
  });

  // Filtrare angajați disponibili - exclude pe cei deja programați în ziua selectată
  const availableEmployees = useMemo(() => {
    if (!employees || !schedules) return employees || [];
    
    // Dacă editezi, exclude programările celorlalți din ziua selectată
    const occupiedUserIds = schedules
      .filter(s => 
        s.day_of_week === formData.day_of_week && 
        (!editingSchedule || s.id !== editingSchedule.id)
      )
      .map(s => s.user_id);
    
    return employees.filter(emp => !occupiedUserIds.includes(emp.id));
  }, [employees, schedules, formData.day_of_week, editingSchedule]);

  // Create/Update schedule mutation
  const createSchedule = useMutation({
    mutationFn: async () => {
      if (selectedEmployees.length === 0) {
        throw new Error('Selectează cel puțin un angajat');
      }

      const vehicles = selectedVehicles.join(', ');

      // Dacă editezi
      if (editingSchedule) {
        const { error } = await supabase
          .from('weekly_schedules')
          .update({
            location: formData.location,
            activity: formData.activity,
            vehicle: vehicles,
            observations: formData.observations,
            shift_type: formData.shift_type,
            day_of_week: formData.day_of_week
          })
          .eq('id', editingSchedule.id);
        
        if (error) throw error;
        return [editingSchedule];
      }

      // Dacă adaugi
      const scheduleEntries = selectedEmployees.map(userId => ({
        team_id: formData.team_id,
        week_start_date: formData.week_start_date,
        user_id: userId,
        day_of_week: formData.day_of_week,
        location: formData.location,
        activity: formData.activity,
        vehicle: vehicles,
        observations: formData.observations,
        shift_type: formData.shift_type
      }));

      const { data: schedules, error } = await supabase
        .from('weekly_schedules')
        .insert(scheduleEntries)
        .select();
      
      if (error) throw error;

      // Create notifications for all employees
      const notifications = schedules.map(schedule => ({
        schedule_id: schedule.id,
        user_id: schedule.user_id
      }));

      await supabase
        .from('schedule_notifications')
        .insert(notifications);

      return schedules;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-schedules'] });
      toast.success(editingSchedule ? 'Programare actualizată!' : 'Programări adăugate cu succes!');
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Eroare la salvarea programărilor');
      console.error('Schedule save error:', error);
    }
  });

  // Delete schedule(s) mutation
  const deleteSchedule = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('weekly_schedules')
        .delete()
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-schedules'] });
      toast.success('Programare(i) ștearsă(e)');
      setSelectedScheduleIds([]);
    },
    onError: (error) => {
      toast.error('Eroare la ștergere');
      console.error('Schedule delete error:', error);
    }
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingSchedule(null);
    setSelectedEmployees([]);
    setSelectedVehicles([]);
    setFormData({
      team_id: selectedTeam,
      week_start_date: selectedWeek,
      day_of_week: 1,
      location: '',
      activity: '',
      observations: '',
      shift_type: 'zi'
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule && selectedEmployees.length === 0) {
      toast.error('Selectează cel puțin un angajat');
      return;
    }
    createSchedule.mutate();
  };

  const handleEdit = (schedule: any) => {
    setEditingSchedule(schedule);
    setShowForm(true);
    setSelectedEmployees([schedule.user_id]);
    setSelectedVehicles(schedule.vehicle ? schedule.vehicle.split(',').map((v: string) => v.trim()) : []);
    setFormData({
      team_id: schedule.team_id,
      week_start_date: schedule.week_start_date,
      day_of_week: schedule.day_of_week,
      location: schedule.location || '',
      activity: schedule.activity || '',
      observations: schedule.observations || '',
      shift_type: schedule.shift_type
    });
  };

  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const toggleVehicle = (vehicle: string) => {
    setSelectedVehicles(prev => 
      prev.includes(vehicle) 
        ? prev.filter(v => v !== vehicle)
        : [...prev, vehicle]
    );
  };

  const toggleScheduleSelection = (scheduleId: string) => {
    setSelectedScheduleIds(prev =>
      prev.includes(scheduleId)
        ? prev.filter(id => id !== scheduleId)
        : [...prev, scheduleId]
    );
  };

  const toggleAllSchedules = () => {
    if (selectedScheduleIds.length === schedules?.length) {
      setSelectedScheduleIds([]);
    } else {
      setSelectedScheduleIds(schedules?.map((s: any) => s.id) || []);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedScheduleIds.length === 0) {
      toast.error('Selectează cel puțin o programare');
      return;
    }
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    deleteSchedule.mutate(selectedScheduleIds);
    setShowDeleteDialog(false);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Programare Săptămânală
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label>Săptămâna (Nr. {weekNumber})</Label>
              <Input
                type="date"
                value={selectedWeek}
                onChange={(e) => {
                  setSelectedWeek(e.target.value);
                  setFormData(prev => ({ ...prev, week_start_date: e.target.value }));
                }}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label>Echipa</Label>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => `E${i + 1}`).map(team => (
                    <SelectItem key={team} value={team}>{team}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => { resetForm(); setShowForm(!showForm); }}>
                <Plus className="h-4 w-4 mr-2" />
                Adaugă Programare
              </Button>
              {selectedScheduleIds.length > 0 && (
                <Button variant="destructive" onClick={handleDeleteSelected}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Șterge ({selectedScheduleIds.length})
                </Button>
              )}
            </div>
          </div>

          {/* Add/Edit Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {editingSchedule ? 'Editează Programare' : 'Adaugă Programare Nouă'}
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Multi-select Angajați */}
                <div className="space-y-3">
                  <Label>Angajați * {editingSchedule ? '' : '(selectare multiplă)'}</Label>
                  {editingSchedule ? (
                    <Input 
                      value={employees?.find(e => e.id === editingSchedule.user_id)?.full_name || ''} 
                      disabled 
                      className="bg-muted"
                    />
                  ) : (
                    <>
                      <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                        {availableEmployees.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Toți angajații sunt deja programați în această zi</p>
                        ) : (
                          availableEmployees.map(emp => (
                            <div key={emp.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`emp-${emp.id}`}
                                checked={selectedEmployees.includes(emp.id)}
                                onCheckedChange={() => toggleEmployee(emp.id)}
                              />
                              <label
                                htmlFor={`emp-${emp.id}`}
                                className="text-sm cursor-pointer flex-1"
                              >
                                {emp.full_name || emp.username}
                              </label>
                            </div>
                          ))
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {selectedEmployees.length} angajat(i) selectat(i) • {availableEmployees.length} disponibil(i)
                      </p>
                    </>
                  )}
                </div>

                {/* Multi-select Mașini */}
                <div className="space-y-3">
                  <Label>Mașini (selectare multiplă)</Label>
                  <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                    {AVAILABLE_VEHICLES.map(vehicle => (
                      <div key={vehicle} className="flex items-center space-x-2">
                        <Checkbox
                          id={`vehicle-${vehicle}`}
                          checked={selectedVehicles.includes(vehicle)}
                          onCheckedChange={() => toggleVehicle(vehicle)}
                        />
                        <label
                          htmlFor={`vehicle-${vehicle}`}
                          className="text-sm cursor-pointer flex-1 font-mono"
                        >
                          {vehicle}
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedVehicles.length} mașină/i selectată/e
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label>Zi *</Label>
                  <Select value={String(formData.day_of_week)} onValueChange={(value) => setFormData({ ...formData, day_of_week: Number(value) })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dayNames.map((day, idx) => (
                        <SelectItem key={idx + 1} value={String(idx + 1)}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tip Tură *</Label>
                  <Select value={formData.shift_type} onValueChange={(value) => setFormData({ ...formData, shift_type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zi">Zi</SelectItem>
                      <SelectItem value="noapte">Noapte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Locație</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="ex: Bacău"
                  />
                </div>
                <div>
                  <Label>Activitate</Label>
                  <Input
                    value={formData.activity}
                    onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
                    placeholder="ex: MIV"
                  />
                </div>
              </div>

              <div>
                <Label>Observații</Label>
                <Input
                  value={formData.observations}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  placeholder="ex: Coordonator..."
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createSchedule.isPending}>
                  {createSchedule.isPending ? 'Se salvează...' : (editingSchedule ? 'Actualizează' : 'Salvează Programări')}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Anulează
                </Button>
              </div>
            </form>
          )}

          {/* Schedule Table */}
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={schedules?.length > 0 && selectedScheduleIds.length === schedules?.length}
                      onCheckedChange={toggleAllSchedules}
                    />
                  </TableHead>
                  <TableHead>Zi</TableHead>
                  <TableHead>Tură</TableHead>
                  <TableHead>Angajat</TableHead>
                  <TableHead>Locație</TableHead>
                  <TableHead>Activitate</TableHead>
                  <TableHead>Mașină</TableHead>
                  <TableHead>Observații</TableHead>
                  <TableHead className="w-[120px]">Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">Se încarcă...</TableCell>
                  </TableRow>
                ) : schedules?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      Nu există programări pentru această săptămână
                    </TableCell>
                  </TableRow>
                ) : (
                  schedules?.map((schedule: any) => (
                    <TableRow key={schedule.id} className={selectedScheduleIds.includes(schedule.id) ? 'bg-muted/50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedScheduleIds.includes(schedule.id)}
                          onCheckedChange={() => toggleScheduleSelection(schedule.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{dayNames[schedule.day_of_week - 1]}</TableCell>
                      <TableCell>
                        <span className={schedule.shift_type === 'noapte' ? 'text-blue-600 dark:text-blue-400 font-medium' : ''}>
                          {schedule.shift_type === 'zi' ? '☀️ Zi' : '🌙 Noapte'}
                        </span>
                      </TableCell>
                      <TableCell>{schedule.profiles?.full_name}</TableCell>
                      <TableCell>{schedule.location}</TableCell>
                      <TableCell>{schedule.activity}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {schedule.vehicle?.split(',').map((v: string, idx: number) => (
                            <Badge key={idx} variant="secondary" className="font-mono">
                              {v.trim()}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{schedule.observations}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(schedule)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteSchedule.mutate([schedule.id])}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ești sigur?</AlertDialogTitle>
            <AlertDialogDescription>
              Vei șterge {selectedScheduleIds.length} programare/i. Această acțiune nu poate fi anulată.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Șterge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
