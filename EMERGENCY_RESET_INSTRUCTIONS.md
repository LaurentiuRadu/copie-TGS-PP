# 🔐 Emergency Password Reset Instructions

## Credențiale Resetate

**Email:** `laurentiu.radu@tgservices.ro`  
**Parolă nouă:** `TGSAdmin2025!`  
**Rută de autentificare:** `/admin-auth`

## Cum să resetezi parola ACUM

### Opțiunea 1: Folosind browser-ul (RECOMANDAT)

Copiază și lipește următorul cod în **Console** (F12 în browser):

```javascript
fetch('https://hbwkufaksipsqipqdqcv.supabase.co/functions/v1/emergency-reset-admin-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'laurentiu.radu@tgservices.ro',
    newPassword: 'TGSAdmin2025!',
    secretKey: 'EMERGENCY_RESET_TGS_2025'
  })
})
.then(r => r.json())
.then(data => console.log('✅ SUCCES:', data))
.catch(err => console.error('❌ EROARE:', err));
```

### Opțiunea 2: Folosind curl

```bash
curl -X POST \
  https://hbwkufaksipsqipqdqcv.supabase.co/functions/v1/emergency-reset-admin-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "laurentiu.radu@tgservices.ro",
    "newPassword": "TGSAdmin2025!",
    "secretKey": "EMERGENCY_RESET_TGS_2025"
  }'
```

## După resetare

1. ✅ Accesează `/admin-auth` în aplicație
2. 🔑 Autentifică-te cu credențialele de mai sus
3. ⚠️ **IMPORTANT:** Șterge edge function-ul `emergency-reset-admin-password` imediat pentru securitate!

## Securitate

⚠️ **ATENȚIE:** Acest edge function este PUBLIC (fără JWT) și trebuie șters IMEDIAT după utilizare!

Pentru a-l șterge:
1. Șterge folderul `supabase/functions/emergency-reset-admin-password/`
2. Șterge configurația din `supabase/config.toml`:
   ```toml
   [functions.emergency-reset-admin-password]
   verify_jwt = false
   ```

## Testare Autentificare

După resetare, poți testa autentificarea la:
- URL: `https://your-app-url.lovable.app/admin-auth`
- Email: `laurentiu.radu@tgservices.ro`
- Parolă: `TGSAdmin2025!`
