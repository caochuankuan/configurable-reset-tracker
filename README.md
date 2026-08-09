# Codex Resets — framework-free replica

对 `codex-resets.com` 当前页面结构、内容模型和视觉样式的复刻，包含两种无框架实现：

- `static-json/`：纯 HTML + CSS + JavaScript + JSON，适合任意静态托管。
- `worker-d1/`：Cloudflare Worker + D1，带 `/admin/` 配置后台。

两套代码互相独立，不需要构建前端资源。当前配置包含 41 条 reset 事件、26 周热力图、Reset Watch、统计卡片和完整时间线。

## 1. 静态 JSON 版本

```bash
cd static-json
python3 -m http.server 8080
```

打开 <http://localhost:8080>。修改 `content.json` 后刷新页面即可看到结果。浏览器的 `file://` 模式通常不允许读取 JSON，因此请通过 HTTP 服务预览。

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
