import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TeamTimeApprovalManager } from '@/components/TeamTimeApprovalManager';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ClipboardCheck, ChevronLeft, ChevronRight, ChevronDown, AlertCircle, CheckCircle2, RotateCcw, AlertTriangle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { startOfWeek, endOfWeek, format, addWeeks, subWeeks, addDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

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
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [editedTeams, setEditedTeams] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // 🆕 localStorage key pentru tracking echipe verificate
  const getVerificationStorageKey = () => `team-verification-${selectedWeek}-${selectedDayOfWeek}`;
  
  const [verifiedTeams, setVerifiedTeams] = useState<Set<string>>(() => {
    const stored = localStorage.getItem(getVerificationStorageKey());
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  // Salvează în localStorage la fiecare schimbare
  useEffect(() => {
    localStorage.setItem(getVerificationStorageKey(), JSON.stringify(Array.from(verifiedTeams)));
  }, [verifiedTeams, selectedWeek, selectedDayOfWeek]);

  // Reset verifiedTeams când schimbăm săptămâna sau ziua
  useEffect(() => {
    const stored = localStorage.getItem(getVerificationStorageKey());
    setVerifiedTeams(stored ? new Set(JSON.parse(stored)) : new Set());
  }, [selectedWeek, selectedDayOfWeek]);
  
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

  // 🆕 Fetch pending and incomplete counts per team pentru status vizual
  const { data: teamPendingCounts = {} } = useQuery({
    queryKey: ['team-pending-counts', selectedWeek, selectedDayOfWeek, Array.from(availableTeams || [])],
    queryFn: async () => {
      if (!availableTeams || availableTeams.size === 0) return {};

      const weekStart = new Date(selectedWeek);
      const targetDate = addDays(weekStart, selectedDayOfWeek - 1);
      const startOfDay = format(targetDate, 'yyyy-MM-dd');
      const endOfDay = format(addDays(targetDate, 1), 'yyyy-MM-dd');

      const { data: schedules, error: schedulesError } = await supabase
        .from('weekly_schedules')
        .select('user_id, team_id, profiles!inner(is_external_contractor, is_office_staff)')
        .eq('week_start_date', selectedWeek)
        .eq('day_of_week', selectedDayOfWeek)
        .in('team_id', Array.from(availableTeams))
        .eq('profiles.is_external_contractor', false)
        .eq('profiles.is_office_staff', false);

      if (schedulesError) throw schedulesError;

      const userIds = schedules.map(s => s.user_id);
      if (userIds.length === 0) return {};

      const { data: timeEntries, error: entriesError } = await supabase
        .from('time_entries')
        .select('id, user_id, clock_in_time, clock_out_time, approval_status')
        .in('user_id', userIds)
        .gte('clock_in_time', `${startOfDay}T00:00:00Z`)
        .lt('clock_in_time', `${endOfDay}T00:00:00Z`);

      if (entriesError) throw entriesError;

      // Separare pontaje complete vs incomplete
      const completeEntries = timeEntries.filter(entry => {
        if (!entry.clock_out_time) return false;
        const duration = (new Date(entry.clock_out_time).getTime() - new Date(entry.clock_in_time).getTime()) / (1000 * 60 * 60);
        return duration >= 0.17; // >= 10 min
      });

      const incompleteEntries = timeEntries.filter(entry => !entry.clock_out_time);

      // Count pending complete entries and incomplete entries per team
      const counts: Record<string, { pending: number; incomplete: number; total: number }> = {};
      
      schedules.forEach(schedule => {
        const userComplete = completeEntries.filter(e => e.user_id === schedule.user_id);
        const userIncomplete = incompleteEntries.filter(e => e.user_id === schedule.user_id);
        
        const pendingCount = userComplete.filter(e => e.approval_status === 'pending_review').length;
        const incompleteCount = userIncomplete.length;
        
        if (!counts[schedule.team_id]) {
          counts[schedule.team_id] = { pending: 0, incomplete: 0, total: 0 };
        }
        
        counts[schedule.team_id].pending += pendingCount;
        counts[schedule.team_id].incomplete += incompleteCount;
        counts[schedule.team_id].total += pendingCount + incompleteCount;
      });

      return counts;
    },
    enabled: !!availableTeams && availableTeams.size > 0,
    refetchInterval: 5000,
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
      // EXCLUDE office staff explicit prin JOIN cu profiles
      const { count } = await supabase
        .from('time_entries')
        .select(`
          *,
          profiles!inner(is_office_staff)
        `, { count: 'exact', head: true })
        .in('user_id', userIds)
        .gte('clock_in_time', `${targetDateStr}T00:00:00Z`)
        .lt('clock_in_time', `${format(addDays(targetDate, 1), 'yyyy-MM-dd')}T00:00:00Z`)
        .eq('approval_status', 'pending_review')
        .eq('profiles.is_office_staff', false);

      return count || 0;
    },
    enabled: !!selectedWeek && !!selectedDayOfWeek,
    refetchInterval: 5000, // Refresh la fiecare 5s pentru actualizare live
  });

  const hasPendingEntries = pendingCountForDay > 0;

  // 🆕 Funcție pentru reset status verificare
  const handleResetVerificationStatus = () => {
    setVerifiedTeams(new Set());
    setEditedTeams(new Set());
    localStorage.removeItem(getVerificationStorageKey());
    toast({
      title: '🔄 Status resetat',
      description: 'Toate echipele pot fi reverificate.',
    });
  };

  // 🆕 Calculare progres verificare
  const verificationProgress = {
    total: availableTeams?.size || 0,
    verified: Array.from(availableTeams || []).filter(team => {
      const teamData = teamPendingCounts[team] || { pending: 0, incomplete: 0, total: 0 };
      return teamData.total === 0; // No pending and no incomplete entries
    }).length,
  };
  
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
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
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
            
            {/* 🆕 Layout consolidat: Progres + Selector Zi + Reset */}
            {availableTeams && availableTeams.size > 0 && (
              <div className="space-y-3 mt-4 p-4 bg-muted/30 rounded-lg border">
                {/* Rând consolidat cu 3 coloane responsive */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Coloana 1: Selector de zi (MUTAT PE PRIMA POZIȚIE) */}
                  <div className="flex items-center gap-2">
                    <Label htmlFor="day-selector" className="text-sm font-medium whitespace-nowrap">
                      Selectează ziua:
                    </Label>
                    <Select 
                      value={selectedDayOfWeek.toString()} 
                      onValueChange={(v) => {
                        const targetDay = Number(v);
                        if (!hasPendingEntries) {
                          setSelectedDayOfWeek(targetDay);
                        } else if (targetDay < selectedDayOfWeek) {
                          setSelectedDayOfWeek(targetDay);
                        } else {
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
                        {(() => {
                          const today = new Date();
                          const currentDayOfWeek = today.getDay() || 7; // 1=Luni, 7=Duminică
                          
                          return (
                            <>
                              <SelectItem value="1" disabled={false}>
                                📅 Luni
                              </SelectItem>
                              <SelectItem value="2" disabled={false}>
                                📅 Marți
                              </SelectItem>
                              <SelectItem value="3" disabled={false}>
                                📅 Miercuri
                              </SelectItem>
                              <SelectItem value="4" disabled={false}>
                                📅 Joi
                              </SelectItem>
                              <SelectItem value="5" disabled={false}>
                                📅 Vineri
                              </SelectItem>
                              <SelectItem value="6" disabled={false}>
                                📅 Sâmbătă
                              </SelectItem>
                              <SelectItem value="7" disabled={false}>
                                📅 Duminică
                              </SelectItem>
                            </>
                          );
                        })()}
                      </SelectContent>
                    </Select>

                    {/* 🆕 Warning icon pentru zi curentă */}
                    {(() => {
                      const today = new Date();
                      const todayDayOfWeek = today.getDay() || 7;
                      const isVerifyingToday = selectedDayOfWeek === todayDayOfWeek;
                      
                      return isVerifyingToday && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950/30 cursor-help hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors">
                                <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs bg-blue-50 border-blue-300 dark:bg-blue-950 dark:border-blue-700">
                              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                                ⚠️ Verifici ziua CURENTĂ!
                              </p>
                              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                Majoritatea pontajelor pot fi incomplete (clock-out lipsește).
                              </p>
                              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                                <Info className="h-3 w-3" />
                                <strong>Recomandare:</strong> verifică mâine pentru date complete.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })()}
                  </div>

                  {/* Coloana 2: Progres Verificare (ACUM PE POZIȚIA 2) */}
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <div className="text-sm">
                      <span className="text-muted-foreground">📊 Progres Verificare: </span>
                      <span className="font-bold text-lg">
                        {verificationProgress.verified}/{verificationProgress.total}
                      </span>
                      <span className="text-muted-foreground ml-1">echipe</span>
                    </div>
                    {verificationProgress.verified === verificationProgress.total && verificationProgress.total > 0 && (
                      <Badge variant="outline" className="bg-green-100 text-green-700 border-green-400 dark:bg-green-950/30 dark:text-green-300">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Toate verificate!
                      </Badge>
                    )}
                    
                    {/* 🆕 Badge pentru pontaje pending cu Tooltip */}
                    {hasPendingEntries && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-400 dark:bg-yellow-950/30 dark:text-yellow-300 cursor-help">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              ⏳ {pendingCountForDay} pending
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            <p className="text-sm">
                              <strong>{pendingCountForDay} pontaj{pendingCountForDay !== 1 ? 'e' : ''}</strong> în așteptare pentru această zi.
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              💡 Poți naviga înapoi la zilele anterioare, dar nu poți avansa până termini aprobarea.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>

                  {/* Coloana 3: Reset Status */}
                  <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 lg:ml-auto"
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span className="hidden sm:inline">Reset Status</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          <AlertDialogTitle className="text-destructive">
                            Confirmare Reset Status Verificare
                          </AlertDialogTitle>
                        </div>
                        <AlertDialogDescription className="space-y-3 pt-2">
                          <p className="text-sm">
                            Această acțiune va șterge <strong>statusul de verificare</strong> pentru toate echipele din săptămâna selectată:
                          </p>
                          <ul className="text-sm space-y-1 list-disc list-inside ml-2">
                            <li>Toate echipele vor reveni la status <strong>"neverificat"</strong></li>
                            <li>Modificările locale salvate vor fi șterse</li>
                            <li>Va fi necesară reverificarea completă</li>
                          </ul>
                          <p className="text-sm font-semibold text-destructive">
                            ⚠️ Această acțiune nu poate fi anulată!
                          </p>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Anulează</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            handleResetVerificationStatus();
                            setIsResetDialogOpen(false);
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Confirmă Reset
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="team-select" className="text-sm font-medium">
                    Selectează echipa:
                  </Label>
                  <Select value={selectedTeam || ''} onValueChange={setSelectedTeam}>
                    <SelectTrigger id="team-select" className="w-full max-w-md">
                      <SelectValue placeholder="Selectează echipa" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(availableTeams)
                        .sort((a, b) => {
                          const numA = parseInt(a.replace(/\D/g, ''), 10);
                          const numB = parseInt(b.replace(/\D/g, ''), 10);
                          
                          // Prioritate 1: Echipe cu pontaje pending sau incomplete (neverificate)
                          const aData = teamPendingCounts[a] || { pending: 0, incomplete: 0, total: 0 };
                          const bData = teamPendingCounts[b] || { pending: 0, incomplete: 0, total: 0 };
                          
                          if (aData.total > 0 && bData.total === 0) return -1;
                          if (aData.total === 0 && bData.total > 0) return 1;
                          
                          return numA - numB;
                        })
                        .map(team => {
                          const teamData = teamPendingCounts[team] || { pending: 0, incomplete: 0, total: 0 };
                          const isFullyVerified = teamData.total === 0;

                          return (
                            <SelectItem 
                              key={team} 
                              value={team}
                              className={isFullyVerified ? 'bg-green-50 dark:bg-green-950/20' : 'bg-yellow-50/50 dark:bg-yellow-950/10'}
                            >
                              <div className="flex items-center gap-2 w-full">
                                {isFullyVerified ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                                )}
                                <span className="flex-1">Echipa {team}</span>
                                {isFullyVerified ? (
                                  <Badge variant="outline" className="ml-2 bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300 text-xs">
                                    ✅ Verificat
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="ml-2 bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300 text-xs">
                                    {teamData.pending > 0 && `⏳ ${teamData.pending} pending`}
                                    {teamData.incomplete > 0 && teamData.pending > 0 && ' | '}
                                    {teamData.incomplete > 0 && `🔄 ${teamData.incomplete} nefinalizat${teamData.incomplete > 1 ? 'e' : ''}`}
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-6">
            
            <TeamTimeApprovalManager
              selectedWeek={selectedWeek}
              selectedDayOfWeek={selectedDayOfWeek}
              availableTeams={availableTeams || new Set()}
              selectedTeam={selectedTeam}
              editedTeams={editedTeams}
              onTeamEdited={(teamId) => {
                setEditedTeams(prev => new Set([...prev, teamId]));
                // Auto-marchează ca verificată dacă nu mai are pontaje pending sau incomplete
                const teamData = teamPendingCounts[teamId] || { pending: 0, incomplete: 0, total: 0 };
                if (teamData.total === 0) {
                  setVerifiedTeams(prev => new Set([...prev, teamId]));
                }
              }}
              onTeamChange={setSelectedTeam}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}