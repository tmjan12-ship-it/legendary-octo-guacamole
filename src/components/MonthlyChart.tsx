// 依存なしのSVG棒グラフ。
// 月別の売上・経費・所得を3系列で表示する。

type MonthlyPoint = {
  label: string;
  revenue: number;
  expense: number;
  profit: number;
};

const W = 720;
const H = 220;
const PADDING = { top: 12, right: 16, bottom: 24, left: 56 };

export default function MonthlyChart({ data }: { data: MonthlyPoint[] }) {
  if (data.length === 0) return null;

  const innerW = W - PADDING.left - PADDING.right;
  const innerH = H - PADDING.top - PADDING.bottom;

  const max = Math.max(
    1,
    ...data.flatMap((d) => [d.revenue, d.expense, Math.abs(d.profit)]),
  );
  const step = innerW / data.length;
  const barW = step / 4;

  function yScale(v: number) {
    const half = innerH / 2;
    const center = PADDING.top + half;
    return center - (v / max) * half;
  }
  function yZero() {
    return PADDING.top + innerH / 2;
  }

  const ticks = [-max, -max / 2, 0, max / 2, max];

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        className="bg-white text-xs"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* y axis ticks */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={PADDING.left}
              y1={yScale(t)}
              x2={W - PADDING.right}
              y2={yScale(t)}
              stroke={t === 0 ? "#94a3b8" : "#e2e8f0"}
              strokeWidth={t === 0 ? 1 : 1}
              strokeDasharray={t === 0 ? "" : "2 2"}
            />
            <text
              x={PADDING.left - 4}
              y={yScale(t) + 3}
              textAnchor="end"
              fill="#64748b"
            >
              {formatShort(t)}
            </text>
          </g>
        ))}

        {/* bars */}
        {data.map((d, i) => {
          const cx = PADDING.left + step * i + step / 2;
          return (
            <g key={i}>
              <Bar
                x={cx - barW * 1.5}
                y0={yZero()}
                y1={yScale(d.revenue)}
                width={barW}
                color="#2563eb"
              />
              <Bar
                x={cx - barW * 0.5}
                y0={yZero()}
                y1={yScale(d.expense)}
                width={barW}
                color="#dc2626"
              />
              <Bar
                x={cx + barW * 0.5}
                y0={yZero()}
                y1={yScale(d.profit)}
                width={barW}
                color={d.profit >= 0 ? "#059669" : "#f59e0b"}
              />
              <text
                x={cx}
                y={H - PADDING.bottom + 14}
                textAnchor="middle"
                fill="#475569"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex gap-4 text-xs text-slate-700 mt-1 ml-14">
        <Legend color="#2563eb" label="売上" />
        <Legend color="#dc2626" label="経費" />
        <Legend color="#059669" label="所得（黒字）" />
        <Legend color="#f59e0b" label="所得（赤字）" />
      </div>
    </div>
  );
}

function Bar({
  x,
  y0,
  y1,
  width,
  color,
}: {
  x: number;
  y0: number;
  y1: number;
  width: number;
  color: string;
}) {
  const top = Math.min(y0, y1);
  const height = Math.abs(y1 - y0);
  return <rect x={x} y={top} width={width} height={height} fill={color} />;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span
        className="inline-block w-3 h-3 rounded-sm"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

function formatShort(n: number): string {
  if (n === 0) return "0";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 10000) return `${sign}${Math.round(abs / 10000)}万`;
  if (abs >= 1000) return `${sign}${Math.round(abs / 1000)}千`;
  return `${sign}${Math.round(abs)}`;
}
