import * as XLSX from 'xlsx';

interface ExportTimeEntry {
  Angajat: string;
  Data: string;
  Normale: string;
  Noapte: string;
  Sâmbătă: string;
  'D/Sărbători': string;
  Pasager: string;
  Condus: string;
  Utilaj: string;
  CO: string;
  CM: string;
  Observații: string;
  Total: string;
}

export const exportToExcel = (data: ExportTimeEntry[], filename: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  
  // Set column widths
  worksheet['!cols'] = [
    { wch: 20 }, // Angajat
    { wch: 12 }, // Data
    { wch: 10 }, // Normale
    { wch: 10 }, // Noapte
    { wch: 10 }, // Sâmbătă
    { wch: 12 }, // D/Sărbători
    { wch: 10 }, // Pasager
    { wch: 10 }, // Condus
    { wch: 10 }, // Utilaj
    { wch: 8 },  // CO
    { wch: 8 },  // CM
    { wch: 30 }, // Observații
    { wch: 10 }, // Total
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