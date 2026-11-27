/**
 * Milvus/couple_surprise_engine.js
 * 情侣空间 ·「秘密惊喜（锦囊行囊 · 到日揭晓）」独立核心引擎 v2.0
 *
 * 职责：
 * 1. 独立 IndexedDB（milvus_couple_surprise_idb -> surprises）持久化
 * 2. 背包物品按名称+类型分组（groupBackpackItems）与精准按 id 托管扣减/归还
 * 3. 金库（farm_coins + addTransactionRecord + walletTransactionsUpdated）余额校验、扣款、退还、入账
 * 4. 本地日期 YYYY-MM-DD 严格防时区偏移解锁判定（isRevealable / getDaysUntilReveal）
 * 5. 五维深度上下文采集器（角色全维配置 + 身份配置库 + 开启世界书 + 记忆胶囊 + 传讯近30条上下文）
 * 6. 角色秘密筹备惊喜（物品可选 / 五铢钱可选 / 信件必选 + 备礼历程 prepJournal）与传讯自动触发去重
 * 7. 拆封领奖幂等锁（claimedAt），杜绝重复刷物品/刷钱
 */
(function (global) {
  "use strict";

  var DB_NAME = "milvus_couple_surprise_idb";
  var DB_VERSION = 1;
  var STORE_NAME = "surprises";
  var MAX_BAG_SLOTS = 5;

  // ==================== 1. Local Date Utilities (Timezone-Safe) ====================

  function getLocalDateStr(dateObj) {
    var d = dateObj instanceof Date ? dateObj : new Date();
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    return yyyy + "-" + mm + "-" + dd;
  }

  function addDaysToLocalDate(days, baseDate) {
    var d = baseDate instanceof Date ? new Date(baseDate.getTime()) : new Date();
    d.setDate(d.getDate() + (Number(days) || 0));
    return getLocalDateStr(d);
  }

  function normalizeDateStr(raw) {
    if (!raw) return "";
    var s = String(raw).trim().replace(/[/.年]/g, "-").replace(/月/g, "-").replace(/日/g, "");
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) return "";
    var y = Number(m[1]);
    var mo = Number(m[2]);
    var da = Number(m[3]);
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return "";
    return String(y) + "-" + String(mo).padStart(2, "0") + "-" + String(da).padStart(2, "0");
  }

  function isValidDateStr(str) {
    return typeof str === "string" && /^\d{4}-\d{2}-\d{2}$/.test(str);
  }

  function isRevealable(revealDate, todayOverride) {
    if (!isValidDateStr(revealDate)) return false;
    var today = isValidDateStr(todayOverride) ? todayOverride : getLocalDateStr();
    return today >= revealDate;
  }

  function getDaysUntilReveal(revealDate, todayOverride) {
    if (!isValidDateStr(revealDate)) return 0;
    var today = isValidDateStr(todayOverride) ? todayOverride : getLocalDateStr();
    if (today >= revealDate) return 0;
    var tParts = today.split("-").map(Number);
    var rParts = revealDate.split("-").map(Number);
    var tUtc = Date.UTC(tParts[0], tParts[1] - 1, tParts[2]);
    var rUtc = Date.UTC(rParts[0], rParts[1] - 1, rParts[2]);
    return Math.max(0, Math.round((rUtc - tUtc) / 86400000));
  }

  function formatCnDate(dateStr) {
    var ds = isValidDateStr(dateStr) ? dateStr : getLocalDateStr();
    var p = ds.split("-").map(Number);
    return p[0] + "年" + p[1] + "月" + p[2] + "日";
  }

  function notifySurpriseUpdated(charId, recordId) {
    try {
      if (typeof global.dispatchEvent === "function" && typeof CustomEvent === "function") {
        global.dispatchEvent(
          new CustomEvent("milvus-surprise-updated", {
            detail: { charId: charId || "", recordId: recordId || "" }
          })
        );
      }
    } catch (_) {}
  }

  // ==================== 2. IndexedDB Layer ====================

  var dbPromise = null;

  function openSurpriseDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (typeof indexedDB === "undefined") {
        reject(new Error("当前环境不支持 IndexedDB"));
        return;
      }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (ev) {
        var db = ev.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          var store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("by_charId", "charId", { unique: false });
          store.createIndex("by_direction", "direction", { unique: false });
        }
      };
      req.onsuccess = function (ev) {
        resolve(ev.target.result);
      };
      req.onerror = function (ev) {
        dbPromise = null;
        reject(ev.target.error || new Error("打开秘密惊喜数据库失败"));
      };
    });
    return dbPromise;
  }

  async function dbPut(record) {
    var db = await openSurpriseDB();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = function () {
        resolve(record);
      };
      tx.onerror = function (ev) {
        reject(ev.target.error || new Error("写入惊喜记录失败"));
      };
    });
  }

  async function dbGet(id) {
    var db = await openSurpriseDB();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_NAME, "readonly");
      var req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = function () {
        resolve(req.result || null);
      };
      req.onerror = function (ev) {
        reject(ev.target.error || new Error("读取惊喜记录失败"));
      };
    });
  }

  async function dbDelete(id) {
    var db = await openSurpriseDB();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = function () {
        resolve(true);
      };
      tx.onerror = function (ev) {
        reject(ev.target.error || new Error("删除惊喜记录失败"));
      };
    });
  }

  async function getSurprisesByChar(charId) {
    var db = await openSurpriseDB();
    return new Promise(function (resolve) {
      var tx = db.transaction(STORE_NAME, "readonly");
      var store = tx.objectStore(STORE_NAME);
      var req = charId
        ? store.index("by_charId").getAll(charId)
        : store.getAll();
      req.onsuccess = function () {
        var list = (req.result || []).slice();
        list.sort(function (a, b) {
          return (b.createdAt || 0) - (a.createdAt || 0);
        });
        resolve(list);
      };
      req.onerror = function () {
        resolve([]);
      };
    });
  }

  // ==================== 3. Vault (金库五铢钱) Adapter ====================

  function getVaultCoins() {
    try {
      var raw = global.localStorage ? global.localStorage.getItem("farm_coins") : null;
      var parsed = parseInt(raw == null ? "500" : raw, 10);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 500;
    } catch (_) {
      return 500;
    }
  }

  function notifyVaultUpdated() {
    try {
      if (typeof global.dispatchEvent === "function" && typeof Event === "function") {
        global.dispatchEvent(new Event("walletTransactionsUpdated"));
      }
    } catch (_) {}
  }

  function deductVaultCoins(amount, desc) {
    var amt = Math.max(0, Math.floor(Number(amount) || 0));
    if (amt <= 0) return { ok: true, balance: getVaultCoins() };
    var current = getVaultCoins();
    if (current < amt) {
      return {
        ok: false,
        balance: current,
        error: "金库余额不足！需要 " + amt + " 铢，当前金库余额 " + current + " 铢。"
      };
    }
    var nextBal = current - amt;
    try {
      if (global.localStorage) {
        global.localStorage.setItem("farm_coins", String(nextBal));
      }
      if (typeof global.addTransactionRecord === "function") {
        global.addTransactionRecord("expense", amt, desc || "秘密惊喜封存");
      }
      notifyVaultUpdated();
      return { ok: true, balance: nextBal };
    } catch (e) {
      return { ok: false, balance: current, error: "金库扣款失败：" + (e && e.message ? e.message : e) };
    }
  }

  function creditVaultCoins(amount, desc) {
    var amt = Math.max(0, Math.floor(Number(amount) || 0));
    if (amt <= 0) return { ok: true, balance: getVaultCoins() };
    var current = getVaultCoins();
    var nextBal = current + amt;
    try {
      if (global.localStorage) {
        global.localStorage.setItem("farm_coins", String(nextBal));
      }
      if (typeof global.addTransactionRecord === "function") {
        global.addTransactionRecord("income", amt, desc || "秘密惊喜入账");
      }
      notifyVaultUpdated();
      return { ok: true, balance: nextBal };
    } catch (e) {
      return { ok: false, balance: current, error: "金库入账失败：" + (e && e.message ? e.message : e) };
    }
  }

  // ==================== 4. Backpack Grouping & Category Adapter ====================

  function classifyBackpackCategory(item) {
    var rawType = String((item && (item.type || item.category)) || "").toLowerCase();
    var name = String((item && item.name) || "");
    if (
      rawType.indexOf("food") >= 0 ||
      rawType.indexOf("drink") >= 0 ||
      rawType.indexOf("snack") >= 0 ||
      /糕|茶|酒|汤|面|饼|糖|果|酥|羹|丹|丸|粥|饮|食|膳|饭/.test(name)
    ) {
      return "food";
    }
    if (
      rawType.indexOf("ticket") >= 0 ||
      rawType.indexOf("pass") >= 0 ||
      rawType.indexOf("letter") >= 0 ||
      /印信|票|券|令|符|贴|笺|契/.test(name)
    ) {
      return "ticket";
    }
    if (
      rawType.indexOf("gift") >= 0 ||
      rawType.indexOf("treasure") >= 0 ||
      rawType.indexOf("ornament") >= 0 ||
      /玉|簪|香|囊|扇|画|佩|铃|珠|花|帕|匣|琴|剑|镜|钗|镯/.test(name)
    ) {
      return "gift";
    }
    return "other";
  }

  function groupBackpackItems(rawItems) {
    var list = Array.isArray(rawItems) ? rawItems : [];
    var map = {};
    var groups = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (!it || !it.id) continue;
      var cat = classifyBackpackCategory(it);
      var key = (it.name || "未命名好物") + "::" + cat;
      if (!map[key]) {
        map[key] = {
          groupKey: key,
          name: it.name || "未命名好物",
          type: it.type || cat,
          category: cat,
          price: it.price || "",
          desc: it.desc || it.description || "",
          icon: it.icon || it.emoji || "",
          image: it.image || it.img || "",
          items: []
        };
        groups.push(map[key]);
      }
      map[key].items.push(it);
    }
    return groups;
  }

  async function getBackpackItems() {
    if (global.backpackStore && typeof global.backpackStore.getAll === "function") {
      try {
        return (await global.backpackStore.getAll()) || [];
      } catch (_) {}
    }
    return [];
  }

  // ==================== 5. Five-Dimensional Rich Context Collector ====================

  async function collectRichSurpriseContext(params) {
    var baseChar = (params && params.taCharacter) || {};
    var charId = String((params && params.charId) || baseChar.id || "");
    var charName = String((params && params.charName) || baseChar.name || "TA");

    // 1) Resolve full character configuration (name, ID, MBTI, constellation, style, personality, background)
    var fullChar = Object.assign({}, baseChar);
    try {
      var charStore = global.chatCharacterStore || global.chatCharactersStore;
      if (charStore && typeof charStore.getAll === "function") {
        var allChars = (await charStore.getAll()) || [];
        var matched = allChars.find(function (c) {
          return c && ((charId && String(c.id) === charId) || (charName && c.name === charName));
        });
        if (matched) {
          fullChar = Object.assign({}, matched, fullChar, {
            profile: Object.assign({}, matched.profile || {}, fullChar.profile || {})
          });
          if (!charId && matched.id) charId = String(matched.id);
          if ((!charName || charName === "TA") && matched.name) charName = matched.name;
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

    var profile = fullChar.profile || {};
    var charLines = [
      "- 角色姓名：" + charName,
      "- 角色ID：" + (charId || "unknown")
    ];
    var mbti = profile.mbti || fullChar.mbti || cs.mbti || "";
    var constellation = profile.constellation || profile.zodiac || fullChar.constellation || cs.constellation || "";
    var style = profile.speakingStyle || profile.style || fullChar.speakingStyle || fullChar.style || fullChar.languageStyle || cs.speakingStyle || "";
    var personality = profile.personality || fullChar.personality || cs.personality || "";
    var background = profile.background || profile.bio || fullChar.background || cs.background || fullChar.desc || "";
    var extraPersona = fullChar.customPersona || fullChar.persona || profile.persona || "";

    if (mbti) charLines.push("- MBTI 性格类型：" + mbti);
    if (constellation) charLines.push("- 星座：" + constellation);
    if (style) charLines.push("- 语言风格：" + String(style).slice(0, 140));
    if (personality) charLines.push("- 性格特点：" + String(personality).slice(0, 160));
    if (background) charLines.push("- 个人背景：" + String(background).slice(0, 220));
    if (extraPersona) charLines.push("- 补充人设：" + String(extraPersona).slice(0, 180));

    var charDocText = "";
    try {
      if (charId && global.characterDocStore && typeof global.characterDocStore.getEnabledDocContext === "function") {
        charDocText = String((await global.characterDocStore.getEnabledDocContext(charId)) || "").slice(0, 320);
      }
    } catch (_) {}

    var charContext = charLines.join("\n") + (charDocText ? "\n- 专属设定摘录：" + charDocText : "");

    // 2) User Persona from 设置 - 身份配置库
    var userName = String((params && params.userName) || "");
    var userPersonaText = "";
    try {
      if (global.localStorage) {
        var savedPersonas = JSON.parse(global.localStorage.getItem("user_personas") || "[]");
        var activeId =
          global.localStorage.getItem("active_persona_id") ||
          global.localStorage.getItem("active_user_persona_id") ||
          "";
        var activePersona =
          savedPersonas.find(function (p) { return String(p.id) === String(activeId); }) ||
          savedPersonas[0];
        if (activePersona) {
          if (!userName && activePersona.name) userName = activePersona.name;
          var uLines = [];
          if (activePersona.name) uLines.push("- 称呼/姓名：" + activePersona.name);
          if (activePersona.gender) uLines.push("- 性别：" + activePersona.gender);
          if (activePersona.age) uLines.push("- 年龄：" + activePersona.age);
          var uDesc = activePersona.personality || activePersona.persona || "";
          if (uDesc) uLines.push("- 身份与性格：" + String(uDesc).slice(0, 220));
          if (activePersona.style) uLines.push("- 说话风格：" + String(activePersona.style).slice(0, 100));
          userPersonaText = uLines.join("\n");
        }
      }
    } catch (_) {}
    if (!userName) userName = "你";

    // 3) Enabled World Book entries from 设置 - 世界书设置
    var worldBookText = "";
    try {
      if (typeof global.getWorldBookContext === "function") {
        worldBookText = String((await global.getWorldBookContext()) || "").slice(0, 500);
      } else if (global.worldBookStore && typeof global.worldBookStore.getData === "function") {
        var wbData = await global.worldBookStore.getData();
        var entries = Array.isArray(wbData && wbData.entries) ? wbData.entries : [];
        worldBookText = entries
          .filter(function (e) { return e && e.enabled !== false && (e.content || e.text); })
          .map(function (e) { return "【" + (e.title || e.name || "条目") + "】" + (e.content || e.text); })
          .join("\n")
          .slice(0, 500);
      }
    } catch (_) {}

    // 4) Memory Capsules (记忆胶囊)
    var memoryCapsuleText = "";
    try {
      if (global.localStorage) {
        var memCfg = JSON.parse(global.localStorage.getItem("t8_memory_config") || "{}");
        var allMems = Array.isArray(memCfg.memories) ? memCfg.memories : [];
        var mountedIds = [];
        try {
          var chatSettings = JSON.parse(global.localStorage.getItem("chat_settings_" + charId) || "{}");
          if (Array.isArray(chatSettings.mountedMemories)) mountedIds = chatSettings.mountedMemories;
        } catch (_) {}

        var pickedMems = allMems.filter(function (m) {
          if (!m) return false;
          if (mountedIds.length > 0 && mountedIds.indexOf(m.id) >= 0) return true;
          if (charId && (String(m.charId || "") === charId || String(m.characterId || "") === charId)) return true;
          return false;
        });
        if (pickedMems.length === 0 && allMems.length > 0 && mountedIds.length === 0) {
          pickedMems = allMems.slice(0, 5);
        }
        memoryCapsuleText = pickedMems
          .slice(0, 8)
          .map(function (m) {
            return "【" + (m.title || "记忆") + "】：" + String(m.content || "").slice(0, 120);
          })
          .join("\n")
          .slice(0, 550);
      }
    } catch (_) {}

    // 5) Recent ~30 Chat Messages (传讯上下文)
    var recentChatText = "";
    try {
      if (charId && global.chatHistoryStore) {
        var rawMsgs = [];
        if (typeof global.chatHistoryStore.getRecentMessages === "function") {
          rawMsgs = (await global.chatHistoryStore.getRecentMessages(charId, 30)) || [];
        } else if (typeof global.chatHistoryStore.getMessages === "function") {
          rawMsgs = (await global.chatHistoryStore.getMessages(charId)) || [];
        }
        var cleanMsgs = rawMsgs
          .filter(function (m) {
            if (!m) return false;
            var txt = String(m.text || m.content || "").trim();
            if (!txt || m.type === "system" || m.type === "narration") return false;
            return true;
          })
          .slice(-30);
        recentChatText = cleanMsgs
          .map(function (m) {
            var who = m.isMe || m.sender === "me" || m.sender === "我" || m.role === "user" ? userName : charName;
            var txt = String(m.text || m.content || "").replace(/\s+/g, " ").slice(0, 72);
            return who + "：" + txt;
          })
          .join("\n")
          .slice(-1200);
      }
    } catch (_) {}

    return {
      charId: charId,
      charName: charName,
      userName: userName,
      charContext: charContext,
      userPersonaText: userPersonaText,
      worldBookText: worldBookText,
      memoryCapsuleText: memoryCapsuleText,
      recentChatText: recentChatText
    };
  }

  // ==================== 6. Sanitized Summary (Anti-Spoiler Guard) ====================

  function sanitizeRecordForView(record, todayOverride) {
    if (!record) return null;
    var unlocked = isRevealable(record.revealDate, todayOverride);
    if (record.direction === "from_char" && record.status !== "revealed" && !unlocked) {
      return {
        id: record.id,
        charId: record.charId,
        charName: record.charName,
        direction: record.direction,
        occasionName: record.occasionName,
        revealDate: record.revealDate,
        status: record.status,
        isPreparing: !!record.isPreparing,
        teaserNote: record.isPreparing
          ? "正在悄悄替你打点行囊中…"
          : record.teaserNote || "还没到日子呢，不许提前偷看哦。",
        createdAt: record.createdAt,
        isLocked: true,
        daysLeft: getDaysUntilReveal(record.revealDate, todayOverride)
      };
    }
    return Object.assign({}, record, {
      isLocked: false,
      daysLeft: getDaysUntilReveal(record.revealDate, todayOverride)
    });
  }

  // ==================== 7. Prep Journal Fallback & Normalizer ====================

  function buildFallbackPrepJournal(opts) {
    var charName = (opts && opts.charName) || "TA";
    var occasionName = (opts && opts.occasionName) || "重要日子";
    var items = Array.isArray(opts && opts.items) ? opts.items : [];
    var coins = Number((opts && opts.coins) || 0);
    var seqNumber = Math.max(1, Number((opts && opts.seqNumber) || 1));
    var prepDate = formatCnDate(getLocalDateStr());

    var firstItem = items[0] ? items[0].name : "";
    var secondItem = items[1] ? items[1].name : "";

    var events = [
      {
        time: "14:15",
        location: "书案前",
        mood: "calm",
        text: charName + "翻了翻案头记事，忽然想起「" + occasionName + "」将至，决定趁着今日有空，悄悄去置办一份像样的秘密行囊。",
        highlight: occasionName
      }
    ];

    if (firstItem) {
      events.push({
        time: "15:40",
        location: "城东市集",
        mood: "joy",
        text: "穿过两条喧闹长街，在巷尾老铺一眼相中了" + firstItem + "。「包得仔细些，可别磕碰坏了。」掌柜笑着多系了一道红绳。",
        highlight: firstItem
      });
    } else {
      events.push({
        time: "15:30",
        location: "长街茶肆",
        mood: "twist",
        text: "在市集转了一大圈，挑拣半晌总觉得寻常物件配不上心意，索性买了几张上好云笺，打算亲手写一封分量十足的长信。",
        highlight: "云笺"
      });
    }

    if (secondItem) {
      events.push({
        time: "17:05",
        location: "临水小摊",
        mood: "twist",
        text: "归途忽起一阵微风，顺道又替你捎上了" + secondItem + "。差点和路人撞了个满怀，幸好紧紧护住了怀里的小包裹。",
        highlight: secondItem
      });
    } else if (coins > 0) {
      events.push({
        time: "18:20",
        location: "私库匣前",
        mood: "joy",
        text: "数出整整齐齐的 " + coins + " 铢五铢钱，用红绸帕细细包好塞进夹层——「遇见喜欢的东西，只管去买便是。」",
        highlight: coins + " 铢"
      });
    }

    events.push({
      time: "22:45",
      location: "灯下书房",
      mood: "joy",
      text: "夜深人静时点起一盏暖灯，提笔写下给你的信。反复删改了两遍落款，吹干墨迹后连同全部心意一起系上了红结。",
      highlight: charName
    });

    return {
      prepDate: prepDate,
      seqNumber: seqNumber,
      weather: "sun",
      durationText: "筹备：3.5小时",
      distanceText: items.length > 0 ? "寻访：" + (items.length + 2) + "处" : "提笔：深夜灯下",
      stampText: items.length >= 2 ? "满载而归" : "费尽心思",
      voiceNote: "一路想着你拆开包裹时的模样，多绕两步也甘之如饴。",
      events: events
    };
  }

  function ensurePrepJournal(record) {
    if (
      record &&
      record.prepJournal &&
      Array.isArray(record.prepJournal.events) &&
      record.prepJournal.events.length > 0
    ) {
      return record.prepJournal;
    }
    return buildFallbackPrepJournal({
      charName: (record && record.charName) || "TA",
      occasionName: (record && record.occasionName) || "重要日子",
      items: (record && record.items) || [],
      coins: (record && record.coins) || 0,
      seqNumber: 1
    });
  }

  // ==================== 8. Atomic Transactions (Seal / Cancel / Reveal) ====================

  function validateLetter(letter) {
    if (!letter || typeof letter !== "object") return null;
    var title = String(letter.title || "").trim();
    var body = String(letter.body || "").trim();
    var sign = String(letter.sign || "").trim();
    if (!title && !body) return null;
    return { title: title || "见字如晤", body: body, sign: sign };
  }

  async function sealUserSurprise(params) {
    var charId = String((params && params.charId) || "");
    var charName = String((params && params.charName) || "TA");
    var occasionName = String((params && params.occasionName) || "").trim();
    var revealDate = normalizeDateStr(params && params.revealDate);
    var selectedItems = Array.isArray(params && params.items) ? params.items.slice(0, MAX_BAG_SLOTS) : [];
    var coins = Math.max(0, Math.floor(Number((params && params.coins) || 0)));
    var letter = validateLetter(params && params.letter);

    if (!occasionName) throw new Error("请先写上这一天是什么重要日子～");
    if (!isValidDateStr(revealDate)) throw new Error("请选择有效的揭晓日期～");
    if (selectedItems.length === 0 && coins <= 0 && !letter) {
      throw new Error("行囊还是空的，至少放入一件背包好物、一点五铢钱或一封信吧～");
    }

    var currentBal = getVaultCoins();
    if (coins > currentBal) {
      throw new Error("金库余额不足！当前仅有 " + currentBal + " 铢，无法封入 " + coins + " 铢。");
    }

    var itemIds = selectedItems.map(function (it) { return it.id; }).filter(Boolean);
    if (itemIds.length > 0 && global.backpackStore && typeof global.backpackStore.getAll === "function") {
      var latestBag = await global.backpackStore.getAll();
      var bagIdSet = {};
      for (var i = 0; i < latestBag.length; i++) bagIdSet[latestBag[i].id] = true;
      for (var j = 0; j < itemIds.length; j++) {
        if (!bagIdSet[itemIds[j]]) {
          throw new Error("背包中部分物品已变动，请重新挑选后再封存。");
        }
      }
    }

    var bagDeducted = false;
    var coinsDeducted = false;
    try {
      if (itemIds.length > 0 && global.backpackStore) {
        if (typeof global.backpackStore.removeItems === "function") {
          await global.backpackStore.removeItems(itemIds);
        } else if (typeof global.backpackStore.removeItem === "function") {
          for (var r = 0; r < itemIds.length; r++) {
            await global.backpackStore.removeItem(itemIds[r]);
          }
        }
        bagDeducted = true;
      }

      if (coins > 0) {
        var deductRes = deductVaultCoins(coins, "秘密惊喜封存（给" + charName + " · " + occasionName + "）");
        if (!deductRes.ok) throw new Error(deductRes.error);
        coinsDeducted = true;
      }

      var record = {
        id: "surp_u_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        charId: charId,
        charName: charName,
        direction: "from_user",
        occasionName: occasionName,
        revealDate: revealDate,
        status: "sealed",
        teaserNote: "",
        items: selectedItems,
        coins: coins,
        letter: letter,
        claimedAt: null,
        charReaction: "",
        createdAt: Date.now(),
        revealedAt: null
      };

      await dbPut(record);
      notifySurpriseUpdated(charId, record.id);
      return record;
    } catch (err) {
      if (coinsDeducted && coins > 0) {
        creditVaultCoins(coins, "秘密惊喜封存失败退回");
      }
      if (bagDeducted && selectedItems.length > 0 && global.backpackStore && typeof global.backpackStore.addItems === "function") {
        try {
          await global.backpackStore.addItems(selectedItems);
        } catch (_) {}
      }
      throw err;
    }
  }

  async function cancelUserSurprise(recordId) {
    var rec = await dbGet(recordId);
    if (!rec) throw new Error("未找到该惊喜包裹");
    if (rec.direction !== "from_user" || rec.status !== "sealed") {
      throw new Error("该包裹已揭晓，无法撤回");
    }
    await dbDelete(recordId);
    if (Array.isArray(rec.items) && rec.items.length > 0 && global.backpackStore && typeof global.backpackStore.addItems === "function") {
      await global.backpackStore.addItems(rec.items);
    }
    if (rec.coins > 0) {
      creditVaultCoins(rec.coins, "撤回秘密惊喜退回（" + rec.occasionName + "）");
    }
    notifySurpriseUpdated(rec.charId, recordId);
    return true;
  }

  // ==================== 9. Character AI Preparation & Chat Auto-Trigger ====================

  var FALLBACK_GIFTS_POOL = [
    { name: "桂花糯米糕", type: "food", price: "35钱", desc: "刚出笼还带着桂香，特意给你留的。" },
    { name: "安神香囊", type: "gift", price: "80钱", desc: "缝了沉香与合欢花，夜里放在枕边好眠。" },
    { name: "青玉小兔坠", type: "gift", price: "120钱", desc: "在市集一眼瞧见，觉得很衬你。" },
    { name: "蜜渍青梅", type: "food", price: "28钱", desc: "酸甜开胃，解闷正好。" },
    { name: "手绘平安符", type: "ticket", price: "无价", desc: "一笔一划亲手所画，愿你岁岁长安。" },
    { name: "温润白瓷茶盏", type: "gift", price: "95钱", desc: "下次对坐煮茶，就用这一只。" }
  ];

  var FALLBACK_TEASERS = [
    "昨晚点灯包了很久，不许偷偷捏包裹。",
    "藏得严严实实的，等那一天再拆开看。",
    "记在心上的日子，怎么会忘呢？再等等吧。",
    "蝴蝶结系得很紧，提前拆开可是要被我抓现行的。"
  ];

  function buildOfflineCharSurprise(charName, occasionName, userName, seqNumber) {
    var picked = [];
    var pool = FALLBACK_GIFTS_POOL.slice();
    // Items are optional (0~2), coins are optional (0 or lucky number), letter is ALWAYS mandatory
    var itemCount = Math.floor(Math.random() * 3); // 0, 1, or 2
    for (var i = 0; i < itemCount && pool.length > 0; i++) {
      var idx = Math.floor(Math.random() * pool.length);
      var base = pool.splice(idx, 1)[0];
      picked.push({
        id: "surp_gift_" + Date.now() + "_" + i + "_" + Math.random().toString(36).slice(2, 5),
        name: base.name,
        type: base.type,
        price: base.price,
        desc: base.desc,
        fromChar: charName,
        acquiredAt: Date.now()
      });
    }
    var coinChoices = [0, 88, 131, 188, 288, 520];
    var coins = coinChoices[Math.floor(Math.random() * coinChoices.length)];
    var teaser = FALLBACK_TEASERS[Math.floor(Math.random() * FALLBACK_TEASERS.length)];
    var toWho = userName || "你";

    return {
      teaserNote: teaser,
      items: picked,
      coins: coins,
      letter: {
        title: occasionName + " · 秘密赠礼",
        body:
          "提笔时窗外风色正好，想起「" +
          occasionName +
          "」将至，便提前替你收拾了这只小行囊。\n\n" +
          (picked.length > 0
            ? "里头放了" + picked.map(function (x) { return "「" + x.name + "」"; }).join("与") + "，都是平日里留心替你寻来的。"
            : "寻常物件总觉配不上心意，便将满腹念想都落在这纸云笺里。") +
          (coins > 0 ? "另封了 " + coins + " 铢五铢钱，遇见喜欢的吃食或小玩意儿只管买下，不必替我省着。\n\n" : "\n\n") +
          "愿往后每一个寻常或特别的日子，我都能这样稳稳陪在" +
          toWho +
          "身旁。",
        sign: charName + " 亲启"
      },
      prepJournal: buildFallbackPrepJournal({
        charName: charName,
        occasionName: occasionName,
        items: picked,
        coins: coins,
        seqNumber: seqNumber || 1
      })
    };
  }

  async function tryCallUnifiedAI(systemPrompt, userPrompt) {
    var messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    // Primary: Host app's canonical global.sendToLLM (used by 每日一问 & 沧海一刻)
    if (typeof global.sendToLLM === "function") {
      try {
        var reply = await new Promise(function (resolve, reject) {
          var settled = false;
          var timer = setTimeout(function () {
            if (settled) return;
            settled = true;
            reject(new Error("sendToLLM timeout"));
          }, 75000);
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
        if (reply && String(reply).trim()) return String(reply).trim();
      } catch (e) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[CoupleSurpriseEngine] sendToLLM failed:", e);
        }
      }
    }

    // Secondary fallback: direct fetch if raw api_key / api_url / api_model exist
    try {
      var apiKey = global.localStorage && global.localStorage.getItem("api_key");
      var apiUrl = (global.localStorage && global.localStorage.getItem("api_url")) || "";
      var model = (global.localStorage && global.localStorage.getItem("api_model")) || "";
      if (!apiKey || !apiUrl || !model || typeof fetch !== "function") return null;

      var endpoint = apiUrl.replace(/\/+$/, "");
      if (!/\/chat\/completions$/i.test(endpoint)) {
        endpoint += "/chat/completions";
      }

      var controller = typeof AbortController === "function" ? new AbortController() : null;
      var timer2 = controller
        ? setTimeout(function () {
            controller.abort();
          }, 30000)
        : null;

      var resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + apiKey
        },
        signal: controller ? controller.signal : undefined,
        body: JSON.stringify({
          model: model,
          temperature: 0.85,
          messages: messages
        })
      });
      if (timer2) clearTimeout(timer2);
      if (!resp.ok) return null;
      var data = await resp.json();
      return (
        data &&
        data.choices &&
        data.choices[0] &&
        data.choices[0].message &&
        data.choices[0].message.content
      ) || null;
    } catch (_) {
      return null;
    }
  }

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

  function normalizePrepJournal(rawJournal, fallbackOpts) {
    var fb = buildFallbackPrepJournal(fallbackOpts);
    if (!rawJournal || typeof rawJournal !== "object") return fb;
    var rawEvents = Array.isArray(rawJournal.events) ? rawJournal.events : [];
    var cleanEvents = rawEvents
      .filter(function (ev) { return ev && ev.text && String(ev.text).trim(); })
      .slice(0, 6)
      .map(function (ev, idx) {
        var mood = ["joy", "twist", "calm"].indexOf(ev.mood) >= 0 ? ev.mood : idx % 2 === 0 ? "joy" : "twist";
        return {
          time: String(ev.time || (14 + idx) + ":20").slice(0, 8),
          location: String(ev.location || "街市").slice(0, 12),
          mood: mood,
          text: String(ev.text).trim().slice(0, 140),
          highlight: String(ev.highlight || "").trim().slice(0, 16)
        };
      });
    if (cleanEvents.length < 2) cleanEvents = fb.events;

    return {
      prepDate: String(rawJournal.prepDate || fb.prepDate).slice(0, 16),
      seqNumber: fallbackOpts.seqNumber || 1,
      weather: ["sun", "cloud", "moon"].indexOf(rawJournal.weather) >= 0 ? rawJournal.weather : "sun",
      durationText: String(rawJournal.durationText || fb.durationText).slice(0, 16),
      distanceText: String(rawJournal.distanceText || fb.distanceText).slice(0, 16),
      stampText: String(rawJournal.stampText || fb.stampText).replace(/\s+/g, "").slice(0, 4) || "费尽心思",
      voiceNote: String(rawJournal.voiceNote || fb.voiceNote).slice(0, 60),
      events: cleanEvents
    };
  }

  /**
   * Generate a character surprise using full 5D context (character config, user persona,
   * enabled worldbook, memory capsules, last ~30 chat messages).
   * Items: optional (0~3); Coins: optional (0~2000); Letter: MANDATORY; PrepJournal: MANDATORY.
   */
  async function generateCharSurprisePayload(ctx, occasionName, revealDate, seqNumber) {
    var promptBlocks = [
      "【你的角色完整配置】\n" + ctx.charContext
    ];
    if (ctx.userPersonaText) {
      promptBlocks.push("【对方（用户）在身份配置库中的设定】\n" + ctx.userPersonaText);
    }
    if (ctx.worldBookText) {
      promptBlocks.push("【当前已开启的世界观/世界书条目】\n" + ctx.worldBookText);
    }
    if (ctx.memoryCapsuleText) {
      promptBlocks.push("【你们在记忆胶囊中的重要记忆】\n" + ctx.memoryCapsuleText);
    }
    if (ctx.recentChatText) {
      promptBlocks.push("【传讯中你们最近的聊天上下文（参考近期话题与心愿）】\n" + ctx.recentChatText);
    }

    var sysPrompt =
      "你正在扮演角色「" + ctx.charName + "」。你要在「" + occasionName + "」（揭晓日期：" + revealDate + "）背着「" + ctx.userName + "」悄悄准备一份秘密惊喜包裹，并记录下你备礼的全过程手记。\n\n" +
      promptBlocks.join("\n\n") +
      "\n\n【生成规则（严格遵守）】\n" +
      "1. 背包物品（items）：可选，可放 0~3 件贴合你人设、世界观或近期聊天里对方提过的物品；若觉得纯书信/红包更契合也可以为空数组 []。\n" +
      "2. 五铢钱金额（coins）：可选，可为 0 或 1~1314 的整数（依你的财力与性格自然决定）。\n" +
      "3. 信件（letter）：**必须包含**，120~240 字，紧扣你的语言风格、MBTI、星座、背景以及近期聊天/记忆胶囊里的真实细节，禁止AI模板套话。\n" +
      "4. 备礼历程（prepJournal）：记录你为准备这份惊喜奔波挑选、偶遇小波折、深夜提笔写信的 4~5 条时间轴事件，每条极富活人感与角色台词，像航海日志一样生动。\n" +
      "请严格输出合法 JSON（不要附加任何解释或 Markdown）：\n" +
      '{\n' +
      '  "teaserNote": "18字以内不剧透的包裹外签提示",\n' +
      '  "items": [{"name": "物品名(2~8字)", "type": "food或gift或ticket", "desc": "一句为什么选它"}],\n' +
      '  "coins": 0或正整数,\n' +
      '  "letter": {"title": "信件标题(2~14字)", "body": "120~240字走心正文", "sign": "落款"},\n' +
      '  "prepJournal": {\n' +
      '    "weather": "sun或cloud或moon",\n' +
      '    "durationText": "如：耗时：3.5小时",\n' +
      '    "distanceText": "如：寻访：4处街市",\n' +
      '    "stampText": "4字印章评语，如：跋涉寻礼/费尽心思/满载而归",\n' +
      '    "voiceNote": "一句简短筹备心声(30字内)",\n' +
      '    "events": [\n' +
      '      {"time": "14:20", "location": "地点(2~6字)", "mood": "joy或twist或calm", "text": "40~80字生动备礼经过，可含角色台词", "highlight": "正文中需高亮的1个关键词(如物品名或角色名)"}\n' +
      '    ]\n' +
      '  }\n' +
      '}';

    var aiRaw = await tryCallUnifiedAI(
      sysPrompt,
      "今天是 " + getLocalDateStr() + "，请为「" + occasionName + "」（揭晓日 " + revealDate + "）秘密筹备包裹与备礼历程。"
    );
    var parsed = extractJsonBlock(aiRaw);
    var offline = buildOfflineCharSurprise(ctx.charName, occasionName, ctx.userName, seqNumber);

    if (parsed && typeof parsed === "object") {
      // Items are OPTIONAL (0~3)
      var items = Array.isArray(parsed.items)
        ? parsed.items
            .filter(function (it) { return it && it.name && String(it.name).trim(); })
            .slice(0, 3)
            .map(function (it, idx) {
              return {
                id: "surp_gift_" + Date.now() + "_" + idx + "_" + Math.random().toString(36).slice(2, 5),
                name: String(it.name).trim().slice(0, 14),
                type: ["food", "gift", "ticket"].indexOf(it.type) >= 0 ? it.type : "gift",
                price: "专属赠礼",
                desc: String(it.desc || "").trim(),
                fromChar: ctx.charName,
                acquiredAt: Date.now()
              };
            })
        : [];

      // Coins are OPTIONAL (0 ~ 2000)
      var rawCoins = Number(parsed.coins);
      var coins = Number.isFinite(rawCoins) ? Math.min(2000, Math.max(0, Math.floor(rawCoins))) : 0;

      // Letter is MANDATORY
      var letterBody = parsed.letter && String(parsed.letter.body || "").trim();
      var letter = letterBody
        ? {
            title: String((parsed.letter && parsed.letter.title) || occasionName + " · 秘密赠礼").slice(0, 24),
            body: letterBody,
            sign: String((parsed.letter && parsed.letter.sign) || ctx.charName + " 亲启").slice(0, 20)
          }
        : offline.letter;

      var prepJournal = normalizePrepJournal(parsed.prepJournal, {
        charName: ctx.charName,
        occasionName: occasionName,
        items: items,
        coins: coins,
        seqNumber: seqNumber
      });

      return {
        teaserNote: String(parsed.teaserNote || offline.teaserNote).slice(0, 36),
        items: items,
        coins: coins,
        letter: letter,
        prepJournal: prepJournal
      };
    }

    return offline;
  }

  async function prepareCharSurprise(params) {
    var occasionName = String((params && params.occasionName) || "").trim();
    var revealDate = normalizeDateStr(params && params.revealDate);
    if (!occasionName) throw new Error("请先写上这一天是什么日子～");
    if (!isValidDateStr(revealDate)) throw new Error("请选择有效的揭晓日期～");

    var ctx = await collectRichSurpriseContext(params);
    var existingList = await getSurprisesByChar(ctx.charId);
    var seqNumber =
      existingList.filter(function (r) { return r.direction === "from_char"; }).length + 1;

    var payload = await generateCharSurprisePayload(ctx, occasionName, revealDate, seqNumber);

    var record = {
      id: (params && params.existingId) || ("surp_c_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6)),
      charId: ctx.charId,
      charName: ctx.charName,
      direction: "from_char",
      occasionName: occasionName,
      revealDate: revealDate,
      status: "sealed",
      isPreparing: false,
      source: (params && params.source) || "manual",
      teaserNote: payload.teaserNote,
      items: payload.items,
      coins: payload.coins,
      letter: payload.letter,
      prepJournal: payload.prepJournal,
      claimedAt: null,
      charReaction: "",
      createdAt: (params && params.createdAt) || Date.now(),
      revealedAt: null
    };

    await dbPut(record);
    notifySurpriseUpdated(ctx.charId, record.id);
    return sanitizeRecordForView(record);
  }

  /**
   * Called silently from chat_autonomy_p0_engine when the character detects an important
   * upcoming date during chat ([记入秘密惊喜:日子名称|YYYY-MM-DD]).
   * - Deduplicates by charId + revealDate
   * - Immediately writes a sealed placeholder record so Couple Space reflects it right away
   * - Runs 5D AI preparation asynchronously in the background without blocking chat
   */
  async function triggerSecretSurpriseFromChat(params) {
    var charId = String((params && params.charId) || "");
    var charName = String((params && params.charName) || "TA");
    var occasionName = String((params && params.occasionName) || "").trim().slice(0, 24);
    var revealDate = normalizeDateStr(params && params.revealDate);
    var todayStr = getLocalDateStr();

    if (!charId || !occasionName || !isValidDateStr(revealDate)) {
      return { ok: false, reason: "INVALID_ARGS" };
    }
    if (revealDate < todayStr) {
      return { ok: false, reason: "PAST_DATE" };
    }

    // Deduplicate: skip if this character already has a sealed bundle on the same revealDate
    var existing = await getSurprisesByChar(charId);
    var dup = existing.find(function (r) {
      return r.direction === "from_char" && r.status === "sealed" && r.revealDate === revealDate;
    });
    if (dup) {
      return { ok: true, duplicated: true, id: dup.id };
    }

    var placeholderId = "surp_c_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    var createdAt = Date.now();
    var placeholder = {
      id: placeholderId,
      charId: charId,
      charName: charName,
      direction: "from_char",
      occasionName: occasionName,
      revealDate: revealDate,
      status: "sealed",
      isPreparing: true,
      source: "chat_auto",
      teaserNote: "记在心上的日子，正在悄悄为你筹备中…",
      items: [],
      coins: 0,
      letter: buildOfflineCharSurprise(charName, occasionName, "你", 1).letter,
      prepJournal: null,
      claimedAt: null,
      charReaction: "",
      createdAt: createdAt,
      revealedAt: null
    };

    await dbPut(placeholder);
    notifySurpriseUpdated(charId, placeholderId);

    // Fire-and-forget background AI generation to enrich the placeholder
    prepareCharSurprise({
      charId: charId,
      charName: charName,
      taCharacter: (params && params.taCharacter) || { id: charId, name: charName },
      occasionName: occasionName,
      revealDate: revealDate,
      existingId: placeholderId,
      createdAt: createdAt,
      source: "chat_auto"
    }).catch(function () {});

    return { ok: true, duplicated: false, id: placeholderId };
  }

  async function revealAndClaimCharSurprise(recordId, todayOverride) {
    var rec = await dbGet(recordId);
    if (!rec) throw new Error("未找到该惊喜包裹");
    if (rec.direction !== "from_char") throw new Error("包裹类型不匹配");
    if (!isRevealable(rec.revealDate, todayOverride)) {
      var days = getDaysUntilReveal(rec.revealDate, todayOverride);
      throw new Error("还没到揭晓日期哦，再耐心等待 " + days + " 天吧～");
    }

    rec.prepJournal = ensurePrepJournal(rec);

    var alreadyClaimed = !!rec.claimedAt;
    if (!alreadyClaimed) {
      rec.status = "revealed";
      rec.isPreparing = false;
      rec.revealedAt = rec.revealedAt || Date.now();
      rec.claimedAt = Date.now();
      await dbPut(rec);

      if (Array.isArray(rec.items) && rec.items.length > 0 && global.backpackStore && typeof global.backpackStore.addItems === "function") {
        await global.backpackStore.addItems(rec.items);
      }
      if (rec.coins > 0) {
        creditVaultCoins(rec.coins, rec.charName + "的秘密惊喜（" + rec.occasionName + "）");
      }
      notifySurpriseUpdated(rec.charId, rec.id);
    }
    return { record: rec, newlyClaimed: !alreadyClaimed };
  }

  async function revealUserSurpriseWithReaction(recordId, taCharacter, todayOverride) {
    var rec = await dbGet(recordId);
    if (!rec) throw new Error("未找到该惊喜包裹");
    if (rec.direction !== "from_user") throw new Error("包裹类型不匹配");
    if (!isRevealable(rec.revealDate, todayOverride)) {
      var days = getDaysUntilReveal(rec.revealDate, todayOverride);
      throw new Error("还没到约定的揭晓日，再等 " + days + " 天送给 " + rec.charName + " 吧～");
    }
    if (rec.status === "revealed" && rec.charReaction) {
      return rec;
    }

    var ctx = await collectRichSurpriseContext({ charId: rec.charId, charName: rec.charName, taCharacter: taCharacter });
    var itemNames = (rec.items || []).map(function (i) { return i.name; }).join("、") || "无实物";
    var letterText = rec.letter && rec.letter.body ? rec.letter.body : "（未附信件）";

    var sysPrompt =
      "你正在扮演角色「" + ctx.charName + "」。\n" +
      ctx.charContext +
      "\n今天是「" + rec.occasionName + "」，「" + ctx.userName + "」把提前为你秘密打包好的惊喜行囊交给了你。" +
      "请用第一人称写出你亲手解开红结、看到每一件礼物、五铢钱与信件后的真实惊喜反应（100~200字，极具活人感与情感温度，禁止AI套话）。";

    var userPrompt =
      "行囊里装了：\n- 背包好物：" + itemNames +
      "\n- 五铢钱：" + (rec.coins || 0) + " 铢" +
      "\n- 给你的信：" + letterText;

    var aiReaction = await tryCallUnifiedAI(sysPrompt, userPrompt);
    var reaction =
      (aiReaction && String(aiReaction).trim()) ||
      ("解开红结的时候我还以为你藏了什么机密，结果看到" +
        (rec.items && rec.items.length > 0 ? "「" + itemNames + "」" : "这只沉甸甸的小行囊") +
        (rec.coins > 0 ? "和那 " + rec.coins + " 铢五铢钱" : "") +
        "，心里一下子软得一塌糊涂。这份「" +
        rec.occasionName +
        "」的心意，我会好好珍藏一辈子的。");

    rec.status = "revealed";
    rec.revealedAt = Date.now();
    rec.charReaction = reaction;
    await dbPut(rec);
    notifySurpriseUpdated(rec.charId, rec.id);
    return rec;
  }

  global.CoupleSurpriseEngine = {
    version: "2.0.0",
    MAX_BAG_SLOTS: MAX_BAG_SLOTS,
    getLocalDateStr: getLocalDateStr,
    addDaysToLocalDate: addDaysToLocalDate,
    normalizeDateStr: normalizeDateStr,
    isValidDateStr: isValidDateStr,
    isRevealable: isRevealable,
    getDaysUntilReveal: getDaysUntilReveal,
    getVaultCoins: getVaultCoins,
    deductVaultCoins: deductVaultCoins,
    creditVaultCoins: creditVaultCoins,
    classifyBackpackCategory: classifyBackpackCategory,
    groupBackpackItems: groupBackpackItems,
    getBackpackItems: getBackpackItems,
    collectRichSurpriseContext: collectRichSurpriseContext,
    sanitizeRecordForView: sanitizeRecordForView,
    ensurePrepJournal: ensurePrepJournal,
    getSurprisesByChar: getSurprisesByChar,
    sealUserSurprise: sealUserSurprise,
    cancelUserSurprise: cancelUserSurprise,
    prepareCharSurprise: prepareCharSurprise,
    triggerSecretSurpriseFromChat: triggerSecretSurpriseFromChat,
    revealAndClaimCharSurprise: revealAndClaimCharSurprise,
    revealUserSurpriseWithReaction: revealUserSurpriseWithReaction,
    _dbPut: dbPut,
    _dbGet: dbGet,
    _dbDelete: dbDelete
  };
})(typeof window !== "undefined" ? window : globalThis);
