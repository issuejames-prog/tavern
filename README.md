# Tavern · 慢慢來的酒館

只給自己用的輕量版 SillyTavern：打開網頁、貼上你的 OpenRouter 金鑰，就能跟角色慢慢聊天、寫故事。
**不用安裝、不用伺服器**，所有資料都留在你自己的瀏覽器裡。

👉 **<https://issuejames-prog.github.io/tavern/>**

## 開始使用

1. 打開上面的網址，到「設定」貼上你的 [OpenRouter 金鑰](https://openrouter.ai/keys)。
2. 回到大廳選一個角色，按「開始對話」。

建議在 OpenRouter 建立一把**專用金鑰並設定額度上限**。

## 功能

- **串流對話**：逐字顯示、可隨時停下，送出的訊息不會因錯誤而遺失。
- **角色卡**：匯入／匯出 SillyTavern 的 PNG 與 JSON 角色卡（V1／V2／V3），可拖曳檔案匯入；角色頭像、其他開場白等欄位。
- **世界書**：關鍵字觸發的設定集（地名、人物、規則…），支援次要關鍵字、常駐、優先度、Token 預算；可匯入 SillyTavern 世界書或角色卡內嵌的世界書。
- **Token 預算**：聊天頁顯示這次送給模型的內容用了多少空間、觸發了哪些世界書條目。
- **備份與還原**：在「設定」一鍵匯出全部資料（不含金鑰）。

## 資料與隱私

- 金鑰只存在你的瀏覽器，只會送到 OpenRouter；網頁以 Content-Security-Policy 限制只能連線到 OpenRouter。
- 角色、對話、世界書存在瀏覽器的 IndexedDB。**清除瀏覽器資料、換瀏覽器或換電腦就看不到原本的內容**，記得定期匯出備份。
- ⚠️ **千萬不要把金鑰或含金鑰的檔案放進 GitHub repo**——repo 是公開的。

## 開發

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 核心邏輯單元測試（Prompt 組裝、世界書、角色卡）
npm run typecheck
npm run build      # 輸出到 web/dist
```

推到 `main` 後，GitHub Actions 會自動建置並發布到 GitHub Pages（`gh-pages` 分支）。

```
shared/   核心邏輯（純 TypeScript）：Prompt 組裝、世界書引擎、角色卡 PNG／JSON
web/      React 網頁：頁面、元件、瀏覽器端資料（IndexedDB）與 OpenRouter 串流
```

路線圖與開發規範見 [CLAUDE.md](./CLAUDE.md)。
