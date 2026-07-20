import type { Cart, Product } from "@/lib/shopify/types";

export type ConciergeMessage = {
  role: "user" | "model";
  text: string;
};

export type ConciergeEvent =
  | { type: "text-delta"; text: string }
  | { type: "products"; mode: "list" | "compare"; products: Product[] }
  | { type: "cart"; cart: Cart }
  | { type: "whatsapp"; message: string }
  | { type: "transcript"; text: string }
  | { type: "audio"; data: string; mimeType: string }
  | { type: "error"; message: string }
  | { type: "done" };
