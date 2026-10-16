import { useEffect, useRef, useState, useCallback } from "react";
import { ScrollView, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Hero, Badge, ActionTile, Icon } from "../components/studio";
import Matrix from "../components/Matrix";
import { Button, Card, Input, Label, styles } from "../components/ui";
import { Device, State, defaults, demoQuotes } from "../lib/model";
import { getDevice, request, ApiError } from "../lib/api";
import { remember, savedDevices, tokenFor } from "../lib/storage";
import { useSession } from "../lib/session";
import { canDiscover, discover } from "../lib/discovery";
export default function Home() {
  const session = useSession();
  const [address, setAddress] = useState(""),
    [devices, setDevices] = useState<Device[]>([]),
    [selected, setSelected] = useState<Device | null>(null),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [scanning, setScanning] = useState(false);
  const [health, setHealth] = useState<Record<string, string>>({});
  const [manual, setManual] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      savedDevices().then((ds) => {
        if (active) setDevices(ds);
      });
      return () => {
        active = false;
      };
    }, []),
  );
  async function checkDevices() {
    setBusy(true);
    await Promise.all(
      devices.map(async (d) => {
        try {
          const fresh = await getDevice(d.address);
          setHealth((h) => ({
            ...h,
            [d.id]: fresh.id === d.id ? "Disponible" : "La IP cambió",
          }));
        } catch {
          setHealth((h) => ({ ...h, [d.id]: "Sin respuesta" }));
        }
      }),
    );
    setBusy(false);
  }
  const stop = useRef<() => void>(() => {}),
    scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    savedDevices().then(setDevices);
    return () => {
      stop.current();
      if (scanTimer.current) clearTimeout(scanTimer.current);
    };
  }, []);
  const add = (d: Device) =>
    setDevices((old) => [d, ...old.filter((v) => v.id !== d.id)]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function connect(d: Device) {
    const fresh = await getDevice(d.address);
    if (fresh.id !== d.id)
      throw new Error("La IP pertenece a otro cartel. Volvé a buscarlo.");
    const token = await tokenFor(d.id);
    add(fresh);
    if (token) {
      try {
        const state = await request<State>(d.address, "state", token);
        session.open(fresh, token, state.settings, state.quotes);
        router.navigate("/editor");
        return;
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 401) throw e;
        /* Request a new physical pairing if the old key was replaced. */
      }
    }
    setSelected(fresh);
    setCode("");
    setNotice("Tocá Mostrar código y copiá los seis números del cartel.");
  }
  async function scan() {
    setScanning(true);
    setNotice("Buscando durante 12 segundos…");
    try {
      stop.current = await discover(add, setNotice);
      scanTimer.current = setTimeout(() => {
        stop.current();
        setScanning(false);
        setNotice("Búsqueda terminada. Si no aparece, conectá por IP.");
      }, 12000);
    } catch (e) {
      setScanning(false);
      setNotice((e as Error).message);
    }
  }
  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Hero
          eyebrow="CRIPTOBRO STUDIO"
          title="Un espacio para tus píxeles."
          description="Cotizaciones, mensajes y pequeños momentos en 64 × 32."
        />
        <Card>
          <View style={[styles.row, { justifyContent: "space-between" }]}>
            <Badge good={!!session.device}>
              {session.device ? "PANTALLA SELECCIONADA" : "EXPLORÁ EN DEMO"}
            </Badge>
            <Icon name="screens" />
          </View>
          <Label>
            {session.device
              ? session.settings.name
              : "Tu próximo diseño empieza acá"}
          </Label>
          <Matrix
            settings={session.settings}
            quotes={session.quotes}
            playing={false}
          />
          <Button
            title={
              session.device ? "Continuar diseñando" : "Explorar el estudio"
            }
            onPress={() => router.navigate("/editor")}
          />
        </Card>
        <View style={styles.row}>
          <ActionTile
            icon="design"
            title="Diseñar"
            detail="Texto, precios y estilos"
            onPress={() => router.navigate("/editor")}
          />
          <ActionTile
            icon="library"
            title="Biblioteca"
            detail="Memes, GIF y videos"
            onPress={() => router.navigate("/animations")}
          />
        </View>
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <Label>Mis pantallas · {devices.length}</Label>
          {!!devices.length && (
            <Button
              secondary
              title="Comprobar"
              disabled={busy}
              onPress={checkDevices}
            />
          )}
        </View>
        {!devices.length && (
          <Text style={styles.subtitle}>
            Vinculá tu primer cartel para guardar diseños y enviar contenido.
          </Text>
        )}
        {devices.map((d) => (
          <Card key={d.id}>
            <View style={styles.row}>
              <Icon name="screens" />
              <View style={{ flex: 1 }}>
                <Label>{d.name}</Label>
                <Text style={styles.note}>
                  {d.address} · {d.id.slice(-6)}
                </Text>
              </View>
              <Badge good={health[d.id] === "Disponible"}>
                {health[d.id] || "Guardado"}
              </Badge>
            </View>
            <Button
              title="Abrir pantalla"
              secondary
              disabled={busy}
              onPress={() => run(() => connect(d))}
            />
          </Card>
        ))}
        {!!devices.length && (
          <Button
            title={manual ? "Ocultar conexión" : "＋ Vincular otra pantalla"}
            secondary
            onPress={() => setManual(!manual)}
          />
        )}
        {(manual || !devices.length) && (
          <Card>
            <Label>Conectemos tu cartel</Label>
            <Text style={styles.note}>
              {canDiscover
                ? "Buscá carteles cercanos o ingresá su dirección."
                : "Expo Go: conectá por IP. La búsqueda automática está disponible en la app de desarrollo."}
            </Text>
            {canDiscover && (
              <Button
                title={scanning ? "Buscando…" : "Buscar pantallas"}
                onPress={scan}
                disabled={scanning || busy}
              />
            )}
            <Input
              accessibilityLabel="Dirección IP del cartel"
              placeholder="192.168.1.96"
              value={address}
              onChangeText={setAddress}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
            />
            <Button
              title={busy ? "Conectando…" : "Conectar por IP"}
              disabled={busy || !address.trim()}
              onPress={() =>
                run(async () => {
                  const d = await getDevice(address);
                  await connect(d);
                })
              }
            />
          </Card>
        )}
        {notice !== "" && (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {notice}
          </Text>
        )}
        {selected && (
          <Card>
            <Label>Vincular {selected.name}</Label>
            <Text style={styles.note}>
              El código vence en un minuto. Una nueva vinculación reemplaza el
              acceso del celular anterior.
            </Text>
            <Button
              secondary
              title="Mostrar código en el cartel"
              disabled={busy}
              onPress={() =>
                run(async () => {
                  await request(selected.address, "pair/start", "", {});
                  setNotice("Mirá el código en el cartel.");
                })
              }
            />
            <Input
              accessibilityLabel="Código de vinculación"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
            />
            <Button
              title="Vincular y editar"
              disabled={busy || code.length !== 6}
              onPress={() =>
                run(async () => {
                  const p = await request<{ token: string; id: string }>(
                    selected.address,
                    "pair",
                    "",
                    { code },
                  );
                  if (p.id !== selected.id)
                    throw new Error("Cambió el dispositivo");
                  await remember(selected, p.token);
                  const state = await request<State>(
                    selected.address,
                    "state",
                    p.token,
                  );
                  session.open(selected, p.token, state.settings, state.quotes);
                  setSelected(null);
                  router.navigate("/editor");
                })
              }
            />
          </Card>
        )}
        {!session.device && (
          <Card>
            <Label>Probar sin un cartel</Label>
            <Text style={styles.note}>
              Vista de ejemplo con datos ilustrativos. No modifica ninguna
              pantalla.
            </Text>
            <Button
              title="Abrir demostración"
              secondary
              onPress={() => {
                session.open(
                  null,
                  "",
                  { ...defaults, coins: [0, 1, 2] },
                  demoQuotes,
                );
                router.navigate("/editor");
              }}
            />
          </Card>
        )}
        <Text style={styles.note}>
          Solo red local · Sin cuenta · Brillo limitado al 80%
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
