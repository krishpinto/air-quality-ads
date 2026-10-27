import { cn } from "@/lib/utils";

/**
 * The Data Science Process exactly as drawn in class (Kotu & Deshpande Fig 2.1):
 *
 *   [Business understanding]  [Data understanding]            1. Prior knowledge
 *                 ↘  [Prepare data]  ↙                         2. Preparation
 *   [Training data] → [Building model using algorithms]       3. Modeling
 *   [Test data]     → [Applying model and performance evaluation]
 *                      [Deployment]                            4. Application
 *                  [Knowledge and actions]                     5. Knowledge
 *
 * Each stage lists the units of this project that live on it. Pure markup, no hooks,
 * so it can be used from server pages (home, Unit 1, conclusion).
 */
export type StagePlacement = { stage: 1 | 2 | 3 | 4 | 5; units: string[] };

export const DEFAULT_PLACEMENTS: StagePlacement[] = [
  { stage: 1, units: ["Unit 1 · objective, subject area, data"] },
  { stage: 2, units: ["Unit 1 · clean, transform, split", "Unit 2 · explore (descriptive)", "Unit 3 · explore (inferential)"] },
  { stage: 3, units: ["Unit 1 · how models are validated", "Unit 4 · regression", "Unit 5 · anomaly detection", "Unit 6 · time series models"] },
  { stage: 4, units: ["Unit 6 · forecast the test months"] },
  { stage: 5, units: ["Conclusion · knowledge and actions"] },
];

const STAGES: Record<number, string> = { 1: "Prior knowledge", 2: "Preparation", 3: "Modeling", 4: "Application", 5: "Knowledge" };

function Box({ children, className, muted = false }: { children: React.ReactNode; className?: string; muted?: boolean }) {
  return (
    <div className={cn("rounded-md border px-3 py-2 text-center text-[13px] leading-snug", muted ? "border-dashed bg-muted/40 text-muted-foreground" : "border-foreground/70 bg-background font-medium", className)}>
      {children}
    </div>
  );
}

function Arrow({ dir = "down", className }: { dir?: "down" | "right" | "down-left" | "down-right"; className?: string }) {
  const glyph = { down: "↓", right: "→", "down-left": "↙", "down-right": "↘" }[dir];
  return <div className={cn("select-none text-center text-lg leading-none text-muted-foreground", className)}>{glyph}</div>;
}

function StageLabel({ n, highlight, placements }: { n: 1 | 2 | 3 | 4 | 5; highlight: boolean; placements: StagePlacement[] }) {
  const units = placements.find((p) => p.stage === n)?.units ?? [];
  return (
    <div className={cn("flex flex-col gap-1 rounded-md px-2 py-1", highlight && "bg-teal-50 ring-1 ring-teal-300")}>
      <div className="text-[13px] font-semibold">
        {n}. {STAGES[n]}
      </div>
      {units.map((u) => (
        <span key={u} className="w-fit rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
          {u}
        </span>
      ))}
    </div>
  );
}

export function ProcessDiagram({ highlight = [], placements = DEFAULT_PLACEMENTS, className }: { highlight?: number[]; placements?: StagePlacement[]; className?: string }) {
  const hl = (n: number) => highlight.includes(n);
  const row = (n: 1 | 2 | 3 | 4 | 5, hi: boolean) => cn("rounded-md", hi && "bg-teal-50/60 ring-1 ring-teal-200");
  return (
    <div className={cn("overflow-x-auto rounded-lg border bg-background p-4", className)}>
      <div className="grid min-w-[640px] grid-cols-[150px_1fr_220px] items-center gap-x-3 gap-y-1 text-sm">
        {/* 1. Prior knowledge */}
        <div />
        <div className={cn("grid grid-cols-2 gap-3 p-1", row(1, hl(1)))}>
          <Box>Business understanding</Box>
          <Box>Data understanding</Box>
        </div>
        <StageLabel n={1} highlight={hl(1)} placements={placements} />

        <div />
        <div className="grid grid-cols-2">
          <Arrow dir="down-right" />
          <Arrow dir="down-left" />
        </div>
        <div />

        {/* 2. Preparation */}
        <div />
        <div className={cn("p-1", row(2, hl(2)))}>
          <Box className="mx-auto w-2/3">Prepare data</Box>
        </div>
        <StageLabel n={2} highlight={hl(2)} placements={placements} />

        <div />
        <Arrow />
        <div />

        {/* 3. Modeling */}
        <Box muted>Training data</Box>
        <div className={cn("grid grid-cols-[20px_1fr] items-center p-1", row(3, hl(3)))}>
          <Arrow dir="right" />
          <Box>Building model using algorithms</Box>
        </div>
        <StageLabel n={3} highlight={hl(3)} placements={placements} />

        <div />
        <Arrow />
        <div />

        <Box muted>Test data</Box>
        <div className={cn("grid grid-cols-[20px_1fr] items-center p-1", row(3, hl(3)))}>
          <Arrow dir="right" />
          <Box>Applying model and performance evaluation</Box>
        </div>
        <div />

        <div />
        <Arrow />
        <div />

        {/* 4. Application */}
        <div />
        <div className={cn("p-1", row(4, hl(4)))}>
          <Box className="mx-auto w-2/3">Deployment</Box>
        </div>
        <StageLabel n={4} highlight={hl(4)} placements={placements} />

        <div />
        <Arrow />
        <div />

        {/* 5. Knowledge */}
        <div />
        <div className={cn("p-1", row(5, hl(5)))}>
          <Box className="mx-auto w-2/3">Knowledge and actions</Box>
        </div>
        <StageLabel n={5} highlight={hl(5)} placements={placements} />
      </div>
    </div>
  );
}
