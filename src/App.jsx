import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
  Bar,
  Cell,
  ReferenceLine,
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
  Upload,
  Sparkles,
  Search,
  BarChart3,
  Copy,
  Coins,
  Star,
  Zap,
  Layers,
  Headphones,
  Globe,
  Users,
  TrendingDown,
  CreditCard,
  Award,
  LineChart as LineChartIcon,
  CandlestickChart as CandlestickChartIcon,
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
    method: p.method || "mpesa",
    amount: p.amountKes,
    usdAmount: p.usdAmount,
    phone: p.phone,
    walletAddress: p.walletAddress,
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

// Draws the dashed current-price line's decorations: a small dot at the
// left edge and a bordered price pill at the right edge — recharts hands
// us the already-computed pixel viewBox for the reference line, so we
// just draw plain SVG on top of it.
function CurrentPriceLabel({ viewBox, value, color }) {
  if (!viewBox) return null;
  const { x, y, width } = viewBox;
  const text = value.toFixed(2);
  const boxWidth = text.length * 7.5 + 22;
  const boxX = x + width - boxWidth;
  return (
    <g>
      <circle cx={x} cy={y} r={4} fill={color} />
      <rect x={boxX} y={y - 12} width={boxWidth} height={24} rx={7} fill={c.bg} stroke={color} strokeWidth={1.5} />
      <text
        x={boxX + boxWidth / 2}
        y={y + 4}
        textAnchor="middle"
        fill={c.text}
        fontSize={11}
        fontWeight={700}
        fontFamily="monospace"
      >
        {text}
      </text>
    </g>
  );
}

// Recharts has no built-in candlestick type, so this is the standard
// workaround: render a <Bar dataKey="highLow"> where highLow=[low, high] —
// recharts then hands this shape the pixel y/height already scaled to
// exactly span [low, high] on the y-axis. Open/close just need linear
// interpolation within that same span to land in the right place.
function Candle({ x, y, width, height, payload }) {
  const { open, close, high, low } = payload;
  const bodyWidth = Math.max(width * 0.6, 2);
  const bodyX = x + (width - bodyWidth) / 2;
  const wickX = x + width / 2;
  const isUp = close >= open;
  const color = close === open ? c.textFaint : isUp ? c.green : c.red;

  if (high === low) {
    // Doji — this tick's price rounded to exactly the same value as the
    // previous one, so there's no range to draw a body/wick from.
    // recharts collapses y/height to a single point in this case; a flat
    // dash reads correctly instead of dividing by a zero range.
    return <line x1={x} y1={y} x2={x + width} y2={y} stroke={color} strokeWidth={1.5} />;
  }

  const scaleY = (price) => y + height * ((high - price) / (high - low));
  const openY = scaleY(open);
  const closeY = scaleY(close);
  const bodyTop = Math.min(openY, closeY);
  const bodyHeight = Math.max(Math.abs(closeY - openY), 1.5); // 1.5px floor so a thin body is still visible
  return (
    <g>
      <line x1={wickX} y1={y} x2={wickX} y2={y + height} stroke={color} strokeWidth={1.25} />
      <rect x={bodyX} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={color} rx={1} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// TECHNICAL INDICATORS — real calculations, not placeholders. Each compute
// function takes an array of closing prices (oldest first) and returns
// either a flat array of values aligned index-for-index with the input
// (single-line indicators), or an object of such arrays (multi-line ones
// like Bollinger Bands or MACD). Indices before an indicator has enough
// data to compute yet are `null`, which recharts simply skips drawing.
// ---------------------------------------------------------------------------

function computeSMA(closes, period) {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    return sum / period;
  });
}

function computeEMA(closes, period) {
  const k = 2 / (period + 1);
  const out = new Array(closes.length).fill(null);
  let prev = null;
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) continue;
    if (prev === null) {
      // Seed the EMA with a simple average of the first `period` closes.
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += closes[j];
      prev = sum / period;
    } else {
      prev = closes[i] * k + prev * (1 - k);
    }
    out[i] = prev;
  }
  return out;
}

function computeBollinger(closes, period, stdDevMult) {
  const mid = computeSMA(closes, period);
  const upper = new Array(closes.length).fill(null);
  const lower = new Array(closes.length).fill(null);
  for (let i = 0; i < closes.length; i++) {
    if (mid[i] === null) continue;
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) sumSq += (closes[j] - mid[i]) ** 2;
    const stdDev = Math.sqrt(sumSq / period);
    upper[i] = mid[i] + stdDev * stdDevMult;
    lower[i] = mid[i] - stdDev * stdDevMult;
  }
  return { mid, upper, lower };
}

function computeRSI(closes, period) {
  const out = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return out;
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gainSum += change;
    else lossSum -= change;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

function computeMACD(closes, fast, slow, signal) {
  const emaFast = computeEMA(closes, fast);
  const emaSlow = computeEMA(closes, slow);
  const macdLine = closes.map((_, i) => (emaFast[i] !== null && emaSlow[i] !== null ? emaFast[i] - emaSlow[i] : null));
  // Signal line is an EMA of the MACD line itself — computed only over the
  // stretch where macdLine is non-null, then mapped back to full length.
  const macdValues = macdLine.filter((v) => v !== null);
  const signalRaw = computeEMA(macdValues, signal);
  const firstMacdIdx = macdLine.findIndex((v) => v !== null);
  const signalLine = new Array(closes.length).fill(null);
  signalRaw.forEach((v, i) => {
    if (v !== null) signalLine[firstMacdIdx + i] = v;
  });
  const histogram = closes.map((_, i) =>
    macdLine[i] !== null && signalLine[i] !== null ? macdLine[i] - signalLine[i] : null
  );
  return { macdLine, signalLine, histogram };
}

// Palette cycled through as a user adds more overlay indicators, so each
// gets a visually distinct line color on the chart.
const INDICATOR_COLORS = ["#38BDF8", "#A78BFA", "#FB923C", "#22D3EE", "#F472B6"];

// The catalog shown in the "All" tab of the Indicators modal. `overlay:
// true` means it draws on the price chart itself (EMA/SMA/Bollinger);
// `overlay: false` means it gets its own panel below the chart (RSI/MACD),
// matching how PocketOption separates trend indicators from oscillators.
const INDICATOR_CATALOG = [
  { type: "ema", label: "Moving Average EMA", overlay: true, defaultParams: { period: 20 } },
  { type: "sma", label: "Moving Average SMA", overlay: true, defaultParams: { period: 20 } },
  { type: "bollinger", label: "Bollinger Bands", overlay: true, defaultParams: { period: 20, stdDev: 2 } },
  { type: "rsi", label: "RSI", overlay: false, defaultParams: { period: 14 } },
  { type: "macd", label: "MACD", overlay: false, defaultParams: { fast: 12, slow: 26, signal: 9 } },
];

function indicatorDisplayLabel(ind) {
  const def = INDICATOR_CATALOG.find((d) => d.type === ind.type);
  if (ind.type === "bollinger") return `${def.label} (${ind.params.period}, ${ind.params.stdDev})`;
  if (ind.type === "macd") return `${def.label} (${ind.params.fast}, ${ind.params.slow}, ${ind.params.signal})`;
  return `${def.label} ${ind.params.period}`;
}

// The small chart panel below the main price chart for oscillator-type
// indicators (RSI, MACD) — these have their own value range (0-100 for
// RSI) that doesn't share an axis with price, so they can't be overlaid
// directly on the chart the way EMA/SMA/Bollinger are.
function OscillatorPanel({ indicator, data, color, onRemove, onEdit }) {
  return (
    <div className="border-t px-1 sm:px-2 pt-2 pb-1" style={{ borderColor: c.border }}>
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-[11px] font-bold" style={{ color: c.textDim }}>
          {indicatorDisplayLabel(indicator)}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={onEdit} aria-label="Settings">
            <Settings size={12} style={{ color: c.textFaint }} />
          </button>
          <button onClick={onRemove} aria-label="Remove">
            <X size={13} style={{ color: c.textFaint }} />
          </button>
        </div>
      </div>
      <div className="h-[90px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {indicator.type === "rsi" ? (
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <YAxis domain={[0, 100]} hide />
              <XAxis dataKey="time" hide />
              <ReferenceLine y={70} stroke={c.textFaint} strokeDasharray="3 3" strokeOpacity={0.5} />
              <ReferenceLine y={30} stroke={c.textFaint} strokeDasharray="3 3" strokeOpacity={0.5} />
              <Line type="monotone" dataKey={indicator.id} stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
            </LineChart>
          ) : (
            <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <YAxis domain={["auto", "auto"]} hide />
              <XAxis dataKey="time" hide />
              <ReferenceLine y={0} stroke={c.textFaint} strokeOpacity={0.4} />
              <Bar dataKey={`${indicator.id}_hist`} isAnimationActive={false}>
                {data.map((row, i) => (
                  <Cell key={i} fill={(row[`${indicator.id}_hist`] ?? 0) >= 0 ? c.green : c.red} />
                ))}
              </Bar>
              <Line type="monotone" dataKey={`${indicator.id}_macd`} stroke={color} strokeWidth={1.25} dot={false} isAnimationActive={false} connectNulls />
              <Line type="monotone" dataKey={`${indicator.id}_signal`} stroke={c.amber} strokeWidth={1.25} dot={false} isAnimationActive={false} connectNulls />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Add/manage indicators — mirrors the Current/All tab layout from the
// reference screenshots. "Current" lists what's actually applied with
// settings + remove controls; "All" is the catalog to add from. Only
// types with a real compute() implementation appear here — no dead
// buttons for indicators that don't actually calculate anything.
function IndicatorsModal({
  open,
  onClose,
  indicators,
  tab,
  setTab,
  editingId,
  setEditingId,
  onAdd,
  onRemove,
  onUpdateParams,
  onClearAll,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[85vh] flex flex-col"
        style={{ background: c.elevated }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-base font-bold" style={{ color: c.text }}>Indicators</h3>
          <button onClick={onClose}>
            <X size={20} style={{ color: c.textDim }} />
          </button>
        </div>

        <div className="flex border-b" style={{ borderColor: c.border }}>
          <button
            onClick={() => setTab("current")}
            className="flex-1 py-3 text-sm font-bold"
            style={{
              color: tab === "current" ? c.text : c.textDim,
              borderBottom: tab === "current" ? `2px solid ${c.amber}` : "2px solid transparent",
            }}
          >
            Current ({indicators.length})
          </button>
          <button
            onClick={() => setTab("all")}
            className="flex-1 py-3 text-sm font-bold"
            style={{
              color: tab === "all" ? c.text : c.textDim,
              borderBottom: tab === "all" ? `2px solid ${c.amber}` : "2px solid transparent",
            }}
          >
            All
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {tab === "current" &&
            (indicators.length === 0 ? (
              <p className="text-sm text-center py-10" style={{ color: c.textFaint }}>
                No indicators added yet. Switch to "All" to add one.
              </p>
            ) : (
              indicators.map((ind) => (
                <div key={ind.id} className="mb-1">
                  <div
                    className="flex items-center justify-between py-3 px-3 rounded-2xl"
                    style={{ background: c.surfaceAlt }}
                  >
                    <span className="text-sm font-semibold" style={{ color: c.text }}>
                      {indicatorDisplayLabel(ind)}
                    </span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setEditingId(editingId === ind.id ? null : ind.id)}>
                        <Settings size={16} style={{ color: editingId === ind.id ? c.amber : c.textDim }} />
                      </button>
                      <button onClick={() => onRemove(ind.id)}>
                        <X size={16} style={{ color: c.textDim }} />
                      </button>
                    </div>
                  </div>
                  {editingId === ind.id && (
                    <IndicatorParamEditor indicator={ind} onChange={(params) => onUpdateParams(ind.id, params)} />
                  )}
                </div>
              ))
            ))}

          {tab === "all" &&
            INDICATOR_CATALOG.map((def) => {
              const alreadyAdded = indicators.some((i) => i.type === def.type);
              return (
                <button
                  key={def.type}
                  onClick={() => onAdd(def.type)}
                  className="w-full flex items-center gap-3 py-3 px-1 text-left"
                >
                  <Star
                    size={16}
                    style={{ color: alreadyAdded ? c.amber : c.textFaint }}
                    fill={alreadyAdded ? c.amber : "none"}
                  />
                  <span className="text-sm font-semibold" style={{ color: c.text }}>{def.label}</span>
                </button>
              );
            })}
        </div>

        {tab === "current" && indicators.length > 0 && (
          <div className="px-5 py-4 border-t" style={{ borderColor: c.border }}>
            <button
              onClick={onClearAll}
              className="w-full text-center text-sm font-bold py-2"
              style={{ color: c.red }}
            >
              Delete all ({indicators.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Inline period/param editor shown under a Current-tab row when its gear
// icon is tapped. Kept intentionally simple — number inputs only, no
// separate confirm modal, since these are single small values.
function IndicatorParamEditor({ indicator, onChange }) {
  const params = indicator.params;
  function setParam(key, value) {
    onChange({ ...params, [key]: Number(value) });
  }
  const fields =
    indicator.type === "bollinger"
      ? [
          { key: "period", label: "Period", min: 2, max: 100 },
          { key: "stdDev", label: "Std Dev", min: 0.5, max: 5, step: 0.5 },
        ]
      : indicator.type === "macd"
      ? [
          { key: "fast", label: "Fast", min: 2, max: 50 },
          { key: "slow", label: "Slow", min: 2, max: 100 },
          { key: "signal", label: "Signal", min: 2, max: 50 },
        ]
      : [{ key: "period", label: "Period", min: 2, max: 200 }];

  return (
    <div className="flex gap-3 px-3 py-3 rounded-2xl mt-1" style={{ background: c.surface }}>
      {fields.map((f) => (
        <label key={f.key} className="flex-1">
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: c.textFaint }}>
            {f.label}
          </span>
          <input
            type="number"
            value={params[f.key]}
            min={f.min}
            max={f.max}
            step={f.step || 1}
            onChange={(e) => setParam(f.key, e.target.value)}
            className="w-full mt-1 h-9 px-2 rounded-xl text-sm font-mono font-bold outline-none"
            style={{ background: c.surfaceAlt, color: c.text, border: `1px solid ${c.border}` }}
          />
        </label>
      ))}
    </div>
  );
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

// ---------------------------------------------------------------------------
// AI ENTRY SCANNER — a simulated market scanner for people who'd rather not
// pick a symbol/digit manually. It's a randomized pick dressed up with a
// scanning animation, not a real predictive model — this game has no
// exploitable pattern, same as everywhere else in this app.
// ---------------------------------------------------------------------------
const SCANNER_MARKETS = [
  { id: "matches", label: "Matches/Differs" },
  { id: "evenodd", label: "Even/Odd" },
  { id: "overunder", label: "Over/Under" },
];
const STEPS_PER_SYMBOL = 3;

function AIScannerModal({ onClose, onLoadMarket }) {
  const [marketChoice, setMarketChoice] = useState("evenodd");
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0); // 0..totalSteps
  const [currentSymbol, setCurrentSymbol] = useState(null);
  const [result, setResult] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const totalSteps = SYMBOLS.length * STEPS_PER_SYMBOL;

  function startScan() {
    clearTimeout(timerRef.current);
    setResult(null);
    setScanning(true);
    setProgress(0);
    let step = 0;

    function tick() {
      const symbolIdx = Math.min(Math.floor(step / STEPS_PER_SYMBOL), SYMBOLS.length - 1);
      setCurrentSymbol(SYMBOLS[symbolIdx]);
      step += 1;
      setProgress(step);

      if (step >= totalSteps) {
        const winner = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        const digit = Math.floor(Math.random() * 10);
        const confidence = 68 + Math.floor(Math.random() * 24); // 68-91%, deliberately not near 100

        let side, sideLabel;
        if (marketChoice === "evenodd") {
          side = Math.random() < 0.5 ? "even" : "odd";
          sideLabel = side === "even" ? "Even" : "Odd";
        } else if (marketChoice === "matches") {
          side = Math.random() < 0.5 ? "matches" : "differs";
          sideLabel = side === "matches" ? "Matches" : "Differs";
        } else {
          side = Math.random() < 0.5 ? "over" : "under";
          sideLabel = side === "over" ? "Over" : "Under";
        }

        setResult({ symbol: winner, side, sideLabel, digit, confidence });
        setScanning(false);
        return;
      }
      timerRef.current = setTimeout(tick, 220);
    }
    tick();
  }

  const marketLabel = SCANNER_MARKETS.find((m) => m.id === marketChoice)?.label;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-5">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.65)" }} onClick={onClose} />
      <div
        className="relative w-full max-w-sm rounded-3xl border overflow-hidden"
        style={{ background: c.surface, borderColor: c.border, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: c.border }}>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #9333EA, #4F46E5)" }}
          >
            <Sparkles size={17} style={{ color: "#fff" }} />
          </div>
          <span className="text-base font-bold flex-1">Entry Scanner</span>
          <button onClick={onClose} aria-label="Close">
            <X size={18} style={{ color: c.textDim }} />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[75vh] overflow-y-auto">
          <p className="text-sm leading-relaxed mb-4" style={{ color: c.textDim }}>
            Pick the market category you want to scan. The scanner checks every
            volatility index and suggests an entry based on the current last-digit
            spread — not a guarantee, just a starting point.
          </p>

          <label className="text-xs font-semibold mb-1.5 block" style={{ color: c.textDim }}>
            Market
          </label>
          <select
            value={marketChoice}
            onChange={(e) => {
              setMarketChoice(e.target.value);
              setResult(null);
            }}
            disabled={scanning}
            className="w-full h-12 rounded-2xl px-4 text-sm font-semibold outline-none mb-4"
            style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
          >
            {SCANNER_MARKETS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>

          {(scanning || result) && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span style={{ color: "#C77DFF" }}>
                  {result ? result.symbol.label : currentSymbol?.label}
                </span>
                <span style={{ color: c.textFaint }}>{progress}/{totalSteps}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: c.elevated }}>
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{
                    width: `${(progress / totalSteps) * 100}%`,
                    background: "linear-gradient(90deg, #9333EA, #EC4899)",
                  }}
                />
              </div>
              {scanning && (
                <div className="flex items-center gap-2 text-sm" style={{ color: c.textDim }}>
                  <Loader2 size={14} className="animate-spin" />
                  Scanning {currentSymbol?.label}…
                </div>
              )}
            </div>
          )}

          {result && !scanning && (
            <div
              className="rounded-2xl border p-4 mb-4"
              style={{ background: c.elevated, borderColor: c.border }}
            >
              <div className="text-xs font-semibold mb-2" style={{ color: c.textFaint }}>
                SUGGESTED ENTRY
              </div>
              <div className="text-base font-bold mb-1">{result.symbol.label}</div>
              <div className="text-sm mb-2" style={{ color: c.textDim }}>
                {marketLabel} ·{" "}
                <span style={{ color: c.amber, fontWeight: 700 }}>{result.sideLabel}</span>
                {(marketChoice === "matches" || marketChoice === "overunder") && (
                  <> · Digit {result.digit}</>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: c.surfaceAlt }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${result.confidence}%`, background: c.green }}
                  />
                </div>
                <span className="text-xs font-bold font-mono" style={{ color: c.green }}>
                  {result.confidence}%
                </span>
              </div>
            </div>
          )}

          <button
            onClick={startScan}
            disabled={scanning}
            className="w-full h-12 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 mb-2.5"
            style={{
              background: scanning ? c.elevated : "linear-gradient(90deg, #7C3AED, #4F46E5)",
              color: scanning ? c.textDim : "#fff",
            }}
          >
            {scanning ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Deep Scanning…
              </>
            ) : (
              <>
                <Search size={15} /> {result ? "Scan Again" : "Deep Scan for Best Market"}
              </>
            )}
          </button>

          <button
            onClick={() => result && onLoadMarket(result, marketChoice)}
            disabled={!result || scanning}
            className="w-full h-12 rounded-2xl text-sm font-bold"
            style={{
              background: result && !scanning ? c.amber : c.elevated,
              color: result && !scanning ? "#181205" : c.textFaint,
              cursor: result && !scanning ? "pointer" : "not-allowed",
            }}
          >
            Load This Market
          </button>
        </div>
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
  const [zoomPoints, setZoomPoints] = useState(20);
  const [historicalView, setHistoricalView] = useState(false);
  const [chartType, setChartType] = useState("area"); // "area" | "candles"
  const [indicators, setIndicators] = useState([]); // [{ id, type, params }]
  const [indicatorsModalOpen, setIndicatorsModalOpen] = useState(false);
  const [indicatorsTab, setIndicatorsTab] = useState("current"); // "current" | "all"
  const [editingIndicatorId, setEditingIndicatorId] = useState(null);

  function addIndicator(type) {
    const def = INDICATOR_CATALOG.find((d) => d.type === type);
    if (!def) return;
    const id = `${type}_${Date.now()}`;
    setIndicators((prev) => [...prev, { id, type, params: { ...def.defaultParams } }]);
    setEditingIndicatorId(id);
    setIndicatorsTab("current");
  }
  function removeIndicator(id) {
    setIndicators((prev) => prev.filter((i) => i.id !== id));
    if (editingIndicatorId === id) setEditingIndicatorId(null);
  }
  function updateIndicatorParams(id, params) {
    setIndicators((prev) => prev.map((i) => (i.id === id ? { ...i, params } : i)));
  }
  function clearAllIndicators() {
    setIndicators([]);
    setEditingIndicatorId(null);
  }
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
  const [nowClock, setNowClock] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNowClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const [flash, setFlash] = useState(null);
  const [digitStats, setDigitStats] = useState(INITIAL_DIGIT_STATS);
  const [tradeInFlight, setTradeInFlight] = useState(false);
  const [resultAlert, setResultAlert] = useState(null); // { type: "win" | "loss" | "error", title, message }
  const [notifications, setNotifications] = useState([]);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [aiScannerOpen, setAiScannerOpen] = useState(false);

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
  const [tickingDigit, setTickingDigit] = useState(null); // digit currently flashing while a trade resolves
  const tickIntervalRef = useRef(null);
  const [revealedResult, setRevealedResult] = useState(null); // { digit, won } shown briefly after resolving

  useEffect(() => {
    return () => clearInterval(tickIntervalRef.current);
  }, []);

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

  function handleLoadScannedMarket(result, marketChoice) {
    if (autoRunning) return;
    switchSymbol(result.symbol.id);
    setActiveTab(marketChoice);
    if (marketChoice !== "evenodd") setSelectedDigit(result.digit);
    setAiScannerOpen(false);
    setView("trade");
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
    }, 1000);
    return () => clearInterval(id);
  }, [symbol.base, symbol.vol]);

  // rotate the last-digit probabilities to feel live, in step with the tick feed
  useEffect(() => {
    const id = setInterval(() => {
      setDigitStats((prev) => rotateDigitStats(prev));
    }, 1800);
    return () => clearInterval(id);
  }, []);

  const visibleData = useMemo(
    () => (historicalView ? data : data.slice(-zoomPoints)),
    [data, zoomPoints, historicalView]
  );

  // One candle per tick (the feed already ticks every 1s — see the
  // setInterval above), matching how a real 1-second chart on
  // TradingView forms: a brand new candle every second, not a batch
  // every few seconds. Each candle's open is the previous tick's price
  // and its close is the current tick's price, so the sequence of
  // candles traces the same path the line/area view shows — just as
  // discrete OHLC bars instead of one continuous line.
  const candleData = useMemo(() => {
    const candles = [];
    for (let i = 1; i < visibleData.length; i++) {
      const open = visibleData[i - 1].price;
      const close = visibleData[i].price;
      const high = Math.max(open, close);
      const low = Math.min(open, close);
      candles.push({ time: visibleData[i].time, open, close, high, low, highLow: [low, high] });
    }
    return candles;
  }, [visibleData]);

  // Overlay indicators (EMA/SMA/Bollinger) computed against whichever
  // price series the active chart type is actually displaying, then
  // merged onto that same array so they can be drawn as extra <Line>
  // elements sharing the chart's existing x-axis — no separate chart
  // needed for these, matching how they render directly on price on
  // every real trading platform.
  const overlayIndicators = indicators.filter((i) => INDICATOR_CATALOG.find((d) => d.type === i.type)?.overlay);
  const oscillatorIndicators = indicators.filter((i) => !INDICATOR_CATALOG.find((d) => d.type === i.type)?.overlay);

  const chartDataWithOverlays = useMemo(() => {
    const base = chartType === "candles" ? candleData : visibleData;
    if (!overlayIndicators.length) return base;
    const closeAccessor = chartType === "candles" ? (d) => d.close : (d) => d.price;
    const closes = base.map(closeAccessor);
    const seriesById = {};
    overlayIndicators.forEach((ind) => {
      if (ind.type === "ema") seriesById[ind.id] = { [ind.id]: computeEMA(closes, ind.params.period) };
      else if (ind.type === "sma") seriesById[ind.id] = { [ind.id]: computeSMA(closes, ind.params.period) };
      else if (ind.type === "bollinger") {
        const { mid, upper, lower } = computeBollinger(closes, ind.params.period, ind.params.stdDev);
        seriesById[ind.id] = { [`${ind.id}_mid`]: mid, [`${ind.id}_upper`]: upper, [`${ind.id}_lower`]: lower };
      }
    });
    return base.map((row, i) => {
      const extra = {};
      Object.values(seriesById).forEach((keyed) => {
        Object.entries(keyed).forEach(([key, arr]) => {
          extra[key] = arr[i];
        });
      });
      return { ...row, ...extra };
    });
  }, [chartType, candleData, visibleData, overlayIndicators]);

  // Oscillator panels (RSI/MACD) always compute off the raw tick feed,
  // regardless of chart type — they're about momentum over time, not
  // tied to candle bucketing.
  const oscillatorData = useMemo(() => {
    if (!oscillatorIndicators.length) return [];
    const closes = visibleData.map((d) => d.price);
    return visibleData.map((row, i) => {
      const extra = { time: row.time };
      oscillatorIndicators.forEach((ind) => {
        if (ind.type === "rsi") {
          extra[`${ind.id}`] = computeRSI(closes, ind.params.period)[i];
        } else if (ind.type === "macd") {
          const { macdLine, signalLine, histogram } = computeMACD(closes, ind.params.fast, ind.params.slow, ind.params.signal);
          extra[`${ind.id}_macd`] = macdLine[i];
          extra[`${ind.id}_signal`] = signalLine[i];
          extra[`${ind.id}_hist`] = histogram[i];
        }
      });
      return extra;
    });
  }, [visibleData, oscillatorIndicators]);

  const currentPrice = data[data.length - 1].price;
  const changePct = useMemo(() => {
    const open = openingPriceRef.current;
    return ((currentPrice - open) / open) * 100;
  }, [currentPrice]);
  const isUp = changePct >= 0;
  const trendColor = isUp ? c.green : c.red;

  // Real payout rates, fetched from the backend so admin-configured
  // per-instrument/per-side overrides (PayoutRate) are actually visible
  // here BEFORE a trade is placed — not just applied silently server-side
  // after the fact. Falls back to the same odds-based side defaults the
  // backend uses (see DEFAULT_SIDE_RATES in routes/trades.js) while
  // loading/on error, so Match and Differ never look identical here even
  // before the fetch resolves.
  const [payoutRates, setPayoutRates] = useState({
    defaultRate: 1.952,
    sideDefaults: { matches: 9.5, differs: 1.056, even: 1.95, odd: 1.95 },
    overUnderRates: { over: {}, under: {} },
    rates: {},
  });
  useEffect(() => {
    backendApi("/api/trades/payout-rates")
      .then(setPayoutRates)
      .catch(() => {}); // keep the default on failure — never block trading
  }, []);

  function currentPayoutRate(forSide, digit = selectedDigit) {
    const symbolOverride = payoutRates.rates?.[symbolId]?.[forSide];
    if (symbolOverride !== undefined && symbolOverride !== null) return Number(symbolOverride);

    if (forSide === "over" || forSide === "under") {
      const digitRate = payoutRates.overUnderRates?.[forSide]?.[digit];
      if (digitRate !== undefined && digitRate !== null) return Number(digitRate);

      // Fallback for an older backend response: same 5% house-edge formula.
      const d = Number(digit);
      const probability = forSide === "over" ? (9 - d) / 10 : d / 10;
      if (Number.isInteger(d) && probability > 0 && probability <= 1) {
        return Number(((1 / probability) * 0.95).toFixed(4));
      }
      return null;
    }

    return Number(payoutRates.sideDefaults?.[forSide] ?? payoutRates.defaultRate);
  }

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

  const leftRate = currentPayoutRate(market.left.key);
  const rightRate = currentPayoutRate(market.right.key);
  const leftPayout = leftRate == null ? null : (stake * leftRate).toFixed(2);
  const rightPayout = rightRate == null ? null : (stake * rightRate).toFixed(2);
  const payoutRate = leftRate;
  const payout = leftPayout ?? "0.00";

  const isInvalidOverUnder = (side) =>
    activeTab === "overunder" &&
    ((side === "over" && selectedDigit === 9) || (side === "under" && selectedDigit === 0));

  async function openPosition(side, marketSnapshot, digitSnapshot, stakeAmt) {
    if (
      activeTab === "overunder" &&
      ((side === "over" && digitSnapshot === 9) || (side === "under" && digitSnapshot === 0))
    ) {
      throw new Error(
        side === "over"
          ? "Over 9 is not a valid contract — no digit is ever greater than 9."
          : "Under 0 is not a valid contract — no digit is ever less than 0."
      );
    }

    const marketLabel =
      activeTab === "matches" ? "Matches/Differs" : activeTab === "evenodd" ? "Even/Odd" : "Over/Under";
    const sideLabel = side === marketSnapshot.left.key ? marketSnapshot.left.label : marketSnapshot.right.label;

    const { tradeId, balance: newBalance, payout: confirmedPayout } = await backendApi("/api/trades", {
      method: "POST",
      body: JSON.stringify({
        accountType,
        symbolLabel: symbol.label,
        symbolId,
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
      symbolId,
      market: activeTab,
      marketLabel,
      side,
      sideLabel,
      digit: digitSnapshot,
      stake: stakeAmt,
      // Use the amount the backend actually recorded/paid for, not a
      // client-side recompute — this is the one place it truly matters,
      // since it's what settles the trade.
      payout:
         confirmedPayout ??
         (currentPayoutRate(side, digitSnapshot) == null
           ? 0
           : Number((stakeAmt * currentPayoutRate(side, digitSnapshot)).toFixed(2))),
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

    // Start a random "spinning tick" highlight across the digit row while
    // we wait for the result — cleared and replaced by the reveal color
    // (green/red) the moment the real result comes back.
    setRevealedResult(null);
    clearInterval(tickIntervalRef.current);
    tickIntervalRef.current = setInterval(() => {
      setTickingDigit(Math.floor(Math.random() * 10));
    }, 120);

    window.setTimeout(async () => {
      let result;
      try {
        result = await backendApi(`/api/trades/${id}/resolve`, { method: "PATCH" });
      } catch (err) {
        clearInterval(tickIntervalRef.current);
        setTickingDigit(null);
        runningRef.current = false;
        setAutoRunning(false);
        setStopRequested(false);
        setTradeInFlight(false);
        setResultAlert({ type: "error", title: "Couldn't resolve trade", message: err.message });
        return;
      }

      const { won, resultDigit, payout: payoutAmt, balance: newBalance } = result;
      clearInterval(tickIntervalRef.current);
      setTickingDigit(null);
      setRevealedResult({ digit: resultDigit, won });
      window.setTimeout(() => setRevealedResult((r) => (r?.digit === resultDigit ? null : r)), 1800);

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

    if (isInvalidOverUnder(side)) {
      setResultAlert({
        type: "error",
        title: "Invalid contract",
        message: side === "over"
          ? "Over 9 is unavailable because no digit can be greater than 9."
          : "Under 0 is unavailable because no digit can be less than 0.",
      });
      return;
    }

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

  function loadScannedMarket(result, marketChoice) {
    if (autoRunning) return; // don't yank the market out from under a live session
    switchSymbol(result.symbol.id);
    setActiveTab(marketChoice);
    if (marketChoice !== "evenodd") setSelectedDigit(result.digit);
    setAiScannerOpen(false);
    setView("trade");
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
              className="relative rounded-3xl border overflow-hidden mb-4"
              style={{ background: c.bg, borderColor: c.border, boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}
            >
              {/* Floating instrument header, overlaid on the chart itself */}
              <div className="absolute top-3 left-3 right-3 z-10 flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <button
                      onClick={() => !autoRunning && setSymbolMenuOpen((v) => !v)}
                      disabled={autoRunning}
                      className="flex items-center gap-2 rounded-2xl pl-2.5 pr-3 py-2"
                      style={{
                        background: "rgba(16,20,29,0.82)",
                        border: `1px solid ${c.border}`,
                        backdropFilter: "blur(6px)",
                        cursor: autoRunning ? "not-allowed" : "pointer",
                      }}
                    >
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: c.amberDim }}
                      >
                        <BarChart3 size={13} style={{ color: c.amber }} />
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold">{symbol.label}</span>
                          <ChevronDown size={12} style={{ color: c.textFaint }} />
                        </div>
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="text-[11px] font-bold" style={{ color: c.text }}>
                            {currentPrice.toFixed(2)}
                          </span>
                          <span
                            className="flex items-center text-[10px] font-bold"
                            style={{ color: trendColor }}
                          >
                            {isUp ? "+" : ""}
                            {changePct.toFixed(2)}%
                          </span>
                        </div>
                      </div>
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
                  </div>

                  <button
                    onClick={() => setHistoricalView((v) => !v)}
                    className="h-8 px-3 rounded-2xl text-[11px] font-bold flex-shrink-0"
                    style={{
                      background: historicalView ? "linear-gradient(90deg, #F6465D, #EC4899)" : "rgba(16,20,29,0.82)",
                      color: historicalView ? "#fff" : c.textDim,
                      border: `1px solid ${historicalView ? "transparent" : c.border}`,
                    }}
                  >
                    Historical View
                  </button>

                  <div
                    className="flex items-center gap-0.5 h-8 px-0.5 rounded-2xl flex-shrink-0"
                    style={{ background: "rgba(16,20,29,0.82)", border: `1px solid ${c.border}` }}
                  >
                    <button
                      onClick={() => setChartType("area")}
                      aria-label="Line chart"
                      className="h-7 w-7 rounded-xl flex items-center justify-center transition"
                      style={{ background: chartType === "area" ? c.amber : "transparent" }}
                    >
                      <LineChartIcon size={14} style={{ color: chartType === "area" ? "#181205" : c.textDim }} />
                    </button>
                    <button
                      onClick={() => setChartType("candles")}
                      aria-label="Candlestick chart"
                      className="h-7 w-7 rounded-xl flex items-center justify-center transition"
                      style={{ background: chartType === "candles" ? c.amber : "transparent" }}
                    >
                      <CandlestickChartIcon size={14} style={{ color: chartType === "candles" ? "#181205" : c.textDim }} />
                    </button>
                  </div>

                  <button
                    onClick={() => setIndicatorsModalOpen(true)}
                    aria-label="Indicators"
                    className="h-8 w-8 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: indicators.length ? c.amberDim : "rgba(16,20,29,0.82)",
                      border: `1px solid ${indicators.length ? c.amber : c.border}`,
                    }}
                  >
                    <Layers size={14} style={{ color: indicators.length ? c.amber : c.textDim }} />
                  </button>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span
                    className="h-8 px-3 rounded-2xl text-[11px] font-bold flex items-center"
                    style={{ background: "rgba(16,20,29,0.82)", border: `1px solid ${c.border}`, color: c.textDim }}
                  >
                    {Math.round((zoomPoints / 100) * 100)}%
                  </span>
                  <button
                    onClick={() => setZoomPoints((z) => Math.min(data.length, z + 10))}
                    className="flex items-center justify-center w-8 h-8 rounded-xl"
                    style={{ background: "rgba(16,20,29,0.82)", border: `1px solid ${c.border}` }}
                    aria-label="Zoom out"
                  >
                    <Minus size={14} style={{ color: c.textDim }} />
                  </button>
                  <button
                    onClick={() => setZoomPoints((z) => Math.max(15, z - 10))}
                    className="flex items-center justify-center w-8 h-8 rounded-xl"
                    style={{ background: "rgba(16,20,29,0.82)", border: `1px solid ${c.border}` }}
                    aria-label="Zoom in"
                  >
                    <Plus size={14} style={{ color: c.textDim }} />
                  </button>
                </div>
              </div>

              {activeTab === "evenodd" && (
                <div className="absolute top-14 left-0 right-0 z-10 flex items-baseline justify-center pointer-events-none select-none">
                  <span
                    className="font-bold tabular-nums tracking-tight"
                    style={{ fontSize: 28, color: c.text, textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}
                  >
                    {currentPrice.toFixed(2).slice(0, -1)}
                  </span>
                  <span
                    className="font-bold tabular-nums tracking-tight"
                    style={{ fontSize: 44, color: c.amber, textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}
                  >
                    {currentPrice.toFixed(2).slice(-1)}
                  </span>
                </div>
              )}

              <div className="h-[420px] sm:h-[480px] w-full pt-16 pb-1 px-1 sm:px-2">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === "candles" ? (
                    <ComposedChart data={chartDataWithOverlays} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal vertical />
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
                        tickFormatter={(v) => v.toFixed(2)}
                      />
                      <ReferenceLine
                        y={currentPrice}
                        stroke={c.textFaint}
                        strokeDasharray="4 4"
                        strokeOpacity={0.6}
                        label={<CurrentPriceLabel value={currentPrice} color={trendColor} />}
                      />
                      <Bar dataKey="highLow" shape={<Candle />} isAnimationActive={false} />
                      {overlayIndicators.map((ind, idx) => {
                        const color = INDICATOR_COLORS[idx % INDICATOR_COLORS.length];
                        if (ind.type === "bollinger") {
                          return (
                            <React.Fragment key={ind.id}>
                              <Line type="monotone" dataKey={`${ind.id}_upper`} stroke={color} strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} connectNulls />
                              <Line type="monotone" dataKey={`${ind.id}_mid`} stroke={color} strokeWidth={1.25} dot={false} isAnimationActive={false} connectNulls />
                              <Line type="monotone" dataKey={`${ind.id}_lower`} stroke={color} strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} connectNulls />
                            </React.Fragment>
                          );
                        }
                        return (
                          <Line key={ind.id} type="monotone" dataKey={ind.id} stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
                        );
                      })}
                    </ComposedChart>
                  ) : (
                    <AreaChart data={chartDataWithOverlays} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#E9ECF2" stopOpacity={0.16} />
                          <stop offset="100%" stopColor="#E9ECF2" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal vertical />
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
                        tickFormatter={(v) => v.toFixed(2)}
                      />
                      <ReferenceLine
                        y={currentPrice}
                        stroke={c.textFaint}
                        strokeDasharray="4 4"
                        strokeOpacity={0.6}
                        label={<CurrentPriceLabel value={currentPrice} color={trendColor} />}
                      />
                      <Area
                        type="monotone"
                        dataKey="price"
                        stroke="#E9ECF2"
                        strokeWidth={1.75}
                        fill="url(#priceFill)"
                        dot={false}
                        isAnimationActive={false}
                      />
                      {overlayIndicators.map((ind, idx) => {
                        const color = INDICATOR_COLORS[idx % INDICATOR_COLORS.length];
                        if (ind.type === "bollinger") {
                          return (
                            <React.Fragment key={ind.id}>
                              <Line type="monotone" dataKey={`${ind.id}_upper`} stroke={color} strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} connectNulls />
                              <Line type="monotone" dataKey={`${ind.id}_mid`} stroke={color} strokeWidth={1.25} dot={false} isAnimationActive={false} connectNulls />
                              <Line type="monotone" dataKey={`${ind.id}_lower`} stroke={color} strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} connectNulls />
                            </React.Fragment>
                          );
                        }
                        return (
                          <Line key={ind.id} type="monotone" dataKey={ind.id} stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
                        );
                      })}
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>

              {oscillatorIndicators.map((ind, idx) => (
                <OscillatorPanel
                  key={ind.id}
                  indicator={ind}
                  data={oscillatorData}
                  color={INDICATOR_COLORS[(overlayIndicators.length + idx) % INDICATOR_COLORS.length]}
                  onRemove={() => removeIndicator(ind.id)}
                  onEdit={() => {
                    setEditingIndicatorId(ind.id);
                    setIndicatorsModalOpen(true);
                    setIndicatorsTab("current");
                  }}
                />
              ))}
            </div>

            <IndicatorsModal
              open={indicatorsModalOpen}
              onClose={() => setIndicatorsModalOpen(false)}
              indicators={indicators}
              tab={indicatorsTab}
              setTab={setIndicatorsTab}
              editingId={editingIndicatorId}
              setEditingId={setEditingIndicatorId}
              onAdd={addIndicator}
              onRemove={removeIndicator}
              onUpdateParams={updateIndicatorParams}
              onClearAll={clearAllIndicators}
            />

            <div className="flex items-center justify-center gap-1.5 mb-4 -mt-1">
              <Clock size={12} style={{ color: c.textFaint }} />
              <span className="text-[11px] font-mono font-semibold" style={{ color: c.textFaint }}>
                {nowClock.toLocaleTimeString([], { hour12: false })}
              </span>
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
                  const isTicking = tickingDigit === digit;
                  const isRevealed = revealedResult?.digit === digit;
                  const revealColor = isRevealed ? (revealedResult.won ? c.green : c.red) : null;
                  // The persistent prediction marker (ring + triangle) is
                  // distinct from the transient ticking/reveal states so
                  // they never visually collide.
                  const showSelectionMark = selected && interactive && !isTicking && !revealColor;
                  return (
                    <button
                      key={digit}
                      onClick={() => interactive && setSelectedDigit(digit)}
                      disabled={!interactive}
                      className="flex-shrink-0 flex flex-col items-center gap-1"
                      style={{ cursor: interactive ? "pointer" : "default" }}
                    >
                      <span
                        className="flex items-center justify-center rounded-full font-bold text-base transition-all"
                        style={{
                          width: 46,
                          height: 46,
                          background: revealColor ? revealColor : isTicking ? c.amber : c.elevated,
                          color: revealColor || isTicking ? "#181205" : c.text,
                          border: `2px solid ${
                            revealColor || (isTicking ? c.amber : showSelectionMark ? c.amber : c.border)
                          }`,
                          boxShadow: isTicking
                            ? `0 0 10px ${c.amber}`
                            : revealColor
                            ? `0 0 20px 2px ${revealColor}`
                            : "none",
                          transform: isTicking || revealColor ? "scale(1.08)" : "scale(1)",
                        }}
                      >
                        {digit}
                      </span>
                      <span
                        style={{
                          width: 0,
                          height: 0,
                          borderLeft: "4px solid transparent",
                          borderRight: "4px solid transparent",
                          borderTop: `5px solid ${showSelectionMark ? c.amber : "transparent"}`,
                        }}
                      />
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
                    <span className="text-sm font-bold font-mono text-white mt-1">
                      ${runningSide === market.left.key ? leftPayout : rightPayout}
                    </span>
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
                    disabled={tradeInFlight || isInvalidOverUnder(market.left.key)}
                    className="flex flex-col items-center justify-center rounded-2xl py-5 transition"
                    style={{
                      background: `linear-gradient(135deg, ${c.green}, #0EA96B)`,
                      boxShadow:
                        flash === market.left.key ? `0 0 0 3px ${c.green}` : "0 10px 24px rgba(22,199,132,0.3)",
                      transform: flash === market.left.key ? "scale(0.97)" : "scale(1)",
                      opacity: tradeInFlight || isInvalidOverUnder(market.left.key) ? 0.45 : 1,
                      cursor: tradeInFlight || isInvalidOverUnder(market.left.key) ? "not-allowed" : "pointer",
                    }}
                  >
                    <span className="text-lg font-extrabold text-white">{market.left.label}</span>
                    <span className="text-xs font-semibold text-white/85 mt-1">{market.left.hint}</span>
                    <span className="text-xs font-bold font-mono text-white mt-1">
                       {leftRate == null ? "Unavailable" : `${leftRate.toFixed(2)}× payout`}
                     </span>
                     <span className="text-sm font-bold font-mono text-white mt-0.5">
                       {leftPayout == null ? "—" : `$${leftPayout}`}
                     </span>
                  </button>
                  <button
                    onClick={() => handleTradeButtonClick(market.right.key)}
                    disabled={tradeInFlight || isInvalidOverUnder(market.right.key)}
                    className="flex flex-col items-center justify-center rounded-2xl py-5 transition"
                    style={{
                      background: `linear-gradient(135deg, ${c.red}, #D8283F)`,
                      boxShadow:
                        flash === market.right.key ? `0 0 0 3px ${c.red}` : "0 10px 24px rgba(246,70,93,0.3)",
                      transform: flash === market.right.key ? "scale(0.97)" : "scale(1)",
                      opacity: tradeInFlight || isInvalidOverUnder(market.right.key) ? 0.45 : 1,
                      cursor: tradeInFlight || isInvalidOverUnder(market.right.key) ? "not-allowed" : "pointer",
                    }}
                  >
                    <span className="text-lg font-extrabold text-white">{market.right.label}</span>
                    <span className="text-xs font-semibold text-white/85 mt-1">{market.right.hint}</span>
                    <span className="text-xs font-bold font-mono text-white mt-1">
                       {rightRate == null ? "Unavailable" : `${rightRate.toFixed(2)}× payout`}
                     </span>
                     <span className="text-sm font-bold font-mono text-white mt-0.5">
                       {rightPayout == null ? "—" : `$${rightPayout}`}
                     </span>
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
              onClick={() => (id === "ai" ? setAiScannerOpen(true) : setView(id))}
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

      {/* ================= AI ENTRY SCANNER ================= */}
      {aiScannerOpen && (
        <AIScannerModal
          onClose={() => setAiScannerOpen(false)}
          onLoadMarket={handleLoadScannedMarket}
        />
      )}

      {/* ================= AI ENTRY SCANNER ================= */}
      {aiScannerOpen && (
        <AIScannerModal onClose={() => setAiScannerOpen(false)} onLoadMarket={loadScannedMarket} />
      )}

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

// ---------------------------------------------------------------------------
// LANDING PAGE — marketing home shown before login/signup. All primary CTAs
// (Get Started, Start Trading Now, Create Free Account, Try Demo) route into
// signup; "Log in" routes into login. Try Demo also goes through signup
// because a demo balance in this app lives on the user's account record —
// there's no anonymous demo mode to drop into.
// ---------------------------------------------------------------------------
const LANDING_FEATURES = [
  { icon: Zap, tint: "#FF8A3D", tintBg: "rgba(255,138,61,0.14)", title: "Lightning Execution", desc: "Sub-second trade execution powered by our global infrastructure" },
  { icon: Shield, tint: c.green, tintBg: c.greenDim, title: "Bank-Grade Security", desc: "Your funds protected with enterprise encryption and cold storage" },
  { icon: Layers, tint: "#A78BFA", tintBg: "rgba(167,139,250,0.14)", title: "100+ Markets", desc: "Forex, crypto, stocks, indices, and commodities — all in one place" },
  { icon: Wallet, tint: "#FB7185", tintBg: "rgba(251,113,133,0.14)", title: "Zero Fees", desc: "No hidden charges on deposits, withdrawals, or account maintenance" },
  { icon: Headphones, tint: c.green, tintBg: c.greenDim, title: "24/7 Live Support", desc: "Expert help whenever you need it" },
];

const LANDING_STATS = [
  { icon: Users, value: "1M+", label: "Active Traders" },
  { icon: BarChart3, value: "$50M+", label: "Daily Volume" },
  { icon: Globe, value: "100+", label: "Trading Assets" },
  { icon: Headphones, value: "24/7", label: "Live Support" },
];

const LANDING_STEPS = [
  { n: "01", icon: Users, title: "Create Account", desc: "Sign up in 30 seconds. No lengthy forms, no ID required to start." },
  { n: "02", icon: Zap, title: "Fund & Trade", desc: "Deposit from $1 with 20+ payment methods. Pick an asset and direction." },
  { n: "03", icon: Wallet, title: "Collect Profits", desc: "Withdraw anytime. Payouts processed within minutes, not days." },
];

const LANDING_MARKET_POINTS = [
  { icon: Clock, title: "Real-Time Prices", desc: "Live market data with zero delay" },
  { icon: CreditCard, title: "20+ Payment Methods", desc: "Crypto, cards, bank transfer, e-wallets" },
  { icon: Award, title: "Up to 950% Returns", desc: "Industry-leading payout rates" },
];

const LANDING_TESTIMONIALS = [
  { initials: "AM", flag: "🇺🇸", name: "Alex M.", role: "Day Trader", quote: "The execution speed is incredible. I switched from my old platform and never looked back." },
  { initials: "SK", flag: "🇬🇧", name: "Sarah K.", role: "Forex Trader", quote: "From crypto to forex, everything I need in one place. The charts are superb." },
  { initials: "MR", flag: "🇨🇦", name: "Mike R.", role: "Beginner", quote: "Demo account helped me learn risk-free. Now I trade with real confidence." },
  { initials: "EL", flag: "🇦🇺", name: "Emma L.", role: "Crypto Trader", quote: "BTC and ETH options with great payouts. This platform delivers." },
  { initials: "JW", flag: "🇩🇪", name: "James W.", role: "Professional", quote: "10 years trading and this is the best platform I have ever used." },
  { initials: "LT", flag: "🇫🇷", name: "Lisa T.", role: "Part-time", quote: "Perfect for spare-time trading. Clean mobile experience." },
];

function LandingBadge({ children }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide px-3 py-1.5 rounded-full uppercase"
      style={{ background: c.amberDim, color: c.amber }}
    >
      {children}
    </span>
  );
}

function LandingSectionHeader({ badge, title, subtitle, align = "center" }) {
  return (
    <div className={`flex flex-col gap-3 mb-8 ${align === "center" ? "items-center text-center" : "items-start text-left"}`}>
      <LandingBadge>{badge}</LandingBadge>
      <h2 className="text-2xl font-extrabold leading-tight">{title}</h2>
      {subtitle && (
        <p className="text-sm max-w-md" style={{ color: c.textDim }}>{subtitle}</p>
      )}
    </div>
  );
}

function LandingScreen({ onGetStarted, onLogin, onTryDemo }) {
  return (
    <div className="min-h-screen w-full font-sans" style={{ background: c.bg, color: c.text }}>
      {/* Sticky header */}
      <div
        className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 h-16 border-b backdrop-blur"
        style={{ background: "rgba(11,14,20,0.85)", borderColor: c.border }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${c.amber}, #FF8A3D)` }}
          >
            <TrendingUp size={17} style={{ color: "#181205" }} />
          </div>
          <span className="text-base font-extrabold tracking-tight">PrimeVest</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onLogin}
            className="text-sm font-semibold px-3.5 py-2 rounded-xl"
            style={{ color: c.text }}
          >
            Log in
          </button>
          <button
            onClick={onGetStarted}
            className="text-sm font-bold px-4 py-2 rounded-xl"
            style={{ background: c.amber, color: "#181205" }}
          >
            Get Started
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="px-4 sm:px-6 pt-10 pb-12 flex flex-col items-center text-center">
        <span
          className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-6"
          style={{ background: c.greenDim, color: c.green }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.green }} />
          Live trading — 1M+ active traders
        </span>
        <h1 className="text-[2.4rem] leading-[1.05] font-extrabold mb-4 max-w-md">
          Trade Smarter.
          <br />
          <span style={{ color: c.amber }}>Profit Faster.</span>
        </h1>
        <p className="text-sm max-w-sm mb-8" style={{ color: c.textDim }}>
          Access 100+ global markets with lightning-fast execution, institutional-grade tools, and payouts up to 950%. Start with just $10.
        </p>

        <div className="w-full max-w-sm flex flex-col gap-3 mb-10">
          <button
            onClick={onGetStarted}
            className="h-13 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ height: 52, background: c.amber, color: "#181205" }}
          >
            Start Trading Now
            <ArrowRight size={16} />
          </button>
          <button
            onClick={onTryDemo}
            className="h-13 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 border"
            style={{ height: 52, borderColor: c.borderStrong, color: c.text }}
          >
            Try Free Demo
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3 w-full max-w-md mb-10">
          {[
            { v: "$1", l: "Min. Deposit" },
            { v: "$0.10", l: "Min. Trade" },
            { v: "950%", l: "Max. Payout", accent: true },
            { v: "<1s", l: "Execution" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <div className="text-lg font-extrabold" style={{ color: s.accent ? c.green : c.text }}>{s.v}</div>
              <div className="text-[10px]" style={{ color: c.textFaint }}>{s.l}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2.5 w-full max-w-lg">
          {[
            { sym: "BTC/USD", price: "$43,256.78", chg: "+2.34%", up: true, bg: "#F7931A" },
            { sym: "ETH/USD", price: "$2,284.50", chg: "+1.87%", up: true, bg: "#A78BFA" },
            { sym: "EUR/USD", price: "1.0842", chg: "-0.12%", up: false, bg: c.surfaceAlt },
          ].map((t) => (
            <div key={t.sym} className="rounded-xl border p-2.5 text-left" style={{ background: c.surface, borderColor: c.border }}>
              <div className="text-[11px] font-bold mb-1">{t.sym}</div>
              <div className="text-xs font-mono mb-0.5">{t.price}</div>
              <span className="text-[10px] font-bold" style={{ color: t.up ? c.green : c.red }}>{t.chg}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Why PrimeVest */}
      <div className="px-4 sm:px-6 py-12" style={{ borderTop: `1px solid ${c.border}` }}>
        <LandingSectionHeader badge="Why PrimeVest" title="Built for serious traders" />
        <div className="flex flex-col gap-3 max-w-lg mx-auto">
          {LANDING_FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border p-4" style={{ background: c.surface, borderColor: c.border }}>
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                style={{ background: f.tintBg }}
              >
                <f.icon size={20} style={{ color: f.tint }} />
              </div>
              <div className="text-sm font-bold mb-1">{f.title}</div>
              <div className="text-xs" style={{ color: c.textDim }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Live demo trade card */}
      <div className="px-4 sm:px-6 pb-12">
        <div className="rounded-2xl border p-4 max-w-lg mx-auto" style={{ background: c.surface, borderColor: c.border }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#F7931A" }}>
                <span className="text-sm font-bold text-white">₿</span>
              </div>
              <div>
                <div className="text-sm font-bold leading-tight">BTC/USD</div>
                <div className="text-[11px]" style={{ color: c.textFaint }}>Bitcoin</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold font-mono">$43,256.78</div>
              <div className="text-xs font-bold" style={{ color: c.green }}>+2.34%</div>
            </div>
          </div>
          <div
            className="h-32 rounded-xl mb-4 relative overflow-hidden flex items-end"
            style={{ background: "linear-gradient(180deg, rgba(22,199,132,0.16), rgba(22,199,132,0))" }}
          >
            <span
              className="absolute top-2 right-2.5 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: "rgba(0,0,0,0.4)", color: c.green }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.green }} /> LIVE
            </span>
            <svg viewBox="0 0 300 100" className="w-full h-full" preserveAspectRatio="none">
              <polyline
                points="0,85 40,70 70,72 100,55 130,58 160,40 190,38 220,25 250,22 300,5"
                fill="none"
                stroke={c.green}
                strokeWidth="2.5"
              />
            </svg>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={onTryDemo}
              className="flex-1 h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5"
              style={{ background: c.green, color: "#04140C" }}
            >
              <TrendingUp size={16} /> UP <span className="opacity-80">+95%</span>
            </button>
            <button
              onClick={onTryDemo}
              className="flex-1 h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5"
              style={{ background: c.red, color: "#fff" }}
            >
              <TrendingDown size={16} /> DOWN <span className="opacity-80">+95%</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="px-4 sm:px-6 pb-12">
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
          {LANDING_STATS.map((s) => (
            <div key={s.label} className="rounded-2xl border p-4 text-center" style={{ background: c.surface, borderColor: c.border }}>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                style={{ background: c.greenDim }}
              >
                <s.icon size={18} style={{ color: c.green }} />
              </div>
              <div className="text-xl font-extrabold">{s.value}</div>
              <div className="text-[11px]" style={{ color: c.textDim }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Testimonials */}
      <div className="px-4 sm:px-6 py-12" style={{ borderTop: `1px solid ${c.border}` }}>
        <LandingSectionHeader badge="Testimonials" title="Trusted by traders worldwide" />
        <div className="flex flex-col gap-3 max-w-lg mx-auto mb-6">
          {LANDING_TESTIMONIALS.map((t) => (
            <div key={t.name} className="rounded-2xl border p-4" style={{ background: c.surface, borderColor: c.border }}>
              <div className="flex gap-0.5 mb-2.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} fill={c.amber} style={{ color: c.amber }} />
                ))}
              </div>
              <p className="text-sm mb-3" style={{ color: c.text }}>&quot;{t.quote}&quot;</p>
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: c.greenDim, color: c.green }}
                >
                  {t.initials}
                </div>
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">{t.name} <span>{t.flag}</span></div>
                  <div className="text-[11px]" style={{ color: c.textFaint }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center text-sm" style={{ color: c.textDim }}>
          <span className="font-bold" style={{ color: c.green }}>4.9/5</span> from{" "}
          <span className="font-bold" style={{ color: c.text }}>50,000+</span> reviews
        </div>
      </div>

      {/* Three steps */}
      <div className="px-4 sm:px-6 py-12" style={{ borderTop: `1px solid ${c.border}` }}>
        <LandingSectionHeader badge="Getting Started" title="Three steps to your first trade" />
        <div className="flex flex-col gap-3 max-w-lg mx-auto">
          {LANDING_STEPS.map((s) => (
            <div key={s.n} className="relative rounded-2xl border p-4 overflow-hidden" style={{ background: c.surface, borderColor: c.border }}>
              <span
                className="absolute -top-1 right-3 text-5xl font-extrabold select-none"
                style={{ color: c.borderStrong, opacity: 0.5 }}
              >
                {s.n}
              </span>
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 relative"
                style={{ background: c.greenDim }}
              >
                <s.icon size={20} style={{ color: c.green }} />
              </div>
              <div className="text-sm font-bold mb-1 relative">{s.title}</div>
              <div className="text-xs relative" style={{ color: c.textDim }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Trade global markets */}
      <div className="px-4 sm:px-6 py-12" style={{ borderTop: `1px solid ${c.border}` }}>
        <LandingSectionHeader
          badge="Markets"
          title="Trade global markets from one account"
          subtitle="Access forex, cryptocurrencies, stocks, indices, and commodities — all with competitive spreads and instant execution."
        />
        <div className="flex flex-col gap-3 max-w-lg mx-auto">
          {LANDING_MARKET_POINTS.map((m) => (
            <div key={m.title} className="flex items-center gap-3 rounded-2xl border p-3.5" style={{ background: c.surface, borderColor: c.border }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: c.greenDim }}>
                <m.icon size={18} style={{ color: c.green }} />
              </div>
              <div>
                <div className="text-sm font-bold">{m.title}</div>
                <div className="text-xs" style={{ color: c.textDim }}>{m.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Final CTA */}
      <div className="px-4 sm:px-6 py-14 text-center" style={{ borderTop: `1px solid ${c.border}` }}>
        <h2 className="text-2xl font-extrabold mb-3 max-w-sm mx-auto">Ready to start trading?</h2>
        <p className="text-sm mb-8 max-w-sm mx-auto" style={{ color: c.textDim }}>
          Join over 1 million traders. Create your free account in seconds and start with a risk-free demo.
        </p>
        <div className="w-full max-w-sm mx-auto flex flex-col gap-3">
          <button
            onClick={onGetStarted}
            className="h-13 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ height: 52, background: c.amber, color: "#181205" }}
          >
            Create Free Account
            <ArrowRight size={16} />
          </button>
          <button
            onClick={onTryDemo}
            className="h-13 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 border"
            style={{ height: 52, borderColor: c.borderStrong, color: c.text }}
          >
            Try Demo
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 sm:px-6 py-10 text-center" style={{ borderTop: `1px solid ${c.border}` }}>
        <div className="flex items-center justify-center gap-2 mb-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${c.amber}, #FF8A3D)` }}
          >
            <TrendingUp size={15} style={{ color: "#181205" }} />
          </div>
          <span className="text-sm font-extrabold">PrimeVest</span>
        </div>
        <p className="text-xs mb-4" style={{ color: c.textFaint }}>© 2026 PrimeVest. All rights reserved.</p>
        <div className="flex items-center justify-center gap-4 text-xs" style={{ color: c.textDim }}>
          <button className="underline underline-offset-2">Privacy</button>
          <button className="underline underline-offset-2">Terms</button>
          <button className="underline underline-offset-2">Responsible Trading</button>
        </div>
      </div>
    </div>
  );
}


function AuthScreen({ onAuth, authError, clearAuthError, initialMode }) {
  const [mode, setMode] = useState(initialMode === "signup" ? "signup" : "login"); // "login" | "signup"
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [remember, setRemember] = useState(true);
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  });

  const [showForgot, setShowForgot] = useState(false);

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
    if (mode === "signup" && !isValidPhoneNumber(form.phone))
      e.phone = "Enter a valid phone number (Kenyan or with country code, e.g. +1 415 555 0100)";
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
    await onAuth?.({
      mode,
      name: form.name,
      email: form.email,
      phone: mode === "signup" ? toInternationalPhone(form.phone) : undefined,
      password: form.password,
      remember,
    });
    setSubmitting(false);
  }

  const inputStyle = {
    color: c.text,
    background: "transparent",
  };

  if (showForgot) {
    return <ForgotPasswordScreen onBack={() => setShowForgot(false)} />;
  }

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

            {mode === "signup" && (
              <div>
                <Field icon={Smartphone} error={errors.phone}>
                  <input
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    onBlur={() => setForm((f) => (f.phone ? { ...f, phone: toInternationalPhone(f.phone) } : f))}
                    placeholder="Phone number"
                    type="tel"
                    autoComplete="tel"
                    className="flex-1 outline-none text-sm"
                    style={inputStyle}
                  />
                </Field>
                {!errors.phone && (
                  <p className="text-[11px] mt-1.5 px-1" style={{ color: c.textFaint }}>
                    Kenyan number? Just type it normally (07XX XXX XXX). Outside Kenya, include your country code (e.g. +1, +44).
                  </p>
                )}
              </div>
            )}

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
                  onClick={() => setShowForgot(true)}
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
// Forgot password — phone -> SMS OTP -> new password, three steps against
// the backend's /api/auth/forgot-password, /verify-reset-otp, /reset-password.
// ---------------------------------------------------------------------------
function ForgotPasswordScreen({ onBack }) {
  const [step, setStep] = useState("phone"); // phone | otp | newpass | done
  const [channel, setChannel] = useState("sms"); // "sms" | "email"
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const destination = channel === "email" ? email.trim().toLowerCase() : toInternationalPhone(phone);

  async function requestOtp(ev) {
    ev.preventDefault();
    setError("");
    if (channel === "email") {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address");
    } else {
      if (!isValidPhoneNumber(phone)) return setError("Enter a valid phone number, including country code if you're outside Kenya");
    }
    setSubmitting(true);
    try {
      await backendApi("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(channel === "email" ? { email: destination } : { phone: destination }),
      });
      setStep("otp");
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyOtp(ev) {
    ev.preventDefault();
    setError("");
    if (otp.trim().length !== 6) return setError("Enter the 6-digit code");
    setSubmitting(true);
    try {
      const data = await backendApi("/api/auth/verify-reset-otp", {
        method: "POST",
        body: JSON.stringify(
          channel === "email" ? { email: destination, otp: otp.trim() } : { phone: destination, otp: otp.trim() }
        ),
      });
      setResetToken(data.resetToken);
      setStep("newpass");
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function resetPassword(ev) {
    ev.preventDefault();
    setError("");
    if (newPassword.length < 8) return setError("Use at least 8 characters");
    if (newPassword !== confirm) return setError("Passwords don't match");
    setSubmitting(true);
    try {
      await backendApi("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ resetToken, newPassword }),
      });
      setStep("done");
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = { color: c.text, background: "transparent" };

  return (
    <div className="min-h-screen w-full font-sans flex items-center justify-center px-6" style={{ background: c.bg, color: c.text }}>
      <div className="w-full max-w-sm">
        {step !== "done" && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium mb-8"
            style={{ color: c.textDim }}
          >
            <ArrowLeft size={16} /> Back to login
          </button>
        )}

        {step === "phone" && (
          <form onSubmit={requestOtp}>
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-5" style={{ background: c.amberDim }}>
              {channel === "email" ? <Mail size={20} style={{ color: c.amber }} /> : <Smartphone size={20} style={{ color: c.amber }} />}
            </div>
            <h1 className="text-xl font-bold mb-1.5">Reset your password</h1>
            <p className="text-sm mb-5" style={{ color: c.textDim }}>
              {channel === "email"
                ? "Enter the email on your account. We'll send a 6-digit code to it."
                : "Enter the phone number on your account. We'll text a 6-digit code to it."}
            </p>

            <div className="flex items-center rounded-full p-1 mb-5" style={{ background: c.surfaceAlt }}>
              <button
                type="button"
                onClick={() => { setChannel("sms"); setError(""); }}
                className="flex-1 h-9 rounded-full text-xs font-bold transition-colors"
                style={{ background: channel === "sms" ? c.amber : "transparent", color: channel === "sms" ? "#181205" : c.textDim }}
              >
                Phone (SMS)
              </button>
              <button
                type="button"
                onClick={() => { setChannel("email"); setError(""); }}
                className="flex-1 h-9 rounded-full text-xs font-bold transition-colors"
                style={{ background: channel === "email" ? c.amber : "transparent", color: channel === "email" ? "#181205" : c.textDim }}
              >
                Email
              </button>
            </div>

            {channel === "email" ? (
              <Field icon={Mail} error={error}>
                <input
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  placeholder="Email address"
                  type="email"
                  autoComplete="email"
                  className="flex-1 outline-none text-sm"
                  style={inputStyle}
                />
              </Field>
            ) : (
              <Field icon={Smartphone} error={error}>
                <input
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setError(""); }}
                  placeholder="Phone number"
                  type="tel"
                  autoComplete="tel"
                  className="flex-1 outline-none text-sm"
                  style={inputStyle}
                />
              </Field>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-13 rounded-2xl font-semibold text-sm mt-5 flex items-center justify-center gap-2"
              style={{ height: 52, background: c.amber, color: "#181205", opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              Send reset code
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={verifyOtp}>
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-5" style={{ background: c.amberDim }}>
              <ShieldCheck size={20} style={{ color: c.amber }} />
            </div>
            <h1 className="text-xl font-bold mb-1.5">Enter the code</h1>
            <p className="text-sm mb-6" style={{ color: c.textDim }}>
              We sent a 6-digit code to <span style={{ color: c.text }}>{destination}</span>.
            </p>
            <Field icon={ShieldCheck} error={error}>
              <input
                value={otp}
                onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                placeholder="6-digit code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="flex-1 outline-none text-sm tracking-[0.3em]"
                style={inputStyle}
              />
            </Field>
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-13 rounded-2xl font-semibold text-sm mt-5 flex items-center justify-center gap-2"
              style={{ height: 52, background: c.amber, color: "#181205", opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              Verify code
            </button>
            <button
              type="button"
              onClick={() => setStep("phone")}
              className="w-full text-xs font-semibold mt-4"
              style={{ color: c.textDim }}
            >
              {channel === "email" ? "Wrong email? Start over" : "Wrong number? Start over"}
            </button>
          </form>
        )}

        {step === "newpass" && (
          <form onSubmit={resetPassword}>
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-5" style={{ background: c.amberDim }}>
              <Lock size={20} style={{ color: c.amber }} />
            </div>
            <h1 className="text-xl font-bold mb-1.5">Set a new password</h1>
            <p className="text-sm mb-6" style={{ color: c.textDim }}>
              Choose a new password for your account.
            </p>
            <div className="flex flex-col gap-3.5">
              <Field icon={Lock} error={error}>
                <input
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                  placeholder="New password"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  className="flex-1 outline-none text-sm"
                  style={inputStyle}
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"}>
                  {showPw ? <EyeOff size={17} style={{ color: c.textFaint }} /> : <Eye size={17} style={{ color: c.textFaint }} />}
                </button>
              </Field>
              <Field icon={Lock}>
                <input
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                  placeholder="Confirm new password"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  className="flex-1 outline-none text-sm"
                  style={inputStyle}
                />
              </Field>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-13 rounded-2xl font-semibold text-sm mt-5 flex items-center justify-center gap-2"
              style={{ height: 52, background: c.amber, color: "#181205", opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              Reset password
            </button>
          </form>
        )}

        {step === "done" && (
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 mx-auto" style={{ background: c.greenDim }}>
              <CheckCircle2 size={26} style={{ color: c.green }} />
            </div>
            <h1 className="text-xl font-bold mb-1.5">Password reset</h1>
            <p className="text-sm mb-8" style={{ color: c.textDim }}>
              Your password has been changed. Log in with your new password.
            </p>
            <button
              type="button"
              onClick={onBack}
              className="w-full h-13 rounded-2xl font-semibold text-sm"
              style={{ height: 52, background: c.amber, color: "#181205" }}
            >
              Back to login
            </button>
          </div>
        )}
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

// General, non-Kenya-locked phone handling for account-level fields
// (signup, password reset, Settings) — this app has users outside Kenya
// too, and M-Pesa is only one of several deposit/withdraw rails.
// Mirrors the backend's normalizePhoneInternational exactly so what the
// user sees validated here is what the server will actually accept.
function toInternationalPhone(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) {
    const digits = trimmed.replace(/[^\d]/g, "");
    return "+" + digits;
  }
  const kenyan = toMsisdn254(trimmed);
  return kenyan;
}

function isValidPhoneNumber(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("+")) {
    const digits = trimmed.replace(/[^\d]/g, "");
    return digits.length >= 8 && digits.length <= 15;
  }
  return isValidKenyanNumber(trimmed);
}

// ---------------------------------------------------------------------------
// DEPOSIT — M-Pesa STK Push
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Shared payment-method picker — M-Pesa vs USDT (TRC20), used by both
// Deposit and Withdraw before showing the method-specific form.
// ---------------------------------------------------------------------------
function PaymentMethodPicker({ onPick }) {
  return (
    <div className="flex-1 flex justify-center px-4 sm:px-6 py-8">
      <div className="w-full max-w-[420px] flex flex-col gap-3">
        <div className="text-xs font-semibold mb-1" style={{ color: c.textDim }}>
          Choose a method
        </div>
        <button
          onClick={() => onPick("mpesa")}
          className="flex items-center gap-3 rounded-2xl border p-4 text-left"
          style={{ background: c.surface, borderColor: c.border }}
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(22,199,132,0.14)" }}
          >
            <Smartphone size={20} style={{ color: c.green }} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold">M-Pesa</div>
            <div className="text-xs" style={{ color: c.textDim }}>Instant mobile money</div>
          </div>
          <ChevronRight size={18} style={{ color: c.textFaint }} />
        </button>
        <button
          onClick={() => onPick("usdt")}
          className="flex items-center gap-3 rounded-2xl border p-4 text-left"
          style={{ background: c.surface, borderColor: c.border }}
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: c.amberDim }}
          >
            <Coins size={20} style={{ color: c.amber }} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold">USDT (TRC20)</div>
            <div className="text-xs" style={{ color: c.textDim }}>Cryptocurrency</div>
          </div>
          <ChevronRight size={18} style={{ color: c.textFaint }} />
        </button>
      </div>
    </div>
  );
}

function DepositScreen({ onBack, onComplete, onBalanceSet, onAddPayment }) {
  const [method, setMethod] = useState(null); // null | "mpesa" | "usdt"
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

  if (!method) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: c.bg, color: c.text }}>
        <MoneyHeader title="Deposit" onBack={onBack} />
        <PaymentMethodPicker onPick={setMethod} />
      </div>
    );
  }

  if (method === "usdt") {
    return (
      <DepositCryptoScreen
        onBack={() => setMethod(null)}
        onComplete={onComplete}
        onAddPayment={onAddPayment}
      />
    );
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
      <MoneyHeader title="Deposit" onBack={() => setMethod(null)} />
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
// DEPOSIT — USDT (TRC20)
// ---------------------------------------------------------------------------
function DepositCryptoScreen({ onBack, onComplete, onAddPayment }) {
  const [address, setAddress] = useState("");
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [configError, setConfigError] = useState("");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState("form"); // form | submitted
  const [reference, setReference] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await backendApi("/api/payments/config");
        if (!cancelled) setAddress(data.usdtTrc20Address || "");
      } catch (err) {
        if (!cancelled) setConfigError(err.message || "Couldn't load the deposit address");
      } finally {
        if (!cancelled) setLoadingConfig(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API can be blocked in some in-app browsers — the address
      // is still selectable/visible, so this just silently no-ops.
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError("Enter the amount you sent");
      return;
    }
    setSubmitting(true);
    try {
      const data = await backendApi("/api/payments/deposit/crypto", {
        method: "POST",
        body: JSON.stringify({ amountUsd: amt, txHash: txHash.trim() }),
      });
      setReference(data.reference);
      onAddPayment?.({
        id: data.reference,
        type: "deposit",
        method: "usdt_trc20",
        amount: Math.round(amt * 129), // display-only estimate; server holds the authoritative KES figure
        usdAmount: amt,
        status: "pending",
        time: Date.now(),
      });
      setStage("submitted");
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (stage === "submitted") {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: c.bg, color: c.text }}>
        <MoneyHeader title="Deposit" onBack={onBack} />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
            style={{ background: c.amberDim }}
          >
            <Loader2 size={26} style={{ color: c.amber }} />
          </div>
          <h2 className="text-lg font-bold mb-2">Deposit submitted</h2>
          <p className="text-sm max-w-xs mb-2" style={{ color: c.textDim }}>
            We're watching for your transfer of{" "}
            <span className="font-semibold" style={{ color: c.text }}>${Number(amount).toFixed(2)} USDT</span>.
            Your Real balance updates once we confirm it on-chain — usually within a few minutes.
          </p>
          <p className="text-xs font-mono mb-8" style={{ color: c.textFaint }}>Reference: {reference}</p>
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
          <div className="rounded-2xl border p-4" style={{ background: c.surface, borderColor: c.border }}>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: c.amberDim }}
              >
                <Coins size={20} style={{ color: c.amber }} />
              </div>
              <div>
                <div className="text-sm font-bold">Deposit USDT</div>
                <div className="text-xs" style={{ color: c.textDim }}>TRC20 network</div>
              </div>
            </div>
            <p className="text-xs mb-3" style={{ color: c.textDim }}>
              Send only <span className="font-semibold" style={{ color: c.text }}>USDT (TRC20)</span> to the
              address below. Sending any other token or network may result in permanent loss.
            </p>
            <div className="text-[11px] font-semibold mb-1" style={{ color: c.textFaint }}>
              DEPOSIT ADDRESS
            </div>
            {loadingConfig ? (
              <div className="flex items-center gap-2 text-xs" style={{ color: c.textDim }}>
                <Loader2 size={14} className="animate-spin" /> Loading address…
              </div>
            ) : configError ? (
              <div className="text-xs font-medium" style={{ color: c.red }}>{configError}</div>
            ) : (
              <div
                className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
                style={{ background: c.bg, borderColor: c.borderStrong }}
              >
                <span className="flex-1 text-sm font-mono break-all" style={{ color: c.text }}>{address}</span>
                <button
                  type="button"
                  onClick={copyAddress}
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: c.surfaceAlt }}
                  aria-label="Copy address"
                >
                  {copied ? <Check size={15} style={{ color: c.green }} /> : <Copy size={15} style={{ color: c.textDim }} />}
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: c.textDim }}>
              Amount sent (USD)
            </label>
            <div
              className="flex items-center gap-2 h-13 rounded-2xl border px-4"
              style={{ height: 52, background: c.bg, borderColor: error ? c.red : c.borderStrong }}
            >
              <span className="text-sm font-bold" style={{ color: c.textDim }}>$</span>
              <input
                value={amount}
                onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, "")); setError(""); }}
                placeholder="0.00"
                inputMode="decimal"
                className="flex-1 outline-none text-sm bg-transparent font-semibold"
                style={{ color: c.text }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: c.textDim }}>
              Transaction hash <span className="font-normal" style={{ color: c.textFaint }}>(optional, speeds up confirmation)</span>
            </label>
            <Field icon={Info}>
              <input
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="0x…"
                className="flex-1 outline-none text-sm bg-transparent"
                style={{ color: c.text }}
              />
            </Field>
          </div>

          {error && <div className="text-xs font-medium -mt-2" style={{ color: c.red }}>{error}</div>}

          <button
            type="submit"
            disabled={submitting || loadingConfig || !address}
            className="h-13 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 mt-1"
            style={{ height: 52, background: c.amber, color: "#181205", opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            I've sent it
          </button>

          <div className="flex items-center gap-2 justify-center text-xs text-center" style={{ color: c.textFaint }}>
            <ShieldCheck size={13} />
            Your balance updates after we manually confirm the transfer
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WITHDRAW — M-Pesa or USDT (TRC20)
// ---------------------------------------------------------------------------
function WithdrawScreen({ onBack, onComplete, balance, onBalanceSet, onAddPayment, registeredPhone }) {
  const [method, setMethod] = useState(null); // null | "mpesa" | "usdt"
  const [amount, setAmount] = useState("");
  const [error, setError] = useState({});
  const [stage, setStage] = useState("form"); // form | processing | success | failed
  const [reference, setReference] = useState("");
  const [apiError, setApiError] = useState("");
  const [kesAmount, setKesAmount] = useState(0);
  const [phones, setPhones] = useState(registeredPhone ? [registeredPhone] : []);
  const [selectedPhone, setSelectedPhone] = useState(registeredPhone || "");
  const [loadingPhones, setLoadingPhones] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await backendApi("/api/payments/verified-phones");
        if (cancelled) return;
        const list = data.phones?.length ? data.phones : (registeredPhone ? [registeredPhone] : []);
        setPhones(list);
        setSelectedPhone((prev) => (prev && list.includes(prev) ? prev : list[0] || ""));
      } catch {
        // Fall back to just the registered number — withdrawal still works,
        // it just won't offer the extra deposit-verified numbers.
      } finally {
        if (!cancelled) setLoadingPhones(false);
      }
    })();
    return () => { cancelled = true; };
  }, [registeredPhone]);

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!selectedPhone) {
      errs.amount = "Add a phone number to your account in Settings before withdrawing";
    }
    const amt = Number(amount);
    if (!amt || amt < 1) errs.amount = "Minimum withdrawal is $1";
    else if (balance <= 0) errs.amount = "Insufficient balance";
    else if (amt > balance) errs.amount = "Insufficient balance for this amount";
    setError(errs);
    if (Object.keys(errs).length) return;

    setStage("processing");
    try {
      const data = await backendApi("/api/payments/withdraw", {
        method: "POST",
        body: JSON.stringify({ amountUsd: amt, phone: selectedPhone }),
      });
      setReference(data.reference);
      setKesAmount(data.amountKes);
      onBalanceSet?.(data.balance);
      onAddPayment?.({
        id: data.reference,
        type: "withdrawal",
        amount: data.amountKes,
        usdAmount: amt,
        phone: selectedPhone,
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

  if (!method) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: c.bg, color: c.text }}>
        <MoneyHeader title="Withdraw" onBack={onBack} />
        <PaymentMethodPicker onPick={setMethod} />
      </div>
    );
  }

  if (method === "usdt") {
    return (
      <WithdrawCryptoScreen
        onBack={() => setMethod(null)}
        onComplete={onComplete}
        balance={balance}
        onBalanceSet={onBalanceSet}
        onAddPayment={onAddPayment}
      />
    );
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
            <span style={{ color: c.text }}>{selectedPhone}</span>
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
            ) to {selectedPhone} has been received. Our team will process this manually and disburse the funds
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
      <MoneyHeader title="Withdraw" onBack={() => setMethod(null)} />
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
            {loadingPhones ? (
              <div
                className="flex items-center gap-2 h-13 rounded-2xl border px-4"
                style={{ height: 52, background: c.surfaceAlt, borderColor: c.border, color: c.textDim }}
              >
                <Loader2 size={15} className="animate-spin" />
                <span className="text-xs">Loading your verified numbers…</span>
              </div>
            ) : phones.length > 0 ? (
              <div className="flex flex-col gap-2">
                {phones.map((p) => {
                  const isSelected = p === selectedPhone;
                  const isRegistered = p === registeredPhone;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSelectedPhone(p)}
                      className="flex items-center gap-2.5 h-13 rounded-2xl border px-4 text-left"
                      style={{
                        height: 52,
                        background: isSelected ? c.amberDim : c.surfaceAlt,
                        borderColor: isSelected ? c.amber : c.border,
                      }}
                    >
                      <div
                        className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                        style={{ borderColor: isSelected ? c.amber : c.borderStrong }}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full" style={{ background: c.amber }} />}
                      </div>
                      <Smartphone size={17} style={{ color: c.textFaint, flexShrink: 0 }} />
                      <span className="flex-1 text-sm" style={{ color: c.text }}>{p}</span>
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{
                          background: isRegistered ? c.amberDim : c.greenDim,
                          color: isRegistered ? c.amber : c.green,
                        }}
                      >
                        {isRegistered ? "Registered" : "Verified deposit"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div
                className="flex items-center gap-2.5 rounded-2xl border px-4 py-3"
                style={{ background: c.redDim, borderColor: c.red }}
              >
                <AlertTriangle size={17} style={{ color: c.red, flexShrink: 0 }} />
                <span className="text-xs" style={{ color: c.text }}>
                  No phone number on file — add one in Settings before withdrawing.
                </span>
              </div>
            )}
            <p className="text-[11px] mt-1.5" style={{ color: c.textFaint }}>
              You can withdraw to your registered number or any number you've made a real deposit from.
            </p>
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
            disabled={!selectedPhone}
            className="h-13 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 mt-1"
            style={{ height: 52, background: c.amber, color: "#181205", opacity: selectedPhone ? 1 : 0.5 }}
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
// WITHDRAW — USDT (TRC20)
// ---------------------------------------------------------------------------
function WithdrawCryptoScreen({ onBack, onComplete, balance, onBalanceSet, onAddPayment }) {
  const [walletAddress, setWalletAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState({});
  const [stage, setStage] = useState("form"); // form | processing | success | failed
  const [reference, setReference] = useState("");
  const [apiError, setApiError] = useState("");

  const TRC20_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!TRC20_RE.test(walletAddress.trim())) errs.walletAddress = "Enter a valid TRC20 (USDT) wallet address";
    const amt = Number(amount);
    if (!amt || amt < 1) errs.amount = "Minimum withdrawal is $1";
    else if (balance <= 0) errs.amount = "Insufficient balance";
    else if (amt > balance) errs.amount = "Insufficient balance for this amount";
    setError(errs);
    if (Object.keys(errs).length) return;

    setStage("processing");
    try {
      const data = await backendApi("/api/payments/withdraw/crypto", {
        method: "POST",
        body: JSON.stringify({ amountUsd: amt, walletAddress: walletAddress.trim() }),
      });
      setReference(data.reference);
      onBalanceSet?.(data.balance);
      onAddPayment?.({
        id: data.reference,
        type: "withdrawal",
        method: "usdt_trc20",
        amount: data.amountKes,
        usdAmount: amt,
        walletAddress: walletAddress.trim(),
        status: "pending",
        time: Date.now(),
      });
      setStage("success");
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
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6" style={{ background: c.redDim }}>
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
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6" style={{ background: c.amberDim }}>
            <Loader2 size={28} style={{ color: c.amber }} className="animate-spin" />
          </div>
          <h2 className="text-lg font-bold mb-2">Submitting your request…</h2>
          <p className="text-sm max-w-xs break-all" style={{ color: c.textDim }}>
            ${Number(amount).toFixed(2)} USDT to <span style={{ color: c.text }}>{walletAddress}</span>
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
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6" style={{ background: "rgba(22,199,132,0.14)" }}>
            <CheckCircle2 size={30} style={{ color: c.green }} />
          </div>
          <h2 className="text-lg font-bold mb-2">Withdrawal submitted successfully</h2>
          <p className="text-sm max-w-xs mb-2 break-all" style={{ color: c.textDim }}>
            Your request to withdraw{" "}
            <span className="font-semibold" style={{ color: c.text }}>${Number(amount).toFixed(2)} USDT</span> to{" "}
            {walletAddress} has been received. Our team will process this manually and disburse the funds shortly.
          </p>
          <p className="text-xs font-mono mb-8" style={{ color: c.textFaint }}>Reference: {reference}</p>
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
          <div className="rounded-2xl border p-4" style={{ background: c.surface, borderColor: c.border }}>
            <div className="text-xs font-semibold mb-1" style={{ color: c.textDim }}>Real account balance</div>
            <div className="text-2xl font-bold font-mono">
              ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: c.textDim }}>
              TRC20 wallet address
            </label>
            <Field icon={Coins} error={error.walletAddress}>
              <input
                value={walletAddress}
                onChange={(e) => { setWalletAddress(e.target.value); setError((er) => ({ ...er, walletAddress: undefined })); }}
                placeholder="T…"
                className="flex-1 outline-none text-sm bg-transparent font-mono"
                style={{ color: c.text }}
              />
            </Field>
            <p className="text-[11px] mt-1.5" style={{ color: c.textFaint }}>
              Double-check this address — sending to the wrong one can't be reversed.
            </p>
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
                onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, "")); setError((er) => ({ ...er, amount: undefined })); }}
                placeholder="0"
                inputMode="decimal"
                className="flex-1 outline-none text-sm bg-transparent font-semibold"
                style={{ color: c.text }}
              />
              <button
                type="button"
                onClick={() => setAmount(String(balance))}
                className="text-xs font-bold"
                style={{ color: c.amber }}
              >
                MAX
              </button>
            </div>
            {error.amount && <div className="text-xs font-medium mb-3" style={{ color: c.red }}>{error.amount}</div>}
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
  const isCrypto = p.method === "usdt_trc20";
  const pending = p.status === "pending";
  const approved = p.status === "approved";
  const rejected = p.status === "rejected";
  const failed = p.status === "failed";
  const completed = p.status === "completed" || p.status === "success";

  const statusLabel = pending ? "Pending" : approved ? "Approved" : rejected ? "Rejected" : failed ? "Failed" : completed ? "Completed" : "";
  const statusColor = pending || approved ? c.amber : rejected || failed ? c.red : c.green;

  const title = isCrypto
    ? (isDeposit ? "USDT deposit" : "Withdrawal to USDT wallet")
    : (isDeposit ? "M-Pesa deposit" : "Withdrawal to M-Pesa");

  const destination = isCrypto
    ? (p.walletAddress ? `${p.walletAddress.slice(0, 6)}…${p.walletAddress.slice(-4)}` : "")
    : p.phone;

  return (
    <div
      className="flex items-center gap-3 rounded-2xl border p-3.5"
      style={{ background: c.surface, borderColor: c.border }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: pending || approved ? c.amberDim : rejected || failed ? c.redDim : isDeposit ? c.greenDim : c.redDim }}
      >
        {isDeposit ? (
          <ArrowDownRight size={18} style={{ color: c.green }} />
        ) : (
          <ArrowUpRight size={18} style={{ color: pending || approved ? c.amber : c.red }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold truncate">
            {title}
          </span>
          <span
            className="text-sm font-bold font-mono flex-shrink-0"
            style={{ color: isDeposit ? c.green : c.amber }}
          >
            {isCrypto
              ? `${isDeposit ? "+" : "-"}$${(p.usdAmount ?? 0).toFixed(2)}`
              : `${isDeposit ? "+" : "-"}KES ${p.amount.toLocaleString()}`}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-xs flex items-center gap-1.5 font-mono" style={{ color: c.textDim }}>
            {destination}
            {statusLabel && (
              <span className="font-semibold font-sans" style={{ color: statusColor }}>
                · {statusLabel}
              </span>
            )}
          </span>
          <span className="text-xs flex-shrink-0 font-mono" style={{ color: c.textFaint }}>
            {isCrypto ? "" : p.usdAmount != null ? `≈ $${p.usdAmount.toFixed(2)} · ` : ""}
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

function KycInput({ label, optional, ...props }) {
  return (
    <div>
      <label className="text-[11px] font-bold tracking-wide mb-1.5 block" style={{ color: c.textDim }}>
        {label} {optional && <span className="font-normal normal-case" style={{ color: c.textFaint }}>(optional)</span>}
      </label>
      <input
        {...props}
        className="w-full h-12 rounded-2xl px-4 text-sm outline-none"
        style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }}
      />
    </div>
  );
}

function KycUploadBox({ label, hint, file, onPick }) {
  const inputRef = useRef(null);
  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full flex flex-col items-center justify-center gap-3 rounded-2xl py-8 px-4"
        style={{
          border: `1.5px dashed ${file ? c.green : c.borderStrong}`,
          background: file ? c.greenDim : "transparent",
        }}
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: c.surfaceAlt }}
        >
          {file ? (
            <Check size={20} style={{ color: c.green }} />
          ) : (
            <Upload size={20} style={{ color: c.textDim }} />
          )}
        </div>
        <div className="text-center">
          <div className="text-sm font-bold">{file ? file.name : label}</div>
          <div className="text-xs mt-0.5" style={{ color: c.textFaint }}>
            {file ? "Tap to replace" : "PDF, JPG, or PNG — max 10MB"}
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0])}
        />
      </button>
      <p className="text-xs italic text-center mt-1.5" style={{ color: c.textFaint }}>{hint}</p>
    </div>
  );
}

function AccountSettingsScreen({ onBack, user, onUpdateUser }) {
  const [open, setOpen] = useState(null);
  const [name, setName] = useState(user?.name || "");
  const [nameSaved, setNameSaved] = useState(false);
  const [phone, setPhone] = useState(user?.phone || "");
  const [phoneSaved, setPhoneSaved] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwSaved, setPwSaved] = useState(false);
  const [idForm, setIdForm] = useState({
    firstName: "",
    lastName: "",
    contactEmail: user?.email || "",
    contactPhone: "",
    middleName: "",
    dateOfBirth: "",
    idType: "National ID",
    idNumber: "",
    issuingCountry: "Kenya",
    addressLine: "",
    city: "",
    stateCounty: "",
    postalCode: "",
    country: "Kenya",
  });
  const [idFiles, setIdFiles] = useState({ idFront: null, idBack: null, selfie: null });
  const [idSubmitting, setIdSubmitting] = useState(false);
  const [idError, setIdError] = useState("");
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

  async function savePhone(e) {
    e.preventDefault();
    if (!isValidPhoneNumber(phone)) {
      setPhoneError("Enter a valid phone number, including country code if you're outside Kenya");
      return;
    }
    setPhoneError("");
    try {
      const { user: updated } = await backendApi("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ phone: toInternationalPhone(phone) }),
      });
      onUpdateUser?.({ phone: updated.phone });
      setPhone(updated.phone);
      setPhoneSaved(true);
      window.setTimeout(() => setPhoneSaved(false), 2000);
    } catch (err) {
      setPhoneError(err.message);
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

  // "off" | "setup" (QR shown, awaiting code) | "on"
  const [twoFactorStage, setTwoFactorStage] = useState(user?.twoFactorEnabled ? "on" : "off");
  const [qrData, setQrData] = useState(null); // { qrCodeDataUrl, secret }
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorError, setTwoFactorError] = useState("");
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [showDisableForm, setShowDisableForm] = useState(false);

  async function startTwoFactorSetup() {
    setTwoFactorError("");
    setTwoFactorBusy(true);
    try {
      const data = await backendApi("/api/auth/me/2fa/setup", { method: "POST" });
      setQrData(data);
      setTwoFactorStage("setup");
    } catch (err) {
      setTwoFactorError(err.message);
    } finally {
      setTwoFactorBusy(false);
    }
  }

  async function confirmTwoFactorSetup(e) {
    e.preventDefault();
    if (!twoFactorCode.trim()) return;
    setTwoFactorError("");
    setTwoFactorBusy(true);
    try {
      const { user: updated } = await backendApi("/api/auth/me/2fa/verify", {
        method: "POST",
        body: JSON.stringify({ code: twoFactorCode.trim() }),
      });
      onUpdateUser?.({ twoFactorEnabled: updated.twoFactorEnabled });
      setTwoFactorStage("on");
      setTwoFactorCode("");
      setQrData(null);
    } catch (err) {
      setTwoFactorError(err.message);
    } finally {
      setTwoFactorBusy(false);
    }
  }

  async function disableTwoFactor(e) {
    e.preventDefault();
    if (!disablePassword.trim()) return;
    setTwoFactorError("");
    setTwoFactorBusy(true);
    try {
      const { user: updated } = await backendApi("/api/auth/me/2fa/disable", {
        method: "POST",
        body: JSON.stringify({ password: disablePassword }),
      });
      onUpdateUser?.({ twoFactorEnabled: updated.twoFactorEnabled });
      setTwoFactorStage("off");
      setDisablePassword("");
      setShowDisableForm(false);
    } catch (err) {
      setTwoFactorError(err.message);
    } finally {
      setTwoFactorBusy(false);
    }
  }

  function cancelTwoFactorSetup() {
    setTwoFactorStage("off");
    setQrData(null);
    setTwoFactorCode("");
    setTwoFactorError("");
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (file.size > 10 * 1024 * 1024) {
        reject(new Error(`${file.name} is over 10MB`));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error(`Couldn't read ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  async function handleFilePick(key, file) {
    if (!file) return;
    setIdError("");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setIdFiles((f) => ({ ...f, [key]: { name: file.name, dataUrl } }));
    } catch (err) {
      setIdError(err.message);
    }
  }

  async function submitIdentity(e) {
    e.preventDefault();
    setIdError("");

    const required = ["firstName", "lastName", "dateOfBirth", "idType", "idNumber", "issuingCountry"];
    const missingField = required.find((k) => !idForm[k]?.trim());
    if (missingField) {
      setIdError("Fill in all required identification fields");
      return;
    }
    if (!idFiles.idFront || !idFiles.idBack || !idFiles.selfie) {
      setIdError("Upload the front and back of your ID and a selfie holding it");
      return;
    }

    setIdSubmitting(true);
    try {
      const { user: updated } = await backendApi("/api/auth/me/verify-identity", {
        method: "POST",
        body: JSON.stringify({
          ...idForm,
          idFront: idFiles.idFront.dataUrl,
          idBack: idFiles.idBack.dataUrl,
          selfie: idFiles.selfie.dataUrl,
        }),
      });
      onUpdateUser?.({ identityStatus: updated.identityStatus });
    } catch (err) {
      setIdError(err.message || "Something went wrong — try again");
    } finally {
      setIdSubmitting(false);
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
            icon={Smartphone}
            label={user?.phone ? "M-Pesa Phone Number" : "Add Phone Number"}
            badge={
              !user?.phone && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: c.redDim, color: c.red }}
                >
                  Required
                </span>
              )
            }
            expanded={open === "phone"}
            onToggle={() => toggle("phone")}
          >
            <form onSubmit={savePhone} className="flex flex-col gap-3">
              {!user?.phone && (
                <p className="text-xs -mt-1" style={{ color: c.textDim }}>
                  Password-reset codes are sent to this number, and Kenyan numbers can also withdraw and deposit via M-Pesa directly. Add it to enable both.
                </p>
              )}
              <Field icon={Smartphone} error={phoneError}>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => setPhone((p) => (p ? toInternationalPhone(p) : p))}
                  placeholder="07XX XXX XXX or +1 415 555 0100"
                  inputMode="tel"
                  className="flex-1 outline-none text-sm bg-transparent"
                  style={{ color: c.text }}
                />
              </Field>
              <button
                type="submit"
                className="h-11 rounded-xl text-sm font-bold"
                style={{ background: c.amber, color: "#181205" }}
              >
                {phoneSaved ? "Saved ✓" : user?.phone ? "Update number" : "Add number"}
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
              twoFactorStage === "on" && (
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
            {twoFactorStage === "off" && (
              <div className="flex flex-col gap-4">
                <div
                  className="flex items-center justify-between rounded-2xl p-4"
                  style={{ background: c.elevated }}
                >
                  <div className="flex items-center gap-3">
                    <Shield size={18} style={{ color: c.textDim }} />
                    <div>
                      <div className="text-sm font-bold">2FA is Disabled</div>
                      <div className="text-xs mt-0.5" style={{ color: c.textDim }}>
                        Enable 2FA for extra security
                      </div>
                    </div>
                  </div>
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.textFaint }} />
                </div>

                <div className="rounded-2xl border p-4" style={{ borderColor: c.border }}>
                  <div className="text-sm font-bold mb-3">How it works:</div>
                  <ol className="flex flex-col gap-2 text-xs" style={{ color: c.textDim }}>
                    <li>1. Download Google Authenticator or any TOTP app</li>
                    <li>2. Scan the QR code or enter the secret key manually</li>
                    <li>3. Enter the 6-digit code from the app to verify</li>
                    <li>4. Each time you login, you'll need to enter a code</li>
                  </ol>
                </div>

                {twoFactorError && (
                  <div className="text-xs font-medium" style={{ color: c.red }}>{twoFactorError}</div>
                )}

                <button
                  onClick={startTwoFactorSetup}
                  disabled={twoFactorBusy}
                  className="h-12 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(90deg, #16C784, #22D98A)", color: "#06210F" }}
                >
                  {twoFactorBusy ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Smartphone size={15} />
                  )}
                  Enable 2FA
                </button>
              </div>
            )}

            {twoFactorStage === "setup" && qrData && (
              <form onSubmit={confirmTwoFactorSetup} className="flex flex-col gap-4">
                <p className="text-sm" style={{ color: c.textDim }}>
                  Scan this QR code with Google Authenticator (or any TOTP app), then enter the
                  6-digit code it shows.
                </p>
                <div className="flex justify-center bg-white rounded-2xl p-4">
                  <img src={qrData.qrCodeDataUrl} alt="2FA QR code" style={{ width: 180, height: 180 }} />
                </div>
                <div>
                  <div className="text-xs font-semibold mb-1" style={{ color: c.textDim }}>
                    Can't scan? Enter this key manually:
                  </div>
                  <div
                    className="text-xs font-mono px-3 py-2 rounded-xl break-all"
                    style={{ background: c.elevated, color: c.text }}
                  >
                    {qrData.secret}
                  </div>
                </div>
                <Field icon={ShieldCheck}>
                  <input
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit code"
                    inputMode="numeric"
                    className="flex-1 outline-none text-sm bg-transparent tracking-widest"
                    style={{ color: c.text }}
                  />
                </Field>
                {twoFactorError && (
                  <div className="text-xs font-medium" style={{ color: c.red }}>{twoFactorError}</div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={cancelTwoFactorSetup}
                    className="flex-1 h-11 rounded-xl text-sm font-bold"
                    style={{ background: c.surfaceAlt, color: c.textDim, border: `1px solid ${c.border}` }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={twoFactorBusy || twoFactorCode.length !== 6}
                    className="flex-1 h-11 rounded-xl text-sm font-bold"
                    style={{ background: c.green, color: "#06210F", opacity: twoFactorBusy ? 0.7 : 1 }}
                  >
                    {twoFactorBusy ? "Verifying…" : "Verify & Enable"}
                  </button>
                </div>
              </form>
            )}

            {twoFactorStage === "on" && (
              <div className="flex flex-col gap-4">
                <div
                  className="flex items-center gap-3 rounded-2xl p-4"
                  style={{ background: c.greenDim }}
                >
                  <Check size={18} style={{ color: c.green }} />
                  <div>
                    <div className="text-sm font-bold">2FA is enabled</div>
                    <div className="text-xs mt-0.5" style={{ color: c.textDim }}>
                      You'll be asked for a code from your app every time you log in
                    </div>
                  </div>
                </div>

                {!showDisableForm ? (
                  <button
                    onClick={() => setShowDisableForm(true)}
                    className="h-11 rounded-xl text-sm font-bold"
                    style={{ background: c.redDim, color: c.red }}
                  >
                    Disable 2FA
                  </button>
                ) : (
                  <form onSubmit={disableTwoFactor} className="flex flex-col gap-3">
                    <p className="text-xs" style={{ color: c.textDim }}>
                      Enter your password to confirm disabling 2FA.
                    </p>
                    <Field icon={Lock}>
                      <input
                        type="password"
                        value={disablePassword}
                        onChange={(e) => setDisablePassword(e.target.value)}
                        placeholder="Password"
                        className="flex-1 outline-none text-sm bg-transparent"
                        style={{ color: c.text }}
                      />
                    </Field>
                    {twoFactorError && (
                      <div className="text-xs font-medium" style={{ color: c.red }}>{twoFactorError}</div>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowDisableForm(false);
                          setDisablePassword("");
                          setTwoFactorError("");
                        }}
                        className="flex-1 h-11 rounded-xl text-sm font-bold"
                        style={{ background: c.surfaceAlt, color: c.textDim, border: `1px solid ${c.border}` }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={twoFactorBusy}
                        className="flex-1 h-11 rounded-xl text-sm font-bold"
                        style={{ background: c.red, color: "#fff", opacity: twoFactorBusy ? 0.7 : 1 }}
                      >
                        {twoFactorBusy ? "Disabling…" : "Confirm Disable"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
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
              <form onSubmit={submitIdentity} className="flex flex-col gap-5">
                <div>
                  <div className="text-xs font-bold tracking-wide mb-2" style={{ color: c.textDim }}>
                    FULL LEGAL NAME
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <KycInput
                      label="First Name"
                      value={idForm.firstName}
                      onChange={(e) => setIdForm((f) => ({ ...f, firstName: e.target.value }))}
                      placeholder="First Name"
                    />
                    <KycInput
                      label="Last Name"
                      value={idForm.lastName}
                      onChange={(e) => setIdForm((f) => ({ ...f, lastName: e.target.value }))}
                      placeholder="Last Name"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold tracking-wide mb-2" style={{ color: c.green }}>
                    CONTACT
                  </div>
                  <div className="flex flex-col gap-3">
                    <KycInput
                      label="Email"
                      type="email"
                      value={idForm.contactEmail}
                      onChange={(e) => setIdForm((f) => ({ ...f, contactEmail: e.target.value }))}
                      placeholder="Email address"
                    />
                    <KycInput
                      label="Phone"
                      value={idForm.contactPhone}
                      onChange={(e) => setIdForm((f) => ({ ...f, contactPhone: e.target.value }))}
                      placeholder="07xx xxx xxx"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold tracking-wide mb-2" style={{ color: c.green }}>
                    IDENTIFICATION
                  </div>
                  <div className="flex flex-col gap-3">
                    <KycInput
                      label="Middle Name"
                      optional
                      value={idForm.middleName}
                      onChange={(e) => setIdForm((f) => ({ ...f, middleName: e.target.value }))}
                      placeholder="Middle name as on ID"
                    />
                    <KycInput
                      label="Date of Birth"
                      type="date"
                      value={idForm.dateOfBirth}
                      onChange={(e) => setIdForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                    />
                    <div>
                      <label className="text-[11px] font-bold tracking-wide mb-1.5 block" style={{ color: c.textDim }}>
                        ID TYPE
                      </label>
                      <select
                        value={idForm.idType}
                        onChange={(e) => setIdForm((f) => ({ ...f, idType: e.target.value }))}
                        className="w-full h-12 rounded-2xl px-4 text-sm outline-none font-semibold"
                        style={{ background: c.surfaceAlt, border: `1px solid ${c.border}`, color: c.text }}
                      >
                        <option>National ID</option>
                        <option>Passport</option>
                        <option>Driver's License</option>
                        <option>Military ID</option>
                      </select>
                    </div>
                    <KycInput
                      label="ID Number"
                      value={idForm.idNumber}
                      onChange={(e) => setIdForm((f) => ({ ...f, idNumber: e.target.value }))}
                      placeholder="As shown on document"
                    />
                    <KycInput
                      label="Issuing Country"
                      value={idForm.issuingCountry}
                      onChange={(e) => setIdForm((f) => ({ ...f, issuingCountry: e.target.value }))}
                      placeholder="Kenya"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold tracking-wide mb-2" style={{ color: c.green }}>
                    ADDRESS <span className="font-normal normal-case" style={{ color: c.textFaint }}>(optional)</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    <KycInput
                      label="Address Line"
                      value={idForm.addressLine}
                      onChange={(e) => setIdForm((f) => ({ ...f, addressLine: e.target.value }))}
                      placeholder="Street, estate, building"
                    />
                    <KycInput
                      label="City"
                      value={idForm.city}
                      onChange={(e) => setIdForm((f) => ({ ...f, city: e.target.value }))}
                      placeholder="Nairobi"
                    />
                    <KycInput
                      label="State / County"
                      value={idForm.stateCounty}
                      onChange={(e) => setIdForm((f) => ({ ...f, stateCounty: e.target.value }))}
                      placeholder="County"
                    />
                    <KycInput
                      label="Postal Code"
                      value={idForm.postalCode}
                      onChange={(e) => setIdForm((f) => ({ ...f, postalCode: e.target.value }))}
                      placeholder="00100"
                    />
                    <KycInput
                      label="Country"
                      value={idForm.country}
                      onChange={(e) => setIdForm((f) => ({ ...f, country: e.target.value }))}
                      placeholder="Kenya"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold tracking-wide mb-2" style={{ color: c.green }}>
                    DOCUMENTS REQUIRED
                  </div>
                  <div className="flex flex-col gap-4">
                    <KycUploadBox
                      label="Upload ID / Passport (Front)"
                      hint="Upload a clear photo or scan of the front"
                      file={idFiles.idFront}
                      onPick={(file) => handleFilePick("idFront", file)}
                    />
                    <KycUploadBox
                      label="Upload ID / Passport (Back)"
                      hint="Upload a clear photo or scan of the back"
                      file={idFiles.idBack}
                      onPick={(file) => handleFilePick("idBack", file)}
                    />
                    <KycUploadBox
                      label="Selfie holding your ID"
                      hint="A photo of you holding the document for verification"
                      file={idFiles.selfie}
                      onPick={(file) => handleFilePick("selfie", file)}
                    />
                  </div>
                </div>

                {idError && (
                  <div className="text-xs font-medium text-center" style={{ color: c.red }}>{idError}</div>
                )}

                <button
                  type="submit"
                  disabled={idSubmitting}
                  className="h-13 rounded-2xl text-sm font-bold"
                  style={{ height: 52, background: c.green, color: "#06210F", opacity: idSubmitting ? 0.7 : 1 }}
                >
                  {idSubmitting ? "Submitting…" : "Submit Documents for Verification"}
                </button>
                <p className="text-xs text-center" style={{ color: c.textFaint }}>
                  By clicking submit, you agree to our Terms of Service and Privacy Policy.
                </p>
              </form>
            )}
          </SettingsRow>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TWO-FACTOR LOGIN CHALLENGE — shown only after a correct password, and only
// for accounts that have 2FA enabled. Everyone else never sees this screen.
// ---------------------------------------------------------------------------
function TwoFactorChallengeScreen({ onVerify, onCancel }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (code.length !== 6) return;
    setError("");
    setSubmitting(true);
    try {
      await onVerify(code);
    } catch (err) {
      setError(err.message || "Incorrect code — try again");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-5" style={{ background: c.bg, color: c.text }}>
      <div className="w-full max-w-[380px]">
        <div className="flex flex-col items-center text-center mb-7">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: c.amberDim }}
          >
            <Smartphone size={24} style={{ color: c.amber }} />
          </div>
          <h2 className="text-xl font-bold mb-1.5">Two-factor authentication</h2>
          <p className="text-sm" style={{ color: c.textDim }}>
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field icon={ShieldCheck}>
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                setError("");
              }}
              placeholder="6-digit code"
              inputMode="numeric"
              autoFocus
              className="flex-1 outline-none text-sm bg-transparent tracking-widest"
              style={{ color: c.text }}
            />
          </Field>
          {error && (
            <div className="text-xs font-medium text-center" style={{ color: c.red }}>{error}</div>
          )}
          <button
            type="submit"
            disabled={submitting || code.length !== 6}
            className="h-13 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ height: 52, background: c.amber, color: "#181205", opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : "Verify & Log In"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-semibold text-center"
            style={{ color: c.textDim }}
          >
            Back to login
          </button>
        </form>
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
  const [showLanding, setShowLanding] = useState(true);
  const [authMode, setAuthMode] = useState("login"); // "login" | "signup" — set by which landing CTA was tapped
  const [twoFactorChallenge, setTwoFactorChallenge] = useState(null); // { preAuthToken } | null
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

  // Restore a saved session (if any) once, on first load. Render's free
  // tier can take 50+ seconds to wake from idle, so this waits generously
  // before giving up — but it does give up, rather than spinning forever
  // if the backend is genuinely unreachable.
  useEffect(() => {
    (async () => {
      const token = getToken();
      if (token) {
        try {
          const { user: profile } = await Promise.race([
            backendApi("/api/auth/me"),
            new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 45000)),
          ]);
          await loadSession(profile);
          setScreen("dashboard");
        } catch (err) {
          if (err.message !== "timeout") setToken(null); // expired/invalid token — clear it
          // On timeout, leave the token in place: the backend may just be
          // slow to wake, not actually rejecting the session.
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

  async function handleAuth({ mode, name, email, phone, password, remember }) {
    try {
      const data = await backendApi(mode === "signup" ? "/api/auth/signup" : "/api/auth/login", {
        method: "POST",
        body: JSON.stringify(mode === "signup" ? { name, email, phone, password } : { email, password }),
      });
      setAuthError("");

      if (data.requiresTwoFactor) {
        setTwoFactorChallenge({ preAuthToken: data.preAuthToken });
        return;
      }

      setToken(data.token);
      await loadSession(data.user);
      setScreen("dashboard");
    } catch (err) {
      setAuthError(err.message || "Something went wrong");
    }
  }

  async function handleTwoFactorVerify(code) {
    const data = await backendApi("/api/auth/login/2fa", {
      method: "POST",
      body: JSON.stringify({ preAuthToken: twoFactorChallenge.preAuthToken, code }),
    });
    setToken(data.token);
    setTwoFactorChallenge(null);
    await loadSession(data.user);
    setScreen("dashboard");
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

  if (booting) {
    return (
      <div
        className="min-h-screen w-full flex flex-col items-center justify-center gap-4"
        style={{ background: c.bg, color: c.text }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg"
          style={{ background: c.amber, color: "#181205" }}
        >
          P
        </div>
        <Loader2 size={22} className="animate-spin" style={{ color: c.textDim }} />
      </div>
    );
  }

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
        registeredPhone={user?.phone || ""}
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
  if (twoFactorChallenge) {
    return (
      <TwoFactorChallengeScreen
        onVerify={handleTwoFactorVerify}
        onCancel={() => setTwoFactorChallenge(null)}
      />
    );
  }
  if (showLanding) {
    return (
      <LandingScreen
        onGetStarted={() => { setAuthMode("signup"); setShowLanding(false); }}
        onLogin={() => { setAuthMode("login"); setShowLanding(false); }}
        onTryDemo={() => { setAuthMode("signup"); setShowLanding(false); }}
      />
    );
  }
  return (
    <AuthScreen
      onAuth={handleAuth}
      authError={authError}
      clearAuthError={() => setAuthError("")}
      initialMode={authMode}
    />
  );
}
