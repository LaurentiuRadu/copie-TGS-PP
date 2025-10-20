// Quick password reset script using fetch API
const SUPABASE_URL = 'https://eqfqbmzwqgeprtuwwjnd.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxZnFibXp3cWdlcHJ0dXd3am5kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk4Nzg1MywiZXhwIjoyMDc2NTYzODUzfQ.sRTeiLQoD-r253vPC2vNEGN_5aBmYzXmJlu6JsNYOZ0';
const USER_ID = 'feeceb81-ec75-4fa0-b028-a8da289320ad';
const NEW_PASSWORD = 'TGSAdmin2025!';

async function resetPassword() {
  console.log('🔐 Resetare parolă pentru admin...\n');

  const url = `${SUPABASE_URL}/auth/v1/admin/users/${USER_ID}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({
      password: NEW_PASSWORD
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Eroare:', error);
    return;
  }

  const data = await response.json();
  console.log('✅ Parola a fost resetată cu succes!\n');
  console.log('📧 Email: laurentiu.radu@tgservices.ro');
  console.log('🔑 Parolă nouă:', NEW_PASSWORD);
  console.log('\n⚠️  IMPORTANT: Accesează /admin-auth pentru autentificare!');
  console.log('⚠️  Schimbă această parolă după prima autentificare!\n');
}

resetPassword().catch(console.error);
