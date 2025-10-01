export type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

export function useHapticFeedback() {
  const triggerHaptic = (style: HapticStyle = 'medium') => {
    // Check if the Vibration API is supported
    if (!('vibrate' in navigator)) {
      return;
    }

    // Map haptic styles to vibration patterns
    const patterns: Record<HapticStyle, number | number[]> = {
      light: 10,
      medium: 20,
      heavy: 30,
      success: [10, 50, 10],
      warning: [20, 100, 20],
      error: [50, 100, 50, 100, 50]
    };

    try {
      navigator.vibrate(patterns[style]);
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  };

  return { triggerHaptic };
}
