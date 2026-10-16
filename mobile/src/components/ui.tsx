import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  TextInput,
  TextInputProps,
} from "react-native";
export const colors = {
  bg: "#0C0D14",
  card: "#191B29",
  line: "#303348",
  text: "#F3F6FC",
  muted: "#ADB0C7",
  accent: "#C2B0FF",
  orange: "#FFB45B",
};
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: secondary ? colors.line : colors.accent,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: secondary ? colors.text : colors.bg,
          fontWeight: "700",
          fontSize: 15,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}
export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}
export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      autoCorrect={false}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: 20,
    gap: 18,
    paddingBottom: 50,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -1,
    color: colors.text,
  },
  subtitle: { fontSize: 15, lineHeight: 22, color: colors.muted },
  label: { fontSize: 16, fontWeight: "700", color: colors.text },
  card: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 14,
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    color: colors.text,
    fontSize: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    minHeight: 48,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  note: { fontSize: 13, lineHeight: 19, color: colors.muted },
  error: { color: "#FFAA9E", fontSize: 14, lineHeight: 20 },
});
