import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
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
            <CardTitle>Alege data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border w-full max-w-sm" />
            <Button onClick={() => toast.info('Funcție în curs de implementare')}>Trimite cererea</Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Vacations;
