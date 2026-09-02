import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { explainProductFit } from "@/lib/intelligence/service/explain-service";
import { parseWeights } from "@/lib/intelligence/service/params";

/**
 * GET /api/products/:handle/explain?priorities=camera:4,battery:3
 *
 * The structured reasoning (strengths / weaknesses / primary drivers) for one
 * product against a shopper's priorities — code-produced, for a model to
 * narrate. Read-only, public.
 */
export async function GET(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const { handle } = await params;
    const weights = parseWeights(new URL(request.url).searchParams.get("priorities"));
    const reasoning = await explainProductFit(handle, weights);
    if (!reasoning) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(reasoning);
  } catch (error) {
    return jsonError(500, error);
  }
}
