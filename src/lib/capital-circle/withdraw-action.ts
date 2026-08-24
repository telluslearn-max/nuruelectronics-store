import "server-only";
import { revalidatePath, updateTag } from "next/cache";
import { requireAdminSession } from "../admin-auth";
import { logAdminAction } from "../audit-log";
import { redirectWithError, redirectWithSuccess } from "../admin-feedback";
import { WALLET_ONCHAIN_TAG } from "../reports/capital-circle-wallet";

const REPORT_PATH = "/admin/reports/capital-circle";

/**
 * The shared scaffolding behind every Capital Circle withdraw action: parse the amount, enforce
 * the app-level cap, log the attempt, call the destination-specific client, log the result, then
 * redirect. binance-actions.ts and circle-withdraw-actions.ts both said as much in their own
 * comments before this existed ("same as every other Capital Circle write path") — this factors
 * that shared control flow out once (A Philosophy of Software Design, Ch. 6.6/9.3) while leaving
 * each destination's special-purpose bits (the cap, the client call, the exact wording) supplied
 * by the caller, so the two callers' user-facing strings stay byte-for-byte what they were before
 * this refactor.
 */
export async function performCapitalCircleWithdraw(config: {
  formData: FormData;
  capUsdc: number;
  client: (amountUsdc: number) => Promise<{ id: string }>;
  entityId: string;
  actionAttempt: string;
  actionSuccess: string;
  actionFailed: string;
  /** The success log's metadata key for the client's returned id — kept caller-specific
      (`binanceWithdrawId` vs `circleTransactionId`) rather than unified, since this metadata is
      persisted audit-log data and nothing outside this refactor should have to change to keep
      reading it. */
  successMetadataKey: string;
  capExceededMessage: (capUsdc: number) => string;
  attemptSummary: (amountUsdc: number) => string;
  successSummary: (amountUsdc: number, transactionId: string) => string;
  failedSummary: (message: string) => string;
  failedRedirectMessage: (message: string) => string;
  successRedirectMessage: (amountUsdc: number) => string;
}): Promise<void> {
  const {
    formData,
    capUsdc,
    client,
    entityId,
    actionAttempt,
    actionSuccess,
    actionFailed,
    successMetadataKey,
    capExceededMessage,
    attemptSummary,
    successSummary,
    failedSummary,
    failedRedirectMessage,
    successRedirectMessage,
  } = config;

  await requireAdminSession();

  const amountUsdc = Number(formData.get("amountUsdc") ?? 0);
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    redirectWithError(REPORT_PATH, "Enter a positive USDC amount.");
  }
  if (amountUsdc > capUsdc) {
    redirectWithError(REPORT_PATH, capExceededMessage(capUsdc));
  }

  await logAdminAction({
    action: actionAttempt,
    entityType: "capital_circle_wallet",
    entityId,
    summary: attemptSummary(amountUsdc),
    metadata: { amountUsdc },
  });

  try {
    const result = await client(amountUsdc);
    await logAdminAction({
      action: actionSuccess,
      entityType: "capital_circle_wallet",
      entityId,
      summary: successSummary(amountUsdc, result.id),
      metadata: { amountUsdc, [successMetadataKey]: result.id },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    await logAdminAction({
      action: actionFailed,
      entityType: "capital_circle_wallet",
      entityId,
      summary: failedSummary(message),
      metadata: { amountUsdc, error: message },
    });
    redirectWithError(REPORT_PATH, failedRedirectMessage(message));
  }

  revalidatePath(REPORT_PATH);
  // updateTag (not revalidateTag) — Server Action, read-your-own-writes: next load shows the
  // fresh balance rather than serving stale-while-revalidate.
  updateTag(WALLET_ONCHAIN_TAG);
  redirectWithSuccess(REPORT_PATH, successRedirectMessage(amountUsdc));
}
