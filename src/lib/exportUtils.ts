import * as XLSX from 'xlsx';

interface ExportTimeEntry {
  Angajat: string;
  Data: string;
  Intrare: string;
  Ieșire: string;
  'Ore Totale': number;
  'Ore Plătite': number;
  Segmente: string;
}

export const exportToExcel = (data: ExportTimeEntry[], filename: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  
  // Set column widths
  worksheet['!cols'] = [
    { wch: 20 }, // Angajat
    { wch: 12 }, // Data
    { wch: 10 }, // Intrare
    { wch: 10 }, // Ieșire
    { wch: 12 }, // Ore Totale
    { wch: 12 }, // Ore Plătite
    { wch: 50 }, // Segmente
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