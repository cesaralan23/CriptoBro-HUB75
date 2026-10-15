import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { Settings, Quote } from "../lib/model";
import { frame, lines } from "../lib/render";
import { styles, colors } from "./ui";
export default function Matrix({
  settings,
  quotes,
  playing,
}: {
  settings: Settings;
  quotes: Quote[];
  playing: boolean;
}) {
  const [position, setPosition] = useState({ x: 2, index: 0 });
  const coin = settings.coins[position.index % settings.coins.length] ?? 0,
    q = quotes[coin];
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        setPosition((p) => {
          const c = settings.coins[p.index % settings.coins.length],
            l = lines(settings, quotes[c], c),
            end =
              settings.inset -
              (settings.showLogo ? settings.textX : 0) -
              Math.max(l.top.length, l.bottom.length) *
                (settings.font === "compact" ? 8 : 12) -
              8;
          return p.x - 2 < end
            ? { x: 64, index: (p.index + 1) % settings.coins.length }
            : { ...p, x: p.x - 2 };
        }),
      settings.interval,
    );
    return () => clearInterval(timer);
  }, [playing, settings, quotes]);
  const pixels = frame(settings, q, coin, position.x),
    paths: Record<string, string> = {};
  pixels.forEach((c, i) => {
    if (c === "000000") return;
    paths[c] =
      (paths[c] ?? "") +
      `M${(i % 64) + 0.08} ${Math.floor(i / 64) + 0.08}h.84v.84h-.84z`;
  });
  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          padding: 10,
          backgroundColor: "#020408",
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        <Svg width="100%" viewBox="0 0 64 32" style={{ aspectRatio: 2 }}>
          <Rect width={64} height={32} fill="#05080B" />
          {Object.entries(paths).map(([c, d]) => (
            <Path key={c} d={d} fill={"#" + c} />
          ))}
        </Svg>
      </View>
      <Text style={styles.note}>
        64 × 32 · Vista previa del diseño ·{" "}
        {playing ? "En movimiento" : "Pausada"}
      </Text>
    </View>
  );
}
