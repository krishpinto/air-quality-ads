import { promises as fs } from "fs";
import path from "path";

/**
 * Server-side loader for the JSON files produced by the Python pipeline.
 * Pages are React Server Components, so they read straight from disk and
 * pass plain objects down to the client chart components.
 */
export async function loadData<T = unknown>(name: string): Promise<T> {
  const file = path.join(process.cwd(), "public", "data", `${name}.json`);
  const raw = await fs.readFile(file, "utf-8");
  return JSON.parse(raw) as T;
}
