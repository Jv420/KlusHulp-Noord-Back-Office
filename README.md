# KlusHulp Noord Back Office

Next.js-administratie voor KlusHulp Noord, ingericht voor een zzp-eenmanszaak en geschikt voor Vercel met een externe MySQL-database.

## Functies

- klantenbeheer;
- offertes, facturen, werkbonnen en creditfacturen;
- voorraadbeheer;
- bedrijfsauto en privéauto;
- urenregistratie;
- uitgaven en planning;
- login, rollen en boekhouderstoegang.

## Database instellen

Importeer `database.sql` in de phpMyAdmin-omgeving van je databaseprovider.

## Vercel-variabelen

Voeg in Vercel bij **Settings → Environment Variables** toe:

```env
DB_HOST=sql7.freesqldatabase.com
DB_PORT=3306
DB_NAME=sql7833304
DB_USER=sql7833304
DB_PASSWORD=JOUW_DATABASE_WACHTWOORD
AUTH_SECRET=EEN_LANG_WILLEKEURIG_GEHEIM
OWNER_EMAIL=JOUW_INLOG_EMAIL
OWNER_PASSWORD=JOUW_STERKE_INLOGWACHTWOORD
NEXT_PUBLIC_APP_NAME=KlusHulp Noord Administratie
```

Zet echte wachtwoorden nooit in GitHub.

## Eigenaar aanmaken

Na het importeren van de database kun je lokaal met dezelfde omgevingsvariabelen uitvoeren:

```bash
npm install
npm run create:owner
```

Daarna kun je het project aan Vercel koppelen en `backoffice.klushulpnoord.nl` als domein instellen.
