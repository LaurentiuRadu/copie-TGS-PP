import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Database, Eye, Lock, FileText, AlertTriangle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { AdminLayout } from "@/components/AdminLayout";

export default function PrivacyPolicy() {
  return (
    <AdminLayout title="Politica de Confidențialitate">
      <div className="space-y-6">

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Introducere
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Această Politică de Confidențialitate descrie modul în care compania noastră colectează, utilizează, 
            stochează și protejează datele dumneavoastră personale în conformitate cu Regulamentul General privind 
            Protecția Datelor (GDPR - Regulamentul UE 2016/679) și legislația română aplicabilă.
          </p>
          <p>
            Aplicația de pontaj colectează și procesează date personale, inclusiv <strong>date biometrice</strong> 
            (fotografii faciale), care sunt considerate date cu caracter special conform Art. 9 GDPR și necesită 
            consimțământul dumneavoastră explicit.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            1. Date Personale Colectate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">1.1. Date de Identificare</h4>
            <ul className="list-disc pl-6 space-y-1">
              <li>Nume complet</li>
              <li>Username</li>
              <li>Adresă de email</li>
              <li>Fotografie de profil (opțional)</li>
            </ul>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-2">1.2. Date Biometrice (Categorie Specială - Art. 9 GDPR)</h4>
            <ul className="list-disc pl-6 space-y-1">
              <li>Fotografii faciale realizate la pontajul de intrare/ieșire</li>
              <li>Score-uri de calitate a fotografiilor</li>
              <li>Score-uri de potrivire facială (match score)</li>
              <li>Template-uri biometrice (dacă se stochează)</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-2">
              <strong>Baza legală:</strong> Consimțământ explicit (Art. 9(2)(a) GDPR)
            </p>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-2">1.3. Date de Localizare</h4>
            <ul className="list-disc pl-6 space-y-1">
              <li>Coordonate GPS (latitudine și longitudine) la pontaj</li>
              <li>Timestamp-uri precise ale locației</li>
              <li>Locații de muncă validate</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-2">
              <strong>Baza legală:</strong> Consimțământ explicit
            </p>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-2">1.4. Date de Activitate Profesională</h4>
            <ul className="list-disc pl-6 space-y-1">
              <li>Ore de lucru (regulare, noapte, weekend, sărbători)</li>
              <li>Tip de schimb (zi/noapte)</li>
              <li>Vehicul atribuit</li>
              <li>Locație de lucru</li>
              <li>Activitate desfășurată</li>
              <li>Note și observații</li>
              <li>Cereri de concediu</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-2">
              <strong>Baza legală:</strong> Contract de muncă (Art. 6(1)(b) GDPR) și obligație legală (Codul Muncii)
            </p>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-2">1.5. Date Tehnice</h4>
            <ul className="list-disc pl-6 space-y-1">
              <li>Adresă IP</li>
              <li>User agent (tip browser/dispozitiv)</li>
              <li>Device fingerprint</li>
              <li>Sesiuni active</li>
              <li>Informații despre dispozitiv</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-2">
              <strong>Baza legală:</strong> Interes legitim (securitate și prevenirea fraudei)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            2. Scopul Procesării Datelor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Pontaj și evidența timpului de lucru:</strong> Pentru a înregistra orele de lucru conform 
              obligațiilor legale ale angajatorului (Codul Muncii - Art. 119)
            </li>
            <li>
              <strong>Verificare identitate:</strong> Utilizarea datelor biometrice pentru a asigura că persoana 
              care efectuează pontajul este angajatul autorizat
            </li>
            <li>
              <strong>Prevenirea fraudei:</strong> Verificarea locației GPS și a fotografiilor pentru a preveni 
              pontajul neautorizat sau fraudulos
            </li>
            <li>
              <strong>Salarizare:</strong> Calcularea salariului pe baza orelor înregistrate
            </li>
            <li>
              <strong>Managementul programului:</strong> Planificarea schimburilor și a echipelor de lucru
            </li>
            <li>
              <strong>Conformitate legală:</strong> Respectarea legislației muncii și a obligațiilor de raportare
            </li>
            <li>
              <strong>Securitate:</strong> Protejarea conturilor și prevenirea accesului neautorizat
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            3. Stocarea și Protecția Datelor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">3.1. Perioada de Stocare</h4>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Date pontaj și timp de lucru:</strong> 5 ani (conform Legii Contabilității nr. 82/1991 
                și Codul Muncii)
              </li>
              <li>
                <strong>Date biometrice:</strong> Până la retragerea consimțământului sau încetarea contractului 
                de muncă (cel care intervine primul)
              </li>
              <li>
                <strong>Sesiuni active:</strong> 30 de zile de la ultima activitate
              </li>
              <li>
                <strong>Loguri de audit:</strong> 2 ani
              </li>
              <li>
                <strong>Cereri GDPR procesate:</strong> 1 an după finalizare
              </li>
            </ul>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-2">3.2. Măsuri de Securitate</h4>
            <ul className="list-disc pl-6 space-y-1">
              <li>Criptare end-to-end pentru transmiterea datelor</li>
              <li>Autentificare securizată cu token-uri JWT</li>
              <li>Row Level Security (RLS) pe toate tabelele de date</li>
              <li>Audit trail complet pentru accesul la date sensibile</li>
              <li>Rate limiting pentru prevenirea atacurilor</li>
              <li>Backup-uri regulate și criptate</li>
              <li>Acces restricționat la date pe baza rolurilor</li>
            </ul>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-2">3.3. Partajarea Datelor</h4>
            <p className="mb-2">Datele dumneavoastră personale NU sunt vândute sau partajate cu terți, cu excepția:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Furnizori de servicii cloud:</strong> Pentru hosting și stocare (Supabase/AWS) - 
                cu contracte de prelucrare GDPR-conforme
              </li>
              <li>
                <strong>Autorități publice:</strong> Când este obligatoriu legal (ITM, Fisc, Poliție)
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            4. Drepturile Dumneavoastră GDPR
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            Conform GDPR, aveți următoarele drepturi cu privire la datele dumneavoastră personale:
          </p>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold">✅ Dreptul de acces (Art. 15)</h4>
              <p className="text-sm text-muted-foreground">
                Puteți solicita și primi o copie a datelor personale pe care le procesăm despre dumneavoastră.
              </p>
            </div>

            <div>
              <h4 className="font-semibold">✅ Dreptul la rectificare (Art. 16)</h4>
              <p className="text-sm text-muted-foreground">
                Puteți corecta datele incorecte sau incomplete din profilul dumneavoastră.
              </p>
            </div>

            <div>
              <h4 className="font-semibold">✅ Dreptul la ștergere - "Dreptul de a fi uitat" (Art. 17)</h4>
              <p className="text-sm text-muted-foreground">
                Puteți solicita ștergerea datelor, cu excepția cazurilor în care avem o obligație legală de 
                stocare (ex: păstrare registre timp de lucru 5 ani).
              </p>
            </div>

            <div>
              <h4 className="font-semibold">✅ Dreptul la portabilitate (Art. 20)</h4>
              <p className="text-sm text-muted-foreground">
                Puteți exporta datele într-un format structurat, utilizat în mod curent (JSON/Excel).
              </p>
            </div>

            <div>
              <h4 className="font-semibold">✅ Dreptul de a retrage consimțământul (Art. 7(3))</h4>
              <p className="text-sm text-muted-foreground">
                Puteți retrage consimțământul pentru procesarea datelor biometrice și GPS în orice moment.
                <strong> Notă:</strong> Retragerea poate afecta capacitatea dumneavoastră de a utiliza aplicația.
              </p>
            </div>

            <div>
              <h4 className="font-semibold">✅ Dreptul la restricționare procesare (Art. 18)</h4>
              <p className="text-sm text-muted-foreground">
                Puteți solicita restricționarea temporară a procesării datelor în anumite circumstanțe.
              </p>
            </div>

            <div>
              <h4 className="font-semibold">✅ Dreptul de a depune plângere (Art. 77)</h4>
              <p className="text-sm text-muted-foreground">
                Puteți depune o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu 
                Caracter Personal (ANSPDCP):
              </p>
              <ul className="text-sm text-muted-foreground list-disc pl-6 mt-2">
                <li>Website: <a href="https://www.dataprotection.ro" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.dataprotection.ro</a></li>
                <li>Email: anspdcp@dataprotection.ro</li>
                <li>Telefon: +40 21 252 5599</li>
              </ul>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Exercitarea Drepturilor</h4>
            <p className="text-sm">
              Pentru a vă exercita drepturile, accesați secțiunea <strong>Setări GDPR & Confidențialitate</strong> din 
              aplicație sau contactați DPO-ul companiei: <strong>Radu Ioan Laurentiu</strong> (radu.ioan.laurentiu@company.ro, tel: 0741 19 07 29)
            </p>
            <p className="text-sm mt-2">
              Vom răspunde cererii dumneavoastră în termen de maximum 30 de zile calendaristice.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5. Contact și Responsabil cu Protecția Datelor (DPO)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            Pentru orice întrebări referitoare la procesarea datelor personale sau pentru a vă exercita drepturile GDPR, 
            vă rugăm să contactați Responsabilul cu Protecția Datelor (DPO):
          </p>
          
          <div className="bg-muted p-4 rounded-lg border space-y-2">
            <p><strong>Responsabil cu Protecția Datelor (DPO)</strong></p>
            <p><strong>Nume:</strong> Radu Ioan Laurentiu</p>
            <p><strong>Email:</strong> radu.ioan.laurentiu@company.ro</p>
            <p><strong>Telefon:</strong> 0741 19 07 29</p>
            <p><strong>Adresă:</strong> Bacau, strada Nordului 5 B 1</p>
          </div>
          
          <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
            <h5 className="font-semibold mb-2">Depunerea unei Plângeri</h5>
            <p className="text-sm text-muted-foreground">
              Dacă considerați că drepturile dumneavoastră GDPR au fost încălcate, puteți depune o plângere 
              la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP):
            </p>
            <ul className="text-sm text-muted-foreground list-disc pl-6 mt-2">
              <li>Website: <a href="https://www.dataprotection.ro" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.dataprotection.ro</a></li>
              <li>Email: anspdcp@dataprotection.ro</li>
              <li>Telefon: +40 21 252 5599</li>
            </ul>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            Această politică poate fi actualizată periodic. Veți fi notificat despre orice modificări semnificative.
          </p>
        </CardContent>
      </Card>
    </div>
    </AdminLayout>
  );
}
