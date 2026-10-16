import { Settings } from "./model";
export const presets: {
  name: string;
  detail: string;
  color: string;
  settings: Partial<Settings>;
}[] = [
  {
    name: "Cripto clásico",
    detail: "Blanco, verde y rojo",
    color: "#DCEBFF",
    settings: {
      font: "compact",
      top: 4,
      bottom: 18,
      inset: 2,
      textX: 20,
      showLogo: true,
      priceColor: "DCEBFF",
      positiveColor: "00FF46",
      negativeColor: "FF191E",
      interval: 140,
    },
  },
  {
    name: "Neón",
    detail: "Cian y violeta",
    color: "#00DCFF",
    settings: {
      font: "compact",
      top: 4,
      bottom: 18,
      inset: 2,
      textX: 20,
      showLogo: true,
      priceColor: "00DCFF",
      positiveColor: "00FF46",
      negativeColor: "AA32FF",
      interval: 140,
    },
  },
  {
    name: "Ámbar",
    detail: "Inspirado en un colectivo",
    color: "#FF7D00",
    settings: {
      font: "compact",
      top: 4,
      bottom: 18,
      inset: 4,
      textX: 20,
      showLogo: true,
      priceColor: "FF7D00",
      positiveColor: "FFFF00",
      negativeColor: "FF191E",
      interval: 200,
    },
  },
  {
    name: "Lectura grande",
    detail: "Letras de 10 × 14",
    color: "#C2B0FF",
    settings: {
      font: "classic",
      top: 2,
      bottom: 16,
      inset: 2,
      textX: 20,
      showLogo: true,
      priceColor: "DCEBFF",
      positiveColor: "00FF46",
      negativeColor: "FF191E",
      interval: 240,
    },
  },
];
