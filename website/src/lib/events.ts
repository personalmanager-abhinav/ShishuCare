import { z } from 'zod';
const id = z.uuid();
const source = z.enum(['catalogue', 'product_detail', 'search']);
const recommendationProperties = z
  .object({
    recommendation_id: id,
    position: z.number().int().min(1).max(6),
    model_version: z.string().min(1).max(60),
    experiment_id: z.string().min(1).max(60),
    variant: z.enum(['content', 'hybrid']),
    placement: z.enum(['product_detail', 'product_modal']),
  })
  .strict();
const bargainProperties = z
  .object({
    placement: z.enum(['product_detail', 'product_modal']),
    attempts_remaining: z.number().int().min(0).max(3).optional(),
    mode: z.literal('demo'),
  })
  .strict();
const properties = {
  recommendation_impression: recommendationProperties,
  recommendation_click: recommendationProperties,
  page_view: z.object({ page_type: z.enum(['home', 'product', 'other']) }).strict(),
  product_view: z.object({ source_surface: source }).strict(),
  search: z
    .object({
      query: z.string().max(200),
      result_count: z.number().int().min(0).max(10000),
      top_ids: z.array(z.string().max(30)).max(10),
      fallback: z.boolean(),
    })
    .strict(),
  search_result_click: z.object({ position: z.number().int().min(1).max(10000) }).strict(),
  marketplace_button_impression: z
    .object({
      offer_id: z.string().max(80),
      placement: z.enum(['product_detail', 'product_modal']),
    })
    .strict(),
  marketplace_click: z
    .object({
      offer_id: z.string().max(80),
      placement: z.enum(['product_detail', 'product_modal']),
      interaction_id: id,
    })
    .strict(),
  filter_usage: z
    .object({ filter: z.enum(['category', 'budget']), value: z.string().max(50) })
    .strict(),
  sort_usage: z
    .object({ sort: z.enum(['relevance', 'price-low', 'price-high', 'newest']) })
    .strict(),
  bargain_opened: bargainProperties,
  bargain_started: bargainProperties,
  buyer_offer_submitted: bargainProperties,
  bargain_counteroffered: bargainProperties,
  bargain_accepted_demo: bargainProperties,
  bargain_unavailable: bargainProperties,
};
export type EventType = keyof typeof properties;
export const eventSchema = z
  .object({
    event_id: id,
    event_type: z.enum(Object.keys(properties) as [EventType, ...EventType[]]),
    occurred_at: z.iso.datetime(),
    session_id: id,
    page_view_id: id,
    page_path: z
      .string()
      .max(200)
      .regex(/^\/[a-zA-Z0-9/_-]*$/),
    product_id: z.string().max(30).optional(),
    marketplace_id: z.string().max(30).optional(),
    search_id: id.optional(),
    catalogue_version: z.string().max(40),
    properties: z.unknown(),
  })
  .strict()
  .transform((event, ctx) => {
    const result = properties[event.event_type].safeParse(event.properties);
    if (!result.success) {
      ctx.addIssue({ code: 'custom', message: 'Invalid event properties' });
      return z.NEVER;
    }
    if (event.event_type === 'search')
      (result.data as { query: string }).query = redact((result.data as { query: string }).query);
    return { ...event, properties: result.data };
  });
export const batchSchema = z.object({ events: z.array(eventSchema).min(1).max(10) }).strict();
export function redact(text: string) {
  return text
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email]')
    .replace(/(?:\+?\d[\d\s()-]{7,}\d)/g, '[number]')
    .replace(/https?:\/\/\S+/g, '[url]');
}
