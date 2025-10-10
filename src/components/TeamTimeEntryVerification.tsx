import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useTeamTimeEntries } from '@/hooks/useTeamTimeEntries';
import { format, addDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Clock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TeamTimeEntryVerificationProps {
  selectedWeek: string;
  availableTeams: Set<string>;
}

const dayNames = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];

export function TeamTimeEntryVerification({ selectedWeek, availableTeams }: TeamTimeEntryVerificationProps) {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(
    availableTeams.size > 0 ? Array.from(availableTeams)[0] : null
  );

  const { data, isLoading } = useTeamTimeEntries(selectedTeam, selectedWeek);

  // Calculează statistici pentru echipă
  const teamStats = useMemo(() => {
    if (!data?.members) return null;

    const allEntries = data.members.flatMap(member => 
      Object.values(member.entries).flat()
    );

    const clockInTimes = allEntries
      .map(e => new Date(e.clock_in_time).getHours() * 60 + new Date(e.clock_in_time).getMinutes())
      .filter(t => t > 0);

    const clockOutTimes = allEntries
      .filter(e => e.clock_out_time)
      .map(e => new Date(e.clock_out_time!).getHours() * 60 + new Date(e.clock_out_time!).getMinutes());

    const avgClockIn = clockInTimes.length > 0 
      ? Math.round(clockInTimes.reduce((a, b) => a + b, 0) / clockInTimes.length)
      : 0;

    const avgClockOut = clockOutTimes.length > 0
      ? Math.round(clockOutTimes.reduce((a, b) => a + b, 0) / clockOutTimes.length)
      : 0;

    return {
      memberCount: data.members.length,
      avgClockIn: `${String(Math.floor(avgClockIn / 60)).padStart(2, '0')}:${String(avgClockIn % 60).padStart(2, '0')}`,
      avgClockOut: avgClockOut > 0 ? `${String(Math.floor(avgClockOut / 60)).padStart(2, '0')}:${String(avgClockOut % 60).padStart(2, '0')}` : '-',
      totalEntries: allEntries.length
    };
  }, [data]);

  // Calculează discrepanțe pentru highlighting
  const getDiscrepancyLevel = (time: string, avgTime: string): 'ok' | 'moderate' | 'high' => {
    if (!time || !avgTime || avgTime === '-') return 'ok';
    
    const [timeH, timeM] = time.split(':').map(Number);
    const [avgH, avgM] = avgTime.split(':').map(Number);
    
    const timeMinutes = timeH * 60 + timeM;
    const avgMinutes = avgH * 60 + avgM;
    
    const diff = Math.abs(timeMinutes - avgMinutes);
    
    if (diff <= 15) return 'ok';
    if (diff <= 30) return 'moderate';
    return 'high';
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return null;
    return format(new Date(dateString), 'HH:mm');
  };

  if (availableTeams.size === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-8">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nu există echipe programate în această săptămână.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selector Echipă */}
      <Card>
        <CardHeader>
          <CardTitle>Selectează Echipa</CardTitle>
          <CardDescription>
            Verifică pontajele membrilor echipei pentru săptămâna selectată
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select value={selectedTeam || ''} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selectează echipa..." />
              </SelectTrigger>
              <SelectContent>
                {Array.from(availableTeams).sort().map(team => (
                  <SelectItem key={team} value={team}>
                    Echipa {team}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {teamStats && (
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{teamStats.memberCount} membri</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Medie intrare: {teamStats.avgClockIn}</span>
                </div>
                {teamStats.avgClockOut !== '-' && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Medie ieșire: {teamStats.avgClockOut}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabel Pontaje */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ) : data?.members && data.members.length > 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px] sticky left-0 bg-background z-10">Angajat</TableHead>
                    {dayNames.map((day, index) => (
                      <TableHead key={index} className="text-center min-w-[120px]">
                        {day}
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {format(addDays(new Date(selectedWeek), index), 'dd.MM')}
                        </span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.members.map(member => (
                    <TableRow key={member.user_id}>
                      <TableCell className="font-medium sticky left-0 bg-background z-10">
                        {member.full_name}
                      </TableCell>
                      {[1, 2, 3, 4, 5, 6, 7].map(dayOfWeek => {
                        const entries = member.entries[dayOfWeek] || [];
                        
                        if (entries.length === 0) {
                          return (
                            <TableCell key={dayOfWeek} className="text-center">
                              <Badge variant="outline" className="text-muted-foreground">
                                Lipsă
                              </Badge>
                            </TableCell>
                          );
                        }

                        const entry = entries[0]; // Prima intrare
                        const clockIn = formatTime(entry.clock_in_time);
                        const clockOut = formatTime(entry.clock_out_time);
                        
                        const clockInLevel = teamStats ? getDiscrepancyLevel(clockIn!, teamStats.avgClockIn) : 'ok';
                        const clockOutLevel = clockOut && teamStats ? getDiscrepancyLevel(clockOut, teamStats.avgClockOut) : 'ok';

                        return (
                          <TableCell key={dayOfWeek} className="text-center">
                            <div className="space-y-1">
                              <div className={cn(
                                "text-sm font-medium",
                                clockInLevel === 'high' && "text-destructive",
                                clockInLevel === 'moderate' && "text-yellow-600 dark:text-yellow-500",
                                clockInLevel === 'ok' && "text-foreground"
                              )}>
                                {clockIn}
                                {clockInLevel === 'high' && <AlertCircle className="inline h-3 w-3 ml-1" />}
                              </div>
                              <div className={cn(
                                "text-sm",
                                !clockOut && "text-muted-foreground",
                                clockOut && clockOutLevel === 'high' && "text-destructive",
                                clockOut && clockOutLevel === 'moderate' && "text-yellow-600 dark:text-yellow-500",
                                clockOut && clockOutLevel === 'ok' && "text-foreground"
                              )}>
                                {clockOut || 'În desfășurare'}
                                {clockOut && clockOutLevel === 'high' && <AlertCircle className="inline h-3 w-3 ml-1" />}
                              </div>
                              {entries.length > 1 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{entries.length - 1}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex items-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-foreground" />
                <span>În interval acceptabil (±15 min)</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span>Diferență moderată (±30 min)</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span>Discrepanță mare (&gt;30 min)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground py-8">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nu există membri programați pentru această echipă.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
