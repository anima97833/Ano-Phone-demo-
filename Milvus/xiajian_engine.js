/**
 * Milvus/xiajian_engine.js
 * 主屏幕应用「狭间 · 天道收容所」独立核心引擎（Step 2）
 *
 * 职责：
 * 1. 独立 IndexedDB（milvus_xiajian_idb）：自定义收容物、涂黑解密状态、AI 续写观测日志、双人巡视回放
 * 2. 全维上下文采集器：角色 6 项完整档案 + 身份配置库 + 开启的世界书 + 当前异常详情与观测日志 + 传讯近期上下文
 * 3. 三大 AI 能力（统一走 window.sendToLLM，带完整零 Emoji 本地兜底）：
 *    - runDualInspection：7分克系规则怪谈 × 5分角色反差，角色真实受异常影响且仅在狭间内演绎完结
 *    - polishCustomAnomalyWithAI：用户填简单简介 -> AI 一键润色完整档案、活点路径与 4 页观测手札
 *    - appendObservationLogWithAI：AI 续写下一页《仙人观测日志》（含正常/异变/鬼画符污染页）
 */
(function (global) {
  "use strict";

  var DB_NAME = "milvus_xiajian_idb";
  var DB_VERSION = 2;
  var STORE_CUSTOM = "custom_anomalies";
  var STORE_EXTRAS = "extra_logs";
  var STORE_VISITS = "visit_records";
  var STORE_MEDIA = "anomaly_media";

  var INSPECTION_ACTIONS = [
    { id: "observe", label: "隔栏观测", desc: "保持安全距离，细致观察异常的细微动向与收容符状态" },
    { id: "communicate", label: "尝试沟通", desc: "隔着封禁线试探搭话（不可沟通项极易触发认知反噬）" },
    { id: "touch", label: "冒险触碰", desc: "近距离接触或以身试险，极易引发异常效应直接侵染" },
    { id: "reinforce", label: "稳固封印", desc: "与同行名士合力补刻镇符、压制建木裂隙躁动" }
  ];

  // ==================== 1. IndexedDB Layer ====================

  var dbPromise = null;

  function openXiajianDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (typeof indexedDB === "undefined") {
        reject(new Error("当前环境不支持 IndexedDB"));
        return;
      }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (ev) {
        var db = ev.target.result;
        if (!db.objectStoreNames.contains(STORE_CUSTOM)) {
          db.createObjectStore(STORE_CUSTOM, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_EXTRAS)) {
          db.createObjectStore(STORE_EXTRAS, { keyPath: "anomalyId" });
        }
        if (!db.objectStoreNames.contains(STORE_VISITS)) {
          var vs = db.createObjectStore(STORE_VISITS, { keyPath: "id" });
          vs.createIndex("by_anomalyId", "anomalyId", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_MEDIA)) {
          db.createObjectStore(STORE_MEDIA, { keyPath: "anomalyId" });
        }
      };
      req.onsuccess = function (ev) { resolve(ev.target.result); };
      req.onerror = function (ev) {
        dbPromise = null;
        reject(ev.target.error || new Error("打开狭间数据库失败"));
      };
    });
    return dbPromise;
  }

  async function idbGetAll(storeName) {
    try {
      var db = await openXiajianDB();
      return await new Promise(function (resolve) {
        var tx = db.transaction(storeName, "readonly");
        var req = tx.objectStore(storeName).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { resolve([]); };
      });
    } catch (_) {
      return [];
    }
  }

  async function idbGet(storeName, key) {
    try {
      var db = await openXiajianDB();
      return await new Promise(function (resolve) {
        var tx = db.transaction(storeName, "readonly");
        var req = tx.objectStore(storeName).get(key);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { resolve(null); };
      });
    } catch (_) {
      return null;
    }
  }

  async function idbPut(storeName, value) {
    var db = await openXiajianDB();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(value);
      tx.oncomplete = function () { resolve(value); };
      tx.onerror = function (ev) { reject(ev.target.error || new Error("写入狭间数据失败")); };
    });
  }

  async function idbDelete(storeName, key) {
    var db = await openXiajianDB();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = function (ev) { reject(ev.target.error || new Error("删除狭间数据失败")); };
    });
  }

  // ==================== 2. Unified AI Caller (window.sendToLLM) ====================

  function extractJsonBlock(rawText) {
    if (!rawText) return null;
    var cleaned = String(rawText)
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch (_) {}
    var m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    var candidate = m[0].replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(candidate);
    } catch (_) {
      return null;
    }
  }

  async function callXiajianLLM(systemPrompt, userPrompt) {
    if (typeof global.sendToLLM !== "function") return null;
    var messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];
    try {
      var reply = await new Promise(function (resolve, reject) {
        var settled = false;
        var timer = setTimeout(function () {
          if (settled) return;
          settled = true;
          reject(new Error("sendToLLM timeout"));
        }, 80000);
        global.sendToLLM(
          messages,
          { disableMCP: true },
          function (res) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(res);
          },
          function (err) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        );
      });
      return reply && String(reply).trim() ? String(reply).trim() : null;
    } catch (e) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[XiajianEngine] sendToLLM failed:", e);
      }
      return null;
    }
  }

  // ==================== 3. Full Context Collector (6D: Char + Persona + WB + Anomaly + Logs + Chat) ====================

  async function getAvailableCharacters() {
    var list = [];
    try {
      var store = global.chatCharacterStore || global.chatCharactersStore;
      if (store && typeof store.getAll === "function") {
        var all = (await store.getAll()) || [];
        list = all.filter(function (c) {
          if (!c || !c.id || !c.name) return false;
          if (c.type === "decor" || c.type === "moments" || c.type === "group" || c.isGroup) return false;
          if (String(c.id).indexOf("group_chat") === 0) return false;
          return true;
        });
      }
    } catch (_) {}
    return list;
  }

  async function collectInspectionContext(params) {
    var baseChar = (params && params.charObj) || {};
    var charId = String(baseChar.id || "");
    var charName = String(baseChar.name || "同行名士");
    var anomaly = (params && params.anomaly) || {};

    // 1) 角色完整 6 项配置
    var fullChar = Object.assign({}, baseChar);
    try {
      var store = global.chatCharacterStore || global.chatCharactersStore;
      if (store && typeof store.getAll === "function") {
        var all = (await store.getAll()) || [];
        var hit = all.find(function (c) {
          return c && ((charId && String(c.id) === charId) || (charName && c.name === charName));
        });
        if (hit) {
          fullChar = Object.assign({}, hit, fullChar, {
            profile: Object.assign({}, hit.profile || {}, fullChar.profile || {})
          });
          if (!charId && hit.id) charId = String(hit.id);
          if ((!charName || charName === "同行名士") && hit.name) charName = hit.name;
        }
      }
    } catch (_) {}

    var cs = {};
    try {
      if (global.localStorage) {
        var csMap = JSON.parse(global.localStorage.getItem("character_settings") || "{}");
        cs = csMap[charId] || csMap[charName] || {};
      }
    } catch (_) {}

    var prof = fullChar.profile || {};
    var charProfileText = [
      "- 角色姓名与ID：" + charName + " (" + (charId || "unknown") + ")",
      "- MBTI 性格类型：" + (prof.mbti || fullChar.mbti || cs.mbti || "未知"),
      "- 星座：" + (prof.constellation || prof.zodiac || fullChar.constellation || cs.constellation || "未知"),
      "- 语言风格：" + String(prof.speakingStyle || prof.style || fullChar.speakingStyle || fullChar.style || cs.speakingStyle || "贴合原著口吻").slice(0, 150),
      "- 性格特点：" + String(prof.personality || fullChar.personality || cs.personality || "性格鲜明").slice(0, 180),
      "- 个人背景：" + String(prof.background || prof.bio || fullChar.background || cs.background || fullChar.desc || "").slice(0, 260)
    ].join("\n");

    try {
      if (charId && global.characterDocStore && typeof global.characterDocStore.getEnabledDocContext === "function") {
        var docTxt = String((await global.characterDocStore.getEnabledDocContext(charId)) || "").slice(0, 320);
        if (docTxt) charProfileText += "\n- 专属长篇档案摘录：" + docTxt;
      }
    } catch (_) {}

    // 2) 用户身份配置库
    var userName = "广陵王";
    var userPersonaText = "";
    try {
      if (global.localStorage) {
        var personas = JSON.parse(global.localStorage.getItem("user_personas") || "[]");
        var activeId =
          global.localStorage.getItem("active_persona_id") ||
          global.localStorage.getItem("active_user_persona_id") ||
          "";
        var activeP =
          (Array.isArray(personas) && personas.find(function (p) { return String(p.id) === String(activeId); })) ||
          (Array.isArray(personas) && personas[0]) ||
          null;
        if (activeP) {
          if (activeP.name) userName = activeP.name;
          userPersonaText = [
            "- 称呼/姓名：" + (activeP.name || "广陵王"),
            activeP.gender ? "- 性别：" + activeP.gender : "",
            activeP.identity ? "- 身份：" + activeP.identity : "",
            activeP.personality || activeP.persona ? "- 性格设定：" + String(activeP.personality || activeP.persona).slice(0, 200) : "",
            activeP.background || activeP.bio ? "- 背景：" + String(activeP.background || activeP.bio).slice(0, 200) : ""
          ].filter(Boolean).join("\n");
        }
      }
    } catch (_) {}

    // 3) 开启的世界书条目
    var worldBookText = "";
    try {
      if (typeof global.getWorldBookContext === "function") {
        worldBookText = String((await global.getWorldBookContext()) || "").trim().slice(0, 600);
      } else if (global.worldBookStore && typeof global.worldBookStore.getData === "function") {
        var wb = await global.worldBookStore.getData();
        var books = Array.isArray(wb && wb.books) ? wb.books : [];
        worldBookText = books
          .filter(function (b) { return b && b.enable !== false && b.content; })
          .map(function (b) { return "【" + (b.title || "设定") + "】" + b.content; })
          .join("\n")
          .slice(0, 600);
      }
    } catch (_) {}

    // 4) 当前异常怪物的具体情况、内容详情与仙人观测日志摘录
    var catalog = global.XiajianCatalogData || {};
    var traitsLabels = (anomaly.traits || [])
      .map(function (tid) { return (catalog.DANGER_TRAITS && catalog.DANGER_TRAITS[tid] && catalog.DANGER_TRAITS[tid].label) || tid; })
      .join("、") || "无额外高危标签";
    var logsSummary = (anomaly.observationLogs || [])
      .slice(-4)
      .map(function (lg) {
        return "[" + (lg.date || "") + "·" + (lg.recorder || "司隙官") + "][" + (lg.checkState || "normal") + "] " +
          String(lg.body || "").slice(0, 80) + (lg.corruptWhisper ? "（异语：" + lg.corruptWhisper.slice(0, 40) + "）" : "");
      })
      .join("\n");

    var anomalyContext = [
      "- 编号与名称：" + (anomaly.code || anomaly.id || "XJ-000") + "「" + (anomaly.name || "未知异常") + "」",
      "- 类型与等级：" + (anomaly.reactionType || "未知系") + " ｜ 危险等级 " + (anomaly.dangerLevel || 1) + " 级 ｜ 量级：" + (anomaly.scale || "个体") + " ｜ 收容难度：" + (anomaly.containmentDifficulty || "低"),
      "- 危险属性：" + traitsLabels,
      "- 应对指南：" + (anomaly.responseGuide || ""),
      "- 异常正文：" + (anomaly.description || ""),
      anomaly.redactedSecret ? "- 机密档案隐情：" + anomaly.redactedSecret : "",
      anomaly.anomalyEffectHint ? "- 对同行者的典型影响机制：" + anomaly.anomalyEffectHint : "",
      logsSummary ? "- 仙人观测日志与过往评论摘录：\n" + logsSummary : ""
    ].filter(Boolean).join("\n");

    // 5) 传讯中角色与该用户的近期上下文（最近 28 条）
    var recentChatText = "";
    try {
      if (charId && global.chatHistoryStore) {
        var rawMsgs = [];
        if (typeof global.chatHistoryStore.getRecentMessages === "function") {
          rawMsgs = (await global.chatHistoryStore.getRecentMessages(charId, 28)) || [];
        } else if (typeof global.chatHistoryStore.getMessages === "function") {
          rawMsgs = (await global.chatHistoryStore.getMessages(charId)) || [];
        }
        recentChatText = rawMsgs
          .filter(function (m) {
            if (!m) return false;
            var t = String(m.text || m.content || "").trim();
            return t && m.type !== "system" && m.type !== "narration";
          })
          .slice(-28)
          .map(function (m) {
            var who = m.isMe || m.sender === "me" || m.sender === "我" || m.role === "user" ? userName : charName;
            return who + "：" + String(m.text || m.content || "").replace(/\s+/g, " ").slice(0, 72);
          })
          .join("\n")
          .slice(-1100);
      }
    } catch (_) {}

    return {
      charId: charId,
      charName: charName,
      userName: userName,
      charProfileText: charProfileText,
      userPersonaText: userPersonaText,
      worldBookText: worldBookText,
      anomalyContext: anomalyContext,
      recentChatText: recentChatText
    };
  }

  // ==================== 4. Anomaly Catalog CRUD & Merging ====================

  async function getAllAnomalies() {
    var catalog = global.XiajianCatalogData || {};
    var builtins = Array.isArray(catalog.BUILTIN_ANOMALIES) ? catalog.BUILTIN_ANOMALIES : [];
    var customs = await idbGetAll(STORE_CUSTOM);
    var extrasList = await idbGetAll(STORE_EXTRAS);
    var mediaList = await idbGetAll(STORE_MEDIA);
    var extrasMap = {};
    for (var i = 0; i < extrasList.length; i++) {
      if (extrasList[i] && extrasList[i].anomalyId) {
        extrasMap[extrasList[i].anomalyId] = extrasList[i];
      }
    }
    var mediaMap = {};
    for (var m = 0; m < mediaList.length; m++) {
      if (mediaList[m] && mediaList[m].anomalyId) {
        mediaMap[mediaList[m].anomalyId] = mediaList[m];
      }
    }

    var merged = builtins.concat(customs).map(function (item) {
      var extra = extrasMap[item.id];
      var media = mediaMap[item.id];
      var baseLogs = Array.isArray(item.observationLogs) ? item.observationLogs : [];
      var extraLogs = extra && Array.isArray(extra.logs) ? extra.logs : [];
      var finalLogs = baseLogs.concat(extraLogs);
      return Object.assign({}, item, {
        observationLogs: finalLogs,
        logsLazyPending: finalLogs.length === 0 && Boolean(item.logsLazyPending),
        redactedUnlocked: Boolean(extra && extra.redactedUnlocked),
        imageUrl: (media && media.imageUrl) || item.imageUrl || "",
        mediaMeta: media || null
      });
    });

    return merged;
  }

  async function getAnomalyMedia(anomalyId) {
    if (!anomalyId) return null;
    return await idbGet(STORE_MEDIA, anomalyId);
  }

  async function saveAnomalyMedia(anomalyId, mediaPayload) {
    if (!anomalyId || !mediaPayload || !mediaPayload.imageUrl) {
      throw new Error("缺少影像数据");
    }
    var rec = {
      anomalyId: anomalyId,
      imageUrl: String(mediaPayload.imageUrl),
      styleLabel: String(mediaPayload.styleLabel || ""),
      styleCustom: String(mediaPayload.styleCustom || ""),
      sourceMode: String(mediaPayload.sourceMode || "builtin_flux"),
      updatedAt: Date.now()
    };
    await idbPut(STORE_MEDIA, rec);
    return rec;
  }

  async function deleteAnomalyMedia(anomalyId) {
    if (!anomalyId) return false;
    return await idbDelete(STORE_MEDIA, anomalyId);
  }

  async function unlockRedactedSecret(anomalyId) {
    var cur = (await idbGet(STORE_EXTRAS, anomalyId)) || { anomalyId: anomalyId, logs: [], redactedUnlocked: false };
    cur.redactedUnlocked = true;
    await idbPut(STORE_EXTRAS, cur);
    return true;
  }

  async function saveCustomAnomaly(anomalyObj) {
    var rec = Object.assign({}, anomalyObj, {
      isCustom: true,
      imageUrl: anomalyObj.imageUrl || "",
      createdAt: anomalyObj.createdAt || Date.now()
    });
    await idbPut(STORE_CUSTOM, rec);
    return rec;
  }

  async function deleteCustomAnomaly(anomalyId) {
    await idbDelete(STORE_CUSTOM, anomalyId);
    return true;
  }

  async function getVisitRecords(anomalyId) {
    try {
      var db = await openXiajianDB();
      return await new Promise(function (resolve) {
        var tx = db.transaction(STORE_VISITS, "readonly");
        var store = tx.objectStore(STORE_VISITS);
        var req = anomalyId ? store.index("by_anomalyId").getAll(anomalyId) : store.getAll();
        req.onsuccess = function () {
          var list = (req.result || []).slice();
          list.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
          resolve(list);
        };
        req.onerror = function () { resolve([]); };
      });
    } catch (_) {
      return [];
    }
  }

  // ==================== 5. AI Feature 1: Dual Inspection Theatre ====================

  async function runDualInspection(params) {
    var anomaly = params && params.anomaly;
    var charObj = params && params.charObj;
    var actionId = (params && params.actionId) || "observe";
    var userCustomInput = String((params && params.userCustomInput) || "").trim();
    var historyTurns = Array.isArray(params && params.historyTurns) ? params.historyTurns.slice(-4) : [];

    if (!anomaly) throw new Error("未选择收容物");
    var ctx = await collectInspectionContext({ charObj: charObj, anomaly: anomaly });
    var actionMeta =
      INSPECTION_ACTIONS.find(function (a) { return a.id === actionId; }) || INSPECTION_ACTIONS[0];
    var isNonComm = Array.isArray(anomaly.traits) && anomaly.traits.indexOf("non_comm") >= 0;

    var prevTurnsText = historyTurns
      .map(function (t, i) {
        return "【第" + (i + 1) + "幕：" + t.actionLabel + "】" + String(t.sceneText || "").slice(0, 140) +
          (t.affectedTag ? "（当时影响：" + t.affectedTag + "）" : "");
      })
      .join("\n");

    var lv = Number(anomaly.dangerLevel) || 2;
    var sysPrompt =
      "你正在执笔「狭间 · 天道收容所」的双人巡视沉浸剧场。\n" +
      "情绪基调：7 分中式克系规则怪谈的诡谲氛围 + 5 分名士真实性格反差与彼此互动张力。\n" +
      "核心原则（务必具体情况具体分析，严禁模板化！）：\n" +
      "1. **绝对禁止一上来就无脑上演「名士一把拉你到身后/扣手腕护短」的套路！**\n" +
      "2. 严格依据「当前异常的危险等级（当前为 " + lv + " 级 · " + (anomaly.scale || "个体") + "）与具体特性」+「名士自身的性格、MBTI、语言风格与背景」+「你们传讯中的真实关系氛围」来自然推演反应：\n" +
      "   - 若为低危（1~2级）或荒诞/言灵/生活类异常：名士完全可能只是饶有兴致地打量、嫌弃吐槽、好奇试探、互相打趣，或是自己先踩了异常规则的坑出点小糗/说了大实话，根本无需紧张护人；\n" +
      "   - 若为中高危（3~5级）或攻击/认知类异常：名士的表现也应贴合其人设——比如冷静分析、各执一词、冷眼旁观、甚至自己先中招陷入短暂失态/认知错位，反而需要你去拉他一把、拆穿幻觉或互相配合脱身，而非千篇一律的单向保护；\n" +
      "3. 同行名士「" + ctx.charName + "」在直面异常时**确实可能被异常规则影响**（程度随行动与危险等级自然浮动，也可能暂时安然无恙），所有异常影响仅在本场狭间巡视内演绎完结。\n" +
      "4. 严禁使用任何 Emoji！严禁套话鸡汤！\n\n" +
      "【同行名士 6 项完整配置（最高遵从）】\n" + ctx.charProfileText + "\n\n" +
      (ctx.userPersonaText ? "【巡视者（用户）身份设定】\n" + ctx.userPersonaText + "\n\n" : "") +
      (ctx.worldBookText ? "【当前已开启的世界书】\n" + ctx.worldBookText + "\n\n" : "") +
      "【当前收容物详细卷宗与观测日志】\n" + ctx.anomalyContext + "\n\n" +
      (ctx.recentChatText ? "【你们在传讯中近期的聊天上下文（自然呼应彼此关系与近期梗）】\n" + ctx.recentChatText + "\n\n" : "") +
      (prevTurnsText ? "【本场巡视前情】\n" + prevTurnsText + "\n\n" : "") +
      "请严格输出合法 JSON（禁止多余说明与 Emoji）：\n" +
      '{\n' +
      '  "sceneText": "160~280字现场沉浸叙事，紧扣该异常当前危险度与规则细节，刻画" + ctx.charName + "符合其真实性格的自然反应（可能是好奇、吐槽、试探、冷静观察、被异常规则捉弄失态，或与你双向互动，严禁动辄套路化护短）",\n' +
      '  "charDialogue": "1~2句贴合角色口吻与当下情境的直白台词（不加多余前缀）",\n' +
      '  "affectedTag": "4~8字当前异常影响标签（如：镜中反语、微弱耳鸣、轻微失神、兴味盎然；若未受影响可填：灵台清明）",\n' +
      '  "affectedDesc": "一句话客观说明当前异常对" + ctx.charName + "或现场局势的具体影响（可为无明显影响）",\n' +
      '  "clarityDelta": -25到10之间的整数（灵台清明度变化，稳固封印或低危平稳可为0或正，触碰高危/强行沟通不可沟通物为负）\n' +
      '}';

    var userPrompt =
      "当前行动：【" + actionMeta.label + "】" +
      (isNonComm && actionId === "communicate" ? "（警告：该收容物标注为不可沟通，强行搭话易触发认知反噬）" : "") +
      (userCustomInput ? "\n" + ctx.userName + " 补充的举动或话语：「" + userCustomInput + "」" : "") +
      "\n请结合当前收容物的危险等级与 " + ctx.charName + " 的真实人设，自然演绎这一幕（切忌套路化一上来就保护）。";

    var aiRaw = await callXiajianLLM(sysPrompt, userPrompt);
    var parsed = extractJsonBlock(aiRaw);
    var usedAi = Boolean(parsed && parsed.sceneText);

    var offlineFallback = lv <= 2
      ? {
          sceneText:
            "收容室内的灯影微微晃了半寸，建木根隙间泛起一点若有似无的凉意。你选择「" +
            actionMeta.label +
            "」时，「" +
            anomaly.name +
            "」发出极轻的一声异响。身旁的" +
            ctx.charName +
            "并未显得紧张，反而挑眉凑近半步细细端详，似在掂量这物件究竟有何古怪，嘴角还挂着几分漫不经心的打量。",
          charDialogue: "「就这？听卷宗写得神乎其神，近看倒挺有意思。」",
          affectedTag: "灵台清明",
          affectedDesc: "低危异常尚未造成明显侵染，" + ctx.charName + " 仍保持着一贯的从容与好奇。",
          clarityDelta: actionId === "reinforce" ? 5 : 0
        }
      : {
          sceneText:
            "收容室内的烛火陡然压低半寸，空气像被无形之物抽干了一层温度。你执行「" +
            actionMeta.label +
            "」之际，「" +
            anomaly.name +
            "」的异常脉动骤然扩散。身旁的" +
            ctx.charName +
            "眉心微蹙，指尖无意识停在半空，神色短暂地恍惚了一瞬，像是听见了只有自己才能辨认的旧日低语。",
          charDialogue: "「……方才那一声，你也听见了？不对，刚才那句话不像冲你来的。」",
          affectedTag: actionId === "reinforce" ? "稳固封印" : "轻度错位",
          affectedDesc: ctx.charName + " 率先察觉到异常规则的渗透，神思出现细微波动。",
          clarityDelta: actionId === "reinforce" ? 6 : -10
        };

    var result = usedAi
      ? {
          sceneText: String(parsed.sceneText).trim(),
          charDialogue: String(parsed.charDialogue || "").trim(),
          affectedTag: String(parsed.affectedTag || "灵台清明").slice(0, 14),
          affectedDesc: String(parsed.affectedDesc || "").slice(0, 80),
          clarityDelta: Math.max(-30, Math.min(15, Math.floor(Number(parsed.clarityDelta) || 0)))
        }
      : offlineFallback;

    var visitRecord = {
      id: "xj_visit_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      anomalyId: anomaly.id,
      anomalyName: anomaly.name,
      charId: ctx.charId,
      charName: ctx.charName,
      actionId: actionId,
      actionLabel: actionMeta.label,
      userCustomInput: userCustomInput,
      sceneText: result.sceneText,
      charDialogue: result.charDialogue,
      affectedTag: result.affectedTag,
      affectedDesc: result.affectedDesc,
      clarityDelta: result.clarityDelta,
      usedAi: usedAi,
      createdAt: Date.now()
    };

    try {
      await idbPut(STORE_VISITS, visitRecord);
    } catch (_) {}

    return visitRecord;
  }

  // ==================== 6. AI Feature 2: User Custom Anomaly Polish ====================

  async function polishCustomAnomalyWithAI(draft) {
    var name = String((draft && draft.name) || "").trim();
    var brief = String((draft && draft.brief) || "").trim();
    var dangerLevel = Math.max(1, Math.min(5, Math.floor(Number((draft && draft.dangerLevel) || 2))));
    var catalog = global.XiajianCatalogData || {};
    var levelMeta = (catalog.DANGER_LEVELS && catalog.DANGER_LEVELS[dangerLevel]) || { scale: "群体", webglMood: "amber_dust" };
    var scale = String((draft && draft.scale) || levelMeta.scale);
    var containmentDifficulty = ["低", "中", "高"].indexOf(draft && draft.containmentDifficulty) >= 0
      ? draft.containmentDifficulty
      : dangerLevel >= 4 ? "高" : dangerLevel >= 2 ? "中" : "低";
    var traits = Array.isArray(draft && draft.traits) ? draft.traits : [];

    if (!name) throw new Error("请填写收容物名称");
    if (!brief) throw new Error("请先写一两句异常简介脑洞");

    var existing = await getAllAnomalies();
    var customSeq = existing.filter(function (a) { return a.isCustom; }).length + 1;
    var code = "XJ-C" + String(customSeq).padStart(2, "0");

    var customArcHint = pickObservationArcHint({ dangerLevel: dangerLevel, traits: traits }, false);
    var sysPrompt =
      "你是「狭间 · 天道收容所」的机密档案编纂官。请将用户提交的一段简短异常脑洞，润色扩写为一份极具东方玄幻 × SCP 基金会风味的绝密卷宗与 4 页《仙人观测日志》。\n" +
      "铁律：严禁使用任何 Emoji！**严禁机械套用「正常→躁动→污染→接班善后」的固定四段式模板**，请按危险等级具体分析：" + customArcHint + "\n" +
      "可用活点地图节点 ID 仅限：I, II, III, IV, V, VI, VII。\n" +
      "请严格输出合法 JSON：\n" +
      '{\n' +
      '  "reactionType": "如：规则系怪异 / 器物系怪异 / 认知系怪异 / 民俗系怪异",\n' +
      '  "responseGuide": "40~80字冷静克制的应对指南与禁忌规则",\n' +
      '  "description": "100~180字SCP东汉风异常正文描述",\n' +
      '  "redactedSecret": "50~90字可点击解密的暗黑隐藏真相",\n' +
      '  "anomalyEffectHint": "一句话说明参观名士可能产生的具体互动反差（结合危险度，未必是保护或失控）",\n' +
      '  "patrolNodes": ["I", "II", "III"],\n' +
      '  "sightings": [{"date": "建安三年·秋", "nodeId": "I", "note": "简短目击捕获记录"}],\n' +
      '  "observationLogs": [\n' +
      '    {"pageNo": 1, "date": "建安三年 某月某日", "shichen": "戌时", "recorder": "司隙官·某", "checkState": "normal或uneasy或corrupted", "summaryTitle": "标题", "body": "正文", "corruptWhisper": "正常页留空", "glyphType": "none或spiral或talisman或scratch或eye"}\n' +
      '  ]\n' +
      '}';

    var userPrompt =
      "收容物名称：" + name +
      "\n危险等级：" + dangerLevel + " 级（量级：" + scale + "，收容难度：" + containmentDifficulty + "）" +
      "\n危险属性：" + (traits.join("、") || "无") +
      "\n用户简介脑洞：" + brief;

    var aiRaw = await callXiajianLLM(sysPrompt, userPrompt);
    var parsed = extractJsonBlock(aiRaw);
    var validNodeSet = { I: 1, II: 1, III: 1, IV: 1, V: 1, VI: 1, VII: 1 };

    var patrolNodes =
      parsed && Array.isArray(parsed.patrolNodes)
        ? parsed.patrolNodes.filter(function (n) { return validNodeSet[n]; }).slice(0, 5)
        : [];
    if (patrolNodes.length < 2) patrolNodes = ["I", "II", "III"];

    var logs =
      parsed && Array.isArray(parsed.observationLogs) && parsed.observationLogs.length >= 2
        ? parsed.observationLogs.slice(0, 6).map(function (lg, idx) {
            return {
              pageNo: idx + 1,
              formCode: code + "-" + String.fromCharCode(65 + idx),
              date: String(lg.date || "建安三年 秋"),
              shichen: String(lg.shichen || "子时"),
              recorder: String(lg.recorder || "司隙官·值守"),
              checkState: ["normal", "uneasy", "corrupted", "breach"].indexOf(lg.checkState) >= 0 ? lg.checkState : "normal",
              summaryTitle: String(lg.summaryTitle || "观测记录"),
              body: String(lg.body || brief),
              corruptWhisper: String(lg.corruptWhisper || ""),
              glyphType: ["none", "spiral", "talisman", "scratch", "eye"].indexOf(lg.glyphType) >= 0 ? lg.glyphType : "none"
            };
          })
        : [
            {
              pageNo: 1,
              formCode: code + "-A",
              date: "建安三年 初录",
              shichen: "戌时",
              recorder: "司隙官·丙九",
              checkState: "normal",
              summaryTitle: "初入狭间封存",
              body: "「" + name + "」已依规移入狭间收容室，外封铜锁与镇符完好，暂未见躁动。",
              corruptWhisper: "",
              glyphType: "none"
            },
            {
              pageNo: 2,
              formCode: code + "-B",
              date: "建安三年 三日后",
              shichen: "子时",
              recorder: "司隙官·丙九",
              checkState: "corrupted",
              summaryTitle: "观测异常实录",
              body: "灯火莫名发暗。关于「" + name + "」的记录仿佛在纸面上自行游动，耳畔隐约传来细碎低语。切勿久视。",
              corruptWhisper: "不要再写下去了——它在看你写字。",
              glyphType: "spiral"
            }
          ];

    var finalAnomaly = {
      id: code + "_" + Date.now(),
      code: code,
      name: name,
      reactionType: (parsed && parsed.reactionType) || "未知系怪异",
      dangerLevel: dangerLevel,
      scale: scale,
      containmentDifficulty: containmentDifficulty,
      traits: traits,
      imageUrl: "",
      webglMood: levelMeta.webglMood || "amber_dust",
      responseGuide: (parsed && parsed.responseGuide) || "保持安全距离，严禁擅自触碰或破坏外围镇符。",
      description: (parsed && parsed.description) || brief,
      redactedSecret: (parsed && parsed.redactedSecret) || "档案深处仍有未明之处，疑似与建木深根某次震荡有关。",
      anomalyEffectHint: (parsed && parsed.anomalyEffectHint) || "可能令同行者产生微妙的认知错位或情绪反差。",
      patrolNodes: patrolNodes,
      sightings:
        parsed && Array.isArray(parsed.sightings) && parsed.sightings.length > 0
          ? parsed.sightings.slice(0, 3)
          : [{ date: "建安三年", nodeId: patrolNodes[0], note: "由广陵王亲自收录入狭间。" }],
      observationLogs: logs,
      isCustom: true,
      createdAt: Date.now()
    };

    await saveCustomAnomaly(finalAnomaly);
    return finalAnomaly;
  }

  // ==================== 6.5. Dynamic Non-Formulaic Observation Arc Picker ====================

  function pickObservationArcHint(anomaly, isAppend) {
    var lv = Math.max(1, Math.min(5, Number((anomaly && anomaly.dangerLevel) || 2)));
    var traits = Array.isArray(anomaly && anomaly.traits) ? anomaly.traits : [];
    var hasHighRisk = lv >= 4 || traits.indexOf("lethal") >= 0 || traits.indexOf("unkillable") >= 0;

    var lowPools = [
      "【本次随机观测走向：安稳度日】该异常危险度较低，这几页可以全程风平浪静（多为 normal），记录司隙官例行清扫、换符、甚至略带无聊或啼笑皆非的日常细节，不必强行制造失控事故。",
      "【本次随机观测走向：日常微澜】大部分时候安稳如常（normal），仅在某一页出现一个极轻微、甚至带点荒诞或令人哭笑不得的小异动（uneasy），随后又恢复平静。",
      "【本次随机观测走向：细思极恐的平静】表面上每一页都在写“封印完好、一切正常”（normal / uneasy），直到末页某句不经意的核对才隐约露出违和感，无需大爆发鬼画符。",
      "【本次随机观测走向：轻敌小插曲】执笔司隙官因它只是低危物而松懈，中途不慎触发了它的小规矩（uneasy / 轻微 scratch），手忙脚乱补救后写下检讨。"
    ];

    var midPools = [
      "【本次随机观测走向：漫长潜伏】前三页皆是克制冷静的常规记录与微妙伏笔（normal → normal → uneasy），直到最后才突然显现异常端倪，不必急着在本批里收尾善后。",
      "【本次随机观测走向：开局受扰 · 轮换观测者】第一页刚接手便已有观测者受其规则波及（uneasy / corrupted），后续页面记录被迫频繁更换不同代号的司隙官轮值接手。",
      "【本次随机观测走向：反复自我怀疑】执笔人并未彻底发疯，但在多页中反复划改自己之前的记录（uneasy + scratch），不确定究竟是异常变了还是自己的记忆出错了。",
      "【本次随机观测走向：虚惊与暗流】先因一次误判以为收容失效而紧张（uneasy），核查后发现暂未突破（normal），但末页留下一个无法解释的微小痕迹。"
    ];

    var highPools = [
      "【本次随机观测走向：首日即染 · 频繁换人】危险度极高，第一页起观测者便已遭认知渗透（corrupted / uneasy），本组记录呈现多名司隙官（如丙三、乙七、甲四）接连中招被迫轮换的惨烈档案。",
      "【本次随机观测走向：死寂高压】高危物竟罕见地连续多日陷入反常死寂（normal / uneasy），越是安静越令司隙官神经紧绷，怀疑它在酝酿更深的裂隙变动。",
      "【本次随机观测走向：未完结的异变】从异常躁动一路升级至鬼画符污染（uneasy → corrupted → corrupted），结尾停在紧急封廊求援的悬念上，不要强行写成“已经圆满善后”。",
      "【本次随机观测走向：压制拉锯】老练的高阶司隙官与异常展开冷静博弈，交替出现强行镇压（normal/uneasy）与局部认知渗透（corrupted + 符箓/划痕），展现专业与恐惧并存的真实感。"
    ];

    var pool = lv <= 2 && !hasHighRisk ? lowPools : (hasHighRisk ? highPools : midPools);
    var picked = pool[Math.floor(Math.random() * pool.length)];
    return (
      picked +
      (isAppend ? "（请自然承接上一页的日期、人物或悬念继续推演，不要机械重演同一套桥段。）" : "")
    );
  }

  // ==================== 7. AI Feature 3: Append Next 3~5 Observation Log Pages ====================

  async function appendObservationLogWithAI(anomaly, batchCount) {
    if (!anomaly || !anomaly.id) throw new Error("缺少收容物对象");
    var count = Math.max(3, Math.min(5, Math.floor(Number(batchCount) || 4)));
    var currentLogs = Array.isArray(anomaly.observationLogs) ? anomaly.observationLogs : [];
    var startPageNo = currentLogs.length + 1;
    var lastLog = currentLogs[currentLogs.length - 1] || {};
    var arcHint = pickObservationArcHint(anomaly, true);

    var sysPrompt =
      "你是「狭间 · 天道收容所」的执笔司隙官。请为收容物「" + anomaly.code + " · " + anomaly.name + "」（危险等级：" + (anomaly.dangerLevel || 2) + " 级 · " + (anomaly.scale || "个体") + "，特性：" + ((anomaly.traits || []).join("、") || "无特殊高危标签") + "）连续续写 " + count + " 页《仙人观测日志》（第 " + startPageNo + " 页至第 " + (startPageNo + count - 1) + " 页）。\n" +
      "异常档案：" + anomaly.description + "\n应对指南：" + (anomaly.responseGuide || "") + "\n上一页记录（第 " + (lastLog.pageNo || 0) + " 页，执笔：" + (lastLog.recorder || "未知") + "，状态：" + (lastLog.checkState || "normal") + "）：" + (lastLog.body || "无") + "\n" +
      "铁律：\n" +
      "1. 严禁使用任何 Emoji！\n" +
      "2. **严禁机械套用「平静 → 躁动 → 污染鬼画符 → 接班善后」的固定四段式模板！** 请严格根据该收容物的危险等级与下方随机观测走向自由发挥：\n" +
      "   " + arcHint + "\n" +
      "3. 严格输出包含 " + count + " 个对象的合法 JSON 数组（禁止多余解释）：\n" +
      '[{"date": "建安某年 某月某日", "shichen": "时辰", "recorder": "司隙官·代号", "checkState": "normal或uneasy或corrupted", "summaryTitle": "简短标题", "body": "60~120字日记体正文", "corruptWhisper": "仅在受污染或划改时填写，正常页留空串", "glyphType": "none或spiral或talisman或scratch或eye"}]';

    var aiRaw = await callXiajianLLM(
      sysPrompt,
      "请连续续写第 " + startPageNo + " 至第 " + (startPageNo + count - 1) + " 页《仙人观测日志》（共 " + count + " 页 JSON 数组）。"
    );
    var parsedArr = extractJsonArraySafe(aiRaw);
    if (parsedArr.length === 0) {
      var singleParsed = extractJsonBlock(aiRaw);
      if (singleParsed && singleParsed.body) parsedArr = [singleParsed];
    }

    var fallbackTemplates = [
      {
        date: "建安三年 续录·初",
        shichen: "戌时",
        recorder: "司隙官·值夜",
        checkState: "normal",
        summaryTitle: "例行巡检：封条完好",
        body: "建木根隙微震半刻后复归沉寂。「" + anomaly.name + "」收容室内灯火平稳，铜锁与外围镇符均无损毁，续记留档。",
        corruptWhisper: "",
        glyphType: "none"
      },
      {
        date: "建安三年 续录·次日",
        shichen: "子时",
        recorder: "司隙官·值夜",
        checkState: "uneasy",
        summaryTitle: "夜半异响：纸墨微颤",
        body: "子夜时分案头墨砚无风起涟漪，门缝外渗出与「" + anomaly.name + "」相关的细碎低语，值守灵灯忽明忽暗。",
        corruptWhisper: "（划去：无异常 -> 改写：它在数我呼吸的拍子。）",
        glyphType: "scratch"
      },
      {
        date: "建安三年 续录·三日",
        shichen: "丑时三刻",
        recorder: "司隙官·值夜",
        checkState: "corrupted",
        summaryTitle: "认知渗透实录（已封存）",
        body: "烛芯转青。纸页背面似乎有人与我同时落笔，字迹一模一样，只是它写得比我快了一拍。「" + anomaly.name + "」已经知道我刚才念错了一个字——",
        corruptWhisper: "别翻下一页——别翻下一页——门栓已经开了半寸。",
        glyphType: "spiral"
      },
      {
        date: "建安三年 续录·四日",
        shichen: "辰时",
        recorder: "司隙官·甲二（接班）",
        checkState: "normal",
        summaryTitle: "接班加固归档",
        body: "前任值夜司隙官已送往清心堂静养，三日后无碍。现已补刻双道镇符并重封铜锁，本轮续录封存备查。",
        corruptWhisper: "",
        glyphType: "none"
      }
    ];

    var rawList = parsedArr.length >= 2 ? parsedArr.slice(0, 5) : fallbackTemplates.slice(0, count);
    var newPages = rawList.map(function (lg, idx) {
      var pNo = startPageNo + idx;
      return {
        pageNo: pNo,
        formCode: (anomaly.code || "XJ") + "-" + pNo,
        date: String(lg.date || "建安三年 续录"),
        shichen: String(lg.shichen || "子时"),
        recorder: String(lg.recorder || "司隙官·值夜"),
        checkState: ["normal", "uneasy", "corrupted", "breach"].indexOf(lg.checkState) >= 0 ? lg.checkState : "normal",
        summaryTitle: String(lg.summaryTitle || "观测续录"),
        body: String(lg.body || "收容状态稳定，续记备查。"),
        corruptWhisper: String(lg.corruptWhisper || ""),
        glyphType: ["none", "spiral", "talisman", "scratch", "eye"].indexOf(lg.glyphType) >= 0 ? lg.glyphType : "none"
      };
    });

    var curExtra = (await idbGet(STORE_EXTRAS, anomaly.id)) || {
      anomalyId: anomaly.id,
      logs: [],
      redactedUnlocked: false
    };
    curExtra.logs = (curExtra.logs || []).concat(newPages);
    await idbPut(STORE_EXTRAS, curExtra);
    return newPages;
  }

  // ==================== 8. World Book Projection Batch (4~6 Anomalies) & Lazy Logbook ====================

  async function getEnabledWorldBookSummary() {
    var titles = [];
    var chunks = [];
    try {
      if (global.worldBookStore && typeof global.worldBookStore.getData === "function") {
        var wb = await global.worldBookStore.getData();
        var books = Array.isArray(wb && wb.books) ? wb.books : [];
        for (var i = 0; i < books.length; i++) {
          var b = books[i];
          if (b && b.enable !== false && b.content && String(b.content).trim()) {
            var t = String(b.title || "未命名设定").trim();
            titles.push(t);
            chunks.push("【" + t + "】" + String(b.content).trim().slice(0, 260));
          }
        }
      }
    } catch (_) {}

    if (chunks.length === 0 && typeof global.getWorldBookContext === "function") {
      try {
        var ctxTxt = String((await global.getWorldBookContext()) || "").trim();
        if (ctxTxt) {
          titles.push("当前全局世界书");
          chunks.push(ctxTxt.slice(0, 1400));
        }
      } catch (_) {}
    }

    return {
      count: titles.length,
      titles: titles,
      fullText: chunks.join("\n").slice(0, 1800)
    };
  }

  /**
   * Tolerant JSON array extractor: even if an LLM batch output is truncated near the end,
   * salvages every fully closed top-level `{ ... }` anomaly object cleanly.
   */
  function extractJsonArraySafe(rawText) {
    if (!rawText) return [];
    var cleaned = String(rawText)
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    try {
      var direct = JSON.parse(cleaned);
      if (Array.isArray(direct)) return direct;
      if (direct && Array.isArray(direct.anomalies)) return direct.anomalies;
    } catch (_) {}

    var arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        var parsedArr = JSON.parse(arrMatch[0].replace(/,\s*([}\]])/g, "$1"));
        if (Array.isArray(parsedArr)) return parsedArr;
      } catch (_) {}
    }

    // Salvage individual balanced JSON objects from truncated array output
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
      if (ch === '"') {
        inStr = true;
      } else if (ch === "{") {
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
    return salvaged;
  }

  function buildOfflineProjectionBatch(wbSummary, existingNamesSet, startSeq) {
    var seedTitle = (wbSummary && wbSummary.titles && wbSummary.titles[0]) || "建木根隙";
    var templates = [
      {
        name: "无名竹简残册",
        reactionType: "言灵系怪异",
        dangerLevel: 1,
        containmentDifficulty: "低",
        traits: [],
        responseGuide: "阅毕须倒扣案上，严禁高声诵读末行字句。",
        description: "自「" + seedTitle + "」相关旧址掘出的残缺竹简，墨迹随观看者心念自行改写，专录世人最不愿被旁人知晓的隐秘念头。",
        redactedSecret: "末行小字每逢月晦便会浮现一个陌生的姓名，与当下在场者之一笔迹完全相同。",
        anomalyEffectHint: "名士瞥见竹简上浮现的隐秘心事时，表面强作镇定，耳尖却悄然泛红。",
        patrolNodes: ["I", "II", "III"]
      },
      {
        name: "逆滴铜漏壶",
        reactionType: "器物系怪异",
        dangerLevel: 2,
        containmentDifficulty: "中",
        traits: ["non_comm"],
        responseGuide: "保持室内干燥，切勿触碰逆流浮空的铜水珠。",
        description: "受「" + seedTitle + "」裂隙投射而生的古铜漏壶，水滴自下而上悬浮倒流，令三步之内的人短暂错认白昼与黑夜。",
        redactedSecret: "若连滴十二颗逆水珠，室内所有蜡烛会同时熄灭，并映出三日前曾在此处停留之人的残影。",
        anomalyEffectHint: "名士在昼夜错乱的恍惚中下意识将你护在怀侧，错把当下当成某个深夜旧梦。",
        patrolNodes: ["II", "III", "IV"]
      },
      {
        name: "错位城坊舆图",
        reactionType: "规则系怪异",
        dangerLevel: 3,
        containmentDifficulty: "中",
        traits: ["lethal", "aggressive"],
        responseGuide: "切勿以指尖划过图中红墨涂抹的巷道，同行两人须始终牵紧衣袖。",
        description: "一卷不断自行增生巷弄的素帛舆图，投射自「" + seedTitle + "」的暗面空间。凡在图上迷失视线者，脚下青砖亦会随之错位。",
        redactedSecret: "图角暗藏一座从未载入史册的空城，城门匾额上的字迹正在一点点逼近当下地名。",
        anomalyEffectHint: "空间错位引发强烈警觉，名士寸步不离紧握你的手腕，拒绝让你离开视线半步。",
        patrolNodes: ["I", "III", "V", "VI"]
      },
      {
        name: "无声焚香铜鼎",
        reactionType: "灾厄系怪异",
        dangerLevel: 4,
        containmentDifficulty: "高",
        traits: ["lethal", "non_comm", "unkillable"],
        responseGuide: "距鼎五步外屏息通行，严禁吸入任何淡青冷烟。",
        description: "无火自燃的三足青铜古鼎，缕缕冷烟所及之处，方圆一郡的记忆与声音皆会被短暂吞噬，唯有心中最深的执念化作幻影现身。",
        redactedSecret: "鼎腹内壁密布抓痕，疑似曾关押过某位试图篡改天道的上古仙官。",
        anomalyEffectHint: "冷烟中名士直面自己最怕失去你的执念幻影，彻底卸下平日克制与伪装。",
        patrolNodes: ["V", "VI", "VII"]
      }
    ];

    var out = [];
    for (var i = 0; i < templates.length; i++) {
      var t = templates[i];
      var candidateName = t.name;
      if (existingNamesSet[candidateName]) candidateName = candidateName + "·贰";
      out.push(t);
      t.name = candidateName;
    }
    return out;
  }

  /**
   * Project 4~6 new anomalies directly from the user's enabled World Book entries.
   * Observation logs are intentionally left empty (`logsLazyPending: true`) and generated
   * on-demand only when the user actually opens the logbook tab.
   */
  async function generateWorldBookProjectionBatch(opts) {
    var targetCount = Math.max(4, Math.min(6, Math.floor(Number((opts && opts.count) || 5))));
    var wbSummary = await getEnabledWorldBookSummary();
    var existing = await getAllAnomalies();
    var existingNames = existing.map(function (a) { return a.name; });
    var existingNamesSet = {};
    for (var i = 0; i < existingNames.length; i++) existingNamesSet[existingNames[i]] = true;

    var wSeqStart = existing.filter(function (a) {
      return a.code && a.code.indexOf("XJ-W") === 0;
    }).length + 1;

    var sysPrompt =
      "你是「狭间 · 天道收容所」的裂隙观测总管。天道动摇时，用户世界观中的人物、器物、地点、势力与隐秘历史会透过建木裂隙投射出全新的异常收容物。\n" +
      "请严格基于下方【用户当前已开启的世界书设定】，一次性构想并输出恰好 " + targetCount + " 个彼此风格迥异的收容物档案与活点舆图轨迹！\n\n" +
      "【用户已开启的世界书设定】\n" +
      (wbSummary.fullText || "汉末乱世，建木通天，广陵绣衣楼暗掌情报与秘闻。") +
      "\n\n【排重黑名单（严禁与以下已有收容物重名或雷同）】\n" +
      (existingNames.join("、") || "无") +
      "\n\n【生成铁律】\n" +
      "1. 严禁使用任何 Emoji！\n" +
      "2. 危险等级须有梯度覆盖（1级个体、2级群体、3级街区、4级郡县、5级整个东汉），风格为 7 分中式克系规则怪谈 × 5 分名士反差看点。\n" +
      "3. **不要生成 observationLogs（仙人观测日志将等用户查阅时再按需生成）**。\n" +
      "4. 活点舆图节点 ID 仅限：I, II, III, IV, V, VI, VII；traits 仅限 lethal / non_comm / aggressive / unkillable。\n" +
      "5. 请严格输出合法 JSON 数组（不要附加任何解释或 Markdown）：\n" +
      '[\n  {\n' +
      '    "name": "收容物名称(3~10字，紧扣世界书元素)",\n' +
      '    "reactionType": "如：言灵系怪异 / 器物系怪异 / 规则系怪异 / 认知系怪异 / 民俗系怪异",\n' +
      '    "dangerLevel": 1到5的整数,\n' +
      '    "containmentDifficulty": "低或中或高",\n' +
      '    "traits": ["lethal"],\n' +
      '    "responseGuide": "35~75字应对指南与禁忌规则",\n' +
      '    "description": "90~160字SCP东汉风异常正文（融入世界书专有名词与暗线）",\n' +
      '    "redactedSecret": "45~85字涂黑隐藏真相",\n' +
      '    "anomalyEffectHint": "一句话说明参观名士会受到何种反差影响",\n' +
      '    "patrolNodes": ["I", "III", "V"],\n' +
      '    "sightings": [{"date": "建安三年·秋", "nodeId": "I", "note": "简短目击与收容记录"}]\n' +
      '  }\n]';

    var aiRaw = await callXiajianLLM(
      sysPrompt,
      "请基于当前已开启的世界书，一次性投射生成 " + targetCount + " 个全新的狭间收容物（仅输出 JSON 数组）。"
    );
    var parsedArr = extractJsonArraySafe(aiRaw);
    var usedAi = parsedArr.length >= 2;
    var sourceItems = usedAi
      ? parsedArr.slice(0, 6)
      : buildOfflineProjectionBatch(wbSummary, existingNamesSet, wSeqStart);

    var catalog = global.XiajianCatalogData || {};
    var validNodes = { I: 1, II: 1, III: 1, IV: 1, V: 1, VI: 1, VII: 1 };
    var validTraits = { lethal: 1, non_comm: 1, aggressive: 1, unkillable: 1 };
    var savedRecords = [];
    var nowTs = Date.now();

    for (var idx = 0; idx < sourceItems.length; idx++) {
      var raw = sourceItems[idx];
      if (!raw || !raw.name) continue;
      var lv = Math.max(1, Math.min(5, Math.floor(Number(raw.dangerLevel) || ((idx % 5) + 1))));
      var lvMeta = (catalog.DANGER_LEVELS && catalog.DANGER_LEVELS[lv]) || { scale: "个体", webglMood: "amber_dust" };
      var code = "XJ-W" + String(wSeqStart + savedRecords.length).padStart(2, "0");
      var pNodes = Array.isArray(raw.patrolNodes)
        ? raw.patrolNodes.filter(function (n) { return validNodes[n]; }).slice(0, 5)
        : [];
      if (pNodes.length < 2) pNodes = ["I", "II", "III"];

      var traits = Array.isArray(raw.traits)
        ? raw.traits.filter(function (t) { return validTraits[t]; })
        : [];

      var rec = {
        id: code + "_" + (nowTs + idx),
        code: code,
        name: String(raw.name).trim().slice(0, 18),
        reactionType: String(raw.reactionType || "投射系怪异").slice(0, 12),
        dangerLevel: lv,
        scale: lvMeta.scale,
        containmentDifficulty: ["低", "中", "高"].indexOf(raw.containmentDifficulty) >= 0
          ? raw.containmentDifficulty
          : lv >= 4 ? "高" : lv >= 2 ? "中" : "低",
        traits: traits,
        imageUrl: "",
        webglMood: lvMeta.webglMood || "amber_dust",
        responseGuide: String(raw.responseGuide || "保持安全距离，严禁擅动外围镇符。").trim(),
        description: String(raw.description || "由世界书裂隙投射而生的异常收容物。").trim(),
        redactedSecret: String(raw.redactedSecret || "其源头疑似直指建木深处某段被抹去的历史。").trim(),
        anomalyEffectHint: String(raw.anomalyEffectHint || "会令同行名士显露出克制不住的情绪反差。").trim(),
        patrolNodes: pNodes,
        sightings:
          Array.isArray(raw.sightings) && raw.sightings.length > 0
            ? raw.sightings.slice(0, 3)
            : [{ date: "建安三年", nodeId: pNodes[0], note: "世界书裂隙波动时捕获入库。" }],
        observationLogs: [],
        logsLazyPending: true,
        source: "worldbook_projection",
        isCustom: true,
        createdAt: nowTs + idx
      };

      await saveCustomAnomaly(rec);
      savedRecords.push(rec);
    }

    return {
      records: savedRecords,
      usedAi: usedAi,
      worldBookCount: wbSummary.count,
      worldBookTitles: wbSummary.titles
    };
  }

  /**
   * On-demand lazy generation of the initial 4-page 《仙人观测手札》 when the user first
   * opens the logbook tab of a World-Book-projected anomaly.
   */
  async function generateInitialObservationLogsLazy(anomaly) {
    if (!anomaly || !anomaly.id) throw new Error("缺少收容物对象");
    var existingExtra = await idbGet(STORE_EXTRAS, anomaly.id);
    if (existingExtra && Array.isArray(existingExtra.logs) && existingExtra.logs.length > 0) {
      return existingExtra.logs;
    }

    var arcHint = pickObservationArcHint(anomaly, false);
    var sysPrompt =
      "你是「狭间 · 天道收容所」的执笔司隙官。请为收容物「" + anomaly.code + " · " + anomaly.name + "」（危险等级：" + (anomaly.dangerLevel || 2) + " 级 · " + (anomaly.scale || "个体") + "，特性：" + ((anomaly.traits || []).join("、") || "无特殊高危标签") + "）撰写 4 页《仙人观测日志》。\n" +
      "异常档案：" + anomaly.description + "\n应对指南：" + (anomaly.responseGuide || "") + "\n隐秘真相：" + (anomaly.redactedSecret || "") + "\n" +
      "铁律：\n" +
      "1. 严禁使用任何 Emoji！\n" +
      "2. **严禁机械套用「第1页正常→第2页躁动→第3页鬼画符→第4页接班善后」的固定模板！** 请结合该异常的危险程度与下方随机观测走向具体分析：\n" +
      "   " + arcHint + "\n" +
      "3. 严格输出 4 项合法 JSON 数组：\n" +
      '[{"date":"建安三年 某月某日","shichen":"戌时","recorder":"司隙官·某","checkState":"normal或uneasy或corrupted","summaryTitle":"标题","body":"60~120字日记正文","corruptWhisper":"仅在受污染或划改时填写，正常页留空串","glyphType":"none或spiral或talisman或scratch或eye"}]';

    var aiRaw = await callXiajianLLM(sysPrompt, "请为「" + anomaly.name + "」生成 4 页《仙人观测日志》JSON 数组。");
    var parsedArr = extractJsonArraySafe(aiRaw);

    var fallbackPages = [
      {
        date: "建安三年 初七",
        shichen: "戌时",
        recorder: "司隙官·丙五",
        checkState: "normal",
        summaryTitle: "入库初检：封印稳定",
        body: "「" + anomaly.name + "」移入收容室后首日巡检，铜锁与外围镇符均无异状，室内沉寂如常。",
        corruptWhisper: "",
        glyphType: "none"
      },
      {
        date: "建安三年 十一",
        shichen: "子时",
        recorder: "司隙官·丙五",
        checkState: "uneasy",
        summaryTitle: "异常征兆：灯火微颤",
        body: "夜半巡廊，案上灯芯无风自偏。明明未曾靠近封禁线，耳畔却隐约浮现与卷宗描述吻合的细碎异响。",
        corruptWhisper: "（划去：一切正常 -> 改写：它好像知道我在写字。）",
        glyphType: "scratch"
      },
      {
        date: "建安三年 十二",
        shichen: "丑时三刻",
        recorder: "司隙官·丙五",
        checkState: "corrupted",
        summaryTitle: "认知污染实录（已隔离）",
        body: "墨水干不了。门外的脚步声已经绕了七圈，可值夜的明明只有我一个人。「" + anomaly.name + "」就在纸页背面看着我，不许停笔，停笔就会被它换掉——",
        corruptWhisper: "别抬头看它——别抬头看它——封条松了一角。",
        glyphType: "spiral"
      },
      {
        date: "建安三年 十三",
        shichen: "辰时",
        recorder: "司隙官·甲二（接班）",
        checkState: "normal",
        summaryTitle: "接班处置归档",
        body: "丙五已送往清心堂静养，三日后神智恢复。已补刻双道镇符并加厚门闩，此手札封存备查。",
        corruptWhisper: "",
        glyphType: "none"
      }
    ];

    var rawList = parsedArr.length >= 2 ? parsedArr.slice(0, 5) : fallbackPages;
    var finalLogs = rawList.map(function (lg, idx) {
      return {
        pageNo: idx + 1,
        formCode: (anomaly.code || "XJ") + "-" + String.fromCharCode(65 + idx),
        date: String(lg.date || "建安三年"),
        shichen: String(lg.shichen || "子时"),
        recorder: String(lg.recorder || "司隙官·值守"),
        checkState: ["normal", "uneasy", "corrupted", "breach"].indexOf(lg.checkState) >= 0 ? lg.checkState : "normal",
        summaryTitle: String(lg.summaryTitle || "观测记录"),
        body: String(lg.body || "收容状态稳定。"),
        corruptWhisper: String(lg.corruptWhisper || ""),
        glyphType: ["none", "spiral", "talisman", "scratch", "eye"].indexOf(lg.glyphType) >= 0 ? lg.glyphType : "none"
      };
    });

    var curExtra = existingExtra || { anomalyId: anomaly.id, logs: [], redactedUnlocked: false };
    curExtra.logs = finalLogs;
    await idbPut(STORE_EXTRAS, curExtra);
    return finalLogs;
  }

  global.XiajianEngine = {
    version: "2.0.0",
    INSPECTION_ACTIONS: INSPECTION_ACTIONS,
    getAvailableCharacters: getAvailableCharacters,
    collectInspectionContext: collectInspectionContext,
    getAllAnomalies: getAllAnomalies,
    getAnomalyMedia: getAnomalyMedia,
    saveAnomalyMedia: saveAnomalyMedia,
    deleteAnomalyMedia: deleteAnomalyMedia,
    getEnabledWorldBookSummary: getEnabledWorldBookSummary,
    extractJsonArraySafe: extractJsonArraySafe,
    generateWorldBookProjectionBatch: generateWorldBookProjectionBatch,
    generateInitialObservationLogsLazy: generateInitialObservationLogsLazy,
    unlockRedactedSecret: unlockRedactedSecret,
    saveCustomAnomaly: saveCustomAnomaly,
    deleteCustomAnomaly: deleteCustomAnomaly,
    getVisitRecords: getVisitRecords,
    runDualInspection: runDualInspection,
    polishCustomAnomalyWithAI: polishCustomAnomalyWithAI,
    appendObservationLogWithAI: appendObservationLogWithAI
  };
})(typeof window !== "undefined" ? window : globalThis);

