import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { AdminLayout } from "@/components/AdminLayout";

export default function TermsAndConditions() {
  return (
    <AdminLayout title="Termeni și Condiții">
      <div className="space-y-6">

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            1. Introducere și Acceptare
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Acești Termeni și Condiții reglementează utilizarea aplicației de pontaj și evidență timp de lucru 
            (denumită în continuare "Aplicația") furnizată de companie pentru angajații săi.
          </p>
          <p>
            Prin utilizarea Aplicației, declarați că ați citit, ați înțeles și sunteți de acord cu acești Termeni 
            și Condiții, precum și cu Politica de Confidențialitate asociată.
          </p>
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              ⚠️ IMPORTANT: Utilizarea Aplicației este obligatorie pentru toți angajații în scopul evidenței 
              timpului de lucru conform Codului Muncii și contractului dumneavoastră de muncă.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>2. Scopul Aplicației</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">Aplicația este destinată exclusiv pentru:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Înregistrarea pontajului de intrare și ieșire din programul de lucru</li>
            <li>Evidența orelor de lucru (regulare, prelungite, noapte, weekend, sărbători)</li>
            <li>Verificarea identității angajatului prin fotografii faciale</li>
            <li>Validarea locației pontajului prin GPS</li>
            <li>Gestionarea cererilor de concediu</li>
            <li>Vizualizarea programului de lucru și a schimburilor</li>
            <li>Calcularea salariului pe baza timpului lucrat</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>3. Obligațiile Angajatului (Utilizator)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                3.1. Utilizare Corectă
              </h4>
              <ul className="list-disc pl-6 space-y-1 text-sm">
                <li>Să efectuați pontajul personal, în momentul începerii și terminării programului</li>
                <li>Să furnizați fotografii faciale clare pentru verificarea identității</li>
                <li>Să efectuați pontajul din locațiile de muncă autorizate</li>
                <li>Să utilizați propriul cont, fără a-l împărți cu alți angajați</li>
                <li>Să păstrați confidențialitatea parolei de acces</li>
                <li>Să raportați orice problemă tehnică sau eroare de pontaj imediat</li>
              </ul>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-red-600" />
                3.2. Utilizare Interzisă
              </h4>
              <ul className="list-disc pl-6 space-y-1 text-sm">
                <li><strong>INTERZIS:</strong> Pontajul în numele altor angajați</li>
                <li><strong>INTERZIS:</strong> Falsificarea locației GPS</li>
                <li><strong>INTERZIS:</strong> Utilizarea de fotografii ale altor persoane</li>
                <li><strong>INTERZIS:</strong> Manipularea datelor de pontaj</li>
                <li><strong>INTERZIS:</strong> Partajarea credentialelor de acces</li>
                <li><strong>INTERZIS:</strong> Încercarea de a accesa conturi ale altor utilizatori</li>
                <li><strong>INTERZIS:</strong> Orice formă de fraudă sau tentativă de eludare a sistemului</li>
              </ul>
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3 rounded-lg mt-3">
                <p className="text-sm font-semibold text-red-900 dark:text-red-200">
                  ⛔ Încălcarea acestor reguli constituie abatere disciplinară gravă și poate duce la 
                  sancțiuni disciplinare, inclusiv concediere conform Codului Muncii (Art. 61).
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">3.3. Consimțăminte GDPR Obligatorii</h4>
              <p className="text-sm mb-2">Pentru a utiliza Aplicația, trebuie să acordați consimțământul pentru:</p>
              <ul className="list-disc pl-6 space-y-1 text-sm">
                <li>Procesarea datelor biometrice (fotografii faciale)</li>
                <li>Colectarea coordonatelor GPS la pontaj</li>
                <li>Capturarea fotografiilor la pontaj</li>
                <li>Procesarea datelor personale pentru evidența timpului de lucru</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">
                Puteți retrage aceste consimțăminte oricând din Setări GDPR, dar acest lucru va face imposibilă 
                utilizarea Aplicației pentru pontaj.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>4. Obligațiile Angajatorului</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">Compania se angajează să:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Mențină Aplicația funcțională și securizată</li>
            <li>Protejeze datele personale conform GDPR</li>
            <li>Notifice angajații despre orice modificări ale sistemului</li>
            <li>Ofere suport tehnic în caz de probleme</li>
            <li>Utilizeze datele exclusiv în scopurile declarate</li>
            <li>Permită accesul la date personale la cerere</li>
            <li>Șteargă datele conform perioadelor legale de stocare</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>5. Date Biometrice și Confidențialitate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">5.1. Utilizare Date Biometrice</h4>
            <p className="text-sm">
              Fotografiile faciale sunt utilizate <strong>exclusiv</strong> pentru verificarea identității 
              angajatului la pontaj. Aceste date sunt considerate date cu caracter special conform Art. 9 GDPR 
              și sunt protejate cu măsuri de securitate sporite.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">5.2. Stocare și Acces</h4>
            <ul className="list-disc pl-6 space-y-1 text-sm">
              <li>Fotografiile sunt stocate criptat pe servere securizate</li>
              <li>Accesul la date biometrice este restricționat și auditat</li>
              <li>Datele NU sunt partajate cu terți</li>
              <li>Fotografiile pot fi vizualizate doar de administratorii autorizați</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">5.3. Dreptul de Retragere</h4>
            <p className="text-sm">
              Puteți retrage consimțământul pentru procesarea datelor biometrice oricând. În acest caz, 
              nu veți mai putea utiliza Aplicația pentru pontaj și va trebui să utilizați un sistem alternativ 
              agreat cu angajatorul.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>6. Disponibilitate și Suport Tehnic</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">6.1. Disponibilitate</h4>
            <p className="text-sm">
              Compania depune eforturi rezonabile pentru a menține Aplicația disponibilă 24/7, dar nu 
              garantează disponibilitate 100%. Pot exista perioade de mentenanță programată sau întreruperi 
              neprevăzute.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">6.2. Pontaj în Caz de Probleme Tehnice</h4>
            <p className="text-sm">
              În cazul în care Aplicația nu funcționează, trebuie să informați imediat supervizorul direct 
              și să utilizați metoda alternativă de pontaj stabilită de companie (pontaj pe hârtie, email, etc.).
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">6.3. Suport</h4>
            <p className="text-sm">
              Pentru probleme tehnice, contactați departamentul IT sau administratorul de sistem.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>7. Modificări ale Termenilor</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            Compania își rezervă dreptul de a modifica acești Termeni și Condiții în orice moment. 
            Modificările vor intra în vigoare la publicarea lor în Aplicație.
          </p>
          <p className="text-sm text-muted-foreground">
            Veți fi notificat prin Aplicație despre orice modificări semnificative. Utilizarea continuă 
            a Aplicației după modificări constituie acceptarea noilor termeni.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>8. Legislație Aplicabilă și Jurisdicție</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            Acești Termeni și Condiții sunt guvernați de legislația română și de următoarele acte normative:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-sm">
            <li>Codul Muncii (Legea nr. 53/2003)</li>
            <li>GDPR (Regulamentul UE 2016/679)</li>
            <li>Legea nr. 190/2018 privind protecția datelor</li>
            <li>Legea Contabilității nr. 82/1991</li>
          </ul>
          <p className="mt-4 text-sm">
            Orice litigiu decurgând din utilizarea Aplicației va fi soluționat pe cale amiabilă sau, 
            în lipsa unei înțelegeri, de către instanțele competente din România.
          </p>
        </CardContent>
      </Card>

      <div className="mt-6 p-4 bg-muted rounded-lg">
        <p className="text-sm text-center">
          Prin utilizarea Aplicației, confirmați că ați citit, înțeles și acceptat acești Termeni și Condiții.
        </p>
      </div>
    </div>
    </AdminLayout>
  );
}
