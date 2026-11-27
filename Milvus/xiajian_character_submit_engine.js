/**
 * Milvus/xiajian_character_submit_engine.js
 * 主屏幕应用「狭间 · 天道收容所」独立名士呈报引擎 & 1:1 复古活页历程单 UI（Step 1）
 *
 * 功能：
 * 1. 参考名士 6 项完整角色配置 + 已开启世界书 + 近期传讯上下文（严禁强行绑定用户、严禁模板化）
 * 2. 6 类随机遭遇种子池，生成 XJ-Mxx 完整收容物档案 + 活点轨迹 + 4~6 条带具体日期时辰的遭遇历程
 * 3. 1:1 复刻复古活页目录页 UI（做旧斑驳纸面 + 右侧金属活页装订环 + 茶渍水印 + 选中项手绘粗黑墨条反白高亮）
 * 4. 严格零 Emoji，100% 极简矢量 SVG，零改动 Milvus/app.min.js
 */
(function (global) {
  "use strict";

  var ENCOUNTER_SEEDS = [
    {
      id: "daily_bureau",
      title: "公务/日常偶得",
      hint: "该名士在批阅文书、清点库房、饮茶、练武或日常起居时随手撞见一件不起眼的异物。危险度偏低或中等（1~3级），起初他根本没当回事，反而闹出几段极符合其性格的荒诞或别扭插曲，最后忍无可忍才打包呈报狭间。"
    },
    {
      id: "solo_journey",
      title: "远行/暗访奇遇",
      hint: "该名士独自在外地办差、避雨、夜行或访旧时偶遇诡异器物或规则异象（2~4级），在无人知晓的客栈、渡口或旧坊里独自与之周旋了数个时辰，全程不必让用户出场。"
    },
    {
      id: "mystery_gift",
      title: "无名转赠之物",
      hint: "有人托人送来一件不署名的古物、信笺或器皿（1~3级）。该名士明知蹊跷，却因好奇、职责或某段隐秘旧事留了一两日，随后身边开始出现细微错位，察觉不妙后果断封匣移交狭间。"
    },
    {
      id: "old_belonging",
      title: "旧物突生异变",
      hint: "该名士府中存放多年或随身携带着的一件寻常旧物，因建木根系波动突然沾染异规（2~4级），短暂勾出他平时绝不外露的执念、旧习惯或性格反差，最后被他冷静亲手封存送入狭间。"
    },
    {
      id: "high_risk_solo",
      title: "孤身硬扛高危异象",
      hint: "该名士撞见危险度颇高的裂隙异象（3~5级），极早期便遭到认知干扰、幻听或时间错位。他凭借自身手段与性格底色硬生生扛过数个时辰并设法镇压，最后面无表情地将其押送入库。"
    },
    {
      id: "faint_echo",
      title: "独处间隙的微妙余波",
      hint: "在某段独处或近期传讯之后的心绪间隙里，该名士在案头或街巷偶遇一件隐约呼应他当下心境的怪异（1~4级），无需刻意拉用户入场，自己悄悄消化、受了一点微妙影响后，冷静写下呈报卷宗。"
    }
  ];

  // ==================== 1. LLM & Tolerant JSON Parsing ====================

  function callSubmitLLM(sysPrompt, userPrompt) {
    return new Promise(function (resolve) {
      if (typeof global.sendToLLM !== "function") {
        resolve(null);
        return;
      }
      var settled = false;
      var timer = setTimeout(function () {
        if (!settled) { settled = true; resolve(null); }
      }, 48000);
      try {
        global.sendToLLM(
          [
            { role: "system", content: sysPrompt },
            { role: "user", content: userPrompt }
          ],
          { temperature: 0.88, top_p: 0.92, disableMCP: true },
          function (res) {
            if (!settled) { settled = true; clearTimeout(timer); resolve(String(res || "")); }
          },
          function () {
            if (!settled) { settled = true; clearTimeout(timer); resolve(null); }
          }
        );
      } catch (_) {
        if (!settled) { settled = true; clearTimeout(timer); resolve(null); }
      }
    });
  }

  function parseCharacterSubmitJson(rawText) {
    if (!rawText) return null;
    var cleaned = String(rawText)
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    try {
      var direct = JSON.parse(cleaned);
      if (direct && typeof direct === "object") return direct;
    } catch (_) {}

    var startIdx = cleaned.indexOf("{");
    var endIdx = cleaned.lastIndexOf("}");
    if (startIdx >= 0 && endIdx > startIdx) {
      try {
        var sliced = cleaned.slice(startIdx, endIdx + 1).replace(/,\s*([}\]])/g, "$1");
        return JSON.parse(sliced);
      } catch (_) {}
    }

    // Salvage partial fields + any complete chronicle objects if truncated near end
    if (startIdx >= 0) {
      var out = {};
      var strFields = [
        "name", "reactionType", "containmentDifficulty",
        "responseGuide", "description", "redactedSecret",
        "anomalyEffectHint", "summaryNote"
      ];
      for (var i = 0; i < strFields.length; i++) {
        var key = strFields[i];
        var re = new RegExp('"' + key + '"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"');
        var m = cleaned.match(re);
        if (m) {
          try { out[key] = JSON.parse('"' + m[1] + '"'); } catch (_) { out[key] = m[1]; }
        }
      }
      var lvMatch = cleaned.match(/"dangerLevel"\s*:\s*(\d)/);
      if (lvMatch) out.dangerLevel = Number(lvMatch[1]);

      var chronPos = cleaned.indexOf('"submitterChronicle"');
      if (chronPos >= 0) {
        var sub = cleaned.slice(chronPos);
        var Engine = global.XiajianEngine;
        if (Engine && typeof Engine.extractJsonArraySafe === "function") {
          // extractJsonArraySafe checks name && description; parse chronicle items manually
          var salvagedChron = [];
          var depth = 0, inStr = false, esc = false, sPos = -1;
          for (var j = 0; j < sub.length; j++) {
            var ch = sub[j];
            if (inStr) {
              if (esc) esc = false;
              else if (ch === "\\") esc = true;
              else if (ch === '"') inStr = false;
              continue;
            }
            if (ch === '"') inStr = true;
            else if (ch === "{") { if (depth === 0) sPos = j; depth++; }
            else if (ch === "}") {
              depth--;
              if (depth === 0 && sPos >= 0) {
                try {
                  var item = JSON.parse(sub.slice(sPos, j + 1).replace(/,\s*([}\]])/g, "$1"));
                  if (item && (item.timeLabel || item.headline) && item.detail) {
                    salvagedChron.push(item);
                  }
                } catch (_) {}
                sPos = -1;
              }
            }
          }
          if (salvagedChron.length > 0) out.submitterChronicle = salvagedChron;
        }
      }
      if (out.name && out.description) return out;
    }

    return null;
  }

  function parseCharacterSubmitBatchJson(rawText) {
    if (!rawText) return [];
    var cleaned = String(rawText)
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    try {
      var direct = JSON.parse(cleaned);
      if (Array.isArray(direct)) return direct;
      if (direct && Array.isArray(direct.anomalies)) return direct.anomalies;
      if (direct && typeof direct === "object" && direct.name && direct.description) return [direct];
    } catch (_) {}

    var arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        var parsedArr = JSON.parse(arrMatch[0].replace(/,\s*([}\]])/g, "$1"));
        if (Array.isArray(parsedArr)) return parsedArr;
      } catch (_) {}
    }

    // Salvage every complete top-level `{ ... }` anomaly object from truncated JSON array
    var salvaged = [];
    var depth = 0;
    var inStr = false;
    var esc = false;
    var start = -1;
    for (var i = 0; i < cleaned.length; i++) {
      var ch = cleaned[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "{") {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0 && start >= 0) {
          var slice = cleaned.slice(start, i + 1).replace(/,\s*([}\]])/g, "$1");
          try {
            var obj = JSON.parse(slice);
            if (obj && typeof obj === "object" && obj.name && obj.description) {
              salvaged.push(obj);
            }
          } catch (_) {}
          start = -1;
        }
      }
    }
    if (salvaged.length > 0) return salvaged;

    var single = parseCharacterSubmitJson(cleaned);
    return single ? [single] : [];
  }

  function buildOfflineCharacterBatch(charName, cue, count) {
    var cueText = cue ? "（引子：" + cue + "）" : "";
    var pool = [
      {
        name: "慢半拍黑漆旧匣",
        reactionType: "器物系怪异",
        dangerLevel: 2,
        containmentDifficulty: "中",
        traits: ["non_comm"],
        responseGuide: "勿在亥时开启匣盖，若闻轻叩声，原地合匣即可。",
        description: "由" + charName + "于近期处理琐务时封存移交的黑漆旧匣" + cueText + "。匣内空无一物，却会在案面投下比当下慢半刻的烛影。",
        redactedSecret: "匣底夹层粘着半片旧纸，墨迹与" + charName + "多年前途经某处的地名吻合。",
        anomalyEffectHint: "令靠近者短暂陷入似曾相识的旧日错觉。",
        patrolNodes: ["I", "III", "IV"],
        sightings: [{ date: "建安三年·近录", nodeId: "I", note: "由" + charName + "亲自封缄移交狭间。" }],
        summaryNote: "这东西放在案头太碍事，烦请狭间替我收好。",
        submitterChronicle: [
          { timeLabel: "初四 · 辰时", headline: "案角偶见，未置可否", mentalShift: "不以为意", detail: "一早起来便见案角多了这只黑漆匣子。我当是下人放错了地方，随手推到一边，没打算在它身上浪费工夫。" },
          { timeLabel: "初四 · 申时三刻", headline: "影慢半拍，初觉古怪", mentalShift: "暗自留心", detail: "日头都偏西了，这匣子的影子倒还死死赖在午后的角度不动。我伸手碰了下匣边，凉得不太像木头。" },
          { timeLabel: "初五 · 亥时", headline: "夜半轻叩，短时失神", mentalShift: "微受扰动", detail: "夜里静下来后，匣子竟贴着我心跳的拍子笃笃响起来。有那么一瞬我差点以为自己还留在多年前那间旧屋里，回神时墨笔已经划破了半张纸。" },
          { timeLabel: "初六 · 卯时", headline: "青布封缄，送入狭间", mentalShift: "果断脱手", detail: "再留它过夜纯属自找麻烦。天刚亮我就拿青布裹死打了结，直接让人送进狭间，眼不见为净。" }
        ]
      },
      {
        name: "倒写回执竹签",
        reactionType: "言灵系怪异",
        dangerLevel: 1,
        containmentDifficulty: "低",
        traits: [],
        responseGuide: "阅毕倒扣案面，勿照签上反话作答。",
        description: "一枚混入寻常公文筒中的旧竹签，凡经过其旁默念之事，签面皆会浮出截然相反的一句批注。",
        redactedSecret: "竹签背面的刻痕似乎在模仿持有者的笔锋，越看越像自己亲手所写。",
        anomalyEffectHint: "容易诱使人一时嘴快说出心里反话。",
        patrolNodes: ["I", "II"],
        sightings: [{ date: "建安三年·近录", nodeId: "II", note: "由" + charName + "自案牍中挑出呈报。" }],
        summaryNote: "虽不伤人，但天天跟我抬杠实在烦人。",
        submitterChronicle: [
          { timeLabel: "初八 · 巳时", headline: "文筒夹带，误作寻常", mentalShift: "随手搁置", detail: "拆公文时掉出来这么根竹签，我原以为是谁夹的记号，顺手扔在砚台边便没再管。" },
          { timeLabel: "初八 · 酉时", headline: "签面生字，句句唱反", mentalShift: "哭笑不得", detail: "我不过心里嘀咕了一句今晚早点歇息，低头就见竹签上浮出个「彻夜莫眠」。起初还以为自己眼花，拿袖子擦了两次，字反倒更深了。" },
          { timeLabel: "初九 · 午时", headline: "懒得周旋，封筒移交", mentalShift: "干脆利落", detail: "留着它迟早要把我气笑，干脆拿蜡封了竹筒一并送来狭间，省得它继续在案头上多嘴。" }
        ]
      },
      {
        name: "无雨湿阶青石",
        reactionType: "规则系怪异",
        dangerLevel: 3,
        containmentDifficulty: "中",
        traits: ["aggressive"],
        responseGuide: "切勿赤足或久立湿痕中央，见水渍蔓延即退三步。",
        description: "一块自旧驿道带回的青石残片，晴日亦会渗出微咸冷水，在地面映出并非当下的夜雨街景。",
        redactedSecret: "水中倒影里总有一把无人撑起的破伞，正一步步朝石边挪近。",
        anomalyEffectHint: "令凝视水洼者短暂丧失方位感，错闻远处急雨与马蹄。",
        patrolNodes: ["II", "III", "V"],
        sightings: [{ date: "建安三年·近录", nodeId: "V", note: "由" + charName + "外行返程时带回封存。" }],
        summaryNote: "返程途中捡的麻烦，靴底湿了一路，已封石匣送至。",
        submitterChronicle: [
          { timeLabel: "十一 · 申时", headline: "晴日湿阶，偶拾残石", mentalShift: "起疑查探", detail: "大晴天的驿馆台阶偏偏湿了一块，怎么晒都不干。我蹲下去拨开苔藓，撬出这么块巴掌大的青石，拿帕子包了带在身上。" },
          { timeLabel: "十二 · 子时", headline: "房中生雾，耳闻急雨", mentalShift: "提高戒备", detail: "夜里歇在客舍，外头明明月朗星稀，屋里却平白响起倾盆雨声。低头一看，青石渗出的水已经漫到我靴边，水面映出的根本不是这间屋子。" },
          { timeLabel: "十二 · 丑时", headline: "退步避影，盐灰镇压", mentalShift: "冷静应对", detail: "水里那道影子明显在往我这边挪。我没多看，退开三步撒了一圈粗盐和灶灰，水势这才勉强收住。" },
          { timeLabel: "十三 · 辰时", headline: "装匣押送，移交狭间", mentalShift: "妥善收尾", detail: "一早启程便把这东西封进双层木匣直接送来狭间。外头风波多，这种会自己涨水的石头还是关在你们这儿稳妥。" }
        ]
      },
      {
        name: "失声铜风铎",
        reactionType: "认知系怪异",
        dangerLevel: 4,
        containmentDifficulty: "高",
        traits: ["lethal", "non_comm"],
        responseGuide: "严禁在其无风自摆时开口发声，须以厚棉塞死铃舌。",
        description: "一只檐角取下的暗青铜铎，无风自摇却全无声响，反会吞噬方圆十步内所有人的声音与短时记忆。",
        redactedSecret: "被吞噬的声音并未消失，而是在铎身内壁积攒，待某日骤然一并倾泻。",
        anomalyEffectHint: "令身处其侧者短暂失语，只能听见自己脑中放大数倍的旧日念头。",
        patrolNodes: ["IV", "VI", "VII"],
        sightings: [{ date: "建安三年·近录", nodeId: "VI", note: "由" + charName + "孤身封舌后移交。" }],
        summaryNote: "这东西比预想的凶险，棉絮别拆，直接入高危库。",
        submitterChronicle: [
          { timeLabel: "十五 · 戌时", headline: "古檐无声，初触异象", mentalShift: "骤生警觉", detail: "路过荒废旧阁时，明明风刮得厉害，檐下那只铜铎摆得飞快却半点声音都没有。我刚开口唤了一声随从，才惊觉自己喉咙里根本发不出声。" },
          { timeLabel: "十五 · 戌时三刻", headline: "十步死寂，念头回响", mentalShift: "强自镇定", detail: "周围安静得令人发毛，连脚步声都被吞得一干二净，脑子里却全是过去几年的零碎杂音翻来覆去地撞。我咬破舌尖稳住神智，没敢再多停。" },
          { timeLabel: "十五 · 亥时", headline: "裂帛塞舌，强行摘铎", mentalShift: "果决压制", detail: "屏住气扯下里衣撕成厚布条，趁它摆幅减缓的一瞬死死塞住铜舌，连绳带钩一并斩落裹紧。" },
          { timeLabel: "十六 · 卯时", headline: "星夜兼程，押入狭间", mentalShift: "冷淡交接", detail: "不敢在半路多耽搁，天没亮便亲自送来狭间。记着把棉絮再加厚两层，这玩意儿可不是拿来摆着看的。" }
        ]
      }
    ];
    return pool.slice(0, Math.max(3, Math.min(5, count || 4)));
  }

  // ==================== 2. Main Generator: Character Submitted Batch (3~5 Anomalies) ====================

  async function generateCharacterSubmittedBatch(params) {
    var Engine = global.XiajianEngine;
    var Catalog = global.XiajianCatalogData || {};
    if (!Engine) throw new Error("XiajianEngine 未加载");

    var targetCount = Math.max(3, Math.min(5, Math.floor(Number((params && params.count) || 4))));
    var charObj = params && params.charObj;
    if (!charObj) {
      var chars = await Engine.getAvailableCharacters();
      if (!chars || chars.length === 0) {
        throw new Error("通讯录中暂无可用名士，请先添加角色或切换「亲自录入」");
      }
      charObj = chars[Math.floor(Math.random() * chars.length)];
    }

    var optionalCue = String((params && params.optionalCue) || "").trim().slice(0, 120);
    // Shuffle seeds so each of the 3~5 anomalies has a distinct encounter archetype
    var shuffledSeeds = ENCOUNTER_SEEDS.slice().sort(function () { return Math.random() - 0.5; });
    var pickedSeeds = shuffledSeeds.slice(0, targetCount);
    var seedLines = pickedSeeds.map(function (s, idx) {
      return (idx + 1) + ". " + s.title + "：" + s.hint;
    }).join("\n");

    var ctx = await Engine.collectInspectionContext({
      charObj: charObj,
      anomaly: { id: "draft", code: "", name: "", description: "" }
    });
    var wbSummary = typeof Engine.getEnabledWorldBookSummary === "function"
      ? await Engine.getEnabledWorldBookSummary()
      : { count: 0, titles: [], fullText: "" };

    var existing = await Engine.getAllAnomalies();
    var existingNames = existing.map(function (a) { return a.name; });
    var mSeqStart = existing.filter(function (a) {
      return a.code && a.code.indexOf("XJ-M") === 0;
    }).length + 1;

    var sysPrompt =
      "你是「狭间 · 天道收容所」的机密档案编纂官。现在由传讯名士「" + ctx.charName + "」一次性呈报恰好 " + targetCount + " 宗他在不同时间/经历中亲自发现并送来的异常收容物，每宗都须附带他**亲口/亲笔第一人称风格**写就的【名士遭遇历程单】。\n\n" +
      "【呈报名士 6 项完整配置（最高遵从：历程单正文与附言的说话口吻必须 100% 贴合其语言风格、自称习惯、性格特点与 MBTI！）】\n" + ctx.charProfileText + "\n\n" +
      (wbSummary.fullText ? "【当前已开启的世界书设定（自然融入背景与专有名词）】\n" + wbSummary.fullText + "\n\n" : "") +
      (ctx.recentChatText
        ? "【传讯中近期聊天上下文（仅参考该名士近期心境、口癖与生活切片，严禁强行把异常都写成与用户强相关！）】\n" + ctx.recentChatText + "\n\n"
        : "") +
      "【本次 " + targetCount + " 宗异常各自参考的随机遭遇走向（去模板化、彼此风格迥异）】\n" + seedLines + "\n\n" +
      "【排重黑名单（严禁与以下已有收容物重名或雷同）】\n" + (existingNames.join("、") || "无") + "\n\n" +
      "【核心铁律】\n" +
      "1. 严禁使用任何 Emoji！\n" +
      "2. **历程单口吻铁律**：每条 `submitterChronicle` 里的 `detail`（时辰详述正文）以及 `summaryNote`（呈报附言），**严禁使用第三人称旁白（如「" + ctx.charName + "看到……」）！必须完全以「" + ctx.charName + "」自己的第一人称口吻（使用该角色人设卡中符合其身份的「我/本王/某/孤」等自称与专属语气、用词习惯、吐槽或克制感）来讲述当时亲历的经过与内心反应！**\n" +
      "3. **不要强行绑定用户！** 除非用户手写了引子，否则请围绕「" + ctx.charName + "」自己这一阶段的政务、旅途、旧事、独处或人际见闻自由发散。\n" +
      "4. 危险等级（1~5）须在 " + targetCount + " 宗之间有自然梯度差异，受影响深浅按具体情况而定，切忌每宗都套同一模板。\n" +
      "5. **不要生成 observationLogs**（司隙司手札由用户后续按需懒生成）。\n" +
      "6. 每宗的 `submitterChronicle` 包含 3~5 个带古代日期与时辰的节点（如 `初三 · 辰时`、`同日 · 申时`、`次日 · 亥时`），`detail` 控制在 55~110 字之间，精炼传神。\n" +
      "7. 活点地图节点 ID 仅限：I, II, III, IV, V, VI, VII；traits 仅限 lethal / non_comm / aggressive / unkillable。\n" +
      "8. 请严格输出包含 " + targetCount + " 个对象的合法 JSON 数组（禁止多余解释或 Markdown）：\n" +
      '[\n  {\n' +
      '    "name": "收容物名称(3~10字)",\n' +
      '    "reactionType": "器物系怪异 / 言灵系怪异 / 规则系怪异 / 认知系怪异 / 民俗系怪异",\n' +
      '    "dangerLevel": 1到5的整数,\n' +
      '    "containmentDifficulty": "低或中或高",\n' +
      '    "traits": [],\n' +
      '    "responseGuide": "30~65字应对指南",\n' +
      '    "description": "80~140字SCP东汉风档案正文",\n' +
      '    "redactedSecret": "40~75字涂黑真相",\n' +
      '    "anomalyEffectHint": "一句话说明影响",\n' +
      '    "patrolNodes": ["I", "II", "III"],\n' +
      '    "sightings": [{"date": "建安三年·近录", "nodeId": "I", "note": "简短发现记录"}],\n' +
      '    "summaryNote": "用" + ctx.charName + "本人第一人称说话风格写的简短呈报附言(15~40字)",\n' +
      '    "submitterChronicle": [\n' +
      '      {"timeLabel": "初三 · 辰时", "headline": "6~12字短标题", "mentalShift": "4字状态", "detail": "55~110字，严格用" + ctx.charName + "自己的第一人称说话口吻叙述当时亲历与被影响的经过"}\n' +
      '    ]\n' +
      '  }\n]';

    var userPrompt =
      "请以名士「" + ctx.charName + "」的个人经历与专属说话口吻，一次性生成 " + targetCount + " 宗风格各异的呈报异常卷宗与第一人称历程单（仅输出 JSON 数组）。" +
      (optionalCue ? "\n补充灵感引子（请自然融入其中至少 1~2 宗）：「" + optionalCue + "」" : "\n无额外限定，请结合人设卡与世界书自由发散。");

    var aiRaw = await callSubmitLLM(sysPrompt, userPrompt);
    var parsedArr = parseCharacterSubmitBatchJson(aiRaw);
    var usedAi = parsedArr.length >= 1;
    var sourceItems = usedAi
      ? parsedArr.slice(0, 5)
      : buildOfflineCharacterBatch(ctx.charName, optionalCue, targetCount);

    var validNodes = { I: 1, II: 1, III: 1, IV: 1, V: 1, VI: 1, VII: 1 };
    var validTraits = { lethal: 1, non_comm: 1, aggressive: 1, unkillable: 1 };
    var offlinePool = buildOfflineCharacterBatch(ctx.charName, optionalCue, targetCount);
    var savedRecords = [];
    var nowTs = Date.now();

    for (var idx = 0; idx < sourceItems.length; idx++) {
      var src = sourceItems[idx];
      if (!src || !src.name) continue;
      var code = "XJ-M" + String(mSeqStart + savedRecords.length).padStart(2, "0");
      var lv = Math.max(1, Math.min(5, Math.floor(Number(src.dangerLevel) || ((idx % 4) + 1))));
      var lvMeta = (Catalog.DANGER_LEVELS && Catalog.DANGER_LEVELS[lv]) || { scale: "群体", webglMood: "amber_dust" };
      var pNodes = Array.isArray(src.patrolNodes)
        ? src.patrolNodes.filter(function (n) { return validNodes[n]; }).slice(0, 5)
        : [];
      if (pNodes.length < 2) pNodes = ["I", "III", "IV"];

      var traits = Array.isArray(src.traits)
        ? src.traits.filter(function (t) { return validTraits[t]; })
        : [];

      var fallbackItem = offlinePool[idx % offlinePool.length];
      var rawChron = Array.isArray(src.submitterChronicle) && src.submitterChronicle.length >= 2
        ? src.submitterChronicle.slice(0, 6)
        : fallbackItem.submitterChronicle;

      var chronicle = rawChron.map(function (c, cIdx) {
        return {
          index: cIdx + 1,
          timeLabel: String((c && c.timeLabel) || ("第" + (cIdx + 1) + "日 · 辰时")).trim().slice(0, 20),
          headline: String((c && c.headline) || "异常纪事").trim().slice(0, 22),
          mentalShift: String((c && c.mentalShift) || "如常").trim().slice(0, 10),
          detail: String((c && c.detail) || "").trim()
        };
      });

      var rec = {
        id: code + "_" + (nowTs + idx),
        code: code,
        name: String(src.name).trim().slice(0, 18),
        reactionType: String(src.reactionType || "器物系怪异").trim().slice(0, 12),
        dangerLevel: lv,
        scale: lvMeta.scale,
        containmentDifficulty: ["低", "中", "高"].indexOf(src.containmentDifficulty) >= 0
          ? src.containmentDifficulty
          : lv >= 4 ? "高" : lv >= 2 ? "中" : "低",
        traits: traits,
        imageUrl: "",
        webglMood: lvMeta.webglMood || "amber_dust",
        responseGuide: String(src.responseGuide || "保持安全距离，按规封存观察。").trim(),
        description: String(src.description || "").trim(),
        redactedSecret: String(src.redactedSecret || "卷宗末页似有涂改痕迹，暂未查明源头。").trim(),
        anomalyEffectHint: String(src.anomalyEffectHint || "可能引发贴合个体性格的微妙认知偏移。").trim(),
        patrolNodes: pNodes,
        sightings: Array.isArray(src.sightings) && src.sightings.length > 0
          ? src.sightings.slice(0, 3)
          : [{ date: "建安三年·近录", nodeId: pNodes[0], note: "由" + ctx.charName + "呈报收录入狭间。" }],
        observationLogs: [],
        logsLazyPending: true,
        source: "character_submission",
        isCustom: true,
        submitter: {
          charId: ctx.charId,
          charName: ctx.charName,
          mbti: String((charObj && charObj.mbti) || ""),
          summaryNote: String(src.summaryNote || fallbackItem.summaryNote).trim().slice(0, 80)
        },
        submitterChronicle: chronicle,
        createdAt: nowTs + idx
      };

      await Engine.saveCustomAnomaly(rec);
      savedRecords.push(rec);
    }

    return {
      records: savedRecords,
      record: savedRecords[0] || null,
      usedAi: usedAi,
      charName: ctx.charName
    };
  }

  async function generateCharacterSubmittedAnomaly(params) {
    return generateCharacterSubmittedBatch(params);
  }

  // ==================== 3. 1:1 Vintage Binder UI: CharacterChronicleBinder ====================

  function BinderRingsSvg(h) {
    // 5 vertical metallic loose-leaf binder rings along the right edge (1:1 reference replica)
    var yPositions = [38, 102, 166, 230, 294];
    return h(
      "svg",
      {
        viewBox: "0 0 36 336",
        style: {
          position: "absolute",
          top: 0,
          right: "-2px",
          width: "34px",
          height: "100%",
          pointerEvents: "none",
          zIndex: 4
        }
      },
      yPositions.map(function (cy, idx) {
        return h(
          "g",
          { key: idx },
          // Punched dark hole in aged paper
          h("circle", { cx: 11, cy: cy, r: 4.5, fill: "#2A241E", opacity: 0.88 }),
          h("circle", { cx: 11, cy: cy, r: 5.5, fill: "none", stroke: "rgba(65,52,38,0.45)", strokeWidth: 1 }),
          // Drop shadow under metal ring
          h("path", { d: "M11 " + (cy + 2.5) + " Q23 " + (cy + 1) + " 35 " + (cy + 3.5), fill: "none", stroke: "rgba(0,0,0,0.38)", strokeWidth: 4.5, strokeLinecap: "round" }),
          // Dark iron binder ring bar
          h("path", { d: "M10 " + cy + " Q23 " + (cy - 2) + " 35 " + (cy + 0.5), fill: "none", stroke: "#1E1B18", strokeWidth: 3.6, strokeLinecap: "round" }),
          // Subtle metallic highlight
          h("path", { d: "M13 " + (cy - 1) + " Q23 " + (cy - 2.6) + " 32 " + (cy - 0.8), fill: "none", stroke: "#756D62", strokeWidth: 0.9, strokeLinecap: "round", opacity: 0.7 })
        );
      })
    );
  }

  function CoffeeStainWatermarkSvg(h) {
    // Faint vintage coffee/tea ring watermark at bottom-right (1:1 reference replica)
    return h(
      "svg",
      {
        viewBox: "0 0 180 140",
        style: {
          position: "absolute",
          right: "18px",
          bottom: "-6px",
          width: "168px",
          height: "130px",
          opacity: 0.17,
          pointerEvents: "none",
          zIndex: 1
        }
      },
      h("path", {
        d: "M42 128 C28 96, 44 46, 86 32 C126 19, 162 46, 164 88 C166 112, 152 132, 132 138",
        fill: "none",
        stroke: "#6B563E",
        strokeWidth: 7.5,
        strokeLinecap: "round"
      }),
      h("path", {
        d: "M50 124 C38 96, 52 54, 90 40 C124 28, 154 52, 155 88",
        fill: "none",
        stroke: "#5A4630",
        strokeWidth: 2.2,
        strokeDasharray: "18 7"
      }),
      // Diagonal smudge streak matching lower-left of stain in reference
      h("path", {
        d: "M16 74 L68 122",
        fill: "none",
        stroke: "#6E5A42",
        strokeWidth: 5,
        strokeLinecap: "round",
        opacity: 0.45
      })
    );
  }

  function CharacterChronicleBinder(props) {
    var React = global.React;
    if (!React) return null;
    var h = React.createElement;
    var useEffect = React.useEffect;
    var useState = React.useState;

    var anomaly = props && props.anomaly;
    var chronicle = Array.isArray(anomaly && anomaly.submitterChronicle) ? anomaly.submitterChronicle : [];
    var submitter = (anomaly && anomaly.submitter) || { charName: "传讯名士", summaryNote: "" };

    var [activeIdx, setActiveIdx] = useState(0);

    useEffect(function () {
      setActiveIdx(0);
    }, [anomaly && anomaly.id]);

    if (chronicle.length === 0) {
      return h(
        "div",
        { style: { padding: "24px", textAlign: "center", color: "#B8AEA0", fontSize: "12.5px" } },
        "该收容物暂无名士遭遇历程记录。"
      );
    }

    var safeIdx = Math.max(0, Math.min(chronicle.length - 1, activeIdx));
    var curItem = chronicle[safeIdx];

    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "12px" } },

      // ===== Part 1: 1:1 Weathered Loose-Leaf Binder Index Sheet (参考图原样复刻) =====
      h(
        "div",
        {
          style: {
            position: "relative",
            width: "100%",
            minHeight: "336px",
            boxSizing: "border-box",
            padding: "20px 38px 34px 20px",
            background: "linear-gradient(168deg, #E1D9C8 0%, #D3C9B6 52%, #C6BBA5 100%)",
            borderRadius: "4px 6px 6px 4px",
            border: "1px solid #9E927E",
            borderLeft: "4px solid #8E826E",
            boxShadow:
              "0 12px 28px rgba(0,0,0,0.46), inset 0 0 38px rgba(48, 38, 26, 0.34), inset 8px 0 14px rgba(42, 33, 22, 0.22)",
            fontFamily: "'Songti SC', 'STSong', 'Noto Serif SC', Georgia, serif",
            overflow: "hidden"
          }
        },
        // Subtle aged blotch spot on left margin (复刻参考图左侧墨渍斑点)
        h("div", {
          style: {
            position: "absolute",
            left: "12px",
            top: "42%",
            width: "26px",
            height: "22px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(94,74,54,0.28) 0%, rgba(94,74,54,0) 72%)",
            pointerEvents: "none"
          }
        }),

        // Bottom-right vintage coffee ring watermark
        CoffeeStainWatermarkSvg(h),

        // Right-edge metallic binder rings
        BinderRingsSvg(h),

        // Subtle archival sub-header
        h(
          "div",
          {
            style: {
              position: "relative",
              zIndex: 2,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: "14px",
              paddingBottom: "6px",
              borderBottom: "1px dashed rgba(68, 56, 42, 0.35)"
            }
          },
          h(
            "span",
            { style: { fontSize: "11px", fontWeight: 800, color: "#4A3E31", letterSpacing: "1.5px" } },
            "呈报历程 · " + submitter.charName
          ),
          h(
            "span",
            { style: { fontSize: "10px", color: "#6E5F4E", fontFamily: "monospace" } },
            (anomaly.code || "XJ-M") + " / " + chronicle.length + " 节"
          )
        ),

        // Stacked Chronicle Index Rows (Active row gets rough-edged black ink highlight bar!)
        h(
          "div",
          { style: { position: "relative", zIndex: 2, display: "flex", flexDirection: "column", gap: "10px" } },
          chronicle.map(function (entry, idx) {
            var isSelected = idx === safeIdx;
            var pageNumStr = String(idx + 1).padStart(2, "0");
            return h(
              "button",
              {
                key: idx,
                type: "button",
                onClick: function () { setActiveIdx(idx); },
                style: {
                  position: "relative",
                  textAlign: "left",
                  border: "none",
                  background: isSelected ? "#141312" : "transparent",
                  color: isSelected ? "#F4EDE0" : "#25201B",
                  padding: isSelected ? "9px 12px" : "6px 6px 8px",
                  marginLeft: isSelected ? "-6px" : "0",
                  width: isSelected ? "calc(100% + 10px)" : "100%",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: "10px",
                  fontFamily: "'Songti SC', 'STSong', 'Noto Serif SC', Georgia, serif",
                  borderBottom: isSelected ? "none" : "1px solid rgba(72, 60, 46, 0.28)",
                  boxShadow: isSelected ? "0 3px 10px rgba(0,0,0,0.32)" : "none",
                  // Hand-brushed uneven ink stroke edge via subtle clip-path
                  clipPath: isSelected
                    ? "polygon(1% 4%, 99% 0%, 100% 34%, 98.5% 96%, 94% 100%, 2% 97%, 0% 62%)"
                    : "none",
                  transition: "background 0.16s ease, color 0.16s ease"
                }
              },
              h(
                "div",
                { style: { minWidth: 0, flex: 1, lineHeight: 1.45 } },
                h(
                  "span",
                  {
                    style: {
                      fontSize: "13px",
                      fontWeight: isSelected ? 800 : 700,
                      letterSpacing: "0.4px"
                    }
                  },
                  entry.timeLabel
                ),
                h(
                  "span",
                  {
                    style: {
                      fontSize: "12.5px",
                      fontWeight: isSelected ? 600 : 500,
                      marginLeft: "6px",
                      opacity: isSelected ? 0.95 : 0.88
                    }
                  },
                  "· " + entry.headline
                )
              ),
              h(
                "span",
                {
                  style: {
                    fontSize: "11px",
                    fontFamily: "Georgia, serif",
                    letterSpacing: "1px",
                    color: isSelected ? "#D7CCB9" : "#706252",
                    flexShrink: 0
                  }
                },
                "p. " + pageNumStr
              )
            );
          })
        ),

        // Submitter's brief remark at bottom of binder sheet
        submitter.summaryNote &&
          h(
            "div",
            {
              style: {
                position: "relative",
                zIndex: 2,
                marginTop: "22px",
                paddingTop: "8px",
                borderTop: "1px dotted rgba(72, 60, 46, 0.34)",
                fontSize: "11px",
                color: "#524536",
                fontStyle: "italic",
                lineHeight: 1.6
              }
            },
            "附言：" + submitter.summaryNote
          )
      ),

      // ===== Part 2: Selected Time-Node Detail Paper Card =====
      h(
        "div",
        {
          style: {
            background: "rgba(242, 236, 224, 0.96)",
            border: "1px solid #B8AA92",
            borderLeft: "4px solid #1C1917",
            borderRadius: "6px",
            padding: "14px 16px",
            color: "#28211B",
            boxShadow: "0 6px 18px rgba(0,0,0,0.32)",
            fontFamily: "'Songti SC', 'STSong', 'Noto Serif SC', Georgia, serif"
          }
        },
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginBottom: "8px" } },
          h(
            "div",
            { style: { fontSize: "13.5px", fontWeight: 900, color: "#1A1613" } },
            curItem.timeLabel + " ｜ " + curItem.headline
          ),
          curItem.mentalShift &&
            h(
              "span",
              {
                style: {
                  fontSize: "10.5px",
                  fontWeight: 800,
                  padding: "2px 8px",
                  background: "#1B1816",
                  color: "#EFE6D6",
                  borderRadius: "3px",
                  flexShrink: 0
                }
              },
              curItem.mentalShift
            )
        ),
        h(
          "div",
          { style: { fontSize: "13px", lineHeight: 1.85, color: "#322922" } },
          curItem.detail
        ),
        // Prev / Next Chronicle Node Switcher
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", paddingTop: "8px", borderTop: "1px dashed #CFC4B0" } },
          h(
            "button",
            {
              type: "button",
              disabled: safeIdx <= 0,
              onClick: function () { setActiveIdx(Math.max(0, safeIdx - 1)); },
              style: {
                border: "1px solid #9B8E7A",
                background: safeIdx <= 0 ? "transparent" : "#EFE8DA",
                color: safeIdx <= 0 ? "#A69B8A" : "#2D251E",
                borderRadius: "6px",
                padding: "4px 12px",
                fontSize: "11.5px",
                fontWeight: 700,
                cursor: safeIdx <= 0 ? "not-allowed" : "pointer"
              }
            },
            "上一节点"
          ),
          h(
            "span",
            { style: { fontSize: "11px", color: "#756756", fontWeight: 700 } },
            (safeIdx + 1) + " / " + chronicle.length
          ),
          h(
            "button",
            {
              type: "button",
              disabled: safeIdx >= chronicle.length - 1,
              onClick: function () { setActiveIdx(Math.min(chronicle.length - 1, safeIdx + 1)); },
              style: {
                border: "1px solid #9B8E7A",
                background: safeIdx >= chronicle.length - 1 ? "transparent" : "#EFE8DA",
                color: safeIdx >= chronicle.length - 1 ? "#A69B8A" : "#2D251E",
                borderRadius: "6px",
                padding: "4px 12px",
                fontSize: "11.5px",
                fontWeight: 700,
                cursor: safeIdx >= chronicle.length - 1 ? "not-allowed" : "pointer"
              }
            },
            "下一节点"
          )
        )
      )
    );
  }

  global.XiajianCharSubmitEngine = {
    version: "1.1.0",
    ENCOUNTER_SEEDS: ENCOUNTER_SEEDS,
    parseCharacterSubmitJson: parseCharacterSubmitJson,
    parseCharacterSubmitBatchJson: parseCharacterSubmitBatchJson,
    generateCharacterSubmittedBatch: generateCharacterSubmittedBatch,
    generateCharacterSubmittedAnomaly: generateCharacterSubmittedAnomaly,
    CharacterChronicleBinder: CharacterChronicleBinder
  };
})(typeof window !== "undefined" ? window : globalThis);
