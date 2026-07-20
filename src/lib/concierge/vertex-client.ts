import "server-only";
import { GoogleGenAI } from "@google/genai";

const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.GOOGLE_CLOUD_LOCATION;

export const isConciergeConfigured = Boolean(
  serviceAccountEmail && serviceAccountPrivateKey && project && location,
);

/** Pinned explicitly rather than an alias, so a model swap is a deliberate change. */
export const CONCIERGE_MODEL = "gemini-2.5-flash";

/** Dedicated Gemini TTS model for the voice concierge's spoken replies. */
export const CONCIERGE_TTS_MODEL = "gemini-2.5-flash-preview-tts";

let client: GoogleGenAI | null = null;

export function getGenAIClient(): GoogleGenAI {
  if (!isConciergeConfigured) {
    throw new Error(
      "Concierge isn't configured — set GOOGLE_SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY, GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION.",
    );
  }
  if (!client) {
    client = new GoogleGenAI({
      vertexai: true,
      project,
      location,
      googleAuthOptions: {
        credentials: {
          client_email: serviceAccountEmail,
          private_key: serviceAccountPrivateKey,
        },
      },
    });
  }
  return client;
}
