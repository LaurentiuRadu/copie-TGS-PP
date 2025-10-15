import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuditResult {
  time_entry_id: string;
  username: string;
  clock_in_time: string;
  clock_out_time: string;
  first_segment_start: string | null;
  last_segment_end: string | null;
  diff_start_sec: number;
  diff_end_sec: number;
  status: 'ok' | 'mismatch';
  fixed: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      start_date, 
      end_date, 
      dry_run = true, 
      fix = false 
    } = await req.json();
    
    console.log(`[Audit] Mode: ${dry_run ? 'DRY RUN' : 'LIVE'} | Fix: ${fix} | Range: ${start_date} → ${end_date}`);

    // Fetch all time entries in date range with their segments
    const { data: entries, error } = await supabase
      .from('time_entries')
      .select(`
        id,
        user_id,
        clock_in_time,
        clock_out_time,
        profiles!inner(username),
        time_entry_segments(start_time, end_time)
      `)
      .not('clock_out_time', 'is', null)
      .gte('clock_in_time', `${start_date}T00:00:00Z`)
      .lte('clock_in_time', `${end_date}T23:59:59Z`)
      .order('clock_in_time', { ascending: true });

    if (error) throw error;

    const results: AuditResult[] = [];
    let mismatchCount = 0;
    let fixedCount = 0;

    for (const entry of entries || []) {
      const segments = entry.time_entry_segments || [];
      
      if (segments.length === 0) {
        console.warn(`[Audit] Entry ${entry.id} has NO segments - skipping`);
        continue;
      }

      // Sort segments by start_time
      segments.sort((a: any, b: any) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );

      const firstSegment = segments[0];
      const lastSegment = segments[segments.length - 1];

      const clockInUTC = new Date(entry.clock_in_time);
      const clockOutUTC = new Date(entry.clock_out_time);
      const firstStartUTC = new Date(firstSegment.start_time);
      const lastEndUTC = new Date(lastSegment.end_time);

      const diffStartSec = (firstStartUTC.getTime() - clockInUTC.getTime()) / 1000;
      const diffEndSec = (lastEndUTC.getTime() - clockOutUTC.getTime()) / 1000;

      const isMismatch = Math.abs(diffStartSec) > 1 || Math.abs(diffEndSec) > 1;

      const result: AuditResult = {
        time_entry_id: entry.id,
        username: (entry as any).profiles?.username || 'unknown',
        clock_in_time: entry.clock_in_time,
        clock_out_time: entry.clock_out_time,
        first_segment_start: firstSegment.start_time,
        last_segment_end: lastSegment.end_time,
        diff_start_sec: Math.round(diffStartSec),
        diff_end_sec: Math.round(diffEndSec),
        status: isMismatch ? 'mismatch' : 'ok',
        fixed: false
      };

      if (isMismatch) {
        mismatchCount++;
        console.warn(`[Audit] ⚠️ Mismatch for ${result.username} (${entry.id}): start ${diffStartSec}s, end ${diffEndSec}s`);

        // Apply fix if requested and not dry_run
        if (fix && !dry_run) {
          try {
            // Invoke calculate-time-segments to recalculate
            const { error: recalcError } = await supabase.functions.invoke('calculate-time-segments', {
              body: {
                user_id: entry.user_id,
                time_entry_id: entry.id,
                clock_in_time: entry.clock_in_time,
                clock_out_time: entry.clock_out_time,
                notes: null
              }
            });

            if (recalcError) {
              console.error(`[Audit] ❌ Failed to fix ${entry.id}:`, recalcError);
            } else {
              result.fixed = true;
              fixedCount++;
              console.log(`[Audit] ✅ Fixed ${entry.id}`);
            }
          } catch (fixError) {
            console.error(`[Audit] ❌ Exception fixing ${entry.id}:`, fixError);
          }
        }
      }

      results.push(result);
    }

    const summary = {
      total_entries: results.length,
      ok_count: results.filter(r => r.status === 'ok').length,
      mismatch_count: mismatchCount,
      fixed_count: fixedCount,
      dry_run,
      fix,
      date_range: { start_date, end_date }
    };

    console.log(`[Audit] Summary:`, summary);

    return new Response(
      JSON.stringify({
        summary,
        results: results.filter(r => r.status === 'mismatch') // Only return mismatches for brevity
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Audit] Error:', error);
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
