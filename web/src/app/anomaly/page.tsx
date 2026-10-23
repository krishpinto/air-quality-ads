import { loadData } from "@/lib/data";
import { PageShell } from "@/components/layout/page-shell";
import { ChartCard, DataTable, FormulaCard, KV, Note, Section, StatCard, StatGrid } from "@/components/blocks";
import { Histogram } from "@/components/charts/series";
import { CategoryBars, ScatterPlot } from "@/components/charts/scatter";
import { ConfusionMatrix, Heatmap } from "@/components/charts/grids";
import { XYLines } from "@/components/charts/xy";
import { AnomalyExplorer } from "@/components/anomaly-explorer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AQI_COLORS } from "@/lib/colors";
import { fmt, fmtInt } from "@/lib/format";

type Result = { model: string; strategy: string; train_pos: number; train_neg: number; tn: number; fp: number; fn: number; tp: number; accuracy: number; precision: number; recall: number; f1: number; specificity: number; roc_auc: number; pr_auc: number; roc: Array<{ fpr: number; tpr: number }>; pr: Array<{ recall: number; precision: number }> };
type An = {
  n_days: number;
  statistical: { mu: number; sd: number; median: number; mad: number; q1: number; q3: number; iqr: number; z_threshold: number; z_cut_value: number; modz_threshold: number; modz_cut_value: number; iqr_fences: [number, number]; iqr_fences_extreme: [number, number]; counts: { z: number; modz: number; iqr: number; iqr_extreme: number }; z_hist: Array<Record<string, unknown>> };
  methods: Array<{ key: string; name: string; family: string; rule: string; count: number }>;
  overlap: Array<{ a: string; b: string; jaccard: number }>;
  series: Array<{ date: string; pm25: number; z: number; maha: number; lof: number; agree: number; f_z: boolean; f_modz: boolean; f_iqr: boolean; f_maha: boolean; f_knn: boolean; f_lof: boolean; f_iso: boolean }>;
  top: Array<{ date: string; pm25: number; pm25_max: number; DEWP: number; TEMP: number; PRES: number; Iws: number; wind: string; z: number; maha: number; lof: number; agree: number }>;
  explorer: Array<{ x: number; y: number; maha: boolean; lof: boolean; z: boolean; date: string }>;
  density: { lof_hist: Array<Record<string, unknown>>; maha_hist: Array<Record<string, unknown>>; maha_cut: number; knn_hist: Array<Record<string, unknown>>; knn_cut: number; lof_cut: number };
  episode: Array<{ date: string; pm25: number; pm25_max: number; flags: number }>;
  imbalance: { threshold: number; target: string; features: string[]; overall: { pos: number; neg: number; ratio: number; pos_pct: number }; train: { pos: number; neg: number }; train_smote: { pos: number; neg: number }; test: { pos: number; neg: number; n: number }; aqi_hourly: Array<{ key: string; count: number; pct: number }>; results: Result[]; baseline: { accuracy: number; recall: number; precision: number; f1: number; tn: number; fp: number; fn: number; tp: number }; smote_viz: { neg: Array<{ x: number; y: number }>; pos: Array<{ x: number; y: number }>; synthetic: Array<{ x: number; y: number }>; axes: [string, string] } };
  agreement_counts: Array<{ agree: number; days: number }>;
};

export default async function Page() {
  const d = await loadData<An>("anomaly");
  const s = d.statistical;
  const im = d.imbalance;
  const keys = d.methods.map((m) => m.key);
  const names = Object.fromEntries(d.methods.map((m) => [m.key, m.name]));
  const lrPlain = im.results.find((r) => r.model === "Logistic regression" && r.strategy === "No resampling")!;
  const lrSmote = im.results.find((r) => r.model === "Logistic regression" && r.strategy === "SMOTE")!;
  return (
    <PageShell
      module="8"
      title="Anomaly detection & class imbalance"
      description="Which days are abnormal? Statistical rules on PM2.5 alone, then distance-based (Mahalanobis, k-NN), density-based (LOF) and Isolation Forest on the joint weather + pollution vector, applied to 1,826 daily rows. The second half treats 'severe day' as a rare class and shows what SMOTE and class weights do to a classifier's precision/recall trade-off."
      concepts={["Z-score & modified z", "IQR fences", "Mahalanobis distance", "k-NN distance", "Local Outlier Factor", "Isolation Forest", "Class imbalance", "SMOTE", "Precision / recall / F1 / ROC"]}
    >
      <StatGrid cols={5}>
        <StatCard label="Days analysed" value={fmtInt(d.n_days)} hint="daily means 2010-2014" />
        <StatCard label="Z-score outliers (|z| > 3)" value={d.methods[0].count} hint={`above ${fmt(s.z_cut_value, 0)} µg/m³`} />
        <StatCard label="IQR outliers" value={d.methods[2].count} hint={`above ${fmt(s.iqr_fences[1], 0)} µg/m³`} />
        <StatCard label="Mahalanobis outliers" value={d.methods[3].count} hint="5-D weather + PM2.5" />
        <StatCard label="Severe-day recall, SMOTE" value={`${fmt(100 * lrPlain.recall, 0)}% → ${fmt(100 * lrSmote.recall, 0)}%`} hint={`precision ${fmt(100 * lrPlain.precision, 0)}% → ${fmt(100 * lrSmote.precision, 0)}%`} tone="good" />
      </StatGrid>

      <Section title="Statistical methods (univariate)" subtitle="Three rules on the daily PM2.5 series alone. The z-score assumes a roughly normal distribution; the modified z-score and IQR fences are robust to the skew.">
        <div className="grid gap-4 md:grid-cols-3">
          <FormulaCard title="Z-score" tex={"z_i = \\frac{x_i-\\bar{x}}{s}, \\quad |z_i| > 3"} where={[["\\bar{x}, s", `${fmt(s.mu, 1)}, ${fmt(s.sd, 1)}`], ["\\text{cut-off}", `${fmt(s.z_cut_value, 0)} µg/m³ → ${s.counts.z} days`]]} />
          <FormulaCard title="Modified z-score (MAD)" tex={"M_i = \\frac{0.6745\\,(x_i-\\tilde{x})}{MAD}, \\quad |M_i| > 3.5"} where={[["MAD", `median |xᵢ − median| = ${fmt(s.mad, 1)}`], ["\\text{cut-off}", `${fmt(s.modz_cut_value, 0)} µg/m³ → ${s.counts.modz} days`]]} />
          <FormulaCard title="IQR fences" tex={"x < Q_1 - 1.5\\,IQR \\;\\lor\\; x > Q_3 + 1.5\\,IQR"} where={[["Q_1, Q_3, IQR", `${fmt(s.q1, 1)}, ${fmt(s.q3, 1)}, ${fmt(s.iqr, 1)}`], ["\\text{fences}", `[${fmt(s.iqr_fences[0], 0)}, ${fmt(s.iqr_fences[1], 0)}] → ${s.counts.iqr} days; 3·IQR → ${s.counts.iqr_extreme}`]]} />
        </div>
        <ChartCard title="Distribution of daily z-scores" description="Because the series is right-skewed, the z rule only ever flags high values: no day is 3 SD below the mean (that would be negative PM2.5).">
          <Histogram bins={s.z_hist} height={220} color="#64748b" label="days" xFormat="1dp" />
        </ChartCard>
      </Section>

      <Section title="Distance, density and ensemble methods (multivariate)" subtitle="Features: PM2.5, dew point, temperature, pressure, wind speed (standardised). A day is anomalous if its whole weather-pollution combination is unusual.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormulaCard title="Mahalanobis distance" tex={"D_i = \\sqrt{(x_i-\\boldsymbol\\mu)^\\top \\Sigma^{-1}(x_i-\\boldsymbol\\mu)}"} where={[["\\Sigma", "covariance matrix - accounts for correlated features"], ["D^2 \\sim \\chi^2_p", `cut-off √χ²₀.₉₇₅(5) = ${fmt(d.density.maha_cut, 2)}`]]} />
          <FormulaCard title="k-NN distance" tex={"s_i = \\frac{1}{k}\\sum_{j \\in N_k(i)} \\|x_i - x_j\\|"} where={[["k", "10 nearest neighbours"], ["\\text{cut-off}", `97.5th percentile = ${fmt(d.density.knn_cut, 2)}`]]} />
          <FormulaCard title="Local Outlier Factor" tex={"LOF_k(i) = \\frac{\\frac{1}{k}\\sum_{j\\in N_k(i)} lrd_k(j)}{lrd_k(i)}"} where={[["lrd", "local reachability density"], ["LOF \\gg 1", `much sparser than neighbours; cut-off ${fmt(d.density.lof_cut, 2)}`]]} />
          <FormulaCard title="Isolation Forest" tex={"s(x) = 2^{-E[h(x)]/c(n)}"} where={[["h(x)", "path length to isolate x by random splits"], ["s \\to 1", "anomaly (isolated quickly)"]]} />
        </div>
        <ChartCard title="Interactive: flagged days by method" description="Pick a method. Red dots on the series are the days it flags; the scatter shows the same flags against wind speed.">
          <AnomalyExplorer series={d.series} methods={d.methods} explorer={d.explorer} />
        </ChartCard>
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard title="Mahalanobis distance distribution" description={`Cut-off ${fmt(d.density.maha_cut, 2)}; the long tail to the right is the anomalies.`}>
            <Histogram bins={d.density.maha_hist} height={200} color="#2563eb" label="days" showNormal={false} xFormat="1dp" />
          </ChartCard>
          <ChartCard title="k-NN mean distance" description={`Cut-off ${fmt(d.density.knn_cut, 2)}.`}>
            <Histogram bins={d.density.knn_hist} height={200} color="#0d9488" label="days" showNormal={false} xFormat="2dp" />
          </ChartCard>
          <ChartCard title="LOF score" description="Most days ≈ 1 (as dense as their neighbours). Scores above ~1.5 are isolated points.">
            <Histogram bins={d.density.lof_hist} height={200} color="#7c3aed" label="days" showNormal={false} xFormat="2dp" />
          </ChartCard>
        </div>
      </Section>

      <Section title="Do the methods agree?" subtitle="Jaccard overlap of the flagged sets (1 = identical, 0 = disjoint), and how many methods flag each day.">
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <ChartCard title="Jaccard similarity between methods">
            <Heatmap rows={keys} cols={keys} cells={d.overlap.map((o) => ({ row: o.a, col: o.b, value: o.jaccard }))} min={0} max={1} digits={2} hue="blue" cellClass="h-10" />
            <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">{keys.map((k) => <span key={k}><code>{k}</code> = {names[k]}; </span>)}</div>
          </ChartCard>
          <ChartCard title="Days by number of methods agreeing">
            <CategoryBars data={d.agreement_counts.map((a) => ({ agree: `${a.agree}`, days: a.days }))} xKey="agree" yKey="days" yLabel="days" height={220} fallback="#64748b" />
            <p className="text-xs text-muted-foreground">Most days are flagged by nobody; a handful are flagged by all seven.</p>
          </ChartCard>
        </div>
        <ChartCard title="Top 15 anomalous days by Mahalanobis distance" description="With the weather that produced them. 'Agree' = number of the 7 methods that flag the day.">
          <DataTable
            rows={d.top}
            columns={[
              { key: "date", header: "Date", className: "font-medium whitespace-nowrap" },
              { key: "pm25", header: "Daily mean", align: "right", render: (r) => fmt(r.pm25, 0) },
              { key: "pm25_max", header: "Hourly max", align: "right", render: (r) => fmt(r.pm25_max, 0) },
              { key: "DEWP", header: "Dew pt", align: "right", render: (r) => fmt(r.DEWP, 1) },
              { key: "TEMP", header: "Temp", align: "right", render: (r) => fmt(r.TEMP, 1) },
              { key: "PRES", header: "Pressure", align: "right", render: (r) => fmt(r.PRES, 0) },
              { key: "Iws", header: "Wind", align: "right", render: (r) => fmt(r.Iws, 1) },
              { key: "wind", header: "Dir" },
              { key: "z", header: "z", align: "right", render: (r) => fmt(r.z, 2) },
              { key: "maha", header: "D", align: "right", render: (r) => fmt(r.maha, 2) },
              { key: "lof", header: "LOF", align: "right", render: (r) => fmt(r.lof, 2) },
              { key: "agree", header: "Agree", align: "center", render: (r) => <Badge variant={r.agree >= 5 ? "default" : "secondary"} className="rounded-md text-[10px]">{r.agree}/7</Badge> },
            ]}
          />
        </ChartCard>
        <ChartCard title="Known episode check: 10–16 January 2013" description="The 'airpocalypse' of January 2013 made international news (hourly readings approached 900 µg/m³). The methods flag it without being told.">
          <DataTable rows={d.episode} columns={[{ key: "date", header: "Date" }, { key: "pm25", header: "Daily mean", align: "right", render: (r) => fmt(r.pm25, 0) }, { key: "pm25_max", header: "Hourly max", align: "right", render: (r) => fmt(r.pm25_max, 0) }, { key: "flags", header: "Methods flagging", align: "center", render: (r) => `${r.flags}/7` }]} />
        </ChartCard>
      </Section>

      <Section title="Class imbalance and SMOTE" subtitle={`Supervised task: predict a ${im.target} from the day's weather only. Positives are ${fmt(im.overall.pos_pct, 1)}% of days (1 : ${fmt(im.overall.ratio, 0)}), so accuracy alone is misleading - always predicting 'normal' scores ${fmt(100 * im.baseline.accuracy, 1)}%.`}>
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard title="Class balance" description="Train = 2010-2013, test = 2014 (chronological).">
            <KV cols={1} items={[["All days: severe / normal", `${im.overall.pos} / ${im.overall.neg}`], ["Train: severe / normal", `${im.train.pos} / ${im.train.neg}`], ["Train after SMOTE", `${im.train_smote.pos} / ${im.train_smote.neg}`], ["Test: severe / normal", `${im.test.pos} / ${im.test.neg}`], ["Features", im.features.length + " (weather, wind, month)"]]} />
          </ChartCard>
          <ChartCard title="Hourly EPA categories" description="The imbalance is in the raw data too: 'Good' hours are rare.">
            <CategoryBars data={im.aqi_hourly} xKey="key" yKey="pct" colors={AQI_COLORS} yLabel="% of hours" height={220} />
          </ChartCard>
          <FormulaCard title="SMOTE" tex={"x_{new} = x_i + \\lambda\\,(x_{nn} - x_i), \\quad \\lambda \\sim U(0,1)"} where={[["x_{nn}", "one of the k = 5 nearest minority neighbours of xᵢ"], ["\\text{result}", "synthetic minority rows on the segments between real ones, until classes are balanced"]]}>
            Only the training set is resampled. The test set keeps its real 1 : {fmt(im.test.neg / im.test.pos, 0)} ratio, otherwise the scores would be fiction.
          </FormulaCard>
        </div>
        <ChartCard title="What SMOTE adds (first two standardised features)" description="Grey = normal days, blue = real severe days, red = synthetic severe days interpolated between real ones.">
          <ScatterPlot
            points={[
              ...im.smote_viz.neg.map((p) => ({ ...p, color: "#cbd5e1", group: "Normal" })),
              ...im.smote_viz.synthetic.map((p) => ({ ...p, color: "#e11d48", group: "Synthetic severe" })),
              ...im.smote_viz.pos.map((p) => ({ ...p, color: "#2563eb", group: "Real severe" })),
            ]}
            xLabel={im.smote_viz.axes[0]}
            yLabel={im.smote_viz.axes[1]}
            height={300}
            size={16}
            opacity={0.7}
          />
        </ChartCard>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormulaCard title="Precision" tex={"\\frac{TP}{TP+FP}"} where={[["", "of the days we flag, how many are really severe"]]} />
          <FormulaCard title="Recall (sensitivity)" tex={"\\frac{TP}{TP+FN}"} where={[["", "of the real severe days, how many we catch"]]} />
          <FormulaCard title="F1" tex={"2\\cdot\\frac{P\\cdot R}{P+R}"} where={[["", "harmonic mean - punishes a lopsided trade-off"]]} />
          <FormulaCard title="ROC-AUC" tex={"\\int_0^1 TPR\\,d(FPR)"} where={[["", "ranking quality, independent of the 0.5 threshold"]]} />
        </div>
        <Tabs defaultValue="table">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="table">Results table</TabsTrigger>
            {im.results.map((r, i) => (
              <TabsTrigger key={i} value={`m${i}`}>{r.model.split(" ")[0]} · {r.strategy}</TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="table">
            <DataTable
              rows={[{ model: "Majority baseline", strategy: "always 'normal'", ...im.baseline, roc_auc: 0.5, pr_auc: im.test.pos / im.test.n, specificity: 1 }, ...im.results]}
              columns={[
                { key: "model", header: "Model", className: "font-medium whitespace-nowrap" },
                { key: "strategy", header: "Imbalance strategy" },
                { key: "tp", header: "TP", align: "right" }, { key: "fp", header: "FP", align: "right" }, { key: "fn", header: "FN", align: "right" }, { key: "tn", header: "TN", align: "right" },
                { key: "accuracy", header: "Accuracy", align: "right", render: (r) => fmt(r.accuracy as number, 3) },
                { key: "precision", header: "Precision", align: "right", render: (r) => fmt(r.precision as number, 3) },
                { key: "recall", header: "Recall", align: "right", render: (r) => <span className="font-semibold">{fmt(r.recall as number, 3)}</span> },
                { key: "f1", header: "F1", align: "right", render: (r) => fmt(r.f1 as number, 3) },
                { key: "roc_auc", header: "ROC-AUC", align: "right", render: (r) => fmt(r.roc_auc as number, 3) },
                { key: "pr_auc", header: "PR-AUC", align: "right", render: (r) => fmt(r.pr_auc as number, 3) },
              ]}
            />
          </TabsContent>
          {im.results.map((r, i) => (
            <TabsContent key={i} value={`m${i}`}>
              <div className="grid gap-4 lg:grid-cols-3">
                <ChartCard title={`${r.model} · ${r.strategy}`} description={`Trained on ${r.train_pos} severe / ${r.train_neg} normal days`}>
                  <ConfusionMatrix tn={r.tn} fp={r.fp} fn={r.fn} tp={r.tp} />
                  <KV cols={2} items={[["Accuracy", fmt(r.accuracy, 3)], ["Specificity", fmt(r.specificity, 3)], ["Precision", fmt(r.precision, 3)], ["Recall", fmt(r.recall, 3)], ["F1", fmt(r.f1, 3)], ["ROC-AUC", fmt(r.roc_auc, 3)]]} />
                </ChartCard>
                <ChartCard title="ROC curve" description="True-positive rate vs false-positive rate over all thresholds.">
                  <XYLines series={[{ name: `${r.strategy} (AUC ${fmt(r.roc_auc, 3)})`, points: r.roc.map((p) => ({ x: p.fpr, y: p.tpr })), color: "#2563eb" }]} xLabel="False positive rate" yLabel="True positive rate" diagonal height={260} />
                </ChartCard>
                <ChartCard title="Precision-recall curve" description="More informative than ROC when positives are rare.">
                  <XYLines series={[{ name: `${r.strategy} (AP ${fmt(r.pr_auc, 3)})`, points: r.pr.map((p) => ({ x: p.recall, y: p.precision })), color: "#e11d48" }]} xLabel="Recall" yLabel="Precision" height={260} />
                </ChartCard>
              </div>
            </TabsContent>
          ))}
        </Tabs>
        <ChartCard title="All ROC curves" description="Resampling moves the operating point along the curve (more recall, less precision) but barely changes the curve itself: SMOTE does not add information, it changes the decision threshold.">
          <XYLines series={im.results.map((r, i) => ({ name: `${r.model} · ${r.strategy}`, points: r.roc.map((p) => ({ x: p.fpr, y: p.tpr })), color: ["#2563eb", "#60a5fa", "#7c3aed", "#16a34a", "#86efac"][i], dashed: r.strategy !== "No resampling" }))} xLabel="False positive rate" yLabel="True positive rate" diagonal height={320} />
        </ChartCard>
        <Note tone="good" title="Reading the results">
          Without resampling, logistic regression at the default 0.5 threshold catches {fmt(100 * lrPlain.recall, 0)}% of severe days with {fmt(100 * lrPlain.precision, 0)}% precision; with SMOTE it catches {fmt(100 * lrSmote.recall, 0)}% at {fmt(100 * lrSmote.precision, 0)}% precision. For a health warning system a missed severe day costs more than a false alarm, so the SMOTE / class-weighted operating point is the sensible one. The random forest has the higher ROC-AUC: a non-linear model extracts a little more from the same weather.
        </Note>
      </Section>
    </PageShell>
  );
}
