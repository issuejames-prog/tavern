# CLAUDE.md

> 給 AI 協作者閱讀：這份文件說明專案是什麼、要做到哪裡、怎麼寫才符合約定。
> 開始任何修改前請先讀完，並以「讓專案依路線圖穩定往下走」為最高目標。
> 標記為「（預設）」的項目是目前的暫定決定，使用者明確改變時以使用者為準，並同步更新本文件。

---

## 1. 專案目的

一個**只給自己使用**的輕量版 SillyTavern：**完全在瀏覽器裡執行的網頁**（HTML + JavaScript），發布在 GitHub Pages，用使用者自己的 OpenRouter 金鑰進行 **AI 角色扮演聊天** 與 **文字故事創作**。不需要安裝、不需要伺服器、打開網址就能用。

四個核心版塊：

| 版塊 | 職責 |
| --- | --- |
| 介面（Web UI） | 聊天、角色庫、世界書編輯、設定四類頁面，以電腦瀏覽器為主，手機可用 |
| 模型（大腦） | 使用者自己的 OpenRouter 金鑰（或其他 OpenAI 相容 API），由瀏覽器直接呼叫，透過「模型轉接層」可替換 |
| 角色卡（Character Card） | 角色性格、語氣、背景的結構化資料，可用 PNG（內嵌 JSON）或純 JSON 匯入匯出 |
| 世界書（World Info） | 世界觀／地名／事件／規則的條目庫，對話出現關鍵字時才自動載入 Prompt |

### 不是什麼（範圍界線）

- 不是多人服務：沒有註冊、付費、社群、權限分級、雲端帳號。
- **沒有後端伺服器**：2026-11-03 起刪除自架伺服器版（決策見 `docs/decisions/2026-11-03-html-only.md`），之後不再新增需要伺服器的功能。
- 不是 SillyTavern 的完整複製：只保留上述四個核心概念，其他功能走路線圖逐步加。
- 不內建模型：大腦永遠是外部 API。

### 設計原則（做取捨時依序參考）

1. **自用優先**：架構越簡單越好，單人維護得動。
2. **打開即用**：所有功能都必須能在 GitHub Pages 的靜態網頁上運作，不依賴任何自架服務。
3. **模型可抽換**：核心程式只依賴「訊息陣列進、文字串流出、回報用量」這個介面。
4. **相容社群格式**：角色卡 Character Card V2／V3、世界書（`character_book` 與 SillyTavern World Info JSON）要能與 SillyTavern 互通。
5. **資料自己掌握**：資料只存在使用者的瀏覽器（IndexedDB），可一鍵匯出／還原備份；不送到模型供應商以外的任何地方。
6. **先 MVP 再擴充**：每個階段都要有可用成果，不要為了未來功能提早抽象。

---

## 2. 目前進度與路線圖

> 開發時先確認「現在在哪個階段」，**只做當前階段的工作**，除非使用者明確指示跳階段。
> 完成一個階段後，由使用者驗收關卡，再更新下方的「目前階段」。

**目前階段：階段二（角色與世界書）——程式碼已完成，待使用者驗收** ← 更新此行以反映真實進度

| 階段 | 內容 | 關卡（驗收條件） | 狀態 |
| --- | --- | --- | --- |
| 一 MVP | 設定頁與金鑰、串接 OpenRouter、串流對話、聊天紀錄存檔、套用角色卡 | 能與一張角色卡穩定串流聊天 | ✅ 2026-11-03 驗收 |
| 二 角色與世界書 | 角色卡匯入匯出（PNG／JSON）、角色卡編輯器與頭像、世界書條目與關鍵字觸發、Token 預算控制、全部資料備份還原 | 角色卡與世界書能匯入並正確觸發 | 🔄 待驗收 |
| 三 創作體驗 | 重新生成與分支、編輯任一則訊息、選擇其他開場白、Prompt 預覽除錯（完整內容）、自動摘要前情、故事續寫模式 | 長篇故事不遺忘前情，也不超長度 | |
| 四 進階擴充 | 多組模型設定、群組聊天、瀏覽器端向量檢索記憶、語音、角色圖片庫、PWA 離線安裝、跨裝置同步（使用者自選雲端，例如 Gist／雲端硬碟） | 依需要逐項驗收 | |

### 已實作

**階段一**
- 瀏覽器內完成整個對話流程（`web/src/api/browser-chat.ts`），直接呼叫 OpenRouter，SSE 串流、中止、錯誤時保留部分文字。
- 設定頁：OpenRouter 金鑰（只存在本瀏覽器）、暱稱、系統指令、模型與生成參數、今日用量（每日 300 次上限）、主題與閱讀模式。

**階段二**
- 角色卡：PNG（tEXt `chara`／`ccv3`）與 JSON 匯入匯出，V1／V2／V3，未知欄位完整保留；拖曳匯入；頭像圖片（上傳或沿用 PNG 卡圖）；匯出 PNG 時沒有圖片會自動產生一張。
- 角色編輯器：全部 V2 欄位（含其他開場白、作者、版本）、綁定世界書。
- 世界書：列表、編輯器（條目清單 + 條目編輯）、主要／次要關鍵字、常駐、啟用、優先度、插入順序、位置、區分大小寫；掃描深度、Token 預算、全域啟用；匯入 SillyTavern World Info JSON 或角色卡內嵌 `character_book`，匯出為 SillyTavern 格式。匯入含世界書的角色卡時自動建立並綁定。
- Token 預算：聊天頁頂部顯示本次 Prompt 用量與預算、觸發的世界書條目、被裁切的內容。
- 資料儲存改用 IndexedDB（階段一的 localStorage 資料會自動搬移），設定頁可匯出／還原全部資料（備份不含金鑰）。

---

## 3. 系統架構

```
GitHub Pages（靜態檔案）
   │  下載 HTML / JS / CSS
   ▼
使用者的瀏覽器（React 單頁應用）
   ├─ 頁面與元件（web/src/pages、components）
   ├─ TavernApi（web/src/api/types.ts）── 頁面只透過它存取資料
   │    ├─ browser-api.ts   角色、世界書、設定、匯入匯出、備份
   │    ├─ browser-chat.ts  一次對話的流程（§4）
   │    ├─ browser-llm.ts   模型轉接層（OpenAI 相容格式 / OpenRouter）
   │    └─ browser-db.ts    IndexedDB 存取與舊資料搬移
   ├─ 核心邏輯（shared/，不碰 DOM、可在 Node 測試）
   │    ├─ prompt-assembler.ts  Prompt 排序與裁切
   │    ├─ world-engine.ts      世界書關鍵字掃描與預算
   │    ├─ world-info.ts        世界書格式轉換
   │    └─ card-png.ts / card-io.ts  角色卡 PNG／JSON
   │
   ├──► IndexedDB（本瀏覽器）：所有資料與頭像圖片
   ├──► localStorage（本瀏覽器）：API 金鑰、介面偏好
   └──► https://openrouter.ai（唯一允許的外部連線，由 CSP 限制）
```

### 鐵則

- **金鑰**：API 金鑰只存在使用者自己瀏覽器的 localStorage（`tavern-openrouter-key`），只送往模型供應商；永遠不進程式碼、不進 repo、不進建置產物、不進備份檔、不寫進日誌。**`.env` 或任何含金鑰的檔案都不得上傳到 GitHub**（repo 是公開的）。
- **CSP**：建置時注入 Content-Security-Policy（`web/vite.config.ts`）：`script-src 'self'`、`connect-src 'self' https://openrouter.ai`。不得放寬，新增外部連線前要先取得使用者同意。
- **不用 `dangerouslySetInnerHTML`**；角色卡與世界書內容一律當純文字顯示（它們可能來自網路上的陌生人）。

### 技術選型（預設）

| 層級 | 技術 |
| --- | --- |
| 前端 | React + Vite + TypeScript、Tailwind CSS v4、Zustand（介面狀態）、TanStack Query（資料快取）、React Router（hash 路由） |
| 核心邏輯 | `shared/`：純 TypeScript，無相依套件 |
| 串流 | 瀏覽器 `fetch` 讀取 SSE |
| 資料 | IndexedDB（原生 API，無套件）；金鑰與偏好在 localStorage |
| PNG 角色卡 | 自行實作 PNG chunk 讀寫（`shared/src/card-png.ts`），無套件 |
| Token 估算 | `estimateTokens`（中日韓字元約 1 token／字，其他約 3.5 字元／token），實際用量以供應商回報為準 |
| 測試 | Vitest（`shared/` 的核心邏輯） |
| CI／發布 | GitHub Actions：`ci.yml`（型別檢查、測試、建置）、`pages.yml`（建置並推到 `gh-pages` 分支） |

> 新增套件前請見第 9.3 節規則。

---

## 4. 一次對話的流程（實作時必須遵守的順序）

實作位置：`web/src/api/browser-chat.ts` 的 `generate`；Prompt 組裝在 `shared/src/prompt-assembler.ts`。

1. 使用者送出訊息 → **先把使用者訊息存進資料庫**（API 失敗時訊息不能遺失）。
2. 讀取角色卡內容與聊天歷史。
3. 世界書掃描：全域世界書 + 角色綁定的世界書，比對最近 `scan_depth` 則訊息，命中的條目依各本的 `token_budget` 篩選。
4. 組裝 Prompt（見下方順序）並計算 Token。
5. 超過預算 → 依序裁切低優先內容後**重新組裝**；把結果（用量、觸發條目、裁切）回報給聊天頁。
6. 透過模型轉接層呼叫 API，逐字推送到畫面。
7. 完成後存檔 assistant 訊息；使用者中止時，已收到的部分文字照常保留。

### Prompt 組裝順序（由上到下送給模型）

| 順序 | 內容 | 空間不足時 |
| --- | --- | --- |
| 1 | 系統指令 + 角色卡（description、personality、scenario） | **必留** |
| 2 | 世界書命中條目（`before_char` 在前、`after_char` 在後，各自依插入順序；總量 ≤ 預算的 50%） | 可裁切（優先度低的先拿掉） |
| 3 | 範例對話（`mes_example`） | **最先捨棄** |
| 4 | 聊天歷史（由舊到新） | 從最舊的開始裁切 |
| 5 | 使用者最新訊息 | **必留** |
| 6 | 收尾指令（`post_history_instructions`） | **必留** |

送出前做變數替換：`{{char}}` → 角色名、`{{user}}` → 使用者暱稱（也支援舊式 `<BOT>`／`<USER>`）。

---

## 5. 網頁整體風格

> 目標：**輕鬆悠閒**——像午後酒館角落的一張舒服座位，安靜、專注閱讀與書寫，可以長時間待著，不像後台管理系統。

### 風格方向（預設，2026-11-03 由使用者確認「輕鬆悠閒」主題）

- **視覺調性**：燕麥紙色背景、暖墨色文字、低飽和、留白充足；主內容區右上角一層極淡的暖色「燈光」漸層；以文字內容為主角，裝飾最少。
- **主題**：同時支援淺色（白天）與深色（夜晚，「點燈後的酒館」），預設跟隨系統；全部顏色定義在 `web/src/styles/tokens.css`，**禁止在元件裡寫死色碼**。
- **強調色**：全站只用一個強調色——鼠尾草綠（淺色 `#6b8c67`／深色 `#9dbc96`），用在主要按鈕、選取狀態、連結；其餘使用暖灰階。頭像底色是五種低飽和色（sage、clay、sky、sand、plum），只用於頭像。
- **字體**：內文使用系統中文字型堆疊（`"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif`）；標題與「閱讀模式」使用襯線字型（`"Noto Serif TC", "Songti TC", "PMingLiU", serif`）。
- **圓角與陰影**：統一圓角 8px；以邊框與背景色分層，少用陰影（彈出選單除外）。
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

### 路由與頁面（hash 路由，例如 `/#/chat/12`，因為 GitHub Pages 無法改寫路徑）

| 路由 | 頁面 | 職責 |
| --- | --- | --- |
| `/` | 首頁（大廳） | 最近對話、快速開始新對話；未設定金鑰時顯示提示 |
| `/chat/:chatId` | 聊天頁 | 串流對話、中止、Token 預算顯示；（階段三）重新生成、編輯訊息 |
| `/characters` | 角色庫 | 角色列表、匯入（按鈕或拖曳）、匯出 PNG／JSON、刪除 |
| `/characters/:id` | 角色編輯 | 全部欄位、頭像、綁定世界書；`/characters/new` 為新增 |
| `/worlds` | 世界書列表 | 列表、新增、匯入（按鈕或拖曳）、匯出、刪除 |
| `/worlds/:id` | 世界書編輯 | 左：設定與條目清單（可搜尋）；右：條目編輯 |
| `/settings` | 設定 | 金鑰、暱稱與系統指令、模型與參數、今日用量、備份與還原、外觀 |

### 版面骨架

```
電腦：
┌──────────┬──────────────────────────────┐
│ 側邊欄    │ 主內容區                      │
│ 導覽      │ （聊天／編輯器／列表）         │
│ 最近對話  │                              │
│ 主題切換  │                              │
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
- 頂部：角色、模型、Prompt 預算計（點開看觸發的世界書與裁切內容）、閱讀模式、刪除對話（需確認）。

---

## 7. 檔案命名與放置

### 目錄結構

```
/
├─ CLAUDE.md               # 本文件
├─ README.md               # 給人看的使用說明
├─ .github/workflows/      # ci.yml（檢查）、pages.yml（發布到 gh-pages）
├─ docs/decisions/         # 重大決策紀錄，檔名 YYYY-MM-DD-主題.md
├─ shared/src/             # 核心邏輯（純 TS，不碰 DOM、無相依套件），測試與原檔放一起
│  ├─ api.ts               # 介面型別（角色、對話、世界書摘要、串流事件…）
│  ├─ card.ts              # 角色卡型別與正規化
│  ├─ card-png.ts          # PNG chunk 讀寫
│  ├─ card-io.ts           # 角色卡檔案匯入匯出
│  ├─ world-info.ts        # 世界書型別與格式轉換
│  ├─ world-engine.ts      # 關鍵字掃描與預算
│  ├─ prompt-assembler.ts  # Prompt 組裝與裁切
│  └─ text.ts              # 變數替換、Token 估算
├─ web/                    # 網頁應用
│  ├─ vite.config.ts       # 含 CSP 注入
│  └─ src/
│     ├─ pages/            # 一個路由一個檔案（ChatPage.tsx）
│     ├─ components/       # 共用元件，依功能分子資料夾（layout/、chat/、common/、world/）
│     ├─ hooks/            # useChatStream.ts 等
│     ├─ stores/           # Zustand store（介面偏好）
│     ├─ api/              # TavernApi 與瀏覽器實作（見 §3）、queries.ts（TanStack Query hooks）
│     ├─ lib/              # 純函式工具（格式化）
│     ├─ i18n/             # 介面文字（zh-TW.ts）
│     └─ styles/           # design tokens 與全域樣式
└─ tests/fixtures/         # 測試用角色卡與世界書樣本（自製）
```

### 命名規則

| 對象 | 規則 | 範例 |
| --- | --- | --- |
| 一般檔案與資料夾 | `kebab-case` | `prompt-assembler.ts` |
| React 元件檔案 | `PascalCase.tsx` | `MessageBubble.tsx` |
| 頁面元件 | `XxxPage.tsx` | `ChatPage.tsx` |
| hooks | `useXxx.ts` | `useChatStream.ts` |
| 型別／介面 | `PascalCase` | `CharacterCardV2` |
| 變數與函式 | `camelCase` | `assemblePrompt` |
| 常數 | `UPPER_SNAKE_CASE` | `DAILY_LIMIT` |
| 儲存的資料欄位 | `snake_case`（與角色卡格式一致） | `world_book_id`、`secondary_keys` |
| localStorage／IndexedDB 鍵 | `tavern-` 前綴，`kebab-case` | `tavern-openrouter-key` |
| 測試檔 | 與原檔同名加 `.test.ts` | `world-engine.test.ts` |
| 文件 | `kebab-case.md`，決策紀錄加日期前綴 | `2026-11-03-html-only.md` |

### 放置原則

- 不碰 DOM、可在 Node 執行的邏輯一律放 `shared/`，並在那裡寫測試；`web/` 只放介面與瀏覽器相關程式。
- 供應商相關的差異**只能**出現在 `web/src/api/browser-llm.ts`，其他地方不得出現特定供應商的欄位名稱。
- 資料存取只放 `web/src/api/browser-*.ts`；頁面與元件只能透過 `api`（`TavernApi`）與 `queries.ts`，不得自行讀寫 IndexedDB 或 localStorage（介面偏好的 `stores/ui-store.ts` 除外）。
- 單一檔案過長（約 300 行以上）時，優先拆成同資料夾下的小模組，而不是繼續堆疊。

---

## 8. 新增內容時要遵守的格式

### 8.1 角色卡（Character Card V2／V3）

- 欄位依社群通用格式：`name`、`description`、`personality`、`scenario`、`first_mes`、`mes_example`、`system_prompt`、`post_history_instructions`、`alternate_greetings`、`character_book`、`tags`、`creator`、`creator_notes`、`character_version`、`extensions`。
- 儲存時保存**整張卡的完整 JSON**；匯入時遇到不認得的欄位必須**原樣保留**，不得丟棄。V3 卡保留 `spec: chara_card_v3`。
- PNG 匯入：讀取 tEXt chunk，優先 `ccv3`，其次 `chara`，內容為 Base64 編碼的 UTF-8 JSON。匯出時移除舊的卡片 chunk 後寫入 `chara`（V3 另寫 `ccv3`）。
- 匯出時若角色綁定世界書，以該世界書覆寫 `character_book`，並設定 `extensions.world` 為世界書名稱。
- `tags`、`creator`、`creator_notes`、`character_version` 屬於 metadata，**不送給模型**。

### 8.2 世界書

儲存格式沿用 `character_book` 條目欄位：`id`、`comment`、`keys`、`secondary_keys`、`content`、`constant`、`selective`、`enabled`、`insertion_order`、`priority`、`position`、`case_sensitive`、`extensions`；世界書本身有 `scan_depth`、`token_budget`、`global`。

- 中文關鍵字用「字串包含」比對，**不要**用空格分詞；`/規則/旗標` 視為正規表示式，寫錯的規則不觸發。
- 有 `secondary_keys` 且 `selective !== false` 時，主要與次要關鍵字各至少命中一個才觸發。
- `constant: true` 不需關鍵字；`enabled: false` 永不觸發。
- 每本世界書只掃描最近 `scan_depth` 則訊息；命中條目受該本 `token_budget` 限制（0 = 不限），超出時保留 `priority` 高者，再比 `insertion_order`。
- 匯入支援 SillyTavern World Info JSON（`entries` 為物件、欄位 `key`／`keysecondary`／`disable`／`order`…）與 `character_book`；SillyTavern 的其他欄位原樣保留在條目上，`position` > 1 存在 `extensions.st_position`，匯出時還原。匯出一律為 SillyTavern World Info 格式。

### 8.3 模型轉接層

- `web/src/api/browser-llm.ts` 的 `streamCompletion`：輸入訊息陣列與參數，輸出文字串流，並回報用量。以 OpenAI 相容 Chat Completions 為基準；OpenRouter 另加 `HTTP-Referer`、`X-Title` 與 `usage.include`。
- 錯誤一律轉成 `BrowserLlmError`（`PROVIDER_AUTH`、`PROVIDER_CREDITS`、`PROVIDER_RATE_LIMIT`、`PROVIDER_BAD_REQUEST`、`PROVIDER_NETWORK`…），訊息給人看得懂。
- 新增供應商：在 `browser-llm.ts` 內處理差異（檔案變大時拆成 `browser-llm-<供應商>.ts`），並同步把網域加進 CSP 的 `connect-src`（需使用者同意）。

### 8.4 資料儲存變更

- 儲存結構定義在 `web/src/api/browser-db.ts` 的 `BrowserState`，有 `version` 欄位。
- 改結構時：提高 `version`，在 `upgrade()` 加上舊版 → 新版的轉換，**不得讓既有使用者的資料失效**；備份還原也要能讀舊版。
- 刪欄位、改型別前，先說明對既有資料的影響並取得使用者同意。

### 8.5 TavernApi

- 頁面只透過 `TavernApi`（`web/src/api/types.ts`）取資料；錯誤一律丟 `ApiRequestError(code, 人看得懂的訊息)`。
- 一次對話以 `StreamEvent` 回報：`user_saved` → `prompt` → `delta`… → `done`，失敗時 `error`（附已存的部分回覆）。

### 8.6 介面文字與元件

- 新增文字先加進 `i18n/zh-TW.ts`，再於元件引用。
- 新增元件須支援淺色與深色主題，並在電腦寬度與窄螢幕下檢查過。
- 表單與列表必須有載入中、錯誤、空狀態三種畫面。
- 破壞性操作使用 `ConfirmDialog`，不要用瀏覽器原生 `confirm()`。
- 匯入功能同時提供按鈕與拖曳（`components/common/files.tsx`）。

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

- **不得**把 API 金鑰、密碼或任何機密寫進程式碼、設定檔、日誌、commit、測試快照或備份檔。
- **不得**把聊天內容或金鑰送到模型供應商以外的任何地方，也不得放寬 CSP 的 `connect-src`／`script-src`。
- **不得**新增需要後端伺服器才能運作的功能。
- **不得**丟失使用者資料：刪除對話、角色、世界書、還原備份前必須有確認機制；儲存結構變更必須能搬移舊資料。
- **不得**在匯入角色卡或世界書時丟棄未知欄位。
- **不得**使用 `dangerouslySetInnerHTML` 或以任何方式把角色卡／世界書內容當 HTML 執行。
- **不得**為了「順手」而大幅重構與任務無關的程式碼。

### 9.3 需要先徵得使用者同意的事

- 新增或更換依賴套件（說明用途、體積、替代方案）。
- 變更儲存結構、目錄結構、路由。
- 提前實作未來階段的功能。
- 變更整體視覺風格、配色、字型。
- 任何會增加 API 費用的行為（例如自動摘要、背景呼叫模型）。
- 新增任何對外連線（CDN、字型、分析服務、其他 API）。

### 9.4 做完之後

1. 自行檢查：CI 會跑 `npm run typecheck`、`npm test`、`npm run build`，必須全部通過；新增邏輯補上測試（特別是 Prompt 組裝、世界書觸發、角色卡匯入匯出）。
2. 在瀏覽器實際操作過，電腦與窄螢幕寬度、淺色與深色主題各看過一次。
3. 若改動影響到本文件描述的內容（結構、規則、流程、進度），**同步更新 CLAUDE.md**。
4. 回報時說明：做了什麼、改了哪些檔案、怎麼驗證、還有什麼沒做或需要使用者決定的事。回報精簡，不要重述每一個步驟。

### 9.5 重點功能的測試要求

| 功能 | 至少要涵蓋 | 測試檔 |
| --- | --- | --- |
| Prompt 組裝器 | 各層順序正確；超出預算時依規定順序裁切；必留層永遠保留 | `shared/src/prompt-assembler.test.ts` |
| 世界書引擎 | 中文關鍵字命中；次要關鍵字需同時命中；常駐條目；預算不足時依優先度取捨；停用條目不觸發；格式互轉不掉欄位 | `shared/src/world-engine.test.ts` |
| 角色卡處理 | PNG 與 JSON 往返匯出入後內容不變；未知欄位保留；V1／V3；變數替換 | `shared/src/card-io.test.ts`、`text.test.ts` |
| 模型轉接層 | 串流拼接正確；中途中止；API 錯誤時訊息不遺失 | 以瀏覽器實測（Playwright 攔截 OpenRouter 回應） |

測試素材放在 `tests/fixtures/`，使用自製或明確可自由使用的角色卡，不要提交來源不明的他人作品。

### 9.6 內容與隱私

- 聊天內容只送往使用者選用的 API 供應商，不得另外送到任何第三方服務（分析、遙測、錯誤回報、字型 CDN 等）。
- 不在 console 記錄完整對話內容或金鑰。

---

## 10. 發布與資料備忘

- 發布：推到 `main` 後，`pages.yml` 會建置並強制推送到 `gh-pages` 分支；GitHub Pages 設定為 `gh-pages` 分支根目錄。網址：<https://issuejames-prog.github.io/tavern/>。
- 本機開發：`npm install` → `npm run dev`（http://localhost:5173）。
- 資料只存在使用者瀏覽器的 IndexedDB；提醒使用者定期在設定頁「匯出全部資料」。備份檔不含金鑰。
- 金鑰安全：建議使用者在 OpenRouter 建立專用金鑰並設定額度上限；每日生成上限 300 次（`DAILY_LIMIT`）。

---

## 11. 已知風險與對策（開發時留意）

| 風險 | 對策 |
| --- | --- |
| Prompt 超出模型上下文長度 | 組裝時先算 Token 預算，依第 4 節順序裁切 |
| Token 估算與實際模型不同 | 估算偏保守；上下文長度設定保守一點，以供應商回報為準 |
| 金鑰在瀏覽器被竊取（XSS） | CSP 限制腳本與連線來源、不渲染 HTML、匯入內容只當純文字 |
| 清除瀏覽器資料導致遺失 | 設定頁備份與還原；介面多處提醒 |
| 長篇故事遺忘前情 | 世界書記錄設定；階段三加入自動摘要 |
| API 費用失控 | 每日用量上限、顯示每次 Token 用量、限制單次輸出長度、建議金鑰額度上限 |
| 角色卡格式不相容 | 保留未知欄位；V1／V2／V3 都能讀；用多張真實格式的卡測試匯入 |
| 範圍失控、變成重寫 SillyTavern | 嚴守階段範圍，功能新增先對照路線圖 |

---

## 12. 待確認事項（取得答案後請更新本文件）

- [x] LLM API：**OpenRouter**（OpenAI 相容格式）。
- [x] 視覺風格：輕鬆悠閒、以電腦端為主（見第 5 節）。
- [x] repo：`issuejames-prog/tavern`（公開），GitHub Pages：<https://issuejames-prog.github.io/tavern/>。
- [x] 發布方式：只做網頁版（2026-11-03 使用者決定刪除本機伺服器版）。
- [ ] 預設模型 ID：目前為 `deepseek/deepseek-chat-v3-0324`，使用者可在設定頁更改。
- [ ] 舊金鑰曾外洩於 repo 歷史（2026-11-03），使用者是否已撤銷？是否要改寫 git 歷史清除？
