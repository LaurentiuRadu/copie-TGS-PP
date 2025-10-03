import { useEffect, useState } from 'react';

/**
 * Hook pentru detectarea activității aplicației
 * Detectează când utilizatorul e activ vs inactiv pentru optimizarea bateriei
 */
export const useAppActivity = (inactivityThreshold: number = 120000) => {
  const [isActive, setIsActive] = useState(true);
  const [lastActivity, setLastActivity] = useState(Date.now());

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const updateActivity = () => {
      setLastActivity(Date.now());
      setIsActive(true);
      
      // Reset timeout pentru inactivitate
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsActive(false);
      }, inactivityThreshold);
    };

    // Events care indică activitate utilizator
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    activityEvents.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    // Page Visibility API pentru detectarea când tab-ul devine vizibil
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateActivity();
      } else {
        setIsActive(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Start inițial timeout
    updateActivity();

    return () => {
      clearTimeout(timeoutId);
      activityEvents.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [inactivityThreshold]);

  return { isActive, lastActivity };
};
