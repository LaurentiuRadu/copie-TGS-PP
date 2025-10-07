import { useEffect } from 'react';
import { useTheme } from 'next-themes';

interface SunTimes {
  sunrise: number; // hour (0-23)
  sunset: number;  // hour (0-23)
}

// Calculează sunrise/sunset aproximativ bazat pe lună (pentru România)
const getSunTimes = (month: number): SunTimes => {
  // Timpi aproximativi pentru România (UTC+2/+3)
  const sunTimes: Record<number, SunTimes> = {
    0: { sunrise: 8, sunset: 17 },   // Ianuarie
    1: { sunrise: 7, sunset: 18 },   // Februarie
    2: { sunrise: 7, sunset: 19 },   // Martie
    3: { sunrise: 6, sunset: 20 },   // Aprilie
    4: { sunrise: 5, sunset: 21 },   // Mai
    5: { sunrise: 5, sunset: 21 },   // Iunie
    6: { sunrise: 6, sunset: 21 },   // Iulie
    7: { sunrise: 6, sunset: 20 },   // August
    8: { sunrise: 7, sunset: 19 },   // Septembrie
    9: { sunrise: 7, sunset: 18 },   // Octombrie
    10: { sunrise: 7, sunset: 17 },  // Noiembrie
    11: { sunrise: 8, sunset: 16 },  // Decembrie
  };
  
  return sunTimes[month] || { sunrise: 6, sunset: 18 };
};

export const useAutoDarkMode = (enabled: boolean = false) => {
  const { setTheme } = useTheme();

  useEffect(() => {
    // Dacă nu este activat, nu face nimic
    if (!enabled) return;

    const updateTheme = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMonth = now.getMonth();
      
      const { sunrise, sunset } = getSunTimes(currentMonth);
      
      // E noapte dacă ora e înainte de sunrise sau după sunset
      const isNight = currentHour < sunrise || currentHour >= sunset;
      const newTheme = isNight ? 'dark' : 'light';
      
      if (import.meta.env.DEV) {
        console.info(`🌓 Auto theme: ${newTheme} (${currentHour}:00, sunrise: ${sunrise}:00, sunset: ${sunset}:00)`);
      }
      
      setTheme(newTheme);
    };

    // Verifică imediat
    updateTheme();

    // Verifică la fiecare 30 minute
    const interval = setInterval(updateTheme, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [enabled, setTheme]);
};
