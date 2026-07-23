# Utility Impianti — Versione 1

App web pensata per smartphone per registrare gli interventi sugli impianti. Questa prima versione salva tutto **nel browser del dispositivo**: non serve un account e non richiede servizi a pagamento.

## Funzioni incluse

- Importazione Excel/CSV con queste colonne: `Descrizione`, `Comune`, `Via`, `CAP`, `Amministratore`, `Tecnico responsabile`.
- Ricerca per nome, indirizzo, comune, CAP o amministratore.
- Filtro per tecnico, tipo di intervento e stato (da fare/completato).
- Registrazione immediata di manutenzione, verifica, prova fumi, accensione, spegnimento e altro, con data e ora automatiche.
- Cronologia per impianto, modificabile in caso di errore.
- Creazione e modifica manuale degli impianti, compreso il cambio di tecnico.
- Backup JSON e ripristino: fare una copia periodica del file scaricato.
- PWA installabile su iPhone/Android e pronta per Vercel.

## Avvio sul computer

1. Installa [Node.js](https://nodejs.org/) versione LTS.
2. Apri una finestra del terminale nella cartella del progetto.
3. Esegui `npm install` una sola volta.
4. Esegui `npm run dev` e apri l’indirizzo mostrato.

## Pubblicazione con GitHub e Vercel

1. Crea un repository GitHub chiamato `utility-impianti` e carica questi file.
2. Su Vercel scegli **Add New → Project**, quindi importa il repository.
3. Lascia invariati i valori proposti (Vite rilevato automaticamente) e premi **Deploy**.
4. Sul telefono apri il link Vercel con Safari/Chrome e scegli **Aggiungi alla schermata Home**.

Ogni modifica inviata su GitHub verrà pubblicata automaticamente da Vercel.

## Importante: dati e backup

I dati restano nel browser del telefono o PC utilizzato. Non si sincronizzano fra dispositivi in questa V1. Usa regolarmente **Esporta backup** e conserva il file JSON in un luogo sicuro. In futuro quel backup potrà essere migrato alla versione condivisa con database.
