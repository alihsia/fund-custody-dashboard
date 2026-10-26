"""抓取 SITCA 最新資料 → 分類整理 → 套進 template.html/logic.js → 產生 docs/index.html。

防呆：解析後若基金檔數過低或總規模為 0，視為抓取失敗，以非 0 狀態結束，
不寫入 docs/，避免壞資料覆蓋掉已發布的頁面（由呼叫端 workflow 決定要不要 commit）。
"""
import json
import os
import re
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(__file__))

from classify import build_funds  # noqa: E402
from fetch_sitca import FetchError, fetch_all  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_DIR = os.path.join(ROOT, "docs")

MIN_FUNDS = 500


def month_end(ym):
    """ym 形如 '202609' -> '2026-09-30'（當月最後一天）。"""
    y, m = int(ym[:4]), int(ym[4:6])
    if m == 12:
        nxt = date(y + 1, 1, 1)
    else:
        nxt = date(y, m + 1, 1)
    last_day = nxt - timedelta(days=1)
    return last_day.isoformat()


def build():
    raw = fetch_all()
    funds = build_funds(raw["t1"], raw["t2"], raw["t3"], raw["company_map"])

    total_aum = sum(f["a"] for f in funds)
    if len(funds) < MIN_FUNDS:
        raise FetchError(f"解析後基金檔數過低：{len(funds)} < {MIN_FUNDS}，判定抓取失敗")
    if total_aum <= 0:
        raise FetchError("解析後總規模為 0，判定抓取失敗")

    ym = raw["ym"]
    today = date.today().isoformat()
    meta = {
        "dataMonth": f"{ym[:4]}/{ym[4:6]}",
        "aumAsOf": month_end(ym),
        "pageGenerated": today,
    }

    os.makedirs(DOCS_DIR, exist_ok=True)

    data_json_path = os.path.join(DOCS_DIR, "data.json")
    with open(data_json_path, "w", encoding="utf-8") as f:
        json.dump({"meta": meta, "funds": funds}, f, ensure_ascii=False)

    with open(os.path.join(ROOT, "template.html"), encoding="utf-8") as f:
        template = f.read()
    with open(os.path.join(ROOT, "logic.js"), encoding="utf-8") as f:
        logic = f.read()

    logic = logic.replace("__META_DATA_MONTH__", meta["dataMonth"])
    logic = logic.replace("__META_AUM_AS_OF__", meta["aumAsOf"])
    logic = logic.replace("__META_PAGE_GENERATED__", meta["pageGenerated"])

    fund_data_json = json.dumps(funds, ensure_ascii=False)
    # </script> 不可能出現在合法 JSON 字串裡，但資料來源是外部網站，保守起見還是轉義一下。
    fund_data_json = fund_data_json.replace("</script>", "<\\/script>")

    html = template.replace("__FUND_DATA__", fund_data_json)
    html = html.replace("__JS_LOGIC__", logic)

    with open(os.path.join(DOCS_DIR, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)

    print(
        f"OK: {len(funds)} funds, total AUM {total_aum:,} TWD, "
        f"data month {meta['dataMonth']}, {len(raw['company_map'])} companies, "
        f"{len(set(f['cu'] for f in funds if f['cu']))} custodians",
        file=sys.stderr,
    )
    return meta, funds


if __name__ == "__main__":
    try:
        build()
    except FetchError as e:
        print(f"FETCH FAILED: {e}", file=sys.stderr)
        sys.exit(1)
