import Constants from "expo-constants";
import { Platform } from "react-native";
import { Device } from "./model";
import { getDevice } from "./api";
export const canDiscover =
  Platform.OS !== "web" && Constants.executionEnvironment !== "storeClient";
type Listener = { found: (d: Device) => void; error: (message: string) => void };
const listeners = new Set<Listener>();
const seen = new Map<string, Device>();
let starting: Promise<void> | undefined;
let cleanup: (() => void) | undefined;

// One native mDNS browser shared by manual search and saved-device recovery.
export async function discover(found: (d: Device) => void, onError: (message: string) => void): Promise<() => void> {
  if (!canDiscover) {
    onError("La búsqueda automática requiere nuestra APK instalada. En Expo Go podés conectar por IP.");
    return () => {};
  }
  const listener = { found, error: onError };
  listeners.add(listener);
  const unsubscribe = () => {
    listeners.delete(listener);
    if (!listeners.size) { cleanup?.(); cleanup = undefined; starting = undefined; seen.clear(); }
  };
  if (!starting) starting = (async () => {
    const { default: Zeroconf } = await import("react-native-zeroconf");
    const z = new Zeroconf();
    let active = true;
    cleanup = () => { active = false; z.stop(); z.removeAllListeners(); };
    z.on("resolved", async service => {
      for (const address of service.addresses ?? []) {
        if (address.includes(":")) continue;
        try {
          const d = await getDevice(`${address}:${service.port}`);
          if (active) {
            seen.set(d.id, d);
            for (const subscriber of [...listeners]) subscriber.found(d);
          }
          break;
        } catch { /* A different interface may still be reachable. */ }
      }
    });
    z.on("error", error => { for (const subscriber of [...listeners]) subscriber.error(String(error)); });
    z.scan({ type: "criptobro", protocol: "tcp", domain: "local." });
  })();
  try {
    await starting;
    for (const d of seen.values()) if (listeners.has(listener)) found(d);
  } catch (error) { unsubscribe(); throw error; }
  return unsubscribe;
}

export async function resolveDevice(saved: Device): Promise<Device> {
  const { locateDevice } = await import("./locate");
  return locateDevice(saved, getDevice, discover);
}
