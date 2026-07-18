# Stripe instellen voor KlusHulp Noord

## Vercel omgevingsvariabelen

Voeg in Vercel bij **Project → Settings → Environment Variables** toe:

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://jouw-backoffice-domein.nl
```

Gebruik tijdens het testen eerst `sk_test_...`.

## Webhook in Stripe

Maak in Stripe Workbench/Developers een webhook endpoint aan:

```text
https://jouw-backoffice-domein.nl/api/stripe/webhook
```

Selecteer minimaal deze events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `payment_intent.succeeded`
- `charge.refunded`

Kopieer daarna het signing secret (`whsec_...`) naar `STRIPE_WEBHOOK_SECRET` in Vercel.

## Online facturen innen

Open een factuur in de backoffice en klik op **Stripe-betaallink + QR maken**. De app maakt een Stripe-hosted Checkout Session aan met iDEAL en kaartbetaling. De QR-code komt op de afdruk/PDF. Stripe verstuurt het officiële betaalbewijs naar het e-mailadres van de klant wanneer dit op de klantkaart staat.

## Tap to Pay op iPhone en Android

De webbackoffice bevat de beveiligde server-endpoints die de mobiele Stripe Terminal SDK nodig heeft:

```text
POST /api/stripe/terminal/connection-token
POST /api/stripe/terminal/payment-intent
```

NFC-kaartacceptatie kan niet rechtstreeks vanuit een normale browser/PWA worden gestart. Hiervoor is de Stripe Dashboard-app (zonder eigen mobiele app) of een aparte native/React Native-app met Stripe Terminal nodig.

Voor een eigen iPhone-app is daarnaast Apple Tap to Pay-entitlement en goedkeuring vereist. Voor Android is een ondersteund, niet-geroot NFC-apparaat met recente Android-beveiliging nodig.

## Veiligheid

- Zet nooit `STRIPE_SECRET_KEY` of `STRIPE_WEBHOOK_SECRET` in clientcode of GitHub.
- Alleen de officiële Stripe Checkout-pagina verwerkt online betaalgegevens.
- Webhooks worden cryptografisch gecontroleerd met het Stripe signing secret.
- Verwerkte webhook-events worden opgeslagen zodat dezelfde betaling niet dubbel wordt geboekt.
