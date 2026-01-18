import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export type LoadedSpecification = {
  id: string;
  label: string;
  description: string;
  topN: number;
  spec: unknown;
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params;
  if (!name.endsWith(".json"))
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  const filePath = path.join(process.cwd(), "specifications", name);
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as LoadedSpecification;

  return NextResponse.json(parsed);
}
