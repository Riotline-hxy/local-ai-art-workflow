# 裸金属机部署

本目录提供公司裸金属机上的生产部署模板。当前约定是：

- 应用源码：`/opt/photo-workbench`
- 生成图片：`/srv/photo-workbench/generated-images`
- 监听：`127.0.0.1:8791`
- 访问路径：现有公司域名的 `/photo/`，构建时使用 `NEXT_PUBLIC_BASE_PATH=/photo`
- 进程：`photo-workbench.service`
- 密钥：`/etc/photo-workbench.env`，权限 `0600`
- 网页保存的 API 配置：`/srv/photo-workbench/runtime-config.json`，权限 `0600`

本次公司部署显式设置 `PHOTO_ALLOW_REMOTE_CONFIG=1` 和 `PHOTO_PUBLIC_ORIGIN=https://strategy.noryx.cn`，生产模式下可通过网页设置 API、文本模型与提示词整理，保存到 `PHOTO_CONFIG_FILE` 指定的持久文件。保存接口校验网页来源，不要求账号、密码或邀请令牌。未显式启用远程配置的其他部署仍保留原有的开发 localhost 限制。

API 默认通过服务器环境文件提供；网页保存的运行时 JSON 覆盖对应环境变量。源码包不包含本地 `.env.local` 或 `.local-runtime-config.json`；服务器独立环境文件已按当前使用配置创建。此部署不设置 `APP_PASSWORD`、`PHOTO_ACCESS_TOKEN` 或 `PHOTO_REQUIRE_ACCESS`，能访问反向代理的人都可以发起 API 请求与修改共享配置。

首次部署的顺序：

1. 准备 Node.js 20.9+，创建 `photo-workbench` 系统用户和 `/opt/photo-workbench`、`/srv/photo-workbench/generated-images`。
2. 上传源码，执行 `npm ci --include=dev`。
3. 将 `photo-workbench.env.example` 复制为 `/etc/photo-workbench.env`，填入图片和文本 API，设为 `root:photo-workbench`、`0600`。
4. 构建时设置 `NEXT_PUBLIC_BASE_PATH=/photo NEXT_PUBLIC_IMAGE_STORAGE_MODE=fs NEXT_PUBLIC_PROMPT_REFINER_ENABLED=false`，执行 `npm run build`。API 密钥不需要出现在构建命令中。
5. 安装 `photo-workbench.service`，执行 `systemctl daemon-reload && systemctl enable --now photo-workbench`。
6. 把 `Caddyfile.photo-snippet` 插入现有 `{$STRATEGYOS_DOMAIN}` 站点块，先 `caddy validate`，再只重载 Caddy。

验收命令：

```bash
systemctl is-active photo-workbench
curl -fsS http://127.0.0.1:8791/photo/
curl -fsS https://strategy.noryx.cn/photo/
curl -fsS https://strategy.noryx.cn/photo/api/auth-status
curl -fsS https://strategy.noryx.cn/photo/api/local-config
npm audit --omit=dev --registry=https://registry.npmjs.org
```

更新时保留 `/etc/photo-workbench.env` 和整个 `/srv/photo-workbench`，上传新源码并重新 `npm ci --include=dev`、按上面环境构建，再 `systemctl restart photo-workbench`。长时间生图由 Caddy 900 秒读写超时覆盖；API 服务自身还会按适配器设置超时。

2026-10-14 部署时已将 Next.js、eslint-config-next 更新到 16.4.0，sharp 到 0.35.5，source-map-js 到 1.2.2，并修复旧 brace-expansion override。生产依赖审计为 0 项；完整审计仍有 5 项来自开发工具的 braces/micromatch/fast-glob 链，没有执行破坏性降级。服务器与本地构建、lint 和项目测试已通过；详细实测记录见服务器工作区 `photo-workbench/README.md`。
