-- Activează Realtime pentru active_sessions pentru a detecta invalidări instant
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_sessions;