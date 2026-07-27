import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { planTodaysRoutes } from "@/lib/logistics/route-planner";

export const metadata: Metadata = { title: "Today's Delivery Routes" };

function formatDistance(meters: number | null) {
  if (meters == null) return "unknown distance";
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return "";
  return ` · ~${Math.round(seconds / 60)} min`;
}

export default async function RoutePlannerPage() {
  await requireAdminSession();

  const plan = await planTodaysRoutes();

  return (
    <div>
      <h2 className="text-lg font-medium">Today&apos;s Delivery Routes</h2>
      <p className="mt-2 text-neutral-500">
        Real driving distances from the store to each pending delivery (Google Maps), grouped into suggested
        routes across available riders (Gemini). Still a planning tool — relay the route to riders yourself,
        same as today.
      </p>

      {!plan.ready ? (
        <p className="mt-6 rounded-card border border-border-subtle p-4 text-sm text-neutral-500">{plan.reason}</p>
      ) : (
        <div className="mt-6 space-y-6">
          {plan.routes.map((route, i) => {
            const stopsByOrder = [...route.stops].sort((a, b) => a.order - b.order);
            return (
              <div key={i} className="rounded-card border border-border-subtle p-5">
                <h3 className="font-medium">{route.riderName ?? `Route ${i + 1}`}</h3>
                <ol className="mt-3 space-y-3">
                  {stopsByOrder.map((routeStop) => {
                    const stop = plan.stops.find((s) => s.deliveryNoteId === routeStop.deliveryNoteId);
                    if (!stop) return null;
                    return (
                      <li key={stop.deliveryNoteId} className="flex items-start gap-3 text-sm">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-medium">
                          {routeStop.order}
                        </span>
                        <div>
                          <p className="font-medium">
                            {stop.recipientName} <span className="font-normal text-neutral-500">({stop.number})</span>
                          </p>
                          <p className="text-neutral-500">{stop.deliveryAddress}</p>
                          <p className="text-xs text-neutral-400">
                            {formatDistance(stop.distanceMeters)}
                            {formatDuration(stop.durationSeconds)}
                            {routeStop.reason && ` · ${routeStop.reason}`}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
