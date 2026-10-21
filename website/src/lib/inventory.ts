import { z } from 'zod';
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const time = Date.parse(value);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
  }, 'Invalid calendar day');
export const inventoryImport = z
  .object({
    source: z.string().trim().min(2).max(100),
    observed_at: z.iso.datetime(),
    skus: z
      .array(
        z
          .object({
            sku: z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/),
            product_id: z.string().regex(/^P\d+$/),
            variant: z.string().trim().min(1).max(80),
            stock_on_hand: z.number().int().min(0).max(10000000),
            lead_days: z.number().int().min(0).max(365),
            safety_days: z.number().int().min(0).max(90),
          })
          .strict(),
      )
      .min(1)
      .max(50),
    sales: z
      .array(
        z
          .object({
            sku: z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/),
            day,
            units_sold: z.number().int().min(0).max(10000000),
            units_returned: z.number().int().min(0).max(10000000),
          })
          .strict(),
      )
      .max(150),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (new Set(input.skus.map((s) => s.sku)).size !== input.skus.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate SKU' });
    const keys = input.sales.map((s) => `${s.sku}:${s.day}`);
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate sales day' });
    for (const row of input.sales)
      if (!input.skus.some((s) => s.sku === row.sku))
        ctx.addIssue({ code: 'custom', message: 'Sales require a SKU in this batch' });
  });
export type InventoryRow = z.infer<typeof inventoryImport>['skus'][number] & {
  observed_at: string;
  source: string;
};
export type SalesRow = z.infer<typeof inventoryImport>['sales'][number];
export function inventoryOutlook(sku: InventoryRow, sales: SalesRow[], now = Date.now()) {
  // Completed India calendar days only. Missing days are unknown, never assumed zero.
  const end = new Date(Math.floor((now + 19800000) / 86400000) * 86400000)
    .toISOString()
    .slice(0, 10);
  const start = new Date(Date.parse(end) - 28 * 86400000).toISOString().slice(0, 10);
  const rows = sales.filter((s) => s.sku === sku.sku && s.day >= start && s.day < end);
  const days = new Set(rows.map((s) => s.day)).size;
  const sold = rows.reduce((n, s) => n + s.units_sold, 0),
    returned = rows.reduce((n, s) => n + s.units_returned, 0);
  const stale = now - Date.parse(sku.observed_at) > 86400000 || Date.parse(sku.observed_at) > now;
  const usable = days === 28 && !stale;
  const daily = usable ? sold / 28 : null;
  return {
    ...sku,
    period_start: start,
    period_end_exclusive: end,
    observed_days: days,
    units_sold: sold,
    units_returned: returned,
    status: stale
      ? 'stale_stock'
      : days !== 28
        ? 'incomplete_sales'
        : sold === 0
          ? 'no_observed_sales'
          : 'baseline_available',
    daily_units: daily,
    days_of_cover: daily && daily > 0 ? sku.stock_on_hand / daily : null,
    reorder_units:
      daily !== null
        ? Math.max(0, Math.ceil(daily * (sku.lead_days + sku.safety_days)) - sku.stock_on_hand)
        : null,
  };
}
