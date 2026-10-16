import { ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Button, Card, Label, styles } from "../components/ui";
import { Hero, Badge } from "../components/studio";
import { useSession } from "../lib/session";
export default function Help() {
  const { device, demo } = useSession();
  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Hero
          eyebrow="A MANO, CUANDO LO NECESITES"
          title="Tu cartel, sin vueltas."
          description="Conexión, guardado y reproducción: lo esencial para manejarlo con confianza."
        />
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
            "03 · Enviar un clip",
            "En Biblioteca, elegí una plantilla o importá un GIF/video. Revisá la vista previa y tocá Enviar. En Alternancia elegís cuántas repeticiones y cuántas vueltas de cotizaciones esperar.",
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
            "64 × 32 píxeles. Brillo máximo de 80%. Clips de hasta 5 segundos, sin sonido, convertidos a un máximo de 40 KB. Se guarda un clip activo; enviar otro lo reemplaza después de verificar la carga.",
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
