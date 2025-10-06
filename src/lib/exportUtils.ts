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

interface PayrollDailyExportEntry {
  'Angajat': string;
  'Ziua': string;
  'Ore Zi': string;
  'Ore Noapte': string;
  'Ore Sâmbătă': string;
  'Ore Duminică': string;
  'Ore Sărbători': string;
  'Ore Pasager': string;
  'Ore Condus': string;
  'Ore Utilaj': string;
  'CO': string;
  'CM': string;
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

  // Helper function to format date as DD.MM.YYYY
  const formatDateDD_MM_YYYY = (dateStr: string): string => {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
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

  // 2. Export daily (one row per employee per day) - NO AGGREGATION!
  const exportData: PayrollDailyExportEntry[] = filteredData.map(entry => ({
    'Angajat': entry.profiles?.full_name || entry.profiles?.username || 'Unknown',
    'Ziua': formatDateDD_MM_YYYY(entry.work_date),
    'Ore Zi': formatRomanianNumber(entry.hours_regular),
    'Ore Noapte': formatRomanianNumber(entry.hours_night),
    'Ore Sâmbătă': formatRomanianNumber(entry.hours_saturday),
    'Ore Duminică': formatRomanianNumber(entry.hours_sunday),
    'Ore Sărbători': formatRomanianNumber(entry.hours_holiday),
    'Ore Pasager': formatRomanianNumber(entry.hours_passenger),
    'Ore Condus': formatRomanianNumber(entry.hours_driving),
    'Ore Utilaj': formatRomanianNumber(entry.hours_equipment),
    'CO': formatRomanianNumber(entry.hours_leave),
    'CM': formatRomanianNumber(entry.hours_medical_leave),
  }));

  // 3. Generate CSV with Romanian separator (semicolon)
  const ws = XLSX.utils.json_to_sheet(exportData);
  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ';' });
  
  // 4. Download file (NO metadata header!)
  const formatDateRO = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const isSameDay = startDateStr === endDateStr;
  const filename = isSameDay 
    ? `raport-${formatDateRO(startDate)}.csv`
    : `raport-${formatDateRO(startDate)}-${formatDateRO(endDate)}.csv`;
  
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};

// Raport lunar salarizare - export Excel cu sumar per angajat
interface PayrollSummary {
  employeeName: string;
  totalHours: number;
  daysWorked: number;
  hoursRegular: number;
  hoursNight: number;
  hoursSaturday: number;
  hoursSunday: number;
  hoursHoliday: number;
  hoursPassenger: number;
  hoursDriving: number;
  hoursEquipment: number;
  hoursLeave: number;
  hoursMedicalLeave: number;
  // Ore plătibile cu multiplicatori
  payableRegular: number;  // 1.0x
  payableNight: number;    // 1.25x
  payableSaturday: number; // 1.5x
  payableSundayHoliday: number; // 2.0x
  totalPayableHours: number;
}

export const exportMonthlyPayrollReport = (
  data: DailyTimesheetForExport[],
  month: Date,
  selectedEmployeeId?: string
) => {
  const monthName = month.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
  
  // Filtrare opțională per angajat
  const filteredData = selectedEmployeeId 
    ? data.filter(d => d.employee_id === selectedEmployeeId)
    : data;

  if (filteredData.length === 0) {
    throw new Error('Nu există date pentru perioada selectată');
  }

  // Agregare pe angajați
  const employeeSummaries = new Map<string, PayrollSummary>();

  filteredData.forEach(entry => {
    const employeeName = entry.profiles?.full_name || entry.profiles?.username || 'Unknown';
    
    if (!employeeSummaries.has(entry.employee_id)) {
      employeeSummaries.set(entry.employee_id, {
        employeeName,
        totalHours: 0,
        daysWorked: 0,
        hoursRegular: 0,
        hoursNight: 0,
        hoursSaturday: 0,
        hoursSunday: 0,
        hoursHoliday: 0,
        hoursPassenger: 0,
        hoursDriving: 0,
        hoursEquipment: 0,
        hoursLeave: 0,
        hoursMedicalLeave: 0,
        payableRegular: 0,
        payableNight: 0,
        payableSaturday: 0,
        payableSundayHoliday: 0,
        totalPayableHours: 0,
      });
    }

    const summary = employeeSummaries.get(entry.employee_id)!;
    
    summary.hoursRegular += entry.hours_regular;
    summary.hoursNight += entry.hours_night;
    summary.hoursSaturday += entry.hours_saturday;
    summary.hoursSunday += entry.hours_sunday;
    summary.hoursHoliday += entry.hours_holiday;
    summary.hoursPassenger += entry.hours_passenger;
    summary.hoursDriving += entry.hours_driving;
    summary.hoursEquipment += entry.hours_equipment;
    summary.hoursLeave += entry.hours_leave;
    summary.hoursMedicalLeave += entry.hours_medical_leave;
    summary.daysWorked += 1;

    // Calcul ore plătibile cu multiplicatori
    summary.payableRegular += entry.hours_regular * 1.0;
    summary.payableNight += entry.hours_night * 1.25;
    summary.payableSaturday += entry.hours_saturday * 1.5;
    summary.payableSundayHoliday += (entry.hours_sunday + entry.hours_holiday) * 2.0;
  });

  // Calculare total-uri
  employeeSummaries.forEach(summary => {
    summary.totalHours = 
      summary.hoursRegular + summary.hoursNight + summary.hoursSaturday +
      summary.hoursSunday + summary.hoursHoliday + summary.hoursPassenger +
      summary.hoursDriving + summary.hoursEquipment + summary.hoursLeave +
      summary.hoursMedicalLeave;
    
    summary.totalPayableHours = 
      summary.payableRegular + summary.payableNight + summary.payableSaturday +
      summary.payableSundayHoliday;
  });

  // Creare Excel cu formatare
  const wb = XLSX.utils.book_new();

  // Sheet 1: Rezumat Salarizare
  const summaryData = Array.from(employeeSummaries.values()).map(s => ({
    'Angajat': s.employeeName,
    'Zile Lucrate': s.daysWorked,
    'Total Ore Lucrate': formatRomanianNumber(s.totalHours),
    'Ore Regulate (1.0x)': formatRomanianNumber(s.hoursRegular),
    'Ore Noapte (1.25x)': formatRomanianNumber(s.hoursNight),
    'Ore Sâmbătă (1.5x)': formatRomanianNumber(s.hoursSaturday),
    'Ore Dum/Sârb (2.0x)': formatRomanianNumber(s.hoursSunday + s.hoursHoliday),
    'Ore Pasager': formatRomanianNumber(s.hoursPassenger),
    'Ore Condus': formatRomanianNumber(s.hoursDriving),
    'Ore Utilaj': formatRomanianNumber(s.hoursEquipment),
    'Ore CO': formatRomanianNumber(s.hoursLeave),
    'Ore CM': formatRomanianNumber(s.hoursMedicalLeave),
    '---': '---',
    'Ore Plătibile Regulate': formatRomanianNumber(s.payableRegular),
    'Ore Plătibile Noapte': formatRomanianNumber(s.payableNight),
    'Ore Plătibile Sâmbătă': formatRomanianNumber(s.payableSaturday),
    'Ore Plătibile Dum/Sârb': formatRomanianNumber(s.payableSundayHoliday),
    'TOTAL ORE PLĂTIBILE': formatRomanianNumber(s.totalPayableHours),
  }));

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary['!cols'] = [
    { wch: 25 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
    { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 10 }, { wch: 10 }, { wch: 5 }, { wch: 20 }, { wch: 20 },
    { wch: 20 }, { wch: 20 }, { wch: 20 }
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Rezumat Salarizare');

  // Sheet 2: Detalii zilnice
  const detailsData = filteredData.map(entry => ({
    'Angajat': entry.profiles?.full_name || entry.profiles?.username || 'Unknown',
    'Data': new Date(entry.work_date).toLocaleDateString('ro-RO'),
    'Ore Zi': formatRomanianNumber(entry.hours_regular),
    'Ore Noapte': formatRomanianNumber(entry.hours_night),
    'Ore Sâmbătă': formatRomanianNumber(entry.hours_saturday),
    'Ore Duminică': formatRomanianNumber(entry.hours_sunday),
    'Ore Sărbători': formatRomanianNumber(entry.hours_holiday),
    'Ore Pasager': formatRomanianNumber(entry.hours_passenger),
    'Ore Condus': formatRomanianNumber(entry.hours_driving),
    'Ore Utilaj': formatRomanianNumber(entry.hours_equipment),
    'CO': formatRomanianNumber(entry.hours_leave),
    'CM': formatRomanianNumber(entry.hours_medical_leave),
    'Observații': entry.notes || ''
  }));

  const wsDetails = XLSX.utils.json_to_sheet(detailsData);
  wsDetails['!cols'] = [
    { wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 8 }, { wch: 8 }, { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(wb, wsDetails, 'Detalii Zilnice');

  // Download
  const filename = selectedEmployeeId
    ? `Raport_${employeeSummaries.get(selectedEmployeeId)?.employeeName}_${monthName.replace(' ', '_')}.xlsx`
    : `Raport_Salarizare_${monthName.replace(' ', '_')}.xlsx`;
  
  XLSX.writeFile(wb, filename);
};
