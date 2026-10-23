"""把 fetch_sitca.py 抓回的 4 張表 (t1~t4 原始列) 整理成 dashboard 要用的 funds 清單。

分類規則（10 類判斷順序）取自使用者的「基金分類對照表(已整理).xlsx」。
輸出的每一檔基金是 dashboard 前端 (logic.js) 預期的精簡欄位格式：
  id  基金統編前8碼（去除級別後綴）
  n   基金名稱（取其中一個級別的名稱）
  tc  類型代號（該基金規模最大之級別的代號）
  c   10 類分類
  e   ETF 分類（主動式ETF / 被動式ETF / 一般傳統基金）
  mc  經理公司代號
  co  公司中文全名
  cu  保管銀行（國內，多數決）
  inc 基金成立日 YYYY-MM-DD（取各級別最早者）
  a   基金規模合計（台幣）
  nc  級別數
"""
import collections
import re


def num(s):
    if s is None:
        return 0.0
    s = s.strip().replace(",", "")
    if s in ("", "-", "N/A"):
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def base_fund(fid):
    m = re.match(r"^(\d{8})", fid)
    return m.group(1) if m else fid


def ymd(s):
    s = (s or "").strip()
    if not re.match(r"^\d{8}$", s):
        return None
    return f"{s[0:4]}-{s[4:6]}-{s[6:8]}"


def classify(code):
    if code.startswith("AH") or code.startswith("AL"):
        return "指數股票型ETF(含主動式ETF)"
    if code.startswith("AE"):
        return "組合型"
    if code == "AC23":
        return "非投資等級債券型"
    if code in ("AC12", "AC21"):
        return "一般債券型"
    if code.startswith("AD") or code == "AC11":
        return "貨幣市場型"
    if code.startswith("AA"):
        return "股票型"
    if code.startswith("AB"):
        return "平衡型"
    if code.startswith("AJ"):
        return "多重資產型"
    if code.startswith("AI") or code in ("AK11", "AK21"):
        return "指數型"
    return "其他"


def etf_class(code):
    if code.startswith("AL"):
        return "主動式ETF"
    if code.startswith("AH"):
        return "被動式ETF"
    return "一般傳統基金"


def build_funds(t1, t2, t3, company_map):
    # t2: fid -> 經理公司代號, 成立日
    t2_idx = {}
    for r in t2:
        fid = r[1].strip()
        t2_idx[fid] = {"manager_code": r[9].strip(), "inception": ymd(r[11])}

    # t3: fid -> 保管銀行(國內)
    t3_idx = {}
    for r in t3:
        fid = r[1].strip()
        t3_idx[fid] = {"custodian": r[9].strip()}

    groups = collections.defaultdict(list)
    for r in t1:
        fid = r[1].strip()
        groups[base_fund(fid)].append(r)

    funds = []
    for bid, rows in groups.items():
        type_codes = collections.Counter(r[0].strip() for r in rows)
        type_code = type_codes.most_common(1)[0][0]
        aum_total = sum(num(r[5]) for r in rows)
        name = rows[0][2].strip()

        incs = []
        manager_codes = collections.Counter()
        for r in rows:
            t2r = t2_idx.get(r[1].strip())
            if t2r:
                if t2r["inception"]:
                    incs.append(t2r["inception"])
                if t2r["manager_code"]:
                    manager_codes[t2r["manager_code"]] += 1
        inception = min(incs) if incs else None
        manager_code = manager_codes.most_common(1)[0][0] if manager_codes else None

        custodians = collections.Counter()
        for r in rows:
            t3r = t3_idx.get(r[1].strip())
            if t3r and t3r["custodian"]:
                custodians[t3r["custodian"]] += 1
        custodian = custodians.most_common(1)[0][0] if custodians else None

        company = company_map.get(manager_code) if manager_code else None

        funds.append({
            "id": bid,
            "n": name,
            "tc": type_code,
            "c": classify(type_code),
            "e": etf_class(type_code),
            "mc": manager_code,
            "co": company,
            "cu": custodian,
            "inc": inception,
            "a": round(aum_total),
            "nc": len(rows),
        })

    return funds
