(function(){
"use strict";

var FUNDS = JSON.parse(document.getElementById('fund-data').textContent);

var META = {
  dataMonth: '__META_DATA_MONTH__',
  aumAsOf: '__META_AUM_AS_OF__',
  pageGenerated: '__META_PAGE_GENERATED__'
};

// 年度視窗一律從 META.aumAsOf（資料所屬年月的月底）動態推算，
// 不寫死年份，每次重新產生頁面都會自動跟著資料往前滾動。
var CUR_YEAR = Number(META.aumAsOf.slice(0, 4));
var YEARS = [String(CUR_YEAR - 2), String(CUR_YEAR - 1), String(CUR_YEAR)];
var WINDOW_START = YEARS[0] + '-01-01'; // 跟逐年新基金長條圖同一個 3 年回溯窗，起點對齊 YEARS[0]
var WINDOW_END = META.aumAsOf;

var BANK_SHORT = {
  '中國信託商業銀行':'中國信託','第一商業銀行':'第一','彰化商業銀行':'彰化','永豐商業銀行':'永豐',
  '玉山商業銀行':'玉山','華南商業銀行':'華南','兆豐國際商業銀行':'兆豐','合作金庫商業銀行':'合作金庫',
  '臺灣銀行':'臺銀','臺灣中小企業銀行':'臺企銀','台北富邦商業銀行':'台北富邦','台新國際商業銀行':'台新',
  '國泰世華商業銀行':'國泰世華','陽信商業銀行':'陽信','渣打國際商業銀行':'渣打','臺灣新光商業銀行':'臺灣新光',
  '台中商業銀行':'台中','凱基商業銀行':'凱基','遠東國際商業銀行':'遠東','上海商業儲蓄銀行':'上海商銀',
  '聯邦商業銀行':'聯邦','臺灣土地銀行':'土銀','元大商業銀行':'元大'
};
function shortBank(n){ return BANK_SHORT[n] || n; }

var CATEGORY_ORDER = [
  '被動式ETF','主動式ETF','一般債券型','股票型','指數型','非投資等級債券型',
  '平衡型','多重資產型','貨幣市場型','組合型','其他'
];

// ---------- formatters ----------
function fmtInt(n){ return Math.round(n).toLocaleString('en-US'); }
function fmtPct(x, d){ d = d==null?1:d; return (x*100).toFixed(d) + '%'; }
function fmtAUM(twd){
  if (twd == null) return '—';
  if (Math.abs(twd) >= 1e12) return (twd/1e12).toFixed(2) + ' 兆';
  return fmtInt(twd/1e8) + ' 億';
}
function fmtAUMShort(twd){
  if (twd == null) return '—';
  if (Math.abs(twd) >= 1e12) return (twd/1e12).toFixed(2) + '兆';
  if (Math.abs(twd) >= 1e8) return (twd/1e8).toFixed(1) + '億';
  return fmtInt(twd);
}

// competition ranking: items pre-sorted desc by value; returns array of ranks (1-based, ties share rank)
function ranks(values){
  var out = new Array(values.length);
  var prevVal = null, prevRank = 0;
  for (var i=0;i<values.length;i++){
    if (prevVal !== null && values[i] === prevVal){
      out[i] = prevRank;
    } else {
      out[i] = i+1;
      prevRank = i+1;
      prevVal = values[i];
    }
  }
  return out;
}

function el(tag, attrs, children){
  var e = document.createElement(tag);
  if (attrs) for (var k in attrs){
    if (k === 'class') e.className = attrs[k];
    else if (k === 'html') e.innerHTML = attrs[k];
    else e.setAttribute(k, attrs[k]);
  }
  if (children) children.forEach(function(c){ if (c!=null) e.appendChild(typeof c==='string'?document.createTextNode(c):c); });
  return e;
}

// ======================================================================
// Meta chips
// ======================================================================
(function renderMeta(){
  var wrap = document.getElementById('metaChips');
  var items = [
    ['資料年月', META.dataMonth],
    ['本頁資料產生', META.pageGenerated],
    ['只用公開資料', null]
  ];
  items.forEach(function(it){
    var chip = el('span', {class:'chip' + (it[1]?'':' accent')}, [
      it[1] ? it[0] + ' ' : it[0], it[1] ? el('b', {}, [it[1]]) : null
    ]);
    wrap.appendChild(chip);
  });
})();

// ======================================================================
// Section 1 — Overview
// ======================================================================
var fundCount = FUNDS.length;
var totalAUM = FUNDS.reduce(function(s,f){ return s+f.a; }, 0);
var custodianSet = {}, companySet = {};
FUNDS.forEach(function(f){ if(f.cu) custodianSet[f.cu]=1; if(f.co) companySet[f.co]=1; });
var custodianCount = Object.keys(custodianSet).length;
var companyCount = Object.keys(companySet).length;

(function renderOverview(){
  var grid = document.getElementById('statGrid');
  var tiles = [
    ['全市場｜基金檔數', fmtInt(fundCount) + ' 檔', '同一基金不同級別僅計 1 檔'],
    ['全市場｜基金總規模', fmtAUM(totalAUM), '基準日 ' + META.aumAsOf],
    ['全市場｜保管行家數', custodianCount + ' 家', '承作基金保管業務之銀行'],
    ['全市場｜投信家數', companyCount + ' 家', '有存續基金之經理公司']
  ];
  tiles.forEach(function(t){
    grid.appendChild(el('div', {class:'card stat-tile'}, [
      el('div', {class:'label'}, [t[0]]),
      el('div', {class:'value num'}, [t[1]]),
      el('div', {class:'sub'}, [t[2]])
    ]));
  });
})();

// ======================================================================
// Section 2 — 存量市占
// ======================================================================
var custodianStats = (function(){
  var map = {};
  FUNDS.forEach(function(f){
    if (!f.cu) return;
    if (!map[f.cu]) map[f.cu] = { name:f.cu, aum:0, count:0, companies:{} };
    map[f.cu].aum += f.a;
    map[f.cu].count += 1;
    if (f.co) map[f.cu].companies[f.co] = 1;
  });
  var list = Object.keys(map).map(function(k){
    var m = map[k];
    return { name:m.name, aum:m.aum, count:m.count, companyCount: Object.keys(m.companies).length };
  });
  return list;
})();

function sortedBy(list, key){
  var copy = list.slice().sort(function(a,b){ return b[key]-a[key]; });
  var rk = ranks(copy.map(function(x){ return x[key]; }));
  copy.forEach(function(c,i){ c['rank_'+key] = rk[i]; });
  return copy;
}
var byAUM = sortedBy(custodianStats, 'aum');
var byCount = sortedBy(custodianStats, 'count');
var byCompanyCount = sortedBy(custodianStats, 'companyCount');
var rankByName = {};
[['aum',byAUM],['count',byCount],['companyCount',byCompanyCount]].forEach(function(pair){
  var key = pair[0], arr = pair[1];
  arr.forEach(function(c){
    if (!rankByName[c.name]) rankByName[c.name] = {};
    rankByName[c.name][key] = c['rank_'+key];
  });
});
var statByName = {};
custodianStats.forEach(function(c){ statByName[c.name] = c; });

var shareMetric = 'aum';
var shareShowAll = false;

function renderShareBarList(){
  var wrap = document.getElementById('shareBarList');
  wrap.innerHTML = '';
  var src = shareMetric === 'aum' ? byAUM : byCount;
  var total = shareMetric === 'aum' ? totalAUM : fundCount;
  var n = shareShowAll ? src.length : Math.min(10, src.length);
  var max = src[0][shareMetric];
  var label = shareMetric === 'aum' ? '依規模：各保管行基金規模與市占（前 ' + n + ' 名）' : '依檔數：各保管行存續基金檔數與市占（前 ' + n + ' 名）';
  wrap.appendChild(el('div', {style:'font-size:12px;font-weight:700;color:var(--accent);margin-bottom:6px;'}, [label]));
  var fills = [];
  for (var i=0;i<n;i++){
    var c = src[i];
    var pct = c[shareMetric] / total;
    var widthPct = (c[shareMetric] / max * 100).toFixed(1);
    var valText = shareMetric === 'aum'
      ? fmtPct(pct) + '　' + fmtAUMShort(c.aum)
      : fmtPct(pct) + '　' + c.count + ' 檔';
    var fill = el('div', {class:'bar-fill'});
    fills.push([fill, widthPct]);
    wrap.appendChild(el('div', {class:'bar-row'}, [
      el('div', {class:'rank'}, [String(i+1)]),
      el('div', {class:'name', title:c.name}, [shortBank(c.name)]),
      el('div', {class:'bar-track'}, [fill]),
      el('div', {class:'val num'}, [valText])
    ]));
  }
  document.getElementById('shareShowAllBtn').textContent = shareShowAll ? '收合為前 10 名' : '顯示全部 ' + src.length + ' 家';
  // 先掛載在 width:0，下一幀再設定目標寬度，讓切換依規模/依檔數時長條有動畫
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      fills.forEach(function(pair){ pair[0].style.width = pair[1] + '%'; });
    });
  });
}

document.getElementById('shareShowAllBtn').addEventListener('click', function(){
  shareShowAll = !shareShowAll;
  renderShareBarList();
});

document.getElementById('shareToggle').addEventListener('click', function(e){
  var btn = e.target.closest('button');
  if (!btn) return;
  shareMetric = btn.getAttribute('data-metric');
  Array.prototype.forEach.call(document.querySelectorAll('#shareToggle button'), function(b){
    b.classList.toggle('active', b===btn);
  });
  renderShareBarList();
});

// --- compare panel ---
var allBankNames = byAUM.map(function(c){ return c.name; });
var selectedBanks = byAUM.slice(0,3).map(function(c){ return c.name; });

function renderBankChips(){
  var wrap = document.getElementById('bankChips');
  wrap.innerHTML = '';
  allBankNames.forEach(function(name){
    var isSel = selectedBanks.indexOf(name) !== -1;
    var disabled = !isSel && selectedBanks.length >= 3;
    var chip = el('button', {class:'bank-chip' + (isSel?' selected':'')}, [shortBank(name)]);
    if (disabled) chip.setAttribute('disabled','disabled');
    chip.addEventListener('click', function(){
      if (isSel){ selectedBanks = selectedBanks.filter(function(n){ return n!==name; }); }
      else if (selectedBanks.length < 3){ selectedBanks.push(name); }
      renderBankChips();
      renderCompareTable();
    });
    wrap.appendChild(chip);
  });
}

function compareRowCells(stat, nameLabel){
  var r = rankByName[stat.name] || {};
  return [
    el('td', {class:'name-cell'}, [nameLabel]),
    el('td', {class:'num'}, [fmtAUMShort(stat.aum)]),
    el('td', {class:'num'}, [fmtPct(stat.aum/totalAUM) + ' ', el('span',{class:'rank-pill'},['（'+r.aum+'）'])]),
    el('td', {class:'num'}, [String(stat.count)]),
    el('td', {class:'num'}, [fmtPct(stat.count/fundCount) + ' ', el('span',{class:'rank-pill'},['（'+r.count+'）'])]),
    el('td', {class:'num'}, [String(stat.companyCount) + ' 家 ', el('span',{class:'rank-pill'},['（'+r.companyCount+'）'])])
  ];
}

function renderCompareTable(){
  var table = document.getElementById('compareTable');
  table.innerHTML = '';
  var thead = el('thead', {}, [el('tr', {}, [
    el('th', {}, ['保管行']), el('th', {}, ['規模']), el('th', {}, ['規模市占＋排名']),
    el('th', {}, ['檔數']), el('th', {}, ['檔數市占＋排名']), el('th', {}, ['投信客戶＋排名'])
  ])]);
  table.appendChild(thead);
  var tbody = el('tbody');
  selectedBanks.forEach(function(name){
    var stat = statByName[name];
    tbody.appendChild(el('tr', {}, compareRowCells(stat, shortBank(name))));
  });
  var marketStat = { name:'全市場', aum: totalAUM, count: fundCount, companyCount: companyCount };
  var marketRow = el('tr', {class:'market-row'}, [
    el('td', {class:'name-cell'}, ['全市場']),
    el('td', {class:'num'}, [fmtAUM(totalAUM)]),
    el('td', {class:'num'}, ['100%']),
    el('td', {class:'num'}, [String(fundCount)]),
    el('td', {class:'num'}, ['100%']),
    el('td', {class:'num'}, [companyCount + ' 家'])
  ]);
  tbody.appendChild(marketRow);
  table.appendChild(tbody);
}

renderShareBarList();
renderBankChips();
renderCompareTable();

// ======================================================================
// Section 3 — 新案流向
// ======================================================================
var newFundsAll = FUNDS.filter(function(f){ return f.inc && f.inc >= YEARS[0] + '-01-01'; });
var byYear = {};
YEARS.forEach(function(y){ byYear[y] = []; });
newFundsAll.forEach(function(f){
  var y = f.inc.slice(0,4);
  if (byYear[y]) byYear[y].push(f);
});

(function renderYearBars(){
  var wrap = document.getElementById('yearBars');
  var max = Math.max.apply(null, YEARS.map(function(y){ return byYear[y].length; }));
  var fills = [];
  YEARS.forEach(function(y){
    var n = byYear[y].length;
    var h = max ? (n/max*100) : 0;
    var fill = el('div', {class:'fill'});
    fills.push([fill, h]);
    var col = el('div', {class:'year-bar-col' + (y===YEARS[2]?' current':'')}, [
      el('div', {class:'amt num'}, [n + ' 檔']),
      el('div', {class:'bar'}, [fill]),
      el('div', {class:'yr'}, [y === YEARS[2] ? y+'*' : y])
    ]);
    wrap.appendChild(col);
  });
  // 先掛載在 height:0，下一幀再設定目標高度，讓 CSS transition 有起點可以動畫（grow-up）
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      fills.forEach(function(pair){ pair[0].style.height = pair[1] + '%'; });
    });
  });
})();

var currentYear = YEARS[2];
function renderYearPanel(){
  document.getElementById('yearTableTitle').textContent = currentYear + ' 年新基金 ' + byYear[currentYear].length + ' 檔｜前三名保管行';
  var yFunds = byYear[currentYear];
  var total = yFunds.length;
  var byC = {};
  yFunds.forEach(function(f){
    if (!f.cu) return;
    if (!byC[f.cu]) byC[f.cu] = { name:f.cu, items:[] };
    byC[f.cu].items.push(f);
  });
  var list = Object.keys(byC).map(function(k){ return byC[k]; });
  list.forEach(function(g){ g.n = g.items.length; });
  list.sort(function(a,b){ return b.n-a.n; });
  var rk = ranks(list.map(function(g){ return g.n; }));
  var top3 = list.slice(0,3);

  var table = document.getElementById('yearTopTable');
  table.innerHTML = '';
  table.appendChild(el('thead', {}, [el('tr', {}, [
    el('th', {}, ['保管行']), el('th', {}, ['新基金']), el('th', {}, ['檔數市占']),
    el('th', {}, ['其中ETF類']), el('th', {}, ['其中主動式ETF']), el('th', {}, ['新增基金規模'])
  ])]));
  var tbody = el('tbody');
  top3.forEach(function(g, i){
    var etfCount = g.items.filter(function(f){ return f.c === '被動式ETF' || f.c === '主動式ETF'; }).length;
    var activeEtfCount = g.items.filter(function(f){ return f.e === '主動式ETF'; }).length;
    var aum = g.items.reduce(function(s,f){ return s+f.a; }, 0);
    var rankLabel = i===0 ? '第 1' : (g.n === top3[i-1].n ? '並列第 '+rk[i] : '第 '+rk[i]);
    tbody.appendChild(el('tr', {}, [
      el('td', {class:'name-cell'}, [shortBank(g.name) + ' ' + rankLabel]),
      el('td', {class:'num'}, [g.n + ' 檔']),
      el('td', {class:'num'}, [fmtPct(g.n/total)]),
      el('td', {class:'num'}, [String(etfCount)]),
      el('td', {class:'num'}, [String(activeEtfCount)]),
      el('td', {class:'num'}, [fmtAUMShort(aum)])
    ]));
  });
  table.appendChild(tbody);

  // footnote: top3 custodians by new-fund AUM across whole YEARS[0]-latest window, + total active-ETF count
  var allByC = {};
  newFundsAll.forEach(function(f){
    if (!f.cu) return;
    allByC[f.cu] = (allByC[f.cu]||0) + f.a;
  });
  var allList = Object.keys(allByC).map(function(k){ return {name:k, aum:allByC[k]}; });
  allList.sort(function(a,b){ return b.aum-a.aum; });
  var top3Overall = allList.slice(0,3).map(function(x){ return shortBank(x.name) + ' ' + fmtAUMShort(x.aum); }).join('、');
  var totalActiveEtf = newFundsAll.filter(function(f){ return f.e === '主動式ETF'; }).length;
  document.getElementById('yearFootnote').textContent =
    '以新增基金規模計（' + YEARS[0] + ' 年起累計）：' + top3Overall + '。主動式 ETF 歷年共 ' + totalActiveEtf + ' 檔。';
}

(function renderYearTabs(){
  var wrap = document.getElementById('yearTabs');
  YEARS.forEach(function(y){
    var btn = el('button', {class: y===currentYear?'active':''}, [y]);
    btn.addEventListener('click', function(){
      currentYear = y;
      Array.prototype.forEach.call(wrap.querySelectorAll('button'), function(b,i){ b.classList.toggle('active', YEARS[i]===y); });
      renderYearPanel();
    });
    wrap.appendChild(btn);
  });
})();
renderYearPanel();

// WINDOW_START/WINDOW_END 仍用於「自己查」的一鍵範例篩選（新案期間、今年新基金）
var WINDOW_LABEL = WINDOW_START.slice(0,7) + '～' + WINDOW_END.slice(0,7);
document.getElementById('presetCurYear').textContent = YEARS[2] + ' 年新基金';
document.getElementById('presetWindow').textContent = '新案期間（' + WINDOW_LABEL + '）';
document.getElementById('yearBarsNote').textContent =
  YEARS[2] + ' 年資料至 ' + Number(META.dataMonth.slice(5)) + ' 月。僅計目前仍存續的基金；成立日採「基金」成立日（不採級別成立日，避免老基金新增級別被誤算成新基金）。';

function renderCategoryTable(funds, tableElId, titleElId, titleText){
  document.getElementById(titleElId).textContent = titleText;
  var byCat = {};
  funds.forEach(function(f){
    if (!byCat[f.c]) byCat[f.c] = { count:0, aum:0 };
    byCat[f.c].count += 1;
    byCat[f.c].aum += f.a;
  });
  var sortedCats = CATEGORY_ORDER.slice().sort(function(a,b){
    return (byCat[b] ? byCat[b].aum : 0) - (byCat[a] ? byCat[a].aum : 0);
  });
  var maxAum = 0;
  sortedCats.forEach(function(c){ if (byCat[c]) maxAum = Math.max(maxAum, byCat[c].aum); });

  var table = document.getElementById(tableElId);
  table.innerHTML = '';
  table.appendChild(el('thead', {}, [el('tr', {}, [
    el('th', {}, ['產品類型']), el('th', {}, ['檔數']), el('th', {}, ['現規模'])
  ])]));
  var tbody = el('tbody');
  var fills = [];
  sortedCats.forEach(function(cat){
    var d = byCat[cat] || {count:0, aum:0};
    // 線性比例是長條圖「長度＝規模」的基本承諾，不能用 log/sqrt 之類非線性壓縮去美化，
    // 那樣會誤導相對大小。小類型只給一個「看得到」的最小寬度，數字仍以右側現規模欄為準。
    var w = maxAum && d.aum > 0 ? Math.max(d.aum/maxAum*100, 4) : 0;
    var fill = el('div', {class:'mini-fill'});
    fills.push([fill, w]);
    tbody.appendChild(el('tr', {}, [
      el('td', {class:'name-cell'}, [
        el('div', {class:'cat-bar-cell'}, [
          el('div', {class:'mini-track'}, [fill]),
          el('span', {}, [cat])
        ])
      ]),
      el('td', {class:'num'}, [d.count + ' 檔']),
      el('td', {class:'num'}, [fmtAUMShort(d.aum)])
    ]));
  });
  table.appendChild(tbody);
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      fills.forEach(function(pair){ pair[0].style.width = pair[1] + '%'; });
    });
  });
}
renderCategoryTable(FUNDS, 'allCatTable', 'allCatTableTitle', '目前存續基金（共 ' + fmtInt(FUNDS.length) + ' 檔）｜依產品類型');

function renderPie(funds, svgId, legendId, centerSubtext){
  var groups = { '主動式ETF':{count:0,aum:0}, '被動式ETF':{count:0,aum:0}, '一般傳統基金':{count:0,aum:0} };
  funds.forEach(function(f){
    if (!groups[f.e]) groups[f.e] = {count:0,aum:0};
    groups[f.e].count += 1;
    groups[f.e].aum += f.a;
  });
  var total = funds.reduce(function(s,f){ return s+f.a; }, 0) || 1;
  var colors = { '主動式ETF':'var(--series-1)', '被動式ETF':'var(--series-2)', '一般傳統基金':'var(--series-3)' };
  var order = ['主動式ETF','被動式ETF','一般傳統基金'];

  var svg = document.getElementById(svgId);
  var cx=84, cy=84, r=62, sw=26;
  var circumference = 2*Math.PI*r;
  var offsetAcc = 0;
  var svgns = 'http://www.w3.org/2000/svg';

  // 每一塊都用「淺色調→基礎色」的放射狀漸層，類別識別色不變，只是多一點層次感
  var defs = document.createElementNS(svgns,'defs');
  order.forEach(function(key, i){
    var grad = document.createElementNS(svgns,'radialGradient');
    var gradId = svgId + '-grad-' + i;
    grad.setAttribute('id', gradId);
    grad.setAttribute('cx','35%'); grad.setAttribute('cy','35%'); grad.setAttribute('r','75%');
    var stop0 = document.createElementNS(svgns,'stop');
    stop0.setAttribute('offset','0%');
    stop0.setAttribute('style', 'stop-color:color-mix(in srgb, ' + colors[key] + ' 55%, white)');
    var stop1 = document.createElementNS(svgns,'stop');
    stop1.setAttribute('offset','100%');
    stop1.setAttribute('style', 'stop-color:' + colors[key]);
    grad.appendChild(stop0); grad.appendChild(stop1);
    defs.appendChild(grad);
  });
  svg.appendChild(defs);

  var bgCircle = document.createElementNS(svgns,'circle');
  bgCircle.setAttribute('cx',cx); bgCircle.setAttribute('cy',cy); bgCircle.setAttribute('r',r);
  bgCircle.setAttribute('fill','none'); bgCircle.setAttribute('stroke','var(--surface-sunken)'); bgCircle.setAttribute('stroke-width',sw);
  svg.appendChild(bgCircle);

  order.forEach(function(key, i){
    var g = groups[key] || {count:0,aum:0};
    var frac = g.aum/total;
    var len = frac*circumference;
    var gap = Math.min(2, len*0.08);
    var circle = document.createElementNS(svgns,'circle');
    circle.setAttribute('cx',cx); circle.setAttribute('cy',cy); circle.setAttribute('r',r);
    circle.setAttribute('fill','none');
    circle.setAttribute('stroke', 'url(#' + svgId + '-grad-' + i + ')');
    circle.setAttribute('stroke-width', sw);
    circle.setAttribute('stroke-dasharray', Math.max(0,len-gap) + ' ' + (circumference-(len-gap)));
    circle.setAttribute('stroke-dashoffset', -offsetAcc);
    circle.setAttribute('transform', 'rotate(-90 '+cx+' '+cy+')');
    circle.setAttribute('stroke-linecap','butt');
    svg.appendChild(circle);
    offsetAcc += len;
  });
  var centerText = document.createElementNS(svgns,'text');
  centerText.setAttribute('x',cx); centerText.setAttribute('y',cy-4);
  centerText.setAttribute('text-anchor','middle');
  centerText.setAttribute('font-size','20'); centerText.setAttribute('font-weight','700');
  centerText.setAttribute('fill','var(--ink)');
  centerText.textContent = fmtAUMShort(total);
  svg.appendChild(centerText);
  var subText = document.createElementNS(svgns,'text');
  subText.setAttribute('x',cx); subText.setAttribute('y',cy+14);
  subText.setAttribute('text-anchor','middle');
  subText.setAttribute('font-size','10.5'); subText.setAttribute('fill','var(--ink-muted)');
  subText.textContent = centerSubtext;
  svg.appendChild(subText);

  var legend = document.getElementById(legendId);
  legend.innerHTML = '';
  order.forEach(function(key){
    var g = groups[key] || {count:0,aum:0};
    legend.appendChild(el('div', {class:'pie-legend-row'}, [
      el('div', {class:'lk'}, [el('span',{class:'dot', style:'background:'+colors[key]}), key]),
      el('div', {class:'lv num'}, [g.count + ' 檔・' + fmtAUMShort(g.aum) + '（' + fmtPct(g.aum/total) + '）'])
    ]));
  });
}
renderPie(FUNDS, 'allPieSvg', 'allPieLegend', '全市場規模');

// ======================================================================
// Section 4 — 自己查
// ======================================================================
(function populateFilters(){
  var companies = Object.keys(companySet).sort(function(a,b){return a.localeCompare(b,'zh-Hant');});
  var custodians = Object.keys(custodianSet).sort(function(a,b){return a.localeCompare(b,'zh-Hant');});
  var compSel = document.getElementById('fCompany');
  companies.forEach(function(c){ compSel.appendChild(el('option', {value:c}, [c])); });
  var custSel = document.getElementById('fCustodian');
  custodians.forEach(function(c){ custSel.appendChild(el('option', {value:c}, [shortBank(c)])); });
  var catSel = document.getElementById('fCategory');
  CATEGORY_ORDER.forEach(function(c){ catSel.appendChild(el('option', {value:c}, [c])); });
})();

function getFilters(){
  return {
    company: document.getElementById('fCompany').value,
    custodian: document.getElementById('fCustodian').value,
    category: document.getElementById('fCategory').value,
    from: document.getElementById('fFrom').value,
    to: document.getElementById('fTo').value,
    kw: document.getElementById('fKeyword').value.trim()
  };
}

function applyFilters(){
  var f = getFilters();
  var list = FUNDS.filter(function(x){
    if (f.company && x.co !== f.company) return false;
    if (f.custodian && x.cu !== f.custodian) return false;
    if (f.category && x.c !== f.category) return false;
    if (f.from && (!x.inc || x.inc < f.from)) return false;
    if (f.to && (!x.inc || x.inc > f.to)) return false;
    if (f.kw && x.n.indexOf(f.kw) === -1) return false;
    return true;
  });
  list.sort(function(a,b){ return (b.inc||'') < (a.inc||'') ? -1 : (b.inc||'') > (a.inc||'') ? 1 : 0; });
  renderLookupResults(list);
}

function renderLookupResults(list){
  var totalAum = list.reduce(function(s,f){ return s+f.a; }, 0);
  document.getElementById('resultCount').innerHTML =
    '符合條件 <b>' + fmtInt(list.length) + '</b> 檔｜現規模合計 <b>' + fmtAUM(totalAum) + '</b>';

  var byC = {};
  list.forEach(function(f){ if (f.cu) byC[f.cu] = (byC[f.cu]||0)+1; });
  var topC = Object.keys(byC).map(function(k){return {name:k,n:byC[k]};}).sort(function(a,b){return b.n-a.n;}).slice(0,6);
  document.getElementById('byCustodianLine').textContent = topC.length
    ? '依保管行：' + topC.map(function(c){ return shortBank(c.name)+' '+c.n; }).join('、') + (Object.keys(byC).length>6 ? ' …等 '+Object.keys(byC).length+' 家' : '')
    : '';

  var table = document.getElementById('lookupTable');
  table.innerHTML = '';
  table.appendChild(el('thead', {}, [el('tr', {}, [
    el('th', {}, ['成立日']), el('th', {}, ['投信']), el('th', {}, ['基金名稱']),
    el('th', {}, ['產品類型']), el('th', {}, ['保管行']), el('th', {}, ['現規模（億）'])
  ])]));
  var tbody = el('tbody');
  var MAX_ROWS = 500;
  list.slice(0, MAX_ROWS).forEach(function(f){
    tbody.appendChild(el('tr', {}, [
      el('td', {}, [f.inc || '—']),
      el('td', {}, [f.co || '—']),
      el('td', {class:'name-cell', title:f.n}, [f.n]),
      el('td', {}, [el('span',{class:'tag'},[f.c])]),
      el('td', {}, [shortBank(f.cu||'—')]),
      el('td', {class:'num'}, [(f.a/1e8).toFixed(1)])
    ]));
  });
  table.appendChild(tbody);
  if (list.length > MAX_ROWS){
    var note = el('div', {class:'table-note', style:'padding:10px;'}, ['僅顯示前 ' + MAX_ROWS + ' 筆（共 ' + list.length + ' 筆），請用篩選縮小範圍或下載 CSV 取得完整清單。']);
    document.getElementById('lookupTable').parentNode.appendChild(note);
  }
  currentLookupList = list;
}

var currentLookupList = [];

['fCompany','fCustodian','fCategory','fFrom','fTo'].forEach(function(id){
  document.getElementById(id).addEventListener('change', applyFilters);
});
document.getElementById('fKeyword').addEventListener('input', applyFilters);

document.querySelectorAll('.preset-btn').forEach(function(btn){
  btn.addEventListener('click', function(){
    var p = btn.getAttribute('data-preset');
    if (p === 'clear'){
      document.getElementById('fCompany').value = '';
      document.getElementById('fCustodian').value = '';
      document.getElementById('fCategory').value = '';
      document.getElementById('fFrom').value = '';
      document.getElementById('fTo').value = '';
      document.getElementById('fKeyword').value = '';
    } else if (p === 'curyear'){
      document.getElementById('fFrom').value = YEARS[2] + '-01-01';
      document.getElementById('fTo').value = WINDOW_END;
      document.getElementById('fCategory').value = '';
    } else if (p === 'active-etf'){
      document.getElementById('fFrom').value = '';
      document.getElementById('fTo').value = '';
      document.getElementById('fCategory').value = '主動式ETF';
      document.getElementById('fKeyword').value = '';
    } else if (p === 'window'){
      document.getElementById('fFrom').value = WINDOW_START;
      document.getElementById('fTo').value = WINDOW_END;
      document.getElementById('fCategory').value = '';
      document.getElementById('fKeyword').value = '';
    }
    applyFilters();
  });
});

document.getElementById('downloadCsv').addEventListener('click', function(){
  var rows = [['成立日','投信','基金統編','基金名稱','產品類型','保管行','現規模(億)']];
  currentLookupList.forEach(function(f){
    rows.push([f.inc||'', f.co||'', f.id, f.n, f.c, f.cu||'', (f.a/1e8).toFixed(2)]);
  });
  var csv = rows.map(function(r){
    return r.map(function(v){
      v = String(v==null?'':v);
      if (v.indexOf(',')!==-1 || v.indexOf('"')!==-1 || v.indexOf('\n')!==-1){
        v = '"' + v.replace(/"/g,'""') + '"';
      }
      return v;
    }).join(',');
  }).join('\r\n');
  var blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8;'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = '投信保管行明細_' + META.dataMonth.replace('/','') + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

applyFilters();

// ======================================================================
// section nav active state on scroll
// ======================================================================
(function(){
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.section-nav a'));
  var sections = navLinks.map(function(a){ return document.querySelector(a.getAttribute('href')); });
  function onScroll(){
    var pos = window.scrollY + 90;
    var activeIdx = 0;
    sections.forEach(function(s, i){ if (s && s.offsetTop <= pos) activeIdx = i; });
    navLinks.forEach(function(a,i){ a.classList.toggle('active', i===activeIdx); });
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();
})();

})();
