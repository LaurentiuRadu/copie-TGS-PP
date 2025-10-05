import * as XLSX from 'xlsx';

interface ExportTimeEntry {
  Angajat: string;
  Ziua: string;
  'Ore Zi': string;
  'Ore Noapte': string;
  'Ore Sambata': string;
  'Ore Duminica': string;
  'Ore Sarbatori': string;
  'Ore Pasager': string;
  'Ore Condus': string;
  'Ore Utilaj': string;
  CO: string;
  CM: string;
}

export const exportToExcel = (data: ExportTimeEntry[], filename: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  
  // Set column widths
  worksheet['!cols'] = [
    { wch: 20 }, // Angajat
    { wch: 22 }, // Ziua
    { wch: 10 }, // Ore Zi
    { wch: 12 }, // Ore Noapte
    { wch: 12 }, // Ore Sambata
    { wch: 13 }, // Ore Duminica
    { wch: 13 }, // Ore Sarbatori
    { wch: 12 }, // Ore Pasager
    { wch: 11 }, // Ore Condus
    { wch: 11 }, // Ore Utilaj
    { wch: 10 }, // CO
    { wch: 10 }, // CM
  ];
  
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pontaje');
  
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

export const exportToCSV = (data: ExportTimeEntry[], filename: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};