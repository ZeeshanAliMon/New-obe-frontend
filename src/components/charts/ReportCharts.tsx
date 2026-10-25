import React, { useRef, useState } from 'react';

/*
 * Lightweight, dependency-free charts for the QA reports.
 * Presentation only: every chart takes data that the report already has and
 * never fetches or mutates anything.
 *
 * Palette (validated): series blue #2a78d6, status good/warning/critical,
 * sequential blue ramp for magnitude. Text always uses ink tokens, never series colour.
 */

export const CHART = {
  surface: '#ffffff',
  ink: '#0b0b0b',
  ink2: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  series: '#2a78d6',
  good: '#0ca30c',
  warning: '#fab219',
  critical: '#d03b3b',
  neutral: '#c3c2b7',
};

const SEQ = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281'];
// Ordinal steps (start no lighter than step 250 so the lightest still reads on white)
const ORDINAL = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281', '#0d366b'];

const fmt = (v: number) => `${(Math.round(v * 10) / 10).toFixed(1)}%`;

/* ---------- shared tooltip ---------- */
type Tip = { x: number; y: number; title: string; lines: string[] } | null;

function useTip() {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip>(null);
  const show = (e: React.MouseEvent, title: string, lines: string[]) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, title, lines });
  };
  const hide = () => setTip(null);
  const node = tip ? (
    <div
      className="pointer-events-none absolute z-20 rounded-lg bg-white px-3 py-2 text-[11px] shadow-lg ring-1 ring-black/10 print:hidden"
      style={{ left: Math.min(tip.x + 12, (ref.current?.clientWidth ?? 9999) - 190), top: tip.y + 12, minWidth: 140, maxWidth: 260 }}
    >
      <p className="font-semibold" style={{ color: CHART.ink }}>{tip.title}</p>
      {tip.lines.map((l, i) => <p key={i} style={{ color: CHART.ink2 }}>{l}</p>)}
    </div>
  ) : null;
  return { ref, show, hide, node };
}

/* ---------- card wrapper ---------- */
export function ChartCard({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 break-inside-avoid ${className}`}>
      <p className="text-xs font-bold text-slate-800">{title}</p>
      {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

export const LegendItem: React.FC<{ color: string; label: string }> = ({ color, label }) => {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: CHART.ink2 }}>
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
};

/* ---------- horizontal bar chart (percentages 0–100 with a threshold) ---------- */
export interface HBarItem {
  label: string;        // short label shown on the axis (e.g. GA-1)
  value: number | null; // percentage
  detail?: string;      // full title shown on hover
  pass?: boolean;       // colours the bar; defaults to value >= threshold
  extra?: string[];     // extra tooltip lines
  color?: string;       // explicit bar colour (overrides pass/fail)
  status?: string;      // tooltip status text when colour is explicit
}

export function HBarChart({ items, threshold = 50, max = 100, unit = '%', passLabel = 'At / above threshold', failLabel = 'Below threshold', showThreshold = true, colorByStatus = true, legend }: {
  items: HBarItem[]; threshold?: number; max?: number; unit?: string; passLabel?: string; failLabel?: string; showThreshold?: boolean; colorByStatus?: boolean;
  legend?: { color: string; label: string }[];
}) {
  const t = useTip();
  if (!items.length) return <p className="text-[11px] text-slate-400">No data to chart.</p>;
  const rawTop = Math.max(max, ...items.map(i => i.value ?? 0));
  const top = unit === '%' ? rawTop : Math.max(1, rawTop * 1.08);
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / top) * 100))}%`;
  const ticks = unit === '%' ? [0, 25, 50, 75, 100].filter(v => v <= top) : niceTicks(rawTop).filter(v => v <= top);
  const anyFail = colorByStatus && items.some(i => i.value != null && !(i.pass ?? i.value >= threshold));
  return (
    <div ref={t.ref} className="relative">
      <div className="grid gap-x-3" style={{ gridTemplateColumns: 'minmax(48px,auto) 1fr' }}>
        {items.map((it, i) => {
          const v = it.value;
          const pass = it.pass ?? (v != null && v >= threshold);
          const color = it.color || (!colorByStatus ? CHART.series : pass ? CHART.good : CHART.critical);
          const statusText = it.status ?? (colorByStatus && v != null ? (pass ? passLabel : failLabel) : undefined);
          return (
            <React.Fragment key={i}>
              <div className="flex items-center justify-end py-1 text-[11px] font-semibold whitespace-nowrap" style={{ color: CHART.ink2 }}>{it.label}</div>
              <div
                className="relative flex items-center py-1 cursor-default"
                onMouseMove={e => t.show(e, it.detail ? `${it.label} — ${it.detail}` : it.label, [v == null ? 'No data' : `${unit === '%' ? fmt(v) : v}${unit === '%' ? '' : ` ${unit}`}`, ...(statusText ? [statusText] : []), ...(it.extra || [])])}
                onMouseLeave={t.hide}
              >
                {/* gridlines */}
                <div className="absolute inset-0 pointer-events-none">
                  {ticks.map(tk => <div key={tk} className="absolute top-0 bottom-0 w-px" style={{ left: pct(tk), background: CHART.grid }} />)}
                </div>
                {v == null ? (
                  <span className="relative text-[10px] italic" style={{ color: CHART.muted }}>no data</span>
                ) : (
                  <>
                    <div className="relative h-3.5 rounded-r" style={{ width: pct(v), minWidth: v > 0 ? 3 : 0, background: color }} />
                    <span className="relative ml-1.5 text-[11px] font-semibold tabular-nums" style={{ color: CHART.ink }}>{unit === '%' ? fmt(v) : v}</span>
                  </>
                )}
                {showThreshold && unit === '%' && (
                  <div className="absolute top-0 bottom-0 w-px pointer-events-none" style={{ left: pct(threshold), background: CHART.ink, opacity: 0.55 }} />
                )}
              </div>
            </React.Fragment>
          );
        })}
        {/* axis */}
        <div />
        <div className="relative h-4 mt-0.5 border-t" style={{ borderColor: CHART.axis }}>
          {ticks.map(tk => (
            <span key={tk} className="absolute -translate-x-1/2 text-[10px] tabular-nums" style={{ left: pct(tk), color: CHART.muted }}>{tk}{unit === '%' ? '%' : ''}</span>
          ))}
        </div>
      </div>
      {(colorByStatus || legend) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          {legend ? legend.map(l => <LegendItem key={l.label} color={l.color} label={l.label} />) : <>
            <LegendItem color={CHART.good} label={passLabel} />
            {anyFail && <LegendItem color={CHART.critical} label={failLabel} />}
          </>}
          {showThreshold && unit === '%' && (
            <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: CHART.ink2 }}>
              <span className="inline-block h-3 w-px" style={{ background: CHART.ink }} /> Threshold {threshold}%
            </span>
          )}
        </div>
      )}
      {t.node}
    </div>
  );
}

function niceTicks(top: number): number[] {
  if (top <= 0) return [0];
  const raw = top / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = Math.max(1, [1, 2, 5, 10].map(m => m * mag).find(s => s >= raw) || mag * 10);
  const out: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

/* ---------- donut (part-to-whole, ≤ 6 segments) ---------- */
export interface DonutSlice { label: string; value: number; color: string }

export function DonutChart({ slices, centerLabel, size = 132 }: { slices: DonutSlice[]; centerLabel?: string; size?: number }) {
  const t = useTip();
  const data = slices.filter(s => s.value > 0);
  const total = data.reduce((a, s) => a + s.value, 0);
  if (!total) return <p className="text-[11px] text-slate-400">No data to chart.</p>;
  const r = size / 2, stroke = 18, rr = r - stroke / 2 - 1, C = 2 * Math.PI * rr;
  const gap = data.length > 1 ? 2 : 0;
  let acc = 0;
  return (
    <div ref={t.ref} className="relative flex items-center gap-5 flex-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <g transform={`rotate(-90 ${r} ${r})`}>
          {data.map((s, i) => {
            const len = (s.value / total) * C;
            const dash = Math.max(0.5, len - gap);
            const el = (
              <circle
                key={i}
                cx={r} cy={r} r={rr} fill="none" stroke={s.color} strokeWidth={stroke}
                strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-acc}
                onMouseMove={e => t.show(e, s.label, [`${s.value} of ${total}`, `${((s.value / total) * 100).toFixed(0)}%`])}
                onMouseLeave={t.hide}
                style={{ cursor: 'default' }}
              />
            );
            acc += len;
            return el;
          })}
        </g>
        <text x={r} y={r - 2} textAnchor="middle" fontSize="20" fontWeight="700" fill={CHART.ink}>{total}</text>
        <text x={r} y={r + 14} textAnchor="middle" fontSize="10" fill={CHART.muted}>{centerLabel || 'total'}</text>
      </svg>
      <div className="space-y-1.5">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            <span className="inline-block h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span style={{ color: CHART.ink2 }}>{s.label}</span>
            <span className="font-semibold tabular-nums ml-auto pl-3" style={{ color: CHART.ink }}>{s.value}</span>
          </div>
        ))}
      </div>
      {t.node}
    </div>
  );
}

/* ---------- heatmap (rows × columns of percentages) ---------- */
export function HeatmapChart({ rows, cols, value, rowLabel, colLabel }: {
  rows: string[]; cols: string[]; value: (row: string, col: string) => number | null; rowLabel?: string; colLabel?: (c: string) => string;
}) {
  const t = useTip();
  const cell = (v: number) => SEQ[Math.max(0, Math.min(SEQ.length - 1, Math.floor((v / 100) * SEQ.length)))];
  return (
    <div ref={t.ref} className="relative overflow-x-auto">
      <table className="border-separate text-[11px]" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="px-2 text-left font-semibold" style={{ color: CHART.muted }}>{rowLabel}</th>
            {cols.map(c => <th key={c} className="px-1 font-semibold whitespace-nowrap" style={{ color: CHART.ink2 }}>{colLabel ? colLabel(c) : c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r}>
              <td className="pr-2 font-semibold whitespace-nowrap" style={{ color: CHART.ink2 }}>{r}</td>
              {cols.map(c => {
                const v = value(r, c);
                const bg = v == null ? '#f3f3f1' : cell(v);
                const dark = v != null && v >= 50;
                return (
                  <td
                    key={c}
                    className="h-8 min-w-[52px] rounded text-center font-semibold tabular-nums"
                    style={{ background: bg, color: v == null ? CHART.muted : dark ? '#ffffff' : CHART.ink }}
                    onMouseMove={e => t.show(e, `${r} · ${colLabel ? colLabel(c) : c}`, [v == null ? 'Not assessed' : fmt(v)])}
                    onMouseLeave={t.hide}
                  >
                    {v == null ? '—' : `${Math.round(v)}%`}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center gap-2 text-[10px]" style={{ color: CHART.muted }}>
        <span>0%</span>
        <div className="h-2 w-32 rounded" style={{ background: `linear-gradient(to right, ${SEQ.join(',')})` }} />
        <span>100%</span>
      </div>
      {t.node}
    </div>
  );
}

/* ---------- grouped column chart (categories × ordered series) ---------- */
export function GroupedColumnChart({ categories, series, value, threshold }: {
  categories: string[]; series: string[]; value: (cat: string, s: string) => number | null; threshold?: number;
}) {
  const t = useTip();
  const colors = series.map((_, i) => ORDINAL[series.length === 1 ? 2 : Math.round((i / Math.max(1, series.length - 1)) * (Math.min(series.length, ORDINAL.length) - 1))]);
  const H = 170;
  const ticks = [0, 25, 50, 75, 100];
  const barW = Math.max(6, Math.min(24, Math.floor(60 / Math.max(1, series.length))));
  const groupW = series.length * barW + (series.length - 1) * 2;
  return (
    <div ref={t.ref} className="relative">
      <div className="flex pt-2">
        <div className="relative shrink-0 w-10" style={{ height: H }}>
          {ticks.map(tk => (
            <span key={tk} className="absolute right-2 text-[10px] leading-none tabular-nums" style={{ bottom: `calc(${tk}% - 5px)`, color: CHART.muted }}>{tk}%</span>
          ))}
        </div>
        <div className="flex-1 overflow-x-auto">
          <div className="relative" style={{ minWidth: categories.length * (groupW + 16) }}>
            <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: H }}>
              {ticks.map(tk => <div key={tk} className="absolute left-0 right-0 h-px" style={{ bottom: `${tk}%`, background: tk === 0 ? CHART.axis : CHART.grid }} />)}
              {threshold != null && <div className="absolute left-0 right-0 h-px" style={{ bottom: `${threshold}%`, background: CHART.ink, opacity: 0.55 }} />}
            </div>
            <div className="relative flex">
              {categories.map(cat => (
                <div key={cat} className="flex flex-1 flex-col items-center">
                  <div className="flex items-end gap-[2px]" style={{ height: H }}>
                    {series.map((s, si) => {
                      const v = value(cat, s);
                      return (
                        <div
                          key={s}
                          className="rounded-t"
                          style={{ width: barW, height: v == null ? 0 : `${Math.max(0.5, Math.min(100, v))}%`, background: colors[si] }}
                          onMouseMove={e => t.show(e, `${cat} · ${s}`, [v == null ? 'No data' : fmt(v)])}
                          onMouseLeave={t.hide}
                        />
                      );
                    })}
                  </div>
                  <div className="pt-1.5 text-center text-[10px] font-semibold whitespace-nowrap" style={{ color: CHART.ink2 }}>{cat}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {series.length > 1 && series.map((s, i) => <LegendItem key={s} color={colors[i]} label={s} />)}
        {threshold != null && (
          <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: CHART.ink2 }}>
            <span className="inline-block h-px w-3" style={{ background: CHART.ink }} /> Threshold {threshold}%
          </span>
        )}
      </div>
      {t.node}
    </div>
  );
}

/* ---------- stacked horizontal bar (counts) ---------- */
export function StackedBarChart({ rows, parts }: {
  rows: { label: string; values: number[] }[]; parts: { label: string; color: string }[];
}) {
  const t = useTip();
  const max = Math.max(1, ...rows.map(r => r.values.reduce((a, b) => a + b, 0)));
  return (
    <div ref={t.ref} className="relative space-y-1.5">
      {rows.map((r, i) => {
        const total = r.values.reduce((a, b) => a + b, 0);
        return (
          <div key={i} className="grid items-center gap-3" style={{ gridTemplateColumns: 'minmax(90px, 160px) 1fr' }}>
            <span className="truncate text-right text-[11px] font-semibold" style={{ color: CHART.ink2 }} title={r.label}>{r.label}</span>
            <div className="flex items-center">
              <div className="flex h-3.5 gap-[2px]" style={{ width: `${(total / max) * 100}%`, minWidth: total ? 4 : 0 }}>
                {r.values.map((v, j) => v > 0 && (
                  <div
                    key={j}
                    className={`h-full ${j === r.values.length - 1 || r.values.slice(j + 1).every(x => !x) ? 'rounded-r' : ''}`}
                    style={{ flex: v, background: parts[j].color }}
                    onMouseMove={e => t.show(e, r.label, parts.map((p, k) => `${p.label}: ${r.values[k]}`))}
                    onMouseLeave={t.hide}
                  />
                ))}
              </div>
              <span className="ml-1.5 text-[11px] font-semibold tabular-nums" style={{ color: CHART.ink }}>{total}</span>
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
        {parts.map(p => <LegendItem key={p.label} color={p.color} label={p.label} />)}
      </div>
      {t.node}
    </div>
  );
}
