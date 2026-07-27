import "server-only";
import { CONCIERGE_MODEL, getGenAIClient, isConciergeConfigured } from "@/lib/concierge/vertex-client";
import { getDistancesFromOrigin, isGoogleMapsConfigured } from "@/lib/google-maps";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export type RouteStop = {
  deliveryNoteId: string;
  number: string;
  recipientName: string;
  deliveryAddress: string;
  distanceMeters: number | null;
  durationSeconds: number | null;
};

export type SuggestedRoute = {
  riderName: string | null;
  stops: { deliveryNoteId: string; order: number; reason: string }[];
};

export type RoutePlan = { ready: true; stops: RouteStop[]; routes: SuggestedRoute[] } | { ready: false; reason: string };

const ROUTE_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    routes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          riderName: { type: "string", description: "Suggested rider name, or leave empty for an unassigned grouping." },
          stops: {
            type: "array",
            items: {
              type: "object",
              properties: {
                deliveryNoteId: { type: "string" },
                order: { type: "integer" },
                reason: { type: "string", description: "One short phrase, only if it clarifies the grouping. Leave empty otherwise." },
              },
              required: ["deliveryNoteId", "order"],
            },
          },
        },
        required: ["stops"],
      },
    },
  },
  required: ["routes"],
};

type RawRoute = { riderName?: unknown; stops?: unknown };
type RawStop = { deliveryNoteId?: unknown; order?: unknown; reason?: unknown };

async function suggestRoutesWithGemini(stops: RouteStop[], riderNames: string[]): Promise<SuggestedRoute[]> {
  const ai = getGenAIClient();
  const stopsList = stops
    .map((s) => {
      const distanceLabel =
        s.distanceMeters != null
          ? `${(s.distanceMeters / 1000).toFixed(1)}km, ~${Math.round((s.durationSeconds ?? 0) / 60)}min from the store`
          : "distance unknown";
      return `${s.deliveryNoteId}: ${s.recipientName} at ${s.deliveryAddress} — ${distanceLabel}`;
    })
    .join("\n");
  const riderList = riderNames.length > 0 ? riderNames.join(", ") : "no named riders on file — just suggest efficient groupings";
  const prompt = `Plan today's delivery routes for a Kenyan electronics retailer. Available riders: ${riderList}.\n\nPending deliveries (id: recipient at address — real driving distance/time from the store):\n${stopsList}\n\nGroup these into efficient routes — minimize backtracking, keep group sizes reasonable per rider, and order stops within each route sensibly by proximity. If there's only one rider or none named, return a single ordered route.`;

  const response = await ai.models.generateContent({
    model: CONCIERGE_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { responseMimeType: "application/json", responseSchema: ROUTE_RESPONSE_SCHEMA },
  });
  const parsed = JSON.parse((response.text ?? "").trim() || "{}") as { routes?: unknown };
  if (!Array.isArray(parsed.routes)) return [];

  const validIds = new Set(stops.map((s) => s.deliveryNoteId));
  return (parsed.routes as RawRoute[])
    .filter((r): r is RawRoute => typeof r === "object" && r !== null)
    .map((r) => ({
      riderName: typeof r.riderName === "string" && r.riderName.trim() ? r.riderName : null,
      stops: (Array.isArray(r.stops) ? (r.stops as RawStop[]) : [])
        .filter((s) => typeof s.deliveryNoteId === "string" && validIds.has(s.deliveryNoteId))
        .map((s) => ({
          deliveryNoteId: s.deliveryNoteId as string,
          order: Number(s.order) || 0,
          reason: typeof s.reason === "string" ? s.reason : "",
        })),
    }))
    .filter((r) => r.stops.length > 0);
}

/** Nearest-first single route — used when Gemini isn't configured or ranking fails, so the tool still returns something useful. */
function fallbackRoute(stops: RouteStop[]): SuggestedRoute[] {
  const ordered = [...stops].sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
  return [{ riderName: null, stops: ordered.map((s, i) => ({ deliveryNoteId: s.deliveryNoteId, order: i + 1, reason: "" })) }];
}

/**
 * Suggests today's delivery routes: real driving distances from the store (Settings.companyAddress)
 * to each pending delivery via Google Maps Distance Matrix, grouped/ordered by Gemini across
 * available riders. A planning tool, not live GPS tracking — the owner still relays the suggested
 * route to riders over WhatsApp, same as today.
 */
export async function planTodaysRoutes(): Promise<RoutePlan> {
  if (!isGoogleMapsConfigured) {
    return { ready: false, reason: "Google Maps isn't configured — set GOOGLE_MAPS_API_KEY." };
  }

  const settings = await getSettings();
  if (!settings.companyAddress) {
    return { ready: false, reason: "Set a company address in Settings first — it's used as the delivery route origin." };
  }

  const pending = await prisma.deliveryNote.findMany({
    where: { status: "pending" },
    select: { id: true, number: true, recipientName: true, deliveryAddress: true },
    orderBy: { createdAt: "asc" },
  });
  if (pending.length === 0) {
    return { ready: false, reason: "No pending deliveries right now." };
  }

  let stops: RouteStop[];
  try {
    const distances = await getDistancesFromOrigin(
      settings.companyAddress,
      pending.map((p) => p.deliveryAddress),
    );
    stops = pending.map((note, i) => ({
      deliveryNoteId: note.id,
      number: note.number,
      recipientName: note.recipientName,
      deliveryAddress: note.deliveryAddress,
      distanceMeters: distances[i]?.distanceMeters ?? null,
      durationSeconds: distances[i]?.durationSeconds ?? null,
    }));
  } catch (error) {
    console.error("Failed to fetch delivery distances:", error);
    return { ready: false, reason: "Couldn't reach Google Maps — try again shortly." };
  }

  const riders = await prisma.employee.findMany({ where: { active: true }, select: { name: true } });

  let routes: SuggestedRoute[] = [];
  if (isConciergeConfigured) {
    try {
      routes = await suggestRoutesWithGemini(
        stops,
        riders.map((r) => r.name),
      );
    } catch (error) {
      console.error("Gemini route planning failed:", error);
    }
  }
  if (routes.length === 0) routes = fallbackRoute(stops);

  return { ready: true, stops, routes };
}
