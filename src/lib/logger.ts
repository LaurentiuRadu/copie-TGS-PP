/**
 * Sistem centralizat de logging pentru producție
 * Logging-ul este activ doar în development mode
 */

const isDev = import.meta.env.DEV;

export const logger = {
  info: (...args: any[]) => {
    if (isDev) {
      console.info(...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },
  
  error: (...args: any[]) => {
    // Error-urile sunt logate și în producție
    console.error(...args);
  },
  
  debug: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  }
};
