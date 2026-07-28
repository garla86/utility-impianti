# Utility Impianti ? Versione 1.1

App web mobile-first per gestire impianti e interventi, con dati salvati localmente nel browser.

## Novit? 1.1

- Nuove stagioni/campagne selettive: i contatori ripartono senza eliminare lo storico.
- Vista a schede e vista elenco compatta.
- Vista mappa filtrata con collegamenti di navigazione e itinerario fino a 9 tappe.
- Menu Impostazioni per tecnico, Excel, backup, nuova stagione, mappa e informazioni.
- Migrazione automatica e compatibile dei dati e backup della V1.
- Pulsante Preaccensione al posto di Altro.
- Letture consumi per stagione: gas iniziale/finale in m? ed energia iniziale/finale in MWh.
- Stato acceso/spento visibile nelle schede e nell?elenco, ricavato dall?ultima accensione o spegnimento.
- Pi? contatori energia nominabili per zona, con migrazione automatica delle vecchie letture.
- Esportazione Excel dei consumi con riepilogo impianti e dettaglio contatori.
- Filtro Consumi con conteggio e viste Da fare/Completati per la stagione corrente.
- Azione ?Vedi tutti? in mappa, coerente con tecnico, intervento e stato selezionati.
- Filtri adattivi su pi? righe, senza categorie tagliate.
- Mappa interna con marcatori per tutti gli impianti filtrati e geocodifica progressiva memorizzata localmente.
- Accesso amministratore locale: solo l?amministratore gestisce anagrafica, stagioni e report consumi.
- Selettore tecnico ridimensionato per evitare sovrapposizioni con la ricerca.

## Dati

La chiave `localStorage` resta `utility-impianti-v1`. Al primo avvio i vecchi interventi vengono associati alla campagna ?Dati precedenti?; impianti, tecnico selezionato e cronologia restano invariati.

## V2 condivisa ? configurazione

1. Eseguire `supabase/schema.sql` nel SQL Editor del progetto Supabase.
2. In Vercel configurare:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (solo nelle funzioni server; non usare mai nel client)
3. Creare dall?app il primo account con `graziano.garlaschelli@cfsfacility.it`.
4. Confermare l?email, accedere e disabilitare le nuove registrazioni pubbliche in Supabase Auth.
5. Usare **Impostazioni ? Migra dati V1** una sola volta sul dispositivo che contiene l?archivio completo.
6. Invitare i tecnici da **Impostazioni ? Gestione utenti**.

Tutti gli utenti autenticati possono consultare tutti gli impianti. Le policy RLS consentono a un tecnico di registrare interventi e consumi soltanto sugli impianti assegnati; l?amministratore pu? gestire tutto.

## Sviluppo

```bash
npm install
npm run build
```
