/**
 * Redă un sunet de notificare folosind Web Audio API
 */
export const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Creează un oscillator pentru sunet
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Configurează sunetul - un beep plăcut de 800Hz
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    // Configurează volumul cu fade out
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    // Redă sunetul pentru 0.5 secunde
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
    
    // Cleanup după ce sunetul se termină
    oscillator.onended = () => {
      audioContext.close();
    };
  } catch (error) {
    console.error('Eroare la redarea sunetului de notificare:', error);
  }
};

/**
 * Redă un sunet dublu de notificare (mai evident)
 */
export const playDoubleNotificationSound = () => {
  playNotificationSound();
  setTimeout(() => playNotificationSound(), 200);
};
