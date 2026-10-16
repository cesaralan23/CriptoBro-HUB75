import { ReactNode } from "react";
import { Pressable, Text, View, ColorValue } from "react-native";
import Svg, { Path, Rect, Circle } from "react-native-svg";
import { colors, styles } from "./ui";
export function Icon({
  name,
  color = colors.accent,
  size = 24,
}: {
  name: string;
  color?: ColorValue;
  size?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === "screens" ? (
        <>
          <Rect x={3} y={4} width={18} height={13} rx={3} />
          <Path d="M8 21h8M12 17v4M7 8h1m3 0h1m3 0h1M7 12h1m3 0h1m3 0h1" />
        </>
      ) : name === "design" ? (
        <>
          <Path d="m4 20 4-1L20 7l-3-3L5 16zM14 7l3 3M4 20h16" />
        </>
      ) : name === "library" ? (
        <>
          <Rect x={3} y={3} width={7} height={7} rx={2} />
          <Rect x={14} y={3} width={7} height={7} rx={2} />
          <Rect x={3} y={14} width={7} height={7} rx={2} />
          <Path d="m15 14 6 3.5-6 3.5z" />
        </>
      ) : name === "help" ? (
        <>
          <Circle cx={12} cy={12} r={9} />
          <Path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01" />
        </>
      ) : name === "spark" ? (
        <Path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
      ) : (
        <>
          <Path d="M3 8a14 14 0 0 1 18 0M6 12a9 9 0 0 1 12 0m-9 4a4 4 0 0 1 6 0" />
          <Circle cx={12} cy={20} r={0.5} />
        </>
      )}
    </Svg>
  );
}
export function Badge({
  children,
  good = false,
}: {
  children: ReactNode;
  good?: boolean;
}) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 30,
        paddingHorizontal: 11,
        paddingVertical: 6,
        backgroundColor: good ? "#16382D" : "#29243E",
      }}
    >
      <Text
        style={{
          color: good ? "#8CE7B3" : colors.accent,
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 0.6,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
export function Hero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <View style={{ gap: 9 }}>
      <Text
        style={{
          color: colors.accent,
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 2,
        }}
      >
        {eyebrow}
      </Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{description}</Text>
    </View>
  );
}
export function Segments<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { key: T; title: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        padding: 4,
        gap: 4,
        borderRadius: 16,
        backgroundColor: "#12131E",
      }}
    >
      {options.map((o) => (
        <Pressable
          key={o.key}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === o.key }}
          onPress={() => onChange(o.key)}
          style={{
            flex: 1,
            minHeight: 46,
            justifyContent: "center",
            alignItems: "center",
            borderRadius: 12,
            backgroundColor: value === o.key ? "#36304E" : "transparent",
            paddingHorizontal: 4,
          }}
        >
          <Text
            style={{
              color: value === o.key ? "#EEE7FF" : colors.muted,
              fontSize: 13,
              fontWeight: "700",
            }}
          >
            {o.title}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function ActionTile({
  icon,
  title,
  detail,
  onPress,
}: {
  icon: string;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 135,
        padding: 17,
        gap: 12,
        borderRadius: 20,
        backgroundColor: pressed ? "#323047" : colors.card,
        borderColor: colors.line,
        borderWidth: 1,
      })}
    >
      <Icon name={icon} />
      <Text style={styles.label}>{title}</Text>
      <Text style={styles.note}>{detail}</Text>
    </Pressable>
  );
}
