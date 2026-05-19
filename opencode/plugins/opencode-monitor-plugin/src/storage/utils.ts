export function datePartition(): string {
  return new Date().toISOString().slice(0, 10);
}
