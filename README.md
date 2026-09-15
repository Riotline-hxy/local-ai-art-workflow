# Local AI Art Workflow

English | [简体中文](./README.zh-CN.md)

A self-hosted image studio and text chat workspace for OpenAI-compatible APIs. Connect your own providers, refine image prompts with a text model, inspect the final prompt, and generate or edit images. Use the separate chat page for ordinary conversations.

Based on [alasano/gpt-image-playground](https://github.com/alasano/gpt-image-playground), retaining its [MIT license](./LICENSE).

## Features

- Generate images, edit uploads, and draw or upload edit masks.
- Follow the workflow: prompt refinement → final prompt preview → image request → completed image. The final prompt remains visible afterward.
- Use independent text chat with model and reasoning-effort selectors.
- Fetch separate image and text model lists from your providers' `/models` endpoints, with manual refresh.
- Configure image and text APIs independently through local settings. Changes survive restarts and apply to subsequent requests.
- Switch between Chinese and English, including settings and chat.
- Browse image history, download images, and send an existing image back to the editor.

## Local setup

### 1. Install

Install [Node.js](https://nodejs.org/) 20.9 or later and Git, then run:

```bash
git clone https://github.com/Riotline-hxy/local-ai-art-workflow.git
cd local-ai-art-workflow
npm ci
```

No API key is required just to start the site.

### 2. Start the website

On Windows, double-click `start-photo.cmd`, or run it from PowerShell:

```powershell
.\start-photo.cmd
```

The launcher starts the development server on port 3000. It does not install Node.js or dependencies; complete the installation step first.

On Windows, macOS, or Linux, you can also run:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Wait for the ready message, then open [http://localhost:3000](http://localhost:3000). Keep the terminal open while using the site; press `Ctrl+C` to stop it.

If port 3000 is occupied, choose another port:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Then open [http://localhost:3001](http://localhost:3001).

### 3. Configure the image API

1. Open **Settings** in the upper-right corner of the image studio and select **Image models**.
2. Enter the **API Base URL**: the API root, such as `https://api.openai.com/v1` or `https://provider.example/v1`. Do not append `/models`, `/images/generations`, or `/chat/completions`.
3. Enter the API key issued by that provider. The Base URL and key must belong to the same provider configuration.
4. Click **Save and refresh**. The server saves the configuration and requests the provider's model list.
5. Close settings and select an image model in the generate or edit form. Only models classified as image models from the API response appear.

Saving settings does not generate an image. Image requests begin when you submit the generate or edit form.

### 4. Configure text and prompt refinement

1. Open **Settings → Text models**.
2. Enter the text API Base URL and key. These can match the image provider's values if it serves both model types, but the two API sections are configured separately.
3. Click **Save and refresh** first to retrieve the models available under the new credentials.
4. Select a **Text model** from the refreshed list, choose its **Reasoning effort**, and enable **Prompt refinement** if desired.
5. Click **Save and refresh** again to store these preferences.

With refinement enabled, the text model prepares your prompt before the image request. The workflow panel above the image forms shows **Final prompt · sent to the image model**, including the exact text and a copy button. With refinement disabled, the image model receives your original prompt. The preview remains visible after completion. It is part of the automatic workflow and does not pause for a second approval.

Text chat works independently of the refinement switch. You can leave refinement off and still chat as long as the text API is configured.

### 5. Chat and reasoning effort

Open **Text chat** from the image studio, or visit [http://localhost:3000/chat](http://localhost:3000/chat).

- Choose the text model and reasoning effort in the chat toolbar before sending a message.
- **Default** omits `reasoning_effort` and lets the provider use its default behavior. Other options are `none`, `minimal`, `low`, `medium`, `high`, and `xhigh`.
- Effort support depends on the model and provider. A selector option is not a guarantee of support. If the provider rejects a value, choose **Default** or a supported value and send again. The app shows the error without silently retrying with different parameters.
- Changing the chat model or effort affects subsequent chat requests. It does not overwrite the model or effort saved for image-prompt refinement.
- Chat model and effort preferences are saved in your browser. **Conversation messages currently live in page memory and reset on reload**; they are not a saved chat history.
- Press `Enter` to send and `Shift+Enter` for a new line. The clear button clears the current conversation.

## Saved settings and credentials

Web settings are stored in `.local-runtime-config.json` in the project root, on the machine running the app. On a hosted instance, this means the server's filesystem, not the visitor's phone.

| Setting | Behavior |
| --- | --- |
| Saved credentials and preferences | Persist across restarts; subsequent API requests read the file again. |
| Empty API-key field on save | Keeps the previously configured key; it does not delete it. |
| Reading settings | Returns URLs, preferences, and whether each key is configured, never saved API-key values. |
| Key inputs cleared after saving | Only the browser inputs are cleared; the saved keys remain. |
| Configuration priority | Runtime JSON values override corresponding environment variables. |
| Git | `.env*`, `.local-runtime-config.json`, and generated images are ignored. Do not force-add private files. |

Keys are stored as plaintext in the server-side file, not encrypted. Restrict file access and keep private backups outside the repository. The browser transmits a key when you enter and save it; the server does not send stored keys back to the browser.

The repository's web configuration endpoint is available only in **development mode** through `localhost`, `127.0.0.1`, or `::1`. It rejects cross-site saves. It is disabled in production, including `npm run start`; production operators configure credentials on the server.

## Environment configuration

For production, or manual configuration, create `.env.local` in the project root and replace the placeholders:

```dotenv
# Image provider
OPENAI_API_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=replace-with-your-image-api-key

# Text provider: chat and optional prompt refinement
PROMPT_REFINER_BASE_URL=https://api.openai.com/v1
PROMPT_REFINER_API_KEY=replace-with-your-text-api-key
PROMPT_REFINER_MODEL=replace-with-an-available-text-model-id
PROMPT_REFINER_EFFORT=default
PROMPT_REFINER_ENABLED=1

# Image storage: fs or indexeddb
NEXT_PUBLIC_IMAGE_STORAGE_MODE=fs
```

Set `PROMPT_REFINER_ENABLED=0` to disable image-prompt refinement. Chat still uses the text provider. Remove the legacy `NEXT_PUBLIC_PROMPT_REFINER_ENABLED=true` setting if present when disabling refinement; the code still accepts that switch.

| Variable | Purpose / default |
| --- | --- |
| `OPENAI_API_KEY` | Image API credential; required for image-model discovery and image requests. |
| `OPENAI_API_BASE_URL` | Image API root; defaults to `https://api.openai.com/v1`. |
| `PROMPT_REFINER_API_KEY` | Text API credential; required for text-model discovery, chat, and enabled refinement. |
| `PROMPT_REFINER_BASE_URL` | Text API root; defaults to `https://api.openai.com/v1`. |
| `PROMPT_REFINER_MODEL` | Default text-model ID; choose a model supported by the text provider. |
| `PROMPT_REFINER_EFFORT` | Default reasoning effort; defaults to `default`. |
| `PROMPT_REFINER_ENABLED` | `1` enables refinement; otherwise disabled unless the legacy switch or runtime file enables it. |
| `NEXT_PUBLIC_IMAGE_STORAGE_MODE` | `fs`: server files. `indexeddb`: browser storage. If unset, Vercel uses IndexedDB and other environments use filesystem storage. |
| `PHOTO_IMAGES_DIR` | Optional image directory in filesystem mode; defaults to the project's `generated-images` directory. |
| `NEXT_PUBLIC_BASE_PATH` | Optional URL prefix such as `/art`; leave unset for the root. Set before building. |
| `PHOTO_ACCESS_TOKEN` | Optional private invitation secret; enables invitation access when set. |
| `PHOTO_REQUIRE_ACCESS` | `1` requires invitation access even if the token is missing; a missing token then denies access. |
| `PHOTO_PUBLIC_ORIGIN` | Public scheme and host, such as `https://art.example.com`, for invitation redirects and request-origin checks. Set when using invitations behind a proxy. |

The matching runtime JSON property names are `openaiApiKey`, `openaiBaseUrl`, `promptRefinerApiKey`, `promptRefinerBaseUrl`, `promptRefinerModel`, `promptRefinerEffort`, and the boolean `promptRefinerEnabled`.

Runtime JSON changes apply to the next request without a rebuild or restart. Restart after changing `.env.local` or process environment variables. Rebuild and restart after changing `NEXT_PUBLIC_BASE_PATH` or other browser build configuration. If an environment change seems ineffective, check whether runtime JSON overrides it.

## Production deployment

For a server with Node.js and a persistent disk:

1. Clone the repository and run `npm ci`.
2. Create the server's `.env.local` as above, or set these variables through your service manager.
3. Build and start:

   ```bash
   npm run build
   npm run start -- --hostname 127.0.0.1 --port 3000
   ```

4. Point an HTTPS reverse proxy at `127.0.0.1:3000`, and supervise the Node process with your service manager. Allow enough request time for image generation and long text replies.
5. Preserve `.env.local`, `.local-runtime-config.json` if used, and the image directory across deployments. Publish source code to GitHub, excluding private configuration and generated data.

The app uses the operator's API credentials for visitors. Without invitation access or outer access control, anyone who can reach the app can submit requests against those credentials. For built-in invitation access, set a strong `PHOTO_ACCESS_TOKEN` and `PHOTO_PUBLIC_ORIGIN`, then privately share `https://art.example.com/?invite=YOUR_TOKEN` or `https://art.example.com/chat?invite=YOUR_TOKEN`. Include any configured base path before `/chat`. Invitations set a cookie in the receiving browser; switching browsers requires reopening the full invitation link.

For serverless hosting, use `NEXT_PUBLIC_IMAGE_STORAGE_MODE=indexeddb` and configure secrets through the host. Local file configuration requires a writable persistent filesystem, and image requests must fit the host's execution limits. Check those capabilities before deploying.

## Model compatibility and troubleshooting

The app queries `<Base URL>/models` with the configured key and expects `{ "data": [{ "id": "..." }] }`. It removes duplicates and separates image and text models using endpoint/output/type metadata where present and known model-name patterns otherwise. There is no universal capability schema; custom names without useful metadata may be filtered out. A listed model still needs to support the endpoint and parameters used by the app:

- Images: `/images/generations` and, for editing, `/images/edits`.
- Text: `/chat/completions` for both chat and refinement.

| Symptom | What to check |
| --- | --- |
| Empty model list | Save the correct Base URL/key, refresh, and verify provider support for `/models` and account access. The app does not substitute a static list. |
| A known model is missing | Inspect the provider's model response and `src/lib/model-catalog.ts`. Discovery does not imply support for every provider-specific API. |
| Provider `401` / `403` | Verify the key, account permissions, and provider URL. |
| Provider `404` | Use the API root, usually ending in `/v1`, and confirm the required endpoint exists. |
| Rejected effort/parameters | Try effort **Default** and parameters supported by that exact model. Providers may support only a subset. |
| Refinement fails before image generation | Check the separate text API, model, and effort. Disable refinement to submit the original prompt when appropriate. |
| `502`, timeout, or response too large | Check provider responses and proxy limits. Reduce image count/resolution if necessary; catalog presence does not guarantee every output size can pass through the provider. |
| Web settings unavailable | Use `npm run dev` on `localhost` for local editing. Production credentials are configured on the server. |
| Environment changes have no effect | Check runtime JSON overrides, restart after environment changes, and rebuild after base-path changes. |

Image-history metadata lives in browser local storage. Image files live on the server in filesystem mode, or in the current browser in IndexedDB mode. Clearing browser data can remove history or locally stored images. Cost estimates use the app's pricing mappings and may differ from the provider's bill, especially for custom models.

## Development checks

```bash
npm run lint
node --test tests/model-config.test.mjs tests/invite-access.test.mjs tests/chat-options.test.mjs
npm run build
```

Automated tests use isolated configuration and mocks; they do not need real API keys or generate paid images. Provider-specific behavior still needs verification against your configured provider.

## License and attribution

[MIT](./LICENSE). Based on the original GPT Image Playground by Aljosa Asanovic. Preserve the original copyright and license notice when redistributing.


## Multiple image providers

Choose **Image API protocol** in the workbench. Auto mode selects GPT Images for GPT image models, Seedream JSON generation for Seedream, Gemini `generateContent` for Gemini image/Nano Banana, and generic OpenAI Images for other models. A manual Chat Completions override supports gateways that expose image models as chat endpoints. Overrides are saved per model in your browser.

Use your existing image API key and Base URL. Gemini replaces a trailing `/v1` or `/v1beta` with `/v1beta/models/{model}:generateContent`. The catalog currently requires an OpenAI-compatible `/models` response; native provider catalogs are not universally supported. Model names alone cannot establish a gateway's protocol; select an override when needed.

Responses support Base64, public HTTPS URLs, Data URLs, Gemini inline image parts and explicit chat image fields/Markdown images. URL downloads validate the destination and PNG/JPEG/WebP bytes, are limited to 30 MiB, and never receive the API key. Seedream and generic Images request Base64 where supported.

Non-GPT adapters omit GPT-only quality, background, format, moderation and streaming parameters. Gemini/Chat and Grok use provider default dimensions. Seedream defaults to 2K (1024 square for Seedream 3); explicit sizes must meet model requirements. Seedream, Gemini and Chat currently accept one image per request. Masks require GPT Images. Generic edits use multipart; Grok uses JSON; Seedream and Gemini encode reference images inline. No automatic endpoint fallback or paid retry is performed.

Live text-to-image checks on OpenLux, September 15, 2026: `gemini-2.5-flash-image`, `doubao-seedream-4-0-250828`, and `grok-imagine-image-2.0` returned real images. One model per provider was tested; Seedream/Grok were retried once explicitly with Base64 output. Other models and reference-image editing remain unverified against live providers.
