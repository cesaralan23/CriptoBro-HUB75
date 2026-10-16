import { useEffect, useMemo, useState, useRef } from "react";
import { ScrollView, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Hero, Badge, Segments, Icon } from "../components/studio";
import { fromByteArray } from "base64-js";
import { Button, Card, Label, Input, styles, colors } from "../components/ui";
import ClipPreview from "../components/ClipPreview";
import { Clip, crc32, meme, memeNames } from "../lib/animation";
import { importMedia } from "../lib/importMedia";
import { request } from "../lib/api";
import { useSession } from "../lib/session";
type AnimationState = {
  available: boolean;
  enabled: boolean;
  name: string;
  loops: number;
  rounds: number;
};
export default function Animations() {
  const { device } = useSession();
  return <AnimationPanel key={device?.id || "demo"} />;
}
function AnimationPanel() {
  const { device, token, demo } = useSession();
  const scroll = useRef<ScrollView>(null);
  const [section, setSection] = useState<"gallery" | "import" | "rotation">(
    "gallery",
  );
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState(false);
  const gallery = useMemo(() => memeNames.map(meme), []);
  const [clip, setClip] = useState<Clip>(gallery[0]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [seconds, setSeconds] = useState(3),
    [loops, setLoops] = useState(2),
    [rounds, setRounds] = useState(1),
    [active, setActive] = useState<AnimationState | null>(null);
  useEffect(() => {
    if (!device) return;
    let live = true;
    request<AnimationState>(device.address, "animation", token)
      .then((s) => {
        if (live) {
          setActive(s);
          setLoops(s.loops);
          setRounds(s.rounds);
        }
      })
      .catch((e) => {
        if (live)
          setMessage(
            `No pude leer el reproductor: ${e.message}. Requiere firmware 1.2.0.`,
          );
      });
    return () => {
      live = false;
    };
  }, [device, token]);
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo completar");
    } finally {
      setBusy(false);
    }
  }
  async function configure(enabled: boolean) {
    if (!device) {
      setMessage("Vista de demostración: no se envió al cartel.");
      return;
    }
    const s = await request<AnimationState>(
      device.address,
      "animation/settings",
      token,
      { enabled, loops, rounds },
    );
    setActive(s);
    setMessage("Alternancia guardada en el cartel.");
  }
  async function upload() {
    if (!device) {
      setMessage(
        "Vinculá un cartel para enviar. La vista previa funciona en demo.",
      );
      return;
    }
    const info = await request<{ animationApi?: number; version: string }>(
      device.address,
      "info",
    );
    if (info.animationApi !== 1)
      throw new Error(
        `El cartel todavía tiene firmware ${info.version}. Necesita 1.2.0: dejalo conectado a Internet para que se actualice por OTA y volvé a enviar.`,
      );
    const transfer = await request<{ upload: string }>(
      device.address,
      "animation/start",
      token,
      { size: clip.bytes.length, crc: crc32(clip.bytes), name: clip.name },
    );
    for (let offset = 0; offset < clip.bytes.length; offset += 768) {
      await request(device.address, "animation/chunk", token, {
        upload: transfer.upload,
        offset,
        data: fromByteArray(clip.bytes.slice(offset, offset + 768)),
      });
      setMessage(
        `Enviando… ${Math.min(100, Math.round(((offset + 768) * 100) / clip.bytes.length))}%`,
      );
    }
    setActive(
      await request<AnimationState>(device.address, "animation/finish", token, {
        upload: transfer.upload,
      }),
    );
    await configure(true);
    await request(device.address, "animation/play", token, {});
    setMessage(
      "Clip guardado. Se reproduce ahora y alternará con las cotizaciones.",
    );
  }
  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Hero
          eyebrow="TU BIBLIOTECA DE PÍXELES"
          title="Dale vida al cartel."
          description="Elegí un meme o traé algo tuyo. Revisalo antes de enviarlo."
        />
        <Badge good={!demo}>{demo ? "EXPLORANDO EN DEMO" : device?.name}</Badge>
        <Card>
          <View style={[styles.row, { justifyContent: "space-between" }]}>
            <Label>En preparación</Label>
            <Badge>64 × 32</Badge>
          </View>
          {(section !== "gallery" || preview) && <ClipPreview clip={clip} />}
          <Label>{clip.name}</Label>
          <Text style={styles.note}>
            {(clip.frames.length / clip.fps).toFixed(1)} s · {clip.fps}{" "}
            cuadros/s · {(clip.bytes.length / 1024).toFixed(1)} KB
          </Text>
          <View
            style={{
              height: 5,
              borderRadius: 3,
              backgroundColor: colors.line,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: 5,
                width: `${(clip.bytes.length / 40960) * 100}%`,
                backgroundColor: colors.accent,
              }}
            />
          </View>
          <Text style={styles.note}>
            Memoria del clip: {((clip.bytes.length / 40960) * 100).toFixed(0)}%
            de 40 KB
          </Text>
          {section === "gallery" && (
            <Button
              secondary
              title={preview ? "Ocultar vista previa" : "Ver vista previa"}
              onPress={() => setPreview(!preview)}
            />
          )}
        </Card>
        {!!message && (
          <View
            style={{
              padding: 14,
              borderRadius: 14,
              backgroundColor: "#29243E",
            }}
          >
            <Text accessibilityLiveRegion="polite" style={styles.subtitle}>
              {message}
            </Text>
          </View>
        )}
        <Segments
          value={section}
          onChange={setSection}
          options={[
            { key: "gallery", title: "Plantillas" },
            { key: "import", title: "Importar" },
            { key: "rotation", title: "Alternancia" },
          ]}
        />
        {section === "gallery" && (
          <>
            <Input
              accessibilityLabel="Buscar plantilla"
              placeholder="Buscar un meme…"
              value={query}
              onChangeText={setQuery}
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {gallery
                .filter((item) =>
                  item.name.toLowerCase().includes(query.toLowerCase()),
                )
                .map((item) => (
                  <Pressable
                    key={item.name}
                    accessibilityRole="button"
                    accessibilityLabel={`Elegir ${item.name}`}
                    accessibilityState={{ selected: clip.name === item.name }}
                    disabled={busy}
                    onPress={() => {
                      setClip(item);
                      setPreview(true);
                      setMessage(`${item.name} listo para enviar.`);
                      scroll.current?.scrollTo({ y: 0, animated: true });
                    }}
                    style={{
                      width: "47%",
                      flexGrow: 1,
                      padding: 12,
                      gap: 12,
                      borderWidth: 2,
                      borderColor:
                        clip.name === item.name ? colors.accent : colors.line,
                      backgroundColor: colors.card,
                      borderRadius: 20,
                      opacity: busy ? 0.5 : 1,
                    }}
                  >
                    <ClipPreview clip={item} playing={false} />
                    <Text style={styles.label}>{item.name}</Text>
                    <Text style={styles.note}>
                      Animación ·{" "}
                      {clip.name === item.name
                        ? "Seleccionada"
                        : "Tocar para elegir"}
                    </Text>
                  </Pressable>
                ))}
            </View>
            {!gallery.some((item) =>
              item.name.toLowerCase().includes(query.toLowerCase()),
            ) && (
              <Card>
                <Label>No encontramos ese meme</Label>
                <Text style={styles.note}>
                  Probá con HODL, STONKS, MOON o DIP. También podés importar tu
                  propio GIF.
                </Text>
                <Button
                  secondary
                  title="Limpiar búsqueda"
                  onPress={() => setQuery("")}
                />
              </Card>
            )}
          </>
        )}
        {section === "import" && (
          <Card>
            <Icon name="library" size={32} />
            <Label>De tu galería al panel</Label>
            <Text style={styles.subtitle}>
              Elegí un GIF o un video. Lo adaptamos al cartel conservando su
              proporción.
            </Text>
            <Text style={styles.note}>
              1. Elegí cuánto dura el fragmento inicial.
            </Text>
            <View style={styles.row}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Button
                  key={n}
                  title={`${n} s`}
                  secondary={seconds !== n}
                  disabled={busy}
                  onPress={() => setSeconds(n)}
                />
              ))}
            </View>
            <Button
              disabled={busy}
              title={busy ? "Preparando…" : "2. Elegir GIF o video"}
              onPress={() =>
                void action(async () => {
                  const result = await importMedia(seconds, setMessage);
                  if (result) {
                    setClip(result);
                    setMessage(
                      "Conversión lista. Revisá la vista previa y tocá Enviar.",
                    );
                    scroll.current?.scrollTo({ y: 0, animated: true });
                  }
                })
              }
            />
            <Text style={styles.note}>
              Hasta 20 MB de origen · Sin audio · Video desde Android. Si hace
              falta, reducimos los cuadros por segundo para que entre.
            </Text>
          </Card>
        )}
        {section === "rotation" && (
          <>
            <Card>
              <Badge good={!!active?.enabled}>
                {active?.enabled ? "ALTERNANCIA ACTIVA" : "ALTERNANCIA PAUSADA"}
              </Badge>
              <Label>
                {active?.available
                  ? active.name
                  : "Todavía no hay un clip guardado"}
              </Label>
              <Text style={styles.subtitle}>Tu secuencia</Text>
              <View
                style={{
                  gap: 10,
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: "#10111B",
                }}
              >
                <Text style={styles.label}>
                  ① Cotizaciones · {rounds} vuelta{rounds === 1 ? "" : "s"}
                </Text>
                <Text style={styles.note}>↓</Text>
                <Text style={styles.label}>
                  ② Clip · {loops} repetici{loops === 1 ? "ón" : "ones"}
                </Text>
                <Text style={styles.note}>↻ Vuelve a empezar</Text>
              </View>
              <Text style={styles.note}>
                Una vuelta incluye todas las monedas elegidas. Funciona en modo
                Cotizaciones; el texto libre no activa esta secuencia.
              </Text>
            </Card>
            <Card>
              <Label>¿Cuántas veces se repite el clip?</Label>
              <View style={styles.row}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Button
                    key={n}
                    disabled={busy}
                    title={`${n}`}
                    secondary={loops !== n}
                    onPress={() => setLoops(n)}
                  />
                ))}
              </View>
              <Label>¿Cada cuántas vueltas de monedas?</Label>
              <View style={styles.row}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Button
                    key={n}
                    disabled={busy}
                    title={`${n}`}
                    secondary={rounds !== n}
                    onPress={() => setRounds(n)}
                  />
                ))}
              </View>
              <Button
                disabled={busy || (!demo && !active?.available)}
                title="Guardar y activar alternancia"
                onPress={() => void action(() => configure(true))}
              />
              <Button
                disabled={busy || (!demo && !active?.available)}
                secondary
                title="Pausar animaciones"
                onPress={() => void action(() => configure(false))}
              />
            </Card>
          </>
        )}
        <Text style={styles.note}>
          Se conserva un clip en el cartel. Al enviar otro, reemplaza al
          anterior después de comprobar la carga.
        </Text>
      </ScrollView>
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 10,
          paddingBottom: 12,
          gap: 8,
          backgroundColor: "#12131E",
          borderTopWidth: 1,
          borderColor: colors.line,
        }}
      >
        <Text numberOfLines={1} style={styles.note}>
          {busy
            ? message
            : demo
              ? "Vista previa · Vinculá un cartel para enviar"
              : `Destino: ${device?.name}`}
        </Text>
        <Button
          disabled={busy}
          title={busy ? "Procesando…" : `Enviar ${clip.name}`}
          onPress={() => void action(upload)}
        />
      </View>
    </SafeAreaView>
  );
}
