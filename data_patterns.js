// ============================================================
// 《织机与芯片》云锦预设纹样数据 —— 团队原创，程序化参数绘制后固化为 16×16 像素矩阵
// 字符合集：'.' 空（地部）｜'B' 石青｜'W' 月白｜'G' 赤金｜'K' 墨
// 每件纹样 16 行 × 16 列；纹样工坊取前 4 件作快捷载入，织物库展示全部 6 件。
// 本文件不含任何外部图片引用，全部视觉由字符矩阵 + Canvas/SVG 程序渲染。
// ============================================================

const PATTERN_LEGEND = {
  '.': { zh: '空（地部）', en: 'empty (ground)' },
  'B': { zh: '石青', en: 'stone blue' },
  'W': { zh: '月白', en: 'moon white' },
  'G': { zh: '赤金', en: 'vermilion gold' },
  'K': { zh: '墨', en: 'ink' },
};

const PATTERN_COLORS = {
  B: '#1c3f52',
  W: '#dfe8ec',
  G: '#b8860b',
  K: '#1a1a1a'
};

const PATTERNS = [
  {
    id: 'tuanhua',
    zh: '团花',
    en: 'Roundel',
    py: 'tuánhuā',
    band: '库缎',
    bandEn: 'silk damask',
    size: 16,
    zhDesc: '极坐标生成的八出花瓣（石青）环抱一颗 2×2 赤金花心，外圈以月白点出一整圈蕊点——云锦最典型的中心对称构图，多用于袍料的团窠（roundel）位置。挑花结本时，花心与花瓣的边界决定提沉翻转的疏密。',
    enDesc: 'Eight blue petals, generated in polar coordinates, ring a 2×2 gold heart, with a full circle of white stamen dots outside: the classic centre-symmetric roundel of Nanjing brocade, usually set at the chest of a robe. In pattern-drafting the petal boundary is what decides how dense the lift reversal is.',
    map: [
      '................',
      '......WWWW......',
      '....WW....WW....',
      '...W........W...',
      '..W....BB....W..',
      '..W..BBBBBB..W..',
      '.W...BBBBBB...W.',
      '.W..BBBGGBBB..W.',
      '.W..BBBGGBBB..W.',
      '.W...BBBBBB...W.',
      '..W..BBBBBB..W..',
      '..W....BB....W..',
      '...W........W...',
      '....WW....WW....',
      '......WWWW......',
      '................',
    ]
  },
  {
    id: 'chanzhilian',
    zh: '缠枝莲',
    en: 'Lotus scroll',
    py: 'chánzhīlián',
    band: '妆花',
    bandEn: 'zhuanghua polychrome',
    size: 16,
    zhDesc: '一条波浪枝蔓自左下贯到右上、出入画外而不断，四朵月白莲花（赤金花心）等距骑在枝上，另生三道卷须。这一母题自唐传入，至明清成为最通行的织物骨架，云锦妆花袍料常以它为地。',
    enDesc: 'A single undulating vine runs from lower left to upper right, leaving the frame and never breaking; four white lotus blooms with gold hearts ride on it at even intervals, with three curled tendrils. The motif arrived from Tang workshops and became the most widespread fabric armature of the Ming and Qing.',
    map: [
      '...............B',
      '............BB.B',
      '............B.WB',
      '.............WGW',
      '..............WB',
      '..............BB',
      '.BB.......W..BB.',
      '..B..W..BWGWBB..',
      '...BWGWBB.W.....',
      '..BB.W..........',
      '.BB.............',
      '.WB.............',
      'WGW.............',
      'BW.B............',
      'BBBB............',
      'BB..............',
    ]
  },
  {
    id: 'siheyun',
    zh: '四合如意云',
    en: 'Four-way ruyi cloud',
    py: 'sìhé rúyì yún',
    band: '妆花',
    bandEn: 'zhuanghua polychrome',
    size: 16,
    zhDesc: '四朵如意云头分踞四个斜角，云头向内四合于中心、云尾各向两侧舒卷成勾，正中一枚 2×2 赤金云心。云纹是云锦命名之由来，四合云又是其中最基础的单元，可叠成"连云""四合四合"等层叠云式。',
    enDesc: 'Four ruyi cloud heads sit on the diagonals, their tips converging on the centre and their tails curling outward in hooks on either side, around a 2×2 gold cloud heart. Clouds give Nanjing brocade its name; the four-way arrangement is its basic unit, stacked into denser cloud fields on ceremonial robes.',
    map: [
      '................',
      '................',
      '......B..B......',
      '.....BB..BB.....',
      '....WB....BW....',
      '...BBBB..BBBB...',
      '..BB.BB..BB.BB..',
      '.......GG.......',
      '.......GG.......',
      '..BB.BB..BB.BB..',
      '...BBBB..BBBB...',
      '....WB....BW....',
      '.....BB..BB.....',
      '......B..B......',
      '................',
      '................',
    ]
  },
  {
    id: 'zhijin',
    zh: '织金几何',
    en: 'Gold-shot lattice',
    py: 'zhījīn jǐhé',
    band: '织金',
    bandEn: 'gold-shot',
    size: 16,
    zhDesc: '菱形骨架以扁金线通梭织入，格心嵌宝相花心。"织金""金宝地"一类以金显贵的品种，其底纹多是这种几何骨架；金线在提沉中始终处于经浮位，才能连续反光。',
    enDesc: 'A lozenge armature woven with flat gold thread, each cell holding a rosette heart. Gold-ground brocades are built on such geometry: the gold must stay on a warp float to keep its continuous sheen.',
    map: [
      'G.......G.......',
      '.G.....G.G.....G',
      '..G.G.G...G.G.G.',
      '...GBG.....GBG..',
      '..GBWBG...GBWBG.',
      '...GBG.....GBG..',
      '..G.G.G.G.G.G.G.',
      '.G.....GBG.....G',
      'G.....GBWBG.....',
      '.G.....GBG.....G',
      '..G.G.G.G.G.G.G.',
      '...GBG.....GBG..',
      '..GBWBG...GBWBG.',
      '...GBG.....GBG..',
      '..G.G.G...G.G.G.',
      '.G.....G.G.....G',
    ]
  },
  {
    id: 'zhezhimudan',
    zh: '折枝牡丹',
    en: 'Plucked peony branch',
    py: 'zhézhī mǔdān',
    band: '妆花',
    bandEn: 'zhuanghua polychrome',
    size: 16,
    zhDesc: '一枝斜出、六出花瓣层层抱心的写生式朵花。折枝（单枝入画）与缠枝（连绵不断）是织物构图的两种基本思路，前者更接近绘画。',
    enDesc: 'A single branch rising at an angle, its six-petalled bloom layered around a gold heart. The cut branch and the continuous scroll are the two basic logics of textile composition, the former closer to painting.',
    map: [
      '................',
      '................',
      '..........BB....',
      '........B.BBBB..',
      '........BBWWBB..',
      '.........WGGW...',
      '........BBWWBB..',
      '........B.BBBB..',
      '........WWBB....',
      '........W.......',
      '........W.......',
      '....BB.WW.......',
      '...BBBBBB.......',
      '...BWWWBBB......',
      '...WWGG.........',
      '................',
    ]
  },
  {
    id: 'luohualiushui',
    zh: '落花流水',
    en: 'Flowers on flowing water',
    py: 'luòhuā liúshuǐ',
    band: '库锦',
    bandEn: 'brocade',
    size: 16,
    zhDesc: '阶梯状水波三道，落花五瓣相间。宋锦"落花流水锦"传统的延续，云锦取其节奏感作缘边与袖襕，水波的方向性使织物在动时产生流动感。',
    enDesc: 'Three stepped water bands with five-petalled blossoms scattered between them, descended from the Song "falling blossoms on flowing water" brocade. Its directional rhythm makes the fabric seem to move.',
    map: [
      '..WWWW....WWWW..',
      '..WGGWBB..WGGWBB',
      'BBBWWBBBBBBWWBBB',
      'BBBB....BBBB....',
      '................',
      '...WW......WW...',
      '..WWWWBB..WWWWBB',
      'BBBWWBBBBBBWWBBB',
      'BBBWW...BBBWW...',
      '................',
      '...WW......WW...',
      '..WWWWBB..WWWWBB',
      'BBBWWBBBBBBWWBBB',
      'BBBWW...BBBWW...',
      '................',
      '................',
    ]
  },
];

// 待替换的 AI 影像氛围图位置清单（占位：当前由 Canvas 噪声 + 渐变程序生成，
// 无图亦可正常显示；Lead 可用同名 AI 影像替换，代码无需改动）。
const PENDING_ASSETS = [
  { id: 'atmo_cover', zh: '封面织物质感', en: 'cover silk texture', zhPrompt: '深色织锦微距：金线穿梭、丝光流动、浅景深', enPrompt: 'macro silk brocade, gold weft, shallow depth of field', seg: 'A1', pendingAsset: true, fallback: 'canvas-noise' },
  { id: 'atmo_loom', zh: '投梭织造底纹', en: 'weaving backdrop', zhPrompt: '大花楼织机经线如瀑的暗调局部', enPrompt: 'dark detail of a grand drawloom warp sheet', seg: 'A2', pendingAsset: true, fallback: 'canvas-noise' },
  { id: 'atmo_huaben', zh: '挑花结本底纹', en: 'pattern-book backdrop', zhPrompt: '手工编结丝线花本的特写，暖光', enPrompt: 'hands tying silk cords into a pattern program, warm light', seg: 'A3', pendingAsset: true, fallback: 'canvas-noise' },
  { id: 'atmo_timeline', zh: '时间线背景', en: 'timeline backdrop', zhPrompt: '1804 雅卡尔穿孔卡片提花机', enPrompt: '19th-century Jacquard loom with punched cards', seg: 'A4', pendingAsset: true, fallback: 'canvas-noise' },
  { id: 'atmo_five', zh: '五态同构背景', en: 'five-states backdrop', zhPrompt: '打孔卡片→二进制→晶圆的意象转场', enPrompt: 'punched card morphing into glowing binary and a wafer', seg: 'A5', pendingAsset: true, fallback: 'canvas-noise' },
  { id: 'atmo_team', zh: '团队页收束图', en: 'closing image', zhPrompt: '成品云锦披在肩上，博物馆灯光', enPrompt: 'brocade robe on a shoulder, museum light', seg: 'A6', pendingAsset: true, fallback: 'canvas-noise' },
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PATTERNS: PATTERNS, PATTERN_LEGEND: PATTERN_LEGEND, PATTERN_COLORS: PATTERN_COLORS, PENDING_ASSETS: PENDING_ASSETS };
}
