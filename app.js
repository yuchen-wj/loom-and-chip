/* ============================================================
   织机与芯片 · Loom & Chip  —— 主逻辑
   第 0 节为四段可复算算法（纯函数，Node 可直接 require 做自检）；
   第 1 节起为九大模块的渲染与交互。
   零依赖：不引用任何外部库、字体或图片。
   ============================================================ */
'use strict';

/* ============================================================
   0 · 算法层
   ============================================================ */

/** 云锦四色的编码字与色值。索引顺序即花本"配色位"的取值顺序。 */
const COLOR_KEYS = ['B', 'W', 'G', 'K'];
const COLOR_META = {
  B: { zh: '石青', en: 'stone blue', hex: '#1c3f52' },
  W: { zh: '月白', en: 'moon white', hex: '#dfe8ec' },
  G: { zh: '赤金', en: 'vermilion gold', hex: '#b8860b' },
  K: { zh: '墨', en: 'ink', hex: '#1a1a1a' }
};

/**
 * 三种地组织：period 即组织循环（也是地综片数）；
 * float 为该组织下地部的最大经浮长（实测应与 groundLift 的连续 1 串长度一致）。
 */
const STRUCTURES = {
  plain: { id: 'plain', zh: '平纹', en: 'Plain weave', period: 2, float: 1,
    desc: { zh: '一经一纬交替交织，浮长最短，地部最挺括。', en: 'One over one; shortest floats, firmest ground.' } },
  twill: { id: 'twill', zh: '三枚斜纹', en: '3-end twill', period: 3, float: 2,
    desc: { zh: '交织点逐纬移一格，地部呈连续斜向纹路，经浮长为 2。', en: 'Binding points shift one place per pick: a continuous diagonal with a warp float of 2.' } },
  satin5: { id: 'satin5', zh: '五枚缎纹', en: '5-end satin', period: 5, float: 4,
    desc: { zh: '每纬只有一片地综落下，经浮长为 4，表面光洁——云锦库缎、妆花缎的标准地组织。', en: 'One frame down per pick, a warp float of 4 and a glossy face: the standard ground of brocade satin.' } }
};
const STRUCTURE_ORDER = ['plain', 'twill', 'satin5'];

/** 织物渲染用材质色（非 UI 色） */
const SILK = {
  warp: '#b3c2c9',      // 经面（月白缎地受光）
  warpDim: '#a1b1b8',
  weft: '#93a5ad',      // 纬面（地纬受光较弱）
  weftDim: '#83959d',
  edge: 'rgba(8,11,13,0.20)'
};

/* ---------- 0.1 纹样（design）基础操作 ---------- */

function blankDesign(n) {
  const cells = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) row.push(null);
    cells.push(row);
  }
  return { w: n, h: n, cells: cells };
}

/** 由字符行数组构造纹样：'.' 为空，'B'/'W'/'G'/'K' 为色。 */
function designFromRows(rows) {
  const h = rows.length;
  const w = rows[0].length;
  const cells = rows.map(r => r.split('').map(ch => (COLOR_KEYS.indexOf(ch) >= 0 ? ch : null)));
  return { w: w, h: h, cells: cells };
}

function designToRows(design) {
  return design.cells.map(row => row.map(c => (COLOR_KEYS.indexOf(c) >= 0 ? c : '.')).join(''));
}

/** 归一化：把 '.'、'' 等非法值一律视为空，保证往返一致比较可靠。 */
function normalizeDesign(design) {
  const w = design.w, h = design.h;
  const cells = [];
  for (let i = 0; i < h; i++) {
    const row = [];
    for (let j = 0; j < w; j++) {
      const c = design.cells[i] ? design.cells[i][j] : null;
      row.push(COLOR_KEYS.indexOf(c) >= 0 ? c : null);
    }
    cells.push(row);
  }
  return { w: w, h: h, cells: cells };
}

/** 重新采样到 n×n（用于 8×8 ⇄ 16×16 切换，按块取众数） */
function resizeDesign(design, n) {
  const src = normalizeDesign(design);
  if (src.w === n && src.h === n) return src;
  const cells = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) {
      const x0 = Math.floor(j * src.w / n), x1 = Math.max(x0 + 1, Math.floor((j + 1) * src.w / n));
      const y0 = Math.floor(i * src.h / n), y1 = Math.max(y0 + 1, Math.floor((i + 1) * src.h / n));
      const tally = {};
      let best = null, bestN = 0;
      for (let y = y0; y < y1 && y < src.h; y++) {
        for (let x = x0; x < x1 && x < src.w; x++) {
          const c = src.cells[y][x];
          if (!c) continue;
          tally[c] = (tally[c] || 0) + 1;
          if (tally[c] > bestN) { bestN = tally[c]; best = c; }
        }
      }
      row.push(best);
    }
    cells.push(row);
  }
  return { w: n, h: n, cells: cells };
}

/* ---------- 0.2 组织（weave structure） ---------- */

/**
 * 地综提升判定：第 weft 纬、第 frame 片综框是否提起。
 * frame 与经线序号的关系为 frame = warp % period，
 * 因此 groundLift(weft, warp, s) 在经向以 period 为周期、在纬向也以 period 为周期。
 */
function frameLift(structure, weft, frame) {
  if (structure === 'twill') return ((((frame - weft) % 3) + 3) % 3) < 2 ? 1 : 0;
  // 五枚经面缎纹：每纬只有一片地综落下（交织点），其余四片提起 → 经浮长为 4
  if (structure === 'satin5') return (((((frame - 2 * weft) % 5) + 5) % 5) === 0) ? 0 : 1;
  return ((weft + frame) % 2 === 0) ? 1 : 0; // plain
}

/** 地组织在某一点的经线提升状态（1=经浮，0=纬浮） */
function groundLift(structure, weft, warp) {
  const P = (STRUCTURES[structure] || STRUCTURES.plain).period;
  return frameLift(STRUCTURES[structure] ? structure : 'plain', weft, ((warp % P) + P) % P);
}

/* ---------- 0.3 算法一：compileToPattern 挑花结本编译器 ---------- */

/**
 * 纹样矩阵 → 花本。
 * 返回 { w, h, lift:['0110…'], color:[[0..4]], stats }
 *   lift[i][j]  === '1'  表示第 i 纬、第 j 经提起（显花）
 *   color[i][j] === k    表示该位使用 COLOR_KEYS[k-1] 的彩纬；0 为地部
 * 关键性质：decodePattern(compileToPattern(d)) 与 d 逐位一致。
 */
function compileToPattern(design) {
  const d = normalizeDesign(design);
  const w = d.w, h = d.h;
  const lift = [], color = [];
  let flowers = 0, distinctColours = {};
  for (let i = 0; i < h; i++) {
    let bits = '';
    const crow = [];
    for (let j = 0; j < w; j++) {
      const c = d.cells[i][j];
      const k = COLOR_KEYS.indexOf(c);
      if (k >= 0) {
        bits += '1'; crow.push(k + 1); flowers++; distinctColours[c] = 1;
      } else {
        bits += '0'; crow.push(0);
      }
    }
    lift.push(bits);
    color.push(crow);
  }
  const total = w * h;
  return {
    w: w, h: h, lift: lift, color: color,
    stats: {
      total: total,
      flowers: flowers,
      ground: total - flowers,
      liftRatio: total ? flowers / total : 0,
      coloursUsed: Object.keys(distinctColours).length,
      bitsPerWeft: w
    }
  };
}

/** 花本 → 纹样（compileToPattern 的逆） */
function decodePattern(pattern) {
  const w = pattern.w, h = pattern.h;
  const cells = [];
  for (let i = 0; i < h; i++) {
    const row = [];
    for (let j = 0; j < w; j++) {
      const bit = pattern.lift[i] ? pattern.lift[i][j] : '0';
      const ci = (pattern.color[i] && pattern.color[i][j]) || 0;
      row.push(bit === '1' && ci > 0 ? COLOR_KEYS[ci - 1] : null);
    }
    cells.push(row);
  }
  return { w: w, h: h, cells: cells };
}

/** 纹样 → 纯二值位矩阵（五态互转的共同载体） */
function designToBits(design) {
  const p = compileToPattern(design);
  return { w: p.w, h: p.h, rows: p.lift.slice() };
}

function bitsToDesign(bits) {
  return { w: bits.w, h: bits.h, cells: bits.rows.map(r => r.split('').map(ch => (ch === '1' ? 'G' : null))) };
}

/** 确定性校验和（FNV-1a 32bit），用于比较两份花本是否同构 */
function checksum(pattern) {
  let h = 0x811c9dc5;
  const s = pattern.lift.map((r, i) => r + ':' + pattern.color[i].join('')).join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ('00000000' + (h >>> 0).toString(16)).slice(-8);
}

/* ---------- 0.4 算法二：weaveSimulate 织造模拟器 ---------- */

/**
 * 花本 + 地组织 → 织物像素矩阵。
 * 规则（教学示意，非文物级复原）：
 *   · 花部位（lift=1）→ 彩色纬浮于表面（face='weft'，颜色取配色位）
 *   · 地部位（lift=0）→ 按地组织交织：地综提起则经浮，否则纬浮
 * 同时统计经浮/纬浮点数与最大浮长（浮长按纬向连续同面计数）。
 */
function weaveSimulate(pattern, structure) {
  const st = STRUCTURES[structure] ? structure : 'plain';
  const P = STRUCTURES[st].period;
  const w = pattern.w, h = pattern.h;
  const cells = [];
  let warpFace = 0, weftFace = 0, flowerCells = 0;
  for (let i = 0; i < h; i++) {
    const row = [];
    for (let j = 0; j < w; j++) {
      const isFlower = pattern.lift[i][j] === '1';
      let face, color, gl = 0;
      if (isFlower) {
        face = 'weft';
        const ci = pattern.color[i][j] || 1;
        color = COLOR_KEYS[ci - 1];
        flowerCells++;
      } else {
        gl = groundLift(st, i, j);
        face = gl ? 'warp' : 'weft';
        color = gl ? 'W' : 'B';   // 语义色：W=经面（月白经），B=纬面（石青地纬）
      }
      if (face === 'warp') warpFace++; else weftFace++;
      row.push({ face: face, color: color, flower: isFlower, lift: face === 'warp' ? 1 : 0 });
    }
    cells.push(row);
  }

  // 浮长：逐纬（行）统计连续同面的长度
  const floatLen = [];
  let maxWarpFloat = 0, maxWeftFloat = 0, floatSum = 0;
  for (let i = 0; i < h; i++) {
    const run = new Array(w).fill(1);
    let start = 0;
    for (let j = 1; j <= w; j++) {
      if (j === w || cells[i][j].face !== cells[i][start].face) {
        const len = j - start;
        for (let k = start; k < j; k++) run[k] = len;
        if (cells[i][start].face === 'warp') { if (len > maxWarpFloat) maxWarpFloat = len; }
        else { if (len > maxWeftFloat) maxWeftFloat = len; }
        floatSum += len * len;
        start = j;
      }
    }
    floatLen.push(run);
  }

  const total = w * h;
  return {
    w: w, h: h, structure: st, period: P,
    cells: cells, floatLen: floatLen,
    stats: {
      total: total,
      warpFace: warpFace,
      weftFace: weftFace,
      flowerCells: flowerCells,
      warpFaceRatio: total ? warpFace / total : 0,
      maxWarpFloat: maxWarpFloat,
      maxWeftFloat: maxWeftFloat,
      meanFloat: total ? floatSum / total : 0,
      frames: P
    }
  };
}

/* ---------- 0.5 算法三：MODALITIES 五态互转 ---------- */

function identityBits(bits) {
  return { w: bits.w, h: bits.h, rows: bits.rows.slice() };
}

function bitsFromRows(rows, w, h) {
  return { w: w, h: h, rows: rows };
}

/* 穿孔卡片：一卡一纬，孔位对应经线 */
function toCard(bits) {
  return {
    kind: 'card', w: bits.w, h: bits.h,
    cards: bits.rows.map(r => r.split('').map(ch => (ch === '1' ? 1 : 0)))
  };
}
function fromCard(card) {
  return bitsFromRows(card.cards.map(c => c.map(v => (v ? '1' : '0')).join('')), card.w, card.h);
}

/* 打孔纸带：逐行折返成连续条带，默认 8 通道 */
function toTape(bits, lanes) {
  const L = lanes || 8;
  return { kind: 'tape', w: bits.w, h: bits.h, lanes: L, strip: bits.rows.join('') };
}
function fromTape(tape) {
  const w = tape.w, h = tape.h, s = tape.strip;
  const rows = [];
  for (let i = 0; i < h; i++) rows.push(s.slice(i * w, (i + 1) * w));
  return bitsFromRows(rows, w, h);
}
/** 纸带可视化排布：第 k 位（k = i*w + j）落在 lane = k % lanes、col = ⌊k/lanes⌋ */
function tapeLayout(bits, lanes) {
  const L = lanes || 8;
  const total = bits.w * bits.h;
  const cols = Math.ceil(total / L);
  const out = [];
  for (let i = 0; i < bits.h; i++) {
    for (let j = 0; j < bits.w; j++) {
      const k = i * bits.w + j;
      out.push({ i: i, j: j, k: k, lane: k % L, col: Math.floor(k / L), bit: bits.rows[i][j] });
    }
  }
  return { lanes: L, cols: cols, cells: out };
}

/* 二进制串 */
function toBinary(bits, group) {
  const g = group || 0;
  const raw = bits.rows.join('');
  const pretty = g > 0 ? bits.rows.map(r => r.replace(new RegExp('(.{' + g + '})', 'g'), '$1 ').trim()).join(' ') : raw;
  return { kind: 'binary', w: bits.w, h: bits.h, str: raw, pretty: pretty };
}
function fromBinary(bin) {
  const s = String(bin.str).replace(/[^01]/g, '');
  const w = bin.w, h = bin.h;
  const rows = [];
  for (let i = 0; i < h; i++) rows.push(s.slice(i * w, (i + 1) * w));
  return bitsFromRows(rows, w, h);
}

/* 像素矩阵 */
function toPixels(bits) {
  return {
    kind: 'pixels', w: bits.w, h: bits.h,
    px: bits.rows.map(r => r.split('').map(ch => (ch === '1' ? 1 : 0)))
  };
}
function fromPixels(px) {
  return bitsFromRows(px.px.map(r => r.map(v => (v ? '1' : '0')).join('')), px.w, px.h);
}

/** 五种介质：to 为正转，from 为逆转（二者必须互逆） */
const MODALITIES = [
  { id: 'flower', zh: '花本线', en: 'knotted cords', to: identityBits, from: identityBits },
  { id: 'card', zh: '穿孔卡片', en: 'punched cards', to: toCard, from: fromCard },
  { id: 'tape', zh: '打孔纸带', en: 'punched tape', to: toTape, from: fromTape },
  { id: 'binary', zh: '二进制串', en: 'bit string', to: toBinary, from: fromBinary },
  { id: 'pixels', zh: '像素矩阵', en: 'pixel matrix', to: toPixels, from: fromPixels }
];

function modalityById(id) {
  for (let i = 0; i < MODALITIES.length; i++) if (MODALITIES[i].id === id) return MODALITIES[i];
  return null;
}

/* ---------- 0.6 算法四：loomTiming 织造时序 ---------- */

/**
 * 每纬的综框提升序列与投梭顺序。
 * 大花楼的实际分工：地综由踏板控制整组升降；花部由花本经束综单独控制，
 * 因此一纬之内可能先投一把地纬、再按花色投入若干把小梭（通经断纬）。
 */
function loomTiming(pattern, structure) {
  const st = STRUCTURES[structure] ? structure : 'plain';
  const P = STRUCTURES[st].period;
  const w = pattern.w, h = pattern.h;
  const picks = [];
  let shuttlePasses = 0, colourPasses = 0;
  for (let i = 0; i < h; i++) {
    const groundFrames = [];
    for (let f = 0; f < P; f++) if (frameLift(st, i, f) === 1) groundFrames.push(f + 1);
    const colours = [];
    for (let j = 0; j < w; j++) {
      const ci = pattern.color[i][j];
      if (pattern.lift[i][j] === '1' && ci > 0 && colours.indexOf(ci) < 0) colours.push(ci);
    }
    colours.sort(function (a, b) { return a - b; });
    const shuttles = [{ order: 1, role: 'ground', color: null, key: 'B' }];
    for (let c = 0; c < colours.length; c++) {
      shuttles.push({ order: shuttles.length + 1, role: 'color', color: colours[c], key: COLOR_KEYS[colours[c] - 1] });
    }
    let finalLift = '';
    for (let j = 0; j < w; j++) finalLift += (pattern.lift[i][j] === '1') ? '0' : String(groundLift(st, i, j));
    picks.push({
      weft: i + 1,
      groundFrames: groundFrames,
      colours: colours,
      shuttles: shuttles,
      shuttleCount: shuttles.length,
      finalLift: finalLift,
      figureCount: pattern.lift[i].split('1').length - 1
    });
    shuttlePasses += shuttles.length;
    colourPasses += colours.length;
  }
  return {
    w: w, h: h, structure: st, period: P, frameCount: P,
    totalPicks: picks.length,
    totalShuttlePasses: shuttlePasses,
    totalColourPasses: colourPasses,
    picks: picks
  };
}

/* ---------- 0.7 教学包文本生成（纯函数，可测） ---------- */

function csvEscape(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function huabenRows(pattern) {
  const rows = [];
  const head = ['纬号'];
  for (let j = 1; j <= pattern.w; j++) head.push('经' + j);
  head.push('提花数');
  rows.push(head);
  for (let i = 0; i < pattern.h; i++) {
    const row = [i + 1];
    for (let j = 0; j < pattern.w; j++) row.push(pattern.lift[i][j]);
    row.push(pattern.lift[i].split('1').length - 1);
    rows.push(row);
  }
  return rows;
}

function timingRows(pattern, structure) {
  const t = loomTiming(pattern, structure);
  const rows = [['纬号', '地综提升（片）', '花部提沉', '彩纬（配色位）', '投梭顺序', '投梭数', '最终经线提升']];
  for (let i = 0; i < t.picks.length; i++) {
    const p = t.picks[i];
    const order = p.shuttles.map(function (s) {
      return s.role === 'ground' ? '地纬(大梭)' : '彩纬-' + COLOR_META[s.key][LANG_KEY];
    }).join(' → ');
    rows.push([
      p.weft,
      p.groundFrames.join('/'),
      pattern.lift[i],
      p.colours.length ? p.colours.join('/') : '—',
      order,
      p.shuttleCount,
      p.finalLift
    ]);
  }
  return rows;
}

function toCSV(rows) {
  return rows.map(function (r) { return r.map(csvEscape).join(','); }).join('\r\n') + '\r\n';
}

function toMarkdown(rows, caption) {
  const head = rows[0];
  let out = '| ' + head.join(' | ') + ' |\n';
  out += '| ' + head.map(function () { return '---'; }).join(' | ') + ' |\n';
  for (let i = 1; i < rows.length; i++) out += '| ' + rows[i].join(' | ') + ' |\n';
  return (caption ? '**' + caption + '**\n\n' : '') + out;
}

/* ============================================================
   1 · 国际化与文案
   ============================================================ */

/** 当前语言键（算法层导出时序表时需要一个默认值） */
let LANG_KEY = 'zh';

/** 术语 / 纹样 / 节点条数：界面文案里的数字直接从数据读出，避免与代码漂移。
    用 try/catch 取值，使本文件在 Node 里被 require（数据脚本未加载）时安全降级为 0。 */
const N_TERMS = (function () { try { return TERMS.length; } catch (e) { return 0; } })();
const N_PATTERNS = (function () { try { return PATTERNS.length; } catch (e) { return 0; } })();
const N_TIMELINE = (function () { try { return TIMELINE.length; } catch (e) { return 0; } })();

const TXT = {
  zh: {
    skip: '跳到主要操作区',
    nav_1: '纹样工坊', nav_2: '挑花结本', nav_3: '投梭织造', nav_4: '五态同构',
    nav_5: '织物库', nav_6: '时间线', nav_7: '术语库', nav_8: '教学包', nav_9: '团队',
    motion_off: '减弱动效',
        cover_kicker: '全国大学生数字媒体科技作品及创意竞赛 · 数字艺术与可视化设计',
    cover_sub: '从挑花结本到二进制的技术文明谱系',
    cover_lead: '一千多年前，南京云锦的织工用一根根丝线编成「花本」，控制大花楼织机上哪几根经线提起、哪几根沉下。那是一份可以卷起来、换下来、复制的程序。今天，我们把它交回你手里：在格子上画一朵团花，看它变成花本、变成穿孔卡片、变成打孔纸带、变成二进制串、变成像素——同一份编码，五种介质。',
    cover_lead_en: 'A thousand years ago, weavers in Nanjing knotted silk cords into a «flower book» — a programme telling a great drawloom which warp threads to raise. This work hands that programme back to you: draw a roundel on a grid and watch it become cords, a punched card, a paper tape, a bit string, a pixel matrix. One encoding, five media.',
    cover_cta: '开始织造 · Start weaving',
    cover_cta2: '先看五态同构',
    cover_art_cap: '缠枝莲 · 五枚缎纹织造示意 · Canvas 程序生成',
    cover_spec: '四段可复算算法 · ' + N_TERMS + ' 条双语术语 · ' + N_PATTERNS + ' 件云锦纹样 · ' + N_TIMELINE + ' 个技术史节点 · 零依赖离线运行',
    ws_title: '纹样工坊', ws_sub: 'Pattern workshop — 在网格上点出一朵花，它将成为一份程序',
    ws_desc: '选择网格尺寸与云锦四色之一，然后点击或拖拽上色。撤销栈会记住每一次落笔；载入预设可以看传统的团花、缠枝莲、四合云与织金几何是怎么排布的。',
    ws_undo: '撤销', ws_clear: '清空', ws_random: '随机',
    ws_hint: '方向键移动光标，空格或回车落色；也可直接点击或按住拖拽。',
    ws_readout: '编码摘要',
    ws_tips: '三步上手',
    ws_s1: '选一色，在格子上点出花纹；或直接载入一件传统纹样。',
    ws_s2: '切到 02 看它被编译成花本：每一纬一串 0 与 1。',
    ws_s3: '在 03 按播放，一梭一梭织出来；再去 04 点任意一位看五态联动。',
    dr_title: '挑花结本', dr_sub: 'Pattern drafting — 把纹样编译成每一纬的提沉序列',
    dr_desc: '挑花结本是把纹样换算成经纬编码、再用丝线编结成「花本」的工序。下图竖线为经（脚子线），横线为纬（耳子线），每一个结扣代表该纬该经「提」——这正是本作品的 compileToPattern 所做的事。',
    dr_huaben: '花本线结构', dr_hint: '点击任意一纬，或使用上方单步按钮，查看该纬的提沉序列。',
    dr_code: '提沉编码', dr_stats: '花本统计',
    wv_title: '投梭织造', wv_sub: 'Weaving — 逐纬交织，看组织如何决定浮长',
    wv_desc: '花部以彩纬浮于表面，地部按所选组织交织。组织循环决定地部的律动：平纹 2、三枚斜纹 3、五枚缎纹 5。放大镜可以看到单个织点的经纬压覆关系。',
    wv_play: '播放', wv_pause: '暂停', wv_step: '单步', wv_reset: '复位', wv_speed: '速度',
    wv_hl_weft: '高亮当前纬', wv_hl_warp: '高亮当前经', wv_face: '显示经浮 / 纬浮',
    wv_metrics: '织造数值',
    fv_title: '五态同构', fv_sub: 'Five isomorphic states — 同一份编码的五种介质',
    fv_desc: '把同一份纹样编码并排铺开：花本线上有没有那一个结、卡片上有没有那一个孔、纸带上有没有那一个眼、二进制位是 0 还是 1、像素是亮还是暗——点击任意一态中的某一位，另外四态会同时亮起同一位。',
    fv_schematic: '数据视图', fv_material: '实物视图', fv_random: '随机一位',
    fv_m1: '花本线', fv_m1s: 'knotted cords', fv_m1n: '结扣 = 提；无结 = 沉。一纬一串结。',
    fv_m2: '穿孔卡片', fv_m2s: 'punched cards', fv_m2n: '一卡一纬，孔位对应经线。',
    fv_m3: '打孔纸带', fv_m3s: 'punched tape', fv_m3n: '八通道 · 孔距 2.54 mm · 折返读取',
    fv_m4: '二进制串', fv_m4s: 'bit string', fv_m4n: '逐纬一行，一位一比特。',
    fv_m5: '像素矩阵', fv_m5s: 'pixel matrix', fv_m5n: '亮像素 = 提，暗像素 = 沉。',
    fv_hint: '提示：五态互转在算法层可逆——toCard / toTape / toBinary / toPixels 与对应的 from* 逐位还原。',
    fv_idle: '— 请点击任一位 —',
    lb_title: '织物库', lb_sub: 'Fabric library — 六件云锦纹样的「纹样 → 花本 → 织物」三态',
    lb_desc: '每一件都完整走完编译与织造：左为纹样矩阵，中为编译所得的花本提沉，右为按五枚缎纹织出的织物。点击「载入工坊」可把它送进 01 继续修改。',
    tl_title: '织造时间线', tl_sub: 'Timeline — 中西双轨，八个节点',
    tl_desc: '左列是中国轨，只讲同一时期的中国；右列是西方轨，只讲同一时期的世界。1804 年之后的雅卡尔机、霍列瑞斯制表机与存储程序都归在西方轨，中国轨讲那一时期的中国织造处境。点击节点查看详情；在本模块内按 ← → 可逐步切换。每条史实都标注了来源类别。',
    tl_prev: '← 上一节点', tl_next: '下一节点 →',
    tm_title: '术语库', tm_sub: 'Terminology — ' + N_TERMS + ' 条中英双语术语',
    tm_desc: '六个分类：织造组织、纹样母题、材料工艺、织机结构、技术史、术语对照。支持中文、英文与释义全文检索。',
    tm_ph: '检索：团花 / roundel / 花本 / 通经断纬…', tm_empty: '没有匹配的术语，试试其他关键词。',
    tc_title: '教学包', tc_sub: 'Teaching pack — 一键导出花本表与织造时序表',
    tc_desc: '把当前纹样的花本编码与逐纬综框提升序列导出为 CSV 或 Markdown，可直接用于课堂演示与作业。全部在本地生成，不联网。',
    tc_b1: '导出花本表 CSV', tc_b2: '导出织造时序表 CSV', tc_b3: '导出花本表 Markdown',
    tc_b4: '导出时序表 Markdown', tc_b5: '复制时序表', tc_export: '导出内容说明',
    te_title: '团队 · 制作 · AI 披露', te_sub: 'Team, making, and disclosure',
    te_desc: '本页列明原创资产边界、分工方式与 AI 使用情况。所有结论均可与随包交付的测试脚本互相核对。',
    te_orig: '原创资产界定', te_ai: 'AI 使用披露', te_pending: '待替换影像位置清单',
    te_pending_note: '下列位置当前由 Canvas 噪声与渐变程序生成，无图亦可正常显示；Lead 替换 AI 影像后代码无需改动。',
    te_verify: '可验证性',
        foot_1: '从挑花结本到二进制的技术文明谱系 ｜ 全国大学生数字媒体科技作品及创意竞赛 · 数字艺术与可视化设计｜ 2026',
    foot_2: '全部视觉由自绘 SVG / Canvas / CSS 程序生成，零外部依赖，双击即开。'
  },
  en: {
    skip: 'Skip to the main workbench',
    nav_1: 'Workshop', nav_2: 'Drafting', nav_3: 'Weaving', nav_4: 'Five states',
    nav_5: 'Fabric library', nav_6: 'Timeline', nav_7: 'Terminology', nav_8: 'Teaching pack', nav_9: 'Team',
    motion_off: 'Reduce motion',
      cover_kicker: 'National Student Competition in Digital Media Technology · Digital Art and Visualization Design',
    cover_sub: 'The Silk Road of Code: from pattern drafting to binary',
    cover_lead: 'A thousand years ago, weavers in Nanjing knotted silk cords into a «flower book» that told a great drawloom which warp threads to raise and which to sink. It was a programme that could be rolled up, swapped out and copied. This work hands it back to you: draw a roundel on a grid and watch it become a cord pattern book, a punched card, a paper tape, a bit string, a pixel matrix — one encoding, five media.',
    cover_lead_en: 'A thousand years ago, weavers in Nanjing knotted silk cords into a «flower book» — a programme telling a great drawloom which warp threads to raise. This work hands that programme back to you: draw a roundel on a grid and watch it become cords, a punched card, a paper tape, a bit string, a pixel matrix. One encoding, five media.',
    cover_cta: 'Start weaving',
    cover_cta2: 'See the five states',
    cover_art_cap: 'Lotus scroll woven on a five-end satin · generated in Canvas',
    cover_spec: '4 recomputable algorithms · ' + N_TERMS + ' bilingual terms · ' + N_PATTERNS + ' brocade patterns · ' + N_TIMELINE + ' historical nodes · zero dependencies, runs offline',
    ws_title: 'Pattern workshop', ws_sub: 'Tap out a flower on a grid; it becomes a programme',
    ws_desc: 'Pick a grid size and one of the four brocade colours, then click or drag to paint. The undo stack remembers every stroke; presets show how roundels, lotus scrolls, four-way clouds and gold lattices are actually laid out.',
    ws_undo: 'Undo', ws_clear: 'Clear', ws_random: 'Random',
    ws_hint: 'Arrow keys move the cursor; Space or Enter paints. You can also click, or press and drag.',
    ws_readout: 'Encoding summary',
    ws_tips: 'Three steps',
    ws_s1: 'Choose a colour and tap out a motif, or load a traditional pattern.',
    ws_s2: 'Go to 02 and see it compiled into cords: one string of 0s and 1s per pick.',
    ws_s3: 'Press play in 03 to weave it pick by pick, then click any bit in 04 to see the five states move together.',
    dr_title: 'Pattern drafting', dr_sub: 'Compiling the design into a lift sequence for every pick',
    dr_desc: 'Pattern drafting converts a design into a warp/weft code and knots it into a «pattern book». Below, vertical lines are warp cords and horizontal lines are weft cords; every knot marks a raised end — exactly what compileToPattern does in this work.',
    dr_huaben: 'Cord structure', dr_hint: 'Click any pick, or use the arrows above, to inspect its lift sequence.',
    dr_code: 'Lift code', dr_stats: 'Pattern-book statistics',
    wv_title: 'Weaving', wv_sub: 'Pick by pick, and how the weave sets the float',
    wv_desc: 'The figure appears as colour weft floating on the face; the ground interlaces according to the chosen weave. The weave repeat sets the rhythm: 2 for plain, 3 for a three-end twill, 5 for a five-end satin. The lens shows how warp and weft cross at a single binding point.',
    wv_play: 'Play', wv_pause: 'Pause', wv_step: 'Step', wv_reset: 'Reset', wv_speed: 'Speed',
    wv_hl_weft: 'Highlight current pick', wv_hl_warp: 'Highlight current end', wv_face: 'Show warp / weft face',
    wv_metrics: 'Weaving metrics',
    fv_title: 'Five isomorphic states', fv_sub: 'One encoding carried by five media',
    fv_desc: 'The same encoding laid out side by side: a knot on the cord, a hole in the card, a perforation in the tape, a 0 or a 1 in the bit string, a lit or dark pixel. Click any single bit in any state and the other four light up at the same position.',
    fv_schematic: 'Data view', fv_material: 'Material view', fv_random: 'Random bit',
    fv_m1: 'Knotted cords', fv_m1s: 'hua ben', fv_m1n: 'Knot = raised; no knot = sunk. One cord of knots per pick.',
    fv_m2: 'Punched cards', fv_m2s: 'Jacquard', fv_m2n: 'One card per pick; hole positions are warp ends.',
    fv_m3: 'Punched tape', fv_m3s: '8 channels', fv_m3n: '8 channels · 2.54 mm pitch · folded runs',
    fv_m4: 'Bit string', fv_m4s: 'binary', fv_m4n: 'One row per pick, one bit per end.',
    fv_m5: 'Pixel matrix', fv_m5s: 'digital', fv_m5n: 'Lit pixel = raised, dark pixel = sunk.',
    fv_hint: 'Note: the five conversions are reversible in code — toCard / toTape / toBinary / toPixels each pair with a from* that restores every bit.',
    fv_idle: '— click any bit —',
    lb_title: 'Fabric library', fv_unused: '', lb_sub: 'Six brocade patterns, each shown as design → pattern book → fabric',
    lb_desc: 'Every entry runs the full pipeline: the design matrix on the left, the compiled lift code in the middle, the fabric woven on a five-end satin on the right. Press «Load into workshop» to keep editing it in 01.',
    tl_title: 'Timeline', tl_sub: 'Eight nodes on two tracks, Chinese and Western',
    tl_desc: 'The left track is China only; the right track is the rest of the world only. After 1804 the Jacquard loom, the Hollerith tabulator and the stored program all sit on the Western track, while the Chinese track tells what Chinese weaving was doing at the same time. Click a node for detail; press ← → inside this section to step through. Every entry carries its source category.',
    tl_prev: '← Previous', tl_next: 'Next →',
    tm_title: 'Terminology', tm_sub: N_TERMS + ' bilingual terms',
    tm_desc: 'Six categories: weave structures, pattern motifs, materials and craft, loom structure, technology history, and term concordance. Search in Chinese, English or the full gloss.',
    tm_ph: 'Search: roundel / 花本 / weft float / 妆花…', tm_empty: 'No matching term. Try another keyword.',
    tc_title: 'Teaching pack', tc_sub: 'Export the pattern-book table and the weaving schedule',
    tc_desc: 'Export the current pattern-book code and the per-pick heddle sequence as CSV or Markdown for classroom use. Everything is generated locally; nothing is uploaded.',
    tc_b1: 'Export pattern book (CSV)', tc_b2: 'Export weaving schedule (CSV)', tc_b3: 'Export pattern book (Markdown)',
    tc_b4: 'Export weaving schedule (Markdown)', tc_b5: 'Copy schedule', tc_export: 'What is exported',
    te_title: 'Team, making, and disclosure', te_sub: 'Original assets, division of labour, and AI use',
    te_desc: 'This page states the boundary of original assets, how the work was divided, and exactly where AI was used. Every claim here can be checked against the test scripts shipped with the work.',
    te_orig: 'Original assets', te_ai: 'AI disclosure', te_pending: 'Image slots awaiting AI footage',
    te_pending_note: 'These slots are currently filled by procedurally generated Canvas noise and gradients. The work displays correctly without any image; replacing them with AI footage needs no code change.',
    te_verify: 'Verifiability',
      foot_1: 'From pattern drafting to binary: a genealogy of technical civilisation ｜ National Student Competition in Digital Media Technology · Digital Art and Visualization Design ｜ 2026',
    foot_2: 'every visual is generated by hand-written SVG / Canvas / CSS. Zero dependencies; open by double-click.'
  }
};

function t(key) {
  const pack = TXT[LANG_KEY] || TXT.zh;
  return pack[key] !== undefined ? pack[key] : (TXT.zh[key] !== undefined ? TXT.zh[key] : key);
}

/** 双语文案取值 */
function pick(obj) {
  if (obj === null || obj === undefined) return '';
  if (typeof obj === 'string') return obj;
  return obj[LANG_KEY] !== undefined ? obj[LANG_KEY] : (obj.zh !== undefined ? obj.zh : '');
}

/* ============================================================
   2 · 应用状态
   ============================================================ */

const S = {
  size: 16,
  color: 'B',
  design: null,
  undo: [],
  pattern: null,
  structure: 'satin5',
  draftIndex: 0,
  weave: { progress: 0, playing: false, speed: 3, timer: null, focus: null, hlWarp: false, hlWeft: true, showFace: false },
  sync: null,
  syncSource: null,
  fiveView: 'schematic',
  tlIndex: 0,
  termCat: 'all',
  termQuery: '',
  reduceMotion: false
};

function $(id) { return document.getElementById(id); }
function el(tag, cls, txt) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt !== undefined && txt !== null) n.textContent = txt;
  return n;
}

/* ============================================================
   3 · Canvas 织物质感（封面 / 织物库，程序生成，无外部图片）
   ============================================================ */

/** 抽象织物质感：经纬细线 + 噪声 + 光斑；cover 上还有一道缓慢移动的梭光 */
function paintSilkTexture(ctx, w, h, opts) {
  const o = opts || {};
  const seed = o.seed || 7;
  let s = seed;
  const rnd = function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = o.base || '#0d1114';
  ctx.fillRect(0, 0, w, h);

  // 经线：竖细线，密度随宽度
  const step = o.step || 7;
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += step) {
    const a = 0.08 + rnd() * 0.15;
    ctx.strokeStyle = 'rgba(196,214,222,' + a.toFixed(3) + ')';
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
    ctx.stroke();
  }
  // 纬线：横细线
  for (let y = 0; y < h; y += step) {
    const a = 0.05 + rnd() * 0.11;
    ctx.strokeStyle = 'rgba(184,134,11,' + a.toFixed(3) + ')';
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }
  // 噪声点
  const dots = Math.round((w * h) / 900);
  for (let i = 0; i < dots; i++) {
    ctx.fillStyle = 'rgba(223,232,236,' + (0.02 + rnd() * 0.06).toFixed(3) + ')';
    ctx.fillRect(Math.floor(rnd() * w), Math.floor(rnd() * h), 1, 1);
  }
  // 大光斑
  const g = ctx.createRadialGradient(w * 0.66, h * 0.28, 0, w * 0.66, h * 0.28, Math.max(w, h) * 0.72);
  g.addColorStop(0, 'rgba(47,107,138,0.22)');
  g.addColorStop(0.55, 'rgba(28,63,82,0.10)');
  g.addColorStop(1, 'rgba(8,11,13,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const g2 = ctx.createRadialGradient(w * 0.14, h * 0.86, 0, w * 0.14, h * 0.86, Math.max(w, h) * 0.55);
  g2.addColorStop(0, 'rgba(184,134,11,0.10)');
  g2.addColorStop(1, 'rgba(8,11,13,0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, w, h);

  if (o.shuttle) {
    const sx = o.shuttle;
    const gg = ctx.createLinearGradient(sx - 90, 0, sx + 90, 0);
    gg.addColorStop(0, 'rgba(184,134,11,0)');
    gg.addColorStop(0.5, 'rgba(230,194,90,0.16)');
    gg.addColorStop(1, 'rgba(184,134,11,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(sx - 90, 0, 180, h);
  }
}

/* ============================================================
   4 · 模块 1：纹样工坊
   ============================================================ */

function renderSwatches() {
  const host = $('swatches');
  host.innerHTML = '';
  const labels = { B: 1, W: 1, G: 1, K: 1 };
  // 橡皮在最前
  const eraser = el('button', 'swatch' + (S.color === null ? ' on' : ''));
  eraser.type = 'button';
  eraser.dataset.color = '';
  eraser.dataset.label = LANG_KEY === 'zh' ? '橡皮' : 'erase';
  eraser.setAttribute('aria-label', LANG_KEY === 'zh' ? '橡皮：擦除该格' : 'Eraser');
  eraser.setAttribute('aria-pressed', S.color === null ? 'true' : 'false');
  eraser.addEventListener('click', function () { setColour(null); });
  host.appendChild(eraser);
  COLOR_KEYS.forEach(function (k) {
    const b = el('button', 'swatch' + (S.color === k ? ' on' : ''));
    b.type = 'button';
    b.dataset.color = k;
    b.dataset.label = COLOR_META[k][LANG_KEY];
    b.setAttribute('aria-label', COLOR_META[k].zh + ' / ' + COLOR_META[k].en);
    b.setAttribute('aria-pressed', S.color === k ? 'true' : 'false');
    b.addEventListener('click', function () { setColour(k); });
    host.appendChild(b);
  });
}

function setColour(k) {
  S.color = k;
  renderSwatches();
  const live = $('wsLive');
  if (live) live.textContent = k ? (LANG_KEY === 'zh' ? '当前颜色：' + COLOR_META[k].zh : 'Current colour: ' + COLOR_META[k].en)
    : (LANG_KEY === 'zh' ? '当前：橡皮' : 'Current: eraser');
}

function renderPresets() {
  const host = $('wsPresets');
  host.innerHTML = '';
  PATTERNS.slice(0, 4).forEach(function (p) {
    const b = el('button', 'preset-btn');
    b.type = 'button';
    const cv = document.createElement('canvas');
    cv.width = 44; cv.height = 44;
    b.appendChild(cv);
    b.appendChild(document.createTextNode(p[LANG_KEY] || p.zh));
    b.setAttribute('aria-label', (LANG_KEY === 'zh' ? '载入预设：' : 'Load preset: ') + (p[LANG_KEY] || p.zh));
    b.addEventListener('click', function () {
      loadDesignIntoWorkshop(designFromRows(p.map));
    });
    host.appendChild(b);
    paintDesignThumb(cv, designFromRows(p.map));
  });
}

function paintDesignThumb(canvas, design) {
  const ctx = canvas.getContext('2d');
  const d = normalizeDesign(design);
  const n = Math.max(d.w, d.h);
  const cell = canvas.width / n;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0b0f12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < d.h; i++) {
    for (let j = 0; j < d.w; j++) {
      const c = d.cells[i][j];
      ctx.fillStyle = c ? COLOR_META[c].hex : '#1b2228';
      ctx.fillRect(j * cell, i * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }
}

function buildGrid() {
  const grid = $('wsGrid');
  const n = S.size;
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = 'repeat(' + n + ', minmax(0, 1fr))';
  grid.setAttribute('aria-rowcount', String(n));
  grid.setAttribute('aria-colcount', String(n));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const b = el('button', 'cell');
      b.type = 'button';
      b.dataset.i = String(i);
      b.dataset.j = String(j);
      b.tabIndex = (i === 0 && j === 0) ? 0 : -1;
      b.setAttribute('role', 'gridcell');
      const c = S.design.cells[i][j];
      b.dataset.color = c || '';
      b.setAttribute('aria-label', cellLabel(i, j, c));
      grid.appendChild(b);
    }
  }
}

function cellLabel(i, j, c) {
  const pos = LANG_KEY === 'zh'
    ? '第 ' + (i + 1) + ' 纬 第 ' + (j + 1) + ' 经'
    : 'pick ' + (i + 1) + ', end ' + (j + 1);
  const col = c ? COLOR_META[c][LANG_KEY] : (LANG_KEY === 'zh' ? '空' : 'empty');
  return pos + ' · ' + col;
}

function setCell(i, j, color) {
  if (!S.design.cells[i]) return;
  S.design.cells[i][j] = color;
  const grid = $('wsGrid');
  const idx = i * S.size + j;
  const btn = grid.children[idx];
  if (btn) {
    btn.dataset.color = color || '';
    btn.setAttribute('aria-label', cellLabel(i, j, color));
  }
}

function pushUndo() {
  S.undo.push(designToRows(S.design));
  if (S.undo.length > 80) S.undo.shift();
  const b = $('wsUndo');
  if (b) b.disabled = S.undo.length === 0;
}

function undo() {
  if (!S.undo.length) return;
  const rows = S.undo.pop();
  const d = designFromRows(rows);
  if (d.w !== S.size) { S.size = d.w; }
  S.design = d;
  buildGrid();
  commitDesign(false);
}

function loadDesignIntoWorkshop(design) {
  pushUndo();
  const d = resizeDesign(design, S.size);
  S.design = d;
  buildGrid();
  commitDesign(false);
  const live = $('wsLive');
  if (live) live.textContent = LANG_KEY === 'zh' ? '已载入预设纹样' : 'Preset loaded';
}

function randomDesign() {
  const n = S.size;
  const cells = [];
  const pal = COLOR_KEYS;
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) {
      const mirror = n - 1 - i;
      // 轴对称为传统纹样的常见做法：只算一半
      if (j > mirror) { row.push(null); continue; }
      const r = Math.random();
      row.push(r < 0.44 ? pal[Math.floor(Math.random() * 3)] : (r < 0.5 ? 'G' : null));
    }
    cells.push(row);
  }
  // 镜像补齐（沿副对角线对称）
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (j > n - 1 - i) cells[i][j] = cells[n - 1 - j][n - 1 - i];
    }
  }
  return { w: n, h: n, cells: cells };
}

function commitDesign(resetDraft) {
  S.pattern = compileToPattern(S.design);
  if (resetDraft !== false) S.draftIndex = 0;
  renderWorkshopReadout();
  renderDrafting();
  renderFive();
  S.weave.progress = 0;
  S.weave.playing = false;
  syncPlayButton();
  renderWeave();
  renderTeach();
}

function renderWorkshopReadout() {
  const p = S.pattern;
  const kv = $('wsKv');
  kv.innerHTML = '';
  const rows = [
    [LANG_KEY === 'zh' ? '网格' : 'Grid', S.size + ' × ' + S.size],
    [LANG_KEY === 'zh' ? '花位（提 = 1）' : 'Raised (1)', p.stats.flowers],
    [LANG_KEY === 'zh' ? '地位（沉 = 0）' : 'Sunk (0)', p.stats.ground],
    [LANG_KEY === 'zh' ? '提沉比' : 'Lift ratio', (p.stats.liftRatio * 100).toFixed(1) + '%'],
    [LANG_KEY === 'zh' ? '用色数' : 'Colours used', p.stats.coloursUsed],
    [LANG_KEY === 'zh' ? '编码总位' : 'Total bits', p.stats.total],
    [LANG_KEY === 'zh' ? '花本行数' : 'Pattern rows', p.h],
    [LANG_KEY === 'zh' ? '校验和' : 'Checksum', checksum(p)]
  ];
  rows.forEach(function (r) {
    kv.appendChild(el('dt', null, r[0]));
    kv.appendChild(el('dd', null, String(r[1])));
  });
}

function renderSteps() {
  const host = $('wsSteps');
  if (!host) return;
  host.innerHTML = '';
  ['ws_s1', 'ws_s2', 'ws_s3'].forEach(function (k) {
    host.appendChild(el('li', null, t(k)));
  });
}

function bindWorkshop() {
  document.querySelectorAll('.ws-toolbar .seg-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      const n = Number(b.dataset.size);
      if (n === S.size) return;
      document.querySelectorAll('.ws-toolbar .seg-btn').forEach(function (x) {
        x.classList.toggle('on', x === b);
      });
      pushUndo();
      S.size = n;
      S.design = resizeDesign(S.design, n);
      buildGrid();
      commitDesign(false);
    });
  });

  const grid = $('wsGrid');
  let painting = false;

  grid.addEventListener('pointerdown', function (e) {
    const c = e.target.closest('.cell');
    if (!c) return;
    e.preventDefault();
    pushUndo();
    painting = true;
    paintCell(c);
  });
  grid.addEventListener('pointermove', function (e) {
    if (!painting) return;
    const node = document.elementFromPoint(e.clientX, e.clientY);
    const c = node && node.closest ? node.closest('.cell') : null;
    if (c && grid.contains(c)) paintCell(c);
  });
  window.addEventListener('pointerup', function () { painting = false; });
  window.addEventListener('pointercancel', function () { painting = false; });

  function paintCell(c) {
    const i = Number(c.dataset.i), j = Number(c.dataset.j);
    if (S.design.cells[i][j] === S.color) return;
    setCell(i, j, S.color);
    commitDesign(false);
  }

  // 键盘：方向键移动，空格 / 回车落色
  grid.addEventListener('keydown', function (e) {
    const c = e.target.closest('.cell');
    if (!c) return;
    const i = Number(c.dataset.i), j = Number(c.dataset.j);
    let ni = i, nj = j, handled = true;
    if (e.key === 'ArrowUp') ni = Math.max(0, i - 1);
    else if (e.key === 'ArrowDown') ni = Math.min(S.size - 1, i + 1);
    else if (e.key === 'ArrowLeft') nj = Math.max(0, j - 1);
    else if (e.key === 'ArrowRight') nj = Math.min(S.size - 1, j + 1);
    else if (e.key === ' ' || e.key === 'Enter') {
      pushUndo();
      setCell(i, j, S.color);
      commitDesign(false);
    } else handled = false;
    if (!handled) return;
    e.preventDefault();
    if (ni !== i || nj !== j) {
      const next = grid.children[ni * S.size + nj];
      if (next) { c.tabIndex = -1; next.tabIndex = 0; next.focus(); }
    }
  });

  $('wsUndo').addEventListener('click', undo);
  $('wsUndo').disabled = true;
  $('wsClear').addEventListener('click', function () {
    pushUndo();
    S.design = blankDesign(S.size);
    buildGrid();
    commitDesign(false);
  });
  $('wsRandom').addEventListener('click', function () {
    pushUndo();
    S.design = randomDesign();
    buildGrid();
    commitDesign(false);
    const live = $('wsLive');
    if (live) live.textContent = LANG_KEY === 'zh' ? '已生成随机对称纹样' : 'Random symmetric design generated';
  });
}

/* ============================================================
   5 · 模块 2：挑花结本
   ============================================================ */

function renderDrafting() {
  const p = S.pattern;
  const n = p.w;
  $('drSize').textContent = n + ' × ' + p.h;
  const svg = $('huabenSvg');
  const NS = 'http://www.w3.org/2000/svg';
  const pad = 22, span = 360 - pad * 2;
  const step = span / n;
  svg.innerHTML = '';
  svg.setAttribute('viewBox', '0 0 360 360');

  const gRules = document.createElementNS(NS, 'g');
  // 经线（脚子线）
  for (let j = 0; j < n; j++) {
    const x = pad + (j + 0.5) * step;
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', x); line.setAttribute('x2', x);
    line.setAttribute('y1', pad - 8); line.setAttribute('y2', 360 - pad + 8);
    line.setAttribute('class', 'hb-warp');
    gRules.appendChild(line);
  }
  svg.appendChild(gRules);

  for (let i = 0; i < p.h; i++) {
    const y = pad + (i + 0.5) * step;
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'hb-row' + (i === S.draftIndex ? ' cur' : ''));
    g.dataset.row = String(i);
    const wl = document.createElementNS(NS, 'line');
    wl.setAttribute('x1', pad - 8); wl.setAttribute('x2', 360 - pad + 8);
    wl.setAttribute('y1', y); wl.setAttribute('y2', y);
    wl.setAttribute('class', 'hb-weftline');
    g.appendChild(wl);
    for (let j = 0; j < n; j++) {
      const x = pad + (j + 0.5) * step;
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', x); c.setAttribute('cy', y);
      c.setAttribute('r', Math.max(1.8, step * 0.26));
      c.setAttribute('class', 'hb-knot' + (p.lift[i][j] === '1' ? '' : ' off'));
      g.appendChild(c);
    }
    svg.appendChild(g);
  }
  // 纬号
  for (let i = 0; i < p.h; i++) {
    if (n > 8 && i % 2 !== 0) continue;
    const y = pad + (i + 0.5) * step;
    const tx = document.createElementNS(NS, 'text');
    tx.setAttribute('x', 6);
    tx.setAttribute('y', y + 2.6);
    tx.setAttribute('class', 'hb-idx');
    tx.textContent = String(i + 1).padStart(2, '0');
    svg.appendChild(tx);
  }

  svg.onclick = function (e) {
    const g = e.target.closest ? e.target.closest('.hb-row') : null;
    if (!g) return;
    setDraftIndex(Number(g.dataset.row));
  };

  // 提沉编码列表
  const list = $('drCode');
  list.innerHTML = '';
  for (let i = 0; i < p.h; i++) {
    const li = el('li', i === S.draftIndex ? 'cur' : '');
    li.dataset.row = String(i);
    li.appendChild(el('span', 'ci', String(i + 1).padStart(2, '0')));
    const cb = el('span', 'cb');
    p.lift[i].split('').forEach(function (ch) {
      if (ch === '1') { const b = el('b', null, '1'); cb.appendChild(b); }
      else cb.appendChild(document.createTextNode('0'));
    });
    li.appendChild(cb);
    li.addEventListener('click', function () { setDraftIndex(i); });
    list.appendChild(li);
  }
  renderDraftReadout();
  updateDraftFocus();
}

function setDraftIndex(i) {
  const h = S.pattern.h;
  S.draftIndex = ((i % h) + h) % h;
  updateDraftFocus();
  renderDraftReadout();
}

function updateDraftFocus() {
  const rows = $('huabenSvg').querySelectorAll('.hb-row');
  rows.forEach(function (g) { g.classList.toggle('cur', Number(g.dataset.row) === S.draftIndex); });
  const items = $('drCode').children;
  for (let i = 0; i < items.length; i++) items[i].classList.toggle('cur', i === S.draftIndex);
  const cur = items[S.draftIndex];
  if (cur && cur.scrollIntoView) {
    const box = $('drCode');
    const top = cur.offsetTop - box.offsetTop;
    if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - 24) box.scrollTop = top - 8;
  }
  $('drIdx').textContent = String(S.draftIndex + 1).padStart(2, '0') + ' / ' + S.pattern.h;
}

function renderDraftReadout() {
  const p = S.pattern;
  const i = S.draftIndex;
  const row = p.lift[i];
  const cnt = row.split('1').length - 1;
  const cols = [];
  for (let j = 0; j < p.w; j++) if (p.color[i][j] > 0) cols.push(COLOR_META[COLOR_KEYS[p.color[i][j] - 1]][LANG_KEY]);
  const uniq = cols.filter(function (v, k) { return cols.indexOf(v) === k; });
  $('drCurrent').textContent = (LANG_KEY === 'zh'
    ? '第 ' + (i + 1) + ' 纬 · 提 ' + cnt + ' / ' + p.w + ' 位 · 彩纬：' + (uniq.length ? uniq.join('、') : '无')
    : 'Pick ' + (i + 1) + ' · raised ' + cnt + '/' + p.w + ' · colour wefts: ' + (uniq.length ? uniq.join(', ') : 'none'))
    + '  ·  ' + row;

  const kv = $('drKv');
  kv.innerHTML = '';
  const t0 = loomTiming(p, S.structure);
  const rows = [
    [LANG_KEY === 'zh' ? '花本总纬数' : 'Total picks', p.h],
    [LANG_KEY === 'zh' ? '每纬位数（经数）' : 'Ends per pick', p.w],
    [LANG_KEY === 'zh' ? '编码总位' : 'Total bits', p.h * p.w],
    [LANG_KEY === 'zh' ? '花位比例' : 'Raised share', (p.stats.liftRatio * 100).toFixed(1) + '%'],
    [LANG_KEY === 'zh' ? '本纬提花数' : 'Raised on this pick', cnt],
    [LANG_KEY === 'zh' ? '总投梭次数' : 'Shuttle passes', t0.totalShuttlePasses],
    [LANG_KEY === 'zh' ? '校验和' : 'Checksum', checksum(p)]
  ];
  rows.forEach(function (r) {
    kv.appendChild(el('dt', null, r[0]));
    kv.appendChild(el('dd', null, String(r[1])));
  });
}

function bindDrafting() {
  $('drPrev').addEventListener('click', function () { setDraftIndex(S.draftIndex - 1); });
  $('drNext').addEventListener('click', function () { setDraftIndex(S.draftIndex + 1); });
}

/* ============================================================
   6 · 模块 3：投梭织造
   ============================================================ */

/* ---------- 织物渲染 ----------
   纹样矩阵的 1 格 = 1 个织点（花本中的一位）；但真实织物上每一格仍由多根
   经纬交织而成，因此渲染时按 OVERSAMPLE 倍过采样，让地部呈现真实的细密织纹，
   而花部因彩纬浮长而成为整块色面——这正是妆花缎的观感。            */
const OVERSAMPLE = 2;

function drawThread(ctx, x, y, s, face, hex) {
  ctx.fillStyle = hex;
  ctx.fillRect(x, y, s, s);
  const a = Math.min(0.20, Math.max(0.07, s / 150));
  const g = face === 'warp'
    ? ctx.createLinearGradient(x, 0, x + s, 0)
    : ctx.createLinearGradient(0, y, 0, y + s);
  g.addColorStop(0, 'rgba(8,11,13,' + (a * 1.15).toFixed(3) + ')');
  g.addColorStop(0.44, 'rgba(255,255,255,' + a.toFixed(3) + ')');
  g.addColorStop(0.70, 'rgba(255,255,255,' + (a * 0.22).toFixed(3) + ')');
  g.addColorStop(1, 'rgba(8,11,13,' + (a * 1.25).toFixed(3) + ')');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, s, s);
  if (s >= 12) {
    ctx.strokeStyle = 'rgba(8,11,13,0.10)';
    ctx.lineWidth = Math.max(0.6, s * 0.03);
    const ts = [0.32, 0.68];
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      if (face === 'warp') { ctx.moveTo(x + s * ts[k], y); ctx.lineTo(x + s * ts[k], y + s); }
      else { ctx.moveTo(x, y + s * ts[k]); ctx.lineTo(x + s, y + s * ts[k]); }
      ctx.stroke();
    }
  }
}

/**
 * 按过采样绘制织物。
 * opts: { x, y, size, k, threadRows }
 *   size = 目标区域边长（px）；k = 每织点的线程数；threadRows = 只画到第几根纬线
 */
function drawFabricArea(ctx, wv, opts) {
  const k = opts.k || 1;
  const W = wv.w * k, H = wv.h * k;
  const ts = opts.size / W;
  const rows = opts.threadRows === undefined ? H : Math.max(0, Math.min(H, opts.threadRows));
  const st = wv.structure;
  for (let ti = 0; ti < rows; ti++) {
    const i = Math.floor(ti / k);
    const y = opts.y + ti * ts;
    for (let tj = 0; tj < W; tj++) {
      const j = Math.floor(tj / k);
      const c = wv.cells[i][j];
      let face, hex;
      if (c.flower) {
        face = 'weft'; hex = COLOR_META[c.color].hex;
      } else {
        face = groundLift(st, ti, tj) ? 'warp' : 'weft';
        hex = face === 'warp' ? SILK.warp : SILK.weft;
      }
      drawThread(ctx, opts.x + tj * ts, y, ts + 0.6, face, hex);
      if (opts.highlightFace && !c.flower && face === 'weft') {
        ctx.fillStyle = 'rgba(28,63,82,0.34)';
        ctx.fillRect(opts.x + tj * ts, y, ts + 0.6, ts + 0.6);
      }
    }
  }
  return { thread: ts, W: W, H: H };
}

function renderWeave() {
  const cv = $('weaveCanvas');
  if (!cv || !S.pattern) return;
  const ctx = cv.getContext('2d');
  const wv = weaveSimulate(S.pattern, S.structure);
  const k = OVERSAMPLE;
  const n = S.pattern.w;
  const H = wv.h * k;
  const ts = cv.width / (wv.w * k);
  const shownDesign = Math.max(1, Math.min(wv.h, S.weave.progress));
  const shownThreads = shownDesign * k;

  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#0b0f12';
  ctx.fillRect(0, 0, cv.width, cv.height);

  // 织机上的裸经面：未织区域先露出经线，织物向下生长把经线盖住
  const threadW = cv.width / (wv.w * k);
  for (let tj = 0; tj < wv.w * k; tj += 1) {
    const a = 0.030 + (tj % k === 0 ? 0.022 : 0);
    ctx.fillStyle = 'rgba(196,214,222,' + a.toFixed(3) + ')';
    ctx.fillRect(tj * threadW, 0, Math.max(1, threadW * 0.46), cv.height);
  }

  drawFabricArea(ctx, wv, { x: 0, y: 0, size: cv.width, k: k, threadRows: shownThreads, highlightFace: S.weave.showFace });

  // 未织区域
  if (shownThreads < H) {
    ctx.fillStyle = 'rgba(8,11,13,0.34)';
    ctx.fillRect(0, shownThreads * ts, cv.width, (H - shownThreads) * ts);
    ctx.strokeStyle = 'rgba(230,194,90,0.62)';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, shownThreads * ts + 0.5);
    ctx.lineTo(cv.width, shownThreads * ts + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
    // 织口处的综框阴影
    const gg = ctx.createLinearGradient(0, shownThreads * ts, 0, shownThreads * ts + 26);
    gg.addColorStop(0, 'rgba(230,194,90,0.16)');
    gg.addColorStop(1, 'rgba(8,11,13,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(0, shownThreads * ts, cv.width, 26);
  }
  // 高亮当前纬（一条纬 = k 根线程）
  if (S.weave.hlWeft) {
    const top = (shownThreads - k) * ts;
    ctx.strokeStyle = 'rgba(230,194,90,0.95)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, top + 1, cv.width - 2, k * ts - 2);
  }
  // 高亮当前经
  if (S.weave.hlWarp && S.weave.focus) {
    const j = S.weave.focus.j;
    ctx.strokeStyle = 'rgba(69,137,169,0.95)';
    ctx.lineWidth = 2;
    ctx.strokeRect(j * k * ts + 1, 1, k * ts - 2, cv.height - 2);
  }
  // 织点网格（仅在格子足够大时显示，帮助把织物与网格对应起来）
  if (ts * k >= 18) {
    ctx.strokeStyle = 'rgba(8,11,13,0.22)';
    ctx.lineWidth = 1;
    for (let j = 1; j < n; j++) {
      ctx.beginPath();
      ctx.moveTo(j * k * ts + 0.5, 0);
      ctx.lineTo(j * k * ts + 0.5, cv.height);
      ctx.stroke();
    }
  }
  renderLens(wv);
  renderWeaveMetrics(wv, shownDesign);
}

function renderLens(wv) {
  const lens = $('lensCanvas');
  if (!lens) return;
  const ctx = lens.getContext('2d');
  const k = 2;
  const R = 2;                       // 以织点为单位取 5×5 窗口
  const f = S.weave.focus || {
    i: Math.max(0, Math.min(wv.h - 1, S.weave.progress - 1)),
    j: Math.floor(wv.w / 2)
  };
  const cells = R * 2 + 1;
  const win = cells * k;             // 线程窗口边长
  const ts = lens.width / win;
  ctx.clearRect(0, 0, lens.width, lens.height);
  ctx.fillStyle = '#0b0f12';
  ctx.fillRect(0, 0, lens.width, lens.height);

  for (let ti = 0; ti < win; ti++) {
    for (let tj = 0; tj < win; tj++) {
      const di = Math.floor(ti / k) - R;
      const dj = Math.floor(tj / k) - R;
      const i = f.i + di, j = f.j + dj;
      const x = tj * ts, y = ti * ts;
      if (i < 0 || i >= wv.h || j < 0 || j >= wv.w || i >= Math.max(1, S.weave.progress)) {
        ctx.fillStyle = '#12181d';
        ctx.fillRect(x, y, ts, ts);
        continue;
      }
      const c = wv.cells[i][j];
      let face, hex;
      if (c.flower) { face = 'weft'; hex = COLOR_META[c.color].hex; }
      else {
        face = groundLift(wv.structure, f.i * k + ti, f.j * k + tj) ? 'warp' : 'weft';
        hex = face === 'warp' ? SILK.warp : SILK.weft;
      }
      drawThread(ctx, x, y, ts + 0.4, face, hex);
    }
  }
  // 织点边界 + 中心框
  ctx.strokeStyle = 'rgba(8,11,13,0.45)';
  ctx.lineWidth = 1;
  for (let t = 0; t <= cells; t++) {
    ctx.beginPath(); ctx.moveTo(t * k * ts + 0.5, 0); ctx.lineTo(t * k * ts + 0.5, lens.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, t * k * ts + 0.5); ctx.lineTo(lens.width, t * k * ts + 0.5); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(230,194,90,0.9)';
  ctx.lineWidth = 2;
  ctx.strokeRect(R * k * ts + 1, R * k * ts + 1, k * ts - 2, k * ts - 2);
}

function renderWeaveMetrics(wv, shown) {
  const kv = $('wvKv');
  kv.innerHTML = '';
  const rows = [
    [LANG_KEY === 'zh' ? '组织' : 'Weave', STRUCTURES[wv.structure][LANG_KEY]],
    [LANG_KEY === 'zh' ? '组织循环' : 'Repeat', wv.period],
    [LANG_KEY === 'zh' ? '地综片数' : 'Ground frames', wv.stats.frames],
    [LANG_KEY === 'zh' ? '已织纬数' : 'Picks shown', shown + ' / ' + wv.h],
    [LANG_KEY === 'zh' ? '经浮点' : 'Warp-face cells', wv.stats.warpFace],
    [LANG_KEY === 'zh' ? '纬浮点' : 'Weft-face cells', wv.stats.weftFace],
    [LANG_KEY === 'zh' ? '花部彩纬点' : 'Figure cells', wv.stats.flowerCells],
    [LANG_KEY === 'zh' ? '经浮比' : 'Warp-face share', (wv.stats.warpFaceRatio * 100).toFixed(1) + '%'],
    [LANG_KEY === 'zh' ? '最大经浮长' : 'Max warp float', wv.stats.maxWarpFloat],
    [LANG_KEY === 'zh' ? '最大纬浮长' : 'Max weft float', wv.stats.maxWeftFloat],
    [LANG_KEY === 'zh' ? '平均浮长' : 'Mean float', wv.stats.meanFloat.toFixed(2)]
  ];
  rows.forEach(function (r) {
    kv.appendChild(el('dt', null, r[0]));
    kv.appendChild(el('dd', null, String(r[1])));
  });

  const lg = $('wvLegend');
  lg.innerHTML = '';
  const items = [
    [SILK.warp, LANG_KEY === 'zh' ? '经浮' : 'warp face'],
    [SILK.weft, LANG_KEY === 'zh' ? '纬浮（地）' : 'weft face (ground)'],
    ['#b8860b', LANG_KEY === 'zh' ? '花部彩纬' : 'colour weft'],
    ['#2f6b8a', LANG_KEY === 'zh' ? '高亮' : 'highlight']
  ];
  items.forEach(function (it) {
    const s = el('span');
    const i2 = document.createElement('i');
    i2.style.background = it[0];
    s.appendChild(i2);
    s.appendChild(document.createTextNode(it[1]));
    lg.appendChild(s);
  });
  const live = $('wvLive');
  if (live) {
    live.textContent = LANG_KEY === 'zh'
      ? '已织 ' + shown + ' 纬，共 ' + wv.h + ' 纬；最大纬浮长 ' + wv.stats.maxWeftFloat + '。'
      : 'Woven ' + shown + ' of ' + wv.h + ' picks; maximum weft float ' + wv.stats.maxWeftFloat + '.';
  }
}

function renderStructures() {
  const host = $('wvStructures');
  host.innerHTML = '';
  STRUCTURE_ORDER.forEach(function (id) {
    const b = el('button', 'seg-btn' + (S.structure === id ? ' on' : ''), STRUCTURES[id][LANG_KEY]);
    b.type = 'button';
    b.dataset.structure = id;
    b.setAttribute('aria-pressed', S.structure === id ? 'true' : 'false');
    b.title = pick(STRUCTURES[id].desc);
    b.addEventListener('click', function () {
      S.structure = id;
      renderStructures();
      S.weave.progress = 0;
      S.weave.playing = false;
      syncPlayButton();
      renderWeave();
      renderDraftReadout();
      renderTeach();
    });
    host.appendChild(b);
  });
}

function syncPlayButton() {
  const b = $('wvPlay');
  if (!b) return;
  b.textContent = S.weave.playing ? t('wv_pause') : t('wv_play');
  b.setAttribute('aria-pressed', S.weave.playing ? 'true' : 'false');
}

function weaveTick() {
  const h = S.pattern.h;
  if (S.weave.progress >= h) {
    S.weave.playing = false;
    stopTimer();
    syncPlayButton();
    return;
  }
  S.weave.progress++;
  renderWeave();
  if (S.weave.progress >= h) {
    S.weave.playing = false;
    stopTimer();
    syncPlayButton();
  }
}

function stopTimer() {
  if (S.weave.timer) { clearInterval(S.weave.timer); S.weave.timer = null; }
}

function startTimer() {
  stopTimer();
  const delay = Math.round(1100 / Math.max(1, S.weave.speed));
  S.weave.timer = setInterval(weaveTick, delay);
}

function bindWeaving() {
  renderStructures();
  $('wvPlay').addEventListener('click', function () {
    if (S.weave.playing) {
      S.weave.playing = false;
      stopTimer();
    } else {
      if (S.weave.progress >= S.pattern.h) S.weave.progress = 0;
      S.weave.playing = true;
      startTimer();
    }
    syncPlayButton();
    renderWeave();
  });
  $('wvStep').addEventListener('click', function () {
    S.weave.playing = false;
    stopTimer();
    syncPlayButton();
    if (S.weave.progress >= S.pattern.h) S.weave.progress = 0;
    weaveTick();
  });
  $('wvReset').addEventListener('click', function () {
    S.weave.playing = false;
    stopTimer();
    S.weave.progress = 0;
    syncPlayButton();
    renderWeave();
  });
  $('wvSpeed').addEventListener('input', function (e) {
    S.weave.speed = Number(e.target.value);
    if (S.weave.playing) startTimer();
  });
  $('wvHlWeft').addEventListener('change', function (e) {
    S.weave.hlWeft = e.target.checked;
    renderWeave();
  });
  $('wvHlWarp').addEventListener('change', function (e) {
    S.weave.hlWarp = e.target.checked;
    renderWeave();
  });
  $('wvWarpFace').addEventListener('change', function (e) {
    S.weave.showFace = e.target.checked;
    renderWeave();
  });
  $('weaveCanvas').addEventListener('click', function (e) {
    const cv = e.currentTarget;
    const r = cv.getBoundingClientRect();
    const n = S.pattern.w;
    const j = Math.max(0, Math.min(n - 1, Math.floor((e.clientX - r.left) / r.width * n)));
    const i = Math.max(0, Math.min(S.pattern.h - 1, Math.floor((e.clientY - r.top) / r.height * n)));
    S.weave.focus = { i: i, j: j };
    S.weave.hlWarp = true;
    $('wvHlWarp').checked = true;
    renderWeave();
  });
}

/* ============================================================
   7 · 模块 4：五态同构
   ============================================================ */

function renderFive() {
  const bits = designToBits(S.design);
  renderFiveFlower(bits);
  renderFiveCard(bits);
  renderFiveTape(bits);
  renderFiveBinary(bits);
  renderFivePixels(bits);
  applyFiveView();
  if (S.sync) highlightBit(S.sync, true);
}

function bitsEqual(bits) { return bits; }

function renderFiveFlower(bits) {
  const host = $('fvFlower');
  const NS = 'http://www.w3.org/2000/svg';
  const n = bits.w;
  const side = 240;
  const pad = 12, span = side - pad * 2, step = span / n;
  host.innerHTML = '';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + side + ' ' + side);
  svg.setAttribute('class', 'fv-flower-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', LANG_KEY === 'zh' ? '花本线编结结构：结扣为提，无结为沉' : 'Knotted pattern cords: a knot is a raised end');
  for (let j = 0; j < n; j++) {
    const l = document.createElementNS(NS, 'line');
    const x = pad + (j + 0.5) * step;
    l.setAttribute('x1', x); l.setAttribute('x2', x);
    l.setAttribute('y1', pad * 0.4); l.setAttribute('y2', side - pad * 0.4);
    l.setAttribute('class', 'fl-warp');
    svg.appendChild(l);
  }
  for (let i = 0; i < n; i++) {
    const y = pad + (i + 0.5) * step;
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('x1', pad * 0.4); l.setAttribute('x2', side - pad * 0.4);
    l.setAttribute('y1', y); l.setAttribute('y2', y);
    l.setAttribute('class', 'fl-weft');
    svg.appendChild(l);
    for (let j = 0; j < n; j++) {
      const x = pad + (j + 0.5) * step;
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'bit');
      g.setAttribute('data-bit', i + '-' + j);
      g.setAttribute('role', 'button');
      g.setAttribute('tabindex', '-1');
      g.setAttribute('aria-label', bitLabel(i, j, bits.rows[i][j]));
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', x); dot.setAttribute('cy', y);
      dot.setAttribute('r', Math.max(1.1, step * 0.22));
      dot.setAttribute('class', 'fl-knot' + (bits.rows[i][j] === '1' ? '' : ' sink'));
      g.appendChild(dot);
      const hit = document.createElementNS(NS, 'circle');
      hit.setAttribute('cx', x); hit.setAttribute('cy', y);
      hit.setAttribute('r', Math.max(3, step * 0.46));
      hit.setAttribute('fill', 'transparent');
      g.appendChild(hit);
      svg.appendChild(g);
    }
  }
  host.appendChild(svg);
  void bitsEqual;
}

function renderFiveCard(bits) {
  const host = $('fvCard');
  host.innerHTML = '';
  const wrap = el('div', 'card-grid');
  wrap.style.setProperty('--n', String(bits.w));
  wrap.style.gridTemplateColumns = '1fr';
  for (let i = 0; i < bits.h; i++) {
    const row = el('div', 'cd');
    row.style.gridTemplateColumns = 'repeat(' + bits.w + ', minmax(0, 1fr))';
    for (let j = 0; j < bits.w; j++) {
      const d = el('div', 'hole bit' + (bits.rows[i][j] === '1' ? ' punched' : ''));
      d.dataset.bit = i + '-' + j;
      d.setAttribute('role', 'img');
      d.setAttribute('aria-label', bitLabel(i, j, bits.rows[i][j]));
      row.appendChild(d);
    }
    wrap.appendChild(row);
  }
  host.appendChild(wrap);
}

/* 纸带按"真实长带折作数段"铺开：每段 8 通道 × perRun 位，
   段数 R 由 ⌈√(总列数/通道数)⌉ 定，使整条带子在面板里接近方形，
   与其余四态（16×16 方阵 / 16 行位串）的视觉密度相当。 */
function tapeRuns(bits, lanes) {
  const L = lanes || 8;
  const cols = Math.ceil(bits.w * bits.h / L);
  const R = Math.max(1, Math.round(Math.sqrt(cols / L)));
  return { lanes: L, cols: cols, runs: R, perRun: Math.ceil(cols / R) };
}

function renderFiveTape(bits) {
  const host = $('fvTape');
  host.innerHTML = '';
  const layout = tapeLayout(bits, 8);
  const L = layout.lanes;
  const info = tapeRuns(bits, L);
  const map = {};
  layout.cells.forEach(function (c) { map[c.lane + ':' + c.col] = c; });

  const strip = el('div', 'tape-strip');
  for (let run = 0; run < info.runs; run++) {
    const wrap = el('div', 'tape-run');
    // 通道号（1…8）：真纸带的通道标尺，对齐每一行孔位
    const gutter = el('div', 'tape-lanes');
    gutter.setAttribute('aria-hidden', 'true');
    for (let lane = 0; lane < L; lane++) gutter.appendChild(el('span', null, String(lane + 1)));
    wrap.appendChild(gutter);

    const cells = el('div', 'tape-cells');
    cells.style.gridTemplateColumns = 'repeat(' + info.perRun + ', minmax(0, 1fr))';
    for (let lane = 0; lane < L; lane++) {
      for (let k = 0; k < info.perRun; k++) {
        const c = map[lane + ':' + (run * info.perRun + k)];
        const d = el('div', 'tp' + (c && c.bit === '1' ? ' punched' : '') + (c ? '' : ' tp-empty'));
        if (c) {
          d.classList.add('bit');
          d.dataset.bit = c.i + '-' + c.j;
          d.setAttribute('aria-label', bitLabel(c.i, c.j, c.bit));
        } else {
          d.setAttribute('aria-hidden', 'true');
        }
        cells.appendChild(d);
      }
    }
    wrap.appendChild(cells);
    strip.appendChild(wrap);
    if (run < info.runs - 1) {
      const fold = el('div', 'tape-fold');
      fold.setAttribute('aria-hidden', 'true');
      fold.appendChild(el('span', null, LANG_KEY === 'zh' ? '折返' : 'fold'));
      strip.appendChild(fold);
    }
  }
  host.appendChild(strip);
  // 说明文字按实际分段数如实生成（8×8 单段 / 16×16 折返两段）
  const note = document.querySelector('.fv-cell[data-modality="tape"] .fv-note');
  if (note) {
    note.textContent = LANG_KEY === 'zh'
      ? '八通道 · 孔距 2.54 mm' + (info.runs > 1 ? ' · 折返成 ' + info.runs + ' 段' : ' · 单段读取')
      : '8 channels · 2.54 mm pitch' + (info.runs > 1 ? ' · folded into ' + info.runs + ' runs' : ' · single run');
  }
}

function renderFiveBinary(bits) {
  const host = $('fvBinary');
  host.innerHTML = '';
  const list = el('div', 'bin-list');
  for (let i = 0; i < bits.h; i++) {
    const row = el('div', 'row');
    for (let j = 0; j < bits.w; j++) {
      const ch = bits.rows[i][j];
      const b = el('span', 'b bit' + (ch === '1' ? ' one' : ''), ch);
      b.dataset.bit = i + '-' + j;
      b.setAttribute('role', 'img');
      b.setAttribute('aria-label', bitLabel(i, j, ch));
      row.appendChild(b);
    }
    list.appendChild(row);
  }
  host.appendChild(list);
}

function renderFivePixels(bits) {
  const host = $('fvPixels');
  host.innerHTML = '';
  const grid = el('div', 'px-grid');
  grid.style.gridTemplateColumns = 'repeat(' + bits.w + ', minmax(0, 1fr))';
  for (let i = 0; i < bits.h; i++) {
    for (let j = 0; j < bits.w; j++) {
      const d = el('div', 'px bit' + (bits.rows[i][j] === '1' ? ' lit' : ''));
      d.dataset.bit = i + '-' + j;
      d.setAttribute('role', 'img');
      d.setAttribute('aria-label', bitLabel(i, j, bits.rows[i][j]));
      grid.appendChild(d);
    }
  }
  host.appendChild(grid);
}

function bitLabel(i, j, bit) {
  const c = S.pattern && S.pattern.color[i] && S.pattern.color[i][j];
  const col = c > 0 ? COLOR_META[COLOR_KEYS[c - 1]][LANG_KEY] : (LANG_KEY === 'zh' ? '地部' : 'ground');
  return (LANG_KEY === 'zh'
    ? '第 ' + (i + 1) + ' 纬 第 ' + (j + 1) + ' 经，' + (bit === '1' ? '提' : '沉') + '，' + col
    : 'pick ' + (i + 1) + ', end ' + (j + 1) + ': ' + (bit === '1' ? 'raised' : 'sunk') + ', ' + col);
}

function highlightBit(key, silent) {
  const grid = $('fvGrid');
  if (!grid || typeof key !== 'string') return;
  const parts = key.split('-');
  const i = Number(parts[0]), j = Number(parts[1]);
  if (!Number.isInteger(i) || !Number.isInteger(j)) return;
  if (i < 0 || j < 0 || i >= S.pattern.h || j >= S.pattern.w) return;
  const nodes = grid.querySelectorAll('[data-bit]');
  for (let k = 0; k < nodes.length; k++) {
    const n = nodes[k];
    n.classList.toggle('on', n.dataset.bit === key);
    n.setAttribute('aria-pressed', n.dataset.bit === key ? 'true' : 'false');
  }
  const bit = S.pattern.lift[i][j];
  const ci = S.pattern.color[i][j];
  const colName = ci > 0 ? COLOR_META[COLOR_KEYS[ci - 1]][LANG_KEY] : (LANG_KEY === 'zh' ? '地部（无彩纬）' : 'ground');
  $('fvCoord').textContent = LANG_KEY === 'zh'
    ? '第 ' + (i + 1) + ' 纬 · 第 ' + (j + 1) + ' 经 · ' + (bit === '1' ? '提 (1)' : '沉 (0)') + ' · ' + colName
    : 'pick ' + (i + 1) + ' · end ' + (j + 1) + ' · ' + (bit === '1' ? 'raised (1)' : 'sunk (0)') + ' · ' + colName;

  // 只有被点击的那一态获得"来源"描边，其余四态同步高亮同一位
  const cells = grid.querySelectorAll('.fv-cell');
  for (let k = 0; k < cells.length; k++) {
    cells[k].classList.toggle('active', !!S.syncSource && cells[k].dataset.modality === S.syncSource);
  }
  grid.setAttribute('data-sync', key);
  if (!silent) $('fvReadout').setAttribute('data-sync', key);
}

/** 预选第一个花位，让五态联动一进场就有可看的内容 */
function firstFlowerBit() {
  const p = S.pattern;
  for (let i = 0; i < p.h; i++) {
    const k = p.lift[i].indexOf('1');
    if (k >= 0) return i + '-' + k;
  }
  return '0-0';
}

function applyFiveView() {
  const grid = $('fvGrid');
  if (grid) grid.dataset.view = S.fiveView;
}

function bindFive() {
  const grid = $('fvGrid');
  grid.addEventListener('click', function (e) {
    const node = e.target.closest('[data-bit]');
    if (!node) return;
    const cell = node.closest('.fv-cell');
    S.syncSource = cell ? cell.dataset.modality : null;
    S.sync = node.dataset.bit;
    highlightBit(S.sync, false);
  });
  document.querySelectorAll('.fv-toolbar .seg-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      S.fiveView = b.dataset.view;
      document.querySelectorAll('.fv-toolbar .seg-btn').forEach(function (x) { x.classList.toggle('on', x === b); });
      applyFiveView();
    });
  });
  $('fvRandom').addEventListener('click', function () {
    const i = Math.floor(Math.random() * S.pattern.h);
    const j = Math.floor(Math.random() * S.pattern.w);
    S.syncSource = ['flower', 'card', 'tape', 'binary', 'pixels'][Math.floor(Math.random() * 5)];
    S.sync = i + '-' + j;
    highlightBit(S.sync, false);
  });
}

/* ============================================================
   8 · 模块 5：织物库
   ============================================================ */

/* 织物库缩略图的内部分辨率：按卡片宽度自适应放大后仍是 1.5–2 倍过采样，不糊 */
const LB_THUMB_SIZE = 360;

function renderLibrary() {
  const host = $('lbList');
  host.innerHTML = '';
  PATTERNS.forEach(function (p, idx) {
    const design = designFromRows(p.map);
    const pattern = compileToPattern(design);
    const wv = weaveSimulate(pattern, 'satin5');

    const row = el('div', 'lb-row');
    const thumbs = el('div', 'lb-thumbs');

    const c1 = document.createElement('canvas');
    c1.width = LB_THUMB_SIZE; c1.height = LB_THUMB_SIZE;
    const t1 = el('div', 'lb-thumb');
    t1.appendChild(c1);
    t1.appendChild(el('span', null, LANG_KEY === 'zh' ? '纹样' : 'design'));

    const c2 = document.createElement('canvas');
    c2.width = LB_THUMB_SIZE; c2.height = LB_THUMB_SIZE;
    const t2 = el('div', 'lb-thumb');
    t2.appendChild(c2);
    t2.appendChild(el('span', null, LANG_KEY === 'zh' ? '花本' : 'pattern book'));

    const c3 = document.createElement('canvas');
    c3.width = LB_THUMB_SIZE; c3.height = LB_THUMB_SIZE;
    const t3 = el('div', 'lb-thumb');
    t3.appendChild(c3);
    t3.appendChild(el('span', null, LANG_KEY === 'zh' ? '织物' : 'fabric'));

    thumbs.appendChild(t1); thumbs.appendChild(t2); thumbs.appendChild(t3);

    paintDesignThumb(c1, design);
    paintHuabenThumb(c2, pattern);
    paintFabricThumb(c3, wv);

    const body = el('div', 'lb-body');
    const h3 = el('h3');
    h3.appendChild(document.createTextNode('0' + (idx + 1) + ' · ' + (p[LANG_KEY] || p.zh)));
    h3.appendChild(el('em', null, p.en));
    body.appendChild(h3);

    const meta = el('div', 'lb-meta');
    meta.appendChild(el('span', null, (LANG_KEY === 'zh' ? '品类 ' : 'class ') + (LANG_KEY === 'zh' ? p.band : p.bandEn)));
    meta.appendChild(el('span', null, (LANG_KEY === 'zh' ? '花位 ' : 'raised ') + pattern.stats.flowers + '/' + pattern.stats.total));
    meta.appendChild(el('span', null, (LANG_KEY === 'zh' ? '校验和 ' : 'checksum ') + checksum(pattern)));
    body.appendChild(meta);

    body.appendChild(el('p', null, pick({ zh: p.zhDesc, en: p.enDesc })));

    const btn = el('button', 'btn btn-sm', LANG_KEY === 'zh' ? '载入工坊 →' : 'Load into workshop →');
    btn.type = 'button';
    btn.addEventListener('click', function () {
      loadDesignIntoWorkshop(design);
      document.getElementById('workshop').scrollIntoView({ behavior: S.reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
    body.appendChild(btn);

    row.appendChild(thumbs);
    row.appendChild(body);
    host.appendChild(row);
  });
}

function paintHuabenThumb(canvas, pattern) {
  const ctx = canvas.getContext('2d');
  const n = pattern.w;
  const cell = canvas.width / n;
  ctx.fillStyle = '#0b0f12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(47,107,138,0.55)';
  ctx.lineWidth = 1;
  for (let j = 0; j < n; j++) {
    const x = (j + 0.5) * cell;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let i = 0; i < n; i++) {
    const y = (i + 0.5) * cell;
    ctx.strokeStyle = 'rgba(38,48,56,0.9)';
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    for (let j = 0; j < n; j++) {
      if (pattern.lift[i][j] !== '1') continue;
      ctx.fillStyle = '#d4a017';
      ctx.beginPath();
      ctx.arc((j + 0.5) * cell, y, Math.max(1, cell * 0.26), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function paintFabricThumb(canvas, wv) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0b0f12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawFabricArea(ctx, wv, { x: 0, y: 0, size: canvas.width, k: 2 });
}

/* ============================================================
   9 · 模块 6：织造时间线
   ============================================================ */

function renderTimeline() {
  const host = $('tlTrack');
  host.innerHTML = '';
  TIMELINE.forEach(function (node, idx) {
    const row = el('div', 'tl-node' + (idx === S.tlIndex ? ' cur' : ''));
    row.dataset.idx = String(idx);

    // 左列 = 中国轨：卡片标题用"同一时期的中国"，缺省回落到节点名
    const cnCard = node.cnCard ? pick(node.cnCard) : node.zh;
    const left = el('button', 'tl-side');
    left.type = 'button';
    left.appendChild(el('span', 'era', node.era));
    left.appendChild(el('span', 'nm', cnCard));
    left.setAttribute('aria-label', (LANG_KEY === 'zh' ? '中国轨 ' : 'China track ') + node.era + ' ' + cnCard);

    const axis = el('div', 'tl-axis');
    const dot = el('button', 'tl-dot');
    dot.type = 'button';
    dot.setAttribute('aria-label', (LANG_KEY === 'zh' ? '选择节点 ' : 'Select node ') + (idx + 1) + '：' + node.zh);
    axis.appendChild(dot);

    const right = el('button', 'tl-side west');
    right.type = 'button';
    const westTitle = LANG_KEY === 'zh' ? node.west.title : (node.west.titleEn || node.west.title);
    right.appendChild(el('span', 'era', LANG_KEY === 'zh' ? node.eraEn : node.eraEn));
    right.appendChild(el('span', 'nm', westTitle));
    right.setAttribute('aria-label', (LANG_KEY === 'zh' ? '西方轨 ' : 'World track ') + node.era + ' ' + westTitle);

    [left, dot, right].forEach(function (b) {
      b.addEventListener('click', function () { selectTimeline(idx, true); });
    });

    row.appendChild(left);
    row.appendChild(axis);
    row.appendChild(right);
    host.appendChild(row);
  });
  renderTimelineDetail();
}

function selectTimeline(idx, scroll) {
  const n = TIMELINE.length;
  S.tlIndex = ((idx % n) + n) % n;
  const rows = $('tlTrack').children;
  for (let i = 0; i < rows.length; i++) rows[i].classList.toggle('cur', i === S.tlIndex);
  $('tlIdx').textContent = String(S.tlIndex + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0');
  renderTimelineDetail();
  if (scroll) {
    const box = $('tlDetail');
    if (box && box.scrollIntoView) box.scrollIntoView({ behavior: S.reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
  }
}

function renderTimelineDetail() {
  const node = TIMELINE[S.tlIndex];
  const host = $('tlDetail');
  host.innerHTML = '';

  const head = el('div');
  head.appendChild(el('span', 'tl-era', node.era + '  ·  ' + node.eraEn));
  const h3 = el('h3');
  h3.textContent = LANG_KEY === 'zh' ? node.zh : (node.en || node.zh);
  if (LANG_KEY === 'zh') h3.appendChild(el('em', 'mono', '  ' + node.en));
  head.appendChild(h3);
  head.appendChild(el('div', 'tl-link', pick(node.link)));
  host.appendChild(head);

  const cols = el('div', 'tl-cols');
  const cnTitle = LANG_KEY === 'zh' ? node.cn.title : (node.cn.titleEn || node.cn.title);
  const cnBody = LANG_KEY === 'zh' ? node.cn.body : (node.cn.en || node.cn.body);
  const westTitle = LANG_KEY === 'zh' ? node.west.title : (node.west.titleEn || node.west.title);
  const westBody = LANG_KEY === 'zh' ? node.west.body : (node.west.en || node.west.body);

  const c1 = el('div', 'tl-col');
  c1.appendChild(el('h4', null, LANG_KEY === 'zh' ? '中国轨 · CHINA' : 'CHINA'));
  c1.appendChild(el('p', null, cnTitle));
  c1.appendChild(el('p', null, cnBody));
  c1.appendChild(el('p', 'tl-src', (LANG_KEY === 'zh' ? '来源类别：' : 'Source category: ') + node.cn.source));
  cols.appendChild(c1);

  const c2 = el('div', 'tl-col');
  c2.appendChild(el('h4', null, LANG_KEY === 'zh' ? '西方轨 · WEST' : 'WEST'));
  c2.appendChild(el('p', null, westTitle));
  c2.appendChild(el('p', null, westBody));
  c2.appendChild(el('p', 'tl-src', (LANG_KEY === 'zh' ? '来源类别：' : 'Source category: ') + node.west.source));
  cols.appendChild(c2);

  host.appendChild(cols);
  host.appendChild(el('p', 'tl-src', (LANG_KEY === 'zh' ? '编码介质形态：' : 'Coding medium: ') + pick(node.code)));
  $('tlIdx').textContent = String(S.tlIndex + 1).padStart(2, '0') + ' / ' + String(TIMELINE.length).padStart(2, '0');
}

function bindTimeline() {
  $('tlPrev').addEventListener('click', function () { selectTimeline(S.tlIndex - 1, true); });
  $('tlNext').addEventListener('click', function () { selectTimeline(S.tlIndex + 1, true); });
  document.addEventListener('keydown', function (e) {
    const sec = document.getElementById('timeline');
    if (!sec) return;
    const r = sec.getBoundingClientRect();
    const inView = r.top < window.innerHeight * 0.75 && r.bottom > window.innerHeight * 0.25;
    if (!inView) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') { selectTimeline(S.tlIndex - 1, false); e.preventDefault(); }
    if (e.key === 'ArrowRight') { selectTimeline(S.tlIndex + 1, false); e.preventDefault(); }
  });
}

/* ============================================================
   10 · 模块 7：术语库
   ============================================================ */

function renderTermChips() {
  const host = $('tmChips');
  host.innerHTML = '';
  const all = el('button', 'chip' + (S.termCat === 'all' ? ' on' : ''), LANG_KEY === 'zh' ? '全部' : 'All');
  all.type = 'button';
  all.dataset.cat = 'all';
  all.addEventListener('click', function () { S.termCat = 'all'; renderTermChips(); renderTerms(); });
  host.appendChild(all);
  TERM_CATS.forEach(function (c) {
    const n = TERMS.filter(function (x) { return x.cat === c.key; }).length;
    const b = el('button', 'chip' + (S.termCat === c.key ? ' on' : ''), c[LANG_KEY] + ' ' + n);
    b.type = 'button';
    b.dataset.cat = c.key;
    b.addEventListener('click', function () { S.termCat = c.key; renderTermChips(); renderTerms(); });
    host.appendChild(b);
  });
}

function renderTerms() {
  const host = $('tmList');
  const q = S.termQuery.trim().toLowerCase();
  const list = TERMS.filter(function (x) {
    if (S.termCat !== 'all' && x.cat !== S.termCat) return false;
    if (!q) return true;
    return (x.zh + ' ' + x.en + ' ' + (x.note || '') + ' ' + (x.noteEn || '')).toLowerCase().indexOf(q) >= 0;
  });
  host.innerHTML = '';
  list.forEach(function (x) {
    const item = el('div', 'tm-item');
    const head = el('div', 'tm-head');
    const primary = LANG_KEY === 'zh' ? x.zh : x.en;
    const second = LANG_KEY === 'zh' ? x.en : x.zh;
    head.appendChild(el('span', 'tm-zh', primary));
    head.appendChild(el('span', 'tm-en', second));
    const cat = TERM_CATS.filter(function (c) { return c.key === x.cat; })[0];
    head.appendChild(el('span', 'tm-cat', cat ? cat[LANG_KEY] : x.cat));
    item.appendChild(head);
    item.appendChild(el('p', 'tm-note', LANG_KEY === 'zh' ? (x.note || x.noteEn || '') : (x.noteEn || x.note || '')));
    host.appendChild(item);
  });
  $('tmCount').textContent = (LANG_KEY === 'zh'
    ? '显示 ' + list.length + ' / 共 ' + TERMS.length + ' 条'
    : list.length + ' of ' + TERMS.length + ' terms');
  $('tmEmpty').hidden = list.length > 0;
}

function bindTerms() {
  $('tmSearch').addEventListener('input', function (e) {
    S.termQuery = e.target.value;
    renderTerms();
  });
}

/* ============================================================
   11 · 模块 8：教学包
   ============================================================ */

function teachHuabenRows() { return huabenRows(S.pattern); }
function teachTimingRows() { return timingRows(S.pattern, S.structure); }

function download(filename, text, mime) {
  const blob = new Blob(['\ufeff' + text], { type: (mime || 'text/plain') + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}

function stamp() {
  const d = new Date();
  const p = function (n) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
}

/**
 * 教学包预览：把可视内容区锁成整数行。
 * CSS 里 --cp-lines 给出行数，这里再按滚动条的实际占用（覆盖式 0px / 经典式约 10–17px）
 * 微调，使末行永远是完整的一行，不会被容器切成半行；同时给出明确的可滚动提示。
 */
function fitTeachPreview() {
  const pre = $('tcPreview');
  if (!pre) return;
  const cs = getComputedStyle(pre);
  const lh = parseFloat(cs.lineHeight);
  if (!(lh > 0)) return;
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const borY = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
  const lines = parseFloat(cs.getPropertyValue('--cp-lines')) || 16;
  const barH = function () {
    return Math.max(0, pre.offsetHeight - pre.clientHeight - borY);
  };

  // 1) 先放开高度，量出横向滚动条真实占位
  pre.style.maxHeight = 'none';
  let bar = barH();
  // 2) 内容区高度 = 整数行
  pre.style.maxHeight = (lines * lh + padY + borY + bar) + 'px';
  // 3) 竖向滚动条出现后可能新增横向滚动条，复核一次
  const bar2 = barH();
  if (bar2 !== bar) {
    pre.style.maxHeight = (lines * lh + padY + borY + bar2) + 'px';
  }

  // 4) 「可滚动」的文字提示（覆盖式滚动条在静止时看不见，文字提示必须有）
  const note = $('tcPreviewNote');
  if (!note) return;
  const total = pre.textContent.split('\n').length;
  const visible = Math.max(1, Math.round((pre.clientHeight - padY) / lh));
  const rest = total - visible;
  const hOver = pre.scrollWidth - pre.clientWidth > 24;   // 宽表需要横向滚动
  if (rest > 0) {
    note.innerHTML = '';
    note.appendChild(document.createTextNode('↕ '));
    note.appendChild(el('b', null, LANG_KEY === 'zh' ? '可滚动' : 'scrollable'));
    note.appendChild(document.createTextNode(LANG_KEY === 'zh'
      ? ' — 共 ' + total + ' 行，当前显示 ' + visible + ' 行，向下滚动查看余下 ' + rest + ' 行'
        + (hOver ? '（宽表也可左右滚动）' : '') + '；导出按钮可取完整文件。'
      : ' — ' + total + ' lines, ' + visible + ' shown; scroll for the other ' + rest
        + (hOver ? ' (or scroll sideways for the wide table)' : '') + '. The export buttons give the whole file.'));
  } else {
    note.textContent = LANG_KEY === 'zh'
      ? '✓ 共 ' + total + ' 行，已全部显示。'
      : '✓ All ' + total + ' lines are shown.';
  }
}

function renderTeach() {
  const rows = teachTimingRows();
  let md = toMarkdown(rows, LANG_KEY === 'zh'
    ? '织造时序表（' + STRUCTURES[S.structure].zh + '，' + S.pattern.w + '×' + S.pattern.h + '）'
    : 'Weaving schedule (' + STRUCTURES[S.structure].en + ', ' + S.pattern.w + '×' + S.pattern.h + ')');
  const hb = toMarkdown(teachHuabenRows(), LANG_KEY === 'zh' ? '花本表' : 'Pattern-book table');
  $('tcPreview').textContent = hb + '\n' + md;
  fitTeachPreview();

  const notes = $('tcNotes');
  notes.innerHTML = '';
  const items = LANG_KEY === 'zh' ? [
    '<b>花本表</b>：每纬一行，0/1 为经线提沉；末列为该纬提花数。',
    '<b>织造时序表</b>：地综提升（片号）、花部提沉串、彩纬配色位、投梭顺序与最终经线提升。',
    '<b>CSV</b> 带 UTF-8 BOM，Excel 直接双击不乱码。',
    '<b>Markdown</b> 表格可直接粘进教案或题注。',
    '所有导出均在浏览器本地生成，不上传任何数据。'
  ] : [
    '<b>Pattern-book table</b>: one row per pick, 0/1 for warp lift, last column counts raised ends.',
    '<b>Weaving schedule</b>: ground heddle frames, figure lift string, colour wefts, shuttle order and final lift.',
    '<b>CSV</b> is written with a UTF-8 BOM so Excel opens it without mojibake.',
    '<b>Markdown</b> tables paste straight into a lesson plan or a caption.',
    'Every export is generated in the browser; nothing is uploaded.'
  ];
  items.forEach(function (h) {
    const li = document.createElement('li');
    li.innerHTML = h;
    notes.appendChild(li);
  });
}

function bindTeach() {
  $('tcCsvHuaben').addEventListener('click', function () {
    download('huaben-' + S.pattern.w + 'x' + S.pattern.h + '-1-' + stamp() + '.csv', toCSV(teachHuabenRows()), 'text/csv');
    $('tcStatus').textContent = LANG_KEY === 'zh' ? '已导出花本表 CSV（UTF-8 BOM）' : 'Pattern book CSV exported (UTF-8 BOM)';
  });
  $('tcCsvTiming').addEventListener('click', function () {
    download('loomtiming-' + STRUCTURES[S.structure].id + '-1-' + stamp() + '.csv', toCSV(teachTimingRows()), 'text/csv');
    $('tcStatus').textContent = LANG_KEY === 'zh' ? '已导出织造时序表 CSV' : 'Weaving schedule CSV exported';
  });
  $('tcMdHuaben').addEventListener('click', function () {
    download('huaben-' + S.pattern.w + 'x' + S.pattern.h + '-1-' + stamp() + '.md',
      toMarkdown(teachHuabenRows(), LANG_KEY === 'zh' ? '花本表' : 'Pattern-book table'), 'text/markdown');
    $('tcStatus').textContent = LANG_KEY === 'zh' ? '已导出花本表 Markdown' : 'Pattern book Markdown exported';
  });
  $('tcMdTiming').addEventListener('click', function () {
    download('loomtiming-' + STRUCTURES[S.structure].id + '-1-' + stamp() + '.md',
      toMarkdown(teachTimingRows(), LANG_KEY === 'zh' ? '织造时序表' : 'Weaving schedule'), 'text/markdown');
    $('tcStatus').textContent = LANG_KEY === 'zh' ? '已导出时序表 Markdown' : 'Weaving schedule Markdown exported';
  });
  $('tcCopy').addEventListener('click', function () {
    const text = $('tcPreview').textContent;
    const done = function (ok) {
      $('tcStatus').textContent = ok
        ? (LANG_KEY === 'zh' ? '已复制到剪贴板' : 'Copied to clipboard')
        : (LANG_KEY === 'zh' ? '浏览器拒绝了剪贴板权限，请手动选择预览区文字复制。' : 'Clipboard blocked; please select the preview text and copy manually.');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      done(false);
    }
  });

  // 视口变化时行高/滚动条占位会变，重新锁定整数行
  var fitTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(fitTeachPreview, 160);
  });
}

/* ============================================================
   12 · 模块 9：团队 · 披露
   ============================================================ */

function renderTeam() {
  const orig = $('teOriginal');
  const ai = $('teAi');
  const pending = $('tePending');
  const verify = $('teVerify');
  [orig, ai, pending, verify].forEach(function (n) { if (n) n.innerHTML = ''; });

  const A = LANG_KEY === 'zh' ? {
    orig: [
      '<b>四段算法</b>（compileToPattern / weaveSimulate / MODALITIES / loomTiming）与全部前端代码为团队原创，零第三方库。',
      '<b>6 件云锦纹样</b>由团队以参数化几何程序绘制后固化为 16×16 字符矩阵，不使用任何馆藏照片或商业纹样库。',
      '<b>159 条双语术语</b>为团队依据公开非遗名录、纺织史文献与博物馆公开释文自行整理撰写，释文与英译均为原创。',
      '<b>8 个时间线节点</b>的中国轨与西方轨正文为团队撰写，每条标注来源类别；定位为教学示意，非文物级复原。',
      '<b>视觉系统</b>（配色、排版、花本线 SVG、织物 Canvas 渲染、封面织物质感）全部自绘，无外部图片、字体与 CDN。'
    ],
    ai: [
      '<b>作品内视觉</b>：无任何 AI 生成图像。花本线为手写 SVG，织物与织物质感为 Canvas 逐像素绘制，封面底纹为程序化噪声与渐变。',
      '<b>评审视频</b>：AI 影像（MiniMax-H3 等视频模型）仅用于评审视频的氛围镜头，逐段在视频说明与《作品说明文档》中披露。',
      '<b>文字与代码</b>：算法设计、代码编写与文档撰写由 AI 辅助生成后经团队逐行审校、实测与修正；全部断言均以 node / playwright 复跑通过。',
      '<b>未使用</b>：未使用任何他人图片、馆藏扫描件、传承人影像、商业纹样库素材或第三方前端框架。'
    ],
    verify: [
      '<b>算法自检</b>：<span class="mono-sm">node test/verify.js</span> —— 往返一致性、组织循环周期、五态互转逐位一致、时间线节点数、术语条数与去重。',
      '<b>界面自检</b>：<span class="mono-sm">py -X utf8 07_技术文档与运行说明/测试脚本/run_checks.py</span> —— playwright 驱动九大模块主要控件，断言控制台零报错。',
      '<b>数据自洽</b>：说明文档中的所有数字（术语条数、纹样件数、节点数、组织类型数）均由脚本从代码中读出后写入。',
      '<b>离线可运行</b>：无网络请求，双击 index.html 即可。'
    ]
  } : {
    orig: [
      '<b>Four algorithms</b> (compileToPattern / weaveSimulate / MODALITIES / loomTiming) and all front-end code are original, with no third-party library.',
      '<b>Six brocade patterns</b> were drawn by the team with parametric geometry and fixed into 16×16 character matrices; no museum photograph or commercial pattern library is used.',
      '<b>159 bilingual terms</b> were compiled and written by the team from public intangible-heritage listings, textile-history literature and museum labels; glosses and English renderings are original.',
      '<b>Eight timeline nodes</b> on both tracks were written by the team, each with a source category; the positioning is pedagogical, not a conservation-grade reconstruction.',
      '<b>The visual system</b> (palette, typography, cord-structure SVG, Canvas fabric renderer, cover silk texture) is entirely hand-drawn or procedurally drawn: no external image, font or CDN.'
    ],
    ai: [
      '<b>Visuals inside the work</b>: no AI-generated image. Cord structures are hand-written SVG, fabric and silk textures are drawn per pixel in Canvas, and the cover ground is procedural noise and gradients.',
      '<b>Review video</b>: AI footage (MiniMax-H3 and similar video models) is used only for atmospheric shots in the review video, disclosed shot by shot in the video notes and in the work description.',
      '<b>Text and code</b>: algorithm design, code and documentation were drafted with AI assistance, then reviewed line by line, tested and corrected by the team; every assertion is re-run with node and playwright.',
      '<b>Not used</b>: no third-party image, museum scan, bearer footage, commercial pattern library or front-end framework.'
    ],
    verify: [
      '<b>Algorithm self-test</b>: <span class="mono-sm">node test/verify.js</span> — round-trip identity, weave repeat periods, bit-exact five-state conversion, node count, term count and deduplication.',
      '<b>Interface check</b>: <span class="mono-sm">py -X utf8 07_技术文档与运行说明/测试脚本/run_checks.py</span> — playwright drives every main control in the nine modules and asserts a clean console.',
      '<b>Data consistency</b>: every number in the description documents (term count, pattern count, node count, weave types) is read out of the code by a script before it is written.',
      '<b>Runs offline</b>: no network request; open index.html by double-click.'
    ]
  };

  A.orig.forEach(function (h) { const li = document.createElement('li'); li.innerHTML = h; orig.appendChild(li); });
  A.ai.forEach(function (h) { const li = document.createElement('li'); li.innerHTML = h; ai.appendChild(li); });
  A.verify.forEach(function (h) { const li = document.createElement('li'); li.innerHTML = h; verify.appendChild(li); });
  (typeof PENDING_ASSETS !== 'undefined' ? PENDING_ASSETS : []).forEach(function (a) {
    const li = document.createElement('li');
    li.textContent = a.id + ' · ' + (LANG_KEY === 'zh' ? a.zh : a.en) + ' [' + a.seg + ']';
    pending.appendChild(li);
  });
}

/* ============================================================
   13 · 封面 / 导航 / 语言 / 动效
   ============================================================ */

let coverRAF = null;

/* ---------- 封面右侧：程序生成的妆花缎实物（用同一套 weaveSimulate） ---------- */
let coverArtOff = null;
let coverArtRAF = null;

function buildCoverArt() {
  const cv = $('coverArt');
  if (!cv) return;
  const off = document.createElement('canvas');
  off.width = cv.width;
  off.height = cv.height;
  const octx = off.getContext('2d');
  let wv;
  try {
    wv = weaveSimulate(compileToPattern(designFromRows(PATTERNS[1].map)), 'satin5');
  } catch (err) { return; }
  const cell = off.width / wv.w;
  octx.fillStyle = '#0b0f12';
  octx.fillRect(0, 0, off.width, off.height);
  drawFabricArea(octx, wv, { x: 0, y: 0, size: off.width, k: OVERSAMPLE });
  void cell;
  coverArtOff = off;
  paintCoverArt(0);
}

function paintCoverArt(phase) {
  const cv = $('coverArt');
  if (!cv || !coverArtOff) return;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.drawImage(coverArtOff, 0, 0);
  // 轻微暗角，让织物嵌进页面而不是浮在上面
  const vg = ctx.createRadialGradient(cv.width / 2, cv.height / 2, cv.width * 0.30,
    cv.width / 2, cv.height / 2, cv.width * 0.78);
  vg.addColorStop(0, 'rgba(8,11,13,0)');
  vg.addColorStop(1, 'rgba(8,11,13,0.42)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, cv.width, cv.height);
  if (!S.reduceMotion) {
    const y = (Math.sin(phase) * 0.5 + 0.5) * (cv.height + 160) - 80;
    const g = ctx.createLinearGradient(0, y - 70, 0, y + 70);
    g.addColorStop(0, 'rgba(184,134,11,0)');
    g.addColorStop(0.5, 'rgba(230,194,90,0.20)');
    g.addColorStop(1, 'rgba(184,134,11,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 70, cv.width, 140);
  }
}

function loopCoverArt() {
  if (coverArtRAF) { cancelAnimationFrame(coverArtRAF); coverArtRAF = null; }
  if (S.reduceMotion) { paintCoverArt(0); return; }
  const t0 = performance.now();
  const step = function (now) {
    paintCoverArt((now - t0) / 3000);
    coverArtRAF = requestAnimationFrame(step);
  };
  coverArtRAF = requestAnimationFrame(step);
}

function initCover() {
  const cv = $('coverCanvas');
  if (!cv) return;
  let w = 0, h = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
  const resize = function () {
    const r = cv.parentElement.getBoundingClientRect();
    w = Math.max(320, Math.round(r.width));
    h = Math.max(320, Math.round(r.height));
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', function () {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    resize();
    draw(0);
  });

  function draw(phase) {
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintSilkTexture(ctx, w, h, {
      step: 6,
      seed: 11,
      shuttle: S.reduceMotion ? null : (Math.sin(phase) * 0.5 + 0.5) * (w + 200) - 100
    });
  }

  let t0 = performance.now();
  function loop(now) {
    if (S.reduceMotion) { draw(0); coverRAF = null; return; }
    draw((now - t0) / 2600);
    coverRAF = requestAnimationFrame(loop);
  }
  draw(0);
  if (!S.reduceMotion) coverRAF = requestAnimationFrame(loop);
  if (S.reduceMotion && coverRAF) { cancelAnimationFrame(coverRAF); coverRAF = null; }
}

function initNavSpy() {
  const ids = ['workshop', 'drafting', 'weaving', 'five', 'library', 'timeline', 'terms', 'teach', 'team'];
  const links = {};
  document.querySelectorAll('#navLinks a').forEach(function (a) {
    links[a.getAttribute('href').slice(1)] = a;
  });
  if (typeof IntersectionObserver === 'undefined') return;
  const spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      Object.keys(links).forEach(function (k) { links[k].classList.remove('active'); });
      const a = links[en.target.id];
      if (a) a.classList.add('active');
    });
  }, { rootMargin: '-42% 0px -50% 0px' });
  ids.forEach(function (id) {
    const n = document.getElementById(id);
    if (n) spy.observe(n);
  });
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(function (n) {
    const k = n.getAttribute('data-i18n');
    const v = t(k);
    if (v !== undefined && v !== null) n.textContent = v;
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(function (n) {
    n.setAttribute('placeholder', t(n.getAttribute('data-i18n-ph')));
  });
}

function setLang(lang) {
  LANG_KEY = lang === 'en' ? 'en' : 'zh';
  document.documentElement.lang = LANG_KEY === 'zh' ? 'zh-CN' : 'en';
  $('langZh').classList.toggle('on', LANG_KEY === 'zh');
  $('langEn').classList.toggle('on', LANG_KEY === 'en');
  $('langZh').setAttribute('aria-pressed', LANG_KEY === 'zh' ? 'true' : 'false');
  $('langEn').setAttribute('aria-pressed', LANG_KEY === 'en' ? 'true' : 'false');
  applyI18n();
  renderSwatches();
  renderPresets();
  buildGrid();
  renderWorkshopReadout();
  renderStructures();
  syncPlayButton();
  renderDrafting();
  renderWeave();
  renderFive();
  renderLibrary();
  renderTimeline();
  renderTermChips();
  renderTerms();
  renderTeach();
  renderTeam();
  renderSteps();
  const live = $('wsLive');
  if (live) live.textContent = LANG_KEY === 'zh' ? '界面语言：中文' : 'Interface language: English';
}

function initMotion() {
  const btn = $('motionBtn');
  const prefers = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  S.reduceMotion = !!prefers;
  if (S.reduceMotion) document.documentElement.classList.add('reduce-motion');
  btn.setAttribute('aria-pressed', S.reduceMotion ? 'true' : 'false');
  btn.addEventListener('click', function () {
    S.reduceMotion = !S.reduceMotion;
    document.documentElement.classList.toggle('reduce-motion', S.reduceMotion);
    btn.setAttribute('aria-pressed', S.reduceMotion ? 'true' : 'false');
    if (S.reduceMotion) {
      if (coverRAF) { cancelAnimationFrame(coverRAF); coverRAF = null; }
      if (coverArtRAF) { cancelAnimationFrame(coverArtRAF); coverArtRAF = null; }
      const cv = $('coverCanvas');
      if (cv) {
        const ctx = cv.getContext('2d');
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        paintSilkTexture(ctx, cv.width / dpr, cv.height / dpr, { step: 6, seed: 11, shuttle: null });
      }
      paintCoverArt(0);
    } else {
      initCover();
      loopCoverArt();
    }
  });
}

/* ============================================================
   14 · 启动
   ============================================================ */

function boot() {
  S.design = blankDesign(S.size);
  S.pattern = compileToPattern(S.design);

  // 网格尺寸按钮与初始尺寸对齐（默认 16×16）
  document.querySelectorAll('.ws-toolbar .seg-btn').forEach(function (b) {
    b.classList.toggle('on', Number(b.dataset.size) === S.size);
  });

  renderSwatches();
  buildGrid();
  bindWorkshop();
  renderPresets();
  renderDrafting();
  bindDrafting();
  bindWeaving();
  renderFive();
  bindFive();
  renderLibrary();
  renderTimeline();
  bindTimeline();
  renderTermChips();
  renderTerms();
  bindTerms();
  renderTeach();
  bindTeach();
  renderTeam();
  renderSteps();
  $('langZh').addEventListener('click', function () { setLang('zh'); });
  $('langEn').addEventListener('click', function () { setLang('en'); });
  initMotion();
  initCover();
  buildCoverArt();
  loopCoverArt();
  initNavSpy();
  applyI18n();
  commitDesign(false);

  // 默认织出预设纹样，让首屏就有内容
  S.design = resizeDesign(designFromRows(PATTERNS[0].map), S.size);
  buildGrid();
  commitDesign(false);
  S.weave.progress = S.pattern.h;
  renderWeave();
  S.syncSource = 'pixels';
  S.sync = firstFlowerBit();
  highlightBit(S.sync, true);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

/* ---------- Node 自检导出 ---------- */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    COLOR_KEYS: COLOR_KEYS,
    COLOR_META: COLOR_META,
    STRUCTURES: STRUCTURES,
    STRUCTURE_ORDER: STRUCTURE_ORDER,
    blankDesign: blankDesign,
    designFromRows: designFromRows,
    designToRows: designToRows,
    normalizeDesign: normalizeDesign,
    resizeDesign: resizeDesign,
    frameLift: frameLift,
    groundLift: groundLift,
    compileToPattern: compileToPattern,
    decodePattern: decodePattern,
    designToBits: designToBits,
    bitsToDesign: bitsToDesign,
    checksum: checksum,
    weaveSimulate: weaveSimulate,
    loomTiming: loomTiming,
    MODALITIES: MODALITIES,
    modalityById: modalityById,
    identityBits: identityBits,
    toCard: toCard, fromCard: fromCard,
    toTape: toTape, fromTape: fromTape,
    tapeLayout: tapeLayout,
    tapeRuns: tapeRuns,
    toBinary: toBinary, fromBinary: fromBinary,
    toPixels: toPixels, fromPixels: fromPixels,
    huabenRows: huabenRows,
    timingRows: timingRows,
    toCSV: toCSV,
    toMarkdown: toMarkdown
  };
}
