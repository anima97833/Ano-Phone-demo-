/**
 * Milvus/han_workshop_sachet_bridge.js
 * 「东汉工坊 · 香囊造物（幽兰佩 · 东汉古法香囊工坊）」独立宿主桥接引擎
 *
 * 严格遵循 .agents/skills/han-workshop-grafting/SKILL.md：
 * 1. 通过 window.HanWorkshopApp.registerWorkshop("sachet", ...) 自动热插拔入驻，零改动 app.min.js
 * 2. 全屏托管同源 <iframe src="./香囊制作.html">，通过 postMessage 兼容 file:// 与 http://
 * 3. 七维上下文按需采集（角色 6 维 + 身份配置库 + 情侣空间 + 开启世界书 + 记忆胶囊 + 传讯近 15 条 + 双轨视觉）
 * 4. 完整 7 步 13 组东汉制香枚举（6 囊形 / 5 丝帛 / 7 色 / 5 织锦底纹 / 19 味汉方香料 / 17 刺绣纹样 / 系绳流苏玉珠结饰 / 礼盒印章）+ 简笔画 SVG
 * 5. 独立历史库 milvus_han_workshop_sachet_idb + 存入行囊(backpackStore.addItems) + 传讯画框大图转发
 */
(function (global) {
  "use strict";

  var SACHET_ENUMS = {
    shape: ["pouch", "round", "gourd", "fangsheng", "ruyi", "petal"],
    material: ["silk", "damask", "linen", "brocade", "embcloth"],
    color: ["rouge", "moonwhite", "tianshui", "qiuxiang", "ochre", "turquoise", "lotus"],
    pattern: ["plain", "cloud", "fret", "pearl", "scroll"],
    cutTool: ["scissors", "knife", "ruler"],
    opening: ["drawstring", "flat", "folded"],
    herb: [
      "osmanthus", "plum", "jasmine", "rose", "chrys", "orchid",
      "mugwort", "mint", "perilla", "agastache", "eupatorium",
      "clove", "chenpi", "angelica", "nard", "agarwood",
      "cotton", "powder", "woodchip"
    ],
    needle: ["fine", "embroidery", "curved"],
    threadColor: ["t_red", "t_gold", "t_white", "t_cyan", "t_green", "t_pink", "t_purple", "t_black"],
    stitchType: ["running", "back", "overlock", "binding"],
    motif: [
      "m_plum", "m_lotus", "m_peony", "m_orchid", "m_osman", "m_chrys",
      "m_cloud", "m_ruyi", "m_bat", "m_fish", "m_branch", "m_beast",
      "t_fu", "t_an", "t_ning", "t_changle", "t_changan"
    ],
    embTool: ["satin", "chain", "gold", "seed"],
    cord: ["c_red", "c_cyan", "c_gold", "c_white", "c_double"],
    tassel: ["ts_long", "ts_short", "ts_double", "ts_petal"],
    bead: ["bd_jade", "bd_agate", "bd_glass", "bd_wood", "bd_ring"],
    knot: ["kn_ear", "kn_ruyi", "kn_simple", "kn_flower"],
    box: ["lacquer", "pouch", "silk", "bamboo"],
    sealStyle: ["red_relief", "white_intaglio"]
  };

  var SACHET_ENUM_HINT_TEXT =
    "【幽兰佩 · 东汉古法香囊工坊 7 步完整合法枚举 ID（严禁编造列表外的 ID）】\n" +
    "- 囊形 shapeId：pouch(荷包形) / round(圆形香囊) / gourd(葫芦形) / fangsheng(方胜形) / ruyi(如意形) / petal(花瓣形)\n" +
    "- 丝帛材质 materialId：silk(素绢) / damask(绫罗) / linen(棉麻) / brocade(锦缎) / embcloth(绣布)\n" +
    "- 布料底色 colorId：rouge(胭脂粉) / moonwhite(月白) / tianshui(天水碧) / qiuxiang(秋香色) / ochre(赭红) / turquoise(松石绿) / lotus(藕荷紫)\n" +
    "- 织锦底纹 patternId：plain(素面) / cloud(云纹) / fret(回纹) / pearl(连珠纹) / scroll(缠枝花纹)\n" +
    "- 裁具 cutToolId：scissors(小剪刀) / knife(裁布刀) / ruler(竹布尺)；囊口 openingId：drawstring(抽绳口) / flat(平口) / folded(翻边口)\n" +
    "- 19 味汉方香料 herbs（数组 3~5 味，每项 {\"id\":\"合法ID\",\"amount\":15到40整数}，合计约100）：\n" +
    "  * 花材：osmanthus(桂花) / plum(梅花) / jasmine(茉莉) / rose(玫瑰) / chrys(菊花) / orchid(兰草)\n" +
    "  * 香草：mugwort(艾草) / mint(薄荷) / perilla(紫苏) / agastache(藿香) / eupatorium(佩兰)\n" +
    "  * 香料：clove(丁香) / chenpi(陈皮) / angelica(白芷) / nard(甘松) / agarwood(沉香)\n" +
    "  * 辅材：cotton(棉絮) / powder(香粉) / woodchip(香木碎)\n" +
    "- 缝合针具 needleId：fine(细针) / embroidery(绣花针) / curved(弯针)；针法 stitchTypeId：running(平针) / back(回针) / overlock(锁边针) / binding(包边针)\n" +
    "- 丝线/绣线色 threadColorId / embThreadId / embThread2Id：t_red(朱红) / t_gold(金丝) / t_white(米白) / t_cyan(黛青) / t_green(青绿) / t_pink(浅粉) / t_purple(藕紫) / t_black(墨黑)\n" +
    "- 刺绣针法 embToolId：satin(平绣) / chain(锁绣) / gold(盘金绣) / seed(打籽绣)\n" +
    "- 刺绣纹样 motifs（数组，建议 3~5 处，最多 6 处）：\n" +
    "  * 花卉：m_plum(梅花) / m_lotus(荷花) / m_peony(牡丹) / m_orchid(兰花) / m_osman(桂花枝) / m_chrys(菊花)\n" +
    "  * 吉祥：m_cloud(祥云) / m_ruyi(如意) / m_bat(福蝠) / m_fish(双鱼) / m_branch(连理枝) / m_beast(瑞兽纹)\n" +
    "  * 吉语：t_fu(福) / t_an(安) / t_ning(宁) / t_changle(长乐) / t_changan(常安)\n" +
    "- 系绳 cordId：c_red(朱红丝绳) / c_cyan(天青丝绳) / c_gold(流金丝绳) / c_white(米白丝绳) / c_double(双股彩绳)\n" +
    "- 流苏 tasselId：ts_long(长流苏) / ts_short(短流苏) / ts_double(双层流苏) / ts_petal(花瓣流苏)\n" +
    "- 汉风结饰 knotId：kn_ear(双耳结) / kn_ruyi(如意结) / kn_simple(同心结) / kn_flower(盘长花结)\n" +
    "- 玉珠佩饰 beadIds（数组 1~3 颗）：bd_jade(白玉珠) / bd_agate(玛瑙珠) / bd_glass(琉璃珠) / bd_wood(檀木珠) / bd_ring(白玉环)\n" +
    "- 礼盒 boxId：lacquer(朱漆木盒) / pouch(素色锦囊) / silk(丝帛包裹) / bamboo(竹编小盒)；印章 sealStyleId：red_relief(朱文方印) / white_intaglio(白文古印)";

  var AFFECTION_CRAFT_GUIDELINE =
    "【心意与古法制香法则（非常重要）】\n" +
    "1. 请根据你的角色设定、世界书、记忆胶囊与近期传讯关系，判断你对收礼人的情感温度：\n" +
    "   - 若你是**爱慕、偏爱、深爱、宠溺或格外珍视对方**的角色：香囊本就是汉代贴身定情与护身之物，就算你平日清冷、克制、毒舌或嘴硬，也会暗自用心挑选锦缎/绫罗暗纹、配伍讲究的 4~5 味君臣佐使香方（兼顾安神、驱暑或对方喜爱的花木香）、细密盘金绣/锁绣多层次纹样、配齐玉珠同心结/如意结与雅致礼盒，绝不敷衍！\n" +
    "   - 清冷/克制但深爱型：走【兰质蕙心清雅高定】——月白/天水碧/松石绿绫罗云纹 + 沉香/兰草/白芷/梅花君臣香方 + 盘金/平绣梅兰云纹 + 白玉珠/白玉环与如意结，嘴上淡淡说“顺手缝的”，实则针脚与香方极考究。\n" +
    "   - 热烈/温柔/宠溺型：走【朱漆织金华贵高定】——胭脂粉/赭红/藕荷紫锦缎缠枝花纹 + 玫瑰/桂花/丁香/甘松甜暖香方 + 盘金绣牡丹/连理枝/长乐吉语 + 玛瑙/琉璃珠与双层长流苏同心结。\n" +
    "   - 只有当你们关系确实疏离或冷战敷衍时，才选择素面棉麻极简款。\n" +
    "2. 避免单调空旷：刺绣至少选 3~5 处（主纹+伴纹+吉语），佩珠选 2~3 颗，让成品挂在腰间一眼惊艳。";

  var visionUnsupportedSession = false;

  function pickValid(val, list, fallback) {
    return list.indexOf(val) >= 0 ? val : fallback;
  }

  function normalizeHerbs(rawHerbs) {
    var list = [];
    var seen = {};
    if (Array.isArray(rawHerbs)) {
      for (var i = 0; i < rawHerbs.length; i++) {
        var h = rawHerbs[i];
        var id = typeof h === "string" ? h : (h && h.id);
        if (!id || SACHET_ENUMS.herb.indexOf(id) < 0 || seen[id]) continue;
        seen[id] = true;
        var amt = Math.max(10, Math.min(50, Math.round(Number(h && h.amount) || 25)));
        list.push({ id: id, amount: amt });
        if (list.length >= 5) break;
      }
    }
    if (list.length === 0) {
      return [
        { id: "osmanthus", amount: 30 },
        { id: "orchid", amount: 25 },
        { id: "angelica", amount: 25 },
        { id: "agarwood", amount: 20 }
      ];
    }
    var sum = list.reduce(function (s, x) { return s + x.amount; }, 0);
    if (sum !== 100 && sum > 0) {
      var acc = 0;
      for (var j = 0; j < list.length - 1; j++) {
        list[j].amount = Math.max(10, Math.round((list[j].amount / sum) * 100));
        acc += list[j].amount;
      }
      list[list.length - 1].amount = Math.max(10, 100 - acc);
    }
    return list;
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

  // ==================== 1. 7D On-Demand Context Collector (Strict 记忆胶囊) ====================

  async function getLightCharacterRoster() {
    var rawList = [];
    try {
      if (global.chatCharacterStore && typeof global.chatCharacterStore.getAll === "function") {
        var stored = await global.chatCharacterStore.getAll();
        if (Array.isArray(stored) && stored.length > 0) rawList = stored;
      }
    } catch (_) {}
    if (rawList.length === 0 && Array.isArray(global.__T8_LIVE_CHATS)) rawList = global.__T8_LIVE_CHATS;
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

    // 严格读取「传讯 · 对话偏好设置 · 记忆胶囊」（CompanionMemoryEngine），不读旧版长期记忆
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

  // ==================== 2. Dual-Track LLM & SVG Sanitizer ====================

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

  async function callSachetLLMWithVisionFallback(sysPrompt, userPrompt, imageDataUrl) {
    var canTryVision = Boolean(
      imageDataUrl &&
      typeof imageDataUrl === "string" &&
      imageDataUrl.indexOf("data:image") === 0 &&
      !visionUnsupportedSession
    );
    if (canTryVision) {
      try {
        var vReply = await invokeSendToLLM([
          { role: "system", content: sysPrompt },
          { role: "user", content: [{ type: "text", text: userPrompt }, { type: "image_url", image_url: { url: imageDataUrl } }] }
        ]);
        if (vReply && vReply.trim()) return { text: vReply, usedVision: true };
      } catch (_) {
        visionUnsupportedSession = true;
      }
    }
    try {
      var tReply = await invokeSendToLLM([
        { role: "system", content: sysPrompt },
        { role: "user", content: userPrompt }
      ]);
      return { text: tReply || "", usedVision: false };
    } catch (_) {
      return { text: "", usedVision: false };
    }
  }

  function extractJsonSafe(rawText) {
    if (!rawText) return null;
    var cleaned = String(rawText).replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    try { return JSON.parse(cleaned); } catch (_) {}
    var s = cleaned.indexOf("{");
    var e = cleaned.lastIndexOf("}");
    if (s >= 0 && e > s) {
      try { return JSON.parse(cleaned.slice(s, e + 1).replace(/,\s*([}\]])/g, "$1")); } catch (_) {}
    }
    return null;
  }

  function sanitizeSketchSvg(rawSvg, targetW, targetH) {
    if (!rawSvg || typeof rawSvg !== "string") return "";
    var s = rawSvg.replace(/```(?:svg|xml)?\s*/gi, "").replace(/```\s*/g, "").trim();
    var m = s.match(/<svg[\s\S]*?<\/svg>/i);
    if (!m) return "";
    s = m[0];
    s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
    s = s.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "");
    s = s.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    s = s.replace(/javascript:/gi, "");
    s = s.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi, "&amp;");
    s = s.replace(/<rect\b[^>]*(?:width\s*=\s*["'](?:100%|2[0-9]{2}|3[0-9]{2}|4[0-9]{2})["'])[^>]*(?:fill\s*=\s*["'](?:#fff|#ffffff|white|#fdf|#faf)[^"']*["'])[^>]*\/?>/gi, "");
    s = s.replace(/<svg\b([^>]*)>/i, function (_, attrs) {
      var cleanAttrs = String(attrs || "")
        .replace(/\swidth\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .replace(/\sheight\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
      if (!/xmlns\s*=/i.test(cleanAttrs)) cleanAttrs = ' xmlns="http://www.w3.org/2000/svg"' + cleanAttrs;
      if (!/viewBox\s*=/i.test(cleanAttrs)) cleanAttrs += ' viewBox="0 0 ' + targetW + ' ' + targetH + '"';
      return '<svg width="' + targetW + '" height="' + targetH + '"' + cleanAttrs + '>';
    });
    if (!/<(?:path|circle|ellipse|line|polyline|polygon|rect|text)\b/i.test(s)) return "";
    return s;
  }

  function buildFallbackSachetSketchSvg(charName) {
    var safeName = String(charName || "名士").replace(/[<>&"']/g, "").slice(0, 4);
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="72" viewBox="0 0 320 72">' +
      '<path d="M22 56 Q62 24 114 40" fill="none" stroke="#5B8C6B" stroke-width="2.2" stroke-linecap="round"/>' +
      '<path d="M36 56 Q78 16 142 26" fill="none" stroke="#5B8C6B" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M58 48 Q92 32 134 46" fill="none" stroke="#7BB086" stroke-width="1.8" stroke-linecap="round"/>' +
      '<circle cx="144" cy="25" r="4" fill="#D9889A"/><circle cx="151" cy="29" r="3.6" fill="#F5C6D0"/><circle cx="139" cy="31" r="3.6" fill="#F5C6D0"/>' +
      '<rect x="182" y="18" width="24" height="24" rx="4" fill="none" stroke="#C84B31" stroke-width="1.8"/>' +
      '<text x="194" y="34" text-anchor="middle" font-family="serif" font-size="12" font-weight="bold" fill="#C84B31">香</text>' +
      '<text x="224" y="46" font-family="serif" font-size="20" font-weight="bold" fill="#3E2215">' + safeName + '</text>' +
      '<path d="M218 55 Q258 51 302 57" fill="none" stroke="#D9A441" stroke-width="1.6" stroke-linecap="round"/>' +
      '</svg>'
    );
  }

  // ==================== 3. Four Sachet AI Orchestration Actions (7-Step Craft) ====================

  async function handleStepRelay(payload) {
    var ctx = await collectCharacterFullContext(payload.charId);
    var E = SACHET_ENUMS;
    var stepIndex = Math.max(0, Math.min(6, Math.floor(Number(payload.stepIndex) || 0)));
    var stepNames = ["择囊选绢", "裁绢定形", "调香填囊", "缝合囊口", "刺绣绘纹", "系绳缀饰", "题名封礼"];
    var visualText = String(payload.visualSnapshotText || payload.cakeSummary || "刚铺开丝帛的东汉制香绣案");
    var relayNotes = Array.isArray(payload.relayHistory) ? payload.relayHistory.slice(-4).join("\n") : "";

    var stepSchemaByIdx = {
      0: '{"shapeId":"合法囊形ID","materialId":"合法丝帛ID","colorId":"合法颜色ID","patternId":"合法底纹ID","spokenLine":"1~2句贴合人设边选囊形丝帛边说的话","moodTag":"4字状态"}',
      1: '{"cutToolId":"scissors/knife/ruler","openingId":"drawstring/flat/folded","spokenLine":"1~2句贴合人设边裁绢定形边说的话","moodTag":"4字状态"}',
      2: '{"herbs":[{"id":"合法香料ID","amount":30},{"id":"合法香料ID","amount":25},{"id":"合法香料ID","amount":25},{"id":"合法香料ID","amount":20}],"spokenLine":"1~2句贴合人设说明为何配这几味香料的话","moodTag":"4字状态"}',
      3: '{"needleId":"fine/embroidery/curved","threadColorId":"合法丝线ID","stitchTypeId":"running/back/overlock/binding","spokenLine":"1~2句贴合人设边缝合囊口边说的话","moodTag":"4字状态"}',
      4: '{"motifs":["m_plum","m_cloud","t_changle"],"embThreadId":"合法绣线ID","embThread2Id":"none或合法绣线ID","embToolId":"satin/chain/gold/seed","sachetSketchTitle":"可选：若想在囊面正中亲手绣一幅简笔画填2~6字画题，不画留空","sachetSketchSvg":"可选：若画囊面刺绣简笔画则输出透明底标准<svg viewBox=\\"0 0 220 220\\">线稿(用#E0AD45/#FAF6EE/#C83E3B清晰绣线stroke-width=4，严禁白色底框，不画留空)","spokenLine":"1~2句贴合人设边刺绣绘纹边说的话","moodTag":"4字状态"}',
      5: '{"cordId":"合法系绳ID","tasselId":"合法流苏ID","knotId":"合法结饰ID","beadIds":["bd_jade","bd_ring"],"spokenLine":"1~2句贴合人设边系绳缀玉珠边说的话","moodTag":"4字状态"}',
      6: '{"boxId":"lacquer/pouch/silk/bamboo","sealStyleId":"red_relief/white_intaglio","sachetName":"香囊雅名(<=10字)","recipient":"称呼(<=14字)","message":"赠香祝词(20~55字)","sealText":"印章吉语(4字)","cardSketchTitle":"必填：你在封礼签名区手绘的花押/幽兰小画名(2~6字)","cardSketchSvg":"必填：透明底标准<svg viewBox=\\"0 0 320 72\\">矢量花押涂鸦(用#3E2215/#C84B31/#5B8C6B暖墨色，严禁白色底框)","spokenLine":"1~2句贴合人设题名封礼赠香时的话","moodTag":"4字状态"}'
    };

    var sysPrompt =
      "你正在扮演传讯名士「" + ctx.charObj.name + "」，正在「东汉工坊 · 香囊造物（幽兰佩香囊坊）」里与「" + ctx.userPersona.name + "」玩**你一步、我一步轮流接力制作一枚东汉古法香囊**。\n" +
      "现在轮到你亲自上手操作【第 " + (stepIndex + 1) + "/7 步：" + stepNames[stepIndex] + "】！\n\n" +
      "【你的 6 项完整角色配置（最高遵从：审美与口吻必须 100% 符合人设）】\n" + ctx.charProfileText + "\n\n" +
      "【" + ctx.userPersona.name + " 的身份设定】\n" + ctx.userPersonaText + "\n\n" +
      (ctx.coupleBondHint ? "【亲密关系提示】\n" + ctx.coupleBondHint + "\n\n" : "") +
      (ctx.worldBookText ? "【已开启的世界书设定】\n" + ctx.worldBookText + "\n\n" : "") +
      (ctx.memoryCapsuleText ? "【传讯 · 记忆胶囊中的共同回忆（自然参考你们的约定、喜好与过往细节）】\n" + ctx.memoryCapsuleText + "\n\n" : "") +
      (ctx.recentChatText ? "【你们在传讯中近期的聊天上下文（自然呼应彼此近况或梗）】\n" + ctx.recentChatText + "\n\n" : "") +
      AFFECTION_CRAFT_GUIDELINE + "\n\n" +
      SACHET_ENUM_HINT_TEXT + "\n\n" +
      "请结合当前香囊进度与你的真实性格及对对方的心意，在 `spokenLine` 里自然说出你**为什么选这些丝帛/香料/针法/纹样/玉珠或题名**，严格输出合法 JSON（禁止多余说明）：\n" +
      stepSchemaByIdx[stepIndex];

    var userPrompt =
      "【当前香囊制作进度与外观】\n" + visualText +
      (relayNotes ? "\n\n【前几步互动记录】\n" + relayNotes : "") +
      "\n\n现在轮到你完成【" + stepNames[stepIndex] + "】，请给出走心的制香决策与此刻台词。";

    var llmRes = await callSachetLLMWithVisionFallback(sysPrompt, userPrompt, payload.imageDataUrl);
    var parsed = extractJsonSafe(llmRes.text) || {};

    var stepAction = {};
    if (stepIndex === 0) {
      stepAction = {
        shapeId: pickValid(parsed.shapeId, E.shape, "pouch"),
        materialId: pickValid(parsed.materialId, E.material, "damask"),
        colorId: pickValid(parsed.colorId, E.color, "tianshui"),
        patternId: pickValid(parsed.patternId, E.pattern, "cloud")
      };
    } else if (stepIndex === 1) {
      stepAction = {
        cutToolId: pickValid(parsed.cutToolId, E.cutTool, "scissors"),
        openingId: pickValid(parsed.openingId, E.opening, "drawstring")
      };
    } else if (stepIndex === 2) {
      stepAction = {
        herbs: normalizeHerbs(parsed.herbs)
      };
    } else if (stepIndex === 3) {
      stepAction = {
        needleId: pickValid(parsed.needleId, E.needle, "embroidery"),
        threadColorId: pickValid(parsed.threadColorId, E.threadColor, "t_gold"),
        stitchTypeId: pickValid(parsed.stitchTypeId, E.stitchType, "overlock")
      };
    } else if (stepIndex === 4) {
      var rawMotifs = Array.isArray(parsed.motifs)
        ? parsed.motifs.filter(function (m) { return E.motif.indexOf(m) >= 0; }).slice(0, 6)
        : [];
      if (rawMotifs.length === 0) rawMotifs = ["m_plum", "m_cloud", "t_changle"];
      var secTh = parsed.embThread2Id === "none" ? "none" : pickValid(parsed.embThread2Id, E.threadColor, "t_white");
      stepAction = {
        motifs: rawMotifs,
        embThreadId: pickValid(parsed.embThreadId, E.threadColor, "t_gold"),
        embThread2Id: secTh,
        embToolId: pickValid(parsed.embToolId, E.embTool, "gold"),
        sachetSketchTitle: String(parsed.sachetSketchTitle || "").trim().slice(0, 12),
        sachetSketchSvg: sanitizeSketchSvg(parsed.sachetSketchSvg, 220, 220)
      };
    } else if (stepIndex === 5) {
      var rawBeads = Array.isArray(parsed.beadIds)
        ? parsed.beadIds.filter(function (b) { return E.bead.indexOf(b) >= 0; }).slice(0, 3)
        : [];
      if (rawBeads.length === 0) rawBeads = ["bd_jade", "bd_ring"];
      stepAction = {
        cordId: pickValid(parsed.cordId, E.cord, "c_gold"),
        tasselId: pickValid(parsed.tasselId, E.tassel, "ts_long"),
        knotId: pickValid(parsed.knotId, E.knot, "kn_ruyi"),
        beadIds: rawBeads
      };
    } else if (stepIndex === 6) {
      stepAction = {
        boxId: pickValid(parsed.boxId, E.box, "lacquer"),
        sealStyleId: pickValid(parsed.sealStyleId, E.sealStyle, "red_relief"),
        sachetName: String(parsed.sachetName || "幽兰长乐囊").slice(0, 12),
        recipient: String(parsed.recipient || ("致：" + ctx.userPersona.name)).slice(0, 18),
        message: String(parsed.message || "幽兰佩君侧，愿此缕清香伴你岁岁常安。").slice(0, 60),
        sealText: String(parsed.sealText || "长乐未央").slice(0, 6),
        cardSketchTitle: String(parsed.cardSketchTitle || "幽兰花押").trim().slice(0, 12),
        cardSketchSvg: sanitizeSketchSvg(parsed.cardSketchSvg, 320, 72) || buildFallbackSachetSketchSvg(ctx.charObj.name)
      };
    }

    return {
      charName: ctx.charObj.name,
      stepIndex: stepIndex,
      stepAction: stepAction,
      spokenLine: String(parsed.spokenLine || "「这一步交给我来理线配香罢。」").trim(),
      moodTag: String(parsed.moodTag || "巧手制香").slice(0, 8),
      usedVision: llmRes.usedVision
    };
  }

  async function handleCharFullMake(payload) {
    var ctx = await collectCharacterFullContext(payload.charId);
    var E = SACHET_ENUMS;
    var sysPrompt =
      "你正在扮演传讯名士「" + ctx.charObj.name + "」，正在「东汉工坊 · 香囊造物（幽兰佩香囊坊）」里**亲自从头到尾为「" + ctx.userPersona.name + "」缝制并调配一枚专属东汉古法香囊**。\n\n" +
      "【你的 6 项完整角色配置（最高遵从：香方寓意、配色审美、绣纹吉语与口吻必须 100% 符合人设）】\n" + ctx.charProfileText + "\n\n" +
      "【收礼人（" + ctx.userPersona.name + "）身份设定】\n" + ctx.userPersonaText + "\n\n" +
      (ctx.coupleBondHint ? "【亲密关系提示】\n" + ctx.coupleBondHint + "\n\n" : "") +
      (ctx.worldBookText ? "【已开启的世界书设定】\n" + ctx.worldBookText + "\n\n" : "") +
      (ctx.memoryCapsuleText ? "【传讯 · 记忆胶囊中的共同回忆（自然融入你们的回忆、喜好与私密约定）】\n" + ctx.memoryCapsuleText + "\n\n" : "") +
      (ctx.recentChatText ? "【你们在传讯中近期的聊天上下文（自然融入你们的近况与梗）】\n" + ctx.recentChatText + "\n\n" : "") +
      AFFECTION_CRAFT_GUIDELINE + "\n\n" +
      SACHET_ENUM_HINT_TEXT + "\n\n" +
      "请一次性构思完整 7 步制香高定方案，并在 `stepLines` 的 7 句里**用你的专属口吻自然交代每一步为什么选这个囊形丝帛、囊口、这几味君臣香料、针法、刺绣纹样、玉珠结饰与雅名祝词**，严格输出合法 JSON（禁止多余说明）：\n" +
      '{\n' +
      '  "shapeId": "合法ID", "materialId": "合法ID", "colorId": "合法ID", "patternId": "合法ID",\n' +
      '  "cutToolId": "合法ID", "openingId": "合法ID",\n' +
      '  "herbs": [{"id":"合法香料ID","amount":30},{"id":"合法香料ID","amount":25},{"id":"合法香料ID","amount":25},{"id":"合法香料ID","amount":20}],\n' +
      '  "needleId": "合法ID", "threadColorId": "合法ID", "stitchTypeId": "合法ID",\n' +
      '  "motifs": ["合法ID", "...建议3~5处，最多6处"], "embThreadId": "合法绣线ID", "embThread2Id": "none或合法绣线ID", "embToolId": "satin或chain或gold或seed",\n' +
      '  "sachetSketchTitle": "可选：若想在囊面正中亲手绣一幅小简笔画填2~6字画题；不画留空",\n' +
      '  "sachetSketchSvg": "可选：若画囊面刺绣简笔画则输出透明底标准<svg viewBox=\\"0 0 220 220\\">线稿(用#E0AD45/#FAF6EE/#C83E3B清晰绣线stroke-width=4，严禁白色底框)；不画留空",\n' +
      '  "cordId": "合法ID", "tasselId": "合法ID", "knotId": "合法ID", "beadIds": ["bd_jade", "bd_ring"],\n' +
      '  "boxId": "合法ID", "sealStyleId": "合法ID", "sachetName": "香囊雅名(<=10字)", "recipient": "称呼(<=14字)", "message": "20~55字赠香祝词", "sealText": "4字印章吉语",\n' +
      '  "cardSketchTitle": "必填：你在封礼签名区随手画的小简笔画/花押名称(2~6字)",\n' +
      '  "cardSketchSvg": "必填：透明底标准<svg viewBox=\\"0 0 320 72\\">矢量花押涂鸦(用#3E2215/#C84B31/#5B8C6B暖墨色，严禁白色底框)",\n' +
      '  "stepLines": ["第1步择囊选绢心意(20~50字)", "第2步裁绢定形心意(18~45字)", "第3步调香配伍心意(25~55字)", "第4步缝合囊口心意(18~45字)", "第5步刺绣绘纹心意(25~55字)", "第6步系绳缀玉珠心意(20~45字)", "第7步题名封礼与花押心意(25~55字)"],\n' +
      '  "introNote": "亲手将香囊递给对方佩戴时的一句开场白"\n' +
      '}';

    var llmRes = await callSachetLLMWithVisionFallback(
      sysPrompt,
      "请为 " + ctx.userPersona.name + " 定制并亲手缝制一枚饱含你心意与专属香方的 7 步东汉古法香囊。",
      ""
    );
    var p = extractJsonSafe(llmRes.text) || {};

    var motifs = Array.isArray(p.motifs)
      ? p.motifs.filter(function (m) { return E.motif.indexOf(m) >= 0; }).slice(0, 6)
      : [];
    if (motifs.length === 0) motifs = ["m_plum", "m_cloud", "m_orchid", "t_changle"];

    var beads = Array.isArray(p.beadIds)
      ? p.beadIds.filter(function (b) { return E.bead.indexOf(b) >= 0; }).slice(0, 3)
      : [];
    if (beads.length === 0) beads = ["bd_jade", "bd_ring"];

    var defaultLines = [
      "挑了衬你气度的丝帛与暗纹，贴身佩戴才够温润。",
      "依着囊形细细裁齐边角，留好顺手的囊口。",
      "这几味花木香料按君臣配好，既安神又不显甜腻。",
      "针脚替你缝得密实些，免得佩久了漏出香末。",
      "囊面上细细绣了纹样与吉语，一针一线可不许嫌弃。",
      "系上丝绳、汉风结与玉珠流苏，挂在腰间才够体面。",
      "雅名、祝词连同花押都封进礼盒里了，收好罢。"
    ];
    var lines = Array.isArray(p.stepLines) && p.stepLines.length >= 7
      ? p.stepLines.slice(0, 7).map(function (s, i) { return String(s || defaultLines[i]).trim(); })
      : defaultLines;

    var secTh = p.embThread2Id === "none" ? "none" : pickValid(p.embThread2Id, E.threadColor, "t_white");

    return {
      charName: ctx.charObj.name,
      plan: {
        shapeId: pickValid(p.shapeId, E.shape, "pouch"),
        materialId: pickValid(p.materialId, E.material, "damask"),
        colorId: pickValid(p.colorId, E.color, "tianshui"),
        patternId: pickValid(p.patternId, E.pattern, "cloud"),
        cutToolId: pickValid(p.cutToolId, E.cutTool, "scissors"),
        openingId: pickValid(p.openingId, E.opening, "drawstring"),
        herbs: normalizeHerbs(p.herbs),
        needleId: pickValid(p.needleId, E.needle, "embroidery"),
        threadColorId: pickValid(p.threadColorId, E.threadColor, "t_gold"),
        stitchTypeId: pickValid(p.stitchTypeId, E.stitchType, "overlock"),
        motifs: motifs,
        embThreadId: pickValid(p.embThreadId, E.threadColor, "t_gold"),
        embThread2Id: secTh,
        embToolId: pickValid(p.embToolId, E.embTool, "gold"),
        sachetSketchTitle: String(p.sachetSketchTitle || "").trim().slice(0, 12),
        sachetSketchSvg: sanitizeSketchSvg(p.sachetSketchSvg, 220, 220),
        cordId: pickValid(p.cordId, E.cord, "c_gold"),
        tasselId: pickValid(p.tasselId, E.tassel, "ts_long"),
        knotId: pickValid(p.knotId, E.knot, "kn_ruyi"),
        beadIds: beads,
        boxId: pickValid(p.boxId, E.box, "lacquer"),
        sealStyleId: pickValid(p.sealStyleId, E.sealStyle, "red_relief"),
        sachetName: String(p.sachetName || "幽兰长乐囊").slice(0, 12),
        recipient: String(p.recipient || ("致：" + ctx.userPersona.name)).slice(0, 18),
        message: String(p.message || "幽兰佩君侧，愿此缕清香伴你岁岁常安。").slice(0, 60),
        sealText: String(p.sealText || "长乐未央").slice(0, 6),
        cardSketchTitle: String(p.cardSketchTitle || "幽兰花押").trim().slice(0, 12),
        cardSketchSvg: sanitizeSketchSvg(p.cardSketchSvg, 320, 72) || buildFallbackSachetSketchSvg(ctx.charObj.name)
      },
      stepLines: lines,
      introNote: String(p.introNote || lines[6]).trim()
    };
  }

  async function handleCharTaste(payload) {
    var ctx = await collectCharacterFullContext(payload.charId);
    var visualText = String(payload.visualSnapshotText || payload.cakeSummary || "一枚东汉古法香囊");
    var modeNote = payload.mode === "relay_coop"
      ? "这是你与「" + ctx.userPersona.name + "」你一步我一步共同接力缝制完成的香囊。"
      : "这是「" + ctx.userPersona.name + "」亲手为你调香缝制并赠予你的香囊。";

    var sysPrompt =
      "你正在扮演传讯名士「" + ctx.charObj.name + "」，此刻正将眼前这枚古法香囊捧在掌心轻嗅并端详。\n" +
      modeNote + "\n\n" +
      "【你的 6 项完整角色配置（最高遵从：必须用你本人的说话风格、性情与细节癖好来评价）】\n" + ctx.charProfileText + "\n\n" +
      "【" + ctx.userPersona.name + " 的身份设定】\n" + ctx.userPersonaText + "\n\n" +
      (ctx.worldBookText ? "【已开启的世界书设定】\n" + ctx.worldBookText + "\n\n" : "") +
      (ctx.memoryCapsuleText ? "【传讯 · 记忆胶囊中的共同回忆】\n" + ctx.memoryCapsuleText + "\n\n" : "") +
      (ctx.recentChatText ? "【你们在传讯中近期的聊天上下文（自然呼应彼此关系与近期聊天细节）】\n" + ctx.recentChatText + "\n\n" : "") +
      "【要求】\n" +
      "1. 必须真实点评到香囊的具体丝帛颜色、所填香料气味、刺绣纹样与玉珠流苏，以及香囊雅名或题词！\n" +
      "2. 严禁千篇一律的“真香谢谢你”套话，要展现鲜明的人设感（比如挑剔针脚却立刻系在腰间、被某味药香勾起回忆、对题词嘴硬耳红等）。\n" +
      "3. 严格输出合法 JSON：\n" +
      '{"reactionTag":"4~8字神态短签","comment":"70~130字画面感嗅香佩戴动作与细节描写","dialogue":"1~2句贴合角色口吻的直白台词"}';

    var userPrompt = "【你眼前看到的香囊完整工艺与香方】\n" + visualText + "\n\n请以「" + ctx.charObj.name + "」的身份嗅香品评并给出真实回函。";
    var llmRes = await callSachetLLMWithVisionFallback(sysPrompt, userPrompt, payload.imageDataUrl);
    var p = extractJsonSafe(llmRes.text) || {};

    return {
      charName: ctx.charObj.name,
      reactionTag: String(p.reactionTag || "拈囊细嗅").slice(0, 12),
      comment: String(p.comment || (ctx.charObj.name + "垂眸摩挲过丝帛上的刺绣纹路，凑近轻嗅那缕幽幽花木清香，唇角微不可察地扬了扬，顺手将其系在腰间玉带上。")).trim(),
      dialogue: String(p.dialogue || "「这香方倒配得极合我意……既送了我，便日日佩着不摘了。」").trim(),
      usedVision: llmRes.usedVision
    };
  }

  async function handleUserFeedbackReply(payload) {
    var ctx = await collectCharacterFullContext(payload.charId);
    var userFeedback = String(payload.userFeedback || "").trim().slice(0, 160);
    var visualText = String(payload.visualSnapshotText || payload.cakeSummary || "");

    var sysPrompt =
      "你正在扮演传讯名士「" + ctx.charObj.name + "」。刚才你亲手为「" + ctx.userPersona.name + "」缝制了一枚古法香囊，对方嗅香佩戴后对你给出了一句真实反馈。\n\n" +
      "【你的 6 项完整角色配置】\n" + ctx.charProfileText + "\n\n" +
      "【" + ctx.userPersona.name + " 的身份设定】\n" + ctx.userPersonaText + "\n\n" +
      (ctx.worldBookText ? "【已开启的世界书设定】\n" + ctx.worldBookText + "\n\n" : "") +
      (ctx.memoryCapsuleText ? "【传讯 · 记忆胶囊中的共同回忆】\n" + ctx.memoryCapsuleText + "\n\n" : "") +
      (ctx.recentChatText ? "【近期传讯上下文】\n" + ctx.recentChatText + "\n\n" : "") +
      "请严格输出合法 JSON：\n" +
      '{"reactionTag":"4~8字神态短签","comment":"45~90字听到评价后的微表情与举动","dialogue":"1~2句贴合人设的回应台词"}';

    var userPrompt =
      "【你缝制的香囊】\n" + visualText +
      "\n\n【" + ctx.userPersona.name + " 佩香后对你说】：「" + (userFeedback || "这味道真好闻！") + "」";

    var llmRes = await callSachetLLMWithVisionFallback(sysPrompt, userPrompt, "");
    var p = extractJsonSafe(llmRes.text) || {};

    return {
      charName: ctx.charObj.name,
      reactionTag: String(p.reactionTag || "闻言微哂").slice(0, 12),
      comment: String(p.comment || (ctx.charObj.name + "听罢眼尾微弯，抬手替你理了理垂在衣襟间的丝绳流苏。")).trim(),
      dialogue: String(p.dialogue || "「合你心意便好，日后香散了再拿来，我替你换新料。」").trim()
    };
  }

  // ==================== 4. Independent Sachet History IndexedDB & Phone Integration ====================

  var SACHET_DB_NAME = "milvus_han_workshop_sachet_idb";
  var SACHET_DB_VER = 1;
  var SACHET_STORE = "sachets";
  var dbPromise = null;

  function openSachetHistoryDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (typeof indexedDB === "undefined") { reject(new Error("不支持 IndexedDB")); return; }
      var req = indexedDB.open(SACHET_DB_NAME, SACHET_DB_VER);
      req.onupgradeneeded = function (ev) {
        var db = ev.target.result;
        if (!db.objectStoreNames.contains(SACHET_STORE)) {
          db.createObjectStore(SACHET_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = function (ev) { resolve(ev.target.result); };
      req.onerror = function (ev) { dbPromise = null; reject(ev.target.error); };
    });
    return dbPromise;
  }

  function compressDataUrl(dataUrl, maxSide, quality) {
    return new Promise(function (resolve) {
      if (!dataUrl || typeof Image === "undefined" || typeof document === "undefined") { resolve(dataUrl || ""); return; }
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
        } catch (_) { resolve(dataUrl); }
      };
      img.src = dataUrl;
    });
  }

  async function saveSachetHistoryRecord(payload) {
    try {
      var db = await openSachetHistoryDB();
      var thumb = await compressDataUrl(payload.posterDataUrl || "", 680, 0.84);
      var rec = {
        id: String(payload.id || ("sachet_hist_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6))),
        cakeName: String(payload.cakeName || "幽兰长乐囊").slice(0, 28),
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
        var tx = db.transaction(SACHET_STORE, "readwrite");
        tx.objectStore(SACHET_STORE).put(rec);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function (ev) { reject(ev.target.error); };
      });
      return { ok: true, record: rec };
    } catch (e) {
      return { ok: false, message: String(e && e.message || e) };
    }
  }

  async function listSachetHistoryRecords() {
    try {
      var db = await openSachetHistoryDB();
      var list = await new Promise(function (resolve) {
        var tx = db.transaction(SACHET_STORE, "readonly");
        var req = tx.objectStore(SACHET_STORE).getAll();
        req.onsuccess = function () { resolve(Array.isArray(req.result) ? req.result : []); };
        req.onerror = function () { resolve([]); };
      });
      list.sort(function (a, b) { return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0); });
      return list;
    } catch (_) {
      return [];
    }
  }

  async function deleteSachetHistoryRecord(id) {
    try {
      var db = await openSachetHistoryDB();
      await new Promise(function (resolve, reject) {
        var tx = db.transaction(SACHET_STORE, "readwrite");
        tx.objectStore(SACHET_STORE).delete(String(id));
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function (ev) { reject(ev.target.error); };
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: String(e && e.message || e) };
    }
  }

  async function saveSachetToBackpack(payload) {
    var bp = global.backpackStore;
    if (!bp || (typeof bp.addItems !== "function" && typeof bp.add !== "function" && typeof bp.save !== "function" && typeof bp.put !== "function")) {
      return { ok: false, message: "未检测到「我的背包」存储模块" };
    }
    var thumb = await compressDataUrl(payload.posterDataUrl || "", 540, 0.82);
    var item = {
      id: "sachet_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      name: String(payload.cakeName || "幽兰长乐囊").slice(0, 24),
      price: 0,
      merchant: "东汉工坊 · 幽兰佩香囊坊",
      type: "古法香囊",
      category: "accessory",
      description: String(payload.cakeDesc || "幽兰佩香囊坊亲手调香刺绣的东汉古法香囊").slice(0, 120),
      image: thumb,
      acquiredAt: Date.now()
    };
    try {
      if (typeof bp.addItems === "function") await bp.addItems([item]);
      else if (typeof bp.add === "function") await bp.add(item);
      else if (typeof bp.save === "function") await bp.save(item);
      else await bp.put(item);
      return { ok: true, message: "已收入「设置 → 隐私 → 我的背包」：" + item.name };
    } catch (e) {
      return { ok: false, message: "存入背包失败：" + (e && e.message ? e.message : e) };
    }
  }

  async function sendSachetToChat(payload) {
    var rawCharId = payload && payload.charId;
    if (rawCharId === undefined || rawCharId === null || String(rawCharId).trim() === "") {
      return { ok: false, message: "请先选择一位要赠予的传讯好友" };
    }
    var chStore = global.chatHistoryStore;
    if (!chStore || (typeof chStore.saveMessage !== "function" && typeof chStore.saveMessages !== "function")) {
      return { ok: false, message: "未检测到传讯消息存储模块" };
    }

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
    var itemTitle = String(payload.cakeName || "幽兰长乐囊");
    var captionTitle = "《" + itemTitle + "》" + (payload.plaqueText ? " · " + payload.plaqueText : "") + "（东汉工坊手作纪念图）";

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
        text: "【东汉工坊 · 香囊造物】" + captionTitle + (payload.cakeDesc ? "\n" + String(payload.cakeDesc).slice(0, 100) : "")
      });
    }
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
      if (typeof chStore.saveMessage === "function") {
        for (var i = 0; i < msgsToSave.length; i++) await chStore.saveMessage(targetId, msgsToSave[i]);
      } else {
        var prevRes = typeof chStore.getMessages === "function" ? await chStore.getMessages(targetId, 1, 200) : null;
        var prevList = (prevRes && Array.isArray(prevRes.messages)) ? prevRes.messages : [];
        await chStore.saveMessages(targetId, prevList.concat(msgsToSave));
      }
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

      var previewText = "[香囊造物] 《" + itemTitle + "》";
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

      if (typeof global.dispatchEvent === "function" && typeof CustomEvent === "function") {
        global.dispatchEvent(new CustomEvent("reloadChats"));
        global.dispatchEvent(new CustomEvent("milvus-forum-share-sent", { detail: { charId: String(targetId), msg: primaryMsg } }));
        global.dispatchEvent(new CustomEvent("chatHistoryUpdated", { detail: { chatId: String(targetId) } }));
      }
      return { ok: true, message: "已成功赠予至「" + targetName + "」的传讯聊天" };
    } catch (e) {
      return { ok: false, message: "转发传讯失败：" + (e && e.message ? e.message : e) };
    }
  }

  // ==================== 5. Fullscreen Iframe Host Component ====================

  function SachetWorkshopHostModal(props) {
    var React = global.React;
    if (!React) return null;
    var h = React.createElement;
    var useEffect = React.useEffect;
    var useRef = React.useRef;

    var onClose = props && (props.onClose || props.onBack);
    var iframeRef = useRef(null);

    async function pushLightSync() {
      var win = iframeRef.current && iframeRef.current.contentWindow;
      if (!win) return;
      var roster = await getLightCharacterRoster();
      var userP = getActiveUserPersona();
      win.postMessage(
        {
          type: "WORKSHOP_CAKE_HOST_SYNC",
          payload: {
            edition: "sachet",
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
        if (win && ev.source && ev.source !== win) return;

        if (data.type === "WORKSHOP_CAKE_CLOSE" || data.type === "WORKSHOP_SACHET_CLOSE") {
          if (typeof onClose === "function") onClose();
          return;
        }
        if (data.type === "WORKSHOP_CAKE_REQUEST_SYNC" || data.type === "WORKSHOP_SACHET_REQUEST_SYNC") {
          await pushLightSync();
          return;
        }
        if (!win) return;

        var reqId = data.requestId;
        var p = data.payload || {};
        if (data.type === "WORKSHOP_CAKE_STEP_RELAY_REQUEST") {
          try {
            var res1 = await handleStepRelay(p);
            win.postMessage({ type: "WORKSHOP_CAKE_STEP_RELAY_RESPONSE", requestId: reqId, result: res1 }, "*");
          } catch (e1) {
            win.postMessage({ type: "WORKSHOP_CAKE_STEP_RELAY_RESPONSE", requestId: reqId, error: String(e1 && e1.message || e1) }, "*");
          }
        } else if (data.type === "WORKSHOP_CAKE_FULL_MAKE_REQUEST") {
          try {
            var res2 = await handleCharFullMake(p);
            win.postMessage({ type: "WORKSHOP_CAKE_FULL_MAKE_RESPONSE", requestId: reqId, result: res2 }, "*");
          } catch (e2) {
            win.postMessage({ type: "WORKSHOP_CAKE_FULL_MAKE_RESPONSE", requestId: reqId, error: String(e2 && e2.message || e2) }, "*");
          }
        } else if (data.type === "WORKSHOP_CAKE_TASTE_REQUEST") {
          try {
            var res3 = await handleCharTaste(p);
            win.postMessage({ type: "WORKSHOP_CAKE_TASTE_RESPONSE", requestId: reqId, result: res3 }, "*");
          } catch (e3) {
            win.postMessage({ type: "WORKSHOP_CAKE_TASTE_RESPONSE", requestId: reqId, error: String(e3 && e3.message || e3) }, "*");
          }
        } else if (data.type === "WORKSHOP_CAKE_FEEDBACK_REQUEST") {
          try {
            var res4 = await handleUserFeedbackReply(p);
            win.postMessage({ type: "WORKSHOP_CAKE_FEEDBACK_RESPONSE", requestId: reqId, result: res4 }, "*");
          } catch (e4) {
            win.postMessage({ type: "WORKSHOP_CAKE_FEEDBACK_RESPONSE", requestId: reqId, error: String(e4 && e4.message || e4) }, "*");
          }
        } else if (data.type === "WORKSHOP_CAKE_SAVE_BACKPACK") {
          var bpRes = await saveSachetToBackpack(p);
          win.postMessage({ type: "WORKSHOP_CAKE_ACTION_RESULT", requestId: reqId, result: bpRes }, "*");
        } else if (data.type === "WORKSHOP_CAKE_SEND_CHAT") {
          var chRes = await sendSachetToChat(p);
          win.postMessage({ type: "WORKSHOP_CAKE_ACTION_RESULT", requestId: reqId, result: chRes }, "*");
        } else if (data.type === "WORKSHOP_CAKE_SAVE_HISTORY") {
          var shRes = await saveSachetHistoryRecord(p);
          win.postMessage({ type: "WORKSHOP_CAKE_ACTION_RESULT", requestId: reqId, result: shRes }, "*");
        } else if (data.type === "WORKSHOP_CAKE_LIST_HISTORY") {
          var lhRes = await listSachetHistoryRecords();
          win.postMessage({ type: "WORKSHOP_CAKE_ACTION_RESULT", requestId: reqId, result: lhRes }, "*");
        } else if (data.type === "WORKSHOP_CAKE_DELETE_HISTORY") {
          var dhRes = await deleteSachetHistoryRecord(p && p.id);
          win.postMessage({ type: "WORKSHOP_CAKE_ACTION_RESULT", requestId: reqId, result: dhRes }, "*");
        }
      };

      global.addEventListener("message", onMessage);
      return function () { global.removeEventListener("message", onMessage); };
    }, [onClose]);

    return h(
      "div",
      {
        style: {
          position: "fixed",
          inset: 0,
          zIndex: 1020,
          background: "#FFF9EF",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          touchAction: "none"
        }
      },
      h("iframe", {
        ref: iframeRef,
        src: "./香囊制作.html",
        title: "东汉工坊 · 香囊造物（幽兰佩）",
        onLoad: function () { pushLightSync(); },
        style: {
          flex: 1,
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
          background: "#FFF9EF"
        }
      })
    );
  }

  // Auto hot-plug into 东汉工坊 ("sachet" 香囊造物 slot)
  if (global.HanWorkshopApp && typeof global.HanWorkshopApp.registerWorkshop === "function") {
    global.HanWorkshopApp.registerWorkshop("sachet", {
      title: "香囊造物",
      subtitle: "幽兰调香 · 共创",
      icon: "sachet",
      component: SachetWorkshopHostModal
    });
  }

  global.HanWorkshopSachetBridge = {
    version: "1.0.0",
    SACHET_ENUMS: SACHET_ENUMS,
    collectCharacterFullContext: collectCharacterFullContext,
    handleStepRelay: handleStepRelay,
    handleCharFullMake: handleCharFullMake,
    handleCharTaste: handleCharTaste,
    handleUserFeedbackReply: handleUserFeedbackReply,
    saveSachetToBackpack: saveSachetToBackpack,
    sendSachetToChat: sendSachetToChat
  };
})(typeof window !== "undefined" ? window : globalThis);

