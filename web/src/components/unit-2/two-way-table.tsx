import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * A properly built two-way table with the teacher's seven parts labelled in the margin:
 * Table number, Title, Headnote, Caption (column headings), Stub (row headings), Body, Footnote.
 */
export type TwoWay = {
  number: string;
  title: string;
  headnote: string;
  stub_head: string;
  caption: string[];
  rows: Array<{ stub: string; cells: number[]; total: number }>;
  total_row: { stub: string; cells: number[]; total: number };
  footnote: string;
};

const n0 = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });

function Part({ children }: { children: string }) {
  return <span className="mr-2 inline-block rounded border border-dashed border-amber-400 bg-amber-50 px-1 py-px font-mono text-[10px] text-amber-800">{children}</span>;
}

export function TwoWayTable({ t }: { t: TwoWay }) {
  return (
    <div className="space-y-1 rounded-lg border p-4">
      <div className="text-xs font-medium">
        <Part>1 Table number</Part>
        {t.number}
      </div>
      <div className="text-sm font-semibold">
        <Part>2 Title</Part>
        {t.title}
      </div>
      <div className="text-xs text-muted-foreground">
        <Part>6 Headnote</Part>
        {t.headnote}
      </div>
      <div className="overflow-x-auto pt-2">
        <Table className="text-[13px] [&_td]:py-1.5 [&_th]:h-8">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="whitespace-nowrap">
                <Part>4 Stub</Part>
                {t.stub_head}
              </TableHead>
              {t.caption.map((c, i) => (
                <TableHead key={c} className="whitespace-nowrap text-right">
                  {i === 0 && <Part>3 Caption</Part>}
                  {c}
                </TableHead>
              ))}
              <TableHead className="text-right font-semibold">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {t.rows.map((r, ri) => (
              <TableRow key={r.stub}>
                <TableCell className="font-medium">{r.stub}</TableCell>
                {r.cells.map((v, i) => (
                  <TableCell key={i} className="text-right tabular-nums">
                    {ri === 0 && i === 0 && <Part>5 Body</Part>}
                    {n0(v)}
                  </TableCell>
                ))}
                <TableCell className="text-right font-semibold tabular-nums">{n0(r.total)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2 bg-muted/30 font-semibold hover:bg-muted/30">
              <TableCell>{t.total_row.stub}</TableCell>
              {t.total_row.cells.map((v, i) => (
                <TableCell key={i} className="text-right tabular-nums">
                  {n0(v)}
                </TableCell>
              ))}
              <TableCell className="text-right tabular-nums">{n0(t.total_row.total)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <div className="pt-1 text-[11px] text-muted-foreground">
        <Part>7 Footnote</Part>
        {t.footnote}
      </div>
    </div>
  );
}
