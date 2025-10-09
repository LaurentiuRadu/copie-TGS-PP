import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { toast } from 'sonner';
import { Calendar, Plus, Trash2, Edit, Users, MapPin, Activity, Car, User, X, Check, ChevronsUpDown, Copy, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfWeek, addDays, getWeek } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { SimpleDateRangePicker } from '@/components/ui/simple-date-range-picker';
import { AdminLayout } from '@/components/AdminLayout';
import { cn } from '@/lib/utils';

import { useRealtimeSchedules } from '@/hooks/useRealtimeSchedules';
import { STALE_TIME } from '@/lib/queryConfig';

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
  const navigate = useNavigate();
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
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [teamToDuplicate, setTeamToDuplicate] = useState<string>('');
  const [targetWeek, setTargetWeek] = useState<string>('');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [projectManagerId, setProjectManagerId] = useState<string>('');
  const [teamLeaderId, setTeamLeaderId] = useState<string>('');
  const [activeTab, setActiveTab] = useState('summary');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  
  // Configuration per day - each day can have multiple location entries
  interface DayConfiguration {
    location: string;
    activity: string;
    vehicle: string;
    shift_type: 'zi' | 'noapte';
    observations: string;
  }
  const [dayConfigurations, setDayConfigurations] = useState<Record<number, DayConfiguration[]>>({});
  
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

  // Navigate between weeks
  const goToPreviousWeek = () => {
    const newWeek = format(startOfWeek(addDays(new Date(selectedWeek), -7), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    setSelectedWeek(newWeek);
    setFormData(prev => ({ ...prev, week_start_date: newWeek }));
  };

  const goToNextWeek = () => {
    const newWeek = format(startOfWeek(addDays(new Date(selectedWeek), 7), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    setSelectedWeek(newWeek);
    setFormData(prev => ({ ...prev, week_start_date: newWeek }));
  };

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
    },
    staleTime: STALE_TIME.STATIC_DATA,
  });

  // Fetch locations
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
    staleTime: STALE_TIME.STATIC_DATA,
  });

  // Fetch projects
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
    staleTime: STALE_TIME.STATIC_DATA,
  });
  
  // Fetch execution items ("De executat")
  const { data: executionItems } = useQuery({
    queryKey: ['execution_items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('execution_items')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
    staleTime: STALE_TIME.STATIC_DATA,
  });
  
  // Fetch schedules for all teams in the selected week
  const { data: schedules, isLoading } = useQuery({
    queryKey: ['weekly-schedules', selectedWeek],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_schedules')
        .select('*')
        .eq('week_start_date', selectedWeek)
        .order('team_id')
        .order('day_of_week');
      if (error) throw error;
      
      // Fetch employee names separately
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(s => s.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .in('id', userIds);
        
        // Merge employee names into schedules
        return data.map(schedule => ({
          ...schedule,
          profiles: profiles?.find(p => p.id === schedule.user_id) || null
        }));
      }
      
      return data;
    }
  });

  // Filter schedules by selected team for details tab
  const teamSchedules = useMemo(() => {
    if (!schedules) return [];
    return schedules.filter(s => s.team_id === selectedTeam);
  }, [schedules, selectedTeam]);

  // Filtrare angajați disponibili - exclude pe cei deja programați în ziua selectată
  const availableEmployees = useMemo(() => {
    if (!employees || !teamSchedules) return employees || [];
    
    // Dacă editezi, exclude programările celorlalți din ziua selectată
    const occupiedUserIds = teamSchedules
      .filter(s => 
        s.day_of_week === formData.day_of_week && 
        (!editingSchedule || s.id !== editingSchedule.id)
      )
      .map(s => s.user_id);
    
    const filtered = employees.filter(emp => !occupiedUserIds.includes(emp.id));
    
    // Aplică filtrul de căutare
    if (!employeeSearch.trim()) return filtered;
    const searchLower = employeeSearch.toLowerCase();
    return filtered.filter(emp => 
      (emp.full_name?.toLowerCase().includes(searchLower)) ||
      (emp.username?.toLowerCase().includes(searchLower))
    );
  }, [employees, teamSchedules, formData.day_of_week, editingSchedule, employeeSearch]);

  // Filtrare mașini bazată pe căutare
  const filteredVehicles = useMemo(() => {
    if (!vehicleSearch.trim()) return AVAILABLE_VEHICLES;
    const searchLower = vehicleSearch.toLowerCase();
    return AVAILABLE_VEHICLES.filter(v => v.toLowerCase().includes(searchLower));
  }, [vehicleSearch]);

  // Echipe deja folosite în săptămâna selectată
  const usedTeams = useMemo(() => {
    if (!schedules) return new Set<string>();
    // Get used teams from all schedules
    return new Set(schedules.map((s: any) => s.team_id));
  }, [schedules]);

  // Echipe disponibile (exclude echipele deja folosite)
  const availableTeams = useMemo(() => {
    const allTeams = Array.from({ length: 10 }, (_, i) => `E${i + 1}`);
    // Dacă editezi, permite echipa curentă
    if (editingSchedule) {
      return allTeams;
    }
    return allTeams.filter(team => !usedTeams.has(team));
  }, [usedTeams, editingSchedule]);

  // Create/Update schedule mutation
  const createSchedule = useMutation({
    mutationFn: async () => {
      if (selectedEmployees.length === 0) {
        throw new Error('Selectează cel puțin un angajat');
      }

      if (!projectManagerId && !editingSchedule) {
        throw new Error('Selectează un Manager de Proiect');
      }

      if (!teamLeaderId && !editingSchedule) {
        throw new Error('Selectează un Șef de Echipă');
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
            day_of_week: formData.day_of_week,
            coordinator_id: projectManagerId || editingSchedule.coordinator_id,
            team_leader_id: teamLeaderId || editingSchedule.team_leader_id
          })
          .eq('id', editingSchedule.id);
        
        if (error) throw error;
        return [editingSchedule];
      }

      // Dacă adaugi - pentru fiecare zi, configurație, și angajat
      // Securizare: nu permite folosirea aceluiași nume/număr de echipă în săptămâna curentă
      if (!editingSchedule && usedTeams.has(selectedTeam)) {
        throw new Error('Numele/numărul echipei este deja folosit în săptămâna curentă');
      }
      const scheduleEntries = [];
      for (const dayOfWeek of selectedDays) {
        const configs = dayConfigurations[dayOfWeek] || [];
        for (const config of configs) {
          for (const userId of selectedEmployees) {
            scheduleEntries.push({
              team_id: selectedTeam,
              week_start_date: formData.week_start_date,
              user_id: userId,
              day_of_week: dayOfWeek,
              location: config.location,
              activity: config.activity,
              vehicle: config.vehicle || null,
              observations: config.observations || null,
              shift_type: config.shift_type,
              coordinator_id: projectManagerId,
              team_leader_id: teamLeaderId
            });
          }
        }
      }

      const { data: schedules, error } = await supabase
        .from('weekly_schedules')
        .insert(scheduleEntries)
        .select();
      
      if (error) throw error;

      // ✅ Notificările sunt create automat de trigger-ul notify_schedule_change
      // Nu mai e nevoie de insert manual

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

  // Duplicate schedule mutation
  const duplicateSchedule = useMutation({
    mutationFn: async ({ teamId, targetWeekStart }: { teamId: string; targetWeekStart: string }) => {
      // Verifică dacă există deja echipa în săptămâna țintă
      const { data: existingSchedules } = await supabase
        .from('weekly_schedules')
        .select('id')
        .eq('team_id', teamId)
        .eq('week_start_date', targetWeekStart)
        .limit(1);

      if (existingSchedules && existingSchedules.length > 0) {
        throw new Error(`Echipa ${teamId} există deja în săptămâna selectată`);
      }

      // Preia toate programările echipei din săptămâna curentă
      const { data: teamSchedules, error: fetchError } = await supabase
        .from('weekly_schedules')
        .select('*')
        .eq('team_id', teamId)
        .eq('week_start_date', selectedWeek);

      if (fetchError) throw fetchError;
      if (!teamSchedules || teamSchedules.length === 0) {
        throw new Error('Nu există programări de duplicat');
      }

      // Creează intrări noi pentru săptămâna țintă
      const newSchedules = teamSchedules.map(schedule => ({
        team_id: schedule.team_id,
        week_start_date: targetWeekStart,
        user_id: schedule.user_id,
        day_of_week: schedule.day_of_week,
        location: schedule.location,
        activity: schedule.activity,
        vehicle: schedule.vehicle,
        observations: schedule.observations,
        shift_type: schedule.shift_type,
        coordinator_id: schedule.coordinator_id,
        team_leader_id: schedule.team_leader_id
      }));

      const { error: insertError } = await supabase
        .from('weekly_schedules')
        .insert(newSchedules);

      if (insertError) throw insertError;

      return { teamId, targetWeekStart, count: newSchedules.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['weekly-schedules'] });
      toast.success(`Echipa ${data.teamId} duplicată cu succes! (${data.count} programări)`);
      setShowDuplicateDialog(false);
      setTeamToDuplicate('');
      setTargetWeek('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Eroare la duplicarea planificării');
      console.error('Schedule duplicate error:', error);
    }
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingSchedule(null);
    setSelectedEmployees([]);
    setSelectedVehicles([]);
    setSelectedDays([]);
    setProjectManagerId('');
    setTeamLeaderId('');
    setDayConfigurations({});
    setEmployeeSearch('');
    setVehicleSearch('');
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
    
    // Validate day configurations for new schedules
    if (!editingSchedule) {
      if (selectedDays.length === 0) {
        toast.error('Selectează cel puțin o zi');
        return;
      }
      
      for (const day of selectedDays) {
        const configs = dayConfigurations[day] || [];
        if (configs.length === 0) {
          toast.error(`Adaugă cel puțin o configurație pentru ${dayNames[day - 1]}`);
          return;
        }
        // Validate each config has required fields
        for (let i = 0; i < configs.length; i++) {
          const config = configs[i];
          if (!config.location || !config.activity) {
            toast.error(`Completează Locația și Proiectul pentru ${dayNames[day - 1]} - Locație ${i + 1}`);
            return;
          }
        }
      }
    }
    
    createSchedule.mutate();
  };

  const handleEdit = (schedule: any) => {
    setEditingSchedule(schedule);
    setShowForm(true);
    setActiveTab('details');
    setSelectedEmployees([schedule.user_id]);
    setSelectedVehicles(schedule.vehicle ? schedule.vehicle.split(',').map((v: string) => v.trim()) : []);
    setSelectedDays([schedule.day_of_week]);
    setProjectManagerId(schedule.coordinator_id || '');
    setTeamLeaderId(schedule.team_leader_id || '');
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

  // Editare completă pentru toate zilele unui angajat
  const handleBulkEdit = (userId: string) => {
    if (!schedules) return;
    
    // Găsește toate programările acestui angajat în săptămâna curentă
    const userSchedules = schedules.filter((s: any) => s.user_id === userId);
    
    if (userSchedules.length === 0) return;
    
    const firstSchedule = userSchedules[0];
    
    // Pregătește configurațiile pentru fiecare zi
    const configs: Record<number, DayConfiguration[]> = {};
    userSchedules.forEach((schedule: any) => {
      configs[schedule.day_of_week] = [{
        location: schedule.location || '',
        activity: schedule.activity || '',
        vehicle: schedule.vehicle || '',
        shift_type: schedule.shift_type,
        observations: schedule.observations || ''
      }];
    });
    
    setEditingSchedule(null); // Nu editezi o singură programare
    setShowForm(true);
    setActiveTab('details');
    setSelectedEmployees([userId]);
    setSelectedDays(userSchedules.map((s: any) => s.day_of_week));
    setDayConfigurations(configs);
    setProjectManagerId(firstSchedule.coordinator_id || '');
    setTeamLeaderId(firstSchedule.team_leader_id || '');
    setFormData({
      team_id: firstSchedule.team_id,
      week_start_date: firstSchedule.week_start_date,
      day_of_week: firstSchedule.day_of_week,
      location: '',
      activity: '',
      observations: '',
      shift_type: 'zi'
    });
  };

  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
    setEmployeeSearch(''); // Clear search after selection
  };

  const toggleVehicle = (vehicle: string) => {
    setSelectedVehicles(prev => 
      prev.includes(vehicle) 
        ? prev.filter(v => v !== vehicle)
        : [...prev, vehicle]
    );
    setVehicleSearch(''); // Clear search after selection
  };

  const toggleDay = (day: number) => {
    if (editingSchedule) return; // Nu permite multiselect în modul editare
    setSelectedDays(prev => {
      const newDays = prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort();
      
      // Initialize or remove day configuration
      setDayConfigurations(prevConfigs => {
        const newConfigs = { ...prevConfigs };
        if (newDays.includes(day) && !prevConfigs[day]) {
          // Initialize with one empty configuration, pre-populated with selected vehicles
          newConfigs[day] = [{
            location: '',
            activity: '',
            vehicle: selectedVehicles.join(', '),
            shift_type: 'zi',
            observations: ''
          }];
        } else if (!newDays.includes(day)) {
          // Remove configuration for unselected day
          delete newConfigs[day];
        }
        return newConfigs;
      });
      
      return newDays;
    });
  };
  
  const addDayConfiguration = (dayNum: number) => {
    setDayConfigurations(prev => ({
      ...prev,
      [dayNum]: [
        ...(prev[dayNum] || []),
        {
          location: '',
          activity: '',
          vehicle: selectedVehicles.join(', '),
          shift_type: 'zi',
          observations: ''
        }
      ]
    }));
  };
  
  const removeDayConfiguration = (dayNum: number, configIndex: number) => {
    setDayConfigurations(prev => {
      const newConfigs = { ...prev };
      newConfigs[dayNum] = newConfigs[dayNum].filter((_, idx) => idx !== configIndex);
      return newConfigs;
    });
  };
  
  const updateDayConfiguration = (dayNum: number, configIndex: number, field: keyof DayConfiguration, value: string) => {
    setDayConfigurations(prev => {
      const newConfigs = { ...prev };
      if (!newConfigs[dayNum]) return prev;
      newConfigs[dayNum] = [...newConfigs[dayNum]];
      newConfigs[dayNum][configIndex] = {
        ...newConfigs[dayNum][configIndex],
        [field]: value
      };
      return newConfigs;
    });
  };

  const toggleScheduleSelection = (scheduleId: string) => {
    setSelectedScheduleIds(prev =>
      prev.includes(scheduleId)
        ? prev.filter(id => id !== scheduleId)
        : [...prev, scheduleId]
    );
  };

  const toggleAllSchedules = () => {
    if (selectedScheduleIds.length === teamSchedules?.length) {
      setSelectedScheduleIds([]);
    } else {
      setSelectedScheduleIds(teamSchedules?.map((s: any) => s.id) || []);
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

  // Grupare după echipă (fără unire de echipe)
  const teamSummary = useMemo(() => {
    if (!schedules) return [];
    
    // Grupează doar după team_id
    const grouped = schedules.reduce((acc: any, schedule: any) => {
      const key = schedule.team_id;
      
      if (!acc[key]) {
        acc[key] = {
          team_id: schedule.team_id,
          coordinator: schedule.coordinator_id ? 
            employees?.find(e => e.id === schedule.coordinator_id) : null,
          coordinator_id: schedule.coordinator_id,
          members: new Set(),
          locations: new Map(),
          days: new Set(),
          scheduleIds: [],
        };
      }
      
      acc[key].members.add(schedule.profiles?.full_name || 'N/A');
      acc[key].days.add(schedule.day_of_week);
      acc[key].scheduleIds.push(schedule.id);
      
      // Track locations per day
      const dayKey = schedule.day_of_week;
      if (!acc[key].locations.has(dayKey)) {
        acc[key].locations.set(dayKey, new Set());
      }
      acc[key].locations.get(dayKey).add(
        `${schedule.shift_type === 'zi' ? '☀️' : '🌙'} ${schedule.location}${schedule.activity ? ' - ' + schedule.activity : ''}`
      );
      
      return acc;
    }, {});
    
    return Object.values(grouped).map((group: any) => ({
      ...group,
      members: Array.from(group.members),
      days: Array.from(group.days).sort(),
      locations: Array.from(group.locations.entries()).map(([day, locs]) => ({
        day,
        locations: Array.from(locs)
      }))
    }));
  }, [schedules, employees]);

  return (
    <AdminLayout title="Programare Săptămânală">
      <div className="container mx-auto p-6">
        <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Programare Săptămânală
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label>Săptămâna (Nr. {weekNumber})</Label>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={goToPreviousWeek}
                  title="Săptămâna anterioară"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-start text-left font-normal">
                      <Calendar className="mr-2 h-4 w-4" />
                      {selectedWeek ? format(new Date(selectedWeek), "dd MMM yyyy", { locale: ro }) : "Selectează săptămâna"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <SimpleDateRangePicker
                      selected={{ 
                        from: new Date(selectedWeek), 
                        to: addDays(new Date(selectedWeek), 6) 
                      }}
                      onSelect={(range) => {
                        if (range?.from) {
                          const weekStart = format(startOfWeek(range.from, { weekStartsOn: 1 }), 'yyyy-MM-dd');
                          setSelectedWeek(weekStart);
                          setFormData(prev => ({ ...prev, week_start_date: weekStart }));
                        }
                      }}
                      disabled={(date) => date > new Date()}
                    />
                  </PopoverContent>
                </Popover>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={goToNextWeek}
                  title="Săptămâna următoare"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {activeTab === 'details' && (
              <div className="flex-1 min-w-[200px]">
                <Label>Echipa</Label>
                <Select value={selectedTeam} onValueChange={(value) => {
                  setSelectedTeam(value);
                  setFormData(prev => ({ ...prev, team_id: value }));
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => `E${i + 1}`).map(team => {
                      const isUsed = usedTeams.has(team) && team !== selectedTeam;
                      return (
                        <SelectItem 
                          key={team} 
                          value={team}
                          disabled={isUsed}
                        >
                          {team} {isUsed && '(ocupată)'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
              <Button onClick={() => {
                resetForm();
                // Alege automat următorul număr de echipă disponibil în săptămâna curentă
                const allTeams = Array.from({ length: 10 }, (_, i) => `E${i + 1}`);
                const nextTeam = allTeams.find(t => !usedTeams.has(t));
                if (!nextTeam) {
                  toast.error('Toate numerele de echipă sunt ocupate pentru săptămâna selectată');
                  return;
                }
                setSelectedTeam(nextTeam);
                setFormData(prev => ({ ...prev, team_id: nextTeam, week_start_date: selectedWeek }));
                setShowForm(true);
                setActiveTab('details');
              }}>
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

          {/* Add/Edit Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-6 bg-muted/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {editingSchedule ? 'Editează Programare' : 'Adaugă Programare Nouă'}
                </h3>
              </div>
              
              {/* Manager de Proiect & Șef de Echipă Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4">
                <div>
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Manager de Proiect *
                  </Label>
                  <Select value={projectManagerId} onValueChange={setProjectManagerId}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Selectează Manager de Proiect" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees?.filter(emp => {
                        const candidate = (emp.full_name || emp.username || '').trim().toUpperCase();
                        const allowed = [
                          ['ALEXANDRESCU', 'ADRIAN'],
                          ['COSTACHE', 'FLORIN'],
                          ['CHITICARU', 'FLORIN'],
                          ['COSTAN', 'IONUT'],
                          ['RADU', 'IOAN'],
                          ['RADU', 'LAURENTIU'],
                          ['CANBEI', 'RAZVAN'],
                        ];
                        return allowed.some((nameParts) =>
                          nameParts.every(part => candidate.includes(part))
                        );
                      }).map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          👤 {emp.full_name || emp.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Șef de Echipă *
                  </Label>
                  <Select value={teamLeaderId} onValueChange={setTeamLeaderId}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Selectează Șef de Echipă" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees?.filter(emp => selectedEmployees.includes(emp.id)).map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          👤 {emp.full_name || emp.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedEmployees.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Selectează mai întâi angajați pentru echipă
                    </p>
                  )}
                </div>
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
                      <Input
                        placeholder="🔍 Caută angajat..."
                        value={employeeSearch}
                        onChange={(e) => setEmployeeSearch(e.target.value)}
                        className="mb-2"
                      />
                      <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                        {availableEmployees.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            {employeeSearch ? 'Niciun angajat găsit' : 'Toți angajații sunt deja programați în această zi'}
                          </p>
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
                  <Input
                    placeholder="🔍 Caută mașină..."
                    value={vehicleSearch}
                    onChange={(e) => setVehicleSearch(e.target.value)}
                    className="mb-2"
                  />
                  <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                    {filteredVehicles.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nicio mașină găsită</p>
                    ) : (
                      filteredVehicles.map(vehicle => (
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
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedVehicles.length} mașină/i selectată/e
                  </p>
                </div>
              </div>

              {/* Multi-select Days */}
              <div className="space-y-3">
                <Label className="text-base">{editingSchedule ? 'Zi *' : 'Zile * (selectare multiplă)'}</Label>
                {editingSchedule ? (
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
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                      {dayNames.map((day, idx) => {
                        const dayNum = idx + 1;
                        return (
                          <div key={dayNum} className="flex items-center space-x-2 border rounded-md p-2 hover:bg-accent">
                            <Checkbox
                              id={`day-${dayNum}`}
                              checked={selectedDays.includes(dayNum)}
                              onCheckedChange={() => toggleDay(dayNum)}
                            />
                            <label htmlFor={`day-${dayNum}`} className="text-sm cursor-pointer flex-1">
                              {day}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {selectedDays.length} zi(le) selectată(e)
                    </p>
                  </>
                )}
              </div>

              {/* Day Configurations - shown only for new schedules */}
              {!editingSchedule && selectedDays.length > 0 && (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold text-lg">Configurare per Zi</h3>
                  {selectedDays.sort((a, b) => a - b).map(dayNum => (
                    <div key={dayNum} className="border rounded-lg p-4 space-y-3 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {dayNames[dayNum - 1]}
                        </h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addDayConfiguration(dayNum)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Adaugă locație
                        </Button>
                      </div>
                      
                      {(dayConfigurations[dayNum] || []).map((config, configIndex) => (
                        <div key={configIndex} className="border rounded p-3 space-y-3 bg-background">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Locație {configIndex + 1}</span>
                            {dayConfigurations[dayNum].length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeDayConfiguration(dayNum, configIndex)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Label>Tip Tură *</Label>
                              <Select
                                value={config.shift_type}
                                onValueChange={(value) => updateDayConfiguration(dayNum, configIndex, 'shift_type', value)}
                              >
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
                              <Label>Locație *</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                      "w-full justify-between font-normal",
                                      !config.location && "text-muted-foreground"
                                    )}
                                  >
                                    {config.location || "Selectează locație..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0" align="start">
                                  <Command>
                                    <CommandInput placeholder="🔍 Caută locație..." />
                                    <CommandEmpty>
                                      <div className="p-2 text-sm">
                                        Nu există locația. Scrie-o manual:
                                        <Input
                                          className="mt-2"
                                          placeholder="Locație nouă..."
                                          onKeyDown={async (e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              const newLocation = e.currentTarget.value.trim();
                                              if (newLocation) {
                                                updateDayConfiguration(dayNum, configIndex, 'location', newLocation);
                                                try {
                                                  await supabase.from('locations').insert({ name: newLocation });
                                                  queryClient.invalidateQueries({ queryKey: ['locations'] });
                                                  toast.success(`Locație "${newLocation}" adăugată`);
                                                  // Close popover
                                                  document.body.click();
                                                } catch (error: any) {
                                                  if (error.code !== '23505') { // ignore duplicate key error
                                                    toast.error('Eroare la salvarea locației');
                                                  }
                                                }
                                              }
                                            }
                                          }}
                                        />
                                      </div>
                                    </CommandEmpty>
                                    <CommandGroup className="max-h-64 overflow-auto">
                                      {locations?.map((loc) => (
                                        <CommandItem
                                          key={loc.id}
                                          value={loc.name}
                                          onSelect={() => {
                                            updateDayConfiguration(dayNum, configIndex, 'location', loc.name);
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              config.location === loc.name ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          {loc.name}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </div>
                            
                            <div>
                              <Label>Proiect *</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                      "w-full justify-between font-normal",
                                      !config.activity && "text-muted-foreground"
                                    )}
                                  >
                                    {config.activity || "Selectează proiect..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0" align="start">
                                  <Command>
                                    <CommandInput placeholder="🔍 Caută proiect..." />
                                    <CommandEmpty>
                                      <div className="p-2 text-sm">
                                        Nu există proiectul. Scrie-l manual:
                                        <Input
                                          className="mt-2"
                                          placeholder="Proiect nou..."
                                          onKeyDown={async (e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              const newProject = e.currentTarget.value.trim();
                                              if (newProject) {
                                                updateDayConfiguration(dayNum, configIndex, 'activity', newProject);
                                                try {
                                                  await supabase.from('projects').insert({ name: newProject });
                                                  queryClient.invalidateQueries({ queryKey: ['projects'] });
                                                  toast.success(`Proiect "${newProject}" adăugat`);
                                                  // Close popover
                                                  document.body.click();
                                                } catch (error: any) {
                                                  if (error.code !== '23505') { // ignore duplicate key error
                                                    toast.error('Eroare la salvarea proiectului');
                                                  }
                                                }
                                              }
                                            }
                                          }}
                                        />
                                      </div>
                                    </CommandEmpty>
                                    <CommandGroup className="max-h-64 overflow-auto">
                                      {projects?.map((proj) => (
                                        <CommandItem
                                          key={proj.id}
                                          value={proj.name}
                                          onSelect={() => {
                                            updateDayConfiguration(dayNum, configIndex, 'activity', proj.name);
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              config.activity === proj.name ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          {proj.name}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </div>
                            
                            <div>
                              <Label>Vehicul</Label>
                              <Input
                                value={config.vehicle}
                                onChange={(e) => updateDayConfiguration(dayNum, configIndex, 'vehicle', e.target.value)}
                                placeholder="Ex: B-123-ABC"
                              />
                            </div>
                            
                            <div className="md:col-span-2">
                              <Label>De executat</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                      "w-full justify-between font-normal",
                                      !config.observations && "text-muted-foreground"
                                    )}
                                  >
                                    {config.observations || "Selectează/adauga 'De executat'..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0" align="start">
                                  <Command>
                                    <CommandInput placeholder="🔍 Caută 'De executat'..." />
                                    <CommandEmpty>
                                      <div className="p-2 text-sm">
                                        Nu există elementul. Scrie-l manual:
                                        <Input
                                          className="mt-2"
                                          placeholder="Element nou..."
                                          onKeyDown={async (e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              const newItem = e.currentTarget.value.trim();
                                              if (newItem) {
                                                updateDayConfiguration(dayNum, configIndex, 'observations', newItem);
                                                try {
                                                  await supabase.from('execution_items').insert({ name: newItem });
                                                  queryClient.invalidateQueries({ queryKey: ['execution_items'] });
                                                  toast.success(`Element "${newItem}" adăugat`);
                                                  document.body.click();
                                                } catch (error: any) {
                                                  if (error.code !== '23505') {
                                                    toast.error('Eroare la salvarea elementului');
                                                  }
                                                }
                                              }
                                            }
                                          }}
                                        />
                                      </div>
                                    </CommandEmpty>
                                    <CommandGroup className="max-h-64 overflow-auto">
                                      {executionItems?.map((item) => (
                                        <CommandItem
                                          key={item.id}
                                          value={item.name}
                                          onSelect={() => {
                                            updateDayConfiguration(dayNum, configIndex, 'observations', item.name);
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              config.observations === item.name ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          {item.name}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Legacy fields - shown only for editing existing schedules */}
              {editingSchedule && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    <Label>Proiect</Label>
                    <Input
                      value={formData.activity}
                      onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
                      placeholder="ex: Pază Complexul X"
                    />
                  </div>
                </div>
              )}

              {editingSchedule && (
                <div>
                  <Label>De executat</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between font-normal",
                          !formData.observations && "text-muted-foreground"
                        )}
                      >
                        {formData.observations || "Selectează/adauga 'De executat'..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="🔍 Caută 'De executat'..." />
                        <CommandEmpty>
                          <div className="p-2 text-sm">
                            Nu există elementul. Scrie-l manual:
                            <Input
                              className="mt-2"
                              placeholder="Element nou..."
                              onKeyDown={async (e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const newItem = e.currentTarget.value.trim();
                                  if (newItem) {
                                    setFormData(prev => ({ ...prev, observations: newItem }));
                                    try {
                                      await supabase.from('execution_items').insert({ name: newItem });
                                      queryClient.invalidateQueries({ queryKey: ['execution_items'] });
                                      toast.success(`Element "${newItem}" adăugat`);
                                      document.body.click();
                                    } catch (error: any) {
                                      if (error.code !== '23505') {
                                        toast.error('Eroare la salvarea elementului');
                                      }
                                    }
                                  }
                                }
                              }}
                            />
                          </div>
                        </CommandEmpty>
                        <CommandGroup className="max-h-64 overflow-auto">
                          {executionItems?.map((item) => (
                            <CommandItem
                              key={item.id}
                              value={item.name}
                              onSelect={() => {
                                setFormData(prev => ({ ...prev, observations: item.name }));
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.observations === item.name ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {item.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

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

          {/* Tabs: Summary and Details */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="summary" className="gap-2">
                <Users className="h-4 w-4" />
                Rezumat Programări
              </TabsTrigger>
              <TabsTrigger value="details" className="gap-2">
                <Calendar className="h-4 w-4" />
                Detalii Complete
              </TabsTrigger>
            </TabsList>

            {/* Summary Tab */}
            <TabsContent value="summary" className="mt-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                  <div className="col-span-full text-center py-8">Se încarcă...</div>
                ) : teamSummary.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    Nu există programări pentru această săptămână
                  </div>
                ) : (
                  teamSummary.map((summary: any) => (
                    <Card key={summary.team_id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="text-lg">Echipa {summary.team_id}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {summary.members.length} membri
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setTeamToDuplicate(summary.team_id);
                                setShowDuplicateDialog(true);
                              }}
                              title="Repetă planificarea în altă săptămână"
                            >
                              <Copy className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                navigate(`/edit-team-schedule?team=${summary.team_id}&week=${selectedWeek}`);
                              }}
                              title="Editează echipa"
                            >
                              <Edit className="h-4 w-4 text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedScheduleIds(summary.scheduleIds || []);
                                setShowDeleteDialog(true);
                              }}
                              title="Șterge toate programările"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </CardTitle>
                        {summary.coordinator && (
                          <CardDescription className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            Manager de Proiect: <strong>{summary.coordinator.full_name}</strong>
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent 
                        className="space-y-3 cursor-pointer"
                        onClick={() => setActiveTab('details')}
                      >
                        <div className="pt-2 border-t">
                          <div className="text-xs text-muted-foreground mb-2">Membri echipă:</div>
                          <div className="flex flex-wrap gap-1">
                            {summary.members.map((member: string, idx: number) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {member}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        <div className="pt-2 border-t">
                          <div className="text-xs text-muted-foreground mb-2">Program săptămânal:</div>
                          <div className="space-y-2">
                            {summary.locations.map((dayLoc: any) => (
                              <div key={dayLoc.day} className="text-sm">
                                <div className="font-medium text-xs text-muted-foreground mb-1">
                                  {dayNames[dayLoc.day - 1]}:
                                </div>
                                <div className="flex flex-col gap-1 ml-2">
                                  {dayLoc.locations.map((loc: string, idx: number) => (
                                    <div key={idx} className="flex items-start gap-1 text-xs">
                                      <MapPin className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                                      <span>{loc}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Details Tab */}
            <TabsContent value="details" className="mt-6">
              <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={teamSchedules?.length > 0 && selectedScheduleIds.length === teamSchedules?.length}
                        onCheckedChange={toggleAllSchedules}
                      />
                    </TableHead>
                    <TableHead>Zi</TableHead>
                    <TableHead>Tură</TableHead>
                    <TableHead>Angajat</TableHead>
                    <TableHead>Manager de Proiect</TableHead>
                    <TableHead>Șef de Echipă</TableHead>
                    <TableHead>Locație</TableHead>
                    <TableHead>Proiect</TableHead>
                    <TableHead>Mașină</TableHead>
                    <TableHead>De executat</TableHead>
                    <TableHead className="w-[120px]">Acțiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center">Se încarcă...</TableCell>
                    </TableRow>
                  ) : teamSchedules?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground">
                        Nu există programări pentru această săptămână
                      </TableCell>
                    </TableRow>
                  ) : (
                    teamSchedules?.map((schedule: any) => {
                      const coordinator = employees?.find(e => e.id === schedule.coordinator_id);
                      const teamLeader = employees?.find(e => e.id === schedule.team_leader_id);
                      return (
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
                          <TableCell>
                            {coordinator ? (
                              <Badge variant="outline" className="gap-1">
                                <User className="h-3 w-3" />
                                {coordinator.full_name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {teamLeader ? (
                              <Badge variant="outline" className="gap-1">
                                <User className="h-3 w-3" />
                                {teamLeader.full_name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">N/A</span>
                            )}
                          </TableCell>
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
                      );
                    })
                  )}
                </TableBody>
              </Table>
              </div>
            </TabsContent>
          </Tabs>
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

      {/* Duplicate Schedule Dialog */}
      <AlertDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Repetă Planificarea
            </AlertDialogTitle>
            <AlertDialogDescription>
              Duplică programarea echipei {teamToDuplicate} într-o altă săptămână
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="target-week" className="text-sm font-medium">Selectează săptămâna țintă</Label>
            <Input
              type="date"
              id="target-week"
              value={targetWeek}
              onChange={(e) => {
                if (e.target.value) {
                  const weekStart = format(startOfWeek(new Date(e.target.value), { weekStartsOn: 1 }), 'yyyy-MM-dd');
                  setTargetWeek(weekStart);
                }
              }}
              className="mt-2"
            />
            {targetWeek && (
              <p className="text-sm text-muted-foreground mt-2">
                Săptămâna {getWeek(new Date(targetWeek), { weekStartsOn: 1 })} - {format(new Date(targetWeek), 'dd MMM yyyy', { locale: ro })}
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDuplicateDialog(false);
              setTeamToDuplicate('');
              setTargetWeek('');
            }}>
              Anulează
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!targetWeek) {
                  toast.error('Selectează o săptămână țintă');
                  return;
                }
                if (targetWeek === selectedWeek) {
                  toast.error('Săptămâna țintă trebuie să fie diferită de săptămâna curentă');
                  return;
                }
                duplicateSchedule.mutate({ teamId: teamToDuplicate, targetWeekStart: targetWeek });
              }}
              disabled={!targetWeek || duplicateSchedule.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {duplicateSchedule.isPending ? 'Se duplică...' : 'Duplică Planificarea'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </AdminLayout>
  );
}
