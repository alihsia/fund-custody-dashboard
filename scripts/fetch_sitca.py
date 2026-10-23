"""抓取中華民國證券投資信託暨顧問商業同業公會 (SITCA, sitca.org.tw) 的 4 份公開查詢表。

這 4 個頁面都是傳統 ASP.NET WebForms（__VIEWSTATE/__EVENTVALIDATION postback）。
點擊「查詢」按鈕時瀏覽器會把整個表單（含隱藏欄位）POST 回同一個 URL，
回應內容就是重新 render 的整頁 HTML，資料表格直接內嵌在其中一個 <table> 裡
（不是另外呼叫 AJAX API）。

已知的關鍵眉角：
  - 表1頁面 (IN2201.aspx) 有一個隱藏的 radio group
    `ctl00$ContentPlaceHolder1$rdo1`，瀏覽器預設勾選 value="rbComid"。
    若 POST 時漏了這個欄位，伺服器會把請求當成一般重新整理處理，
    回傳的頁面不含資料表格（表格列數只有個位數）。
  - 資料列一律用「儲存格數量」而非內容樣式來篩選：小計列／總計列的儲存格數量
    比資料列少，用 len(cells) == 預期欄位數 就能乾淨濾掉。
"""
import os
import random
import re
import time
from datetime import date

import requests
from bs4 import BeautifulSoup

BASE = "https://www.sitca.org.tw/ROC/Industry"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
TIMEOUT = 30
MAX_RETRIES = 4


class FetchError(RuntimeError):
    pass


def _request(method, url, session, **kwargs):
    last_exc = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            r = session.request(method, url, timeout=TIMEOUT, **kwargs)
            r.raise_for_status()
            return r
        except (requests.RequestException,) as exc:
            last_exc = exc
            if attempt < MAX_RETRIES:
                time.sleep(2 ** attempt + random.uniform(0, 1))
    raise FetchError(f"{method} {url} failed after {MAX_RETRIES} attempts: {last_exc}")


def new_session():
    s = requests.Session()
    s.headers.update({
        "User-Agent": UA,
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
    })
    return s


def _save_raw(name, text):
    """除錯用：若設定了 SITCA_RAW_DIR 環境變數，把原始回應存下來。"""
    raw_dir = os.environ.get("SITCA_RAW_DIR")
    if not raw_dir:
        return
    os.makedirs(raw_dir, exist_ok=True)
    with open(os.path.join(raw_dir, name), "w", encoding="utf-8") as f:
        f.write(text)


def _hidden_fields(soup):
    data = {}
    for inp in soup.find_all("input"):
        name = inp.get("name")
        if name and name.startswith("__"):
            data[name] = inp.get("value", "")
    return data


def _select_options(soup, name):
    sel = soup.find("select", {"name": name})
    if sel is None:
        raise FetchError(f"select {name} not found")
    return [(o.get("value", ""), o.text.strip()) for o in sel.find_all("option")]


_FUND_ID_RE = re.compile(r"^\d{8}")


def _rows_of(soup, table_id, ncols, id_col):
    """取出資料列：儲存格數對且 id_col 欄位長得像 8 碼基金統編開頭。

    光靠儲存格數量篩選不夠：表頭因 rowspan/colspan 層層疊加文字，
    恰好也會湊出跟資料列一樣的儲存格數，需要再用基金統編欄位的內容形狀擋掉。
    """
    table = soup.find("table", {"id": table_id})
    if table is None:
        raise FetchError(f"table id={table_id} not found in response")
    out = []
    for tr in table.find_all("tr"):
        cells = [c.get_text(strip=True) for c in tr.find_all(["td", "th"])]
        if len(cells) == ncols and _FUND_ID_RE.match(cells[id_col]):
            out.append(cells)
    return out


def latest_year_month(session):
    """從表1頁面的年月下拉選單取得最新一期（最後一個 option）。"""
    url = f"{BASE}/IN2201.aspx?pid=IN2221_01"
    r = _request("GET", url, session)
    soup = BeautifulSoup(r.text, "html.parser")
    opts = _select_options(soup, "ctl00$ContentPlaceHolder1$ddlQ_YM")
    opts = [o for o in opts if o[0]]
    if not opts:
        raise FetchError("ddlQ_YM has no options")
    ym_value, ym_label = opts[-1]
    return ym_value, ym_label


def fetch_table1(session, ym):
    """基金規模（對應「第一張表.xls」）。回傳 (rows, company_map)。

    rows: 每列 18 個儲存格，欄位依序為
      類型代號,基金統編,基金名稱,類別,計價幣別,基金規模(台幣),基金規模(原幣),
      市占率,單位淨值(台幣),單位淨值(原幣),受益權單位數,自然人受益人數,
      法人受益人數,總受益人數,本月申購(台幣),本月申購(原幣),本月買回(台幣),本月買回(原幣)
    company_map: {經理公司代號: 公司中文全名}，取自頁面「公司」下拉選單。
    """
    url = f"{BASE}/IN2201.aspx?pid=IN2221_01"
    r = _request("GET", url, session)
    soup = BeautifulSoup(r.text, "html.parser")

    company_map = {}
    for value, label in _select_options(soup, "ctl00$ContentPlaceHolder1$ddlQ_Comid"):
        if value:
            name = label.split(" ", 1)[1].strip() if " " in label else label
            company_map[value] = name

    data = _hidden_fields(soup)
    data.update({
        "ctl00$ContentPlaceHolder1$ddlQ_YM": ym,
        "ctl00$ContentPlaceHolder1$ddlQ_COLUMN": "1",
        "ctl00$ContentPlaceHolder1$rdo1": "rbComid",
        "ctl00$ContentPlaceHolder1$ddlQ_Comid": "",
        "ctl00$ContentPlaceHolder1$ddlQ_CLASS": "0",
        "ctl00$ContentPlaceHolder1$ddlQ_CURRENCY": "",
        "ctl00$ContentPlaceHolder1$BtnQuery": "查詢",
    })
    r2 = _request("POST", url, session, data=data, headers={"Referer": url})
    _save_raw("t1.html", r2.text)
    soup2 = BeautifulSoup(r2.text, "html.parser")
    rows = []
    for table in soup2.find_all("table"):
        if table.get("id") is None and len(table.find_all("tr")) > 100:
            for tr in table.find_all("tr"):
                cells = [c.get_text(strip=True) for c in tr.find_all(["td", "th"])]
                if len(cells) == 18 and _FUND_ID_RE.match(cells[1]):
                    rows.append(cells)
            break
    return rows, company_map


def _fetch_table2_page(session, ym, column, table_id, ncols, id_col=1):
    url = f"{BASE}/IN2105.aspx?pid=IN2212_02"
    r = _request("GET", url, session)
    soup = BeautifulSoup(r.text, "html.parser")
    data = _hidden_fields(soup)
    data.update({
        "ctl00$ContentPlaceHolder1$ddlQ_YYYYMM": ym,
        "ctl00$ContentPlaceHolder1$ddlQ_Column": column,
        "ctl00$ContentPlaceHolder1$ddlQ_Comid": "",
        "ctl00$ContentPlaceHolder1$ddlQ_FundNo": "",
        "ctl00$ContentPlaceHolder1$txtQ_KeyWord": "",
        "ctl00$ContentPlaceHolder1$BtnQuery": "查詢",
    })
    r2 = _request("POST", url, session, data=data, headers={"Referer": url})
    _save_raw(f"t{'2' if column == '1' else '3'}.html", r2.text)
    soup2 = BeautifulSoup(r2.text, "html.parser")
    return _rows_of(soup2, table_id, ncols, id_col)


def fetch_table2(session, ym):
    """基本資料（對應「第二張表.xls」），表現欄位＝標準。23 欄。"""
    return _fetch_table2_page(session, ym, "1", "ctl00_ContentPlaceHolder1_Table1", 23)


def fetch_table3(session, ym):
    """費率與保管銀行（對應「3rd.xls」），表現欄位＝費率、銀行與規定。14 欄。"""
    return _fetch_table2_page(session, ym, "2", "ctl00_ContentPlaceHolder1_Table2", 14)


def fetch_table4(session):
    """基金成立事件（對應「4th.xls」）。日期起固定 1950-01-01，取完整歷史。6 欄。"""
    url = f"{BASE}/IN2104.aspx?pid=IN2213_01"
    r = _request("GET", url, session)
    soup = BeautifulSoup(r.text, "html.parser")
    data = _hidden_fields(soup)
    data.update({
        "ctl00$ContentPlaceHolder1$ddlQ_Comid": "",
        "ctl00$ContentPlaceHolder1$ddlQ_FundNo": "",
        "ctl00$ContentPlaceHolder1$txtQ_SDate": "19500101",
        "ctl00$ContentPlaceHolder1$txtQ_EDate": date.today().strftime("%Y%m%d"),
        "ctl00$ContentPlaceHolder1$ddlQ_Type": "1",
        "ctl00$ContentPlaceHolder1$txtQ_Keyword": "",
        "ctl00$ContentPlaceHolder1$BtnQuery": "查詢",
    })
    r2 = _request("POST", url, session, data=data, headers={"Referer": url})
    _save_raw("t4.html", r2.text)
    soup2 = BeautifulSoup(r2.text, "html.parser")
    return _rows_of(soup2, "ctl00_ContentPlaceHolder1_Table1", 6, id_col=0)


def fetch_all():
    """抓取全部 4 張表，回傳 dict。任何一張表資料量異常過低就拋出 FetchError。"""
    session = new_session()
    ym, ym_label = latest_year_month(session)

    t1, company_map = fetch_table1(session, ym)
    if len(t1) < 2000:
        raise FetchError(f"table1 rows too low: {len(t1)}")
    if len(company_map) < 20:
        raise FetchError(f"company_map too small: {len(company_map)}")

    t2 = fetch_table2(session, ym)
    if len(t2) < 2000:
        raise FetchError(f"table2 rows too low: {len(t2)}")

    t3 = fetch_table3(session, ym)
    if len(t3) < 2000:
        raise FetchError(f"table3 rows too low: {len(t3)}")

    t4 = fetch_table4(session)
    if len(t4) < 1000:
        raise FetchError(f"table4 rows too low: {len(t4)}")

    return {
        "ym": ym,
        "ym_label": ym_label,
        "company_map": company_map,
        "t1": t1,
        "t2": t2,
        "t3": t3,
        "t4": t4,
    }


if __name__ == "__main__":
    import json
    import sys

    result = fetch_all()
    print(
        f"ym={result['ym']} t1={len(result['t1'])} t2={len(result['t2'])} "
        f"t3={len(result['t3'])} t4={len(result['t4'])} companies={len(result['company_map'])}",
        file=sys.stderr,
    )
    json.dump(result, sys.stdout, ensure_ascii=False)
