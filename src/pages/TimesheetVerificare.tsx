import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TeamTimeApprovalManager } from '@/components/TeamTimeApprovalManager';
import { ApprovalStatsDashboard } from '@/components/ApprovalStatsDashboard';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ClipboardCheck, ChevronLeft, ChevronRight, ChevronDown, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { startOfWeek, endOfWeek, format, addWeeks, subWeeks, addDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

// Funcție pentru a calcula ziua de verificare default (X-1 cu regula de luni)
const getDefaultVerificationDay = (): number => {
  const today = new Date();
  const todayDayOfWeek = today.getDay() || 7; // 1=luni, 7=duminică
  
  if (todayDayOfWeek === 1) {
    // 📅 LUNI: verificăm VINERI din săptămâna trecută (ziua 5)
    return 5;
  } else {
    // 📅 ALTE ZILE: verificăm ziua de IERI (X-1)
    return todayDayOfWeek - 1 === 0 ? 7 : todayDayOfWeek - 1;
  }
};

// Funcție pentru a calcula săptămâna de verificare (săptămâna trecută pentru luni)
const getDefaultVerificationWeek = (): string => {
  const today = new Date();
  const todayDayOfWeek = today.getDay() || 7;
  
  if (todayDayOfWeek === 1) {
    // 📅 LUNI: folosim săptămâna TRECUTĂ pentru vineri/sâmbătă/duminică
    const lastWeek = subWeeks(today, 1);
    return format(startOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  } else {
    // 📅 ALTE ZILE: săptămâna curentă
    return format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  }
};

export default function TimesheetVerificare() {
  const [selectedWeek, setSelectedWeek] = useState(getDefaultVerificationWeek());
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number>(getDefaultVerificationDay());
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [editedTeams, setEditedTeams] = useState<Set<string>>(new Set());
  
  // Fetch echipele disponibile pentru ziua selectată (exclude contractori + personal birou)
  const { data: availableTeams } = useQuery({
    queryKey: ['teams-for-day', selectedWeek, selectedDayOfWeek],
    queryFn: async () => {
      const { data } = await supabase
        .from('weekly_schedules')
        .select(`
          team_id,
          profiles!inner(is_external_contractor, is_office_staff)
        `)
        .eq('week_start_date', selectedWeek)
        .eq('day_of_week', selectedDayOfWeek)
        .eq('profiles.is_external_contractor', false)
        .eq('profiles.is_office_staff', false);
      
      return new Set(data?.map(s => s.team_id) || []);
    },
    enabled: !!selectedWeek && !!selectedDayOfWeek,
  });

  // NU resetăm edited teams când schimbăm ziua - doar când schimbăm săptămâna
  useEffect(() => {
    if (availableTeams && availableTeams.size > 0) {
      const firstTeam = Array.from(availableTeams)[0];
      setSelectedTeam(firstTeam);
    } else {
      setSelectedTeam(null);
    }
  }, [selectedWeek, selectedDayOfWeek, availableTeams]);

  // Reset edited teams DOAR când schimbăm săptămâna
  useEffect(() => {
    setEditedTeams(new Set());
  }, [selectedWeek]);

  // Fetch numărul de pontaje pending pentru ziua curentă (exclude contractori + personal birou)
  const { data: pendingCountForDay = 0 } = useQuery({
    queryKey: ['pending-count-for-day', selectedWeek, selectedDayOfWeek],
    queryFn: async () => {
      // Calculează data exactă pentru ziua selectată
      const weekStart = new Date(selectedWeek);
      const targetDate = addDays(weekStart, selectedDayOfWeek - 1);
      const targetDateStr = format(targetDate, 'yyyy-MM-dd');

      // Obține toți userii din echipele programate în această zi (exclude contractori + personal birou)
      const { data: schedules } = await supabase
        .from('weekly_schedules')
        .select(`
          user_id,
          profiles!inner(is_external_contractor, is_office_staff)
        `)
        .eq('week_start_date', selectedWeek)
        .eq('day_of_week', selectedDayOfWeek)
        .eq('profiles.is_external_contractor', false)
        .eq('profiles.is_office_staff', false);

      if (!schedules || schedules.length === 0) return 0;

      const userIds = schedules.map(s => s.user_id);

      // Numără pontajele pending pentru acești useri în ziua selectată
      const { count } = await supabase
        .from('time_entries')
        .select('*', { count: 'exact', head: true })
        .in('user_id', userIds)
        .gte('clock_in_time', `${targetDateStr}T00:00:00Z`)
        .lt('clock_in_time', `${format(addDays(targetDate, 1), 'yyyy-MM-dd')}T00:00:00Z`)
        .eq('approval_status', 'pending_review');

      return count || 0;
    },
    enabled: !!selectedWeek && !!selectedDayOfWeek,
    refetchInterval: 5000, // Refresh la fiecare 5s pentru actualizare live
  });

  const hasPendingEntries = pendingCountForDay > 0;
  const { toast } = useToast();
  
  // Guard pentru persistență zi - previne schimbări automate
  const previousDayRef = useRef(selectedDayOfWeek);

  useEffect(() => {
    previousDayRef.current = selectedDayOfWeek;
  }, [selectedDayOfWeek]);

  const getDayName = (day: number) => {
    const days = ['', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
    return days[day];
  };
  
  const navigateWeek = (direction: 'prev' | 'next') => {
    setSelectedWeek(current => {
      const currentDate = new Date(current);
      const newDate = direction === 'prev' 
        ? subWeeks(currentDate, 1) 
        : addWeeks(currentDate, 1);
      return format(startOfWeek(newDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    });
  };

  const goToToday = () => {
    setSelectedWeek(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-6 md:p-8">
      <Card className="w-full max-w-7xl mx-auto">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-6 w-6" />
                  Verificare Pontaje
                </CardTitle>
                <CardDescription>
                  {new Date().getDay() === 1 
                    ? "📅 Este luni - verifică vineri, sâmbătă și duminică din săptămâna trecută"
                    : "Aprobă, editează sau respinge pontajele de ieri"
                  }
                </CardDescription>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateWeek('prev')}
                  className="gap-1"
                  disabled={hasPendingEntries}
                  title={hasPendingEntries ? "Termină aprobările din ziua curentă" : "Săptămâna anterioară"}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Anterioara</span>
                </Button>
                
                <div className="text-center px-2 sm:px-4">
                  <div className="text-sm font-medium whitespace-nowrap">
                    {format(new Date(selectedWeek), 'dd MMM', { locale: ro })} - {' '}
                    {format(endOfWeek(new Date(selectedWeek), { weekStartsOn: 1 }), 'dd MMM yyyy', { locale: ro })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Săptămâna {format(new Date(selectedWeek), 'ww', { locale: ro })}
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateWeek('next')}
                  className="gap-1"
                  disabled={hasPendingEntries}
                  title={hasPendingEntries ? "Termină aprobările din ziua curentă" : "Săptămâna următoare"}
                >
                  <span className="hidden sm:inline">Următoarea</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={goToToday}
                  disabled={hasPendingEntries}
                  title={hasPendingEntries ? "Termină aprobările din ziua curentă" : "Mergi la ziua curentă"}
                >
                  Astăzi
                </Button>
              </div>
            </div>
            
            {/* Selector de zi */}
            <div className="flex items-center gap-2 mt-4">
              <Label htmlFor="day-selector" className="text-sm font-medium">
                Selectează ziua:
              </Label>
              <Select 
                value={selectedDayOfWeek.toString()} 
                onValueChange={(v) => {
                  const targetDay = Number(v);
                  if (!hasPendingEntries) {
                    // Liber să navighezi oriunde dacă nu ai pending
                    setSelectedDayOfWeek(targetDay);
                  } else if (targetDay < selectedDayOfWeek) {
                    // Poți merge DOAR la zile ANTERIOARE când ai pending
                    setSelectedDayOfWeek(targetDay);
                  } else {
                    // Blocare pentru zile curente sau viitoare
                    toast({
                      title: '⚠️ Nu poți avansa',
                      description: `Termină aprobarea celor ${pendingCountForDay} pontaje din ${getDayName(selectedDayOfWeek)}.`,
                      variant: 'destructive'
                    });
                  }
                }}
              >
                <SelectTrigger id="day-selector" className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1" disabled={hasPendingEntries && 1 >= selectedDayOfWeek}>📅 Luni</SelectItem>
                  <SelectItem value="2" disabled={hasPendingEntries && 2 >= selectedDayOfWeek}>📅 Marți</SelectItem>
                  <SelectItem value="3" disabled={hasPendingEntries && 3 >= selectedDayOfWeek}>📅 Miercuri</SelectItem>
                  <SelectItem value="4" disabled={hasPendingEntries && 4 >= selectedDayOfWeek}>📅 Joi</SelectItem>
                  <SelectItem value="5" disabled={hasPendingEntries && 5 >= selectedDayOfWeek}>📅 Vineri</SelectItem>
                  <SelectItem value="6" disabled={hasPendingEntries && 6 >= selectedDayOfWeek}>📅 Sâmbătă</SelectItem>
                  <SelectItem value="7" disabled={hasPendingEntries && 7 >= selectedDayOfWeek}>📅 Duminică</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Selector de echipă - MUTAT SUS pentru acces rapid */}
            {availableTeams && availableTeams.size > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <Label htmlFor="team-select" className="text-sm font-medium">
                  Selectează echipa:
                </Label>
                <Select value={selectedTeam || ''} onValueChange={setSelectedTeam}>
                  <SelectTrigger id="team-select" className="w-[180px]">
                    <SelectValue placeholder="Selectează echipa" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(availableTeams)
                      .sort((a, b) => {
                        const numA = parseInt(a.replace(/\D/g, ''), 10);
                        const numB = parseInt(b.replace(/\D/g, ''), 10);
                        
                        // Prioritate 1: Neverificate (nu sunt în editedTeams)
                        const aEdited = editedTeams.has(a);
                        const bEdited = editedTeams.has(b);
                        
                        if (!aEdited && bEdited) return -1; // a (neverificată) înainte de b (verificată)
                        if (aEdited && !bEdited) return 1;  // b (neverificată) înainte de a (verificată)
                        
                        // Dacă ambele sunt în aceeași categorie, sortează alfabetic/numeric
                        return numA - numB;
                      })
                      .map(team => {
                        const isEdited = editedTeams.has(team);
                        return (
                          <SelectItem key={team} value={team}>
                            <div className="flex items-center gap-2">
                              {isEdited ? (
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                              ) : (
                                <AlertCircle className="h-3 w-3 text-yellow-600" />
                              )}
                              Echipa {team}
                            </div>
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
                {editedTeams.size > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditedTeams(new Set());
                      toast({
                        title: '🔄 Reset complet',
                        description: 'Toate echipele pot fi reverificate.',
                      });
                    }}
                    className="gap-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span className="hidden sm:inline">Reset</span>
                  </Button>
                )}
              </div>
            )}

            {/* Alert pentru pontaje pending */}
            {hasPendingEntries && (
              <Alert className="mt-4 bg-yellow-50 border-yellow-300 dark:bg-yellow-950/20 dark:border-yellow-800">
                <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <AlertDescription className="text-sm text-yellow-900 dark:text-yellow-100">
                  ⏳ Există <strong>{pendingCountForDay} pontaj{pendingCountForDay !== 1 ? 'e' : ''}</strong> în așteptare pentru această zi.
                  <br />
                  Poți naviga înapoi la zilele anterioare (deja aprobate), dar nu poți avansa până termini aprobarea.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-6">
            {/* Dashboard restrângibil */}
            <Collapsible defaultOpen={false} className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">
                  📊 Statistici Săptămână Curentă
                </h3>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1">
                    <span className="text-xs">Afișează/Ascunde</span>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </Button>
                </CollapsibleTrigger>
              </div>
              
              <CollapsibleContent className="space-y-4">
                <ApprovalStatsDashboard />
              </CollapsibleContent>
            </Collapsible>

            <Separator />
            
            <TeamTimeApprovalManager
              selectedWeek={selectedWeek}
              selectedDayOfWeek={selectedDayOfWeek}
              availableTeams={availableTeams || new Set()}
              selectedTeam={selectedTeam}
              editedTeams={editedTeams}
              onTeamEdited={(teamId) => setEditedTeams(prev => new Set([...prev, teamId]))}
              onTeamChange={setSelectedTeam}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}