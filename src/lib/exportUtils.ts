import * as XLSX from 'xlsx';

interface ExportTimeEntry {
  Angajat: string;
  Data: string;
  Intrare: string;
  Ieșire: string;
  Regular: string;
  Noapte: string;
  Sâmbătă: string;
  Duminică: string;
  Sărbătoare: string;
  Pasager: string;
  Condus: string;
  Utilaj: string;
  CO: string;
  CM: string;
  TOTAL: string;
}

interface TimeEntrySegment {
  segment_type: string;
  hours_decimal: number;
}

interface TimeEntryForExport {
  profiles?: { full_name?: string | null; username?: string | null } | null;
  clock_in_time: string;
  clock_out_time: string | null;
  notes?: string | null;
  time_entry_segments?: TimeEntrySegment[];
}

const formatHours = (hours: number): string => {
  return `${hours.toFixed(1).replace('.', ',')}h`;
};

const mapHoursToCategories = (entry: TimeEntryForExport) => {
  const notes = entry.notes || '';
  const segments = entry.time_entry_segments || [];
  
  // Calculate total hours from segments
  const totalHours = segments.reduce((sum, seg) => sum + seg.hours_decimal, 0);
  
  // Initialize all categories to 0
  const categories = {
    regular: 0,
    noapte: 0,
    sambata: 0,
    duminica: 0,
    sarbatoare: 0,
    pasager: 0,
    condus: 0,
    utilaj: 0,
    co: 0,
    cm: 0,
  };
  
  // Check if notes specify a manual category
  if (notes.includes('Tip: Condus')) {
    categories.condus = totalHours;
  } else if (notes.includes('Tip: Pasager')) {
    categories.pasager = totalHours;
  } else if (notes.includes('Tip: Utilaj')) {
    categories.utilaj = totalHours;
  } else {
    // Distribute hours based on automatic segments
    segments.forEach(seg => {
      switch (seg.segment_type) {
        case 'normal_day':
          categories.regular += seg.hours_decimal;
          break;
        case 'normal_night':
          categories.noapte += seg.hours_decimal;
          break;
        case 'saturday':
          categories.sambata += seg.hours_decimal;
          break;
        case 'sunday':
          categories.duminica += seg.hours_decimal;
          break;
        case 'holiday':
          categories.sarbatoare += seg.hours_decimal;
          break;
      }
    });
  }
  
  return categories;
};

export const exportToExcel = (data: TimeEntryForExport[], filename: string) => {
  const exportData: ExportTimeEntry[] = data.map(entry => {
    const categories = mapHoursToCategories(entry);
    const totalHours = Object.values(categories).reduce((sum, h) => sum + h, 0);
    
    return {
      Angajat: entry.profiles?.full_name || entry.profiles?.username || 'Necunoscut',
      Data: new Date(entry.clock_in_time).toLocaleDateString('ro-RO'),
      Intrare: new Date(entry.clock_in_time).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }),
      Ieșire: entry.clock_out_time 
        ? new Date(entry.clock_out_time).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
        : '-',
      Regular: formatHours(categories.regular),
      Noapte: formatHours(categories.noapte),
      Sâmbătă: formatHours(categories.sambata),
      Duminică: formatHours(categories.duminica),
      Sărbătoare: formatHours(categories.sarbatoare),
      Pasager: formatHours(categories.pasager),
      Condus: formatHours(categories.condus),
      Utilaj: formatHours(categories.utilaj),
      CO: formatHours(categories.co),
      CM: formatHours(categories.cm),
      TOTAL: formatHours(totalHours),
    };
  });
  
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  
  // Set column widths
  worksheet['!cols'] = [
    { wch: 20 }, // Angajat
    { wch: 12 }, // Data
    { wch: 10 }, // Intrare
    { wch: 10 }, // Ieșire
    { wch: 10 }, // Regular
    { wch: 10 }, // Noapte
    { wch: 10 }, // Sâmbătă
    { wch: 10 }, // Duminică
    { wch: 12 }, // Sărbătoare
    { wch: 10 }, // Pasager
    { wch: 10 }, // Condus
    { wch: 10 }, // Utilaj
    { wch: 8 },  // CO
    { wch: 8 },  // CM
    { wch: 10 }, // TOTAL
  ];
  
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pontaje');
  
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

export const exportToCSV = (data: TimeEntryForExport[], filename: string) => {
  const exportData: ExportTimeEntry[] = data.map(entry => {
    const categories = mapHoursToCategories(entry);
    const totalHours = Object.values(categories).reduce((sum, h) => sum + h, 0);
    
    return {
      Angajat: entry.profiles?.full_name || entry.profiles?.username || 'Necunoscut',
      Data: new Date(entry.clock_in_time).toLocaleDateString('ro-RO'),
      Intrare: new Date(entry.clock_in_time).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }),
      Ieșire: entry.clock_out_time 
        ? new Date(entry.clock_out_time).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
        : '-',
      Regular: formatHours(categories.regular),
      Noapte: formatHours(categories.noapte),
      Sâmbătă: formatHours(categories.sambata),
      Duminică: formatHours(categories.duminica),
      Sărbătoare: formatHours(categories.sarbatoare),
      Pasager: formatHours(categories.pasager),
      Condus: formatHours(categories.condus),
      Utilaj: formatHours(categories.utilaj),
      CO: formatHours(categories.co),
      CM: formatHours(categories.cm),
      TOTAL: formatHours(totalHours),
    };
  });
  
  const worksheet = XLSX.utils.json_to_sheet(exportData);
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