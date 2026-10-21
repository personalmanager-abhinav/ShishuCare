// Ephemeral, bounded isolate cache. Never persist queries or share them with analytics.
export class QueryVectorCache {
  private entries = new Map<string, { vector: number[]; expires: number }>();
  constructor(private capacity = 128, private ttl = 300_000) {}
  get(key: string, now = Date.now()) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    if (entry.expires <= now) return undefined;
    this.entries.set(key, entry);
    return [...entry.vector];
  }
  set(key: string, vector: number[], now = Date.now()) {
    if (!vector.length || !vector.every(Number.isFinite)) return;
    this.entries.delete(key);
    this.entries.set(key, { vector: [...vector], expires: now + this.ttl });
    while (this.entries.size > this.capacity) this.entries.delete(this.entries.keys().next().value!);
  }
}
