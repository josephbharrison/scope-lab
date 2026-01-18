import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export type SpecListItem = {
  id: string;
  label: string;
  description: string;
  filename: string;
};

export async function GET() {
  const dir = path.join(process.cwd(), "specifications");
  const files = await fs.readdir(dir);

  const items: SpecListItem[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const raw = await fs.readFile(path.join(dir, f), "utf8");
    const parsed = JSON.parse(raw) as {
      id?: string;
      label?: string;
      description?: string;
    };
    items.push({
      id: parsed.id ?? f.replace(/\.json$/, ""),
      label: parsed.label ?? f,
      description: parsed.description ?? "",
      filename: f,
    });
  }

  items.sort((a, b) => a.label.localeCompare(b.label));
  return NextResponse.json(items);
}
