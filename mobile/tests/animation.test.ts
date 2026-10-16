import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GifWriter } from 'omggif';
import { crc32, encode, fitClip, meme, memeNames, resizePixels } from '../src/lib/animation';
import { decodeGif } from '../src/lib/gif';
function unpack(bytes: Uint8Array) {
  assert.equal(String.fromCharCode(...bytes.slice(0,4)), 'CBA1');
  const frames: number[][] = []; let offset = 8;
  for (let i = 0; i < bytes[5]; i++) {
    const header = bytes[offset++] | bytes[offset++] << 8, size = header & 0x7fff;
    const end = offset + size, frame: number[] = [];
    if (header & 0x8000) { frame.push(...bytes.slice(offset,end)); offset=end; }
    else while (offset < end) { const n=bytes[offset++], c=bytes[offset++]; frame.push(...Array(n).fill(c)); }
    assert.equal(frame.length,2048); frames.push(frame);
  }
  assert.equal(offset,bytes.length); return frames;
}
test('CBA1 round trip covers raw, RLE and 255-pixel runs', () => {
  const frames = [new Uint8Array(2048).fill(28), Uint8Array.from({length:2048},(_,i)=>i%256)];
  assert.deepEqual(unpack(encode(frames,8)),frames.map(f=>[...f]));
  assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);
  assert.throws(()=>encode([new Uint8Array(1)],8));
  assert.throws(()=>encode(Array(241).fill(frames[0]),8));
});
test('complex five-second clips fit flash without changing color pixels', () => {
  const frames=Array.from({length:40},(_,j)=>Uint8Array.from({length:2048},(_,i)=>(i+j)%256));
  const clip=fitClip('noise',frames,8);
  assert.ok(clip.bytes.length<=307200); assert.equal(clip.frames.length/clip.fps,5);
  assert.equal(clip.fps,8); unpack(clip.bytes);
});
test('all meme templates are valid, animated and fit the panel', () => {
  for (const name of memeNames) { const c=meme(name); assert.ok(c.bytes.length<=40960); unpack(c.bytes); assert.ok(c.frames.some(f=>!f.every((p,i)=>p===c.frames[0][i]))); }
  const red=resizePixels(new Uint8Array([255,0,0,255]),1,1);
  assert.equal(red[0],0); assert.equal(red[32+16*64],224);
});
test('GIF disposal clears a previous patch before the next frame', () => {
  const bytes=new Uint8Array(1000), writer=new GifWriter(bytes,2,1,{palette:[0,0xff0000,0x00ff00,0xffffff]});
  writer.addFrame(0,0,2,1,[1,1],{delay:25,disposal:2});
  writer.addFrame(1,0,1,1,[2],{delay:25});
  const clip=decodeGif(bytes.slice(0,writer.end()),'test',1,8);
  assert.equal(clip.frames.length,4); assert.equal(clip.frames[0][0],224);
  assert.equal(clip.frames[2][0],0); assert.equal(clip.frames[2][63],28);
});
