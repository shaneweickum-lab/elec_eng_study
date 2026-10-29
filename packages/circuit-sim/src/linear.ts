/**
 * Dense linear solver: Gaussian elimination with partial pivoting.
 *
 * Circuits in the training environments have tens of nodes, so a dense
 * O(n³) solve is both simple and fast. A singular (or numerically singular)
 * system is reported rather than "solved" — callers must never fabricate a
 * result for an ill-posed circuit.
 */

export type LinearSolveResult =
  | { readonly ok: true; readonly x: Float64Array }
  | { readonly ok: false; readonly reason: "singular"; readonly row: number };

export function solveLinearSystem(matrix: ReadonlyArray<ArrayLike<number>>, rhs: ArrayLike<number>): LinearSolveResult {
  const n = rhs.length;
  if (n === 0) return { ok: true, x: new Float64Array(0) };
  const a: Float64Array[] = matrix.map((row) => Float64Array.from(row));
  const b = Float64Array.from(rhs);

  let scale = 0;
  for (const row of a) for (let j = 0; j < n; j++) scale = Math.max(scale, Math.abs(row[j]!));
  const tolerance = Math.max(scale, 1) * 1e-13;

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let pivotMagnitude = Math.abs(a[col]![col]!);
    for (let r = col + 1; r < n; r++) {
      const m = Math.abs(a[r]![col]!);
      if (m > pivotMagnitude) {
        pivotMagnitude = m;
        pivotRow = r;
      }
    }
    if (pivotMagnitude <= tolerance) return { ok: false, reason: "singular", row: col };
    if (pivotRow !== col) {
      [a[col], a[pivotRow]] = [a[pivotRow]!, a[col]!];
      [b[col], b[pivotRow]] = [b[pivotRow]!, b[col]!];
    }
    const pivot = a[col]!;
    for (let r = col + 1; r < n; r++) {
      const row = a[r]!;
      const factor = row[col]! / pivot[col]!;
      if (factor === 0) continue;
      for (let j = col; j < n; j++) row[j] = row[j]! - factor * pivot[j]!;
      b[r] = b[r]! - factor * b[col]!;
    }
  }

  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    const row = a[i]!;
    let sum = b[i]!;
    for (let j = i + 1; j < n; j++) sum -= row[j]! * x[j]!;
    x[i] = sum / row[i]!;
  }
  return { ok: true, x };
}
