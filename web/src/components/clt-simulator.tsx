"use client";

import { useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Histogram } from "@/components/charts/series";
import { KV } from "@/components/blocks";

/** Deterministic PRNG so the simulation is reproducible for a given seed. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stats(a: number[]) {
  const n = a.length;
  const mean = a.reduce((s, v) => s + v, 0) / n;
  const m2 = a.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const m3 = a.reduce((s, v) => s + (v - mean) ** 3, 0) / n;
  const m4 = a.reduce((s, v) => s + (v - mean) ** 4, 0) / n;
  return { mean, sd: Math.sqrt((m2 * n) / (n - 1)), skew: m3 / m2 ** 1.5, kurt: m4 / m2 ** 2 - 3 };
}

function histogram(values: number[], bins = 35, mu: number, se: number) {
  const lo = Math.min(...values), hi = Math.max(...values);
  const w = (hi - lo) / bins || 1;
  const counts = new Array(bins).fill(0);
  for (const v of values) counts[Math.min(bins - 1, Math.floor((v - lo) / w))]++;
  return counts.map((c, i) => {
    const mid = lo + (i + 0.5) * w;
    return { mid: Number(mid.toFixed(2)), count: c, density: c / (values.length * w), normal: Math.exp(-0.5 * ((mid - mu) / se) ** 2) / (se * Math.sqrt(2 * Math.PI)) };
  });
}

export function CltSimulator({ population, mu, sigma }: { population: number[]; mu: number; sigma: number }) {
  const [n, setN] = useState(30);
  const [draws, setDraws] = useState(1000);
  const [seed, setSeed] = useState(1);

  const { bins, s, se } = useMemo(() => {
    const rnd = mulberry32(seed);
    const means: number[] = [];
    for (let d = 0; d < draws; d++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += population[Math.floor(rnd() * population.length)];
      means.push(sum / n);
    }
    const se = sigma / Math.sqrt(n);
    return { bins: histogram(means, 35, mu, se), s: stats(means), se };
  }, [n, draws, seed, population, mu, sigma]);

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Sample size n</span>
            <span className="font-medium tabular-nums">{n}</span>
          </div>
          <Slider min={1} max={200} step={1} value={[n]} onValueChange={(v) => setN(v[0])} />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Number of samples (draws)</span>
            <span className="font-medium tabular-nums">{draws}</span>
          </div>
          <Slider min={100} max={5000} step={100} value={[draws]} onValueChange={(v) => setDraws(v[0])} />
        </div>
        <button type="button" onClick={() => setSeed((x) => x + 1)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
          Re-draw (seed {seed})
        </button>
        <KV
          cols={1}
          items={[
            ["Population mean μ", mu.toFixed(2)],
            ["Population σ", sigma.toFixed(2)],
            ["Mean of sample means", s.mean.toFixed(2)],
            ["SD of sample means (observed)", s.sd.toFixed(2)],
            ["σ / √n (theory)", se.toFixed(2)],
            ["Skewness of the means", s.skew.toFixed(3)],
            ["Excess kurtosis of the means", s.kurt.toFixed(3)],
          ]}
        />
      </div>
      <div className="space-y-2">
        <Histogram bins={bins} height={300} label="Sample means" color="#7c3aed" xFormat="int" />
        <p className="text-xs text-muted-foreground">
          Histogram of {draws} sample means, each from n = {n} hours drawn with replacement from 4,000 real PM2.5 readings. Red curve: N(μ, σ²/n). Drag n up and watch the skew vanish and the spread shrink like 1/√n.
        </p>
      </div>
    </div>
  );
}
