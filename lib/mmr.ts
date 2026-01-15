export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export type MmrCandidate<T> = { item: T; vector: number[]; baseScore?: number };

export function mmrSelect<T>(
  queryVector: number[],
  candidates: Array<MmrCandidate<T>>,
  k: number,
  lambda = 0.5
): Array<MmrCandidate<T>> {
  const selected: Array<MmrCandidate<T>> = [];
  const remaining = [...candidates];

  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const lam = clamp(lambda);

  while (selected.length < k && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i]!;
      const simToQuery = cosineSimilarity(queryVector, c.vector);
      let maxSimToSelected = 0;

      for (const s of selected) {
        const sim = cosineSimilarity(c.vector, s.vector);
        if (sim > maxSimToSelected) maxSimToSelected = sim;
      }

      const mmr = lam * simToQuery - (1 - lam) * maxSimToSelected;
      if (mmr > bestScore) {
        bestScore = mmr;
        bestIdx = i;
      }
    }

    selected.push(remaining.splice(bestIdx, 1)[0]!);
  }

  return selected;
}
