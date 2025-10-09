import { supabase } from "@/integrations/supabase/client";

/**
 * Verifică dacă utilizatorul are toate consimțămintele GDPR obligatorii
 */
export async function checkUserConsents(userId: string): Promise<boolean> {
  const requiredConsents = ['biometric_data', 'gps_tracking', 'photo_capture', 'data_processing'];
  
  const { data, error } = await supabase
    .from('user_consents')
    .select('consent_type, consent_given, consent_withdrawn_date')
    .eq('user_id', userId)
    .in('consent_type', requiredConsents);

  if (error) {
    console.error('Error checking consents:', error);
    return false;
  }

  // Verifică dacă toate consimțămintele sunt date și neretrase
  const validConsents = data?.filter(
    consent => consent.consent_given && !consent.consent_withdrawn_date
  ) || [];

  return validConsents.length === requiredConsents.length;
}

/**
 * Returnează lista consimțămintelor lipsă pentru un utilizator
 */
export async function getMissingConsents(userId: string): Promise<string[]> {
  const requiredConsents = ['biometric_data', 'gps_tracking', 'photo_capture', 'data_processing'];
  
  const { data, error } = await supabase
    .from('user_consents')
    .select('consent_type, consent_given, consent_withdrawn_date')
    .eq('user_id', userId)
    .in('consent_type', requiredConsents);

  if (error) {
    console.error('Error fetching consents:', error);
    return requiredConsents;
  }

  const givenConsents = data
    ?.filter(consent => consent.consent_given && !consent.consent_withdrawn_date)
    .map(consent => consent.consent_type) || [];

  return requiredConsents.filter(consent => !givenConsents.includes(consent));
}

/**
 * Obține toți utilizatorii fără consimțăminte complete (DOAR angajați, nu admini)
 */
export async function getUsersWithoutConsents() {
  // Obținem DOAR angajații (exclude admini)
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select(`
      id, 
      username, 
      full_name
    `);

  if (profilesError) {
    console.error('Error fetching profiles:', profilesError);
    return [];
  }

  // Obținem rolurile pentru toți utilizatorii
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('user_id, role');

  const employeeIds = new Set(
    userRoles
      ?.filter(ur => ur.role === 'employee')
      .map(ur => ur.user_id) || []
  );

  // Filtrăm doar angajații
  const employees = profiles?.filter(p => employeeIds.has(p.id)) || [];

  // Verificăm consimțămintele pentru fiecare angajat
  const usersWithoutConsents = [];
  
  for (const profile of employees) {
    const hasAllConsents = await checkUserConsents(profile.id);
    if (!hasAllConsents) {
      const missingConsents = await getMissingConsents(profile.id);
      usersWithoutConsents.push({
        ...profile,
        missingConsents
      });
    }
  }

  return usersWithoutConsents;
}
