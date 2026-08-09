# 代码与思考 — JSON 驱动博客

沿用 `codex-resets.com` 的视觉样式和页面布局，改造成一个完全中文的无框架博客，包含两种实现：

- `static-json/`：纯 HTML + CSS + JavaScript + JSON，适合任意静态托管。
- `worker-d1/`：Cloudflare Worker + D1，带 `/admin/` 配置后台。

两套代码互相独立，不需要构建前端资源。博客内容由 JSON 配置，包含精选文章、26 周更新足迹、统计卡片和文章归档；点击“展开”会在弹窗中阅读完整正文。

完整中文博客配置位于 [`examples/content.zh-CN.json`](./examples/content.zh-CN.json)，两套代码默认使用同一份内容。

## 1. 静态 JSON 版本

```bash
cd static-json
python3 -m http.server 8080
```

打开 <http://localhost:8080>。修改 `content.json` 后刷新页面即可看到结果。浏览器的 `file://` 模式通常不允许读取 JSON，因此请通过 HTTP 服务预览。

GitHub Pages：<https://caochuankuan.github.io/configurable-reset-tracker/>（由 `static-json/` 自动发布）。

## 2. Cloudflare Worker + D1 版本

详细步骤见 [`worker-d1/README.md`](./worker-d1/README.md)。

```bash
cd worker-d1
npm install
npm run db:local
npm run dev
```

打开 <http://localhost:8787> 查看前台，打开 <http://localhost:8787/admin/> 进入后台。

线上示例：<https://reset-tracker-worker-d1.2835082172.workers.dev/>
