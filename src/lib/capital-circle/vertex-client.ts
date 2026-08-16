import "server-only";
import { getGenAIClient, isConciergeConfigured } from "../concierge/vertex-client";

/**
 * Same Vertex AI credentials as the shoppers concierge (GOOGLE_SERVICE_ACCOUNT_*,
 * GOOGLE_CLOUD_PROJECT/LOCATION) — no separate Capital Circle credentials to
 * configure. Re-exported under its own name so callers here don't read as
 * depending on the concierge feature.
 */
export const isCapitalCircleConfigured = isConciergeConfigured;
export { getGenAIClient };
