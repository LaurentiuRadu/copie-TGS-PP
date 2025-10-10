import jsPDF from 'jspdf';

// Cache pentru font-urile încărcate (fetch o singură dată)
let cachedFonts: {
  normalB64: string | null;
  boldB64: string | null;
} = {
  normalB64: null,
  boldB64: null,
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

export const ensureDejaVuSans = async (doc: jsPDF) => {
  // Dacă font-urile nu sunt în cache, le încărcăm de pe server
  if (!cachedFonts.normalB64 || !cachedFonts.boldB64) {
    const [normalResp, boldResp] = await Promise.all([
      fetch('/fonts/Roboto-Regular.ttf'),
      fetch('/fonts/Roboto-Bold.ttf'),
    ]);

    const [normalAb, boldAb] = await Promise.all([
      normalResp.arrayBuffer(),
      boldResp.arrayBuffer(),
    ]);

    cachedFonts.normalB64 = arrayBufferToBase64(normalAb);
    cachedFonts.boldB64 = arrayBufferToBase64(boldAb);
  }

  // Adăugăm font-urile în documentul jsPDF CURENT
  // (chiar dacă am mai făcut-o pentru alt document)
  doc.addFileToVFS('Roboto-Regular.ttf', cachedFonts.normalB64!);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');

  doc.addFileToVFS('Roboto-Bold.ttf', cachedFonts.boldB64!);
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
};