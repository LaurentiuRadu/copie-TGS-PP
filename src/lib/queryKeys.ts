/**
 * Centralizare Query Keys pentru React Query
 * ✅ Previne duplicate queries prin deduplication
 * ✅ Invalidare predictibilă și consistentă
 * ✅ Tip-safe cu TypeScript
 */

export const QUERY_KEYS = {
  // Time Entries
  timeEntries: (date?: Date) => 
    date ? ['time-entries', date.toISOString()] : ['time-entries'],
  
  myTimeEntries: (userId?: string, month?: Date) => 
    ['my-time-entries', userId, month?.toISOString()].filter(Boolean),

  // Daily Timesheets
  dailyTimesheets: (date?: Date) => 
    date ? ['daily-timesheets', date.toISOString()] : ['daily-timesheets'],
  
  myDailyTimesheets: (userId?: string, month?: Date) => 
    ['my-daily-timesheets', userId, month?.toISOString()].filter(Boolean),

  weeklyTimesheets: (startDate?: Date) => 
    startDate ? ['weekly-timesheets', startDate.toISOString()] : ['weekly-timesheets'],

  // Vacations
  vacationRequests: () => ['vacation-requests'],
  
  vacationBalance: (userId?: string, year?: number) => 
    ['vacation-balance', userId, year].filter(Boolean),

  // Schedules
  weeklySchedules: (weekStart?: Date) => 
    weekStart ? ['weekly-schedules', weekStart.toISOString()] : ['weekly-schedules'],
  
  mySchedules: (userId?: string) => 
    userId ? ['my-schedules', userId] : ['my-schedules'],

  // Active Entry
  activeEntry: (userId?: string) => 
    userId ? ['active-entry', userId] : ['active-entry'],

  // GDPR
  gdprRequests: (status?: string) => 
    status ? ['gdpr-requests', status] : ['gdpr-requests'],
} as const;
