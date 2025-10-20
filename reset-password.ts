/**
 * Script pentru resetarea parolei adminului
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

const NEW_PASSWORD = process.env.NEW_PASSWORD || 'Maciuca2016!';
const ADMIN_EMAIL = 'laurentiu.radu@tgservices.ro';

async function resetPassword() {
  console.log('🔐 Resetare parolă admin...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log(`📧 Email: ${ADMIN_EMAIL}`);
  console.log(`🔑 Parolă nouă: ${NEW_PASSWORD}\n`);

  // Încercare autentificare pentru a obține user ID
  const { data: signInData } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: 'Maciuca2016!', // parola veche
  });

  if (!signInData?.user) {
    console.error('❌ Nu s-a putut autentifica cu parola veche');
    console.log('\n💡 Verifică dacă parola veche este corectă sau dacă contul există.');
    process.exit(1);
  }

  console.log('✅ Autentificat cu succes!');
  console.log(`   User ID: ${signInData.user.id}\n`);

  // Apel Edge Function pentru reset
  const { data, error } = await supabase.functions.invoke('reset-user-password', {
    headers: {
      Authorization: `Bearer ${signInData.session.access_token}`,
    },
    body: {
      userId: signInData.user.id,
      newPassword: NEW_PASSWORD,
    },
  });

  if (error) {
    console.error('❌ Eroare la resetare:', error);
    process.exit(1);
  }

  console.log('✅ Parolă resetată cu succes!');
  console.log(`\n📝 Noile credențiale:`);
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   Parolă: ${NEW_PASSWORD}\n`);

  await supabase.auth.signOut();
}

resetPassword().catch((error) => {
  console.error('❌ Eroare:', error);
  process.exit(1);
});
