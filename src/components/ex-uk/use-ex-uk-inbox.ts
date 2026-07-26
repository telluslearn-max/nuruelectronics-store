"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConciergeDisplayMessage } from "@/components/concierge/use-concierge-messages";

/**
 * What we persist per message. Deliberately narrower than ConciergeDisplayMessage —
 * `products` (full Product[] payloads) and `audioUrl` (base64 audio) are dropped so a
 * long-running conversation doesn't blow past localStorage's size limit. Re-asking a
 * product question after reload just re-fetches those via the concierge's tools.
 */
export type PersistedMessage = {
  id: string;
  role: "user" | "model";
  text: string;
  checkoutUrl?: string;
  whatsappMessage?: string;
};

export type PersistedThread = {
  messages: PersistedMessage[];
  updatedAt: number;
};

const STORAGE_KEY = "nuru:ex-uk-inbox";
const LAST_READ_KEY = "nuru:ex-uk-last-read";

function toPersisted(messages: ConciergeDisplayMessage[]): PersistedMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    text: m.text,
    checkoutUrl: m.checkoutUrl,
    whatsappMessage: m.whatsappMessage,
  }));
}

function readStoredThreads(): Record<string, PersistedThread> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, PersistedThread>) : {};
  } catch {
    return {};
  }
}

function readLastRead(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(LAST_READ_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

type InboxState = {
  threads: Record<string, PersistedThread>;
  // When each thread was last viewed — a thread is "unread" when its updatedAt is newer than
  // this, not merely "has any messages" (every matched product gets an initial message, so
  // that would flag almost every match as unread forever).
  lastRead: Record<string, number>;
  // Reading localStorage only happens after mount, so callers that seed a one-time initial
  // value from `threads` (e.g. usePersistedConciergeMessages) must wait for this to flip true
  // first — otherwise they'd lock in an empty history before it has loaded.
  hydrated: boolean;
};

/** Per-product conversation history — each matched product gets its own persisted "inbox". */
export function useExUkInbox() {
  const [state, setState] = useState<InboxState>({ threads: {}, lastRead: {}, hydrated: false });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ threads: readStoredThreads(), lastRead: readLastRead(), hydrated: true });
  }, []);

  const saveThread = useCallback((handle: string, messages: ConciergeDisplayMessage[]) => {
    setState((prev) => {
      const threads = { ...prev.threads, [handle]: { messages: toPersisted(messages), updatedAt: Date.now() } };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
      return { ...prev, threads };
    });
  }, []);

  // Called when a thread's conversation screen is opened, so messages that arrive after the
  // shopper leaves still count as unread on their next visit.
  const markRead = useCallback((handle: string) => {
    setState((prev) => {
      const lastRead = { ...prev.lastRead, [handle]: Date.now() };
      window.localStorage.setItem(LAST_READ_KEY, JSON.stringify(lastRead));
      return { ...prev, lastRead };
    });
  }, []);

  return { threads: state.threads, lastRead: state.lastRead, saveThread, markRead, hydrated: state.hydrated };
}
