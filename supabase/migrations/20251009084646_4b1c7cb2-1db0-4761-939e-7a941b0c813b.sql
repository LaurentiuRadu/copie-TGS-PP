-- ✅ FAZA 1.4: Adaugă index composite pentru optimizare query my-time-entries
-- Îmbunătățește performanța query-urilor pentru fetch-ul pontajelor utilizatorului
-- Index: (user_id, clock_in_time DESC) pentru sortare rapidă

CREATE INDEX IF NOT EXISTS idx_time_entries_user_clock_in 
ON public.time_entries (user_id, clock_in_time DESC);

-- Comentariu: Acest index accelerează query-urile de tipul:
-- SELECT * FROM time_entries WHERE user_id = ? ORDER BY clock_in_time DESC
-- Reduce timpul de query de la O(n) la O(log n) pentru user-specific lookups