export function rankingMetrics(ids: string[], relevantIds: string[], k = 3) {
  if (!Number.isInteger(k) || k < 1) throw new Error('Evaluation cutoff must be positive');
  const relevant = new Set(relevantIds);
  const ranked = [...new Set(ids)].slice(0, k);
  const hits = ranked.filter((id) => relevant.has(id)).length;
  const dcg = ranked.reduce(
    (score, id, i) => score + (relevant.has(id) ? 1 / Math.log2(i + 2) : 0),
    0,
  );
  const ideal = Array.from(
    { length: Math.min(k, relevant.size) },
    (_, i) => 1 / Math.log2(i + 2),
  ).reduce((a, b) => a + b, 0);
  return {
    precision: hits / k,
    recall: relevant.size ? hits / relevant.size : 0,
    ndcg: ideal ? dcg / ideal : 0,
  };
}
