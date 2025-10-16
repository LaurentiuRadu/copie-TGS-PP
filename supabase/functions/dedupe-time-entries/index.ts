import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DedupeRequest {
  team_id: string;
  work_date: string; // YYYY-MM-DD
}

interface DuplicateGroup {
  user_id: string;
  entries: Array<{
    id: string;
    clock_in_time: string;
    clock_out_time: string;
    notes: string | null;
  }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { team_id, work_date }: DedupeRequest = await req.json();

    console.log(`[Dedupe] Starting for team: ${team_id}, date: ${work_date}`);

    // Step 1: Get user IDs from weekly_schedules for this team/week
    const workDateObj = new Date(work_date);
    const dayOfWeek = workDateObj.getDay() === 0 ? 7 : workDateObj.getDay();
    
    // Calculate week_start_date (Monday of the week)
    const weekStartDate = new Date(workDateObj);
    weekStartDate.setDate(workDateObj.getDate() - (dayOfWeek - 1));
    const weekStartString = weekStartDate.toISOString().split('T')[0];

    const { data: schedules, error: schedError } = await supabase
      .from('weekly_schedules')
      .select('user_id')
      .eq('team_id', team_id)
      .eq('week_start_date', weekStartString)
      .eq('day_of_week', dayOfWeek);

    if (schedError) throw schedError;
    if (!schedules || schedules.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No users in this team/day',
          duplicates_removed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userIds = schedules.map(s => s.user_id);
    console.log(`[Dedupe] Found ${userIds.length} users in team`);

    // Step 2: Fetch time entries for this date
    const nextDay = new Date(workDateObj);
    nextDay.setDate(nextDay.getDate() + 1);

    const { data: entries, error: entriesError } = await supabase
      .from('time_entries')
      .select('id, user_id, clock_in_time, clock_out_time, notes')
      .in('user_id', userIds)
      .gte('clock_in_time', workDateObj.toISOString())
      .lt('clock_in_time', nextDay.toISOString())
      .order('clock_in_time', { ascending: true });

    if (entriesError) throw entriesError;
    if (!entries || entries.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No time entries found for this date',
          duplicates_removed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Dedupe] Found ${entries.length} time entries`);

    // Step 3: Group entries by user and time interval (±1 min tolerance)
    const duplicateGroups: Map<string, DuplicateGroup[]> = new Map();

    for (const userId of userIds) {
      const userEntries = entries.filter(e => e.user_id === userId);
      if (userEntries.length <= 1) continue;

      const groups: DuplicateGroup[] = [];
      
      for (const entry of userEntries) {
        const clockIn = new Date(entry.clock_in_time);
        const clockOut = entry.clock_out_time ? new Date(entry.clock_out_time) : null;
        
        // Find if this entry belongs to an existing group (±1 minute)
        let foundGroup = false;
        for (const group of groups) {
          const firstEntry = group.entries[0];
          const firstClockIn = new Date(firstEntry.clock_in_time);
          const firstClockOut = firstEntry.clock_out_time ? new Date(firstEntry.clock_out_time) : null;
          
          const clockInDiff = Math.abs(clockIn.getTime() - firstClockIn.getTime());
          const clockOutDiff = clockOut && firstClockOut 
            ? Math.abs(clockOut.getTime() - firstClockOut.getTime())
            : 0;
          
          // Tolerance: ±60 seconds (1 minute)
          if (clockInDiff <= 60000 && clockOutDiff <= 60000) {
            group.entries.push(entry);
            foundGroup = true;
            break;
          }
        }
        
        if (!foundGroup) {
          groups.push({
            user_id: userId,
            entries: [entry]
          });
        }
      }
      
      // Keep only groups with duplicates
      const duplicates = groups.filter(g => g.entries.length > 1);
      if (duplicates.length > 0) {
        duplicateGroups.set(userId, duplicates);
      }
    }

    if (duplicateGroups.size === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No duplicates found',
          duplicates_removed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Dedupe] Found duplicates for ${duplicateGroups.size} users`);

    // Step 4: For each duplicate group, keep one and delete others
    let totalRemoved = 0;
    const removalDetails: Array<{ user_id: string; removed: number }> = [];

    for (const [userId, groups] of duplicateGroups.entries()) {
      let userRemoved = 0;
      
      for (const group of groups) {
        // Priority: keep "Normal" type (notes don't contain "Tip:"), otherwise keep first
        let keepEntry = group.entries.find(e => !e.notes || !e.notes.includes('Tip:'));
        if (!keepEntry) keepEntry = group.entries[0];
        
        const toDelete = group.entries.filter(e => e.id !== keepEntry.id);
        
        console.log(`[Dedupe] User ${userId}: keeping ${keepEntry.id}, removing ${toDelete.length} duplicates`);
        
        // Delete segments first
        for (const entry of toDelete) {
          const { error: segError } = await supabase
            .from('time_entry_segments')
            .delete()
            .eq('time_entry_id', entry.id);
          
          if (segError) {
            console.error(`[Dedupe] Failed to delete segments for ${entry.id}:`, segError);
          }
        }
        
        // Delete time entries
        const { error: deleteError } = await supabase
          .from('time_entries')
          .delete()
          .in('id', toDelete.map(e => e.id));
        
        if (deleteError) {
          console.error(`[Dedupe] Failed to delete entries:`, deleteError);
        } else {
          userRemoved += toDelete.length;
        }
      }
      
      if (userRemoved > 0) {
        removalDetails.push({ user_id: userId, removed: userRemoved });
        totalRemoved += userRemoved;
      }
    }

    // Step 5: Recalculate segments for kept entries
    console.log(`[Dedupe] Recalculating segments for affected users`);
    
    for (const [userId, groups] of duplicateGroups.entries()) {
      for (const group of groups) {
        const keepEntry = group.entries.find(e => !e.notes || !e.notes.includes('Tip:')) || group.entries[0];
        
        try {
          await supabase.functions.invoke('calculate-time-segments', {
            body: { time_entry_id: keepEntry.id }
          });
        } catch (error) {
          console.error(`[Dedupe] Failed to recalculate segments for ${keepEntry.id}:`, error);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Eliminated ${totalRemoved} duplicate entries for ${removalDetails.length} users`,
        duplicates_removed: totalRemoved,
        details: removalDetails
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Dedupe] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
