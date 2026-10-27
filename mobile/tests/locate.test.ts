import test from 'node:test';
import assert from 'node:assert/strict';
import { locateDevice, Browse } from '../src/lib/locate';
import type { Device } from '../src/lib/model';
const old = {id:'B0A732378074',address:'192.168.1.96:8080'} as Device;
const fresh = {...old,address:'192.168.1.69:8080'};
test('reachable saved address does not start discovery',async()=>{
 assert.equal(await locateDevice(old,async()=>old,async()=>{throw Error('unexpected scan');}),old);
});
test('changed DHCP address is recovered by ID, ignoring other panels',async()=>{
 let cleaned=0;
 const browse:Browse=async found=>{found({...fresh,id:'AAAAAAAAAAAA'});found(fresh);return()=>{cleaned++;};};
 assert.equal(await locateDevice(old,async()=>{throw Error('offline');},browse),fresh);
 await Promise.resolve();assert.equal(cleaned,1);
});
test('old IP assigned to another device is never returned',async()=>{
 assert.equal(await locateDevice(old,async()=>({...old,id:'AAAAAAAAAAAA'}),async found=>{
  found(fresh);return()=>{};
 }),fresh);
});
test('absent device times out and closes discovery',async()=>{
 let cleaned=0;
 await assert.rejects(locateDevice(old,async()=>{throw Error('offline');},async()=>()=>{cleaned++;},10),/mismo Wi-Fi/);
 assert.equal(cleaned,1);
});
test('discovery error closes subscription even if setup resolves late',async()=>{
 let cleaned=0;
 await assert.rejects(locateDevice(old,async()=>{throw Error('offline');},async(_found,error)=>{
  error('No multicast');await new Promise(r=>setTimeout(r,5));return()=>{cleaned++;};
 }),/No multicast/);
 await new Promise(r=>setTimeout(r,15));assert.equal(cleaned,1);
});
