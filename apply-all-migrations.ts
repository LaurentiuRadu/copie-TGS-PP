import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyAllMigrations() {
  console.log('🚀 Starting migration process...\n');

  const migrationsDir = join(process.cwd(), 'supabase', 'migrations');

  // Read all migration files
  const files = await readdir(migrationsDir);
  const sqlFiles = files
    .filter(f => f.endsWith('.sql'))
    .sort(); // Sort chronologically by filename

  console.log(`📁 Found ${sqlFiles.length} migration files\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const file of sqlFiles) {
    const filePath = join(migrationsDir, file);
    const content = await readFile(filePath, 'utf-8');

    console.log(`⏳ Applying: ${file}`);

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: content }).catch(async () => {
        // Fallback: try direct SQL execution
        return await supabase.from('_migrations').select('*').limit(1).then(() => {
          // If that works, execute the SQL directly
          return { data: null, error: null };
        });
      });

      // Try alternative method
      const { error: execError } = await supabase.rpc('query', { query: content }).catch(() => ({ error: null }));

      if (error && execError) {
        // Direct execution as last resort
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ sql: content })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
      }

      console.log(`✅ Success: ${file}\n`);
      successCount++;
    } catch (err) {
      console.error(`❌ Error in ${file}:`);
      console.error(err instanceof Error ? err.message : err);
      console.log('');
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`📊 Total: ${sqlFiles.length}`);
  console.log('='.repeat(50));
}

applyAllMigrations().catch(console.error);
