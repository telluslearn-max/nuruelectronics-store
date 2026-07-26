"use client";

function ChatBubbleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-7Z"
      />
      <path strokeLinecap="round" d="M8 9h8M8 12.5h5" />
    </svg>
  );
}

export function ConciergeFab({
  onClick,
  hasUnread,
}: {
  onClick: () => void;
  hasUnread: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Chat with our AI shopping concierge"
      className="relative flex h-14 w-14 animate-scale-in items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition hover:brightness-110"
    >
      <ChatBubbleIcon className="h-6 w-6" />
      {hasUnread && (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-red-500 ring-2 ring-background"
        />
      )}
    </button>
  );
}
