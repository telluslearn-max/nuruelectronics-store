import { ConciergeMessageList } from "./concierge-message-list";
import type { ConciergeDisplayMessage } from "./use-concierge-messages";

export function ConciergeSheet({
  messages,
  isStreaming,
  onCollapse,
  children,
}: {
  messages: ConciergeDisplayMessage[];
  isStreaming: boolean;
  onCollapse: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-label="Shopping concierge"
      className="flex w-[calc(100vw-2rem)] max-w-sm max-h-[70vh] origin-bottom-right animate-scale-in flex-col overflow-hidden rounded-card border border-border-subtle bg-background shadow-2xl md:w-96 md:max-h-[32rem]"
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
      {children}
    </div>
  );
}
