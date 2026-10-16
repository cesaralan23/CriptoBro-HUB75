import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { createVideoPlayer } from 'expo-video';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { pngFrame } from './png';
import { decodeGif } from './gif';
import { fitClip } from './animation';
export async function importMedia(seconds: number, progress: (text: string) => void) {
  const result = await DocumentPicker.getDocumentAsync({type: ['image/gif', 'video/*'], copyToCacheDirectory: true});
  if (result.canceled) return null;
  const asset = result.assets[0];
  const name = [...asset.name].slice(0, 16).join(''); // At most 64 UTF-8 bytes.
  const input = Platform.OS === 'web' ? null : new File(asset.uri);
  try {
    if ((asset.size || input?.size || 0) > 20 * 1024 * 1024) throw new Error('Elegí un archivo de hasta 20 MB');
    progress('Convirtiendo a 64 × 32…');
    if (asset.name.toLowerCase().endsWith('.gif') || asset.mimeType === 'image/gif') {
      const bytes = input ? await input.bytes() : new Uint8Array(await asset.file!.arrayBuffer());
      return decodeGif(bytes, name, seconds);
    }
    if (Platform.OS === 'web') throw new Error('Importá videos desde la app en Android. Acá podés probar GIF y memes.');
    const player = createVideoPlayer(null);
    try {
      await player.replaceAsync({uri: asset.uri});
      // Android replaceAsync resolves after prepare(), before metadata is ready.
      const deadline = Date.now() + 15000;
      while (player.duration <= 0 && player.status !== 'error' && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      const duration = Math.min(seconds, player.duration);
      if (!Number.isFinite(duration) || duration <= 0) throw new Error('No se pudo leer este video. Probá un MP4 con H.264.');
      const frames: Uint8Array[] = [], count = Math.max(1, Math.floor(duration * 8));
      for (let i = 0; i < count; i++) {
        progress(`Convirtiendo cuadro ${i + 1} de ${count}…`);
        const [thumbnail] = await player.generateThumbnailsAsync(i / 8, {maxWidth: 64, maxHeight: 32});
        const scale = Math.min(64 / thumbnail.width, 32 / thumbnail.height);
        const context = ImageManipulator.manipulate(thumbnail);
        try {
          context.resize({width: Math.max(1, Math.round(thumbnail.width * scale)), height: Math.max(1, Math.round(thumbnail.height * scale))});
          const image = await context.renderAsync();
          try {
            const saved = await image.saveAsync({format: SaveFormat.PNG});
            const file = new File(saved.uri);
            try {
              frames.push(pngFrame(await file.bytes()));
            } finally { file.delete(); }
          } finally { image.release(); }
        } finally { context.release(); }
      }
      return fitClip(name, frames, 8);
    } finally { player.release(); }
  } finally { if (input?.exists) input.delete(); }
}
