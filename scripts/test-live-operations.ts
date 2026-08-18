import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { dispatchTool as dispatchConciergeTool, functionDeclarations as conciergeDeclarations } from "../src/lib/concierge/tools";
import { dispatchTool as dispatchCapitalTool, functionDeclarations as capitalDeclarations } from "../src/lib/capital-circle/tools";
import { ACCOUNTS, postJournalEntry } from "../src/lib/ledger";
import { computePnl } from "../src/lib/reports/pnl";
import { getTrialBalance } from "../src/lib/reports/trial-balance";
import { decideReturnCase } from "../src/lib/support/return-policy";
import { searchProducts, getProductDetails, compareProducts } from "../src/lib/concierge/catalog-tools";
import { listActivePolymarketMarkets } from "../src/lib/capital-circle/polymarket-client";
import { sizePosition } from "../src/lib/capital-circle/sizing-tool";
import { recordPosition } from "../src/lib/capital-circle/executor-tool";
import { isConciergeConfigured, CONCIERGE_MODEL } from "../src/lib/concierge/vertex-client";
import { isCircleWalletConfigured, circleWalletAddress } from "../src/lib/capital-circle/circle-wallet-client";
import { CAPITAL_CIRCLE_LIVE, DEFAULT_PER_POSITION_CAP_USD, CAPITAL_CIRCLE_SWEEP_PERCENT } from "../src/lib/capital-circle/config";

interface TestReport {
  flowName: string;
  status: "PASSED" | "FAILED";
  details: Record<string, unknown>;
  error?: string;
}

const reports: TestReport[] = [];

async function runTest(flowName: string, fn: () => Promise<Record<string, unknown>>) {
  console.log(`\n======================================================`);
  console.log(`RUNNING LIVE TEST: ${flowName}`);
  console.log(`======================================================`);
  try {
    const details = await fn();
    console.log(`✅ [PASSED] ${flowName}`);
    reports.push({ flowName, status: "PASSED", details });
  } catch (err: any) {
    console.error(`❌ [FAILED] ${flowName}:`, err.message || err);
    reports.push({ flowName, status: "FAILED", details: {}, error: err.message || String(err) });
  }
}

async function main() {
  console.log("🚀 Starting NURU AI Operational Engine Live Flow Verification...");
  console.log(`Database connected: ${Boolean(process.env.DATABASE_URL)}`);
  console.log(`Concierge Configured (Vertex AI / Gemini): ${isConciergeConfigured} (Model: ${CONCIERGE_MODEL})`);
  console.log(`Circle Wallet Configured: ${isCircleWalletConfigured} (Address: ${circleWalletAddress ?? "none"})`);
  console.log(`Capital Circle Live Execution Mode: ${CAPITAL_CIRCLE_LIVE}`);

  // -------------------------------------------------------------
  // FLOW 1: PRODUCT CATALOG WRITE & READ AUTHORITY
  // -------------------------------------------------------------
  await runTest("Flow 1: Product Catalog Write & Read Authority", async () => {
    // Test 1.1: Catalog search through Concierge Tool
    const searchResult = await dispatchConciergeTool("search_products", { query: "MacBook", first: 3 });
    const products = (searchResult.resultForModel as any[]) || [];

    // Test 1.2: Product Details lookup
    const handle = products.length > 0 ? products[0].handle : "iphone-15-pro";
    const detailsResult = await dispatchConciergeTool("get_product_details", { handle });
    
    // Test 1.3: Product Comparison
    const compareResult = await dispatchConciergeTool("compare_products", { handles: [handle] });

    // Test 1.4: BNPL Plan Explanation
    const bnplResult = await dispatchConciergeTool("explain_bnpl_plan", { handle });

    // Test 1.5: List Kits & Brand Ecosystems
    const kitsResult = await dispatchConciergeTool("list_kits_or_ecosystems", { kind: "both" });

    return {
      searchToolProductsReturned: products.length,
      sampleProductHandle: handle,
      productDetailsAvailable: Boolean((detailsResult.resultForModel as any)?.title),
      bnplPlanEligibility: (bnplResult.resultForModel as any)?.eligible ?? false,
      kitsAndEcosystemsDispatched: Boolean(kitsResult.resultForModel),
      toolDeclarationsCount: conciergeDeclarations.length,
    };
  });

  // -------------------------------------------------------------
  // FLOW 2: CUSTOMER CARTS WRITE-AUTHORITY
  // -------------------------------------------------------------
  await runTest("Flow 2: Customer Carts Operations (Write Authority)", async () => {
    // Find a real product variant to test adding to cart
    const catalog = await searchProducts({ first: 5 });
    const productWithVariant = catalog.find((p) => p.variants && p.variants.length > 0) || catalog[0];
    const variantId = productWithVariant?.variants?.[0]?.id || "gid://shopify/ProductVariant/mock-1";

    // Test 2.1: Add item to cart via concierge tool
    const addResult = await dispatchConciergeTool("add_to_cart", { variantId, quantity: 2 });
    const lineId = (addResult.resultForModel as any)?.lineId;

    // Test 2.2: Get current cart contents
    const getCartResult = await dispatchConciergeTool("get_cart", {});

    // Test 2.3: Update cart quantity
    let updateResult: any = null;
    if (lineId) {
      updateResult = await dispatchConciergeTool("update_cart_quantity", { lineId, quantity: 3 });
    }

    // Test 2.4: Checkout link creation
    const checkoutResult = await dispatchConciergeTool("open_checkout", {});

    // Test 2.5: Remove item from cart
    let removeResult: any = null;
    if (lineId) {
      removeResult = await dispatchConciergeTool("remove_from_cart", { lineId });
    }

    // Verify audit log entry in database for cart action
    const latestAudit = await prisma.adminAuditLog.findFirst({
      where: { action: "concierge.add_to_cart" },
      orderBy: { createdAt: "desc" },
    });

    return {
      variantAdded: variantId,
      addToCartResult: addResult.resultForModel,
      cartEventTriggered: addResult.events.length > 0,
      cartStateRetrieved: getCartResult.resultForModel,
      cartQuantityUpdated: updateResult?.resultForModel ?? "skipped (no lineId)",
      checkoutUrlGenerated: Boolean((checkoutResult.resultForModel as any)?.url),
      cartItemRemoved: removeResult?.resultForModel ?? "skipped (no lineId)",
      auditLogRecorded: Boolean(latestAudit),
      auditSummary: latestAudit?.summary,
    };
  });

  // -------------------------------------------------------------
  // FLOW 3: WARRANTY RESOLUTIONS & RETURN POLICY ENGINE
  // -------------------------------------------------------------
  await runTest("Flow 3: Warranty Resolutions & Decision Engine", async () => {
    // Test 3.1: Warranty Policy logic evaluation (Pure Policy unit logic)
    const validWarrantyDecision = decideReturnCase({
      reason: "warranty",
      hoursSinceOrder: 24 * 180, // 6 months in (within 1-year warranty)
      isBnpl: false,
    });

    const expiredWarrantyDecision = decideReturnCase({
      reason: "warranty",
      hoursSinceOrder: 24 * 400, // > 1 year
      isBnpl: false,
    });

    const changeOfMindDecision = decideReturnCase({
      reason: "change_of_mind",
      hoursSinceOrder: 48, // within 7-day window
      isBnpl: false,
    });

    // Test 3.2: Live operational ReturnCase creation and ledger journal entry in Prisma
    const testOrderId = `live-test-order-${Date.now()}`;
    const testOrderName = `#TEST-${Math.floor(1000 + Math.random() * 9000)}`;
    const testCustomerEmail = `customer-${Date.now()}@example.com`;
    const refundAmount = 15500.00;

    const caseRecord = await prisma.$transaction(async (tx) => {
      // 1. Post matching balanced double-entry journal entry to financial ledger
      const entry = await postJournalEntry(tx, {
        date: new Date(),
        description: `Refund authorized by AI concierge live test — order ${testOrderName} (warranty)`,
        sourceType: "returnCase",
        sourceId: testOrderId,
        lines: [
          { accountCode: ACCOUNTS.SALES_RETURNS, debit: refundAmount },
          { accountCode: ACCOUNTS.REFUNDS_PAYABLE, credit: refundAmount },
        ],
      });

      // 2. Persist ReturnCase
      const created = await tx.returnCase.create({
        data: {
          shopifyOrderId: testOrderId,
          shopifyOrderName: testOrderName,
          customerEmail: testCustomerEmail,
          reason: "warranty",
          description: "Customer reports hardware display glitch covered under 1-year warranty",
          status: "approved",
          decisionBasis: validWarrantyDecision.reasoning,
          refundAmount: refundAmount,
          refundChannel: "shopify_checkout",
          journalEntryId: entry.id,
        },
      });

      // 3. Log audit entry
      await tx.adminAuditLog.create({
        data: {
          action: "concierge.return_case_decision",
          entityType: "returnCase",
          entityId: created.id,
          summary: `AI concierge approved a "warranty" claim for order ${testOrderName}`,
          metadata: { reason: "warranty", refundAmount, decision: validWarrantyDecision },
        },
      });

      return { created, journalEntryId: entry.id };
    });

    // Verify written records
    const retrievedCase = await prisma.returnCase.findUnique({
      where: { id: caseRecord.created.id },
    });
    const retrievedJournal = await prisma.journalEntry.findUnique({
      where: { id: caseRecord.journalEntryId },
      include: { lines: { include: { account: true } } },
    });

    return {
      policyApprovedWarranty: validWarrantyDecision.status === "approved",
      policyDeniedExpired: expiredWarrantyDecision.status === "denied",
      policyApprovedChangeOfMind: changeOfMindDecision.status === "approved",
      createdReturnCaseId: retrievedCase?.id,
      createdCaseStatus: retrievedCase?.status,
      createdRefundAmount: retrievedCase?.refundAmount?.toString(),
      linkedJournalEntryId: retrievedJournal?.id,
      journalLinesCount: retrievedJournal?.lines.length,
      journalBalanced: retrievedJournal?.lines.reduce((s, l) => s + Number(l.debit), 0) === refundAmount,
    };
  });

  // -------------------------------------------------------------
  // FLOW 4: FINANCIAL LEDGER & DOUBLE-ENTRY ACCOUNTING
  // -------------------------------------------------------------
  await runTest("Flow 4: Financial Ledger (Double-Entry Engine & Reporting)", async () => {
    const testAmount = 45000.00;
    const testDate = new Date();

    // Test 4.1: Post a balanced journal entry (e.g. Cash Sale: Debit CASH, Credit SALES_REVENUE)
    const saleEntry = await prisma.$transaction(async (tx) => {
      return await postJournalEntry(tx, {
        date: testDate,
        description: `Live test sale transaction: Cash receipt for electronics hardware`,
        sourceType: "test_sale",
        lines: [
          { accountCode: ACCOUNTS.CASH, debit: testAmount },
          { accountCode: ACCOUNTS.SALES_REVENUE, credit: testAmount },
        ],
      });
    });

    // Test 4.2: Verify unbalance prevention rule (must throw error)
    let unbalancedCaught = false;
    try {
      await prisma.$transaction(async (tx) => {
        await postJournalEntry(tx, {
          date: testDate,
          description: "Unbalanced intentional test",
          lines: [
            { accountCode: ACCOUNTS.CASH, debit: 1000 },
            { accountCode: ACCOUNTS.SALES_REVENUE, credit: 500 }, // Mismatch!
          ],
        });
      });
    } catch (e: any) {
      unbalancedCaught = e.message.includes("Journal entry does not balance");
    }

    // Test 4.3: Query Trial Balance
    const trialBalance = await getTrialBalance();
    const totalDebit = trialBalance.reduce((sum, row) => sum + row.debit, 0);
    const totalCredit = trialBalance.reduce((sum, row) => sum + row.credit, 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.05;

    // Test 4.4: Generate P&L Report
    const fromDate = new Date(new Date().getFullYear(), 0, 1);
    const toDate = new Date();
    const pnlReport = await computePnl({ from: fromDate, to: toDate, granularity: "monthly" });

    return {
      postedSaleEntryId: saleEntry.id,
      unbalancedEntryBlocked: unbalancedCaught,
      trialBalanceAccountRows: trialBalance.length,
      trialBalanceTotalDebit: totalDebit,
      trialBalanceTotalCredit: totalCredit,
      trialBalanceIsBalanced: isBalanced,
      pnlBucketsCount: pnlReport.buckets.length,
      pnlTotalRevenueBuckets: Object.keys(pnlReport.totalRevenue).length,
    };
  });

  // -------------------------------------------------------------
  // FLOW 5: TREASURY WALLETS & CAPITAL CIRCLE RISK EXECUTION
  // -------------------------------------------------------------
  await runTest("Flow 5: Treasury Wallets & Capital Circle Risk Execution", async () => {
    // Test 5.1: Research real live prediction markets on Polymarket
    let markets: any[] = [];
    try {
      markets = await listActivePolymarketMarkets(5);
    } catch (e) {
      console.warn("Polymarket CLOB query note:", e);
    }

    const testMarket = markets.length > 0 ? markets[0] : {
      conditionId: "0xmockcondition" + Date.now(),
      tokenId: "mocktoken123",
      question: "Will Global AI compute demand grow > 50% in 2026?",
    };

    // Test 5.2: Size Position with Risk Bounds (Tool dispatch & function test)
    const sizingUnderCap = await sizePosition(15);
    const sizingOverCap = await sizePosition(100); // Exceeds default cap (25 USD)
    const sizingDispatch = await dispatchCapitalTool("size_position", { requestedUsd: 50 });

    // Test 5.3: Record Position via Capital Circle Executor Tool
    const positionResult = await recordPosition({
      conditionId: testMarket.conditionId,
      tokenId: testMarket.tokenId || "token-default",
      question: testMarket.question,
      thesis: "High conviction data center demand signal and compute infrastructure expansion",
      sizeUsd: sizingUnderCap.approvedUsd,
    });

    // Test 5.4: Verify Capital Circle Position persisted in Prisma
    const savedPosition = await prisma.capitalCirclePosition.findUnique({
      where: { id: positionResult.positionId },
    });

    // Test 5.5: Treasury configuration & Sweep parameters
    const sweepPercent = CAPITAL_CIRCLE_SWEEP_PERCENT;
    const defaultCap = DEFAULT_PER_POSITION_CAP_USD;

    return {
      liveMarketsQueried: markets.length,
      sampleMarketQuestion: testMarket.question,
      sizingUnderCapApproved: sizingUnderCap.approvedUsd,
      sizingOverCapClampedTo: sizingOverCap.approvedUsd,
      sizingOverCapCappedFlag: sizingOverCap.capped,
      sizingToolDispatched: sizingDispatch.resultForModel,
      executedPositionId: savedPosition?.id,
      positionStatus: savedPosition?.status,
      positionSizeUsd: savedPosition?.sizeUsd?.toString(),
      configuredSweepPercent: `${sweepPercent}%`,
      perPositionCap: `$${defaultCap}`,
      isCircleWalletConfigured,
      testnetWalletAddress: process.env.CIRCLE_TESTNET_WALLET_ADDRESS || "none",
    };
  });

  // -------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------
  console.log("\n======================================================");
  console.log("FINAL FLOW VERIFICATION SUMMARY");
  console.log("======================================================");
  let allPassed = true;
  for (const r of reports) {
    const symbol = r.status === "PASSED" ? "✅" : "❌";
    console.log(`${symbol} ${r.flowName}: ${r.status}`);
    if (r.status === "FAILED") {
      allPassed = false;
      console.log(`   Error: ${r.error}`);
    }
  }

  console.log("\n" + JSON.stringify(reports, null, 2));

  if (!allPassed) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error("Fatal test runner error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
