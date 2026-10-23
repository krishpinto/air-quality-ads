import { loadData } from "@/lib/data";
import { PageShell } from "@/components/layout/page-shell";
import { ChartCard, DataTable, FormulaCard, KV, Note, Section, StatCard, StatGrid } from "@/components/blocks";
import { BarSeries, Histogram, LineSeries } from "@/components/charts/series";
import { ScatterPlot, CategoryBars } from "@/components/charts/scatter";
import { Badge } from "@/components/ui/badge";
import { fmt, fmtInt } from "@/lib/format";

type M = { r2: number; mae: number; rmse: number };
type Fold = { fold: number; n_train: number; n_test: number; r2: number; mae: number; rmse: number };
type KF = { model: string; k: number; folds: Fold[]; mean_r2: number; std_r2: number; mean_rmse: number; std_rmse: number; seconds?: number };
type SFold = { fold: number; pos_rate_train: number; pos_rate_test: number; accuracy: number; precision: number; recall: number; f1: number };
type Boot = { estimate: number; boot_mean?: number; boot_se: number; ci: [number, number]; hist: Array<Record<string, unknown>>; analytic_se?: number };
type Val = {
  features: string[];
  holdout: Array<{ model: string; split: string; n_train: number; n_test: number; train: M; test: M }>;
  holdout_variability: { r2_values: number[]; mean: number; std: number; min: number; max: number };
  kfold: { lr_k5: KF; lr_k10: KF; rf_k5: KF };
  stratified: { positive_rate: number; n_pos: number; n: number; folds: SFold[]; plain_folds: SFold[]; mean_f1: number; mean_recall: number };
  loocv: { n: number; fits: number; seconds: number; mse: number; rmse: number; mae: number; r2: number; k10: { rmse: number; r2: number; fits: number }; points: Array<{ actual: number; pred: number }>; per_obs_sq_err: number[] };
  bootstrap: { B: number; n: number; dewp_coef: Boot; r2: Boot; mean_pm25: Boot };
  learning_curve: Array<{ n: number; lr_train: number; lr_test: number; rf_train: number; rf_test: number }>;
  comparison: Array<{ method: string; fits: number; test_r2: number | null; variance: number | null; note: string }>;
};

export default async function Page() {
  const d = await loadData<Val>("validation");
  const rfRandom = d.holdout.find((h) => h.model === "Random forest" && h.split.startsWith("Random"))!;
  const rfChrono = d.holdout.find((h) => h.model === "Random forest" && h.split.startsWith("Chrono"))!;
  return (
    <PageShell
      module="7"
      title="Model validation"
      description="How do we know a model's score is real? Hold-out, k-fold, stratified k-fold, leave-one-out and the bootstrap are applied to the regression model (and a random forest for contrast), with the same features as Module 6. The main lesson for time-ordered data: a random split leaks the future into training and over-states performance."
      concepts={["Train / test split", "Hold-out variance", "K-fold cross-validation", "Stratified K-fold", "Leave-one-out", "Bootstrap CI", "Learning curve", "Overfitting"]}
    >
      <StatGrid cols={4}>
        <StatCard label="RF test R², random split" value={fmt(rfRandom.test.r2, 3)} hint="random 80/20 - leaks neighbouring hours" tone="warn" />
        <StatCard label="RF test R², chronological" value={fmt(rfChrono.test.r2, 3)} hint="train 2010-13, test 2014 - honest" tone="good" />
        <StatCard label="5-fold CV R² (linear)" value={`${fmt(d.kfold.lr_k5.mean_r2, 3)} ± ${fmt(d.kfold.lr_k5.std_r2, 4)}`} hint="mean ± SD over folds" />
        <StatCard label="Bootstrap 95% CI, dew-point slope" value={`[${fmt(d.bootstrap.dewp_coef.ci[0], 2)}, ${fmt(d.bootstrap.dewp_coef.ci[1], 2)}]`} hint={`B = ${d.bootstrap.B} resamples of daily data`} />
      </StatGrid>

      <Section title="Hold-out validation" subtitle="Fit on one part, score on the other. Two ways to split: at random, or by time.">
        <FormulaCard title="Metrics on the held-out set" tex={["R^2 = 1 - \\frac{\\sum (y_i-\\hat{y}_i)^2}{\\sum (y_i-\\bar{y})^2}, \\qquad RMSE = \\sqrt{\\frac{1}{n}\\sum (y_i-\\hat{y}_i)^2}, \\qquad MAE = \\frac{1}{n}\\sum |y_i-\\hat{y}_i|"]} />
        <DataTable
          rows={d.holdout}
          columns={[
            { key: "model", header: "Model", className: "font-medium" },
            { key: "split", header: "Split" },
            { key: "n_train", header: "Train n", align: "right", render: (r) => fmtInt(r.n_train) },
            { key: "n_test", header: "Test n", align: "right", render: (r) => fmtInt(r.n_test) },
            { key: "tr", header: "Train R²", align: "right", render: (r) => fmt(r.train.r2, 3) },
            { key: "te", header: "Test R²", align: "right", render: (r) => <span className="font-semibold">{fmt(r.test.r2, 3)}</span> },
            { key: "gap", header: "Gap", align: "right", render: (r) => <span className={r.train.r2 - r.test.r2 > 0.1 ? "text-amber-700" : ""}>{fmt(r.train.r2 - r.test.r2, 3)}</span> },
            { key: "rmse", header: "Test RMSE", align: "right", render: (r) => fmt(r.test.rmse, 1) },
          ]}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="How much does a single random hold-out score move?" description={`The same linear model with 30 different random 80/20 splits. R² ranges ${fmt(d.holdout_variability.min, 3)} – ${fmt(d.holdout_variability.max, 3)} (SD ${fmt(d.holdout_variability.std, 4)}). A single split is a noisy estimate.`}>
            <CategoryBars data={d.holdout_variability.r2_values.map((v, i) => ({ seed: `${i + 1}`, r2: v }))} xKey="seed" yKey="r2" yLabel="test R²" height={220} fallback="#64748b" refY={d.holdout_variability.mean} refLabel="mean" />
          </ChartCard>
          <Note tone="warn" title="Random vs chronological">
            Hours next to each other share the same air mass, so a random split puts an hour in the test set whose neighbours are in the training set. The random forest, which can memorise local structure, scores {fmt(rfRandom.test.r2, 3)} under a random split but only {fmt(rfChrono.test.r2, 3)} on an unseen year. The linear model barely changes, because it cannot memorise. For any model that will be used to predict the future, validate on the future.
          </Note>
        </div>
      </Section>

      <Section title="K-fold cross-validation" subtitle="Split into k folds; each fold is the test set once. The average score uses every row for testing and is far more stable than a single hold-out.">
        <FormulaCard title="CV estimate" tex={["\\text{CV}_k = \\frac{1}{k}\\sum_{j=1}^{k} \\text{Score}_j, \\qquad SE = \\frac{s_{\\text{folds}}}{\\sqrt{k}}"]} where={[["k = 5", "80% train / 20% test per fold"], ["k = 10", "90% / 10%: less bias, more fits"]]} />
        <div className="grid gap-4 lg:grid-cols-3">
          {(["lr_k5", "lr_k10", "rf_k5"] as const).map((k) => {
            const kf = d.kfold[k];
            return (
              <ChartCard key={k} title={`${kf.model}, k = ${kf.k}`} description={`mean R² ${fmt(kf.mean_r2, 4)} ± ${fmt(kf.std_r2, 4)} · mean RMSE ${fmt(kf.mean_rmse, 2)}${kf.seconds ? ` · ${kf.seconds}s` : ""}`}>
                <CategoryBars data={kf.folds.map((f) => ({ fold: `F${f.fold}`, r2: f.r2 }))} xKey="fold" yKey="r2" yLabel="R²" height={180} fallback={k === "rf_k5" ? "#16a34a" : "#2563eb"} refY={kf.mean_r2} />
                <DataTable rows={kf.folds} columns={[{ key: "fold", header: "Fold", align: "right" }, { key: "n_test", header: "Test n", align: "right", render: (r) => fmtInt(r.n_test) }, { key: "r2", header: "R²", align: "right", render: (r) => fmt(r.r2, 4) }, { key: "rmse", header: "RMSE", align: "right", render: (r) => fmt(r.rmse, 2) }]} />
              </ChartCard>
            );
          })}
        </div>
      </Section>

      <Section title="Stratified K-fold (classification)" subtitle={`Classifying 'unhealthy' hours (PM2.5 > 150, ${fmt(100 * d.stratified.positive_rate, 1)}% of rows) with logistic regression. Stratification keeps the positive rate identical in every fold; plain K-fold lets it drift.`}>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Positive rate in each test fold" description="Stratified folds: all equal to the overall rate. Plain folds: random variation.">
            <BarSeries data={d.stratified.folds.map((f, i) => ({ fold: `Fold ${f.fold}`, stratified: 100 * f.pos_rate_test, plain: 100 * d.stratified.plain_folds[i].pos_rate_test }))} xKey="fold" series={[{ key: "stratified", label: "Stratified", color: "#2563eb" }, { key: "plain", label: "Plain K-fold", color: "#f97316" }]} height={220} yFormat="1dp" legend variant="default" yDomain={[19, 22]} />
          </ChartCard>
          <ChartCard title="Per-fold classification metrics (stratified)" description={`Mean F1 ${fmt(d.stratified.mean_f1, 3)}, mean recall ${fmt(d.stratified.mean_recall, 3)} (class_weight = balanced).`}>
            <DataTable rows={d.stratified.folds} columns={[{ key: "fold", header: "Fold", align: "right" }, { key: "pos_rate_test", header: "Pos. rate", align: "right", render: (r) => fmt(100 * r.pos_rate_test, 2) + "%" }, { key: "accuracy", header: "Accuracy", align: "right", render: (r) => fmt(r.accuracy, 3) }, { key: "precision", header: "Precision", align: "right", render: (r) => fmt(r.precision, 3) }, { key: "recall", header: "Recall", align: "right", render: (r) => fmt(r.recall, 3) }, { key: "f1", header: "F1", align: "right", render: (r) => fmt(r.f1, 3) }]} />
          </ChartCard>
        </div>
      </Section>

      <Section title="Leave-one-out cross-validation" subtitle={`k = n. Each of the ${d.loocv.n} daily observations of 2014 is predicted by a model trained on the other ${d.loocv.n - 1}. Nearly unbiased, but n fits and a high-variance estimate.`}>
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <FormulaCard title="LOOCV error" tex={"\\text{CV}_{(n)} = \\frac{1}{n}\\sum_{i=1}^{n}\\left(y_i - \\hat{y}_{(-i)}\\right)^2"} where={[["\\hat{y}_{(-i)}", "prediction for i from a model fitted without i"]]} />
            <KV cols={1} items={[["Fits", fmtInt(d.loocv.fits)], ["Time", `${d.loocv.seconds} s`], ["MSE", fmt(d.loocv.mse, 1)], ["RMSE", fmt(d.loocv.rmse, 2)], ["MAE", fmt(d.loocv.mae, 2)], ["R²", fmt(d.loocv.r2, 4)], ["10-fold on the same data: RMSE / R²", `${fmt(d.loocv.k10.rmse, 2)} / ${fmt(d.loocv.k10.r2, 4)} (${d.loocv.k10.fits} fits)`]]} />
          </div>
          <ChartCard title="LOOCV predictions vs actual daily PM2.5 (2014)" description="10-fold gives almost the same answer with 36× fewer fits, which is why k = 5 or 10 is the usual default.">
            <ScatterPlot points={d.loocv.points.map((p) => ({ x: p.pred, y: p.actual }))} xLabel="LOO prediction" yLabel="Actual" height={280} diagonal size={14} opacity={0.5} />
          </ChartCard>
        </div>
      </Section>

      <Section title="Bootstrap" subtitle={`Resample the ${fmtInt(d.bootstrap.n)} daily rows with replacement ${d.bootstrap.B} times, refit, and look at the spread of the statistic. Gives a standard error and a percentile confidence interval without normality assumptions.`}>
        <FormulaCard title="Percentile bootstrap" tex={["\\hat{\\theta}^{*(b)} = \\hat{\\theta}(\\text{resample}_b), \\quad b = 1..B; \\qquad SE_{boot} = sd(\\hat{\\theta}^{*}), \\qquad CI_{95} = [\\hat{\\theta}^{*}_{(2.5\\%)},\\ \\hat{\\theta}^{*}_{(97.5\\%)}]"]} />
        <div className="grid gap-4 lg:grid-cols-3">
          {([["dewp_coef", "Dew-point slope (daily model)", "#2563eb", 2], ["r2", "R² of the daily model", "#7c3aed", 3], ["mean_pm25", "Mean daily PM2.5", "#16a34a", 2]] as const).map(([k, title, color, dg]) => {
            const b = d.bootstrap[k];
            return (
              <ChartCard key={k} title={title} description={`estimate ${fmt(b.estimate, dg)} · bootstrap SE ${fmt(b.boot_se, dg + 1)} · 95% CI [${fmt(b.ci[0], dg)}, ${fmt(b.ci[1], dg)}]${b.analytic_se ? ` · analytic SE ${fmt(b.analytic_se, dg + 1)}` : ""}`}>
                <Histogram bins={b.hist} height={200} color={color} label="bootstrap replicates" showNormal={false} xFormat={k === "r2" ? "3dp" : "1dp"} />
              </ChartCard>
            );
          })}
        </div>
        <Note tone="good">
          For the mean, the bootstrap SE ({fmt(d.bootstrap.mean_pm25.boot_se, 3)}) matches the textbook s/√n ({fmt(d.bootstrap.mean_pm25.analytic_se, 3)}), a sanity check that the method works. For R², which has no simple SE formula, the bootstrap is the practical way to get an interval.
        </Note>
      </Section>

      <Section title="Learning curve" subtitle="Train on growing subsets of 2010-2013, test on 2014. A big train/test gap that closes with more data = variance (overfitting); a low plateau = bias (the features cannot explain more).">
        <ChartCard title="R² vs training size">
          <LineSeries data={d.learning_curve} xKey="n" series={[{ key: "lr_train", label: "Linear - train", color: "#93c5fd", stroke: "dashed" }, { key: "lr_test", label: "Linear - test", color: "#2563eb" }, { key: "rf_train", label: "RF - train", color: "#86efac", stroke: "dashed" }, { key: "rf_test", label: "RF - test", color: "#16a34a" }]} height={280} xFormat="int" yFormat="2dp" legend yDomain={[0, 1]} />
          <p className="mt-1 text-xs text-muted-foreground">The random forest fits the training data far better than it predicts 2014 even with 33k rows: it is learning hour-to-hour structure that does not transfer. The linear model has no variance problem, only bias.</p>
        </ChartCard>
      </Section>

      <Section title="Which validation scheme, when?">
        <DataTable
          rows={d.comparison}
          columns={[
            { key: "method", header: "Method", className: "font-medium whitespace-nowrap" },
            { key: "fits", header: "Model fits", align: "right", render: (r) => fmtInt(r.fits) },
            { key: "test_r2", header: "Estimate (R²)", align: "right", render: (r) => (r.test_r2 === null ? "–" : fmt(r.test_r2, 4)) },
            { key: "variance", header: "SD of estimate", align: "right", render: (r) => (r.variance === null ? "–" : fmt(r.variance, 4)) },
            { key: "note", header: "When to use" },
          ]}
        />
        <div className="flex flex-wrap gap-2 text-xs">
          {d.features.map((f) => (
            <Badge key={f} variant="outline" className="rounded-md font-mono">{f}</Badge>
          ))}
          <span className="text-muted-foreground">features used by every model on this page</span>
        </div>
      </Section>
    </PageShell>
  );
}
