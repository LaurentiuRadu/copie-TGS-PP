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
    fetch('/fonts/Roboto-Regular.ttf'),
    fetch('/fonts/Roboto-Bold.ttf'),
  ]);

  const [normalAb, boldAb] = await Promise.all([
    normalResp.arrayBuffer(),
    boldResp.arrayBuffer(),
  ]);

  const normalB64 = arrayBufferToBase64(normalAb);
  const boldB64 = arrayBufferToBase64(boldAb);

  doc.addFileToVFS('Roboto-Regular.ttf', normalB64);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');

  doc.addFileToVFS('Roboto-Bold.ttf', boldB64);
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');

  fontsLoaded = true;
};