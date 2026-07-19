"use client";

import { useState } from "react";
import { ConciergeLauncherButton } from "./concierge-launcher-button";
import { ConciergePanel } from "./concierge-panel";

export function ConciergeWidget({ enabled }: { enabled: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!enabled) return null;

  return (
    <>
      {!isOpen && <ConciergeLauncherButton onClick={() => setIsOpen(true)} />}
      {isOpen && <ConciergePanel onClose={() => setIsOpen(false)} />}
    </>
  );
}
