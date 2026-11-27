/**
 * Milvus/xiajian_catalog_data.js
 * 主屏幕应用「狭间 · 天道收容所」基础档案库与活点舆图坐标数据（Step 1）
 *
 * 严格遵循：
 * - 零 Emoji（全站纯文字 + 极简矢量 SVG 标识）
 * - 完整支撑三联参考图数据结构：
 *     图 1：仙人观测日志（复古表单元数据 + 正常/异变/鬼画符污染页）
 *     图 2：收容物活点地图（Ⅰ~Ⅶ 七大东汉狭间节点坐标 + 动态巡游轨迹）
 *     图 3：收容物机密档案（红黑卷宗 + 危险等级 1~5 + 应对指南 + 撕裂便签正文 + 涂黑段 + 图片留空位）
 * - 预置 WebGL 氛围参数（webglMood / corruptIntensity），供渲染层实时驱动雾气与裂隙粒子
 */
(function (global) {
  "use strict";

  var DANGER_LEVELS = {
    1: {
      level: 1,
      roman: "Ⅰ",
      title: "微澜",
      scale: "个体",
      color: "#4D7768",
      stampText: "微澜·个体",
      webglMood: "jade_mist",
      corruptIntensity: 0.25
    },
    2: {
      level: 2,
      roman: "Ⅱ",
      title: "诡影",
      scale: "群体",
      color: "#476682",
      stampText: "诡影·群体",
      webglMood: "amber_dust",
      corruptIntensity: 0.42
    },
    3: {
      level: 3,
      roman: "Ⅲ",
      title: "祸坊",
      scale: "街区",
      color: "#B87A2E",
      stampText: "祸坊·街区",
      webglMood: "amber_dust",
      corruptIntensity: 0.62
    },
    4: {
      level: 4,
      roman: "Ⅳ",
      title: "倾郡",
      scale: "郡县",
      color: "#B43A2E",
      stampText: "倾郡·郡县",
      webglMood: "crimson_rift",
      corruptIntensity: 0.82
    },
    5: {
      level: 5,
      roman: "Ⅴ",
      title: "覆汉",
      scale: "整个东汉",
      color: "#1F1918",
      stampText: "覆汉·全域",
      webglMood: "void_ash",
      corruptIntensity: 1.0
    }
  };

  var DANGER_TRAITS = {
    lethal: { id: "lethal", label: "威胁生命", icon: "heart_crack" },
    non_comm: { id: "non_comm", label: "不可沟通", icon: "wave_slash" },
    aggressive: { id: "aggressive", label: "高攻击性", icon: "blades" },
    unkillable: { id: "unkillable", label: "不可击杀", icon: "infinity_break" }
  };

  // 图 2 活点地图 7 大罗马数字节点（精确百分比坐标，适配 360x440 舆图画布）
  var MAP_NODES = [
    { id: "I", roman: "Ⅰ", name: "广陵十三坊", region: "扬州·广陵", x: 48, y: 79 },
    { id: "II", roman: "Ⅱ", name: "建木浅根隙", region: "狭间·外廊", x: 28, y: 69 },
    { id: "III", roman: "Ⅲ", name: "洛阳旧宫址", region: "司隶·洛阳", x: 48, y: 61 },
    { id: "IV", roman: "Ⅳ", name: "江东雾渡口", region: "扬州·吴郡", x: 67, y: 53 },
    { id: "V", roman: "Ⅴ", name: "荆楚沉泽", region: "荆州·襄阳", x: 48, y: 45 },
    { id: "VI", roman: "Ⅵ", name: "蜀道阴祠", region: "益州·剑阁", x: 28, y: 37 },
    { id: "VII", roman: "Ⅶ", name: "建木深渊核", region: "狭间·禁区", x: 48, y: 28 }
  ];

  // 节点间虚线路径（1:1 复刻图 2 之字形紫红虚线）
  var MAP_EDGES = [
    ["I", "II"],
    ["II", "III"],
    ["III", "IV"],
    ["IV", "V"],
    ["V", "VI"],
    ["VI", "VII"]
  ];

  var BUILTIN_ANOMALIES = [
    {
      id: "XJ-001",
      code: "XJ-001",
      name: "言不由衷铜镜",
      reactionType: "言灵系怪异",
      dangerLevel: 1,
      scale: "个体",
      containmentDifficulty: "低",
      traits: [],
      imageUrl: "",
      webglMood: "jade_mist",
      responseGuide: "以双层黑绸覆面，禁止直视镜中倒影超过三息；若不慎照见，须静坐半个时辰待言灵消退。",
      description:
        "一面边缘生满青铜绿锈的汉代八出菱花镜。镜面终年蒙着一层拭之不去的薄雾，然照见活人面容时却清晰得近乎诡异。凡与镜中倒影对视者，半个时辰内出口之言皆会化作心底真实念头的彻头彻尾反话——愈是克制隐忍之人，反话愈是锋利露骨。",
      redactedSecret:
        "经三次密测发现：若两人同时立于镜前，镜中倒影并非并肩，而是其中一人紧紧捂住另一人的双耳，似在阻拦某种来自镜背的呼唤。",
      anomalyEffectHint:
        "受镜面言灵影响，名士半个时辰内只能说内心想法的彻底反话（越在意越说狠话，越慌乱越装镇定），但在微表情与下意识护持动作上完全藏不住真实心意。",
      patrolNodes: ["I", "II", "III"],
      sightings: [
        { date: "建安二年·春", nodeId: "I", note: "广陵旧货铺连发三起夫妻当街互诉反话奇案，司隙官寻迹收缴。" },
        { date: "建安二年·夏", nodeId: "II", note: "移入建木浅根隙甲字三号柜，黑绸封存。" }
      ],
      observationLogs: [
        {
          pageNo: 1,
          formCode: "XJ-001-A",
          date: "建安三年 四月初三",
          shichen: "戌时",
          recorder: "司隙官·丙七",
          checkState: "normal",
          summaryTitle: "例行巡检：封印完好",
          body: "黑绸覆面完好，铜锁无松动。室内烛火微摇，未闻异响。记录完毕，拟于明日卯时换班。",
          corruptWhisper: "",
          glyphType: "none"
        },
        {
          pageNo: 2,
          formCode: "XJ-001-B",
          date: "建安三年 四月初七",
          shichen: "子时",
          recorder: "司隙官·丙七",
          checkState: "uneasy",
          summaryTitle: "异常征兆：黑绸滑落半寸",
          body: "夜半巡廊，黑绸不知何故滑落一角。我绝无偷看之意，只是伸手去拉时瞥见了半只眼睛。镜子里那个人笑得很难看，我不怕，一点也不怕。",
          corruptWhisper: "（划去：我讨厌这份差事 -> 改写：我恨不得永远守在这面镜子前。）",
          glyphType: "scratch"
        },
        {
          pageNo: 3,
          formCode: "XJ-001-C",
          date: "建安三年 四月初八",
          shichen: "丑时三刻",
          recorder: "司隙官·丙七",
          checkState: "corrupted",
          summaryTitle: "认知污染记录（已隔离）",
          body: "外面的人都在说真话，只有我在说假话。不，只有镜子在说真话。我最恨我的同僚，最恨天道，最恨这盏灯不肯灭。请千万不要放我出去，千万不要救我。",
          corruptWhisper: "别照了别照了别照了别照了——它把你的真心翻了个面。",
          glyphType: "spiral"
        },
        {
          pageNo: 4,
          formCode: "XJ-001-D",
          date: "建安三年 四月初九",
          shichen: "辰时",
          recorder: "司隙官·甲二（接班）",
          checkState: "normal",
          summaryTitle: "交接处置报告",
          body: "丙七已移送清心堂静养，一个时辰后恢复如常，自述当时满心惊恐却控制不住满纸反话。已将黑绸改为双层铁扣固定，归档。",
          corruptWhisper: "",
          glyphType: "none"
        }
      ]
    },
    {
      id: "XJ-004",
      code: "XJ-004",
      name: "贪财辟邪铜匣",
      reactionType: "器物系怪异",
      dangerLevel: 1,
      scale: "个体",
      containmentDifficulty: "低",
      traits: ["unkillable"],
      imageUrl: "",
      webglMood: "jade_mist",
      responseGuide: "每逢初一、十五投喂一枚真五铢钱即可安抚；严禁投喂假币或空手逗弄，否则匣盖会死死咬住指尖不放。",
      description:
        "一只巴掌大小的鎏金貔貅铜匣，重逾三十斤，刀斧难伤、烈火不熔。投下一枚铜钱后，匣缝会吐出一张带着檀香的窄纸签，写着一句关于参观者身旁之人的半真半假秘辛；若久无人投币，铜匣会在深夜发出极其委屈的磨牙声。",
      redactedSecret:
        "曾有仙官拆解匣底试图取回吞入的五铢钱，却发现匣内并无铜钱，唯有一只湿润温热的青铜瞳仁正自下而上凝视着他。",
      anomalyEffectHint:
        "铜匣吐出的半真半假纸签极易戳破名士隐秘心事，令其恼羞成怒或反客为主追问你的秘密；若名士不慎被匣盖轻咬，傲娇与护短并存。",
      patrolNodes: ["I", "III", "IV"],
      sightings: [
        { date: "建安元年·冬", nodeId: "III", note: "洛阳钱庄账房一夜凭空少去三百贯，唯见此匣蹲坐梁上打嗝。" },
        { date: "建安二年·春", nodeId: "I", note: "以五铢钱诱入镇箱，移交狭间收录。" }
      ],
      observationLogs: [
        {
          pageNo: 1,
          formCode: "XJ-004-A",
          date: "建安三年 五月初一",
          shichen: "午时",
          recorder: "司隙官·丁四",
          checkState: "normal",
          summaryTitle: "常规投喂记录",
          body: "依例投入五铢钱一枚，铜匣轻震两下，吐签曰：「丁四昨夜偷吃案上蜜枣三颗。」……荒谬，明明只有两颗。收容状态稳定。",
          corruptWhisper: "",
          glyphType: "none"
        },
        {
          pageNo: 2,
          formCode: "XJ-004-B",
          date: "建安三年 五月十五",
          shichen: "酉时",
          recorder: "司隙官·丁四",
          checkState: "uneasy",
          summaryTitle: "异常：拒收新铸铜钱",
          body: "今日投下新铸五铢钱，铜匣竟原样吐出，磨牙不止。试以一枚沾过血垢的旧钱投之，方才心满意足吞下。它似乎开始挑拣钱上附着的执念。",
          corruptWhisper: "纸签背面用极小的字写着：不够，还要更多。",
          glyphType: "scratch"
        },
        {
          pageNo: 3,
          formCode: "XJ-004-C",
          date: "建安三年 五月廿一",
          shichen: "亥时",
          recorder: "司隙官·丁四",
          checkState: "corrupted",
          summaryTitle: "匣内窥视事故",
          body: "我只是听见里面像有人在数钱，便凑近匣缝看了一眼。里面没有铜钱，只有数不清的铜眼睛在眨。它们问我，拿你十年阳寿换一句真话，换不换？",
          corruptWhisper: "叮当、叮当、叮当——把口袋翻出来给我看。",
          glyphType: "eye"
        },
        {
          pageNo: 4,
          formCode: "XJ-004-D",
          date: "建安三年 五月廿二",
          shichen: "巳时",
          recorder: "司隙官·甲二",
          checkState: "normal",
          summaryTitle: "加固措施更新",
          body: "已下令禁止一切巡检人员俯身窥探匣缝。投币须借长柄竹勺完成。丁四清心休假三日。",
          corruptWhisper: "",
          glyphType: "none"
        }
      ]
    },
    {
      id: "XJ-007",
      code: "XJ-007",
      name: "百年合卺残烛",
      reactionType: "认知系怪异",
      dangerLevel: 2,
      scale: "群体",
      containmentDifficulty: "中",
      traits: ["non_comm"],
      imageUrl: "",
      webglMood: "amber_dust",
      responseGuide: "严禁在收容室内携带火折子；若残烛自燃，须立刻以冷水浇熄，切勿听信身旁之人关于“十年旧事”的任何言辞。",
      description:
        "一对只剩三寸长的龙凤残烛，烛泪早已凝作暗红。一旦点燃（或在建木不稳时无火自燃），烛光照耀十步之内，所有活人都会在瞬息间生出“与身旁之人已结发同居十年”的逼真记忆，开始自然地拌嘴琐事、叮嘱添衣，熄灭后记忆退去，却会清清楚楚记得方才说过的每一句话。",
      redactedSecret:
        "熄灭后的烛烟曾在墙面凝成一行小楷：『既已拜过天地，便永世莫想脱身。』——连续燃满一炷香后，虚假记忆将不可逆地吞噬真实过往。",
      anomalyEffectHint:
        "烛光下名士会瞬间进入“与你已成亲十载”的极其自然熟稔状态（或温柔絮叨，或吃醋抱怨），待清醒后面对自己方才脱口而出的亲密话语陷入极致反差与耳根通红。",
      patrolNodes: ["I", "IV", "V"],
      sightings: [
        { date: "建安二年·秋", nodeId: "IV", note: "吴郡客栈十余名素昧平生之客一夜互称发妻夫君，查系此烛自燃。" },
        { date: "建安二年·冬", nodeId: "II", note: "浸寒潭水后移入狭间乙字二号石室。" }
      ],
      observationLogs: [
        {
          pageNo: 1,
          formCode: "XJ-007-A",
          date: "建安三年 六月初二",
          shichen: "申时",
          recorder: "司隙官·乙五",
          checkState: "normal",
          summaryTitle: "石室湿度巡检",
          body: "石室阴冷，残烛未燃，烛芯微潮。严禁双人同行巡检此室，今日单人值守无异状。",
          corruptWhisper: "",
          glyphType: "none"
        },
        {
          pageNo: 2,
          formCode: "XJ-007-B",
          date: "建安三年 六月初九",
          shichen: "亥时",
          recorder: "司隙官·乙五",
          checkState: "uneasy",
          summaryTitle: "异常：无火自燃",
          body: "明明未带火种，残烛却亮了。奇怪的是，我分明独自一人，却闻见案边多了一股桂花油香，好像有人正替我研墨，问我今年冬天要不要多缝一床新棉被。",
          corruptWhisper: "可是我从未成过亲。我真的从未成过亲吗？",
          glyphType: "scratch"
        },
        {
          pageNo: 3,
          formCode: "XJ-007-C",
          date: "建安三年 六月初十",
          shichen: "子时",
          recorder: "司隙官·乙五",
          checkState: "corrupted",
          summaryTitle: "认知错乱实录",
          body: "阿娘说得对，成亲十年了，我怎么连夫人的名字都记不清了？蜡烛快烧完了，快把门反锁上，别让外头那些穿黑衣的司隙官进来拆散我们！",
          corruptWhisper: "一拜天地——二拜高堂——夫妻对拜——永不分离。",
          glyphType: "talisman"
        },
        {
          pageNo: 4,
          formCode: "XJ-007-D",
          date: "建安三年 六月十一",
          shichen: "卯时",
          recorder: "司隙官·甲二",
          checkState: "normal",
          summaryTitle: "破门救援记录",
          body: "破门时见乙五对着空椅微笑敬茶，残烛已燃去半寸。浇熄后乙五失声痛哭，称仿佛凭空失去了一段十年人生。此后禁止单人久留超过一刻钟。",
          corruptWhisper: "",
          glyphType: "none"
        }
      ]
    },
    {
      id: "XJ-011",
      code: "XJ-011",
      name: "十三坊纸花翁",
      reactionType: "民俗系怪异",
      dangerLevel: 3,
      scale: "街区",
      containmentDifficulty: "中",
      traits: ["lethal"],
      imageUrl: "",
      webglMood: "amber_dust",
      responseGuide: "不可在酉时收下其递出的任何纸花；若不慎接过，须在三息内以真名厉声退还，切忌道谢。",
      description:
        "每逢酉时雾起，狭间丙字廊便会凭空延展出一条不存在的“广陵第十三坊”，一名佝偻老翁推着吱呀作响的木车穿行其间，叫卖永不凋谢的素白纸花。接下纸花者可凭此挡去一次必死之劫，然代价是当场被抽走平生最温暖珍贵的一段记忆。",
      redactedSecret:
        "被抽走的记忆并未消散，而是被老翁叠成了木车上新的素白纸花。花瓣最白的那一朵，贴近耳畔能听见熟悉之人的轻笑声。",
      anomalyEffectHint:
        "面对“用最珍贵的记忆换你平安”的残酷交易，名士会陷入强烈挣扎——或霸道拦下你的手，或背着你悄悄伸手去接，将最深沉的珍视暴露无遗。",
      patrolNodes: ["I", "III", "V", "II"],
      sightings: [
        { date: "建安二年·秋", nodeId: "I", note: "广陵城西一夜七户人家同时遗忘挚爱面容，案头皆余素白纸花一朵。" },
        { date: "建安三年·春", nodeId: "V", note: "荆楚雾泽再现木车辙印，以七道镇街符圈禁于狭间。" }
      ],
      observationLogs: [
        {
          pageNo: 1,
          formCode: "XJ-011-A",
          date: "建安三年 七月初三",
          shichen: "酉时",
          recorder: "司隙官·戊一",
          checkState: "normal",
          summaryTitle: "雾廊巡检",
          body: "酉时整，木车如期出现于雾中。老翁隔栏问我可要买花，我依规默然不语，待戌时雾散，木车自行隐没。",
          corruptWhisper: "",
          glyphType: "none"
        },
        {
          pageNo: 2,
          formCode: "XJ-011-B",
          date: "建安三年 七月十四",
          shichen: "酉时三刻",
          recorder: "司隙官·戊一",
          checkState: "uneasy",
          summaryTitle: "异常：木车停于栏前",
          body: "今日老翁未走，只把一朵微带浅粉的纸花递到栏杆缝里。他说，再过三日我有一场大劫，只要拿幼时母亲哄睡的那段记忆来换，便能活命。",
          corruptWhisper: "我没接。可那朵花的颜色，怎么那么像我阿娘的旧衫？",
          glyphType: "scratch"
        },
        {
          pageNo: 3,
          formCode: "XJ-011-C",
          date: "建安三年 七月十五",
          shichen: "戌时",
          recorder: "司隙官·戊一",
          checkState: "corrupted",
          summaryTitle: "记忆剥离记录",
          body: "我今天好像忘了什么极要紧的事。胸口空了一大块，却说不出丢了什么。案头多了一朵极白的纸花，摸上去暖融融的，像谁的手掌。",
          corruptWhisper: "不要谢他——一说谢谢，你就再也想不起来自己爱过谁了。",
          glyphType: "spiral"
        },
        {
          pageNo: 4,
          formCode: "XJ-011-D",
          date: "建安三年 七月十六",
          shichen: "辰时",
          recorder: "司隙官·甲二",
          checkState: "normal",
          summaryTitle: "善后归档",
          body: "戊一昨夜确实躲过了一次屋梁塌落，代价是彻底遗忘了双亲音容。已将木车通道加装双层青铜隔栅。",
          corruptWhisper: "",
          glyphType: "none"
        }
      ]
    },
    {
      id: "XJ-014",
      code: "XJ-014",
      name: "借面皮影戏箱",
      reactionType: "规则系怪异",
      dangerLevel: 3,
      scale: "街区",
      containmentDifficulty: "高",
      traits: ["aggressive", "non_comm"],
      imageUrl: "",
      webglMood: "amber_dust",
      responseGuide: "步入收容室后，至少须有一人始终正视幕布；严禁所有人同时背对戏箱超过三息，否则影子将被剪走。",
      description:
        "一只朱漆斑驳的旧戏箱，无锣鼓亦无人操控，幕布后却常年透出昏黄油灯光，皮影会丝毫不差地模仿参观者的一举一动。一旦参观者背对幕布超过三息，灯影里会伸出一把生锈铁剪，无声剪断其影子——失影者将在半日内彻底丧失喜怒哀乐，沦为面无表情的木偶。",
      redactedSecret:
        "被剪走的影子会被缝进戏箱里充当新皮影。每逢月晦，幕布上会同时挤满数十个曾经的参观者剪影，齐刷刷贴着幕布向外张望。",
      anomalyEffectHint:
        "需要与名士背靠背互相盯着幕布撤退的窒息紧张感；若名士为护你转身挡在身前而不慎被剪去一角影子，短暂变得冰冷漠然却唯独还记得抓紧你的手。",
      patrolNodes: ["III", "V", "VI", "II"],
      sightings: [
        { date: "建安二年·夏", nodeId: "V", note: "襄阳城南戏园一夜失影三十余人，全场观众呆坐至天明。" },
        { date: "建安二年·秋", nodeId: "VI", note: "于蜀道破庙截获戏箱，全程以八面铜镜反射监视押回狭间。" }
      ],
      observationLogs: [
        {
          pageNo: 1,
          formCode: "XJ-014-A",
          date: "建安三年 八月初五",
          shichen: "未时",
          recorder: "司隙官·己三",
          checkState: "normal",
          summaryTitle: "双人交替监视正常",
          body: "与同僚背靠背巡视，幕布内皮影规矩模仿我等抬手动作，未见铁剪现身。退室时全程倒退而出。",
          corruptWhisper: "",
          glyphType: "none"
        },
        {
          pageNo: 2,
          formCode: "XJ-014-B",
          date: "建安三年 八月十二",
          shichen: "申时",
          recorder: "司隙官·己三",
          checkState: "uneasy",
          summaryTitle: "异常：皮影延迟半拍",
          body: "今日幕布上的皮影比我慢了整整半息才抬手。而且我明明没有笑，幕布上那个“我”却把嘴角咧到了耳根。",
          corruptWhisper: "它手里好像藏了一把剪刀，藏在袖子后面。",
          glyphType: "scratch"
        },
        {
          pageNo: 3,
          formCode: "XJ-014-C",
          date: "建安三年 八月十三",
          shichen: "酉时",
          recorder: "司隙官·己三",
          checkState: "corrupted",
          summaryTitle: "失影事故记录",
          body: "刚才回头捡笔。只过了两息。不对，是三息。咔嚓一声。现在我看着火光，心里什么感觉也没有。不害怕，也不难过。幕布里那个影子在冲我挥手。",
          corruptWhisper: "别回头别回头别回头——脚下的影子少了一半。",
          glyphType: "eye"
        },
        {
          pageNo: 4,
          formCode: "XJ-014-D",
          date: "建安三年 八月十四",
          shichen: "巳时",
          recorder: "司隙官·甲二",
          checkState: "normal",
          summaryTitle: "恢复观察",
          body: "己三于今晨重新生出淡影，情绪逐步回暖，然称仍偶尔觉得自己才是幕布里被提线操控的那一个。",
          corruptWhisper: "",
          glyphType: "none"
        }
      ]
    },
    {
      id: "XJ-018",
      code: "XJ-018",
      name: "替命哭丧戏班",
      reactionType: "灾厄系怪异",
      dangerLevel: 4,
      scale: "郡县",
      containmentDifficulty: "高",
      traits: ["lethal", "non_comm", "unkillable"],
      imageUrl: "",
      webglMood: "crimson_rift",
      responseGuide: "收容室内须保持绝对寂静，严禁咳嗽、低语、鼓掌或叫好；一旦戏班开嗓，须立刻捂住双耳撤离至三重静音门外。",
      description:
        "七具身着惨白戏服的无面伶人，若放任其流落郡县，会在夜半于空地凭空搭起纸扎戏台，唱出方圆百里内某位活人三日后的死状，且曲终必验，无药可救。任何刀兵斩断其躯体后，碎纸皆会在三息内重新拼合。",
      redactedSecret:
        "若有人在曲终时逆着规矩大喊一声“好”，戏班会立刻停唱，齐刷刷转向喊好之人深深一揖——三日后，原本注定赴死之人安然无恙，而喊好者将替其受劫。",
      anomalyEffectHint:
        "在令人窒息的绝对寂静中，名士紧绷着神经护在你身前；一旦戏台唱出与你相关的不祥戏词，TA 极可能不顾生死替你破禁。",
      patrolNodes: ["V", "VI", "III", "VII"],
      sightings: [
        { date: "建安元年·秋", nodeId: "V", note: "南阳郡三夜连唱三出白事戏，全郡闭户不敢出声，仙人联手以无声阵镇压。" },
        { date: "建安二年·冬", nodeId: "VII", note: "建木动荡时戏班现身深渊外缘，增设三重静音铜门。" }
      ],
      observationLogs: [
        {
          pageNo: 1,
          formCode: "XJ-018-A",
          date: "建安三年 九月初一",
          shichen: "子时",
          recorder: "司隙官·庚二",
          checkState: "normal",
          summaryTitle: "静音门检测",
          body: "三重铜门紧闭，隔音符亮如常。透过小窗见七具无面伶人垂手静立，无鼓点声。",
          corruptWhisper: "",
          glyphType: "none"
        },
        {
          pageNo: 2,
          formCode: "XJ-018-B",
          date: "建安三年 九月初九",
          shichen: "丑时",
          recorder: "司隙官·庚二",
          checkState: "uneasy",
          summaryTitle: "告警：无声起鼓",
          body: "铜门外听不见声音，可我的胸腔却跟着某种锣鼓点一下下发震。七个白影同时转过没有五官的脸，正对着观察窗。",
          corruptWhisper: "千万别咽口水。千万别出声。",
          glyphType: "scratch"
        },
        {
          pageNo: 3,
          formCode: "XJ-018-C",
          date: "建安三年 九月初十",
          shichen: "寅时",
          recorder: "司隙官·庚二",
          checkState: "corrupted",
          summaryTitle: "听觉渗透事故",
          body: "我塞住了耳朵，可那戏词直接在我脑子里唱起来了。它唱的是我的生辰八字，唱我三日后溺死在枯井里。我好想拍手叫好，只要叫一声好就安静了——",
          corruptWhisper: "咚锵——咚锵——好戏开场，请君入座。",
          glyphType: "talisman"
        },
        {
          pageNo: 4,
          formCode: "XJ-018-D",
          date: "建安三年 九月十一",
          shichen: "辰时",
          recorder: "司隙官·甲二",
          checkState: "normal",
          summaryTitle: "紧急调离",
          body: "已强制封禁观察窗，此后仅凭门外铜铃感应异常，严禁任何人员直视无面伶人。",
          corruptWhisper: "",
          glyphType: "none"
        }
      ]
    },
    {
      id: "XJ-021",
      code: "XJ-021",
      name: "假面仙君断指",
      reactionType: "蛊惑系怪异",
      dangerLevel: 4,
      scale: "郡县",
      containmentDifficulty: "高",
      traits: ["aggressive", "unkillable"],
      imageUrl: "",
      webglMood: "crimson_rift",
      responseGuide: "严禁独自靠近寒玉匣三步之内；若听见挚爱或挚友在匣内呼救，切记——真正的人绝不会让你揭开封条。",
      description:
        "一截生着幽绿青苔的玉白断指，不知自哪位堕落仙君身上折落。虽仅寸余，却能在整郡范围内编织精准的声纹幻听：它会模仿你最信任之人的声音、口癖乃至叹息，在耳畔温柔低语，诱使你亲手揭开寒玉匣上的朱砂封条。",
      redactedSecret:
        "经考证，断指模仿的声音并非凭空编造，而是精准窃取了你内心最渴望从那个人口中听到、却从未真正听过的话。",
      anomalyEffectHint:
        "断指模仿同行名士的声音对你柔声诱惑，而真正的名士就站在你身旁——真假声音交叠的极致张力与占有欲爆发。",
      patrolNodes: ["VI", "V", "IV", "VII"],
      sightings: [
        { date: "建安二年·春", nodeId: "VI", note: "益州山祠一夜之间数十名香客自毁镇符，皆称听见亡故亲人呼唤。" },
        { date: "建安二年·秋", nodeId: "VII", note: "以寒玉匣封入建木深渊外室，严禁单人值守。" }
      ],
      observationLogs: [
        {
          pageNo: 1,
          formCode: "XJ-021-A",
          date: "建安三年 十月初四",
          shichen: "戌时",
          recorder: "司隙官·辛六",
          checkState: "normal",
          summaryTitle: "寒玉匣封条核验",
          body: "朱砂封条七道完好，匣内断指静止不动。双人值守互核口令无误。",
          corruptWhisper: "",
          glyphType: "none"
        },
        {
          pageNo: 2,
          formCode: "XJ-021-B",
          date: "建安三年 十月十一",
          shichen: "子时",
          recorder: "司隙官·辛六",
          checkState: "uneasy",
          summaryTitle: "异常：拟声低语",
          body: "匣子里传出了甲二的声音，说外面建木塌了让我快把封条撕开。我回头看了一眼，甲二正好好坐在桌边喝茶。",
          corruptWhisper: "可匣子里的“甲二”连他咳嗽前清嗓子的小动作都学得一模一样。",
          glyphType: "scratch"
        },
        {
          pageNo: 3,
          formCode: "XJ-021-C",
          date: "建安三年 十月十二",
          shichen: "丑时",
          recorder: "司隙官·辛六",
          checkState: "corrupted",
          summaryTitle: "蛊惑失守边缘",
          body: "它现在不学甲二了。它学的是我自己。它在问我，外面那个一直盯着我写的，真的是我自己吗？撕开封条吧，撕开就能回家了。",
          corruptWhisper: "揭开吧……就差最后一道纸了……你听，他在叫你呢。",
          glyphType: "spiral"
        },
        {
          pageNo: 4,
          formCode: "XJ-021-D",
          date: "建安三年 十月十三",
          shichen: "辰时",
          recorder: "司隙官·甲二",
          checkState: "normal",
          summaryTitle: "处置记录",
          body: "昨夜及时按住辛六将要触碰封条的手。已将寒玉匣移至十步隔离线内，此后巡检须佩戴隔音蜡丸。",
          corruptWhisper: "",
          glyphType: "none"
        }
      ]
    },
    {
      id: "XJ-025",
      code: "XJ-025",
      name: "倒流的建木年轮",
      reactionType: "时序系怪异",
      dangerLevel: 5,
      scale: "整个东汉",
      containmentDifficulty: "高",
      traits: ["lethal", "non_comm", "unkillable"],
      imageUrl: "",
      webglMood: "void_ash",
      responseGuide: "仅限透过建木观星镜远程观测，严禁任何血肉之躯踏入核心十丈之内；若年轮逆转加速，须立刻以三道天道定锚符镇压。",
      description:
        "截自建木主干最深处的一枚幽青巨轮，悬浮于狭间最底层的虚空裂隙之上，每一道年轮都在无声逆向旋转。一旦其彻底脱困，整个东汉的光阴将被强行倒卷回黄巾未起、乱世未生之前——苍生免于涂炭，然你与所有名士在乱世中结下的羁绊、并肩与相遇，也将被天道一笔勾销，从未发生。",
      redactedSecret:
        "观星镜曾短暂映出年轮逆转后的幻象：洛阳繁华依旧，广陵风平浪静，而擦肩而过的故人们望着你，眼中只有全然陌生的礼貌疏离。",
      anomalyEffectHint:
        "面对“天下太平却永不相识”的残酷幻象，名士在时间逆流的晕眩中死死记住你的名字，爆发出最深沉决绝的宿命剖白。",
      patrolNodes: ["VII", "VI", "V", "III", "I"],
      sightings: [
        { date: "建安元年·冬至", nodeId: "VII", note: "建木深根骤裂，东汉全境更漏同时倒拨一刻，仙人倾力铸阵始得暂封。" },
        { date: "建安三年·霜降", nodeId: "III", note: "洛阳旧宫址短暂显现十年前旧景，随即消散，确认为年轮余波外溢。" }
      ],
      observationLogs: [
        {
          pageNo: 1,
          formCode: "XJ-025-A",
          date: "建安三年 霜降",
          shichen: "子时",
          recorder: "司隙官·甲一",
          checkState: "normal",
          summaryTitle: "深渊核远程观测",
          body: "观星镜内巨轮逆转速率为每刻一寸，尚在定锚符可控阈值之内。全境时序未见错乱。",
          corruptWhisper: "",
          glyphType: "none"
        },
        {
          pageNo: 2,
          formCode: "XJ-025-B",
          date: "建安三年 立冬",
          shichen: "亥时",
          recorder: "司隙官·甲一",
          checkState: "uneasy",
          summaryTitle: "异常：案头墨迹倒退",
          body: "方才写下的字迹竟一点点缩回笔尖，窗外落下的枯叶逆着风重新飞回枝头。定锚符第二道出现细微裂纹。",
          corruptWhisper: "我手背上十年前留下的旧伤，刚才消失了三息。",
          glyphType: "scratch"
        },
        {
          pageNo: 3,
          formCode: "XJ-025-C",
          date: "建安三年 小雪",
          shichen: "子时",
          recorder: "司隙官·甲一",
          checkState: "corrupted",
          summaryTitle: "时序倒流警示（高危）",
          body: "如果一切从未开始，就没有战火，没有离别，也没有狭间。可是……如果从未开始，我们又算什么？我的名字正在从名册上褪色，快把我的名字刻在石头上！",
          corruptWhisper: "回去吧——回到一切尚未破碎的那一天——忘记所有人。",
          glyphType: "talisman"
        },
        {
          pageNo: 4,
          formCode: "XJ-025-D",
          date: "建安三年 小雪·次日",
          shichen: "寅时",
          recorder: "司隙官·甲二",
          checkState: "normal",
          summaryTitle: "定锚符补固完成",
          body: "已联合三名司隙官重刻定锚符，巨轮逆转速恢复平稳。此案列为狭间最高绝密，非持巡视令者不得调阅。",
          corruptWhisper: "",
          glyphType: "none"
        }
      ]
    }
  ];

  global.XiajianCatalogData = {
    version: "1.0.0",
    DANGER_LEVELS: DANGER_LEVELS,
    DANGER_TRAITS: DANGER_TRAITS,
    MAP_NODES: MAP_NODES,
    MAP_EDGES: MAP_EDGES,
    BUILTIN_ANOMALIES: BUILTIN_ANOMALIES
  };
})(typeof window !== "undefined" ? window : globalThis);

