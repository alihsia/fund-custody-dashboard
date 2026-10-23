# 基金保管市場看板

自動追蹤台灣境內基金的保管銀行市占、新案流向與產品類型分布。

## 資料來源

[中華民國證券投資信託暨顧問商業同業公會（SITCA）](https://www.sitca.org.tw/) 公開查詢頁面：

- 基金規模彙總表（`IN2201.aspx`）
- 基金基本資料／費率與保管銀行（`IN2105.aspx`）
- 基金成立事件（`IN2104.aspx`）

同一基金的不同級別合併計為 1 檔；基金規模以新台幣計（含外幣基金折合）。本頁僅整理公開資料，**不構成投資建議**。

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
```
