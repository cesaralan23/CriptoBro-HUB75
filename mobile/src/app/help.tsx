import { useState } from "react";
import { request } from "../lib/api";
import { ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Button, Card, Label, styles } from "../components/ui";
import { Hero, Badge } from "../components/studio";
import { useSession } from "../lib/session";
import UpdateCard from "../components/UpdateCard";
export default function Help() {
  const [diagnostic, setDiagnostic] = useState("");
  const { device, demo, token } = useSession();
  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Hero
          eyebrow="A MANO, CUANDO LO NECESITES"
          title="Tu cartel, sin vueltas."
          description="Conexión, guardado y reproducción: lo esencial para manejarlo con confianza."
        />
        <UpdateCard />
        <Card>
          <Badge>{demo ? "MODO DEMO" : "PANTALLA VINCULADA"}</Badge>
          <Label>{device?.name || "Todavía no elegiste un cartel"}</Label>
          <Text selectable style={styles.note}>
            {device
              ? `${device.address}\nID ${device.id}\nFirmware ${device.version}`
              : "La demostración no modifica ningún cartel."}
          </Text>
          <Button
            title="Ir a mis pantallas"
            secondary
            onPress={() => router.navigate("/")}
          />
        </Card>
        {device && (
          <Card>
            <Label>Comprobar píxeles y conexión</Label>
            <Button
              title="Mostrar patrón durante 20 segundos"
              onPress={() =>
                void request(device.address, "display-test", token, {})
                  .then(() =>
                    setDiagnostic(
                      "Mirá las líneas: deben mantenerse quietas, sin puntos fuera del dibujo. Al terminar vuelve el contenido.",
                    ),
                  )
                  .catch((e) => setDiagnostic(e.message))
              }
            />
            <Button
              secondary
              title="Consultar señal y refresco"
              onPress={() =>
                void request<{ wifiRssi: number; refreshHz: number }>(
                  device.address,
                  "info",
                )
                  .then((d) =>
                    setDiagnostic(
                      d.refreshHz
                        ? `Wi-Fi: ${d.wifiRssi} dBm · Refresco: ${d.refreshHz} Hz`
                        : "Esperá al firmware 1.3.0.",
                    ),
                  )
                  .catch((e) => setDiagnostic(e.message))
              }
            />
            <Text style={styles.note}>
              {diagnostic ||
                "Este patrón ayuda a distinguir un problema del archivo de uno de refresco o señal. No cambia el brillo."}
            </Text>
          </Card>
        )}
        {[
          [
            "01 · Conectar",
            "El celular y el cartel deben estar en la misma red Wi-Fi. En Pantallas, ingresá la IP del cartel. Para vincularlo, copiá el código de seis números que aparece en sus LEDs.",
          ],
          [
            "02 · Diseñar y guardar",
            "Elegí Contenido, Estilo o Ajustes. La vista previa muestra el diseño, no una captura del panel. Con cambios en vivo activados, el cartel recibe los ajustes; Guardar hace que sobrevivan al apagado.",
          ],
          [
            "03 · Crear una cola",
            "En Biblioteca agregá imágenes, GIF o memes a la cola. Elegí el orden y los segundos de cada elemento. Seleccioná Solo multimedia o + Cotizaciones, y guardá la cola.",
          ],
          [
            "La app no abre",
            "Con Expo Go la PC debe estar encendida y el servidor de desarrollo abierto. Abrí Iniciar-app.cmd en la carpeta mobile de la PC y reabrí el proyecto en Expo Go. Si cambió la IP de la PC, escaneá el nuevo QR. Una APK instalada incluye la app y no necesita ese servidor.",
          ],
          [
            "La app abre, pero el cartel no responde",
            "Revisá que ambos usen la misma red y que la IP guardada siga siendo la del cartel. Las redes de invitados pueden impedir que los dispositivos se comuniquen. Volvé a Pantallas para comprobar la conexión.",
          ],
          [
            "¿Qué queda guardado?",
            "La red Wi-Fi, el diseño guardado, el clip y su alternancia quedan en el cartel. El teléfono conserva la vinculación. Cerrar la app no detiene las cotizaciones ni la reproducción.",
          ],
          [
            "¿Qué significan 24H y DIA?",
            "BTC y SOL muestran su variación de las últimas 24 horas. MSTR muestra la variación del día frente al cierre anterior. DATO VIEJO indica que el cartel no pudo refrescar la información.",
          ],
          [
            "Límites de esta pantalla",
            "64 × 32 píxeles. Brillo máximo de 80%. Clips de hasta 5 segundos, sin sonido, convertidos a un máximo de 40 KB. Hasta 8 elementos por cola, con 1 a 300 segundos de exposición cada uno. Los 40 KB se comparten entre todos. La cola anterior se conserva hasta verificar la nueva.",
          ],
        ].map(([title, description]) => (
          <Card key={title}>
            <Label>{title}</Label>
            <Text style={styles.subtitle}>{description}</Text>
          </Card>
        ))}
        <Text style={styles.note}>
          CriptoBro Studio · Control local · HUB75 64 × 32
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
