/**
 * Milvus/han_workshop_porcelain_bridge.js
 * 「东汉工坊 · 器物绘彩（寻窑记 · 古法瓷器施釉与窑变工坊）」独立宿主桥接引擎
 *
 * 严格遵循 .agents/skills/han-workshop-grafting/SKILL.md：
 * 1. 通过 window.HanWorkshopApp.registerWorkshop("lacquer", ...) 自动热插拔入驻，零改动 app.min.js
 * 2. 全屏托管同源 <iframe src="./制造瓷器.html">，通过 postMessage 兼容 file:// 与 http://
 * 3. 七维上下文按需采集（角色 6 维 + 身份配置库 + 情侣空间 + 开启世界书 + 记忆胶囊 + 传讯近 15 条 + 双轨视觉）
 * 4. 完整瓷器枚举（4 器型 / 4 素胎 / 6 名窑釉色 / 5 流釉 / 双层暗刻 / 11 贴花金彩 / 3 撒料 / 3 窑火）+ 简笔画 SVG
 * 5. 独立历史库 milvus_han_workshop_porcelain_idb + 存入行囊(backpackStore.addItems) + 传讯画框大图转发
 */
(function (global) {
  "use strict";

  var PORCELAIN_ENUMS = {
    vessel: ["lacquer_ear", "bronze_jian", "celadon_bowl", "jade_lotus"],
    sponge: ["pure_snow", "milk_curd", "green_plum", "hibiscus"],
    frostingColor: ["snow_curd", "grape_wine", "smoked_plum", "cliff_honey", "cane_juice", "perilla"],
    glazeStyle: ["solid", "ombre", "marble"],
    dripGlaze: ["none", "osmanthus_M", "plum_syrup", "brown_sugar", "milk_dew", "bamboo_dew"],
    pipingNozzle: ["rosette", "shell", "pearl", "blossom"],
    pipingColor: ["p_white", "p_pink", "p_yellow", "p_green", "p_blue", "p_choco"],
    pipingPattern: ["double_band", "shoulder", "foot", "minimal"],
    decor: [
      "straw_whole", "straw_half", "blueberry", "fig_slice", "mango_wedge",
      "cherry", "mint_leaf", "macaron_pink", "macaron_green", "choco_sail", "meringue"
    ],
    sprinkle: ["sprinkle_pearl", "sprinkle_gold", "sprinkle_sugar"],
    sprinkleDensity: ["none", "light", "medium", "rich"],
    kilnType: ["oxidizing", "reducing", "wood_ash"]
  };

  var PORCELAIN_ENUM_HINT_TEXT =
    "【寻窑记 · 古法瓷器工坊完整合法枚举 ID（严禁编造列表外的 ID）】\n" +
    "- 瓷器形制 vesselId：lacquer_ear(梅瓶·清挺秀) / bronze_jian(茶碗·静开阔) / celadon_bowl(小罐·拙饱满) / jade_lotus(玉壶春·婉流丽)\n" +
    "- 素胎泥料 spongeId：pure_snow(高岭白胎) / milk_curd(汝州香灰胎) / green_plum(龙泉青灰胎) / hibiscus(建阳紫金胎)\n" +
    "- 名窑主釉色 frostingColorId & 可选窑变副釉色 secondaryFrostingColorId（none 或以下6色）：snow_curd(天青) / grape_wine(月白) / smoked_plum(窑变紫) / cliff_honey(铜红) / cane_juice(梅子青) / perilla(建盏乌金)\n" +
    "- 施釉晕染技法 glazeStyle：solid(单色清釉) / ombre(双色上下渐变窑变，需配副釉色) / marble(流霞交融窑变，需配副釉色)\n" +
    "- 口沿厚积流釉 dripGlazeId：none(无厚积流釉) / osmanthus_M(钧紫流霞釉) / plum_syrup(铜红垂泪釉) / brown_sugar(苏麻离青花) / milk_dew(月白堆脂釉) / bamboo_dew(铁锈斑彩料)\n" +
    "- 暗刻浮雕纹样 pipingNozzleId：rosette(卷云如意纹) / shell(仰覆莲瓣纹) / pearl(联珠乳钉纹) / blossom(折枝梅花纹)\n" +
    "- 暗刻彩料主色 pipingColorId & 可选撞彩 secondaryPipingColorId（none 或以下6色）：p_white(影青暗刻) / p_pink(胭脂红彩) / p_yellow(本金描金) / p_green(秘色青刻) / p_blue(青花钴料) / p_choco(磁州铁绘)\n" +
    "- 暗刻布局 pipingPattern：double_band(肩部+胫足双层360°环绕纹带，高定首选) / shoulder(肩部锦带) / foot(胫足莲瓣) / minimal(雅致疏刻)\n" +
    "- 贴花金彩 decorList（数组，每项限以下 ID，可重复，建议 5~9 件，最多 12 件，360°环器身错落布置）：straw_whole(青花折枝梅) / straw_half(暗刻瑞莲瓣) / blueberry(釉里红石榴) / fig_slice(钧窑紫霞斑) / mango_wedge(贴塑双鱼耳) / cherry(铁锈花飞鸟) / mint_leaf(卷草兰叶纹) / macaron_pink(描金团鹤纹) / macaron_green(瓦当云雷章) / choco_sail(曜变星斑纹) / meringue(浮雕铺首衔环)\n" +
    "- 窑变撒料 sprinkleTypes（数组，可选 0~2 种）：sprinkle_pearl(兔毫银星) / sprinkle_gold(洒金箔星) / sprinkle_sugar(柴烧落灰)；密度 sprinkleDensity：none / light / medium / rich\n" +
    "- 入窑窑火 kilnType：oxidizing(氧化焰·清亮通透) / reducing(还原焰·紫翠深润窑变) / wood_ash(松柴烧·落灰火痕天成)";

  var AFFECTION_CRAFT_GUIDELINE =
    "【心意与名窑工艺法则（非常重要）】\n" +
    "1. 请根据你的角色设定、世界书、记忆胶囊与近期传讯关系，判断你对收礼人的情感温度：\n" +
    "   - 若你是**爱慕、偏爱、深爱、宠溺或格外珍视对方**的角色：就算平日清冷、克制、毒舌或嘴硬，也会为了替喜欢的人烧出一件传世佳器而倾注心血，绝不敷衍！\n" +
    "   - 请区分「审美流派」与「用心精致度」：\n" +
    "     * 清冷/克制/傲娇但深爱型：走【宋瓷高古清雅高定】——选梅瓶或玉壶春配天青/月白/梅子青柔和渐变(ombre)、影青或本金描金双层暗刻(double_band)、精挑折枝梅/瑞莲/飞鸟/兰叶 5~8 件 + 少量兔毫银星或洒金箔星，入还原焰或氧化焰，嘴上淡淡说“顺手烧着玩的”，实则处处见功力。\n" +
    "     * 热烈/温柔/华丽/宠溺型：走【钧窑流霞华贵高定】——窑变紫/铜红/乌金流霞晕染(marble) + 厚积流釉 + 描金/胭脂红双层纹带 + 团鹤/石榴/紫霞斑/曜变星斑 7~10 件 + 洒金箔星，入还原焰或柴烧。\n" +
    "     * 只有当你们关系确实疏离、初识或冷战敷衍时，才选择素胎单釉极简款。\n" +
    "2. 避免器身空洞单调：善用双色窑变、流釉、双层暗刻、环器身贴花金彩与窑变撒料，让开窑成品一眼惊艳。";

  var visionUnsupportedSession = false;

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

  async function callPorcelainLLMWithVisionFallback(sysPrompt, userPrompt, imageDataUrl) {
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

  function buildFallbackPorcelainSketchSvg(charName) {
    var safeName = String(charName || "名士").replace(/[<>&"']/g, "").slice(0, 4);
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="80" viewBox="0 0 320 80">' +
      '<path d="M18 58 Q74 36 132 42 Q170 46 202 26" fill="none" stroke="#425D4F" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M98 42 Q112 24 134 18" fill="none" stroke="#425D4F" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="138" cy="17" r="4.6" fill="#587868" opacity="0.82"/>' +
      '<circle cx="145" cy="22" r="4.2" fill="#86B392" opacity="0.86"/>' +
      '<circle cx="132" cy="24" r="4.2" fill="#86B392" opacity="0.86"/>' +
      '<circle cx="139" cy="22" r="2" fill="#E0B453"/>' +
      '<rect x="186" y="22" width="26" height="26" rx="4" fill="none" stroke="#A84A44" stroke-width="2"/>' +
      '<text x="199" y="39" text-anchor="middle" font-family="serif" font-size="13" font-weight="bold" fill="#A84A44">窑</text>' +
      '<text x="230" y="52" font-family="serif" font-size="21" font-weight="bold" fill="#26231F">' + safeName + '</text>' +
      '<path d="M224 62 Q262 58 302 64" fill="none" stroke="#B88B4A" stroke-width="1.6" stroke-linecap="round"/>' +
      '</svg>'
    );
  }

  // ==================== 3. Four Porcelain AI Orchestration Actions ====================

  async function handleStepRelay(payload) {
    var ctx = await collectCharacterFullContext(payload.charId);
    var E = PORCELAIN_ENUMS;
    var stepIndex = Math.max(0, Math.min(5, Math.floor(Number(payload.stepIndex) || 0)));
    var stepNames = ["择器制胎", "施釉晕染", "暗刻纹饰", "贴花金彩", "底款题跋", "入窑开窑"];
    var visualText = String(payload.visualSnapshotText || payload.cakeSummary || "刚拉好素胎的制瓷陶轮");
    var relayNotes = Array.isArray(payload.relayHistory) ? payload.relayHistory.slice(-4).join("\n") : "";

    var stepSchemaByIdx = {
      0: '{"vesselId":"lacquer_ear/bronze_jian/celadon_bowl/jade_lotus","spongeId":"pure_snow/milk_curd/green_plum/hibiscus","spokenLine":"1~2句贴合角色口吻边选器型素胎边说的话","moodTag":"4字状态"}',
      1: '{"frostingColorId":"合法釉色ID","secondaryFrostingColorId":"none或合法釉色ID","glazeStyle":"solid或ombre或marble","dripGlazeId":"none或合法流釉ID","vesselSketchTitle":"可选：若想在器腹手绘青花/铁绘简笔画则填2~6字画题，不画留空","vesselSketchSvg":"可选：若画器腹简笔画则输出透明底标准<svg viewBox=\\"0 0 220 220\\">矢量线稿(用#284878/#4F2D1D/#E0B453清晰笔触stroke-width=4，严禁白色底框，不画留空)","spokenLine":"1~2句贴合角色口吻边施釉晕染边说的话","moodTag":"4字状态"}',
      2: '{"pipingNozzleId":"rosette/shell/pearl/blossom","pipingColorId":"合法彩料ID","secondaryPipingColorId":"none或合法彩料ID","pipingPattern":"double_band或shoulder或foot或minimal","spokenLine":"1~2句贴合角色口吻边暗刻纹饰边说的话","moodTag":"4字状态"}',
      3: '{"decorList":["straw_whole","straw_half","macaron_pink","cherry","mint_leaf","fig_slice"],"sprinkleTypes":["sprinkle_gold","sprinkle_pearl"],"sprinkleDensity":"light或medium或rich","spokenLine":"1~2句贴合角色口吻边贴花描金边说的话","moodTag":"4字状态"}',
      4: '{"cardTheme":0到3整数,"cardTo":"称呼(<=14字)","cardBody":"鉴藏题跋(20~55字，贴合人设与回忆)","plaqueText":"器底落款(<=8字)","cardSketchTitle":"必填：你在题跋落款区手绘的小简笔画/花押印(2~6字)","cardSketchSvg":"必填：透明底标准<svg viewBox=\\"0 0 320 80\\">矢量简笔画+印章落款(用#26231F/#425D4F/#A84A44墨印色，严禁白色底框)","spokenLine":"1~2句贴合角色口吻落款题跋时说的话","moodTag":"4字状态"}',
      5: '{"kilnType":"oxidizing或reducing或wood_ash","spokenLine":"1~2句择火入窑开窑呈器时的话","moodTag":"4字状态"}'
    };

    var sysPrompt =
      "你正在扮演传讯名士「" + ctx.charObj.name + "」，正在「东汉工坊 · 器物绘彩（寻窑记制瓷坊）」里与「" + ctx.userPersona.name + "」玩**你一步、我一步轮流接力烧制一件古法名瓷**。\n" +
      "现在轮到你亲自上手操作【第 " + (stepIndex + 1) + " 步：" + stepNames[stepIndex] + "】！\n\n" +
      "【你的 6 项完整角色配置（最高遵从：审美与口吻必须 100% 符合人设）】\n" + ctx.charProfileText + "\n\n" +
      "【" + ctx.userPersona.name + " 的身份设定】\n" + ctx.userPersonaText + "\n\n" +
      (ctx.coupleBondHint ? "【亲密关系提示】\n" + ctx.coupleBondHint + "\n\n" : "") +
      (ctx.worldBookText ? "【已开启的世界书设定】\n" + ctx.worldBookText + "\n\n" : "") +
      (ctx.memoryCapsuleText ? "【传讯 · 记忆胶囊中的共同回忆（自然参考你们的约定、喜好与过往细节）】\n" + ctx.memoryCapsuleText + "\n\n" : "") +
      (ctx.recentChatText ? "【你们在传讯中近期的聊天上下文（自然呼应彼此近况或梗）】\n" + ctx.recentChatText + "\n\n" : "") +
      AFFECTION_CRAFT_GUIDELINE + "\n\n" +
      PORCELAIN_ENUM_HINT_TEXT + "\n\n" +
      "请结合当前瓷胎现状与你的性格心意，在 `spokenLine` 里自然说出你**为什么选这些器型/釉色/纹饰/窑火或落款**，严格输出合法 JSON（禁止多余说明）：\n" +
      stepSchemaByIdx[stepIndex];

    var userPrompt =
      "【当前制瓷进度与外观】\n" + visualText +
      (relayNotes ? "\n\n【前几步互动记录】\n" + relayNotes : "") +
      "\n\n现在轮到你完成【" + stepNames[stepIndex] + "】，请给出走心的制瓷决策与此刻台词。";

    var llmRes = await callPorcelainLLMWithVisionFallback(sysPrompt, userPrompt, payload.imageDataUrl);
    var parsed = extractJsonSafe(llmRes.text) || {};

    var stepAction = {};
    if (stepIndex === 0) {
      stepAction = {
        vesselId: pickValid(parsed.vesselId, E.vessel, "lacquer_ear"),
        spongeId: pickValid(parsed.spongeId, E.sponge, "pure_snow")
      };
    } else if (stepIndex === 1) {
      var secGlaze = parsed.secondaryFrostingColorId === "none" ? "none" : pickValid(parsed.secondaryFrostingColorId, E.frostingColor, "smoked_plum");
      stepAction = {
        frostingColorId: pickValid(parsed.frostingColorId, E.frostingColor, "snow_curd"),
        secondaryFrostingColorId: secGlaze,
        glazeStyle: pickValid(parsed.glazeStyle, E.glazeStyle, secGlaze !== "none" ? "ombre" : "solid"),
        dripGlazeId: pickValid(parsed.dripGlazeId, E.dripGlaze, "osmanthus_M"),
        vesselSketchTitle: String(parsed.vesselSketchTitle || "").trim().slice(0, 12),
        vesselSketchSvg: sanitizeSketchSvg(parsed.vesselSketchSvg, 220, 220)
      };
    } else if (stepIndex === 2) {
      var secPipe = parsed.secondaryPipingColorId === "none" ? "none" : pickValid(parsed.secondaryPipingColorId, E.pipingColor, "none");
      stepAction = {
        pipingNozzleId: pickValid(parsed.pipingNozzleId, E.pipingNozzle, "blossom"),
        pipingColorId: pickValid(parsed.pipingColorId, E.pipingColor, "p_yellow"),
        secondaryPipingColorId: secPipe,
        pipingPattern: pickValid(parsed.pipingPattern, E.pipingPattern, "double_band")
      };
    } else if (stepIndex === 3) {
      var rawDecors = Array.isArray(parsed.decorList)
        ? parsed.decorList.filter(function (d) { return E.decor.indexOf(d) >= 0; }).slice(0, 12)
        : [];
      if (rawDecors.length === 0) rawDecors = ["straw_whole", "straw_half", "macaron_pink", "cherry", "mint_leaf", "fig_slice"];
      var rawSprinkles = Array.isArray(parsed.sprinkleTypes)
        ? parsed.sprinkleTypes.filter(function (s) { return E.sprinkle.indexOf(s) >= 0; }).slice(0, 2)
        : ["sprinkle_gold", "sprinkle_pearl"];
      stepAction = {
        decorList: rawDecors,
        sprinkleTypes: rawSprinkles,
        sprinkleDensity: pickValid(parsed.sprinkleDensity, E.sprinkleDensity, rawSprinkles.length > 0 ? "medium" : "none")
      };
    } else if (stepIndex === 4) {
      stepAction = {
        cardTheme: Math.max(0, Math.min(3, Math.floor(Number(parsed.cardTheme) || 0))),
        cardTo: String(parsed.cardTo || ("致：" + ctx.userPersona.name)).slice(0, 18),
        cardBody: String(parsed.cardBody || "雨过天青云破处，这般颜色做将来，赠君清赏。").slice(0, 60),
        plaqueText: String(parsed.plaqueText || "奉华清赏").slice(0, 10),
        cardSketchTitle: String(parsed.cardSketchTitle || "窑印花押").trim().slice(0, 12),
        cardSketchSvg: sanitizeSketchSvg(parsed.cardSketchSvg, 320, 80) || buildFallbackPorcelainSketchSvg(ctx.charObj.name)
      };
    } else if (stepIndex === 5) {
      stepAction = {
        kilnType: pickValid(parsed.kilnType, E.kilnType, "reducing")
      };
    }

    return {
      charName: ctx.charObj.name,
      stepIndex: stepIndex,
      stepAction: stepAction,
      spokenLine: String(parsed.spokenLine || "「这一步交给我来落笔罢，瞧好了。」").trim(),
      moodTag: String(parsed.moodTag || "专注制瓷").slice(0, 8),
      usedVision: llmRes.usedVision
    };
  }

  async function handleCharFullMake(payload) {
    var ctx = await collectCharacterFullContext(payload.charId);
    var E = PORCELAIN_ENUMS;
    var sysPrompt =
      "你正在扮演传讯名士「" + ctx.charObj.name + "」，正在「东汉工坊 · 器物绘彩（寻窑记制瓷坊）」里**亲自从头到尾为「" + ctx.userPersona.name + "」拉坯施釉烧制一件专属古法名瓷**。\n\n" +
      "【你的 6 项完整角色配置（最高遵从：器型审美、釉色偏好、落款题跋与口吻必须 100% 符合人设）】\n" + ctx.charProfileText + "\n\n" +
      "【收礼人（" + ctx.userPersona.name + "）身份设定】\n" + ctx.userPersonaText + "\n\n" +
      (ctx.coupleBondHint ? "【亲密关系提示】\n" + ctx.coupleBondHint + "\n\n" : "") +
      (ctx.worldBookText ? "【已开启的世界书设定】\n" + ctx.worldBookText + "\n\n" : "") +
      (ctx.memoryCapsuleText ? "【传讯 · 记忆胶囊中的共同回忆（自然融入你们的回忆、偏好与私密约定）】\n" + ctx.memoryCapsuleText + "\n\n" : "") +
      (ctx.recentChatText ? "【你们在传讯中近期的聊天上下文（自然融入你们的近况与梗）】\n" + ctx.recentChatText + "\n\n" : "") +
      AFFECTION_CRAFT_GUIDELINE + "\n\n" +
      PORCELAIN_ENUM_HINT_TEXT + "\n\n" +
      "请一次性构思完整 6 步名窑高定方案，并在 `stepLines` 的 6 句里**用你的专属口吻自然交代每一步为什么选这个器型、素胎、双色釉变/流釉、暗刻纹带、贴花金彩、落款花押与入窑窑火**，严格输出合法 JSON（禁止多余说明）：\n" +
      '{\n' +
      '  "vesselId": "合法器型ID", "spongeId": "合法素胎ID",\n' +
      '  "frostingColorId": "合法主釉色ID", "secondaryFrostingColorId": "none或合法副釉色ID", "glazeStyle": "solid或ombre或marble", "dripGlazeId": "none或合法流釉ID",\n' +
      '  "vesselSketchTitle": "可选：若想在器腹手绘青花/铁绘小简笔画填2~6字画题；不想画留空",\n' +
      '  "vesselSketchSvg": "可选：若画器腹简笔画则输出透明底标准<svg viewBox=\\"0 0 220 220\\">线稿(用#284878/#4F2D1D/#E0B453清晰笔触stroke-width=4，严禁白色底框)；不画留空",\n' +
      '  "pipingNozzleId": "合法暗刻ID", "pipingColorId": "合法彩料ID", "secondaryPipingColorId": "none或合法彩料ID", "pipingPattern": "double_band或shoulder或foot或minimal",\n' +
      '  "decorList": ["合法ID", "...建议6~9件，最多12件"], "sprinkleTypes": ["sprinkle_gold", "sprinkle_pearl"], "sprinkleDensity": "light或medium或rich",\n' +
      '  "cardTheme": 0到3整数, "cardTo": "称呼(<=14字)", "cardBody": "20~55字鉴藏题跋", "plaqueText": "器底落款(<=8字)",\n' +
      '  "cardSketchTitle": "必填：你在题跋签名区随手画的小简笔画/花押印名称(2~6字)",\n' +
      '  "cardSketchSvg": "必填：透明底标准<svg viewBox=\\"0 0 320 80\\">矢量简笔画+印章落款(用#26231F/#425D4F/#A84A44墨印色，严禁白色底框)",\n' +
      '  "kilnType": "oxidizing或reducing或wood_ash",\n' +
      '  "stepLines": ["第1步选器型与素胎的心意(25~50字)", "第2步施釉窑变与流釉心意(25~55字)", "第3步暗刻纹饰与描金心意(20~45字)", "第4步贴花金彩与窑变撒料心意(25~55字)", "第5步底款题跋与花押小画心意(25~55字)", "第6步择火入窑开窑呈器的话(20~45字)"],\n' +
      '  "introNote": "开窑捧给对方赏鉴时的一句开场白"\n' +
      '}';

    var llmRes = await callPorcelainLLMWithVisionFallback(
      sysPrompt,
      "请为 " + ctx.userPersona.name + " 定制并烧制一件既贴合你审美、又饱含心意与名窑工艺的 6 步古法瓷器。",
      ""
    );
    var p = extractJsonSafe(llmRes.text) || {};

    var decors = Array.isArray(p.decorList)
      ? p.decorList.filter(function (d) { return E.decor.indexOf(d) >= 0; }).slice(0, 12)
      : [];
    if (decors.length === 0) decors = ["straw_whole", "straw_half", "macaron_pink", "cherry", "mint_leaf", "fig_slice"];

    var sprinkles = Array.isArray(p.sprinkleTypes)
      ? p.sprinkleTypes.filter(function (s) { return E.sprinkle.indexOf(s) >= 0; }).slice(0, 2)
      : ["sprinkle_gold", "sprinkle_pearl"];

    var defaultLines = [
      "挑了合你气度的器型与素胎，胎骨匀净才衬得起好釉色。",
      "主副两道矿物釉细细晕开，口沿再挂一圈厚釉，等入窑窑变。",
      "肩颈与胫足都环刻上纹饰，细处才最见心思。",
      "再点几处贴花金彩与银星金箔，转着看哪一面都雅致。",
      "器底落款与题跋花押也替你写好了，留作日后清赏。",
      "窑火已毕，开窑清响正好——来瞧瞧这件专为你烧的瓷器罢。"
    ];
    var lines = Array.isArray(p.stepLines) && p.stepLines.length >= 6
      ? p.stepLines.slice(0, 6).map(function (s, i) { return String(s || defaultLines[i]).trim(); })
      : defaultLines;

    var secGlaze = p.secondaryFrostingColorId === "none" ? "none" : pickValid(p.secondaryFrostingColorId, E.frostingColor, "smoked_plum");
    var secPipe = p.secondaryPipingColorId === "none" ? "none" : pickValid(p.secondaryPipingColorId, E.pipingColor, "none");

    return {
      charName: ctx.charObj.name,
      plan: {
        vesselId: pickValid(p.vesselId, E.vessel, "lacquer_ear"),
        spongeId: pickValid(p.spongeId, E.sponge, "pure_snow"),
        frostingColorId: pickValid(p.frostingColorId, E.frostingColor, "snow_curd"),
        secondaryFrostingColorId: secGlaze,
        glazeStyle: pickValid(p.glazeStyle, E.glazeStyle, secGlaze !== "none" ? "ombre" : "solid"),
        dripGlazeId: pickValid(p.dripGlazeId, E.dripGlaze, "osmanthus_M"),
        vesselSketchTitle: String(p.vesselSketchTitle || "").trim().slice(0, 12),
        vesselSketchSvg: sanitizeSketchSvg(p.vesselSketchSvg, 220, 220),
        pipingNozzleId: pickValid(p.pipingNozzleId, E.pipingNozzle, "blossom"),
        pipingColorId: pickValid(p.pipingColorId, E.pipingColor, "p_yellow"),
        secondaryPipingColorId: secPipe,
        pipingPattern: pickValid(p.pipingPattern, E.pipingPattern, "double_band"),
        decorList: decors,
        sprinkleTypes: sprinkles,
        sprinkleDensity: pickValid(p.sprinkleDensity, E.sprinkleDensity, sprinkles.length > 0 ? "medium" : "none"),
        cardTheme: Math.max(0, Math.min(3, Math.floor(Number(p.cardTheme) || 0))),
        cardTo: String(p.cardTo || ("致：" + ctx.userPersona.name)).slice(0, 18),
        cardBody: String(p.cardBody || "雨过天青云破处，这般颜色做将来，愿君常伴清欢。").slice(0, 60),
        plaqueText: String(p.plaqueText || "奉华清赏").slice(0, 10),
        cardSketchTitle: String(p.cardSketchTitle || "窑印花押").trim().slice(0, 12),
        cardSketchSvg: sanitizeSketchSvg(p.cardSketchSvg, 320, 80) || buildFallbackPorcelainSketchSvg(ctx.charObj.name),
        kilnType: pickValid(p.kilnType, E.kilnType, "reducing")
      },
      stepLines: lines,
      introNote: String(p.introNote || lines[5]).trim()
    };
  }

  async function handleCharTaste(payload) {
    var ctx = await collectCharacterFullContext(payload.charId);
    var visualText = String(payload.visualSnapshotText || payload.cakeSummary || "一件古法窑变名瓷");
    var modeNote = payload.mode === "relay_coop"
      ? "这是你与「" + ctx.userPersona.name + "」你一步我一步共同接力烧制完成的古法瓷器。"
      : "这是「" + ctx.userPersona.name + "」亲手为你施釉烧制并捧到你面前的古法瓷器。";

    var sysPrompt =
      "你正在扮演传讯名士「" + ctx.charObj.name + "」，此刻正端详并把玩眼前这件刚出窑的古法瓷器。\n" +
      modeNote + "\n\n" +
      "【你的 6 项完整角色配置（最高遵从：必须用你本人的说话风格、性情与审美癖好来赏鉴）】\n" + ctx.charProfileText + "\n\n" +
      "【" + ctx.userPersona.name + " 的身份设定】\n" + ctx.userPersonaText + "\n\n" +
      (ctx.worldBookText ? "【已开启的世界书设定】\n" + ctx.worldBookText + "\n\n" : "") +
      (ctx.memoryCapsuleText ? "【传讯 · 记忆胶囊中的共同回忆】\n" + ctx.memoryCapsuleText + "\n\n" : "") +
      (ctx.recentChatText ? "【你们在传讯中近期的聊天上下文（自然呼应彼此关系与近期聊天细节）】\n" + ctx.recentChatText + "\n\n" : "") +
      "【要求】\n" +
      "1. 必须真实点评到具体的器型、釉色窑变、纹饰贴花、窑火效果，以及器底落款或题跋上的话！\n" +
      "2. 严禁千篇一律的“很好看谢谢你”套话，要展现鲜明的人设感（比如摩挲釉面爱不释手、挑剔釉泪偏了半寸却偏要收进书房、看到底款嘴硬耳红等）。\n" +
      "3. 严格输出合法 JSON：\n" +
      '{"reactionTag":"4~8字神态短签","comment":"70~130字画面感赏器动作与细节描写","dialogue":"1~2句贴合角色口吻的直白台词"}';

    var userPrompt = "【你眼前看到的瓷器完整工艺与外观】\n" + visualText + "\n\n请以「" + ctx.charObj.name + "」的身份赏鉴并给出真实评语。";
    var llmRes = await callPorcelainLLMWithVisionFallback(sysPrompt, userPrompt, payload.imageDataUrl);
    var p = extractJsonSafe(llmRes.text) || {};

    return {
      charName: ctx.charObj.name,
      reactionTag: String(p.reactionTag || "执器细赏").slice(0, 12),
      comment: String(p.comment || (ctx.charObj.name + "指腹轻拂过温润的釉面与开片纹理，又翻转器底细看那行落款，眼底浮起几分难得的笑意。")).trim(),
      dialogue: String(p.dialogue || "「这抹窑变倒比官窑还合我眼缘……归我了，别想再讨回去。」").trim(),
      usedVision: llmRes.usedVision
    };
  }

  async function handleUserFeedbackReply(payload) {
    var ctx = await collectCharacterFullContext(payload.charId);
    var userFeedback = String(payload.userFeedback || "").trim().slice(0, 160);
    var visualText = String(payload.visualSnapshotText || payload.cakeSummary || "");

    var sysPrompt =
      "你正在扮演传讯名士「" + ctx.charObj.name + "」。刚才你亲手为「" + ctx.userPersona.name + "」烧制了一件古法瓷器，对方赏鉴后对你给出了一句真实评价。\n\n" +
      "【你的 6 项完整角色配置】\n" + ctx.charProfileText + "\n\n" +
      "【" + ctx.userPersona.name + " 的身份设定】\n" + ctx.userPersonaText + "\n\n" +
      (ctx.worldBookText ? "【已开启的世界书设定】\n" + ctx.worldBookText + "\n\n" : "") +
      (ctx.memoryCapsuleText ? "【传讯 · 记忆胶囊中的共同回忆】\n" + ctx.memoryCapsuleText + "\n\n" : "") +
      (ctx.recentChatText ? "【近期传讯上下文】\n" + ctx.recentChatText + "\n\n" : "") +
      "请严格输出合法 JSON：\n" +
      '{"reactionTag":"4~8字神态短签","comment":"45~90字听到评价后的微表情与举动","dialogue":"1~2句贴合人设的回应台词"}';

    var userPrompt =
      "【你烧制的瓷器】\n" + visualText +
      "\n\n【" + ctx.userPersona.name + " 赏完后对你说】：「" + (userFeedback || "这釉色真美！") + "」";

    var llmRes = await callPorcelainLLMWithVisionFallback(sysPrompt, userPrompt, "");
    var p = extractJsonSafe(llmRes.text) || {};

    return {
      charName: ctx.charObj.name,
      reactionTag: String(p.reactionTag || "闻言微哂").slice(0, 12),
      comment: String(p.comment || (ctx.charObj.name + "听罢唇角微扬，顺手替你将瓷器稳稳安放在案头光影最清透的一角。")).trim(),
      dialogue: String(p.dialogue || "「既合你心意，下回再替你烧一对配套的茶盏便是。」").trim()
    };
  }

  // ==================== 4. Independent Porcelain History IndexedDB & Phone Integration ====================

  var PORCELAIN_DB_NAME = "milvus_han_workshop_porcelain_idb";
  var PORCELAIN_DB_VER = 1;
  var PORCELAIN_STORE = "porcelains";
  var dbPromise = null;

  function openPorcelainHistoryDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (typeof indexedDB === "undefined") { reject(new Error("不支持 IndexedDB")); return; }
      var req = indexedDB.open(PORCELAIN_DB_NAME, PORCELAIN_DB_VER);
      req.onupgradeneeded = function (ev) {
        var db = ev.target.result;
        if (!db.objectStoreNames.contains(PORCELAIN_STORE)) {
          db.createObjectStore(PORCELAIN_STORE, { keyPath: "id" });
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

  async function savePorcelainHistoryRecord(payload) {
    try {
      var db = await openPorcelainHistoryDB();
      var thumb = await compressDataUrl(payload.posterDataUrl || "", 680, 0.84);
      var rec = {
        id: String(payload.id || ("porcelain_hist_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6))),
        cakeName: String(payload.cakeName || "寻窑秘色名瓷").slice(0, 28),
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
        var tx = db.transaction(PORCELAIN_STORE, "readwrite");
        tx.objectStore(PORCELAIN_STORE).put(rec);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function (ev) { reject(ev.target.error); };
      });
      return { ok: true, record: rec };
    } catch (e) {
      return { ok: false, message: String(e && e.message || e) };
    }
  }

  async function listPorcelainHistoryRecords() {
    try {
      var db = await openPorcelainHistoryDB();
      var list = await new Promise(function (resolve) {
        var tx = db.transaction(PORCELAIN_STORE, "readonly");
        var req = tx.objectStore(PORCELAIN_STORE).getAll();
        req.onsuccess = function () { resolve(Array.isArray(req.result) ? req.result : []); };
        req.onerror = function () { resolve([]); };
      });
      list.sort(function (a, b) { return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0); });
      return list;
    } catch (_) {
      return [];
    }
  }

  async function deletePorcelainHistoryRecord(id) {
    try {
      var db = await openPorcelainHistoryDB();
      await new Promise(function (resolve, reject) {
        var tx = db.transaction(PORCELAIN_STORE, "readwrite");
        tx.objectStore(PORCELAIN_STORE).delete(String(id));
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function (ev) { reject(ev.target.error); };
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: String(e && e.message || e) };
    }
  }

  async function savePorcelainToBackpack(payload) {
    var bp = global.backpackStore;
    if (!bp || (typeof bp.addItems !== "function" && typeof bp.add !== "function" && typeof bp.save !== "function" && typeof bp.put !== "function")) {
      return { ok: false, message: "未检测到「我的背包」存储模块" };
    }
    var thumb = await compressDataUrl(payload.posterDataUrl || "", 540, 0.82);
    var item = {
      id: "porcelain_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      name: String(payload.cakeName || "寻窑秘色名瓷").slice(0, 24),
      price: 0,
      merchant: "东汉工坊 · 寻窑记制瓷坊",
      type: "古法瓷器",
      category: "artifact",
      description: String(payload.cakeDesc || "寻窑记亲手施釉入窑烧制的专属名瓷").slice(0, 120),
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

  async function sendPorcelainToChat(payload) {
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
    var itemTitle = String(payload.cakeName || "寻窑秘色名瓷");
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
        text: "【东汉工坊 · 器物绘彩】" + captionTitle + (payload.cakeDesc ? "\n" + String(payload.cakeDesc).slice(0, 100) : "")
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

      var previewText = "[器物绘彩] 《" + itemTitle + "》";
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

  function PorcelainWorkshopHostModal(props) {
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
            edition: "porcelain",
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
        // 仅处理来自当前瓷器 iframe 的消息
        if (win && ev.source && ev.source !== win) return;

        if (data.type === "WORKSHOP_CAKE_CLOSE" || data.type === "WORKSHOP_PORCELAIN_CLOSE") {
          if (typeof onClose === "function") onClose();
          return;
        }
        if (data.type === "WORKSHOP_CAKE_REQUEST_SYNC" || data.type === "WORKSHOP_PORCELAIN_REQUEST_SYNC") {
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
          var bpRes = await savePorcelainToBackpack(p);
          win.postMessage({ type: "WORKSHOP_CAKE_ACTION_RESULT", requestId: reqId, result: bpRes }, "*");
        } else if (data.type === "WORKSHOP_CAKE_SEND_CHAT") {
          var chRes = await sendPorcelainToChat(p);
          win.postMessage({ type: "WORKSHOP_CAKE_ACTION_RESULT", requestId: reqId, result: chRes }, "*");
        } else if (data.type === "WORKSHOP_CAKE_SAVE_HISTORY") {
          var shRes = await savePorcelainHistoryRecord(p);
          win.postMessage({ type: "WORKSHOP_CAKE_ACTION_RESULT", requestId: reqId, result: shRes }, "*");
        } else if (data.type === "WORKSHOP_CAKE_LIST_HISTORY") {
          var lhRes = await listPorcelainHistoryRecords();
          win.postMessage({ type: "WORKSHOP_CAKE_ACTION_RESULT", requestId: reqId, result: lhRes }, "*");
        } else if (data.type === "WORKSHOP_CAKE_DELETE_HISTORY") {
          var dhRes = await deletePorcelainHistoryRecord(p && p.id);
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
          background: "#F2EFE9",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          touchAction: "none"
        }
      },
      h("iframe", {
        ref: iframeRef,
        src: "./制造瓷器.html",
        title: "东汉工坊 · 器物绘彩（寻窑记）",
        onLoad: function () { pushLightSync(); },
        style: {
          flex: 1,
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
          background: "#F2EFE9"
        }
      })
    );
  }

  // Auto hot-plug into 东汉工坊 ("lacquer" 器物绘彩 slot)
  if (global.HanWorkshopApp && typeof global.HanWorkshopApp.registerWorkshop === "function") {
    global.HanWorkshopApp.registerWorkshop("lacquer", {
      title: "器物绘彩",
      subtitle: "寻窑施釉 · 共创",
      icon: "lacquer",
      component: PorcelainWorkshopHostModal
    });
  }

  global.HanWorkshopPorcelainBridge = {
    version: "1.0.0",
    PORCELAIN_ENUMS: PORCELAIN_ENUMS,
    collectCharacterFullContext: collectCharacterFullContext,
    handleStepRelay: handleStepRelay,
    handleCharFullMake: handleCharFullMake,
    handleCharTaste: handleCharTaste,
    handleUserFeedbackReply: handleUserFeedbackReply,
    savePorcelainToBackpack: savePorcelainToBackpack,
    sendPorcelainToChat: sendPorcelainToChat
  };
})(typeof window !== "undefined" ? window : globalThis);

