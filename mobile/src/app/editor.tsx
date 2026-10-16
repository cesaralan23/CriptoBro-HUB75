import { useEffect, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge, Hero, Segments } from "../components/studio";
import { router } from "expo-router";
import { presets } from "../lib/presets";
import { ScrollView, Text, View, Switch, Pressable } from "react-native";
import Slider from "@react-native-community/slider";
import { Button, Card, Input, Label, styles, colors } from "../components/ui";
import Matrix from "../components/Matrix";
import { Settings, State, symbols, validateSettings } from "../lib/model";
import { request } from "../lib/api";
import { useSession } from "../lib/session";
import { remember } from "../lib/storage";
function Range({
  title,
  value,
  min,
  max,
  step = 2,
  unit = "",
  display,
  change,
}: {
  title: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  display?: string;
  change: (n: number) => void;
}) {
  return (
    <View>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Text style={styles.subtitle}>{title}</Text>
        <Text style={{ color: colors.accent, fontWeight: "700" }}>
          {display ?? `${value}${unit}`}
        </Text>
      </View>
      <Slider
        accessibilityLabel={title}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={change}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.line}
        thumbTintColor={colors.accent}
        style={{ height: 40 }}
      />
    </View>
  );
}
export default function Editor() {
  const { device } = useSession();
  return <EditorPanel key={device?.id || "demo"} />;
}
function EditorPanel() {
  const session = useSession(),
    s = session.settings;
  const [section, setSection] = useState<"content" | "style" | "settings">(
    "content",
  );
  const [advanced, setAdvanced] = useState(false);
  const [history, setHistory] = useState<Settings[]>([]);
  const [live, setLive] = useState(true),
    [playing, setPlaying] = useState(true),
    [message, setMessage] = useState(""),
    [dirty, setDirty] = useState(false),
    [saving, setSaving] = useState(false),
    [revision, setRevision] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    latest = useRef(0),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  function change(p: Partial<Settings>) {
    setHistory((h) => [...h.slice(-19), { ...s, coins: [...s.coins] }]);
    session.setSettings({ ...s, ...p });
    setDirty(true);
    setRevision((v) => v + 1);
    latest.current++;
  }
  useEffect(() => {
    if (!dirty || !live || session.demo || saving) return;
    const error = validateSettings(s);
    if (error) return;
    const rev = latest.current;
    timer.current = setTimeout(() => {
      session
        .send(s)
        .then(() => {
          if (mounted.current && rev === latest.current)
            setMessage("Aplicado al cartel · Falta guardar");
        })
        .catch((e) => {
          if (mounted.current) setMessage(e.message);
        });
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // Only user edits trigger writes, never opening or refreshing a device.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, live, saving]);
  useEffect(() => {
    if (!session.device) return;
    let cancelled = false,
      inFlight = false;
    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const state = await request<State>(
          session.device!.address,
          "state",
          session.token,
        );
        if (!cancelled) session.setQuotes(state.quotes);
      } catch {
        if (!cancelled)
          setMessage("Sin respuesta del cartel. Revisá el Wi-Fi.");
      } finally {
        inFlight = false;
      }
    };
    const t = setInterval(poll, 10000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.device?.id, session.token]);
  async function save() {
    if (timer.current) clearTimeout(timer.current);
    const error = validateSettings(s);
    if (error) {
      setMessage(error);
      return;
    }
    const rev = latest.current;
    setSaving(true);
    try {
      await session.send(s, true);
      if (session.device)
        await remember({ ...session.device, name: s.name }, session.token);
      if (rev === latest.current) setDirty(false);
      setMessage(
        session.demo
          ? "Demostración: no se guardó en un cartel."
          : "Guardado en el cartel. Se conserva al apagar.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function undo() {
    const previous = history[history.length - 1];
    if (!previous) return;
    session.setSettings(previous);
    setHistory((h) => h.slice(0, -1));
    setDirty(true);
    setRevision((v) => v + 1);
    latest.current++;
  }
  async function chooseContent(mode: "ticker" | "text") {
    change({ mode });
    if (session.device) {
      try {
        await request(
          session.device.address,
          "animation/settings",
          session.token,
          { enabled: false, onlyMedia: false, loops: 2, rounds: 1 },
        );
        setMessage(
          "Reproductor pausado. Mostrando " +
            (mode === "ticker" ? "cotizaciones" : "texto") +
            ".",
        );
      } catch (e) {
        setMessage((e as Error).message);
      }
    }
  }
  const colorNames: Record<string, string> = {
    DCEBFF: "Blanco",
    "00FF46": "Verde",
    FF191E: "Rojo",
    FF7D00: "Naranja",
    "00DCFF": "Celeste",
    AA32FF: "Violeta",
    FFFF00: "Amarillo",
  };
  const palette = [
    "DCEBFF",
    "00FF46",
    "FF191E",
    "FF7D00",
    "00DCFF",
    "AA32FF",
    "FFFF00",
  ];
  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Hero
          eyebrow="ESTUDIO · 64 × 32"
          title={s.name}
          description="Elegí qué mostrar. Dale tu estilo. Mirá el resultado."
        />
        <Badge good={!session.demo}>
          {session.demo
            ? "DEMO · NO MODIFICA EL CARTEL"
            : `VINCULADO · ${session.device?.address}`}
        </Badge>
        <Matrix settings={s} quotes={session.quotes} playing={playing} />
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <Button
            secondary
            title={playing ? "Pausar vista previa" : "Animar vista previa"}
            onPress={() => setPlaying(!playing)}
          />
          <Button
            secondary
            title="Deshacer"
            disabled={!history.length || saving}
            onPress={undo}
          />
        </View>
        <Segments
          value={section}
          onChange={setSection}
          options={[
            { key: "content", title: "Contenido" },
            { key: "style", title: "Estilo" },
            { key: "settings", title: "Ajustes" },
          ]}
        />
        {!session.demo && (
          <View style={[styles.row, { justifyContent: "space-between" }]}>
            <Label>Aplicar cambios en vivo</Label>
            <Switch
              accessibilityLabel="Aplicar cambios en vivo"
              value={live}
              onValueChange={setLive}
              trackColor={{ true: colors.accent }}
            />
          </View>
        )}
        {!!(validateSettings(s) || message) && (
          <Text accessibilityLiveRegion="polite" style={styles.subtitle}>
            {validateSettings(s) || message}
          </Text>
        )}
        {section === "content" && (
          <Card>
            <Label>¿Qué querés mostrar?</Label>
            <View style={styles.row}>
              {(["ticker", "text"] as const).map((mode) => (
                <Button
                  key={mode}
                  title={mode === "ticker" ? "Cotizaciones" : "Texto libre"}
                  secondary={s.mode !== mode}
                  onPress={() => void chooseContent(mode)}
                />
              ))}
            </View>
            <Button
              secondary
              title="Solo imágenes / GIF · Armar cola"
              onPress={() => router.push("/animations")}
            />
            {s.mode === "text" ? (
              <>
                <Input
                  accessibilityLabel="Texto del cartel"
                  value={s.message}
                  maxLength={80}
                  autoCapitalize="characters"
                  onChangeText={(v) => change({ message: v.toUpperCase() })}
                />
                <Text style={styles.note}>
                  A–Z, números, espacios, puntos, +, - y %. Hasta 80 caracteres.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.note}>
                  Elegí las monedas y su orden. ↑ adelanta una posición.
                </Text>
                {symbols.map((symbol, i) => (
                  <View
                    key={symbol}
                    style={[styles.row, { justifyContent: "space-between" }]}
                  >
                    <Text style={styles.label}>
                      {symbol}
                      {s.coins.includes(i)
                        ? ` · ${s.coins.indexOf(i) + 1}`
                        : ""}
                    </Text>
                    <View style={styles.row}>
                      {s.coins.indexOf(i) > 0 && (
                        <Button
                          title="↑"
                          secondary
                          onPress={() => {
                            const coins = [...s.coins],
                              at = coins.indexOf(i);
                            [coins[at - 1], coins[at]] = [
                              coins[at],
                              coins[at - 1],
                            ];
                            change({ coins });
                          }}
                        />
                      )}
                      <Switch
                        accessibilityLabel={`Mostrar ${symbol}`}
                        value={s.coins.includes(i)}
                        onValueChange={(yes) => {
                          if (!yes && s.coins.length === 1) {
                            setMessage("Dejá al menos una moneda activada.");
                            return;
                          }
                          change({
                            coins: yes
                              ? [...s.coins, i]
                              : s.coins.filter((c) => c !== i),
                          });
                        }}
                      />
                    </View>
                  </View>
                ))}
              </>
            )}
          </Card>
        )}
        {section === "style" && (
          <>
            <Card>
              <Label>Un estilo en un toque</Label>
              <Text style={styles.note}>
                Cambia letras, colores y movimiento. Conserva tu brillo y tus
                monedas.
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {presets.map((p) => (
                  <Pressable
                    key={p.name}
                    accessibilityRole="button"
                    accessibilityLabel={`Aplicar estilo ${p.name}`}
                    accessibilityState={{
                      selected: Object.entries(p.settings).every(
                        ([k, v]) => s[k as keyof Settings] === v,
                      ),
                    }}
                    onPress={() => change(p.settings)}
                    style={{
                      width: "48%",
                      flexGrow: 1,
                      padding: 14,
                      borderRadius: 16,
                      backgroundColor: "#10111B",
                      borderWidth: 1,
                      borderColor: Object.entries(p.settings).every(
                        ([k, v]) => s[k as keyof Settings] === v,
                      )
                        ? colors.accent
                        : colors.line,
                      gap: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: p.color,
                        fontSize: 24,
                        fontWeight: "800",
                      }}
                    >
                      Aa
                    </Text>
                    <Text style={styles.label}>
                      {Object.entries(p.settings).every(
                        ([k, v]) => s[k as keyof Settings] === v,
                      )
                        ? "✓ "
                        : ""}
                      {p.name}
                    </Text>
                    <Text style={styles.note}>{p.detail}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>
            <Card>
              <Label>Letras y distribución</Label>
              <View style={styles.row}>
                <Button
                  title="Compacta 6×10"
                  secondary={s.font !== "compact"}
                  onPress={() =>
                    change({ font: "compact", top: 4, bottom: 18 })
                  }
                />
                <Button
                  title="Clásica 10×14"
                  secondary={s.font !== "classic"}
                  onPress={() =>
                    change({ font: "classic", top: 2, bottom: 16 })
                  }
                />
              </View>
              <Text style={styles.note}>
                Ambas fuentes conservan trazos de 2 píxeles.
              </Text>
              <Button
                secondary
                title={
                  advanced
                    ? "Ocultar posición avanzada"
                    : "Ajustar posición y márgenes"
                }
                onPress={() => setAdvanced(!advanced)}
              />
              {advanced && (
                <>
                  <Range
                    title="Altura del precio / texto"
                    value={s.top}
                    min={0}
                    max={s.font === "compact" ? 22 : 18}
                    unit=" px"
                    change={(top) => change({ top })}
                  />
                  <Range
                    title="Altura de la variación"
                    value={s.bottom}
                    min={0}
                    max={s.font === "compact" ? 22 : 18}
                    unit=" px"
                    change={(bottom) => change({ bottom })}
                  />
                  <Range
                    title="Margen lateral"
                    value={s.inset}
                    min={0}
                    max={8}
                    unit=" px"
                    change={(inset) => change({ inset })}
                  />
                </>
              )}
              <View style={[styles.row, { justifyContent: "space-between" }]}>
                <Text style={styles.subtitle}>Mostrar logo</Text>
                <Switch
                  value={s.showLogo}
                  onValueChange={(showLogo) => change({ showLogo })}
                />
              </View>
              {s.showLogo && advanced && (
                <Range
                  title="Texto respecto al logo"
                  value={s.textX}
                  min={0}
                  max={40}
                  unit=" px"
                  change={(textX) => change({ textX })}
                />
              )}
              <Text style={styles.note}>
                El logo acompaña al texto durante el recorrido.
              </Text>
            </Card>
            <Card>
              <Label>Colores</Label>
              {(["priceColor", "positiveColor", "negativeColor"] as const).map(
                (key, i) => (
                  <View key={key} style={{ gap: 10 }}>
                    <Text style={styles.subtitle}>
                      {["Precio y texto", "Suba", "Baja"][i]} ·{" "}
                      {colorNames[s[key].toUpperCase()] || "#" + s[key]}
                    </Text>
                    <View style={styles.row}>
                      {palette.map((color) => (
                        <Pressable
                          key={color}
                          accessibilityRole="button"
                          accessibilityLabel={`${colorNames[color]} para ${["Precio y texto", "Suba", "Baja"][i]}`}
                          accessibilityState={{
                            selected: s[key].toUpperCase() === color,
                          }}
                          onPress={() => change({ [key]: color })}
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 17,
                            backgroundColor: "#" + color,
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: s[key].toUpperCase() === color ? 3 : 0,
                            borderColor: "#FFFFFF",
                          }}
                        >
                          <Text
                            style={{
                              color: "#080810",
                              fontSize: 24,
                              fontWeight: "900",
                            }}
                          >
                            {s[key].toUpperCase() === color ? "✓" : ""}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ),
              )}
            </Card>
          </>
        )}
        {section === "settings" && (
          <>
            <Card>
              <Label>Movimiento y luz</Label>
              <View style={styles.row}>
                {[
                  { name: "Tranquilo", value: 240 },
                  { name: "Normal", value: 140 },
                  { name: "Rápido", value: 70 },
                ].map((v) => (
                  <Button
                    key={v.name}
                    secondary={s.interval !== v.value}
                    title={v.name}
                    onPress={() => change({ interval: v.value })}
                  />
                ))}
              </View>
              <Range
                title="Velocidad del carrusel"
                display={`${(2000 / s.interval).toFixed(1)} px/s`}
                value={1040 - s.interval}
                min={40}
                max={1000}
                step={10}
                unit=""
                change={(value) => change({ interval: 1040 - value })}
              />
              <Text style={styles.note}>
                Izquierda: más lento · Derecha: más rápido
              </Text>
              <Range
                title="Brillo"
                value={s.brightness}
                min={0}
                max={80}
                step={1}
                unit="%"
                change={(brightness) => change({ brightness })}
              />
            </Card>
            <Card>
              <Label>Nombre del cartel</Label>
              <Input
                accessibilityLabel="Nombre del cartel"
                value={s.name}
                maxLength={24}
                onChangeText={(name) => change({ name })}
              />
              <Text style={styles.note}>
                Un nombre corto para distinguir tus pantallas.
              </Text>
            </Card>
            {!session.demo && (
              <Button
                secondary
                title="Identificar este cartel"
                onPress={() =>
                  request(
                    session.device!.address,
                    "identify",
                    session.token,
                    {},
                  ).catch((e) => setMessage(e.message))
                }
              />
            )}
          </>
        )}
        <Text style={styles.note}>
          {section === "content"
            ? "El orden de las monedas es el orden del carrusel."
            : section === "style"
              ? "Letras con trazos de 2 píxeles para que se lean a distancia."
              : "Los cambios se conservan al tocar Guardar."}
        </Text>
      </ScrollView>
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 10,
          paddingBottom: 12,
          gap: 8,
          borderTopWidth: 1,
          borderColor: colors.line,
          backgroundColor: "#12131E",
        }}
      >
        <Text accessibilityLiveRegion="polite" style={styles.note}>
          {validateSettings(s) ||
            (dirty ? "Cambios sin guardar" : "Diseño listo")}
          {session.demo ? " · Demostración" : ""}
        </Text>
        <Button
          title={
            saving
              ? "Guardando…"
              : session.demo
                ? "Probar guardado (demo)"
                : "Guardar en el cartel"
          }
          disabled={saving || !!validateSettings(s)}
          onPress={save}
        />
      </View>
    </SafeAreaView>
  );
}
