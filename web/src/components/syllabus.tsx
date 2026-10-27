import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Formula } from "@/components/formula";
import { cn } from "@/lib/utils";

/**
 * The one layout every syllabus section uses, so the whole site reads the same way:
 *
 *   <UnitSection number="2.3" title="Univariate exploration">
 *     <What>…teacher's definition…</What>
 *     <FormulaBlock tex={[…]} where={[…]} />
 *     <Worked title="…">…a table with the intermediate columns…</Worked>
 *     <Result label="Mean" value="98.6 µg/m³" />
 *     <Interpretation>…one sentence in the teacher's phrasing…</Interpretation>
 *   </UnitSection>
 *
 * Self-learning topics get `selfLearning` so they are visibly tagged.
 */
export function UnitSection({
  number,
  title,
  selfLearning = false,
  intro,
  children,
}: {
  number: string;
  title: string;
  selfLearning?: boolean;
  intro?: ReactNode;
  children: ReactNode;
}) {
  const id = `s-${number.replace(/\./g, "-")}`;
  return (
    <section id={id} className="scroll-mt-16 space-y-5 border-t pt-8 first:border-t-0 first:pt-0">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-md font-mono text-[11px]">
            {number}
          </Badge>
          {selfLearning && (
            <Badge variant="outline" className="rounded-md border-amber-300 bg-amber-50 text-[11px] font-normal text-amber-800">
              Self-learning topic
            </Badge>
          )}
        </div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {intro && <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

/** A sub-heading inside a unit section, for topics that have several parts (e.g. Mean / Median / Mode). */
export function SubSection({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      <h3 className="text-base font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Beat({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-2 md:grid-cols-[110px_1fr]", className)}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:pt-1">{label}</div>
      <div className="min-w-0 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

/** Beat 1 — what it is, in the teacher's wording. */
export function What({ children }: { children: ReactNode }) {
  return <Beat label="What it is">{children}</Beat>;
}

/** Beat 2 — the formula exactly as taught. */
export function FormulaBlock({ tex, where, note }: { tex: string | string[]; where?: [string, string][]; note?: ReactNode }) {
  const list = Array.isArray(tex) ? tex : [tex];
  return (
    <Beat label="Formula">
      <Card className="gap-0 py-3 shadow-none">
        <CardContent className="space-y-1 px-4">
          {list.map((t, i) => (
            <Formula key={i} tex={t} />
          ))}
          {where && (
            <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
              {where.map(([sym, meaning]) => (
                <div key={sym} className="flex gap-2">
                  <dt className="shrink-0">
                    <Formula tex={sym} display={false} />
                  </dt>
                  <dd>= {meaning}</dd>
                </div>
              ))}
            </dl>
          )}
          {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
        </CardContent>
      </Card>
    </Beat>
  );
}

/** Beat 3 — the calculation on our data, usually a table with the intermediate columns. */
export function Worked({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <Beat label="Worked on our data">
      <div className="space-y-2">
        {title && <p className="text-sm text-muted-foreground">{title}</p>}
        {children}
      </div>
    </Beat>
  );
}

/** Beat 4 — the result, boxed. Several results can be listed. */
export function Result({ items, label, value, hint }: { items?: Array<{ label: string; value: ReactNode; hint?: ReactNode }>; label?: string; value?: ReactNode; hint?: ReactNode }) {
  const list = items ?? (label !== undefined ? [{ label, value, hint }] : []);
  return (
    <Beat label="Result">
      <div className="flex flex-wrap gap-2">
        {list.map((it) => (
          <div key={it.label} className="rounded-md border-2 border-foreground/80 bg-background px-3 py-2">
            <div className="text-[11px] text-muted-foreground">{it.label}</div>
            <div className="font-mono text-base font-semibold tabular-nums">{it.value}</div>
            {it.hint && <div className="text-[11px] text-muted-foreground">{it.hint}</div>}
          </div>
        ))}
      </div>
    </Beat>
  );
}

/** Beat 5 — one or two sentences in the teacher's phrasing. */
export function Interpretation({ children }: { children: ReactNode }) {
  return (
    <Beat label="Interpretation">
      <div className="rounded-md border-l-4 border-l-primary bg-muted/40 px-3 py-2">{children}</div>
    </Beat>
  );
}

/** The teacher's 5-step hypothesis-test layout (Unit 3 and Unit 4). */
export function HypothesisTest({
  h0,
  h1,
  alpha = "α = 0.05",
  statistic,
  calculated,
  tabulated,
  decision,
  conclusion,
}: {
  h0: ReactNode;
  h1: ReactNode;
  alpha?: ReactNode;
  statistic: ReactNode;
  calculated: ReactNode;
  tabulated: ReactNode;
  decision: "reject" | "accept";
  conclusion: ReactNode;
}) {
  const rows: [string, ReactNode][] = [
    ["1. Null hypothesis", h0],
    ["2. Alternative hypothesis", h1],
    ["3. Level of significance", alpha],
    ["4. Test statistic", statistic],
  ];
  return (
    <Card className="gap-0 py-0 shadow-none">
      <CardContent className="divide-y px-0">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 px-4 py-2 text-sm md:grid-cols-[200px_1fr]">
            <div className="font-medium">{k}</div>
            <div className="min-w-0">{v}</div>
          </div>
        ))}
        <div className="grid gap-1 px-4 py-2 text-sm md:grid-cols-[200px_1fr]">
          <div className="font-medium">Calculated vs tabulated</div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono tabular-nums">
            <span>Calculated: {calculated}</span>
            <span>Tabulated: {tabulated}</span>
          </div>
        </div>
        <div className={cn("grid gap-1 px-4 py-2 text-sm md:grid-cols-[200px_1fr]", decision === "reject" ? "bg-rose-50" : "bg-green-50")}>
          <div className="font-medium">5. Conclusion</div>
          <div>
            <span className="font-semibold">{decision === "reject" ? "H₀ is rejected." : "H₀ is accepted."}</span> {conclusion}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** "Check against the class example" box: the code reproduces the teacher's slide. */
export function ClassCheck({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-md border border-dashed border-amber-400 bg-amber-50/40 p-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="rounded-md border-amber-400 text-[11px] font-normal text-amber-800">
          Check against the class example
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}
