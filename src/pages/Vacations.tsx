import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { type DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const Vacations = () => {
  const [date, setDate] = useState<DateRange | undefined>();

  useEffect(() => {
    document.title = 'Programare Concedii | TimeTrack';
  }, []);

  return (
    <div className="min-h-screen bg-background p-4">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">Programare Concedii</h1>
        <p className="text-sm text-muted-foreground">Selectează data concediului și trimite cererea spre aprobare.</p>
      </header>

      <main className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Alege data concediului</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date?.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date?.from ? (
                    date.to ? `${format(date.from, "PPP", { locale: ro })} - ${format(date.to, "PPP", { locale: ro })}` : format(date.from, "PPP", { locale: ro })
                  ) : (
                    <span>Selectează perioada</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                 <Calendar
                   mode="range"
                   selected={date}
                   onSelect={setDate}
                   initialFocus
                   numberOfMonths={2}
                   locale={ro}
                   className="pointer-events-auto"
                 />
              </PopoverContent>
            </Popover>
             <Button 
               onClick={() => toast.info('Funcție în curs de implementare')}
               disabled={!(date?.from && date?.to)}
               className="w-full"
             >
               Trimite cererea
             </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Vacations;
