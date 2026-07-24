import "server-only";
import { prisma } from "../prisma";

export type RiderImpactRow = {
  riderId: string;
  name: string;
  deliveriesCompleted: number;
  totalPaid: number;
};

export type RidersImpactSummary = {
  activeRiders: number;
  totalDeliveries: number;
  totalPaidOut: number;
};

export type RidersImpactReport = {
  rows: RiderImpactRow[];
  summary: RidersImpactSummary;
};

/**
 * Real, countable gig-job-creation evidence: which active employees have completed at least one
 * delivery (tagged via riderId when a delivery note is marked delivered — see markDelivered in
 * src/lib/admin-actions.ts), how many, and their total payroll payout. Payslips aren't itemized
 * per-delivery, so `totalPaid` is a rider's total net pay across all payslips, not a per-delivery
 * breakdown — a reasonable approximation given how thin the current payroll data is.
 */
export async function getRidersImpactReport(): Promise<RidersImpactReport> {
  const employees = await prisma.employee.findMany({
    where: { active: true },
    include: {
      deliveries: { where: { status: "delivered" } },
      payslips: true,
    },
    orderBy: { name: "asc" },
  });

  const riderEmployees = employees.filter((employee) => employee.deliveries.length > 0);

  const rows: RiderImpactRow[] = riderEmployees.map((employee) => ({
    riderId: employee.id,
    name: employee.name,
    deliveriesCompleted: employee.deliveries.length,
    totalPaid: employee.payslips.reduce((sum, payslip) => sum + Number(payslip.netPay), 0),
  }));

  return {
    rows,
    summary: {
      activeRiders: rows.length,
      totalDeliveries: rows.reduce((sum, row) => sum + row.deliveriesCompleted, 0),
      totalPaidOut: rows.reduce((sum, row) => sum + row.totalPaid, 0),
    },
  };
}
