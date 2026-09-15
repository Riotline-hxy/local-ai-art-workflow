import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type RuntimeConfig = {
    openaiApiKey?: string;
    openaiBaseUrl?: string;
    promptRefinerApiKey?: string;
    promptRefinerBaseUrl?: string;
    promptRefinerModel?: string;
    promptRefinerEnabled?: boolean;
};
const configFile = path.join(process.cwd(), '.local-runtime-config.json');
export async function getRuntimeConfig(): Promise<RuntimeConfig> {
    let local: RuntimeConfig = {};
    try { local = JSON.parse(await fs.readFile(configFile, 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Unable to read local configuration'); }
    return {
        openaiApiKey: process.env.OPENAI_API_KEY,
        openaiBaseUrl: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
        promptRefinerApiKey: process.env.PROMPT_REFINER_API_KEY,
        promptRefinerBaseUrl: process.env.PROMPT_REFINER_BASE_URL || 'https://api.openai.com/v1',
        promptRefinerModel: process.env.PROMPT_REFINER_MODEL || '',
        promptRefinerEnabled: process.env.PROMPT_REFINER_ENABLED === '1' || process.env.NEXT_PUBLIC_PROMPT_REFINER_ENABLED === 'true',
        ...local
    };
}
export async function saveRuntimeConfig(config: RuntimeConfig) {
    const temporaryFile = configFile + '.' + randomUUID() + '.tmp';
    try {
        await fs.writeFile(temporaryFile, JSON.stringify(config, null, 2), { mode: 0o600 });
        await fs.rename(temporaryFile, configFile);
    } finally { await fs.unlink(temporaryFile).catch(() => undefined); }
}
