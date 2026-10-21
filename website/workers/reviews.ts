import { z } from 'zod';
import { hash, limit } from './auth';
import type { Env } from './types';
export const reviewInput = z
  .object({
    product_id: z.string().regex(/^P\d+$/),
    name: z.string().trim().min(2).max(40),
    avatar: z.enum(['initial', 'flower', 'moon', 'leaf']),
    rating: z.number().int().min(1).max(5),
    review: z.string().trim().min(10).max(600),
    consent: z.literal(true),
    website: z.literal(''),
  })
  .strict();
export async function submitReview(env: Env, input: unknown, ip: string, ids: Set<string>) {
  const parsed = reviewInput.safeParse(input);
  if (!parsed.success || !ids.has(parsed.data.product_id))
    return {
      status: 400,
      data: { error: 'Please check the name, rating, note and display consent.' },
    };
  if (!(await limit(env, `reviews:${ip}`, 3, new Date(Date.now() + 86400000).toISOString())))
    return { status: 429, data: { error: 'Please try again tomorrow.' } };
  const p = parsed.data,
    id = crypto.randomUUID(),
    token = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO product_reviews(id,product_id,display_name,avatar,rating,review_text,created_at,deletion_hash) VALUES(?,?,?,?,?,?,?,?)',
  )
    .bind(
      id,
      p.product_id,
      p.name,
      p.avatar,
      p.rating,
      p.review,
      new Date().toISOString(),
      await hash(token),
    )
    .run();
  return { status: 201, data: { id, token, status: 'pending' } };
}
export async function publicReviews(env: Env, ids: string[]) {
  const result = await env.DB.prepare(
    `SELECT id,product_id,display_name,avatar,rating,review_text,created_at FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY created_at DESC) AS position FROM product_reviews WHERE status='approved') WHERE position<=10 ORDER BY created_at DESC LIMIT 500`,
  ).all();
  return result.results.filter((row) => ids.includes(String(row.product_id)));
}
export const moderationHtml = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Parent notes — owner review</title><link rel="stylesheet" href="/fonts/poppins.css"><style>body{font:14px Poppins,sans-serif;background:#fff8fb;color:#51474d;max-width:900px;margin:40px auto;padding:20px}article{background:white;border:1px solid #eddce4;border-radius:18px;padding:20px;margin:16px 0}button,select{font:inherit;padding:10px;border:1px solid #eddce4;border-radius:10px;margin-right:8px;background:#fceaf2}p{white-space:pre-wrap}a{color:inherit}</style><a href="/internal/">← Analytics</a><h1>Parent notes</h1><p>Review for relevance, personal information and abuse. Negative experiences are welcome. These submissions are not purchase-verified.</p><label>Show <select id="filter"><option>pending</option><option>approved</option><option>rejected</option></select></label><p id="status" role="status"></p><div id="reviews"></div><script>
async function load(){try{const response=await fetch('/internal/api/reviews?status='+document.querySelector('#filter').value);if(!response.ok)throw Error('Unable to load reviews.');const data=await response.json();const root=document.querySelector('#reviews');root.replaceChildren();for(const r of data.reviews){const item=document.createElement('article');const heading=document.createElement('h2');heading.textContent=r.product_id+' · '+r.display_name;const note=document.createElement('p');note.textContent=r.review_text;const meta=document.createElement('p');meta.textContent='Rating '+r.rating+'/5 · '+r.created_at+' · Not purchase-verified';item.append(heading,note,meta);for(const action of ['approved','rejected','delete']){const button=document.createElement('button');button.textContent=action==='approved'?'Publish':action==='rejected'?'Keep private':'Delete';button.onclick=async()=>{button.disabled=true;try{const response=await fetch('/internal/api/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:r.id,status:action})});if(!response.ok)throw Error('Could not update review.');await load();}catch(e){document.querySelector('#status').textContent=e.message;button.disabled=false;}};item.append(button);}root.append(item);}document.querySelector('#status').textContent=data.reviews.length?'':'No notes in this queue.';}catch(e){document.querySelector('#status').textContent=e.message;}}
document.querySelector('#filter').onchange=load;load();</script></html>`;
