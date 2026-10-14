// 가벼운 SVG 차트: 영역별 레이더, 회차별 등급 추이, 막대. 바깥/위쪽/높은 막대일수록 좋은 등급(1등급)입니다.

/** 교과군별 색(내신 화면 전체에서 같은 색을 씁니다) */
export const GROUP_COLORS: Record<string, string> = {
  국어: "#14b8a6",
  수학: "#e0607e",
  영어: "#f59e0b",
  사회: "#8b5cf6",
  과학: "#10b981",
  제2외국어: "#f97316",
  "예체능·기타": "#94a3b8",
};

/** 막대 차트: 막대가 높을수록 좋은 등급. 가로로 넘치면 스크롤됩니다. */
export function BarChart({ items }: { items: { label: string; value: number; color: string }[] }) {
  const W = Math.max(520, items.length * 74 + 70);
  const H = 360;
  const L = 58;
  const T = 24;
  const B = 74;
  const y = (g: number) => T + ((H - T - B) * (g - 1)) / 9; // 1등급 맨 위, 10 = 바닥선
  const slot = (W - L - 14) / Math.max(1, items.length);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: W }} className="w-full" role="img" aria-label="등급 막대 그래프">
        {Array.from({ length: 9 }, (_, i) => i + 1).map((g) => (
          <g key={g}>
            <line x1={L} x2={W - 10} y1={y(g)} y2={y(g)} className="stroke-stone-200" />
            <text x={L - 8} y={y(g)} textAnchor="end" dominantBaseline="middle" className="fill-stone-500 text-[11px]">
              {g}등급
            </text>
          </g>
        ))}
        <line x1={L} x2={L} y1={T} y2={y(10)} className="stroke-stone-300" />
        <line x1={L} x2={W - 10} y1={y(10)} y2={y(10)} className="stroke-stone-300" />
        {items.map((it, i) => {
          const cx = L + slot * i + slot / 2;
          const bw = Math.min(46, slot * 0.62);
          const top = y(Math.min(10, Math.max(1, it.value)));
          return (
            <g key={`${it.label}-${i}`}>
              <rect x={cx - bw / 2} y={top} width={bw} height={y(10) - top} rx={5} fill={it.color} fillOpacity={0.75} stroke={it.color} />
              <text x={cx} y={top - 7} textAnchor="middle" className="text-[12px] font-bold" fill={it.color}>
                {Number.isInteger(it.value) ? it.value : it.value.toFixed(2).replace(/0$/, "")}등급
              </text>
              <text
                x={cx}
                y={y(10) + 16}
                textAnchor="end"
                transform={`rotate(-30 ${cx} ${y(10) + 16})`}
                className="fill-stone-700 text-[11px] font-medium"
              >
                {it.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const trimNum = (n: number) => String(Math.round(n * 100) / 100);

/**
 * 강점·약점 방사형: 바깥쪽일수록 좋은 등급(1등급=바깥 테두리, 9등급=가운데 근처).
 * reference(학생 전체 평균)를 점선 다각형으로 그리고, 그보다 threshold 이상 좋은 점은 초록(강점),
 * 나쁜 점은 빨강(약점), 나머지는 속이 빈 점으로 표시합니다.
 */
export function StrengthRadar({
  axes,
  reference,
  threshold = 0.3,
}: {
  axes: { label: string; grade: number }[];
  reference: number | null;
  threshold?: number;
}) {
  const n = axes.length;
  if (n < 3) return <p className="text-sm text-stone-500">3개 이상의 항목이 있어야 그릴 수 있습니다.</p>;
  const W = 560;
  const H = 500;
  const cx = W / 2;
  const cy = 258;
  const r = 150;
  const ratio = (g: number) => (10 - Math.min(9, Math.max(1, g))) / 9;
  const pt = (i: number, rr: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [cx + r * rr * Math.cos(a), cy + r * rr * Math.sin(a), a] as const;
  };
  const poly = (f: (i: number) => number) => axes.map((_, i) => pt(i, f(i)).slice(0, 2).join(",")).join(" ");
  const small = n > 12;

  // 값 라벨 위치: 점에서 안쪽(중심 방향)으로 띄웁니다. 바깥에는 과목명이 있으므로 겹치지 않습니다.
  // 점이 중심 가까이 있어 안쪽 자리가 없으면 바깥쪽으로 둡니다.
  // 거리는 점 반지름 + 글자 상자가 점을 벗어날 만큼(글자 폭을 반영)으로 잡아 점·글자가 닿지 않게 합니다.
  const dots = axes.map((a, i) => pt(i, ratio(a.grade)));
  const vpos = dots.map(([px, py, ang], i) => {
    const hw = trimNum(axes[i].grade).length * 4.4; // 글자 상자 반폭(14px 굵은 숫자)
    const off = 10 + 4 + Math.abs(Math.cos(ang)) * hw + Math.abs(Math.sin(ang)) * 8;
    // 안쪽(중심 방향)과 바깥쪽 두 자리 중, 다른 점과 덜 겹치는 쪽을 고릅니다(같으면 안쪽 우선).
    const cands = [-1, 1].map((dir) => [px + dir * Math.cos(ang) * off, py + dir * Math.sin(ang) * off] as const);
    const clearance = (c: readonly [number, number]) => {
      let m = Infinity;
      dots.forEach(([ox, oy], j) => {
        if (j !== i) m = Math.min(m, Math.max(Math.abs(c[0] - ox) - (hw + 10), Math.abs(c[1] - oy) - (7 + 10)));
      });
      // 바깥쪽 후보는 과목명 쪽으로 가므로, 그림 바깥으로 나가는 만큼 불리하게 봅니다.
      const dist = Math.hypot(c[0] - cx, c[1] - cy);
      return dist > r * 0.97 ? Math.min(m, -1) : m;
    };
    const preferInward = ratio(axes[i].grade) >= 0.45;
    const [inw, outw] = cands;
    const ci = clearance(inw);
    const co = clearance(outw);
    return preferInward ? (ci >= 0 || ci >= co ? inw : outw) : co >= 0 || co >= ci ? outw : inw;
  });
  const ringGrades = n > 12 ? [1, 9] : [1, 5, 9];
  // 눈금 글자(1·5·9등급)는 이웃한 두 축 사이의 빈 자리에 놓되, 값 라벨·점에서 가장 먼 자리를 고릅니다.
  const ringPos = (k: number, g: number) => {
    const bis = -Math.PI / 2 + ((2 * k + 1) * Math.PI) / n;
    const rr = ratio(g) * Math.cos(Math.PI / n); // 다각형 변의 중간 지점
    return [cx + r * rr * Math.cos(bis), cy + r * rr * Math.sin(bis)] as const;
  };
  // 글자 상자(가로로 긴 모양)를 감안한 간격: 음수면 겹침. 값 라벨과는 28×14, 점과는 30×17 이상 떨어져야 합니다.
  const sep = (x: number, y: number, ox: number, oy: number, hw: number, hh: number) =>
    Math.max(Math.abs(x - ox) - hw, Math.abs(y - oy) - hh);
  let bestK = 0;
  let bestScore = -Infinity;
  for (let k = 0; k < n; k++) {
    let score = Infinity;
    for (const g of ringGrades) {
      const [x, y] = ringPos(k, g);
      for (const [vx, vy] of vpos) score = Math.min(score, sep(x, y, vx, vy, 28, 14));
      for (const [px, py] of dots) score = Math.min(score, sep(x, y, px, py, 30, 17));
    }
    if (score > bestScore) {
      bestScore = score;
      bestK = k;
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xl mx-auto" role="img" aria-label="강점·약점 방사형 차트">
      {Array.from({ length: 9 }, (_, k) => k + 1).map((g) => (
        <polygon key={g} points={poly(() => ratio(g))} fill="none" stroke="#e7e1d8" strokeWidth={g === 1 ? 1.5 : 1} />
      ))}
      {axes.map((_, i) => (
        <line key={i} x1={cx} y1={cy} x2={pt(i, 1)[0]} y2={pt(i, 1)[1]} stroke="#e7e1d8" />
      ))}

      <polygon points={poly((i) => ratio(axes[i].grade))} fill="#14b8a6" fillOpacity={0.2} stroke="#0f9488" strokeWidth={3} strokeLinejoin="round" />
      {reference != null && (
        <polygon points={poly(() => ratio(reference))} fill="none" stroke="#6b7280" strokeWidth={2.5} strokeDasharray="6 5" />
      )}

      {/* 눈금 라벨: 첫 두 축 사이의 빈 자리(이등분선)에 놓아 값·과목명과 겹치지 않게 합니다 */}
      {ringGrades.map((g) => {
        const [rx, ry] = ringPos(bestK, g);
        return (
          <text
            key={g}
            x={rx}
            y={ry}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-teal-700 text-[12px] font-medium"
            stroke="#fbf7f1"
            strokeWidth={4}
            paintOrder="stroke"
          >
            {g}등급
          </text>
        );
      })}

      {axes.map((a, i) => {
        const [px, py, ang] = pt(i, ratio(a.grade));
        const cos = Math.cos(ang);
        const sin = Math.sin(ang);
        const diff = reference == null ? 0 : Math.round((a.grade - reference) * 100) / 100;
        const strong = reference != null && diff <= -threshold;
        const weak = reference != null && diff >= threshold;
        const dotFill = strong ? "#3f6f4a" : weak ? "#9f2a40" : "#fff";
        const dotStroke = strong || weak ? "#fff" : "#0f9488";

        const [vx, vy] = vpos[i];

        // 과목명: 가장 바깥 눈금 바로 밖. 위/아래 축은 가운데 정렬, 옆 축은 바깥쪽으로 정렬합니다.
        const gap = 18;
        const lx = cx + (r + gap) * cos;
        const ly = cy + (r + gap) * sin;
        const anchor = cos > 0.25 ? "start" : cos < -0.25 ? "end" : "middle";
        const baseline = sin < -0.7 ? "auto" : sin > 0.7 ? "hanging" : "middle";
        return (
          <g key={`${a.label}-${i}`}>
            <circle cx={px} cy={py} r={strong || weak ? 10 : 7} fill={dotFill} stroke={dotStroke} strokeWidth={strong || weak ? 2.5 : 3} />
            <text
              x={vx}
              y={vy}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[14px] font-bold"
              fill="#0f766e"
              stroke="#fbf7f1"
              strokeWidth={4}
              paintOrder="stroke"
            >
              {trimNum(a.grade)}
            </text>
            <text
              x={lx}
              y={ly}
              textAnchor={anchor}
              dominantBaseline={baseline}
              className={`${small ? "text-[12px]" : "text-[15px]"} font-bold fill-emerald-900`}
            >
              {a.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const CX = 150;
const CY = 140;
const R = 100;

export function RadarChart({ axes }: { axes: { label: string; grade: number | null }[] }) {
  const n = axes.length;
  if (n < 3) return <p className="text-sm text-stone-500">영역이 3개 이상이어야 그릴 수 있습니다.</p>;
  const pt = (i: number, ratio: number) => {
    const ang = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [CX + R * ratio * Math.cos(ang), CY + R * ratio * Math.sin(ang)] as const;
  };
  const ratio = (g: number | null) => (g == null ? 0 : (10 - g) / 9); // 1등급=1.0, 9등급≈0.11
  const poly = axes.map((a, i) => pt(i, ratio(a.grade)).join(",")).join(" ");
  return (
    <svg viewBox="-30 -10 360 310" className="w-full max-w-sm mx-auto" role="img" aria-label="영역별 최근 등급 레이더 차트">
      {[1, 3, 5, 7, 9].map((g) => (
        <polygon
          key={g}
          points={axes.map((_, i) => pt(i, ratio(g)).join(",")).join(" ")}
          fill="none"
          className="stroke-stone-200"
        />
      ))}
      {axes.map((_, i) => (
        <line key={i} x1={CX} y1={CY} x2={pt(i, 1)[0]} y2={pt(i, 1)[1]} className="stroke-stone-200" />
      ))}
      <polygon points={poly} className="fill-amber-500/25 stroke-amber-700" strokeWidth={2} />
      {axes.map((a, i) => {
        const [x, y] = pt(i, ratio(a.grade));
        const [lx, ly] = pt(i, 1.32);
        return (
          <g key={a.label}>
            <circle cx={x} cy={y} r={3.5} className="fill-amber-700" />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="fill-stone-800 text-[11px] font-medium">
              {a.label}
            </text>
            <text x={lx} y={ly + 13} textAnchor="middle" className="fill-amber-800 text-[11px] font-bold">
              {a.grade == null ? "-" : `${a.grade}등급`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export interface TrendSeries {
  label: string;
  color: string;
  dashed?: boolean;
  values: (number | null)[];
}

export function TrendChart({
  labels,
  series,
  range = [1, 9],
}: {
  labels: string[];
  series: TrendSeries[];
  /** 세로축 범위(작은 값이 위). 기본 1~9등급 */
  range?: [number, number];
}) {
  const W = 560;
  const H = 240;
  const L = 40;
  const Rt = 16;
  const T = 14;
  const B = 34;
  const [lo, hi] = range;
  const x = (i: number) => (labels.length === 1 ? (L + W - Rt) / 2 : L + ((W - L - Rt) * i) / (labels.length - 1));
  const y = (g: number) => T + ((H - T - B) * (g - lo)) / (hi - lo); // 좋은 등급(작은 값)이 맨 위
  const ticks = hi - lo === 8 ? Array.from({ length: 9 }, (_, i) => i + 1) : Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="등급 추이">
        {ticks.map((g) => (
          <g key={g}>
            <line x1={L} x2={W - Rt} y1={y(g)} y2={y(g)} className="stroke-stone-100" />
            <text x={L - 8} y={y(g)} textAnchor="end" dominantBaseline="middle" className="fill-stone-500 text-[10px]">
              {Number.isInteger(g) ? g : g.toFixed(1)}
            </text>
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={l} x={x(i)} y={H - 12} textAnchor="middle" className="fill-stone-600 text-[11px]">
            {l}
          </text>
        ))}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v == null ? null : ([x(i), y(v)] as const)));
          const path = pts.filter(Boolean).map((p) => p!.join(",")).join(" ");
          return (
            <g key={s.label}>
              {pts.filter(Boolean).length > 1 && (
                <polyline points={path} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? "5 4" : undefined} />
              )}
              {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={3.5} fill={s.color} />)}
            </g>
          );
        })}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-700">
        {series.map((s) => (
          <li key={s.label} className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
