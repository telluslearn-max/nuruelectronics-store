import "server-only";
import { CONCIERGE_MODEL, CONCIERGE_TTS_MODEL, getGenAIClient } from "./vertex-client";

const TRANSCRIBE_INSTRUCTION =
  "Transcribe exactly what the speaker says. Output only the transcript text, with no commentary, quotes, or preamble.";

export async function transcribeAudio(audio: { mimeType: string; data: string }): Promise<string> {
  const ai = getGenAIClient();
  const response = await ai.models.generateContent({
    model: CONCIERGE_MODEL,
    contents: [
      {
        role: "user",
        parts: [{ inlineData: { mimeType: audio.mimeType, data: audio.data } }, { text: TRANSCRIBE_INSTRUCTION }],
      },
    ],
  });
  return (response.text ?? "").trim();
}

/** Gemini TTS returns raw 16-bit PCM (`audio/L16;codec=pcm;rate=<n>`), not directly playable — wrap it in a minimal WAV header so the client can just use an <audio> element. */
function pcmToWav(pcmBase64: string, sampleRate: number, channels = 1, bitsPerSample = 16): string {
  const pcm = Buffer.from(pcmBase64, "base64");
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]).toString("base64");
}

export async function synthesizeSpeech(text: string): Promise<{ mimeType: string; data: string }> {
  const ai = getGenAIClient();
  const response = await ai.models.generateContent({
    model: CONCIERGE_TTS_MODEL,
    contents: [{ role: "user", parts: [{ text }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.[0];
  const inlineData = part?.inlineData;
  if (!inlineData?.data) {
    throw new Error("Speech synthesis returned no audio data.");
  }

  const rateMatch = /rate=(\d+)/.exec(inlineData.mimeType ?? "");
  const sampleRate = rateMatch ? Number(rateMatch[1]) : 24000;
  return { mimeType: "audio/wav", data: pcmToWav(inlineData.data, sampleRate) };
}
