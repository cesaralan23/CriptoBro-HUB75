import Constants from "expo-constants";
import { Platform } from "react-native";
import { Device } from "./model";
import { getDevice } from "./api";
export const canDiscover =
  Platform.OS !== "web" && Constants.executionEnvironment !== "storeClient";
export async function discover(
  found: (d: Device) => void,
  onError: (message: string) => void,
): Promise<() => void> {
  if (!canDiscover) {
    onError(
      "La búsqueda automática requiere nuestra app de desarrollo. En Expo Go podés conectar por IP.",
    );
    return () => {};
  }
  // Lazy import: Expo Go must not load a module absent from its native runtime.
  const { default: Zeroconf } = await import("react-native-zeroconf");
  const z = new Zeroconf();
  let stopped = false;
  z.on("resolved", async (service) => {
    for (const address of service.addresses ?? []) {
      if (address.includes(":")) continue;
      try {
        const d = await getDevice(`${address}:${service.port}`);
        if (!stopped) found(d);
        break;
      } catch {
        /* Ignore unrelated or inaccessible services. */
      }
    }
  });
  z.on("error", (error) => {
    if (!stopped) onError(String(error));
  });
  z.scan({ type: "criptobro", protocol: "tcp", domain: "local." });
  return () => {
    stopped = true;
    z.stop();
    z.removeAllListeners();
  };
}
