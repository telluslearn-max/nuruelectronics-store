import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { compareByHandles } from "@/lib/intelligence/service/compare-service";

/**
 * GET  /api/products/compare?handles=galaxy-s25,pixel-9a
 * POST /api/products/compare  { handles: [...] }
 *
 * Side-by-side comparison with per-attribute and per-component winners. 2-4
 * products, all of one category. 422 if the set can't be compared (mixed
 * categories, missing profiles, fewer than two). Read-only, public.
 */
async function run(handles: string[]) {
  const result = await compareByHandles(handles);
  if (!result) {
    return NextResponse.json(
      { error: "Need 2-4 products of the same category with product-intelligence profiles." },
      { status: 422 },
    );
  }
  return NextResponse.json(result);
}

export async function GET(request: Request) {
  try {
    const handles = (new URL(request.url).searchParams.get("handles") ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);
    return await run(handles);
  } catch (error) {
    return jsonError(500, error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { handles?: unknown };
    const handles = Array.isArray(body.handles) ? body.handles.filter((h): h is string => typeof h === "string") : [];
    return await run(handles);
  } catch (error) {
    return jsonError(500, error);
  }
}
