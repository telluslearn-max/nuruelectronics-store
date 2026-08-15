"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ConciergeInputBar } from "@/components/concierge/concierge-input-bar";
import { ConciergeMessageList } from "@/components/concierge/concierge-message-list";
import { useConciergeChat } from "@/components/concierge/use-concierge-chat";
import { useConciergeVoice } from "@/components/concierge/use-concierge-voice";
import type { ConciergeDisplayMessage } from "@/components/concierge/use-concierge-messages";
import type { Product } from "@/lib/shopify/types";
import { useExUkInbox, type PersistedMessage } from "./use-ex-uk-inbox";
import { usePersistedConciergeMessages } from "./use-persisted-concierge-messages";

function fromPersisted(messages: PersistedMessage[]): ConciergeDisplayMessage[] {
  return messages.map((m) => ({ ...m }));
}

function ConversationBody({
  product,
  initialMessages,
  onChange,
}: {
  product: Product;
  initialMessages: ConciergeDisplayMessage[];
  onChange: (messages: ConciergeDisplayMessage[]) => void;
}) {
  const [input, setInput] = useState("");
  const store = usePersistedConciergeMessages(initialMessages, onChange);
  const { messages } = store;
  const { isStreaming, send } = useConciergeChat(store);
  const { isVoiceSupported, recordingState, startRecording, stopRecording } = useConciergeVoice(store);
  const hasSentInitialMessage = useRef(false);

  useEffect(() => {
    if (messages.length > 0 || hasSentInitialMessage.current) return;
    hasSentInitialMessage.current = true;
    void send(
      `Tell me more about the ${product.title} — I'm interested in the Ex-UK (unboxed, 1-year warranty) unit.`,
    );
    // Only ever fires once, on a genuinely empty (brand-new) thread.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    // The shell caps at max-w-6xl for Discover's grid; message bubbles use max-w-[90%] of their
    // own container (concierge-message.tsx), so without a narrower cap here they'd stretch
    // almost the full 6xl width on desktop. Keep this a normal chat-width column instead.
    <div className="flex flex-1 flex-col overflow-hidden sm:mx-auto sm:w-full sm:max-w-md">
      <div className="flex-1 overflow-y-auto">
        <ConciergeMessageList messages={messages} isStreaming={isStreaming || recordingState === "processing"} />
      </div>
      <ConciergeInputBar
        input={input}
        onInputChange={setInput}
        onSubmit={(text) => void send(text)}
        isVoiceSupported={isVoiceSupported}
        recordingState={recordingState}
        onStartRecording={() => void startRecording()}
        onStopRecording={stopRecording}
      />
    </div>
  );
}

/** A full-page (not modal) chat scoped to one product, with its own persisted history — the "individual inbox". */
export function ExUkConversation({ product }: { product: Product }) {
  const { threads, saveThread, markRead, hydrated } = useExUkInbox();

  const initialMessages = useMemo(
    () => fromPersisted(threads[product.handle]?.messages ?? []),
    [threads, product.handle],
  );

  // Marked read on open (not after the reply streams in) so a reply that arrives after the
  // shopper navigates away still shows as unread on their next visit.
  useEffect(() => {
    if (!hydrated) return;
    markRead(product.handle);
  }, [hydrated, product.handle, markRead]);

  if (!hydrated) return null;

  return (
    <ConversationBody
      key={product.handle}
      product={product}
      initialMessages={initialMessages}
      onChange={(messages) => saveThread(product.handle, messages)}
    />
  );
}
