import { useCallback } from 'react';

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

export function useHapticFeedback() {
  const triggerHaptic = useCallback((style: HapticStyle = 'medium') => {
    // Map haptic styles to vibration patterns
    const patterns: Record<HapticStyle, number | number[]> = {
      light: 10,
      medium: 20,
      heavy: 30,
      success: [10, 50, 10],
      warning: [20, 100, 20],
      error: [50, 100, 50, 100, 50]
    };

    // Try native Vibration API first
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(patterns[style]);
      } catch (error) {
        console.warn('Haptic feedback failed:', error);
      }
    }

    // Try Capacitor Haptics for better native feel
    if ((window as any).Capacitor) {
      import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => {
        const impactStyles = {
          light: ImpactStyle.Light,
          heavy: ImpactStyle.Heavy,
          medium: ImpactStyle.Medium,
        };

        const impactStyle = 
          style === 'light' ? impactStyles.light :
          style === 'heavy' ? impactStyles.heavy :
          impactStyles.medium;

        Haptics.impact({ style: impactStyle }).catch(() => {
          // Silently fail if not supported
        });
      }).catch(() => {
        // Capacitor Haptics not available
      });
    }
  }, []);

  return { triggerHaptic };
}
