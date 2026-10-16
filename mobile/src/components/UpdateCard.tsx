import { useState } from 'react';
import { Text } from 'react-native';
import * as Updates from 'expo-updates';
import { Button, Card, Label, styles } from './ui';
export default function UpdateCard() {
  const [status, setStatus] = useState('Los cambios se descargan al abrir y se aplican en el próximo inicio.');
  const [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true);
    try {
      if (!Updates.isEnabled) { setStatus('Disponible en la APK con actualizaciones habilitadas.'); return; }
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) { await Updates.fetchUpdateAsync(); setStatus('Actualización descargada. Cerrá y volvé a abrir la app cuando termines.'); }
      else setStatus('Esta app ya está al día.');
    } catch { setStatus('No se pudo consultar. Revisá Internet; podés seguir usando la app.'); }
    finally { setBusy(false); }
  }
  return <Card><Label>Actualizaciones de la app</Label><Text style={styles.note}>{status}</Text>
    <Button title={busy ? 'Buscando…' : 'Buscar actualización'} disabled={busy} onPress={() => void check()} />
  </Card>;
}
