# Tavern · 慢慢來的酒館

只給自己用的輕量版 SillyTavern：用你自己的 OpenRouter 金鑰，跟角色卡慢慢聊天、寫故事。

**線上展示（不需金鑰）**：<https://issuejames-prog.github.io/tavern/>
展示版在瀏覽器裡模擬後端，回覆是預錄文字，不會呼叫任何模型；登入時輸入任何文字即可。

> 目前進度：**階段一 MVP**——登入、設定頁、OpenRouter 串流對話、聊天紀錄存檔、套用角色卡。
> 路線圖與開發規範見 [CLAUDE.md](./CLAUDE.md)。

## 需求

- Node.js 22 或 26（Windows、macOS、Linux 皆可，不需要另外安裝 Python 或編譯工具）
- 一把 [OpenRouter](https://openrouter.ai/keys) API 金鑰

## 快速開始（本機）

```bash
git clone https://github.com/issuejames-prog/tavern.git
cd tavern
npm install
cp .env.example .env
```

編輯 `.env`：

```ini
APP_PASSWORD=你的登入密碼
SESSION_SECRET=一串隨機字元   # 例如 openssl rand -hex 32
OPENROUTER_API_KEY=sk-or-...
```

啟動開發模式（後端 8787 + 前端 5173）：

```bash
npm run dev
```

打開 <http://localhost:5173>，用 `APP_PASSWORD` 登入。第一次啟動會自動建立資料庫（`data/app.sqlite`）、一組 OpenRouter 模型設定與範例角色「阿暖」。

到「設定」頁可以改模型 ID（例如 `deepseek/deepseek-chat-v3-0324`、`anthropic/claude-sonnet-4.5`，完整清單見 [openrouter.ai/models](https://openrouter.ai/models)）、溫度、回覆長度與上下文長度。

## 正式執行（單一程序）

```bash
npm run build   # 建置前端到 web/dist
npm start       # 後端同時提供 API 與網頁，http://127.0.0.1:8787
```

要從手機或其他裝置連線，建議用 Tailscale 或 Cloudflare Tunnel，並在 HTTPS 下設定 `COOKIE_SECURE=1`。

## 常用指令

| 指令 | 用途 |
| --- | --- |
| `npm run dev` | 開發模式（熱重載） |
| `npm run typecheck` | 全專案型別檢查 |
| `npm test` | 單元測試（Prompt 組裝、模型串流、角色卡） |
| `npm run test:smoke` | 端對端測試：用假的模型端點跑完登入→對話→串流（需先 `npm run build`） |
| `npm run build:demo` | 建置 GitHub Pages 展示版到 `web/dist-demo` |
| `npm run db:generate` | 修改 `server/src/db/schema.ts` 後產生 migration |

## 專案結構

```
shared/   前後端共用型別（角色卡 V2、API 型別）
server/   Hono + SQLite（Drizzle）後端；金鑰只存在這裡
  src/providers/   模型轉接層（OpenRouter / OpenAI 相容）
  src/services/    Prompt 組裝器、角色卡處理、對話流程
web/      React + Vite + Tailwind 前端
  src/api/demo-*   GitHub Pages 展示版用的瀏覽器內假後端
data/     執行期資料（不進版本控制）——備份這個資料夾即可
```

## 安全

- API 金鑰只放在伺服器的 `.env`，資料庫只記錄「環境變數名稱」，前端永遠拿不到金鑰。
- `DAILY_REQUEST_LIMIT` 限制每日生成次數，避免程式錯誤燒光額度。
- 聊天內容只會送到你選用的模型供應商，不做任何遙測。
