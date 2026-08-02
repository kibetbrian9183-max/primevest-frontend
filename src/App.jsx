import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  Menu,
  Bell,
  ChevronDown,
  ChevronRight,
  X,
  Plus,
  Minus,
  TrendingUp,
  Bot,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  Settings,
  LogOut,
  Wallet,
  UserCog,
  ArrowLeftRight,
  History,
  Gift,
  Moon,
  HelpCircle,
  Shield,
  MessageCircle,
  Info,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  ArrowRight,
  Check,
  ArrowLeft,
  Smartphone,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  PartyPopper,
  XCircle,
  AlertTriangle,
  Square,
  Heart,
  Clock,
  DollarSign,
  Send,
  Image as ImageIcon,
  UserCheck,
  RefreshCw,
} from "lucide-react";


// ---------------------------------------------------------------------------
// Design tokens (custom hex values, applied via inline style since arbitrary
// Tailwind classes aren't available in this environment)
// ---------------------------------------------------------------------------
const c = {
  bg: "#0B0E14",
  surface: "#10141D",
  surfaceAlt: "#151A25",
  elevated: "#1A2030",
  border: "rgba(255,255,255,0.07)",
  borderStrong: "rgba(255,255,255,0.12)",
  text: "#E9ECF2",
  textDim: "#7D8699",
  textFaint: "#4B5566",
  amber: "#FFB020",
  amberDim: "rgba(255,176,32,0.12)",
  green: "#16C784",
  greenDim: "rgba(22,199,132,0.14)",
  red: "#F6465D",
  redDim: "rgba(246,70,93,0.14)",
};

// ---------------------------------------------------------------------------
// Backend wiring — points at the deployed PrimeVest backend. This backend
// is the source of truth for accounts, balances, trades, and payments —
// nothing durable lives only in the browser anymore.
// ---------------------------------------------------------------------------
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const TOKEN_KEY = "primevest_token_v1";

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore — session just won't survive a refresh
  }
}

async function backendApi(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

/** Polls a status endpoint until it resolves to success/failed, or times out. */
async function pollStatus(path, { intervalMs = 2500, timeoutMs = 90000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const data = await backendApi(path);
    if (data.status === "success" || data.status === "failed") return data;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Timed out waiting for confirmation");
}

// Shapes a Mongo trade doc into the fields the UI already expects.
function transformTrade(t) {
  return {
    id: t._id,
    openTime: t.openTime ? new Date(t.openTime).getTime() : Date.now(),
    closeTime: t.closeTime ? new Date(t.closeTime).getTime() : undefined,
    symbolLabel: t.symbolLabel,
    market: t.market,
    marketLabel: t.marketLabel,
    side: t.side,
    sideLabel: t.sideLabel,
    digit: t.digit,
    resultDigit: t.resultDigit,
    stake: t.stake,
    payout: t.payout,
    status: t.status,
    won: t.status === "won",
  };
}

// Shapes a Mongo payment doc into the fields PaymentRow/History expect.
function transformPayment(p) {
  return {
    id: p._id,
    type: p.type,
    amount: p.amountKes,
    usdAmount: p.usdAmount,
    phone: p.phone,
    status: p.status,
    time: p.createdAt ? new Date(p.createdAt).getTime() : Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Mock data generation
// ---------------------------------------------------------------------------
function makeInitialSeries(base, points) {
  const now = Date.now();
  let price = base * 1.0215; // start ~2.15% above so we trend down to `base`
  const out = [];
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    const drift = (base - price) * 0.02;
    const noise = (Math.random() - 0.5) * base * 0.0009;
    price = price + drift + noise;
    out.push({
      idx: i,
      time: new Date(now - (points - i) * 1000),
      price: Number(price.toFixed(2)),
    });
  }
  out[out.length - 1].price = base;
  return out;
}

const BASE_PRICE = 9295.61;
const SYMBOLS = [
  { id: "vol10", short: "VOL 10 (1S)", label: "Volatility 10 (1s)", base: 9295.61, vol: 0.0011 },
  { id: "vol25", short: "VOL 25 (1S)", label: "Volatility 25 (1s)", base: 4820.15, vol: 0.0022 },
  { id: "vol50", short: "VOL 50 (1S)", label: "Volatility 50 (1s)", base: 682.3, vol: 0.0035 },
  { id: "vol75", short: "VOL 75 (1S)", label: "Volatility 75 (1s)", base: 118530.4, vol: 0.0055 },
  { id: "vol100", short: "VOL 100 (1S)", label: "Volatility 100 (1s)", base: 1452.9, vol: 0.008 },
];
const INITIAL_DIGIT_STATS = [8.1, 9.4, 10.2, 9.8, 10.6, 9.1, 10.9, 8.7, 11.3, 11.9];

// Nudge each digit's percentage by a small random amount, then renormalize
// so the row always sums to 100% — simulates a live-updating distribution.
function rotateDigitStats(prev) {
  const nudged = prev.map((v) => Math.max(2, v + (Math.random() - 0.5) * 3.2));
  const sum = nudged.reduce((a, b) => a + b, 0);
  return nudged.map((v) => Number(((v / sum) * 100).toFixed(1)));
}

function maskEmail(email) {
  if (!email || !email.includes("@")) return email || "";
  const [local, domain] = email.split("@");
  return `${local.charAt(0)}****@${domain}`;
}

function relTime(ts) {
  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function PositionCard({ pos }) {
  const isOpen = pos.status === "open";
  const won = pos.status === "won";
  const profit = won ? pos.payout - pos.stake : -pos.stake;
  const contractValue = won ? pos.payout : 0;

  return (
    <div className="rounded-2xl border p-4" style={{ background: c.surface, borderColor: c.border }}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: isOpen ? c.amberDim : won ? c.greenDim : c.redDim }}
          >
            {isOpen ? (
              <Loader2 size={17} className="animate-spin" style={{ color: c.amber }} />
            ) : won ? (
              <ArrowUpRight size={18} style={{ color: c.green }} />
            ) : (
              <ArrowDownRight size={18} style={{ color: c.red }} />
            )}
          </div>
          <div>
            <div className="text-sm font-bold">{pos.symbolLabel || "Volatility 10 (1s)"}</div>
            <div className="text-xs" style={{ color: c.textDim }}>Index</div>
          </div>
        </div>
        <span
          className="flex items-center gap-1 text-xs font-bold flex-shrink-0"
          style={{ color: isOpen ? c.amber : won ? c.green : c.red }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: isOpen ? c.amber : won ? c.green : c.red }}
          />
          {pos.sideLabel}
        </span>
      </div>
      <div
        className="text-xs font-semibold mb-2"
        style={{ color: isOpen ? c.amber : won ? c.green : c.red }}
      >
        {isOpen ? "Open" : "Closed"}
      </div>
      {isOpen ? (
        <div className="text-xs" style={{ color: c.textDim }}>
          Stake <span className="font-bold" style={{ color: c.text }}>${pos.stake.toFixed(2)}</span> · waiting
          for the next tick…
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-y-2 text-xs">
          <div>
            <span style={{ color: c.textDim }}>Total profit/loss:</span>
            <div className="font-bold font-mono" style={{ color: won ? c.green : c.red }}>
              {won ? "+" : "-"}{Math.abs(profit).toFixed(2)}
            </div>
          </div>
          <div>
            <span style={{ color: c.textDim }}>Contract value:</span>
            <div className="font-bold font-mono" style={{ color: won ? c.green : c.red }}>
              {contractValue.toFixed(2)}
            </div>
          </div>
          <div>
            <span style={{ color: c.textDim }}>Stake:</span>
            <div className="font-bold font-mono">{pos.stake.toFixed(2)}</div>
          </div>
          <div>
            <span style={{ color: c.textDim }}>Potential payout:</span>
            <div className="font-bold font-mono">{pos.payout.toFixed(2)}</div>
          </div>
        </div>
      )}
      <div className="text-[11px] mt-2" style={{ color: c.textFaint }}>
        {relTime(pos.closeTime || pos.openTime)}
      </div>
    </div>
  );
}

function PositionsPanel({ trades, posTab, setPosTab }) {
  const open = trades.filter((t) => t.status === "open");
  const closed = trades.filter((t) => t.status === "won" || t.status === "lost");

  // Two transaction rows per resolved trade (Stake, then Closed), one for open trades (Stake only).
  const transactions = [];
  for (const t of trades) {
    transactions.push({
      id: `${t.id}-stake`,
      time: t.openTime,
      label: "Stake",
      sub: t.sideLabel,
      amount: -t.stake,
      tone: "stake",
    });
    if (t.status !== "open") {
      transactions.push({
        id: `${t.id}-closed`,
        time: t.closeTime,
        label: "Closed",
        sub: t.sideLabel,
        amount: t.status === "won" ? t.payout : -t.stake,
        tone: t.status,
      });
    }
  }
  transactions.sort((a, b) => b.time - a.time);

  const list = posTab === "open" ? open : posTab === "closed" ? closed : null;

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {[
          { id: "open", label: `Open (${open.length})` },
          { id: "closed", label: `Closed (${closed.length})` },
          { id: "transactions", label: "Transactions" },
        ].map((tab) => {
          const active = posTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setPosTab(tab.id)}
              className="flex-1 h-10 rounded-xl text-xs sm:text-sm font-bold transition"
              style={{
                background: active ? c.amber : c.surfaceAlt,
                color: active ? "#181205" : c.textDim,
                border: `1px solid ${active ? c.amber : c.border}`,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {posTab === "transactions" ? (
        transactions.length === 0 ? (
          <div className="text-center py-16 text-sm" style={{ color: c.textDim }}>
            No transactions yet.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center gap-3 rounded-2xl border p-3.5"
                style={{ background: c.surface, borderColor: c.border }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background:
                      tx.tone === "won" ? c.greenDim : tx.tone === "lost" ? c.redDim : c.amberDim,
                  }}
                >
                  {tx.tone === "won" ? (
                    <ArrowUpRight size={16} style={{ color: c.green }} />
                  ) : (
                    <ArrowDownRight size={16} style={{ color: tx.tone === "lost" ? c.red : c.amber }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-sm font-bold"
                      style={{ color: tx.tone === "won" ? c.green : tx.tone === "lost" ? c.red : c.text }}
                    >
                      {tx.label}
                    </span>
                    <span
                      className="text-sm font-bold font-mono flex-shrink-0"
                      style={{
                        color:
                          tx.amount >= 0 && tx.tone === "won" ? c.green : c.amber,
                      }}
                    >
                      {tx.amount >= 0 ? "+" : ""}
                      {tx.amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs" style={{ color: c.textDim }}>
                      {tx.sub}
                    </span>
                    <span className="text-xs font-mono flex-shrink-0" style={{ color: c.textFaint }}>
                      {relTime(tx.time)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
            style={{ background: c.surfaceAlt }}
          >
            <Briefcase size={22} style={{ color: c.textFaint }} />
          </div>
          <h3 className="text-sm font-bold mb-1">
            {posTab === "open" ? "No open positions" : "No closed trades yet"}
          </h3>
          <p className="text-xs max-w-xs" style={{ color: c.textDim }}>
            {posTab === "open"
              ? "Trades you place will appear here while they're running."
              : "Resolved trades will show up here."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {list.map((pos) => (
            <PositionCard key={pos.id} pos={pos} />
          ))}
        </div>
      )}
    </div>
  );
}

function TradingDashboard({
  onLogout,
  onNavigate,
  balance,
  demoBalance,
  realBalance,
  accountType,
  onSwitchAccount,
  onBalanceSet,
  trades,
  onAddTrade,
  onResolveTrade,
  user,
}) {
  const [symbolId, setSymbolId] = useState("vol10");
  const [symbolMenuOpen, setSymbolMenuOpen] = useState(false);
  const symbol = SYMBOLS.find((s) => s.id === symbolId) || SYMBOLS[0];
  const [data, setData] = useState(() => makeInitialSeries(symbol.base, 80));
  const [zoomPoints, setZoomPoints] = useState(40);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkTheme, setDarkTheme] = useState(true);
  const [balanceMenuOpen, setBalanceMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("evenodd");
  const [mode, setMode] = useState("AUTO");
  const [stake, setStake] = useState(10);
  const [stakeInput, setStakeInput] = useState("10");
  const [targetProfit, setTargetProfit] = useState("200");
  const [stopLoss, setStopLoss] = useState("999");
  const [multiplier, setMultiplier] = useState("2");
  const [selectedDigit, setSelectedDigit] = useState(5);
  const [flash, setFlash] = useState(null);
  const [digitStats, setDigitStats] = useState(INITIAL_DIGIT_STATS);
  const [tradeInFlight, setTradeInFlight] = useState(false);
  const [resultAlert, setResultAlert] = useState(null); // { type: "win" | "loss" | "error", title, message }
  const [notifications, setNotifications] = useState([]);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);

  useEffect(() => {
    backendApi("/api/notifications")
      .then(({ notifications }) => setNotifications(notifications))
      .catch(() => {});
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function openNotifications() {
    const opening = !notifPanelOpen;
    setNotifPanelOpen(opening);
    if (opening && unreadCount > 0) {
      const unread = notifications.filter((n) => !n.read);
      setNotifications((list) => list.map((n) => ({ ...n, read: true })));
      unread.forEach((n) => {
        backendApi(`/api/notifications/${n._id}/read`, { method: "PATCH" }).catch(() => {});
      });
    }
  }
  const [view, setView] = useState("trade"); // "trade" | "positions"
  const [posTab, setPosTab] = useState("open"); // "open" | "closed" | "transactions"
  const [autoRunning, setAutoRunning] = useState(false);
  const [runningSide, setRunningSide] = useState(null);
  const [stopRequested, setStopRequested] = useState(false);
  const [sessionStats, setSessionStats] = useState({ trades: 0, wins: 0, losses: 0, net: 0 });

  const balanceRef = useRef(balance);
  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);
  const runningRef = useRef(false);
  const sessionStatsRef = useRef({ trades: 0, wins: 0, losses: 0, net: 0 });

  const openingPriceRef = useRef(data[0].price);

  // Switching symbols starts a fresh price series for that instrument.
  function switchSymbol(id) {
    if (autoRunning) return;
    const next = SYMBOLS.find((s) => s.id === id);
    if (!next) return;
    setSymbolId(id);
    setSymbolMenuOpen(false);
    const freshData = makeInitialSeries(next.base, 80);
    setData(freshData);
    openingPriceRef.current = freshData[0].price;
  }

  // simulate a live-ish feed, scaled to the active symbol's volatility
  useEffect(() => {
    const id = setInterval(() => {
      setData((prev) => {
        const last = prev[prev.length - 1].price;
        const noise = (Math.random() - 0.5) * symbol.base * symbol.vol;
        const next = Number((last + noise).toFixed(2));
        const nextPoint = { idx: prev[prev.length - 1].idx + 1, time: new Date(), price: next };
        const merged = [...prev.slice(1), nextPoint];
        return merged;
      });
    }, 2000);
    return () => clearInterval(id);
  }, [symbol.base, symbol.vol]);

  // rotate the last-digit probabilities to feel live, in step with the tick feed
  useEffect(() => {
    const id = setInterval(() => {
      setDigitStats((prev) => rotateDigitStats(prev));
    }, 1800);
    return () => clearInterval(id);
  }, []);

  const visibleData = useMemo(() => data.slice(-zoomPoints), [data, zoomPoints]);
  const currentPrice = data[data.length - 1].price;
  const changePct = useMemo(() => {
    const open = openingPriceRef.current;
    return ((currentPrice - open) / open) * 100;
  }, [currentPrice]);
  const isUp = changePct >= 0;
  const trendColor = isUp ? c.green : c.red;

  const payoutRate = 1.952; // 95.2% return
  const payout = (stake * payoutRate).toFixed(2);

  const quickAmounts = [1, 5, 10, 25, 50, 100];

  function commitStake(val) {
    const n = Math.max(0, Number(val) || 0);
    setStake(n);
    setStakeInput(String(n));
  }

  // Which two contract types are offered for the active market tab.
  const marketConfig = {
    matches: {
      left: { key: "matches", label: "Matches", hint: "Digit = prediction" },
      right: { key: "differs", label: "Differs", hint: "Digit ≠ prediction" },
      needsDigit: true,
      digitLabel: "SELECT YOUR PREDICTION DIGIT",
    },
    evenodd: {
      left: { key: "even", label: "Even", hint: "Last digit is even" },
      right: { key: "odd", label: "Odd", hint: "Last digit is odd" },
      needsDigit: false,
      digitLabel: "LAST DIGIT PROBABILITY",
    },
    overunder: {
      left: { key: "over", label: "Over", hint: `Digit > ${selectedDigit}` },
      right: { key: "under", label: "Under", hint: `Digit < ${selectedDigit}` },
      needsDigit: true,
      digitLabel: "SELECT THRESHOLD DIGIT",
    },
  };
  const market = marketConfig[activeTab];

  async function openPosition(side, marketSnapshot, digitSnapshot, stakeAmt) {
    const marketLabel =
      activeTab === "matches" ? "Matches/Differs" : activeTab === "evenodd" ? "Even/Odd" : "Over/Under";
    const sideLabel = side === marketSnapshot.left.key ? marketSnapshot.left.label : marketSnapshot.right.label;

    const { tradeId, balance: newBalance } = await backendApi("/api/trades", {
      method: "POST",
      body: JSON.stringify({
        accountType,
        symbolLabel: symbol.label,
        market: activeTab,
        marketLabel,
        side,
        sideLabel,
        digit: digitSnapshot,
        stake: stakeAmt,
      }),
    });

    balanceRef.current = newBalance;
    onBalanceSet?.(accountType, newBalance);
    onAddTrade?.({
      id: tradeId,
      openTime: Date.now(),
      symbolLabel: symbol.label,
      market: activeTab,
      marketLabel,
      side,
      sideLabel,
      digit: digitSnapshot,
      stake: stakeAmt,
      payout: Number((stakeAmt * payoutRate).toFixed(2)),
      status: "open",
    });
    return tradeId;
  }

  async function runTick(side, marketSnapshot, digitSnapshot, stakeAmt, targetProfitVal, stopLossVal, isAuto) {
    let id;
    try {
      id = await openPosition(side, marketSnapshot, digitSnapshot, stakeAmt);
    } catch (err) {
      runningRef.current = false;
      setAutoRunning(false);
      setStopRequested(false);
      setTradeInFlight(false);
      setResultAlert({ type: "error", title: "Couldn't place trade", message: err.message });
      return;
    }

    window.setTimeout(async () => {
      let result;
      try {
        result = await backendApi(`/api/trades/${id}/resolve`, { method: "PATCH" });
      } catch (err) {
        runningRef.current = false;
        setAutoRunning(false);
        setStopRequested(false);
        setTradeInFlight(false);
        setResultAlert({ type: "error", title: "Couldn't resolve trade", message: err.message });
        return;
      }

      const { won, resultDigit, payout: payoutAmt, balance: newBalance } = result;
      balanceRef.current = newBalance;
      onBalanceSet?.(accountType, newBalance);

      onResolveTrade?.(id, {
        status: won ? "won" : "lost",
        won,
        resultDigit,
        closeTime: Date.now(),
      });

      const prev = sessionStatsRef.current;
      const next = {
        trades: prev.trades + 1,
        wins: prev.wins + (won ? 1 : 0),
        losses: prev.losses + (won ? 0 : 1),
        net: Number((prev.net + (won ? payoutAmt - stakeAmt : -stakeAmt)).toFixed(2)),
      };
      sessionStatsRef.current = next;
      setSessionStats(next);

      if (!isAuto) {
        setResultAlert({
          type: won ? "win" : "loss",
          title: won ? "Congratulations! 🎉" : "Trade lost",
          message: won
            ? `The last digit was ${resultDigit} — your trade won. $${payoutAmt.toFixed(
                2
              )} has been added to your balance.`
            : `The last digit was ${resultDigit} — this trade didn't win. $${stakeAmt.toFixed(
                2
              )} was deducted from your balance.`,
        });
        setTradeInFlight(false);
        return;
      }

      // AUTO mode: decide whether to run another tick.
      const hitTarget = targetProfitVal && next.net >= Number(targetProfitVal);
      const hitStopLoss = stopLossVal && next.net <= -Number(stopLossVal);
      const outOfFunds = stakeAmt > balanceRef.current;
      const shouldStop = !runningRef.current || hitTarget || hitStopLoss || outOfFunds;

      if (shouldStop) {
        runningRef.current = false;
        setAutoRunning(false);
        setStopRequested(false);
        setResultAlert({
          type: next.net >= 0 ? "win" : "loss",
          title: hitTarget
            ? "Target profit reached 🎯"
            : hitStopLoss
            ? "Stop loss reached"
            : outOfFunds
            ? "Stopped — insufficient balance"
            : "Session stopped",
          message: `${next.trades} trade${next.trades === 1 ? "" : "s"} · ${next.wins} won · ${
            next.losses
          } lost. Net ${next.net >= 0 ? "+" : ""}$${next.net.toFixed(2)}.`,
        });
      } else {
        window.setTimeout(
          () => runTick(side, marketSnapshot, digitSnapshot, stakeAmt, targetProfitVal, stopLossVal, true),
          350
        );
      }
    }, 1400);
  }

  function handleTradeButtonClick(side) {
    if (tradeInFlight || autoRunning) return;

    if (!stake || stake <= 0) {
      setResultAlert({
        type: "error",
        title: "Enter a stake",
        message: "Enter a stake amount before placing a trade.",
      });
      return;
    }

    if (stake > balance) {
      setResultAlert({
        type: "error",
        title: "Insufficient balance",
        message: `Your stake is $${stake.toFixed(2)} but your balance is only $${balance.toFixed(
          2
        )}. Deposit more funds to place this trade.`,
      });
      return;
    }

    setFlash(side);
    window.setTimeout(() => setFlash(null), 500);

    const marketSnapshot = market;
    const digitSnapshot = selectedDigit;
    const stakeAmt = stake;

    if (mode === "AUTO") {
      runningRef.current = true;
      sessionStatsRef.current = { trades: 0, wins: 0, losses: 0, net: 0 };
      setSessionStats(sessionStatsRef.current);
      setStopRequested(false);
      setAutoRunning(true);
      setRunningSide(side);
      runTick(side, marketSnapshot, digitSnapshot, stakeAmt, targetProfit, stopLoss, true);
    } else {
      setTradeInFlight(true);
      runTick(side, marketSnapshot, digitSnapshot, stakeAmt, null, null, false);
    }
  }

  function requestStopRun() {
    runningRef.current = false;
    setStopRequested(true);
  }

  return (
    <div
      className="min-h-screen w-full font-sans"
      style={{ background: c.bg, color: c.text }}
    >
      {/* ================= TOP NAV ================= */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between gap-2 px-3 sm:px-6 h-16 border-b backdrop-blur"
        style={{ background: "rgba(11,14,20,0.92)", borderColor: c.border }}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-xl font-bold text-base"
            style={{ background: c.amber, color: "#181205" }}
          >
            T
          </div>
          <span className="hidden sm:block text-sm font-semibold tracking-wide" style={{ color: c.textDim }}>
            TRADEX
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Balance dropdown */}
          <div className="relative">
            <button
              onClick={() => !autoRunning && setBalanceMenuOpen((v) => !v)}
              disabled={autoRunning}
              className="flex items-center gap-1.5 h-10 px-3 rounded-xl border text-sm font-semibold font-mono"
              style={{
                background: c.surfaceAlt,
                borderColor: c.border,
                color: c.text,
                opacity: autoRunning ? 0.6 : 1,
                cursor: autoRunning ? "not-allowed" : "pointer",
              }}
            >
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{
                  background: accountType === "demo" ? c.amberDim : c.greenDim,
                  color: accountType === "demo" ? c.amber : c.green,
                }}
              >
                {accountType === "demo" ? "DEMO" : "REAL"}
              </span>
              ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              <ChevronDown size={15} style={{ color: c.textDim }} />
            </button>
            {balanceMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-48 rounded-xl border overflow-hidden shadow-2xl z-20"
                style={{ background: c.elevated, borderColor: c.border }}
              >
                <button
                  onClick={() => {
                    onSwitchAccount?.("demo");
                    setBalanceMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between text-left px-4 py-3 text-sm hover:bg-white/5"
                  style={{ color: c.text, background: accountType === "demo" ? c.amberDim : "transparent" }}
                >
                  <span>
                    Demo account
                    <div className="text-xs font-mono" style={{ color: c.textDim }}>
                      ${demoBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </span>
                  {accountType === "demo" && <Check size={14} style={{ color: c.amber }} />}
                </button>
                <div style={{ borderTop: `1px solid ${c.border}` }} />
                <button
                  onClick={() => {
                    onSwitchAccount?.("real");
                    setBalanceMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between text-left px-4 py-3 text-sm hover:bg-white/5"
                  style={{ color: c.text, background: accountType === "real" ? c.greenDim : "transparent" }}
                >
                  <span>
                    Real account
                    <div className="text-xs font-mono" style={{ color: c.textDim }}>
                      ${realBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </span>
                  {accountType === "real" && <Check size={14} style={{ color: c.green }} />}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigate?.("deposit")}
            className="hidden xs:flex items-center h-10 px-4 rounded-xl text-sm font-bold"
            style={{ background: c.amber, color: "#181205" }}
          >
            Deposit
          </button>
          <button
            onClick={() => onNavigate?.("deposit")}
            className="flex sm:hidden items-center justify-center w-10 h-10 rounded-xl text-sm font-bold"
            style={{ background: c.amber, color: "#181205" }}
            aria-label="Deposit"
          >
            +
          </button>

          <div className="relative">
            <button
              onClick={openNotifications}
              className="relative flex items-center justify-center w-10 h-10 rounded-xl border"
              style={{ background: c.surfaceAlt, borderColor: c.border }}
              aria-label="Notifications"
            >
              <Bell size={18} style={{ color: c.textDim }} />
              {unreadCount > 0 && (
                <span
                  className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
                  style={{ background: c.amber }}
                />
              )}
            </button>
            {notifPanelOpen && (
              <div
                className="absolute right-0 mt-2 w-72 max-h-96 overflow-y-auto rounded-xl border shadow-2xl z-20"
                style={{ background: c.elevated, borderColor: c.border }}
              >
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm" style={{ color: c.textDim }}>
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n._id}
                      className="px-4 py-3 border-b"
                      style={{ borderColor: c.border }}
                    >
                      <div className="text-sm font-bold mb-0.5">{n.title}</div>
                      <div className="text-xs mb-1" style={{ color: c.textDim }}>{n.body}</div>
                      <div className="text-[11px]" style={{ color: c.textFaint }}>
                        {relTime(new Date(n.createdAt).getTime())}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center justify-center w-10 h-10 rounded-xl border"
            style={{ background: c.surfaceAlt, borderColor: c.border }}
            aria-label="Menu"
          >
            <Menu size={18} style={{ color: c.textDim }} />
          </button>
        </div>
      </header>

      {/* ================= SIDEBAR DRAWER ================= */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.55)" }}
            onClick={() => setSidebarOpen(false)}
          />
          <div
            className="relative w-80 max-w-[85%] h-full overflow-y-auto"
            style={{ background: c.surface, borderLeft: `1px solid ${c.border}` }}
          >
            <div className="flex items-center justify-between px-5 py-5 border-b" style={{ borderColor: c.border }}>
              <button onClick={() => setSidebarOpen(false)} aria-label="Close menu">
                <X size={22} style={{ color: c.text }} />
              </button>
              <span className="text-lg font-bold">Menu</span>
              <span className="flex items-center gap-1 text-sm font-semibold" style={{ color: c.text }}>
                🇬🇧 EN
              </span>
            </div>

            <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: c.border }}>
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl flex-shrink-0"
                style={{ background: "#3B6DF0", color: "#FFFFFF" }}
              >
                {(user?.name?.trim()?.charAt(0) || user?.email?.charAt(0) || "T").toUpperCase()}
              </div>
              <div>
                <div className="text-base font-bold">
                  {user?.name?.trim() || user?.email?.split("@")[0] || "Trader"}
                </div>
                <div className="text-sm" style={{ color: c.textDim }}>
                  {user?.email ? maskEmail(user.email) : "No email on file"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: c.border }}>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center font-bold flex-shrink-0"
                style={{ background: "#F0475B", color: "#FFFFFF" }}
              >
                P
              </div>
              <span className="text-base font-bold">PrimeVest</span>
            </div>

            <nav className="py-2 border-b" style={{ borderColor: c.border }}>
              {[
                { icon: UserCog, label: "Account Settings", nav: "settings" },
                { icon: Wallet, label: "Deposit", nav: "deposit" },
                { icon: ArrowLeftRight, label: "Withdraw", nav: "withdraw" },
                { icon: History, label: "History", nav: "history" },
                { icon: Gift, label: "Refer & Earn", highlight: true, nav: "refer" },
              ].map(({ icon: Icon, label, highlight, nav }) => (
                <button
                  key={label}
                  onClick={() => {
                    if (nav) onNavigate?.(nav);
                    else setSidebarOpen(false);
                  }}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-sm hover:bg-white/5"
                  style={{
                    color: highlight ? "#C77DFF" : c.text,
                    background: highlight ? "rgba(124,58,237,0.18)" : "transparent",
                  }}
                >
                  <span className="flex items-center gap-4">
                    <Icon size={19} style={{ color: highlight ? "#C77DFF" : c.textDim }} />
                    <span className="font-medium">{label}</span>
                  </span>
                  <ChevronRight size={17} style={{ color: highlight ? "#C77DFF" : c.textDim }} />
                </button>
              ))}
            </nav>

            <nav className="py-2 border-b" style={{ borderColor: c.border }}>
              <div className="w-full flex items-center justify-between gap-4 px-5 py-4 text-sm">
                <span className="flex items-center gap-4">
                  <Moon size={19} style={{ color: c.textDim }} />
                  <span className="font-medium">Dark Theme</span>
                </span>
                <button
                  onClick={() => setDarkTheme((v) => !v)}
                  className="relative w-11 h-6 rounded-full transition-colors"
                  style={{ background: darkTheme ? "#3B82F6" : c.borderStrong }}
                  aria-label="Toggle dark theme"
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                    style={{ transform: darkTheme ? "translateX(22px)" : "translateX(2px)" }}
                  />
                </button>
              </div>
              {[
                { icon: Bell, label: "Notifications" },
                { icon: HelpCircle, label: "Help Centre", nav: "livechat" },
                { icon: Shield, label: "Security" },
                { icon: MessageCircle, label: "Live Chat", nav: "livechat" },
                { icon: Info, label: "About PrimeVest", nav: "about" },
              ].map(({ icon: Icon, label, nav }) => (
                <button
                  key={label}
                  onClick={() => {
                    if (nav) onNavigate?.(nav);
                    else setSidebarOpen(false);
                  }}
                  className="w-full flex items-center gap-4 px-5 py-4 text-sm hover:bg-white/5"
                  style={{ color: c.text }}
                >
                  <Icon size={19} style={{ color: c.textDim }} />
                  <span className="font-medium">{label}</span>
                </button>
              ))}
            </nav>

            <button
              onClick={() => onLogout?.()}
              className="w-full flex items-center gap-3 px-5 py-5 text-sm font-medium"
              style={{ color: c.red }}
            >
              <LogOut size={19} />
              Log Out
            </button>
          </div>
        </div>
      )}

      {/* ================= MAIN ================= */}
      <main className="max-w-7xl mx-auto px-3 sm:px-5 pb-28 lg:pb-10 pt-4">
        {view === "trade" && (
        <div className="lg:grid lg:grid-cols-3 lg:gap-4">
          {/* LEFT / MAIN COLUMN */}
          <div className="lg:col-span-2 min-w-0">
            {/* Market tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 mb-3 -mx-1 px-1">
              {[
                { id: "matches", label: "Matches/Differs" },
                { id: "evenodd", label: "Even/Odd" },
                { id: "overunder", label: "Over/Under" },
              ].map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => !autoRunning && setActiveTab(tab.id)}
                    disabled={autoRunning}
                    className="flex-shrink-0 h-12 px-5 rounded-2xl text-sm font-semibold whitespace-nowrap transition"
                    style={{
                      background: active ? c.amber : c.surfaceAlt,
                      color: active ? "#181205" : c.textDim,
                      border: `1px solid ${active ? c.amber : c.border}`,
                      opacity: autoRunning ? 0.5 : 1,
                      cursor: autoRunning ? "not-allowed" : "pointer",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Chart card */}
            <div
              className="rounded-3xl border overflow-hidden mb-4"
              style={{ background: c.bg, borderColor: c.border, boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}
            >
              <div className="flex items-start justify-between px-4 sm:px-5 pt-4 pb-2">
                <div className="relative">
                  <button
                    onClick={() => !autoRunning && setSymbolMenuOpen((v) => !v)}
                    disabled={autoRunning}
                    className="flex items-center gap-2 mb-1.5"
                    style={{ cursor: autoRunning ? "not-allowed" : "pointer" }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: c.amber, boxShadow: `0 0 8px ${c.amber}` }}
                    />
                    <span className="text-xs font-semibold tracking-wide" style={{ color: c.textDim }}>
                      {symbol.short}
                    </span>
                    <ChevronDown size={13} style={{ color: c.textFaint }} />
                  </button>
                  {symbolMenuOpen && (
                    <div
                      className="absolute left-0 top-full mt-1 w-52 rounded-xl border overflow-hidden shadow-2xl z-20"
                      style={{ background: c.elevated, borderColor: c.border }}
                    >
                      {SYMBOLS.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => switchSymbol(s.id)}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 flex items-center justify-between"
                          style={{ color: s.id === symbolId ? c.amber : c.text }}
                        >
                          {s.label}
                          {s.id === symbolId && <Check size={14} style={{ color: c.amber }} />}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums">
                      {currentPrice.toFixed(2)}
                    </span>
                    <span
                      className="flex items-center gap-0.5 text-sm font-semibold font-mono"
                      style={{ color: trendColor }}
                    >
                      {isUp ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                      {changePct.toFixed(2)}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setZoomPoints((z) => Math.min(data.length, z + 10))}
                    className="flex items-center justify-center w-9 h-9 rounded-xl border"
                    style={{ background: c.surfaceAlt, borderColor: c.border }}
                    aria-label="Zoom out"
                  >
                    <Minus size={16} style={{ color: c.textDim }} />
                  </button>
                  <button
                    onClick={() => setZoomPoints((z) => Math.max(15, z - 10))}
                    className="flex items-center justify-center w-9 h-9 rounded-xl border"
                    style={{ background: c.surfaceAlt, borderColor: c.border }}
                    aria-label="Zoom in"
                  >
                    <Plus size={16} style={{ color: c.textDim }} />
                  </button>
                </div>
              </div>

              <div className="h-56 sm:h-72 w-full px-1 sm:px-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={visibleData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.045)" vertical={false} />
                    <XAxis
                      dataKey="time"
                      tickFormatter={(t) =>
                        new Date(t).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" })
                      }
                      tick={{ fill: c.textFaint, fontSize: 10 }}
                      axisLine={{ stroke: c.border }}
                      tickLine={false}
                      minTickGap={30}
                    />
                    <YAxis
                      orientation="right"
                      domain={["auto", "auto"]}
                      tick={{ fill: c.textFaint, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={54}
                      tickFormatter={(v) => v.toFixed(1)}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke={trendColor}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Digit selector */}
            <div
              className="rounded-3xl border mb-4 px-3 py-4"
              style={{
                background: c.surface,
                borderColor: c.border,
                opacity: market.needsDigit && !autoRunning ? 1 : 0.6,
              }}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-semibold tracking-wide" style={{ color: c.textDim }}>
                  {market.digitLabel}
                </span>
                {!market.needsDigit && (
                  <span className="text-[11px] font-medium" style={{ color: c.textFaint }}>
                    Not used for Even/Odd
                  </span>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {digitStats.map((pct, digit) => {
                  const selected = digit === selectedDigit;
                  const highest = pct === Math.max(...digitStats);
                  const interactive = market.needsDigit && !autoRunning;
                  return (
                    <button
                      key={digit}
                      onClick={() => interactive && setSelectedDigit(digit)}
                      disabled={!interactive}
                      className="flex-shrink-0 flex flex-col items-center gap-1.5"
                      style={{ cursor: interactive ? "pointer" : "default" }}
                    >
                      <span
                        className="flex items-center justify-center rounded-full font-bold text-base transition"
                        style={{
                          width: 46,
                          height: 46,
                          background: selected && interactive ? c.amber : c.elevated,
                          color: selected && interactive ? "#181205" : c.text,
                          border: `1px solid ${selected && interactive ? c.amber : c.border}`,
                        }}
                      >
                        {digit}
                      </span>
                      <span
                        className="text-[11px] font-mono tabular-nums transition-all duration-700 ease-out"
                        style={{
                          color: selected && interactive ? c.amber : highest ? c.text : c.textDim,
                          fontWeight: highest ? 700 : 400,
                        }}
                      >
                        {pct.toFixed(1)}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT / TRADING PANEL */}
          <div className="lg:col-span-1">
            <div
              className="rounded-3xl border p-4 sm:p-5 mb-4"
              style={{ background: c.surface, borderColor: c.border }}
            >
              {/* AUTO / MANUAL */}
              <div
                className="flex p-1 rounded-2xl mb-5"
                style={{ background: c.bg }}
              >
                {["AUTO", "MANUAL"].map((m) => {
                  const active = mode === m;
                  return (
                    <button
                      key={m}
                      onClick={() => !autoRunning && !tradeInFlight && setMode(m)}
                      disabled={autoRunning || tradeInFlight}
                      className="flex-1 h-11 rounded-xl text-sm font-bold transition"
                      style={{
                        background: active ? c.amber : "transparent",
                        color: active ? "#181205" : c.textDim,
                        opacity: autoRunning || tradeInFlight ? 0.6 : 1,
                        cursor: autoRunning || tradeInFlight ? "not-allowed" : "pointer",
                      }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>

              {/* Stake */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold tracking-wide" style={{ color: c.textDim }}>
                    STAKE
                  </label>
                  <span className="text-xs font-mono" style={{ color: c.textFaint }}>
                    Payout&nbsp;
                    <span className="font-bold" style={{ color: c.amber }}>
                      ${payout}
                    </span>
                  </span>
                </div>
                <div
                  className="flex items-center gap-2 h-14 rounded-2xl border px-4"
                  style={{ background: c.bg, borderColor: c.borderStrong, opacity: autoRunning ? 0.6 : 1 }}
                >
                  <span className="text-xl font-bold font-mono" style={{ color: c.textDim }}>$</span>
                  <input
                    value={stakeInput}
                    disabled={autoRunning}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9.]/g, "");
                      setStakeInput(v);
                    }}
                    onBlur={(e) => commitStake(e.target.value)}
                    inputMode="decimal"
                    className="flex-1 bg-transparent outline-none text-xl font-bold font-mono"
                    style={{ color: c.text }}
                  />
                </div>
                <div className="grid grid-cols-6 gap-1.5 mt-2.5">
                  {quickAmounts.map((amt) => {
                    const active = stake === amt;
                    return (
                      <button
                        key={amt}
                        onClick={() => !autoRunning && commitStake(amt)}
                        disabled={autoRunning}
                        className="h-9 rounded-lg text-xs font-semibold font-mono transition"
                        style={{
                          background: active ? c.amberDim : c.elevated,
                          color: active ? c.amber : c.textDim,
                          border: `1px solid ${active ? c.amber : c.border}`,
                        }}
                      >
                        ${amt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3 settings inputs */}
              <div className="grid grid-cols-3 gap-2.5 mb-5">
                <div className="flex flex-col">
                  <label className="text-[11px] mb-1.5" style={{ color: c.textDim }}>
                    TARGET PROFIT
                  </label>
                  <div
                    className="flex items-center h-12 rounded-xl border px-2 justify-center"
                    style={{ background: c.bg, borderColor: c.border }}
                  >
                    <span className="text-xs font-mono mr-0.5" style={{ color: c.textFaint }}>$</span>
                    <input
                      value={targetProfit}
                      onChange={(e) => setTargetProfit(e.target.value.replace(/[^0-9.]/g, ""))}
                      inputMode="decimal"
                      className="w-full bg-transparent outline-none text-sm font-bold font-mono text-center"
                      style={{ color: c.text }}
                    />
                  </div>
                </div>
                <div className="flex flex-col">
                  <label className="text-[11px] mb-1.5" style={{ color: c.textDim }}>
                    STOP LOSS
                  </label>
                  <div
                    className="flex items-center h-12 rounded-xl border px-2 justify-center"
                    style={{ background: c.bg, borderColor: c.border }}
                  >
                    <span className="text-xs font-mono mr-0.5" style={{ color: c.textFaint }}>$</span>
                    <input
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value.replace(/[^0-9.]/g, ""))}
                      inputMode="decimal"
                      className="w-full bg-transparent outline-none text-sm font-bold font-mono text-center"
                      style={{ color: c.text }}
                    />
                  </div>
                </div>
                <div className="flex flex-col">
                  <label className="text-[11px] mb-1.5" style={{ color: c.textDim }}>
                    MULTIPLIER
                  </label>
                  <div
                    className="flex items-center h-12 rounded-xl border px-2 justify-center"
                    style={{ background: c.bg, borderColor: c.border }}
                  >
                    <span className="text-xs font-mono mr-0.5" style={{ color: c.textFaint }}>x</span>
                    <input
                      value={multiplier}
                      onChange={(e) => setMultiplier(e.target.value.replace(/[^0-9.]/g, ""))}
                      inputMode="decimal"
                      className="w-full bg-transparent outline-none text-sm font-bold font-mono text-center"
                      style={{ color: c.text }}
                    />
                  </div>
                </div>
              </div>

              {/* LIVE session banner while an AUTO run is active */}
              {autoRunning && (
                <div
                  className="flex items-center justify-between rounded-2xl px-4 py-3 mb-3"
                  style={{ background: c.elevated, border: `1px solid ${c.border}` }}
                >
                  <span className="flex items-center gap-2 text-xs font-bold" style={{ color: c.red }}>
                    <span
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{ background: c.red }}
                    />
                    LIVE
                    <span className="font-medium" style={{ color: c.textDim }}>
                      &nbsp;{sessionStats.trades}T · {sessionStats.wins}W · {sessionStats.losses}L
                    </span>
                  </span>
                  <span
                    className="text-sm font-bold font-mono"
                    style={{ color: sessionStats.net >= 0 ? c.green : c.red }}
                  >
                    {sessionStats.net >= 0 ? "+" : ""}${sessionStats.net.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Action buttons */}
              {autoRunning ? (
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className="flex flex-col items-center justify-center rounded-2xl py-5"
                    style={{
                      background:
                        runningSide === market.left.key
                          ? `linear-gradient(135deg, ${c.green}, #0EA96B)`
                          : `linear-gradient(135deg, ${c.red}, #D8283F)`,
                      opacity: 0.85,
                    }}
                  >
                    <span className="text-lg font-extrabold text-white">
                      {runningSide === market.left.key ? market.left.label : market.right.label}
                    </span>
                    <span className="text-sm font-bold font-mono text-white mt-1">${payout}</span>
                  </div>
                  <button
                    onClick={requestStopRun}
                    disabled={stopRequested}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-2xl py-5 transition"
                    style={{
                      background: c.amber,
                      opacity: stopRequested ? 0.6 : 1,
                      cursor: stopRequested ? "not-allowed" : "pointer",
                    }}
                  >
                    <Square size={18} fill="#181205" style={{ color: "#181205" }} />
                    <span className="text-sm font-extrabold" style={{ color: "#181205" }}>
                      {stopRequested ? "Stopping…" : "STOP"}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleTradeButtonClick(market.left.key)}
                    disabled={tradeInFlight}
                    className="flex flex-col items-center justify-center rounded-2xl py-5 transition"
                    style={{
                      background: `linear-gradient(135deg, ${c.green}, #0EA96B)`,
                      boxShadow:
                        flash === market.left.key ? `0 0 0 3px ${c.green}` : "0 10px 24px rgba(22,199,132,0.3)",
                      transform: flash === market.left.key ? "scale(0.97)" : "scale(1)",
                      opacity: tradeInFlight ? 0.6 : 1,
                      cursor: tradeInFlight ? "not-allowed" : "pointer",
                    }}
                  >
                    <span className="text-lg font-extrabold text-white">{market.left.label}</span>
                    <span className="text-xs font-semibold text-white/85 mt-1">{market.left.hint}</span>
                    <span className="text-sm font-bold font-mono text-white mt-1">${payout}</span>
                  </button>
                  <button
                    onClick={() => handleTradeButtonClick(market.right.key)}
                    disabled={tradeInFlight}
                    className="flex flex-col items-center justify-center rounded-2xl py-5 transition"
                    style={{
                      background: `linear-gradient(135deg, ${c.red}, #D8283F)`,
                      boxShadow:
                        flash === market.right.key ? `0 0 0 3px ${c.red}` : "0 10px 24px rgba(246,70,93,0.3)",
                      transform: flash === market.right.key ? "scale(0.97)" : "scale(1)",
                      opacity: tradeInFlight ? 0.6 : 1,
                      cursor: tradeInFlight ? "not-allowed" : "pointer",
                    }}
                  >
                    <span className="text-lg font-extrabold text-white">{market.right.label}</span>
                    <span className="text-xs font-semibold text-white/85 mt-1">{market.right.hint}</span>
                    <span className="text-sm font-bold font-mono text-white mt-1">${payout}</span>
                  </button>
                </div>
              )}
              {tradeInFlight && (
                <div
                  className="flex items-center justify-center gap-2 mt-3 text-xs font-medium"
                  style={{ color: c.textDim }}
                >
                  <Loader2 size={13} className="animate-spin" />
                  Waiting for the next tick…
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {view === "positions" && (
          <PositionsPanel trades={trades} posTab={posTab} setPosTab={setPosTab} />
        )}
      </main>

      {/* ================= BOTTOM NAV ================= */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around h-[70px] border-t lg:hidden"
        style={{ background: c.surface, borderColor: c.border }}
      >
        {[
          { icon: TrendingUp, label: "Trade", id: "trade" },
          { icon: Bot, label: "AI", id: "ai" },
          { icon: Briefcase, label: "Positions", id: "positions" },
        ].map(({ icon: Icon, label, id }) => {
          const active = view === id;
          return (
            <button
              key={label}
              onClick={() => id !== "ai" && setView(id)}
              className="flex flex-col items-center gap-1"
            >
              <Icon size={21} style={{ color: active ? c.amber : c.textDim }} />
              <span className="text-[11px] font-medium" style={{ color: active ? c.amber : c.textDim }}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ================= TRADE RESULT ALERT ================= */}
      {resultAlert && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-5">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => setResultAlert(null)}
          />
          <div
            className="relative w-full max-w-sm rounded-3xl border p-6 text-center"
            style={{ background: c.surface, borderColor: c.border, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{
                background:
                  resultAlert.type === "win"
                    ? c.greenDim
                    : resultAlert.type === "loss"
                    ? c.redDim
                    : c.amberDim,
              }}
            >
              {resultAlert.type === "win" && <PartyPopper size={26} style={{ color: c.green }} />}
              {resultAlert.type === "loss" && <XCircle size={26} style={{ color: c.red }} />}
              {resultAlert.type === "error" && <AlertTriangle size={26} style={{ color: c.amber }} />}
            </div>
            <h3 className="text-lg font-bold mb-2">{resultAlert.title}</h3>
            <p className="text-sm mb-6" style={{ color: c.textDim }}>
              {resultAlert.message}
            </p>
            <button
              onClick={() => setResultAlert(null)}
              className="w-full h-12 rounded-2xl text-sm font-bold"
              style={{ background: c.amber, color: "#181205" }}
            >
              {resultAlert.type === "error" ? "Got it" : "Continue trading"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}




// ---------------------------------------------------------------------------
// Decorative sparkline for the marketing panel — echoes the dashboard chart
// ---------------------------------------------------------------------------
function useSparkline(len = 48) {
  const [points, setPoints] = useState(() => {
    let v = 50;
    return Array.from({ length: len }, (_, i) => {
      v += (Math.random() - 0.46) * 4;
      return { i, v };
    });
  });
  useEffect(() => {
    const id = setInterval(() => {
      setPoints((prev) => {
        const last = prev[prev.length - 1].v;
        const next = last + (Math.random() - 0.46) * 4;
        return [...prev.slice(1), { i: prev[prev.length - 1].i + 1, v: next }];
      });
    }, 900);
    return () => clearInterval(id);
  }, []);
  return points;
}

function Field({ icon: Icon, error, children }) {
  return (
    <div>
      <div
        className="flex items-center gap-2.5 h-13 rounded-2xl border px-4"
        style={{
          height: 52,
          background: c.bg,
          borderColor: error ? c.red : c.borderStrong,
        }}
      >
        <Icon size={17} style={{ color: c.textFaint, flexShrink: 0 }} />
        {children}
      </div>
      {error && (
        <div className="mt-1.5 text-xs font-medium" style={{ color: c.red }}>
          {error}
        </div>
      )}
    </div>
  );
}

function AuthScreen({ onAuth, authError, clearAuthError }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [remember, setRemember] = useState(true);
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });

  const spark = useSparkline();
  const sparkUp = spark[spark.length - 1].v >= spark[0].v;

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function switchMode(next) {
    setMode(next);
    setErrors({});
    setShowPw(false);
    setShowPw2(false);
    clearAuthError?.();
  }

  function validate() {
    const e = {};
    if (mode === "signup" && !form.name.trim()) e.name = "Enter your full name";
    if (!form.email.trim()) e.email = "Enter your email";
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Enter a valid email";
    if (!form.password) e.password = "Enter your password";
    else if (mode === "signup" && form.password.length < 8)
      e.password = "Use at least 8 characters";
    if (mode === "signup" && form.confirm !== form.password)
      e.confirm = "Passwords don't match";
    if (mode === "signup" && !agree) e.agree = "Accept the terms to continue";
    return e;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSubmitting(true);
    await onAuth?.({ mode, name: form.name, email: form.email, password: form.password, remember });
    setSubmitting(false);
  }

  const inputStyle = {
    color: c.text,
    background: "transparent",
  };

  return (
    <div
      className="min-h-screen w-full font-sans flex"
      style={{ background: c.bg, color: c.text }}
    >
      {/* ================= LEFT / MARKETING PANEL (desktop only) ================= */}
      <div
        className="hidden lg:flex lg:w-[46%] relative flex-col justify-between p-12 overflow-hidden"
        style={{
          background:
            "radial-gradient(120% 140% at 0% 0%, #171B26 0%, #0B0E14 60%)",
          borderRight: `1px solid ${c.border}`,
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-xl font-bold text-base"
            style={{ background: c.amber, color: "#181205" }}
          >
            P
          </div>
          <span className="text-sm font-semibold tracking-widest" style={{ color: c.textDim }}>
            PRIMEVEST
          </span>
        </div>

        <div>
          <div className="mb-8">
            <div
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-semibold mb-6"
              style={{ background: c.amberDim, color: c.amber }}
            >
              <TrendingUp size={12} />
              Live markets, 24/7
            </div>
            <h1 className="text-4xl font-bold leading-[1.15] mb-4 max-w-md">
              Your edge starts the moment you log in.
            </h1>
            <p className="text-sm leading-relaxed max-w-sm" style={{ color: c.textDim }}>
              Track positions, execute trades, and watch the tape update in
              real time — all from one account.
            </p>
          </div>

          {/* signature sparkline strip */}
          <div
            className="rounded-3xl border p-5"
            style={{ background: c.surface, borderColor: c.border }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold tracking-wide" style={{ color: c.textDim }}>
                VOL/100 INDEX
              </span>
              <span
                className="text-xs font-mono font-bold"
                style={{ color: sparkUp ? c.green : c.red }}
              >
                {sparkUp ? "▲" : "▼"} {Math.abs(spark[spark.length - 1].v - spark[0].v).toFixed(2)}%
              </span>
            </div>
            <div style={{ height: 64 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={spark}>
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke={sparkUp ? c.green : c.red}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="text-xs" style={{ color: c.textFaint }}>
          © {new Date().getFullYear()} PrimeVest. Trading involves risk.
        </div>
      </div>

      {/* ================= RIGHT / FORM PANEL ================= */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[400px]">
          {/* mobile logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-8 justify-center">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-xl font-bold text-base"
              style={{ background: c.amber, color: "#181205" }}
            >
              P
            </div>
            <span className="text-sm font-semibold tracking-widest" style={{ color: c.textDim }}>
              PRIMEVEST
            </span>
          </div>

          {/* mode switch */}
          <div
            className="flex p-1 rounded-2xl mb-7"
            style={{ background: c.surfaceAlt, border: `1px solid ${c.border}` }}
          >
            {[
              { id: "login", label: "Log In" },
              { id: "signup", label: "Create Account" },
            ].map((tab) => {
              const active = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => switchMode(tab.id)}
                  className="flex-1 h-11 rounded-xl text-sm font-bold transition"
                  style={{
                    background: active ? c.amber : "transparent",
                    color: active ? "#181205" : c.textDim,
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-1.5">
              {mode === "login" ? "Welcome back" : "Set up your account"}
            </h2>
            <p className="text-sm" style={{ color: c.textDim }}>
              {mode === "login"
                ? "Log in to pick up right where you left off."
                : "Takes under a minute. No card required."}
            </p>
          </div>

          {authError && (
            <div
              className="mb-4 rounded-xl px-4 py-3 text-sm font-medium"
              style={{ background: c.redDim, color: c.red }}
            >
              {authError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            {mode === "signup" && (
              <Field icon={User} error={errors.name}>
                <input
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Full name"
                  autoComplete="name"
                  className="flex-1 outline-none text-sm"
                  style={inputStyle}
                />
              </Field>
            )}

            <Field icon={Mail} error={errors.email}>
              <input
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="Email address"
                type="email"
                autoComplete="email"
                className="flex-1 outline-none text-sm"
                style={inputStyle}
              />
            </Field>

            <Field icon={Lock} error={errors.password}>
              <input
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="Password"
                type={showPw ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="flex-1 outline-none text-sm"
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? (
                  <EyeOff size={17} style={{ color: c.textFaint }} />
                ) : (
                  <Eye size={17} style={{ color: c.textFaint }} />
                )}
              </button>
            </Field>

            {mode === "signup" && (
              <Field icon={Lock} error={errors.confirm}>
                <input
                  value={form.confirm}
                  onChange={(e) => update("confirm", e.target.value)}
                  placeholder="Confirm password"
                  type={showPw2 ? "text" : "password"}
                  autoComplete="new-password"
                  className="flex-1 outline-none text-sm"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => setShowPw2((v) => !v)}
                  aria-label={showPw2 ? "Hide password" : "Show password"}
                >
                  {showPw2 ? (
                    <EyeOff size={17} style={{ color: c.textFaint }} />
                  ) : (
                    <Eye size={17} style={{ color: c.textFaint }} />
                  )}
                </button>
              </Field>
            )}

            {mode === "login" ? (
              <div className="flex items-center justify-between -mt-1">
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: c.textDim }}>
                  <button
                    type="button"
                    onClick={() => setRemember((v) => !v)}
                    className="w-4 h-4 rounded flex items-center justify-center"
                    style={{
                      background: remember ? c.amber : "transparent",
                      border: `1px solid ${remember ? c.amber : c.borderStrong}`,
                    }}
                  >
                    {remember && <Check size={11} style={{ color: "#181205" }} strokeWidth={3} />}
                  </button>
                  Remember me
                </label>
                <button
                  type="button"
                  className="text-xs font-semibold"
                  style={{ color: c.amber }}
                >
                  Forgot password?
                </button>
              </div>
            ) : (
              <div>
                <label className="flex items-start gap-2.5 text-xs cursor-pointer" style={{ color: c.textDim }}>
                  <button
                    type="button"
                    onClick={() => {
                      setAgree((v) => !v);
                      setErrors((e) => ({ ...e, agree: undefined }));
                    }}
                    className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      background: agree ? c.amber : "transparent",
                      border: `1px solid ${agree ? c.amber : (errors.agree ? c.red : c.borderStrong)}`,
                    }}
                  >
                    {agree && <Check size={11} style={{ color: "#181205" }} strokeWidth={3} />}
                  </button>
                  <span>
                    I agree to the{" "}
                    <span className="font-semibold" style={{ color: c.text }}>Terms of Service</span>{" "}
                    and{" "}
                    <span className="font-semibold" style={{ color: c.text }}>Privacy Policy</span>.
                  </span>
                </label>
                {errors.agree && (
                  <div className="mt-1.5 text-xs font-medium" style={{ color: c.red }}>
                    {errors.agree}
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="h-13 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 mt-1 transition"
              style={{
                height: 52,
                background: c.amber,
                color: "#181205",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? (
                "Please wait…"
              ) : (
                <>
                  {mode === "login" ? "Log In" : "Create Account"}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm" style={{ color: c.textDim }}>
            {mode === "login" ? (
              <>
                Don't have an account?{" "}
                <button
                  onClick={() => switchMode("signup")}
                  className="font-semibold"
                  style={{ color: c.amber }}
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => switchMode("login")}
                  className="font-semibold"
                  style={{ color: c.amber }}
                >
                  Log in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Shared "money" screen chrome — back header used by Deposit & Withdraw
// ---------------------------------------------------------------------------
function MoneyHeader({ title, onBack, onRefresh, refreshing }) {
  return (
    <div
      className="sticky top-0 z-10 flex items-center gap-3 h-16 px-4 sm:px-6 border-b"
      style={{ background: c.bg, borderColor: c.border }}
    >
      <button
        onClick={onBack}
        className="flex items-center justify-center w-9 h-9 rounded-xl border flex-shrink-0"
        style={{ background: c.surfaceAlt, borderColor: c.border }}
        aria-label="Back"
      >
        <ArrowLeft size={17} style={{ color: c.text }} />
      </button>
      <span className="text-base font-bold flex-1">{title}</span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center justify-center w-9 h-9 rounded-xl border flex-shrink-0"
          style={{ background: c.surfaceAlt, borderColor: c.border, opacity: refreshing ? 0.6 : 1 }}
          aria-label="Refresh"
        >
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} style={{ color: c.text }} />
        </button>
      )}
    </div>
  );
}

const KES_QUICK_AMOUNTS = [500, 1000, 2500, 5000, 10000];
const USD_QUICK_AMOUNTS = [5, 10, 25, 50, 100, 200];

// Fixed approximate rate — not a live feed. For accurate pricing this
// should come from a live FX rate source or your own configured rate.
const USD_KES_RATE = 129;
function kesToUsd(kes) {
  return Number((kes / USD_KES_RATE).toFixed(2));
}
function usdToKes(usd) {
  return Math.round(usd * USD_KES_RATE);
}

function AmountChips({ value, onPick, tiers, formatLabel }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tiers.map((amt) => (
        <button
          key={amt}
          type="button"
          onClick={() => onPick(amt)}
          className="h-9 px-3.5 rounded-xl text-xs font-bold"
          style={{
            background: String(value) === String(amt) ? c.amber : c.surfaceAlt,
            color: String(value) === String(amt) ? "#181205" : c.textDim,
            border: `1px solid ${String(value) === String(amt) ? c.amber : c.border}`,
          }}
        >
          {formatLabel(amt)}
        </button>
      ))}
    </div>
  );
}

// Converts any of 07XXXXXXXX / 01XXXXXXXX / +254XXXXXXXXX / 254XXXXXXXXX
// into the exact "254XXXXXXXXX" format Daraja requires — no plus sign,
// no spaces, no leading zero.
function toMsisdn254(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  let n = digits;
  if (n.startsWith("0")) n = "254" + n.slice(1);
  else if (n.startsWith("7") || n.startsWith("1")) n = "254" + n;
  return n.slice(0, 12);
}

function isValidKenyanNumber(raw) {
  return /^254(7|1)\d{8}$/.test(toMsisdn254(raw));
}

// ---------------------------------------------------------------------------
// DEPOSIT — M-Pesa STK Push
// ---------------------------------------------------------------------------
function DepositScreen({ onBack, onComplete, onBalanceSet, onAddPayment }) {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState({});
  const [stage, setStage] = useState("form"); // form | pushed | waiting | success | failed
  const [apiError, setApiError] = useState("");
  const [creditedUsd, setCreditedUsd] = useState(0);

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!isValidKenyanNumber(phone)) errs.phone = "Enter a valid Safaricom number";
    const amt = Number(amount);
    if (!amt || amt < 10) errs.amount = "Minimum deposit is KES 10";
    setError(errs);
    if (Object.keys(errs).length) return;

    const msisdn = toMsisdn254(phone);
    setPhone(msisdn);

    setApiError("");
    setStage("pushed");
    try {
      const { checkoutRequestId } = await backendApi("/api/payments/deposit", {
        method: "POST",
        body: JSON.stringify({ phone: msisdn, amountKes: amt }),
      });
      setStage("waiting");
      const result = await pollStatus(`/api/payments/deposit/status/${checkoutRequestId}`);
      if (result.status === "success") {
        setCreditedUsd(result.usdAmount);
        // The callback already credited the balance server-side — pull the
        // authoritative figure rather than guessing at it locally.
        const { user } = await backendApi("/api/auth/me");
        onBalanceSet?.(user.realBalance);
        onAddPayment?.({
          id: checkoutRequestId,
          type: "deposit",
          amount: amt,
          usdAmount: result.usdAmount,
          phone: msisdn,
          status: "success",
          time: Date.now(),
        });
        setStage("success");
      } else {
        setApiError(result.resultDesc || "The deposit was not completed");
        setStage("failed");
      }
    } catch (err) {
      setApiError(err.message || "Something went wrong");
      setStage("failed");
    }
  }

  const usdEquivalent = creditedUsd || (amount ? kesToUsd(Number(amount)) : 0);

  if (stage === "failed") {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: c.bg, color: c.text }}>
        <MoneyHeader title="Deposit" onBack={onBack} />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
            style={{ background: c.redDim }}
          >
            <X size={26} style={{ color: c.red }} />
          </div>
          <h2 className="text-lg font-bold mb-2">Deposit didn't go through</h2>
          <p className="text-sm max-w-xs mb-8" style={{ color: c.textDim }}>{apiError}</p>
          <button
            onClick={() => setStage("form")}
            className="h-12 px-6 rounded-2xl text-sm font-bold"
            style={{ background: c.amber, color: "#181205" }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (stage === "pushed" || stage === "waiting") {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: c.bg, color: c.text }}>
        <MoneyHeader title="Deposit" onBack={onBack} />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
            style={{ background: c.amberDim }}
          >
            <Loader2 size={28} style={{ color: c.amber }} className="animate-spin" />
          </div>
          <h2 className="text-lg font-bold mb-2">
            {stage === "pushed" ? "Sending STK push…" : "Check your phone"}
          </h2>
          <p className="text-sm max-w-xs" style={{ color: c.textDim }}>
            {stage === "pushed" ? (
              <>Sending a prompt to <span style={{ color: c.text }}>{phone}</span>…</>
            ) : (
              <>
                Enter your M-Pesa PIN on the prompt sent to{" "}
                <span className="font-semibold" style={{ color: c.text }}>
                  {phone}
                </span>{" "}
                to complete depositing{" "}
                <span className="font-semibold" style={{ color: c.text }}>
                  KES {Number(amount).toLocaleString()}
                </span>
                .
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  if (stage === "success") {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: c.bg, color: c.text }}>
        <MoneyHeader title="Deposit" onBack={onBack} />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
            style={{ background: "rgba(22,199,132,0.14)" }}
          >
            <CheckCircle2 size={30} style={{ color: c.green }} />
          </div>
          <h2 className="text-lg font-bold mb-2">Deposit successful</h2>
          <p className="text-sm max-w-xs mb-8" style={{ color: c.textDim }}>
            KES {Number(amount).toLocaleString()} from {phone} converted to{" "}
            <span className="font-semibold" style={{ color: c.text }}>
              ${usdEquivalent.toFixed(2)}
            </span>{" "}
            and added to your Real account balance.
          </p>
          <button
            onClick={onComplete}
            className="h-12 px-6 rounded-2xl text-sm font-bold"
            style={{ background: c.amber, color: "#181205" }}
          >
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: c.bg, color: c.text }}>
      <MoneyHeader title="Deposit" onBack={onBack} />
      <div className="flex-1 flex justify-center px-4 sm:px-6 py-8">
        <form onSubmit={submit} className="w-full max-w-[420px] flex flex-col gap-5">
          <div
            className="flex items-center gap-3 rounded-2xl border p-4"
            style={{ background: c.surface, borderColor: c.border }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(22,199,132,0.14)" }}
            >
              <Smartphone size={20} style={{ color: c.green }} />
            </div>
            <div>
              <div className="text-sm font-bold">M-Pesa STK Push</div>
              <div className="text-xs" style={{ color: c.textDim }}>
                Converts to USD and adds to your Real account
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: c.textDim }}>
              M-Pesa phone number
            </label>
            <Field icon={Smartphone} error={error.phone}>
              <input
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setError((er) => ({ ...er, phone: undefined }));
                }}
                onBlur={() => setPhone((p) => (p ? toMsisdn254(p) : p))}
                placeholder="07XX XXX XXX"
                inputMode="tel"
                className="flex-1 outline-none text-sm bg-transparent"
                style={{ color: c.text }}
              />
            </Field>
          </div>

          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: c.textDim }}>
              Amount (KES)
            </label>
            <div
              className="flex items-center gap-2 h-13 rounded-2xl border px-4 mb-1.5"
              style={{ height: 52, background: c.bg, borderColor: error.amount ? c.red : c.borderStrong }}
            >
              <span className="text-sm font-bold" style={{ color: c.textDim }}>KES</span>
              <input
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value.replace(/[^\d]/g, ""));
                  setError((er) => ({ ...er, amount: undefined }));
                }}
                placeholder="0"
                inputMode="numeric"
                className="flex-1 outline-none text-sm bg-transparent font-semibold"
                style={{ color: c.text }}
              />
            </div>
            {amount && !error.amount && (
              <div className="text-xs font-mono mb-3" style={{ color: c.textFaint }}>
                ≈ ${usdEquivalent.toFixed(2)} added to your Real account
              </div>
            )}
            {error.amount && (
              <div className="text-xs font-medium mb-3" style={{ color: c.red }}>{error.amount}</div>
            )}
            <AmountChips
              value={amount}
              onPick={(a) => setAmount(String(a))}
              tiers={KES_QUICK_AMOUNTS}
              formatLabel={(a) => `KES ${a.toLocaleString()}`}
            />
          </div>

          <button
            type="submit"
            className="h-13 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 mt-1"
            style={{ height: 52, background: c.amber, color: "#181205" }}
          >
            Send STK Push
            <ArrowRight size={16} />
          </button>

          <div className="flex items-center gap-2 justify-center text-xs" style={{ color: c.textFaint }}>
            <ShieldCheck size={13} />
            Secured by M-Pesa · Funds reflect instantly
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WITHDRAW — to M-Pesa
// ---------------------------------------------------------------------------
function WithdrawScreen({ onBack, onComplete, balance, onBalanceSet, onAddPayment }) {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState({});
  const [stage, setStage] = useState("form"); // form | processing | success | failed
  const [reference, setReference] = useState("");
  const [apiError, setApiError] = useState("");
  const [kesAmount, setKesAmount] = useState(0);

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!isValidKenyanNumber(phone)) errs.phone = "Enter a valid Safaricom number";
    const amt = Number(amount);
    if (!amt || amt < 1) errs.amount = "Minimum withdrawal is $1";
    else if (balance <= 0) errs.amount = "Insufficient balance";
    else if (amt > balance) errs.amount = "Insufficient balance for this amount";
    setError(errs);
    if (Object.keys(errs).length) return;

    const msisdn = toMsisdn254(phone);
    setPhone(msisdn);

    setStage("processing");
    try {
      const data = await backendApi("/api/payments/withdraw", {
        method: "POST",
        body: JSON.stringify({ phone: msisdn, amountUsd: amt }),
      });
      setReference(data.reference);
      setKesAmount(data.amountKes);
      onBalanceSet?.(data.balance);
      onAddPayment?.({
        id: data.reference,
        type: "withdrawal",
        amount: data.amountKes,
        usdAmount: amt,
        phone: msisdn,
        status: "pending",
        time: Date.now(),
      });
      setStage("success");
    } catch (err) {
      setApiError(err.message || "Something went wrong");
      setStage("failed");
    }
  }

  const kesEquivalent = kesAmount || (amount ? usdToKes(Number(amount)) : 0);

  if (stage === "failed") {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: c.bg, color: c.text }}>
        <MoneyHeader title="Withdraw" onBack={onBack} />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
            style={{ background: c.redDim }}
          >
            <X size={26} style={{ color: c.red }} />
          </div>
          <h2 className="text-lg font-bold mb-2">Withdrawal request failed</h2>
          <p className="text-sm max-w-xs mb-8" style={{ color: c.textDim }}>{apiError}</p>
          <button
            onClick={() => setStage("form")}
            className="h-12 px-6 rounded-2xl text-sm font-bold"
            style={{ background: c.amber, color: "#181205" }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (stage === "processing") {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: c.bg, color: c.text }}>
        <MoneyHeader title="Withdraw" onBack={onBack} />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
            style={{ background: c.amberDim }}
          >
            <Loader2 size={28} style={{ color: c.amber }} className="animate-spin" />
          </div>
          <h2 className="text-lg font-bold mb-2">Submitting your request…</h2>
          <p className="text-sm max-w-xs" style={{ color: c.textDim }}>
            ${Number(amount).toFixed(2)} (KES {kesEquivalent.toLocaleString()}) to{" "}
            <span style={{ color: c.text }}>{phone}</span>
          </p>
        </div>
      </div>
    );
  }

  if (stage === "success") {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: c.bg, color: c.text }}>
        <MoneyHeader title="Withdraw" onBack={onBack} />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
            style={{ background: "rgba(22,199,132,0.14)" }}
          >
            <CheckCircle2 size={30} style={{ color: c.green }} />
          </div>
          <h2 className="text-lg font-bold mb-2">Withdrawal submitted successfully</h2>
          <p className="text-sm max-w-xs mb-2" style={{ color: c.textDim }}>
            Your request to withdraw ${Number(amount).toFixed(2)} (converted to{" "}
            <span className="font-semibold" style={{ color: c.text }}>
              KES {kesEquivalent.toLocaleString()}
            </span>
            ) to {phone} has been received. Our team will process this manually and disburse the funds
            shortly.
          </p>
          <p className="text-xs font-mono mb-8" style={{ color: c.textFaint }}>
            Reference: {reference}
          </p>
          <button
            onClick={onComplete}
            className="h-12 px-6 rounded-2xl text-sm font-bold"
            style={{ background: c.amber, color: "#181205" }}
          >
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: c.bg, color: c.text }}>
      <MoneyHeader title="Withdraw" onBack={onBack} />
      <div className="flex-1 flex justify-center px-4 sm:px-6 py-8">
        <form onSubmit={submit} className="w-full max-w-[420px] flex flex-col gap-5">
          <div
            className="rounded-2xl border p-4"
            style={{ background: c.surface, borderColor: c.border }}
          >
            <div className="text-xs font-semibold mb-1" style={{ color: c.textDim }}>
              Real account balance
            </div>
            <div className="text-2xl font-bold font-mono">
              ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: c.textDim }}>
              M-Pesa phone number
            </label>
            <Field icon={Smartphone} error={error.phone}>
              <input
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setError((er) => ({ ...er, phone: undefined }));
                }}
                onBlur={() => setPhone((p) => (p ? toMsisdn254(p) : p))}
                placeholder="07XX XXX XXX"
                inputMode="tel"
                className="flex-1 outline-none text-sm bg-transparent"
                style={{ color: c.text }}
              />
            </Field>
          </div>

          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: c.textDim }}>
              Amount (USD)
            </label>
            <div
              className="flex items-center gap-2 h-13 rounded-2xl border px-4 mb-1.5"
              style={{ height: 52, background: c.bg, borderColor: error.amount ? c.red : c.borderStrong }}
            >
              <span className="text-sm font-bold" style={{ color: c.textDim }}>$</span>
              <input
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value.replace(/[^0-9.]/g, ""));
                  setError((er) => ({ ...er, amount: undefined }));
                }}
                placeholder="0"
                inputMode="decimal"
                className="flex-1 outline-none text-sm bg-transparent font-semibold"
                style={{ color: c.text }}
              />
              <button
                type="button"
                onClick={() => setAmount(String(balance.toFixed(2)))}
                className="text-xs font-bold flex-shrink-0"
                style={{ color: c.amber }}
              >
                MAX
              </button>
            </div>
            {amount && !error.amount && (
              <div className="text-xs font-mono mb-3" style={{ color: c.textFaint }}>
                ≈ KES {kesEquivalent.toLocaleString()} disbursed via M-Pesa
              </div>
            )}
            {error.amount && (
              <div className="text-xs font-medium mb-3" style={{ color: c.red }}>{error.amount}</div>
            )}
            <AmountChips
              value={amount}
              onPick={(a) => setAmount(String(a))}
              tiers={USD_QUICK_AMOUNTS}
              formatLabel={(a) => `$${a}`}
            />
          </div>

          <button
            type="submit"
            className="h-13 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 mt-1"
            style={{ height: 52, background: c.amber, color: "#181205" }}
          >
            Submit withdrawal request
            <ArrowRight size={16} />
          </button>

          <div className="flex items-center gap-2 justify-center text-xs" style={{ color: c.textFaint }}>
            <ShieldCheck size={13} />
            Withdrawals are reviewed and sent manually
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TRADE HISTORY
// ---------------------------------------------------------------------------
function relativeTime(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function PaymentRow({ p }) {
  const isDeposit = p.type === "deposit";
  const pending = p.status === "pending";
  const rejected = p.status === "rejected";
  const failed = p.status === "failed";
  const completed = p.status === "completed" || p.status === "success";

  const statusLabel = pending ? "Pending" : rejected ? "Rejected" : failed ? "Failed" : completed ? "Completed" : "";
  const statusColor = pending ? c.amber : rejected || failed ? c.red : c.green;

  return (
    <div
      className="flex items-center gap-3 rounded-2xl border p-3.5"
      style={{ background: c.surface, borderColor: c.border }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: pending ? c.amberDim : rejected || failed ? c.redDim : isDeposit ? c.greenDim : c.redDim }}
      >
        {isDeposit ? (
          <ArrowDownRight size={18} style={{ color: c.green }} />
        ) : (
          <ArrowUpRight size={18} style={{ color: pending ? c.amber : c.red }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold truncate">
            {isDeposit ? "M-Pesa deposit" : "Withdrawal to M-Pesa"}
          </span>
          <span
            className="text-sm font-bold font-mono flex-shrink-0"
            style={{ color: isDeposit ? c.green : c.amber }}
          >
            {isDeposit ? "+" : "-"}KES {p.amount.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-xs flex items-center gap-1.5" style={{ color: c.textDim }}>
            {p.phone}
            {statusLabel && (
              <span className="font-semibold" style={{ color: statusColor }}>
                · {statusLabel}
              </span>
            )}
          </span>
          <span className="text-xs flex-shrink-0 font-mono" style={{ color: c.textFaint }}>
            {p.usdAmount != null ? `≈ $${p.usdAmount.toFixed(2)} · ` : ""}
            {relativeTime(p.time)}
          </span>
        </div>
      </div>
    </div>
  );
}

function HistoryScreen({ trades, payments, onBack, onRefresh }) {
  const [tab, setTab] = useState("trades"); // trades | deposits | withdrawals
  const [filter, setFilter] = useState("all"); // all | won | lost
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setRefreshing(false);
    }
  }

  const filtered = trades.filter((t) => {
    if (filter === "won") return t.won;
    if (filter === "lost") return !t.won;
    return true;
  });

  const stats = trades.reduce(
    (acc, t) => {
      acc.staked += t.stake;
      acc.net += t.won ? t.payout - t.stake : -t.stake;
      if (t.won) acc.wins += 1;
      return acc;
    },
    { staked: 0, net: 0, wins: 0 }
  );

  const deposits = payments.filter((p) => p.type === "deposit");
  const withdrawals = payments.filter((p) => p.type === "withdrawal");

  return (
    <div className="min-h-screen flex flex-col" style={{ background: c.bg, color: c.text }}>
      <MoneyHeader title="History" onBack={onBack} onRefresh={handleRefresh} refreshing={refreshing} />

      <div className="flex-1 px-4 sm:px-6 py-5 max-w-2xl w-full mx-auto">
        <div className="flex gap-2 mb-5">
          {[
            { id: "trades", label: "Trades" },
            { id: "deposits", label: "Deposits" },
            { id: "withdrawals", label: "Withdrawals" },
          ].map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-1 h-10 rounded-xl text-xs sm:text-sm font-bold transition"
                style={{
                  background: active ? c.amber : c.surfaceAlt,
                  color: active ? "#181205" : c.textDim,
                  border: `1px solid ${active ? c.amber : c.border}`,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "trades" && (
          <>
            {trades.length > 0 && (
              <div className="grid grid-cols-3 gap-2.5 mb-5">
                <div className="rounded-2xl border p-3.5" style={{ background: c.surface, borderColor: c.border }}>
                  <div className="text-[11px] font-semibold mb-1" style={{ color: c.textDim }}>
                    TRADES
                  </div>
                  <div className="text-lg font-bold font-mono">{trades.length}</div>
                </div>
                <div className="rounded-2xl border p-3.5" style={{ background: c.surface, borderColor: c.border }}>
                  <div className="text-[11px] font-semibold mb-1" style={{ color: c.textDim }}>
                    WIN RATE
                  </div>
                  <div className="text-lg font-bold font-mono">
                    {Math.round((stats.wins / trades.length) * 100)}%
                  </div>
                </div>
                <div className="rounded-2xl border p-3.5" style={{ background: c.surface, borderColor: c.border }}>
                  <div className="text-[11px] font-semibold mb-1" style={{ color: c.textDim }}>
                    NET P/L
                  </div>
                  <div
                    className="text-lg font-bold font-mono"
                    style={{ color: stats.net >= 0 ? c.green : c.red }}
                  >
                    {stats.net >= 0 ? "+" : ""}
                    ${stats.net.toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            {trades.length > 0 && (
              <div className="flex gap-2 mb-4">
                {[
                  { id: "all", label: "All" },
                  { id: "won", label: "Won" },
                  { id: "lost", label: "Lost" },
                ].map((f) => {
                  const active = filter === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setFilter(f.id)}
                      className="h-9 px-4 rounded-xl text-xs font-bold transition"
                      style={{
                        background: active ? c.amber : c.surfaceAlt,
                        color: active ? "#181205" : c.textDim,
                        border: `1px solid ${active ? c.amber : c.border}`,
                      }}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            )}

            {trades.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-20">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
                  style={{ background: c.surfaceAlt }}
                >
                  <History size={26} style={{ color: c.textFaint }} />
                </div>
                <h3 className="text-base font-bold mb-1.5">No trades yet</h3>
                <p className="text-sm max-w-xs" style={{ color: c.textDim }}>
                  Trades you place from the dashboard will show up here.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {filtered.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-2xl border p-3.5"
                    style={{ background: c.surface, borderColor: c.border }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: t.won ? c.greenDim : c.redDim }}
                    >
                      {t.won ? (
                        <ArrowUpRight size={18} style={{ color: c.green }} />
                      ) : (
                        <ArrowDownRight size={18} style={{ color: c.red }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold truncate">
                          {t.marketLabel} · {t.sideLabel}
                        </span>
                        <span
                          className="text-sm font-bold font-mono flex-shrink-0"
                          style={{ color: t.won ? c.green : c.red }}
                        >
                          {t.won ? "+" : "-"}${t.won ? (t.payout - t.stake).toFixed(2) : t.stake.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: c.textDim }}>
                          Stake ${t.stake.toFixed(2)} · Digit {t.resultDigit}
                        </span>
                        <span className="text-xs flex-shrink-0" style={{ color: c.textFaint }}>
                          {relativeTime(t.closeTime)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "deposits" &&
          (deposits.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
                style={{ background: c.surfaceAlt }}
              >
                <Wallet size={24} style={{ color: c.textFaint }} />
              </div>
              <h3 className="text-base font-bold mb-1.5">No deposits yet</h3>
              <p className="text-sm max-w-xs" style={{ color: c.textDim }}>
                Successful M-Pesa deposits will show up here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {deposits.map((p) => (
                <PaymentRow key={p.id} p={p} />
              ))}
            </div>
          ))}

        {tab === "withdrawals" &&
          (withdrawals.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
                style={{ background: c.surfaceAlt }}
              >
                <ArrowLeftRight size={24} style={{ color: c.textFaint }} />
              </div>
              <h3 className="text-base font-bold mb-1.5">No withdrawals yet</h3>
              <p className="text-sm max-w-xs" style={{ color: c.textDim }}>
                Submitted withdrawal requests will show up here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {withdrawals.map((p) => (
                <PaymentRow key={p.id} p={p} />
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ABOUT / RESPONSIBLE TRADING
// ---------------------------------------------------------------------------
function AboutScreen({ onBack }) {
  const guidelines = [
    {
      icon: DollarSign,
      color: c.green,
      bg: c.greenDim,
      title: "Set a Budget",
      body: "Only trade with money you can afford to lose. Never use funds needed for essential expenses.",
    },
    {
      icon: Clock,
      color: "#5B8DEF",
      bg: "rgba(91,141,239,0.14)",
      title: "Take Breaks",
      body: "Set time limits for your trading sessions. Regular breaks help maintain focus and clear thinking.",
    },
    {
      icon: AlertTriangle,
      color: c.amber,
      bg: c.amberDim,
      title: "Know the Risks",
      body: "Trading involves real risk of loss. Past performance never guarantees future results.",
    },
    {
      icon: Heart,
      color: c.red,
      bg: c.redDim,
      title: "Emotional Control",
      body: "Don't trade when upset, tired, or under the influence. Emotional trading leads to poor decisions.",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: c.bg, color: c.text }}>
      <MoneyHeader title="About PrimeVest" onBack={onBack} />

      <div className="flex-1 px-4 sm:px-6 py-5 max-w-2xl w-full mx-auto flex flex-col gap-4">
        {/* Company blurb */}
        <div className="rounded-3xl border p-6" style={{ background: c.surface, borderColor: c.border }}>
          <div className="flex items-center gap-2.5 mb-4">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold"
              style={{ background: c.amber, color: "#181205" }}
            >
              P
            </div>
            <span className="text-base font-bold">Our story</span>
          </div>
          <p className="text-sm leading-relaxed mb-3" style={{ color: c.textDim }}>
            PrimeVest was built to make trading synthetic volatility indices simple and
            accessible, with deposits and withdrawals that work the way our users already
            move money day to day — straight from M-Pesa, without extra steps.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: c.textDim }}>
            We're a small, product-led team focused on a fast, uncluttered trading
            experience: clear pricing, instant deposits, and a support team that actually
            responds. We're still early — if something feels off, we want to hear about
            it through Live Chat or Help Centre.
          </p>
        </div>

        {/* Responsible trading hero */}
        <div
          className="rounded-3xl border p-6 flex flex-col items-center text-center"
          style={{ background: c.surface, borderColor: c.border }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ background: "rgba(45,212,191,0.16)" }}
          >
            <Heart size={26} style={{ color: "#2DD4BF" }} />
          </div>
          <h2 className="text-xl font-bold mb-2">Trade Responsibly</h2>
          <p className="text-sm max-w-sm" style={{ color: c.textDim }}>
            At PrimeVest, we care about your well-being. Trading should be enjoyable and
            within your means. Here are some guidelines to help you trade responsibly.
          </p>
        </div>

        {guidelines.map((g) => (
          <div
            key={g.title}
            className="rounded-3xl border p-5"
            style={{ background: c.surface, borderColor: c.border }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
              style={{ background: g.bg }}
            >
              <g.icon size={20} style={{ color: g.color }} />
            </div>
            <h3 className="text-base font-bold mb-1.5">{g.title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: c.textDim }}>{g.body}</p>
          </div>
        ))}

        <p className="text-xs text-center px-4 py-2" style={{ color: c.textFaint }}>
          If trading is affecting your finances, relationships, or wellbeing, please reach
          out to a local support service or talk to someone you trust.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// LIVE CHAT (simulated)
// ---------------------------------------------------------------------------
function botReplyFor(text) {
  const t = text.toLowerCase();
  if (/\b(hi|hello|hey)\b/.test(t)) return "Hey there! How can I help you today?";
  if (t.includes("deposit"))
    return "Deposits go through M-Pesa STK Push — enter your amount, confirm the prompt on your phone, and it reflects in your Real account right away.";
  if (t.includes("withdraw"))
    return "Withdrawal requests are reviewed and sent manually by our team. You'll see the status update from Pending to Completed in your History once it's processed.";
  if (t.includes("balance"))
    return "You can check your balance at the top of the Trade screen — tap it to switch between your Demo and Real accounts.";
  if (t.includes("password") || t.includes("2fa") || t.includes("verify"))
    return "You can manage your password, 2FA, and identity verification under Account Settings in the menu.";
  if (t.includes("refer") || t.includes("earn"))
    return "Refer & Earn is in the menu — share your link and earn a percentage from your referrals' activity.";
  return "Thanks for reaching out! One of our agents will get back to you shortly.";
}

function LiveChatScreen({ onBack }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [botTyping, setBotTyping] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, botTyping]);

  function send() {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { id: Date.now(), from: "user", text }]);
    setInput("");
    setBotTyping(true);
    window.setTimeout(() => {
      setBotTyping(false);
      setMessages((m) => [...m, { id: Date.now() + 1, from: "agent", text: botReplyFor(text) }]);
    }, 1100 + Math.random() * 700);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: c.bg, color: c.text }}>
      <div
        className="flex items-center gap-3 px-4 sm:px-6 py-4"
        style={{ background: "linear-gradient(135deg, #2563EB, #3B82F6)" }}
      >
        <button onClick={onBack} className="flex-shrink-0" aria-label="Back">
          <ArrowLeft size={20} style={{ color: "#fff" }} />
        </button>
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.18)" }}
        >
          <MessageCircle size={20} style={{ color: "#fff" }} />
        </div>
        <div>
          <div className="text-base font-bold text-white">Live Support</div>
          <div className="flex items-center gap-1.5 text-xs text-white/85">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#4ADE80" }} />
            Online · Typically replies instantly
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
              style={{ background: "rgba(59,130,246,0.16)" }}
            >
              <MessageCircle size={26} style={{ color: "#3B82F6" }} />
            </div>
            <h3 className="text-base font-bold mb-1.5">Welcome to Support!</h3>
            <p className="text-sm max-w-xs" style={{ color: c.textDim }}>
              Send us a message and we'll get back to you as soon as possible.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 max-w-2xl mx-auto">
            {messages.map((m) => (
              <div
                key={m.id}
                className="flex"
                style={{ justifyContent: m.from === "user" ? "flex-end" : "flex-start" }}
              >
                <div
                  className="max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                  style={{
                    background: m.from === "user" ? c.amber : c.surface,
                    color: m.from === "user" ? "#181205" : c.text,
                    border: m.from === "user" ? "none" : `1px solid ${c.border}`,
                    borderBottomRightRadius: m.from === "user" ? 4 : 16,
                    borderBottomLeftRadius: m.from === "user" ? 16 : 4,
                  }}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {botTyping && (
              <div className="flex justify-start">
                <div
                  className="rounded-2xl px-4 py-3 flex gap-1"
                  style={{ background: c.surface, border: `1px solid ${c.border}`, borderBottomLeftRadius: 4 }}
                >
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full animate-pulse"
                      style={{ background: c.textFaint, animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-4 sm:px-6 py-3 border-t" style={{ borderColor: c.border }}>
        <button
          className="flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0"
          style={{ background: c.surfaceAlt, border: `1px solid ${c.border}` }}
          aria-label="Attach image"
        >
          <ImageIcon size={18} style={{ color: c.textDim }} />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type your message..."
          className="flex-1 h-11 rounded-xl px-4 text-sm outline-none"
          style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }}
        />
        <button
          onClick={send}
          disabled={!input.trim()}
          className="flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0"
          style={{
            background: input.trim() ? "linear-gradient(135deg, #2563EB, #3B82F6)" : c.surfaceAlt,
            opacity: input.trim() ? 1 : 0.5,
          }}
          aria-label="Send"
        >
          <Send size={18} style={{ color: input.trim() ? "#fff" : c.textFaint }} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// REFER & EARN
// ---------------------------------------------------------------------------
function ReferScreen({ onBack, referralCode }) {
  const [tab, setTab] = useState("overview"); // overview | referrals | earnings
  const [copied, setCopied] = useState(false);
  const link = `https://primevest.app/register?ref=${referralCode}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — silently ignore
    }
  }

  async function shareLink() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join PrimeVest", url: link });
      } catch {
        // user cancelled — ignore
      }
    } else {
      copyLink();
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: c.bg, color: c.text }}>
      <div
        className="flex items-center gap-3 px-4 sm:px-6 h-16 border-b"
        style={{ background: c.bg, borderColor: c.border }}
      >
        <button onClick={onBack} aria-label="Back">
          <ArrowLeft size={20} style={{ color: c.text }} />
        </button>
        <span className="text-lg">🎁</span>
        <span className="text-base font-bold">Refer &amp; Earn</span>
      </div>

      <div className="flex-1 px-4 sm:px-6 py-5 max-w-2xl w-full mx-auto flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border p-4" style={{ background: c.surface, borderColor: c.border }}>
            <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: c.textDim }}>
              <Briefcase size={13} /> Total Referrals
            </div>
            <div className="text-2xl font-bold">0</div>
          </div>
          <div className="rounded-2xl border p-4" style={{ background: c.surface, borderColor: c.border }}>
            <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: c.textDim }}>
              <DollarSign size={13} /> Total Earned
            </div>
            <div className="text-2xl font-bold" style={{ color: c.green }}>$0.00</div>
          </div>
          <div className="rounded-2xl border p-4" style={{ background: c.surface, borderColor: c.border }}>
            <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: c.textDim }}>
              <Clock size={13} /> Pending Today
            </div>
            <div className="text-2xl font-bold" style={{ color: c.amber }}>+$0.00</div>
            <div className="text-[11px] mt-1" style={{ color: c.textFaint }}>Min $1 for payout</div>
          </div>
          <div className="rounded-2xl border p-4" style={{ background: c.surface, borderColor: c.border }}>
            <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: c.textDim }}>
              <TrendingUp size={13} /> Your Rate
            </div>
            <div className="text-2xl font-bold" style={{ color: "#22D3EE" }}>10.00%</div>
            <div className="text-[11px] mt-1" style={{ color: c.textFaint }}>Of referral losses</div>
          </div>
        </div>

        <div
          className="rounded-3xl overflow-hidden border"
          style={{ borderColor: c.border }}
        >
          <div className="px-5 py-5" style={{ background: "linear-gradient(135deg, #9333EA, #4F46E5)" }}>
            <div className="flex items-center gap-2 text-white font-bold text-base mb-1">
              🔗 Your Referral Link
            </div>
            <div className="text-sm text-white/85">Earn 10.00% of your referrals' losses daily!</div>
          </div>
          <div className="p-5" style={{ background: c.surface }}>
            <div className="text-xs font-semibold mb-2" style={{ color: c.textDim }}>Your Referral Link</div>
            <div
              className="flex items-center gap-2 rounded-xl border px-3 h-11 mb-4"
              style={{ background: c.bg, borderColor: c.border }}
            >
              <span className="flex-1 text-sm font-mono truncate" style={{ color: c.text }}>{link}</span>
              <button
                onClick={copyLink}
                className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                style={{ background: "rgba(147,51,234,0.18)" }}
                aria-label="Copy link"
              >
                <Check size={14} style={{ color: copied ? c.green : "#C77DFF" }} />
              </button>
            </div>
            <button
              onClick={shareLink}
              className="w-full h-12 rounded-2xl text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #9333EA, #4F46E5)" }}
            >
              Share Your Link
            </button>
          </div>
        </div>

        <div className="flex gap-1.5 rounded-2xl p-1" style={{ background: c.surfaceAlt }}>
          {[
            { id: "overview", label: "Overview" },
            { id: "referrals", label: "My Referrals" },
            { id: "earnings", label: "Earnings" },
          ].map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-1 h-10 rounded-xl text-xs sm:text-sm font-bold transition"
                style={{
                  background: active ? "linear-gradient(135deg, #9333EA, #7C3AED)" : "transparent",
                  color: active ? "#fff" : c.textDim,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "overview" && (
          <div className="rounded-3xl border p-5" style={{ background: c.surface, borderColor: c.border }}>
            <div className="flex items-center gap-2 font-bold text-base mb-4">
              <TrendingUp size={17} style={{ color: "#C77DFF" }} /> How It Works
            </div>
            <div className="flex flex-col gap-4">
              {[
                { n: 1, color: "#7C3AED", title: "Share Your Link", body: "Send your unique referral link to friends" },
                { n: 2, color: "#7C3AED", title: "They Sign Up & Trade", body: "When they register and start trading" },
                { n: 3, color: c.green, title: "You Earn 10.00% Daily", body: "Earn commission from their trading losses every day" },
              ].map((s) => (
                <div key={s.n} className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0"
                    style={{ background: s.color, color: "#fff" }}
                  >
                    {s.n}
                  </div>
                  <div>
                    <div className="text-sm font-bold">{s.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: c.textDim }}>{s.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "referrals" && (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <Briefcase size={26} style={{ color: c.textFaint }} className="mb-4" />
            <h3 className="text-sm font-bold mb-1">No referrals yet</h3>
            <p className="text-xs max-w-xs" style={{ color: c.textDim }}>
              Friends who sign up with your link will show up here.
            </p>
          </div>
        )}

        {tab === "earnings" && (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <DollarSign size={26} style={{ color: c.textFaint }} className="mb-4" />
            <h3 className="text-sm font-bold mb-1">No earnings yet</h3>
            <p className="text-xs max-w-xs" style={{ color: c.textDim }}>
              Commission from your referrals' activity will show up here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ACCOUNT SETTINGS
// ---------------------------------------------------------------------------
function SettingsRow({ icon: Icon, label, badge, expanded, onToggle, children }) {
  return (
    <div className="border-b" style={{ borderColor: c.border }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-sm"
      >
        <span className="flex items-center gap-4">
          <Icon size={18} style={{ color: c.textDim }} />
          <span className="font-medium">{label}</span>
          {badge}
        </span>
        <ChevronRight
          size={17}
          style={{ color: c.textDim, transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}
        />
      </button>
      {expanded && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function AccountSettingsScreen({ onBack, user, onUpdateUser }) {
  const [open, setOpen] = useState(null);
  const [name, setName] = useState(user?.name || "");
  const [nameSaved, setNameSaved] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwSaved, setPwSaved] = useState(false);
  const [twoFactor, setTwoFactor] = useState(!!user?.twoFactorEnabled);
  const [idForm, setIdForm] = useState({ legalName: "", idNumber: "" });
  const identityStatus = user?.identityStatus || "unverified";

  const [nameError, setNameError] = useState("");

  function toggle(key) {
    setOpen((o) => (o === key ? null : key));
  }

  async function saveName(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setNameError("");
    try {
      const { user: updated } = await backendApi("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() }),
      });
      onUpdateUser?.({ name: updated.name });
      setNameSaved(true);
      window.setTimeout(() => setNameSaved(false), 2000);
    } catch (err) {
      setNameError(err.message);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setPwError("");
    if (!pwForm.current || !pwForm.next) {
      setPwError("Fill in all fields");
      return;
    }
    if (pwForm.next.length < 8) {
      setPwError("New password must be at least 8 characters");
      return;
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwError("Passwords don't match");
      return;
    }
    try {
      await backendApi("/api/auth/me/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      });
      setPwSaved(true);
      setPwForm({ current: "", next: "", confirm: "" });
      window.setTimeout(() => setPwSaved(false), 2500);
    } catch (err) {
      setPwError(err.message);
    }
  }

  async function toggleTwoFactor() {
    const next = !twoFactor;
    setTwoFactor(next);
    try {
      const { user: updated } = await backendApi("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ twoFactorEnabled: next }),
      });
      onUpdateUser?.({ twoFactorEnabled: updated.twoFactorEnabled });
    } catch {
      setTwoFactor(!next); // revert on failure
    }
  }

  async function submitIdentity(e) {
    e.preventDefault();
    if (!idForm.legalName.trim() || !idForm.idNumber.trim()) return;
    try {
      const { user: updated } = await backendApi("/api/auth/me/verify-identity", {
        method: "POST",
        body: JSON.stringify(idForm),
      });
      onUpdateUser?.({ identityStatus: updated.identityStatus });
    } catch {
      // form stays as-is; user can retry
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: c.bg, color: c.text }}>
      <MoneyHeader title="Account Settings" onBack={onBack} />

      <div className="flex-1 px-4 sm:px-6 py-5 max-w-2xl w-full mx-auto">
        <div className="rounded-3xl border overflow-hidden" style={{ background: c.surface, borderColor: c.border }}>
          <SettingsRow
            icon={UserCog}
            label="Change Name"
            expanded={open === "name"}
            onToggle={() => toggle("name")}
          >
            <form onSubmit={saveName} className="flex flex-col gap-3">
              <Field icon={User}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className="flex-1 outline-none text-sm bg-transparent"
                  style={{ color: c.text }}
                />
              </Field>
              {nameError && <div className="text-xs font-medium" style={{ color: c.red }}>{nameError}</div>}
              <button
                type="submit"
                className="h-11 rounded-xl text-sm font-bold"
                style={{ background: c.amber, color: "#181205" }}
              >
                {nameSaved ? "Saved ✓" : "Save name"}
              </button>
            </form>
          </SettingsRow>

          <SettingsRow
            icon={Lock}
            label="Change Password"
            expanded={open === "password"}
            onToggle={() => toggle("password")}
          >
            <form onSubmit={savePassword} className="flex flex-col gap-3">
              <Field icon={Lock}>
                <input
                  type="password"
                  value={pwForm.current}
                  onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
                  placeholder="Current password"
                  className="flex-1 outline-none text-sm bg-transparent"
                  style={{ color: c.text }}
                />
              </Field>
              <Field icon={Lock}>
                <input
                  type="password"
                  value={pwForm.next}
                  onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
                  placeholder="New password"
                  className="flex-1 outline-none text-sm bg-transparent"
                  style={{ color: c.text }}
                />
              </Field>
              <Field icon={Lock}>
                <input
                  type="password"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                  placeholder="Confirm new password"
                  className="flex-1 outline-none text-sm bg-transparent"
                  style={{ color: c.text }}
                />
              </Field>
              {pwError && <div className="text-xs font-medium" style={{ color: c.red }}>{pwError}</div>}
              <button
                type="submit"
                className="h-11 rounded-xl text-sm font-bold"
                style={{ background: c.amber, color: "#181205" }}
              >
                {pwSaved ? "Password updated ✓" : "Update password"}
              </button>
            </form>
          </SettingsRow>

          <SettingsRow
            icon={Smartphone}
            label="Two-Factor Auth (2FA)"
            badge={
              twoFactor && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: c.greenDim, color: c.green }}
                >
                  ON
                </span>
              )
            }
            expanded={open === "2fa"}
            onToggle={() => toggle("2fa")}
          >
            <div className="flex items-center justify-between rounded-xl border p-4" style={{ borderColor: c.border }}>
              <div>
                <div className="text-sm font-bold">SMS-based 2FA</div>
                <div className="text-xs mt-0.5" style={{ color: c.textDim }}>
                  Add an extra step when logging in
                </div>
              </div>
              <button
                onClick={toggleTwoFactor}
                className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
                style={{ background: twoFactor ? c.green : c.borderStrong }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                  style={{ transform: twoFactor ? "translateX(22px)" : "translateX(2px)" }}
                />
              </button>
            </div>
          </SettingsRow>

          <SettingsRow
            icon={UserCheck}
            label="Verify Identity"
            badge={
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{
                  background: identityStatus === "verified" ? c.greenDim : identityStatus === "pending" ? c.amberDim : c.surfaceAlt,
                  color: identityStatus === "verified" ? c.green : identityStatus === "pending" ? c.amber : c.textFaint,
                }}
              >
                {identityStatus === "verified" ? "VERIFIED" : identityStatus === "pending" ? "PENDING" : "UNVERIFIED"}
              </span>
            }
            expanded={open === "identity"}
            onToggle={() => toggle("identity")}
          >
            {identityStatus === "pending" ? (
              <p className="text-sm" style={{ color: c.textDim }}>
                Your documents are under review. This usually takes 1-2 business days.
              </p>
            ) : identityStatus === "verified" ? (
              <p className="text-sm" style={{ color: c.textDim }}>Your identity has been verified.</p>
            ) : (
              <form onSubmit={submitIdentity} className="flex flex-col gap-3">
                <Field icon={User}>
                  <input
                    value={idForm.legalName}
                    onChange={(e) => setIdForm((f) => ({ ...f, legalName: e.target.value }))}
                    placeholder="Full legal name"
                    className="flex-1 outline-none text-sm bg-transparent"
                    style={{ color: c.text }}
                  />
                </Field>
                <Field icon={ShieldCheck}>
                  <input
                    value={idForm.idNumber}
                    onChange={(e) => setIdForm((f) => ({ ...f, idNumber: e.target.value }))}
                    placeholder="National ID / Passport number"
                    className="flex-1 outline-none text-sm bg-transparent"
                    style={{ color: c.text }}
                  />
                </Field>
                <button
                  type="submit"
                  className="h-11 rounded-xl text-sm font-bold"
                  style={{ background: c.amber, color: "#181205" }}
                >
                  Submit for review
                </button>
              </form>
            )}
          </SettingsRow>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App shell — routes between the auth screen and the trading dashboard
// ---------------------------------------------------------------------------
export default function App() {
  const [screen, setScreen] = useState("auth"); // "auth" | "dashboard" | "deposit" | "withdraw" | "history" | "about"
  const [booting, setBooting] = useState(true);
  const [authError, setAuthError] = useState("");
  const [user, setUser] = useState(null); // { name, email, referralCode, twoFactorEnabled, identityStatus }
  const [accountType, setAccountType] = useState("demo"); // "demo" | "real"
  const [demoBalance, setDemoBalance] = useState(10000);
  const [realBalance, setRealBalance] = useState(0);
  const [trades, setTrades] = useState([]);
  const [payments, setPayments] = useState([]); // deposit + withdrawal history

  // Pulls this user's profile, balances, and history from the backend and
  // populates local state — used on both fresh login and session restore.
  async function loadSession(profile) {
    setUser({
      name: profile.name,
      email: profile.email,
      referralCode: profile.referralCode,
      twoFactorEnabled: !!profile.twoFactorEnabled,
      identityStatus: profile.identityStatus || "unverified",
    });
    setAccountType("demo");
    setDemoBalance(profile.demoBalance ?? 10000);
    setRealBalance(profile.realBalance ?? 0);

    try {
      const { trades: rawTrades } = await backendApi("/api/trades");
      setTrades(rawTrades.map(transformTrade));
    } catch {
      setTrades([]);
    }
    try {
      const { payments: rawPayments } = await backendApi("/api/payments");
      setPayments(rawPayments.map(transformPayment));
    } catch {
      setPayments([]);
    }
  }

  // Restore a saved session (if any) once, on first load.
  useEffect(() => {
    (async () => {
      const token = getToken();
      if (token) {
        try {
          const { user: profile } = await backendApi("/api/auth/me");
          await loadSession(profile);
          setScreen("dashboard");
        } catch {
          setToken(null); // expired/invalid — fall back to the login screen
        }
      }
      setBooting(false);
    })();
  }, []);

  const onUpdateUser = (patch) => setUser((u) => ({ ...u, ...patch }));

  function setAccountBalance(type, amount) {
    if (type === "demo") setDemoBalance(amount);
    else setRealBalance(amount);
  }

  const addTrade = (entry) => setTrades((t) => [entry, ...t]);
  const resolveTrade = (id, patch) =>
    setTrades((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const addPayment = (entry) => setPayments((p) => [entry, ...p]);

  async function handleAuth({ mode, name, email, password, remember }) {
    try {
      const data = await backendApi(mode === "signup" ? "/api/auth/signup" : "/api/auth/login", {
        method: "POST",
        body: JSON.stringify(mode === "signup" ? { name, email, password } : { email, password }),
      });
      setToken(data.token);
      setAuthError("");
      await loadSession(data.user);
      setScreen("dashboard");
    } catch (err) {
      setAuthError(err.message || "Something went wrong");
    }
  }

  function handleLogout() {
    setToken(null);
    setUser(null);
    setAccountType("demo");
    setDemoBalance(10000);
    setRealBalance(0);
    setTrades([]);
    setPayments([]);
    setScreen("auth");
  }

  if (booting) return null;

  const balance = accountType === "demo" ? demoBalance : realBalance;

  if (screen === "dashboard") {
    return (
      <TradingDashboard
        onLogout={handleLogout}
        onNavigate={(next) => setScreen(next)}
        balance={balance}
        demoBalance={demoBalance}
        realBalance={realBalance}
        accountType={accountType}
        onSwitchAccount={setAccountType}
        onBalanceSet={setAccountBalance}
        trades={trades}
        onAddTrade={addTrade}
        onResolveTrade={resolveTrade}
        user={user}
      />
    );
  }
  if (screen === "deposit") {
    return (
      <DepositScreen
        onBack={() => setScreen("dashboard")}
        onComplete={() => setScreen("dashboard")}
        onBalanceSet={(amount) => setRealBalance(amount)}
        onAddPayment={addPayment}
      />
    );
  }
  if (screen === "withdraw") {
    return (
      <WithdrawScreen
        onBack={() => setScreen("dashboard")}
        onComplete={() => setScreen("dashboard")}
        balance={realBalance}
        onBalanceSet={(amount) => setRealBalance(amount)}
        onAddPayment={addPayment}
      />
    );
  }
  if (screen === "history") {
    return (
      <HistoryScreen
        trades={trades.filter((t) => t.status === "won" || t.status === "lost")}
        payments={payments}
        onBack={() => setScreen("dashboard")}
        onRefresh={async () => {
          const { trades: rawTrades } = await backendApi("/api/trades");
          setTrades(rawTrades.map(transformTrade));
          const { payments: rawPayments } = await backendApi("/api/payments");
          setPayments(rawPayments.map(transformPayment));
        }}
      />
    );
  }
  if (screen === "about") {
    return <AboutScreen onBack={() => setScreen("dashboard")} />;
  }
  if (screen === "livechat") {
    return <LiveChatScreen onBack={() => setScreen("dashboard")} />;
  }
  if (screen === "refer") {
    return <ReferScreen onBack={() => setScreen("dashboard")} referralCode={user?.referralCode || ""} />;
  }
  if (screen === "settings") {
    return (
      <AccountSettingsScreen
        onBack={() => setScreen("dashboard")}
        user={user}
        onUpdateUser={onUpdateUser}
      />
    );
  }
  return (
    <AuthScreen
      onAuth={handleAuth}
      authError={authError}
      clearAuthError={() => setAuthError("")}
    />
  );
}
