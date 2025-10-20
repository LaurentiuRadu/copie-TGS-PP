# Ghid Export Database

## Despre

Acest script permite exportul complet al bazei de date folosind Edge Function-ul existent `admin-full-database-export`.

## Cerințe

- Node.js instalat (v18+)
- Cont admin în sistem
- Acces la fișierul `.env` cu credentials Supabase

## Cont Admin Disponibil

**Username:** `laurentiu.radu`
**Email:** `laurentiu.radu@company.local`
**Rol:** admin (verificat în database)

## Instalare Dependințe

Dacă nu ai deja instalat `tsx`:

```bash
npm install -g tsx
# SAU
npm install tsx --save-dev
```

## Rulare Export

### Metoda 1: Cu variabilă de mediu (Recomandat)

```bash
ADMIN_PASSWORD="your-password-here" npx tsx export-database.ts
```

### Metoda 2: Export variabilă în shell

```bash
export ADMIN_PASSWORD="your-password-here"
npx tsx export-database.ts
```

### Metoda 3: Editare temporară script

**⚠️ NU COMMITA PAROLA ÎN GIT!**

Editează temporar `export-database.ts` și înlocuiește:
```typescript
const password = process.env.ADMIN_PASSWORD;
```

Cu:
```typescript
const password = "your-password-here";
```

După rulare, **ȘTERGE parola** din fișier!

## Ce Face Scriptul?

1. **Autentificare** - Se conectează cu contul admin
2. **Verificare Rol** - Confirmă că utilizatorul este admin
3. **Invocare Edge Function** - Apelează `admin-full-database-export`
4. **Salvare Locală** - Salvează rezultatul ca JSON
5. **Afișare Statistici** - Arată numărul de înregistrări per tabel
6. **Logout** - Închide sesiunea

## Rezultat

Scriptul va crea un fișier de forma:

```
database-export-2025-10-20T18-30-45-123Z.json
```

### Structură JSON Export

```json
{
  "exportDate": "2025-10-20T18:30:45.123Z",
  "exportedBy": "feeceb81-ec75-4fa0-b028-a8da289320ad",
  "version": "1.0",
  "database": {
    "profiles": [...],
    "user_roles": [...],
    "time_entries": [...],
    "daily_timesheets": [...],
    "weekly_schedules": [...],
    "vacation_requests": [...],
    "vacation_balances": [...],
    "work_locations": [...],
    "holidays": [...],
    "security_alerts": [...],
    "audit_logs": [...],
    "face_verification_logs": [...],
    "notification_preferences": [...],
    "notification_delivery_logs": [...],
    "schedule_notifications": [...],
    "user_consents": [...],
    "gdpr_requests": [...],
    "admin_sessions": [...],
    "employee_sessions": [...],
    "time_entry_segments": [...],
    "team_time_discrepancies": [...],
    "time_entry_correction_requests": [...],
    "user_password_tracking": [...],
    "app_versions": [...],
    "data_retention_policies": [...],
    "rate_limit_config": [...],
    "rate_limit_attempts": [...],
    "work_hour_rules": [...],
    "push_subscriptions": [...],
    "locations": [...],
    "projects": [...],
    "execution_items": [...],
    "notification_settings": [...]
  },
  "statistics": {
    "total_profiles": 34,
    "total_time_entries": 1234,
    "total_daily_timesheets": 134,
    "total_schedules": 52,
    "total_vacation_requests": 45
  }
}
```

## Troubleshooting

### Eroare: "Missing SUPABASE credentials"

Verifică că fișierul `.env` există și conține:
```
VITE_SUPABASE_URL=https://effcxrqcdplktvoagnlt.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Eroare: "Authentication failed"

- Verifică username-ul (trebuie să fie exact `laurentiu.radu`)
- Verifică parola (case-sensitive)
- Contul trebuie să fie activ în database

### Eroare: "User is not an admin"

Rulează query pentru verificare:
```sql
SELECT p.username, ur.role
FROM profiles p
JOIN user_roles ur ON p.id = ur.user_id
WHERE p.username = 'laurentiu.radu';
```

### Eroare: "Export failed"

- Verifică că Edge Function `admin-full-database-export` este deployat
- Verifică logs în Supabase Dashboard
- Network issues - încearcă din nou

## Security

**IMPORTANT:**
- ❌ NU commita `export-database.ts` cu parola hardcoded
- ❌ NU commita fișierele `database-export-*.json` în Git
- ✅ Folosește variabile de mediu pentru parole
- ✅ `.gitignore` deja exclude `*.local` și `database-export-*.json`

## După Export

Fișierul JSON conține **toate datele** din aplicație:
- Date personale (GDPR sensitive)
- Istorice pontaje
- Sesiuni active
- Audit logs
- Security alerts

**Păstrează-l în siguranță!**

## Verificare Fișier `.gitignore`

Asigură-te că `.gitignore` conține:

```
# Database exports
database-export-*.json
export-database.ts.local

# Environment
.env
.env.local
```

## Ajutor

Pentru probleme, verifică:
1. Logs în console (scriptul afișează pași detaliați)
2. Network tab în browser (dacă rulezi din UI)
3. Supabase Dashboard → Edge Functions → Logs
4. Audit logs în database (vezi cine a făcut export și când)
