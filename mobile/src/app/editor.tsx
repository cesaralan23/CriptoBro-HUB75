import { useEffect, useRef, useState } from "react";
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
  change,
}: {
  title: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  change: (n: number) => void;
}) {
  return (
    <View>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Text style={styles.subtitle}>{title}</Text>
        <Text style={{ color: colors.accent, fontWeight: "700" }}>
          {value}
          {unit}
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
  const session = useSession(),
    s = session.settings;
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
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View>
        <Text
          style={{
            color: colors.accent,
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 2,
          }}
        >
          {session.demo ? "MODO DEMOSTRACIÓN" : "CONECTADO POR WI-FI"}
        </Text>
        <Text style={styles.title}>{s.name}</Text>
        <Text style={styles.note}>
          {session.demo
            ? "Datos ilustrativos · Ningún dispositivo conectado"
            : `${session.device?.address} · ${session.device?.id.slice(-6)}`}
        </Text>
      </View>
      <Matrix settings={s} quotes={session.quotes} playing={playing} />
      <View style={styles.row}>
        <Button
          secondary
          title={playing ? "Pausar vista previa" : "Animar vista previa"}
          onPress={() => setPlaying(!playing)}
        />
        {!session.demo && (
          <Button
            secondary
            title="Identificar cartel"
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
      </View>
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
      <Card>
        <Label>Contenido</Label>
        <View style={styles.row}>
          {(["ticker", "text"] as const).map((mode) => (
            <Button
              key={mode}
              title={mode === "ticker" ? "Cotizaciones" : "Texto libre"}
              secondary={s.mode !== mode}
              onPress={() => change({ mode })}
            />
          ))}
        </View>
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
                  {s.coins.includes(i) ? ` · ${s.coins.indexOf(i) + 1}` : ""}
                </Text>
                <View style={styles.row}>
                  {s.coins.indexOf(i) > 0 && (
                    <Button
                      title="↑"
                      secondary
                      onPress={() => {
                        const coins = [...s.coins],
                          at = coins.indexOf(i);
                        [coins[at - 1], coins[at]] = [coins[at], coins[at - 1]];
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
      <Card>
        <Label>Tipografía y posición</Label>
        <View style={styles.row}>
          <Button
            title="Compacta 6×10"
            secondary={s.font !== "compact"}
            onPress={() => change({ font: "compact", top: 4, bottom: 18 })}
          />
          <Button
            title="Clásica 10×14"
            secondary={s.font !== "classic"}
            onPress={() => change({ font: "classic", top: 2, bottom: 16 })}
          />
        </View>
        <Text style={styles.note}>
          Ambas fuentes conservan trazos de 2 píxeles.
        </Text>
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
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <Text style={styles.subtitle}>Mostrar logo</Text>
          <Switch
            value={s.showLogo}
            onValueChange={(showLogo) => change({ showLogo })}
          />
        </View>
        {s.showLogo && (
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
        <Label>Movimiento y luz</Label>
        <Range
          title="Pausa entre pasos (más = más lento)"
          value={s.interval}
          min={40}
          max={1000}
          step={10}
          unit=" ms"
          change={(interval) => change({ interval })}
        />
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
        <Label>Colores</Label>
        {(["priceColor", "positiveColor", "negativeColor"] as const).map(
          (key, i) => (
            <View key={key} style={{ gap: 10 }}>
              <Text style={styles.subtitle}>
                {["Precio y texto", "Suba", "Baja"][i]}
              </Text>
              <View style={styles.row}>
                {palette.map((color) => (
                  <Pressable
                    key={color}
                    accessibilityRole="button"
                    accessibilityLabel={`Color ${color} para ${key}`}
                    onPress={() => change({ [key]: color })}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: "#" + color,
                      borderWidth: s[key] === color ? 3 : 0,
                      borderColor: "#FFFFFF",
                    }}
                  />
                ))}
              </View>
            </View>
          ),
        )}
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
      <Button
        title={
          saving
            ? "Guardando…"
            : session.demo
              ? "Probar guardado (demo)"
              : "Guardar en el cartel"
        }
        disabled={saving}
        onPress={save}
      />
      <Text style={styles.note}>
        {dirty ? "Hay cambios sin guardar." : "Ajustes cargados."} Guardar
        conserva el diseño aunque cortes la corriente.
      </Text>
    </ScrollView>
  );
}
