import { ConciergeMessageList } from "./concierge-message-list";
import type { ConciergeDisplayMessage } from "./use-concierge-messages";

export function ConciergeSheet({
  messages,
  isStreaming,
  onCollapse,
}: {
  messages: ConciergeDisplayMessage[];
  isStreaming: boolean;
  onCollapse: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shopping concierge"
      className="flex max-h-[75vh] animate-slide-up flex-col rounded-t-card border border-b-0 border-border-subtle bg-background shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-border-subtle p-4">
        <h2 className="text-base font-semibold">Shopping concierge</h2>
        <button
          onClick={onCollapse}
          aria-label="Collapse concierge"
          className="flex h-9 w-9 items-center justify-center rounded-control text-2xl leading-none hover:bg-neutral-100"
        >
          &times;
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ConciergeMessageList messages={messages} isStreaming={isStreaming} />
      </div>
    </div>
  );
}
