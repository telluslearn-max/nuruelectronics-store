import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { recommendProducts } from "@/lib/intelligence/service/recommend";
import { parseWeights, positiveNumber } from "@/lib/intelligence/service/params";

/**
 * POST /api/products/recommend
 *   { categoryId, weights: { camera: 4, battery: 3, ... }, budgetMin?, budgetMax?, brand?, limit?, requireAvailable? }
 *
 * Ranked, in-budget, in-stock recommendations for a shopper's priorities, each
 * with the structured reasoning (strengths / weaknesses / primary drivers) the
 * conversational layer narrates. `weights` come from the concierge's reading of
 * the shopper's own words. Read-only, public.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      categoryId?: string;
      weights?: unknown;
      budgetMin?: unknown;
      budgetMax?: unknown;
      brand?: string;
      limit?: unknown;
      requireAvailable?: boolean;
    };

    if (!body.categoryId || typeof body.categoryId !== "string") {
      return NextResponse.json({ error: "categoryId is required" }, { status: 400 });
    }

    const results = await recommendProducts({
      categoryId: body.categoryId,
      weights: parseWeights(body.weights),
      budgetMin: positiveNumber(body.budgetMin),
      budgetMax: positiveNumber(body.budgetMax),
      brand: typeof body.brand === "string" ? body.brand : undefined,
      limit: positiveNumber(body.limit),
      requireAvailable: body.requireAvailable !== false,
    });
    return NextResponse.json({ products: results });
  } catch (error) {
    return jsonError(500, error);
  }
}
