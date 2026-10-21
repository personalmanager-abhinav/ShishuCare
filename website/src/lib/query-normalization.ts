// Deliberately conservative spelling aliases: no fuzzy rewriting of prices or negation.
const aliases: Record<string, string> = {
  bule: 'blue', pnik: 'pink', creem: 'cream',
  cotten: 'cotton', shawel: 'shawl',
  swadle: 'swaddle', swaddel: 'swaddle', daiper: 'diaper',
  daipers: 'diaper', diapars: 'diaper', sockes: 'socks',
};
export function normalizeQuery(query: string) {
  return query.replace(/[a-z]+/gi, word => aliases[word.toLowerCase()] || word);
}
