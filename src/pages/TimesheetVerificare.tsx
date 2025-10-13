import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TeamTimeApprovalManager } from '@/components/TeamTimeApprovalManager';
import { ApprovalStatsDashboard } from '@/components/ApprovalStatsDashboard';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ClipboardCheck, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { startOfWeek, endOfWeek, format, addWeeks, subWeeks } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function TimesheetVerificare() {
  const [selectedWeek, setSelectedWeek] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number>(new Date().getDay() || 7); // 1=luni, 7=duminică
  
  // Fetch echipele disponibile pentru ziua selectată
  const { data: availableTeams } = useQuery({
    queryKey: ['teams-for-day', selectedWeek, selectedDayOfWeek],
    queryFn: async () => {
      const { data } = await supabase
        .from('weekly_schedules')
        .select('team_id')
        .eq('week_start_date', selectedWeek)
        .eq('day_of_week', selectedDayOfWeek);
      
      return new Set(data?.map(s => s.team_id) || []);
    },
    enabled: !!selectedWeek && !!selectedDayOfWeek,
  });
  
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
                  Aprobă, editează sau respinge pontajele angajaților
                </CardDescription>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateWeek('prev')}
                  className="gap-1"
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
                >
                  <span className="hidden sm:inline">Următoarea</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={goToToday}
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
                onValueChange={(v) => setSelectedDayOfWeek(Number(v))}
              >
                <SelectTrigger id="day-selector" className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">📅 Luni</SelectItem>
                  <SelectItem value="2">📅 Marți</SelectItem>
                  <SelectItem value="3">📅 Miercuri</SelectItem>
                  <SelectItem value="4">📅 Joi</SelectItem>
                  <SelectItem value="5">📅 Vineri</SelectItem>
                  <SelectItem value="6">📅 Sâmbătă</SelectItem>
                  <SelectItem value="7">📅 Duminică</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
