import * as XLSX from 'xlsx';

interface ExportTimeEntry {
  'Angajat': string;
  'Data': string;
  'Ore Normale': string;
  'Ore Noapte': string;
  'Ore Sâmbătă': string;
  'Ore Duminică': string;
  'Ore Sărbători': string;
  'Ore Pasager': string;
  'Ore Șofat': string;
  'Ore Echipament': string;
  'Ore Concediu': string;
  'Ore Medical': string;
  'Total Ore': string;
  'Notițe': string;
}

interface PayrollExportEntry {
  'Nume': string;
  'Ore Zi': string;
  'Ore Noapte': string;
  'Ore Weekend': string;
  'Ore Pasager': string;
  'Ore Condus': string;
  'Ore Concediu': string;
  'Total Ore': string;
}

interface DailyTimesheetForExport {
  employee_id: string;
  work_date: string;
  hours_regular: number;
  hours_night: number;
  hours_saturday: number;
  hours_sunday: number;
  hours_holiday: number;
  hours_passenger: number;
  hours_driving: number;
  hours_equipment: number;
  hours_leave: number;
  hours_medical_leave: number;
  notes: string | null;
  profiles?: {
    username: string | null;
    full_name: string | null;
  };
}

const formatHours = (hours: number): string => {
  return `${hours.toFixed(1)}h`;
};

const mapTimesheetToExportRow = (entry: DailyTimesheetForExport): ExportTimeEntry => {
  const totalHours = 
    entry.hours_regular +
    entry.hours_night +
    entry.hours_saturday +
    entry.hours_sunday +
    entry.hours_holiday +
    entry.hours_passenger +
    entry.hours_driving +
    entry.hours_equipment +
    entry.hours_leave +
    entry.hours_medical_leave;

  return {
    'Angajat': entry.profiles?.full_name || entry.profiles?.username || 'Unknown',
    'Data': new Date(entry.work_date).toLocaleDateString('ro-RO'),
    'Ore Normale': formatHours(entry.hours_regular),
    'Ore Noapte': formatHours(entry.hours_night),
    'Ore Sâmbătă': formatHours(entry.hours_saturday),
    'Ore Duminică': formatHours(entry.hours_sunday),
    'Ore Sărbători': formatHours(entry.hours_holiday),
    'Ore Pasager': formatHours(entry.hours_passenger),
    'Ore Șofat': formatHours(entry.hours_driving),
    'Ore Echipament': formatHours(entry.hours_equipment),
    'Ore Concediu': formatHours(entry.hours_leave),
    'Ore Medical': formatHours(entry.hours_medical_leave),
    'Total Ore': formatHours(totalHours),
    'Notițe': entry.notes || ''
  };
};

export const exportToExcel = (data: DailyTimesheetForExport[], filename: string = 'pontaje.xlsx') => {
  const exportData: ExportTimeEntry[] = data.map(entry => mapTimesheetToExportRow(entry));

  const ws = XLSX.utils.json_to_sheet(exportData);
  
  // Set column widths
  const colWidths = [
    { wch: 20 }, // Angajat
    { wch: 12 }, // Data
    { wch: 12 }, // Ore Normale
    { wch: 12 }, // Ore Noapte
    { wch: 12 }, // Ore Sâmbătă
    { wch: 12 }, // Ore Duminică
    { wch: 12 }, // Ore Sărbători
    { wch: 12 }, // Ore Pasager
    { wch: 12 }, // Ore Șofat
    { wch: 12 }, // Ore Echipament
    { wch: 12 }, // Ore Concediu
    { wch: 12 }, // Ore Medical
    { wch: 12 }, // Total Ore
    { wch: 30 }  // Notițe
  ];
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pontaje');
  XLSX.writeFile(wb, filename);
};

export const exportToCSV = (data: DailyTimesheetForExport[], filename: string = 'pontaje.csv') => {
  const exportData: ExportTimeEntry[] = data.map(entry => mapTimesheetToExportRow(entry));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const csv = XLSX.utils.sheet_to_csv(ws);
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const formatRomanianNumber = (num: number): string => {
  return num.toFixed(2).replace('.', ',');
};

export const exportToPayrollCSV = (
  data: DailyTimesheetForExport[], 
  startDate: Date, 
  endDate: Date
) => {
  // Validate date range
  if (startDate > endDate) {
    throw new Error('Data de început trebuie să fie înainte de data de sfârșit');
  }

  // Helper function to convert Date to YYYY-MM-DD string for comparison
  const formatDateForComparison = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const startDateStr = formatDateForComparison(startDate);
  const endDateStr = formatDateForComparison(endDate);

  console.log(`[Payroll Export] Date range: ${startDateStr} - ${endDateStr}`);
  console.log(`[Payroll Export] Total records from DB: ${data.length}`);

  // 1. Filter data within date range using string comparison to avoid timezone issues
  const filteredData = data.filter(entry => {
    // Extract YYYY-MM-DD from work_date (handles both "2025-10-03" and "2025-10-03T00:00:00")
    const workDateStr = entry.work_date.split('T')[0];
    return workDateStr >= startDateStr && workDateStr <= endDateStr;
  });

  console.log(`[Payroll Export] Filtered records: ${filteredData.length}`);

  if (filteredData.length === 0) {
    throw new Error('Nu există date pentru intervalul selectat');
  }

  // 2. Aggregate per employee (sum hours over interval)
  const aggregatedMap = new Map<string, {
    name: string;
    oreZi: number;
    oreNoapte: number;
    oreWeekend: number;
    orePasager: number;
    oreCondus: number;
    oreConcediu: number;
  }>();
  
  filteredData.forEach(entry => {
    const employeeName = entry.profiles?.full_name || entry.profiles?.username || 'Unknown';
    
    if (!aggregatedMap.has(employeeName)) {
      aggregatedMap.set(employeeName, {
        name: employeeName,
        oreZi: 0,
        oreNoapte: 0,
        oreWeekend: 0,
        orePasager: 0,
        oreCondus: 0,
        oreConcediu: 0
      });
    }
    
    const agg = aggregatedMap.get(employeeName)!;
    
    // Calculate aggregations based on rules:
    // Ore Zi = hours_regular + hours_equipment
    // Ore Weekend = hours_saturday + hours_sunday + hours_holiday
    // Ore Concediu = hours_leave + hours_medical_leave
    agg.oreZi += entry.hours_regular + entry.hours_equipment;
    agg.oreNoapte += entry.hours_night;
    agg.oreWeekend += entry.hours_saturday + entry.hours_sunday + entry.hours_holiday;
    agg.orePasager += entry.hours_passenger;
    agg.oreCondus += entry.hours_driving;
    agg.oreConcediu += entry.hours_leave + entry.hours_medical_leave;
  });
  
  // 3. Validate and warn (non-blocking)
  const warnings: string[] = [];
  filteredData.forEach(entry => {
    const total = 
      entry.hours_regular + entry.hours_night + entry.hours_saturday +
      entry.hours_sunday + entry.hours_holiday + entry.hours_passenger +
      entry.hours_driving + entry.hours_equipment + entry.hours_leave +
      entry.hours_medical_leave;
    
    if (total > 24) {
      warnings.push(`${entry.profiles?.full_name}: ${total}h > 24h pe ${entry.work_date}`);
    }
    if (total < 0) {
      warnings.push(`${entry.profiles?.full_name}: ${total}h < 0 pe ${entry.work_date}`);
    }
  });

  if (warnings.length > 0) {
    console.warn('[Payroll Export] Avertismente:', warnings);
  }

  // 4. Format data for export with Romanian numbers
  const exportData: PayrollExportEntry[] = Array.from(aggregatedMap.values()).map(row => {
    const total = 
      row.oreZi +
      row.oreNoapte +
      row.oreWeekend +
      row.orePasager +
      row.oreCondus +
      row.oreConcediu;
    
    return {
      'Nume': row.name,
      'Ore Zi': formatRomanianNumber(row.oreZi),
      'Ore Noapte': formatRomanianNumber(row.oreNoapte),
      'Ore Weekend': formatRomanianNumber(row.oreWeekend),
      'Ore Pasager': formatRomanianNumber(row.orePasager),
      'Ore Condus': formatRomanianNumber(row.oreCondus),
      'Ore Concediu': formatRomanianNumber(row.oreConcediu),
      'Total Ore': formatRomanianNumber(total)
    };
  });

  // 5. Generate CSV with Romanian separator
  const ws = XLSX.utils.json_to_sheet(exportData);
  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ';' });
  
  // 6. Add metadata header
  const formatDate = (date: Date) => date.toLocaleDateString('ro-RO', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });
  
  const formatDateTime = (date: Date) => date.toLocaleString('ro-RO', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const now = new Date();
  const header = `==== RAPORT PONTAJE TIMETRACK ====
Perioada export: ${formatDate(startDate)} - ${formatDate(endDate)}
Data export: ${formatDateTime(now)}
Total angajați: ${aggregatedMap.size}

`;
  
  const csvWithHeader = header + csv;
  
  // 7. Download file
  const monthYear = startDate.toISOString().slice(0, 7); // YYYY-MM
  const filename = `raport-lunar-${monthYear}.csv`;
  const blob = new Blob(['\ufeff' + csvWithHeader], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};
