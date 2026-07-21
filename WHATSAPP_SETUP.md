# WhatsApp invoice/receipt delivery — setup

This wires "Send via WhatsApp" on an invoice/receipt to Meta's WhatsApp
Business Platform (Cloud API) directly — no third-party provider (Twilio,
360dialog, etc.), so there's no per-message markup or monthly platform fee
on top of Meta's own rates. The flow: you tap "Send via WhatsApp" → the
customer gets a template message with a button → they tap it → our webhook
sends them the PDF in the same chat.

None of this works until the steps below are done — the buttons stay
hidden in the admin until `WHATSAPP_PHONE_NUMBER_ID` and
`WHATSAPP_ACCESS_TOKEN` are both set.

## 1. Meta Business verification

You need a verified Meta Business account. If you don't have one:
[business.facebook.com](https://business.facebook.com) → Business Settings
→ start verification. This is the slowest step (can take days) — start it
first.

## 2. Create a WhatsApp Business Platform app

In [developers.facebook.com](https://developers.facebook.com) → My Apps →
Create App → Business type → add the "WhatsApp" product.

- Meta gives you a **test phone number** for free to develop with (sends
  work immediately, but only to numbers you've added as testers).
- For real customers, add your own number under WhatsApp → API Setup →
  add phone number. **That number can't stay a regular consumer WhatsApp
  account at the same time** — either use a fresh number, or migrate an
  existing one out of the regular WhatsApp/WhatsApp Business app first.

From WhatsApp → API Setup, copy:
- **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`
- Generate a **permanent access token**: System Users (under Business
  Settings) → create a system user → assign it the WhatsApp app with
  `whatsapp_business_messaging` permission → generate token → that's
  `WHATSAPP_ACCESS_TOKEN`. (The token shown by default on the API Setup
  page expires in 24 hours — don't use that one in production.)

## 3. Register the webhook

Still in the app dashboard: WhatsApp → Configuration → Webhook.

- **Callback URL:** `https://<your-domain>/api/webhooks/whatsapp`
- **Verify token:** any string you choose — put the same value in
  `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
- Subscribe to the **messages** field (this is what delivers button taps to
  our webhook).

## 4. Submit the message templates

Business-initiated messages (you notifying a client who hasn't texted you
first) must use a template Meta has reviewed — usually approved within a
day or two for standard utility templates. Create these two under WhatsApp
→ Message Templates:

**`invoice_ready`** (category: Utility, language: English (US))
```
Body: Your invoice {{1}} from NURU Electronics is ready. Tap below to get your copy.
Button: Quick Reply — "Get Invoice"
```

**`receipt_ready`** (category: Utility, language: English (US))
```
Body: Your receipt {{1}} from NURU Electronics is ready. Tap below to get your copy.
Button: Quick Reply — "Get Receipt"
```

The `{{1}}` placeholder is filled with the document number
(`INV-2026-0001`, etc.) when the code sends it.

## 5. Cost notes

- Replying to a customer within 24 hours of *them* messaging you first is
  free (Meta's "service conversation" window) — the store's existing
  "Order via WhatsApp" button already gets customers to message in, so
  reusing that same number here means many replies cost nothing.
- Business-initiated messages (cold notifications) use the paid "utility"
  category — Meta's cheapest message category, billed per message once you
  exceed the platform's free monthly allowance.
- No separate provider bill — you only pay Meta directly.

## 6. Once everything above is done

Set `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, and
`WHATSAPP_WEBHOOK_VERIFY_TOKEN` in your production environment (and
`.env.local` for local testing). The "Send via WhatsApp" buttons will
appear on any order whose customer has a phone number on file.
