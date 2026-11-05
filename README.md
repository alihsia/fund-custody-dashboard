# 基金保管市場看板

自動追蹤台灣境內基金的保管銀行市占、新案流向與產品類型分布。

## 資料來源

[中華民國證券投資信託暨顧問商業同業公會（SITCA）](https://www.sitca.org.tw/) 公開查詢頁面：

- 基金規模彙總表（`IN2201.aspx`）
- 基金基本資料／費率與保管銀行（`IN2105.aspx`）
- 基金成立事件（`IN2104.aspx`）

同一基金的不同級別合併計為 1 檔；基金規模以新台幣計（含外幣基金折合）。本頁僅整理公開資料，**不構成投資建議**。

## 手機 App 版

`docs/app/` 是手機版介面（PWA），網址為 `/app/`。直接讀取同一份 `docs/data.json`，所以每週自動更新後 App 版也會同步，不需要另外建置。

- 5 個分頁：總覽、結構、新案、往來、查詢；新案競爭力與桌機版第 06 區同一算法（近 3 個年度、應拿＝現有市占 × 新案總量）
- 可「加入主畫面」安裝；service worker 會快取最近一次資料，離線也能開啟
- 修改 `docs/app/` 內的檔案後，記得把 `sw.js` 裡的 `CACHE` 版本號加一，已安裝的手機才會換新版

## 自動更新

`.github/workflows/update-data.yml` 每週一（台北時間早上）自動執行 `scripts/build_dashboard.py`，重新抓取公會最新資料並重新產生 `docs/index.html`。也可以在 GitHub Actions 頁面手動觸發（workflow_dispatch）。

若該次抓取到的基金檔數或總規模異常過低（判定為公會網站改版或暫時性錯誤），workflow 會直接失敗並**不會 commit**，已發布的頁面保持不變。每次執行的原始 HTML 回應另外存成 workflow artifact（保留 7 天），方便排查。

## 本機開發

```bash
pip install -r requirements.txt
python scripts/build_dashboard.py   # 產生 docs/index.html, docs/data.json
```

## 檔案結構

```
scripts/fetch_sitca.py     抓取 4 個公會查詢頁
scripts/classify.py        基金分類、保管銀行/公司整理
scripts/build_dashboard.py 組裝 docs/index.html
template.html / logic.js   前端版面與互動邏輯
docs/                      GitHub Pages 服務的輸出目錄
docs/app/                  手機 App 版（PWA，讀 docs/data.json）
```
