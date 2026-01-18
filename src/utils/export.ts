import type { SweepResult } from "../optics/sweep";
import type { OpticDesignKind, Units } from "../optics/types";
import { candidateLabel, fmtLength, fmtNumber, fmtPercent } from "../ui/format";

export function exportSweepResultsMarkdown(
  result: SweepResult,
  tubeUnits: Units,
): string {
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
      `- efficiency: ${fmtPercent(
        bestOverall.throughput.usableLightEfficiency,
        1,
      )}`,
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
        `- **${kind}**: ${candidateLabel(c)} | score ${fmtNumber(
          c.score.total,
          3,
        )} | tube ${fmtLength(
          c.geometry.tubeLength_mm,
          tubeUnits,
          1,
        )} | obs ${fmtPercent(
          c.geometry.obstructionRatio,
          1,
        )} | eff ${fmtPercent(c.throughput.usableLightEfficiency, 1)}`,
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
      )} | ${fmtNumber(
        c.score.terms.tubeLength,
        3,
      )} | ${fmtNumber(c.score.terms.obstruction, 3)} |`,
    );
  }

  lines.push("");
  lines.push(
    `_Candidates generated: ${result.candidates.length}, passing: ${result.ranked.length}_`,
  );

  return lines.join("\n");
}
