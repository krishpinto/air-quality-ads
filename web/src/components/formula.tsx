import katex from "katex";
import { cn } from "@/lib/utils";

type Props = {
  tex: string;
  /** Display (block, centred) or inline maths. */
  display?: boolean;
  className?: string;
};

/**
 * Renders LaTeX with KaTeX. Works in server and client components because
 * katex.renderToString is pure string → string.
 */
export function Formula({ tex, display = true, className }: Props) {
  const html = katex.renderToString(tex, {
    displayMode: display,
    throwOnError: false,
    strict: "ignore",
    output: "html",
  });
  return (
    <span
      className={cn(display ? "block overflow-x-auto py-1 text-[1.02rem]" : "inline", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function Tex({ children, className }: { children: string; className?: string }) {
  return <Formula tex={children} display={false} className={className} />;
}
