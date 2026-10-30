import type { Product } from './product';

export const ageStages = [
  { id: 'newborn', label: 'Newborn · 0–3 months', min: 0, max: 3 },
  { id: '3-6', label: '3–6 months', min: 3, max: 6 },
  { id: '6-12', label: '6–12 months', min: 6, max: 12 },
  { id: '12-24', label: '1–2 years', min: 12, max: 24 },
] as const;

// A stage match means the verified range covers the entire stage, not just one boundary.
export function matchesAgeStage(product: Product, stageId: string): boolean {
  if (!stageId) return true;
  const stage = ageStages.find((candidate) => candidate.id === stageId);
  const suitability = product.age_suitability;
  return Boolean(
    stage && suitability && suitability.min_months <= stage.min && suitability.max_months >= stage.max,
  );
}
