# Security Checklist - TimeTrack

## 📋 Prezentare Generală

Acest checklist asigură menținerea unui nivel înalt de securitate prin verificări regulate și automatizate. Utilizează pentru:
- Onboarding membri noi echipă
- Verificări pre-deployment
- Audituri de securitate periodice
- Post-incident validation

---

## 🔐 1. Autentificare și Acces

### Daily / Per-Deployment

- [ ] **Rate limiting funcțional**
  ```sql
  -- Verifică există rate limits active
  SELECT * FROM rate_limit_config WHERE enabled = true;
  ```

- [ ] **Sesiuni expiră corect**
  ```sql
  -- Verifică sesiuni expirate sunt invalide
  SELECT COUNT(*) FROM active_sessions 
  WHERE expires_at < NOW() AND invalidated_at IS NULL;
  -- Rezultat așteptat: 0
  ```

### Weekly

- [ ] **Audit încercări login eșuate**
  ```sql
  SELECT 
    DATE_TRUNC('day', created_at) as day,
    COUNT(*) as failed_attempts
  FROM audit_logs
  WHERE action = 'failed_login'
    AND created_at > NOW() - INTERVAL '7 days'
  GROUP BY day
  ORDER BY day DESC;
  ```

- [ ] **Verifică rate limit violations**
  ```sql
  SELECT identifier, attempt_type, COUNT(*) as violations
  FROM rate_limit_attempts
  WHERE blocked_until > NOW()
  GROUP BY identifier, attempt_type
  HAVING COUNT(*) > 10;
  ```

- [ ] **Review sesiuni active anormale**
  ```sql
  -- Sesiuni active > 7 zile
  SELECT user_id, COUNT(*) as active_sessions, 
         MAX(created_at) as oldest_session
  FROM active_sessions
  WHERE invalidated_at IS NULL
  GROUP BY user_id
  HAVING MAX(NOW() - created_at) > INTERVAL '7 days';
  ```

### Monthly

- [ ] **Password expiry enforcement**
  ```sql
  -- Utilizatori cu parole expirate neforțate
  SELECT u.email, pt.password_changed_at,
         NOW() - pt.password_changed_at as age
  FROM auth.users u
  JOIN user_password_tracking pt ON u.id = pt.user_id
  WHERE pt.password_changed_at < NOW() - INTERVAL '90 days'
    AND pt.must_change_password = false;
  ```

- [ ] **Leaked password protection ENABLED**
  - Check în Supabase Dashboard > Authentication > Password Protection
  - ✅ "Check for leaked passwords" = ON

- [ ] **Review admin accounts**
  ```sql
  -- Lista completă admini activi
  SELECT u.email, ur.role, u.created_at, u.last_sign_in_at
  FROM auth.users u
  JOIN user_roles ur ON u.id = ur.user_id
  WHERE ur.role = 'admin'
  ORDER BY u.last_sign_in_at DESC;
  ```

---

## 🛡️ 2. Row Level Security (RLS)

### Per Deployment

- [ ] **RLS enabled pe toate tabelele critice**
  ```sql
  SELECT tablename, 
         relrowsecurity as rls_enabled
  FROM pg_tables pt
  JOIN pg_class pc ON pt.tablename = pc.relname
  WHERE schemaname = 'public'
    AND tablename IN (
      'profiles', 'user_roles', 'time_entries', 
      'face_verification_logs', 'audit_logs',
      'active_sessions', 'session_limits'
    );
  -- Toate trebuie să aibă rls_enabled = true
  ```

- [ ] **Politici RLS pentru toate operațiunile**
  ```sql
  -- Verifică fiecare tabel are politici pentru toate CRUD
  SELECT tablename, 
         array_agg(DISTINCT cmd) as policies
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename;
  ```

### Weekly

- [ ] **Test privilege escalation**
  - Încearcă să modifici rolul altui user (trebuie să eșueze)
  - Încearcă să accesezi pontajele altui user (trebuie să eșueze)

- [ ] **Audit modificări RLS policies**
  ```sql
  SELECT * FROM audit_logs
  WHERE resource_type = 'rls_policy'
    AND created_at > NOW() - INTERVAL '7 days'
  ORDER BY created_at DESC;
  ```

### Monthly

- [ ] **Penetration testing RLS**
  - Test cu tool automat (pgTAP sau similar)
  - Încercări de bypass manuală
  - Documentează rezultatele

---

## 📊 3. Data Protection și GDPR

### Daily

- [ ] **Backup-uri funcționale**
  - Verifică ultimul backup Supabase a reușit
  - Test restore pe environment de test (lunar)

### Weekly

- [ ] **Procesare cereri GDPR active**
  ```sql
  -- Cereri în așteptare > 7 zile
  SELECT id, user_id, request_type, requested_at,
         NOW() - requested_at as waiting_time
  FROM gdpr_requests
  WHERE status = 'pending'
    AND requested_at < NOW() - INTERVAL '7 days';
  ```

- [ ] **Audit accesări date sensibile**
  ```sql
  -- Top utilizatori care accesează GPS coordinates
  SELECT user_id, COUNT(*) as gps_access_count
  FROM audit_logs
  WHERE action = 'view_location_data'
    AND created_at > NOW() - INTERVAL '7 days'
  GROUP BY user_id
  ORDER BY gps_access_count DESC
  LIMIT 10;
  ```

### Monthly

- [ ] **Enforcement data retention**
  ```sql
  -- Rulează manual funcția de cleanup
  SELECT public.enforce_data_retention();
  
  -- Verifică rezultatele
  SELECT * FROM data_retention_policies
  ORDER BY last_cleanup_run DESC;
  ```

- [ ] **Biometric consent compliance**
  ```sql
  -- Verificări faciale fără consimțământ (trebuie 0)
  SELECT fvl.user_id, fvl.created_at
  FROM face_verification_logs fvl
  LEFT JOIN user_consents uc ON fvl.user_id = uc.user_id 
    AND uc.consent_type = 'biometric_data'
    AND uc.consent_given = true
    AND uc.consent_withdrawn_date IS NULL
  WHERE uc.id IS NULL
    AND fvl.created_at > NOW() - INTERVAL '30 days';
  -- Rezultat așteptat: 0 rows
  ```

- [ ] **Review consimțăminte retrase**
  ```sql
  SELECT user_id, consent_type, consent_withdrawn_date
  FROM user_consents
  WHERE consent_withdrawn_date IS NOT NULL
    AND consent_withdrawn_date > NOW() - INTERVAL '30 days';
  ```

---

## 🚨 4. Security Alerts și Audit

### Daily

- [ ] **Review alerte HIGH/CRITICAL**
  ```sql
  SELECT * FROM security_alerts
  WHERE severity IN ('high', 'critical')
    AND resolved = false
  ORDER BY created_at DESC;
  ```

- [ ] **Failed face verifications**
  ```sql
  SELECT user_id, COUNT(*) as failures
  FROM face_verification_logs
  WHERE is_match = false
    AND created_at > NOW() - INTERVAL '24 hours'
  GROUP BY user_id
  HAVING COUNT(*) > 3;
  ```

### Weekly

- [ ] **Audit log volume check**
  ```sql
  -- Verifică logging funcționează
  SELECT 
    DATE_TRUNC('day', created_at) as day,
    action,
    COUNT(*) as count
  FROM audit_logs
  WHERE created_at > NOW() - INTERVAL '7 days'
  GROUP BY day, action
  ORDER BY day DESC, count DESC;
  ```

- [ ] **Session hijack detection**
  ```sql
  -- Sesiuni cu device fingerprint schimbat
  SELECT user_id, session_id, 
         COUNT(DISTINCT device_fingerprint) as device_changes
  FROM active_sessions
  WHERE created_at > NOW() - INTERVAL '7 days'
  GROUP BY user_id, session_id
  HAVING COUNT(DISTINCT device_fingerprint) > 1;
  ```

### Monthly

- [ ] **Security dashboard review**
  - Total alerte per severity
  - Trend rate limiting violations
  - Failed login attempts per user
  - Top accessed resources

- [ ] **Incident response drill**
  - Simulează incident P2
  - Verifică procedurile sunt up-to-date
  - Documentează lesson learned

---

## 🔧 5. Infrastructure și Config

### Per Deployment

- [ ] **Environment variables set**
  ```bash
  # Verifică variabile critice
  echo $SUPABASE_URL
  echo $SUPABASE_ANON_KEY
  # NU afișa SERVICE_ROLE_KEY în logs!
  ```

- [ ] **Edge functions deployed**
  ```bash
  # Lista funcții active
  supabase functions list
  
  # Verifică logs pentru erori
  supabase functions logs --all --limit 50
  ```

- [ ] **CORS headers corecte**
  - Verifică manual în browser DevTools
  - Test OPTIONS preflight requests

### Weekly

- [ ] **Database connections healthy**
  ```sql
  -- Verifică connection pooling
  SELECT count(*), state
  FROM pg_stat_activity
  WHERE datname = 'postgres'
  GROUP BY state;
  ```

- [ ] **Storage bucket permissions**
  - `profile-photos` = private ✅
  - RLS policies active pe storage ✅

### Monthly

- [ ] **Dependency updates**
  ```bash
  # Check outdated packages
  npm outdated
  
  # Security audit
  npm audit
  
  # Update Supabase client
  npm update @supabase/supabase-js
  ```

- [ ] **SSL/TLS certificates valid**
  - Custom domain SSL expires in >30 days
  - Check certificate chain completeness

---

## 📈 6. Monitoring și Performance

### Daily

- [ ] **Error rate acceptable**
  - Check Supabase dashboard
  - < 1% error rate for API calls
  - No 500 errors în ultimele 24h

- [ ] **Response times normal**
  - Avg API response < 500ms
  - P95 response < 2000ms

### Weekly

- [ ] **Database query performance**
  ```sql
  -- Slow queries (> 1s)
  SELECT query, mean_exec_time, calls
  FROM pg_stat_statements
  WHERE mean_exec_time > 1000
  ORDER BY mean_exec_time DESC
  LIMIT 10;
  ```

- [ ] **Storage usage trending**
  - Database size < 80% plan limit
  - Storage bucket < 80% plan limit

### Monthly

- [ ] **Uptime SLA review**
  - Target: 99.9% uptime
  - Calculate actual uptime
  - Review downtime incidents

- [ ] **Capacity planning**
  - Predict next 3 months growth
  - Plan infrastructure scaling if needed

---

## 🎓 7. Training și Awareness

### Quarterly

- [ ] **Security training all team**
  - OWASP Top 10 awareness
  - Phishing simulation
  - Secure coding practices

- [ ] **Update security documentation**
  - Review SECURITY_POLICIES.md
  - Review INCIDENT_RESPONSE.md
  - Update team contacts

### Annually

- [ ] **External security audit**
  - Hire penetration testing firm
  - Full codebase review
  - Infrastructure assessment
  - Report findings and remediation

- [ ] **Disaster recovery drill**
  - Simulate complete data loss
  - Test backup restoration
  - Validate RTO/RPO metrics

---

## ✅ 8. Pre-Production Deployment

**Use acest checklist înainte de fiecare deploy în production:**

- [ ] **Security scan pass**
  ```bash
  npm audit --production
  # Zero high/critical vulnerabilities
  ```

- [ ] **RLS policies reviewed**
  - All tables have RLS enabled
  - Policies tested manually

- [ ] **Secrets rotated** (dacă schimbare majoră)
  - API keys updated
  - Environment variables refreshed

- [ ] **Backup created**
  - Full DB dump before deploy
  - Test restore capability

- [ ] **Rollback plan documented**
  - Steps to rollback clearly written
  - Tested on staging environment

- [ ] **Monitoring alerts configured**
  - Error rate threshold
  - Response time degradation
  - Failed login spikes

- [ ] **Changelog security section**
  - Document security-related changes
  - Note any breaking changes

---

## 📞 9. Emergency Contacts

**Dacă checklist detectează issue critic:**

| Severity | Contact | Phone | Email |
|----------|---------|-------|-------|
| P1/P2 | Security Lead | +40 XXX XXX XXX | security@timetrack.ro |
| P3 | Tech Lead | +40 XXX XXX XXX | tech@timetrack.ro |
| P4 | DevOps | - | devops@timetrack.ro |

---

## 📝 10. Tracking și Raportare

**Completează după fiecare review:**

```markdown
## Security Review - [DATA]

**Reviewer:** [Nume]  
**Type:** [Daily/Weekly/Monthly]  
**Duration:** [Minute]

### Issues Found:
1. [Descriere issue + severity]
2. ...

### Actions Taken:
1. [Acțiune + owner + deadline]
2. ...

### Status:
- ✅ PASS - No critical issues
- ⚠️ WARNING - Minor issues found, tracked
- ❌ FAIL - Critical issues, escalated

**Next Review:** [Data]
```

**Salvează în:** `docs/security-reviews/YYYY-MM-DD-review.md`

---

**Ultima Actualizare:** 5 Octombrie 2025  
**Versiune:** 1.0  
**Owner:** Security Team
