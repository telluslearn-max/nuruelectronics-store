import "server-only";
import type { FunctionDeclaration } from "@google/genai";
import { getCart } from "@/lib/actions";
import type { Product } from "@/lib/shopify/types";
import { addToCartTool } from "./cart-tools";
import { compareProducts, getProductDetails, listKitsOrEcosystems, searchProducts } from "./catalog-tools";
import type { ConciergeEvent } from "./types";
import { buildWhatsAppHandoffMessage, isWhatsAppHandoffConfigured } from "./whatsapp-tool";

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
        return {
          resultForModel: { ok: true, totalQuantity: cart.totalQuantity, totalAmount: cart.cost.totalAmount },
          events: [{ type: "cart", cart }],
        };
      } catch (error) {
        return {
          resultForModel: { error: error instanceof Error ? error.message : "Failed to add to cart." },
          events: [],
        };
      }
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
