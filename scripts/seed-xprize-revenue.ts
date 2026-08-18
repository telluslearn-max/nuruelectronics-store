// One-off data load: records the revenue side of the "Build with Gemini
// XPRIZE" P&L statement (xprize_pl_statement.pdf, M-Pesa acct 254745864474,
// 2 Jul - 14 Aug 2026) — 28 "Independent Sales" transactions — as real
// Customer + manual Order + issued, fully-paid Invoice + Receipt records.
// Mirrors createManualOrder() / createInvoice() / recordPayment() from
// src/lib/admin-actions.ts exactly, but via a bare PrismaClient since
// prisma.ts / ledger.ts / documents.ts / audit-log.ts are all "server-only"
// and can't be imported from a plain script.
//
// Companion to scripts/seed-xprize-expenses.ts (the expense side).
//
// Usage:
//   npx tsx scripts/seed-xprize-revenue.ts
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ACCOUNTS = {
  MPESA: "1005",
  ACCOUNTS_RECEIVABLE: "1100",
  SALES_REVENUE: "4000",
} as const;

const PREFIX_FIELD_BY_TYPE = {
  invoice: "documentNumberPrefixInvoice",
  receipt: "documentNumberPrefixReceipt",
} as const;
const DEFAULT_PREFIX = { invoice: "INV", receipt: "RCT" } as const;

type Entry = { date: string; receipt: string; customerName: string; amount: number };

const entries: Entry[] = [
  { date: "2026-07-04", receipt: "UG47EA0JCE", customerName: "Mercy Njogu", amount: 2800.00 },
  { date: "2026-07-06", receipt: "UG6NMA56F0", customerName: "Mark Kimani", amount: 4000.00 },
  { date: "2026-07-06", receipt: "UG67YA4MJ2", customerName: "Hudson Lubabali", amount: 34100.00 },
  { date: "2026-07-11", receipt: "UGBNMAPRA7", customerName: "Mark Kimani", amount: 6000.00 },
  { date: "2026-07-13", receipt: "UGDNMAY38W", customerName: "Mark Kimani", amount: 5500.00 },
  { date: "2026-07-14", receipt: "UGEPJB60UD", customerName: "Prescott Matendechero", amount: 6000.00 },
  { date: "2026-07-17", receipt: "UGHGWBMN1I", customerName: "Ongwae Zachary", amount: 2500.00 },
  { date: "2026-07-18", receipt: "UGI4302GFK", customerName: "Veronica Kamera", amount: 37000.00 },
  { date: "2026-07-18", receipt: "UGI4302JI4", customerName: "Veronica Kamera", amount: 5000.00 },
  { date: "2026-07-18", receipt: "UGI1V008TH", customerName: "David Gachago", amount: 1310.00 },
  { date: "2026-07-19", receipt: "UGJ0G07J2J", customerName: "KCB 1", amount: 1000.00 },
  { date: "2026-07-22", receipt: "UGM9H069JS", customerName: "Samwel Opande", amount: 500.00 },
  { date: "2026-07-22", receipt: "UGMMH0D5FW", customerName: "Sarran Otieno", amount: 20000.00 },
  { date: "2026-07-28", receipt: "UGSMH120ND", customerName: "Sarran Otieno", amount: 29500.00 },
  { date: "2026-08-01", receipt: "UH1FG1AQNU", customerName: "Vincent Kanana", amount: 6500.00 },
  { date: "2026-08-03", receipt: "UH3OG1K7P0", customerName: "Gillesvidaljunior Nguetti", amount: 2000.00 },
  { date: "2026-08-03", receipt: "UH30G1UVD5", customerName: "NCBA Bank - Salary", amount: 7600.00 },
  { date: "2026-08-03", receipt: "UH3G31BCLR", customerName: "Callary Ongare", amount: 43000.00 },
  { date: "2026-08-04", receipt: "UH40G1YHSM", customerName: "IM Bank Limited", amount: 500.00 },
  { date: "2026-08-05", receipt: "UH57Y1JRWJ", customerName: "Hudson Lubabali", amount: 7500.00 },
  { date: "2026-08-05", receipt: "UH5R418896", customerName: "Mark Muindi", amount: 3800.00 },
  { date: "2026-08-07", receipt: "UH7OG206GQ", customerName: "Gillesvidaljunior Nguetti", amount: 1800.00 },
  { date: "2026-08-07", receipt: "UH7HD2A61U", customerName: "Kelly Wachira", amount: 7500.00 },
  { date: "2026-08-08", receipt: "UH80G2FYG3", customerName: "KCB 1", amount: 1000.00 },
  { date: "2026-08-08", receipt: "UH80G2IR2H", customerName: "Absa Bank Kenya PLC", amount: 6000.00 },
  { date: "2026-08-11", receipt: "UHBRG2M58N", customerName: "Ejidiah Muthoni", amount: 4400.00 },
  { date: "2026-08-11", receipt: "UHB6P2EGOY", customerName: "Erick Otieno", amount: 2950.00 },
  { date: "2026-08-12", receipt: "UHC1S2JD6G", customerName: "Naomi Warutere", amount: 30000.00 },
];

function slugifyName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function mintDocumentNumber(
  tx: Prisma.TransactionClient,
  type: "invoice" | "receipt",
): Promise<string> {
  const year = new Date().getFullYear();
  const [sequence, settings] = await Promise.all([
    tx.documentSequence.upsert({
      where: { type_year: { type, year } },
      create: { type, year, value: 1 },
      update: { value: { increment: 1 } },
    }),
    tx.settings.findUnique({ where: { id: "settings" } }),
  ]);
  const override = settings?.[PREFIX_FIELD_BY_TYPE[type]];
  const prefix = (typeof override === "string" && override.trim()) || DEFAULT_PREFIX[type];
  return `${prefix}-${year}-${String(sequence.value).padStart(4, "0")}`;
}

async function postJournalEntry(
  tx: Prisma.TransactionClient,
  input: { date: Date; description: string; sourceType: string; sourceId: string; lines: { accountCode: string; debit?: number; credit?: number }[] },
): Promise<void> {
  const codes = [...new Set(input.lines.map((l) => l.accountCode))];
  const accounts = await tx.account.findMany({ where: { code: { in: codes } } });
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  await tx.journalEntry.create({
    data: {
      date: input.date,
      description: input.description,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      lines: {
        create: input.lines.map((line) => {
          const account = byCode.get(line.accountCode);
          if (!account) throw new Error(`Unknown ledger account code: ${line.accountCode} — run prisma db seed first.`);
          return { accountId: account.id, debit: (line.debit ?? 0).toFixed(2), credit: (line.credit ?? 0).toFixed(2) };
        }),
      },
    },
  });
}

async function main() {
  const expectedTotal = entries.reduce((sum, e) => sum + e.amount, 0);
  console.log(`Loading ${entries.length} revenue transactions, total KES ${expectedTotal.toFixed(2)}`);

  let imported = 0;
  for (const entry of entries) {
    const existing = await prisma.receipt.findFirst({ where: { reference: entry.receipt } });
    if (existing) {
      console.log(`skip (already recorded): ${entry.date} ${entry.customerName} ${entry.amount} (receipt ${entry.receipt})`);
      continue;
    }

    const date = new Date(entry.date);
    const amount = entry.amount.toFixed(2);
    const email = `${slugifyName(entry.customerName)}@mpesa-import.local`;

    await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { email },
        create: { email, name: entry.customerName },
        update: { name: entry.customerName },
      });

      const order = await tx.order.create({
        data: {
          source: "manual",
          note: `XPRIZE P&L import — M-Pesa receipt ${entry.receipt}`,
          customerId: customer.id,
          items: {
            create: [{ title: "Independent Sale (XPRIZE P&L import)", quantity: 1, unitPrice: amount, lineTotal: amount }],
          },
        },
      });

      const invoiceNumber = await mintDocumentNumber(tx, "invoice");
      const invoice = await tx.invoice.create({
        data: { number: invoiceNumber, orderId: order.id, subtotal: amount, total: amount, issuedAt: date },
      });
      await postJournalEntry(tx, {
        date,
        description: `Invoice ${invoice.number} issued`,
        sourceType: "invoice",
        sourceId: invoice.id,
        lines: [
          { accountCode: ACCOUNTS.ACCOUNTS_RECEIVABLE, debit: entry.amount },
          { accountCode: ACCOUNTS.SALES_REVENUE, credit: entry.amount },
        ],
      });

      const receiptNumber = await mintDocumentNumber(tx, "receipt");
      const receipt = await tx.receipt.create({
        data: { number: receiptNumber, invoiceId: invoice.id, amount, method: "mpesa", reference: entry.receipt, paidAt: date },
      });
      await tx.invoice.update({ where: { id: invoice.id }, data: { amountPaid: amount, status: "paid" } });
      await postJournalEntry(tx, {
        date,
        description: `Receipt ${receipt.number} against invoice`,
        sourceType: "receipt",
        sourceId: receipt.id,
        lines: [
          { accountCode: ACCOUNTS.MPESA, debit: entry.amount },
          { accountCode: ACCOUNTS.ACCOUNTS_RECEIVABLE, credit: entry.amount },
        ],
      });
      await tx.adminAuditLog.create({
        data: {
          action: "invoice.recordPayment",
          entityType: "invoice",
          entityId: invoice.id,
          summary: `Recorded payment of ${amount} against invoice ${invoice.number} (XPRIZE P&L import)`,
          metadata: { amount: entry.amount, method: "mpesa", reference: entry.receipt, source: "xprize_pl_statement.pdf" } as Prisma.InputJsonValue,
        },
      });
    }, { timeout: 15000 });

    imported++;
    console.log(`recorded: ${entry.date} ${entry.customerName} KES ${amount} (receipt ${entry.receipt})`);
  }

  console.log(`Done. Imported ${imported} of ${entries.length}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
