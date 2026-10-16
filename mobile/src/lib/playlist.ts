import { Clip, MAX_BYTES } from "./animation";
export type QueueItem = { id: string; clip: Clip; seconds: number };
export function packQueue(items: QueueItem[]) {
  if (!items.length || items.length > 8)
    throw new Error("Elegí entre 1 y 8 elementos.");
  const size = 5 + items.reduce((n, item) => n + 2 + item.clip.bytes.length, 0);
  if (size > MAX_BYTES)
    throw new Error(
      "La cola supera 40 KB. Quitá elementos o importá fragmentos más cortos.",
    );
  const data = new Uint8Array(size);
  data.set([67, 66, 81, 49, items.length]);
  let offset = 5;
  for (const item of items) {
    if (
      !Number.isInteger(item.seconds) ||
      item.seconds < 1 ||
      item.seconds > 300
    )
      throw new Error("Cada elemento debe mostrarse entre 1 y 300 segundos.");
    data.set([item.seconds & 255, item.seconds >> 8], offset);
    offset += 2;
    data.set(item.clip.bytes, offset);
    offset += item.clip.bytes.length;
  }
  return data;
}
