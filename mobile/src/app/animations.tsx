import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View, Pressable, Switch, AppState } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Hero, Badge, Segments } from "../components/studio";
import { Button, Card, Label, Input, styles, colors } from "../components/ui";
import ClipPreview from "../components/ClipPreview";
import { Clip, meme, memeNames } from "../lib/animation";
import { importMedia } from "../lib/importMedia";
import { request } from "../lib/api";
import { useSession } from "../lib/session";
import { packQueue, QueueItem } from "../lib/playlist";
import { retryTransfer, uploadQueue } from "../lib/upload";
import { loadDraft, saveDraft } from "../lib/queueStorage";
import { streamQueue } from "../lib/stream";
import { useKeepAwake } from "expo-keep-awake";
function KeepStreamingAwake(){useKeepAwake();return null;}
type Player = {
  maxBytes: number;
  maxItems: number;
  available: boolean;
  enabled: boolean;
  onlyMedia: boolean;
  count: number;
  name: string;
  rounds: number;
};
export default function Animations() {
  const { device } = useSession();
  return <Library key={device?.id || "demo"} />;
}
function Library() {
  const { device, token, demo } = useSession();
  const [section, setSection] = useState<"queue" | "gallery" | "import">(
    "queue",
  );
  const gallery = useMemo(() => memeNames.map(meme), []);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [only, setOnly] = useState(true),
    [rounds, setRounds] = useState(1);
  const [seconds, setSeconds] = useState(3),
    [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [active, setActive] = useState<Player | null>(null);
  const [selected, setSelected] = useState<Clip | null>(null);
  const cancel = useRef(false);
  const [streaming, setStreaming] = useState(false);
  const limit = active?.maxBytes ?? 40960;
  useEffect(() => {const sub = AppState.addEventListener("change", state => {if(streaming && state !== "active") cancel.current = true;});return () => sub.remove();}, [streaming]);
  const draftKey = device?.id || "demo";
  useEffect(() => {
    let live = true;
    loadDraft(draftKey)
      .then((value) => {
        if (live) {
          setItems(value);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (live) setLoaded(true);
      });
    return () => {
      live = false;
      cancel.current = true;
    };
  }, [draftKey]);
  useEffect(() => {
    if (loaded)
      void saveDraft(draftKey, items).catch(() =>
        setMessage("No se pudo guardar el borrador en este teléfono."),
      );
  }, [items, loaded, draftKey]);
  useEffect(() => {
    if (!device) return;
    let live = true;
    request<Player>(device.address, "animation", token)
      .then((s) => {
        if (live) {
          setActive(s);
          setOnly(s.onlyMedia ?? false);
          setRounds(s.rounds);
        }
      })
      .catch(() => {
        if (live)
          setMessage(
            "Cartel sin respuesta. Tu cola sigue guardada en este teléfono.",
          );
      });
    return () => {
      live = false;
    };
  }, [device, token]);
  const used = 5 + items.reduce((n, item) => n + 2 + item.clip.bytes.length, 0);
  const duration = items.reduce((n, item) => n + item.seconds, 0);
  function add(clip: Clip) {
    if (items.length >= 32) {
      setMessage("La cola admite hasta 32 elementos.");
      return;
    }
    const next = [
      ...items,
      {
        id: Date.now().toString() + Math.random().toString(16).slice(2),
        clip,
        seconds: 10,
      },
    ];
    try {
      packQueue(next, 10 * 1024 * 1024);
      setItems(next);
      setSection("queue");
      setMessage("Agregado a tu cola. Todavía no se envió al cartel.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function move(index: number, delta: number) {
    setItems((current) => {
      const next = [...current];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  }
  async function action(work: () => Promise<void>) {
    cancel.current = false;
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch (e) {
      setMessage((e as Error).message + " Tu borrador se conserva.");
    } finally {
      setBusy(false);
    }
  }
  async function configure(enabled: boolean) {
    if (!device) {
      setMessage("Demostración: no se modificó ningún cartel.");
      return;
    }
    const state = await retryTransfer(
      () =>
        request<Player>(device.address, "animation/settings", token, {
          enabled,
          loops: 2,
          rounds,
          onlyMedia: only,
        }),
      setMessage,
      () => cancel.current,
    );
    setActive(state);
  }
  async function send() {
    if (!device) {
      setMessage("Vinculá una pantalla desde Pantallas para enviar la cola.");
      return;
    }
    const data = packQueue(items, limit);
    await uploadQueue(
      device.address,
      token,
      data,
      setMessage,
      () => cancel.current,
    );
    await configure(true);
    await retryTransfer(
      () => request(device.address, "animation/play", token, {}),
      setMessage,
      () => cancel.current,
    );
    setMessage("Cola guardada y reproduciendo. Podés cerrar la app.");
  }
  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      {streaming && <KeepStreamingAwake />}
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Hero
          eyebrow="REPRODUCTOR"
          title="Tu cola, tu ritmo."
          description="Ordená imágenes y animaciones. Elegí cuánto dura cada una."
        />
        <Badge good={!!active?.enabled}>
          {demo
            ? "VISTA DE DEMOSTRACIÓN"
            : active?.enabled
              ? `EN EL CARTEL · ${active.onlyMedia ? "SOLO MULTIMEDIA" : "CON COTIZACIONES"}`
              : "COLA LOCAL · SIN ENVIAR"}
        </Badge>
        <Segments
          value={section}
          onChange={setSection}
          options={[
            { key: "queue", title: `Cola (${items.length})` },
            { key: "gallery", title: "Memes" },
            { key: "import", title: "Importar" },
          ]}
        />
        {!!message && (
          <Card>
            <Text accessibilityLiveRegion="polite" style={styles.subtitle}>
              {message}
            </Text>
          </Card>
        )}
        {section === "queue" && (
          <>
            <Card>
              <Label>Modo de la cola guardada</Label>
              <Segments
                disabled={busy}
                value={only ? "media" : "mixed"}
                onChange={(v) => setOnly(v === "media")}
                options={[
                  { key: "media", title: "Solo multimedia" },
                  { key: "mixed", title: "+ Cotizaciones" },
                ]}
              />
              <Text style={styles.note}>
                {only
                  ? "La cola se repite sin mostrar monedas. Los GIF se repiten durante el tiempo que elegiste."
                  : "Se reproduce la cola completa entre vueltas de cotizaciones."}
              </Text>
              {!only && (
                <View style={styles.row}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Button
                      key={n}
                      title={`${n} vuelta${n === 1 ? "" : "s"}`}
                      secondary={rounds !== n}
                      disabled={busy}
                      onPress={() => setRounds(n)}
                    />
                  ))}
                </View>
              )}
              {active?.available && (
                <Button
                  secondary
                  disabled={busy}
                  title="Aplicar modo a la cola del cartel"
                  onPress={() =>
                    void action(async () => {
                      await configure(true);
                      setMessage("Modo guardado en el cartel.");
                    })
                  }
                />
              )}
            </Card>
            {!items.length ? (
              <Card>
                <Label>Empezá tu primera cola</Label>
                <Text style={styles.subtitle}>
                  Agregá un meme o elegí una imagen, GIF o video del teléfono.
                </Text>
                <Button
                  title="Elegir de mi galería"
                  onPress={() => setSection("import")}
                />
                <Button
                  secondary
                  title="Explorar memes"
                  onPress={() => setSection("gallery")}
                />
              </Card>
            ) : (
              items.map((item, index) => (
                <Card key={item.id}>
                  <View
                    style={[styles.row, { justifyContent: "space-between" }]}
                  >
                    <Label>
                      {index + 1}. {item.clip.name}
                    </Label>
                    <Badge>
                      {(item.clip.bytes.length / 1024).toFixed(1)} KB · {item.clip.fps} fps en vivo · {item.clip.bytes[4]} fps guardado
                    </Badge>
                  </View>
                  <ClipPreview clip={item.clip} playing={false} />
                  <Label>Tiempo en pantalla</Label>
                  <View style={styles.row}>
                    <Input
                      accessibilityLabel={`Segundos de ${item.clip.name}`}
                      keyboardType="number-pad"
                      value={String(item.seconds)}
                      maxLength={3}
                      editable={!busy}
                      style={{ width: 90 }}
                      onChangeText={(v) =>
                        setItems(
                          items.map((x, i) =>
                            i === index
                              ? { ...x, seconds: Number(v.replace(/\D/g, "")) }
                              : x,
                          ),
                        )
                      }
                    />
                    <Text style={styles.subtitle}>segundos · 1 a 300</Text>
                  </View>
                  <View style={styles.row}>
                    {[5, 10, 30, 60].map((n) => (
                      <Button
                        key={n}
                        title={`${n}s`}
                        secondary={item.seconds !== n}
                        disabled={busy}
                        onPress={() =>
                          setItems(
                            items.map((x, i) =>
                              i === index ? { ...x, seconds: n } : x,
                            ),
                          )
                        }
                      />
                    ))}
                  </View>
                  <View style={styles.row}>
                    <Button
                      secondary
                      title="↑"
                      disabled={busy || index === 0}
                      onPress={() => move(index, -1)}
                    />
                    <Button
                      secondary
                      title="↓"
                      disabled={busy || index === items.length - 1}
                      onPress={() => move(index, 1)}
                    />
                    <Button
                      secondary
                      title="Vista previa"
                      onPress={() => setSelected(item.clip)}
                    />
                    <Button
                      secondary
                      title="Quitar"
                      disabled={busy}
                      onPress={() =>
                        setItems(items.filter((x) => x.id !== item.id))
                      }
                    />
                  </View>
                </Card>
              ))
            )}
            {!!items.length && (
              <Button
                secondary
                disabled={busy}
                title="+ Agregar otro elemento"
                onPress={() => setSection("import")}
              />
            )}
            {selected && (
              <Card>
                <Label>{selected.name}</Label>
                <ClipPreview clip={selected} />
                <Button
                  secondary
                  title="Cerrar vista previa"
                  onPress={() => setSelected(null)}
                />
              </Card>
            )}
            <Card>
              <Label>
                {items.length}/32 elementos · {duration} s por vuelta
              </Label>
              <View
                style={{
                  height: 7,
                  backgroundColor: colors.line,
                  borderRadius: 4,
                }}
              >
                <View
                  style={{
                    height: 7,
                    width: `${Math.min(100, (used * 100) / limit)}%`,
                    backgroundColor: colors.accent,
                    borderRadius: 4,
                  }}
                />
              </View>
              <Text style={styles.note}>
                {(used / 1024).toFixed(1)} / {Math.floor(limit / 1024)} KB guardables en este cartel. La duración de exposición no
                aumenta el tamaño del archivo.
              </Text>
              {active?.available && (
                <View style={[styles.row, { justifyContent: "space-between" }]}>
                  <Label>Reproductor activo</Label>
                  <Switch
                    accessibilityLabel="Activar reproductor"
                    disabled={busy}
                    value={active.enabled}
                    onValueChange={(enabled) =>
                      void action(() => configure(enabled))
                    }
                  />
                </View>
              )}
            </Card>
          </>
        )}
        {section === "gallery" && (
          <>
            <Input
              placeholder="Buscar meme…"
              value={query}
              onChangeText={setQuery}
            />
            {gallery
              .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
              .map((clip) => (
                <Card key={clip.name}>
                  <ClipPreview clip={clip} playing={false} />
                  <Label>{clip.name}</Label>
                  <Button
                    title="+ Agregar a la cola"
                    disabled={busy}
                    onPress={() => add(clip)}
                  />
                </Card>
              ))}
          </>
        )}
        {section === "import" && (
          <Card>
            <Label>Imágenes, GIF y videos</Label>
            <Text style={styles.subtitle}>
              Los adaptamos a 64×32 conservando la proporción. Las imágenes
              quedan quietas; las animaciones se repiten.
            </Text>
            <Label>Fragmento de GIF / video</Label>
            <View style={styles.row}>
              {[3, 5, 10, 20, 30].map((n) => (
                <Button
                  key={n}
                  title={`${n}s`}
                  secondary={seconds !== n}
                  disabled={busy}
                  onPress={() => setSeconds(n)}
                />
              ))}
            </View>
            <Text style={styles.note}>
              Esto define qué fragmento importar. El tiempo que permanece en
              pantalla se elige después, en la cola.
            </Text>
            <Button
              disabled={busy}
              title="Elegir archivo"
              onPress={() =>
                void action(async () => {
                  const clip = await importMedia(seconds, setMessage);
                  if (clip) add(clip);
                })
              }
            />
            <Text style={styles.note}>
              Hasta 20 MB de origen. Si no entra, usá un fragmento más corto.
            </Text>
          </Card>
        )}
      </ScrollView>
      <View
        style={{
          padding: 16,
          gap: 8,
          borderTopWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.card,
        }}
      >
        <Text numberOfLines={2} style={styles.note}>
          {busy
            ? message
            : `${items.length} elementos preparados · ${device?.name || "Sin pantalla vinculada"}`}
        </Text>
        <Button
          disabled={busy || !items.length || !loaded || used > limit || items.length > (active?.maxItems ?? 8)}
          title={streaming ? "Transmisión en curso" : busy ? "Enviando…" : "Guardar cola y reproducir"}
          onPress={() => void action(send)}
        />
        <Button secondary disabled={busy || !items.length || !device} title="Transmitir cola por Wi-Fi"
          onPress={() => void action(async () => {
            if(!device)return;
            setStreaming(true);
            try {await streamQueue(device.address, token, items, () => cancel.current, setMessage);
              setMessage("Transmisión detenida. El cartel vuelve a su contenido guardado.");
            } finally {setStreaming(false);}
          })} />
        <Text style={styles.note}>Streaming repite sólo esta cola, sin guardarla. Mantené la app abierta y el mismo Wi-Fi. Si se corta, vuelve al contenido guardado en 3 segundos.</Text>
        {busy && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              cancel.current = true;
            }}
          >
            <Text style={[styles.label, { textAlign: "center", padding: 8 }]}>
              {streaming ? "Detener transmisión" : "Cancelar envío"}
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}
