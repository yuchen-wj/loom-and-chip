// ============================================================
// 《织机与芯片》织造技术编年史 —— 中西双轨 8 节点
// 每条史实均附 source 字段（来源类别），正文以"教学示意"为定位，不做文物级复原。
// 字段：id｜era / eraEn 年代｜zh / en 节点名（中性，用于详情页标题与无障碍标签）｜
//      cnCard 左列"中国轨"卡片标题（缺省时用 zh）｜
//      cn 中国轨（同一时期的中国）｜west 西方轨（同一时期的世界）｜
//      code 该节点的"编码介质形态"｜link 传播/类比连结点｜order 排序
// 双轨约定：左列一律讲中国，右列一律讲西方/世界；1804 之后的机器（雅卡尔、
// 霍列瑞斯、存储程序）属西方轨，中国轨讲同一时期的中国织造。
// ============================================================

const TIMELINE = [
  {
    id: 'han', order: 1, era: '公元前 1 世纪', eraEn: '1st century BCE',
    zh: '汉·多综多蹑提花机', en: 'Han dynasty: the multi-heddle drawloom',
    code: { zh: '综框 / 踏板组合', en: 'heddle frames + treadles' },
    cn: {
      title: '多综多蹑：汉代提花的主流',
      titleEn: 'Multi-heddle, multi-treadle: the Han mainstream',
      body: '汉代提花机的主流形制是"多综多蹑"——多片综框配多根踏板，织工按顺序踏蹑，综框整组升降，一纬之内能控制的经线数由综框片数与踏蹑顺序决定。'
          + '至迟在西汉，中国织工已能用数十片综框、上千根经线织出循环复杂的锦：湖南长沙马王堆、湖北江陵马山出土的织锦，'
          + '其纹样循环与经线密度都需要以千计的提沉组合才织得出来。'
          + '"束综"（花楼式，一根经线一根束线、可单独提落）是后来的事：学界一般表述为与唐宋以后的花楼织机相关，汉代尚未成熟。',
      en: 'The mainstream Han figure loom was the multi-heddle, multi-treadle type: many heddle frames and many treadles,'
          + ' worked in sequence, so the number of controllable ends per pick followed the number of frames and the treadling'
          + ' order. By the Western Han Chinese weavers could already produce elaborate repeats on dozens of frames and over'
          + ' a thousand ends: the brocades excavated at Mawangdui and Mashan require lift combinations in the thousands.'
          + ' The individual-end harness belongs to a later stage — conventionally associated with the tower drawloom of the'
          + ' Tang and after, and not yet mature in the Han.',
      source: '考古报告（马王堆一号汉墓、江陵马山一号楚墓）｜纺织史专著'
    },
    west: {
      title: '地中海的竖机与纬起花',
      titleEn: 'Upright looms and weft figuring in the Mediterranean',
      body: '同一时期的地中海世界以竖机（vertical loom）为主，织工靠手工挑经起花，幅宽与纹样循环都受体力限制。'
          + '埃及、叙利亚的科普特织物留下了大量纬起花羊毛织物，其"逐段挑织"的思路与通经断纬相通，但尚未形成可复用的编码介质。',
      en: 'The Mediterranean world worked mainly on the upright loom, picking the figure by hand; width and repeat were'
          + ' limited by the weaver\'s reach. Coptic textiles from Egypt and Syria show extensive weft-faced wool patterning'
          + ' with a pick-by-pick logic close to discontinuous weft, but with no reusable coding medium yet.',
      source: '博物馆藏品图录（科普特织物）｜技术史通论'
    },
    link: { zh: '共同需求：让"某一根经线是否提起"可被记忆与复用', en: 'Shared problem: making "is this end raised?" memorable and reusable' }
  },
  {
    id: 'tang', order: 2, era: '8 世纪', eraEn: '8th century',
    zh: '唐·纬锦与联珠纹', en: 'Tang: weft-faced brocade and pearl roundels',
    code: { zh: '纬线显花序列', en: 'weft figuring sequence' },
    cn: {
      title: '把颜色搬到纬线上：一次技术转向',
      titleEn: 'Moving colour onto the weft: a technical turn',
      body: '唐代织工大量吸收西域织法，改"经线显花"为"纬线显花"。这不只是换方向：经线在整幅上固定，'
          + '换色必须换经；纬线却可以逐段投入，于是颜色数量第一次不再受经轴限制。'
          + '联珠团窠、对鸟对兽等萨珊式纹样随之进入中国织锦，纬锦成为新的主流。',
      en: 'Tang weavers absorbed Central Asian methods and moved the figure from warp to weft. This was not a mere change of'
          + ' direction: warps run the full length, so changing colour means changing the beam, whereas wefts can be inserted'
          + ' section by section. For the first time the palette was no longer limited by the warp. Sasanian-style pearl'
          + ' roundels and confronted animals entered Chinese brocade, and weft-faced weaving became the mainstream.',
      source: '《唐六典》贡赋记载｜吐鲁番阿斯塔那墓葬出土织物｜纺织史专著'
    },
    west: {
      title: '波斯与拜占庭的纬起花传统',
      titleEn: 'Sasanian and Byzantine weft figuring',
      body: '萨珊波斯与拜占庭的丝织业以纬起花见长，联珠纹、对兽纹经由中亚绿洲传入唐。'
          + '技术与纹样同路而行——这正是"文明互鉴"在织物上的直接证据。',
      en: 'Sasanian and Byzantine silk industries excelled at weft-faced patterning; pearl roundels and confronted beasts'
          + ' travelled through the Central Asian oases into Tang China. Technique and motif moved along the same road —'
          + ' direct evidence of mutual learning written in cloth.',
      source: '博物馆藏品图录（萨珊、拜占庭丝织）｜丝绸之路考古综述'
    },
    link: { zh: '断纬 → 彩纬可分色盘织，为妆花埋伏笔', en: 'Discontinuous weft → colour wefts inlaid by section, the road to zhuanghua' }
  },
  {
    id: 'yuan', order: 3, era: '13—14 世纪', eraEn: '13th–14th century',
    zh: '元·织金锦（纳石失）', en: 'Yuan: gold brocade (nasij)',
    code: { zh: '片金通织', en: 'flat gold throughout' },
    cn: {
      title: '织工大流动与"金锦"传统',
      titleEn: 'Weavers on the move and the gold-brocade tradition',
      body: '蒙古西征把中亚织工成批带到东方，元代官方作坊中出现了"纳石失"——以片金、捻金通织的织金锦。'
          + '金线不耐反复弯折，因此提沉次数越少越好；这逼迫织工把纹样做得更整块、更几何，也间接塑造了后来云锦织金的视觉语言。',
      en: 'The Mongol conquests brought Central Asian weavers east in numbers, and Yuan workshops produced nasij — brocade'
          + ' shot through with flat and twisted gold. Gold thread tolerates little bending, so fewer lift reversals are'
          + ' better: patterns became blockier and more geometric, shaping the visual language of later gold-shot brocade.',
      source: '《元史·舆服志》｜《大元毡罽工物记》｜中亚纺织史研究'
    },
    west: {
      title: '欧洲织金与意大利丝织的崛起',
      titleEn: 'Gold brocade in Europe and the rise of Italian silk',
      body: '同一世纪，金线经由伊斯兰世界进入西西里与卢卡、威尼斯的丝织作坊。欧洲织金锦（samite、diasper）'
          + '大量用于教堂法衣，其纹样骨架与中国织金高度可比——技术随人走，人随政权走。',
      en: 'In the same century gold thread reached Sicilian, Lucchese and Venetian workshops through the Islamic world.'
          + ' European gold brocades (samite, diasper) served mainly for church vestments, on armatures strikingly'
          + ' comparable to Chinese gold-shot silks: technique travels with people, and people with power.',
      source: 'V&A / 卢浮宫藏品图录｜欧洲丝织技术史'
    },
    link: { zh: '金线 ⇒ 更少提沉 ⇒ 更几何的编码', en: 'Gold ⇒ fewer reversals ⇒ more geometric coding' }
  },
  {
    id: 'ming', order: 4, era: '15—17 世纪', eraEn: '15th–17th century',
    zh: '明·云锦大花楼与挑花结本', en: 'Ming: the grand drawloom and pattern drafting',
    code: { zh: '花本线（编结）', en: 'knotted cord pattern book' },
    cn: {
      title: '把程序从机器里拿出来：花本',
      titleEn: 'Taking the programme out of the machine: the pattern book',
      body: '明代定都南京后设官营织造，云锦在妆花与织金两方面定型。大花楼织机高逾四米，上下两人配合：'
          + '楼上"提花工"按花本拽线，楼下"织手"投梭打纬、盘织彩绒。'
          + '关键的一步是"挑花结本"——把纹样换算成每一纬的经线提沉序列，再用丝线编结成一本可以卷起来、可以换下来、可以复制的"花本"。'
          + '这是目前可考的技术史中，较早把“程序”做成独立于机器的、可更换物理介质的实例。',
      en: 'With the Ming capital at Nanjing, official workshops fixed the zhuanghua and gold-shot techniques. The grand'
          + ' drawloom stands over four metres tall and needs two people: above, a drawboy pulls cords according to the'
          + ' pattern book; below, the weaver throws the shuttle, beats, and inlays colour. The decisive step is pattern'
          + ' drafting: the design is converted into a lift sequence for every pick and knotted into cords — a programme'
          + ' that can be rolled up, taken off and copied. For the first time a programme became a physical medium'
          + ' independent of the machine.',
      source: '《天工开物·乃服》｜江宁织造档案｜南京云锦研究所公开释文'
    },
    west: {
      title: '意大利丝织工坊的组织化',
      titleEn: 'The guild workshops of Italian silk',
      body: '卢卡、佛罗伦萨、威尼斯的丝织行会在此期形成规模化生产，提花机需要两名工人协作、'
          + '纹样以"点纸"（point paper）预先规划——与挑花结本的"意匠图"是同一思路的两种写法。',
      en: 'Lucchese, Florentine and Venetian silk guilds scaled up production; their drawlooms needed two workers, and'
          + ' designs were planned in advance on point paper — the same idea as the Chinese point-paper draft, written'
          + ' differently.',
      source: '佛罗伦萨丝绸行会档案研究｜技术史通论'
    },
    link: { zh: '花本 = 可更换的程序介质 —— 全作品的核心论点', en: 'Pattern book = replaceable programme medium: the thesis of this work' }
  },
  {
    id: 'jacquard', order: 5, era: '1804', eraEn: '1804',
    zh: '法·雅卡尔穿孔卡片提花机', en: 'France: Jacquard\'s punched-card loom',
    cnCard: { zh: '清·江宁织造：云锦贡品的最后高峰', en: 'Qing Jiangning: last peak of court brocade' },
    code: { zh: '穿孔卡片', en: 'punched cards' },
    cn: {
      title: '同一时期的中国：手工花楼与宫廷贡品',
      titleEn: 'China at the same time: the hand drawloom and court commissions',
      body: '1804 年的中国，云锦仍由江宁织造局的官营作坊以手工织造：大花楼织机高逾四米，楼上拽花、楼下投梭盘彩，'
          + '一匹妆花往往要数月，一年所出不过数十匹，专供宫廷与赏赐。'
          + '花本依旧用丝线编结，纹样每改一次就要重挑一次花；这套"人记、线存"的体系把手工提花推到了极致，却没有走向机读卡片。'
          + '同年两条技术路线分岔：一条把程序交给机器，一条守着人力与手感——分岔不发生在技术上，而发生在需求上。',
      en: 'In 1804 Chinese brocade was still woven by hand in the official Jiangning workshops: the tower drawloom stands over'
          + ' four metres tall, a drawboy works the cords above while the weaver throws the shuttle below, and a single'
          + ' zhuanghua panel can take months. The pattern book was still knotted from silk: every change of design meant'
          + ' re-tying the cords. The system took hand figuring as far as it could go, but never moved to machine-read cards.'
          + ' In the same year two technical paths diverged — not for lack of skill, but for lack of demand for a programme'
          + ' the machine could read by itself.',
      source: '清代江宁织造档案｜《天工开物·乃服》｜南京云锦研究所公开释文'
    },
    west: {
      title: '雅卡尔：卡片链，第一台可编程机器',
      titleEn: 'Jacquard: the card chain, the first programmable machine',
      body: '1804 年，法国里昂的织工雅卡尔（Joseph-Marie Jacquard）用一串打了孔的硬纸卡取代了拽花工：'
          + '每张卡对应一纬，孔位对应经线，卡片首尾相连、自动循环。'
          + '这正是花本的逻辑——只是把"丝线打结"换成了"纸片打孔"，把"人记"改成了"机读"。'
          + '雅卡尔机被普遍认为是第一台"可编程"的机器：换一套卡片就换一种织物，机器本身不变。'
          + '此后两百年，"程序与机器分离"反复出现——只是介质从纸卡换成了磁带、磁盘、闪存。',
      en: 'In 1804 the Lyon weaver Joseph-Marie Jacquard replaced the drawboy with a chain of punched cards: one card per'
          + ' pick, a hole for each end, the chain laced end to end and cycling automatically. This is precisely the logic'
          + ' of the pattern book — silk knots exchanged for paper holes, and human memory for machine reading. The loom is'
          + ' widely regarded as the first programmable machine: swap the cards and the cloth changes while the machine'
          + ' stays the same. For two centuries afterwards the separation of programme from machine recurs, with the medium'
          + ' changing from card to tape to disk to flash.',
      source: '雅卡尔机专利与里昂纺织档案｜Science Museum London 藏品说明｜计算机史通论'
    },
    link: { zh: '打结 → 打孔：编码介质换了，编码结构没变', en: 'Knots → holes: the medium changed, the structure did not' }
  },
  {
    id: 'hollerith', order: 6, era: '1890', eraEn: '1890',
    zh: '美·霍列瑞斯打孔卡制表机', en: 'USA: Hollerith\'s punched-card tabulator',
    cnCard: { zh: '1890 洋务：机器织布进来了，提花仍是手工', en: '1890: machine spinning arrives, figuring stays by hand' },
    code: { zh: '打孔卡（数据）', en: 'punched cards as data' },
    cn: {
      title: '同一时期的中国：机器织布，手工提花',
      titleEn: 'China at the same time: machine cloth, hand figuring',
      body: '1890 年前后，洋务派在上海办起的机器织布局开工，中国第一次用蒸汽动力织布；但机器织的是平布，提花依旧靠木机与花本。'
          + '同一时期，清廷的官营织造随着国势衰落而收缩，云锦织工散入民间作坊，宫廷订货一年少于一年。'
          + '一门以"记忆与复用"为核心的手工编码技术，在它的发源地缓慢退场；而同一张打孔卡片，在西方正要变成数据。',
      en: 'Around 1890 the machine-run weaving mill set up at Shanghai by the self-strengthening movement went into'
          + ' operation: for the first time China wove cloth with steam power. But the machines wove plain cloth; figuring'
          + ' still depended on wooden looms and knotted pattern books. Meanwhile the Qing official workshops contracted'
          + ' with the dynasty\'s fortunes, weavers scattered into private ateliers, and court orders dwindled year by year.'
          + ' A hand-worked coding technique built on memory and reuse was slowly leaving its birthplace — while the same'
          + ' punched card was about to become data in the West.',
      source: '中国近代纺织史｜上海机器织布局史料｜南京云锦研究所所史'
    },
    west: {
      title: '霍列瑞斯：同一张卡，从"织什么"变成"记什么"',
      titleEn: 'Hollerith: the same card, from "what to weave" to "what to record"',
      body: '1890 年美国人口普查，霍列瑞斯（Herman Hollerith）把打孔卡从织机搬到统计：'
          + '每个人一张卡，孔位记录性别、年龄、籍贯；机器以探针读孔、自动计数。'
          + '编码介质没有变，变的是它承载的对象——从"这一纬哪几根经线提起"，变成"这个人属于哪一类"。'
          + '1896 年他创办制表机器公司，1924 年并入 IBM。计算机产业的第一块基石，与提花机的卡片是同一项技术；'
          + '同一套卡片、同一台读卡机，可以处理任何被编码的对象。',
      en: 'For the 1890 US census Herman Hollerith moved the punched card from the loom to statistics: one card per person,'
          + ' holes recording sex, age and origin, read by pins and counted automatically. The medium was unchanged; what'
          + ' changed was the object encoded — not "which ends rise on this pick" but "which class this person belongs to".'
          + ' His Tabulating Machine Company (1896) merged into IBM in 1924. The first foundation stone of the computer'
          + ' industry is the same technology as the Jacquard card: the same cards and the same reader could process any'
          + ' object that had been encoded.',
      source: '1890 年美国人口普查报告｜IBM 公司史档案｜计算机史通论'
    },
    link: { zh: '编码对象从"纹样"扩展到"万物"', en: 'The encoded object expands from pattern to anything' }
  },
  {
    id: 'stored', order: 7, era: '1940s', eraEn: '1940s',
    zh: '存储程序：把卡片搬进存储器', en: 'The stored program: cards move into memory',
    cnCard: { zh: '1940s 战乱：云锦濒于失传', en: '1940s: brocade close to being lost' },
    code: { zh: '存储器中的二进制', en: 'binary in memory' },
    cn: {
      title: '同一时期的中国：工艺濒于失传',
      titleEn: 'China at the same time: the craft nearly lost',
      body: '1940 年代的中国战乱频仍，云锦的主要买主——宫廷、官服与富商订货——几乎消失，大花楼织机数量锐减，'
          + '会拽花的老艺人相继离世。'
          + '花本一旦无人能读，就只剩一堆打不开的结：这套"可更换的程序介质"在它的故乡第一次面临整体失传。'
          + '直到 1950 年代南京成立研究机构，才重新整理花本、恢复妆花工艺；今天能跑通的两千年前的结构，是这之后一点点接回来的。',
      en: 'China in the 1940s was at war. The main buyers of brocade — the court, official robes, wealthy patrons — had'
          + ' almost vanished, the number of tower drawlooms fell sharply, and the drawboys who could read a pattern book'
          + ' died one by one. A pattern book that no one can read is only a bundle of knots: the replaceable programme'
          + ' medium came close to being lost altogether in its own homeland. Only in the 1950s, when a research institute'
          + ' was set up in Nanjing, were the cords sorted out again and zhuanghua weaving revived.',
      source: '南京云锦研究所所史｜非物质文化遗产申报材料｜技术史通论'
    },
    west: {
      title: '冯·诺依曼 / EDSAC：可改写程序的机器',
      titleEn: 'Von Neumann / EDSAC: the rewritable programme',
      body: '1940 年代，冯·诺依曼等人在 EDVAC 报告中提出"存储程序"：指令和数据一样放进可读写的存储器，不再靠外部卡片链驱动。'
          + '这一步取消了物理介质，却没有取消编码结构——地址、操作码、数据，仍然是一组有序的 0 与 1。'
          + '程序进入存储器后，"换程序"不再需要重新穿卡片，只需改写内容。'
          + '如果说花本是"可更换的介质"，存储程序就是"可更换 + 可改写"的介质：两种性质合并。',
      en: 'In the 1940s von Neumann and others set out the stored-program idea in the EDVAC report: instructions kept in'
          + ' rewritable memory alongside data, no longer driven by an external card chain. This step removed the physical'
          + ' medium but not the coding structure — addresses, opcodes and data remain ordered zeros and ones. Once the'
          + ' programme lived in memory, changing it no longer meant re-lacing cards but rewriting content. If a pattern'
          + ' book is a replaceable medium, the stored programme is a replaceable and rewritable one: the two properties'
          + ' merged.',
      source: 'EDVAC 报告草案（1945）｜EDSAC 复原档案｜计算机史通论'
    },
    link: { zh: '介质消失，结构留下', en: 'The medium disappears; the structure remains' }
  },
  {
    id: 'pixel', order: 8, era: '2009 — 今日', eraEn: '2009 – today',
    zh: '云锦入名录 · 像素与算力', en: 'Inscription, pixels and compute',
    code: { zh: '像素矩阵', en: 'pixel matrix' },
    cn: {
      title: '回到网格：编码与像素同构',
      titleEn: 'Back to the grid: code and pixel are isomorphic',
      body: '2009 年，南京云锦木机妆花手工织造技艺列入联合国教科文组织人类非物质文化遗产代表作名录。'
          + '今天你在这件作品里做的那件事——在一张 16×16 的格子上点出一朵团花，然后看它变成花本、变成卡片、'
          + '变成纸带、变成二进制、变成像素——正是这条两千年链条的当前一环。'
          + '一块手机屏幕上的 16×16 像素与一片花本、一张卡片，是同一个数据结构的不同介质实现。',
      en: 'In 2009 the Nanjing Yunjin hand-weaving technique was inscribed on UNESCO\'s Representative List of the'
          + ' Intangible Cultural Heritage of Humanity. What you do in this work — tapping a roundel onto a 16×16 grid and'
          + ' watching it become a cord pattern book, a card, a paper tape, a bit string, a pixel matrix — is the present'
          + ' link of a two-thousand-year chain. Sixteen by sixteen pixels on a phone screen, a sheet of pattern cords and'
          + ' a punched card are the same data structure in different media.',
      source: 'UNESCO 人类非物质文化遗产代表作名录（2009）｜本作品自身算法与数据'
    },
    west: {
      title: 'GPU、矩阵与生成模型',
      titleEn: 'GPUs, matrices and generative models',
      body: '当代图形处理器以矩阵运算为核心，屏幕上的每一个像素都是一次编码的产物；'
          + '生成式模型进一步把"纹样设计"本身也纳入同一套矩阵运算。'
          + '两千年前的花本、两百年前的卡片、今天的张量，处理的都是"二维网格上的离散取值"。',
      en: 'Contemporary GPUs are matrix engines, and every pixel on a screen is the output of an encoding; generative'
          + ' models bring the design of a pattern itself into the same matrix arithmetic. The pattern book of two thousand'
          + ' years ago, the card of two hundred years ago and today\'s tensor all handle discrete values on a two-'
          + ' dimensional grid.',
      source: '计算机图形学教材｜UNESCO 名录｜技术史通论'
    },
    link: { zh: '花本 → 卡片 → 纸带 → 二进制 → 像素：五态同构', en: 'cords → cards → tape → bits → pixels: five isomorphic states' }
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TIMELINE: TIMELINE };
}
