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
    dripGlaze: ["none", "dark_choco", "berry_glaze", "caramel", "white_choco", "matcha_glaze"],
    pipingNozzle: ["rosette", "shell", "pearl", "blossom"],
    pipingColor: ["p_white", "p_pink", "p_yellow", "p_green", "p_blue", "p_choco"],
    decor: [
      "straw_whole", "straw_half", "blueberry", "fig_slice", "mango_wedge",
      "cherry", "mint_leaf", "macaron_pink", "macaron_green", "choco_sail", "meringue"
    ]
  };

  var ENUM_HINT_TEXT =
    "【蛋糕工坊合法枚举 ID（严禁编造列表外的 ID）】\n" +
    "- 蛋糕胚 spongeId：vanilla(法式香草胚) / cocoa(浓醇可可胚) / matcha(宇治抹茶胚) / berry(红丝绒莓胚)\n" +
    "- 夹心酱 fillingCreamId：milk_jam(香草草莓酱) / mango_jam(百香芒果酱) / berry_jam(森林蓝莓酱) / choco_jam(榛子巧克力)\n" +
    "- 夹心果粒 fillingFruitId：diced_straw(鲜切草莓丁) / diced_mango(台农甜芒粒) / diced_oreo(奥利奥巧碎) / diced_blue(爆汁蓝莓粒)\n" +
    "- 抹面奶油色 frostingColorId：ivory(动物鲜奶油) / blush(树莓粉奶油) / butter(海盐焦糖黄) / pistachio(开心果奶绿) / taro(芋泥紫奶油) / cocoa(生巧甘纳许)\n" +
    "- 淋面酱 dripGlazeId：none(无淋面) / dark_choco(黑巧淋面) / berry_glaze(草莓甘纳许) / caramel(太妃焦糖酱) / white_choco(白巧牛乳淋) / matcha_glaze(浓抹茶淋面)\n" +
    "- 裱花花嘴 pipingNozzleId：rosette(八齿曲奇花) / shell(法式贝壳边) / pearl(云朵雪顶球) / blossom(五瓣奶油花)\n" +
    "- 裱花色 pipingColorId：p_white(香缇白) / p_pink(蜜桃粉) / p_yellow(柠檬黄) / p_green(薄荷绿) / p_blue(海盐蓝) / p_choco(摩卡棕)\n" +
    "- 装饰配料 decorList（数组，每项限以下 ID，最多 8 件）：straw_whole(红颜整草莓) / straw_half(鲜切半草莓) / blueberry(薄荷蓝莓簇) / fig_slice(鲜切无花果) / mango_wedge(黄桃甜芒瓣) / cherry(带梗红樱桃) / mint_leaf(鲜嫩薄荷叶) / macaron_pink(树莓马卡龙) / macaron_green(开心果马卡龙) / choco_sail(金箔黑巧帆) / meringue(焦糖蛋白糖)";

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

    return {
      charObj: charObj,
      userPersona: userPersona,
      charProfileText: charProfileText,
      userPersonaText: userPersonaText,
      worldBookText: worldBookText,
      recentChatText: recentChatLines.join("\n")
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

  // ==================== 3. Four Co-Baking AI Orchestration Actions ====================

  async function handleStepRelay(payload) {
    var ctx = await collectCharacterFullContext(payload.charId);
    var stepIndex = Math.max(0, Math.min(5, Math.floor(Number(payload.stepIndex) || 0)));
    var stepNames = ["胚与夹心", "奶油抹面", "精致裱花", "鲜果装饰", "手写贺卡", "点亮仪式"];
    var visualText = String(payload.visualSnapshotText || payload.cakeSummary || "刚起步的蛋糕台面");
    var relayNotes = Array.isArray(payload.relayHistory) ? payload.relayHistory.slice(-4).join("\n") : "";

    var stepSchemaByIdx = {
      0: '{"spongeId":"vanilla/cocoa/matcha/berry","fillingCreamId":"milk_jam/mango_jam/berry_jam/choco_jam","fillingFruitId":"diced_straw/diced_mango/diced_oreo/diced_blue","spokenLine":"1~2句贴合角色口吻边做边说的话","moodTag":"4字状态"}',
      1: '{"frostingColorId":"ivory/blush/butter/pistachio/taro/cocoa","dripGlazeId":"none/dark_choco/berry_glaze/caramel/white_choco/matcha_glaze","neatness":"tidy或rustic","spokenLine":"1~2句贴合角色口吻边抹面边说的话","moodTag":"4字状态"}',
      2: '{"pipingNozzleId":"rosette/shell/pearl/blossom","pipingColorId":"p_white/p_pink/p_yellow/p_green/p_blue/p_choco","pipingPattern":"ring或crown或minimal","spokenLine":"1~2句贴合角色口吻边裱花边说的话","moodTag":"4字状态"}',
      3: '{"decorList":["straw_whole","mint_leaf"],"decorLayout":"symmetric或cluster或playful","spokenLine":"1~2句贴合角色口吻边放装饰边说的话","moodTag":"4字状态"}',
      4: '{"cardTheme":0到3整数,"cardTo":"称呼(<=14字)","cardBody":"祝福正文(20~55字，贴合人设与近期聊天)","plaqueText":"巧克力牌刻字(<=8字)","spokenLine":"1~2句贴合角色口吻写贺卡时说的话","moodTag":"4字状态"}',
      5: '{"spokenLine":"1~2句点亮蜡烛收尾时的话","moodTag":"4字状态"}'
    };

    var sysPrompt =
      "你正在扮演传讯名士「" + ctx.charObj.name + "」，正在「东汉工坊 · 蛋糕工坊」里与「" + ctx.userPersona.name + "」玩**你一步、我一步轮流接力做蛋糕**。\n" +
      "现在轮到你亲自上手操作【第 " + (stepIndex + 1) + " 步：" + stepNames[stepIndex] + "】！\n\n" +
      "【你的 6 项完整角色配置（最高遵从：审美选择与说话口吻必须 100% 符合人设）】\n" + ctx.charProfileText + "\n\n" +
      "【" + ctx.userPersona.name + " 的身份设定】\n" + ctx.userPersonaText + "\n\n" +
      (ctx.worldBookText ? "【已开启的世界书设定】\n" + ctx.worldBookText + "\n\n" : "") +
      (ctx.recentChatText ? "【你们在传讯中近期的聊天上下文（自然呼应彼此近况或梗）】\n" + ctx.recentChatText + "\n\n" : "") +
      ENUM_HINT_TEXT + "\n\n" +
      "请结合前面已做好的蛋糕现状与你的真实性格（可以认真讲究、可以嘴硬嫌弃、可以偷偷夹带私心或调侃对方上一步的手艺），并在 `spokenLine` 里自然说出你**为什么选这些配料/颜色/装饰或刻字**，严格输出合法 JSON（禁止多余说明）：\n" +
      stepSchemaByIdx[stepIndex];

    var userPrompt =
      "【当前蛋糕进度与视觉形态】\n" + visualText +
      (relayNotes ? "\n\n【前几步互动记录】\n" + relayNotes : "") +
      "\n\n现在轮到你完成【" + stepNames[stepIndex] + "】，请给出操作决策与你此刻的台词。";

    var llmRes = await callCakeLLMWithVisionFallback(sysPrompt, userPrompt, payload.imageDataUrl);
    var parsed = extractJsonSafe(llmRes.text) || {};

    var stepAction = {};
    if (stepIndex === 0) {
      stepAction = {
        spongeId: pickValid(parsed.spongeId, VALID_ENUMS.sponge, "vanilla"),
        fillingCreamId: pickValid(parsed.fillingCreamId, VALID_ENUMS.fillingCream, "milk_jam"),
        fillingFruitId: pickValid(parsed.fillingFruitId, VALID_ENUMS.fillingFruit, "diced_straw")
      };
    } else if (stepIndex === 1) {
      stepAction = {
        frostingColorId: pickValid(parsed.frostingColorId, VALID_ENUMS.frostingColor, "ivory"),
        dripGlazeId: pickValid(parsed.dripGlazeId, VALID_ENUMS.dripGlaze, "none"),
        neatness: parsed.neatness === "rustic" ? "rustic" : "tidy"
      };
    } else if (stepIndex === 2) {
      stepAction = {
        pipingNozzleId: pickValid(parsed.pipingNozzleId, VALID_ENUMS.pipingNozzle, "rosette"),
        pipingColorId: pickValid(parsed.pipingColorId, VALID_ENUMS.pipingColor, "p_white"),
        pipingPattern: ["ring", "crown", "minimal"].indexOf(parsed.pipingPattern) >= 0 ? parsed.pipingPattern : "ring"
      };
    } else if (stepIndex === 3) {
      var rawDecors = Array.isArray(parsed.decorList)
        ? parsed.decorList.filter(function (d) { return VALID_ENUMS.decor.indexOf(d) >= 0; }).slice(0, 8)
        : [];
      if (rawDecors.length === 0) rawDecors = ["straw_whole", "blueberry", "mint_leaf", "choco_sail"];
      stepAction = {
        decorList: rawDecors,
        decorLayout: ["symmetric", "cluster", "playful"].indexOf(parsed.decorLayout) >= 0 ? parsed.decorLayout : "symmetric"
      };
    } else if (stepIndex === 4) {
      stepAction = {
        cardTheme: Math.max(0, Math.min(3, Math.floor(Number(parsed.cardTheme) || 0))),
        cardTo: String(parsed.cardTo || ("致：" + ctx.userPersona.name)).slice(0, 18),
        cardBody: String(parsed.cardBody || "难得同你一道做一回点心，趁新鲜尝尝罢。").slice(0, 60),
        plaqueText: String(parsed.plaqueText || "顺遂常乐").slice(0, 10)
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
    var sysPrompt =
      "你正在扮演传讯名士「" + ctx.charObj.name + "」，正在「东汉工坊 · 蛋糕工坊」里**亲自从头到尾为「" + ctx.userPersona.name + "」定制制作一个专属手作蛋糕**。\n\n" +
      "【你的 6 项完整角色配置（最高遵从：口味偏好、配色审美、刻字与说话口吻必须 100% 符合人设）】\n" + ctx.charProfileText + "\n\n" +
      "【收礼人（" + ctx.userPersona.name + "）身份设定】\n" + ctx.userPersonaText + "\n\n" +
      (ctx.worldBookText ? "【已开启的世界书设定】\n" + ctx.worldBookText + "\n\n" : "") +
      (ctx.recentChatText ? "【你们在传讯中近期的聊天上下文（自然融入你们的近况、梗或心意）】\n" + ctx.recentChatText + "\n\n" : "") +
      ENUM_HINT_TEXT + "\n\n" +
      "请一次性构思完整 6 步方案，并在 `stepLines` 的 6 句里**用你的专属口吻自然交代每一步为什么挑这个胚、夹心、奶油色、淋面、装饰与刻字**，严格输出合法 JSON（禁止多余说明）：\n" +
      '{\n' +
      '  "spongeId": "合法ID", "fillingCreamId": "合法ID", "fillingFruitId": "合法ID",\n' +
      '  "frostingColorId": "合法ID", "dripGlazeId": "合法ID", "neatness": "tidy或rustic",\n' +
      '  "pipingNozzleId": "合法ID", "pipingColorId": "合法ID", "pipingPattern": "ring或crown或minimal",\n' +
      '  "decorList": ["合法ID", "...最多8件"], "decorLayout": "symmetric或cluster或playful",\n' +
      '  "cardTheme": 0到3整数, "cardTo": "称呼(<=14字)", "cardBody": "20~55字亲笔祝福", "plaqueText": "巧克力牌刻字(<=8字)",\n' +
      '  "stepLines": ["第1步为什么选这个胚与夹心(25~50字)", "第2步为什么选这个抹面色与淋面(25~50字)", "第3步为什么选这种裱花(20~45字)", "第4步为什么摆这些水果装饰(25~50字)", "第5步为什么写这句贺卡与刻字(25~50字)", "第6步点亮蜡烛端出成品的话(20~45字)"],\n' +
      '  "introNote": "端给对方试吃时的一句简短开场白"\n' +
      '}';

    var llmRes = await callCakeLLMWithVisionFallback(
      sysPrompt,
      "请为 " + ctx.userPersona.name + " 定制并制作一个充满你个人风格的 6 步手作蛋糕。",
      ""
    );
    var p = extractJsonSafe(llmRes.text) || {};

    var decors = Array.isArray(p.decorList)
      ? p.decorList.filter(function (d) { return VALID_ENUMS.decor.indexOf(d) >= 0; }).slice(0, 8)
      : [];
    if (decors.length === 0) decors = ["straw_whole", "blueberry", "mint_leaf", "macaron_pink", "choco_sail"];

    var defaultLines = [
      "先把底胚和夹心铺匀，免得切开时塌了。",
      "抹面最考验手上分寸，别催，马上好。",
      "顺着边缘挤一圈花边，瞧着总算像样了。",
      "再挑几颗顺眼的果子与点缀摆上去。",
      "巧克力牌和贺卡也替你写好了，字迹别嫌弃。",
      "蜡烛点好了，趁奶油未化，过来尝一口罢。"
    ];
    var lines = Array.isArray(p.stepLines) && p.stepLines.length >= 6
      ? p.stepLines.slice(0, 6).map(function (s, i) { return String(s || defaultLines[i]).trim(); })
      : defaultLines;

    return {
      charName: ctx.charObj.name,
      plan: {
        spongeId: pickValid(p.spongeId, VALID_ENUMS.sponge, "vanilla"),
        fillingCreamId: pickValid(p.fillingCreamId, VALID_ENUMS.fillingCream, "milk_jam"),
        fillingFruitId: pickValid(p.fillingFruitId, VALID_ENUMS.fillingFruit, "diced_straw"),
        frostingColorId: pickValid(p.frostingColorId, VALID_ENUMS.frostingColor, "ivory"),
        dripGlazeId: pickValid(p.dripGlazeId, VALID_ENUMS.dripGlaze, "caramel"),
        neatness: p.neatness === "rustic" ? "rustic" : "tidy",
        pipingNozzleId: pickValid(p.pipingNozzleId, VALID_ENUMS.pipingNozzle, "rosette"),
        pipingColorId: pickValid(p.pipingColorId, VALID_ENUMS.pipingColor, "p_white"),
        pipingPattern: ["ring", "crown", "minimal"].indexOf(p.pipingPattern) >= 0 ? p.pipingPattern : "ring",
        decorList: decors,
        decorLayout: ["symmetric", "cluster", "playful"].indexOf(p.decorLayout) >= 0 ? p.decorLayout : "symmetric",
        cardTheme: Math.max(0, Math.min(3, Math.floor(Number(p.cardTheme) || 0))),
        cardTo: String(p.cardTo || ("致：" + ctx.userPersona.name)).slice(0, 18),
        cardBody: String(p.cardBody || "亲手试着做了一回，甜度按你平日喜好收了三分，尝尝合不合胃口。").slice(0, 60),
        plaqueText: String(p.plaqueText || "岁岁安暖").slice(0, 10)
      },
      stepLines: lines,
      introNote: String(p.introNote || lines[5]).trim()
    };
  }

  async function handleCharTaste(payload) {
    var ctx = await collectCharacterFullContext(payload.charId);
    var visualText = String(payload.visualSnapshotText || payload.cakeSummary || "一份手作奶油蛋糕");
    var modeNote = payload.mode === "relay_coop"
      ? "这是你与「" + ctx.userPersona.name + "」你一步我一步共同接力完成的蛋糕。"
      : "这是「" + ctx.userPersona.name + "」亲手为你制作并端到你面前的蛋糕。";

    var sysPrompt =
      "你正在扮演传讯名士「" + ctx.charObj.name + "」，此刻正看着并品尝眼前这份手作蛋糕。\n" +
      modeNote + "\n\n" +
      "【你的 6 项完整角色配置（最高遵从：必须用你本人的说话风格、性情与细节癖好来评价）】\n" + ctx.charProfileText + "\n\n" +
      "【" + ctx.userPersona.name + " 的身份设定】\n" + ctx.userPersonaText + "\n\n" +
      (ctx.worldBookText ? "【已开启的世界书设定】\n" + ctx.worldBookText + "\n\n" : "") +
      (ctx.recentChatText ? "【你们在传讯中近期的聊天上下文（自然呼应彼此关系与近期聊天细节）】\n" + ctx.recentChatText + "\n\n" : "") +
      "【要求】\n" +
      "1. 必须真实点评到蛋糕的具体配料、夹心、抹面/配色/装饰长相，以及巧克力牌刻字或贺卡上的话！\n" +
      "2. 严禁千篇一律的“真好吃谢谢你”套话，要展现鲜明的人设感（比如挑剔却吃光、被甜到皱眉、夸某颗果子摆得歪却顺眼、对刻字嘴硬耳红等）。\n" +
      "3. 严格输出合法 JSON：\n" +
      '{"reactionTag":"4~8字神态短签","comment":"70~130字画面感动作与品尝描写","dialogue":"1~2句贴合角色口吻的直白台词"}';

    var userPrompt = "【你眼前看到的蛋糕完整配方与外观】\n" + visualText + "\n\n请以「" + ctx.charObj.name + "」的身份品尝并给出真实回函。";
    var llmRes = await callCakeLLMWithVisionFallback(sysPrompt, userPrompt, payload.imageDataUrl);
    var p = extractJsonSafe(llmRes.text) || {};

    return {
      charName: ctx.charObj.name,
      reactionTag: String(p.reactionTag || "细品慢尝").slice(0, 12),
      comment: String(p.comment || (ctx.charObj.name + "打量了片刻蛋糕上的奶油纹路与巧克力牌，用银叉挑了一角放入口中，神色微动，眉眼间染上几分难得的笑意。")).trim(),
      dialogue: String(p.dialogue || "「手艺倒比我想的稳当些……这甜度刚好，剩下半块留给我罢。」").trim(),
      usedVision: llmRes.usedVision
    };
  }

  async function handleUserFeedbackReply(payload) {
    var ctx = await collectCharacterFullContext(payload.charId);
    var userFeedback = String(payload.userFeedback || "").trim().slice(0, 160);
    var visualText = String(payload.visualSnapshotText || payload.cakeSummary || "");

    var sysPrompt =
      "你正在扮演传讯名士「" + ctx.charObj.name + "」。刚才你亲手为「" + ctx.userPersona.name + "」做了一个蛋糕，对方品尝完后对你给出了一句真实反馈。\n\n" +
      "【你的 6 项完整角色配置】\n" + ctx.charProfileText + "\n\n" +
      "【" + ctx.userPersona.name + " 的身份设定】\n" + ctx.userPersonaText + "\n\n" +
      (ctx.worldBookText ? "【已开启的世界书设定】\n" + ctx.worldBookText + "\n\n" : "") +
      (ctx.recentChatText ? "【近期传讯上下文】\n" + ctx.recentChatText + "\n\n" : "") +
      "请严格输出合法 JSON：\n" +
      '{"reactionTag":"4~8字神态短签","comment":"45~90字听到评价后的微表情与举动","dialogue":"1~2句贴合人设的回应台词"}';

    var userPrompt =
      "【你做的蛋糕】\n" + visualText +
      "\n\n【" + ctx.userPersona.name + " 尝完后对你说】：「" + (userFeedback || "挺好吃的！") + "」";

    var llmRes = await callCakeLLMWithVisionFallback(sysPrompt, userPrompt, "");
    var p = extractJsonSafe(llmRes.text) || {};

    return {
      charName: ctx.charObj.name,
      reactionTag: String(p.reactionTag || "闻言微哂").slice(0, 12),
      comment: String(p.comment || (ctx.charObj.name + "听罢唇角微扬，顺手替你拭去碟边一点奶油碎。")).trim(),
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
        cakeName: String(payload.cakeName || "暖光手作蛋糕").slice(0, 28),
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

  async function listCakeHistoryRecords() {
    try {
      var db = await openCakeHistoryDB();
      var list = await new Promise(function (resolve) {
        var tx = db.transaction(CAKE_STORE, "readonly");
        var req = tx.objectStore(CAKE_STORE).getAll();
        req.onsuccess = function () { resolve(Array.isArray(req.result) ? req.result : []); };
        req.onerror = function () { resolve([]); };
      });
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
    var item = {
      id: "cake_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      name: String(payload.cakeName || "暖光手作蛋糕").slice(0, 24),
      price: 0,
      merchant: "东汉工坊 · 蛋糕工坊",
      type: "甜品手作",
      category: "food",
      description: String(payload.cakeDesc || "东汉工坊亲手抹面裱花的专属蛋糕").slice(0, 120),
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
    var charId = String(payload.charId || "");
    if (!charId) return { ok: false, message: "请先选择一位要转发的传讯好友" };
    var chStore = global.chatHistoryStore;
    if (!chStore || (typeof chStore.appendMessage !== "function" && typeof chStore.saveMessages !== "function")) {
      return { ok: false, message: "未检测到传讯消息存储模块" };
    }
    var thumb = await compressDataUrl(payload.posterDataUrl || "", 640, 0.84);
    var now = Date.now();
    var d = new Date(now);
    var timeStr = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    var userNote = String(payload.forwardNote || "").trim();
    var lines = [
      "【东汉工坊 · 蛋糕工坊分享】" + String(payload.cakeName || "暖光手作蛋糕") + (payload.plaqueText ? "（刻字：" + payload.plaqueText + "）" : "")
    ];
    if (payload.cakeDesc) lines.push("配方：" + String(payload.cakeDesc).slice(0, 90));
    if (userNote) lines.push("附言：" + userNote.slice(0, 80));
    if (payload.reviewDialogue) lines.push("品鉴记：" + String(payload.reviewDialogue).slice(0, 90));

    var msgObj = {
      id: "cake_fwd_" + now,
      text: lines.join("\n"),
      image: thumb || undefined,
      isMe: true,
      time: timeStr,
      timestamp: now
    };

    try {
      if (typeof chStore.appendMessage === "function") {
        await chStore.appendMessage(charId, msgObj);
      } else {
        var prevRes = typeof chStore.getMessages === "function" ? await chStore.getMessages(charId, 1, 200) : null;
        var prevList = (prevRes && Array.isArray(prevRes.messages)) ? prevRes.messages : [];
        await chStore.saveMessages(charId, prevList.concat([msgObj]));
      }

      // Sync chat list preview cleanly
      try {
        if (global.chatCharacterStore && typeof global.chatCharacterStore.getAll === "function" && typeof global.chatCharacterStore.save === "function") {
          var allChars = await global.chatCharacterStore.getAll();
          var targetChar = Array.isArray(allChars) && allChars.find(function (c) { return c && String(c.id) === charId; });
          if (targetChar) {
            targetChar.lastMessage = "[蛋糕工坊] " + String(payload.cakeName || "手作蛋糕");
            targetChar.lastTime = timeStr;
            await global.chatCharacterStore.save(targetChar);
          }
        }
      } catch (_) {}

      if (typeof global.dispatchEvent === "function" && typeof CustomEvent === "function") {
        global.dispatchEvent(new CustomEvent("chatHistoryUpdated", { detail: { chatId: charId } }));
        global.dispatchEvent(new CustomEvent("reloadChats"));
      }
      return { ok: true, message: "已成功转发至「" + (payload.charName || "好友") + "」的传讯聊天" };
    } catch (e) {
      return { ok: false, message: "转发传讯失败：" + (e && e.message ? e.message : e) };
    }
  }

  // ==================== 5. Fullscreen Iframe Host Component ====================

  function CakeWorkshopHostModal(props) {
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

        if (data.type === "WORKSHOP_CAKE_CLOSE") {
          if (typeof onClose === "function") onClose();
          return;
        }
        if (data.type === "WORKSHOP_CAKE_REQUEST_SYNC") {
          await pushLightSync();
          return;
        }
        if (!win) return;

        var reqId = data.requestId;
        if (data.type === "WORKSHOP_CAKE_STEP_RELAY_REQUEST") {
          try {
            var res1 = await handleStepRelay(data.payload || {});
            win.postMessage({ type: "WORKSHOP_CAKE_STEP_RELAY_RESPONSE", requestId: reqId, result: res1 }, "*");
          } catch (e1) {
            win.postMessage({ type: "WORKSHOP_CAKE_STEP_RELAY_RESPONSE", requestId: reqId, error: String(e1 && e1.message || e1) }, "*");
          }
        } else if (data.type === "WORKSHOP_CAKE_FULL_MAKE_REQUEST") {
          try {
            var res2 = await handleCharFullMake(data.payload || {});
            win.postMessage({ type: "WORKSHOP_CAKE_FULL_MAKE_RESPONSE", requestId: reqId, result: res2 }, "*");
          } catch (e2) {
            win.postMessage({ type: "WORKSHOP_CAKE_FULL_MAKE_RESPONSE", requestId: reqId, error: String(e2 && e2.message || e2) }, "*");
          }
        } else if (data.type === "WORKSHOP_CAKE_TASTE_REQUEST") {
          try {
            var res3 = await handleCharTaste(data.payload || {});
            win.postMessage({ type: "WORKSHOP_CAKE_TASTE_RESPONSE", requestId: reqId, result: res3 }, "*");
          } catch (e3) {
            win.postMessage({ type: "WORKSHOP_CAKE_TASTE_RESPONSE", requestId: reqId, error: String(e3 && e3.message || e3) }, "*");
          }
        } else if (data.type === "WORKSHOP_CAKE_FEEDBACK_REQUEST") {
          try {
            var res4 = await handleUserFeedbackReply(data.payload || {});
            win.postMessage({ type: "WORKSHOP_CAKE_FEEDBACK_RESPONSE", requestId: reqId, result: res4 }, "*");
          } catch (e4) {
            win.postMessage({ type: "WORKSHOP_CAKE_FEEDBACK_RESPONSE", requestId: reqId, error: String(e4 && e4.message || e4) }, "*");
          }
        } else if (data.type === "WORKSHOP_CAKE_SAVE_BACKPACK") {
          var bpRes = await saveCakeToBackpack(data.payload || {});
          win.postMessage({ type: "WORKSHOP_CAKE_ACTION_RESULT", requestId: reqId, result: bpRes }, "*");
        } else if (data.type === "WORKSHOP_CAKE_SEND_CHAT") {
          var chRes = await sendCakeToChat(data.payload || {});
          win.postMessage({ type: "WORKSHOP_CAKE_ACTION_RESULT", requestId: reqId, result: chRes }, "*");
        } else if (data.type === "WORKSHOP_CAKE_SAVE_HISTORY") {
          var shRes = await saveCakeHistoryRecord(data.payload || {});
          win.postMessage({ type: "WORKSHOP_CAKE_ACTION_RESULT", requestId: reqId, result: shRes }, "*");
        } else if (data.type === "WORKSHOP_CAKE_LIST_HISTORY") {
          var lhRes = await listCakeHistoryRecords();
          win.postMessage({ type: "WORKSHOP_CAKE_ACTION_RESULT", requestId: reqId, result: lhRes }, "*");
        } else if (data.type === "WORKSHOP_CAKE_DELETE_HISTORY") {
          var dhRes = await deleteCakeHistoryRecord(data.payload && data.payload.id);
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
          background: "#FFF8EE",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          touchAction: "none"
        }
      },
      h("iframe", {
        ref: iframeRef,
        src: "./蛋糕抹面.html",
        title: "东汉工坊 · 蛋糕工坊",
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

