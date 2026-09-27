# JW Daily Scripture

App web gratuita che ogni mattina ti manda una notifica e legge ad alta voce il **testo del giorno** da [wol.jw.org](https://wol.jw.org/it/wol/h/r6/lp-i).

Stile e colori ispirati a Watchtower Online Library (`#4a6da7`, `#799fcc`).

## Deploy pubblico

Progetto pronto per Vercel (`api/` + `public/` + `vercel.json`).

```bash
cd alba
npx vercel login
npx vercel --prod
```

Oppure deploy temporaneo anonimo:

```bash
rm -rf .vercel
npx vercel deploy --temporary --yes
```

Vedi `DEPLOY.md` per l’URL online.

## Avvio locale

```bash
cd alba
npm install
npm start
```

Apri `http://localhost:3847`.

## Hey Siri — «leggi scrittura del giorno»

1. Apri `/siri.html` sull’URL pubblico
2. In **Comandi** crea: **URL** → `Ottieni contenuto di URL` → `Ottieni testo dall’input`
   → `Pronuncia testo`, usando `…/api/daily-speak`. Elimina eventuali azioni `Riproduci suono`.
3. **Aggiungi a Siri** → frase `leggi scrittura del giorno`

## Hey Google — Android Auto

Apri `/google.html` sull’URL pubblico e crea una routine Google Assistant con la frase
`leggi la scrittura del giorno` e l’azione per aprire il link audio `/api/google`. Collega Android
Auto prima di usare il comando. Android Auto non consente a un normale sito web di comparire come
app multimediale nativa; la guida indica il percorso supportato dalla routine Google.

## Nota sul contenuto

Il testo del giorno appartiene a Watch Tower Bible and Tract Society. JW Daily Scripture è un lettore personale non ufficiale.
