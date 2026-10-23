import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

type Props = {
  module?: string;
  title: string;
  description: string;
  /** Short chips listing the syllabus concepts covered on the page. */
  concepts?: string[];
  children: ReactNode;
};

export function PageShell({ module, title, description, concepts, children }: Props) {
  return (
    <div className="flex min-h-svh min-w-0 flex-1 flex-col overflow-x-hidden">
      <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 h-4" />
        <span className="text-sm text-muted-foreground">Applied Data Science</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">{title}</span>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 space-y-8 px-4 py-6 md:px-8">
        <div className="space-y-3">
          {module && (
            <Badge variant="secondary" className="rounded-md font-mono text-[11px]">
              Module {module}
            </Badge>
          )}
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-[15px]">{description}</p>
          {concepts && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {concepts.map((c) => (
                <Badge key={c} variant="outline" className="rounded-md text-[11px] font-normal">
                  {c}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {children}
      </main>
    </div>
  );
}
