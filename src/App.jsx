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
// Backend wiring — points at the deployed Daraja server.
// Set VITE_API_BASE_URL and VITE_API_KEY in your Vercel project's
// Environment Variables (see the deploy README).
// ---------------------------------------------------------------------------
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const API_KEY = import.meta.env.VITE_API_KEY || "";

async function mpesaApi(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
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
    const data = await mpesaApi(path);
    if (data.status === "success" || data.status === "failed") return data;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Timed out waiting for confirmation");
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
const INITIAL_DIGIT_STATS = [8.1, 9.4, 10.2, 9.8, 10.6, 9.1, 10.9, 8.7, 11.3, 11.9];

// Nudge each digit's percentage by a small random amount, then renormalize
// so the row always sums to 100% — simulates a live-updating distribution.
function rotateDigitStats(prev) {
  const nudged = prev.map((v) => Math.max(2, v + (Math.random() - 0.5) * 3.2));
  const sum = nudged.reduce((a, b) => a + b, 0);
  return nudged.map((v) => Number(((v / sum) * 100).toFixed(1)));
}

function TradingDashboard({ onLogout, onNavigate }) {
  const [data, setData] = useState(() => makeInitialSeries(BASE_PRICE, 80));
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

  const openingPriceRef = useRef(data[0].price);

  // simulate a live-ish feed
  useEffect(() => {
    const id = setInterval(() => {
      setData((prev) => {
        const last = prev[prev.length - 1].price;
        const noise = (Math.random() - 0.5) * BASE_PRICE * 0.0011;
        const next = Number((last + noise).toFixed(2));
        const nextPoint = { idx: prev[prev.length - 1].idx + 1, time: new Date(), price: next };
        const merged = [...prev.slice(1), nextPoint];
        return merged;
      });
    }, 2000);
    return () => clearInterval(id);
  }, []);

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

  function handlePlaceTrade(side) {
    setFlash(side);
    window.setTimeout(() => setFlash(null), 500);
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
              onClick={() => setBalanceMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 h-10 px-3 rounded-xl border text-sm font-semibold font-mono"
              style={{ background: c.surfaceAlt, borderColor: c.border, color: c.text }}
            >
              $0.00
              <ChevronDown size={15} style={{ color: c.textDim }} />
            </button>
            {balanceMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-44 rounded-xl border overflow-hidden shadow-2xl"
                style={{ background: c.elevated, borderColor: c.border }}
              >
                <button className="w-full text-left px-4 py-3 text-sm hover:bg-white/5" style={{ color: c.text }}>
                  Real account
                  <div className="text-xs font-mono" style={{ color: c.textDim }}>$0.00</div>
                </button>
                <div style={{ borderTop: `1px solid ${c.border}` }} />
                <button className="w-full text-left px-4 py-3 text-sm hover:bg-white/5" style={{ color: c.text }}>
                  Demo account
                  <div className="text-xs font-mono" style={{ color: c.textDim }}>$10,000.00</div>
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

          <button
            className="relative flex items-center justify-center w-10 h-10 rounded-xl border"
            style={{ background: c.surfaceAlt, borderColor: c.border }}
            aria-label="Notifications"
          >
            <Bell size={18} style={{ color: c.textDim }} />
            <span
              className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
              style={{ background: c.amber }}
            />
          </button>

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
                B
              </div>
              <div>
                <div className="text-base font-bold">Brian Kibet</div>
                <div className="text-sm" style={{ color: c.textDim }}>b****@gmail.com</div>
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
                { icon: UserCog, label: "Account Settings" },
                { icon: Wallet, label: "Deposit", nav: "deposit" },
                { icon: ArrowLeftRight, label: "Withdraw", nav: "withdraw" },
                { icon: History, label: "History" },
                { icon: Gift, label: "Refer & Earn", highlight: true },
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
                { icon: HelpCircle, label: "Help Centre" },
                { icon: Shield, label: "Security" },
                { icon: MessageCircle, label: "Live Chat" },
                { icon: Info, label: "About PrimeVest" },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
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
                    onClick={() => setActiveTab(tab.id)}
                    className="flex-shrink-0 h-12 px-5 rounded-2xl text-sm font-semibold whitespace-nowrap transition"
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

            {/* Chart card */}
            <div
              className="rounded-3xl border overflow-hidden mb-4"
              style={{ background: c.bg, borderColor: c.border, boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}
            >
              <div className="flex items-start justify-between px-4 sm:px-5 pt-4 pb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: c.amber, boxShadow: `0 0 8px ${c.amber}` }}
                    />
                    <span className="text-xs font-semibold tracking-wide" style={{ color: c.textDim }}>
                      VOL 10 (1S)
                    </span>
                  </div>
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
              style={{ background: c.surface, borderColor: c.border }}
            >
              <div className="text-xs font-semibold tracking-wide mb-3 px-1" style={{ color: c.textDim }}>
                LAST DIGIT PROBABILITY
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {digitStats.map((pct, digit) => {
                  const selected = digit === selectedDigit;
                  const highest = pct === Math.max(...digitStats);
                  return (
                    <button
                      key={digit}
                      onClick={() => setSelectedDigit(digit)}
                      className="flex-shrink-0 flex flex-col items-center gap-1.5"
                    >
                      <span
                        className="flex items-center justify-center rounded-full font-bold text-base transition"
                        style={{
                          width: 46,
                          height: 46,
                          background: selected ? c.amber : c.elevated,
                          color: selected ? "#181205" : c.text,
                          border: `1px solid ${selected ? c.amber : c.border}`,
                        }}
                      >
                        {digit}
                      </span>
                      <span
                        className="text-[11px] font-mono tabular-nums transition-all duration-700 ease-out"
                        style={{
                          color: selected ? c.amber : highest ? c.text : c.textDim,
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
                      onClick={() => setMode(m)}
                      className="flex-1 h-11 rounded-xl text-sm font-bold transition"
                      style={{
                        background: active ? c.amber : "transparent",
                        color: active ? "#181205" : c.textDim,
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
                  style={{ background: c.bg, borderColor: c.borderStrong }}
                >
                  <span className="text-xl font-bold font-mono" style={{ color: c.textDim }}>$</span>
                  <input
                    value={stakeInput}
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
                        onClick={() => commitStake(amt)}
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

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handlePlaceTrade("even")}
                  className="flex flex-col items-center justify-center rounded-2xl py-5 transition"
                  style={{
                    background: `linear-gradient(135deg, ${c.green}, #0EA96B)`,
                    boxShadow: flash === "even" ? `0 0 0 3px ${c.green}` : "0 10px 24px rgba(22,199,132,0.3)",
                    transform: flash === "even" ? "scale(0.97)" : "scale(1)",
                  }}
                >
                  <span className="text-lg font-extrabold text-white">Even</span>
                  <span className="text-xs font-semibold text-white/85 mt-1">95.2%</span>
                  <span className="text-sm font-bold font-mono text-white mt-1">${payout}</span>
                </button>
                <button
                  onClick={() => handlePlaceTrade("odd")}
                  className="flex flex-col items-center justify-center rounded-2xl py-5 transition"
                  style={{
                    background: `linear-gradient(135deg, ${c.red}, #D8283F)`,
                    boxShadow: flash === "odd" ? `0 0 0 3px ${c.red}` : "0 10px 24px rgba(246,70,93,0.3)",
                    transform: flash === "odd" ? "scale(0.97)" : "scale(1)",
                  }}
                >
                  <span className="text-lg font-extrabold text-white">Odd</span>
                  <span className="text-xs font-semibold text-white/85 mt-1">95.2%</span>
                  <span className="text-sm font-bold font-mono text-white mt-1">${payout}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ================= BOTTOM NAV ================= */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around h-[70px] border-t lg:hidden"
        style={{ background: c.surface, borderColor: c.border }}
      >
        {[
          { icon: TrendingUp, label: "Trade", active: true },
          { icon: Bot, label: "AI", active: false },
          { icon: Briefcase, label: "Positions", active: false },
        ].map(({ icon: Icon, label, active }) => (
          <button key={label} className="flex flex-col items-center gap-1">
            <Icon size={21} style={{ color: active ? c.amber : c.textDim }} />
            <span className="text-[11px] font-medium" style={{ color: active ? c.amber : c.textDim }}>
              {label}
            </span>
          </button>
        ))}
      </nav>
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

function AuthScreen({ onAuthSuccess }) {
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

  function handleSubmit(ev) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      onAuthSuccess?.();
    }, 1200);
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
function MoneyHeader({ title, onBack }) {
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
      <span className="text-base font-bold">{title}</span>
    </div>
  );
}

const QUICK_AMOUNTS = [500, 1000, 2500, 5000, 10000];

function AmountChips({ value, onPick }) {
  return (
    <div className="flex flex-wrap gap-2">
      {QUICK_AMOUNTS.map((amt) => (
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
          KES {amt.toLocaleString()}
        </button>
      ))}
    </div>
  );
}

// Normalizes/validates a Kenyan mobile number for display purposes only.
function formatKenyanNumber(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("254")) return "+" + digits;
  if (digits.startsWith("0")) return "+254" + digits.slice(1);
  if (digits.length > 0) return "+254" + digits;
  return "";
}

function isValidKenyanNumber(raw) {
  const digits = raw.replace(/\D/g, "");
  return /^(?:254|0)?7\d{8}$/.test(digits) || /^(?:254|0)?1\d{8}$/.test(digits);
}

// ---------------------------------------------------------------------------
// DEPOSIT — M-Pesa STK Push
// ---------------------------------------------------------------------------
function DepositScreen({ onBack, onComplete }) {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState({});
  const [stage, setStage] = useState("form"); // form | pushed | waiting | success | failed
  const [apiError, setApiError] = useState("");

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!isValidKenyanNumber(phone)) errs.phone = "Enter a valid Safaricom number";
    const amt = Number(amount);
    if (!amt || amt < 10) errs.amount = "Minimum deposit is KES 10";
    setError(errs);
    if (Object.keys(errs).length) return;

    setApiError("");
    setStage("pushed");
    try {
      const { checkoutRequestId } = await mpesaApi("/api/mpesa/stkpush", {
        method: "POST",
        body: JSON.stringify({ phone, amount: amt, accountRef: "PrimeVest" }),
      });
      setStage("waiting");
      const result = await pollStatus(`/api/mpesa/stkpush/status/${checkoutRequestId}`);
      if (result.status === "success") {
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
              <>Sending a prompt to <span style={{ color: c.text }}>{formatKenyanNumber(phone)}</span>…</>
            ) : (
              <>
                Enter your M-Pesa PIN on the prompt sent to{" "}
                <span className="font-semibold" style={{ color: c.text }}>
                  {formatKenyanNumber(phone)}
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
            KES {Number(amount).toLocaleString()} has been added to your PrimeVest balance from{" "}
            {formatKenyanNumber(phone)}.
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
                You'll get a prompt on your phone to enter your PIN
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
              className="flex items-center gap-2 h-13 rounded-2xl border px-4 mb-3"
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
            {error.amount && (
              <div className="text-xs font-medium mb-3" style={{ color: c.red }}>{error.amount}</div>
            )}
            <AmountChips value={amount} onPick={(a) => setAmount(String(a))} />
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
function WithdrawScreen({ onBack, onComplete, balance = 10482.5 }) {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState({});
  const [stage, setStage] = useState("form"); // form | processing | success | failed
  const [apiError, setApiError] = useState("");

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!isValidKenyanNumber(phone)) errs.phone = "Enter a valid Safaricom number";
    const amt = Number(amount);
    if (!amt || amt < 100) errs.amount = "Minimum withdrawal is KES 100";
    else if (amt > balance) errs.amount = "Amount exceeds your available balance";
    setError(errs);
    if (Object.keys(errs).length) return;

    setApiError("");
    setStage("processing");
    try {
      const { conversationId } = await mpesaApi("/api/mpesa/b2c", {
        method: "POST",
        body: JSON.stringify({ phone, amount: amt }),
      });
      const result = await pollStatus(`/api/mpesa/b2c/status/${conversationId}`);
      if (result.status === "success") {
        setStage("success");
      } else {
        setApiError(result.resultDesc || "The withdrawal could not be completed");
        setStage("failed");
      }
    } catch (err) {
      setApiError(err.message || "Something went wrong");
      setStage("failed");
    }
  }

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
          <h2 className="text-lg font-bold mb-2">Withdrawal didn't go through</h2>
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
          <h2 className="text-lg font-bold mb-2">Processing withdrawal…</h2>
          <p className="text-sm max-w-xs" style={{ color: c.textDim }}>
            Sending KES {Number(amount).toLocaleString()} to{" "}
            <span style={{ color: c.text }}>{formatKenyanNumber(phone)}</span> via M-Pesa.
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
          <h2 className="text-lg font-bold mb-2">Withdrawal sent</h2>
          <p className="text-sm max-w-xs mb-8" style={{ color: c.textDim }}>
            KES {Number(amount).toLocaleString()} is on its way to {formatKenyanNumber(phone)} via M-Pesa.
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
              Available balance
            </div>
            <div className="text-2xl font-bold font-mono">
              KES {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
              className="flex items-center gap-2 h-13 rounded-2xl border px-4 mb-3"
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
              <button
                type="button"
                onClick={() => setAmount(String(Math.floor(balance)))}
                className="text-xs font-bold flex-shrink-0"
                style={{ color: c.amber }}
              >
                MAX
              </button>
            </div>
            {error.amount && (
              <div className="text-xs font-medium mb-3" style={{ color: c.red }}>{error.amount}</div>
            )}
            <AmountChips value={amount} onPick={(a) => setAmount(String(a))} />
          </div>

          <button
            type="submit"
            className="h-13 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 mt-1"
            style={{ height: 52, background: c.amber, color: "#181205" }}
          >
            Withdraw to M-Pesa
            <ArrowRight size={16} />
          </button>

          <div className="flex items-center gap-2 justify-center text-xs" style={{ color: c.textFaint }}>
            <ShieldCheck size={13} />
            Withdrawals typically arrive within a few minutes
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App shell — routes between the auth screen and the trading dashboard
// ---------------------------------------------------------------------------
export default function App() {
  const [screen, setScreen] = useState("auth"); // "auth" | "dashboard" | "deposit" | "withdraw"

  if (screen === "dashboard") {
    return (
      <TradingDashboard
        onLogout={() => setScreen("auth")}
        onNavigate={(next) => setScreen(next)}
      />
    );
  }
  if (screen === "deposit") {
    return (
      <DepositScreen
        onBack={() => setScreen("dashboard")}
        onComplete={() => setScreen("dashboard")}
      />
    );
  }
  if (screen === "withdraw") {
    return (
      <WithdrawScreen
        onBack={() => setScreen("dashboard")}
        onComplete={() => setScreen("dashboard")}
      />
    );
  }
  return <AuthScreen onAuthSuccess={() => setScreen("dashboard")} />;
}
