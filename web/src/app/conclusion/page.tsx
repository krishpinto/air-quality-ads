import Link from "next/link";
import { loadData } from "@/lib/data";
import { PageShell } from "@/components/layout/page-shell";
import { UnitSection, Result, Interpretation } from "@/components/syllabus";
import { DataTable, Note, type Column } from "@/components/blocks";
import { ProcessDiagram } from "@/components/unit-1/process-diagram";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtInt, pct } from "@/lib/format";

/* ------------------------------------------------------------------ JSON type (pipeline/conclusion.py) */
type Headline = { label: string; value: string; hint: string | null };
type UnitSummary = { unit: number; route: string; title: string; stage: string; paragraph: string; numbers: Headline[]; one_line: string };
type Action = { finding: string; action: string; units: number[] };
type Limitation = { title: string; detail: string };
type SeasonShare = { season: string; days: number; high: number; share: number };
type Conclusion = {
  meta: { rows: number; columns: number; start: string; end: string; train_days: number; test_days: number; test_start: string; objective: string };
  units: UnitSummary[];
  high_demand_by_season: SeasonShare[];
  actions: Action[];
  limitations: Limitation[];
  course_conclusion: string;
};

const seasonCols: Column<SeasonShare>[] = [
  { key: "season", header: "Season" },
  { key: "days", header: "Days", align: "right", render: (r) => fmtInt(r.days) },
  { key: "high", header: "High-demand days", align: "right", render: (r) => fmtInt(r.high) },
  { key: "share", header: "Share", align: "right", render: (r) => pct(r.share) },
];

export default async function ConclusionPage() {
  const d = await loadData<Conclusion>("conclusion");
  const m = d.meta;

  return (
    <PageShell
      title="Conclusion: knowledge and actions"
      description={`The last stage of the Data Science Process. Six units asked one question of the same ${fmtInt(m.rows)} days of Capital Bikeshare data (${m.start} to ${m.end}): ${m.objective} This page collects what each unit found, what a bike-share operator would do with it, and what the study cannot claim. Every number here is read from the unit results; nothing is typed in.`}
      concepts={["Knowledge and actions", "Headline numbers", "Limitations", "Course conclusion"]}
    >
      {/* ------------------------------------------------------------ the process, stage 5 highlighted */}
      <ProcessDiagram highlight={[5]} />

      {/* ------------------------------------------------------------ the walk through the six units */}
      {d.units.map((u) => (
        <UnitSection key={u.unit} number={`Unit-${u.unit}`} title={u.title} intro={`Process stage: ${u.stage}.`}>
          <p className="max-w-4xl text-sm leading-relaxed">{u.paragraph}</p>
          <Result items={u.numbers.map((n) => ({ label: n.label, value: n.value, hint: n.hint ?? undefined }))} />
          <Interpretation>
            {u.one_line}{" "}
            <Link href={u.route} className="text-primary underline underline-offset-2">
              Open Unit {u.unit} →
            </Link>
          </Interpretation>
        </UnitSection>
      ))}

      {/* ------------------------------------------------------------ knowledge and actions */}
      <UnitSection number="Knowledge" title="Knowledge and actions" intro="Each finding is paired with the decision a bike-share operator would take because of it. The unit badges say where the numbers come from.">
        <div className="grid gap-3 md:grid-cols-2">
          {d.actions.map((a, i) => (
            <Card key={i} className="gap-2 py-4 shadow-none">
              <CardHeader className="px-4 pb-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <CardTitle className="text-sm">Finding {i + 1}</CardTitle>
                  {a.units.map((n) => (
                    <Badge key={n} variant="secondary" className="rounded-md font-mono text-[10px]">
                      Unit {n}
                    </Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 px-4 text-sm leading-relaxed">
                <p>{a.finding}</p>
                <p className="rounded-md border-l-4 border-l-primary bg-muted/40 px-3 py-2">
                  <span className="font-medium">Action: </span>
                  {a.action}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="max-w-xl space-y-2">
          <p className="text-sm text-muted-foreground">High-demand days (the Unit 5 label) by season, from the daily table built in Unit 1.</p>
          <DataTable columns={seasonCols} rows={d.high_demand_by_season} rowKey={(r) => r.season} />
        </div>
      </UnitSection>

      {/* ------------------------------------------------------------ limitations */}
      <UnitSection number="Limits" title="Limitations" intro="What this study cannot claim, and why.">
        <ol className="max-w-4xl list-decimal space-y-3 pl-5 text-sm leading-relaxed">
          {d.limitations.map((l) => (
            <li key={l.title}>
              <span className="font-medium">{l.title}.</span> {l.detail}
            </li>
          ))}
        </ol>
      </UnitSection>

      {/* ------------------------------------------------------------ course conclusion */}
      <UnitSection number="Course" title="Course conclusion">
        <Note tone="good" title="Applied Data Science, in one sentence">
          {d.course_conclusion}
        </Note>
      </UnitSection>
    </PageShell>
  );
}
