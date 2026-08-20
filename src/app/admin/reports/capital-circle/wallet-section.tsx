import { Suspense } from "react";
import { Chain, getContractConfig } from "@polymarket/clob-client-v2";
import type { CapitalCircleWalletSummary } from "@/lib/reports/capital-circle";
import { getWalletActivity, getWalletBalanceSnapshot } from "@/lib/reports/capital-circle-wallet";
import { evaluateReadiness, type ReadinessItem, type ReadinessState } from "@/lib/capital-circle/readiness";
import { CAPITAL_CIRCLE_NETWORK, explorerAddressUrl, explorerTokenUrl, explorerTxUrl } from "@/lib/capital-circle/chain";
import { readCollateralAllowance } from "@/lib/capital-circle/onchain";
import { circleWalletAddress, COLLATERAL_TOKEN_ADDRESS } from "@/lib/capital-circle/circle-wallet-client";
import { CAPITAL_CIRCLE_LIVE } from "@/lib/capital-circle/config";
import { truncateAddress } from "@/lib/capital-circle/wallet-identity";
import { walletDepositQrSvg } from "@/lib/capital-circle/wallet-qr";
import { isBinanceConfigured, BINANCE_WITHDRAW_CAP_USDC } from "@/lib/capital-circle/binance-client";
import { depositFromBinance } from "@/lib/capital-circle/binance-actions";
import { isCircleWalletWithdrawConfigured, CIRCLE_WALLET_WITHDRAW_CAP_USDC } from "@/lib/capital-circle/circle-wallet-withdraw";
import { withdrawFromCircleWallet } from "@/lib/capital-circle/circle-withdraw-actions";
import {
  registerCapitalCircleWallet,
  saveCapitalCircleWalletCaps,
  updateCapitalCircleWalletIdentity,
  refreshWalletOnchainData,
} from "@/lib/capital-circle/wallet-actions";
import { formatPrice } from "@/lib/format";
import { moneyColorClass } from "@/components/admin/money-colors";
import { CopyButton } from "@/components/admin/copy-button";
import { SubmitButton } from "@/components/admin/submit-button";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";

const inputClass = "w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground";
const CARD = "rounded-card border border-border-subtle p-4";

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

/**
 * The order-signing exchange contract isn't fixed — resolveVersion() (client.js in
 * @polymarket/clob-client-v2) asks the CLOB API live and defaults to version 2 only if that call
 * fails. Checking allowance against exchangeV2 matches that same fallback default, which is why
 * readiness.ts treats a low reading here as "warn," never "blocked" — this is a best guess about
 * which contract actually needs the approval, not a verified fact.
 */
function bestGuessExchangeSpender(): string {
  const contracts = getContractConfig(CAPITAL_CIRCLE_NETWORK.isTestnet ? Chain.AMOY : Chain.POLYGON);
  return contracts.exchangeV2;
}

function panelSkeleton(lines: number) {
  return (
    <div className={CARD}>
      <div className="h-4 w-32 animate-pulse rounded bg-neutral-100" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="h-3 w-full animate-pulse rounded bg-neutral-100" />
        ))}
      </div>
    </div>
  );
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

/** The wallet used for readiness/balance/activity is "the" env-configured Circle wallet
    (circleWalletAddress), which is a singleton independent of how many CapitalCircleWallet rows
    exist. Picks the first DB row with any address at all — not one that already matches
    circleWalletAddress — specifically so a genuine mismatch stays detectable rather than always
    resolving to "no row found". */
async function ReadinessPanel({ dbWallet }: { dbWallet: CapitalCircleWalletSummary | null }) {
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

  const allClear = items.every((item) => item.state === "ok");

  return (
    <div className={CARD}>
      <h4 className="text-sm font-medium">Readiness</h4>
      {allClear ? (
        <p className="mt-2 text-sm font-medium text-green-700">Ready to trade live.</p>
      ) : (
        <ul className="mt-1 divide-y divide-border-subtle">
          {items.map((item) => (
            <ReadinessRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function BalanceTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-medium tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-neutral-400">{sub}</div>}
    </div>
  );
}

async function BalancePanel() {
  const snapshot = await getWalletBalanceSnapshot();
  const { onchainCollateral, onchainNative, circleCollateral, discrepancyUsd } = snapshot;

  return (
    <div className={CARD}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-medium">Balance</h4>
        <span className="text-xs text-neutral-400">as of {new Date(snapshot.fetchedAtMs).toLocaleTimeString()}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <BalanceTile
          label="On-chain collateral"
          value={onchainCollateral?.ok ? formatPrice(onchainCollateral.value.toFixed(2), "USD") : "—"}
          sub={
            !onchainCollateral
              ? "No wallet configured"
              : onchainCollateral.ok
                ? `block ${onchainCollateral.blockNumber}`
                : onchainCollateral.error.message
          }
        />
        <BalanceTile
          label="POL (gas)"
          value={onchainNative?.ok ? onchainNative.value.toFixed(4) : "—"}
          sub={!onchainNative ? "No wallet configured" : onchainNative.ok ? undefined : onchainNative.error.message}
        />
        <BalanceTile label="Open exposure" value={formatPrice(snapshot.openExposureUsd.toFixed(2), "USD")} sub={`${snapshot.openPositionCount} open position(s)`} />
        <BalanceTile
          label="Room for new positions"
          value={formatPrice(snapshot.roomForNewPositionsUsd.toFixed(2), "USD")}
          sub={`of a $${snapshot.portfolioLimitUsd.toFixed(0)} portfolio limit`}
        />
      </div>
      <div className="mt-3 border-t border-border-subtle pt-3 text-xs text-neutral-500">
        {circleCollateral === null ? (
          "Circle wallet not configured."
        ) : !circleCollateral.ok ? (
          `Circle balance unavailable: ${circleCollateral.reason}`
        ) : discrepancyUsd === null ? (
          <span className="text-green-700">Circle&apos;s reported balance agrees with on-chain.</span>
        ) : (
          <span className={moneyColorClass(-discrepancyUsd)}>
            Circle reports {formatPrice(circleCollateral.amount.toFixed(2), "USD")}, differing from on-chain by{" "}
            {formatPrice(Math.abs(discrepancyUsd).toFixed(2), "USD")}. Usually a lag of a block or two, or an outbound
            transfer Circle has already debited but hasn&apos;t mined yet — worth a second look if it persists.
          </span>
        )}
      </div>
      <form action={refreshWalletOnchainData} className="mt-3">
        <SubmitButton className="rounded-control border border-border-subtle px-3 py-1.5 text-xs font-medium hover:border-foreground" pendingText="Refreshing…">
          Refresh balances
        </SubmitButton>
      </form>
    </div>
  );
}

const ACTIVITY_DIRECTION_CLASS: Record<"in" | "out", string> = { in: "text-green-700", out: "text-red-600" };
const ACTIVITY_DIRECTION_SIGN: Record<"in" | "out", string> = { in: "+", out: "−" };

async function ActivityFeed() {
  const rows = await getWalletActivity();

  return (
    <div className={CARD}>
      <h4 className="text-sm font-medium">Activity</h4>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">Nothing yet — positions, sweeps, and Binance transfers will show up here.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border-subtle">
          {rows.map((row) => (
            <li key={row.key} className="flex items-start justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate text-neutral-700">{row.label}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-neutral-400">
                  <span>{new Date(row.atMs).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
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
      )}
    </div>
  );
}

export async function WalletSection({ wallets }: { wallets: CapitalCircleWalletSummary[] }) {
  const dbWallet = wallets.find((w) => w.address) ?? null;

  return (
    <div className="mt-8">
      <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Wallet</h3>

      {CAPITAL_CIRCLE_NETWORK.isTestnet ? (
        <div className="mt-3 rounded-card border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <span className="font-medium">Configured for {CAPITAL_CIRCLE_NETWORK.label}.</span> Every address and QR
          below is a testnet address. USDC or any other token sent here on Polygon mainnet is very likely
          unrecoverable.
        </div>
      ) : (
        <div className="mt-3 inline-flex items-center gap-2 rounded-control border border-border-subtle px-3 py-1.5 text-xs text-neutral-600">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden />
          {CAPITAL_CIRCLE_NETWORK.label} · chain {CAPITAL_CIRCLE_NETWORK.chainId}
        </div>
      )}

      <p className="mt-3 max-w-2xl text-sm text-neutral-500">
        This never sets anything on Circle&apos;s side — it only records what&apos;s already true there. Provision the
        real wallet with <code className="rounded bg-neutral-100 px-1 py-0.5">scripts/circle-wallet-setup.mjs</code>{" "}
        and set its spending-policy caps directly on Circle (mainnet-only, requires their email OTP to change), then
        mirror those same numbers here so sizing agrees with the real wallet limit instead of falling back to the
        code-level default.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Suspense fallback={panelSkeleton(5)}>
          <ReadinessPanel dbWallet={dbWallet} />
        </Suspense>
        <Suspense fallback={panelSkeleton(4)}>
          <BalancePanel />
        </Suspense>
      </div>

      {wallets.length > 0 && (
        <ul className="mt-3 space-y-3">
          {wallets.map((wallet) => (
            <li key={wallet.id} className={CARD}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="font-mono text-sm">{wallet.circleWalletId ?? wallet.id}</div>
                <WalletStatusPill status={wallet.status} />
              </div>

              {wallet.address && <WalletDepositCard address={wallet.address} />}

              <form action={saveCapitalCircleWalletCaps} className="mt-3 space-y-3">
                <input type="hidden" name="walletId" value={wallet.id} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs text-neutral-500">Status</label>
                    <select name="status" defaultValue={wallet.status} className={inputClass}>
                      <option value="pending">pending</option>
                      <option value="active">active</option>
                      <option value="frozen">frozen</option>
                    </select>
                  </div>
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
                    <input type="checkbox" name="confirmReplace" />I mean to replace the current identity, not just fix a typo
                    elsewhere.
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
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3">
        <Suspense fallback={panelSkeleton(4)}>
          <ActivityFeed />
        </Suspense>
      </div>

      <div className={`mt-3 ${CARD}`}>
        <h4 className="text-sm font-medium">Deposit from Binance</h4>
        {isBinanceConfigured ? (
          <>
            <p className="mt-2 max-w-2xl text-sm text-neutral-500">
              Pulls USDC from Binance straight to the wallet address above. Capped at{" "}
              <span className="font-medium">{formatPrice(BINANCE_WITHDRAW_CAP_USDC.toFixed(2), "USD")}</span> per
              request regardless of what the Binance API key itself allows — pair this with an address-whitelisted,
              IP-restricted key on Binance&apos;s side. Note: Binance has no listing for Polymarket&apos;s current
              collateral token, so this delivers plain USDC — it will need converting before it&apos;s usable as
              trading collateral.
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
            <code className="rounded bg-neutral-100 px-1 py-0.5">BINANCE_API_SECRET</code> to enable. Generate the key
            in Binance&apos;s own dashboard with withdrawals restricted to this wallet&apos;s address and this
            server&apos;s IP — never paste the secret anywhere but{" "}
            <code className="rounded bg-neutral-100 px-1 py-0.5">.env.local</code>.
          </p>
        )}
      </div>

      <div className={`mt-3 ${CARD}`}>
        <h4 className="text-sm font-medium">Withdraw to Binance</h4>
        {isCircleWalletWithdrawConfigured ? (
          <>
            <p className="mt-2 max-w-2xl text-sm text-neutral-500">
              Pushes USDC from the Capital Circle wallet to your Binance deposit address. Capped at{" "}
              <span className="font-medium">{formatPrice(CIRCLE_WALLET_WITHDRAW_CAP_USDC.toFixed(2), "USD")}</span> per
              request, and checked against the wallet&apos;s actual balance before submitting — this is the only way
              funds leave the wallet outside of live Polymarket trading.
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
      </div>

      <details className={`mt-3 ${CARD}`}>
        <summary className="cursor-pointer text-sm font-medium">Register a wallet</summary>
        <form action={registerCapitalCircleWallet} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-neutral-500">Circle wallet id</label>
              <input type="text" name="circleWalletId" placeholder="from circle-wallet-setup.mjs" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Address</label>
              <input type="text" name="address" placeholder="0x…" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Chain</label>
              <input type="text" name="chain" defaultValue="polygon" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Status</label>
              <select name="status" defaultValue="pending" className={inputClass}>
                <option value="pending">pending</option>
                <option value="active">active</option>
                <option value="frozen">frozen</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <WalletCapField name="perTxCapUsd" label="Per-tx cap (USD)" defaultValue="" />
            <WalletCapField name="dailyCapUsd" label="Daily cap (USD)" defaultValue="" />
            <WalletCapField name="weeklyCapUsd" label="Weekly cap (USD)" defaultValue="" />
            <WalletCapField name="monthlyCapUsd" label="Monthly cap (USD)" defaultValue="" />
          </div>
          <SubmitButton className="rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90" pendingText="Registering…">
            Register wallet
          </SubmitButton>
        </form>
      </details>
    </div>
  );
}

/** Split out so the (fast, local, no RPC) QR generation doesn't get lumped visually with the
    Suspense-wrapped, RPC-backed panels above — this renders synchronously with the wallet list. */
async function WalletDepositCard({ address }: { address: string }) {
  const qrSvg = await walletDepositQrSvg(address);

  return (
    <div className="mt-3 flex flex-wrap items-start gap-4">
      <div className="shrink-0 rounded-control border border-border-subtle bg-white p-2" dangerouslySetInnerHTML={{ __html: qrSvg }} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-neutral-500">Scan to deposit ({CAPITAL_CIRCLE_NETWORK.label})</div>
        <p className="mt-1 max-w-xs text-xs text-neutral-500">
          Pre-fills Polymarket&apos;s current collateral token and this address in wallets that support EIP-681
          (MetaMask, Trust Wallet). This is <strong>not always plain USDC</strong> — Polymarket changed collateral
          tokens once already (to pUSD, April 2026) and can again; trust what the QR pre-fills over the word
          &quot;USDC&quot; anywhere else on this page. Always double-check the network is {CAPITAL_CIRCLE_NETWORK.label}{" "}
          before sending.
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <a href={explorerAddressUrl(address)} target="_blank" rel="noreferrer" className="break-all font-mono text-xs text-neutral-500 underline">
            {truncateAddress(address)}
          </a>
          <CopyButton value={address} label="Copy address" className="rounded-control border border-border-subtle px-2 py-1 text-xs font-medium hover:border-foreground" />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
          <span>Token:</span>
          <a href={explorerTokenUrl(COLLATERAL_TOKEN_ADDRESS)} target="_blank" rel="noreferrer" className="font-mono underline">
            {truncateAddress(COLLATERAL_TOKEN_ADDRESS)}
          </a>
          <CopyButton value={COLLATERAL_TOKEN_ADDRESS} label="Copy token" className="rounded-control border border-border-subtle px-2 py-0.5 text-xs hover:border-foreground" />
        </div>
      </div>
    </div>
  );
}
