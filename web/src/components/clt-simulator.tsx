"use client";

import { useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Histogram } from "@/components/charts/series";
import { KV } from "@/components/blocks";

/**
 * Unit 3.2 — the teacher's CLT demo, interactive: draw many samples of size n from the population of
 * 731 daily rental counts, average each, and watch the histogram of the averages turn bell-shaped
 * with spread σ/√n. Everything shown is computed in the browser from the population passed in.
 */

/** Deterministic PRNG so the same seed always gives the same picture. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mean and σ (÷N, the class formula) of a list of numbers. */
function meanSd(a: number[]) {
  const n = a.length;
  const mean = a.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(a.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  return { mean, sd };
}

function histogram(values: number[], bins: number, mu: number, se: number) {
  const lo = Math.min(...values), hi = Math.max(...values);
  const w = (hi - lo) / bins || 1;
  const counts = new Array(bins).fill(0);
  for (const v of values) counts[Math.min(bins - 1, Math.floor((v - lo) / w))]++;
  return counts.map((c, i) => {
    const mid = lo + (i + 0.5) * w;
    return { mid: Math.round(mid), count: c, density: c / (values.length * w), normal: Math.exp(-0.5 * ((mid - mu) / se) ** 2) / (se * Math.sqrt(2 * Math.PI)) };
  });
}

export function CltSimulator({ population, mu, sigma }: { population: number[]; mu: number; sigma: number }) {
  const [n, setN] = useState(30);
  const [draws, setDraws] = useState(2000);
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
    return { bins: histogram(means, 35, mu, se), s: meanSd(means), se };
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
            <span className="text-muted-foreground">Number of samples drawn</span>
            <span className="font-medium tabular-nums">{draws}</span>
          </div>
          <Slider min={100} max={10000} step={100} value={[draws]} onValueChange={(v) => setDraws(v[0])} />
        </div>
        <button type="button" onClick={() => setSeed((x) => x + 1)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
          Re-draw (seed {seed})
        </button>
        <KV
          cols={1}
          items={[
            ["Population mean μ", mu.toFixed(1)],
            ["Population σ", sigma.toFixed(1)],
            ["Mean of the sample means", s.mean.toFixed(1)],
            ["SD of the sample means (observed)", s.sd.toFixed(1)],
            ["σ / √n (standard error, theory)", se.toFixed(1)],
          ]}
        />
      </div>
      <div className="space-y-2">
        <Histogram bins={bins} height={300} label="Sample means x̄" color="#7c3aed" xFormat="int" />
        <p className="text-xs text-muted-foreground">
          Histogram of {draws} sample means, each the average of n = {n} days drawn with replacement from the {population.length} daily rental counts. Red curve: the normal curve with mean μ and standard error σ/√n. Move n past 30 and the shape is bell-shaped; keep raising n and the spread shrinks like 1/√n.
        </p>
      </div>
    </div>
  );
}
