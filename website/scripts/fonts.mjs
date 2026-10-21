import { mkdir, copyFile, writeFile } from 'node:fs/promises';
await mkdir('public/fonts', { recursive: true });
const weights = [400, 500, 600, 700];
for (const weight of weights)
  await copyFile(
    `node_modules/@fontsource/poppins/files/poppins-latin-${weight}-normal.woff2`,
    `public/fonts/poppins-latin-${weight}-normal.woff2`,
  );
await copyFile('node_modules/@fontsource/poppins/LICENSE', 'public/fonts/Poppins-LICENSE.txt');
await writeFile(
  'public/fonts/poppins.css',
  weights
    .map(
      (weight) =>
        `@font-face{font-family:'Poppins';font-style:normal;font-weight:${weight};font-display:swap;src:url('./poppins-latin-${weight}-normal.woff2') format('woff2');}`,
    )
    .join('\n'),
);
