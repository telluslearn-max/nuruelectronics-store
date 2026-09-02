import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { findAlternativesFor } from "@/lib/intelligence/service/recommend";
import { parseWeights, positiveNumber } from "@/lib/intelligence/service/params";

/**
 * POST /api/products/alternatives
 *   { handle, weights?, limit?, threshold?, requireAvailable? }
 *
 * "The requested model is unavailable — here's what still does most of what it
 * would have done for you." Ranks the target's category by capability retained
 * for this shopper, then keeps only what's in stock. Read-only, public.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      handle?: string;
      weights?: unknown;
      limit?: unknown;
      threshold?: unknown;
      requireAvailable?: boolean;
    };

    if (!body.handle || typeof body.handle !== "string") {
      return NextResponse.json({ error: "handle is required" }, { status: 400 });
    }

    const results = await findAlternativesFor({
      handle: body.handle,
      weights: parseWeights(body.weights),
      limit: positiveNumber(body.limit),
      threshold: positiveNumber(body.threshold),
      requireAvailable: body.requireAvailable !== false,
    });
    return NextResponse.json({ alternatives: results });
  } catch (error) {
    return jsonError(500, error);
  }
}
