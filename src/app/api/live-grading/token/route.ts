import { GoogleGenAI, Modality } from "@google/genai";
import { NextResponse } from "next/server";
import { LIVE_GRADING_MODEL, LIVE_GRADING_SYSTEM_INSTRUCTION } from "@/lib/live-grading/config";
import { isLiveGradingRateLimited } from "@/lib/live-grading/rate-limit";
import { getClientIp } from "@/lib/request-ip";

const apiKey = process.env.GEMINI_API_KEY;
const isLiveGradingConfigured = Boolean(apiKey);

/**
 * Mints a short-lived, single-use Gemini Live ephemeral token so the browser can connect directly
 * to Gemini's Live WebSocket endpoint — no server-side relay needed. Deliberately on the Gemini
 * Developer API (a separate API key from the Vertex AI service account everything else uses):
 * ephemeral tokens aren't supported on Vertex AI. The model/system-instruction are locked into the
 * token itself (liveConnectConstraints) so a leaked token can't be repurposed for anything else.
 */
export async function POST(request: Request) {
  if (!isLiveGradingConfigured) {
    return NextResponse.json({ error: "Live grading isn't configured." }, { status: 503 });
  }
  if (await isLiveGradingRateLimited(getClientIp(request))) {
    return NextResponse.json({ error: "Too many requests — try again shortly." }, { status: 429 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const authToken = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: LIVE_GRADING_MODEL,
          config: {
            responseModalities: [Modality.TEXT],
            systemInstruction: LIVE_GRADING_SYSTEM_INSTRUCTION,
          },
        },
      },
    });
    if (!authToken.name) throw new Error("No token returned.");
    return NextResponse.json({ token: authToken.name, model: LIVE_GRADING_MODEL });
  } catch (error) {
    console.error("Failed to mint live-grading token:", error);
    return NextResponse.json({ error: "Couldn't start a live session." }, { status: 500 });
  }
}
