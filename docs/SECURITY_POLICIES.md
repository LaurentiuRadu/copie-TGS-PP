# Politici de Securitate - TimeTrack

## 📋 Prezentare Generală

Acest document descrie politicile și procedurile de securitate implementate în aplicația TimeTrack pentru protejarea datelor utilizatorilor și asigurarea confidențialității informațiilor sensibile.

**Data ultimei actualizări:** 5 Octombrie 2025  
**Versiune:** 1.0

---

## 🔐 1. Autentificare și Control Acces

### 1.1 Politici de Parole

**Cerințe Minime:**
- Minimum 12 caractere
- Cel puțin o literă majusculă
- Cel puțin o literă minusculă
- Cel puțin o cifră
- Cel puțin un caracter special

**Protecții Suplimentare:**
- ✅ Verificare parolă compromisă (Have I Been Pwned API)
- ✅ Score putere parolă (0-100)
- ✅ Feedback în timp real la crearea parolei
- ✅ Blocare parole comune sau compromise

**Expirare Parolă:**
- Parolele trebuie schimbate la fiecare 90 de zile
- Notificări de expirare cu 7 zile înainte
- Blocare acces după expirare până la schimbare

### 1.2 Rate Limiting

**Limite Încercări de Autentificare:**
- Maximum 5 încercări la 15 minute
- Blocare 30 minute după depășirea limitei
- Logging toate încercările eșuate

**Alte Limite:**
- API calls: 100 requests/minute per user
- Password reset: 3 încercări/oră
- Data export (GDPR): 1 cerere/zi

### 1.3 Managementul Sesiunilor

**Politici Sesiune:**
- Timeout inactivitate: 30 minute
- Warning inactivitate: 5 minute înainte de expirare
- Maximum 3 sesiuni concurente per utilizator
- Auto-logout cea mai veche sesiune la depășire limită
- Invalidare automată la schimbare parolă

**Tracking Sesiuni:**
- Înregistrare device fingerprint
- IP address logging
- Device info (browser, OS, type)
- Timestamp ultima activitate

---

## 🔒 2. Protecția Datelor Personale

### 2.1 Date Biometrice

**Consimțământ Explicit:**
- ✅ Obligatoriu consimțământ explicit pentru verificare facială
- ✅ Blocare automată dacă consimțământ retras
- ✅ Logging toate încercările de verificare
- ✅ Drept de retragere consimțământ oricând

**Stocare Date:**
- Fotografii stocate encrypted în storage bucket privat
- Quality score și match score stocate separate
- Retenție: 90 zile, apoi anonimizare automată

### 2.2 Date de Localizare GPS

**Colectare:**
- GPS necesare doar pentru clock-in/clock-out
- Permisiune explicită utilizator
- Precizie high accuracy (±10m)

**Stocare și Acces:**
- Coordonate stocate encrypted
- Vizualizare doar de admini autorizați
- **Audit logging:** Orice acces admin la coordonate GPS este înregistrat automat
- Retenție: 730 zile (2 ani)

### 2.3 GDPR Compliance

**Drepturi Utilizatori:**
- ✅ **Dreptul de acces** - Export date personale (JSON)
- ✅ **Dreptul de ștergere** - Ștergere completă date / anonimizare
- ✅ **Dreptul de portabilitate** - Export structurat
- ✅ **Dreptul de retragere consimțământ** - Oricând

**Procesare Cereri:**
- Răspuns în maximum 30 zile
- Logging toate cererile GDPR
- Confirmare email după procesare

---

## 🛡️ 3. Row Level Security (RLS)

### 3.1 Politici Generale

**Principiu Least Privilege:**
- Utilizatorii văd doar propriile date
- Adminii au acces complet cu audit logging
- Politici separate pentru INSERT, UPDATE, DELETE, SELECT

### 3.2 Tabele Critice

**`user_roles`:**
- ❌ Utilizatorii NU pot modifica propriile roluri
- ✅ Doar adminii pot atribui/modifica roluri
- ✅ INSERT/UPDATE/DELETE restricționate la admini

**`profiles`:**
- ✅ Utilizatorii pot UPDATE doar propriul profil
- ✅ WITH CHECK explicit pentru prevenire modificări cross-user
- ✅ Adminii pot UPDATE orice profil

**`time_entries`:**
- ✅ Utilizatorii văd doar propriile pontaje
- ✅ INSERT permis doar pentru propriul user_id
- ✅ Adminii văd toate pontajele cu audit logging

**`face_verification_logs`:**
- ✅ INSERT permis doar cu consimțământ biometric valid
- ✅ Trigger automat verifică consimțământul înainte de INSERT
- ✅ Blocare automată dacă lipsește consimțământ

---

## 📊 4. Audit și Monitoring

### 4.1 Audit Logs

**Ce se Înregistrează:**
- Accesări date sensibile (GPS, fotografii)
- Modificări roluri utilizatori
- Login/logout evenimente
- Cereri GDPR (export, delete)
- Session management (logout all, invalidări)
- Rate limit violations

**Format Log Entry:**
```json
{
  "user_id": "uuid",
  "action": "view_location_data",
  "resource_type": "time_entry",
  "resource_id": "uuid",
  "details": {
    "target_user_id": "uuid",
    "has_gps_data": true
  },
  "timestamp": "2025-10-05T12:34:56Z"
}
```

**Retenție:**
- 365 zile (1 an)
- Curățare automată după expirare
- Doar adminii pot vizualiza audit logs

### 4.2 Security Alerts

**Tipuri de Alerte:**
- `suspicious_login` - Login din locație neobișnuită
- `rate_limit_exceeded` - Depășire limite încercări
- `failed_face_verification` - Verificare facială eșuată
- `unauthorized_access_attempt` - Încercare acces neautorizat
- `session_hijack_attempt` - Tentativă hijacking sesiune

**Severitate:**
- `low` - Informativ
- `medium` - Necesită atenție
- `high` - Necesită acțiune imediată
- `critical` - Incident securitate major

**Notificări:**
- Email admini pentru alerte HIGH și CRITICAL
- Dashboard vizual pentru toate alertele
- Retenție: 180 zile

---

## 🗄️ 5. Retenția Datelor

### 5.1 Politici Retenție

| Tip Date | Perioadă Retenție | Auto-Delete | Anonimizare |
|----------|-------------------|-------------|-------------|
| Audit Logs | 365 zile | ✅ | ❌ |
| Security Alerts | 180 zile | ✅ (resolved) | ❌ |
| GDPR Requests | 90 zile | ✅ (completed) | ❌ |
| Face Verification | 90 zile | ❌ | ✅ |
| GPS Coordinates | 730 zile | ❌ | ✅ |
| Biometric Photos | 365 zile | ❌ | ✅ |
| Time Entries | 1825 zile (5 ani) | ❌ | ❌ |

### 5.2 Procesul de Anonimizare

**Ce se Anonimizează:**
- URL fotografii → `"REDACTED"`
- Coordonate GPS → `NULL` sau valori generice
- Failure reasons → `"REDACTED"`

**Când se Aplică:**
- Automat la expirarea perioadei de retenție
- Manual la cerere GDPR de ștergere
- Programat daily cleanup job

---

## 🔧 6. Configurări Securitate

### 6.1 Setări Obligatorii

**Backend (Supabase):**
- ✅ Leaked Password Protection: **ENABLED**
- ✅ Email Confirmation: DISABLED (non-production)
- ✅ JWT Expiration: 24 ore
- ✅ Refresh Token Rotation: ENABLED

**Aplicație:**
- ✅ HTTPS Only: ENFORCED
- ✅ Content Security Policy: STRICT
- ✅ Rate Limiting: ENABLED
- ✅ Session Timeout: 30 min

### 6.2 Variabile de Mediu

**Critice (Secrets):**
- `SUPABASE_URL` - URL proiect Supabase
- `SUPABASE_ANON_KEY` - Cheia anonimă publică
- `SUPABASE_SERVICE_ROLE_KEY` - Cheia service role (DOAR în edge functions)

**⚠️ NICIODATĂ:**
- NU expune service role key în frontend
- NU loga parole sau tokeni în console
- NU stoca credențiale în cod

---

## 📝 7. Responsabilități

### 7.1 Administratori

**Obligații:**
- Revizuire audit logs săptămânal
- Răspuns alerte HIGH/CRITICAL în 4 ore
- Procesare cereri GDPR în 30 zile
- Update politici securitate trimestrial
- Testare proceduri backup lunar

### 7.2 Utilizatori

**Obligații:**
- Utilizare parole puternice și unice
- Raportare activitate suspectă imediat
- Nu partaja credențiale de acces
- Logout după utilizare pe device-uri partajate
- Revizuire sesiuni active săptămânal

---

## ⚠️ 8. Incidente Securitate

Vezi [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md) pentru proceduri detaliate.

**Contact Urgență:**
- Email: security@timetrack.ro
- Telefon: +40 XXX XXX XXX (24/7)

---

## 📚 9. Referințe și Resurse

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [GDPR Official Text](https://gdpr-info.eu/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/security)
- [Have I Been Pwned API](https://haveibeenpwned.com/API/v3)

---

**Întrebări sau Sugestii?**  
Contactează echipa de securitate: security@timetrack.ro
