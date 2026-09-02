import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { scoreProduct } from "@/lib/intelligence/service/score";
import { parseWeights } from "@/lib/intelligence/service/params";

/**
 * GET  /api/products/score?handle=galaxy-s25&priorities=camera:4,battery:3
 * POST /api/products/score  { handle, weights? }
 *
 * The NURU Score, plus the personalized Fit Score when priorities are given.
 * Read-only, public.
 */
async function run(handle: string | null, weights: ReturnType<typeof parseWeights>) {
  if (!handle) return NextResponse.json({ error: "handle is required" }, { status: 400 });
  const score = await scoreProduct(handle, weights);
  if (!score) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(score);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return await run(url.searchParams.get("handle"), parseWeights(url.searchParams.get("priorities")));
  } catch (error) {
    return jsonError(500, error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { handle?: string; weights?: unknown };
    return await run(body.handle ?? null, parseWeights(body.weights));
  } catch (error) {
    return jsonError(500, error);
  }
}
