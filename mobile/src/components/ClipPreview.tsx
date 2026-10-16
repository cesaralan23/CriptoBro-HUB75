import { useEffect, useState } from 'react';
import Svg, { Path } from 'react-native-svg';
import { Clip, pixelColor } from '../lib/animation';
export default function ClipPreview({clip, playing = true}: {clip: Clip; playing?: boolean}) {
  const [index, setIndex] = useState(0);
  useEffect(() => { if (!playing) return; const t = setInterval(() => setIndex(i => (i + 1) % clip.frames.length), 1000 / clip.fps); return () => clearInterval(t); }, [clip, playing]);
  const paths = new Map<number, string>();
  clip.frames[playing ? index % clip.frames.length : Math.floor(clip.frames.length / 2)].forEach((c, i) => { if (c) paths.set(c, (paths.get(c) || '') + `M${i % 64} ${Math.floor(i / 64)}h1v1h-1z`); });
  return <Svg width="100%" viewBox="0 0 64 32" style={{aspectRatio: 2, backgroundColor: '#000', borderRadius: 8}}>{[...paths].map(([c, d]) => <Path key={c} d={d} fill={pixelColor(c)} />)}</Svg>;
}
