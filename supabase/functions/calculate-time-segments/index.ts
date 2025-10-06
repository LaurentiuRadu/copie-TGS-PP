import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TimesheetEntry {
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
  notes: string | null;
}

interface Shift {
  startTime: string;
  endTime: string;
  employeeId: string;
  notes?: string;
  shiftType?: string; // condus, pasager, utilaj, normal
}

/**
 * Găsește următorul moment critic de segmentare (00:00, 06:00, 22:00)
 */
function getNextCriticalTime(currentTime: Date): Date {
  const result = new Date(currentTime);
  const currentHour = result.getHours();
  const currentMinute = result.getMinutes();
  
  // Dacă suntem înainte de 06:00, mergi la 06:00 aceeași zi
  if (currentHour < 6 || (currentHour === 6 && currentMinute === 0)) {
    result.setHours(6, 0, 0, 0);
    return result;
  }
  
  // Dacă suntem între 06:00 și 22:00, mergi la 22:00 aceeași zi
  if (currentHour < 22 || (currentHour === 22 && currentMinute === 0)) {
    result.setHours(22, 0, 0, 0);
    return result;
  }
  
  // Dacă suntem după 22:00, mergi la 00:00 ziua următoare
  result.setDate(result.getDate() + 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Verifică dacă o dată este sărbătoare legală românească
 */
function isLegalHoliday(date: Date, holidayDates: Set<string>): boolean {
  const dateStr = date.toISOString().split('T')[0];
  return holidayDates.has(dateStr);
}

/**
 * Determină tipul de ore bazat pe ziua săptămânii și interval orar
 * Conform pseudo-cod:
 * - Sărbătoare 06:01 → 24:00 = hours_holiday (2.0x)
 * - Sărbătoare 00:00 → 06:00 = hours_night (1.25x)
 * - Sâmbătă 06:01 → Duminică 06:00 = hours_saturday (1.50x)
 * - Duminică 06:01 → 24:00 = hours_sunday (2.0x)
 * - Noapte 22:01 → 06:00 = hours_night (1.25x)
 * - Normal 06:01 → 22:00 = hours_regular (1.0x)
 */
function determineHoursType(
  segmentStart: Date,
  segmentEnd: Date,
  holidayDates: Set<string>
): string {
  const dayOfWeek = segmentStart.getDay(); // 0=Duminică, 1=Luni, ..., 6=Sâmbătă
  const startHour = segmentStart.getHours();
  const startMinute = segmentStart.getMinutes();
  
  // Verifică dacă este sărbătoare legală
  if (isLegalHoliday(segmentStart, holidayDates)) {
    // Sărbătoare 06:01 → 24:00
    if (startHour > 6 || (startHour === 6 && startMinute >= 1)) {
      return 'hours_holiday';
    }
    // Sărbătoare 00:00 → 06:00
    if (startHour < 6 || (startHour === 6 && startMinute === 0)) {
      return 'hours_night';
    }
  }
  
  // SÂMBĂTĂ-DUMINICĂ (Sâmbătă 06:01 → Duminică 06:00)
  if (
    (dayOfWeek === 6 && (startHour > 6 || (startHour === 6 && startMinute >= 1))) || // Sâmbătă de la 06:01
    (dayOfWeek === 0 && (startHour < 6 || (startHour === 6 && startMinute === 0)))  // Duminică până la 06:00
  ) {
    return 'hours_saturday';
  }
  
  // DUMINICĂ (Duminică 06:01 → 24:00)
  if (dayOfWeek === 0 && (startHour > 6 || (startHour === 6 && startMinute >= 1))) {
    return 'hours_sunday';
  }
  
  // NOAPTE (22:01 → 06:00) - oricare zi (Luni-Vineri)
  if (startHour >= 22 && (startHour > 22 || startMinute >= 1)) {
    return 'hours_night';
  }
  
  if (startHour < 6 || (startHour === 6 && startMinute === 0)) {
    return 'hours_night';
  }
  
  // ORE NORMALE (06:01 → 22:00) - Luni-Vineri
  return 'hours_regular';
}

/**
 * Segmentează o tură de lucru în pontaje zilnice separate
 * ✅ LOGICĂ NOUĂ: Respectă tipul de tură (Condus/Pasager/Utilaj/Normal)
 */
function segmentShiftIntoTimesheets(
  shift: Shift,
  holidayDates: Set<string>
): TimesheetEntry[] {
  const start = new Date(shift.startTime);
  const end = new Date(shift.endTime);
  const timesheets: TimesheetEntry[] = [];
  
  // ✅ Detectează tipul de tură din notes (default: 'normal')
  const shiftType = shift.shiftType || 'normal';
  console.log(`[Segment] Processing shift type: ${shiftType}`);
  
  let currentSegmentStart = new Date(start);
  
  // Procesează tura în segmente până la sfârșit
  while (currentSegmentStart < end) {
    // Determină sfârșitul acestui segment
    const nextCriticalTime = getNextCriticalTime(currentSegmentStart);
    const currentSegmentEnd = nextCriticalTime < end ? nextCriticalTime : end;
    
    // Calculează ore pentru acest segment
    const hoursInSegment = (currentSegmentEnd.getTime() - currentSegmentStart.getTime()) / 3600000;
    
    // ✅ LOGICĂ NOUĂ: Determină coloana bazat pe tipul de tură
    let hoursType: string;
    
    if (shiftType === 'condus') {
      hoursType = 'hours_driving';  // Toate orele → Condus
      console.log(`[Segment] → hours_driving (${hoursInSegment}h)`);
    } else if (shiftType === 'pasager') {
      hoursType = 'hours_passenger';  // Toate orele → Pasager
      console.log(`[Segment] → hours_passenger (${hoursInSegment}h)`);
    } else if (shiftType === 'utilaj') {
      hoursType = 'hours_equipment';  // Toate orele → Utilaj
      console.log(`[Segment] → hours_equipment (${hoursInSegment}h)`);
    } else {
      // Doar pentru "normal" → fragmentare bazată pe timp
      hoursType = determineHoursType(currentSegmentStart, currentSegmentEnd, holidayDates);
      console.log(`[Segment] → ${hoursType} (${hoursInSegment}h) [time-based]`);
    }
    
    // Găsește sau creează pontaj pentru această zi
    const workDate = currentSegmentStart.toISOString().split('T')[0];
    let existingTimesheet = timesheets.find(t => t.work_date === workDate);
    
    if (!existingTimesheet) {
      existingTimesheet = {
        employee_id: shift.employeeId,
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
        notes: shift.notes || null
      };
      timesheets.push(existingTimesheet);
    }
    
    // Adaugă orele la tipul corect
    (existingTimesheet as any)[hoursType] += hoursInSegment;
    
    // Avansează la următorul segment
    currentSegmentStart = new Date(currentSegmentEnd);
  }
  
  // Rotunjește toate orele la 2 zecimale
  timesheets.forEach(t => {
    t.hours_regular = Math.round(t.hours_regular * 100) / 100;
    t.hours_night = Math.round(t.hours_night * 100) / 100;
    t.hours_saturday = Math.round(t.hours_saturday * 100) / 100;
    t.hours_sunday = Math.round(t.hours_sunday * 100) / 100;
    t.hours_holiday = Math.round(t.hours_holiday * 100) / 100;
  });
  
  return timesheets;
}

/**
 * Validează un pontaj înainte de trimitere
 */
function validateTimesheet(timesheet: TimesheetEntry): string[] {
  const errors: string[] = [];
  
  // 1. Total ore/zi <= 24h
  const totalHours = 
    timesheet.hours_regular +
    timesheet.hours_night +
    timesheet.hours_saturday +
    timesheet.hours_sunday +
    timesheet.hours_holiday +
    timesheet.hours_passenger +
    timesheet.hours_driving +
    timesheet.hours_equipment +
    timesheet.hours_leave;
  
  if (totalHours > 24) {
    errors.push(`Total ore (${totalHours}h) depășește 24h pentru ${timesheet.work_date}`);
  }
  
  // 2. work_date nu în viitor
  const today = new Date().toISOString().split('T')[0];
  if (timesheet.work_date > today) {
    errors.push(`Data ${timesheet.work_date} este în viitor`);
  }
  
  // 3. Toate orele >= 0
  const hourFields: (keyof TimesheetEntry)[] = [
    'hours_regular', 'hours_night', 'hours_saturday', 
    'hours_sunday', 'hours_holiday', 'hours_passenger',
    'hours_driving', 'hours_equipment', 'hours_leave'
  ];
  
  hourFields.forEach(field => {
    const value = timesheet[field];
    if (typeof value === 'number' && value < 0) {
      errors.push(`${field} nu poate fi negativ`);
    }
  });
  
  return errors;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { user_id, clock_in_time, clock_out_time, notes } = await req.json();

    console.log('Processing shift:', { user_id, clock_in_time, clock_out_time, notes });

    // ✅ Extrage tipul de tură din notes (ex: "Tip: Condus")
    const shiftTypeMatch = notes?.match(/Tip:\s*(Condus|Pasager|Normal|Utilaj)/i);
    const shiftType = shiftTypeMatch ? shiftTypeMatch[1].toLowerCase() : 'normal';
    console.log(`[Main] Detected shift type: ${shiftType}`);

    // Fetch holidays
    const { data: holidays } = await supabase
      .from('holidays')
      .select('date');
    
    const holidayDates = new Set((holidays || []).map(h => h.date));

    // Create shift object
    const shift: Shift = {
      startTime: clock_in_time,
      endTime: clock_out_time,
      employeeId: user_id,
      notes,
      shiftType  // ✅ Pasează tipul de tură
    };

    // Segment shift into daily timesheets
    const timesheets = segmentShiftIntoTimesheets(shift, holidayDates);

    // Validate all timesheets
    const allErrors: string[] = [];
    timesheets.forEach(timesheet => {
      const errors = validateTimesheet(timesheet);
      allErrors.push(...errors);
    });

    if (allErrors.length > 0) {
      console.error('Validation errors:', allErrors);
      return new Response(
        JSON.stringify({ error: 'Erori de validare', details: allErrors }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Insert or update timesheets in database
    for (const timesheet of timesheets) {
      const { error: upsertError } = await supabase
        .from('daily_timesheets')
        .upsert(timesheet, {
          onConflict: 'employee_id,work_date'
        });

      if (upsertError) {
        console.error('Error upserting timesheet:', upsertError);
        throw upsertError;
      }
    }

    console.log('Successfully created/updated timesheets:', timesheets.length);

    return new Response(
      JSON.stringify({ 
        success: true, 
        timesheets,
        message: `Procesate ${timesheets.length} pontaje zilnice`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});