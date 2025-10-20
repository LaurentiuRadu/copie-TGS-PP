const url1 = 'https://effcxrqcdplktvoagnlt.supabase.co/functions/v1/emergency-password-reset';
const url2 = 'https://hbwkufaksipsqipqdqcv.supabase.co/functions/v1/emergency-password-reset';

const anon_key1 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmZmN4cnFjZHBsa3R2b2Fnbmx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDU2MDMsImV4cCI6MjA3NjUyMTYwM30._VLkr9jIfpClbxtlqAUd-3UnaAwyvc_y7r9AIDWL5Hs';
const anon_key2 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhid2t1ZmFrc2lwc3FpcHFkcWN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMTE4MDUsImV4cCI6MjA3NDc4NzgwNX0.3OVj-S-JgcWp531gmjCdMgag8TIZl8K4AgL9Ap_44BM';

const payload = {
  email: 'laurentiu.radu@tgservices.ro',
  newPassword: 'Maciuca2016!',
  secretKey: 'EMERGENCY_RESET_2025'
};

async function testReset(url, key, name) {
  console.log(`\n🔍 Testing ${name}...`);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log('Response:', data);

    if (response.ok && data.success) {
      console.log('✅ SUCCESS! Password reset complete!');
      console.log('\nCredentials:');
      console.log('Email: laurentiu.radu@tgservices.ro');
      console.log('Password: Maciuca2016!');
      return true;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
  return false;
}

(async () => {
  const success1 = await testReset(url1, anon_key1, 'effcxrqcdplktvoagnlt');
  if (!success1) {
    await testReset(url2, anon_key2, 'hbwkufaksipsqipqdqcv');
  }
})();
