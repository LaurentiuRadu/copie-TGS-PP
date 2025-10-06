-- Adaugă unique constraint pe session_id pentru a preveni duplicate
ALTER TABLE public.active_sessions ADD CONSTRAINT active_sessions_session_id_key UNIQUE (session_id);