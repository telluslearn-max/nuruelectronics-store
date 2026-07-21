"use client";

import type { ConciergeMessage } from "@/lib/concierge/types";
import { ConciergeDock } from "./concierge-dock";
import { useConciergeMessages } from "./use-concierge-messages";

export function ConciergeWidget({
  enabled,
  initialMessages = [],
}: {
  enabled: boolean;
  initialMessages?: ConciergeMessage[];
}) {
  const store = useConciergeMessages(initialMessages);

  if (!enabled) return null;

  return <ConciergeDock store={store} />;
}
