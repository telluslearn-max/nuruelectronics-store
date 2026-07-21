import type { Cart, Product } from "@/lib/shopify/types";

export type ConciergeMessage = {
  role: "user" | "model";
  text: string;
};

/** What page the shopper is currently on, so the concierge can act on it without being told. */
export type ConciergePageContext = {
  productHandle?: string;
};

export type ConciergeEvent =
  | { type: "text-delta"; text: string }
  | { type: "products"; mode: "list" | "compare"; products: Product[]; autoNavigate?: boolean }
  | { type: "cart"; cart: Cart }
  | { type: "whatsapp"; message: string }
  | { type: "checkout"; url: string }
  | { type: "transcript"; text: string }
  | { type: "audio"; data: string; mimeType: string }
  | { type: "error"; message: string }
  | { type: "done" };
