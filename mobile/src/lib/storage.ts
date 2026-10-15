import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { Device } from "./model";
const memory = new Map<string, string>();
async function get(key: string) {
  return Platform.OS === "web"
    ? (memory.get(key) ?? null)
    : SecureStore.getItemAsync(key);
}
async function set(key: string, value: string) {
  if (Platform.OS === "web") memory.set(key, value);
  else await SecureStore.setItemAsync(key, value);
}
export async function savedDevices(): Promise<Device[]> {
  try {
    return JSON.parse((await get("cb.devices")) ?? "[]");
  } catch {
    return [];
  }
}
export async function remember(d: Device, token: string) {
  const devices = await savedDevices();
  await set(`cb.token.${d.id}`, token);
  await set(
    "cb.devices",
    JSON.stringify([d, ...devices.filter((v) => v.id !== d.id)].slice(0, 8)),
  );
}
export async function tokenFor(id: string) {
  return (await get(`cb.token.${id}`)) ?? "";
}
