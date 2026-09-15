# Local AI Art Workflow

[English](./README.md) | 简体中文

一个可以自己部署的图片工作台和文本聊天网站。接入自己的 OpenAI 兼容 API 后，可以先用文本模型整理提示词，查看实际发送的内容，再生成或编辑图片；也可以打开独立聊天页面，直接与文本模型对话。

本项目基于 [alasano/gpt-image-playground](https://github.com/alasano/gpt-image-playground) 开发，保留原项目的 [MIT 许可证](./LICENSE)。

## 功能

- 文生图、上传图片进行编辑，以及绘制或上传局部编辑蒙版。
- 可见的工作链：提示词整理 → 最终提示词预览 → 对接图片模型 → 图片生成完成。任务结束后仍可查看最终提示词。
- 独立的文本聊天窗口，支持更换文本模型与推理强度（effort）。
- 从已配置 API 的 `/models` 接口获取模型列表，将文本模型和图片模型分开显示，并支持手动刷新。
- 图片 API、文本 API 分别配置；本地网页保存后持久化，后续请求立即使用新配置。
- 中文 / English 界面切换，覆盖工作台、聊天和设置页面。
- 图片历史、下载，以及将已有图片送回编辑器继续修改。

## 本地启动教程

### 第一步：安装环境和依赖

安装 [Node.js](https://nodejs.org/) 20.9 或更高版本，以及 Git。打开终端执行：

```bash
git clone https://github.com/Riotline-hxy/local-ai-art-workflow.git
cd local-ai-art-workflow
npm ci
```

启动网站本身不需要提前填写 API Key。

### 第二步：启动网站和端口

Windows 用户安装完依赖后，可以直接双击项目中的 `start-photo.cmd`，也可以在 PowerShell 执行：

```powershell
.\start-photo.cmd
```

启动脚本会使用本地 3000 端口。脚本不负责安装 Node.js 或依赖，因此首次使用仍需完成第一步。

Windows、macOS 和 Linux 也都可以使用命令启动：

```bash
npm run dev -- --hostname 127.0.0.1 --port 3000
```

看到就绪提示后，打开 [http://localhost:3000](http://localhost:3000)。使用期间保持终端运行，停止时按 `Ctrl+C`。

如果 3000 端口已被占用，可以指定其他端口：

```bash
npm run dev -- --hostname 127.0.0.1 --port 3001
```

随后打开 [http://localhost:3001](http://localhost:3001)。

### 第三步：配置图片 API

1. 点击图片工作台右上角的**设置**，打开**图片模型**标签页。
2. 填写 **API Base URL**：这是服务商提供的 API 根地址，例如 `https://api.openai.com/v1` 或 `https://provider.example/v1`。不要在后面加 `/models`、`/images/generations` 或 `/chat/completions`。
3. 填写对应服务商签发的 **API Key**。Base URL 和 Key 必须对应同一套服务商配置，不能将不同服务商的地址和密钥随意混用。
4. 点击**保存配置并刷新**。网站会先保存配置，再读取这个 API 返回的模型列表。
5. 关闭设置，在生成或编辑表单中选择图片模型。下拉框只显示 API 返回且被识别为图片模型的条目。

保存配置不会自动生成图片。提交生成或编辑表单时，才会发起图片任务。

### 第四步：配置文本 API 和提示词整理器

1. 打开**设置 → 文本模型**。
2. 填写文本 API 的 Base URL 和 API Key。如果同一个服务商同时提供图片和文本模型，可以填相同的地址和密钥；两个标签页仍需分别配置。
3. **先点击一次“保存配置并刷新”**，让网站用新配置读取文本模型列表。
4. 从刷新的下拉框中选择**文本模型**，设置**推理强度**，按需打开**提示词整理**开关。
5. **再次点击“保存配置并刷新”**，保存选中的模型、强度和开关状态。

开启整理器后，文本模型会先处理你的描述，再将整理好的提示词交给图片模型。工作台表单上方的工作链面板会直接显示**最终提示词 · 实际发送内容**，支持复制，图片生成结束后仍会保留。关闭整理器时，则直接发送你的原始提示词。预览属于自动执行流程，中途不会再要求点击一次确认。

纯文本聊天不依赖整理器开关。只要文本 API 已配置，即使关闭图片提示词整理，也可以正常聊天。

### 第五步：使用文本聊天和 effort

点击图片工作台中的**文本聊天**，或直接打开 [http://localhost:3000/chat](http://localhost:3000/chat)。

- 在聊天工具栏选择文本模型和推理强度，再发送消息。
- **默认（Default）**表示不发送 `reasoning_effort` 参数，由服务商采用默认行为。其他选项为 `none`、`minimal`、`low`、`medium`、`high`、`xhigh`。
- 并非所有模型都支持所有强度。是否支持由模型和服务商决定，下拉框中的选项不是能力保证。如果参数被拒绝，改用**默认**或服务商明确支持的值后重新发送。网站会显示错误，不会悄悄更换参数再自动重试。
- 切换模型或 effort 会作用于之后的聊天请求，不会覆盖图片提示词整理器保存的模型和强度。
- 聊天模型和 effort 选择会保存在浏览器中；**当前聊天消息只保存在页面内存，刷新后会清空**，还没有持久化聊天记录功能。
- `Enter` 发送，`Shift+Enter` 换行；清空按钮可以清除当前对话。

## API 保存在哪里？重启后是否要重新填写？

不用每次重新填写。网页保存后，配置会写入项目根目录下的 `.local-runtime-config.json`。文件保存在**运行网站的机器**上；如果访问的是服务器部署的网站，这里的“本地文件”指服务器磁盘，而不是访问者手机。

| 项目 | 实际行为 |
| --- | --- |
| API Key、Base URL、整理器设置 | 保存到配置文件，重启后仍然保留。 |
| 修改并保存后 | 后续 API 请求重新读取文件，无需重新构建或重启。 |
| 保存时密钥输入框留空 | 保留已经配置的密钥，不会删除原密钥。 |
| 再次打开设置 | 显示地址、偏好和“是否已配置密钥”，不会返回已保存的密钥值。 |
| 保存后输入框变空 | 只是清空网页输入框，不代表文件里的密钥丢失。 |
| 配置优先级 | `.local-runtime-config.json` 中的值覆盖对应环境变量。 |
| Git 提交 | `.env*`、运行时配置和生成图片已忽略，不应使用强制添加将它们提交。 |

配置文件中的密钥是**服务端明文保存**，并非加密存储。请限制其他人读取这个文件，私密备份也不要放进公开仓库。你输入并点击保存时，浏览器需要将密钥提交给本地服务端；之后读取设置时，服务端不会将已保存密钥返回浏览器。

GitHub 版本的网页配置接口仅在**开发模式**、通过 `localhost`、`127.0.0.1` 或 `::1` 访问时可用，并拒绝跨站保存请求。生产模式（包括 `npm run start`）关闭网页配置接口，由部署者在服务器上配置凭据。

## 使用环境变量配置

生产部署或偏好手动管理配置时，在项目根目录新建 `.env.local`，将以下占位内容替换成自己的配置：

```dotenv
# 图片 API
OPENAI_API_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=replace-with-your-image-api-key

# 文本 API：供聊天和可选的提示词整理器使用
PROMPT_REFINER_BASE_URL=https://api.openai.com/v1
PROMPT_REFINER_API_KEY=replace-with-your-text-api-key
PROMPT_REFINER_MODEL=replace-with-an-available-text-model-id
PROMPT_REFINER_EFFORT=default
PROMPT_REFINER_ENABLED=1

# 图片保存方式：fs 或 indexeddb
NEXT_PUBLIC_IMAGE_STORAGE_MODE=fs
```

将 `PROMPT_REFINER_ENABLED` 设为 `0` 可以关闭图片提示词整理，文本聊天仍使用上述文本 API。如果旧配置中有 `NEXT_PUBLIC_PROMPT_REFINER_ENABLED=true`，关闭整理器时也要移除这个旧开关，因为代码仍兼容它。

| 变量 | 用途与默认行为 |
| --- | --- |
| `OPENAI_API_KEY` | 图片 API 密钥，读取图片模型列表和生图时需要。 |
| `OPENAI_API_BASE_URL` | 图片 API 根地址，默认 `https://api.openai.com/v1`。 |
| `PROMPT_REFINER_API_KEY` | 文本 API 密钥，用于读取文本模型、聊天和开启后的提示词整理。 |
| `PROMPT_REFINER_BASE_URL` | 文本 API 根地址，默认 `https://api.openai.com/v1`。 |
| `PROMPT_REFINER_MODEL` | 默认文本模型 ID，必须填写文本 API 支持的模型。 |
| `PROMPT_REFINER_EFFORT` | 默认推理强度，默认值为 `default`。 |
| `PROMPT_REFINER_ENABLED` | `1` 表示开启提示词整理；否则关闭，除非旧开关或运行时文件另行开启。 |
| `NEXT_PUBLIC_IMAGE_STORAGE_MODE` | `fs` 将图片存到服务器；`indexeddb` 存到浏览器。未填写时，Vercel 使用 IndexedDB，其他环境使用文件存储。 |
| `PHOTO_IMAGES_DIR` | 文件存储模式下可指定图片目录，默认是项目根目录的 `generated-images`。 |
| `NEXT_PUBLIC_BASE_PATH` | 可选的网站子路径，例如 `/art`；部署在域名根路径时不填。必须在构建前设置。 |
| `PHOTO_ACCESS_TOKEN` | 可选的私密邀请令牌；设置后启用邀请访问。 |
| `PHOTO_REQUIRE_ACCESS` | 设为 `1` 表示强制要求邀请访问；如果此时未设置令牌，将拒绝访问。 |
| `PHOTO_PUBLIC_ORIGIN` | 网站的协议和域名，例如 `https://art.example.com`，供邀请跳转和请求来源校验使用。通过反向代理启用邀请访问时应设置。 |

如需直接管理 `.local-runtime-config.json`，对应字段名为 `openaiApiKey`、`openaiBaseUrl`、`promptRefinerApiKey`、`promptRefinerBaseUrl`、`promptRefinerModel`、`promptRefinerEffort`，以及布尔值 `promptRefinerEnabled`。

修改运行时 JSON，下一次请求即可生效；修改 `.env.local` 或进程环境变量后应重启服务；修改 `NEXT_PUBLIC_BASE_PATH` 等影响浏览器构建的配置后，需要重新构建并重启。如果环境变量修改后没有变化，先检查运行时 JSON 是否覆盖了它。

## 生产部署教程

以下适用于安装了 Node.js、具有持久磁盘的服务器：

1. 克隆仓库，执行 `npm ci` 安装依赖。
2. 按上文创建服务器自己的 `.env.local`，或由进程管理工具注入相同环境变量。
3. 构建并启动：

   ```bash
   npm run build
   npm run start -- --hostname 127.0.0.1 --port 3000
   ```

4. 用 HTTPS 反向代理连接 `127.0.0.1:3000`，并通过进程管理工具保持 Node 服务运行。图片生成和长文本回复可能耗时较长，需要按实际服务商响应时间设置代理超时。
5. 更新代码时保留 `.env.local`、使用中的 `.local-runtime-config.json` 和图片目录；上传 GitHub 时只发布源代码。

网站会使用部署者配置的 API 为访问者发起请求。没有邀请访问或其他外层访问控制时，能够打开网站的人都能消耗这套 API。使用内置邀请功能时，设置足够长且随机的 `PHOTO_ACCESS_TOKEN` 以及 `PHOTO_PUBLIC_ORIGIN`，私下分享 `https://art.example.com/?invite=YOUR_TOKEN` 或 `https://art.example.com/chat?invite=YOUR_TOKEN`。若配置了子路径，将子路径加在 `/chat` 之前。完整邀请链接会给当前浏览器设置访问 Cookie；换浏览器时，需要重新打开带 `invite=...` 的完整链接。

在 Vercel 等无持久磁盘的环境中，设置 `NEXT_PUBLIC_IMAGE_STORAGE_MODE=indexeddb`，并通过平台管理密钥。本地文件配置依赖可写且持久的文件系统，长时间生成还受平台执行时间限制；部署前需要确认这些条件是否满足。

## 模型兼容性和常见问题

网站会携带配置的 API Key 请求 `<Base URL>/models`，期望返回 `{ "data": [{ "id": "..." }] }`。模型列表会去重，并结合端点、输出类型、模型类型元数据和常见名称规则，分成图片模型和文本模型。不同服务商没有统一的能力标注格式，因此缺少元数据的自定义模型名称可能无法识别。出现在列表中，也仍需支持网站实际使用的接口及参数：

- 图片生成使用 `/images/generations`，图片编辑使用 `/images/edits`。
- 文本聊天和提示词整理使用 `/chat/completions`。

| 问题 | 排查方法 |
| --- | --- |
| 模型列表为空 | 先保存正确的 Base URL 和 Key，再刷新；确认服务商开放 `/models` 且账号有可用模型。网站不会填入旧的固定模型列表。 |
| 服务商有某个模型，但列表没显示 | 检查 `/models` 的返回内容，以及 `src/lib/model-catalog.ts` 的分类规则。读取到模型名称不代表支持服务商的所有私有接口。 |
| 服务商返回 `401` / `403` | 检查密钥、账号权限，以及地址是否属于正确服务商。 |
| 服务商返回 `404` | 检查是否填写了 API 根地址（通常以 `/v1` 结尾），以及服务商是否提供所需接口。 |
| effort 或其他参数被拒绝 | 先将 effort 改为**默认**，并使用该模型明确支持的参数。兼容 API 可能只支持部分参数。 |
| 还没生图就提示整理失败 | 检查独立的文本 API、所选文本模型和 effort；按需关闭整理器，改为发送原始提示词。 |
| `502`、超时、响应过大 | 查看服务商响应和代理限制，必要时降低图片数量或分辨率；模型可选不代表服务商能传输所有尺寸的结果。 |
| 网页设置不能修改 | 本地编辑请使用 `npm run dev` 并通过 `localhost` 打开；生产环境凭据由服务器管理。 |
| 改了环境变量但没有生效 | 检查运行时 JSON 覆盖关系；修改环境变量后重启，修改子路径后重新构建。 |

图片历史元数据保存在浏览器 local storage 中。文件模式下图片本体在服务器，IndexedDB 模式下图片本体也在当前浏览器。清理浏览器数据可能删除历史或本地图片。页面费用是按项目内置价格表估算，自定义模型名称或中转站定价可能不匹配，实际费用以服务商账单为准。

## 开发和检查

```bash
npm run lint
node --test tests/model-config.test.mjs tests/invite-access.test.mjs tests/chat-options.test.mjs
npm run build
```

自动测试使用隔离配置和模拟请求，不需要真实 API Key，也不会生成付费图片。服务商特有的行为仍需在自己的配置下验证。

## 许可证与原项目

采用 [MIT 许可证](./LICENSE)，基于 Aljosa Asanovic 的 GPT Image Playground。分发时请保留原有版权声明和许可证。


## 多厂商生图接口

工作台新增“图片接口协议”，默认按模型名自动选择，也可以手动覆盖；每个模型的选择保存在当前浏览器。使用原有图片 API Key 和 Base URL，服务端发送密钥，浏览器不接收密钥。

| 模型 | 自动协议 | 说明 |
| --- | --- | --- |
| GPT Image | GPT Images | 保留原生成、编辑及实时预览 |
| 豆包 Seedream | Seedream | JSON `/images/generations`；参考图使用 Data URL，暂限每次一张；Seedream 3 不支持参考图 |
| Gemini image / Nano Banana | Gemini generateContent | `/v1beta/models/{model}:generateContent`；支持参考图，每次一张 |
| Grok 及其他图片模型 | OpenAI Images | `/images/generations`；Grok 编辑使用 JSON，其他通用编辑使用 multipart |
| 手动选择 Chat Completions | Chat Completions | 适用于将图片模型映射到 `/chat/completions` 的中转站，每次一张 |

示例：中转站填 `https://your-provider.example/v1`，Gemini 原生适配会将末尾 `/v1` 换成 `/v1beta`。如果中转站只提供聊天兼容接口，请为 Gemini 手动选择 Chat Completions。直连 Google 可填 `https://generativelanguage.googleapis.com/v1beta`，但部分厂商原生模型目录格式不同，当前自动模型目录仍要求 OpenAI 兼容的 `/models` 返回格式；并非所有原生服务均已端到端兼容。

豆包、Grok 优先请求 Base64；也支持返回 URL、Data URL 和 Gemini inlineData。URL 会在服务器下载并检查实际 PNG/JPEG/WebP 文件类型，不再假设所有返回都有 `b64_json`。仅支持公开 HTTPS 图片地址，下载上限 30 MiB；不向图片 CDN 转发 API Key。

非 GPT 协议不发送 GPT 专用的质量、背景、输出格式、审核和实时预览参数。Gemini/聊天协议和 Grok 当前使用服务商默认尺寸；Seedream 默认自动尺寸为 2K（Seedream 3 为 1024×1024），手动尺寸必须满足对应版本限制。蒙版编辑目前只支持 GPT 协议。接口适配并不保证任意模型/中转站具有相同能力；报错时核对服务商文档，不会自动切换接口重试或额外批量生成。

本地验证（2026-09-15，OpenLux）：`gemini-2.5-flash-image`、`doubao-seedream-4-0-250828`、`grok-imagine-image-2.0` 均返回真实生成图片；其他模型以及这三家的图生图暂未实测。每家只测试一个模型，豆包/Grok 在请求 Base64 后进行了第二次生成验证。
