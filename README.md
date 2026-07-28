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

## Dati

La chiave `localStorage` resta `utility-impianti-v1`. Al primo avvio i vecchi interventi vengono associati alla campagna ?Dati precedenti?; impianti, tecnico selezionato e cronologia restano invariati.

## Sviluppo

```bash
npm install
npm run build
```
