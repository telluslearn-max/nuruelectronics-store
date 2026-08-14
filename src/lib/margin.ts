/**
 * Margin math shared by the manual-order form (live preview as staff type) and the order detail
 * page (stored summary). Margin % is always relative to revenue (unitPrice), the standard
 * "gross margin %" definition — not relative to cost.
 */

export type LineMarginInput = {
  unitPrice: number;
  unitCost: number | null;
  quantity: number;
};

export type LineMargin = {
  marginAmount: number;
  marginPercent: number | null;
};

export function computeLineMargin({ unitPrice, unitCost, quantity }: LineMarginInput): LineMargin {
  if (unitCost == null) return { marginAmount: 0, marginPercent: null };
  const marginAmount = (unitPrice - unitCost) * quantity;
  const marginPercent = unitPrice > 0 ? ((unitPrice - unitCost) / unitPrice) * 100 : null;
  return { marginAmount, marginPercent };
}

export type OrderMarginSummary = {
  revenue: number;
  cost: number;
  grossMargin: number;
  grossMarginPercent: number | null;
  riderCost: number;
  netMargin: number;
  netMarginPercent: number | null;
  hasCostData: boolean;
};

export function computeOrderMargin(items: LineMarginInput[], riderCost: number): OrderMarginSummary {
  const revenue = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const hasCostData = items.some((item) => item.unitCost != null);
  const cost = items.reduce((sum, item) => sum + (item.unitCost ?? 0) * item.quantity, 0);
  const grossMargin = revenue - cost;
  const grossMarginPercent = revenue > 0 ? (grossMargin / revenue) * 100 : null;
  const netMargin = grossMargin - riderCost;
  const netMarginPercent = revenue > 0 ? (netMargin / revenue) * 100 : null;

  return { revenue, cost, grossMargin, grossMarginPercent, riderCost, netMargin, netMarginPercent, hasCostData };
}
