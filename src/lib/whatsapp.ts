import "server-only";

const GRAPH_API_VERSION = "v21.0";

const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const webhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

export const isWhatsAppConfigured = Boolean(phoneNumberId && accessToken);

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

async function callGraphApi(path: string, init: RequestInit): Promise<Record<string, unknown>> {
  if (!phoneNumberId || !accessToken) {
    throw new Error("WhatsApp isn't configured yet — set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.");
  }
  const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...init.headers },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`WhatsApp API error: ${(data as { error?: { message?: string } }).error?.message ?? response.statusText}`);
  }
  return data;
}

/**
 * Sends a pre-approved template message with an optional quick-reply button.
 * Business-initiated messages (the customer hasn't texted recently) can only
 * go out as templates Meta has already reviewed — see WHATSAPP_SETUP.md for
 * the exact template text this codebase expects to exist.
 */
export async function sendWhatsAppTemplateMessage(options: {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParams?: string[];
  buttonPayload?: string;
}): Promise<void> {
  await callGraphApi("/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizePhone(options.to),
      type: "template",
      template: {
        name: options.templateName,
        language: { code: options.languageCode ?? "en_US" },
        components: [
          ...(options.bodyParams?.length
            ? [{ type: "body", parameters: options.bodyParams.map((text) => ({ type: "text", text })) }]
            : []),
          ...(options.buttonPayload
            ? [
                {
                  type: "button",
                  sub_type: "quick_reply",
                  index: "0",
                  parameters: [{ type: "payload", payload: options.buttonPayload }],
                },
              ]
            : []),
        ],
      },
    }),
  });
}

/** Uploads a PDF straight from memory (no public URL needed) and returns its WhatsApp media id. */
async function uploadWhatsAppMedia(pdfBuffer: Buffer, filename: string): Promise<string> {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" }), filename);
  const data = await callGraphApi("/media", { method: "POST", body: form });
  return data.id as string;
}

export async function sendWhatsAppDocument(options: {
  to: string;
  pdfBuffer: Buffer;
  filename: string;
  caption?: string;
}): Promise<void> {
  const mediaId = await uploadWhatsAppMedia(options.pdfBuffer, options.filename);
  await callGraphApi("/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizePhone(options.to),
      type: "document",
      document: { id: mediaId, filename: options.filename, caption: options.caption },
    }),
  });
}

/** Echoes Meta's webhook verification challenge back only if the verify token matches ours. */
export function verifyWebhookChallenge(mode: string | null, token: string | null): boolean {
  return mode === "subscribe" && Boolean(webhookVerifyToken) && token === webhookVerifyToken;
}
