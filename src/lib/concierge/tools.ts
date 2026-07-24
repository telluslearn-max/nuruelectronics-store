import "server-only";
import type { FunctionDeclaration } from "@google/genai";
import { getCart, markCartConciergeAssisted } from "@/lib/actions";
import { logAdminAction } from "@/lib/audit-log";
import type { BnplPlanId } from "@/lib/bnpl";
import type { Cart, Product } from "@/lib/shopify/types";
import { explainBnplPlan } from "./bnpl-tool";
import { addToCartTool, removeCartItem, updateCartItemQuantity } from "./cart-tools";
import { compareProducts, getProductDetails, listKitsOrEcosystems, searchProducts } from "./catalog-tools";
import { getExUkSavings } from "./ex-uk-tool";
import type { ConciergeEvent } from "./types";
import { buildWhatsAppHandoffMessage, isWhatsAppHandoffConfigured } from "./whatsapp-tool";

/** Compact, model-facing projection of a cart's lines — line ids so the model can reference an item again to remove/adjust it. */
function summarizeCartLines(cart: Cart) {
  return cart.lines.map((line) => ({
    lineId: line.id,
    productTitle: line.merchandise.product.title,
    variantTitle: line.merchandise.title,
    quantity: line.quantity,
    price: line.cost.totalAmount,
  }));
}

/** Compact, model-facing projection of a Product — drops descriptionHtml/images to keep tool results focused on facts the model needs to cite (price, specs, ids), not bloat. */
function summarizeProduct(product: Product) {
  return {
    handle: product.handle,
    title: product.title,
    productType: product.productType,
    vendor: product.vendor,
    tags: product.tags,
    availableForSale: product.availableForSale,
    priceRange: product.priceRange,
    options: product.options,
    variants: product.variants.map((v) => ({
      id: v.id,
      title: v.title,
      price: v.price,
      availableForSale: v.availableForSale,
      selectedOptions: v.selectedOptions,
    })),
    specs: product.specs ?? [],
  };
}

const searchProductsDeclaration: FunctionDeclaration = {
  name: "search_products",
  description:
    "Search the live product catalog by free text, category, ecosystem/brand, or curated kit slug. Returns real, in-stock-aware product data — never invent products.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Free-text search, e.g. a product name or keyword." },
      categorySlug: { type: "string", description: "A categorySlug from the system prompt, e.g. \"phones\"." },
      ecosystemSlug: { type: "string", description: "An ecosystemSlug from the system prompt, e.g. \"samsung\"." },
      kitSlug: { type: "string", description: "A kitSlug from the system prompt, e.g. \"content-creator\"." },
      first: { type: "integer", description: "Max results to return. Defaults to 8." },
    },
  },
};

const getProductDetailsDeclaration: FunctionDeclaration = {
  name: "get_product_details",
  description: "Get full details (specs, variants, price, availability) for one product by its handle.",
  parametersJsonSchema: {
    type: "object",
    properties: { handle: { type: "string" } },
    required: ["handle"],
  },
};

const compareProductsDeclaration: FunctionDeclaration = {
  name: "compare_products",
  description: "Fetch full specs/price/availability for 2-4 products side by side, by their handles, for a direct comparison.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      handles: {
        type: "array",
        items: { type: "string" },
        description: "2-4 product handles to compare.",
      },
    },
    required: ["handles"],
  },
};

const listKitsOrEcosystemsDeclaration: FunctionDeclaration = {
  name: "list_kits_or_ecosystems",
  description: "List the curated kits and/or brand ecosystems with their slugs and blurbs, to recommend a ready-made bundle by name.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["kits", "ecosystems", "both"] },
    },
    required: ["kind"],
  },
};

const addToCartDeclaration: FunctionDeclaration = {
  name: "add_to_cart",
  description: "Add a specific product variant to the shopper's cart. Only call this once the exact variant (color/storage/etc.) is confirmed if the product has more than one.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      variantId: { type: "string", description: "An exact variant id from a prior search/details/compare tool result — never invent one." },
      quantity: { type: "integer", description: "Defaults to 1." },
    },
    required: ["variantId"],
  },
};

const getCartDeclaration: FunctionDeclaration = {
  name: "get_cart",
  description:
    "Get the shopper's current cart contents (line ids, product/variant titles, quantities, prices) and totals. Call this before removing or adjusting an item if you don't already know its lineId, or when the shopper asks what's in their cart.",
  parametersJsonSchema: { type: "object", properties: {} },
};

const removeFromCartDeclaration: FunctionDeclaration = {
  name: "remove_from_cart",
  description: "Remove a line item from the shopper's cart entirely.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      lineId: { type: "string", description: "The exact cart line id from a prior add_to_cart or get_cart result — never invent one." },
    },
    required: ["lineId"],
  },
};

const updateCartQuantityDeclaration: FunctionDeclaration = {
  name: "update_cart_quantity",
  description: "Change the quantity of a line item already in the cart. Setting quantity to 0 removes it.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      lineId: { type: "string", description: "The exact cart line id from a prior add_to_cart or get_cart result — never invent one." },
      quantity: { type: "integer", description: "The new quantity (0 removes the item)." },
    },
    required: ["lineId", "quantity"],
  },
};

const getExUkSavingsDeclaration: FunctionDeclaration = {
  name: "get_ex_uk_savings",
  description:
    "Look up the exact savings between an Ex-UK (unboxed, imported) unit and its equivalent brand-new listing, from either product's handle. Never state or estimate an Ex-UK savings amount/percent without calling this first.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      handle: { type: "string", description: "Handle of either the Ex-UK unit or the equivalent new listing." },
    },
    required: ["handle"],
  },
};

const explainBnplPlanDeclaration: FunctionDeclaration = {
  name: "explain_bnpl_plan",
  description:
    "Look up the real Buy Now, Pay Later terms for a product by its handle — deposit, installment amount, and eligibility requirements. Never state BNPL numbers or eligibility without calling this first; BNPL is only live for some brands today.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      handle: { type: "string", description: "The product handle to check BNPL terms for." },
      planId: { type: "string", enum: ["weekly", "monthly"], description: "Defaults to \"weekly\" if not specified." },
    },
    required: ["handle"],
  },
};

const openCheckoutDeclaration: FunctionDeclaration = {
  name: "open_checkout",
  description: "Surface the real checkout link once the shopper is ready to pay. Only call this once they've indicated they're done deciding.",
  parametersJsonSchema: { type: "object", properties: {} },
};

const openWhatsAppHandoffDeclaration: FunctionDeclaration = {
  name: "open_whatsapp_handoff",
  description: "Hand the shopper off to a real staff member on WhatsApp — e.g. when they want to finalize a custom/bulk order or explicitly ask for a human.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "A concise summary of the shopper's request, for the human staff member." },
    },
    required: ["summary"],
  },
};

export const functionDeclarations: FunctionDeclaration[] = [
  searchProductsDeclaration,
  getProductDetailsDeclaration,
  compareProductsDeclaration,
  listKitsOrEcosystemsDeclaration,
  addToCartDeclaration,
  getCartDeclaration,
  removeFromCartDeclaration,
  updateCartQuantityDeclaration,
  explainBnplPlanDeclaration,
  getExUkSavingsDeclaration,
  openCheckoutDeclaration,
  ...(isWhatsAppHandoffConfigured ? [openWhatsAppHandoffDeclaration] : []),
];

export async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ resultForModel: unknown; events: ConciergeEvent[] }> {
  switch (name) {
    case "search_products": {
      const products = await searchProducts({
        query: typeof args.query === "string" ? args.query : undefined,
        categorySlug: typeof args.categorySlug === "string" ? args.categorySlug : undefined,
        ecosystemSlug: typeof args.ecosystemSlug === "string" ? args.ecosystemSlug : undefined,
        kitSlug: typeof args.kitSlug === "string" ? args.kitSlug : undefined,
        first: typeof args.first === "number" ? args.first : undefined,
      });
      return {
        resultForModel: products.map(summarizeProduct),
        events: products.length ? [{ type: "products", mode: "list", products }] : [],
      };
    }

    case "get_product_details": {
      const handle = typeof args.handle === "string" ? args.handle : "";
      const product = handle ? await getProductDetails(handle) : null;
      return {
        resultForModel: product ? summarizeProduct(product) : { error: "Product not found." },
        events: product ? [{ type: "products", mode: "list", products: [product] }] : [],
      };
    }

    case "compare_products": {
      const handles = Array.isArray(args.handles)
        ? args.handles.filter((h): h is string => typeof h === "string")
        : [];
      const products = await compareProducts(handles);
      return {
        resultForModel: products.map(summarizeProduct),
        events:
          products.length >= 2
            ? [{ type: "products", mode: "compare", products }]
            : products.length === 1
              ? [{ type: "products", mode: "list", products }]
              : [],
      };
    }

    case "list_kits_or_ecosystems": {
      const kind = args.kind === "kits" || args.kind === "ecosystems" ? args.kind : "both";
      return { resultForModel: listKitsOrEcosystems(kind), events: [] };
    }

    case "add_to_cart": {
      const variantId = typeof args.variantId === "string" ? args.variantId : "";
      const quantity = typeof args.quantity === "number" ? args.quantity : 1;
      if (!variantId) {
        return { resultForModel: { error: "Missing variantId." }, events: [] };
      }
      try {
        const cart = await addToCartTool({ variantId, quantity });
        // Best-effort attribution/audit — never let instrumentation failures block a real add-to-cart.
        void markCartConciergeAssisted().catch((error) => console.error("markCartConciergeAssisted failed", error));
        void logAdminAction({
          action: "concierge.add_to_cart",
          entityType: "cart",
          entityId: cart.id,
          summary: `AI concierge added variant ${variantId} (qty ${quantity}) to cart`,
          metadata: { variantId, quantity },
        }).catch((error) => console.error("logAdminAction failed", error));
        const line = cart.lines.find((l) => l.merchandise.id === variantId);
        return {
          resultForModel: {
            ok: true,
            lineId: line?.id,
            totalQuantity: cart.totalQuantity,
            totalAmount: cart.cost.totalAmount,
          },
          events: [{ type: "cart", cart }],
        };
      } catch (error) {
        return {
          resultForModel: { error: error instanceof Error ? error.message : "Failed to add to cart." },
          events: [],
        };
      }
    }

    case "get_cart": {
      const cart = await getCart();
      if (!cart || cart.lines.length === 0) {
        return { resultForModel: { lines: [], totalQuantity: 0 }, events: [] };
      }
      return {
        resultForModel: {
          lines: summarizeCartLines(cart),
          totalQuantity: cart.totalQuantity,
          totalAmount: cart.cost.totalAmount,
        },
        events: [{ type: "cart", cart }],
      };
    }

    case "remove_from_cart": {
      const lineId = typeof args.lineId === "string" ? args.lineId : "";
      if (!lineId) return { resultForModel: { error: "Missing lineId." }, events: [] };
      try {
        const cart = await removeCartItem(lineId);
        return { resultForModel: { ok: true, totalQuantity: cart.totalQuantity }, events: [{ type: "cart", cart }] };
      } catch (error) {
        return {
          resultForModel: { error: error instanceof Error ? error.message : "Failed to remove item." },
          events: [],
        };
      }
    }

    case "update_cart_quantity": {
      const lineId = typeof args.lineId === "string" ? args.lineId : "";
      const quantity = typeof args.quantity === "number" ? args.quantity : NaN;
      if (!lineId || Number.isNaN(quantity)) {
        return { resultForModel: { error: "Missing lineId or quantity." }, events: [] };
      }
      try {
        const cart = await updateCartItemQuantity(lineId, quantity);
        return { resultForModel: { ok: true, totalQuantity: cart.totalQuantity }, events: [{ type: "cart", cart }] };
      } catch (error) {
        return {
          resultForModel: { error: error instanceof Error ? error.message : "Failed to update quantity." },
          events: [],
        };
      }
    }

    case "explain_bnpl_plan": {
      const handle = typeof args.handle === "string" ? args.handle : "";
      const planId: BnplPlanId = args.planId === "monthly" ? "monthly" : "weekly";
      if (!handle) {
        return { resultForModel: { error: "Missing handle." }, events: [] };
      }
      const result = await explainBnplPlan(handle, planId);
      if ("applicationMessage" in result) {
        return {
          resultForModel: {
            eligible: true,
            plan: {
              label: result.label,
              itemPrice: result.itemPrice,
              deposit: result.deposit,
              installment: result.installment,
              termCount: result.termCount,
              termUnit: result.termUnit,
              totalPayable: result.totalPayable,
              currencyCode: result.currencyCode,
            },
            requirements: result.requirements,
          },
          events: [{ type: "whatsapp", message: result.applicationMessage }],
        };
      }
      if ("waitlistMessage" in result) {
        return {
          resultForModel: { eligible: false, comingSoonBrand: result.comingSoonBrand },
          events: [{ type: "whatsapp", message: result.waitlistMessage }],
        };
      }
      return { resultForModel: result, events: [] };
    }

    case "get_ex_uk_savings": {
      const handle = typeof args.handle === "string" ? args.handle : "";
      if (!handle) {
        return { resultForModel: { error: "Missing handle." }, events: [] };
      }
      const result = await getExUkSavings(handle);
      return { resultForModel: result, events: [] };
    }

    case "open_checkout": {
      const cart = await getCart();
      if (!cart || cart.lines.length === 0) {
        return { resultForModel: { error: "Cart is empty — nothing to check out yet." }, events: [] };
      }
      void markCartConciergeAssisted().catch((error) => console.error("markCartConciergeAssisted failed", error));
      void logAdminAction({
        action: "concierge.open_checkout",
        entityType: "cart",
        entityId: cart.id,
        summary: "AI concierge surfaced the checkout link",
      }).catch((error) => console.error("logAdminAction failed", error));
      return { resultForModel: { ok: true, url: cart.checkoutUrl }, events: [{ type: "checkout", url: cart.checkoutUrl }] };
    }

    case "open_whatsapp_handoff": {
      const summary = typeof args.summary === "string" ? args.summary : "";
      const cart = await getCart();
      const message = buildWhatsAppHandoffMessage({ summary, cart });
      return { resultForModel: { ok: true }, events: [{ type: "whatsapp", message }] };
    }

    default:
      return { resultForModel: { error: `Unknown tool "${name}".` }, events: [] };
  }
}
