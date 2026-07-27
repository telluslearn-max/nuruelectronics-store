import "server-only";
import { randomUUID } from "crypto";
import { CONCIERGE_MODEL, getGenAIClient, isConciergeConfigured } from "@/lib/concierge/vertex-client";
import { getStorageBucket, isFirebaseStorageConfigured } from "@/lib/firebase-admin";

export type DeliveryPhotoVerification = {
  photoUrl: string;
  photoVerified: boolean | null;
  verificationNote: string | null;
};

const VERIFICATION_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    matches: { type: "boolean", description: "Whether the photo plausibly shows the ordered item(s)." },
    note: { type: "string", description: "One short sentence explaining the verdict, for the shop owner." },
  },
  required: ["matches", "note"],
};

async function uploadPhoto(deliveryNoteId: string, buffer: Buffer, mimeType: string): Promise<string> {
  const bucket = getStorageBucket();
  const extension = mimeType.split("/")[1] ?? "jpg";
  const path = `delivery-photos/${deliveryNoteId}-${randomUUID()}.${extension}`;
  const file = bucket.file(path);
  await file.save(buffer, { contentType: mimeType });
  await file.makePublic();
  return file.publicUrl();
}

/**
 * Gemini Vision cross-checks a delivery photo against the order's line items — advisory only,
 * mirrors the inlineData pattern already used for audio in src/lib/concierge/voice.ts. Never
 * throws: any failure (Storage not configured, Vertex not configured, model error) degrades to
 * "uploaded but unverified" rather than blocking the delivery from being marked complete.
 */
export async function verifyDeliveryPhoto(
  deliveryNoteId: string,
  file: File,
  orderItems: { title: string; quantity: number }[],
): Promise<DeliveryPhotoVerification | null> {
  if (!isFirebaseStorageConfigured) return null;

  let photoUrl: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    photoUrl = await uploadPhoto(deliveryNoteId, buffer, file.type || "image/jpeg");
  } catch (error) {
    console.error("Failed to upload delivery photo:", error);
    return null;
  }

  if (!isConciergeConfigured) {
    return { photoUrl, photoVerified: null, verificationNote: null };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const itemsList = orderItems.map((item) => `${item.quantity}x ${item.title}`).join(", ");
    const ai = getGenAIClient();
    const response = await ai.models.generateContent({
      model: CONCIERGE_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: file.type || "image/jpeg", data: buffer.toString("base64") } },
            {
              text: `This photo was taken by a rider to confirm a delivery. The order was for: ${itemsList}. Does the photo plausibly show this item (or these items) having been delivered? Judge loosely — different angles/packaging/lighting are fine; flag only a clear mismatch (wrong product type, or the photo doesn't show a delivered item at all).`,
            },
          ],
        },
      ],
      config: { responseMimeType: "application/json", responseSchema: VERIFICATION_RESPONSE_SCHEMA },
    });
    const parsed = JSON.parse((response.text ?? "").trim() || "{}") as { matches?: unknown; note?: unknown };
    return {
      photoUrl,
      photoVerified: typeof parsed.matches === "boolean" ? parsed.matches : null,
      verificationNote: typeof parsed.note === "string" ? parsed.note : null,
    };
  } catch (error) {
    console.error("Delivery photo verification failed:", error);
    return { photoUrl, photoVerified: null, verificationNote: null };
  }
}
