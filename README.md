# 報修登記系統
提供報修需求登記與查閱共用報修清單的功能。

[報修欄位表與範例資料](文件/報修欄位表.xlsx)

## 網頁前端

首頁為根目錄 `index.html`，樣式與行為分別在 `style.css`、`app.js`；`config.js` 只有 Supabase 專案網址與公開 publishable key。透過 CDN 載入 supabase-js v2，無須建置。

請先在 Supabase 部署 `supabase/schema.sql`，確認 RLS 與 anon 權限。前端只新增 reporter_name、location、category、description、urgency；status 與 created_at 由資料庫產生。清單公開讀取最新 20 筆，時間以台北時區顯示。請僅使用虛構資料。

本機啟動（在儲存庫根目錄）：

```sh
python3 -m http.server 8000
```

開啟 http://localhost:8000 。GitHub Pages 請設定 Settings → Pages → Deploy from a branch → main → / (root)，預期網址為 https://trrtms46m7-cloud.github.io/Daya/ 。

## 驗證

語法與空白檢查：

```sh
node --check app.js
node --check config.js
git diff --check
```

瀏覽器測試位於 `tests/frontend.cjs`，使用真正的 SDK 與模擬 API，不會新增真實資料。需有 Node.js、Playwright、`/usr/bin/chromium`，並先啟動上述 8000 埠伺服器：

```sh
npm install --no-save --package-lock=false playwright
curl -fsS 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js' -o /tmp/supabase.js
node tests/frontend.cjs
```

測試涵蓋手機與桌面無水平溢出、五欄位新增（不含 status）、排序與 20 筆限制、成功訊息、讀取失敗重試、送出失敗保留內容與安全文字顯示。畫面截圖：

![手機版](docs/repair-mobile.png)

![桌面版](docs/repair-desktop.png)

本次環境的網路政策阻擋 Supabase 網域，因此尚未驗證實際資料庫新增、讀取及 RLS。正式使用前，以虛構資料送出並確認清單中的自動時間與「待處理」狀態；使用公開 client 檢查 INSERT/SELECT 可用，UPDATE/DELETE 被拒。請勿將 secret 或 service_role 金鑰放進前端。
