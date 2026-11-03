# 2026-11-03 GitHub Pages 瀏覽器模式

## 決定

GitHub Pages 上的網站從「預錄回覆的展示版」改為可實際使用的**瀏覽器模式**：
使用者在網頁的設定頁輸入自己的 OpenRouter 金鑰，對話直接從瀏覽器送到 OpenRouter，
角色與聊天紀錄存在該瀏覽器的 localStorage。自架伺服器模式保留不變。

## 原因

使用者希望不用在電腦上開終端機，直接從 GitHub 打開網頁就能測試與使用。
GitHub Pages 只能放靜態檔案，無法執行後端，所以金鑰只能放在瀏覽器裡。
選項比較（使用者於 2026-11-03 選擇瀏覽器模式）：

| 選項 | 優點 | 缺點 |
| --- | --- | --- |
| 瀏覽器模式（採用） | 打開網址就能用，不需安裝 | 金鑰存在瀏覽器；資料只在該瀏覽器 |
| GitHub Codespaces | 金鑰仍在伺服器端 | 每次要開雲端環境，有免費時數上限 |

## 對「金鑰只存在後端」鐵則的例外與防護

- 金鑰只存在使用者自己瀏覽器的 localStorage（`tavern-openrouter-key`），**不進 repo、不進建置產物、不送往 OpenRouter 以外的任何地方**。
- 瀏覽器模式的建置注入 Content-Security-Policy：只允許本站腳本，網路連線只允許本站與 `https://openrouter.ai`，降低 XSS 竊取金鑰的風險；`referrer` 設為 `no-referrer`。
- 介面文字一律以 React 轉義輸出，不使用 `dangerouslySetInnerHTML`。
- 建議使用者在 OpenRouter 建立專用金鑰並設定額度上限；另有每日 300 次的生成上限。

## 影響

- Prompt 組裝器與文字工具移到 `shared/`，伺服器與瀏覽器模式共用同一套邏輯。
- 瀏覽器模式的模型轉接在 `web/src/api/browser-llm.ts`（`server/src/providers/` 的對應物）。
- Token 在瀏覽器中以 `estimateTokens` 估算（不下載 tokenizer）。
- 資料僅存在單一瀏覽器，清除瀏覽器資料即遺失；備份匯出列為後續工作。
