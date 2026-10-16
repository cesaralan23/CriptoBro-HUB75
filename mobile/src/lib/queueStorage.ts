import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { QueueItem } from "./playlist";
import { encode } from "./animation";
const memory = new Map<string, string>();
export async function saveDraft(id: string, items: QueueItem[]) {
  const json = JSON.stringify(
    items.map((x) => ({
      id: x.id,
      seconds: x.seconds,
      name: x.clip.name,
      fps: x.clip.fps,
      frames: x.clip.frames.map((f) => Array.from(f)),
    })),
  );
  if (Platform.OS === "web") {
    memory.set(id, json);
    return;
  }
  new File(Paths.document, "queue-" + id + ".json").write(json);
}
export async function loadDraft(id: string): Promise<QueueItem[]> {
  const file =
    Platform.OS === "web"
      ? null
      : new File(Paths.document, "queue-" + id + ".json");
  const json = file
    ? file.exists
      ? await file.text()
      : "[]"
    : memory.get(id) || "[]";
  return JSON.parse(json)
    .slice(0, 32)
    .map(
      (x: {
        id: string;
        seconds: number;
        name: string;
        fps: number;
        frames: number[][];
      }) => {
        const frames = x.frames.map((f) => Uint8Array.from(f));
        return {
          id: x.id,
          seconds: x.seconds,
          clip: {
            name: x.name,
            fps: x.fps,
            frames,
            bytes: encode(frames, x.fps),
          },
        };
      },
    );
}
