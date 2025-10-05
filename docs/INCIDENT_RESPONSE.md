# Plan de Răspuns la Incidente de Securitate

## 🚨 Prezentare Generală

Acest document definește procedurile de răspuns rapid la incidente de securitate pentru aplicația TimeTrack. Scopul este minimizarea impactului și recuperarea rapidă în caz de breach sau compromitere.

**Contact Urgență Securitate:**
- 📧 Email: security@timetrack.ro
- ☎️ Telefon: +40 XXX XXX XXX (24/7)
- 📱 SMS Alertă: +40 XXX XXX XXX

---

## 🎯 1. Clasificarea Incidentelor

### Severitate 1 - CRITICĂ (P1)
**Impact:** Compromitere masivă date, breach securitate majore  
**Timp Răspuns:** Imediat (< 15 minute)  
**Exemple:**
- Leak bază de date completă
- Acces neautorizat la service role key
- Ransomware sau atac criptare date
- Breach-ul expune date PII ale >100 utilizatori

### Severitate 2 - ÎNALTĂ (P2)
**Impact:** Compromitere date sensibile limitate  
**Timp Răspuns:** < 1 oră  
**Exemple:**
- Acces neautorizat cont admin
- Tentativă SQL injection reușită
- Leak coordonate GPS multiple
- Breach fotografii biometrice

### Severitate 3 - MEDIE (P3)
**Impact:** Vulnerabilitate identificată, risc moderat  
**Timp Răspuns:** < 4 ore  
**Exemple:**
- Depășire repetată rate limits
- Sesiuni hijack suspectate
- Vulnerabilitate XSS descoperită
- Încercări brute force persistente

### Severitate 4 - SCĂZUTĂ (P4)
**Impact:** Risc minor, fără date compromise  
**Timp Răspuns:** < 24 ore  
**Exemple:**
- Activitate suspectă izolată
- Configurare suboptimală
- Alerte false pozitive
- Logging inconsistent

---

## 📋 2. Procedura de Răspuns

### Faza 1: DETECTARE și ALERTARE (0-15 min)

**Surse de Detectare:**
- ✅ Supabase security alerts
- ✅ Application logs (audit_logs, security_alerts)
- ✅ Rate limiting violations
- ✅ Raportări utilizatori
- ✅ Monitoring automatizat (uptime, performance)

**Acțiuni Imediare:**
1. **Confirmă incidentul** - Verifică dacă este real sau fals pozitiv
2. **Clasifică severitatea** - Aplică P1-P4
3. **Alertează echipa** - Notifică conform severity level
4. **Documentează** - Începe incident log cu timestamp și detalii

**Template Alertă:**
```
[P1-CRITICAL] Incident de Securitate Detectat
---
Timestamp: 2025-10-05 14:32:00 UTC
Tip: Acces Neautorizat Admin Account
Impact: ~500 utilizatori potențial afectați
Status: INVESTIGATING
Reporter: Sistema Automată / User XYZ
Link: [Incident Tracking URL]
```

### Faza 2: CONTAINMENT (15-60 min)

**Obiectiv:** Oprește propagarea și limitează daune

**P1/P2 Actions:**

**Immediate Containment (Short-term):**
1. **Izolează sistemul compromis**
   ```sql
   -- Revocă toate sesiunile active
   UPDATE active_sessions 
   SET invalidated_at = NOW(), 
       invalidation_reason = 'security_incident_p1'
   WHERE invalidated_at IS NULL;
   ```

2. **Rotește credențiale compromise**
   - Regenerează API keys
   - Rotește JWT secrets
   - Invalidează refresh tokens

3. **Blochează vectorul de atac**
   - IP banning (temporar sau permanent)
   - Rate limit agresiv (1 req/min)
   - Disable funcționalități compromise

4. **Backup date critice**
   ```bash
   # Export urgent DB snapshot
   supabase db dump > incident_backup_$(date +%Y%m%d_%H%M%S).sql
   ```

**Long-term Containment (1-4 ore):**
1. **Patch vulnerabilitate identificată**
2. **Deploy hotfix de urgență**
3. **Update RLS policies dacă necesare**
4. **Implementează monitoring suplimentar**

### Faza 3: ERADICARE (1-8 ore)

**Obiectiv:** Eliminează cauza root și toate urmele atacatorului

**Checklist Eradicare:**
- [ ] Identifică și înlătură backdoors
- [ ] Șterge malware / cod malițios
- [ ] Revocă toate accesele neautorizate
- [ ] Patch toate vulnerabilitățile conexe
- [ ] Validează integritatea cod și date

**Verificări Post-Eradicare:**
```sql
-- Verifică sesiuni suspectate rămase
SELECT * FROM active_sessions 
WHERE created_at BETWEEN '[incident_start]' AND '[incident_end]'
ORDER BY created_at DESC;

-- Verifică modificări roluri în timpul incidentului
SELECT * FROM audit_logs 
WHERE action IN ('role_change', 'permission_update')
  AND created_at BETWEEN '[incident_start]' AND '[incident_end]';
```

### Faza 4: RECUPERARE (4-24 ore)

**Obiectiv:** Restabilește serviciile și monitorizează revenire

**Proces Recuperare:**
1. **Restore din backup clean** (dacă necesar)
2. **Re-enable funcționalități pas cu pas**
3. **Monitorizare intensivă 48h**
4. **Comunicare utilizatori afectați**

**Template Comunicare Utilizatori (P1/P2):**
```
Subiect: Incident de Securitate - Acțiune Necesară

Dragă [Nume Utilizator],

Am detectat un incident de securitate care ar putea afecta contul tău.

Ce s-a întâmplat:
[Descriere simplă și clară]

Ce am făcut:
- Oprirea imediată a incidentului
- Investigare completă
- Patch-uri de securitate implementate

Ce trebuie să faci:
1. Schimbă-ți parola imediat
2. Revizuiește sesiunile active (Settings > Sesiuni)
3. Verifică activitățile recente

Suntem disponibili pentru orice întrebări:
support@timetrack.ro | +40 XXX XXX XXX

Cu respect,
Echipa TimeTrack Security
```

### Faza 5: LESSONS LEARNED (24-72 ore)

**Post-Incident Review Meeting:**
- **Participanți:** Echipa tech + management
- **Durată:** 1-2 ore
- **Format:** Blameless postmortem

**Agenda:**
1. **Timeline complet incident** (cu timestamps precise)
2. **Ce a funcționat bine?**
3. **Ce trebuia îmbunătățit?**
4. **Root cause analysis** (5 Whys method)
5. **Action items** (cu responsabili și deadline)

**Template Post-Mortem:**
```markdown
# Incident Post-Mortem: [Titlu Incident]

## Summary
- **Incident ID:** INC-2025-001
- **Date:** 5 Oct 2025, 14:32 - 18:45 UTC
- **Severity:** P1 - Critical
- **Impact:** 500 users, 4h downtime
- **Root Cause:** Unpatched SQL injection în funcție X

## Timeline
- 14:32 - Detectare automată SQL error anomaly
- 14:35 - Confirmare incident P1
- 14:40 - Containment: Revocate toate sesiunile
- 15:10 - Patch deploiat în urgență
- 16:30 - Eradicare completă confirmată
- 18:00 - Servicii restaurate complet
- 18:45 - Incident closed

## What Went Well
- ✅ Detectare automată rapidă (3 min)
- ✅ Comunicare echipă excelentă
- ✅ Hotfix deploiat în <40 min

## What Went Wrong
- ❌ Vulnerability scanning săptămânal nu a prins issue-ul
- ❌ No automated rollback mechanism
- ❌ Notificare utilizatori delayed 2h

## Root Cause (5 Whys)
1. Why incident? → SQL injection în search query
2. Why SQL injection possible? → Input validation missing
3. Why validation missing? → Developer oversight
4. Why oversight? → No code review checklist
5. Why no checklist? → Process not enforced

## Action Items
| Action | Owner | Deadline | Priority |
|--------|-------|----------|----------|
| Implement input validation library | Dev Team | Oct 10 | P0 |
| Mandatory code review checklist | Tech Lead | Oct 8 | P0 |
| Automated security scans on PR | DevOps | Oct 12 | P1 |
| Incident notification automation | Backend | Oct 15 | P1 |

## Prevention
- Add automated input validation
- Weekly pentest schedule
- Quarterly security training

## Supporting Documents
- [Incident Log PDF]
- [Timeline Spreadsheet]
- [Technical Analysis]
```

---

## 🛠️ 3. Unelte și Comenzi Utile

### Supabase Admin Quick Commands

```sql
-- Revocă toate sesiunile unui user
UPDATE active_sessions 
SET invalidated_at = NOW(), 
    invalidation_reason = 'admin_security_action'
WHERE user_id = '[user_uuid]';

-- Vizualizează toate alertele HIGH/CRITICAL din ultimele 24h
SELECT * FROM security_alerts 
WHERE severity IN ('high', 'critical')
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Verifică încercări login eșuate per IP
SELECT ip_address, COUNT(*) as failed_attempts
FROM audit_logs
WHERE action = 'failed_login'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY ip_address
HAVING COUNT(*) > 5
ORDER BY failed_attempts DESC;

-- Ban IP temporar (adaugă în whitelist/blacklist table)
INSERT INTO ip_blacklist (ip_address, reason, expires_at)
VALUES ('192.168.1.100', 'Brute force attempt', NOW() + INTERVAL '24 hours');

-- Export date utilizator pentru investigare
SELECT 
  u.id, u.email, u.created_at,
  array_agg(DISTINCT ur.role) as roles,
  COUNT(DISTINCT te.id) as time_entries_count
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN time_entries te ON u.id = te.user_id
WHERE u.id = '[user_uuid]'
GROUP BY u.id, u.email, u.created_at;
```

### Edge Function Emergency Disable

```bash
# Disable o funcție compromisă temporar
# Comentează în supabase/config.toml:
[functions.compromised-function]
verify_jwt = false  # Change to true to disable completely

# Deploy rapid
git add .
git commit -m "HOTFIX: Disable compromised function"
git push
```

### Monitoring Commands

```bash
# Check recent error logs
supabase functions logs compromised-function --limit 100

# Monitor active sessions real-time
watch -n 5 'supabase db query "SELECT COUNT(*) FROM active_sessions WHERE invalidated_at IS NULL"'

# Tail audit logs
supabase db query "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20"
```

---

## 📞 4. Contacte Esențiale

### Intern

| Rol | Nume | Telefon | Email |
|-----|------|---------|-------|
| Security Lead | [Nume] | +40 XXX XXX XXX | security@timetrack.ro |
| CTO | [Nume] | +40 XXX XXX XXX | cto@timetrack.ro |
| DevOps Lead | [Nume] | +40 XXX XXX XXX | devops@timetrack.ro |
| Legal Counsel | [Nume] | +40 XXX XXX XXX | legal@timetrack.ro |

### Extern

| Serviciu | Contact | Când contactezi |
|----------|---------|-----------------|
| Supabase Support | support@supabase.io | Infrastructure issues, DB compromise |
| CERT-RO | certro@cert.ro | Major breaches, coordinated attacks |
| Legal Advisor | [Nume] | Data breaches involving >100 users |
| Police Cybercrime | 112 / cybercrime@politia.ro | Criminal activity suspected |

---

## 📊 5. Reporting și Compliance

### Raportare Internă
- **P1/P2:** Raport scris în 24h către management
- **P3/P4:** Raport săptămânal rezumativ

### Raportare Externă (GDPR)

**Când trebuie raportat la ANSPDCP:**
- ✅ Breach afectează >100 persoane
- ✅ Date sensibile compromise (biometric, GPS)
- ✅ Risc semnificativ pentru drepturi utilizatori

**Timeline:**
- **72 ore** de la detectare → Notificare ANSPDCP
- **Fără întârziere nejustificată** → Notificare utilizatori afectați

**Template Notificare ANSPDCP:**
```
Către: Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal

Subiect: Notificare Incident de Securitate - Art. 33 GDPR

1. Operator Date: TimeTrack SRL, CUI: XXXXXX
2. Data incident: 5 Octombrie 2025, 14:32 UTC
3. Tipuri date afectate: Email, GPS coordinates, facial photos
4. Nr. persoane afectate: ~500
5. Măsuri implementate: [Lista]
6. Contact DPO: dpo@timetrack.ro

Anexe:
- Raport tehnic detaliat
- Timeline incident
- Măsuri remediere
```

---

## ✅ 6. Checklist Rapid

### P1 Incident - Primele 15 Minute
- [ ] Confirmă incident real (nu fals pozitiv)
- [ ] Alertează Security Lead + CTO
- [ ] Revocă toate sesiunile active
- [ ] Backup urgent bază date
- [ ] Disable funcționalitate compromisă
- [ ] Începe incident log cu timestamps
- [ ] Identifică vectorul de atac
- [ ] Block IP-uri suspectate

### P1 Incident - Prima Oră
- [ ] Root cause analysis preliminar
- [ ] Deploy hotfix sau workaround
- [ ] Rotește credențiale compromise
- [ ] Audit complete pentru alte vulnerabilități similare
- [ ] Pregătește comunicare utilizatori
- [ ] Contactează Supabase support (dacă relevant)

### P1 Incident - Primele 24 Ore
- [ ] Eradicare completă confirmată
- [ ] Toate servicii restaurate
- [ ] Monitoring intensificat activ
- [ ] Utilizatori notificați
- [ ] Raport management finalizat
- [ ] Post-mortem meeting programat

---

## 📚 7. Resurse și Training

**Documentație Recomandată:**
- [NIST Incident Response Guide](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-61r2.pdf)
- [SANS Incident Handler's Handbook](https://www.sans.org/reading-room/whitepapers/incident/incident-handlers-handbook-33901)
- [OWASP Incident Response](https://owasp.org/www-community/Incident_Response)

**Training Intern:**
- Incident simulation exercises (quarterly)
- Tabletop drills (bi-annual)
- Security awareness training (monthly)

---

**Ultima Revizuire:** 5 Octombrie 2025  
**Revizuire Următoare:** 5 Ianuarie 2026  
**Owner:** Security Team
