export type Settings = {
  name: string;
  font: "compact" | "classic";
  mode: "ticker" | "text";
  message: string;
  brightness: number;
  interval: number;
  top: number;
  bottom: number;
  inset: number;
  textX: number;
  showLogo: boolean;
  priceColor: string;
  positiveColor: string;
  negativeColor: string;
  coins: number[];
};
export type Quote = {
  symbol: string;
  price: number;
  change: number;
  valid: boolean;
  closed: boolean;
  stale: boolean;
  timestamp: number;
};
export type Device = {
  id: string;
  name: string;
  address: string;
  version: string;
  api: number;
  width: number;
  height: number;
  paired: boolean;
};
export type State = {
  id: string;
  version: string;
  settings: Settings;
  quotes: Quote[];
};
export const defaults: Settings = {
  name: "CriptoBro",
  font: "compact",
  mode: "ticker",
  message: "HOLA CRIPTOBRO",
  brightness: 50,
  interval: 140,
  top: 4,
  bottom: 18,
  inset: 2,
  textX: 20,
  showLogo: true,
  priceColor: "DCEBFF",
  positiveColor: "00FF46",
  negativeColor: "FF191E",
  coins: [0, 1, 2],
};
export const symbols = ["BTC", "SOL", "MSTR"];
export const demoQuotes: Quote[] = [81648, 104.09, 142.94].map((price, i) => ({
  symbol: symbols[i],
  price,
  change: [1.66, -3.24, -6.07][i],
  valid: true,
  closed: false,
  stale: false,
  timestamp: 0,
}));
export function localAddress(input: string) {
  const s = input.trim().replace(/^http:\/\//, "");
  const m = s.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{1,5}))?\/?$/);
  if (!m) throw new Error("Ingresá una IP local, por ejemplo 192.168.1.96");
  const n = m[1].split(".").map(Number),
    port = Number(m[2] ?? 8080);
  if (
    n.some((x) => x > 255) ||
    !(
      n[0] === 10 ||
      (n[0] === 192 && n[1] === 168) ||
      (n[0] === 172 && n[1] >= 16 && n[1] <= 31)
    ) ||
    port < 1 ||
    port > 65535
  )
    throw new Error("La dirección debe pertenecer a tu red local");
  return `${n.join(".")}:${port}`;
}
export function validateSettings(s: Settings) {
  if (!s.name.trim() || s.name.length > 24 || !/^[ -~]+$/.test(s.name))
    return "Usá un nombre de 1 a 24 caracteres sin acentos";
  if (s.message.length > 80 || !/^[A-Z0-9 .+%\-]*$/.test(s.message))
    return "Texto: hasta 80 letras A–Z, números, espacios, puntos, +, - o %";
  if (
    !s.coins.length ||
    s.coins.length > 3 ||
    new Set(s.coins).size !== s.coins.length ||
    s.coins.some((c) => ![0, 1, 2].includes(c))
  )
    return "Elegí al menos una moneda";
  if (
    !["compact", "classic"].includes(s.font) ||
    !["ticker", "text"].includes(s.mode)
  )
    return "Formato inválido";
  const h = s.font === "compact" ? 10 : 14;
  if (!Number.isInteger(s.brightness) || s.brightness < 0 || s.brightness > 80)
    return "Brillo: 0 a 80%";
  if (!Number.isInteger(s.interval) || s.interval < 40 || s.interval > 1000)
    return "Velocidad fuera de rango";
  for (const y of [s.top, s.bottom])
    if (!Number.isInteger(y) || y < 0 || y + h > 32 || y % 2)
      return "El renglón no cabe en la pantalla";
  if (
    s.inset < 0 ||
    s.inset > 8 ||
    s.inset % 2 ||
    s.textX < 0 ||
    s.textX > 40 ||
    s.textX % 2
  )
    return "Posición inválida";
  if (
    [s.priceColor, s.positiveColor, s.negativeColor].some(
      (c) => !/^([0-9a-f]{6})$/i.test(c),
    )
  )
    return "Color inválido";
  return null;
}
