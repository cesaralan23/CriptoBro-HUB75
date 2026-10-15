import {
  Device,
  localAddress,
  Settings,
  State,
  validateSettings,
} from "./model";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function request<T>(
  address: string,
  path: string,
  token = "",
  body?: unknown,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(
      `http://${localAddress(address)}/api/${path}`,
      {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      },
    );
    const data = await response.json();
    if (!response.ok)
      throw new ApiError(
        response.status,
        data.error || `Error ${response.status}`,
      );
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new Error(
      "No se pudo conectar. Revisá el Wi-Fi, la IP y que el cartel esté encendido.",
    );
  } finally {
    clearTimeout(timer);
  }
}
export async function getDevice(address: string) {
  const d = await request<Device>(address, "info");
  if (
    d.api !== 1 ||
    d.width !== 64 ||
    d.height !== 32 ||
    !/^[0-9A-F]{12}$/.test(d.id)
  )
    throw new Error("Este equipo no es un CriptoBro compatible");
  return { ...d, address: localAddress(address) };
}
export function apply(
  address: string,
  token: string,
  settings: Settings,
  save = false,
) {
  const error = validateSettings(settings);
  if (error) throw new Error(error);
  return request<State>(address, "config", token, { settings, save });
}
// A failed request does not poison the queue; subsequent changes remain ordered.
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();
  run<T>(action: () => Promise<T>): Promise<T> {
    const task = this.tail.then(action);
    this.tail = task.catch(() => undefined);
    return task;
  }
}
