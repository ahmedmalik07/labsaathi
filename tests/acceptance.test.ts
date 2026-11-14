import { describe, expect, it } from "vitest";
import { EVAL_CASES, runEvalCase } from "@/lib/evals";

/**
 * The acceptance list lives in src/lib/evals.ts so the live /evals page runs
 * exactly the same cases. Each case becomes one Vitest test here.
 */
describe("acceptance cases", () => {
  const groups = [...new Set(EVAL_CASES.map((c) => c.group))];
  for (const group of groups) {
    describe(group, () => {
      for (const c of EVAL_CASES.filter((x) => x.group === group)) {
        it(`${c.id}: ${c.title}`, () => {
          const result = runEvalCase(c);
          const failed = result.checks.filter((x) => !x.pass).map((x) => `${x.label}: want ${x.want}, got ${x.got}`);
          expect(failed).toEqual([]);
          expect(result.checks.length).toBeGreaterThan(0);
        });
      }
    });
  }
});
