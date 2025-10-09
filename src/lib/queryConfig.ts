/**
 * Configurare centralizată pentru React Query
 * ✅ StaleTime values standardizate
 * ✅ Cache time predictibil
 * ✅ Documentație self-explanatory
 */

export const STALE_TIME = {
  /**
   * Pentru date administrate rar schimbate
   * Ex: timesheets, users, holidays
   */
  ADMIN_DATA: 60000, // 60s

  /**
   * Pentru date user modificate frecvent
   * Ex: my entries, my schedules
   */
  USER_TRACKING: 30000, // 30s

  /**
   * Pentru date critice în timp real
   * Ex: active pontaj (cu refetchInterval)
   */
  ACTIVE_ENTRY: 15000, // 15s

  /**
   * Pentru date statice rareori schimbate
   * Ex: work locations, holidays, rules
   */
  STATIC_DATA: 300000, // 5min
} as const;

export const CACHE_TIME = {
  /**
   * Cache standard pentru date volatile
   */
  DEFAULT: 60000, // 1 min

  /**
   * Cache lung pentru date stabile
   */
  STABLE: 300000, // 5 min

  /**
   * Cache scurt pentru date critice
   */
  CRITICAL: 30000, // 30s
} as const;

export const REFETCH_INTERVAL = {
  /**
   * Refetch activ pentru pontaj în desfășurare
   */
  ACTIVE_ENTRY: 15000, // 15s

  /**
   * Refetch moderat pentru dashboards
   */
  DASHBOARD: 60000, // 60s
} as const;
