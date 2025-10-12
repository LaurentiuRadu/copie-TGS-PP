import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { PlayCircle } from "lucide-react";

export function QuickReprocessTest() {
  const [autoRun, setAutoRun] = useState(false);

  useEffect(() => {
    if (autoRun) {
      runReprocess();
    }
  }, [autoRun]);

  const runReprocess = async () => {
    try {
      toast.info("🔄 PAS 3: Reprocessare automată...");

      // Invoke calculate-time-segments pentru ultimul entry (trigger pentru toate)
      const { data, error } = await supabase.functions.invoke('calculate-time-segments', {
        body: {
          user_id: '444cfecc-fb2d-46f3-8050-0c762b308850',
          time_entry_id: 'c993fc70-7636-4758-8893-b7a2d90b9e18', // Ultimul entry (Normal 14:05-14:09)
          clock_in_time: '2025-10-12T11:05:13.169+00:00',
          clock_out_time: '2025-10-12T11:09:06.604Z',
          notes: 'Tip: Normal',
          isIntermediateCalculation: false
        }
      });

      if (error) throw error;

      // Verificare
      const { data: segments } = await supabase
        .from('time_entry_segments')
        .select('*')
        .in('time_entry_id', [
          '1a21e98f-f0cb-425c-b9e9-5387ffd5147b',
          '8bae12fb-7871-4342-bd18-b1fdb49aeac8',
          '000592b0-bfc5-4f62-8d70-d28e9f6757db',
          '911b364d-dc41-4876-b487-20ae6d650e33',
          '5ee16375-f40e-4054-aac5-ed5a7bd9a36f',
          'e05cfd1d-9a4c-462b-bf17-b48792903008',
          '3e0c20b9-8e62-41d2-8876-8fe8a06f91af',
          'c993fc70-7636-4758-8893-b7a2d90b9e18'
        ]);

      const { data: timesheets } = await supabase
        .from('daily_timesheets')
        .select('*')
        .eq('employee_id', '444cfecc-fb2d-46f3-8050-0c762b308850')
        .eq('work_date', '2025-10-12');

      toast.success(`✅ PAȘI 3-5 COMPLETAȚI!
      
      Segmente: ${segments?.length || 0}
      Daily Timesheets: ${timesheets?.length || 0}
      
      ${timesheets?.[0] ? `
      Driving: ${timesheets[0].hours_driving}h
      Passenger: ${timesheets[0].hours_passenger}h  
      Sunday: ${timesheets[0].hours_sunday}h` : ''}`);

    } catch (error: any) {
      toast.error(`❌ Eroare: ${error.message}`);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button 
        onClick={() => setAutoRun(true)} 
        size="lg"
        className="shadow-lg"
      >
        <PlayCircle className="mr-2 h-5 w-5" />
        ▶️ Rulează PAS 3-5 ACUM
      </Button>
    </div>
  );
}
