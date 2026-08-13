import "server-only";
import { prisma } from "./prisma";

export type ProductFeedbackSummary = {
  productHandle: string;
  averageRating: number | null;
  ratingCount: number;
  commentCount: number;
};

/** Groups Feedback by productHandle for a per-SKU average rating / comment count — the small
 * aggregation task 5 asks for, surfaced wherever a per-product feedback rollup is useful (e.g. a
 * future admin products/reports view). Only covers Feedback rows a productHandle was set on. */
export async function getFeedbackSummaryByProduct(): Promise<ProductFeedbackSummary[]> {
  const rows = await prisma.feedback.groupBy({
    by: ["productHandle"],
    where: { productHandle: { not: null } },
    _avg: { rating: true },
    _count: { rating: true, comment: true },
  });

  return rows
    .filter((row): row is typeof row & { productHandle: string } => row.productHandle !== null)
    .map((row) => ({
      productHandle: row.productHandle,
      averageRating: row._avg.rating,
      ratingCount: row._count.rating,
      commentCount: row._count.comment,
    }));
}
