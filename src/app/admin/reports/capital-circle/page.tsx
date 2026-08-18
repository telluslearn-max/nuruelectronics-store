import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { getCapitalCircleReport, getCapitalCircleWallets, getPendingSweeps } from "@/lib/reports/capital-circle";
import { confirmSweep } from "@/lib/capital-circle/sweep-actions";
import { saveCapitalCircleWallet } from "@/lib/capital-circle/wallet-actions";
import { depositFromBinance } from "@/lib/capital-circle/binance-actions";
import { isBinanceConfigured, BINANCE_WITHDRAW_CAP_USDC } from "@/lib/capital-circle/binance-client";
import { withdrawFromCircleWallet } from "@/lib/capital-circle/circle-withdraw-actions";
import { isCircleWalletWithdrawConfigured, CIRCLE_WALLET_WITHDRAW_CAP_USDC } from "@/lib/capital-circle/circle-wallet-withdraw";
import { walletDepositQrSvg } from "@/lib/capital-circle/wallet-qr";
import { formatPrice } from "@/lib/format";
import { FeedbackBanner } from "@/components/admin/feedback-banner";

export const metadata: Metadata = { title: "Capital Circle" };

const STATUS_STYLES: Record<string, string> = {
  simulated: "bg-neutral-100 text-neutral-600",
  approved: "bg-blue-50 text-blue-700",
  executed: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
};

const WALLET_STATUS_STYLES: Record<string, string> = {
  pending: "bg-neutral-100 text-neutral-600",
  active: "bg-green-50 text-green-700",
  frozen: "bg-red-50 text-red-700",
};

const inputClass =
  "w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground";

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? "bg-neutral-100 text-neutral-600"}`}>
      {status}
    </span>
  );
}

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

export default async function CapitalCirclePage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  await requireAdminSession();
  const [report, pendingSweeps, wallets] = await Promise.all([
    getCapitalCircleReport(),
    getPendingSweeps(),
    getCapitalCircleWallets(),
  ]);
  const { success, error } = await searchParams;
  const depositQrByWalletId = Object.fromEntries(
    await Promise.all(
      wallets
        .filter((wallet) => wallet.address)
        .map(async (wallet) => [wallet.id, await walletDepositQrSvg(wallet.address!)] as const),
    ),
  );

  return (
    <div>
      <h2 className="text-lg font-medium">Capital Circle</h2>
      <FeedbackBanner success={success} error={error} />
      <p className="mt-2 max-w-2xl text-neutral-500">
        The firewalled, USDC-funded pool that hunts for profit outside electronics retail — a Researcher / Risk-Sizing /
        Executor desk running hourly against real, live Polymarket markets resolving in the next 2 hours. Every decision
        here is logged to the audit log before anything (real or simulated) is recorded.
      </p>

      <div
        className={`mt-4 inline-flex items-center gap-2 rounded-control border px-3 py-2 text-sm ${
          report.live ? "border-green-200 bg-green-50 text-green-800" : "border-border-subtle text-neutral-600"
        }`}
      >
        <span className={`h-2 w-2 rounded-full ${report.live ? "bg-green-500" : "bg-neutral-400"}`} />
        {report.live
          ? "Live — a configured Circle wallet can execute real orders."
          : "Simulation mode — no Circle wallet configured yet. Real markets, real reasoning, no real funds."}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-card border border-border-subtle p-4">
          <div className="text-xs text-neutral-500">Simulated (would-execute) total</div>
          <div className="mt-1 text-2xl font-medium tabular-nums">{formatPrice(report.totalSimulatedUsd.toFixed(2), "USD")}</div>
        </div>
        <div className="rounded-card border border-border-subtle p-4">
          <div className="text-xs text-neutral-500">Executed (real) total</div>
          <div className="mt-1 text-2xl font-medium tabular-nums">{formatPrice(report.totalExecutedUsd.toFixed(2), "USD")}</div>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Wallet</h3>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          This never sets anything on Circle's side — it only records what's already true there. Provision the real
          wallet with <code className="rounded bg-neutral-100 px-1 py-0.5">scripts/circle-wallet-setup.mjs</code>{" "}
          and set its spending-policy caps directly on Circle (mainnet-only, requires their email OTP to change),
          then mirror those same numbers here so sizing agrees with the real wallet limit instead of falling back to
          the code-level default.
        </p>

        {wallets.length > 0 && (
          <ul className="mt-3 space-y-3">
            {wallets.map((wallet) => (
              <li key={wallet.id} className="rounded-card border border-border-subtle p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="font-mono text-sm">{wallet.circleWalletId ?? wallet.id}</div>
                  <WalletStatusPill status={wallet.status} />
                </div>
                {wallet.address && (
                  <div className="mt-3 flex flex-wrap items-start gap-4">
                    <div
                      className="shrink-0 rounded-control border border-border-subtle bg-white p-2"
                      dangerouslySetInnerHTML={{ __html: depositQrByWalletId[wallet.id] }}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-neutral-500">Scan to deposit USDC (Polygon)</div>
                      <p className="mt-1 max-w-xs text-xs text-neutral-500">
                        Pre-fills the USDC token and this address in wallets that support EIP-681 (MetaMask, Trust
                        Wallet). Always double-check the network is Polygon before sending.
                      </p>
                      <p className="mt-2 break-all font-mono text-xs text-neutral-500">{wallet.address}</p>
                    </div>
                  </div>
                )}
                <form action={saveCapitalCircleWallet} className="mt-3 space-y-3">
                  <input type="hidden" name="walletId" value={wallet.id} />
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
                  <button
                    type="submit"
                    className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium hover:border-foreground"
                  >
                    Save
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 rounded-card border border-border-subtle p-4">
          <h4 className="text-sm font-medium">Deposit from Binance</h4>
          {isBinanceConfigured ? (
            <>
              <p className="mt-2 max-w-2xl text-sm text-neutral-500">
                Pulls USDC from Binance straight to the wallet address above. Capped at{" "}
                <span className="font-medium">{formatPrice(BINANCE_WITHDRAW_CAP_USDC.toFixed(2), "USD")}</span> per
                request regardless of what the Binance API key itself allows — pair this with an
                address-whitelisted, IP-restricted key on Binance's side.
              </p>
              <form action={depositFromBinance} className="mt-3 flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs text-neutral-500">Amount (USDC)</label>
                  <input
                    type="number"
                    name="amountUsdc"
                    step="0.01"
                    min="0.01"
                    max={BINANCE_WITHDRAW_CAP_USDC}
                    required
                    className="w-40 rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
                >
                  Deposit
                </button>
              </form>
            </>
          ) : (
            <p className="mt-2 max-w-2xl text-sm text-neutral-500">
              Not configured — set <code className="rounded bg-neutral-100 px-1 py-0.5">BINANCE_API_KEY</code> and{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5">BINANCE_API_SECRET</code> to enable. Generate the
              key in Binance's own dashboard with withdrawals restricted to this wallet's address and this server's
              IP — never paste the secret anywhere but <code className="rounded bg-neutral-100 px-1 py-0.5">.env.local</code>.
            </p>
          )}
        </div>

        <div className="mt-3 rounded-card border border-border-subtle p-4">
          <h4 className="text-sm font-medium">Withdraw to Binance</h4>
          {isCircleWalletWithdrawConfigured ? (
            <>
              <p className="mt-2 max-w-2xl text-sm text-neutral-500">
                Pushes USDC from the Capital Circle wallet to your Binance deposit address. Capped at{" "}
                <span className="font-medium">{formatPrice(CIRCLE_WALLET_WITHDRAW_CAP_USDC.toFixed(2), "USD")}</span>{" "}
                per request, and checked against the wallet's actual balance before submitting — this is the only
                way funds leave the wallet outside of live Polymarket trading.
              </p>
              <form action={withdrawFromCircleWallet} className="mt-3 flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs text-neutral-500">Amount (USDC)</label>
                  <input
                    type="number"
                    name="amountUsdc"
                    step="0.01"
                    min="0.01"
                    max={CIRCLE_WALLET_WITHDRAW_CAP_USDC}
                    required
                    className="w-40 rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
                >
                  Withdraw
                </button>
              </form>
            </>
          ) : (
            <p className="mt-2 max-w-2xl text-sm text-neutral-500">
              Not configured — set <code className="rounded bg-neutral-100 px-1 py-0.5">BINANCE_DEPOSIT_ADDRESS</code>{" "}
              to your Binance USDC-on-Polygon deposit address to enable. This is the only destination this
              withdrawal path will ever send to.
            </p>
          )}
        </div>

        <details className="mt-3 rounded-card border border-border-subtle p-4">
          <summary className="cursor-pointer text-sm font-medium">Register a wallet</summary>
          <form action={saveCapitalCircleWallet} className="mt-4 space-y-3">
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
            <button
              type="submit"
              className="rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
            >
              Register wallet
            </button>
          </form>
        </details>
      </div>

      <div className="mt-8">
        <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Pending Sweeps</h3>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          Each week's proposed 40% profit split. Convert it to USDC yourself (Circle Mint or an exchange), send it to
          the wallet, then confirm the amount actually received below — nothing here moves money automatically.
        </p>
        {pendingSweeps.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            No sweeps pending. The weekly cron hits{" "}
            <code className="rounded bg-neutral-100 px-1 py-0.5">/api/cron/profit-sweep</code> every Monday — trigger
            it manually with the <code className="rounded bg-neutral-100 px-1 py-0.5">CRON_SECRET</code> bearer token
            to see one now.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {pendingSweeps.map((sweep) => (
              <li key={sweep.id} className="rounded-card border border-border-subtle p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="font-medium">
                    Week of {sweep.weekStart.toLocaleDateString("en-US", { dateStyle: "medium" })}
                  </div>
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                    pending
                  </span>
                </div>
                <p className="mt-2 text-sm text-neutral-600">
                  Profit {formatPrice(sweep.totalProfitUsd.toFixed(2), "USD")} × {sweep.splitPercent}% ={" "}
                  <span className="font-medium">{formatPrice(sweep.sweepAmountUsd.toFixed(2), "USD")}</span> to sweep.
                </p>
                {sweep.detectedUsdcAmount != null && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                    {formatPrice(sweep.detectedUsdcAmount.toFixed(2), "USD")} USDC detected — landed{" "}
                    {sweep.detectedAt?.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                )}
                <form action={confirmSweep.bind(null, sweep.id)} className="mt-3 flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-xs text-neutral-500">USDC amount received</label>
                    <input
                      type="number"
                      name="confirmedUsdcAmount"
                      step="0.01"
                      min="0"
                      defaultValue={(sweep.detectedUsdcAmount ?? sweep.sweepAmountUsd).toFixed(2)}
                      required
                      className="w-40 rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
                  >
                    Confirm sweep
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8">
        <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Positions</h3>
        {report.positions.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            No cycles have run yet. The cron hits <code className="rounded bg-neutral-100 px-1 py-0.5">/api/cron/capital-circle-cycle</code>{" "}
            every hour — trigger it manually with the <code className="rounded bg-neutral-100 px-1 py-0.5">CRON_SECRET</code> bearer token to see one now.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {report.positions.map((p) => (
              <li key={p.id} className="rounded-card border border-border-subtle p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="font-medium">{p.question}</div>
                  <StatusPill status={p.status} />
                </div>
                <p className="mt-2 text-sm text-neutral-600">{p.thesis}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                  <span className="tabular-nums">{formatPrice(p.sizeUsd.toFixed(2), "USD")}</span>
                  <span>{p.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
                  {p.txHash && <span className="font-mono">{p.txHash}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
