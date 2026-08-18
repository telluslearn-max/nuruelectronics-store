import { ProductCompareTable } from "@/components/product-compare-table";
import { ConciergeCheckoutCta } from "./concierge-checkout-cta";
import { ConciergeMarkdown } from "./concierge-markdown";
import { ConciergeProductCard } from "./concierge-product-card";
import { ConciergeProductRecommendations } from "./concierge-product-recommendations";
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
        {message.text &&
          (isUser ? (
            <div className="rounded-control bg-foreground px-3.5 py-2 text-sm text-background whitespace-pre-wrap">
              {message.text}
            </div>
          ) : (
            <div className="px-1 text-sm leading-relaxed">
              <ConciergeMarkdown text={message.text} />
            </div>
          ))}

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
          message.products.products.length > 0 &&
          (message.products.products.length === 1 ? (
            <div className="mt-3">
              <ConciergeProductCard product={message.products.products[0]} />
            </div>
          ) : (
            <ConciergeProductRecommendations products={message.products.products} />
          ))}

        {message.whatsappMessage && <ConciergeWhatsAppCta message={message.whatsappMessage} />}

        {message.checkoutUrl && <ConciergeCheckoutCta url={message.checkoutUrl} />}

        {message.audioUrl && (
          <audio className="mt-2 h-9 w-full" controls autoPlay={autoPlayAudio} src={message.audioUrl} />
        )}

        {message.errorNote && <p className="mt-1.5 px-1 text-xs text-neutral-400">{message.errorNote}</p>}
      </div>
    </div>
  );
}
