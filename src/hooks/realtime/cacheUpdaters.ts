import { QueryClient } from '@tanstack/react-query';
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';

/**
 * Pure functions pentru cache updates țintite
 * Eliminăm invalidările globale și facem updates precise
 */

interface TimeEntry {
  id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  clock_in_latitude: number;
  clock_in_longitude: number;
  clock_out_latitude: number | null;
  clock_out_longitude: number | null;
  clock_in_photo_url: string | null;
  clock_out_photo_url: string | null;
  device_id: string | null;
  notes: string | null;
  user_id: string;
  profiles?: {
    full_name: string | null;
  } | null;
  time_entry_segments?: Array<{
    segment_type: string;
    hours_decimal: number;
    multiplier: number;
    start_time: string;
    end_time: string;
  }>;
}

/**
 * Adaugă un time entry NOU în cache-urile relevante
 * Actualizează DOAR cache-urile care conțin acea zi/lună
 */
export function insertTimeEntryInCache(
  queryClient: QueryClient,
  newEntry: TimeEntry
) {
  const entryDate = new Date(newEntry.clock_in_time);
  const dayStart = startOfDay(entryDate);
  const monthStart = startOfMonth(entryDate);

  console.log('[cacheUpdaters] INSERT:', {
    entryId: newEntry.id,
    userId: newEntry.user_id,
    date: entryDate.toISOString()
  });

  // 1. Update cache-ul pentru ziua respectivă ['time-entries', date]
  queryClient.setQueriesData(
    { 
      queryKey: ['time-entries'],
      exact: false,
      predicate: (query) => {
        if (!query.queryKey[1]) return false;
        const cachedDate = new Date(query.queryKey[1] as string);
        // Check dacă cache-ul e pentru aceeași zi
        return startOfDay(cachedDate).getTime() === dayStart.getTime();
      }
    },
    (old: any) => {
      if (!Array.isArray(old)) return old;
      // Adaugă la început (ordine descrescătoare după clock_in_time)
      return [newEntry, ...old];
    }
  );

  // 2. Update cache-ul pentru user ['my-time-entries', userId, month]
  queryClient.setQueriesData(
    {
      queryKey: ['my-time-entries', newEntry.user_id],
      exact: false,
      predicate: (query) => {
        if (query.queryKey.length < 3 || !query.queryKey[2]) return false;
        const cachedMonth = new Date(query.queryKey[2] as string);
        return startOfMonth(cachedMonth).getTime() === monthStart.getTime();
      }
    },
    (old: any) => {
      if (!Array.isArray(old)) return old;
      return [newEntry, ...old];
    }
  );

  // 3. Invalidăm DOAR agregările (daily_timesheets, weekly_timesheets)
  // Acestea necesită recalculare pe server
  const dateKey = entryDate.toISOString().split('T')[0]; // YYYY-MM-DD
  queryClient.invalidateQueries({
    queryKey: ['daily-timesheets'],
    exact: false
  });
  queryClient.invalidateQueries({
    queryKey: ['my-daily-timesheets', newEntry.user_id],
    exact: false
  });
  queryClient.invalidateQueries({
    queryKey: ['weekly-timesheets'],
    exact: false
  });

  console.log('[cacheUpdaters] INSERT completed - 2 cache updates + 3 aggregate invalidations');
}

/**
 * Actualizează un time entry EXISTENT în toate cache-urile
 */
export function updateTimeEntryInCache(
  queryClient: QueryClient,
  updatedEntry: TimeEntry
) {
  console.log('[cacheUpdaters] UPDATE:', {
    entryId: updatedEntry.id,
    userId: updatedEntry.user_id
  });

  // Update în toate cache-urile ['time-entries', ...]
  queryClient.setQueriesData(
    { queryKey: ['time-entries'], exact: false },
    (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.map(entry => 
        entry.id === updatedEntry.id ? { ...entry, ...updatedEntry } : entry
      );
    }
  );

  // Update în cache-ul user-ului ['my-time-entries', userId, ...]
  queryClient.setQueriesData(
    { queryKey: ['my-time-entries', updatedEntry.user_id], exact: false },
    (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.map(entry => 
        entry.id === updatedEntry.id ? { ...entry, ...updatedEntry } : entry
      );
    }
  );

  // Invalidăm agregările (daily_timesheets pot fi afectate de update)
  queryClient.invalidateQueries({
    queryKey: ['daily-timesheets'],
    exact: false
  });
  queryClient.invalidateQueries({
    queryKey: ['my-daily-timesheets', updatedEntry.user_id],
    exact: false
  });

  console.log('[cacheUpdaters] UPDATE completed - 2 cache updates + 2 aggregate invalidations');
}

/**
 * Șterge un time entry din toate cache-urile
 */
export function deleteTimeEntryFromCache(
  queryClient: QueryClient,
  deletedEntry: { id: string; user_id: string }
) {
  console.log('[cacheUpdaters] DELETE:', {
    entryId: deletedEntry.id,
    userId: deletedEntry.user_id
  });

  // Șterge din toate cache-urile ['time-entries', ...]
  queryClient.setQueriesData(
    { queryKey: ['time-entries'], exact: false },
    (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.filter(entry => entry.id !== deletedEntry.id);
    }
  );

  // Șterge din cache-ul user-ului
  queryClient.setQueriesData(
    { queryKey: ['my-time-entries', deletedEntry.user_id], exact: false },
    (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.filter(entry => entry.id !== deletedEntry.id);
    }
  );

  // Invalidăm agregările
  queryClient.invalidateQueries({
    queryKey: ['daily-timesheets'],
    exact: false
  });
  queryClient.invalidateQueries({
    queryKey: ['my-daily-timesheets', deletedEntry.user_id],
    exact: false
  });

  console.log('[cacheUpdaters] DELETE completed - 2 cache updates + 2 aggregate invalidations');
}
