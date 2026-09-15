import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const { NextRequest } = require('next/server');
test('invitation redirects, UTF-8 rejection pages, and cookie access', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'photo-invite-test-'));
    const keys = ['PHOTO_ACCESS_TOKEN','NEXT_PUBLIC_BASE_PATH','PHOTO_PUBLIC_ORIGIN'];
    const old = Object.fromEntries(keys.map(k => [k, process.env[k]]));
    try {
        Object.assign(process.env, { PHOTO_ACCESS_TOKEN: 'test-invite-only', NEXT_PUBLIC_BASE_PATH: '/photo', PHOTO_PUBLIC_ORIGIN: 'https://example.test' });
        for (const [source, target] of [['src/lib/private-access.ts','private-access.mjs'],['src/proxy.ts','proxy.mjs']]) {
            const text = (await fs.readFile(new URL('../'+source, import.meta.url),'utf8'))
                .replaceAll("'next/server'", JSON.stringify(pathToFileURL(require.resolve('next/server')).href))
                .replaceAll("'./lib/private-access'", "'./private-access.mjs'");
            await fs.writeFile(path.join(dir,target),ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText);
        }
        const { proxy } = await import(pathToFileURL(path.join(dir,'proxy.mjs')).href);
        const request = (suffix, headers = {}) => new NextRequest('https://example.test/photo'+suffix, {headers, nextConfig:{basePath:'/photo'}});
        const denied = proxy(request('', {accept:'text/html'}));
        assert.equal(denied.status,403);
        assert.match(denied.headers.get('content-type'),/text\/html; charset=utf-8/);
        assert.match(await denied.text(),/请使用完整邀请链接/);
        const api = proxy(request('/api/models',{accept:'application/json'}));
        assert.equal(api.status,403);
        assert.match(api.headers.get('content-type'),/application\/json; charset=utf-8/);
        for (const suffix of ['', '/chat']) {
            const invited = proxy(request(suffix+'?invite=test-invite-only', {accept:'text/html'}));
            assert.equal(invited.headers.get('location'),'https://example.test/photo'+suffix);
            const cookie = invited.headers.get('set-cookie').split(';')[0];
            assert.equal(proxy(request(suffix,{cookie,accept:'text/html'})).status,200);
        }
        assert.equal(proxy(request('?invite=wrong',{accept:'text/html'})).status,403);
    } finally {
        for(const k of keys) if(old[k]===undefined) delete process.env[k]; else process.env[k]=old[k];
        await fs.rm(dir,{recursive:true,force:true});
    }
});
