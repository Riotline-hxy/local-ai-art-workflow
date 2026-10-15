import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

// Tests use only synthetic credentials and an isolated temporary working directory.
// No provider API is called and no project configuration file is read or changed.
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const initialCwd = process.cwd();
const environmentNames = [
    'NODE_ENV', 'OPENAI_API_KEY', 'OPENAI_API_BASE_URL', 'PROMPT_REFINER_API_KEY',
    'PROMPT_REFINER_BASE_URL', 'PROMPT_REFINER_MODEL', 'PROMPT_REFINER_ENABLED',
    'NEXT_PUBLIC_PROMPT_REFINER_ENABLED', 'PROMPT_REFINER_EFFORT',
    'PHOTO_ALLOW_REMOTE_CONFIG', 'PHOTO_PUBLIC_ORIGIN', 'PHOTO_CONFIG_FILE'
];
const initialEnvironment = Object.fromEntries(environmentNames.map(name => [name, process.env[name]]));
let temporaryRoot;
let catalog;
let runtime;
let route;

async function transpile(relativePath, targetName, rewrite = source => source) {
    const source = await fs.readFile(path.join(projectRoot, relativePath), 'utf8');
    const output = ts.transpileModule(rewrite(source), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
    }).outputText;
    await fs.writeFile(path.join(temporaryRoot, targetName), output, 'utf8');
}

before(async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'photo-model-config-test-'));
    await transpile('src/lib/model-catalog.ts', 'model-catalog.mjs');
    await transpile('src/lib/text-options.ts', 'text-options.mjs');
    await transpile('src/lib/runtime-config.ts', 'runtime-config.mjs', source => source.replaceAll("'@/lib/text-options'", "'./text-options.mjs'"));
    await transpile('src/app/api/local-config/route.ts', 'local-config-route.mjs',
        source => source
            .replaceAll("'next/server'", "'./next-server-stub.mjs'")
            .replaceAll("'@/lib/runtime-config'", "'./runtime-config.mjs'")
            .replaceAll("'@/lib/text-options'", "'./text-options.mjs'"));
    await fs.writeFile(path.join(temporaryRoot, 'next-server-stub.mjs'),
        'export class NextResponse extends Response { static json(body, options = {}) { return Response.json(body, options); } }');
    for (const name of environmentNames) delete process.env[name];
    process.env.NODE_ENV = 'development';
    process.chdir(temporaryRoot);
    catalog = await import(pathToFileURL(path.join(temporaryRoot, 'model-catalog.mjs')).href);
    runtime = await import(pathToFileURL(path.join(temporaryRoot, 'runtime-config.mjs')).href);
    route = await import(pathToFileURL(path.join(temporaryRoot, 'local-config-route.mjs')).href);
});

after(async () => {
    process.chdir(initialCwd);
    for (const name of environmentNames) {
        if (initialEnvironment[name] === undefined) delete process.env[name];
        else process.env[name] = initialEnvironment[name];
    }
    if (temporaryRoot && path.dirname(path.resolve(temporaryRoot)) === path.resolve(os.tmpdir()) &&
        path.basename(temporaryRoot).startsWith('photo-model-config-test-')) {
        await fs.rm(temporaryRoot, { recursive: true, force: true });
    }
});

function request(method = 'GET', body, overrides = {}) {
    const headers = {
        host: 'localhost:3000',
        ...(method === 'POST' ? { origin: 'http://localhost:3000', 'content-type': 'application/json' } : {}),
        ...overrides
    };
    for (const key of Object.keys(headers)) if (headers[key] === null) delete headers[key];
    return new Request('http://localhost:3000/api/local-config', {
        method, headers, ...(method === 'POST' ? { body: JSON.stringify(body) } : {})
    });
}

test('catalog separates actual image and text models, removes duplicates, and excludes unrelated capabilities', () => {
    const data = [
        { id: 'gpt-image-2' }, { id: 'gpt-image-2' }, { id: ' gpt-image-2 ' },
        { id: 'gpt-image-2.5-flare' }, { id: 'gpt-image-2.5-sunburst' },
        { id: 'gemini-2.5-flash-image' }, { id: 'flux-pro' },
        { id: 'studio-render', supported_endpoint_types: ['/v1/images/generations'] },
        { id: 'gpt-4.1' }, { id: 'claude-sonnet-4' }, { id: 'deepseek-chat' },
        { id: 'custom-chat', endpoints: ['/v1/chat/completions'] },
        { id: 'custom-answer', output_modalities: ['text'] },
        { id: 'gpt-4.1' }, { id: 'text-embedding-3-large' }, { id: 'qwen-embedding' },
        { id: 'gpt-4o-realtime-preview' }, { id: 'whisper-1' }, { id: 'tts-1' },
        { id: 'sora-2' }, { id: 'unknown-provider-model' },
        null, {}, { id: '' }, { id: 123 }
    ];
    const images = catalog.filterModels(data, 'image');
    const texts = catalog.filterModels(data, 'text');
    assert.deepEqual(images, [
        'flux-pro', 'gemini-2.5-flash-image', 'gpt-image-2', 'gpt-image-2.5-flare',
        'gpt-image-2.5-sunburst', 'studio-render'
    ].sort());
    assert.deepEqual(texts, ['claude-sonnet-4', 'custom-answer', 'custom-chat', 'deepseek-chat', 'gpt-4.1'].sort());
    assert.equal(images.some(id => texts.includes(id)), false);
    assert.deepEqual(catalog.filterModels([], 'image'), []);
    assert.throws(() => catalog.filterModels({ data }, 'image'), /Invalid model list/);
});

test('configuration persistence, redaction, and local route guards', { concurrency: false }, async context => {
    await context.test('environment fallback and runtime updates do not require a restart', async () => {
        const initial = await runtime.getRuntimeConfig();
        assert.equal(initial.openaiBaseUrl, 'https://api.openai.com/v1');
        assert.equal(initial.promptRefinerEnabled, false);
        process.env.OPENAI_API_KEY = 'test-image-env-secret';
        process.env.PROMPT_REFINER_API_KEY = 'test-text-env-secret';
        process.env.PROMPT_REFINER_MODEL = 'test-env-chat';
        assert.equal((await runtime.getRuntimeConfig()).openaiApiKey, 'test-image-env-secret');
        await runtime.saveRuntimeConfig({ openaiBaseUrl: 'https://image.example.test/v1', promptRefinerEnabled: true });
        const first = await runtime.getRuntimeConfig();
        assert.equal(first.openaiBaseUrl, 'https://image.example.test/v1');
        assert.equal(first.openaiApiKey, 'test-image-env-secret');
        assert.equal(first.promptRefinerEnabled, true);
        await runtime.saveRuntimeConfig({ openaiBaseUrl: 'https://updated.example.test/v1', promptRefinerEnabled: false });
        assert.equal((await runtime.getRuntimeConfig()).openaiBaseUrl, 'https://updated.example.test/v1');
        assert.equal((await runtime.getRuntimeConfig()).promptRefinerEnabled, false);
        assert.deepEqual((await fs.readdir(temporaryRoot)).filter(name => name.endsWith('.tmp')), []);
    });

    await context.test('web save persists settings, while read responses expose only key presence', async () => {
        const response = await route.POST(request('POST', {
            openaiBaseUrl: 'https://image.example.test/v1/',
            openaiApiKey: '  test-image-saved-secret  ',
            promptRefinerBaseUrl: 'https://text.example.test/v1/',
            promptRefinerApiKey: 'test-text-saved-secret',
            promptRefinerModel: 'custom-chat', promptRefinerEffort: 'high',
            promptRefinerEnabled: true
        }));
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        const disk = JSON.parse(await fs.readFile(path.join(temporaryRoot, '.local-runtime-config.json'), 'utf8'));
        assert.equal(disk.openaiApiKey, 'test-image-saved-secret');
        assert.equal(disk.promptRefinerApiKey, 'test-text-saved-secret');
        assert.equal(disk.openaiBaseUrl, 'https://image.example.test/v1');
        assert.equal(disk.promptRefinerEnabled, true);
        const readResponse = await route.GET(request());
        assert.equal(readResponse.status, 200);
        assert.equal(readResponse.headers.get('cache-control'), 'no-store');
        const publicSettings = await readResponse.json();
        assert.equal(publicSettings.imageKeyConfigured, true);
        assert.equal(publicSettings.textKeyConfigured, true);
        assert.equal(publicSettings.promptRefinerModel, 'custom-chat');
        assert.equal(publicSettings.promptRefinerEffort, 'high');
        assert.equal(publicSettings.canEditPreferences, true);
        assert.equal(publicSettings.canEditCredentials, true);
        assert.equal('openaiApiKey' in publicSettings, false);
        assert.equal('promptRefinerApiKey' in publicSettings, false);
        assert.equal(JSON.stringify(publicSettings).includes('secret'), false);
    });

    await context.test('blank password fields preserve both saved API keys', async () => {
        const response = await route.POST(request('POST', {
            openaiApiKey: '', promptRefinerApiKey: '  ',
            promptRefinerModel: 'new-chat-model', promptRefinerEnabled: false
        }));
        assert.equal(response.status, 200);
        const saved = await runtime.getRuntimeConfig();
        assert.equal(saved.openaiApiKey, 'test-image-saved-secret');
        assert.equal(saved.promptRefinerApiKey, 'test-text-saved-secret');
        assert.equal(saved.promptRefinerModel, 'new-chat-model');
        assert.equal(saved.promptRefinerEnabled, false);
    });

    await context.test('untrusted requests cannot read or overwrite settings', async () => {
        const configPath = path.join(temporaryRoot, '.local-runtime-config.json');
        const before = await fs.readFile(configPath, 'utf8');
        const rejectedRequests = [
            ['GET', { host: 'example.test' }],
            ['GET', { host: 'localhost.example.test' }],
            ['GET', { host: 'localhost:3000', 'sec-fetch-site': 'cross-site' }],
            ['POST', { origin: null }],
            ['POST', { origin: 'https://evil.example.test' }],
            ['POST', { origin: 'http://localhost:3001' }],
            ['POST', { 'content-type': 'text/plain' }],
            ['POST', { host: 'example.test', origin: 'http://example.test' }],
            ['POST', { 'sec-fetch-site': 'cross-site' }]
        ];
        for (const [method, overrides] of rejectedRequests) {
            const response = await route[method](request(method, { openaiApiKey: 'test-forbidden-replacement' }, overrides));
            assert.equal(response.status, 403, JSON.stringify({ method, overrides }));
        }
        assert.equal(await fs.readFile(configPath, 'utf8'), before);
        for (const host of ['localhost:3000', '127.0.0.1:3000', '[::1]:3000']) {
            assert.equal((await route.GET(request('GET', undefined, { host }))).status, 200);
        }
        process.env.NODE_ENV = 'production';
        try {
            assert.equal((await route.GET(request())).status, 403);
            assert.equal((await route.POST(request('POST', { openaiApiKey: 'test-forbidden-replacement' }))).status, 403);
        } finally {
            process.env.NODE_ENV = 'development';
        }
        assert.equal(await fs.readFile(configPath, 'utf8'), before);
    });

    await context.test('invalid values are rejected without altering persisted settings', async () => {
        const configPath = path.join(temporaryRoot, '.local-runtime-config.json');
        const before = await fs.readFile(configPath, 'utf8');
        for (const body of [
            null, [], { openaiBaseUrl: 'ftp://example.test/v1' },
            { openaiBaseUrl: 'https://user:secret@example.test/v1' },
            { openaiBaseUrl: 'https://example.test/v1?key=secret' },
            { openaiBaseUrl: 'https://example.test/v1#fragment' },
            { openaiBaseUrl: 'not-a-url' }, { promptRefinerApiKey: 42 },
            { promptRefinerEnabled: 'true' }
        ]) {
            const response = await route.POST(request('POST', body));
            assert.equal(response.status, 400, 'Expected an invalid configuration to fail');
            assert.equal(await fs.readFile(configPath, 'utf8'), before);
        }
    });

    await context.test('production settings require an explicit remote flag and a valid public origin', async () => {
        process.env.NODE_ENV = 'production';
        process.env.PHOTO_PUBLIC_ORIGIN = 'https://strategy.noryx.cn';
        const publicHeaders = { host: 'strategy.noryx.cn', origin: 'https://strategy.noryx.cn' };
        try {
            for (const flag of [undefined, '0', 'true']) {
                if (flag === undefined) delete process.env.PHOTO_ALLOW_REMOTE_CONFIG;
                else process.env.PHOTO_ALLOW_REMOTE_CONFIG = flag;
                assert.equal((await route.GET(request('GET', undefined, publicHeaders))).status, 403);
                assert.equal((await route.POST(request('POST', {}, publicHeaders))).status, 403);
            }
            process.env.PHOTO_ALLOW_REMOTE_CONFIG = '1';
            for (const publicOrigin of [undefined, 'not-a-url', 'ftp://strategy.noryx.cn',
                'https://user:secret@strategy.noryx.cn', 'https://strategy.noryx.cn/photo',
                'https://strategy.noryx.cn?secret=1', 'https://strategy.noryx.cn#fragment']) {
                if (publicOrigin === undefined) delete process.env.PHOTO_PUBLIC_ORIGIN;
                else process.env.PHOTO_PUBLIC_ORIGIN = publicOrigin;
                assert.equal((await route.GET(request('GET', undefined, publicHeaders))).status, 403);
                assert.equal((await route.POST(request('POST', {}, publicHeaders))).status, 403);
                assert.equal((await route.GET(request())).status, 403, 'Invalid remote setup must not fall back to localhost');
            }
        } finally {
            process.env.NODE_ENV = 'development';
            delete process.env.PHOTO_ALLOW_REMOTE_CONFIG;
            delete process.env.PHOTO_PUBLIC_ORIGIN;
        }
    });

    await context.test('same-origin production settings persist all fields without returning saved keys', async () => {
        process.env.NODE_ENV = 'production';
        process.env.PHOTO_ALLOW_REMOTE_CONFIG = '1';
        process.env.PHOTO_PUBLIC_ORIGIN = 'https://strategy.noryx.cn';
        const publicHeaders = { host: 'strategy.noryx.cn', origin: 'https://strategy.noryx.cn', 'sec-fetch-site': 'same-origin' };
        try {
            // The request URL stays localhost, like the internal side of the company reverse proxy.
            const response = await route.POST(request('POST', {
                openaiBaseUrl: 'https://company-image.example.test/v1/',
                openaiApiKey: '  test-company-image-secret  ',
                promptRefinerBaseUrl: 'https://company-text.example.test/v1/',
                promptRefinerApiKey: 'test-company-text-secret',
                promptRefinerModel: 'company-chat', promptRefinerEffort: 'xhigh',
                promptRefinerEnabled: true
            }, publicHeaders));
            assert.equal(response.status, 200);
            assert.equal(response.headers.get('cache-control'), 'no-store');
            const readResponse = await route.GET(request('GET', undefined, { host: 'strategy.noryx.cn' }));
            assert.equal(readResponse.status, 200, 'GET may omit Origin');
            const publicSettings = await readResponse.json();
            assert.equal(publicSettings.openaiBaseUrl, 'https://company-image.example.test/v1');
            assert.equal(publicSettings.promptRefinerBaseUrl, 'https://company-text.example.test/v1');
            assert.equal(publicSettings.promptRefinerModel, 'company-chat');
            assert.equal(publicSettings.promptRefinerEffort, 'xhigh');
            assert.equal(publicSettings.promptRefinerEnabled, true);
            assert.equal(publicSettings.canEditCredentials, true);
            assert.equal(publicSettings.canEditPreferences, true);
            assert.equal(publicSettings.imageKeyConfigured, true);
            assert.equal(publicSettings.textKeyConfigured, true);
            assert.equal('openaiApiKey' in publicSettings, false);
            assert.equal('promptRefinerApiKey' in publicSettings, false);
            assert.equal(JSON.stringify(publicSettings).includes('secret'), false);
            const blankSave = await route.POST(request('POST', {
                openaiApiKey: '', promptRefinerApiKey: '  ',
                promptRefinerModel: 'company-chat-updated', promptRefinerEffort: 'default',
                promptRefinerEnabled: false
            }, publicHeaders));
            assert.equal(blankSave.status, 200);
            const saved = await runtime.getRuntimeConfig();
            assert.equal(saved.openaiApiKey, 'test-company-image-secret');
            assert.equal(saved.promptRefinerApiKey, 'test-company-text-secret');
            assert.equal(saved.promptRefinerModel, 'company-chat-updated');
            assert.equal(saved.promptRefinerEffort, 'default');
            assert.equal(saved.promptRefinerEnabled, false);
            for (const invalid of [{ promptRefinerEffort: 'unsupported' }, { promptRefinerEnabled: 'true' }]) {
                assert.equal((await route.POST(request('POST', invalid, publicHeaders))).status, 400);
                assert.deepEqual(await runtime.getRuntimeConfig(), saved);
            }
        } finally {
            process.env.NODE_ENV = 'development';
            delete process.env.PHOTO_ALLOW_REMOTE_CONFIG;
            delete process.env.PHOTO_PUBLIC_ORIGIN;
        }
    });

    await context.test('remote settings reject wrong hosts, missing POST origins, and cross-origin requests', async () => {
        process.env.NODE_ENV = 'production';
        process.env.PHOTO_ALLOW_REMOTE_CONFIG = '1';
        process.env.PHOTO_PUBLIC_ORIGIN = 'https://strategy.noryx.cn';
        const configPath = path.join(temporaryRoot, '.local-runtime-config.json');
        const before = await fs.readFile(configPath, 'utf8');
        const publicHeaders = { host: 'strategy.noryx.cn', origin: 'https://strategy.noryx.cn' };
        try {
            for (const [method, overrides] of [
                ['GET', { host: 'localhost:3000' }],
                ['GET', { host: 'strategy.noryx.cn.evil.example.test' }],
                ['GET', { host: 'evil.example.test', 'x-forwarded-host': 'strategy.noryx.cn' }],
                ['GET', { origin: 'https://evil.example.test' }],
                ['GET', { origin: 'https://chat.noryx.cn' }],
                ['GET', { origin: '' }],
                ['GET', { 'sec-fetch-site': 'cross-site' }],
                ['GET', { 'sec-fetch-site': 'same-site', origin: null }],
                ['POST', { origin: null }],
                ['POST', { origin: 'null' }],
                ['POST', { origin: 'http://strategy.noryx.cn' }],
                ['POST', { origin: 'https://evil.example.test' }],
                ['POST', { host: '127.0.0.1:8791' }],
                ['POST', { 'sec-fetch-site': 'cross-site' }],
                ['POST', { 'content-type': 'text/plain' }]
            ]) {
                const response = await route[method](request(method,
                    { openaiApiKey: 'test-forbidden-remote-replacement' }, { ...publicHeaders, ...overrides }));
                assert.equal(response.status, 403, JSON.stringify({ method, overrides }));
            }
            assert.equal(await fs.readFile(configPath, 'utf8'), before);
        } finally {
            process.env.NODE_ENV = 'development';
            delete process.env.PHOTO_ALLOW_REMOTE_CONFIG;
            delete process.env.PHOTO_PUBLIC_ORIGIN;
        }
    });

    await context.test('absolute external configuration persists across reloads and reads disk changes immediately', async () => {
        const defaultPath = path.join(temporaryRoot, '.local-runtime-config.json');
        const defaultContents = await fs.readFile(defaultPath, 'utf8');
        const persistentDir = path.join(temporaryRoot, 'persistent');
        const externalPath = path.join(persistentDir, 'runtime-config.json');
        await fs.mkdir(persistentDir);
        process.env.PHOTO_CONFIG_FILE = externalPath;
        try {
            const response = await route.POST(request('POST', {
                openaiApiKey: 'test-external-image-secret',
                promptRefinerModel: 'external-chat', promptRefinerEnabled: true
            }));
            assert.equal(response.status, 200);
            const stored = JSON.parse(await fs.readFile(externalPath, 'utf8'));
            assert.equal(stored.openaiApiKey, 'test-external-image-secret');
            assert.equal(stored.promptRefinerModel, 'external-chat');
            assert.equal(await fs.readFile(defaultPath, 'utf8'), defaultContents);
            process.chdir(persistentDir);
            const reloaded = await import(pathToFileURL(path.join(temporaryRoot, 'runtime-config.mjs')).href + '?external-reload');
            assert.equal((await reloaded.getRuntimeConfig()).openaiApiKey, 'test-external-image-secret');
            await fs.writeFile(externalPath, JSON.stringify({ ...stored, promptRefinerModel: 'edited-on-disk' }));
            assert.equal((await runtime.getRuntimeConfig()).promptRefinerModel, 'edited-on-disk');
            await reloaded.saveRuntimeConfig({ ...stored, promptRefinerModel: 'saved-after-reload' });
            assert.equal(JSON.parse(await fs.readFile(externalPath, 'utf8')).promptRefinerModel, 'saved-after-reload');
            assert.deepEqual((await fs.readdir(persistentDir)).filter(name => name.endsWith('.tmp')), []);
            assert.equal(await fs.readFile(defaultPath, 'utf8'), defaultContents);
            process.env.PHOTO_CONFIG_FILE = 'relative-config.json';
            await assert.rejects(runtime.getRuntimeConfig(), /must be an absolute path/);
            await assert.rejects(runtime.saveRuntimeConfig({}), /must be an absolute path/);
        } finally {
            process.chdir(temporaryRoot);
            delete process.env.PHOTO_CONFIG_FILE;
        }
    });

    await context.test('an unreadable config fails safely without disclosing its content', async () => {
        const configPath = path.join(temporaryRoot, '.local-runtime-config.json');
        const original = await fs.readFile(configPath, 'utf8');
        try {
            await fs.writeFile(configPath, '{ malformed: test-secret-should-stay-private');
            await assert.rejects(runtime.getRuntimeConfig(), /Unable to read local configuration/);
            const response = await route.GET(request());
            assert.equal(response.status, 500);
            assert.equal(JSON.stringify(await response.json()).includes('test-secret'), false);
        } finally {
            await fs.writeFile(configPath, original);
        }
    });
});
