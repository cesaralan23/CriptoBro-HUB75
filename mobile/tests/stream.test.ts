import test from 'node:test';
import assert from 'node:assert/strict';
import { streamQueue } from '../src/lib/stream';
import { request } from '../src/lib/api';
import { fitClip } from '../src/lib/animation';
import { packQueue } from '../src/lib/playlist';

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
