import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resetAdminPassword() {
  const email = 'laurentiu.radu@tgservices.ro';
  const newPassword = 'Admin123!';

  console.log(`Resetez parola pentru: ${email}`);

  const { data: users, error: findError } = await supabase.auth.admin.listUsers();

  if (findError) {
    console.error('Eroare la căutare user:', findError);
    return;
  }

  const user = users.users.find(u => u.email === email);

  if (!user) {
    console.error('User-ul nu a fost găsit');
    return;
  }

  const { data, error } = await supabase.auth.admin.updateUserById(
    user.id,
    { password: newPassword }
  );

  if (error) {
    console.error('Eroare la resetare parolă:', error);
    return;
  }

  console.log('✅ Parola a fost resetată cu succes!');
  console.log(`Email: ${email}`);
  console.log(`Parolă nouă: ${newPassword}`);
  console.log('\n⚠️  IMPORTANT: Schimbă această parolă după autentificare!');
}

resetAdminPassword().catch(console.error);
