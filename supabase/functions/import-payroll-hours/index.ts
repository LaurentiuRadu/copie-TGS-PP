import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PayrollRow {
  angajat: string;
  data: string;
  tipOre: string;
  oreLucrate: string;
}

interface GroupedEntry {
  employee_id: string;
  employee_name: string;
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
}

const hourTypeMapping: Record<string, keyof Omit<GroupedEntry, 'employee_id' | 'employee_name' | 'work_date'>> = {
  'Ore Zi': 'hours_regular',
  'Ore noapte': 'hours_night',
  'Ore sambata': 'hours_saturday',
  'Ore duminica': 'hours_sunday',
  'Ore sarbatori legale': 'hours_holiday',
  'Ore pasager': 'hours_passenger',
  'Ore condus': 'hours_driving',
  'Ore utilaj': 'hours_equipment',
  'Ore CO': 'hours_leave',
  'Ore CM': 'hours_medical_leave',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[import-payroll-hours] Starting import...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get CSV content from request
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      throw new Error('No file provided');
    }

    console.log(`[import-payroll-hours] Processing file: ${file.name}`);

    // Read CSV content
    let csvContent = await file.text();
    
    // Remove BOM if present
    if (csvContent.charCodeAt(0) === 0xFEFF) {
      csvContent = csvContent.slice(1);
    }

    // Parse CSV
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headers = lines[0].split(';').map(h => h.trim());
    
    console.log(`[import-payroll-hours] CSV headers: ${headers.join(', ')}`);
    console.log(`[import-payroll-hours] Total lines: ${lines.length - 1}`);

    // Validate headers
    const expectedHeaders = ['Angajat', 'Data', 'Tip Ore', 'Ore Lucrate'];
    const headersValid = expectedHeaders.every(h => 
      headers.some(csvH => csvH.includes(h))
    );

    if (!headersValid) {
      throw new Error(`Invalid CSV format. Expected headers: ${expectedHeaders.join(', ')}`);
    }

    // Parse rows
    const rows: PayrollRow[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(';').map(v => v.trim());
      
      if (values.length < 4) {
        errors.push(`Row ${i + 1}: Invalid format (expected 4 columns, got ${values.length})`);
        continue;
      }

      rows.push({
        angajat: values[0],
        data: values[1],
        tipOre: values[2],
        oreLucrate: values[3],
      });
    }

    console.log(`[import-payroll-hours] Parsed ${rows.length} rows`);

    // Fetch all employees
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, username');

    if (profilesError) {
      throw new Error(`Failed to fetch employees: ${profilesError.message}`);
    }

    console.log(`[import-payroll-hours] Found ${profiles?.length || 0} employees in database`);

    // Helper function pentru matching inteligent de nume
    const normalizeString = (str: string): string => {
      return str.trim().replace(/\s+/g, ' ').toUpperCase();
    };

    const findEmployeeByName = (csvName: string): typeof profiles[0] | null => {
      if (!profiles || profiles.length === 0) return null;

      const normalizedCsvName = normalizeString(csvName);

      // 1. Încercare potrivire exactă (case-insensitive)
      let match = profiles.find(p => 
        normalizeString(p.full_name || '') === normalizedCsvName
      );
      if (match) return match;

      // 2. Încercare inversare simplă: "NUME PRENUME" <-> "PRENUME NUME"
      const csvParts = normalizedCsvName.split(' ');
      if (csvParts.length >= 2) {
        const reversed = `${csvParts.slice(1).join(' ')} ${csvParts[0]}`;
        match = profiles.find(p => 
          normalizeString(p.full_name || '') === reversed
        );
        if (match) {
          console.log(`[import-payroll-hours] ✓ Matched by name inversion: "${csvName}" -> "${match.full_name}"`);
          return match;
        }

        // 3. Încercare inversare cu prenume mijlociu: "NUME PRENUME MIJLOCIU" <-> "PRENUME MIJLOCIU NUME"
        if (csvParts.length >= 3) {
          const reversedWithMiddle = `${csvParts.slice(1).join(' ')} ${csvParts[0]}`;
          match = profiles.find(p => 
            normalizeString(p.full_name || '') === reversedWithMiddle
          );
          if (match) {
            console.log(`[import-payroll-hours] ✓ Matched by name inversion (with middle): "${csvName}" -> "${match.full_name}"`);
            return match;
          }
        }
      }

      // 4. Nu s-a găsit potrivire
      return null;
    };

    // Group entries by (employee_id, work_date)
    const groupedMap = new Map<string, GroupedEntry>();
    const employeesSet = new Set<string>();
    const employeeMatches = new Map<string, string>(); // CSV name -> DB name
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    for (const row of rows) {
      // Find employee with intelligent matching
      const employee = findEmployeeByName(row.angajat);

      if (!employee) {
        errors.push(`Employee not found: ${row.angajat}`);
        continue;
      }

      // Track successful matches
      if (!employeeMatches.has(row.angajat)) {
        employeeMatches.set(row.angajat, employee.full_name || '');
      }

      // Parse date (DD.MM.YYYY -> YYYY-MM-DD)
      const dateParts = row.data.split('.');
      if (dateParts.length !== 3) {
        errors.push(`Invalid date format for ${row.angajat}: ${row.data}`);
        continue;
      }

      const day = dateParts[0].padStart(2, '0');
      const month = dateParts[1].padStart(2, '0');
      const year = dateParts[2];
      const workDate = `${year}-${month}-${day}`;

      const parsedDate = new Date(workDate);
      if (isNaN(parsedDate.getTime())) {
        errors.push(`Invalid date for ${row.angajat}: ${row.data}`);
        continue;
      }

      if (!minDate || parsedDate < minDate) minDate = parsedDate;
      if (!maxDate || parsedDate > maxDate) maxDate = parsedDate;

      // Parse hours (7,5 -> 7.5)
      const hoursStr = row.oreLucrate.replace(',', '.');
      const hours = parseFloat(hoursStr);

      if (isNaN(hours) || hours <= 0) {
        errors.push(`Invalid hours for ${row.angajat} on ${row.data}: ${row.oreLucrate}`);
        continue;
      }

      // Map hour type
      const hourColumn = hourTypeMapping[row.tipOre];
      if (!hourColumn) {
        warnings.push(`Unknown hour type: '${row.tipOre}' - row skipped`);
        continue;
      }

      // Create group key
      const groupKey = `${employee.id}_${workDate}`;
      
      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, {
          employee_id: employee.id,
          employee_name: row.angajat,
          work_date: workDate,
          hours_regular: 0,
          hours_night: 0,
          hours_saturday: 0,
          hours_sunday: 0,
          hours_holiday: 0,
          hours_passenger: 0,
          hours_driving: 0,
          hours_equipment: 0,
          hours_leave: 0,
          hours_medical_leave: 0,
        });
      }

      const entry = groupedMap.get(groupKey)!;
      entry[hourColumn] += hours;
      employeesSet.add(row.angajat);
    }

    const groupedEntries = Array.from(groupedMap.values());
    console.log(`[import-payroll-hours] Grouped into ${groupedEntries.length} entries`);
    console.log(`[import-payroll-hours] Date range: ${minDate?.toISOString().split('T')[0]} to ${maxDate?.toISOString().split('T')[0]}`);

    if (groupedEntries.length === 0) {
      throw new Error('No valid entries to import after processing');
    }

    // Calculate hours by type
    const hoursByType = groupedEntries.reduce((acc, entry) => ({
      hours_regular: acc.hours_regular + entry.hours_regular,
      hours_night: acc.hours_night + entry.hours_night,
      hours_saturday: acc.hours_saturday + entry.hours_saturday,
      hours_sunday: acc.hours_sunday + entry.hours_sunday,
      hours_holiday: acc.hours_holiday + entry.hours_holiday,
      hours_passenger: acc.hours_passenger + entry.hours_passenger,
      hours_driving: acc.hours_driving + entry.hours_driving,
      hours_equipment: acc.hours_equipment + entry.hours_equipment,
      hours_leave: acc.hours_leave + entry.hours_leave,
      hours_medical_leave: acc.hours_medical_leave + entry.hours_medical_leave,
    }), {
      hours_regular: 0,
      hours_night: 0,
      hours_saturday: 0,
      hours_sunday: 0,
      hours_holiday: 0,
      hours_passenger: 0,
      hours_driving: 0,
      hours_equipment: 0,
      hours_leave: 0,
      hours_medical_leave: 0,
    });

    // Cleanup: Delete existing time_entries in date range
    const minDateStr = minDate!.toISOString().split('T')[0];
    const maxDateStr = maxDate!.toISOString().split('T')[0];

    console.log(`[import-payroll-hours] Deleting existing time_entries from ${minDateStr} to ${maxDateStr}...`);

    const { error: deleteEntriesError, count: deletedEntriesCount } = await supabase
      .from('time_entries')
      .delete({ count: 'exact' })
      .gte('clock_in_time', `${minDateStr}T00:00:00+00:00`)
      .lte('clock_in_time', `${maxDateStr}T23:59:59+00:00`);

    if (deleteEntriesError) {
      console.error('[import-payroll-hours] Error deleting time_entries:', deleteEntriesError);
    } else {
      console.log(`[import-payroll-hours] Deleted ${deletedEntriesCount || 0} time_entries`);
    }

    // Cleanup: Delete existing daily_timesheets in date range
    console.log(`[import-payroll-hours] Deleting existing daily_timesheets from ${minDateStr} to ${maxDateStr}...`);

    const { error: deleteTimesheetsError, count: deletedTimesheetsCount } = await supabase
      .from('daily_timesheets')
      .delete({ count: 'exact' })
      .gte('work_date', minDateStr)
      .lte('work_date', maxDateStr);

    if (deleteTimesheetsError) {
      console.error('[import-payroll-hours] Error deleting daily_timesheets:', deleteTimesheetsError);
    } else {
      console.log(`[import-payroll-hours] Deleted ${deletedTimesheetsCount || 0} daily_timesheets`);
    }

    // Insert new timesheets
    console.log(`[import-payroll-hours] Inserting ${groupedEntries.length} new timesheets...`);

    const timesheetsToInsert = groupedEntries.map(entry => ({
      employee_id: entry.employee_id,
      work_date: entry.work_date,
      hours_regular: entry.hours_regular,
      hours_night: entry.hours_night,
      hours_saturday: entry.hours_saturday,
      hours_sunday: entry.hours_sunday,
      hours_holiday: entry.hours_holiday,
      hours_passenger: entry.hours_passenger,
      hours_driving: entry.hours_driving,
      hours_equipment: entry.hours_equipment,
      hours_leave: entry.hours_leave,
      hours_medical_leave: entry.hours_medical_leave,
      notes: `[IMPORT] Payroll ${minDateStr} - ${maxDateStr}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from('daily_timesheets')
      .insert(timesheetsToInsert);

    if (insertError) {
      throw new Error(`Failed to insert timesheets: ${insertError.message}`);
    }

    console.log('[import-payroll-hours] ✅ Import completed successfully');

    // Prepare employee matches info
    const matchInfo = Array.from(employeeMatches.entries())
      .filter(([csv, db]) => {
        const norm1 = csv.trim().replace(/\s+/g, ' ').toUpperCase();
        const norm2 = db.trim().replace(/\s+/g, ' ').toUpperCase();
        return norm1 !== norm2;
      })
      .map(([csv, db]) => ({ csv_name: csv, matched_db_name: db }));

    if (matchInfo.length > 0) {
      console.log(`[import-payroll-hours] ℹ️ Applied ${matchInfo.length} name normalizations/inversions`);
    }

    // Prepare response
    const response = {
      success: true,
      imported_rows: rows.length,
      grouped_entries: groupedEntries.length,
      employees_count: employeesSet.size,
      employees_list: Array.from(employeesSet).sort(),
      employee_matches: matchInfo.length > 0 ? matchInfo : undefined,
      date_range: {
        start: minDateStr,
        end: maxDateStr,
      },
      hours_by_type: hoursByType,
      deleted_entries: {
        time_entries: deletedEntriesCount || 0,
        daily_timesheets: deletedTimesheetsCount || 0,
      },
      errors: errors.length > 0 ? errors.slice(0, 20) : [], // Limit to 20 errors
      warnings: warnings.length > 0 ? warnings.slice(0, 10) : [], // Limit to 10 warnings
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[import-payroll-hours] ❌ Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
