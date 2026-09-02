import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { getProductView } from "@/lib/intelligence/service/product-view";

/**
 * GET /api/products/:handle — the merged product view (Shopify commercial
 * facts + NURU normalized specs + NURU Score). 404 if the handle isn't in the
 * catalog. Read-only, public.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const { handle } = await params;
    const view = await getProductView(handle);
    if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(view);
  } catch (error) {
    return jsonError(500, error);
  }
}
