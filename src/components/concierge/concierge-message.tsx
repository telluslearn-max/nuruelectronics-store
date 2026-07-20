import { ProductCard } from "@/components/product-card";
import { ProductCompareTable } from "@/components/product-compare-table";
import type { ConciergeDisplayMessage } from "./use-concierge-messages";
import { ConciergeWhatsAppCta } from "./concierge-whatsapp-cta";

export function ConciergeMessage({
  message,
  autoPlayAudio = false,
}: {
  message: ConciergeDisplayMessage;
  autoPlayAudio?: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[90%] ${isUser ? "" : "w-full"}`}>
        {message.text && (
          <div
            className={
              isUser
                ? "rounded-control bg-foreground px-3.5 py-2 text-sm text-background"
                : "px-1 text-sm leading-relaxed whitespace-pre-wrap"
            }
          >
            {message.text}
          </div>
        )}

        {message.products && message.products.mode === "compare" && message.products.products.length >= 2 && (
          <div className="mt-3 overflow-x-auto rounded-card border border-border-subtle">
            <ProductCompareTable
              current={message.products.products[0]}
              related={message.products.products.slice(1)}
            />
          </div>
        )}

        {message.products &&
          (message.products.mode === "list" || message.products.products.length < 2) &&
          message.products.products.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {message.products.products.slice(0, 6).map((product) => (
                <ProductCard key={product.handle} product={product} />
              ))}
            </div>
          )}

        {message.whatsappMessage && <ConciergeWhatsAppCta message={message.whatsappMessage} />}

        {message.audioUrl && (
          <audio className="mt-2 h-9 w-full" controls autoPlay={autoPlayAudio} src={message.audioUrl} />
        )}
      </div>
    </div>
  );
}
