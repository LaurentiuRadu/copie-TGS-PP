# Quick Start: Export Database

## 3 Pași Rapizi

### 1. Instalează tsx (dacă nu ai)

```bash
npm install -g tsx
```

### 2. Rulează Export

```bash
ADMIN_PASSWORD="your-admin-password" npm run export:db
```

### 3. Verifică Rezultatul

Caută fișierul: `database-export-YYYY-MM-DDTHH-MM-SS-MSSZ.json`

---

## Detalii Complete

Vezi **[EXPORT_DATABASE_GUIDE.md](./EXPORT_DATABASE_GUIDE.md)** pentru:
- Troubleshooting
- Structură completă JSON
- Security best practices
- Verificări și validări

---

## Cont Admin

**Username:** `laurentiu.radu`
**Email:** `laurentiu.radu@company.local`

---

## Ce Exportează?

Scriptul exportă **toate cele 34+ tabele**:

- ✅ profiles (utilizatori)
- ✅ time_entries (pontaje)
- ✅ daily_timesheets (pontaje zilnice)
- ✅ weekly_schedules (programări)
- ✅ vacation_requests (cereri concediu)
- ✅ audit_logs (audit trail)
- ✅ security_alerts (alerte securitate)
- ✅ ... și 27+ alte tabele

---

## Output Example

```
🔐 Starting database export...

🔑 Authenticating as: laurentiu.radu@company.local
✅ Authenticated successfully!
   User ID: feeceb81-ec75-4fa0-b028-a8da289320ad

🔍 Verifying admin role...
✅ Admin role confirmed!

📦 Invoking admin-full-database-export function...
   This may take 10-30 seconds...

✅ Export completed successfully!

💾 Saving export to: database-export-2025-10-20T18-30-45-123Z.json
✅ Export saved successfully!

📊 Export Statistics:
   Total Profiles: 34
   Total Time Entries: 1234
   Total Daily Timesheets: 134
   Total Schedules: 52
   Total Vacation Requests: 45

📋 Export includes 34+ tables:
   - profiles: 34 rows
   - user_roles: 34 rows
   - time_entries: 1234 rows
   - daily_timesheets: 134 rows
   ... (30 more tables)

🔓 Signing out...

✅ Database export completed successfully!
📁 File: database-export-2025-10-20T18-30-45-123Z.json
📊 Size: 1234.56 KB
```

---

## După Export

**⚠️ IMPORTANT:** Fișierul conține date GDPR sensitive!

- 🔒 Păstrează-l securizat
- ❌ NU-l commita în Git (`.gitignore` îl exclude automat)
- 🔐 Criptează-l dacă îl shareuri
- 🗑️ Șterge-l când nu mai ai nevoie

---

## Probleme?

### Nu ai parola?

Contactează administratorul sistem sau verifică în Lovable Dashboard.

### Eroare "Authentication failed"?

Verifică că username-ul și parola sunt corecte:
- Username: `laurentiu.radu` (exact, case-sensitive)
- Email generat automat: `laurentiu.radu@company.local`

### Eroare "Export failed"?

1. Verifică că Edge Function este deployat în Supabase
2. Check Supabase Dashboard → Functions → Logs
3. Verifică conexiunea la internet
4. Încearcă din nou

---

## Next Steps

După export, poți:

1. **Analiza datelor** - Deschide JSON în editor
2. **Import în alt sistem** - Folosește datele exportate
3. **Backup** - Păstrează ca backup securizat
4. **Raportare** - Generează rapoarte din date

Pentru analiză avansată, vezi: **[DATABASE_ANALYSIS.md](./DATABASE_ANALYSIS.md)**
