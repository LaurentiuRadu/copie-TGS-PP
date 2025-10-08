-- Adăugare câmp team_leader_id la weekly_schedules
ALTER TABLE public.weekly_schedules 
ADD COLUMN team_leader_id uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.weekly_schedules.coordinator_id IS 'Manager de Proiect - poate fi același pentru mai multe echipe';
COMMENT ON COLUMN public.weekly_schedules.team_leader_id IS 'Șef de Echipă - unic pentru fiecare echipă';