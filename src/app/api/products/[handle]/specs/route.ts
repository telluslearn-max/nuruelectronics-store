import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { resolveDetailedSpecs } from "@/lib/intelligence/service/product-view";

/**
 * GET /api/products/:handle/specs — just the resolved, normalized specs for a
 * product (key, label, group, value, unit, confidence) plus its data
 * completeness. Lighter than the full view. Read-only, public.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const { handle } = await params;
    const profile = await prisma.productProfile.findUnique({ where: { handle } });
    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const specs = await resolveDetailedSpecs(profile.id, profile.category);
    return NextResponse.json({
      handle,
      category: profile.category,
      dataCompleteness: Number(profile.dataCompleteness),
      specs,
    });
  } catch (error) {
    return jsonError(500, error);
  }
}
