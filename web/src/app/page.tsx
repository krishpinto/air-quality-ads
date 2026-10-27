import Link from "next/link";
import { ArrowRight, Lightbulb } from "lucide-react";
import { loadData } from "@/lib/data";
import { PageShell } from "@/components/layout/page-shell";
import { Note, Section } from "@/components/blocks";
import { ProcessDiagram } from "@/components/unit-1/process-diagram";
import { NAV } from "@/components/layout/nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmt, fmtInt, pct } from "@/lib/format";

/* ------------------------------------------------------------------ only the keys the home page reads */
type Unit1 = { prep: { rows_raw: number; columns_raw: number; start: string; end: string; train_days: number; test_days: number }; headline: { holdout_mae_train: number; holdout_mae_test: number } };
type Unit2 = { headline: { mean: number; r_temp: number } };
type Unit3 = { headline: { f_one: number; f_one_crit: number } };
type Unit4 = { headline: { two_predictor: { b1: number; r2: number } } };
type Unit5 = { headline: { recall_without: number; recall_with: number; sandy_lof: number } };
type Unit6 = { headline: { best_method: string; metrics: Record<string, { MAE: number; MASE: number }>; best_key: string } };

/** Syllabus title and sub-sections of each unit, in syllabus order. The numbers come from the JSON. */
const UNITS: Array<{ n: number; href: string; title: string; hours: number; sections: string[] }> = [
  { n: 1, href: "/unit-1", title: "Introduction to Data Science", hours: 4, sections: ["1.1 Data Science Process", "1.2 Volume, dimensions, complexity", "1.3 Data preparation", "1.4 Cross validation, k-fold, leave-1 out, bootstrapping", "1.5 Data science vs analytics", "1.6 Applications"] },
  { n: 2, href: "/unit-2", title: "Data exploration using descriptive statistics", hours: 12, sections: ["2.1 Types and properties of data", "2.2 Classification, tabulation, diagrams, graphs", "2.3 Univariate exploration", "2.4 Multivariate exploration", "2.5 Data visualization"] },
  { n: 3, href: "/unit-3", title: "Data exploration using inferential statistics", hours: 6, sections: ["Normal, Poisson", "Central limit theorem", "Confidence interval", "Hypothesis testing", "Type-I, Type-II errors", "Z-test, t-test", "ANOVA"] },
  { n: 4, href: "/unit-4", title: "Regression analysis", hours: 10, sections: ["4.1 Intercept and slope", "4.2 Error term, R², MAE, MAPE", "4.3 Multiple linear regression", "4.4 Partial coefficients", "4.5 Overall fit (F-test)", "4.6 Individual coefficients (t-test)"] },
  { n: 5, href: "/unit-5", title: "Anomaly detection", hours: 6, sections: ["5.1 Outliers and causes", "5.2 Techniques", "5.3 Statistical", "5.4 Distance-based", "5.5 Density-based (LOF)", "5.6 SMOTE"] },
  { n: 6, href: "/unit-6", title: "Time series forecasting", hours: 5, sections: ["6.1 Taxonomy, decomposition", "6.2 Average, moving average, regression, ARIMA", "6.3 MAE, RMSE, MAPE, MASE"] },
];

export default async function Home() {
  const [u1, u2, u3, u4, u5, u6] = await Promise.all([
    loadData<Unit1>("unit1"),
    loadData<Unit2>("unit2"),
    loadData<Unit3>("unit3"),
    loadData<Unit4>("unit4"),
    loadData<Unit5>("unit5"),
    loadData<Unit6>("unit6"),
  ]);
  const p = u1.prep;
  const best6 = u6.headline.metrics[u6.headline.best_key];

  /** One headline number per unit, read from the unit JSON. */
  const headline: Record<number, { value: string; label: string }> = {
    1: { value: `${fmtInt(p.train_days)} / ${fmtInt(p.test_days)}`, label: "training / test days (chronological hold-out)" },
    2: { value: fmt(u2.headline.r_temp, 2), label: "Karl Pearson's r, temperature vs rentals" },
    3: { value: `F = ${fmt(u3.headline.f_one, 1)} vs ${fmt(u3.headline.f_one_crit, 2)}`, label: "one-way ANOVA by season: H₀ rejected" },
    4: { value: `+${fmtInt(u4.headline.two_predictor.b1)} per °C`, label: `holding humidity constant; R² = ${fmt(u4.headline.two_predictor.r2, 2)}` },
    5: { value: `${pct(u5.headline.recall_without, 0)} → ${pct(u5.headline.recall_with, 0)}`, label: "recall of high-demand days without → with SMOTE" },
    6: { value: `MAE ${fmtInt(best6.MAE)}`, label: `${u6.headline.best_method} on the test months` },
  };
  const navByHref = Object.fromEntries(NAV.flatMap((g) => g.items).map((i) => [i.href, i]));

  return (
    <PageShell
      title="Applied Data Science on Capital Bikeshare"
      description={`One question runs through the whole site: can we describe, explain and forecast the number of bikes rented per day in Washington DC from the weather and the calendar? The data are the UCI Bike Sharing Dataset (id 275): ${fmtInt(p.rows_raw)} days, ${p.columns_raw} columns, ${p.start} to ${p.end}. Each page is one unit of the Applied Data Science syllabus, in syllabus order, applied to this one dataset; the conclusion collects the knowledge and the actions.`}
      concepts={["Six syllabus units", "One dataset", "Python computes, the site shows", "Nothing typed in"]}
    >
      {/* ------------------------------------------------------------ the process with the units placed on it */}
      <Section title="The Data Science Process" subtitle="The five stages as drawn in class (Unit 1.1), with each unit of this project placed on the stage it belongs to. The sidebar follows the same order.">
        <ProcessDiagram />
      </Section>

      {/* ------------------------------------------------------------ how to read */}
      <Section title="How to read this site">
        <Card className="shadow-none">
          <CardContent className="grid gap-4 text-sm leading-relaxed md:grid-cols-2">
            <div className="space-y-1">
              <div className="font-medium">Every section carries its syllabus number</div>
              <p className="text-muted-foreground">
                A heading such as{" "}
                <Badge variant="secondary" className="rounded-md font-mono text-[11px]">
                  2.3
                </Badge>{" "}
                Univariate exploration means exactly syllabus line 2.3 and nothing outside it.
              </p>
            </div>
            <div className="space-y-1">
              <div className="font-medium">Every section has the same five beats</div>
              <p className="text-muted-foreground">What it is → Formula → Worked on our data → Result → Interpretation. The worked table shows the intermediate columns the way the class examples do; the result is boxed; the interpretation is one sentence in the class phrasing.</p>
            </div>
            <div className="space-y-1">
              <div className="font-medium">Amber boxes reproduce the class examples</div>
              <p className="text-muted-foreground">A box titled &ldquo;Check against the class example&rdquo; runs the toy data from the slides through the same code as the bike data and prints the slide&apos;s numbers next to ours.</p>
            </div>
            <div className="space-y-1">
              <div className="font-medium">
                <Badge variant="outline" className="mr-1 rounded-md border-amber-300 bg-amber-50 text-[11px] font-normal text-amber-800">
                  Self-learning topic
                </Badge>
                marks optional material
              </div>
              <p className="text-muted-foreground">Those sections come from the syllabus self-learning lines, not from class, and are kept short.</p>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* ------------------------------------------------------------ one card per unit */}
      <Section title="The six units" subtitle="Syllabus order. Each card lists the sub-sections the page covers and one headline number read from that unit's results.">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {UNITS.map((u) => {
            const nav = navByHref[u.href];
            const h = headline[u.n];
            return (
              <Link key={u.href} href={u.href} className="group">
                <Card className="h-full gap-3 py-4 shadow-none transition-colors group-hover:bg-muted/40">
                  <CardHeader className="flex flex-row items-start gap-3 px-4 pb-0">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">{nav ? <nav.icon className="size-4" /> : null}</span>
                    <div className="min-w-0 space-y-0.5">
                      <CardDescription className="font-mono text-[10px]">
                        UNIT {u.n} · {u.hours} HRS
                      </CardDescription>
                      <CardTitle className="text-sm leading-snug">{u.title}</CardTitle>
                    </div>
                    <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </CardHeader>
                  <CardContent className="space-y-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {u.sections.map((s) => (
                        <Badge key={s} variant="outline" className="rounded-md text-[10px] font-normal">
                          {s}
                        </Badge>
                      ))}
                    </div>
                    <div className="rounded-md border-2 border-foreground/80 bg-background px-3 py-2">
                      <div className="font-mono text-base font-semibold tabular-nums">{h.value}</div>
                      <div className="text-[11px] text-muted-foreground">{h.label}</div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}

          {/* conclusion card */}
          <Link href="/conclusion" className="group">
            <Card className="h-full gap-3 border-emerald-200 bg-emerald-50/40 py-4 shadow-none transition-colors group-hover:bg-emerald-50">
              <CardHeader className="flex flex-row items-start gap-3 px-4 pb-0">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
                  <Lightbulb className="size-4" />
                </span>
                <div className="min-w-0 space-y-0.5">
                  <CardDescription className="font-mono text-[10px]">STAGE 5 · KNOWLEDGE</CardDescription>
                  <CardTitle className="text-sm leading-snug">Conclusion: knowledge and actions</CardTitle>
                </div>
                <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </CardHeader>
              <CardContent className="px-4 text-sm leading-relaxed text-muted-foreground">
                One paragraph per unit with its headline numbers, what a bike-share operator would do with each finding, the limitations, and the course conclusion. Hold-out MAE on the test period: {fmtInt(u1.headline.holdout_mae_test)} rentals vs {fmtInt(u1.headline.holdout_mae_train)} on the training days.
              </CardContent>
            </Card>
          </Link>
        </div>
      </Section>

      <Note tone="info" title="Where the numbers come from">
        Python scripts in <code className="font-mono text-xs">pipeline/</code> compute every statistic and write one JSON file per unit; the pages read that JSON and show it. The mean of {fmtInt(u2.headline.mean)} rentals per day on this page, for example, is read from <code className="font-mono text-xs">unit2.json</code>. Re-running the pipeline regenerates the whole site.
      </Note>
    </PageShell>
  );
}
