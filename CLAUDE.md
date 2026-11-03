# CLAUDE.md

> 給 AI 協作者閱讀：這份文件說明專案是什麼、要做到哪裡、怎麼寫才符合約定。
> 開始任何修改前請先讀完，並以「讓專案依路線圖穩定往下走」為最高目標。
> 標記為「（預設）」的項目是目前的暫定決定，使用者明確改變時以使用者為準，並同步更新本文件。

---

## 1. 專案目的

一個**只給自己使用**的輕量版 SillyTavern：自架網站，用使用者已有的個人 LLM API 進行 **AI 角色扮演聊天** 與 **文字故事創作**。

四個核心版塊：

| 版塊 | 職責 |
| --- | --- |
| 介面（Web UI） | 聊天、角色庫、世界書編輯、設定四類頁面，以電腦瀏覽器為主，手機可用 |
| 後端模型（大腦） | 使用者既有的 API（目前為 OpenRouter），透過「模型轉接層」呼叫，可替換供應商 |
| 角色卡（Character Card） | 角色性格、語氣、背景的結構化資料，可用 PNG（內嵌 JSON）或純 JSON 匯入匯出 |
| 世界書（World Info） | 世界觀／地名／事件／規則的條目庫，對話出現關鍵字時才自動載入 Prompt |

### 不是什麼（範圍界線）

- 不是多人服務：沒有註冊、付費、社群、權限分級。
- 不是 SillyTavern 的完整複製：只保留上述四個核心概念，其他功能走路線圖逐步加。
- 不內建模型：大腦永遠是外部 API 或使用者自己的本機模型。

### 設計原則（做取捨時依序參考）

1. **自用優先**：架構越簡單越好，單人維護得動。
2. **模型可抽換**：核心程式只依賴「訊息陣列進、文字串流出、回報用量」這個介面。
3. **相容社群格式**：角色卡 Character Card V2、世界書 `character_book` 格式要能與 SillyTavern 互通。
4. **資料自己掌握**：全部資料在自己的主機，一個 SQLite 檔加一個資料夾就能備份。
5. **先 MVP 再擴充**：每個階段都要有可用成果，不要為了未來功能提早抽象。

---

## 2. 目前進度與路線圖

> 開發時先確認「現在在哪個階段」，**只做當前階段的工作**，除非使用者明確指示跳階段。
> 完成一個階段後，由使用者驗收關卡，再更新下方的「目前階段」。

**目前階段：階段一（MVP）——初版程式碼已完成，待使用者以真實 OpenRouter 金鑰驗收** ← 更新此行以反映真實進度

| 階段 | 內容 | 關卡（驗收條件） |
| --- | --- | --- |
| 一 MVP | 登入與設定頁、串接 API、串流對話、聊天紀錄存檔、套用單一角色卡 | 能與一張角色卡穩定串流聊天 |
| 二 角色與世界書 | 角色卡匯入匯出（PNG／JSON）、角色卡編輯器、世界書條目與關鍵字觸發、Token 預算控制 | 角色卡與世界書能匯入並正確觸發 |
| 三 創作體驗 | 重新生成與分支、編輯任一則訊息、Prompt 預覽除錯、自動摘要前情、故事續寫模式 | 長篇故事不遺忘前情，也不超長度 |
| 四 進階擴充 | 多組模型設定、群組聊天、向量檢索記憶、語音與角色圖片、外掛事件掛鉤 | 依需要逐項驗收 |

### 階段一已實作

- 單一密碼登入（HMAC 簽章 cookie、登入失敗節流）。
- OpenRouter 轉接（`server/src/providers/openrouter.ts`，以 OpenAI 相容格式為基底），SSE 串流、中止、錯誤時保留部分文字。
- 對話流程依第 4 節順序；世界書層在組裝器中已預留（階段一傳入空陣列）。
- 角色庫列表與基本編輯器（欄位編輯，未知欄位保留）；PNG／JSON 匯入屬階段二，尚未實作。
- 設定頁：暱稱、系統指令、模型設定（只存金鑰的環境變數名稱）、今日用量、主題與閱讀模式。
- 每日生成次數上限（`DAILY_REQUEST_LIMIT`）。
- **兩種執行模式**（決策見 `docs/decisions/2026-11-03-browser-mode.md`）：
  - **瀏覽器模式**（GitHub Pages，`npm run build:pages`，Vite mode `browser`）：`web/src/api/browser-api.ts` 在瀏覽器內執行整個對話流程，使用者在設定頁輸入自己的 OpenRouter 金鑰，直接呼叫 OpenRouter；資料存在 localStorage。不需登入。
  - **伺服器模式**（自架，`npm run dev`／`npm start`）：Hono + SQLite 後端，金鑰在 `.env`，單一密碼登入。

---

## 3. 系統架構

```
瀏覽器（React）
   │  HTTPS + SSE 串流
   ▼
後端服務（Node.js + TypeScript）
   ├─ 聊天路由：收訊息、推串流
   ├─ Prompt 組裝器：排序與裁切（核心）
   ├─ 世界書引擎：關鍵字掃描
   ├─ 角色卡處理：PNG 與 JSON 匯入匯出
   └─ 模型轉接層：統一供應商格式
   │
   ├──► 資料層：SQLite + 檔案資料夾（同一台機器）
   └──► 外部：使用者的個人 LLM API（OpenRouter）
```

**鐵則**：API 金鑰永遠不進程式碼、不進資料庫明文、不進版本控制（**包括 `.env` 不得上傳到 GitHub**）。伺服器模式的金鑰只存在後端；瀏覽器模式是唯一例外——金鑰只存在使用者自己瀏覽器的 localStorage，只送往模型供應商，並以 CSP 限制連線目標。

### 技術選型（預設）

| 層級 | 技術 |
| --- | --- |
| 前端 | React + Vite + TypeScript、Tailwind CSS v4、Zustand（介面狀態）、TanStack Query（伺服器資料）、React Router |
| 後端 | Node.js 22 / 26 + TypeScript，Hono（`@hono/node-server`），以 `tsx` 執行 |
| 串流 | SSE（Server-Sent Events）；前端以 fetch 讀取（因為需要 POST） |
| 資料庫 | 伺服器模式：SQLite（better-sqlite3）+ Drizzle ORM；瀏覽器模式：localStorage |
| 檔案 | 本機資料夾（PNG 原檔、頭像） |
| PNG 處理 | `png-chunks-extract`、`png-chunk-text` 這類套件，讀寫 tEXt chunk（階段二） |
| Token 估算 | `gpt-tokenizer`（僅估算預算），實際用量以供應商回報為準 |
| CI／發布 | GitHub Actions（型別檢查、測試、建置）、GitHub Pages（瀏覽器模式） |
| 部署 | Docker Compose + Caddy（HTTPS）；遠端存取優先 Tailscale 或 Cloudflare Tunnel |

> 新增套件前請見第 8 節規則。

---

## 4. 一次對話的流程（實作時必須遵守的順序）

實作位置：伺服器模式 `server/src/services/chat-service.ts`；瀏覽器模式 `web/src/api/browser-api.ts` 的 `generate`。兩者共用 `shared/src/prompt-assembler.ts`，修改流程時兩邊要一起改。

1. 使用者送出訊息 → **先把使用者訊息存進資料庫**（API 失敗時訊息不能遺失）。
2. 讀取角色卡內容與最近聊天歷史。
3. 世界書掃描：比對最近幾則訊息，命中的條目入選。
4. 組裝 Prompt（見下方順序）並計算 Token。
5. 超過預算 → 依序裁切低優先內容後**重新組裝**。
6. 透過模型轉接層呼叫 API，以 SSE 逐字推送到瀏覽器。
7. 完成後存檔 assistant 訊息；使用者中止時，已收到的部分文字照常保留。

### Prompt 組裝順序（由上到下送給模型）

| 順序 | 內容 | 空間不足時 |
| --- | --- | --- |
| 1 | 系統指令 + 角色卡（description、personality、scenario） | **必留** |
| 2 | 世界書命中條目（依優先度排序，受 Token 預算限制） | 可裁切 |
| 3 | 範例對話（`mes_example`） | **最先捨棄** |
| 4 | 聊天歷史（由舊到新） | 從最舊的開始裁切 |
| 5 | 使用者最新訊息 | **必留** |
| 6 | 收尾指令（`post_history_instructions`） | **必留** |

送出前做變數替換：`{{char}}` → 角色名、`{{user}}` → 使用者暱稱。

---

## 5. 網頁整體風格

> 目標：**輕鬆悠閒**——像午後酒館角落的一張舒服座位，安靜、專注閱讀與書寫，可以長時間待著，不像後台管理系統。

### 風格方向（預設，2026-11-03 由使用者確認「輕鬆悠閒」主題）

- **視覺調性**：燕麥紙色背景、暖墨色文字、低飽和、留白充足；主內容區右上角一層極淡的暖色「燈光」漸層；以文字內容為主角，裝飾最少。
- **主題**：同時支援淺色（白天）與深色（夜晚，「點燈後的酒館」），預設跟隨系統；全部顏色定義在 `web/src/styles/tokens.css`，**禁止在元件裡寫死色碼**。
- **強調色**：全站只用一個強調色——鼠尾草綠（淺色 `#6b8c67`／深色 `#9dbc96`），用在主要按鈕、選取狀態、連結；其餘使用暖灰階。頭像底色是五種低飽和色（sage、clay、sky、sand、plum），只用於頭像。
- **字體**：內文使用系統中文字型堆疊（`"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif`）；標題與「閱讀模式」使用襯線字型（`"Noto Serif TC", "Songti TC", "PMingLiU", serif`）。
- **圓角與陰影**：統一圓角 8px；以邊框與背景色分層，少用陰影。
- **行距**：聊天與故事內文行高 1.8，單行最大寬度 70 字元。
- **角色扮演排版**：`*動作描述*` 顯示為柔和的斜體灰字。
- **動態**：只用於串流游標、訊息淡入、面板展開等功能性回饋，時間短，`prefers-reduced-motion` 時全部關閉。

### 響應式原則

- **電腦優先設計**（使用者指定：以電腦端為主），向下相容平板與手機。
- 電腦（≥ 768px）：固定側邊欄（導覽 + 最近對話）+ 主內容區；窄螢幕：頂部標題列 + 滑出式側邊欄。
- 所有可點擊元件觸控區域至少 44×44px。
- 聊天輸入框固定在底部。

### 語言與用字

- 介面文字預設使用**繁體中文**（台灣用語），程式碼、變數名稱、commit 訊息使用英文。
- 所有介面文字集中管理（`web/src/i18n/zh-TW.ts`），不要把中文字串散落在元件裡，方便日後換語言。

---

## 6. 頁面結構

### 路由與頁面

| 路由 | 頁面 | 職責 |
| --- | --- | --- |
| `/login` | 登入 | 單一密碼登入（單人使用） |
| `/` | 首頁（大廳） | 最近對話、快速開始新對話 |
| `/chat/:chatId` | 聊天頁 | 串流對話、中止；（階段三）重新生成、編輯訊息 |
| `/characters` | 角色庫 | 角色卡列表；（階段二）匯入（PNG／JSON）、匯出 |
| `/characters/:id` | 角色編輯 | 編輯角色卡欄位；`/characters/new` 為新增 |
| `/worlds` | 世界書列表 | 階段二；目前為佔位頁 |
| `/worlds/:id` | 世界書編輯 | 階段二 |
| `/settings` | 設定 | 模型設定、生成參數、Token 預算、外觀；（之後）備份匯出 |

瀏覽器模式（GitHub Pages）使用 hash 路由（`/#/chat/1`）且不顯示登入頁；伺服器模式使用一般路由。

### 版面骨架

```
電腦：
┌──────────┬──────────────────────────────┐
│ 側邊欄    │ 主內容區                      │
│ 導覽      │ （聊天／編輯器／列表）         │
│ 最近對話  │                              │
│ 主題/登出 │                              │
└──────────┴──────────────────────────────┘

窄螢幕：
┌──────────────────────────┐
│ 頂部標題列（☰ 開啟側邊欄） │
├──────────────────────────┤
│ 主內容區（單欄）           │
└──────────────────────────┘
```

### 聊天頁元件（核心頁面）

- 訊息串列：區分使用者（右側淡色泡泡）與角色（左側頭像 + 純文字），支援逐字串流顯示。
- 每則訊息的操作：複製；（階段三）編輯、重新生成、刪除、從此處分支。
- 輸入區：多行輸入（Enter 送出、Shift+Enter 換行，支援輸入法組字）、送出、停下（生成中才出現）。
- 頂部：目前角色、使用的模型、最近一次 Prompt Token 數、閱讀模式切換、刪除對話（需確認）。

---

## 7. 檔案命名與放置

### 目錄結構

```
/
├─ CLAUDE.md               # 本文件
├─ README.md               # 給人看的安裝與啟動說明
├─ .github/workflows/      # ci.yml（檢查）、pages.yml（展示版部署）、db-migrations.yml（手動產生 migration）
├─ docs/                   # 專案文件（發想書、決策紀錄）
│  └─ decisions/           # 重大決策紀錄，檔名 YYYY-MM-DD-主題.md
├─ web/                    # 前端
│  └─ src/
│     ├─ pages/            # 一個路由一個檔案（ChatPage.tsx）
│     ├─ components/       # 共用元件，依功能分子資料夾（layout/、chat/、common/）
│     ├─ hooks/            # useChatStream.ts 等
│     ├─ stores/           # Zustand store
│     ├─ api/              # TavernApi 介面、http-api.ts（伺服器模式）、browser-api.ts + browser-llm.ts（瀏覽器模式）、queries.ts
│     ├─ lib/              # 純函式工具（格式化）
│     ├─ i18n/             # 介面文字（zh-TW.ts）
│     └─ styles/           # design tokens 與全域樣式
├─ server/                 # 後端
│  └─ src/
│     ├─ routes/           # 路由（auth.ts、chats.ts、characters.ts、settings.ts）
│     ├─ services/         # 業務邏輯
│     │  ├─ chat-service.ts
│     │  ├─ character-card.ts
│     │  ├─ repo.ts        # 資料存取與型別轉換
│     │  ├─ usage.ts       # 每日用量上限
│     │  ├─ tokenizer.ts
│     │  └─ world-engine.ts   # 階段二
│     ├─ providers/        # 模型轉接層，一個供應商一個檔案
│     ├─ lib/              # auth、errors
│     ├─ db/               # schema、migrations、連線、seed
│     └─ config/           # 環境變數讀取與驗證
├─ shared/                 # 前後端共用：型別、prompt-assembler.ts、text.ts（變數替換、Token 估算）
├─ data/                   # 執行期資料（**不進版本控制**）
│  ├─ app.sqlite
│  ├─ avatars/
│  └─ cards/               # 角色卡 PNG 原檔
├─ tests/
│  └─ fixtures/            # 測試用角色卡與世界書樣本
└─ .env.example            # 環境變數範本（只放變數名稱，不放真實值）
```

單元測試與原檔放在一起（`shared/src/prompt-assembler.test.ts` 與 `prompt-assembler.ts` 同資料夾）。

### 命名規則

| 對象 | 規則 | 範例 |
| --- | --- | --- |
| 一般檔案與資料夾 | `kebab-case` | `prompt-assembler.ts` |
| React 元件檔案 | `PascalCase.tsx` | `MessageBubble.tsx` |
| 頁面元件 | `XxxPage.tsx` | `ChatPage.tsx` |
| hooks | `useXxx.ts` | `useChatStream.ts` |
| 型別／介面 | `PascalCase` | `CharacterCardV2` |
| 變數與函式 | `camelCase` | `assemblePrompt` |
| 常數 | `UPPER_SNAKE_CASE` | `DEFAULT_TOKEN_BUDGET` |
| 資料表與欄位 | `snake_case`，表名用複數 | `world_entries.secondary_keys` |
| API 路徑 | `kebab-case`，名詞複數，前綴 `/api` | `/api/world-books/:id/entries` |
| 環境變數 | `UPPER_SNAKE_CASE` | `LLM_API_KEY` |
| 測試檔 | 與原檔同名加 `.test.ts` | `world-engine.test.ts` |
| 文件 | `kebab-case.md`，決策紀錄加日期前綴 | `2026-11-03-use-sqlite.md` |

### 放置原則

- 前後端共用的型別一律放 `shared/`，不要在兩邊各寫一份。
- 供應商相關的差異**只能**出現在 `server/providers/`（伺服器模式）與 `web/src/api/browser-llm.ts`（瀏覽器模式），其他地方不得出現特定供應商的欄位名稱。
- 執行期資料與使用者上傳的檔案只放 `data/`；程式不得把它們寫到其他位置。
- 瀏覽器模式的資料存取只放 `web/src/api/browser-*.ts`；元件只能讀 `IS_BROWSER` 決定顯示哪些介面（例如金鑰輸入），不得自行讀寫 localStorage 的資料。
- 單一檔案過長（約 300 行以上）時，優先拆成同資料夾下的小模組，而不是繼續堆疊。

---

## 8. 新增內容時要遵守的格式

### 8.1 角色卡（Character Card V2）

- 欄位依社群通用格式：`name`、`description`、`personality`、`scenario`、`first_mes`、`mes_example`、`system_prompt`、`post_history_instructions`、`alternate_greetings`、`character_book`、`tags`、`creator`、`creator_notes`、`character_version`、`extensions`。
- 資料庫的 `characters.card_json` **保存整張卡的完整 JSON**；匯入時遇到不認得的欄位必須**原樣保留**，不得丟棄。
- PNG 匯入：讀取 tEXt chunk，關鍵字 `chara`，內容為 Base64 編碼的 JSON。匯出時反向寫回。
- 純 JSON 匯入匯出也必須支援。
- `tags`、`creator`、`creator_notes` 屬於 metadata，**不送給模型**。

### 8.2 世界書條目

沿用 `character_book` 條目欄位：`keys`、`secondary_keys`、`content`、`constant`、`enabled`、`insertion_order`、`priority`、`position`、`case_sensitive`。

- 中文關鍵字用「字串包含」比對，**不要**用空格分詞。
- 預設只掃描最近幾則訊息（掃描範圍可在 `world_books.scan_depth` 設定）。
- 世界書總量受 `token_budget` 限制，超出時優先保留優先度高者。
- `constant: true` 的條目不需關鍵字，每次都帶入。

### 8.3 模型轉接層（新增供應商）

新增一個供應商 = 在 `server/providers/` 新增一個檔案，實作同一個介面（`server/src/providers/types.ts`）：

```ts
interface LLMProvider {
  // 送出訊息陣列與參數，回傳文字串流
  stream(input: { messages: ChatMessage[]; params: GenParams; signal: AbortSignal }): AsyncIterable<string>;
  // 串流結束後回報用量（供應商沒提供時可回傳 null）
  usage(): TokenUsage | null;
}
```

- 預設以 OpenAI 相容的 Chat Completions 格式為基準（`openai-compatible.ts`）；OpenRouter（`openrouter.ts`）只在其上加 attribution 標頭與 `usage.include`。
- 供應商之間的欄位差異、參數名稱差異，全部在該檔案內轉換。
- 錯誤一律轉成 `ProviderError`（`PROVIDER_AUTH`、`PROVIDER_RATE_LIMIT`…），訊息給人看得懂。
- 金鑰從環境變數讀取；`model_profiles.key_env` 只存環境變數的**名稱**，且名稱必須符合 `*_API_KEY`。

### 8.4 資料庫變更

- 一律透過 Drizzle migration（`npm run db:generate`），不手動改 `app.sqlite`。伺服器啟動時自動套用。
- 本機無法執行時，可在 GitHub Actions 手動觸發 `Generate DB migrations` 工作流程。CI 會檢查 schema 與 migration 是否一致。
- 每次 migration 必須可從空資料庫完整重建。
- 刪欄位、改型別前，先說明對既有資料的影響並取得使用者同意。
- 主要資料表：`characters`、`world_books`、`world_entries`、`chats`、`messages`（含 `parent_id`，用於分支與重新生成）、`model_profiles`、`settings`、`usage_log`。

### 8.5 API 設計

- RESTful，JSON 往返；聊天生成使用 SSE 端點 `POST /api/chats/:id/generate`，事件型別見 `shared/src/api.ts` 的 `StreamEvent`。
- 錯誤格式統一：`{ "error": { "code": "SOME_CODE", "message": "人看得懂的說明" } }`。
- 所有 `/api` 端點（`/api/auth/*` 除外）都需要通過驗證。

### 8.6 介面文字與元件

- 新增文字先加進 `i18n/zh-TW.ts`，再於元件引用。
- 新增元件須支援淺色與深色主題，並在電腦寬度與窄螢幕下檢查過。
- 表單與列表必須有載入中、錯誤、空狀態三種畫面。
- 破壞性操作使用 `ConfirmDialog`，不要用瀏覽器原生 `confirm()`。

### 8.7 程式碼風格

- TypeScript `strict` 模式，不使用 `any`（確實必要時註明原因）。
- 註解解釋「為什麼」，不重複「做什麼」。
- 提交訊息使用英文，格式 `type: short description`（`feat`、`fix`、`refactor`、`docs`、`chore`、`test`）。

---

## 9. AI 修改或新增內容時必須遵守的規則

### 9.1 動手前

1. 先讀本文件，確認**目前階段**，只做該階段範圍內的事。
2. 修改既有程式前先閱讀相關檔案，沿用現有寫法與命名，不要憑空另起風格。
3. 任務含糊或有多種合理做法、且選錯成本高時，先簡短詢問；成本低時，選最簡單的做法並在回報中說明。

### 9.2 絕對不可以做的事

- **不得**把 API 金鑰、密碼或任何機密寫進程式碼、設定範本、日誌、commit、測試快照或回傳給前端的內容。
- **不得**在前端直接呼叫 LLM API，瀏覽器模式（`browser-llm.ts`）除外；瀏覽器模式不得把金鑰送到模型供應商以外的地方，也不得放寬 CSP 的 `connect-src`。
- **不得**丟失使用者資料：刪除對話、角色、世界書、覆寫角色卡前必須有確認機制；破壞性操作要先取得使用者同意。
- **不得**在匯入角色卡或世界書時丟棄未知欄位。
- **不得**在 `server/providers/` 以外寫死特定供應商的行為。
- **不得**提交 `data/`、`.env`、`node_modules/`、`app.sqlite`。
- **不得**為了「順手」而大幅重構與任務無關的程式碼。

### 9.3 需要先徵得使用者同意的事

- 新增或更換依賴套件（說明用途、體積、替代方案）。
- 變更資料庫結構、目錄結構、API 路徑。
- 提前實作未來階段的功能。
- 變更整體視覺風格、配色、字型。
- 任何會增加 API 費用的行為（例如自動摘要、背景呼叫模型）。

### 9.4 做完之後

1. 自行檢查：能編譯、型別通過、既有測試不壞（CI 會跑 `typecheck`、`test`、`build`，並在 Windows／macOS／Linux 與 Node 22、26 上跑安裝與端對端煙霧測試）；新增邏輯補上測試（特別是 Prompt 組裝、世界書觸發、角色卡匯入匯出）。
2. 電腦與窄螢幕寬度、淺色與深色主題各看過一次。
3. 若改動影響到本文件描述的內容（結構、規則、流程、進度），**同步更新 CLAUDE.md**。
4. 回報時說明：做了什麼、改了哪些檔案、怎麼驗證、還有什麼沒做或需要使用者決定的事。回報精簡，不要重述每一個步驟。

### 9.5 重點功能的測試要求

| 功能 | 至少要涵蓋 |
| --- | --- |
| Prompt 組裝器 | 各層順序正確；超出預算時依規定順序裁切；必留層永遠保留 |
| 世界書引擎 | 中文關鍵字命中；次要關鍵字需同時命中；常駐條目；預算不足時依優先度取捨；停用條目不觸發 |
| 角色卡處理 | PNG 與 JSON 往返匯出入後內容不變；未知欄位保留；變數替換 |
| 模型轉接層 | 串流拼接正確；中途中止；API 錯誤時訊息不遺失 |

測試素材放在 `tests/fixtures/`，使用自製或明確可自由使用的角色卡，不要提交來源不明的他人作品。

### 9.6 內容與隱私

- 聊天內容會送往使用者選用的 API 供應商，不得另外把對話內容送到任何第三方服務（分析、遙測、錯誤回報等）。
- 日誌不得記錄完整對話內容與金鑰；除錯需要時，只在使用者開啟「除錯模式」（`DEBUG_MODE=1`）時記錄，且預設關閉。

---

## 10. 安全與部署備忘

- 預設以單一密碼登入（`APP_PASSWORD`）；放上公網必須啟用 HTTPS 並設定 `COOKIE_SECURE=1`。
- 後端預設只綁定 `127.0.0.1`；要讓其他裝置連線時改 `HOST`，並優先用 Tailscale 或 Cloudflare Tunnel，避免直接開放連接埠。
- 後端以 `DAILY_REQUEST_LIMIT` 限制每日生成次數，防止程式錯誤或被他人使用時燒光額度。
- 備份：每日複製 `data/app.sqlite` 與 `data/avatars/`、`data/cards/`，保留最近 7 份；角色與世界書另提供 JSON 匯出。

---

## 11. 已知風險與對策（開發時留意）

| 風險 | 對策 |
| --- | --- |
| Prompt 超出模型上下文長度 | 組裝時先算 Token 預算，依第 4 節順序裁切 |
| Token 估算與實際模型不同 | `gpt-tokenizer` 只做估算；上下文長度設定保守一點，以供應商回報為準 |
| 長篇故事遺忘前情 | 世界書記錄設定；階段三加入自動摘要 |
| API 費用失控 | 每日用量上限、顯示每次 Token 用量、限制單次輸出長度 |
| 角色卡格式不相容 | 保留未知欄位；用多張真實格式的卡測試匯入 |
| 範圍失控、變成重寫 SillyTavern | 嚴守階段範圍，功能新增先對照路線圖 |

---

## 12. 待確認事項（取得答案後請更新本文件）

- [x] 使用者的 LLM API：**OpenRouter**（OpenAI 相容格式），第一個實作為 `server/src/providers/openrouter.ts`。
- [ ] 部署位置：自己的電腦、NAS、還是雲端主機？（目前以「自己的電腦，本機執行」為預設）
- [x] 視覺風格：輕鬆悠閒、以電腦端為主（見第 5 節）。
- [x] 專案存放的 repo：`issuejames-prog/tavern`（GitHub），瀏覽器模式在 GitHub Pages：<https://issuejames-prog.github.io/tavern/>（需在 repo 的 Settings → Pages 選 `gh-pages` 分支）。
- [x] 發布方式：以 GitHub Pages 瀏覽器模式為主（2026-11-03 使用者選擇），伺服器模式保留。
- [ ] 瀏覽器模式的資料備份匯出（目前只存在單一瀏覽器）。
- [ ] 預設模型 ID：目前為 `deepseek/deepseek-chat-v3-0324`，使用者可在設定頁更改。
