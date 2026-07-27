import "server-only";

const apiKey = process.env.GOOGLE_MAPS_API_KEY;

export const isGoogleMapsConfigured = Boolean(apiKey);

export type DestinationDistance = {
  destination: string;
  distanceMeters: number | null;
  durationSeconds: number | null;
  /** True when Google couldn't resolve/route to this address — caller should surface it rather than silently drop it. */
  error: boolean;
};

/**
 * Real driving distance/duration from one origin to each destination, via the Google Maps
 * Platform Distance Matrix API — used by src/lib/logistics/route-planner.ts to ground rider
 * dispatch suggestions in actual geography instead of guessing from addresses alone.
 */
export async function getDistancesFromOrigin(
  origin: string,
  destinations: string[],
): Promise<DestinationDistance[]> {
  if (!isGoogleMapsConfigured) {
    throw new Error("Google Maps isn't configured — set GOOGLE_MAPS_API_KEY.");
  }
  if (destinations.length === 0) return [];

  const params = new URLSearchParams({
    origins: origin,
    destinations: destinations.join("|"),
    mode: "driving",
    key: apiKey as string,
  });
  const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`, {
    cache: "no-store",
  });
  const json = await res.json();
  if (json.status !== "OK") {
    throw new Error(`Google Distance Matrix error: ${json.status}${json.error_message ? ` — ${json.error_message}` : ""}`);
  }

  const elements: { status: string; distance?: { value: number }; duration?: { value: number } }[] =
    json.rows?.[0]?.elements ?? [];

  return destinations.map((destination, i) => {
    const element = elements[i];
    const ok = element?.status === "OK";
    return {
      destination,
      distanceMeters: ok ? (element.distance?.value ?? null) : null,
      durationSeconds: ok ? (element.duration?.value ?? null) : null,
      error: !ok,
    };
  });
}
