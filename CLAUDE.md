# CLAUDE.md

> 給 AI 協作者閱讀。本文件分三部分：
>
> - **第一部分｜守則**：專案是什麼、要長成什麼樣子、怎麼寫才對。**永久有效**，任何修改都必須遵守。
> - **第二部分｜現況**：目前做到哪裡、實際的程式結構與最近一次改動。會隨進度更新。
> - **第三部分｜風險、方向與自我檢查**：已知風險、接下來要做什麼、待確認事項，以及交付前的守則檢查表。
>
> 開始任何工作前：先讀第一部分 → 在第二部分確認目前階段 → 在第三部分確認下一步與待確認事項 → 動手 → 交付前逐項完成第三部分的檢查表。
> 標記為「（預設）」的項目是暫定決定，使用者明確改變時以使用者為準，並同步更新本文件。

---
---

# 第一部分｜守則（必讀，永久有效）

## 1. 專案目的

一個**只給使用者自己使用**的輕量版 SillyTavern：**完全在瀏覽器裡執行的網頁**，發布在 GitHub Pages，用使用者自己的 OpenRouter 金鑰進行 **AI 角色扮演聊天** 與 **文字故事創作**。打開網址就能用，不需要安裝、不需要伺服器。

### 1.1 四個核心版塊

| 版塊 | 職責 |
| --- | --- |
| 介面 | 聊天、角色庫、世界書、設定四類頁面 |
| 模型（大腦） | 使用者自己的 OpenRouter 金鑰（或其他 OpenAI 相容 API），由瀏覽器直接呼叫，經「模型轉接層」可替換 |
| 角色卡 | 角色性格、語氣、背景的結構化資料，PNG（內嵌 JSON）或純 JSON 匯入匯出 |
| 世界書 | 世界觀／地名／事件／規則的條目庫，對話出現關鍵字時才載入 Prompt |

### 1.2 範圍界線（不做什麼）

- **沒有後端伺服器**：所有功能都必須能在 GitHub Pages 的靜態網頁上運作。不得新增需要伺服器才能運作的功能。
- 不是多人服務：沒有註冊、付費、社群、權限、雲端帳號。
- 不是 SillyTavern 的完整複製：只做上述四個版塊，其他功能依路線圖（第二部分）逐步加入。
- 不內建模型：大腦永遠是外部 API。

### 1.3 設計原則（取捨時依序參考）

1. **自用優先**：架構越簡單越好，單人維護得動。
2. **打開即用**：只依賴瀏覽器與 GitHub Pages。
3. **模型可抽換**：核心只依賴「訊息陣列進、文字串流出、回報用量」。
4. **相容社群格式**：角色卡 V1／V2／V3、世界書（`character_book` 與 SillyTavern World Info JSON）能與 SillyTavern 互通。
5. **資料自己掌握**：資料只存在使用者瀏覽器，可一鍵備份還原；除了模型供應商，不送往任何地方。
6. **先 MVP 再擴充**：每個階段都要有可用成果，不為未來功能提早抽象。

### 1.4 技術邊界（預設）

| 層級 | 技術 |
| --- | --- |
| 前端 | React + Vite + TypeScript、Tailwind CSS v4、Zustand（介面偏好）、TanStack Query（資料快取）、React Router（hash 路由） |
| 核心邏輯 | `shared/`：純 TypeScript，不碰 DOM，無相依套件，可在 Node 測試 |
| 資料 | IndexedDB（原生 API）；API 金鑰與介面偏好在 localStorage |
| 模型呼叫 | 瀏覽器 `fetch` 讀取 SSE 串流 |
| 測試 | Vitest |
| 發布 | GitHub Actions 建置後推到 `gh-pages` 分支 |

---

## 2. 網頁整體風格

> 目標：**輕鬆悠閒**——像午後酒館角落的一張舒服座位；安靜、專注閱讀與書寫、可以長時間待著，**不像後台管理系統**。

- **視覺調性**：燕麥紙色背景、暖墨色文字、低飽和、留白充足；主內容區右上角一層極淡的暖色「燈光」漸層；文字是主角，裝飾最少。
- **主題**：淺色（白天）與深色（夜晚，「點燈後的酒館」）都要支援，預設跟隨系統。
- **顏色只能來自 design tokens**：全部定義在 `web/src/styles/tokens.css`，元件內**禁止寫死色碼**。
- **單一強調色**：鼠尾草綠（淺 `#6b8c67`／深 `#9dbc96`），只用於主要按鈕、選取狀態、連結；其餘為暖灰階。頭像底色五種（sage、clay、sky、sand、plum），只用於頭像。
- **字體**：內文用系統中文字型（`"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif`）；標題與「閱讀模式」用襯線字型（`"Noto Serif TC", "Songti TC", "PMingLiU", serif`）。不載入外部字型。
- **圓角與陰影**：統一圓角 8px；以邊框與背景色分層，少用陰影（彈出選單除外）。
- **閱讀**：聊天與故事內文行高 1.8，單行最大寬度 70 字元；`*動作描述*` 顯示為柔和斜體灰字。
- **動態**：只用於串流游標、訊息淡入、面板展開等功能性回饋；時間短；`prefers-reduced-motion` 時全部關閉。
- **響應式**：**電腦優先**（使用者指定）。≥ 768px：固定側邊欄 + 主內容區；窄螢幕：頂部標題列 + 滑出式側邊欄。可點擊元件至少 44×44px。聊天輸入框固定在底部。
- **語言**：介面一律**繁體中文（台灣用語）**；程式碼、變數、commit 訊息用英文。

---

## 3. 頁面結構

### 3.1 路由（hash 路由，例如 `/#/chat/12`——GitHub Pages 無法改寫路徑）

| 路由 | 頁面 | 職責 |
| --- | --- | --- |
| `/` | 大廳 | 最近對話、快速開始新對話；未設定金鑰時顯示提示 |
| `/chat/:chatId` | 聊天 | 串流對話、中止、Prompt 預算顯示 |
| `/characters` | 角色庫 | 列表、匯入（按鈕＋拖曳）、匯出 PNG／JSON、刪除 |
| `/characters/:id` | 角色編輯 | 全部欄位、頭像、綁定世界書；`/characters/new` 為新增 |
| `/worlds` | 世界書列表 | 列表、新增、匯入（按鈕＋拖曳）、匯出、刪除 |
| `/worlds/:id` | 世界書編輯 | 左：設定與條目清單（可搜尋）；右：條目編輯 |
| `/settings` | 設定 | 金鑰、暱稱與系統指令、模型與參數、今日用量、備份還原、外觀 |

新增頁面：一個路由一個 `XxxPage.tsx`，掛在 `App.tsx` 的 `AppShell` 之下，並更新本表。

### 3.2 版面骨架

```
電腦（≥ 768px）：                          窄螢幕：
┌──────────┬────────────────────┐         ┌────────────────────┐
│ 側邊欄    │ 主內容區            │         │ 頂部標題列（☰）     │
│ 導覽      │（聊天／編輯器／列表）│         ├────────────────────┤
│ 最近對話  │                    │         │ 主內容區（單欄）     │
│ 主題切換  │                    │         └────────────────────┘
└──────────┴────────────────────┘
```

### 3.3 聊天頁（核心頁面）

- 訊息串列：使用者在右（淡色泡泡），角色在左（頭像＋純文字）；逐字串流顯示。
- 輸入區：多行輸入，Enter 送出、Shift+Enter 換行，**輸入法組字中不得送出**；生成中顯示「停下」。
- 頂部：角色、模型、Prompt 預算計（點開看觸發的世界書與被裁切內容）、閱讀模式、刪除對話（需確認）。
- 每則訊息的操作依路線圖擴充（複製 → 編輯、重新生成、刪除、分支）。

---

## 4. 新增內容時要遵守的格式

### 4.1 一次對話的流程（順序不得更動）

1. 使用者送出 → **先把使用者訊息存檔**（API 失敗時訊息不能遺失）。
2. 讀取角色卡與聊天歷史。
3. 世界書掃描：全域世界書＋角色綁定的世界書。
4. 組裝 Prompt 並計算 Token。
5. 超過預算 → 依下表裁切後**重新組裝**，並回報用量、觸發條目、裁切內容。
6. 經模型轉接層呼叫 API，逐字推送到畫面。
7. 完成後存檔回覆；使用者中止時，已收到的部分文字照常保留。

**Prompt 組裝順序**（由上到下送給模型）：

| 順序 | 內容 | 空間不足時 |
| --- | --- | --- |
| 1 | 系統指令 + 角色卡（description、personality、scenario） | **必留** |
| 2 | 世界書命中條目（`before_char` 在前、`after_char` 在後，各依插入順序；總量 ≤ 預算 50%） | 可裁切（優先度低者先拿掉） |
| 3 | 範例對話（`mes_example`） | **最先捨棄** |
| 4 | 聊天歷史（舊 → 新） | 從最舊開始裁切 |
| 5 | 使用者最新訊息 | **必留** |
| 6 | 收尾指令（`post_history_instructions`） | **必留** |

送出前做變數替換：`{{char}}` → 角色名、`{{user}}` → 使用者暱稱（也支援舊式 `<BOT>`／`<USER>`）。

### 4.2 角色卡（Character Card V2／V3）

- 欄位依社群格式：`name`、`description`、`personality`、`scenario`、`first_mes`、`mes_example`、`system_prompt`、`post_history_instructions`、`alternate_greetings`、`character_book`、`tags`、`creator`、`creator_notes`、`character_version`、`extensions`。
- 保存**整張卡的完整 JSON**；不認得的欄位必須**原樣保留**。V3 卡保留 `spec: chara_card_v3`。
- PNG：tEXt chunk，讀取時優先 `ccv3`、其次 `chara`，內容為 Base64 的 UTF-8 JSON；匯出時先移除舊卡片 chunk，再寫 `chara`（V3 另寫 `ccv3`）。
- 匯出時若綁定世界書：以該世界書覆寫 `character_book`，並設 `extensions.world` 為世界書名稱。
- `tags`、`creator`、`creator_notes`、`character_version` 是 metadata，**不送給模型**。

### 4.3 世界書

- 條目欄位沿用 `character_book`：`id`、`comment`、`keys`、`secondary_keys`、`content`、`constant`、`selective`、`enabled`、`insertion_order`、`priority`、`position`、`case_sensitive`、`extensions`。世界書本身：`name`、`description`、`scan_depth`、`token_budget`、`global`、`extra`（匯入檔中不使用的頂層欄位）。
- 中文關鍵字用**字串包含**比對，不得用空格分詞；`/規則/旗標` 視為正規表示式，寫錯的規則不觸發。
- 有 `secondary_keys` 且 `selective !== false`：主要與次要關鍵字各至少命中一個才觸發。
- `constant: true` 不需關鍵字；`enabled: false` 永不觸發。
- 每本只掃描最近 `scan_depth` 則訊息；命中條目受該本 `token_budget` 限制（0 = 不限），先保留 `priority` 高者，再比 `insertion_order`。
- 匯入：SillyTavern World Info JSON（`entries` 為物件，欄位 `key`／`keysecondary`／`disable`／`order`…）與 `character_book`；SillyTavern 其他欄位原樣保留，`position` > 1 存於 `extensions.st_position`。匯出一律為 SillyTavern World Info 格式。

### 4.4 模型轉接層

- 介面：輸入訊息陣列與參數 → 輸出文字串流 → 回報用量。以 OpenAI 相容 Chat Completions 為基準。
- 供應商差異只能寫在 `web/src/api/browser-llm.ts`（變大時拆為 `browser-llm-<供應商>.ts`）。
- 錯誤一律轉成 `BrowserLlmError`（`PROVIDER_AUTH`、`PROVIDER_CREDITS`、`PROVIDER_RATE_LIMIT`、`PROVIDER_BAD_REQUEST`、`PROVIDER_NETWORK`…），訊息要讓人看得懂。
- 新增供應商網域時，必須同步加入 CSP `connect-src`，並先取得使用者同意。

### 4.5 資料儲存

- 結構定義於 `web/src/api/browser-db.ts` 的 `BrowserState`，帶 `version`。
- 改結構：提高 `version`，在 `upgrade()` 加入舊版 → 新版轉換，**既有使用者的資料不得失效**；備份還原也必須能讀舊版。
- 備份檔（`format: "tavern-backup"`）包含全部資料與頭像，**不含 API 金鑰**。

### 4.6 資料存取介面（TavernApi）

- 頁面與元件只透過 `TavernApi`（`web/src/api/types.ts`）與 `queries.ts` 取資料。
- 錯誤一律丟 `ApiRequestError(code, 人看得懂的訊息)`。
- 對話以 `StreamEvent` 回報：`user_saved` → `prompt` → `delta`… → `done`；失敗時 `error`（附已存的部分回覆）。

### 4.7 介面文字與元件

- 所有介面文字（含錯誤訊息、預設文字、相對時間）先加進 `web/src/i18n/zh-TW.ts` 再引用，不得把中文字串寫在元件或資料層。唯一例外：`sample-data.ts` 的範例角色內容。
- 新元件必須支援淺色與深色主題，並在電腦寬度與窄螢幕下檢查過。
- 表單與列表必須有「載入中、錯誤、空狀態」三種畫面。
- 破壞性操作用 `ConfirmDialog`，不得用瀏覽器原生 `confirm()`／`alert()`。
- 匯入功能同時提供按鈕與拖曳（`components/common/files.tsx`）。

### 4.8 程式碼風格

- TypeScript `strict`；不用 `any`（確實必要時註明原因）。
- 註解說明「為什麼」，不重複「做什麼」。
- Commit 訊息用英文：`type: short description`（`feat`、`fix`、`refactor`、`docs`、`chore`、`test`）。

---

## 5. 檔案命名與放置

### 5.1 目錄結構

```
/
├─ CLAUDE.md                # 本文件
├─ README.md                # 給使用者看的說明
├─ .github/workflows/       # ci.yml（檢查）、pages.yml（發布 gh-pages）
├─ docs/decisions/          # 重大決策紀錄
├─ shared/src/              # 核心邏輯：純 TS、不碰 DOM、無相依套件；測試與原檔放一起
├─ web/
│  ├─ vite.config.ts        # 建置設定（含 CSP 注入）
│  └─ src/
│     ├─ pages/             # 一個路由一個檔案
│     ├─ components/        # 依功能分資料夾：layout/、chat/、common/、world/…
│     ├─ hooks/             # React hooks
│     ├─ stores/            # Zustand（只放介面偏好）
│     ├─ api/               # TavernApi、瀏覽器端資料與模型呼叫（browser-*.ts）、queries.ts
│     ├─ lib/               # 純函式工具
│     ├─ i18n/              # 介面文字
│     └─ styles/            # tokens.css、global.css
└─ tests/fixtures/          # 測試用角色卡與世界書（自製）
```

### 5.2 放置原則

- 不碰 DOM、可在 Node 執行的邏輯 → `shared/`，並在旁邊寫測試。`web/` 只放介面與瀏覽器相關程式。
- 讀寫 IndexedDB／localStorage → 只能在 `web/src/api/browser-*.ts`（介面偏好在 `stores/ui-store.ts` 例外）。
- 供應商差異 → 只能在 `web/src/api/browser-llm.ts`。
- 顏色 → 只能在 `web/src/styles/tokens.css`。
- 介面文字 → 只能在 `web/src/i18n/zh-TW.ts`。
- 單一檔案超過約 300 行 → 拆成同資料夾下的小模組，不繼續堆疊。

### 5.3 命名規則

| 對象 | 規則 | 範例 |
| --- | --- | --- |
| 一般檔案與資料夾 | `kebab-case` | `prompt-assembler.ts` |
| React 元件檔 | `PascalCase.tsx` | `MessageBubble.tsx` |
| 頁面元件 | `XxxPage.tsx` | `ChatPage.tsx` |
| hooks | `useXxx.ts` | `useChatStream.ts` |
| 瀏覽器資料層 | `browser-<用途>.ts` | `browser-db.ts` |
| 型別／介面 | `PascalCase` | `CharacterCardV2` |
| 變數與函式 | `camelCase` | `assemblePrompt` |
| 常數 | `UPPER_SNAKE_CASE` | `DAILY_LIMIT` |
| 儲存的資料欄位 | `snake_case`（與角色卡格式一致） | `world_book_id` |
| localStorage／IndexedDB 鍵 | `tavern-` 前綴 | `tavern-openrouter-key` |
| 測試檔 | 原檔名加 `.test.ts` | `world-engine.test.ts` |
| 決策紀錄 | `YYYY-MM-DD-主題.md` | `2026-11-03-html-only.md` |

---

## 6. AI 修改或新增內容時必須遵守的規則

### 6.1 動手前

1. 讀完第一部分；在第二部分確認**目前階段**，只做該階段範圍內的事。
2. 修改前先讀相關檔案，沿用既有寫法與命名，不另起風格。
3. 任務含糊、有多種合理做法且選錯代價高 → 先簡短詢問；代價低 → 選最簡單的做法並在回報中說明。

### 6.2 絕對不可以

- 把 API 金鑰、密碼或任何機密寫進程式碼、設定檔、commit、日誌、測試快照或備份檔；**`.env` 或任何含金鑰的檔案都不得上傳到 GitHub（repo 是公開的）**。
- 把聊天內容或金鑰送到模型供應商以外的地方；放寬 CSP 的 `connect-src`／`script-src`。
- 新增需要後端伺服器才能運作的功能。
- 讓使用者資料遺失：刪除、還原備份前必須確認；儲存結構變更必須能搬移舊資料。
- 匯入角色卡或世界書時丟棄未知欄位。
- 使用 `dangerouslySetInnerHTML`，或以任何方式把角色卡／世界書內容當 HTML 執行（它們可能來自陌生人）。
- 為了「順手」大幅重構與任務無關的程式碼。

### 6.3 必須先徵得使用者同意

- 新增或更換依賴套件（說明用途、體積、替代方案）。
- 變更儲存結構、目錄結構、路由。
- 提前實作未來階段的功能。
- 變更整體視覺風格、配色、字型。
- 任何會增加 API 費用的行為（例如自動摘要、背景呼叫模型）。
- 新增任何對外連線（CDN、字型、分析服務、其他 API）。
- 改寫 git 歷史或強制推送 `main`。

### 6.4 做完之後

1. CI 的 `npm run typecheck`、`npm test`、`npm run build` 必須全部通過；新增邏輯補上測試。
2. 在瀏覽器實際操作：電腦與窄螢幕寬度、淺色與深色主題各看過一次。
3. 逐項完成第三部分的「守則檢查表」。
4. 更新第二部分（進度、改動重點）與第三部分（風險、方向、待確認）；守則本身有變動時，必須是使用者明確同意的改變。
5. 回報：做了什麼、改了哪些檔案、怎麼驗證、還沒做或需要使用者決定的事。精簡，不重述每個步驟。

### 6.5 重點功能的測試要求

| 功能 | 至少要涵蓋 |
| --- | --- |
| Prompt 組裝器 | 各層順序；超出預算時依規定順序裁切；必留層永遠保留 |
| 世界書引擎 | 中文關鍵字；次要關鍵字需同時命中；常駐；預算不足依優先度取捨；停用不觸發；格式互轉不掉欄位 |
| 角色卡 | PNG 與 JSON 往返後內容不變；未知欄位保留；V1／V3；變數替換 |
| 模型轉接層 | 串流拼接；中途中止；API 錯誤時訊息不遺失（以 Playwright 攔截 OpenRouter 回應實測） |

測試素材放 `tests/fixtures/`，只用自製或明確可自由使用的內容。

---
---

# 第二部分｜目前執行狀況（隨進度更新）

> 最後更新：2026-11-03

## 7. 路線圖與目前階段

**目前階段：階段二（角色與世界書）——程式碼已完成並上線，待使用者驗收**

| 階段 | 內容 | 驗收條件 | 狀態 |
| --- | --- | --- | --- |
| 一 MVP | 設定頁與金鑰、串接 OpenRouter、串流對話、聊天紀錄存檔、套用角色卡 | 能與一張角色卡穩定串流聊天 | ✅ 2026-11-03 驗收 |
| 二 角色與世界書 | 角色卡匯入匯出（PNG／JSON）、角色編輯器與頭像、世界書條目與關鍵字觸發、Token 預算控制、全部資料備份還原 | 角色卡與世界書能匯入並正確觸發 | 🔄 待驗收 |
| 三 創作體驗 | 重新生成與分支、編輯任一則訊息、選擇其他開場白、完整 Prompt 預覽、自動摘要前情、故事續寫模式 | 長篇故事不遺忘前情，也不超長度 | ⏳ |
| 四 進階擴充 | 多組模型設定、群組聊天、瀏覽器端向量記憶、語音、角色圖片庫、PWA 離線安裝、跨裝置同步（使用者自選雲端） | 依需要逐項驗收 | ⏳ |

### 7.1 演進歷程

```
11/03 初版 ─► 伺服器版（Hono + SQLite）＋ 展示版（預錄回覆）
        └─► 使用者選擇瀏覽器模式：GitHub Pages 上用自己的金鑰真實聊天
              └─► 階段一驗收 ✅
                    └─► 刪除伺服器版，只保留網頁（HTML-only）＋ 階段二功能 ◄ 目前
```

決策紀錄：`docs/decisions/2026-11-03-browser-mode.md`、`docs/decisions/2026-11-03-html-only.md`。

## 8. 實際架構

```
GitHub Pages（gh-pages 分支的靜態檔）
   ▼
使用者的瀏覽器（React 單頁應用）
   ├─ pages/ 與 components/ ── 只透過 TavernApi（api/types.ts）＋ queries.ts 取資料
   │
   ├─ web/src/api/
   │    ├─ browser-api.ts     角色、對話、世界書、設定、匯入匯出、備份
   │    ├─ browser-chat.ts    一次對話（§4.1 的七個步驟）
   │    ├─ browser-llm.ts     OpenRouter／OpenAI 相容串流（模型轉接層）
   │    ├─ browser-store.ts   記憶體中的資料、ID、頭像 URL、金鑰讀寫
   │    ├─ browser-db.ts      IndexedDB 讀寫、版本升級、舊 localStorage 資料搬移
   │    ├─ browser-images.ts  頭像轉 PNG、無圖時產生卡圖
   │    └─ sample-data.ts     預設範例角色（阿暖、墨言）
   │
   ├─ shared/src/（純邏輯，Vitest 測試）
   │    ├─ prompt-assembler.ts  組裝與裁切
   │    ├─ world-engine.ts      關鍵字掃描、各本預算
   │    ├─ world-info.ts        世界書型別、SillyTavern ⇄ character_book 轉換
   │    ├─ card.ts / card-io.ts / card-png.ts  角色卡正規化、檔案匯入匯出、PNG chunk
   │    └─ text.ts              變數替換、Token 估算
   │
   ├──► IndexedDB「tavern」：state（全部資料，BrowserState v2）、blobs（頭像）
   ├──► localStorage：tavern-openrouter-key（金鑰）、tavern-ui-prefs（主題／閱讀模式）
   └──► https://openrouter.ai（CSP 唯一允許的外部連線）
```

**參數現值**：預設模型 `deepseek/deepseek-chat-v3-0324`、上下文 8192、單次回覆 600、溫度 0.9、Top P 0.95；每日生成上限 300 次；世界書預設掃描深度 4、每本預算 1024 tokens；Token 估算：中日韓字約 1 token／字，其他約 3.5 字元／token。

**發布流程**：推到 `main` → `ci.yml`（typecheck、test、build）＋ `pages.yml`（build 後強制推送到 `gh-pages`）→ <https://issuejames-prog.github.io/tavern/>。

## 9. 已實作功能

### 階段一（已驗收）
- 瀏覽器直接呼叫 OpenRouter：SSE 逐字串流、可停下、錯誤時保留部分文字與使用者訊息。
- 設定頁：金鑰（只存本瀏覽器）、暱稱、系統指令、模型與生成參數、今日用量、主題與閱讀模式。
- 大廳、聊天頁、角色列表與基本編輯器；兩位範例角色。

### 階段二（待驗收）
- **角色卡**：PNG（`chara`／`ccv3`）與 JSON 匯入匯出，V1／V2／V3，未知欄位完整保留；按鈕或拖曳匯入；PNG 卡圖自動成為頭像，也可上傳 PNG／JPG／WebP；沒有圖片時匯出會產生一張頭像色＋首字的卡圖。
- **角色編輯器**：全部 V2 欄位（含其他開場白清單、作者、版本）、綁定世界書、匯出按鈕。
- **世界書**：列表（全域標記、條目數、綁定的角色）；編輯器左右分欄（設定＋可搜尋條目清單／條目編輯）；主要／次要關鍵字、常駐、啟用、區分大小寫、優先度、插入順序、位置、即時 Token 估算；匯入 SillyTavern World Info 或角色卡內嵌 `character_book`；匯出 SillyTavern 格式；匯入含世界書的角色卡時自動建立並綁定。
- **Token 預算**：聊天頁頂部的預算計顯示用量、觸發條目、被略過的世界書／歷史／範例。
- **儲存與備份**：改用 IndexedDB，階段一 localStorage 資料首次開啟時自動搬移；設定頁「匯出全部資料／從備份還原」（還原前需確認，備份不含金鑰）；瀏覽器不能存資料（無痕模式）時顯示警告。

## 10. 這次改動的重點（2026-11-03：HTML-only ＋ 階段二）

1. **刪除伺服器版**：移除 `server/`（Hono、SQLite、Drizzle、登入、`.env`）、煙霧測試、migration 工作流程；npm workspaces 只剩 `shared`、`web`。`TavernApi` 只剩瀏覽器實作，移除登入頁與 hash／browser 兩種路由的分支。
2. **儲存層改寫**：`browser-db.ts`（IndexedDB、`BrowserState` v2、`upgrade()` 由 v1 升級）＋ `browser-store.ts`（記憶體快取、頭像 object URL、金鑰）；原本單一的 `browser-api.ts` 拆出 `browser-chat.ts`、`browser-images.ts`。
3. **核心邏輯擴充（shared/）**：新增 `card-png.ts`（自寫 PNG chunk 與 CRC32，無套件）、`card-io.ts`、`world-info.ts`、`world-engine.ts`；`card.ts` 支援 V3 並修補格式不良的欄位；`prompt-assembler.ts` 的世界書片段加入 `position`、`label`，回報 `worldLabels`。
4. **型別調整（shared/api.ts）**：角色與對話摘要加 `avatar_url`、`world_book_id`；新增 `WorldBookSummary`、`PromptInfo`、`StreamEvent` 的 `prompt` 事件；`SettingsResponse.profiles[]` 改為單一 `profile`；移除伺服器專用欄位（`key_env` 等）。
5. **新頁面與元件**：`WorldEditPage`、`components/world/EntryEditor`、`components/chat/PromptBudget`、`components/common/files`（`FileButton`、`DropZone`、`Notice`）；`Avatar` 支援圖片；角色、世界書、設定頁改寫。
6. **安全**：CSP 改為所有建置都注入，`img-src` 加入 `blob:`（頭像）；備份還原的 data URL 改為本地解碼，不用 `fetch()`（CSP 不允許）。
7. **測試與 CI**：新增 `card-io.test.ts`（6 項）、`world-engine.test.ts`（10 項），共 25 項全部通過；新增自製 fixtures（`sample-card-v2.json`、`sample-world-st.json`）；CI 簡化為 typecheck、test、build。
8. **驗證**：以 Playwright 對實際部署的網頁跑完整流程——v1 資料搬移、PNG 卡匯入並自動建立世界書、SillyTavern 世界書匯入、關鍵字與常駐條目觸發（未綁定的世界書不觸發）、PNG 匯出內容完整、備份不含金鑰、深淺色畫面。

---
---

# 第三部分｜風險、方向與自我檢查

## 11. 已知風險與對策

| 風險 | 對策 | 現況 |
| --- | --- | --- |
| 清除瀏覽器資料、換電腦導致遺失 | 設定頁備份還原；大廳／設定多處提醒；無痕模式警告 | 已實作；尚無自動備份提醒 |
| 金鑰在瀏覽器被竊取（XSS） | CSP 限制腳本與連線、不渲染 HTML、匯入內容只當純文字、建議金鑰設額度上限 | 已實作 |
| 舊金鑰留在 git 歷史 | 使用者撤銷舊金鑰；必要時改寫歷史（需同意） | 待使用者確認（見 §13） |
| Prompt 超出模型上下文 | 依 §4.1 順序裁切並回報 | 已實作 |
| Token 估算與實際模型不同 | 估算偏保守、上下文設定保守、以供應商回報為準 | 已實作 |
| API 費用失控 | 每日 300 次上限、顯示用量、限制單次輸出、建議金鑰額度 | 已實作 |
| 角色卡／世界書格式不相容 | 保留未知欄位；V1／V2／V3；SillyTavern 雙向轉換 | 已實作；尚未用大量真實社群卡測試 |
| IndexedDB 容量或瀏覽器清理 | 頭像上限 8 MB／張；備份 | 尚未申請 `navigator.storage.persist()` |
| 長篇故事遺忘前情 | 世界書記錄設定；階段三自動摘要 | 階段三 |
| 範圍失控、變成重寫 SillyTavern | 嚴守階段範圍，新功能先對照路線圖 | 持續 |

## 12. 接下來的進行方向

1. **使用者驗收階段二**：用真實的 SillyTavern 角色卡與世界書匯入，確認關鍵字觸發與預算計顯示；通過後把 §7 更新為「階段二 ✅」。
2. **先修守則落差**（見 §14 的「目前落差」，屬於維護、不需跳階段）：介面文字移入 i18n、拆分 `browser-api.ts`。
3. **階段三（驗收後開始），建議順序**：
   1. 重新生成與編輯訊息（利用既有的 `parent_id`，先做線性版本，再做分支切換）
   2. 開新對話時選擇其他開場白
   3. 完整 Prompt 預覽（把預算計展開成實際送出的訊息內容）
   4. 故事續寫模式（讓角色接著上一則繼續寫）
   5. 自動摘要前情（**會增加 API 費用，須先取得同意**；需要設計摘要觸發時機與存放位置）
4. 階段四依使用者需要挑選。

## 13. 待確認事項

- [ ] **舊金鑰**：2026-11-03 曾把含金鑰的 `.env` 上傳到公開 repo（已刪除檔案，但仍在 git 歷史）。使用者是否已在 OpenRouter 撤銷？是否要改寫 git 歷史清除（不可復原，需同意）？
- [ ] **階段二驗收結果**。
- [ ] **預設模型 ID**：目前 `deepseek/deepseek-chat-v3-0324`，是否改為使用者常用的模型？
- [ ] **自動摘要（階段三）**：可接受的額外 API 費用與觸發頻率。
- [ ] **是否申請持久化儲存**（`navigator.storage.persist()`，降低瀏覽器自動清除資料的機率；部分瀏覽器會跳出詢問）。

## 14. 守則遵守確認

### 14.1 交付前檢查表（每次修改都要逐項確認）

- [ ] 只做目前階段範圍內的事；跨階段或屬於 §6.3 的事項已取得同意。
- [ ] 沒有任何金鑰、密碼、`.env` 進入程式碼、commit 或備份。
- [ ] 沒有新增對外連線；CSP 未放寬。
- [ ] 沒有使用 `dangerouslySetInnerHTML`；匯入內容只當純文字。
- [ ] 新增的介面文字都在 `i18n/zh-TW.ts`；新增的顏色都在 `tokens.css`。
- [ ] 儲存結構有變時，已提高 `version` 並寫好 `upgrade()`；備份可讀舊版。
- [ ] 匯入匯出未丟失未知欄位（有測試涵蓋）。
- [ ] 破壞性操作有 `ConfirmDialog`。
- [ ] 新元件有載入中／錯誤／空狀態，深淺色與窄螢幕都看過。
- [ ] 單一檔案未超過約 300 行（或已拆分）。
- [ ] CI 全部通過，並以瀏覽器實際操作驗證。
- [ ] 已更新第二部分（進度、改動）與第三部分（風險、方向、待確認）。

### 14.2 目前程式碼的遵守情況（2026-11-03 掃描結果）

| 守則 | 結果 | 說明 |
| --- | --- | --- |
| 金鑰不進 repo／備份 | ✅ | 目前檔案中沒有金鑰；備份經實測不含金鑰。**歷史紀錄中仍有舊金鑰**（見 §13）。 |
| CSP 只允許 OpenRouter | ✅ | `web/vite.config.ts` 注入，已在部署版本確認。 |
| 不用 `dangerouslySetInnerHTML` | ✅ | 0 處。 |
| 不用 `any` | ✅ | 0 處。 |
| 不用原生 `confirm()`／`alert()` | ✅ | 0 處（僅註解提及）。 |
| 資料存取只在 `api/browser-*.ts` | ✅ | 頁面與元件未直接讀寫 IndexedDB／localStorage。 |
| 顏色只在 tokens | ⚠️ | `browser-images.ts` 有兩個備援色碼（讀不到 CSS 變數時才用於產生卡圖）。 |
| 介面文字只在 i18n | ❌ | `browser-api.ts`（驗證錯誤訊息、對話標題）、`browser-store.ts`（預設系統指令、暱稱、「找不到…」）、`lib/format.tsx`（相對時間）仍有中文字串，需移入 `zh-TW.ts`。 |
| 單檔約 300 行以內 | ❌ | `browser-api.ts` 381 行，應拆為 `browser-characters.ts`、`browser-worlds.ts`、`browser-backup.ts` 等。 |
| 供應商差異只在 `browser-llm.ts` | ⚠️ | 預設模型設定（OpenRouter 位址）在 `browser-store.ts`，設定頁有 openrouter.ai 取得金鑰的連結；屬預設值與說明連結，可接受，但新增供應商時應把預設值移到 `browser-llm.ts`。 |
| 重點功能測試 | ✅ | 25 項單元測試；模型轉接層以 Playwright 實測。 |

> ❌／⚠️ 項目列入 §12 第 2 點，下次修改時優先處理。
