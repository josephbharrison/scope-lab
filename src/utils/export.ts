// src/utils/export.ts
import type { SweepResult } from "../optics/sweep";
import type { OpticDesignKind, Units, Candidate } from "../optics/types";
import { candidateLabel, fmtLength, fmtNumber, fmtPercent } from "../ui/format";

type ExportOptions = {
  includeCandidateData?: boolean;
  includePlan?: boolean;
  includeAudit?: boolean;
  includeFullCandidate?: boolean;
  maxCandidates?: number;
};

function safeJsonStringify(value: unknown, space: number = 2): string {
  const seen = new WeakSet<object>();

  return JSON.stringify(
    value,
    (_key, v: unknown) => {
      if (typeof v === "bigint") return v.toString();
      if (typeof v === "object" && v !== null) {
        if (seen.has(v)) return "[Circular]";
        seen.add(v);
      }
      return v;
    },
    space,
  );
}

function codeBlockJson(label: string, value: unknown): string[] {
  const out: string[] = [];
  out.push(`### ${label}`);
  out.push("");
  out.push("```json");
  out.push(safeJsonStringify(value, 2) ?? "");
  out.push("```");
  out.push("");
  return out;
}

export function exportSweepResultsMarkdown(
  result: SweepResult,
  tubeUnits: Units,
  opts?: ExportOptions,
): string {
  const options: Required<ExportOptions> = {
    includeCandidateData: opts?.includeCandidateData ?? true,
    includePlan: opts?.includePlan ?? true,
    includeAudit: opts?.includeAudit ?? true,
    includeFullCandidate: opts?.includeFullCandidate ?? false,
    maxCandidates: opts?.maxCandidates ?? result.top.length,
  };

  const lines: string[] = [];

  lines.push("# scope-lab sweep results");
  lines.push("");

  const bestOverall = result.bestOverall;
  if (bestOverall) {
    lines.push("## Best overall");
    lines.push("");
    lines.push(`- **${candidateLabel(bestOverall)}**`);
    lines.push(`- score: ${fmtNumber(bestOverall.score.total, 3)}`);
    lines.push(
      `- tube: ${fmtLength(bestOverall.geometry.tubeLength_mm, tubeUnits, 1)}`,
    );
    lines.push(
      `- obstruction: ${fmtPercent(bestOverall.geometry.obstructionRatio, 1)}`,
    );
    lines.push(
      `- efficiency: ${fmtPercent(bestOverall.throughput.usableLightEfficiency, 1)}`,
    );
    lines.push("");
  }

  lines.push("## Best by kind");
  lines.push("");
  (["newtonian", "cassegrain", "sct", "rc"] as OpticDesignKind[]).forEach(
    (kind) => {
      const c = result.bestByKind[kind];
      if (!c) {
        lines.push(`- **${kind}**: none`);
        return;
      }

      lines.push(
        `- **${kind}**: ${candidateLabel(c)} | score ${fmtNumber(c.score.total, 3)} | tube ${fmtLength(
          c.geometry.tubeLength_mm,
          tubeUnits,
          1,
        )} | obs ${fmtPercent(c.geometry.obstructionRatio, 1)} | eff ${fmtPercent(
          c.throughput.usableLightEfficiency,
          1,
        )}`,
      );
    },
  );

  lines.push("");
  lines.push(`## Top ${result.top.length}`);
  lines.push("");

  lines.push(
    "| candidate | score | tube | obs | eff | usable | aberr | tubeTerm | obsTerm |",
  );
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|");

  for (const c of result.top) {
    lines.push(
      `| ${candidateLabel(c)} | ${fmtNumber(c.score.total, 3)} | ${fmtLength(
        c.geometry.tubeLength_mm,
        tubeUnits,
        1,
      )} | ${fmtPercent(c.geometry.obstructionRatio, 1)} | ${fmtPercent(
        c.throughput.usableLightEfficiency,
        1,
      )} | ${fmtNumber(c.score.terms.usableLight, 3)} | ${fmtNumber(
        c.score.terms.aberration,
        3,
      )} | ${fmtNumber(c.score.terms.tubeLength, 3)} | ${fmtNumber(c.score.terms.obstruction, 3)} |`,
    );
  }

  lines.push("");
  lines.push(
    `_Candidates generated: ${result.candidates.length}, passing: ${result.ranked.length}_`,
  );

  if (!options.includeCandidateData) {
    return lines.join("\n");
  }

  const dump: Candidate[] = result.top.slice(
    0,
    Math.max(0, options.maxCandidates | 0),
  );

  lines.push("");
  lines.push("## Candidate data");
  lines.push("");
  lines.push(
    `Included: ${[
      options.includePlan ? "plan" : null,
      options.includeAudit ? "audit" : null,
      options.includeFullCandidate ? "full-candidate" : "core-fields",
    ]
      .filter((x): x is string => typeof x === "string" && x.length > 0)
      .join(", ")}`,
  );
  lines.push("");

  for (const c of dump) {
    lines.push(`### ${candidateLabel(c)}`);
    lines.push("");

    if (options.includeFullCandidate) {
      lines.push(...codeBlockJson("candidate", c));
      continue;
    }

    if (options.includePlan) {
      lines.push(...codeBlockJson("plan", c.plan));
    }

    lines.push(
      ...codeBlockJson("metrics", {
        id: c.id,
        kind: c.kind,
        inputs: c.inputs,
        geometry: c.geometry,
        throughput: c.throughput,
        aberrations: c.aberrations,
        constraints: c.constraints,
        score: c.score,
      }),
    );

    if (options.includeAudit) {
      lines.push(...codeBlockJson("audit", c.audit ?? null));
    }
  }

  return lines.join("\n");
}
