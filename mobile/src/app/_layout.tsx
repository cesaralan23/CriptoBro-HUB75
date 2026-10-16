import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SessionProvider } from "../lib/session";
import { colors } from "../components/ui";
import { Icon } from "../components/studio";
export default function Layout() {
  return (
    <SessionProvider>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: "#12131E",
            borderTopColor: colors.line,
            minHeight: 72,
            paddingBottom: 12,
            paddingTop: 8,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Pantallas",
            tabBarIcon: ({ color }) => <Icon name="screens" color={color} />,
          }}
        />
        <Tabs.Screen
          name="editor"
          options={{
            title: "Diseñar",
            tabBarIcon: ({ color }) => <Icon name="design" color={color} />,
          }}
        />
        <Tabs.Screen
          name="animations"
          options={{
            title: "Biblioteca",
            tabBarIcon: ({ color }) => <Icon name="library" color={color} />,
          }}
        />
        <Tabs.Screen
          name="help"
          options={{
            title: "Ayuda",
            tabBarIcon: ({ color }) => <Icon name="help" color={color} />,
          }}
        />
      </Tabs>
    </SessionProvider>
  );
}
