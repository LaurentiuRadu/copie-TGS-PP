import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Calendar, Plus, Trash2 } from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';
import { ro } from 'date-fns/locale';

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
}

const dayNames = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];

export default function WeeklySchedules() {
  const queryClient = useQueryClient();
  const [selectedWeek, setSelectedWeek] = useState(() => format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [selectedTeam, setSelectedTeam] = useState('E1');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<ScheduleEntry>({
    team_id: 'E1',
    week_start_date: selectedWeek,
    user_id: '',
    day_of_week: 1,
    location: '',
    activity: '',
    vehicle: '',
    observations: ''
  });

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

  // Create schedule mutation
  const createSchedule = useMutation({
    mutationFn: async (data: ScheduleEntry) => {
      const { data: schedule, error } = await supabase
        .from('weekly_schedules')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;

      // Create notification
      await supabase
        .from('schedule_notifications')
        .insert({
          schedule_id: schedule.id,
          user_id: data.user_id
        });

      return schedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-schedules'] });
      toast.success('Programare adăugată cu succes!');
      setShowForm(false);
      setFormData({
        team_id: selectedTeam,
        week_start_date: selectedWeek,
        user_id: '',
        day_of_week: 1,
        location: '',
        activity: '',
        vehicle: '',
        observations: ''
      });
    },
    onError: (error) => {
      toast.error('Eroare la adăugarea programării');
      console.error(error);
    }
  });

  // Delete schedule mutation
  const deleteSchedule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('weekly_schedules')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-schedules'] });
      toast.success('Programare ștearsă');
    },
    onError: (error) => {
      toast.error('Eroare la ștergere');
      console.error(error);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.user_id) {
      toast.error('Selectează un angajat');
      return;
    }
    createSchedule.mutate(formData);
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
              <Label>Săptămâna</Label>
              <Input
                type="date"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
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
            <div className="flex items-end">
              <Button onClick={() => setShowForm(!showForm)}>
                <Plus className="h-4 w-4 mr-2" />
                Adaugă Programare
              </Button>
            </div>
          </div>

          {/* Add Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label>Angajat *</Label>
                  <Select value={formData.user_id} onValueChange={(value) => setFormData({ ...formData, user_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selectează angajat" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees?.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name || emp.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                <div>
                  <Label>Mașină</Label>
                  <Input
                    value={formData.vehicle}
                    onChange={(e) => setFormData({ ...formData, vehicle: e.target.value })}
                    placeholder="ex: BC37CUL"
                  />
                </div>
                <div>
                  <Label>Observații</Label>
                  <Input
                    value={formData.observations}
                    onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                    placeholder="ex: Coordonator..."
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createSchedule.isPending}>
                  {createSchedule.isPending ? 'Se salvează...' : 'Salvează'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
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
                  <TableHead>Zi</TableHead>
                  <TableHead>Angajat</TableHead>
                  <TableHead>Locație</TableHead>
                  <TableHead>Activitate</TableHead>
                  <TableHead>Mașină</TableHead>
                  <TableHead>Observații</TableHead>
                  <TableHead className="w-[100px]">Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">Se încarcă...</TableCell>
                  </TableRow>
                ) : schedules?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Nu există programări pentru această săptămână
                    </TableCell>
                  </TableRow>
                ) : (
                  schedules?.map((schedule: any) => (
                    <TableRow key={schedule.id}>
                      <TableCell className="font-medium">{dayNames[schedule.day_of_week - 1]}</TableCell>
                      <TableCell>{schedule.profiles?.full_name}</TableCell>
                      <TableCell>{schedule.location}</TableCell>
                      <TableCell>{schedule.activity}</TableCell>
                      <TableCell>{schedule.vehicle}</TableCell>
                      <TableCell>{schedule.observations}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteSchedule.mutate(schedule.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
