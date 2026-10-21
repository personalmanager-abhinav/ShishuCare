import type { Env } from './types';
export async function operationalHealth(env: Env) {
  const job = await env.DB.prepare("SELECT completed_at FROM job_runs WHERE name='maintenance'").first<{ completed_at: string }>();
  const pending = await env.DB.prepare('SELECT COUNT(*) count, MIN(requested_at) oldest FROM deletion_requests WHERE completed_at IS NULL').first<{ count: number; oldest: string | null }>();
  const archives = await env.DB.prepare('SELECT COUNT(*) count FROM (SELECT DISTINCT substr(received_at,1,10) FROM events WHERE received_at<? AND substr(received_at,1,10) NOT IN (SELECT day FROM archive_manifest))').bind(new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10)).first<{ count: number }>();
  const warnings: string[] = [];
  if (!job || Date.now() - Date.parse(job.completed_at) > 3 * 3600000) warnings.push('Maintenance has not completed in the last three hours.');
  if (pending?.oldest && Date.now() - Date.parse(pending.oldest) > 86400000) warnings.push('A history deletion has waited more than 24 hours.');
  if ((archives?.count || 0) > 4) warnings.push('Archive export is more than one maintenance batch behind.');
  return { status: warnings.length ? 'attention' : 'ok', warnings, last_maintenance: job?.completed_at || null, pending_deletions: pending?.count || 0, unarchived_days: archives?.count || 0, as_of: new Date().toISOString() };
}
