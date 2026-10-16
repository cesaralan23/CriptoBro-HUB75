import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { fromByteArray } from 'base64-js';
import { Button, Card, Label, styles } from '../components/ui';
import ClipPreview from '../components/ClipPreview';
import { Clip, crc32, meme, memeNames } from '../lib/animation';
import { importMedia } from '../lib/importMedia';
import { request } from '../lib/api';
import { useSession } from '../lib/session';
type AnimationState = {available: boolean; enabled: boolean; name: string; loops: number; rounds: number};
export default function Animations() {
  const {device, token, demo} = useSession();
  const gallery = useMemo(() => memeNames.map(meme), []);
  const [clip, setClip] = useState<Clip>(gallery[0]), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [seconds, setSeconds] = useState(3), [loops, setLoops] = useState(2), [rounds, setRounds] = useState(1), [active, setActive] = useState<AnimationState | null>(null);
  useEffect(() => {
    if (!device) return;
    let live = true;
    request<AnimationState>(device.address, 'animation', token).then(s => { if (live) { setActive(s); setLoops(s.loops); setRounds(s.rounds); } }).catch(e => { if (live) setMessage(`No pude leer el reproductor: ${e.message}. Requiere firmware 1.2.0.`); });
    return () => { live = false; };
  }, [device, token]);
  async function action(work: () => Promise<void>) { setBusy(true); setMessage(''); try { await work(); } catch (e) { setMessage(e instanceof Error ? e.message : 'No se pudo completar'); } finally { setBusy(false); } }
  async function configure(enabled: boolean) {
    if (!device) { setMessage('Vista de demostración: no se envió al cartel.'); return; }
    const s = await request<AnimationState>(device.address, 'animation/settings', token, {enabled, loops, rounds}); setActive(s); setMessage('Alternancia guardada en el cartel.');
  }
  async function upload() {
    if (!device) { setMessage('Vinculá un cartel para enviar. La vista previa funciona en demo.'); return; }
    const transfer = await request<{upload: string}>(device.address, 'animation/start', token, {size: clip.bytes.length, crc: crc32(clip.bytes), name: clip.name});
    for (let offset = 0; offset < clip.bytes.length; offset += 768) {
      await request(device.address, 'animation/chunk', token, {upload: transfer.upload, offset, data: fromByteArray(clip.bytes.slice(offset, offset + 768))});
      setMessage(`Enviando… ${Math.min(100, Math.round((offset + 768) * 100 / clip.bytes.length))}%`);
    }
    setActive(await request<AnimationState>(device.address, 'animation/finish', token, {upload: transfer.upload}));
    await configure(true);
    await request(device.address, 'animation/play', token, {});
    setMessage('Clip guardado. Se reproduce ahora y alternará con las cotizaciones.');
  }
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.title}>Memes y clips</Text>
    <Text style={styles.subtitle}>GIF o video → 64 × 32 píxeles. Sin audio, hasta 5 segundos. Se guarda un clip en el cartel y se repite entre vueltas de cotizaciones.</Text>
    {demo && <Text style={styles.note}>DEMOSTRACIÓN · No hay un cartel vinculado</Text>}
    <Card><ClipPreview clip={clip} /><Label>{clip.name}</Label><Text style={styles.note}>{(clip.frames.length / clip.fps).toFixed(1)} s · {clip.fps} cuadros/s · {(clip.bytes.length / 1024).toFixed(1)} / 40 KB</Text>
      <Text style={styles.note}>Se conserva la proporción con márgenes negros. Si hace falta, se reducen los cuadros por segundo para que entre.</Text>
      <Button disabled={busy} title="Enviar y reproducir" onPress={() => void action(upload)} />
    </Card>
    {!!message && <Text accessibilityLiveRegion="polite" style={styles.subtitle}>{message}</Text>}
    <Card><Label>Cargar desde el celular</Label><Text style={styles.note}>Tomar los primeros {seconds} segundos · Archivo de hasta 20 MB</Text><View style={styles.row}>{[1,2,3,4,5].map(n => <Button key={n} title={`${n} s`} secondary={seconds !== n} disabled={busy} onPress={() => setSeconds(n)} />)}</View>
      <Button disabled={busy} title={busy ? 'Procesando…' : 'Elegir GIF o video'} onPress={() => void action(async () => {const result = await importMedia(seconds, setMessage); if (result) {setClip(result); setMessage('Listo para revisar y enviar.');}})} />
    </Card>
    <Card><Label>Alternar con cotizaciones</Label><Text style={styles.note}>En el cartel: {active?.available ? active.name : 'sin clip'} · {active?.enabled ? 'activo' : 'pausado'}</Text>
      <Text style={styles.subtitle}>Repetir el clip {loops} veces</Text><View style={styles.row}>{[1,2,3,4,5].map(n => <Button key={n} disabled={busy} title={`${n}`} secondary={loops !== n} onPress={() => setLoops(n)} />)}</View>
      <Text style={styles.subtitle}>Después de {rounds} vuelta(s) de todas las monedas</Text><View style={styles.row}>{[1,2,3,4,5].map(n => <Button key={n} disabled={busy} title={`${n}`} secondary={rounds !== n} onPress={() => setRounds(n)} />)}</View>
      <Text style={styles.note}>La alternancia funciona en modo cotizaciones. El brillo sigue el ajuste del cartel, con máximo de 80%.</Text>
      <Button disabled={busy || (!demo && !active?.available)} title="Guardar y activar alternancia" onPress={() => void action(() => configure(true))} />
      <Button disabled={busy || (!demo && !active?.available)} secondary title="Pausar animaciones" onPress={() => void action(() => configure(false))} />
    </Card>
    <Label>Plantillas de memes</Label><Text style={styles.note}>Animaciones pixeladas listas para usar. Elegí una, revisala arriba y enviala al cartel.</Text>
    {gallery.map(item => <Card key={item.name}><ClipPreview clip={item} playing={false} /><Button disabled={busy} secondary title={`Elegir ${item.name}`} onPress={() => {setClip(item); setMessage(`${item.name} seleccionado. Revisá la vista previa de arriba.`);}} /></Card>)}
  </ScrollView>;
}
