const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Ora curentă UTC (server)
    const nowUTC = new Date();
    
    // Calculează offsetul României (UTC+2 sau UTC+3 pentru DST)
    const getRomaniaOffset = (date: Date): number => {
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      
      // DST activ: martie (după ultimul duminică) până octombrie (înainte de ultimul duminică)
      if (month > 2 && month < 9) return 3 * 60 * 60 * 1000; // UTC+3
      if (month < 2 || month > 9) return 2 * 60 * 60 * 1000; // UTC+2
      
      // Pentru martie și octombrie, verificăm data exactă
      const lastSundayMarch = new Date(Date.UTC(year, 2, 31));
      lastSundayMarch.setUTCDate(31 - lastSundayMarch.getUTCDay());
      
      const lastSundayOct = new Date(Date.UTC(year, 9, 31));
      lastSundayOct.setUTCDate(31 - lastSundayOct.getUTCDay());
      
      if (month === 2 && date >= lastSundayMarch) return 3 * 60 * 60 * 1000;
      if (month === 9 && date < lastSundayOct) return 3 * 60 * 60 * 1000;
      
      return 2 * 60 * 60 * 1000;
    };
    
    const offset = getRomaniaOffset(nowUTC);
    const romaniaTime = new Date(nowUTC.getTime() + offset);
    
    // Format pentru AI: human-readable + ISO
    const formatted = {
      utc: nowUTC.toISOString(),
      romania_iso: romaniaTime.toISOString(),
      romania_display: romaniaTime.toISOString().replace('T', ' ').substring(0, 19),
      timezone: offset === 3 * 60 * 60 * 1000 ? 'UTC+3 (DST)' : 'UTC+2',
      timestamp: romaniaTime.getTime()
    };

    console.log('[get-romania-time] ✅ Current time:', formatted);

    return new Response(
      JSON.stringify(formatted),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('[get-romania-time] ❌ Error:', error);
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
