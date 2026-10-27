import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { SerialQueue } from "./api";
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
const writes = new SerialQueue();
export function remember(d: Device, token: string) {
  return writes.run(async () => {
    const devices = await savedDevices();
    await set(`cb.token.${d.id}`, token);
    await set("cb.devices", JSON.stringify([d, ...devices.filter(v => v.id !== d.id)].slice(0, 8)));
  });
}
// Address refresh never replaces or clears the pairing token.
export function rememberAddress(d: Device) {
  return writes.run(async () => {
    const devices = await savedDevices();
    await set("cb.devices", JSON.stringify(devices.map(v => v.id === d.id ? d : v)));
  });
}
export async function tokenFor(id: string) {
  return (await get(`cb.token.${id}`)) ?? "";
}
