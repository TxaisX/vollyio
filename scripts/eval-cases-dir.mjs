// Which directory the eval tooling reads by default.
//
// There are two, and pointing at the wrong one has already cost real time.
// `evals/cases/` is gitignored local scratch (.gitignore) that whatever ingest
// run happened last dumps into: it is not reviewed, not committed, and not what
// `BASELINE.json` resolves to. `evals/cases-pro-regression/` is the tracked set,
// the one the committed baseline was measured against and the only one a second
// machine or CI can even see.
//
// The labeling and coverage tools defaulted to scratch. That is why coverage
// reported hundreds of unlabeled cases and a 28-hour labeling job: it was
// counting a scratch dump nobody intended to hand-label, while the reviewed set
// it should have been reporting on is 23 files with notes on every one.
//
// So the default is the tracked set, and scratch is opt-in via --scratch or an
// explicit --cases <dir>. Reporting a number about a directory that is not under
// version control is how a coverage figure becomes unreproducible.

export const TRACKED_CASES_DIR = "evals/cases-pro-regression";
export const SCRATCH_CASES_DIR = "evals/cases";

/**
 * Resolve the case directory from argv.
 *   (default)        -> the tracked set
 *   --scratch        -> the local ingest scratch dir
 *   --cases <dir>    -> an explicit directory
 */
export function resolveCasesDir(argv = process.argv.slice(2)) {
  const explicit = argv.indexOf("--cases");
  if (explicit !== -1 && argv[explicit + 1]) return argv[explicit + 1];
  if (argv.includes("--scratch")) return SCRATCH_CASES_DIR;
  return TRACKED_CASES_DIR;
}
