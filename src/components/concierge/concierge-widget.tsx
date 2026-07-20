"use client";

import { useState } from "react";
import type { ConciergeMessage } from "@/lib/concierge/types";
import { ConciergeLauncherButton } from "./concierge-launcher-button";
import { ConciergePanel } from "./concierge-panel";

export function ConciergeWidget({
  enabled,
  initialMessages = [],
}: {
  enabled: boolean;
  initialMessages?: ConciergeMessage[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!enabled) return null;

  return (
    <>
      {!isOpen && <ConciergeLauncherButton onClick={() => setIsOpen(true)} />}
      {isOpen && <ConciergePanel onClose={() => setIsOpen(false)} initialMessages={initialMessages} />}
    </>
  );
}
