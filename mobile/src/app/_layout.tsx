import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SessionProvider } from "../lib/session";
import { colors } from "../components/ui";
export default function Layout() {
  return (
    <SessionProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" options={{ title: "CriptoBro · Local" }} />
        <Stack.Screen name="editor" options={{ title: "Editor del cartel" }} />
        <Stack.Screen name="animations" options={{ title: "Memes y clips" }} />
      </Stack>
    </SessionProvider>
  );
}
