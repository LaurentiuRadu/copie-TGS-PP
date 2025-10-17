/**
 * Application-wide constants
 * Replace magic numbers and improve maintainability
 */

// Time validation constants
export const MIN_DURATION_HOURS = 0.17; // ~10 minutes minimum for valid entry
export const MAX_DURATION_HOURS = 24; // Maximum work hours per day
export const DISCREPANCY_THRESHOLD_MINUTES = 30; // Threshold for clock-in discrepancy detection

// UI constants
export const MIN_TOUCH_SIZE = 44; // Minimum touch target size for mobile (px)
export const DEBOUNCE_DELAY_MS = 300; // Standard debounce delay
export const ANIMATION_DURATION_MS = 200; // Standard animation duration

// Date format constants
export const DATE_FORMAT = 'yyyy-MM-dd';
export const TIME_FORMAT = 'HH:mm';
export const DATETIME_FORMAT = 'yyyy-MM-dd HH:mm';
export const DISPLAY_DATE_FORMAT = 'dd MMM yyyy';

// Query invalidation constants
export const STALE_TIME_MS = 30000; // 30 seconds
export const CACHE_TIME_MS = 300000; // 5 minutes
