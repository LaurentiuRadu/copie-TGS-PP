import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { ArrowLeft, Calendar, Plus, X, Save } from 'lucide-react';
import { AdminLayout } from '@/components/AdminLayout';

const dayNames = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];

interface DayConfiguration {
  location: string;
  project: string;
  vehicle: string;
  shift_type: 'zi' | 'noapte';
  to_execute: string;
}

export default function EditTeamSchedule() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  
  const teamId = searchParams.get('team');
  const weekStart = searchParams.get('week');
  
  const [projectManagerId, setProjectManagerId] = useState<string>('');
  const [teamLeaderId, setTeamLeaderId] = useState<string>('');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [dayConfigurations, setDayConfigurations] = useState<Record<number, DayConfiguration[]>>({});
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');

  const AVAILABLE_VEHICLES = [
    'B-119-ARF', 'B-169-TGS', 'B-777-TGS', 'B-997-TGS', 'BC-19-TGS',
    'BC-29-CUL', 'BC-37-CUL', 'BC-61-CUL', 'BC-81-TGS', 'BC-99-CUL'
  ];

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
    }
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
    }
  });

  // Fetch locations from database
  const { data: dbLocations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('name')
        .order('name');
      if (error) throw error;
      return data.map(l => l.name);
    }
  });

  // Fetch projects from database
  const { data: dbProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('name')
        .order('name');
      if (error) throw error;
      return data.map(p => p.name);
    }
  });

  // Fetch existing schedules for this team
  const { data: schedules, isLoading } = useQuery({
    queryKey: ['team-schedules', teamId, weekStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_schedules')
        .select('*, profiles!weekly_schedules_user_id_fkey(full_name)')
        .eq('team_id', teamId)
        .eq('week_start_date', weekStart);
      if (error) throw error;
      return data;
    },
    enabled: !!teamId && !!weekStart
  });

  // Initialize form with existing data
  useEffect(() => {
    if (schedules && schedules.length > 0) {
      const firstSchedule = schedules[0];
      setProjectManagerId(firstSchedule.coordinator_id || '');
      setTeamLeaderId(firstSchedule.team_leader_id || '');
      
      // Get unique employees
      const uniqueEmployees = [...new Set(schedules.map(s => s.user_id))];
      setSelectedEmployees(uniqueEmployees);
      
      // Get unique vehicles
      const uniqueVehicles = [...new Set(schedules.map(s => s.vehicle).filter(Boolean))];
      setSelectedVehicles(uniqueVehicles as string[]);
      
      // Get unique days
      const uniqueDays = [...new Set(schedules.map(s => s.day_of_week))];
      setSelectedDays(uniqueDays);
      
      // Build day configurations - group by day and unique combinations
      const configs: Record<number, DayConfiguration[]> = {};
      const dayConfigKeys = new Set<string>();
      
      schedules.forEach(schedule => {
        const configKey = `${schedule.day_of_week}-${schedule.location}-${schedule.activity}-${schedule.vehicle}-${schedule.shift_type}-${schedule.observations}`;
        
        if (!dayConfigKeys.has(configKey)) {
          dayConfigKeys.add(configKey);
          
          if (!configs[schedule.day_of_week]) {
            configs[schedule.day_of_week] = [];
          }
          
          configs[schedule.day_of_week].push({
            location: schedule.location || '',
            project: schedule.activity || '',
            vehicle: schedule.vehicle || '',
            shift_type: schedule.shift_type as 'zi' | 'noapte',
            to_execute: schedule.observations || ''
          });
        }
      });
      
      setDayConfigurations(configs);
    }
  }, [schedules]);

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    if (!employeeSearch.trim()) return employees;
    const searchLower = employeeSearch.toLowerCase();
    return employees.filter(emp => 
      (emp.full_name?.toLowerCase().includes(searchLower)) ||
      (emp.username?.toLowerCase().includes(searchLower))
    );
  }, [employees, employeeSearch]);

  const filteredVehicles = useMemo(() => {
    if (!vehicleSearch.trim()) return AVAILABLE_VEHICLES;
    const searchLower = vehicleSearch.toLowerCase();
    return AVAILABLE_VEHICLES.filter(v => v.toLowerCase().includes(searchLower));
  }, [vehicleSearch]);

  const filteredLocations = useMemo(() => {
    if (!locations) return [];
    if (!locationSearch.trim()) return locations;
    const searchLower = locationSearch.toLowerCase();
    return locations.filter(loc => loc.name.toLowerCase().includes(searchLower));
  }, [locations, locationSearch]);

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    if (!projectSearch.trim()) return projects;
    const searchLower = projectSearch.toLowerCase();
    return projects.filter(proj => proj.name.toLowerCase().includes(searchLower));
  }, [projects, projectSearch]);

  const updateSchedules = useMutation({
    mutationFn: async () => {
      if (!teamId || !weekStart) throw new Error('Date lipsă');
      if (selectedEmployees.length === 0) throw new Error('Selectează cel puțin un angajat');
      if (!projectManagerId) throw new Error('Selectează un Manager de Proiect');
      if (!teamLeaderId) throw new Error('Selectează un Șef de Echipă');

      // Save unique locations and projects to database
      const uniqueLocations = new Set<string>();
      const uniqueProjects = new Set<string>();
      
      Object.values(dayConfigurations).forEach(configs => {
        configs.forEach(config => {
          if (config.location.trim()) uniqueLocations.add(config.location.trim());
          if (config.project.trim()) uniqueProjects.add(config.project.trim());
        });
      });

      // Insert new locations (ignore conflicts)
      for (const location of uniqueLocations) {
        await supabase
          .from('locations')
          .upsert({ name: location }, { onConflict: 'name', ignoreDuplicates: true });
      }

      // Insert new projects (ignore conflicts)
      for (const project of uniqueProjects) {
        await supabase
          .from('projects')
          .upsert({ name: project }, { onConflict: 'name', ignoreDuplicates: true });
      }

      // Delete existing schedules
      await supabase
        .from('weekly_schedules')
        .delete()
        .eq('team_id', teamId)
        .eq('week_start_date', weekStart);

      // Create new schedules
      const scheduleEntries = [];
      for (const dayOfWeek of selectedDays) {
        const configs = dayConfigurations[dayOfWeek] || [];
        for (const config of configs) {
          for (const userId of selectedEmployees) {
            scheduleEntries.push({
              team_id: teamId,
              week_start_date: weekStart,
              user_id: userId,
              day_of_week: dayOfWeek,
              location: config.location,
              activity: config.project,
              vehicle: config.vehicle || null,
              observations: config.to_execute || null,
              shift_type: config.shift_type,
              coordinator_id: projectManagerId,
              team_leader_id: teamLeaderId
            });
          }
        }
      }

      const { error } = await supabase
        .from('weekly_schedules')
        .insert(scheduleEntries);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['team-schedules'] });
      toast.success('Programare echipă actualizată!');
      navigate('/weekly-schedules');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Eroare la salvare');
    }
  });

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

  const toggleDay = (day: number) => {
    setSelectedDays(prev => {
      const newDays = prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort();
      
      setDayConfigurations(prevConfigs => {
        const newConfigs = { ...prevConfigs };
      if (newDays.includes(day) && !prevConfigs[day]) {
          newConfigs[day] = [{
            location: '',
            project: '',
            vehicle: selectedVehicles.join(', '),
            shift_type: 'zi',
            to_execute: ''
          }];
        } else if (!newDays.includes(day)) {
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
          project: '',
          vehicle: selectedVehicles.join(', '),
          shift_type: 'zi',
          to_execute: ''
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

  if (isLoading) {
    return (
      <AdminLayout title="Editare Echipă">
        <div className="flex items-center justify-center min-h-screen">
          <p>Se încarcă...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={`Editare Echipa ${teamId}`}>
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => navigate('/weekly-schedules')}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                Editare Echipa {teamId}
              </CardTitle>
              <Button onClick={() => updateSchedules.mutate()} disabled={updateSchedules.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {updateSchedules.isPending ? 'Se salvează...' : 'Salvează Modificările'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Manager de Proiect & Șef de Echipă */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4">
              <div>
                <Label className="text-base font-semibold">Manager de Proiect *</Label>
                <Select value={projectManagerId} onValueChange={setProjectManagerId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Selectează Manager de Proiect" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees?.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        👤 {emp.full_name || emp.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-base font-semibold">Șef de Echipă *</Label>
                <Select value={teamLeaderId} onValueChange={setTeamLeaderId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Selectează Șef de Echipă" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees?.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        👤 {emp.full_name || emp.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Angajați & Mașini */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label>Angajați * (selectare multiplă)</Label>
                <Input
                  placeholder="🔍 Caută angajat..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                />
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                  {filteredEmployees.map(emp => (
                    <div key={emp.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`emp-${emp.id}`}
                        checked={selectedEmployees.includes(emp.id)}
                        onCheckedChange={() => toggleEmployee(emp.id)}
                      />
                      <label htmlFor={`emp-${emp.id}`} className="text-sm cursor-pointer flex-1">
                        {emp.full_name || emp.username}
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedEmployees.length} angajat(i) selectat(i)
                </p>
              </div>

              <div className="space-y-3">
                <Label>Mașini (selectare multiplă)</Label>
                <Input
                  placeholder="🔍 Caută mașină..."
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                />
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                  {filteredVehicles.map(vehicle => (
                    <div key={vehicle} className="flex items-center space-x-2">
                      <Checkbox
                        id={`vehicle-${vehicle}`}
                        checked={selectedVehicles.includes(vehicle)}
                        onCheckedChange={() => toggleVehicle(vehicle)}
                      />
                      <label htmlFor={`vehicle-${vehicle}`} className="text-sm cursor-pointer flex-1 font-mono">
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

            {/* Zile */}
            <div className="space-y-3">
              <Label className="text-base">Zile * (selectare multiplă)</Label>
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
            </div>

            {/* Configurare per Zi */}
            {selectedDays.length > 0 && (
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
                            <Input
                              value={config.location}
                              onChange={(e) => updateDayConfiguration(dayNum, configIndex, 'location', e.target.value)}
                              placeholder="Ex: București"
                              list={`locations-${dayNum}-${configIndex}`}
                            />
                            <datalist id={`locations-${dayNum}-${configIndex}`}>
                              {filteredLocations.map(loc => (
                                <option key={loc.id} value={loc.name} />
                              ))}
                            </datalist>
                          </div>
                          
                          <div>
                            <Label>Proiect *</Label>
                            <Input
                              value={config.project}
                              onChange={(e) => {
                                updateDayConfiguration(dayNum, configIndex, 'project', e.target.value);
                                // Auto-insert in projects table if doesn't exist
                                if (e.target.value && !projects?.some(p => p.name === e.target.value)) {
                                  supabase.from('projects').insert({ name: e.target.value }).then();
                                }
                              }}
                              placeholder="Ex: Pază Complexul X"
                              list={`projects-${dayNum}-${configIndex}`}
                            />
                            <datalist id={`projects-${dayNum}-${configIndex}`}>
                              {filteredProjects.map(proj => (
                                <option key={proj.id} value={proj.name} />
                              ))}
                            </datalist>
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
                            <Input
                              value={config.to_execute}
                              onChange={(e) => updateDayConfiguration(dayNum, configIndex, 'to_execute', e.target.value)}
                              placeholder="Detalii despre sarcini de executat"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
