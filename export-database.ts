/**
 * Script pentru exportul complet al bazei de date
 * Folosește Edge Function existentă: admin-full-database-export
 *
 * Rulare: npx tsx export-database.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Citire credentials din .env
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ ERROR: Missing SUPABASE credentials in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function exportDatabase() {
  console.log('🔐 Starting database export...\n');

  // PASUL 1: Autentificare
  console.log('📝 Please provide admin credentials:');
  console.log('   Username format: laurentiu.radu');
  console.log('   Email will be: laurentiu.radu@company.local\n');

  // În producție, ar trebui să citești din prompt sau env var
  // Pentru siguranță, NU hardcode-zi parola aici!
  const email = 'laurentiu.radu@company.local';
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    console.error('❌ ERROR: Set ADMIN_PASSWORD environment variable');
    console.error('   Example: ADMIN_PASSWORD="your-password" npx tsx export-database.ts');
    process.exit(1);
  }

  console.log(`🔑 Authenticating as: ${email}`);

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    console.error('❌ Authentication failed:', authError.message);
    console.error('\n💡 TIP: Make sure you\'re using the correct password');
    process.exit(1);
  }

  console.log('✅ Authenticated successfully!');
  console.log(`   User ID: ${authData.user.id}`);
  console.log(`   Email: ${authData.user.email}\n`);

  // PASUL 2: Verificare rol admin
  console.log('🔍 Verifying admin role...');

  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', authData.user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (roleError || !roleData) {
    console.error('❌ User is not an admin!');
    await supabase.auth.signOut();
    process.exit(1);
  }

  console.log('✅ Admin role confirmed!\n');

  // PASUL 3: Invocare Edge Function pentru export
  console.log('📦 Invoking admin-full-database-export function...');
  console.log('   This may take 10-30 seconds...\n');

  const { data: exportData, error: exportError } = await supabase.functions.invoke(
    'admin-full-database-export',
    {
      headers: {
        Authorization: `Bearer ${authData.session.access_token}`,
      },
    }
  );

  if (exportError) {
    console.error('❌ Export failed:', exportError);
    await supabase.auth.signOut();
    process.exit(1);
  }

  console.log('✅ Export completed successfully!\n');

  // PASUL 4: Salvare date local
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `database-export-${timestamp}.json`;
  const filepath = path.join(process.cwd(), filename);

  console.log(`💾 Saving export to: ${filename}`);

  fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2), 'utf8');

  console.log('✅ Export saved successfully!\n');

  // PASUL 5: Afișare statistici
  if (exportData.statistics) {
    console.log('📊 Export Statistics:');
    console.log(`   Total Profiles: ${exportData.statistics.total_profiles}`);
    console.log(`   Total Time Entries: ${exportData.statistics.total_time_entries}`);
    console.log(`   Total Daily Timesheets: ${exportData.statistics.total_daily_timesheets}`);
    console.log(`   Total Schedules: ${exportData.statistics.total_schedules}`);
    console.log(`   Total Vacation Requests: ${exportData.statistics.total_vacation_requests}`);
  }

  console.log('\n📋 Export includes 34+ tables:');
  if (exportData.database) {
    const tables = Object.keys(exportData.database);
    tables.forEach(table => {
      const count = exportData.database[table]?.length || 0;
      console.log(`   - ${table}: ${count} rows`);
    });
  }

  // PASUL 6: Logout
  console.log('\n🔓 Signing out...');
  await supabase.auth.signOut();

  console.log('\n✅ Database export completed successfully!');
  console.log(`📁 File: ${filename}`);
  console.log(`📊 Size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB\n`);
}

// Rulare
exportDatabase().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
