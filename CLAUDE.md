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
| `/chat/:chatId` | 聊天 | 串流對話、中止、Prompt 預算顯示、作者備註 |
| `/characters` | 角色庫 | 列表、匯入（按鈕＋拖曳）、匯出 PNG／JSON、刪除、加入範例 |
| `/characters/:id` | 角色編輯 | 依 §4.2 排列：基本資料 → 描述（Ali:Chat）→ 角色備註（PList）→ 第一條訊息 → 世界書 → 選填欄位；右側為撰寫檢查與寫卡指南；`/characters/new` 為新增 |
| `/worlds` | 世界書列表 | 列表、新增、匯入（按鈕＋拖曳）、匯出、刪除、加入範例 |
| `/worlds/:id` | 世界書編輯 | 左：設定與條目清單（依提示順序排列、可搜尋）；中：條目編輯；右：世界書指南 |
| `/settings` | 設定 | 金鑰、暱稱／使用者角色描述／系統指令、模型與參數、世界書總體參數、今日用量、備份還原、外觀 |

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
- 頂部：角色、模型、Prompt 預算計（點開看觸發的世界書、插入的備註、被裁切內容）、作者備註、閱讀模式、刪除對話（需確認）。
- 每則訊息的操作依路線圖擴充（複製 → 編輯、重新生成、刪除、分支）。

---

## 4. 新增內容時要遵守的格式

> 本節的角色卡與世界書規則依據兩份寫卡指南（PLists + Ali:Chat 寫作指南、世界書進階教學，2026-11-04 由使用者提供，與本文件衝突處以指南為準）。核心原則：**送給模型的內容越靠下（越接近最新訊息），影響越強。**

### 4.1 一次對話的流程（順序不得更動）

1. 使用者送出 → **先把使用者訊息存檔**（API 失敗時訊息不能遺失）。
2. 讀取角色卡、聊天歷史與這段對話的作者備註。
3. 世界書掃描：全域世界書＋角色綁定的世界書，依設定頁的「總體參數」（§4.4）。
4. 組裝 Prompt 並計算 Token。
5. 超過預算 → 依下表裁切後**重新組裝**，並回報用量、觸發條目、插入的備註、裁切內容。
6. 經模型轉接層呼叫 API，逐字推送到畫面。
7. 完成後存檔回覆；使用者中止時，已收到的部分文字照常保留。

**Prompt 組裝順序**（由上到下送給模型；越下面影響越強）：

| 順序 | 內容 | 永久／臨時 | 空間不足時 |
| --- | --- | --- | --- |
| 1 | 系統指令 → 世界書「角色設定之前」→ 描述 → 個性摘要 → 情境 → 世界書「角色設定之後」→ 使用者的角色描述 | 永久 | 必留（世界書條目可裁切） |
| 2 | 對話範例（`mes_example`） | 臨時 | **最先捨棄** |
| 3 | 聊天歷史（舊 → 新，第一條訊息也在其中）＋使用者最新訊息 | 臨時 | 從最舊開始裁切；最新訊息必留 |
| ↳ | **依深度插入**（從最新訊息往上數，0 = 最新訊息之後）：世界書 @D 條目 → 角色備註 → 〔世界書「作者備註之前」＋作者備註＋世界書「作者備註之後」〕 | 永久 | 必留（世界書條目可裁切） |
| 4 | 收尾指令（`post_history_instructions`） | 永久 | 必留 |

- 變數替換：`{{char}}` → 角色名、`{{user}}` → 使用者暱稱（也支援舊式 `<BOT>`／`<USER>`）。
- 作者備註（每段對話各自設定）：預設深度 4、頻率 1（每次）；頻率 N = 每 N 次使用者發言插入一次，0 = 停用。內容空白時，深度仍作為「作者備註前／後」世界書條目的錨點。
- 角色備註：角色卡 `extensions.depth_prompt`（`prompt`、`depth`、`role`），與 SillyTavern 相容，隨卡匯出；預設深度 4。

### 4.2 角色卡（Character Card V2／V3）

**格式**
- 欄位依社群格式：`name`、`description`、`personality`、`scenario`、`first_mes`、`mes_example`、`system_prompt`、`post_history_instructions`、`alternate_greetings`、`character_book`、`tags`、`creator`、`creator_notes`、`character_version`、`extensions`。
- 保存**整張卡的完整 JSON**；不認得的欄位必須**原樣保留**。V3 卡保留 `spec: chara_card_v3`。
- PNG：tEXt chunk，讀取時優先 `ccv3`、其次 `chara`，內容為 Base64 的 UTF-8 JSON；匯出時先移除舊卡片 chunk，再寫 `chara`（V3 另寫 `ccv3`）。
- 匯出時若綁定世界書：以該世界書覆寫 `character_book`，並設 `extensions.world` 為世界書名稱。
- `tags`、`creator`、`creator_notes`、`character_version` 是 metadata，**不送給模型**。

**撰寫守則（PLists + Ali:Chat）**——範例、模板、提示文字、檢查都必須依此設計：
1. **名字**帶有資訊：可加頭銜交代身分；避免與知名角色同名。
2. **描述欄放 Ali:Chat**：1～2 段「{{user}} 簡短提問、{{char}} 詳細回答」的對話，用說話方式、動作、經歷強化最重要的特點；最重要的範例放最下面。範例長 → 回覆長，範例短 → 回覆短。品質 > 數量。
3. **PList 放角色備註（深度 4）**：`[類別：特點，特點；類別：特點]` 一行寫完，類別依重要性排列：身體、衣服在前，標籤、場景居中，**性格放最後**。對話範例中強化過的特點都要列進 PList。沒有角色備註時，PList 放在描述欄最下面。
4. **第一條訊息**對文風影響最大：交代場景、外貌、說話方式、與 {{user}} 的關係；越詳細，回覆越詳細。可以留空。
5. **不替使用者行動或說話**：第一條訊息與對話範例中只描寫角色自己。
6. **避免換行，絕不使用連續空行**（模型會當成分隔）。
7. 個性摘要、情境欄通常留空或極短（寫進 PList）；`mes_example` 是臨時的，想永久保留的 Ali:Chat 寫在描述欄。
8. 永久內容不宜過多：次要背景放世界書。

撰寫檢查（`shared/src/card-writing.ts` 的 `lintCard`）至少涵蓋：連續空行、替使用者行動、缺少 PList、PList 不在描述最下面、沒有第一條訊息、對話範例只放在臨時欄位、永久內容超過預算 30%。

### 4.3 世界書

**格式**
- 條目沿用 `character_book`：`id`、`comment`、`keys`、`secondary_keys`、`content`、`constant`、`selective`、`enabled`、`insertion_order`、`position`、`case_sensitive`、`extensions`。V2 規格沒有的選項存在 `extensions`，**鍵名與 SillyTavern 內嵌 character_book 相同**：`position`（0 角色設定之前、1 之後、2 作者備註之前、3 作者備註之後、4 @D；5／6 原樣保留）、`depth`、`probability`、`useProbability`、`selectiveLogic`（0 AND 任一、1 NOT 全部、2 NOT 任一、3 AND 全部）、`exclude_recursion`、`prevent_recursion`。讀寫一律透過 `readEntry`／`writeEntry`。
- 世界書本身：`name`、`description`、`global`（全域世界書；否則為角色世界書，只對綁定的角色生效）、`entries`、`extra`（匯入檔中不使用的頂層欄位，例如原本的 `scan_depth`、`token_budget`，匯出時還原）。
- 匯入：SillyTavern World Info JSON（`entries` 為物件，`key`／`keysecondary`／`disable`／`order`／`position`／`depth`／`probability`／`selectiveLogic`…）、`character_book`、內嵌世界書的角色卡。匯出一律為 SillyTavern World Info 格式。

**觸發規則（世界書指南）**
- 關鍵字以逗號分隔，任一出現即觸發；中文用**字串包含**比對，不得用空格分詞；`/規則/旗標` 視為正規表示式，寫錯不觸發。
- 狀態三種：普通（關鍵字觸發）、常駐（每次帶入）、停用（不觸發）。
- 有次要關鍵字且 `selective !== false` 時依 `selectiveLogic` 判斷（AND／NOT）。
- 觸發機率 < 100 時擲骰決定。
- 遞迴掃描開啟時，已觸發條目的內容可再觸發其他條目（最多 3 層）；`exclude_recursion` 的條目不會被遞迴觸發，`prevent_recursion` 的條目內容不會觸發其他條目。
- **插入位置強弱**：角色設定之前（最弱）＜ 之後 ＜ 作者備註之前 ＜ 作者備註之後；@D 依深度而定。同一位置內 `insertion_order` 越大越靠下、越強。位置優先於順序。
- **預算取捨**：常駐 ＞ 直接提到關鍵字 ＞ 遞迴觸發，同類再比 `insertion_order`（大者優先）。舊欄位 `priority` 保留但不使用。
- 不實作「角色背景插入策略」與「最小激活次數」（指南不建議使用）；「篩選／排除角色」留待群組聊天（階段四）。

**撰寫守則**：一條目一件事；影響小的世界背景放「角色設定之前」，希望模型牢記的放靠下；不要把所有條目都放在作者備註前後；背景類條目可關閉「內容不會觸發其他條目」避免連鎖；常駐＋@D 可當作者備註使用；機率觸發少用。

### 4.4 世界書總體參數（設定頁，對所有世界書生效）

| 參數 | 預設 | 說明 |
| --- | --- | --- |
| 掃描深度 | 2 | 以「對」計：1 = 使用者剛送出的訊息＋角色最近一則回覆；N 對 = 最新訊息＋往前 2N−1 則；最多 10 |
| 上下文百分比 | 25% | 世界書最多占提示預算的比例 |
| 預算上限 | 0（不限） | 世界書的絕對 token 上限 |
| 遞迴掃描 | 開 | 見 §4.3 |
| 全字匹配 | 關 | 只影響英文等以空格分詞的關鍵字 |

### 4.5 模型轉接層

- 介面：輸入訊息陣列與參數 → 輸出文字串流 → 回報用量。以 OpenAI 相容 Chat Completions 為基準。
- 供應商差異（含預設位址、預設模型、取得金鑰的網址）只能寫在 `web/src/api/browser-llm.ts`。
- 錯誤一律轉成 `BrowserLlmError`，訊息要讓人看得懂。
- 新增供應商網域時，必須同步加入 CSP `connect-src`，並先取得使用者同意。

### 4.6 資料儲存

- 結構定義於 `web/src/api/browser-db.ts` 的 `BrowserState`，帶 `version`（目前 3）。
- 改結構：提高 `version`，在 `upgrade()` 加入舊版 → 新版轉換，**既有使用者的資料不得失效**；備份還原也走同一個 `upgrade()`。
- 備份檔（`format: "tavern-backup"`）包含全部資料與頭像，**不含 API 金鑰**。

### 4.7 資料存取介面（TavernApi）

- 頁面與元件只透過 `TavernApi`（`web/src/api/types.ts`）與 `queries.ts` 取資料。
- 錯誤一律丟 `ApiRequestError(code, 人看得懂的訊息)`。
- 對話以 `StreamEvent` 回報：`user_saved` → `prompt` → `delta`… → `done`；失敗時 `error`（附已存的部分回覆）。

### 4.8 介面文字與元件

- 所有介面文字（含錯誤訊息、預設文字、相對時間、指南與模板）放在 `web/src/i18n/zh-TW.ts` 或 `web/src/i18n/zh-TW/*.ts`，不得寫在元件或資料層。例外：`sample-data.ts` 的範例內容，以及送給模型的 Prompt 區段標題（`shared/`）。
- 新元件必須支援淺色與深色主題，並在電腦寬度與窄螢幕下檢查過。
- 表單與列表必須有「載入中、錯誤、空狀態」三種畫面。
- 破壞性操作用 `ConfirmDialog`，不得用瀏覽器原生 `confirm()`／`alert()`。
- 匯入功能同時提供按鈕與拖曳（`components/common/files.tsx`）。
- 編輯器旁提供對應指南（`GuidePanel`），欄位提示與模板必須符合 §4.2／§4.3 的撰寫守則。

### 4.9 程式碼風格

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
├─ examples/                # 範例角色卡（PNG／JSON）與世界書，依 §4.2／§4.3 撰寫
├─ shared/src/              # 核心邏輯：純 TS、不碰 DOM、無相依套件；測試與原檔放一起
├─ web/
│  ├─ vite.config.ts        # 建置設定（含 CSP 注入）
│  └─ src/
│     ├─ pages/             # 一個路由一個檔案
│     ├─ components/        # 依功能分資料夾：layout/、chat/、common/、character/、world/、settings/
│     ├─ hooks/             # React hooks
│     ├─ stores/            # Zustand（只放介面偏好）
│     ├─ api/               # TavernApi、瀏覽器端資料與模型呼叫（browser-*.ts）、queries.ts
│     ├─ lib/               # 純函式工具
│     ├─ i18n/              # 介面文字（zh-TW.ts ＋ zh-TW/ 下的分頁文字）
│     └─ styles/            # tokens.css、global.css
└─ tests/fixtures/          # 測試用角色卡與世界書（自製）
```

### 5.2 放置原則

- 不碰 DOM、可在 Node 執行的邏輯 → `shared/`，並在旁邊寫測試。`web/` 只放介面與瀏覽器相關程式。
- 讀寫 IndexedDB／localStorage → 只能在 `web/src/api/browser-*.ts`（介面偏好在 `stores/ui-store.ts` 例外）。
- 供應商差異 → 只能在 `web/src/api/browser-llm.ts`。
- 顏色 → 只能在 `web/src/styles/tokens.css`。
- 介面文字 → 只能在 `web/src/i18n/zh-TW.ts` 與 `web/src/i18n/zh-TW/`。
- 範例角色卡與世界書 → `web/src/api/sample-data.ts`（App 內）與 `examples/`（可下載檔案），兩者內容一致。
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
| Prompt 組裝器 | 各層順序；五種世界書位置；依深度插入（角色備註、作者備註、@D）；超出預算時依規定順序裁切；必留層永遠保留 |
| 世界書引擎 | 中文關鍵字；AND／NOT 四種邏輯；常駐與停用；掃描深度（對）；機率；遞迴與兩種遞迴旗標；預算依「常駐＞關鍵字＞遞迴＞插入順序」取捨；格式互轉不掉欄位；舊資料搬移 |
| 角色卡 | PNG 與 JSON 往返後內容不變；未知欄位保留；V1／V3；變數替換；角色備註讀寫；撰寫檢查 |
| 模型轉接層 | 串流拼接；中途中止；API 錯誤時訊息不遺失（以 Playwright 攔截 OpenRouter 回應實測） |

測試素材放 `tests/fixtures/`，只用自製或明確可自由使用的內容。

---
---

# 第二部分｜目前執行狀況（隨進度更新）

> 最後更新：2026-11-04

## 7. 路線圖與目前階段

**目前階段：階段二（角色與世界書）——已依兩份寫卡指南重新設計並上線，待使用者驗收**

| 階段 | 內容 | 驗收條件 | 狀態 |
| --- | --- | --- | --- |
| 一 MVP | 設定頁與金鑰、串接 OpenRouter、串流對話、聊天紀錄存檔、套用角色卡 | 能與一張角色卡穩定串流聊天 | ✅ 2026-11-03 驗收 |
| 二 角色與世界書 | 角色卡匯入匯出（PNG／JSON）、角色編輯器與頭像、世界書條目與關鍵字觸發、Token 預算控制、全部資料備份還原；依寫卡指南的撰寫引導、角色備註、作者備註、世界書進階觸發；西幻範例 | 角色卡與世界書能匯入並正確觸發 | 🔄 待驗收 |
| 三 創作體驗 | 重新生成與分支、編輯任一則訊息、選擇其他開場白、完整 Prompt 預覽、自動摘要前情、故事續寫模式 | 長篇故事不遺忘前情，也不超長度 | ⏳ |
| 四 進階擴充 | 多組模型設定、群組聊天、瀏覽器端向量記憶、語音、角色圖片庫、PWA 離線安裝、跨裝置同步（使用者自選雲端） | 依需要逐項驗收 | ⏳ |

### 7.1 演進歷程

```
11/03 初版 ─► 伺服器版（Hono + SQLite）＋ 展示版（預錄回覆）
        └─► 使用者選擇瀏覽器模式：GitHub Pages 上用自己的金鑰真實聊天
              └─► 階段一驗收 ✅
                    └─► 刪除伺服器版，只保留網頁（HTML-only）＋ 階段二功能
                          └─► 11/04 依「PLists + Ali:Chat」與「世界書」兩份指南重新設計撰寫與觸發規則 ＋ 西幻範例 ◄ 目前
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
   │    ├─ browser-api.ts     組合以下模組＋對話、設定、作者備註、加入範例
   │    ├─ browser-characters.ts / browser-worlds.ts / browser-backup.ts  角色、世界書、備份
   │    ├─ browser-chat.ts    一次對話（§4.1 的七個步驟）
   │    ├─ browser-llm.ts     OpenRouter／OpenAI 相容串流（模型轉接層）
   │    ├─ browser-store.ts   記憶體中的資料、ID、頭像 URL、金鑰讀寫
   │    ├─ browser-db.ts      IndexedDB 讀寫、版本升級、舊 localStorage 資料搬移
   │    ├─ browser-images.ts  頭像轉 PNG、無圖時產生卡圖
   │    ├─ browser-util.ts    共用小工具
   │    └─ sample-data.ts     範例：莉瑟爾＋艾瑞斯塔王國（西幻）、阿暖
   │
   ├─ shared/src/（純邏輯，Vitest 測試）
   │    ├─ prompt-assembler.ts  組裝與裁切
   │    ├─ world-engine.ts      關鍵字掃描（AND／NOT、機率、遞迴）、總體參數、預算取捨
   │    ├─ world-info.ts        世界書型別、條目選項（readEntry／writeEntry）、SillyTavern ⇄ character_book 轉換、舊資料搬移
   │    ├─ card-writing.ts      角色備註（depth_prompt）讀寫、撰寫檢查、永久／臨時 token
   │    ├─ card.ts / card-io.ts / card-png.ts  角色卡正規化、檔案匯入匯出、PNG chunk
   │    └─ text.ts              變數替換、Token 估算
   │
   ├──► IndexedDB「tavern」：state（全部資料，BrowserState v3）、blobs（頭像）
   ├──► localStorage：tavern-openrouter-key（金鑰）、tavern-ui-prefs（主題／閱讀模式）
   └──► https://openrouter.ai（CSP 唯一允許的外部連線）
```

**參數現值**：預設模型 `deepseek/deepseek-chat-v3-0324`、上下文 8192、單次回覆 600、溫度 0.9、Top P 0.95；每日生成上限 300 次；世界書總體參數：掃描深度 2 對、上下文 25%、預算上限 0、遞迴開、全字匹配關；角色備註與作者備註預設深度 4、作者備註頻率 1；Token 估算：中日韓字約 1 token／字，其他約 3.5 字元／token。

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

### 階段二追加：依寫卡指南重新設計（2026-11-04，待驗收）
- **Prompt**：依深度插入（角色備註＝PList、每段對話的作者備註、世界書 @D）；世界書五種插入位置；使用者的角色描述。
- **世界書觸發**：AND／NOT 四種邏輯、觸發機率、遞迴掃描與兩種遞迴旗標；總體參數移到設定頁（掃描深度以「對」計、上下文百分比、預算上限、全字匹配）；預算依「常駐＞關鍵字＞遞迴＞插入順序」取捨。
- **撰寫引導**：角色編輯器依「描述（Ali:Chat）→ 角色備註（PList）→ 第一條訊息」排列，附模板、永久／臨時標籤與 token 數、即時撰寫檢查、寫卡指南；世界書編輯器的條目清單依提示順序排列並標示位置與順序，附世界書指南。
- **範例**：西幻角色卡「莉瑟爾」＋ 14 條目世界書「艾瑞斯塔王國」（新安裝自動建立；「加入西幻範例」按鈕；`examples/` 可下載 PNG／JSON）。

## 10. 最近一次改動的重點（2026-11-04：依寫卡指南重新設計）

1. **依據**：使用者提供的兩份 PDF——《PLists + Ali:Chat 寫作指南》與《世界書》教學；與舊設計衝突處一律依指南修改（使用者指示）。
2. **Prompt 組裝（`shared/src/prompt-assembler.ts`）**：改為「系統＋世界書前＋角色＋世界書後＋使用者角色描述 → 對話範例 → 聊天（中間依深度插入）→ 收尾指令」；新增 `DepthNote`（角色備註、作者備註），世界書片段加 `depth`、`rank`，報告新增 `notes`。
3. **世界書（`world-info.ts`、`world-engine.ts`）**：條目選項改存在與 SillyTavern 相同的 `extensions` 鍵；`readEntry`／`writeEntry`；AND／NOT、機率、遞迴、全字匹配；總體參數 `WorldActivationSettings`；預算排序 `rankOf`；`WorldBook` 移除 `scan_depth`、`token_budget`（保留在 `extra`）；`migrateEntry` 搬移舊資料。介面拿掉「優先度」。
4. **角色卡撰寫（`card-writing.ts`）**：角色備註＝`extensions.depth_prompt`；`lintCard` 七項檢查；`cardTokens` 永久／臨時統計。
5. **型別（`shared/src/api.ts`）**：`AuthorNote`、`ChatDetail.author_note`、`AppSettings.user_persona`／`world`、`PromptInfo.notes`。
6. **儲存（`browser-db.ts`）**：`BrowserState` v3；`upgrade()` 依序 v1 → v2 → v3，備份還原也走同一條路。
7. **API 拆檔**：`browser-api.ts` 拆成 `browser-characters.ts`、`browser-worlds.ts`、`browser-backup.ts`、`browser-util.ts`；新增 `updateAuthorNote`、`addFantasyExample`；供應商預設值移到 `browser-llm.ts`。
8. **介面**：`CharacterEditPage`（重排＋`TextBlock`＋`WritingAside`）、`EntryEditor`（狀態、邏輯、五種位置、深度、機率、遞迴旗標）、`WorldEditPage`（三欄＋指南）、設定頁（使用者角色描述、世界書觸發設定；拆成 `components/settings/`）、聊天頁（作者備註對話框、預算計顯示備註）、`GuidePanel`、`ExampleButton`。
9. **i18n**：補齊資料層與相對時間的文字；指南、模板、檢查訊息；拆出 `i18n/zh-TW/editor.ts`、`worlds.ts`。
10. **範例**：`sample-data.ts` 與 `examples/`（PNG 卡圖為自繪 SVG 轉出），內容通過 `lintCard`；調整關鍵字避免與地名重疊（例如不用「斷劍」以免誤中「斷劍酒館」），背景條目關閉遞迴觸發避免連鎖。
11. **驗證**：核心單元測試 40 項通過（新增 `card-writing.test.ts`，改寫 `world-engine.test.ts`、`prompt-assembler.test.ts`）；CI 通過；以 Playwright 對部署版本實測：新安裝範例、撰寫檢查、條目排序、作者備註、Prompt 版面（角色備註／常駐 @4／作者備註區塊位置）、加入範例（含卡圖頭像）、v2 備份還原升級、深色模式。

## 10.1 前一次改動（2026-11-03：HTML-only ＋ 階段二）

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
| 清除瀏覽器資料、換電腦導致遺失 | 設定頁備份還原；多處提醒；無痕模式警告 | 已實作；尚無自動備份提醒 |
| 金鑰在瀏覽器被竊取（XSS） | CSP 限制腳本與連線、不渲染 HTML、匯入內容只當純文字、建議金鑰設額度上限 | 已實作 |
| 舊金鑰留在 git 歷史 | 使用者撤銷舊金鑰；必要時改寫歷史（需同意） | 待使用者確認（§13） |
| Prompt 超出模型上下文 | 依 §4.1 順序裁切並回報 | 已實作 |
| 世界書遞迴連鎖、觸發過多浪費預算 | 遞迴最多 3 層；`prevent_recursion`／`exclude_recursion`；預算取捨與預算計顯示略過數量；範例示範背景條目關閉遞迴 | 已實作 |
| 關鍵字過短或與名稱重疊造成誤觸發 | 指南與範例示範具體關鍵字（例：不用「斷劍」以免誤中「斷劍酒館」）；預算計列出觸發條目以便除錯 | 持續注意 |
| 撰寫檢查為啟發式，可能誤報／漏報 | 只做建議、不阻擋；訊息說明原因 | 已實作 |
| 掃描深度以「對」計算（依指南），與 SillyTavern 實作（以「則」計）不同 | 設定頁說明清楚；匯入的世界書不套用自帶的掃描深度（保留在 `extra`） | 已實作；見 §13 |
| Token 估算與實際模型不同 | 估算偏保守、上下文設定保守、以供應商回報為準 | 已實作 |
| API 費用失控 | 每日 300 次上限、顯示用量、限制單次輸出、建議金鑰額度 | 已實作 |
| 角色卡／世界書格式不相容 | 保留未知欄位；V1／V2／V3；條目選項使用 SillyTavern 相同鍵名；雙向轉換有測試 | 已實作；尚未用大量真實社群卡測試 |
| IndexedDB 容量或瀏覽器清理 | 頭像上限 8 MB／張；備份 | 尚未申請 `navigator.storage.persist()` |
| 長篇故事遺忘前情 | 世界書、角色備註與作者備註持續提醒；階段三自動摘要 | 部分；摘要在階段三 |
| 範圍失控、變成重寫 SillyTavern | 嚴守階段範圍，新功能先對照路線圖 | 持續 |

## 12. 接下來的進行方向

1. **使用者驗收階段二**：
   - 在「角色」或「世界書」頁按「加入西幻範例」（或匯入 `examples/` 的檔案），打開角色編輯器看撰寫檢查與指南。
   - 跟莉瑟爾聊幾句，提到「灰燼森林」「王冠被偷」，點開預算計確認觸發條目與「角色備註 @4」。
   - 試著設定作者備註、匯入自己常用的 SillyTavern 角色卡與世界書。
   - 通過後把 §7 更新為「階段二 ✅」。
2. **階段三（驗收後開始），建議順序**：
   1. 重新生成與編輯訊息（利用既有的 `parent_id`，先做線性版本，再做分支切換）。
   2. 開新對話時選擇其他開場白（`alternate_greetings` 已能編輯與保存）。
   3. 完整 Prompt 預覽（把預算計展開成實際送出的每則訊息，方便對照 §4.1 的版面）。
   4. 故事續寫模式（讓角色接著上一則繼續寫）。
   5. 自動摘要前情（**會增加 API 費用，須先取得同意**；摘要可寫進作者備註或常駐 @D 條目，沿用現有的深度插入機制）。
3. 階段四依使用者需要挑選（群組聊天時再實作世界書的「篩選／排除角色」）。

## 13. 待確認事項

- [ ] **舊金鑰**：2026-11-03 曾把含金鑰的 `.env` 上傳到公開 repo（已刪除檔案，但仍在 git 歷史）。使用者是否已在 OpenRouter 撤銷？是否要改寫 git 歷史清除（不可復原，需同意）？
- [ ] **階段二驗收結果**。
- [ ] **掃描深度的單位**：目前依指南以「對」計（1 = 最新訊息＋角色最近一則回覆）。SillyTavern 實際以「則」計；若使用者希望與 SillyTavern 完全一致，需改為以則計（影響 §4.4 與設定頁說明）。
- [ ] **預設模型 ID**：目前 `deepseek/deepseek-chat-v3-0324`，是否改為使用者常用的模型？
- [ ] **自動摘要（階段三）**：可接受的額外 API 費用與觸發頻率。
- [ ] **是否申請持久化儲存**（`navigator.storage.persist()`，降低瀏覽器自動清除資料的機率；部分瀏覽器會跳出詢問）。

## 14. 守則遵守確認

### 14.1 交付前檢查表（每次修改都要逐項確認）

- [ ] 只做目前階段範圍內的事；跨階段或屬於 §6.3 的事項已取得同意。
- [ ] 沒有任何金鑰、密碼、`.env` 進入程式碼、commit 或備份。
- [ ] 沒有新增對外連線；CSP 未放寬。
- [ ] 沒有使用 `dangerouslySetInnerHTML`；匯入內容只當純文字。
- [ ] 新增的介面文字都在 `i18n/`；新增的顏色都在 `tokens.css`。
- [ ] 角色卡／世界書相關的範例、模板、提示、檢查符合 §4.2／§4.3 的撰寫守則；範例通過 `lintCard`。
- [ ] Prompt 版面與觸發行為符合 §4.1／§4.3／§4.4，並有測試涵蓋。
- [ ] 儲存結構有變時，已提高 `version` 並寫好 `upgrade()`；備份可讀舊版。
- [ ] 匯入匯出未丟失未知欄位（有測試涵蓋）。
- [ ] 破壞性操作有 `ConfirmDialog`。
- [ ] 新元件有載入中／錯誤／空狀態，深淺色與窄螢幕都看過。
- [ ] 單一檔案未超過約 300 行（或已拆分）。
- [ ] CI 全部通過，並以瀏覽器實際操作驗證。
- [ ] 已更新第二部分（進度、改動）與第三部分（風險、方向、待確認）。

### 14.2 目前程式碼的遵守情況（2026-11-04 掃描結果）

| 守則 | 結果 | 說明 |
| --- | --- | --- |
| 金鑰不進 repo／備份 | ✅ | 目前檔案中沒有金鑰；備份經實測不含金鑰。**歷史紀錄中仍有舊金鑰**（§13）。 |
| CSP 只允許 OpenRouter | ✅ | `web/vite.config.ts` 注入；範例卡圖為同源檔案。 |
| 不用 `dangerouslySetInnerHTML`／`any`／原生 `confirm()` | ✅ | 0 處。 |
| 資料存取只在 `api/browser-*.ts` | ✅ | 頁面與元件未直接讀寫 IndexedDB／localStorage。 |
| 介面文字只在 i18n | ✅ | 上次的落差已修正（資料層錯誤訊息、預設文字、相對時間都移入 i18n）。 |
| 單檔約 300 行以內 | ✅ | 上次的 `browser-api.ts` 已拆分；目前最大的是 `world-info.ts`（約 295 行）與 `CharacterEditPage.tsx`（約 290 行），接近上限，再擴充時要拆。 |
| 供應商差異只在 `browser-llm.ts` | ✅ | 預設位址、模型、取得金鑰網址已移入；其餘提到 OpenRouter 的只有介面文字與 `provider` 型別值。 |
| 顏色只在 tokens | ⚠️ | `browser-images.ts` 仍有兩個備援色碼（讀不到 CSS 變數時才用於產生卡圖），可接受。 |
| 寫卡守則（§4.2／§4.3） | ✅ | 範例兩張卡 `lintCard` 無警告；PList 在角色備註深度 4；世界書示範五種位置、AND／NOT、機率、遞迴與常駐 @D。 |
| 重點功能測試 | ✅ | 40 項單元測試；模型轉接層與整體流程以 Playwright 對部署版本實測。 |
