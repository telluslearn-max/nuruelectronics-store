import "server-only";
import { normalizeKenyanPhone } from "./phone";

// Meta's WhatsApp Cloud API — sends the gift card code as a business-initiated message. Distinct from
// src/lib/whatsapp.ts's buildWhatsAppUrl (a plain wa.me link for a human to click); this actually sends.

const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
const GRAPH_API_VERSION = "v20.0";

export const isWhatsAppCloudConfigured = Boolean(accessToken && phoneNumberId && templateName);

/**
 * Sends the gift card code via a pre-approved Meta message template — business-initiated messages can't
 * use free-form text outside a 24h customer-reply window, so the template's wording/variable count must
 * already be approved in Meta Business Manager and match this call's parameters exactly.
 */
export async function sendGiftCardCodeWhatsApp(
  phone: string,
  details: { offeringName: string; cardNumber: string; pinCode: string | null },
): Promise<void> {
  if (!isWhatsAppCloudConfigured) {
    throw new Error("WhatsApp isn't configured — set WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_NAME.");
  }
  const normalizedPhone = normalizeKenyanPhone(phone);
  if (!normalizedPhone) {
    throw new Error(`"${phone}" doesn't look like a valid Kenyan phone number.`);
  }

  const bodyParameters = [{ type: "text", text: details.offeringName }, { type: "text", text: details.cardNumber }];
  if (details.pinCode) {
    bodyParameters.push({ type: "text", text: details.pinCode });
  }

  const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizedPhone,
      type: "template",
      template: {
        name: templateName,
        language: { code: "en" },
        components: [{ type: "body", parameters: bodyParameters }],
      },
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    const message = json?.error?.message ?? res.statusText;
    throw new Error(`WhatsApp send failed: ${message}`);
  }
}
