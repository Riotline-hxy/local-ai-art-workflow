import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

test('chat sends selected model and effort without altering provider config', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'photo-chat-options-'));
    const initialFetch = globalThis.fetch;
    const oldPassword = process.env.APP_PASSWORD;
    delete process.env.APP_PASSWORD;
    try {
        for(const [source,name] of [['src/lib/text-options.ts','text-options.mjs'],['src/lib/model-catalog.ts','model-catalog.mjs'],['src/app/api/chat/route.ts','chat.mjs']]) {
            const content = (await fs.readFile(new URL('../'+source,import.meta.url),'utf8')).replaceAll("'next/server'","'./next.mjs'").replaceAll("'openai'","'./openai.mjs'").replaceAll("'@/lib/runtime-config'","'./runtime.mjs'").replaceAll("'@/lib/private-access'","'./access.mjs'").replaceAll("'@/lib/text-options'","'./text-options.mjs'").replaceAll("'@/lib/model-catalog'","'./model-catalog.mjs'");
            await fs.writeFile(path.join(dir,name),ts.transpileModule(content,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText);
        }
        await fs.writeFile(path.join(dir,'next.mjs'),'export class NextResponse extends Response { static json(data, options) { return Response.json(data, options); } }');
        await fs.writeFile(path.join(dir,'runtime.mjs'),"export const config = {promptRefinerApiKey:'test-key',promptRefinerBaseUrl:'https://text.example.test/v1',promptRefinerModel:'gpt-default',promptRefinerEffort:'low'};export async function getRuntimeConfig(){return {...config}}");
        await fs.writeFile(path.join(dir,'access.mjs'),"export function accessDenied(r){return r.headers.get('x-test-denied') ? Response.json({error:'denied'},{status:403}) : null} export function sameSecret(a,b){return a===b}");
        await fs.writeFile(path.join(dir,'openai.mjs'),"export const calls=[]; export default class OpenAI { static APIError=class extends Error {}; constructor(config){this.chat={completions:{create:async(params)=>{calls.push({config,params});return {choices:[{message:{content:'hello'}}]}}}}; } }");
        globalThis.fetch = async () => Response.json({data:[{id:'gpt-default'},{id:'gpt-chosen'},{id:'gpt-image-2'}]});
        const { POST } = await import(pathToFileURL(path.join(dir,'chat.mjs')).href);
        const { calls } = await import(pathToFileURL(path.join(dir,'openai.mjs')).href);
        const { config } = await import(pathToFileURL(path.join(dir,'runtime.mjs')).href);
        const request = (body,headers={}) => new Request('http://localhost/api/chat',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({messages:[{role:'user',content:'hello'}],...body})});
        assert.equal((await POST(request({model:'gpt-chosen',effort:'high',baseUrl:'https://bad.test',apiKey:'bad'}))).status,200);
        assert.equal(calls[0].params.model,'gpt-chosen');
        assert.equal(calls[0].params.reasoning_effort,'high');
        assert.equal(calls[0].config.apiKey,'test-key');
        assert.equal(calls[0].config.baseURL,'https://text.example.test/v1');
        assert.equal('temperature' in calls[0].params,false);
        assert.equal((await POST(request({model:'gpt-chosen',effort:'default'}))).status,200);
        assert.equal('reasoning_effort' in calls[1].params,false);
        assert.equal((await POST(request({model:'gpt-chosen',effort:'none'}))).status,200);
        assert.equal(calls[2].params.reasoning_effort,'none');
        assert.equal((await POST(request({model:'gpt-chosen',effort:'extreme'}))).status,400);
        assert.equal((await POST(request({model:'gpt-image-2',effort:'default'}))).status,400);
        assert.equal((await POST(request({model:'gpt-chosen',effort:'high'},{'x-test-denied':'1'}))).status,403);
        assert.equal(calls.length,3);
        assert.equal(config.promptRefinerModel,'gpt-default');
        assert.equal(config.promptRefinerEffort,'low');
    } finally {
        globalThis.fetch=initialFetch;
        if(oldPassword===undefined) delete process.env.APP_PASSWORD; else process.env.APP_PASSWORD=oldPassword;
        await fs.rm(dir,{recursive:true,force:true});
    }
});
