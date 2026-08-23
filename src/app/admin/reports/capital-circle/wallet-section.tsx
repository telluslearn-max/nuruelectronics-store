import { Suspense } from "react";
import { Chain, getContractConfig } from "@polymarket/clob-client-v2";
import type { CapitalCircleWalletSummary } from "@/lib/reports/capital-circle";
import { getWalletActivity, getWalletBalanceSnapshot } from "@/lib/reports/capital-circle-wallet";
import { evaluateReadiness, type ReadinessItem, type ReadinessState } from "@/lib/capital-circle/readiness";
import { CAPITAL_CIRCLE_NETWORK, explorerAddressUrl, explorerTokenUrl, explorerTxUrl } from "@/lib/capital-circle/chain";
import { readCollateralAllowance } from "@/lib/capital-circle/onchain";
import { circleWalletAddress, circleWalletId, COLLATERAL_TOKEN_ADDRESS } from "@/lib/capital-circle/circle-wallet-client";
import { CAPITAL_CIRCLE_LIVE } from "@/lib/capital-circle/config";
import { truncateAddress } from "@/lib/capital-circle/wallet-identity";
import { walletDepositQrSvg } from "@/lib/capital-circle/wallet-qr";
import { isBinanceConfigured, BINANCE_WITHDRAW_CAP_USDC } from "@/lib/capital-circle/binance-client";
import { depositFromBinance } from "@/lib/capital-circle/binance-actions";
import { isCircleWalletWithdrawConfigured, CIRCLE_WALLET_WITHDRAW_CAP_USDC } from "@/lib/capital-circle/circle-wallet-withdraw";
import { withdrawFromCircleWallet } from "@/lib/capital-circle/circle-withdraw-actions";
import { isCollateralBridgeConfigured, BRIDGE_TO_USDCE_CAP_USDC, WRAP_TO_COLLATERAL_CAP_USDC } from "@/lib/capital-circle/collateral-bridge";
import { bridgeToUsdcE, checkBridgeStatus, approveForWrap, wrapToCollateral } from "@/lib/capital-circle/collateral-bridge-actions";
import {
  registerCapitalCircleWallet,
  registerConfiguredCircleWallet,
  saveCapitalCircleWalletCaps,
  updateCapitalCircleWalletIdentity,
  refreshWalletOnchainData,
} from "@/lib/capital-circle/wallet-actions";
import { formatPrice, formatEatDateTime } from "@/lib/format";
import { moneyColorClass } from "@/components/admin/money-colors";
import { CopyButton } from "@/components/admin/copy-button";
import { SubmitButton } from "@/components/admin/submit-button";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";

const inputClass = "w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground";
const DETAILS = "mt-3 rounded-card border border-border-subtle p-4";

const WALLET_STATUS_STYLES: Record<string, string> = {
  pending: "bg-neutral-100 text-neutral-600",
  active: "bg-green-50 text-green-700",
  frozen: "bg-red-50 text-red-700",
};

function WalletStatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${WALLET_STATUS_STYLES[status] ?? "bg-neutral-100 text-neutral-600"}`}>
      {status}
    </span>
  );
}

function WalletCapField({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return (
    <div>
      <label className="block text-xs text-neutral-500">{label}</label>
      <input type="number" name={name} step="0.01" min="0" defaultValue={defaultValue} className={inputClass} />
    </div>
  );
}

/** Matches resolveVersion()'s own fallback (client.js in @polymarket/clob-client-v2) when it
    can't ask the CLOB API which order version is current — the same reasoning readiness.ts's
    allowance check already documents as a guess, not a verified fact. */
function bestGuessExchangeSpender(): string {
  return getContractConfig(CAPITAL_CIRCLE_NETWORK.isTestnet ? Chain.AMOY : Chain.POLYGON).exchangeV2;
}

const READINESS_DOT: Record<ReadinessState, string> = { ok: "bg-green-500", warn: "bg-amber-500", blocked: "bg-red-500" };
const READINESS_TEXT: Record<ReadinessState, string> = { ok: "text-green-700", warn: "text-amber-700", blocked: "text-red-700" };

function ReadinessRow({ item }: { item: ReadinessItem }) {
  return (
    <li className="flex items-start gap-2 py-1.5">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${READINESS_DOT[item.state]}`} aria-hidden />
      <div className="min-w-0 text-sm">
        <span className={`font-medium ${READINESS_TEXT[item.state]}`}>{item.label}</span>
        <span className="text-neutral-500"> — {item.detail}</span>
        {item.remedy && <div className="mt-0.5 text-xs text-neutral-400">{item.remedy}</div>}
      </div>
    </li>
  );
}

/**
 * The hero: one balance, one status line, one Receive block. Apple/MetaMask read this as "the
 * thing you came here for" — everything that explains *why* the number or status looks the way
 * it does (the 8-row checklist, the 4-stat breakdown, the Circle cross-check) lives one tap away
 * in the <details> underneath, not competing with it for attention by default.
 */
async function WalletHero({ dbWallet }: { dbWallet: CapitalCircleWalletSummary | null }) {
  const [snapshot, allowance] = await Promise.all([
    getWalletBalanceSnapshot(),
    circleWalletAddress ? readCollateralAllowance(circleWalletAddress, bestGuessExchangeSpender()) : Promise.resolve(null),
  ]);

  const items = evaluateReadiness({
    wallet: dbWallet
      ? { address: dbWallet.address, perTxCapUsd: dbWallet.perTxCapUsd, dailyCapUsd: dbWallet.dailyCapUsd, weeklyCapUsd: dbWallet.weeklyCapUsd, monthlyCapUsd: dbWallet.monthlyCapUsd }
      : null,
    configuredWalletAddress: circleWalletAddress,
    isTestnet: CAPITAL_CIRCLE_NETWORK.isTestnet,
    collateralBalance: snapshot.onchainCollateral,
    nativeBalance: snapshot.onchainNative,
    allowance,
    isLive: CAPITAL_CIRCLE_LIVE,
  });

  const blockedCount = items.filter((item) => item.state === "blocked").length;
  const warnCount = items.filter((item) => item.state === "warn").length;
  const statusDot = blockedCount > 0 ? "bg-red-500" : warnCount > 0 ? "bg-amber-500" : "bg-green-500";
  const statusText =
    blockedCount > 0
      ? `${blockedCount} thing${blockedCount === 1 ? "" : "s"} blocking live trading`
      : warnCount > 0
        ? `Ready, ${warnCount} thing${warnCount === 1 ? "" : "s"} worth a look`
        : "Ready to trade live";

  const { onchainCollateral, onchainNative, circleCollateral, discrepancyUsd } = snapshot;

  return (
    <>
      <div>
        <div className="text-xs text-neutral-500">Available balance</div>
        <div className="mt-1 text-4xl font-semibold tabular-nums">
          {onchainCollateral?.ok ? formatPrice(onchainCollateral.value.toFixed(2), "USD") : "—"}
        </div>
        {!onchainCollateral ? (
          <p className="mt-1 text-sm text-neutral-500">No wallet registered yet.</p>
        ) : !onchainCollateral.ok ? (
          <p className="mt-1 text-sm text-amber-700">Couldn&apos;t read the chain: {onchainCollateral.error.message}</p>
        ) : null}
      </div>

      <details className="mt-3 group">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm">
          <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot}`} aria-hidden />
          <span className="font-medium">{statusText}</span>
          <span className="text-neutral-400 group-open:hidden">— details</span>
        </summary>

        <div className="mt-3 space-y-4 border-t border-border-subtle pt-3">
          <ul className="divide-y divide-border-subtle">
            {items.map((item) => (
              <ReadinessRow key={item.id} item={item} />
            ))}
          </ul>

          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <div className="text-xs text-neutral-500">POL (gas)</div>
              <div className="tabular-nums">{onchainNative?.ok ? onchainNative.value.toFixed(4) : "—"}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Open exposure</div>
              <div className="tabular-nums">{formatPrice(snapshot.openExposureUsd.toFixed(2), "USD")}</div>
              <div className="text-xs text-neutral-400">{snapshot.openPositionCount} open</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Room for new</div>
              <div className="tabular-nums">{formatPrice(snapshot.roomForNewPositionsUsd.toFixed(2), "USD")}</div>
              <div className="text-xs text-neutral-400">of ${snapshot.portfolioLimitUsd.toFixed(0)} limit</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Circle reports</div>
              {circleCollateral === null ? (
                <div className="text-neutral-400">not configured</div>
              ) : !circleCollateral.ok ? (
                <div className="text-amber-700">unavailable</div>
              ) : discrepancyUsd === null ? (
                <div className="tabular-nums text-green-700">agrees</div>
              ) : (
                <div className={`tabular-nums ${moneyColorClass(-discrepancyUsd)}`}>
                  off by {formatPrice(Math.abs(discrepancyUsd).toFixed(2), "USD")}
                </div>
              )}
            </div>
          </div>
          {discrepancyUsd !== null && circleCollateral?.ok && (
            <p className="text-xs text-neutral-400">
              Usually a lag of a block or two, or an outbound transfer Circle has already debited but hasn&apos;t
              mined yet — worth a second look if it persists.
            </p>
          )}

          <form action={refreshWalletOnchainData}>
            <SubmitButton className="rounded-control border border-border-subtle px-3 py-1.5 text-xs font-medium hover:border-foreground" pendingText="Refreshing…">
              Refresh
            </SubmitButton>
          </form>
        </div>
      </details>
    </>
  );
}

function HeroSkeleton() {
  return (
    <div>
      <div className="h-3 w-24 animate-pulse rounded bg-neutral-100" />
      <div className="mt-2 h-10 w-40 animate-pulse rounded bg-neutral-100" />
      <div className="mt-3 h-4 w-32 animate-pulse rounded bg-neutral-100" />
    </div>
  );
}

/** The one thing this page exists for: where do I send money. QR, address, one warning that
    matters (the network), everything else — which token exactly, the contract address — is one
    tap away for anyone who wants to verify, not in the way of everyone who doesn't. */
async function ReceiveCard({ address }: { address: string }) {
  const qrSvg = await walletDepositQrSvg(address);

  return (
    <div className="mt-6">
      <h4 className="text-sm font-medium text-neutral-500">Receive</h4>
      <div className="mt-2 flex flex-col items-center gap-3 rounded-card border border-border-subtle p-6 text-center sm:flex-row sm:text-left">
        <div className="shrink-0 rounded-control bg-white p-2" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className="break-all font-mono text-sm">{truncateAddress(address, 10, 8)}</span>
            <CopyButton value={address} label="Copy" className="rounded-control border border-border-subtle px-2.5 py-1 text-xs font-medium hover:border-foreground" />
          </div>
          <p className="mt-2 text-sm text-neutral-500">
            {CAPITAL_CIRCLE_NETWORK.label} network only — sending on any other network can&apos;t be recovered.
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-neutral-400">What token is this?</summary>
            <p className="mt-2 max-w-sm text-xs text-neutral-500">
              This QR pre-fills Polymarket&apos;s current trading collateral, which is <strong>not always plain
              USDC</strong> — Polymarket changed it once already (to pUSD, April 2026) and can again. Trust what the
              QR pre-fills over any label on this page.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
              <a href={explorerTokenUrl(COLLATERAL_TOKEN_ADDRESS)} target="_blank" rel="noreferrer" className="font-mono underline">
                {truncateAddress(COLLATERAL_TOKEN_ADDRESS)}
              </a>
              <CopyButton value={COLLATERAL_TOKEN_ADDRESS} label="Copy token" className="rounded-control border border-border-subtle px-2 py-0.5 hover:border-foreground" />
              <a href={explorerAddressUrl(address)} target="_blank" rel="noreferrer" className="underline">
                View address ↗
              </a>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

const ACTIVITY_DIRECTION_CLASS: Record<"in" | "out", string> = { in: "text-green-700", out: "text-red-600" };
const ACTIVITY_DIRECTION_SIGN: Record<"in" | "out", string> = { in: "+", out: "−" };

async function ActivityRows() {
  const rows = await getWalletActivity();
  if (rows.length === 0) return <p className="mt-2 text-sm text-neutral-500">Nothing yet — positions, sweeps, and Binance transfers will show up here.</p>;

  return (
    <ul className="mt-2 divide-y divide-border-subtle">
      {rows.map((row) => (
        <li key={row.key} className="flex items-start justify-between gap-3 py-2 text-sm">
          <div className="min-w-0">
            <div className="truncate text-neutral-700">{row.label}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-neutral-400">
              <span>{formatEatDateTime(new Date(row.atMs))}</span>
              <span>{row.status}</span>
              {row.txHash && (
                <a href={explorerTxUrl(row.txHash)} target="_blank" rel="noreferrer" className="font-mono underline">
                  {truncateAddress(row.txHash)}
                </a>
              )}
            </div>
          </div>
          {row.amountUsd != null && (
            <span className={`shrink-0 tabular-nums font-medium ${ACTIVITY_DIRECTION_CLASS[row.direction]}`}>
              {ACTIVITY_DIRECTION_SIGN[row.direction]}
              {formatPrice(row.amountUsd.toFixed(2), "USD")}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Two fields, nothing else — chain and status are implicit (see registerCapitalCircleWallet's
    own comment for why). Reused by both branches of RegisterWalletCard below, since "the
    env-configured wallet isn't registered yet" and "no wallet is configured at all" both fall
    back to the same manual path for the rare case it's actually needed. */
function ManualRegisterForm() {
  return (
    <form action={registerCapitalCircleWallet} className="mt-3 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-neutral-500">Circle wallet id</label>
          <input type="text" name="circleWalletId" placeholder="from circle-wallet-setup.mjs" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Address</label>
          <input type="text" name="address" placeholder="0x…" className={inputClass} />
        </div>
      </div>
      <SubmitButton className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium hover:border-foreground" pendingText="Registering…">
        Register wallet
      </SubmitButton>
    </form>
  );
}

/**
 * Replaces the old always-present "Register a wallet" form at the bottom of the page. Two real
 * states, not eight form fields: either CIRCLE_WALLET_ID/CIRCLE_WALLET_ADDRESS are already
 * env-configured — the values every other part of this app already trusts and uses for real
 * money movement — in which case registering is a single confirm click with nothing to type or
 * mistype, or nothing is configured yet, in which case the only real next step is running the
 * setup script. Manual entry still exists for the genuine edge case (a second wallet, managing
 * something the env vars don't point at) but is no longer the first thing anyone sees.
 */
function RegisterWalletCard() {
  const envConfigured = Boolean(circleWalletAddress && circleWalletId);

  return (
    <div className="mt-6 rounded-card border border-dashed border-border-subtle p-6 text-center text-sm text-neutral-500">
      {envConfigured ? (
        <>
          <p>Found a wallet configured in your environment:</p>
          <p className="mt-2 font-mono text-neutral-700">{truncateAddress(circleWalletAddress as string)}</p>
          <form action={registerConfiguredCircleWallet} className="mt-3">
            <SubmitButton className="rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90" pendingText="Registering…">
              Register this wallet
            </SubmitButton>
          </form>
        </>
      ) : (
        <p>
          No wallet yet — provision one with{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5">scripts/circle-wallet-setup.mjs</code>, add the
          resulting values to your environment, then reload this page.
        </p>
      )}
      <details className="mt-3 text-left">
        <summary className="cursor-pointer text-xs text-neutral-400">
          {envConfigured ? "Register a different wallet manually" : "Enter one manually instead"}
        </summary>
        <ManualRegisterForm />
      </details>
    </div>
  );
}

export async function WalletSection({ wallets }: { wallets: CapitalCircleWalletSummary[] }) {
  const dbWallet = wallets.find((w) => w.address) ?? null;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Wallet</h3>
        <span className="text-xs text-neutral-400">
          {CAPITAL_CIRCLE_NETWORK.isTestnet ? (
            <span className="font-medium text-red-600">{CAPITAL_CIRCLE_NETWORK.label} — test funds only</span>
          ) : (
            CAPITAL_CIRCLE_NETWORK.label
          )}
        </span>
      </div>

      {CAPITAL_CIRCLE_NETWORK.isTestnet && (
        <p className="mt-2 rounded-control border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          Every address and QR below is a testnet address. Mainnet USDC sent here is very likely unrecoverable.
        </p>
      )}

      <Suspense fallback={<HeroSkeleton />}>
        <WalletHero dbWallet={dbWallet} />
      </Suspense>

      {dbWallet?.address ? <ReceiveCard address={dbWallet.address} /> : <RegisterWalletCard />}

      <details className={DETAILS}>
        <summary className="cursor-pointer text-sm font-medium">Activity</summary>
        <Suspense fallback={<div className="mt-2 h-16 animate-pulse rounded bg-neutral-100" />}>
          <ActivityRows />
        </Suspense>
      </details>

      {wallets.length > 0 &&
        wallets.map((wallet) => (
          <details key={wallet.id} className={DETAILS}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium">
              <span className="min-w-0 truncate font-mono">{wallet.circleWalletId ?? wallet.id}</span>
              <span className="shrink-0">
                <WalletStatusPill status={wallet.status} />
              </span>
            </summary>

            <form action={saveCapitalCircleWalletCaps} className="mt-4 space-y-3">
              <input type="hidden" name="walletId" value={wallet.id} />
              <div>
                <label className="block text-xs text-neutral-500">Status</label>
                <select name="status" defaultValue={wallet.status} className={`${inputClass} sm:w-48`}>
                  <option value="pending">pending</option>
                  <option value="active">active</option>
                  <option value="frozen">frozen</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <WalletCapField name="perTxCapUsd" label="Per-tx cap (USD)" defaultValue={wallet.perTxCapUsd?.toFixed(2) ?? ""} />
                <WalletCapField name="dailyCapUsd" label="Daily cap (USD)" defaultValue={wallet.dailyCapUsd?.toFixed(2) ?? ""} />
                <WalletCapField name="weeklyCapUsd" label="Weekly cap (USD)" defaultValue={wallet.weeklyCapUsd?.toFixed(2) ?? ""} />
                <WalletCapField name="monthlyCapUsd" label="Monthly cap (USD)" defaultValue={wallet.monthlyCapUsd?.toFixed(2) ?? ""} />
              </div>
              <SubmitButton className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium hover:border-foreground" pendingText="Saving…">
                Save
              </SubmitButton>
            </form>

            <details className="mt-3 rounded-control border border-amber-200 bg-amber-50 p-3">
              <summary className="cursor-pointer text-xs font-medium text-amber-800">Change wallet identity</summary>
              <p className="mt-2 text-xs text-amber-800">
                This is how the pool receives money — changing it points every future deposit instruction and
                on-chain withdrawal at a different address. Blanking a field that already has a value is refused; to
                replace it you must enter a real new value and confirm below.
              </p>
              <form action={updateCapitalCircleWalletIdentity} className="mt-3 space-y-3">
                <input type="hidden" name="walletId" value={wallet.id} />
                <input type="hidden" name="seenUpdatedAt" value={wallet.updatedAtMs} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs text-neutral-500">Circle wallet id</label>
                    <input type="text" name="circleWalletId" defaultValue={wallet.circleWalletId ?? ""} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500">Address</label>
                    <input type="text" name="address" defaultValue={wallet.address ?? ""} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500">Chain</label>
                    <input type="text" name="chain" defaultValue={wallet.chain} className={inputClass} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-amber-800">
                  <input type="checkbox" name="confirmReplace" />I mean to replace the current identity, not just fix
                  a typo elsewhere.
                </label>
                <ConfirmSubmitButton
                  confirmMessage={`Change this wallet's identity? It currently points at ${
                    wallet.address ? truncateAddress(wallet.address) : "no address"
                  } / ${wallet.circleWalletId ?? "no Circle id"} — whatever you've entered above will replace it.`}
                  className="rounded-control border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:border-amber-400"
                  pendingText="Updating…"
                >
                  Update identity
                </ConfirmSubmitButton>
              </form>
            </details>
          </details>
        ))}

      <details className={DETAILS}>
        <summary className="cursor-pointer text-sm font-medium">Deposit from Binance</summary>
        {isBinanceConfigured ? (
          <>
            <p className="mt-2 max-w-2xl text-sm text-neutral-500">
              Pulls USDC from Binance straight to the wallet address above. Capped at{" "}
              <span className="font-medium">{formatPrice(BINANCE_WITHDRAW_CAP_USDC.toFixed(2), "USD")}</span> per
              request regardless of what the Binance API key itself allows. Note: Binance has no listing for
              Polymarket&apos;s current collateral token, so this delivers plain USDC — it will need converting
              before it&apos;s usable as trading collateral.
            </p>
            <form action={depositFromBinance} className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-neutral-500">Amount (USDC)</label>
                <input type="number" name="amountUsdc" step="0.01" min="0.01" max={BINANCE_WITHDRAW_CAP_USDC} required className="w-40 rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground" />
              </div>
              <SubmitButton className="rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90" pendingText="Depositing…">
                Deposit
              </SubmitButton>
            </form>
          </>
        ) : (
          <p className="mt-2 max-w-2xl text-sm text-neutral-500">
            Not configured — set <code className="rounded bg-neutral-100 px-1 py-0.5">BINANCE_API_KEY</code> and{" "}
            <code className="rounded bg-neutral-100 px-1 py-0.5">BINANCE_API_SECRET</code> to enable.
          </p>
        )}
      </details>

      <details className={DETAILS}>
        <summary className="cursor-pointer text-sm font-medium">Withdraw to Binance</summary>
        {isCircleWalletWithdrawConfigured ? (
          <>
            <p className="mt-2 max-w-2xl text-sm text-neutral-500">
              Pushes USDC from the Capital Circle wallet to your Binance deposit address. Capped at{" "}
              <span className="font-medium">{formatPrice(CIRCLE_WALLET_WITHDRAW_CAP_USDC.toFixed(2), "USD")}</span>{" "}
              per request, and checked against the wallet&apos;s actual balance before submitting — this is the only
              way funds leave the wallet outside of live Polymarket trading.
            </p>
            <form action={withdrawFromCircleWallet} className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-neutral-500">Amount (USDC)</label>
                <input type="number" name="amountUsdc" step="0.01" min="0.01" max={CIRCLE_WALLET_WITHDRAW_CAP_USDC} required className="w-40 rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground" />
              </div>
              <SubmitButton className="rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90" pendingText="Withdrawing…">
                Withdraw
              </SubmitButton>
            </form>
          </>
        ) : (
          <p className="mt-2 max-w-2xl text-sm text-neutral-500">
            Not configured — set <code className="rounded bg-neutral-100 px-1 py-0.5">BINANCE_DEPOSIT_ADDRESS</code> to
            your Binance USDC-on-Polygon deposit address to enable. This is the only destination this withdrawal path
            will ever send to.
          </p>
        )}
      </details>

      <details className={DETAILS}>
        <summary className="cursor-pointer text-sm font-medium">Bridge USDC → USDC.e</summary>
        {isCollateralBridgeConfigured ? (
          <>
            <p className="mt-2 max-w-2xl text-sm text-neutral-500">
              Neither Binance nor a direct wallet transfer delivers a token the exchange accepts as collateral —
              Binance sends plain USDC, and CollateralOnramp.wrap() only accepts USDC.e. This sends already-received
              USDC to a fresh Polymarket bridge address, which converts and returns it as USDC.e. Capped at{" "}
              <span className="font-medium">{formatPrice(BRIDGE_TO_USDCE_CAP_USDC.toFixed(2), "USD")}</span> per
              request. This can take a few minutes — use &quot;Check bridge status&quot; below with the deposit
              address it gives you.
            </p>
            <form action={bridgeToUsdcE} className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-neutral-500">Amount (USDC)</label>
                <input type="number" name="amountUsdc" step="0.01" min="0.01" max={BRIDGE_TO_USDCE_CAP_USDC} required className="w-40 rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground" />
              </div>
              <SubmitButton className="rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90" pendingText="Sending…">
                Send to bridge
              </SubmitButton>
            </form>
            <form action={checkBridgeStatus} className="mt-3 flex flex-wrap items-end gap-3 border-t border-border-subtle pt-3">
              <div className="min-w-0 flex-1">
                <label className="block text-xs text-neutral-500">Deposit address (from a previous bridge request)</label>
                <input type="text" name="depositAddress" placeholder="0x…" className={inputClass} />
              </div>
              <SubmitButton className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium hover:border-foreground" pendingText="Checking…">
                Check bridge status
              </SubmitButton>
            </form>
          </>
        ) : (
          <p className="mt-2 max-w-2xl text-sm text-neutral-500">
            {CAPITAL_CIRCLE_NETWORK.isTestnet
              ? "Not available on testnet — the bridge and wrap contract are only confirmed on Polygon mainnet."
              : "Register a wallet first to enable this."}
          </p>
        )}
      </details>

      <details className={DETAILS}>
        <summary className="cursor-pointer text-sm font-medium">Wrap USDC.e → pUSD</summary>
        {isCollateralBridgeConfigured ? (
          <>
            <p className="mt-2 max-w-2xl text-sm text-neutral-500">
              Final step: mints pUSD 1:1 from USDC.e already in the wallet via Polymarket&apos;s CollateralOnramp
              contract. Two on-chain calls — approve, then wrap — and the second only succeeds once the first has
              actually confirmed, not just been submitted. Capped at{" "}
              <span className="font-medium">{formatPrice(WRAP_TO_COLLATERAL_CAP_USDC.toFixed(2), "USD")}</span> per
              request.
            </p>
            <form action={approveForWrap} className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-neutral-500">1. Approve amount (USDC.e)</label>
                <input type="number" name="amountUsdc" step="0.01" min="0.01" max={WRAP_TO_COLLATERAL_CAP_USDC} required className="w-40 rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground" />
              </div>
              <SubmitButton className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium hover:border-foreground" pendingText="Approving…">
                Approve
              </SubmitButton>
            </form>
            <form action={wrapToCollateral} className="mt-3 flex flex-wrap items-end gap-3 border-t border-border-subtle pt-3">
              <div>
                <label className="block text-xs text-neutral-500">2. Wrap amount (USDC.e)</label>
                <input type="number" name="amountUsdc" step="0.01" min="0.01" max={WRAP_TO_COLLATERAL_CAP_USDC} required className="w-40 rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground" />
              </div>
              <SubmitButton className="rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90" pendingText="Wrapping…">
                Wrap to pUSD
              </SubmitButton>
            </form>
            <p className="mt-2 text-xs text-neutral-400">
              Wait for the approve transaction to confirm (check the &quot;Activity&quot; section above, or your own
              explorer) before wrapping — wrapping too soon will simply revert on-chain, costing only gas.
            </p>
          </>
        ) : (
          <p className="mt-2 max-w-2xl text-sm text-neutral-500">
            {CAPITAL_CIRCLE_NETWORK.isTestnet
              ? "Not available on testnet — the bridge and wrap contract are only confirmed on Polygon mainnet."
              : "Register a wallet first to enable this."}
          </p>
        )}
      </details>

    </div>
  );
}
