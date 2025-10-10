import jsPDF from 'jspdf';

let fontsLoaded = false;

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
  if (fontsLoaded) return;
  const [normalResp, boldResp] = await Promise.all([
    fetch('/fonts/DejaVuSans.ttf'),
    fetch('/fonts/DejaVuSans-Bold.ttf'),
  ]);

  const [normalAb, boldAb] = await Promise.all([
    normalResp.arrayBuffer(),
    boldResp.arrayBuffer(),
  ]);

  const normalB64 = arrayBufferToBase64(normalAb);
  const boldB64 = arrayBufferToBase64(boldAb);

  doc.addFileToVFS('DejaVuSans.ttf', normalB64);
  doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');

  doc.addFileToVFS('DejaVuSans-Bold.ttf', boldB64);
  doc.addFont('DejaVuSans-Bold.ttf', 'DejaVuSans', 'bold');

  fontsLoaded = true;
};