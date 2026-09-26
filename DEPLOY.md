# Deploy — JW Daily Scripture

Progetto: `prj_vx1XDKLMTBKWPbWahsRSpatR9Vvk`

- **App (produzione):** https://temporary-sonic-banjo-o0bhzmr.vercel.app
- **Audio Siri:** https://temporary-sonic-banjo-o0bhzmr.vercel.app/api/daily-audio?voice=it-IT-IsabellaNeural
- **Voci:** https://temporary-sonic-banjo-o0bhzmr.vercel.app/api/voices

## Notifiche giornaliere push

Le notifiche a orario scelto usano Web Push server-side; il service worker non mantiene un timer
affidabile quando il browser viene sospeso. Il progetto usa un Blob privato Vercel per le
sottoscrizioni e GitHub Actions come scheduler ogni cinque minuti.

Il Blob privato `jw-daily-scripture-push` è collegato all'ambiente production; Vercel conserva il
token read/write come variabile segreta. Per abilitare l'invio, imposta in Vercel
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` (per esempio l'URL pubblico dell'app), poi
ridistribuisci. Il workflow
`.github/workflows/push-cron.yml` usa un token OIDC verificato dall'endpoint; non richiede secret
GitHub statici. La chiave privata VAPID e il token Blob non vanno inseriti nel repository. L'invio
può slittare di alcuni minuti perché GitHub Actions esegue il controllo ogni cinque minuti.

Ogni dispositivo deve consentire le notifiche e salvare l'orario nelle impostazioni. Su iPhone/iPad
serve iOS 16.4 o successivo e l'app aggiunta alla schermata Home.
