# 短剧视界 · 网页版（Cloudflare Pages）

这是把原项目的**本地 Web 服务版**抽出来、改造为可部署到 **Cloudflare Pages** 的工作空间。
上传本目录到 GitHub，在 Cloudflare 里连接仓库即可完成部署，得到一个可通过 Cloudflare 域名访问的在线站点。

原 `guoapp3-main` 项目**未做任何改动**，本目录是独立副本。

---

## 一、部署步骤（3 步）

### 1. 上传到 GitHub

```bash
cd cfbuild
git init
git add .
git commit -m "init: 短剧视界网页版"
git branch -M main
git remote add origin https://github.com/<你的账号>/<你的仓库>.git
git push -u origin main
```

### 2. 在 Cloudflare 创建 Pages 项目

进入 Cloudflare 控制台 → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**，
选择刚才的仓库，然后按下表填写构建配置：

| 配置项 | 填写内容 |
|---|---|
| Framework preset（框架预设） | `None` |
| Build command（构建命令） | **留空** |
| Build output directory（构建输出目录） | `public` |
| Root directory（根目录） | 留空（默认 `/`） |

> 本项目是「纯静态前端 + Pages Functions」，**没有构建步骤**，所以构建命令留空即可。
> Functions 会自动从仓库根目录的 `functions/` 读取。

### 3. 保存并部署

点 **Save and Deploy**，等约 1 分钟即可。之后访问 Cloudflare 分配的
`https://<项目名>.pages.dev` 就能打开站点。之后每次 `git push` 都会自动重新部署。

---

## 二、目录结构

```
cfbuild/
├── public/                 # 静态站点（构建输出目录）
│   ├── index.html          # 页面骨架
│   ├── app.js              # 前端逻辑（含播放器、收藏夹）
│   ├── app.css             # 样式
│   ├── hls.min.js          # HLS 播放支持
│   └── _routes.json        # 声明哪些路径走 Functions（/api/*）
├── functions/              # Pages Functions 后端
│   ├── _middleware.js      # 统一异常与安全响应头
│   ├── _lib/               # 共享代码（下划线开头不会注册成路由）
│   │   ├── util.js         # 抓取 / 文本清洗等工具
│   │   ├── sources.js      # 站源注册表
│   │   └── ikanbot.js      # 爱看机器人站源实现
│   └── api/                # HTTP 端点
│       ├── request.js      # POST /api/request（目录 / 分类 / 详情）
│       ├── play.js         # POST /api/play（播放解析）
│       ├── media.js        # GET  /api/media（媒体同源代理）
│       ├── cover.js        # GET  /api/cover（封面同源代理）
│       ├── sources.js      # GET  /api/sources（站源列表）
│       ├── info.js         # GET  /api/info（站点信息）
│       └── library.js      # GET/POST /api/library（兼容占位）
└── wrangler.toml           # 本地预览 / 命令行部署用（可选）
```

---

## 三、重要限制（请务必先读）

原版后端是 **28565 行 Go 代码**，而 Cloudflare Pages 的 Functions 运行在
**Workers 运行时（V8，只能跑 JavaScript/TypeScript）**，两者能力边界差异很大：

| 原版依赖的能力 | Cloudflare Workers 是否支持 |
|---|---|
| Go 语言与 Go 模块 | ❌ 不支持，只能 JS/TS |
| 文件系统（数据目录、封面缓存） | ❌ 没有 |
| ffmpeg 转码 | ❌ 没有 |
| TLS 指纹伪装（tls-client / utls） | ❌ 没有 |
| `fetch` 抓取网页、解析 HTML/JSON | ✅ 支持 |
| 返回 `Response`、做同源代理 | ✅ 支持 |

因此**不可能把 Go 后端 1:1 搬上来**。本工作空间的做法是：
把能纯用 `fetch + 正则` 复刻的站源，用 JavaScript 重写为 Pages Functions。

### 当前支持哪些站源

**只有「爱看机器人」（ikanbot）一个，且功能完整可用。**

原因是它恰好满足全部条件：

- 纯 HTTPS 抓取，**不需要 TLS 指纹伪装**
- 解析方式为正则 + 一段可复刻的签名算法（`get_tks`）
- 返回的是**直链 m3u8**，浏览器可直接播，**不需要 ffmpeg**
- 无加密 / 无 HEVC

### 哪些站源跑不了

红果、黄果系列、野果、黄豆、韩小圈等**均不可用**，原因分两类：

1. **加密流 / HEVC**：必须服务端 ffmpeg 解密重编码，Workers 没有 ffmpeg；
2. **风控 / TLS 指纹**：需要伪装 Chrome TLS 指纹才能访问，Workers 的 `fetch` 做不到。

这些源在网页版里会返回「当前网页版不包含此站源」。

---

## 四、与原版的差异

| 项目 | 原本地服务版 | 本网页版 |
|---|---|---|
| 后端语言 | Go（本机进程） | JavaScript（Pages Functions） |
| 站源数量 | 24 个 | 1 个（爱看机器人） |
| 播放记录 / 收藏夹 | 存本机数据目录 `library.json` | 存**浏览器 localStorage**（每台设备独立） |
| 封面缓存 | 本机磁盘 + HEIC 转码 | 内存直传代理（不落盘） |
| 转码 | ffmpeg 转 HLS | 无（全部直链） |
| 访问范围 | 本机 / 局域网 | 公网（Cloudflare 域名） |

前端绝大部分逻辑（播放器、多线路切换、分集、倍速与全屏保持、自动连播）
与原版一致，可参考原项目 `native/server/web/app.js`。

---

## 五、本地预览（可选）

若装了 Node.js 与 wrangler：

```bash
npm install -g wrangler
wrangler pages dev public
```

会启动一个本地服务器，`.pages.dev` 的同一套 Functions 会在本地跑起来。

---

## 六、如何扩展站源

若要增加新的站源，只需两步：

1. 在 `functions/_lib/` 下新增一个模块，导出 `SOURCE_ID`、`SOURCE_NAME`、`CATEGORIES`，
   以及 `fetchCatalogPage`、`fetchDetail`、`resolveMedia` 三个函数（可参照 `ikanbot.js`）；
2. 在 `functions/_lib/sources.js` 的 `REGISTRY` 数组里注册这个模块。

注意：能否迁移取决于该源是否依赖 ffmpeg 或 TLS 指纹（见上文限制）。

---

## 七、免责声明

本站源内容来自第三方公开站点，本项目仅做技术演示与个人学习用途，
不存储任何视频内容，请勿用于商业用途。