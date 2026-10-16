import test from 'node:test';
import assert from 'node:assert/strict';
import { streamQueue } from '../src/lib/stream';
import { request } from '../src/lib/api';
import { fitClip } from '../src/lib/animation';
import { packQueue } from '../src/lib/playlist';
import { ApiError } from '../src/lib/api';
import { openFrameChannel } from '../src/lib/streamSocket';

test('stream acknowledges sequential frames, drops late frames, and stops its session', async () => {
  let time=0, sent=0, stopped=false, inFlight=false;
  const clip=fitClip('test',[new Uint8Array(2048).fill(28),new Uint8Array(2048).fill(224)],8);
  const call = (async (_a:string,path:string,_t?:string,body?:unknown) => {
    assert.equal(inFlight,false);inFlight=true;
    await Promise.resolve();inFlight=false;
    if(path==='info')return {streamApi:1};
    if(path==='stream/start')return {session:'abc'};
    if(path==='stream/stop'){stopped=true;return {};}
    const b=body as {seq:number;data:string;session:string};
    assert.equal(b.seq,++sent);assert.equal(b.session,'abc');
    assert.equal(Buffer.from(b.data,'base64').length,2048);
    time+=400;
    return {seq:b.seq};
  }) as typeof request;
  await streamQueue('192.168.1.96:8080','test',[{id:'a',clip,seconds:1}],()=>sent>=3,()=>{},call,async ms=>{time+=ms;},()=>time);
  assert.equal(sent,3);assert.equal(stopped,true);
});
test('stream failure always attempts stop without changing saved media', async () => {
  const paths:string[]=[];
  const call=(async (_a:string,p:string)=>{
    paths.push(p);
    if(p==='info')return {streamApi:1};
    if(p==='stream/start')return {session:'abc'};
    if(p==='stream/frame')throw new Error('offline');
    return {};
  }) as typeof request;
  await assert.rejects(streamQueue('192.168.1.2:8080','t',[{id:'a',clip:fitClip('x',[new Uint8Array(2048)],1),seconds:1}],()=>false,()=>{},call),/offline/);
  assert.deepEqual(paths,['info','stream/start','stream/frame','stream/stop']);
});
test('large queue is streamable but blocked by the original device storage limit',()=>{
  const clip=fitClip('noise',Array.from({length:240},(_,j)=>Uint8Array.from({length:2048},(_,i)=>(i+j)%256)),8);
  assert.ok(clip.bytes.length<=307200);
  assert.equal(clip.frames.length/clip.fps,30);
  const items=[{id:'a',clip,seconds:30}];
  assert.throws(()=>packQueue(items,40960),/40 KB/);
  assert.ok(packQueue(items,307200).length>40960);
});

test('30fps originals remain available for streaming while flash encoding stays compatible',()=>{
  const frames=Array.from({length:900},(_,j)=>Uint8Array.from({length:2048},(_,i)=>(i+j)%256));
  const clip=fitClip('30s',frames,30);
  assert.equal(clip.frames.length,900);assert.equal(clip.fps,30);
  assert.ok(clip.bytes[4]<=10);assert.ok(clip.bytes.length<=307200);
});

test('binary streaming reconnects after a lost connection without touching saved media',async()=>{
  let time=0, sent=0, connections=0, closed=0;
  const paths:string[]=[];
  const call=(async (_a:string,path:string)=>{
    paths.push(path);
    if(path==='info')return {streamApi:1,streamWsApi:1,id:'same'};
    if(path==='stream/start')return {session:'s'+connections,wsPort:8081};
    return {};
  }) as typeof request;
  const connect=(async()=>{
    connections++;const first=connections===1;
    return {close(){closed++;},async send(){if(first)throw new Error('wifi lost');sent++;time+=5;}};
  }) as typeof openFrameChannel;
  await streamQueue('192.168.1.2:8080','t',[{id:'x',clip:fitClip('x',[new Uint8Array(2048)],30),seconds:2}],()=>sent===4,()=>{},call,async ms=>{time+=ms;},()=>time,connect);
  assert.equal(connections,2);assert.ok(closed>=2);
  assert.ok(paths.every(p=>!p.startsWith('animation')));assert.equal(paths.at(-1),'stream/stop');
});

test('reconnect retries offline discovery and can be cancelled without sending media',async()=>{
  let attempts=0,cancel=false;
  const call=(async()=>{attempts++;throw new Error('offline');}) as typeof request;
  await streamQueue('192.168.1.2','t',[{id:'x',clip:fitClip('x',[new Uint8Array(2048)],1),seconds:1}],()=>cancel,()=>{},call,async()=>{cancel=true;});
  assert.equal(attempts,1);
});

test('invalid pairing stops reconnect attempts',async()=>{
  const call=(async (_a:string,p:string)=>{
    if(p==='info')return {streamWsApi:1,id:'same'};
    throw new ApiError(401,'pair again');
  }) as typeof request;
  await assert.rejects(streamQueue('192.168.1.2','t',[{id:'x',clip:fitClip('x',[new Uint8Array(2048)],1),seconds:1}],()=>false,()=>{},call),/pair again/);
});

test('WebSocket packs binary frames, checks acknowledgements and rejects after close',async()=>{
  const wire:any={send(data:unknown){
    if(typeof data==='string')queueMicrotask(()=>wire.onmessage({data:'ready'}));
    else {const frame=new Uint8Array(data as ArrayBuffer);assert.equal(frame.length,2052);assert.equal(frame[4],28);
      queueMicrotask(()=>wire.onmessage({data:frame.buffer.slice(0,4)}));}
  },close(){wire.onclose?.();}};
  const opened=openFrameChannel('192.168.1.2:8080',8081,'session',()=>wire as WebSocket);
  wire.onopen();const channel=await opened;
  await channel.send(new Uint8Array(2048).fill(28));channel.close();
  await assert.rejects(channel.send(new Uint8Array(2048)),/desconectado/);
});

test('WebSocket bounds outstanding frames to three and clears all on disconnect',async()=>{
  const wire:any={send(data:unknown){if(typeof data==='string')queueMicrotask(()=>wire.onmessage({data:'ready'}));},close(){wire.onclose?.();}};
  const opened=openFrameChannel('192.168.1.2:8080',8081,'session',()=>wire as WebSocket);
  wire.onopen();const channel=await opened,frame=new Uint8Array(2048);
  const outstanding=Array.from({length:3},()=>channel.send(frame));
  const settled=Promise.allSettled(outstanding);
  await assert.rejects(channel.send(frame),/ventana llena/);
  channel.close();assert.ok((await settled).every(r=>r.status==='rejected'));
});
