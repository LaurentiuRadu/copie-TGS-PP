import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const Vacations = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());

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
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Selectează data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <Button 
              onClick={() => toast.info('Funcție în curs de implementare')}
              disabled={!date}
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
