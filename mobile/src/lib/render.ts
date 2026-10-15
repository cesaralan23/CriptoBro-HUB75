import fonts from "./fonts.json";
import { Settings, Quote, symbols } from "./model";
export function lines(s: Settings, q: Quote, coin: number) {
  const top =
    s.mode === "text"
      ? s.message
      : `${symbols[coin]} ${q.valid ? q.price.toFixed(2) : "--.--"} ${coin === 2 ? "USD" : "USDT"}`;
  const bottom =
    s.mode === "text"
      ? ""
      : !q.valid
        ? "CARGANDO"
        : q.stale
          ? "DATO VIEJO"
          : `${q.change >= 0 ? "+" : ""}${q.change.toFixed(2)}% ${coin === 2 ? "DIA" : "24H"}${coin === 2 && q.closed ? " CER" : ""}`;
  return { top, bottom };
}
export function frame(
  s: Settings,
  q: Quote,
  coin: number,
  x: number,
): string[] {
  const pixels = Array<string>(2048).fill("000000");
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    for (let py = Math.max(0, y); py < Math.min(32, y + h); py++)
      for (let px = Math.max(0, x); px < Math.min(64, x + w); px++)
        pixels[py * 64 + px] = c;
  };
  function text(
    x: number,
    y: number,
    value: string,
    c: string,
    compact = s.font === "compact",
  ) {
    for (const ch of value) {
      if (compact) {
        const rows = (fonts.compact as Record<string, number[]>)[ch] ?? [];
        rows.forEach((bits, row) => {
          for (let col = 0; col < 3; col++)
            if (bits & (4 >> col)) rect(x + col * 2, y + row * 2, 2, 2, c);
        });
      } else {
        for (let col = 0; col < 5; col++) {
          const bits = fonts.classic[ch.charCodeAt(0) * 5 + col] ?? 0;
          for (let row = 0; row < 8; row++)
            if (bits & (1 << row)) rect(x + col * 2, y + row * 2, 2, 2, c);
        }
      }
      x += compact ? 8 : 12;
    }
  }
  const { top, bottom } = lines(s, q, coin),
    offset = s.showLogo ? s.textX : 0;
  text(x + offset, s.top, top, s.priceColor);
  text(
    x + offset,
    s.bottom,
    bottom,
    !q.valid || q.stale
      ? "FF7D00"
      : q.change > 0
        ? s.positiveColor
        : q.change < 0
          ? s.negativeColor
          : "5A6978",
  );
  if (s.showLogo) {
    if (coin === 0) {
      for (let py = -8; py <= 8; py++) {
        const half = Math.round(Math.sqrt(64 - py * py));
        rect(x + 8 - half, 16 + py, half * 2 + 1, 1, "FF7D00");
      }
      text(x + 6, 12, "B", "DCEBFF", true);
      rect(x + 8, 10, 2, 2, "DCEBFF");
      rect(x + 8, 22, 2, 2, "DCEBFF");
    } else if (coin === 1) {
      ["00DCFF", "AA32FF", "00FF46"].forEach((c, row) =>
        rect(x + (row === 1 ? 0 : 2), 10 + row * 4, 14, 2, c),
      );
    } else {
      rect(x + 4, 8, 8, 16, "FF7D00");
      rect(x, 12, 16, 8, "FF7D00");
      rect(x + 2, 10, 12, 12, "FF7D00");
      text(x + 6, 12, "S", "DCEBFF", true);
    }
  }
  rect(0, 0, s.inset, 32, "000000");
  rect(64 - s.inset, 0, s.inset, 32, "000000");
  return pixels;
}
