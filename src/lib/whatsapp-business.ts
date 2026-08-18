import "server-only";
import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const apiKeySid = process.env.TWILIO_API_KEY_SID;
const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

// API Key auth (recommended by Twilio for production) if both are set, else
// fall back to the Account SID + Auth Token pair. Either way the Account SID
// is required — an API Key alone isn't enough to scope requests to an account.
const hasApiKeyAuth = Boolean(accountSid && apiKeySid && apiKeySecret);
const hasAuthTokenAuth = Boolean(accountSid && authToken);

export const isWhatsAppSendConfigured = Boolean((hasApiKeyAuth || hasAuthTokenAuth) && whatsappFrom);

const client = hasApiKeyAuth
  ? twilio(apiKeySid, apiKeySecret, { accountSid })
  : hasAuthTokenAuth
    ? twilio(accountSid, authToken)
    : null;

/**
 * Normalizes a freeform phone number (as stored on Customer.phone) into Twilio's
 * `whatsapp:+<digits>` address form. Returns null for anything that can't plausibly
 * be a phone number, same "digits only, with country code" convention documented for
 * NEXT_PUBLIC_WHATSAPP_NUMBER.
 */
export function normalizeWhatsAppPhone(phone: string): string | null {
  const digits = phone.replace(/[^0-9]/g, "");
  if (!digits) return null;
  return `whatsapp:+${digits}`;
}

/**
 * Sends an approved WhatsApp Business template message via Twilio's Content API.
 * WhatsApp requires business-initiated messages outside a 24h customer-service session
 * to use a pre-approved template — contentSid must reference one created (and approved)
 * in the Twilio Content Template Builder / Meta Business Manager.
 */
export async function sendWhatsAppTemplate(
  to: string,
  contentSid: string,
  variables: Record<string, string>,
): Promise<void> {
  if (!client || !whatsappFrom) {
    throw new Error(
      "WhatsApp sending isn't configured yet — set TWILIO_ACCOUNT_SID and TWILIO_WHATSAPP_FROM, plus either " +
        "TWILIO_AUTH_TOKEN or TWILIO_API_KEY_SID/TWILIO_API_KEY_SECRET.",
    );
  }
  await client.messages.create({
    from: whatsappFrom,
    to,
    contentSid,
    contentVariables: JSON.stringify(variables),
  });
}
