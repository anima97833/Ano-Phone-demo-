/**
 * Milvus/han_workshop_drink_bridge.js
 * 「东汉工坊 · 饮品工坊（曲水流觞 · 东汉微醺酒肆）」独立宿主桥接引擎
 *
 * 严格遵循 .agents/skills/han-workshop-grafting/SKILL.md：
 * 1. 通过 window.HanWorkshopApp.registerWorkshop("drink", ...) 自动热插拔入驻，零改动 app.min.js
 * 2. 全屏托管同源 <iframe src="./调酒.html">，通过 postMessage 兼容 file:// 与 http://
 * 3. 七维上下文按需采集（角色 6 维 + 身份配置库 + 情侣空间 + 开启世界书 + 记忆胶囊 + 传讯近 15 条 + 双轨视觉）
 * 4. 完整 6 步 9 组古风调酒枚举（3 场景 / 5 酒器 / 5 挂边 / 4 冰型 / 6 捣料 / 8 物理密度分层酒液 / 10 饰品 / 5 饮具 / 3 雾气）+ 简笔画 SVG
 * 5. 独立历史库 milvus_han_workshop_drink_idb + 存入行囊(backpackStore.addItems) + 传讯画框大图转发
 */
(function (global) {
  "use strict";

  var DRINK_ENUMS = {
    scene: ["candle_pavilion", "moon_bamboo", "warm_tea_day"],
    glass: ["goblet", "yushang", "coupe", "rocks", "celadon"],
    rimCrust: ["none", "sea_salt", "osmanthus_sugar", "plum_powder", "matcha_salt"],
    iceType: ["none", "sphere", "cubes", "crushed"],
    muddle: ["mint", "green_plum", "blood_orange", "white_peach", "osmanthus", "hibiscus"],
    wine: [
      "osmanthus_honey", "hibiscus_syrup", "green_plum", "tangerine",
      "grape_wine", "butterfly_pea", "lychee_dew", "pear_spirit"
    ],
    mixStyle: ["layer", "stir", "shake"],
    inWineGarnish: [
      "lime_wheel", "orange_half", "peach_wedge", "strawberry",
      "blueberry_cluster", "mint_sprig", "osmanthus_sprig", "hibiscus_petal"
    ],
    rimGarnish: [
      "lime_wheel", "orange_half", "peach_wedge", "strawberry",
      "mint_sprig", "rosemary", "osmanthus_sprig", "hibiscus_petal", "bamboo_skewer"
    ],
    stirrer: ["none", "lotus_stem", "bamboo_chip", "brass_spoon", "glass_straw"],
    aroma: ["none", "citrus_mist", "incense_smoke"]
  };

  var DRINK_ENUM_HINT_TEXT =
    "【曲水流觞 · 东汉微醺酒肆 6 步完整合法枚举 ID（严禁编造列表外的 ID）】\n" +
    "- 氛围场景 sceneId：candle_pavilion(烛影夜轩) / moon_bamboo(月下竹岚) / warm_tea_day(曲水晴昼)\n" +
    "- 汉风酒器 glassId：goblet(夜光高脚杯·流霞郁金) / yushang(朱漆羽觞·汉代耳杯) / coupe(琉璃蝶口盏·广口闻香) / rocks(冰裂古典杯·厚底老冰) / celadon(青瓷莲花爵·温润玉盏)\n" +
    "- 杯口挂边 rimCrustId：none(素净杯口) / sea_salt(海盐霜边) / osmanthus_sugar(桂花糖霜) / plum_powder(乌梅朱砂) / matcha_salt(青茗盐边)；冰杯 chilled：true 或 false\n" +
    "- 冰型 iceTypeId：none(去冰温润) / sphere(老冰球) / cubes(凌阴方冰) / crushed(碎雪刨冰)\n" +
    "- 捣料 muddleIds（数组 1~3 种）：mint(鲜薄荷) / green_plum(脆青梅) / blood_orange(鲜橙瓣) / white_peach(白桃肉) / osmanthus(金桂瓣) / hibiscus(洛神萼)\n" +
    "- 物理密度分层酒液 pours（数组 2~4 层，每项 {\"id\":\"合法酒液ID\",\"amount\":0.18到0.30小数,\"slow\":true或false}，按密度从重到轻可自然叠出流霞渐变）：\n" +
    "  * 重·沉底：osmanthus_honey(桂花蜜露·金黄甜香) / hibiscus_syrup(洛神石榴·绛红酸甜)\n" +
    "  * 中·主体：green_plum(青梅冰酿·翠绿清冽) / tangerine(丹橘蜜酒·橙暖果香) / grape_wine(西域葡酿·紫红微醺)\n" +
    "  * 轻·浮层：butterfly_pea(蝶豆青岚·靛蓝梦幻) / lychee_dew(荔枝玉露·浅粉清甜) / pear_spirit(梨花白·清烈高酒度)\n" +
    "- 调制手法 mixStyle：layer(保留分明流霞分层) / stir(吧勺轻搅柔顺融合) / shake(摇和激起绵密酒沫)\n" +
    "- 杯中浮果 inWineGarnishes（数组 1~3 件）：lime_wheel(青柠轮片) / orange_half(血橙半月) / peach_wedge(白桃果角) / strawberry(草莓切面) / blueberry_cluster(蓝莓三颗) / mint_sprig(鲜薄荷尖) / osmanthus_sprig(金桂花枝) / hibiscus_petal(洛神干花)\n" +
    "- 杯口挂饰 rimGarnishes（数组 1~2 件）：lime_wheel / orange_half / peach_wedge / strawberry / mint_sprig / rosemary(迷迭香枝) / osmanthus_sprig / hibiscus_petal / bamboo_skewer(竹签串梅)\n" +
    "- 饮具 stirrerId：none(无饮具) / lotus_stem(翡翠荷茎) / bamboo_chip(湘妃竹筹) / brass_spoon(鎏金吧勺) / glass_straw(琉璃吸管)\n" +
    "- 喷香雾气 aromaId：none(无雾气) / citrus_mist(柑橘喷雾) / incense_smoke(沉香冷烟)";

  var AFFECTION_CRAFT_GUIDELINE =
    "【心意与古风调酒法则（非常重要）】\n" +
    "1. 请根据你的角色设定、世界书、记忆胶囊与近期传讯关系，判断你对收礼人的情感温度：\n" +
    "   - 若你是**爱慕、偏爱、深爱、宠溺或格外珍视对方**的角色：就算平日清冷、克制、毒舌或嘴硬，也会细心顾及对方酒量与酸甜喜好，精心挑选衬景酒器、滚上挂霜边、调出 3~4 层流霞渐进色、配齐浮果杯饰与饮具冷烟，绝不敷衍！\n" +
    "   - 清冷/克制/傲娇但深爱型：走【月下清冽高定】——月下竹岚或曲水晴昼 + 青瓷莲花爵/冰裂古典杯 + 海盐霜边/青茗盐边 + 老冰球 + 青梅冰酿/蝶豆青岚/梨花白清透分层 + 迷迭香/青柠/竹签串梅 + 沉香冷烟，嘴上淡淡说“少喝些”，实则每层配色与度数量得极准。\n" +
    "   - 热烈/温柔/宠溺型：走【烛影流霞华贵高定】——烛影夜轩 + 夜光高脚杯/朱漆羽觞 + 桂花糖霜/乌梅朱砂边 + 桂花蜜露/洛神石榴/丹橘蜜酒/西域葡酿 3~4 层流霞 + 血橙/金桂花枝/鎏金吧勺 + 柑橘喷雾。\n" +
    "   - 只有当你们关系确实疏离或冷战敷衍时，才选素净杯口单层简饮。\n" +
    "2. 避免单调空杯：酒液选 3 层为佳（总容量约 0.72~0.84），杯中+杯口饰品、饮具与香雾合理搭配，视觉层次感拉满。";

  var visionUnsupportedSession = false;

  function pickValid(val, list, fallback) {
    return list.indexOf(val) >= 0 ? val : fallback;
  }

  function normalizePours(rawPours) {
    var out = [];
    if (Array.isArray(rawPours)) {
      for (var i = 0; i < rawPours.length; i++) {
        var it = rawPours[i];
        var id = typeof it === "string" ? it : (it && it.id);
        if (!id || DRINK_ENUMS.wine.indexOf(id) < 0) continue;
        var amt = Math.max(0.14, Math.min(0.32, Number(it && it.amount) || 0.24));
        var slow = it && typeof it.slow === "boolean" ? it.slow : (i > 0);
        out.push({ id: id, amount: amt, slow: slow });
        if (out.length >= 4) break;
      }
    }
    if (out.length < 2) {
      return [
        { id: "osmanthus_honey", amount: 0.24, slow: true },
        { id: "green_plum", amount: 0.26, slow: true },
        { id: "butterfly_pea", amount: 0.24, slow: true }
      ];
    }
    var sum = out.reduce(function (s, x) { return s + x.amount; }, 0);
    if (sum > 0.86 || sum < 0.58) {
      var target = 0.76;
      out.forEach(function (x) {
        x.amount = Math.round((x.amount / sum) * target * 100) / 100;
      });
    }
    return out;
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
    } catch (_) { }
    if (rawList.length === 0 && Array.isArray(global.__T8_LIVE_CHATS)) rawList = global.__T8_LIVE_CHATS;
    if (rawList.length === 0) {
      try {
        var localList = JSON.parse((global.localStorage && global.localStorage.getItem("t8_chat_list")) || "[]");
        if (Array.isArray(localList)) rawList = localList;
      } catch (_) { }
    }

    var charSettings = {};
    try {
      charSettings = JSON.parse((global.localStorage && global.localStorage.getItem("character_settings")) || "{}");
    } catch (_) { }

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
    } catch (_) { }
    return { name: "广陵王", identity: "", personality: "", background: "" };
  }

  async function getEnabledWorldBookText() {
    try {
      if (typeof global.getWorldBookContext === "function") {
        var ctx = await global.getWorldBookContext();
        if (ctx && String(ctx).trim()) return String(ctx).trim().slice(0, 1500);
      }
    } catch (_) { }
    try {
      if (global.worldBookStore && typeof global.worldBookStore.getData === "function") {
        var wb = await global.worldBookStore.getData();
        var books = Array.isArray(wb && wb.books) ? wb.books : [];
        var active = books.filter(function (b) { return b && b.enable !== false && b.content && String(b.content).trim(); });
        if (active.length > 0) {
          return active.map(function (b) { return "【" + (b.title || "世界书") + "】" + String(b.content).trim().slice(0, 260); }).join("\n").slice(0, 1500);
        }
      }
    } catch (_) { }
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
    } catch (_) { }

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
    } catch (_) { }

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
    } catch (_) { }

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

  async function callDrinkLLMWithVisionFallback(sysPrompt, userPrompt, imageDataUrl) {
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
    try { return JSON.parse(cleaned); } catch (_) { }
    var s = cleaned.indexOf("{");
    var e = cleaned.lastIndexOf("}");
    if (s >= 0 && e > s) {
      try { return JSON.parse(cleaned.slice(s, e + 1).replace(/,\s*([}\]])/g, "$1")); } catch (_) { }
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

  function buildFallbackDrinkSketchSvg(charName) {
    var safeName = String(charName || "名士").replace(/[<>&"']/g, "").slice(0, 4);
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="70" viewBox="0 0 320 70">' +
      '<path d="M18 52 Q68 32 128 38 Q154 40 172 24" fill="none" stroke="#634F43" stroke-width="2.2" stroke-linecap="round"/>' +
      '<circle cx="116" cy="30" r="3.4" fill="#E4BD72"/><circle cx="124" cy="26" r="3.2" fill="#C89B4B"/>' +
      '<circle cx="132" cy="32" r="3.4" fill="#E4BD72"/><circle cx="144" cy="28" r="3" fill="#C89B4B"/>' +
      '<rect x="184" y="18" width="24" height="24" rx="4" fill="none" stroke="#B84336" stroke-width="1.8"/>' +
      '<text x="196" y="34" text-anchor="middle" font-family="serif" font-size="12" font-weight="bold" fill="#B84336">觞</text>' +
      '<text x="224" y="45" font-family="serif" font-size="20" font-weight="bold" fill="#2B211C">' + safeName + '</text>' +
      '<path d="M218 54 Q260 50 304 56" fill="none" stroke="#C89B4B" stroke-width="1.6" stroke-linecap="round"/>' +
      '</svg>'
    );
  }

  // ==================== 3. Four Drink AI Orchestration Actions (6-Step Craft) ====================

  async function handleStepRelay(payload) {
    var ctx = await collectCharacterFullContext(payload.charId);
    var E = DRINK_ENUMS;
    var stepIndex = Math.max(0, Math.min(5, Math.floor(Number(payload.stepIndex) || 0)));
    var stepNames = ["择器挂杯", "落冰捣料", "倾壶分层", "摇和起沫", "雅趣点睛", "题签封酿"];
    var visualText = String(payload.visualSnapshotText || payload.cakeSummary || "烛影摇红的东汉酒肆吧台");
    var relayNotes = Array.isArray(payload.relayHistory) ? payload.relayHistory.slice(-4).join("\n") : "";

    var stepSchemaByIdx = {
      0: '{"sceneId":"candle_pavilion/moon_bamboo/warm_tea_day","glassId":"goblet/yushang/coupe/rocks/celadon","rimCrustId":"合法挂边ID","chilled":true,"spokenLine":"1~2句贴合人设边挑酒器挂边边说的话","moodTag":"4字状态"}',
      1: '{"iceTypeId":"none/sphere/cubes/crushed","muddleIds":["mint","green_plum"],"spokenLine":"1~2句贴合人设边落冰捣料边说的话","moodTag":"4字状态"}',
      2: '{"pours":[{"id":"osmanthus_honey","amount":0.24,"slow":true},{"id":"green_plum","amount":0.26,"slow":true},{"id":"butterfly_pea","amount":0.24,"slow":true}],"spokenLine":"1~2句贴合人设说明为何配这几层酒液的话","moodTag":"4字状态"}',
      3: '{"mixStyle":"layer或stir或shake","spokenLine":"1~2句贴合人设边摇和/轻搅/留层边说的话","moodTag":"4字状态"}',
      4: '{"inWineGarnishes":["lime_wheel","osmanthus_sprig"],"rimGarnishes":["orange_half"],"stirrerId":"合法饮具ID","aromaId":"none/citrus_mist/incense_smoke","glassSketchTitle":"可选：若想在杯身琉璃上微雕一幅简笔画填2~6字画题，不画留空","glassSketchSvg":"可选：若画杯身微雕简笔画则输出透明底标准<svg viewBox=\\"0 0 180 180\\">线稿(用#FFF4D6/#E4BD72轻柔金白细线stroke-width=3，严禁白色底框，不画留空)","spokenLine":"1~2句贴合人设点睛喷香时说的话","moodTag":"4字状态"}',
      5: '{"drinkTitle":"酒名(<=10字)","cardTo":"称呼(<=14字)","cardNote":"赠酒题词(20~55字)","cardSketchTitle":"必填：你在酒签签名区手绘的花押/桂枝小画名(2~6字)","cardSketchSvg":"必填：透明底标准<svg viewBox=\\"0 0 320 70\\">矢量花押涂鸦(用#2B211C/#B84336/#C89B4B墨印色，严禁白色底框)","spokenLine":"1~2句贴合人设题签敬酒时的话","moodTag":"4字状态"}'
    };

    var sysPrompt =
      "你正在扮演传讯名士「" + ctx.charObj.name + "」，正在「东汉工坊 · 饮品工坊（曲水流觞酒肆）」里与「" + ctx.userPersona.name + "」玩**你一步、我一步轮流接力调制一杯古风微醺佳酿**。\n" +
      "现在轮到你亲自上手操作【第 " + (stepIndex + 1) + "/6 步：" + stepNames[stepIndex] + "】！\n\n" +
      "【你的 6 项完整角色配置（最高遵从：审美、酒趣与口吻必须 100% 符合人设）】\n" + ctx.charProfileText + "\n\n" +
      "【" + ctx.userPersona.name + " 的身份设定】\n" + ctx.userPersonaText + "\n\n" +
      (ctx.coupleBondHint ? "【亲密关系提示】\n" + ctx.coupleBondHint + "\n\n" : "") +
      (ctx.worldBookText ? "【已开启的世界书设定】\n" + ctx.worldBookText + "\n\n" : "") +
      (ctx.memoryCapsuleText ? "【传讯 · 记忆胶囊中的共同回忆（自然参考你们的约定、口味与过往细节）】\n" + ctx.memoryCapsuleText + "\n\n" : "") +
      (ctx.recentChatText ? "【你们在传讯中近期的聊天上下文（自然呼应彼此近况或梗）】\n" + ctx.recentChatText + "\n\n" : "") +
      AFFECTION_CRAFT_GUIDELINE + "\n\n" +
      DRINK_ENUM_HINT_TEXT + "\n\n" +
      "请结合当前杯中酒液进度与你的性格心意，在 `spokenLine` 里自然说出你**为什么选这些酒器/冰料/酒液/手法/饰品或酒名**，严格输出合法 JSON（禁止多余说明）：\n" +
      stepSchemaByIdx[stepIndex];

    var userPrompt =
      "【当前调酒进度与外观】\n" + visualText +
      (relayNotes ? "\n\n【前几步互动记录】\n" + relayNotes : "") +
      "\n\n现在轮到你完成【" + stepNames[stepIndex] + "】，请给出走心的调酒决策与此刻台词。";

    var llmRes = await callDrinkLLMWithVisionFallback(sysPrompt, userPrompt, payload.imageDataUrl);
    var parsed = extractJsonSafe(llmRes.text) || {};

    var stepAction = {};
    if (stepIndex === 0) {
      stepAction = {
        sceneId: pickValid(parsed.sceneId, E.scene, "candle_pavilion"),
        glassId: pickValid(parsed.glassId, E.glass, "goblet"),
        rimCrustId: pickValid(parsed.rimCrustId, E.rimCrust, "osmanthus_sugar"),
        chilled: parsed.chilled !== false
      };
    } else if (stepIndex === 1) {
      var rawMuddles = Array.isArray(parsed.muddleIds)
        ? parsed.muddleIds.filter(function (m) { return E.muddle.indexOf(m) >= 0; }).slice(0, 3)
        : [];
      if (rawMuddles.length === 0) rawMuddles = ["mint", "osmanthus"];
      stepAction = {
        iceTypeId: pickValid(parsed.iceTypeId, E.iceType, "sphere"),
        muddleIds: rawMuddles
      };
    } else if (stepIndex === 2) {
      stepAction = {
        pours: normalizePours(parsed.pours)
      };
    } else if (stepIndex === 3) {
      stepAction = {
        mixStyle: pickValid(parsed.mixStyle, E.mixStyle, "layer")
      };
    } else if (stepIndex === 4) {
      var inG = Array.isArray(parsed.inWineGarnishes)
        ? parsed.inWineGarnishes.filter(function (g) { return E.inWineGarnish.indexOf(g) >= 0; }).slice(0, 3)
        : [];
      if (inG.length === 0) inG = ["osmanthus_sprig", "lime_wheel"];
      var rimG = Array.isArray(parsed.rimGarnishes)
        ? parsed.rimGarnishes.filter(function (g) { return E.rimGarnish.indexOf(g) >= 0; }).slice(0, 2)
        : [];
      if (rimG.length === 0) rimG = ["orange_half"];
      stepAction = {
        inWineGarnishes: inG,
        rimGarnishes: rimG,
        stirrerId: pickValid(parsed.stirrerId, E.stirrer, "brass_spoon"),
        aromaId: pickValid(parsed.aromaId, E.aroma, "citrus_mist"),
        glassSketchTitle: String(parsed.glassSketchTitle || "").trim().slice(0, 12),
        glassSketchSvg: sanitizeSketchSvg(parsed.glassSketchSvg, 180, 180)
      };
    } else if (stepIndex === 5) {
      stepAction = {
        drinkTitle: String(parsed.drinkTitle || "月下流霞").slice(0, 12),
        cardTo: String(parsed.cardTo || ("致：" + ctx.userPersona.name)).slice(0, 18),
        cardNote: String(parsed.cardNote || "晚风微凉，共饮此盏流霞，愿岁岁常欢愉。").slice(0, 60),
        cardSketchTitle: String(parsed.cardSketchTitle || "桂枝觞印").trim().slice(0, 12),
        cardSketchSvg: sanitizeSketchSvg(parsed.cardSketchSvg, 320, 70) || buildFallbackDrinkSketchSvg(ctx.charObj.name)
      };
    }

    return {
      charName: ctx.charObj.name,
      stepIndex: stepIndex,
      stepAction: stepAction,
      spokenLine: String(parsed.spokenLine || "「这一步交给我来斟酌分寸罢。」").trim(),
      moodTag: String(parsed.moodTag || "雅兴调酿").slice(0, 8),
      usedVision: llmRes.usedVision
    };
  }

  async function handleCharFullMake(payload) {
    var ctx = await collectCharacterFullContext(payload.charId);
    var E = DRINK_ENUMS;
    var sysPrompt =
      "你正在扮演传讯名士「" + ctx.charObj.name + "」，正在「东汉工坊 · 饮品工坊（曲水流觞酒肆）」里**亲自从头到尾为「" + ctx.userPersona.name + "」调制一杯专属古风微醺佳酿**。\n\n" +
      "【你的 6 项完整角色配置（最高遵从：酒趣、风味偏好、酒名题词与口吻必须 100% 符合人设）】\n" + ctx.charProfileText + "\n\n" +
      "【品酒人（" + ctx.userPersona.name + "）身份设定】\n" + ctx.userPersonaText + "\n\n" +
      (ctx.coupleBondHint ? "【亲密关系提示】\n" + ctx.coupleBondHint + "\n\n" : "") +
      (ctx.worldBookText ? "【已开启的世界书设定】\n" + ctx.worldBookText + "\n\n" : "") +
      (ctx.memoryCapsuleText ? "【传讯 · 记忆胶囊中的共同回忆（自然融入你们的回忆、口味与私密约定）】\n" + ctx.memoryCapsuleText + "\n\n" : "") +
      (ctx.recentChatText ? "【你们在传讯中近期的聊天上下文（自然融入你们的近况与梗）】\n" + ctx.recentChatText + "\n\n" : "") +
      AFFECTION_CRAFT_GUIDELINE + "\n\n" +
      DRINK_ENUM_HINT_TEXT + "\n\n" +
      "请一次性构思完整 6 步调酒高定方案，并在 `stepLines` 的 6 句里**用你的专属口吻自然交代每一步为什么选这个场景酒器、冰型捣料、这几层酒液、手法、点睛饰品烟雾与酒名花押**，严格输出合法 JSON（禁止多余说明）：\n" +
      '{\n' +
      '  "sceneId": "合法场景ID", "glassId": "合法酒器ID", "rimCrustId": "合法挂边ID", "chilled": true,\n' +
      '  "iceTypeId": "合法冰型ID", "muddleIds": ["mint", "osmanthus"],\n' +
      '  "pours": [{"id":"osmanthus_honey","amount":0.24,"slow":true},{"id":"tangerine","amount":0.26,"slow":true},{"id":"butterfly_pea","amount":0.24,"slow":true}],\n' +
      '  "mixStyle": "layer或stir或shake",\n' +
      '  "inWineGarnishes": ["osmanthus_sprig", "lime_wheel"], "rimGarnishes": ["orange_half"], "stirrerId": "合法饮具ID", "aromaId": "none/citrus_mist/incense_smoke",\n' +
      '  "glassSketchTitle": "可选：若想在杯身琉璃微雕简笔画填2~6字画题；不画留空",\n' +
      '  "glassSketchSvg": "可选：若画杯身微雕简笔画则输出透明底标准<svg viewBox=\\"0 0 180 180\\">线稿(用#FFF4D6/#E4BD72轻柔金白细线stroke-width=3，严禁白色底框)；不画留空",\n' +
      '  "drinkTitle": "酒名(<=10字)", "cardTo": "称呼(<=14字)", "cardNote": "20~55字赠酒题词",\n' +
      '  "cardSketchTitle": "必填：你在酒签签名区随手画的花押/桂枝小画名(2~6字)",\n' +
      '  "cardSketchSvg": "必填：透明底标准<svg viewBox=\\"0 0 320 70\\">矢量花押涂鸦(用#2B211C/#B84336/#C89B4B墨印色，严禁白色底框)",\n' +
      '  "stepLines": ["第1步择器挂杯心意(20~50字)", "第2步落冰捣料心意(20~50字)", "第3步倾壶分层配酒心意(25~55字)", "第4步摇和/搅匀/留层手法心意(18~45字)", "第5步雅趣点睛与冷烟心意(25~55字)", "第6步题签敬酒与花押心意(25~55字)"],\n' +
      '  "introNote": "将酒盏推至对方面前时的一句开场白"\n' +
      '}';

    var llmRes = await callDrinkLLMWithVisionFallback(
      sysPrompt,
      "请为 " + ctx.userPersona.name + " 定制并亲手调制一杯既贴合你审美与酒趣、又饱含心意的 6 步东汉微醺特调。",
      ""
    );
    var p = extractJsonSafe(llmRes.text) || {};

    var muddles = Array.isArray(p.muddleIds)
      ? p.muddleIds.filter(function (m) { return E.muddle.indexOf(m) >= 0; }).slice(0, 3)
      : [];
    if (muddles.length === 0) muddles = ["mint", "osmanthus"];

    var inG = Array.isArray(p.inWineGarnishes)
      ? p.inWineGarnishes.filter(function (g) { return E.inWineGarnish.indexOf(g) >= 0; }).slice(0, 3)
      : [];
    if (inG.length === 0) inG = ["osmanthus_sprig", "lime_wheel"];

    var rimG = Array.isArray(p.rimGarnishes)
      ? p.rimGarnishes.filter(function (g) { return E.rimGarnish.indexOf(g) >= 0; }).slice(0, 2)
      : [];
    if (rimG.length === 0) rimG = ["orange_half"];

    var defaultLines = [
      "挑了衬今夜烛影的酒器，杯口细细滚上一圈霜边，先冰镇好。",
      "落入冰块，再把鲜果香草轻捣出汁，先垫一层清香底韵。",
      "按轻重缓急依次倾入几重酒液，瞧这流霞层次多好看。",
      "收手稳住这抹渐变，让果香与酒气慢慢相融。",
      "挂上鲜果花枝、插好饮具，再熏一缕幽香点睛。",
      "酒名与题签花押都落好了——来，趁冰意正好，先尝一口罢。"
    ];
    var lines = Array.isArray(p.stepLines) && p.stepLines.length >= 6
      ? p.stepLines.slice(0, 6).map(function (s, i) { return String(s || defaultLines[i]).trim(); })
      : defaultLines;

    return {
      charName: ctx.charObj.name,
      plan: {
        sceneId: pickValid(p.sceneId, E.scene, "candle_pavilion"),
        glassId: pickValid(p.glassId, E.glass, "goblet"),
        rimCrustId: pickValid(p.rimCrustId, E.rimCrust, "osmanthus_sugar"),
        chilled: p.chilled !== false,
        iceTypeId: pickValid(p.iceTypeId, E.iceType, "sphere"),
        muddleIds: muddles,
        pours: normalizePours(p.pours),
        mixStyle: pickValid(p.mixStyle, E.mixStyle, "layer"),
        inWineGarnishes: inG,
        rimGarnishes: rimG,
        stirrerId: pickValid(p.stirrerId, E.stirrer, "brass_spoon"),
        aromaId: pickValid(p.aromaId, E.aroma, "citrus_mist"),
        glassSketchTitle: String(p.glassSketchTitle || "").trim().slice(0, 12),
        glassSketchSvg: sanitizeSketchSvg(p.glassSketchSvg, 180, 180),
        drinkTitle: String(p.drinkTitle || "月下流霞").slice(0, 12),
        cardTo: String(p.cardTo || ("致：" + ctx.userPersona.name)).slice(0, 18),
        cardNote: String(p.cardNote || "晚风微凉，共饮此盏流霞，愿岁岁常欢愉。").slice(0, 60),
        cardSketchTitle: String(p.cardSketchTitle || "桂枝觞印").trim().slice(0, 12),
        cardSketchSvg: sanitizeSketchSvg(p.cardSketchSvg, 320, 70) || buildFallbackDrinkSketchSvg(ctx.charObj.name)
      },
      stepLines: lines,
      introNote: String(p.introNote || lines[5]).trim()
    };
  }

  async function handleCharTaste(payload) {
    var ctx = await collectCharacterFullContext(payload.charId);
    var visualText = String(payload.visualSnapshotText || payload.cakeSummary || "一杯古风微醺特调");
    var modeNote = payload.mode === "relay_coop"
      ? "这是你与「" + ctx.userPersona.name + "」你一步我一步共同接力调制完成的特调佳酿。"
      : "这是「" + ctx.userPersona.name + "」亲手为你调制并推到你面前的特调佳酿。";

    var sysPrompt =
      "你正在扮演传讯名士「" + ctx.charObj.name + "」，此刻正举杯端详并浅酌眼前这盏特调佳酿。\n" +
      modeNote + "\n\n" +
      "【你的 6 项完整角色配置（最高遵从：必须用你本人的说话风格、酒量性情与细节癖好来品评）】\n" + ctx.charProfileText + "\n\n" +
      "【" + ctx.userPersona.name + " 的身份设定】\n" + ctx.userPersonaText + "\n\n" +
      (ctx.worldBookText ? "【已开启的世界书设定】\n" + ctx.worldBookText + "\n\n" : "") +
      (ctx.memoryCapsuleText ? "【传讯 · 记忆胶囊中的共同回忆】\n" + ctx.memoryCapsuleText + "\n\n" : "") +
      (ctx.recentChatText ? "【你们在传讯中近期的聊天上下文（自然呼应彼此关系与近期聊天细节）】\n" + ctx.recentChatText + "\n\n" : "") +
      "【要求】\n" +
      "1. 必须真实点评到具体的酒器、挂边、酒液色泽与酸甜烈度风味、杯饰香雾，以及酒名或题词！\n" +
      "2. 严禁千篇一律的“真好喝谢谢你”套话，要展现鲜明的人设感（比如挑剔酒度偏烈/偏甜却一饮而尽、轻晃冰球听响、对酒名嘴硬耳红等）。\n" +
      "3. 严格输出合法 JSON：\n" +
      '{"reactionTag":"4~8字神态短签","comment":"70~130字画面感举杯浅酌动作与风味描写","dialogue":"1~2句贴合角色口吻的直白台词"}';

    var userPrompt = "【你眼前看到的特调完整酒谱与外观】\n" + visualText + "\n\n请以「" + ctx.charObj.name + "」的身份浅酌品评并给出真实回函。";
    var llmRes = await callDrinkLLMWithVisionFallback(sysPrompt, userPrompt, payload.imageDataUrl);
    var p = extractJsonSafe(llmRes.text) || {};

    return {
      charName: ctx.charObj.name,
      reactionTag: String(p.reactionTag || "举杯细酌").slice(0, 12),
      comment: String(p.comment || (ctx.charObj.name + "执杯轻晃，看杯中流霞与冰球折射出暖色烛影，浅啜一口后眉梢微挑，似有几分意外之喜。")).trim(),
      dialogue: String(p.dialogue || "「入口清冽回甘，倒比寻常酒肆会调些……再替我满上一盏罢。」").trim(),
      usedVision: llmRes.usedVision
    };
  }

  async function handleUserFeedbackReply(payload) {
    var ctx = await collectCharacterFullContext(payload.charId);
    var userFeedback = String(payload.userFeedback || "").trim().slice(0, 160);
    var visualText = String(payload.visualSnapshotText || payload.cakeSummary || "");

    var sysPrompt =
      "你正在扮演传讯名士「" + ctx.charObj.name + "」。刚才你亲手为「" + ctx.userPersona.name + "」调制了一杯古风微醺特调，对方浅酌后对你给出了一句真实反馈。\n\n" +
      "【你的 6 项完整角色配置】\n" + ctx.charProfileText + "\n\n" +
      "【" + ctx.userPersona.name + " 的身份设定】\n" + ctx.userPersonaText + "\n\n" +
      (ctx.worldBookText ? "【已开启的世界书设定】\n" + ctx.worldBookText + "\n\n" : "") +
      (ctx.memoryCapsuleText ? "【传讯 · 记忆胶囊中的共同回忆】\n" + ctx.memoryCapsuleText + "\n\n" : "") +
      (ctx.recentChatText ? "【近期传讯上下文】\n" + ctx.recentChatText + "\n\n" : "") +
      "请严格输出合法 JSON：\n" +
      '{"reactionTag":"4~8字神态短签","comment":"45~90字听到评价后的微表情与举动","dialogue":"1~2句贴合人设的回应台词"}';

    var userPrompt =
      "【你调制的特调】\n" + visualText +
      "\n\n【" + ctx.userPersona.name + " 尝完后对你说】：「" + (userFeedback || "这杯真好喝！") + "」";

    var llmRes = await callDrinkLLMWithVisionFallback(sysPrompt, userPrompt, "");
    var p = extractJsonSafe(llmRes.text) || {};

    return {
      charName: ctx.charObj.name,
      reactionTag: String(p.reactionTag || "闻言微哂").slice(0, 12),
      comment: String(p.comment || (ctx.charObj.name + "听罢唇角微扬，执壶替你添了半盏冰露，目光在烛火下格外柔和。")).trim(),
      dialogue: String(p.dialogue || "「合你口味便好，只是莫贪杯，醉了我可不管扶你回去。」").trim()
    };
  }

  // ==================== 4. Independent Drink History IndexedDB & Phone Integration ====================

  var DRINK_DB_NAME = "milvus_han_workshop_drink_idb";
  var DRINK_DB_VER = 1;
  var DRINK_STORE = "drinks";
  var dbPromise = null;

  function openDrinkHistoryDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (typeof indexedDB === "undefined") { reject(new Error("不支持 IndexedDB")); return; }
      var req = indexedDB.open(DRINK_DB_NAME, DRINK_DB_VER);
      req.onupgradeneeded = function (ev) {
        var db = ev.target.result;
        if (!db.objectStoreNames.contains(DRINK_STORE)) {
          db.createObjectStore(DRINK_STORE, { keyPath: "id" });
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

  async function saveDrinkHistoryRecord(payload) {
    try {
      var db = await openDrinkHistoryDB();
      var thumb = await compressDataUrl(payload.posterDataUrl || "", 680, 0.84);
      var rec = {
        id: String(payload.id || ("drink_hist_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6))),
        cakeName: String(payload.cakeName || "月下流霞").slice(0, 28),
        cakeDesc: String(payload.cakeDesc || "").slice(0, 160),
        plaqueText: String(payload.plaqueText || "饮胜").slice(0, 20),
        mode: String(payload.mode || "user_make_char_eat"),
        charId: String(payload.charId || ""),
        charName: String(payload.charName || ""),
        posterDataUrl: thumb,
        makingNotes: Array.isArray(payload.makingNotes) ? payload.makingNotes.slice(0, 8) : [],
        review: payload.review || null,
        createdAt: Number(payload.createdAt) || Date.now()
      };
      await new Promise(function (resolve, reject) {
        var tx = db.transaction(DRINK_STORE, "readwrite");
        tx.objectStore(DRINK_STORE).put(rec);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function (ev) { reject(ev.target.error); };
      });
      return { ok: true, record: rec };
    } catch (e) {
      return { ok: false, message: String(e && e.message || e) };
    }
  }

  async function listDrinkHistoryRecords() {
    try {
      var db = await openDrinkHistoryDB();
      var list = await new Promise(function (resolve) {
        var tx = db.transaction(DRINK_STORE, "readonly");
        var req = tx.objectStore(DRINK_STORE).getAll();
        req.onsuccess = function () { resolve(Array.isArray(req.result) ? req.result : []); };
        req.onerror = function () { resolve([]); };
      });
      list.sort(function (a, b) { return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0); });
      return list;
    } catch (_) {
      return [];
    }
  }

  async function deleteDrinkHistoryRecord(id) {
    try {
      var db = await openDrinkHistoryDB();
      await new Promise(function (resolve, reject) {
        var tx = db.transaction(DRINK_STORE, "readwrite");
        tx.objectStore(DRINK_STORE).delete(String(id));
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function (ev) { reject(ev.target.error); };
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: String(e && e.message || e) };
    }
  }

  async function saveDrinkToBackpack(payload) {
    var bp = global.backpackStore;
    if (!bp || (typeof bp.addItems !== "function" && typeof bp.add !== "function" && typeof bp.save !== "function" && typeof bp.put !== "function")) {
      return { ok: false, message: "未检测到「我的背包」存储模块" };
    }
    var thumb = await compressDataUrl(payload.posterDataUrl || "", 540, 0.82);
    var item = {
      id: "drink_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      name: String(payload.cakeName || "月下流霞").slice(0, 24),
      price: 0,
      merchant: "东汉工坊 · 曲水流觞酒肆",
      type: "古风特调",
      category: "food",
      description: String(payload.cakeDesc || "曲水流觞酒肆亲手调制的东汉微醺特调").slice(0, 120),
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

  async function sendDrinkToChat(payload) {
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
    } catch (_) { }
    if (!targetChar) {
      try {
        var lsChars = JSON.parse((global.localStorage && global.localStorage.getItem("t8_chat_list")) || "[]");
        if (Array.isArray(lsChars)) {
          targetChar = lsChars.find(function (c) {
            return c && (String(c.id) === String(rawCharId) || (payload.charName && String(c.name) === String(payload.charName)));
          }) || null;
        }
      } catch (_) { }
    }

    var targetId = targetChar && targetChar.id !== undefined ? targetChar.id : rawCharId;
    var targetName = (targetChar && (targetChar.name || targetChar.nickname)) || payload.charName || "好友";

    var thumb = await compressDataUrl(payload.posterDataUrl || "", 640, 0.84);
    var now = Date.now();
    var d = new Date(now);
    var timeStr = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    var userNote = String(payload.forwardNote || "").trim().slice(0, 120);
    var itemTitle = String(payload.cakeName || "月下流霞");
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
        text: "【东汉工坊 · 饮品工坊】" + captionTitle + (payload.cakeDesc ? "\n" + String(payload.cakeDesc).slice(0, 100) : "")
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
      } catch (_) { }

      var previewText = "[饮品工坊] 《" + itemTitle + "》";
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
      } catch (_) { }
      try {
        if (targetChar && global.chatCharacterStore && typeof global.chatCharacterStore.save === "function") {
          targetChar.lastMessage = previewText;
          targetChar.lastTime = timeStr;
          targetChar.time = timeStr;
          targetChar.updatedAt = now;
          await global.chatCharacterStore.save(targetChar);
        }
      } catch (_) { }

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

  function DrinkWorkshopHostModal(props) {
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
            edition: "drink",
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

        if (data.type === "WORKSHOP_CAKE_CLOSE" || data.type === "WORKSHOP_DRINK_CLOSE") {
          if (typeof onClose === "function") onClose();
          return;
        }
        if (data.type === "WORKSHOP_CAKE_REQUEST_SYNC" || data.type === "WORKSHOP_DRINK_REQUEST_SYNC") {
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
          var bpRes = await saveDrinkToBackpack(p);
          win.postMessage({ type: "WORKSHOP_CAKE_ACTION_RESULT", requestId: reqId, result: bpRes }, "*");
        } else if (data.type === "WORKSHOP_CAKE_SEND_CHAT") {
          var chRes = await sendDrinkToChat(p);
          win.postMessage({ type: "WORKSHOP_CAKE_ACTION_RESULT", requestId: reqId, result: chRes }, "*");
        } else if (data.type === "WORKSHOP_CAKE_SAVE_HISTORY") {
          var shRes = await saveDrinkHistoryRecord(p);
          win.postMessage({ type: "WORKSHOP_CAKE_ACTION_RESULT", requestId: reqId, result: shRes }, "*");
        } else if (data.type === "WORKSHOP_CAKE_LIST_HISTORY") {
          var lhRes = await listDrinkHistoryRecords();
          win.postMessage({ type: "WORKSHOP_CAKE_ACTION_RESULT", requestId: reqId, result: lhRes }, "*");
        } else if (data.type === "WORKSHOP_CAKE_DELETE_HISTORY") {
          var dhRes = await deleteDrinkHistoryRecord(p && p.id);
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
          background: "#1B2027",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          touchAction: "none"
        }
      },
      h("iframe", {
        ref: iframeRef,
        src: "./调酒.html",
        title: "东汉工坊 · 饮品工坊（曲水流觞）",
        onLoad: function () { pushLightSync(); },
        style: {
          flex: 1,
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
          background: "#1B2027"
        }
      })
    );
  }

  // Auto hot-plug into 东汉工坊 ("drink" 饮品工坊 slot)
  if (global.HanWorkshopApp && typeof global.HanWorkshopApp.registerWorkshop === "function") {
    global.HanWorkshopApp.registerWorkshop("drink", {
      title: "饮品工坊",
      subtitle: "曲水调酿 · 共创",
      icon: "drink",
      component: DrinkWorkshopHostModal
    });
  }

  global.HanWorkshopDrinkBridge = {
    version: "1.0.0",
    DRINK_ENUMS: DRINK_ENUMS,
    collectCharacterFullContext: collectCharacterFullContext,
    handleStepRelay: handleStepRelay,
    handleCharFullMake: handleCharFullMake,
    handleCharTaste: handleCharTaste,
    handleUserFeedbackReply: handleUserFeedbackReply,
    saveDrinkToBackpack: saveDrinkToBackpack,
    sendDrinkToChat: sendDrinkToChat
  };
})(typeof window !== "undefined" ? window : globalThis);

