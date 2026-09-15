import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'photo-adapter-test-'));
for (const name of ['image-protocol', 'image-adapter', 'image-result']) {
 const source = (await fs.readFile(new URL('../src/lib/'+name+'.ts', import.meta.url),'utf8')).replaceAll("'./image-protocol'", "'./image-protocol.mjs'");
 await fs.writeFile(path.join(dir,name+'.mjs'),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText);
}
const { buildImageRequest, extractImages, callImageAdapter }=await import(pathToFileURL(path.join(dir,'image-adapter.mjs')));
const {resolveImage, isPublicImageAddress}=await import(pathToFileURL(path.join(dir,'image-result.mjs')));
const {resolveImageProtocol}=await import(pathToFileURL(path.join(dir,'image-protocol.mjs')));
const input={model:'gemini-2.5-flash-image',prompt:'draw',mode:'generate',protocol:'auto',n:1,size:'auto',images:[],hasMask:false};
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jr1sAAAAASUVORK5CYII=';
test('protocol selection, overrides and request schemas',()=>{
 assert.equal(resolveImageProtocol('gpt-image-2'),'gpt');
 assert.equal(resolveImageProtocol('grok-imagine-image'),'images');
 assert.equal(resolveImageProtocol(input.model,'chat'),'chat');
 const gemini=buildImageRequest(input,'https://gateway.test/v1');
 assert.equal(gemini.url,'https://gateway.test/v1beta/models/gemini-2.5-flash-image:generateContent');
 assert.deepEqual(gemini.body.generationConfig.responseModalities,['TEXT','IMAGE']);
 const seed=buildImageRequest({...input,model:'doubao-seedream-4-0',mode:'edit',images:[{data:png,mimeType:'image/png'}]},'https://gateway.test/v1');
 assert.equal(seed.body.response_format,'b64_json');assert.equal(seed.body.size,'2K');assert.match(seed.body.image,/^data:image/);
 const grok=buildImageRequest({...input,model:'grok-imagine-image'},'https://gateway.test/v1');
 assert.deepEqual(Object.keys(grok.body).sort(),['model','n','prompt','response_format']);
 assert.throws(()=>buildImageRequest({...input,n:2},'https://gateway.test/v1'),/count/);
 assert.throws(()=>buildImageRequest({...input,hasMask:true},'https://gateway.test/v1'),/Masks/);
});
test('normalize base64, URLs, Gemini parts and chat images without treating prose as image links',async()=>{
 assert.equal(extractImages({data:[{url:'https://cdn.test/a.png'}]})[0].url,'https://cdn.test/a.png');
 const gem=extractImages({candidates:[{content:{parts:[{text:'hello'},{inlineData:{data:png,mimeType:'image/png'}}]}}]});
 assert.equal((await resolveImage(gem[0])).format,'png');
 assert.equal(extractImages({choices:[{message:{images:[{image_url:{url:'data:image/png;base64,'+png}}]}}]}).length,1);
 assert.equal(extractImages({choices:[{message:{content:'Visit https://site.test/image.png'}}]}).length,0);
 await assert.rejects(resolveImage({b64_json:Buffer.from('<html>error</html>').toString('base64')}),/Invalid image bytes/);
 await assert.rejects(resolveImage({url:'http://127.0.0.1/a.png'}),/HTTPS/);
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','::1','::ffff:127.0.0.1'])assert.equal(isPublicImageAddress(ip),false);
 assert.equal(isPublicImageAddress('8.8.8.8'),true);
});
test('provider failures do not retry; generic editing uses multipart',async()=>{
 const old=globalThis.fetch; let calls=0;
 try {
  globalThis.fetch=async()=>{calls++;return Response.json({error:{message:'bad protocol'}},{status:400});};
  await assert.rejects(callImageAdapter(input,'https://gateway.test/v1','test-key'),/bad protocol/);assert.equal(calls,1);
  globalThis.fetch=async(url,options)=>{assert.match(url,/images\/edits$/);assert.ok(options.body instanceof FormData);assert.ok(options.body.get('image') instanceof Blob);assert.equal(options.headers['Content-Type'],undefined);return Response.json({data:[{b64_json:png}]});};
  await callImageAdapter({...input,model:'custom-image',mode:'edit',images:[{data:png,mimeType:'image/png'}]},'https://gateway.test/v1','test-key');
 } finally {globalThis.fetch=old;}
});
