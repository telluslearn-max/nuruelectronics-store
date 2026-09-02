import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { searchProductIntelligence, type ProductSearchParams } from "@/lib/intelligence/service/search";
import { positiveNumber } from "@/lib/intelligence/service/params";

/**
 * GET  /api/products/search?q=best+gaming+phone+under+40k
 * GET  /api/products/search?category=smartphone&budgetMax=50000&brand=Samsung
 * POST /api/products/search  { query?, categoryId?, budgetMin?, budgetMax?, brand?, limit? }
 *
 * The internal product-intelligence search — structured filters (parsed from
 * the query when not given explicitly) plus semantic ranking. Read-only, public.
 */

async function run(params: ProductSearchParams) {
  return NextResponse.json(await searchProductIntelligence(params));
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return await run({
      query: url.searchParams.get("q") ?? undefined,
      categoryId: url.searchParams.get("category") ?? undefined,
      budgetMin: positiveNumber(url.searchParams.get("budgetMin")),
      budgetMax: positiveNumber(url.searchParams.get("budgetMax")),
      brand: url.searchParams.get("brand") ?? undefined,
      limit: positiveNumber(url.searchParams.get("limit")),
    });
  } catch (error) {
    return jsonError(500, error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProductSearchParams;
    return await run({
      query: body.query,
      categoryId: body.categoryId,
      budgetMin: positiveNumber(body.budgetMin),
      budgetMax: positiveNumber(body.budgetMax),
      brand: body.brand,
      limit: positiveNumber(body.limit),
    });
  } catch (error) {
    return jsonError(500, error);
  }
}
