import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
try {
  await readFile('.dev.vars');
  console.log('.dev.vars already exists; left unchanged.');
} catch {
  await writeFile('.dev.vars', `LOCAL_ADMIN_TOKEN=${randomBytes(32).toString('hex')}\n`);
  console.log('Created local dashboard token in ignored .dev.vars.');
}
