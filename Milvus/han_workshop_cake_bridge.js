/**
 * Milvus/han_workshop_cake_bridge.js
 * 「东汉工坊 · 蛋糕工坊」独立宿主桥接引擎（Step 1）
 *
 * 职责：
 * 1. 通过 window.HanWorkshopApp.registerWorkshop("cake", ...) 自动热插拔入驻，零改动 app.min.js
 * 2. 全屏托管同源 <iframe src="./蛋糕抹面.html"> 并通过 postMessage 兼容 file:// 与 http://
 * 3. 按需采集单角色 6 维完整配置 + 玩家身份配置库 + 开启的世界书 + 近 15 条传讯聊天记录
 * 4. 双轨视觉感知：结构化蛋糕配方/形态快照 + 可选多模态 Canvas 截图直传（纯文本模型自动无缝降级）
 * 5. 支持三大共创玩法 RPC：
 *    - 模式 A（我做 TA 尝）：成品品鉴点评
 *    - 模式 B（你一步 TA 一步接力）：名士单步配方决策 + 画布实时执行 + 边做边说
 *    - 模式 C（TA 做我尝）：名士全流程 6 步定制 + 用户试吃后的名士二次回应
 * 6. 双向回流主世界：一键存入行囊（backpackStore）& 同步发回传讯聊天（chatHistoryStore）
 */
(function (global) {
  "use strict";

  var VALID_ENUMS = {
    sponge: ["vanilla", "cocoa", "matcha", "berry"],
    fillingCream: ["milk_jam", "mango_jam", "berry_jam", "choco_jam"],
    fillingFruit: ["diced_straw", "diced_mango", "diced_oreo", "diced_blue"],
    frostingColor: ["ivory", "blush", "butter", "pistachio", "taro", "cocoa"],
    frostingStyle: ["solid", "ombre", "marble"],
    dripGlaze: ["none", "dark_choco", "berry_glaze", "caramel", "white_choco", "matcha_glaze"],
    saucePattern: ["none", "swirl", "ribbon", "lace"],
    pipingNozzle: ["rosette", "shell", "pearl", "blossom"],
    pipingColor: ["p_white", "p_pink", "p_yellow", "p_green", "p_blue", "p_choco"],
    pipingPattern: ["ring", "crown", "double_crown", "princess", "minimal"],
    decor: [
      "straw_whole", "straw_half", "blueberry", "fig_slice", "mango_wedge",
      "cherry", "mint_leaf", "macaron_pink", "macaron_green", "choco_sail", "meringue"
    ],
    decorLayout: ["wreath", "crescent", "cluster", "symmetric", "playful"],
    sideStyle: ["garland", "blossom_wall", "fruit_wall", "starlight", "clean"],
    sprinkle: ["sprinkle_gold", "sprinkle_pearl", "sprinkle_sugar"],
    sprinkleDensity: ["none", "light", "medium", "rich"]
  };

  var ENUM_HINT_TEXT =
    "【蛋糕工坊完整合法枚举 ID（严禁编造列表外的 ID）】\n" +
    "- 蛋糕胚 spongeId：vanilla(法式香草胚) / cocoa(浓醇可可胚) / matcha(宇治抹茶胚) / berry(红丝绒莓胚)\n" +
    "- 夹心酱 fillingCreamId / fillingCream2Id（第1/2层可混搭不同口味）：milk_jam(香草草莓酱) / mango_jam(百香芒果酱) / berry_jam(森林蓝莓酱) / choco_jam(榛子巧克力)\n" +
    "- 夹心果粒 fillingFruitId / fillingFruit2Id（第1/2层可混搭）：diced_straw(鲜切草莓丁) / diced_mango(台农甜芒粒) / diced_oreo(奥利奥巧碎) / diced_blue(爆汁蓝莓粒)\n" +
    "- 抹面主色 frostingColorId & 可选辅助色 secondaryFrostingColorId（none 或以下6色）：ivory(动物鲜奶油) / blush(树莓粉奶油) / butter(海盐焦糖黄) / pistachio(开心果奶绿) / taro(芋泥紫奶油) / cocoa(生巧甘纳许)\n" +
    "- 抹面技法 frostingStyle：solid(丝滑纯色) / ombre(双色柔和渐变晕染，需配辅助色) / marble(浪漫双色大理石纹，需配辅助色)\n" +
    "- 边缘淋面 dripGlazeId：none(无淋面) / dark_choco(黑巧淋面) / berry_glaze(草莓甘纳许) / caramel(太妃焦糖酱) / white_choco(白巧牛乳淋) / matcha_glaze(浓抹茶淋面)\n" +
    "- 流心酱笔装饰 saucePenId（none 或上述5种酱色）& saucePattern：none(不画) / swirl(顶面精致螺旋拉丝) / ribbon(侧壁丝带波浪纹) / lace(顶面蕾丝花环)\n" +
    "- 裱花花嘴 pipingNozzleId：rosette(八齿曲奇花) / shell(法式贝壳边) / pearl(云朵雪顶球) / blossom(五瓣奶油花)\n" +
    "- 裱花主色 pipingColorId & 可选撞色 secondaryPipingColorId（none 或以下6色）：p_white(香缇白) / p_pink(蜜桃粉) / p_yellow(柠檬黄) / p_green(薄荷绿) / p_blue(海盐蓝) / p_choco(摩卡棕)\n" +
    "- 裱花结构 pipingPattern：princess(顶面花环+底部裙边，高定精致首选) / double_crown(顶面外圈+内圈双层皇冠，可配双色) / ring(顶面经典单圈) / crown(顶面皇冠圈) / minimal(雅致疏朗单圈)\n" +
    "- 顶面装饰 decorList（数组，每项限以下 ID，可重复，建议 5~10 件，最多 12 件，讲究主景+点缀+绿叶层次）：straw_whole(红颜整草莓) / straw_half(鲜切半草莓) / blueberry(薄荷蓝莓簇) / fig_slice(鲜切无花果) / mango_wedge(黄桃甜芒瓣) / cherry(带梗红樱桃) / mint_leaf(鲜嫩薄荷叶) / macaron_pink(树莓马卡龙) / macaron_green(开心果马卡龙) / choco_sail(金箔黑巧帆) / meringue(焦糖蛋白糖)\n" +
    "- 装饰构图 decorLayout：crescent(法式高级半月弯构图) / wreath(满圈花环+中心主景) / cluster(丰盛中心簇拥) / symmetric(对称双圈外疏内密) / playful(灵动错落)\n" +
    "- 蛋糕侧壁装饰 sideStyle（让 2.5D 侧壁不再单调空白，除非刻意极简否则强烈建议选前4种）：garland(法式复古奶油垂弧花环+蝴蝶结花点+裙边) / blossom_wall(侧壁奶油浮雕小花环绕+金箔糖珠+裙边) / fruit_wall(侧壁腰部鲜果切片/马卡龙贴面+裙边+糖珠) / starlight(侧壁银河漫天金箔珍珠+错落小花+裙边) / clean(仅留纯抹面侧壁)\n" +
    "- 氛围撒料 sprinkleTypes（数组，可选 0~2 种）：sprinkle_gold(食用金箔) / sprinkle_pearl(珍珠糖粒) / sprinkle_sugar(彩糖针)；密度 sprinkleDensity：none / light / medium / rich";

  var AFFECTION_CRAFT_GUIDELINE =
    "【心意与精致度创作法则（非常重要）】\n" +
    "1. 请根据你的角色设定、世界书与近期传讯关系，判断你对收礼人的情感温度：\n" +
    "   - 若你是**爱慕、偏爱、深爱、宠溺或格外珍视对方**的角色：就算你平日性格清冷、克制、毒舌或嘴硬，也会因为“是做给喜欢的人吃的”而暗自下足功夫，绝不敷衍！\n" +
    "   - 请把「性格风格」和「用心精致度」区分开：\n" +
    "     * 清冷/克制/傲娇但深爱型：走【高定雅致精致感】——用双色柔和渐变(ombre)或丝滑底色、恰到好处的淋面/挂露或拉丝、工整的顶面+底边裙边裱花(princess/double_crown)、半月弯(crescent)或双圈对称的 6~9 件精挑配料 + 食用金箔/糖珠提亮，嘴上可以淡淡说“顺手做的”，手上却处处讲究。\n" +
    "     * 热烈/温柔/宠溺/华丽型：走【繁花高定丰盛感】——两层夹心混搭不同口味、双色渐变/大理石抹面、满淋面/挂露+拉丝、双色双层或裙边裱花、7~11 件鲜果与酥点满铺/花环(wreath/cluster) + 金箔/糖珠/花雨。\n" +
    "     * 只有当你们关系确实疏离、初识或正在冷战刻意敷衍时，才选择极简素雅的少量配料。\n" +
    "2. 避免单调空旷：尽量善用双色晕染、挂露/淋面、裙边/双层花边、360°侧壁装饰、层次感果点组合以及金箔/撒料，让成品一眼看去就是用心雕琢的手作高定之作。";

  var HAN_VALID_ENUMS = {
    vessel: ["lacquer_ear", "bronze_jian", "celadon_bowl", "jade_lotus"],
    sponge: ["pure_snow", "milk_curd", "green_plum", "hibiscus"],
    fillingCream: ["red_bean", "chestnut", "taro_curd", "sesame_paste"],
    fillingFruit: ["diced_lychee", "diced_plum", "diced_pome", "diced_walnut"],
    frostingColor: ["snow_curd", "grape_wine", "smoked_plum", "cliff_honey", "cane_juice", "perilla"],
    frostingStyle: ["solid", "ombre", "marble"],
    dripGlaze: ["none", "osmanthus_M", "plum_syrup", "brown_sugar", "milk_dew", "bamboo_dew"],
    saucePattern: ["none", "swirl", "ribbon", "lace"],
    pipingNozzle: ["rosette", "shell", "pearl", "blossom"],
    pipingColor: ["p_white", "p_pink", "p_yellow", "p_green", "p_blue", "p_choco"],
    pipingPattern: ["ring", "crown", "double_crown", "princess", "minimal"],
    decor: [
      "straw_whole", "straw_half", "blueberry", "fig_slice", "mango_wedge",
      "cherry", "mint_leaf", "macaron_pink", "macaron_green", "choco_sail", "meringue"
    ],
    decorLayout: ["wreath", "crescent", "cluster", "symmetric", "playful"],
    sideStyle: ["garland", "blossom_wall", "fruit_wall", "starlight", "clean"],
    sprinkle: ["sprinkle_gold", "sprinkle_pearl", "sprinkle_sugar"],
    sprinkleDensity: ["none", "light", "medium", "rich"]
  };

  var HAN_ENUM_HINT_TEXT =
    "【洛阳凌阴 · 东汉冰饮酥山工坊完整合法枚举 ID（严禁编造列表外的 ID）】\n" +
    "- 汉代器皿 vesselId：lacquer_ear(朱漆云纹耳杯) / bronze_jian(错金青铜冰盏) / celadon_bowl(越窑原始青瓷) / jade_lotus(汉白玉莲瓣盏)\n" +
    "- 凌阴冰胚 spongeId：pure_snow(凌阴清雪冰) / milk_curd(塞北牛乳冰) / green_plum(青梅冷露冰) / hibiscus(洛神花露冰)\n" +
    "- 双层夹心酪酱 fillingCreamId / fillingCream2Id（第1/2层可混搭）：red_bean(赤豆蜜沙) / chestnut(栗子金泥) / taro_curd(紫芋凝酪) / sesame_paste(胡麻香膏)\n" +
    "- 双层夹心鲜果 fillingFruitId / fillingFruit2Id（第1/2层可混搭）：diced_lychee(鲜剥荔枝丁) / diced_plum(蜜渍青梅粒) / diced_pome(红石榴晶粒) / diced_walnut(琥珀核桃碎)\n" +
    "- 外层凝酪/蜜浆主色 frostingColorId & 可选辅助色 secondaryFrostingColorId（none 或以下6色）：snow_curd(雪白凝酪) / grape_wine(西域葡萄浆) / smoked_plum(乌梅浓煎) / cliff_honey(百花崖蜜) / cane_juice(甘蔗柘浆) / perilla(紫苏香露)\n" +
    "- 匀冰技法 frostingStyle：solid(冰镜纯色) / ombre(双色柔和渐变晕染，需配辅助色) / marble(浪漫双色冰纹晕染，需配辅助色)\n" +
    "- 边缘挂露 dripGlazeId：none(无挂露) / osmanthus_M(金桂崖蜜) / plum_syrup(红梅浓露) / brown_sugar(古法黑糖浆) / milk_dew(塞北酥酪露) / bamboo_dew(竹叶青露)\n" +
    "- 流心蜜浆笔装饰 saucePenId（none 或上述5种挂露色）& saucePattern：none(不画) / swirl(顶面精致螺旋蜜纹) / ribbon(冰壁丝带波浪纹) / lace(顶面回纹花环)\n" +
    "- 汉宫点酥花嘴 pipingNozzleId：rosette(汉宫卷云花) / shell(羽觞水波边) / pearl(凝露雪顶珠) / blossom(茱萸五瓣花)\n" +
    "- 点酥主色 pipingColorId & 可选撞色 secondaryPipingColorId（none 或以下6色）：p_white(凝脂白) / p_pink(胭脂粉) / p_yellow(鹅黄色) / p_green(松石绿) / p_blue(天水碧) / p_choco(秋香褐)\n" +
    "- 点酥结构 pipingPattern：princess(顶面花环+底部裙边，汉宫高定首选) / double_crown(顶面外圈+内圈双层花环，可配双色) / ring(顶面经典单圈) / crown(顶面皇冠圈) / minimal(雅致疏朗单圈)\n" +
    "- 西域仙果与汉风酥点 decorList（数组，每项限以下 ID，可重复，建议 6~10 件，最多 12 件）：straw_whole(岭南鲜荔枝) / straw_half(雕花蜜青梅) / blueberry(西域石榴簇) / fig_slice(鲜切无花果) / mango_wedge(金丸鲜枇杷) / cherry(带梗蜜樱桃) / mint_leaf(兰草薄荷叶) / macaron_pink(蜜饵环饼脆) / macaron_green(汉瓦茯苓片) / choco_sail(金箔山楂卷) / meringue(琥珀核桃仁)\n" +
    "- 仙果构图 decorLayout：crescent(雅致半月弯构图) / wreath(满圈花环+中心主景) / cluster(丰盛中心簇拥) / symmetric(对称双圈外疏内密) / playful(灵动错落)\n" +
    "- 冰壁侧装饰 sideStyle（让 2.5D 冰壁饱满精致，除非刻意极简否则强烈建议选前4种）：garland(汉宫垂弧花环+茱萸花结+裙边) / blossom_wall(冰壁凝酥浮雕小花+金箔粟珠+裙边) / fruit_wall(冰壁腰部蜜梅环饼贴面+裙边) / starlight(冰壁星河金箔金桂漫天+裙边) / clean(仅留纯冰壁)\n" +
    "- 氛围撒料 sprinkleTypes（数组，可选 0~2 种）：sprinkle_gold(食用金箔) / sprinkle_pearl(酥脆粟米珠) / sprinkle_sugar(金桂花雨)；密度 sprinkleDensity：none / light / medium / rich";

  function getEditionSpec(edition) {
    if (edition === "han") {
      return {
        edition: "han",
        workshopLabel: "东汉工坊 · 洛阳凌阴冰饮坊",
        craftNoun: "东汉消夏冰饮酥山",
        cardNoun: "汉简木牍与玉签",
        enums: HAN_VALID_ENUMS,
        hintText: HAN_ENUM_HINT_TEXT,
        stepNames: ["凿冰夹心", "淋浆匀冰", "汉宫点酥", "西域仙果", "木牍题词", "浮荷进饮"],
        defaults: {
          vessel: "lacquer_ear",
          sponge: "pure_snow",
          fillingCream: "red_bean",
          fillingFruit: "diced_lychee",
          frostingColor: "snow_curd",
          dripGlaze: "osmanthus_M",
          plaqueText: "清凉无汗",
          cardBody: "愿以此盏凌阴瑞雪，涤尽炎夏万里尘劳，岁岁常安。",
          defaultLines: [
            "挑了趁手的汉盏与凌阴碎冰，两层蜜沙果丁皆替你铺匀了。",
            "这层凝酪与挂露得慢慢匀开，免得化得太快失了冰肌。",
            "沿着盏缘与底边细细点上汉宫酥花，瞧着才够体面。",
            "再将西域仙果与蜜饵错落摆好，撒一把金桂金箔提香。",
            "木牍祝文、玉签刻字连同花押小画都替你题好了。",
            "荷花灯已点亮，趁寒气未散，快尝一口消消暑罢。"
          ]
        }
      };
    }
    return {
      edition: "modern",
      workshopLabel: "东汉工坊 · 蛋糕工坊",
      craftNoun: "手作奶油蛋糕",
      cardNoun: "贺卡与巧克力牌",
      enums: VALID_ENUMS,
      hintText: ENUM_HINT_TEXT,
      stepNames: ["胚与夹心", "奶油抹面", "精致裱花", "鲜果装饰", "手写贺卡", "点亮仪式"],
      defaults: {
        vessel: "",
        sponge: "vanilla",
        fillingCream: "milk_jam",
        fillingFruit: "diced_straw",
        frostingColor: "ivory",
        dripGlaze: "caramel",
        plaqueText: "岁岁安暖",
        cardBody: "亲手试着做了一回，甜度按你平日喜好收了三分，尝尝合不合胃口。",
        defaultLines: [
          "先把底胚和两层夹心铺匀，免得切开时塌了。",
          "抹面与淋面最考验手上分寸，别催，马上好。",
          "顺着顶缘和底边都细细挤上花边，瞧着才够体面。",
          "再挑几颗顺眼的果子与甜点错落摆上，点些金箔糖珠提亮。",
          "巧克力牌和贺卡也替你写好了，字迹别嫌弃。",
          "蜡烛点好了，趁奶油未化，过来尝一口罢。"
        ]
      }
    };
  }

  var visionUnsupportedSession = false;

  // ==================== 1. Lightweight Roster & 6D On-Demand Context ====================

  function pickValid(val, list, fallback) {
    return list.indexOf(val) >= 0 ? val : fallback;
  }

  function hasApiConfigured() {
    try {
      var mm = JSON.parse((global.localStorage && global.localStorage.getItem("minimax_api_config")) || "null");
      if (mm && mm.apiKey && mm.groupId) return true;
      var cfgs = JSON.parse((global.localStorage && global.localStorage.getItem("api_configs")) || "[]");
      return Array.isArray(cfgs) && cfgs.some(function (c) { return c && c.url && c.apiKey; });
    } catch (_) {
      return false;
    }
  }

  async function getLightCharacterRoster() {
    var rawList = [];
    try {
      if (global.chatCharacterStore && typeof global.chatCharacterStore.getAll === "function") {
        var stored = await global.chatCharacterStore.getAll();
        if (Array.isArray(stored) && stored.length > 0) rawList = stored;
      }
    } catch (_) {}

    if (rawList.length === 0 && Array.isArray(global.__T8_LIVE_CHATS)) {
      rawList = global.__T8_LIVE_CHATS;
    }
    if (rawList.length === 0) {
      try {
        var localList = JSON.parse((global.localStorage && global.localStorage.getItem("t8_chat_list")) || "[]");
        if (Array.isArray(localList)) rawList = localList;
      } catch (_) {}
    }

    var charSettings = {};
    try {
      charSettings = JSON.parse((global.localStorage && global.localStorage.getItem("character_settings")) || "{}");
    } catch (_) {}

    var seen = {};
    var out = [];
    for (var i = 0; i < rawList.length; i++) {
      var c = rawList[i];
      if (!c || typeof c !== "object") continue;
      if (String(c.id || "").indexOf("group") === 0 || c.type === "group" || c.type === "decor" || c.type === "moments") continue;
      var cid = String(c.id || c.name || "");
      var cname = String(c.name || c.nickname || "").trim();
      if (!cid || !cname || seen[cid]) continue;
      seen[cid] = true;
      var st = charSettings[cid] || charSettings[cname] || {};
      var prof = c.profile || {};
      out.push({
        id: cid,
        name: cname,
        mbti: String(st.mbti || prof.mbti || c.mbti || "").trim(),
        zodiac: String(st.zodiac || prof.zodiac || c.zodiac || "").trim(),
        languageStyle: String(st.languageStyle || prof.languageStyle || c.languageStyle || "").trim(),
        personality: String(st.personality || prof.personality || c.personality || "").trim(),
        background: String(st.background || prof.background || c.background || c.bio || "").trim()
      });
    }
    return out;
  }

  function getActiveUserPersona() {
    try {
      var list = JSON.parse((global.localStorage && global.localStorage.getItem("user_personas")) || "[]");
      var activeId =
        (global.localStorage && global.localStorage.getItem("active_persona_id")) ||
        (global.localStorage && global.localStorage.getItem("active_user_persona_id")) ||
        "";
      var found = activeId ? list.find(function (p) { return p && String(p.id) === String(activeId); }) : null;
      if (!found && list.length > 0) found = list[0];
      if (found) {
        return {
          name: String(found.name || "广陵王").trim(),
          identity: String(found.identity || "").trim(),
          personality: String(found.personality || "").trim(),
          background: String(found.background || found.bio || "").trim()
        };
      }
    } catch (_) {}
    return { name: "广陵王", identity: "", personality: "", background: "" };
  }

  async function getEnabledWorldBookText() {
    try {
      if (typeof global.getWorldBookContext === "function") {
        var ctx = await global.getWorldBookContext();
        if (ctx && String(ctx).trim()) return String(ctx).trim().slice(0, 1500);
      }
    } catch (_) {}
    try {
      if (global.worldBookStore && typeof global.worldBookStore.getData === "function") {
        var wb = await global.worldBookStore.getData();
        var books = Array.isArray(wb && wb.books) ? wb.books : [];
        var active = books.filter(function (b) { return b && b.enable !== false && b.content && String(b.content).trim(); });
        if (active.length > 0) {
          return active.map(function (b) { return "【" + (b.title || "世界书") + "】" + String(b.content).trim().slice(0, 260); }).join("\n").slice(0, 1500);
        }
      }
    } catch (_) {}
    return "";
  }

  async function collectCharacterFullContext(charId) {
    var roster = await getLightCharacterRoster();
    var charObj =
      roster.find(function (c) { return String(c.id) === String(charId); }) ||
      roster[0] ||
      { id: String(charId || "guest"), name: "同行名士", mbti: "", zodiac: "", languageStyle: "", personality: "", background: "" };

    var userPersona = getActiveUserPersona();
    var worldBookText = await getEnabledWorldBookText();

    var recentChatLines = [];
    try {
      if (global.chatHistoryStore && typeof global.chatHistoryStore.getMessages === "function") {
        var res = await global.chatHistoryStore.getMessages(charObj.id, 1, 20);
        var msgs = (res && Array.isArray(res.messages)) ? res.messages : [];
        recentChatLines = msgs
          .filter(function (m) { return m && m.text && String(m.text).indexOf("data:image") !== 0; })
          .slice(-15)
          .map(function (m) {
            return (m.isMe ? userPersona.name : charObj.name) + "：" + String(m.text).replace(/\s+/g, " ").slice(0, 120);
          });
      }
    } catch (_) {}

    var charProfileText =
      "- 角色姓名与ID：" + charObj.name + "（ID: " + charObj.id + "）\n" +
      "- MBTI 性格类型：" + (charObj.mbti || "未设定") + "\n" +
      "- 星座：" + (charObj.zodiac || "未设定") + "\n" +
      "- 语言风格：" + (charObj.languageStyle || "贴合古风人物自然表达") + "\n" +
      "- 性格特点：" + (charObj.personality || "鲜活有分寸") + "\n" +
      "- 个人背景：" + (charObj.background || "汉末名士");

    var userPersonaText =
      "- 称呼/姓名：" + userPersona.name +
      (userPersona.identity ? "\n- 身份：" + userPersona.identity : "") +
      (userPersona.personality ? "\n- 性格：" + userPersona.personality : "") +
      (userPersona.background ? "\n- 背景：" + userPersona.background : "");

    var memoryCapsuleText = "";
    try {
      var cme = global.CompanionMemoryEngine;
      var capsuleItems = [];
      var summaryItems = [];
      if (cme && typeof cme.getCapsules === "function") {
        var rawCaps = await cme.getCapsules(String(charObj.id));
        if (Array.isArray(rawCaps)) capsuleItems = rawCaps;
      }
      if (cme && typeof cme.dbGetAllByChar === "function" && cme.STORE_SUMMARIES) {
        var rawSums = await cme.dbGetAllByChar(cme.STORE_SUMMARIES, String(charObj.id));
        if (Array.isArray(rawSums)) summaryItems = rawSums.filter(function (s) { return s && !s.archived && s.text; });
      }
      // 优先保留被「钉住」的记忆胶囊，再按时间取最近的胶囊（总计上限约 1500 字）
      var pinnedCaps = capsuleItems.filter(function (c) { return c && c.pinned && c.text; });
      var normalCaps = capsuleItems.filter(function (c) { return c && !c.pinned && c.text; });
      var orderedCaps = pinnedCaps.concat(normalCaps.slice(-6));
      var lines = [];
      var usedChars = 0;
      for (var ci = 0; ci < orderedCaps.length; ci++) {
        var cap = orderedCaps[ci];
        var prefix = cap.pinned ? "📌[置顶胶囊] " : "•[记忆胶囊] ";
        var body = String(cap.text || "").replace(/\s+/g, " ").trim().slice(0, 320);
        if (!body) continue;
        if (usedChars + body.length > 1350 && lines.length > 0) break;
        lines.push(prefix + body);
        usedChars += body.length;
      }
      if (summaryItems.length > 0 && usedChars < 1200) {
        summaryItems.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
        var recentSums = summaryItems.slice(0, 3);
        for (var si = 0; si < recentSums.length; si++) {
          var sm = recentSums[si];
          var sBody = String(sm.text || "").replace(/\s+/g, " ").trim().slice(0, 200);
          if (!sBody) continue;
          if (usedChars + sBody.length > 1550) break;
          lines.push("•[" + (sm.day || "日总结") + "] " + sBody);
          usedChars += sBody.length;
        }
      }
      memoryCapsuleText = lines.join("\n");
    } catch (_) {}

    var coupleBondHint = "";
    try {
      var ls = global.localStorage;
      if (ls) {
        var coupleRaw =
          ls.getItem("couple_space_partner") ||
          ls.getItem("couple_partner_id") ||
          ls.getItem("milvus_couple_partner") ||
          ls.getItem("t8_couple_partner") ||
          "";
        if (coupleRaw && (String(coupleRaw).indexOf(String(charObj.id)) >= 0 || String(coupleRaw).indexOf(charObj.name) >= 0)) {
          coupleBondHint = "你们在「情侣空间」中已结为亲密伴侣，彼此感情深厚。";
        }
      }
    } catch (_) {}

    return {
      charObj: charObj,
      userPersona: userPersona,
      charProfileText: charProfileText,
      userPersonaText: userPersonaText,
      worldBookText: worldBookText,
      memoryCapsuleText: memoryCapsuleText,
      recentChatText: recentChatLines.join("\n"),
      coupleBondHint: coupleBondHint
    };
  }

  // ==================== 2. Dual-Track LLM Caller (Vision + Auto Text Fallback) ====================

  function invokeSendToLLM(messages, opts) {
    return new Promise(function (resolve, reject) {
      if (typeof global.sendToLLM !== "function") {
        reject(new Error("宿主未配置 sendToLLM"));
        return;
      }
      var settled = false;
      var timer = setTimeout(function () {
        if (!settled) { settled = true; reject(new Error("AI 响应超时")); }
      }, 45000);
      try {
        global.sendToLLM(
          messages,
          Object.assign({ disableMCP: true, temperature: 0.85, top_p: 0.92 }, opts || {}),
          function (reply) {
            if (!settled) { settled = true; clearTimeout(timer); resolve(String(reply || "")); }
          },
          function (err) {
            if (!settled) { settled = true; clearTimeout(timer); reject(new Error(String(err || "AI 调用失败"))); }
          }
        );
      } catch (e) {
        if (!settled) { settled = true; clearTimeout(timer); reject(e); }
      }
    });
  }

  async function callCakeLLMWithVisionFallback(sysPrompt, userPrompt, imageDataUrl) {
    var canTryVision = Boolean(
      imageDataUrl &&
      typeof imageDataUrl === "string" &&
      imageDataUrl.indexOf("data:image") === 0 &&
      !visionUnsupportedSession
    );

    if (canTryVision) {
      try {
        var visionMessages = [
          { role: "system", content: sysPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: imageDataUrl } }
            ]
          }
        ];
        var vReply = await invokeSendToLLM(visionMessages);
        if (vReply && vReply.trim()) return { text: vReply, usedVision: true };
      } catch (_) {
        // Pure-text model rejected multimodal payload -> remember & seamlessly fallback
        visionUnsupportedSession = true;
      }
    }

    try {
      var textMessages = [
        { role: "system", content: sysPrompt },
        { role: "user", content: userPrompt }
      ];
      var tReply = await invokeSendToLLM(textMessages);
      return { text: tReply || "", usedVision: false };
    } catch (_) {
      return { text: "", usedVision: false };
    }
  }

  function extractJsonSafe(rawText) {
    if (!rawText) return null;
    var cleaned = String(rawText)
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch (_) {}
    var s = cleaned.indexOf("{");
    var e = cleaned.lastIndexOf("}");
    if (s >= 0 && e > s) {
      try {
        return JSON.parse(cleaned.slice(s, e + 1).replace(/,\s*([}\]])/g, "$1"));
      } catch (_) {}
    }
    return null;
  }

  function sanitizeSketchSvg(rawSvg, targetW, targetH) {
    if (!rawSvg || typeof rawSvg !== "string") return "";
    var s = rawSvg.replace(/```(?:svg|xml)?\s*/gi, "").replace(/```\s*/g, "").trim();
    var m = s.match(/<svg[\s\S]*?<\/svg>/i);
    if (!m) return "";
    s = m[0];
    // 安全性过滤：剔除 script / foreignObject / 事件属性
    s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
    s = s.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "");
    s = s.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    s = s.replace(/javascript:/gi, "");
    // 修复未转义的裸 & 防止浏览器 XML 解析报错导致 img.onerror
    s = s.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi, "&amp;");
    // 剔除覆盖整张画布的纯白/不透明底色矩形，确保透明底贴合蛋糕或贺卡
    s = s.replace(/<rect\b[^>]*(?:width\s*=\s*["'](?:100%|2[0-9]{2}|3[0-9]{2}|4[0-9]{2})["'])[^>]*(?:fill\s*=\s*["'](?:#fff|#ffffff|white|#fdf|#faf)[^"']*["'])[^>]*\/?>/gi, "");
    // 强制注入明确的像素 width/height 与 xmlns，避免 Chrome SVG-to-Canvas naturalWidth=0
    s = s.replace(/<svg\b([^>]*)>/i, function (_, attrs) {
      var cleanAttrs = String(attrs || "")
        .replace(/\swidth\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .replace(/\sheight\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
      if (!/xmlns\s*=/i.test(cleanAttrs)) {
        cleanAttrs = ' xmlns="http://www.w3.org/2000/svg"' + cleanAttrs;
      }
      if (!/viewBox\s*=/i.test(cleanAttrs)) {
        cleanAttrs += ' viewBox="0 0 ' + targetW + ' ' + targetH + '"';
      }
      return '<svg width="' + targetW + '" height="' + targetH + '"' + cleanAttrs + '>';
    });
    // 至少包含一个矢量图形元素
    if (!/<(?:path|circle|ellipse|line|polyline|polygon|rect|text)\b/i.test(s)) return "";
    return s;
  }

  function buildFallbackCardSketchSvg(charName) {
    var safeName = String(charName || "名士").replace(/[<>&"']/g, "").slice(0, 4);
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="80" viewBox="0 0 320 80">' +
      '<path d="M18 58 Q68 38 118 44 Q158 48 194 28" fill="none" stroke="#5A3822" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M90 43 Q102 24 122 20" fill="none" stroke="#5A3822" stroke-width="2.2" stroke-linecap="round"/>' +
      '<circle cx="126" cy="18" r="5" fill="#E86A53" opacity="0.88"/>' +
      '<circle cx="134" cy="22" r="4.5" fill="#F29B8E" opacity="0.9"/>' +
      '<circle cx="120" cy="24" r="4.5" fill="#F29B8E" opacity="0.9"/>' +
      '<circle cx="128" cy="28" r="4.2" fill="#E86A53" opacity="0.85"/>' +
      '<circle cx="127" cy="23" r="2.2" fill="#F5D878"/>' +
      '<path d="M174 34 C174 26 184 24 188 31 C192 24 202 26 202 34 C202 43 188 51 188 51 C188 51 174 43 174 34 Z" fill="none" stroke="#C94E38" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<text x="228" y="56" font-family="serif" font-size="22" font-weight="bold" fill="#4A2E1B">' + safeName + '</text>' +
      '<path d="M220 64 Q256 60 296 66" fill="none" stroke="#C94E38" stroke-width="1.8" stroke-linecap="round"/>' +
      '</svg>'
    );
  }

  // ==================== 3. Four Co-Baking AI Orchestration Actions ====================

  async function handleStepRelay(payload) {
    var ctx = await collectCharacterFullContext(payload.charId);
    var spec = getEditionSpec(payload.edition);
    var E = spec.enums;
    var isHan = spec.edition === "han";
    var stepIndex = Math.max(0, Math.min(5, Math.floor(Number(payload.stepIndex) || 0)));
    var stepNames = spec.stepNames;
    var visualText = String(payload.visualSnapshotText || payload.cakeSummary || (isHan ? "刚备好器皿的洛阳凌阴冰案" : "刚起步的蛋糕台面"));
    var relayNotes = Array.isArray(payload.relayHistory) ? payload.relayHistory.slice(-4).join("\n") : "";

    var stepSchemaByIdx = {
      0: isHan
        ? '{"vesselId":"lacquer_ear/bronze_jian/celadon_bowl/jade_lotus","spongeId":"pure_snow/milk_curd/green_plum/hibiscus","fillingCreamId":"合法ID","fillingFruitId":"合法ID","fillingCream2Id":"合法ID(第2层可混搭)","fillingFruit2Id":"合法ID(第2层可混搭)","spokenLine":"1~2句贴合角色口吻边选器皿凿冰边说的话","moodTag":"4字状态"}'
        : '{"spongeId":"vanilla/cocoa/matcha/berry","fillingCreamId":"合法ID","fillingFruitId":"合法ID","fillingCream2Id":"合法ID(第2层可混搭不同酱)","fillingFruit2Id":"合法ID(第2层可混搭不同果粒)","spokenLine":"1~2句贴合角色口吻边做边说的话","moodTag":"4字状态"}',
      1: '{"frostingColorId":"合法ID","secondaryFrostingColorId":"none或合法颜色ID","frostingStyle":"solid或ombre或marble","dripGlazeId":"合法ID","saucePenId":"none或合法酱露色ID","saucePattern":"none或swirl或ribbon或lace","neatness":"tidy或rustic","cakeTopSketchTitle":"可选：若想在顶面手绘简笔画则填2~6字画题，不画留空","cakeTopSketchSvg":"可选：若要画顶面简笔画则输出透明底标准<svg viewBox=\\"0 0 220 220\\">线稿(stroke-width=4，严禁白色底框，不画留空)","spokenLine":"1~2句贴合角色口吻边抹面匀冰边说的话","moodTag":"4字状态"}',
      2: '{"pipingNozzleId":"rosette/shell/pearl/blossom","pipingColorId":"合法ID","secondaryPipingColorId":"none或合法花色ID","pipingPattern":"princess或double_crown或ring或crown或minimal","spokenLine":"1~2句贴合角色口吻边裱花点酥边说的话","moodTag":"4字状态"}',
      3: '{"decorList":["straw_whole","straw_half","macaron_pink","choco_sail","blueberry","mint_leaf"],"decorLayout":"crescent或wreath或cluster或symmetric或playful","sideStyle":"garland或blossom_wall或fruit_wall或starlight或clean","sprinkleTypes":["sprinkle_gold","sprinkle_pearl"],"sprinkleDensity":"light或medium或rich","spokenLine":"1~2句贴合角色口吻边摆鲜果点缀边说的话","moodTag":"4字状态"}',
      4: '{"cardTheme":0到3整数,"cardTo":"称呼(<=14字)","cardBody":"祝福正文(20~55字，贴合人设与近期聊天)","plaqueText":"' + (isHan ? "玉签" : "巧克力牌") + '刻字(<=8字)","cardSketchTitle":"必填：你在签名区手绘的小简笔画/花押名字(2~6字)","cardSketchSvg":"必填：透明底标准<svg viewBox=\\"0 0 320 80\\">矢量简笔画+落款涂鸦(用#4A2E1B/#C94E38暖墨色线条，简洁灵动，严禁白色底框)","spokenLine":"1~2句贴合角色口吻题词并画落款涂鸦时说的话","moodTag":"4字状态"}',
      5: '{"spokenLine":"1~2句点亮' + (isHan ? "浮水荷花灯呈递冰饮" : "蜡烛收尾") + '时的话","moodTag":"4字状态"}'
    };

    var sysPrompt =
      "你正在扮演传讯名士「" + ctx.charObj.name + "」，正在「" + spec.workshopLabel + "」里与「" + ctx.userPersona.name + "」玩**你一步、我一步轮流接力制作" + spec.craftNoun + "**。\n" +
      "现在轮到你亲自上手操作【第 " + (stepIndex + 1) + " 步：" + stepNames[stepIndex] + "】！\n\n" +
      "【你的 6 项完整角色配置（最高遵从：审美选择与说话口吻必须 100% 符合人设）】\n" + ctx.charProfileText + "\n\n" +
      "【" + ctx.userPersona.name + " 的身份设定】\n" + ctx.userPersonaText + "\n\n" +
      (ctx.coupleBondHint ? "【亲密关系提示】\n" + ctx.coupleBondHint + "\n\n" : "") +
      (ctx.worldBookText ? "【已开启的世界书设定】\n" + ctx.worldBookText + "\n\n" : "") +
      (ctx.memoryCapsuleText ? "【传讯 · 记忆胶囊中的共同回忆（自然参考你们的约定、喜好与过往细节）】\n" + ctx.memoryCapsuleText + "\n\n" : "") +
      (ctx.recentChatText ? "【你们在传讯中近期的聊天上下文（自然呼应彼此近况或梗）】\n" + ctx.recentChatText + "\n\n" : "") +
      AFFECTION_CRAFT_GUIDELINE + "\n\n" +
      spec.hintText + "\n\n" +
      "请结合前面已做好的现状与你的真实性格及对对方的心意（可以认真讲究、可以嘴硬嫌弃但手上用心、可以偷偷夹带私心或调侃对方上一步的手艺），并在 `spokenLine` 里自然说出你**为什么选这些配料/配色/装饰或刻字**，严格输出合法 JSON（禁止多余说明）：\n" +
      stepSchemaByIdx[stepIndex];

    var userPrompt =
      "【当前制作进度与视觉形态】\n" + visualText +
      (relayNotes ? "\n\n【前几步互动记录】\n" + relayNotes : "") +
      "\n\n现在轮到你完成【" + stepNames[stepIndex] + "】，请给出精致走心的操作决策与你此刻的台词。";

    var llmRes = await callCakeLLMWithVisionFallback(sysPrompt, userPrompt, payload.imageDataUrl);
    var parsed = extractJsonSafe(llmRes.text) || {};

    var stepAction = {};
    if (stepIndex === 0) {
      var fc1 = pickValid(parsed.fillingCreamId, E.fillingCream, spec.defaults.fillingCream);
      var ff1 = pickValid(parsed.fillingFruitId, E.fillingFruit, spec.defaults.fillingFruit);
      stepAction = {
        vesselId: isHan ? pickValid(parsed.vesselId, E.vessel, spec.defaults.vessel) : "",
        spongeId: pickValid(parsed.spongeId, E.sponge, spec.defaults.sponge),
        fillingCreamId: fc1,
        fillingFruitId: ff1,
        fillingCream2Id: pickValid(parsed.fillingCream2Id, E.fillingCream, fc1),
        fillingFruit2Id: pickValid(parsed.fillingFruit2Id, E.fillingFruit, ff1)
      };
    } else if (stepIndex === 1) {
      var secFrost = parsed.secondaryFrostingColorId === "none" ? "none" : pickValid(parsed.secondaryFrostingColorId, E.frostingColor, "none");
      var fStyle = pickValid(parsed.frostingStyle, E.frostingStyle, secFrost !== "none" ? "ombre" : "solid");
      var sPen = parsed.saucePenId === "none" ? "none" : pickValid(parsed.saucePenId, E.dripGlaze, "none");
      stepAction = {
        frostingColorId: pickValid(parsed.frostingColorId, E.frostingColor, spec.defaults.frostingColor),
        secondaryFrostingColorId: secFrost,
        frostingStyle: fStyle,
        dripGlazeId: pickValid(parsed.dripGlazeId, E.dripGlaze, spec.defaults.dripGlaze),
        saucePenId: sPen,
        saucePattern: sPen === "none" ? "none" : pickValid(parsed.saucePattern, E.saucePattern, "swirl"),
        neatness: parsed.neatness === "rustic" ? "rustic" : "tidy",
        cakeTopSketchTitle: String(parsed.cakeTopSketchTitle || "").trim().slice(0, 12),
        cakeTopSketchSvg: sanitizeSketchSvg(parsed.cakeTopSketchSvg, 220, 220)
      };
    } else if (stepIndex === 2) {
      var secPipe = parsed.secondaryPipingColorId === "none" ? "none" : pickValid(parsed.secondaryPipingColorId, E.pipingColor, "none");
      stepAction = {
        pipingNozzleId: pickValid(parsed.pipingNozzleId, E.pipingNozzle, "rosette"),
        pipingColorId: pickValid(parsed.pipingColorId, E.pipingColor, "p_white"),
        secondaryPipingColorId: secPipe,
        pipingPattern: pickValid(parsed.pipingPattern, E.pipingPattern, "princess")
      };
    } else if (stepIndex === 3) {
      var rawDecors = Array.isArray(parsed.decorList)
        ? parsed.decorList.filter(function (d) { return E.decor.indexOf(d) >= 0; }).slice(0, 12)
        : [];
      if (rawDecors.length === 0) rawDecors = ["straw_whole", "straw_half", "blueberry", "macaron_pink", "choco_sail", "mint_leaf"];
      var rawSprinkles = Array.isArray(parsed.sprinkleTypes)
        ? parsed.sprinkleTypes.filter(function (s) { return E.sprinkle.indexOf(s) >= 0; }).slice(0, 2)
        : ["sprinkle_gold", "sprinkle_pearl"];
      stepAction = {
        decorList: rawDecors,
        decorLayout: pickValid(parsed.decorLayout, E.decorLayout, "crescent"),
        sideStyle: pickValid(parsed.sideStyle, E.sideStyle, "garland"),
        sprinkleTypes: rawSprinkles,
        sprinkleDensity: pickValid(parsed.sprinkleDensity, E.sprinkleDensity, rawSprinkles.length > 0 ? "medium" : "none")
      };
    } else if (stepIndex === 4) {
      var cleanCardSvg = sanitizeSketchSvg(parsed.cardSketchSvg, 320, 80) || buildFallbackCardSketchSvg(ctx.charObj.name);
      stepAction = {
        cardTheme: Math.max(0, Math.min(3, Math.floor(Number(parsed.cardTheme) || 0))),
        cardTo: String(parsed.cardTo || ("致：" + ctx.userPersona.name)).slice(0, 18),
        cardBody: String(parsed.cardBody || spec.defaults.cardBody).slice(0, 60),
        plaqueText: String(parsed.plaqueText || spec.defaults.plaqueText).slice(0, 10),
        cardSketchTitle: String(parsed.cardSketchTitle || "亲笔花押").trim().slice(0, 12),
        cardSketchSvg: cleanCardSvg
      };
    }

    return {
      charName: ctx.charObj.name,
      stepIndex: stepIndex,
      stepAction: stepAction,
      spokenLine: String(parsed.spokenLine || ("「这一步交给我来罢，看好了。」")).trim(),
      moodTag: String(parsed.moodTag || "专注手作").slice(0, 8),
      usedVision: llmRes.usedVision
    };
  }

  async function handleCharFullMake(payload) {
    var ctx = await collectCharacterFullContext(payload.charId);
    var spec = getEditionSpec(payload.edition);
    var E = spec.enums;
    var isHan = spec.edition === "han";
    var sysPrompt =
      "你正在扮演传讯名士「" + ctx.charObj.name + "」，正在「" + spec.workshopLabel + "」里**亲自从头到尾为「" + ctx.userPersona.name + "」定制制作一份专属" + spec.craftNoun + "**。\n\n" +
      "【你的 6 项完整角色配置（最高遵从：口味偏好、配色审美、刻字与说话口吻必须 100% 符合人设）】\n" + ctx.charProfileText + "\n\n" +
      "【收礼人（" + ctx.userPersona.name + "）身份设定】\n" + ctx.userPersonaText + "\n\n" +
      (ctx.coupleBondHint ? "【亲密关系提示】\n" + ctx.coupleBondHint + "\n\n" : "") +
      (ctx.worldBookText ? "【已开启的世界书设定】\n" + ctx.worldBookText + "\n\n" : "") +
      (ctx.memoryCapsuleText ? "【传讯 · 记忆胶囊中的共同回忆（自然融入你们的过往回忆、彼此口味与私密约定）】\n" + ctx.memoryCapsuleText + "\n\n" : "") +
      (ctx.recentChatText ? "【你们在传讯中近期的聊天上下文（自然融入你们的近况、梗或心意）】\n" + ctx.recentChatText + "\n\n" : "") +
      AFFECTION_CRAFT_GUIDELINE + "\n\n" +
      spec.hintText + "\n\n" +
      "请一次性构思完整 6 步高定方案，并在 `stepLines` 的 6 句里**用你的专属口吻自然交代每一步为什么挑这些器皿/冰胚或蛋糕胚、夹心、配色渐变/挂露、花边、鲜果侧壁与题词花押**，严格输出合法 JSON（禁止多余说明）：\n" +
      '{\n' +
      (isHan ? '  "vesselId": "合法器皿ID",\n' : '') +
      '  "spongeId": "合法ID", "fillingCreamId": "合法ID", "fillingFruitId": "合法ID", "fillingCream2Id": "合法ID", "fillingFruit2Id": "合法ID",\n' +
      '  "frostingColorId": "合法ID", "secondaryFrostingColorId": "none或合法颜色ID", "frostingStyle": "solid或ombre或marble",\n' +
      '  "dripGlazeId": "合法ID", "saucePenId": "none或合法酱露色ID", "saucePattern": "none或swirl或ribbon或lace", "neatness": "tidy或rustic",\n' +
      '  "pipingNozzleId": "合法ID", "pipingColorId": "合法ID", "secondaryPipingColorId": "none或合法花色ID", "pipingPattern": "princess或double_crown或ring或crown或minimal",\n' +
      '  "decorList": ["合法ID", "...建议6~10件，最多12件"], "decorLayout": "crescent或wreath或cluster或symmetric或playful", "sideStyle": "garland或blossom_wall或fruit_wall或starlight或clean",\n' +
      '  "sprinkleTypes": ["sprinkle_gold", "sprinkle_pearl"], "sprinkleDensity": "light或medium或rich",\n' +
      '  "cakeTopSketchTitle": "可选：若你想在顶面手绘简笔画（如小猫/梅枝/羽扇/荷花/爱心小人）填2~6字画题；不想画则留空",\n' +
      '  "cakeTopSketchSvg": "可选：若画顶面简笔画，输出透明底标准<svg viewBox=\\"0 0 220 220\\">矢量线稿（stroke-width=4~5，严禁白色底框）；不画则留空",\n' +
      '  "cardTheme": 0到3整数, "cardTo": "称呼(<=14字)", "cardBody": "20~55字亲笔祝福", "plaqueText": "' + (isHan ? "玉签" : "巧克力牌") + '刻字(<=8字)",\n' +
      '  "cardSketchTitle": "必填：你在签名区随手画的小简笔画/花押名称(2~6字)",\n' +
      '  "cardSketchSvg": "必填：透明底标准<svg viewBox=\\"0 0 320 80\\">矢量简笔画涂鸦（贴合人设或小梗，用#4A2E1B/#C94E38暖墨色，严禁白色底框）",\n' +
      '  "stepLines": ["第1步选料心意(25~50字)", "第2步抹面匀冰与挂露心意(25~55字)", "第3步裱花点酥心意(20~45字)", "第4步鲜果构图、侧壁装饰与撒料心意(25~55字)", "第5步题词刻字与签名涂鸦心意(25~55字)", "第6步收尾端出成品的话(20~45字)"],\n' +
      '  "introNote": "端给对方试吃时的一句简短开场白"\n' +
      '}';

    var llmRes = await callCakeLLMWithVisionFallback(
      sysPrompt,
      "请为 " + ctx.userPersona.name + " 定制并制作一份既符合你个人审美、又饱含心意与精致工艺的 6 步" + spec.craftNoun + "。",
      ""
    );
    var p = extractJsonSafe(llmRes.text) || {};

    var decors = Array.isArray(p.decorList)
      ? p.decorList.filter(function (d) { return E.decor.indexOf(d) >= 0; }).slice(0, 12)
      : [];
    if (decors.length === 0) decors = ["straw_whole", "straw_half", "blueberry", "macaron_pink", "choco_sail", "meringue", "mint_leaf"];

    var sprinkles = Array.isArray(p.sprinkleTypes)
      ? p.sprinkleTypes.filter(function (s) { return E.sprinkle.indexOf(s) >= 0; }).slice(0, 2)
      : ["sprinkle_gold", "sprinkle_pearl"];

    var defaultLines = spec.defaults.defaultLines;
    var lines = Array.isArray(p.stepLines) && p.stepLines.length >= 6
      ? p.stepLines.slice(0, 6).map(function (s, i) { return String(s || defaultLines[i]).trim(); })
      : defaultLines;

    var fc1 = pickValid(p.fillingCreamId, E.fillingCream, spec.defaults.fillingCream);
    var ff1 = pickValid(p.fillingFruitId, E.fillingFruit, spec.defaults.fillingFruit);
    var secFrost = p.secondaryFrostingColorId === "none" ? "none" : pickValid(p.secondaryFrostingColorId, E.frostingColor, "none");
    var sPen = p.saucePenId === "none" ? "none" : pickValid(p.saucePenId, E.dripGlaze, "none");
    var secPipe = p.secondaryPipingColorId === "none" ? "none" : pickValid(p.secondaryPipingColorId, E.pipingColor, "none");

    return {
      charName: ctx.charObj.name,
      plan: {
        vesselId: isHan ? pickValid(p.vesselId, E.vessel, spec.defaults.vessel) : "",
        spongeId: pickValid(p.spongeId, E.sponge, spec.defaults.sponge),
        fillingCreamId: fc1,
        fillingFruitId: ff1,
        fillingCream2Id: pickValid(p.fillingCream2Id, E.fillingCream, fc1),
        fillingFruit2Id: pickValid(p.fillingFruit2Id, E.fillingFruit, ff1),
        frostingColorId: pickValid(p.frostingColorId, E.frostingColor, spec.defaults.frostingColor),
        secondaryFrostingColorId: secFrost,
        frostingStyle: pickValid(p.frostingStyle, E.frostingStyle, secFrost !== "none" ? "ombre" : "solid"),
        dripGlazeId: pickValid(p.dripGlazeId, E.dripGlaze, spec.defaults.dripGlaze),
        saucePenId: sPen,
        saucePattern: sPen === "none" ? "none" : pickValid(p.saucePattern, E.saucePattern, "swirl"),
        neatness: p.neatness === "rustic" ? "rustic" : "tidy",
        pipingNozzleId: pickValid(p.pipingNozzleId, E.pipingNozzle, "rosette"),
        pipingColorId: pickValid(p.pipingColorId, E.pipingColor, "p_white"),
        secondaryPipingColorId: secPipe,
        pipingPattern: pickValid(p.pipingPattern, E.pipingPattern, "princess"),
        decorList: decors,
        decorLayout: pickValid(p.decorLayout, E.decorLayout, "crescent"),
        sideStyle: pickValid(p.sideStyle, E.sideStyle, "garland"),
        sprinkleTypes: sprinkles,
        sprinkleDensity: pickValid(p.sprinkleDensity, E.sprinkleDensity, sprinkles.length > 0 ? "medium" : "none"),
        cakeTopSketchTitle: String(p.cakeTopSketchTitle || "").trim().slice(0, 12),
        cakeTopSketchSvg: sanitizeSketchSvg(p.cakeTopSketchSvg, 220, 220),
        cardTheme: Math.max(0, Math.min(3, Math.floor(Number(p.cardTheme) || 0))),
        cardTo: String(p.cardTo || ("致：" + ctx.userPersona.name)).slice(0, 18),
        cardBody: String(p.cardBody || spec.defaults.cardBody).slice(0, 60),
        plaqueText: String(p.plaqueText || spec.defaults.plaqueText).slice(0, 10),
        cardSketchTitle: String(p.cardSketchTitle || "亲笔花押").trim().slice(0, 12),
        cardSketchSvg: sanitizeSketchSvg(p.cardSketchSvg, 320, 80) || buildFallbackCardSketchSvg(ctx.charObj.name)
      },
      stepLines: lines,
      introNote: String(p.introNote || lines[5]).trim()
    };
  }

  async function handleCharTaste(payload) {
    var ctx = await collectCharacterFullContext(payload.charId);
    var spec = getEditionSpec(payload.edition);
    var visualText = String(payload.visualSnapshotText || payload.cakeSummary || ("一份" + spec.craftNoun));
    var modeNote = payload.mode === "relay_coop"
      ? "这是你与「" + ctx.userPersona.name + "」你一步我一步共同接力完成的" + spec.craftNoun + "。"
      : "这是「" + ctx.userPersona.name + "」亲手为你制作并端到你面前的" + spec.craftNoun + "。";

    var sysPrompt =
      "你正在扮演传讯名士「" + ctx.charObj.name + "」，此刻正看着并品尝眼前这份" + spec.craftNoun + "。\n" +
      modeNote + "\n\n" +
      "【你的 6 项完整角色配置（最高遵从：必须用你本人的说话风格、性情与细节癖好来评价）】\n" + ctx.charProfileText + "\n\n" +
      "【" + ctx.userPersona.name + " 的身份设定】\n" + ctx.userPersonaText + "\n\n" +
      (ctx.worldBookText ? "【已开启的世界书设定】\n" + ctx.worldBookText + "\n\n" : "") +
      (ctx.memoryCapsuleText ? "【传讯 · 记忆胶囊中的共同回忆】\n" + ctx.memoryCapsuleText + "\n\n" : "") +
      (ctx.recentChatText ? "【你们在传讯中近期的聊天上下文（自然呼应彼此关系与近期聊天细节）】\n" + ctx.recentChatText + "\n\n" : "") +
      "【要求】\n" +
      "1. 必须真实点评到具体的配料、夹心、抹面/凝酪配色与装饰长相，以及" + spec.cardNoun + "上的刻字或话！\n" +
      "2. 严禁千篇一律的“真好吃谢谢你”套话，要展现鲜明的人设感（比如挑剔却吃光、被甜/冰到皱眉、夸某颗果子摆得歪却顺眼、对刻字嘴硬耳红等）。\n" +
      "3. 严格输出合法 JSON：\n" +
      '{"reactionTag":"4~8字神态短签","comment":"70~130字画面感动作与品尝描写","dialogue":"1~2句贴合角色口吻的直白台词"}';

    var userPrompt = "【你眼前看到的作品完整配方与外观】\n" + visualText + "\n\n请以「" + ctx.charObj.name + "」的身份品尝并给出真实回函。";
    var llmRes = await callCakeLLMWithVisionFallback(sysPrompt, userPrompt, payload.imageDataUrl);
    var p = extractJsonSafe(llmRes.text) || {};

    return {
      charName: ctx.charObj.name,
      reactionTag: String(p.reactionTag || "细品慢尝").slice(0, 12),
      comment: String(p.comment || (ctx.charObj.name + "打量了片刻眼前的" + spec.craftNoun + "与刻字，挑起一勺放入口中，神色微动，眉眼间染上几分难得的笑意。")).trim(),
      dialogue: String(p.dialogue || "「手艺倒比我想的稳当些……这甜度刚好，剩下半份留给我罢。」").trim(),
      usedVision: llmRes.usedVision
    };
  }

  async function handleUserFeedbackReply(payload) {
    var ctx = await collectCharacterFullContext(payload.charId);
    var spec = getEditionSpec(payload.edition);
    var userFeedback = String(payload.userFeedback || "").trim().slice(0, 160);
    var visualText = String(payload.visualSnapshotText || payload.cakeSummary || "");

    var sysPrompt =
      "你正在扮演传讯名士「" + ctx.charObj.name + "」。刚才你亲手为「" + ctx.userPersona.name + "」做了一份" + spec.craftNoun + "，对方品尝完后对你给出了一句真实反馈。\n\n" +
      "【你的 6 项完整角色配置】\n" + ctx.charProfileText + "\n\n" +
      "【" + ctx.userPersona.name + " 的身份设定】\n" + ctx.userPersonaText + "\n\n" +
      (ctx.worldBookText ? "【已开启的世界书设定】\n" + ctx.worldBookText + "\n\n" : "") +
      (ctx.memoryCapsuleText ? "【传讯 · 记忆胶囊中的共同回忆】\n" + ctx.memoryCapsuleText + "\n\n" : "") +
      (ctx.recentChatText ? "【近期传讯上下文】\n" + ctx.recentChatText + "\n\n" : "") +
      "请严格输出合法 JSON：\n" +
      '{"reactionTag":"4~8字神态短签","comment":"45~90字听到评价后的微表情与举动","dialogue":"1~2句贴合人设的回应台词"}';

    var userPrompt =
      "【你做的" + spec.craftNoun + "】\n" + visualText +
      "\n\n【" + ctx.userPersona.name + " 尝完后对你说】：「" + (userFeedback || "挺合胃口的！") + "」";

    var llmRes = await callCakeLLMWithVisionFallback(sysPrompt, userPrompt, "");
    var p = extractJsonSafe(llmRes.text) || {};

    return {
      charName: ctx.charObj.name,
      reactionTag: String(p.reactionTag || "闻言微哂").slice(0, 12),
      comment: String(p.comment || (ctx.charObj.name + "听罢唇角微扬，神色间藏不住几分受用。")).trim(),
      dialogue: String(p.dialogue || "「合你胃口便好，下回想吃什么口味提前递个话来。」").trim()
    };
  }

  // ==================== 4. Independent Cake History IndexedDB & Two-Way Phone Integration ====================

  var CAKE_DB_NAME = "milvus_han_workshop_cake_idb";
  var CAKE_DB_VER = 1;
  var CAKE_STORE = "cakes";
  var cakeDbPromise = null;

  function openCakeHistoryDB() {
    if (cakeDbPromise) return cakeDbPromise;
    cakeDbPromise = new Promise(function (resolve, reject) {
      if (typeof indexedDB === "undefined") {
        reject(new Error("不支持 IndexedDB"));
        return;
      }
      var req = indexedDB.open(CAKE_DB_NAME, CAKE_DB_VER);
      req.onupgradeneeded = function (ev) {
        var db = ev.target.result;
        if (!db.objectStoreNames.contains(CAKE_STORE)) {
          db.createObjectStore(CAKE_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = function (ev) { resolve(ev.target.result); };
      req.onerror = function (ev) { cakeDbPromise = null; reject(ev.target.error); };
    });
    return cakeDbPromise;
  }

  async function saveCakeHistoryRecord(payload) {
    try {
      var db = await openCakeHistoryDB();
      var thumb = await compressDataUrl(payload.posterDataUrl || "", 680, 0.84);
      var rec = {
        id: String(payload.id || ("cake_hist_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6))),
        edition: payload.edition === "han" ? "han" : "modern",
        cakeName: String(payload.cakeName || (payload.edition === "han" ? "洛阳消夏冰饮" : "暖光手作蛋糕")).slice(0, 28),
        cakeDesc: String(payload.cakeDesc || "").slice(0, 160),
        plaqueText: String(payload.plaqueText || "").slice(0, 20),
        mode: String(payload.mode || "user_make_char_eat"),
        charId: String(payload.charId || ""),
        charName: String(payload.charName || ""),
        posterDataUrl: thumb,
        makingNotes: Array.isArray(payload.makingNotes) ? payload.makingNotes.slice(0, 8) : [],
        review: payload.review || null,
        createdAt: Number(payload.createdAt) || Date.now()
      };
      await new Promise(function (resolve, reject) {
        var tx = db.transaction(CAKE_STORE, "readwrite");
        tx.objectStore(CAKE_STORE).put(rec);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function (ev) { reject(ev.target.error); };
      });
      return { ok: true, record: rec };
    } catch (e) {
      return { ok: false, message: String(e && e.message || e) };
    }
  }

  async function listCakeHistoryRecords(editionFilter) {
    try {
      var db = await openCakeHistoryDB();
      var list = await new Promise(function (resolve) {
        var tx = db.transaction(CAKE_STORE, "readonly");
        var req = tx.objectStore(CAKE_STORE).getAll();
        req.onsuccess = function () { resolve(Array.isArray(req.result) ? req.result : []); };
        req.onerror = function () { resolve([]); };
      });
      if (editionFilter === "han") {
        list = list.filter(function (r) { return r && r.edition === "han"; });
      } else if (editionFilter === "modern") {
        list = list.filter(function (r) { return r && r.edition !== "han"; });
      }
      list.sort(function (a, b) { return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0); });
      return list;
    } catch (_) {
      return [];
    }
  }

  async function deleteCakeHistoryRecord(id) {
    try {
      var db = await openCakeHistoryDB();
      await new Promise(function (resolve, reject) {
        var tx = db.transaction(CAKE_STORE, "readwrite");
        tx.objectStore(CAKE_STORE).delete(String(id));
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function (ev) { reject(ev.target.error); };
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: String(e && e.message || e) };
    }
  }

  function compressDataUrl(dataUrl, maxSide, quality) {
    return new Promise(function (resolve) {
      if (!dataUrl || typeof Image === "undefined" || typeof document === "undefined") {
        resolve(dataUrl || "");
        return;
      }
      var img = new Image();
      img.onerror = function () { resolve(dataUrl); };
      img.onload = function () {
        try {
          var limit = maxSide || 720;
          var w = img.naturalWidth || img.width || 600;
          var h = img.naturalHeight || img.height || 600;
          if (w > limit || h > limit) {
            var r = Math.min(limit / w, limit / h);
            w = Math.max(1, Math.round(w * r));
            h = Math.max(1, Math.round(h * r));
          }
          var c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          c.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL("image/jpeg", quality || 0.84) || dataUrl);
        } catch (_) {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    });
  }

  async function saveCakeToBackpack(payload) {
    var bp = global.backpackStore;
    if (!bp || (typeof bp.addItems !== "function" && typeof bp.add !== "function" && typeof bp.save !== "function" && typeof bp.put !== "function")) {
      return { ok: false, message: "未检测到「我的背包」存储模块" };
    }
    var thumb = await compressDataUrl(payload.posterDataUrl || "", 540, 0.82);
    var isHan = payload && payload.edition === "han";
    var item = {
      id: (isHan ? "han_ice_" : "cake_") + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      name: String(payload.cakeName || (isHan ? "洛阳消夏冰饮" : "暖光手作蛋糕")).slice(0, 24),
      price: 0,
      merchant: isHan ? "东汉工坊 · 洛阳凌阴冰饮坊" : "东汉工坊 · 蛋糕工坊",
      type: isHan ? "东汉冰饮" : "甜品手作",
      category: "food",
      description: String(payload.cakeDesc || (isHan ? "洛阳凌阴亲手点酥缀果的东汉消夏冰饮" : "东汉工坊亲手抹面裱花的专属蛋糕")).slice(0, 120),
      image: thumb,
      acquiredAt: Date.now()
    };
    try {
      if (typeof bp.addItems === "function") await bp.addItems([item]);
      else if (typeof bp.add === "function") await bp.add(item);
      else if (typeof bp.save === "function") await bp.save(item);
      else await bp.put(item);
      return { ok: true, message: "已存入「设置 → 隐私 → 我的背包」：" + item.name };
    } catch (e) {
      return { ok: false, message: "存入背包失败：" + (e && e.message ? e.message : e) };
    }
  }

  async function sendCakeToChat(payload) {
    var rawCharId = payload && payload.charId;
    if (rawCharId === undefined || rawCharId === null || String(rawCharId).trim() === "") {
      return { ok: false, message: "请先选择一位要转发的传讯好友" };
    }
    var chStore = global.chatHistoryStore;
    if (!chStore || (typeof chStore.saveMessage !== "function" && typeof chStore.saveMessages !== "function")) {
      return { ok: false, message: "未检测到传讯消息存储模块" };
    }

    // 1:1 对齐 forum_share_app.js：先从 chatCharacterStore 解析出原始 targetChar，严格保留其 id 原始类型（Number / String）！
    var targetChar = null;
    try {
      if (global.chatCharacterStore && typeof global.chatCharacterStore.getAll === "function") {
        var allChars = await global.chatCharacterStore.getAll();
        if (Array.isArray(allChars)) {
          targetChar = allChars.find(function (c) {
            return c && (String(c.id) === String(rawCharId) || (payload.charName && String(c.name) === String(payload.charName)));
          }) || null;
        }
      }
    } catch (_) {}
    if (!targetChar) {
      try {
        var lsChars = JSON.parse((global.localStorage && global.localStorage.getItem("t8_chat_list")) || "[]");
        if (Array.isArray(lsChars)) {
          targetChar = lsChars.find(function (c) {
            return c && (String(c.id) === String(rawCharId) || (payload.charName && String(c.name) === String(payload.charName)));
          }) || null;
        }
      } catch (_) {}
    }

    var targetId = targetChar && targetChar.id !== undefined ? targetChar.id : rawCharId;
    var targetName = (targetChar && (targetChar.name || targetChar.nickname)) || payload.charName || "好友";

    var thumb = await compressDataUrl(payload.posterDataUrl || "", 640, 0.84);
    var now = Date.now();
    var d = new Date(now);
    var timeStr = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    var userNote = String(payload.forwardNote || "").trim().slice(0, 120);
    var cakeTitle = String(payload.cakeName || "暖光手作蛋糕");
    var captionTitle = "《" + cakeTitle + "》" + (payload.plaqueText ? " · " + payload.plaqueText : "") + "（东汉工坊手作纪念图）";

    // 1:1 对齐传讯图片卡片渲染规则（app.min.js:L119236-L119280）：
    // type: "image" + content: DataURL + text 含《》/图 + isEmoji: false -> 渲染为 260px 精致圆角画框大图（可点击放大）
    var msgsToSave = [];
    if (thumb) {
      msgsToSave.push({
        id: now,
        type: "image",
        isEmoji: false,
        isMe: true,
        sender: "user",
        time: timeStr,
        timestamp: now,
        text: captionTitle,
        content: thumb
      });
    } else {
      msgsToSave.push({
        id: now,
        type: "text",
        isMe: true,
        sender: "user",
        time: timeStr,
        timestamp: now,
        text: "【东汉工坊 · 蛋糕工坊】" + captionTitle + (payload.cakeDesc ? "\n" + String(payload.cakeDesc).slice(0, 100) : "")
      });
    }

    // 若用户填写了转发附言，紧随大图发一条自然附言
    if (userNote) {
      msgsToSave.push({
        id: now + 1,
        type: "text",
        isMe: true,
        sender: "user",
        time: timeStr,
        timestamp: now + 1,
        text: userNote
      });
    }

    var primaryMsg = msgsToSave[0];

    try {
      // 1. 持久化写入 IndexedDB（完全对齐 forum_share_app.js 的 saveMessage）
      if (typeof chStore.saveMessage === "function") {
        for (var i = 0; i < msgsToSave.length; i++) {
          await chStore.saveMessage(targetId, msgsToSave[i]);
        }
      } else {
        var prevRes = typeof chStore.getMessages === "function" ? await chStore.getMessages(targetId, 1, 200) : null;
        var prevList = (prevRes && Array.isArray(prevRes.messages)) ? prevRes.messages : [];
        await chStore.saveMessages(targetId, prevList.concat(msgsToSave));
      }

      // 2. 兼容同步 localStorage 历史缓存（若存在）
      try {
        var lsKey = "t8_chat_history_" + targetId;
        var rawHist = global.localStorage && global.localStorage.getItem(lsKey);
        if (rawHist) {
          var arr = JSON.parse(rawHist);
          if (Array.isArray(arr)) {
            for (var j = 0; j < msgsToSave.length; j++) arr.push(msgsToSave[j]);
            global.localStorage.setItem(lsKey, JSON.stringify(arr));
          }
        }
      } catch (_) {}

      // 3. 同步更新传讯列表最新摘要预览（t8_chat_list + chatCharacterStore）
      var previewText = "[蛋糕工坊] 《" + cakeTitle + "》";
      try {
        var listRaw = global.localStorage && global.localStorage.getItem("t8_chat_list");
        if (listRaw) {
          var list = JSON.parse(listRaw);
          if (Array.isArray(list)) {
            var next = list.map(function (c) {
              return c && String(c.id) === String(targetId)
                ? Object.assign({}, c, { lastMessage: previewText, lastTime: timeStr, time: timeStr, updatedAt: now })
                : c;
            });
            global.localStorage.setItem("t8_chat_list", JSON.stringify(next));
          }
        }
      } catch (_) {}
      try {
        if (targetChar && global.chatCharacterStore && typeof global.chatCharacterStore.save === "function") {
          targetChar.lastMessage = previewText;
          targetChar.lastTime = timeStr;
          targetChar.time = timeStr;
          targetChar.updatedAt = now;
          await global.chatCharacterStore.save(targetChar);
        }
      } catch (_) {}

      // 4. 派发与 forum_share_app.js 一致的自定义事件，通知传讯列表与打开的聊天窗实时同步
      if (typeof global.dispatchEvent === "function" && typeof CustomEvent === "function") {
        global.dispatchEvent(new CustomEvent("reloadChats"));
        global.dispatchEvent(
          new CustomEvent("milvus-forum-share-sent", {
            detail: { charId: String(targetId), msg: primaryMsg }
          })
        );
        global.dispatchEvent(
          new CustomEvent("chatHistoryUpdated", {
            detail: { chatId: String(targetId) }
          })
        );
      }

      return { ok: true, message: "已成功转发至「" + targetName + "」的传讯聊天" };
    } catch (e) {
      return { ok: false, message: "转发传讯失败：" + (e && e.message ? e.message : e) };
    }
  }

  // ==================== 5. Fullscreen Dual-Edition Picker & Iframe Host Component ====================

  function CakeWorkshopHostModal(props) {
    var React = global.React;
    if (!React) return null;
    var h = React.createElement;
    var useEffect = React.useEffect;
    var useRef = React.useRef;
    var useState = React.useState;

    var onClose = props && (props.onClose || props.onBack);
    var edState = useState(null); // null = picker | "modern" | "han"
    var edition = edState[0];
    var setEdition = edState[1];
    var iframeRef = useRef(null);
    var editionRef = useRef(edition);
    editionRef.current = edition;

    async function pushLightSync() {
      var win = iframeRef.current && iframeRef.current.contentWindow;
      if (!win) return;
      var roster = await getLightCharacterRoster();
      var userP = getActiveUserPersona();
      win.postMessage(
        {
          type: "WORKSHOP_CAKE_HOST_SYNC",
          payload: {
            edition: editionRef.current || "modern",
            characters: roster.map(function (c) { return { id: c.id, name: c.name, mbti: c.mbti }; }),
            userName: userP.name,
            apiReady: hasApiConfigured()
          }
        },
        "*"
      );
    }

    useEffect(function () {
      var onMessage = async function (ev) {
        var data = ev && ev.data;
        if (!data || typeof data !== "object" || !data.type) return;
        var win = iframeRef.current && iframeRef.current.contentWindow;
        var curEdition = editionRef.current || "modern";

        if (data.type === "WORKSHOP_CAKE_CLOSE") {
          // 从具体版本返回双版本选择页，方便随时切换现代版/东汉版
          setEdition(null);
          return;
        }
        if (data.type === "WORKSHOP_CAKE_REQUEST_SYNC") {
          await pushLightSync();
          return;
        }
        if (!win) return;

        var reqId = data.requestId;
        var enrichedPayload = Object.assign({ edition: curEdition }, data.payload || {});
        if (data.type === "WORKSHOP_CAKE_STEP_RELAY_REQUEST") {
          try {
            var res1 = await handleStepRelay(enrichedPayload);
            win.postMessage({ type: "WORKSHOP_CAKE_STEP_RELAY_RESPONSE", requestId: reqId, result: res1 }, "*");
          } catch (e1) {
            win.postMessage({ type: "WORKSHOP_CAKE_STEP_RELAY_RESPONSE", requestId: reqId, error: String(e1 && e1.message || e1) }, "*");
          }
        } else if (data.type === "WORKSHOP_CAKE_FULL_MAKE_REQUEST") {
          try {
            var res2 = await handleCharFullMake(enrichedPayload);
            win.postMessage({ type: "WORKSHOP_CAKE_FULL_MAKE_RESPONSE", requestId: reqId, result: res2 }, "*");
          } catch (e2) {
            win.postMessage({ type: "WORKSHOP_CAKE_FULL_MAKE_RESPONSE", requestId: reqId, error: String(e2 && e2.message || e2) }, "*");
          }
        } else if (data.type === "WORKSHOP_CAKE_TASTE_REQUEST") {
          try {
            var res3 = await handleCharTaste(enrichedPayload);
            win.postMessage({ type: "WORKSHOP_CAKE_TASTE_RESPONSE", requestId: reqId, result: res3 }, "*");
          } catch (e3) {
            win.postMessage({ type: "WORKSHOP_CAKE_TASTE_RESPONSE", requestId: reqId, error: String(e3 && e3.message || e3) }, "*");
          }
        } else if (data.type === "WORKSHOP_CAKE_FEEDBACK_REQUEST") {
          try {
            var res4 = await handleUserFeedbackReply(enrichedPayload);
            win.postMessage({ type: "WORKSHOP_CAKE_FEEDBACK_RESPONSE", requestId: reqId, result: res4 }, "*");
          } catch (e4) {
            win.postMessage({ type: "WORKSHOP_CAKE_FEEDBACK_RESPONSE", requestId: reqId, error: String(e4 && e4.message || e4) }, "*");
          }
        } else if (data.type === "WORKSHOP_CAKE_SAVE_BACKPACK") {
          var bpRes = await saveCakeToBackpack(enrichedPayload);
          win.postMessage({ type: "WORKSHOP_CAKE_ACTION_RESULT", requestId: reqId, result: bpRes }, "*");
        } else if (data.type === "WORKSHOP_CAKE_SEND_CHAT") {
          var chRes = await sendCakeToChat(enrichedPayload);
          win.postMessage({ type: "WORKSHOP_CAKE_ACTION_RESULT", requestId: reqId, result: chRes }, "*");
        } else if (data.type === "WORKSHOP_CAKE_SAVE_HISTORY") {
          var shRes = await saveCakeHistoryRecord(enrichedPayload);
          win.postMessage({ type: "WORKSHOP_CAKE_ACTION_RESULT", requestId: reqId, result: shRes }, "*");
        } else if (data.type === "WORKSHOP_CAKE_LIST_HISTORY") {
          var lhRes = await listCakeHistoryRecords(enrichedPayload.edition);
          win.postMessage({ type: "WORKSHOP_CAKE_ACTION_RESULT", requestId: reqId, result: lhRes }, "*");
        } else if (data.type === "WORKSHOP_CAKE_DELETE_HISTORY") {
          var dhRes = await deleteCakeHistoryRecord(data.payload && data.payload.id);
          win.postMessage({ type: "WORKSHOP_CAKE_ACTION_RESULT", requestId: reqId, result: dhRes }, "*");
        }
      };

      global.addEventListener("message", onMessage);
      return function () { global.removeEventListener("message", onMessage); };
    }, [onClose]);

    // 双版本选择器界面（现代版 / 东汉版）
    if (!edition) {
      var cardBaseStyle = {
        width: "100%",
        borderRadius: "22px",
        padding: "20px 18px",
        border: "1.5px solid rgba(226, 200, 174, 0.9)",
        boxShadow: "0 10px 26px rgba(120, 75, 49, 0.10), inset 0 1px 0 rgba(255,255,255,0.85)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        cursor: "pointer",
        textAlign: "left",
        transition: "transform 0.18s ease"
      };

      return h(
        "div",
        {
          style: {
            position: "fixed",
            inset: 0,
            zIndex: 1020,
            background: "radial-gradient(circle at 50% 18%, #FFFDF9 0%, #FFF6EA 58%, #F7E5D0 100%)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            fontFamily: '"PingFang SC", "Songti SC", "Microsoft YaHei", sans-serif'
          }
        },
        h(
          "div",
          {
            style: {
              padding: "16px 18px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid rgba(226, 200, 174, 0.55)",
              background: "rgba(255, 252, 246, 0.86)",
              backdropFilter: "blur(8px)"
            }
          },
          h(
            "button",
            {
              type: "button",
              onClick: function () { if (typeof onClose === "function") onClose(); },
              style: {
                border: "1px solid #E5CBB0",
                background: "#FFFFFF",
                color: "#6B442A",
                borderRadius: "999px",
                padding: "6px 13px",
                fontSize: "12.5px",
                fontWeight: 700,
                cursor: "pointer"
              }
            },
            "‹ 返回东汉工坊"
          ),
          h(
            "div",
            { style: { fontSize: "15.5px", fontWeight: 800, color: "#4A2E1B", letterSpacing: "0.5px" } },
            "蛋糕工坊 · 择坊入席"
          ),
          h("div", { style: { width: "86px" } })
        ),
        h(
          "div",
          {
            style: {
              flex: 1,
              overflowY: "auto",
              padding: "24px 20px 32px",
              maxWidth: "480px",
              width: "100%",
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: "18px"
            }
          },
          h(
            "div",
            { style: { textAlign: "center", marginBottom: "4px" } },
            h("div", { style: { fontSize: "19px", fontWeight: 800, color: "#4A2E1B", marginBottom: "6px" } }, "今日想同名士做什么点心？"),
            h("div", { style: { fontSize: "12.5px", color: "#8C6348", lineHeight: 1.6 } }, "两座工坊均已接入传讯名士、记忆胶囊、简笔画涂鸦、行囊收藏与传讯转发")
          ),
          h(
            "button",
            {
              type: "button",
              onClick: function () { setEdition("modern"); },
              style: Object.assign({}, cardBaseStyle, {
                background: "linear-gradient(145deg, #FFFDF9 0%, #FFEFE2 100%)"
              })
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
              h("span", { style: { fontSize: "17px", fontWeight: 800, color: "#4A2E1B" } }, "现代版 · 暖光奶油蛋糕坊"),
              h("span", { style: { fontSize: "11px", fontWeight: 700, padding: "3px 9px", borderRadius: "999px", background: "#FFE2D6", color: "#C94E38" } }, "法式高定")
            ),
            h("div", { style: { fontSize: "12.5px", color: "#7B563D", lineHeight: 1.65 } }, "海绵蛋糕胚 · 双色渐变抹面 · 甘纳许淋面 · 360° 复古垂弧花边 · 鲜果马卡龙与手写贺卡"),
            h("div", { style: { fontSize: "12px", fontWeight: 700, color: "#C94E38", marginTop: "2px" } }, "推门进入现代蛋糕工坊 →")
          ),
          h(
            "button",
            {
              type: "button",
              onClick: function () { setEdition("han"); },
              style: Object.assign({}, cardBaseStyle, {
                background: "linear-gradient(145deg, #FFFDF7 0%, #F7E8D8 55%, #F2DEC8 100%)",
                borderColor: "rgba(200, 128, 92, 0.72)"
              })
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
              h("span", { style: { fontSize: "17px", fontWeight: 800, color: "#3E2215", fontFamily: '"Songti SC", "STSong", serif' } }, "东汉版 · 洛阳凌阴冰饮坊"),
              h("span", { style: { fontSize: "11px", fontWeight: 700, padding: "3px 9px", borderRadius: "999px", background: "#F5D6C6", color: "#A83622" } }, "汉风酥山")
            ),
            h("div", { style: { fontSize: "12.5px", color: "#724A32", lineHeight: 1.65 } }, "朱漆耳杯 / 青铜冰盏 · 凌阴碎冰夹心 · 百花崖蜜挂露 · 汉宫点酥 · 西域仙果 · 汉简木牍花押"),
            h("div", { style: { fontSize: "12px", fontWeight: 700, color: "#A83622", marginTop: "2px" } }, "入席洛阳凌阴冰饮工坊 →")
          )
        )
      );
    }

    var iframeSrc = edition === "han" ? "./东汉版蛋糕.html" : "./蛋糕抹面.html";
    var iframeTitle = edition === "han" ? "东汉工坊 · 洛阳凌阴冰饮坊" : "东汉工坊 · 蛋糕工坊";

    return h(
      "div",
      {
        style: {
          position: "fixed",
          inset: 0,
          zIndex: 1020,
          background: "#FFF8EE",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          touchAction: "none"
        }
      },
      h("iframe", {
        key: edition,
        ref: iframeRef,
        src: iframeSrc,
        title: iframeTitle,
        onLoad: function () { pushLightSync(); },
        style: {
          flex: 1,
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
          background: "#FFF8EE"
        }
      })
    );
  }

  // Auto hot-plug into 东汉工坊 ("cake" slot)
  if (global.HanWorkshopApp && typeof global.HanWorkshopApp.registerWorkshop === "function") {
    global.HanWorkshopApp.registerWorkshop("cake", {
      title: "蛋糕工坊",
      subtitle: "暖光手作 · 共创",
      icon: "cake",
      component: CakeWorkshopHostModal
    });
  }

  global.HanWorkshopCakeBridge = {
    version: "1.1.0",
    VALID_ENUMS: VALID_ENUMS,
    getLightCharacterRoster: getLightCharacterRoster,
    collectCharacterFullContext: collectCharacterFullContext,
    callCakeLLMWithVisionFallback: callCakeLLMWithVisionFallback,
    handleStepRelay: handleStepRelay,
    handleCharFullMake: handleCharFullMake,
    handleCharTaste: handleCharTaste,
    handleUserFeedbackReply: handleUserFeedbackReply,
    saveCakeHistoryRecord: saveCakeHistoryRecord,
    listCakeHistoryRecords: listCakeHistoryRecords,
    deleteCakeHistoryRecord: deleteCakeHistoryRecord,
    saveCakeToBackpack: saveCakeToBackpack,
    sendCakeToChat: sendCakeToChat,
    CakeWorkshopHostModal: CakeWorkshopHostModal
  };
})(typeof window !== "undefined" ? window : globalThis);

