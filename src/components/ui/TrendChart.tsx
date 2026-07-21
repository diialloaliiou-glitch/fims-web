"use client";

import { useState } from "react";

type Point = { label: string; value: number };

const WIDTH = 900;
const HEIGHT = 220;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

export function TrendChart({ data }: { data: Point[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length === 0) return null;

  const maxValue = Math.max(1, ...data.map((d) => d.value));
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const x = (i: number) =>
    data.length === 1
      ? PAD_LEFT + plotWidth / 2
      : PAD_LEFT + (i / (data.length - 1)) * plotWidth;
  const y = (v: number) => PAD_TOP + plotHeight - (v / maxValue) * plotHeight;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.value)}`).join(" ");

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        style={{ height: "220px" }}
        preserveAspectRatio="none"
      >
        {gridLines.map((g) => (
          <line
            key={g}
            x1={PAD_LEFT}
            x2={WIDTH - PAD_RIGHT}
            y1={PAD_TOP + plotHeight * (1 - g)}
            y2={PAD_TOP + plotHeight * (1 - g)}
            stroke="var(--border-subtle)"
            strokeWidth={1}
          />
        ))}

        <path d={linePath} fill="none" stroke="var(--accent-teal)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {data.map((d, i) => (
          <circle
            key={d.label}
            cx={x(i)}
            cy={y(d.value)}
            r={hoverIdx === i ? 5 : 3}
            fill="var(--accent-teal)"
          />
        ))}

        {hoverIdx !== null && (
          <line
            x1={x(hoverIdx)}
            x2={x(hoverIdx)}
            y1={PAD_TOP}
            y2={PAD_TOP + plotHeight}
            stroke="var(--border-subtle)"
            strokeWidth={1}
            strokeDasharray="3,3"
          />
        )}

        {data.map((d, i) => (
          <text
            key={d.label}
            x={x(i)}
            y={HEIGHT - 8}
            textAnchor="middle"
            fontSize={11}
            fill="var(--text-secondary)"
          >
            {d.label}
          </text>
        ))}

        {data.map((d, i) => (
          <rect
            key={d.label}
            x={x(i) - plotWidth / Math.max(data.length, 1) / 2}
            y={PAD_TOP}
            width={plotWidth / Math.max(data.length, 1)}
            height={plotHeight}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx((cur) => (cur === i ? null : cur))}
          />
        ))}
      </svg>

      {hoverIdx !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md border border-border-subtle bg-bg-card px-3 py-1.5 text-xs shadow-lg"
          style={{
            left: `${(x(hoverIdx) / WIDTH) * 100}%`,
            top: `${(y(data[hoverIdx].value) / HEIGHT) * 100}%`,
          }}
        >
          <p className="font-semibold text-text-primary">{data[hoverIdx].label}</p>
          <p className="text-accent-teal">{data[hoverIdx].value.toLocaleString("fr-FR")}</p>
        </div>
      )}
    </div>
  );
}
