import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

export const CleanupTestDataButton = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleCleanup = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-test-data', {
        body: {
          user_id: '444cfecc-fb2d-46f3-8050-0c762b308850', // Laurentiu Radu
          work_date: '2025-10-12'
        }
      });

      if (error) throw error;

      toast.success(`✅ Cleanup complet: ${data.deleted_entries} pontaje șterse`);
      
      // Refresh the page after 1 second
      setTimeout(() => window.location.reload(), 1000);
    } catch (error: any) {
      console.error('Cleanup error:', error);
      toast.error(`Eroare cleanup: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleCleanup}
      disabled={isLoading}
      variant="destructive"
      size="sm"
      className="gap-2"
    >
      <Trash2 className="h-4 w-4" />
      {isLoading ? 'Se șterge...' : 'Șterge date test Laurentiu 12.10'}
    </Button>
  );
};
