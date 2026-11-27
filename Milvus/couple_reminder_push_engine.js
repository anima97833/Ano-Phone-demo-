/**
 * Milvus/couple_reminder_push_engine.js
 * 设置 ·「开屏推送」情侣空间四维智能提醒 & 1:1 复古画板蝴蝶卡片独立引擎（Step 1）
 *
 * 四项纯只读探测提醒（缺才提醒、完成即免打扰）：
 * 1. 沧海一刻 · 心情日记（今日未写才提醒）
 * 2. 沧海一刻 · 习惯打卡（今日仍有未打卡习惯才提醒）
 * 3. 情侣空间 · 每日一问（今日未填写才提醒）
 * 4. 情侣空间 · 秘密惊喜（角色给用户准备的惊喜到达揭晓日期且未拆封时提醒）
 *
 * 每项均支持用户独立开关、自主选择「上线即提醒」或「每日定时 HH:MM」、一键预览与「今日不再提醒」。
 * 零改动 Milvus/app.min.js。
 */
(function (global) {
  "use strict";

  var PREFS_KEY = "milvus_couple_reminders_prefs_v1";

  var ITEM_META = [
    {
      key: "moodDiary",
      badge: "沧海一刻 · 心情日记",
      title: "今日心情还未落笔",
      desc: "若当天尚未在「沧海一刻」写下心情日记，按设定方式温和提醒。",
      defaultMode: "scheduled",
      defaultTime: "21:30",
      previewText: "今日的心情日记还没有记录呢，趁着此刻思绪清朗，去沧海一刻留下一枚心情贴纸与几句小记吧。",
      hintText: "入口：情侣空间 → 沧海一刻 → 心情日记"
    },
    {
      key: "habitCheckin",
      badge: "沧海一刻 · 习惯打卡",
      title: "今日尚有习惯待打卡",
      desc: "当「我的习惯」存在今日未完成打卡项时提醒；全部打完自动静默。",
      defaultMode: "scheduled",
      defaultTime: "20:00",
      previewText: "今日还有 2 / 4 项习惯尚未打卡（早睡、喝水），记得去沧海一刻点亮今天的玻璃珠哦。",
      hintText: "入口：情侣空间 → 沧海一刻 → 我的习惯"
    },
    {
      key: "dailyQuestion",
      badge: "情侣空间 · 每日一问",
      title: "今日一问等你落笔",
      desc: "若当天尚未填写「每日一问」，弹出复古画板卡片提醒作答。",
      defaultMode: "on_login",
      defaultTime: "19:30",
      previewText: "今天的「每日一问」还留着空白呢，写下此刻的回答，看看 TA 又会怎样回应你吧。",
      hintText: "入口：情侣空间 → 每日一问"
    },
    {
      key: "secretSurprise",
      badge: "情侣空间 · 秘密惊喜",
      title: "有份秘密惊喜今日可拆封",
      desc: "当角色为你筹备的秘密惊喜到达指定揭晓日期且未拆封时提醒。",
      defaultMode: "on_login",
      defaultTime: "09:00",
      previewText: "TA 为你悄悄准备的「纪念日锦囊」今日已到启封之日，快去情侣空间「秘密惊喜」拆开看看吧！",
      hintText: "入口：情侣空间 → 秘密惊喜 → TA 给我的惊喜"
    }
  ];

  // ==================== 1. Date & Prefs Helpers ====================

  function getTodayStr(dateObj) {
    var d = dateObj instanceof Date ? dateObj : new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function getCurrentMinutes(dateObj) {
    var d = dateObj instanceof Date ? dateObj : new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  function parseTimeToMinutes(hhmm) {
    var m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return 20 * 60;
    var h = Math.max(0, Math.min(23, Number(m[1])));
    var mi = Math.max(0, Math.min(59, Number(m[2])));
    return h * 60 + mi;
  }

  function buildDefaultPrefs() {
    var out = {};
    for (var i = 0; i < ITEM_META.length; i++) {
      var meta = ITEM_META[i];
      out[meta.key] = {
        enabled: false,
        mode: meta.defaultMode,
        time: meta.defaultTime,
        dismissedDate: "",
        triggeredDate: ""
      };
    }
    return out;
  }

  function getPrefs() {
    var base = buildDefaultPrefs();
    try {
      var raw = global.localStorage && global.localStorage.getItem(PREFS_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && typeof saved === "object") {
          for (var i = 0; i < ITEM_META.length; i++) {
            var k = ITEM_META[i].key;
            if (saved[k] && typeof saved[k] === "object") {
              base[k] = Object.assign({}, base[k], saved[k]);
            }
          }
        }
      }
    } catch (_) {}
    return base;
  }

  function savePrefs(nextPrefs) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(PREFS_KEY, JSON.stringify(nextPrefs));
      }
      if (typeof global.dispatchEvent === "function" && typeof CustomEvent === "function") {
        global.dispatchEvent(new CustomEvent("milvus-couple-reminders-changed", { detail: nextPrefs }));
      }
    } catch (_) {}
    return nextPrefs;
  }

  function updateItemPref(itemKey, patch) {
    var cur = getPrefs();
    if (!cur[itemKey]) return cur;
    cur[itemKey] = Object.assign({}, cur[itemKey], patch || {});
    return savePrefs(cur);
  }

  // ==================== 2. Safe Read-Only IndexedDB Helper ====================

  function readAllFromIdbStore(dbName, storeName) {
    return new Promise(function (resolve) {
      if (typeof indexedDB === "undefined") {
        resolve([]);
        return;
      }
      try {
        var req = indexedDB.open(dbName);
        req.onerror = function () { resolve([]); };
        req.onsuccess = function (ev) {
          var db = ev.target.result;
          try {
            if (!db || !db.objectStoreNames || !db.objectStoreNames.contains(storeName)) {
              if (db && typeof db.close === "function") db.close();
              resolve([]);
              return;
            }
            var tx = db.transaction(storeName, "readonly");
            var g = tx.objectStore(storeName).getAll();
            g.onsuccess = function () {
              var res = Array.isArray(g.result) ? g.result : [];
              try { db.close(); } catch (_) {}
              resolve(res);
            };
            g.onerror = function () {
              try { db.close(); } catch (_) {}
              resolve([]);
            };
          } catch (_) {
            try { if (db) db.close(); } catch (__) {}
            resolve([]);
          }
        };
      } catch (_) {
        resolve([]);
      }
    });
  }

  // ==================== 3. Four Read-Only Status Probes ====================

  async function probeMoodDiary(todayStr) {
    var today = todayStr || getTodayStr();
    try {
      var list = [];
      if (global.momentCalendarStore && typeof global.momentCalendarStore.getMoodsByChar === "function") {
        list = (await global.momentCalendarStore.getMoodsByChar("")) || [];
      }
      var hasWrittenToday = list.some(function (rec) {
        if (!rec) return false;
        var d = String(rec.date || rec.dateStr || "");
        if (d !== today) return false;
        var ue = rec.userEntry || rec.user || null;
        if (ue && (String(ue.text || "").trim() || ue.moodId || ue.moodLabel)) return true;
        if (String(rec.userText || rec.userDiary || "").trim() || rec.userMood) return true;
        return false;
      });
      if (hasWrittenToday) return null;
      return {
        key: "moodDiary",
        badge: "沧海一刻 · 心情日记",
        title: "今日心情还未落笔",
        body: "今天还没有在「沧海一刻」记录心情日记呢。趁着记忆还温热，挑一枚贴纸写下此刻的心情吧。",
        subInfo: "日期：" + today + " ｜ 状态：尚未记录",
        hintText: "前往：情侣空间 → 沧海一刻 → 心情日记"
      };
    } catch (_) {
      return null;
    }
  }

  async function probeHabitCheckin(todayStr) {
    var today = todayStr || getTodayStr();
    try {
      if (
        !global.momentCalendarStore ||
        typeof global.momentCalendarStore.getHabitDefsByScope !== "function" ||
        typeof global.momentCalendarStore.getHabitLogsByHabit !== "function"
      ) {
        return null;
      }
      var defs = (await global.momentCalendarStore.getHabitDefsByScope("user")) || [];
      var activeDefs = defs.filter(function (d) { return d && d.archived !== true && d.deleted !== true; });
      if (activeDefs.length === 0) return null;

      var pendingNames = [];
      for (var i = 0; i < activeDefs.length; i++) {
        var def = activeDefs[i];
        var logs = (await global.momentCalendarStore.getHabitLogsByHabit(def.id)) || [];
        var checkedToday = logs.some(function (lg) {
          if (!lg) return false;
          var ld = String(lg.date || lg.dateStr || "");
          if (ld !== today) return false;
          if (lg.status && lg.status !== "none") return true;
          return lg.done === true;
        });
        if (!checkedToday) {
          pendingNames.push(String(def.name || def.title || "未命名习惯"));
        }
      }

      if (pendingNames.length === 0) return null;
      var previewList = pendingNames.slice(0, 3).join("、") + (pendingNames.length > 3 ? " 等" : "");
      return {
        key: "habitCheckin",
        badge: "沧海一刻 · 习惯打卡",
        title: "还有 " + pendingNames.length + " 项习惯待打卡",
        body: "今日共有 " + activeDefs.length + " 项习惯，尚有 " + pendingNames.length + " 项未打卡：" + previewList + "。去沧海一刻点亮今天的记录吧。",
        subInfo: "待完成：" + pendingNames.length + " / " + activeDefs.length + " 项",
        hintText: "前往：情侣空间 → 沧海一刻 → 我的习惯"
      };
    } catch (_) {
      return null;
    }
  }

  async function probeDailyQuestion(todayStr) {
    var today = todayStr || getTodayStr();
    var yyyy = today.slice(0, 4);
    var mmdd = today.slice(5);
    try {
      var answers = await readAllFromIdbStore("milvus_couple_daily_q_idb", "answers");
      var answeredToday = answers.some(function (rec) {
        if (!rec) return false;
        if (rec.mmdd === mmdd && rec.years && rec.years[yyyy]) {
          if (String(rec.years[yyyy].userAnswer || "").trim().length > 0) return true;
        }
        if (rec.dateStr === today && String(rec.userAnswer || "").trim().length > 0) return true;
        return false;
      });
      if (answeredToday) return null;

      var qText = "";
      try {
        if (global.CoupleDailyQEngine && typeof global.CoupleDailyQEngine.getQuestionForDate === "function") {
          var qObj = global.CoupleDailyQEngine.getQuestionForDate(today);
          qText = String((qObj && (qObj.question || qObj.text)) || "").trim();
        }
      } catch (_) {}

      return {
        key: "dailyQuestion",
        badge: "情侣空间 · 每日一问",
        title: "今日一问尚未作答",
        body: qText
          ? "今日问题：「" + qText + "」—— 写下你的回答，看看 TA 会怎样回应吧。"
          : "今天的「每日一问」还留着空白呢，快去写下此刻的心意，留作跨年对照吧。",
        subInfo: "日期：" + today + " ｜ 状态：待填写",
        hintText: "前往：情侣空间 → 每日一问"
      };
    } catch (_) {
      return null;
    }
  }

  async function probeSecretSurprise(todayStr) {
    var today = todayStr || getTodayStr();
    try {
      var list = [];
      if (global.CoupleSurpriseEngine && typeof global.CoupleSurpriseEngine.listSurprises === "function") {
        list = (await global.CoupleSurpriseEngine.listSurprises()) || [];
      } else {
        list = await readAllFromIdbStore("milvus_couple_surprise_idb", "surprises");
      }

      var readyList = list.filter(function (rec) {
        if (!rec) return false;
        if (rec.direction !== "from_char") return false;
        if (rec.status === "revealed" || rec.claimedAt) return false;
        if (!rec.revealDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(rec.revealDate))) return false;
        return today >= String(rec.revealDate);
      });

      if (readyList.length === 0) return null;
      var first = readyList[0];
      var who = String(first.charName || "TA");
      var occ = String(first.occasion || "秘密惊喜");
      var extraNote = readyList.length > 1 ? "（另有 " + (readyList.length - 1) + " 份待拆封惊喜）" : "";
      return {
        key: "secretSurprise",
        badge: "情侣空间 · 秘密惊喜",
        title: "有份秘密惊喜今日可拆封",
        body: who + " 为你悄悄准备的「" + occ + "」已到揭晓之日" + extraNote + "，快去情侣空间打开锦囊看看 TA 藏了什么心意吧！",
        subInfo: "揭晓日：" + first.revealDate + " ｜ 待拆：" + readyList.length + " 份",
        hintText: "前往：情侣空间 → 秘密惊喜 → TA 给我的惊喜"
      };
    } catch (_) {
      return null;
    }
  }

  var PROBE_MAP = {
    moodDiary: probeMoodDiary,
    habitCheckin: probeHabitCheckin,
    dailyQuestion: probeDailyQuestion,
    secretSurprise: probeSecretSurprise
  };

  /**
   * Evaluate which enabled reminders are due right now (`triggerType`: "boot" | "tick").
   */
  async function evaluateDueReminders(triggerType, nowDate) {
    var now = nowDate instanceof Date ? nowDate : new Date();
    var today = getTodayStr(now);
    var nowMins = getCurrentMinutes(now);
    var prefs = getPrefs();
    var dueCards = [];

    for (var i = 0; i < ITEM_META.length; i++) {
      var key = ITEM_META[i].key;
      var cfg = prefs[key];
      if (!cfg || !cfg.enabled) continue;
      if (cfg.dismissedDate === today) continue;

      var shouldCheck = false;
      if (cfg.mode === "on_login") {
        if (triggerType === "boot") shouldCheck = true;
      } else {
        // scheduled mode: trigger once per day once local time reaches configured HH:MM
        var targetMins = parseTimeToMinutes(cfg.time);
        if (nowMins >= targetMins && cfg.triggeredDate !== today) {
          shouldCheck = true;
        }
      }

      if (!shouldCheck) continue;
      var probeFn = PROBE_MAP[key];
      if (typeof probeFn !== "function") continue;
      var card = await probeFn(today);
      if (card) {
        dueCards.push(card);
        if (cfg.mode === "scheduled") {
          updateItemPref(key, { triggeredDate: today });
        }
      }
    }

    return dueCards;
  }

  // ==================== 4. 1:1 Pastel Retro Paint Window Card UI ====================

  function HeartSvg(h, color, size) {
    return h(
      "svg",
      { width: size || 16, height: size || 15, viewBox: "0 0 24 22", style: { display: "block", flexShrink: 0 } },
      h("path", {
        d: "M12 20.5s-8.5-5.6-10-10.8C.9 5.9 3.6 2.5 7.2 2.5c2 0 3.7 1.1 4.8 2.7 1.1-1.6 2.8-2.7 4.8-2.7 3.6 0 6.3 3.4 5.2 7.2-1.5 5.2-10 10.8-10 10.8z",
        fill: color
      })
    );
  }

  function ButterflySvg(h, variant, style) {
    // 1:1 pastel kawaii butterfly stickers matching the uploaded reference image
    var isPink = variant === "pink";
    var wingA = isPink ? "#E889C4" : "#F6DF78";
    var wingB = isPink ? "#F7DF7B" : "#9BB5DA";
    var body = isPink ? "#9E82B8" : "#7E9BC4";
    return h(
      "svg",
      {
        viewBox: "0 0 44 40",
        style: Object.assign({ position: "absolute", pointerEvents: "none", zIndex: 8, filter: "drop-shadow(0 2px 3px rgba(110,95,125,0.22))" }, style)
      },
      h("path", { d: "M21 19 C14 7, 2 7, 4 17 C5 23, 14 23, 21 21 Z", fill: wingA, stroke: "#FFFFFF", strokeWidth: 1.1 }),
      h("path", { d: "M23 19 C30 7, 42 7, 40 17 C39 23, 30 23, 23 21 Z", fill: wingA, stroke: "#FFFFFF", strokeWidth: 1.1 }),
      h("path", { d: "M21 21 C14 22, 8 29, 12 34 C16 37, 21 31, 21 24 Z", fill: wingB, stroke: "#FFFFFF", strokeWidth: 1 }),
      h("path", { d: "M23 21 C30 22, 36 29, 32 34 C28 37, 23 31, 23 24 Z", fill: wingB, stroke: "#FFFFFF", strokeWidth: 1 }),
      h("ellipse", { cx: 22, cy: 22, rx: 2, ry: 8, fill: body }),
      h("path", { d: "M21 14 Q18 9 15 10 M23 14 Q26 9 29 10", fill: "none", stroke: body, strokeWidth: 1.2, strokeLinecap: "round" })
    );
  }

  function PaintToolSvg(h, kind) {
    if (kind === "pencil") {
      return h(
        "svg",
        { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none" },
        h("path", { d: "M15.5 4.5l4 4L9 19l-4.5 1 1-4.5L15.5 4.5z", fill: "#FFFFFF", stroke: "#D8AE3E", strokeWidth: 1.2, strokeLinejoin: "round" }),
        h("path", { d: "M13.5 6.5l4 4", stroke: "#E6B947", strokeWidth: 1.3 })
      );
    }
    if (kind === "brush") {
      return h(
        "svg",
        { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none" },
        h("path", { d: "M18.5 3.5l2 2-8.5 9.5-2.5-2.5L18.5 3.5z", fill: "#FFFFFF" }),
        h("path", { d: "M9.5 12.5c-2.2.5-3.2 2.2-3.5 4.2-.2 1.2-.8 2-1.8 2.3 2.5.7 5.2-.2 6.5-2.2.6-.9.8-2.1.3-3.1l-1.5-1.2z", fill: "#FFFFFF" })
      );
    }
    // eraser
    return h(
      "svg",
      { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none" },
      h("path", { d: "M13.5 5.5l5.5 5.5-7 7H7l-2.5-2.5 9-10z", fill: "#FFFFFF" }),
      h("path", { d: "M9.5 10l5.5 5.5-3 2.5H7l-2.5-2.5L9.5 10z", fill: "#F192B5" })
    );
  }

  function ReminderCanvasModal(props) {
    var React = global.React;
    if (!React) return null;
    var h = React.createElement;
    var useEffect = React.useEffect;
    var useState = React.useState;

    var isOpen = Boolean(props && props.isOpen);
    var cards = Array.isArray(props && props.cards) ? props.cards : [];
    var onClose = props && props.onClose;
    var isPreview = Boolean(props && props.isPreview);

    var [idx, setIdx] = useState(0);
    var [mutedMap, setMutedMap] = useState({});

    useEffect(function () {
      setIdx(0);
      setMutedMap({});
    }, [isOpen, cards.length]);

    if (!isOpen || cards.length === 0) return null;

    var safeIdx = Math.max(0, Math.min(cards.length - 1, idx));
    var cur = cards[safeIdx];
    var isCurMuted = Boolean(mutedMap[cur.key]);

    function toggleMuteToday() {
      var nextVal = !isCurMuted;
      setMutedMap(function (prev) {
        var cp = Object.assign({}, prev);
        cp[cur.key] = nextVal;
        return cp;
      });
      if (!isPreview) {
        updateItemPref(cur.key, { dismissedDate: nextVal ? getTodayStr() : "" });
      }
    }

    var paletteColors = [
      ["#9FB2D6", "#ED8CB2", "#F7D86B", "#FFFFFF"],
      ["#FFFFFF", "#F7D86B", "#ED8CB2", "#9FB2D6"]
    ];

    var modalNode = h(
      "div",
      {
        onClick: function (e) { if (e.target === e.currentTarget && onClose) onClose(); },
        style: {
          position: "fixed",
          inset: 0,
          zIndex: 1065,
          background: "rgba(38, 42, 56, 0.56)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px 22px",
          overflow: "hidden"
        }
      },
      // Outer wrapper allowing butterflies to float slightly beyond the frame without causing scrollbars
      h(
        "div",
        {
          style: {
            position: "relative",
            width: "100%",
            maxWidth: "320px",
            boxSizing: "border-box"
          }
        },
        // Floating Kawaii Butterfly & Sparkle Stickers (1:1 reference positions)
        ButterflySvg(h, "yellow", { top: "48px", right: "-10px", width: "34px", height: "31px", transform: "rotate(12deg)" }),
        ButterflySvg(h, "pink", { top: "118px", right: "-16px", width: "44px", height: "40px", transform: "rotate(-10deg)" }),
        h(
          "svg",
          { width: 16, height: 16, viewBox: "0 0 24 24", style: { position: "absolute", top: "168px", right: "-11px", pointerEvents: "none", zIndex: 8 } },
          h("path", { d: "M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z", fill: "#F7DC76" })
        ),
        ButterflySvg(h, "yellow", { bottom: "84px", left: "-12px", width: "34px", height: "31px", transform: "rotate(-14deg)" }),
        ButterflySvg(h, "pink", { bottom: "16px", left: "-16px", width: "44px", height: "40px", transform: "rotate(16deg)" }),

        // Main Retro Paint Window Frame (雾蓝外框 + 樱花粉裱边)
        h(
          "div",
          {
            style: {
              position: "relative",
              background: "#F9D0DC",
              border: "3px solid #96A9CA",
              borderRadius: "4px",
              boxShadow: "0 16px 38px rgba(40, 44, 66, 0.34), 0 0 0 1px rgba(255,255,255,0.65) inset",
              overflow: "hidden",
              fontFamily: "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif"
            }
          },
          // 1. Crisp White Top Bar with 3 Pastel Hearts (蓝 · 粉 · 蓝)
          h(
            "div",
            {
              style: {
                height: "36px",
                background: "#FFFFFF",
                borderBottom: "3px solid #96A9CA",
                padding: "0 10px 0 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }
            },
            h(
              "div",
              { style: { display: "inline-flex", alignItems: "center", gap: "8px" } },
              HeartSvg(h, "#96B0D9", 16),
              HeartSvg(h, "#F07BA7", 16),
              HeartSvg(h, "#96B0D9", 16)
            ),
            h(
              "div",
              { style: { display: "inline-flex", alignItems: "center", gap: "8px" } },
              cards.length > 1 &&
                h(
                  "span",
                  { style: { fontSize: "11px", fontWeight: 700, color: "#8C9FBE" } },
                  (safeIdx + 1) + " / " + cards.length
                ),
              h(
                "button",
                {
                  type: "button",
                  onClick: onClose,
                  title: "关闭提醒",
                  style: {
                    width: "22px",
                    height: "22px",
                    border: "1.5px solid #B7C5DC",
                    borderRadius: "4px",
                    background: "#F7F9FC",
                    color: "#7E93B5",
                    fontSize: "13px",
                    fontWeight: 700,
                    lineHeight: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer"
                  }
                },
                "×"
              )
            )
          ),

          // 2. Center Crisp White Canvas inside Rose-Pink Border (#E582A6)
          h(
            "div",
            { style: { padding: "12px 12px 10px" } },
            h(
              "div",
              {
                style: {
                  background: "#FFFFFF",
                  border: "3px solid #E582A6",
                  minHeight: "238px",
                  padding: "16px 14px 14px",
                  boxSizing: "border-box",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "12px"
                }
              },
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "10px" } },
                // Soft pastel category pill
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" } },
                  h(
                    "span",
                    {
                      style: {
                        display: "inline-block",
                        fontSize: "11px",
                        fontWeight: 800,
                        color: "#C45B84",
                        background: "#FDEAF0",
                        border: "1px solid #F2BBD0",
                        borderRadius: "999px",
                        padding: "3px 10px"
                      }
                    },
                    cur.badge
                  ),
                  isPreview &&
                    h("span", { style: { fontSize: "10px", color: "#93A4C2", fontWeight: 700 } }, "预览模式")
                ),
                h(
                  "div",
                  { style: { fontSize: "16.5px", fontWeight: 900, color: "#434A5E", lineHeight: 1.35 } },
                  cur.title
                ),
                h(
                  "div",
                  { style: { fontSize: "13px", lineHeight: 1.72, color: "#5E6478" } },
                  cur.body
                ),
                cur.subInfo &&
                  h(
                    "div",
                    {
                      style: {
                        fontSize: "11px",
                        color: "#7F8EA8",
                        background: "#F5F7FB",
                        border: "1px dashed #C7D3E6",
                        borderRadius: "6px",
                        padding: "6px 9px"
                      }
                    },
                    cur.subInfo
                  )
              ),

              // Bottom Canvas Action Row
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "8px", paddingTop: "6px", borderTop: "1px dashed #F1CAD8" } },
                cur.hintText &&
                  h("div", { style: { fontSize: "10.5px", color: "#B87A92", textAlign: "center" } }, cur.hintText),
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" } },
                  h(
                    "button",
                    {
                      type: "button",
                      onClick: toggleMuteToday,
                      style: {
                        border: isCurMuted ? "1px solid #E582A6" : "1px solid #D3DCEB",
                        background: isCurMuted ? "#FDEAF0" : "#F8FAFD",
                        color: isCurMuted ? "#C45B84" : "#7F8EA8",
                        borderRadius: "999px",
                        padding: "5px 10px",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer"
                      }
                    },
                    isCurMuted ? "✓ 今日不再提醒" : "今日不再提醒"
                  ),
                  cards.length > 1
                    ? h(
                        "div",
                        { style: { display: "inline-flex", gap: "6px" } },
                        h(
                          "button",
                          {
                            type: "button",
                            onClick: function () { setIdx((safeIdx - 1 + cards.length) % cards.length); },
                            style: { border: "1px solid #B7C5DC", background: "#FFFFFF", color: "#6A7FA3", borderRadius: "6px", padding: "4px 9px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }
                          },
                          "上一条"
                        ),
                        h(
                          "button",
                          {
                            type: "button",
                            onClick: function () { setIdx((safeIdx + 1) % cards.length); },
                            style: { border: "none", background: "#E582A6", color: "#FFFFFF", borderRadius: "6px", padding: "4px 9px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }
                          },
                          "下一条"
                        )
                      )
                    : h(
                        "button",
                        {
                          type: "button",
                          onClick: onClose,
                          style: {
                            border: "none",
                            background: "#E582A6",
                            color: "#FFFFFF",
                            borderRadius: "999px",
                            padding: "6px 16px",
                            fontSize: "12px",
                            fontWeight: 800,
                            cursor: "pointer"
                          }
                        },
                        "我知道啦"
                      )
                )
              )
            )
          ),

          // 3. Bottom Retro MS-Paint Toolbar (2x4 Pastel Swatch Grid + 3 Square Tool Buttons)
          h(
            "div",
            {
              style: {
                padding: "0 12px 12px",
                display: "flex",
                alignItems: "stretch",
                justifyContent: "space-between",
                gap: "10px"
              }
            },
            // Left: 2x4 Color Swatch Palette Grid
            h(
              "div",
              {
                style: {
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 24px)",
                  gridTemplateRows: "repeat(2, 22px)",
                  border: "1.5px solid #96A9CA",
                  background: "#96A9CA",
                  gap: "1.5px",
                  flexShrink: 0
                }
              },
              paletteColors[0].concat(paletteColors[1]).map(function (clr, cIdx) {
                return h("div", { key: cIdx, style: { background: clr } });
              })
            ),
            // Right: 3 Square Retro Tool Icons (Yellow Pencil / Pink Brush / Blue Eraser)
            h(
              "div",
              {
                style: {
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  flex: 1,
                  border: "1.5px solid #96A9CA",
                  background: "#96A9CA",
                  gap: "1.5px"
                }
              },
              [
                { kind: "pencil", bg: "#F8D86C", label: "上一条" },
                { kind: "brush", bg: "#EE83AA", label: "下一条" },
                { kind: "eraser", bg: "#9CB0D4", label: "关闭" }
              ].map(function (tool) {
                return h(
                  "button",
                  {
                    key: tool.kind,
                    type: "button",
                    title: tool.label,
                    onClick: function () {
                      if (tool.kind === "eraser") {
                        if (onClose) onClose();
                      } else if (cards.length > 1) {
                        setIdx(tool.kind === "pencil" ? (safeIdx - 1 + cards.length) % cards.length : (safeIdx + 1) % cards.length);
                      }
                    },
                    style: {
                      border: "none",
                      background: tool.bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "4px",
                      cursor: "pointer"
                    }
                  },
                  PaintToolSvg(h, tool.kind)
                );
              })
            )
          )
        )
      )
    );

    if (
      global.ReactDOM &&
      typeof global.ReactDOM.createPortal === "function" &&
      typeof document !== "undefined" &&
      document.body
    ) {
      return global.ReactDOM.createPortal(modalNode, document.body);
    }
    return modalNode;
  }

  // ==================== 5. Settings Section (Mounted in 开屏推送) ====================

  function SettingsSection() {
    var React = global.React;
    if (!React) return null;
    var h = React.createElement;
    var useEffect = React.useEffect;
    var useState = React.useState;

    var [prefs, setPrefs] = useState(function () { return getPrefs(); });
    var [previewCards, setPreviewCards] = useState([]);

    useEffect(function () {
      var onChange = function (e) { setPrefs((e && e.detail) || getPrefs()); };
      global.addEventListener("milvus-couple-reminders-changed", onChange);
      return function () { global.removeEventListener("milvus-couple-reminders-changed", onChange); };
    }, []);

    var today = getTodayStr();

    return h(
      "div",
      {
        style: {
          background: "#FFFFFF",
          borderRadius: "14px",
          border: "1px solid #E6EAE8",
          padding: "16px",
          boxShadow: "0 2px 10px rgba(45, 65, 70, 0.03)",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }
      },
      h(
        "div",
        null,
        h("div", { style: { fontSize: "15px", fontWeight: 700, color: "#2D3B3F", marginBottom: "3px" } }, "情侣空间 · 贴心提醒"),
        h(
          "div",
          { style: { fontSize: "12px", color: "#6F7F84", lineHeight: 1.55 } },
          "自主选择开启项与触发方式（上线即提醒 / 每日定时）。仅在当日尚未完成或惊喜已到揭晓日时弹出，已完成后自动免打扰。"
        )
      ),

      ITEM_META.map(function (meta) {
        var cfg = prefs[meta.key] || {};
        var isOn = Boolean(cfg.enabled);
        var isMutedToday = cfg.dismissedDate === today;

        return h(
          "div",
          {
            key: meta.key,
            style: {
              border: isOn ? "1px solid #DCE5E3" : "1px solid #EEF2F1",
              background: isOn ? "#FAFDFC" : "#FAFBF9",
              borderRadius: "12px",
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "10px"
            }
          },
          // Top row: Title + Desc + Toggle pill
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" } },
            h(
              "div",
              { style: { flex: 1, minWidth: 0 } },
              h("div", { style: { fontSize: "13.5px", fontWeight: 700, color: "#2D3B3F" } }, meta.badge),
              h("div", { style: { fontSize: "11.5px", color: "#76868B", marginTop: "2px", lineHeight: 1.5 } }, meta.desc)
            ),
            h(
              "div",
              {
                onClick: function () { setPrefs(updateItemPref(meta.key, { enabled: !isOn })); },
                style: {
                  width: "44px",
                  height: "24px",
                  borderRadius: "999px",
                  background: isOn ? "#E582A6" : "#D6DCDA",
                  position: "relative",
                  cursor: "pointer",
                  transition: "background 0.2s ease",
                  flexShrink: 0
                }
              },
              h("div", {
                style: {
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: "#FFFFFF",
                  position: "absolute",
                  top: "2px",
                  left: isOn ? "22px" : "2px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.22)",
                  transition: "left 0.2s ease"
                }
              })
            )
          ),

          // Expanded controls when enabled
          isOn &&
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "8px", paddingTop: "8px", borderTop: "1px dashed #E2EAE8" } },
              h(
                "div",
                { style: { display: "flex", gap: "8px" } },
                [
                  { id: "on_login", label: "上线即提醒" },
                  { id: "scheduled", label: "每日定时提醒" }
                ].map(function (mOpt) {
                  var active = cfg.mode === mOpt.id;
                  return h(
                    "button",
                    {
                      key: mOpt.id,
                      type: "button",
                      onClick: function () { setPrefs(updateItemPref(meta.key, { mode: mOpt.id })); },
                      style: {
                        flex: 1,
                        padding: "7px 6px",
                        borderRadius: "8px",
                        border: active ? "1.5px solid #E582A6" : "1px solid #DDE4E2",
                        background: active ? "#FDEAF0" : "#FFFFFF",
                        color: active ? "#B84C76" : "#6B7B80",
                        fontSize: "11.5px",
                        fontWeight: active ? 700 : 500,
                        cursor: "pointer"
                      }
                    },
                    mOpt.label
                  );
                })
              ),

              cfg.mode === "scheduled" &&
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" } },
                  h("span", { style: { fontSize: "12px", color: "#5F7075", fontWeight: 600 } }, "每日提醒时间"),
                  h("input", {
                    type: "time",
                    value: cfg.time || meta.defaultTime,
                    onChange: function (e) {
                      setPrefs(updateItemPref(meta.key, { time: e.target.value || meta.defaultTime, triggeredDate: "" }));
                    },
                    style: {
                      border: "1px solid #D5DFDD",
                      borderRadius: "8px",
                      padding: "5px 10px",
                      fontSize: "12.5px",
                      color: "#2D3B3F",
                      background: "#FFFFFF"
                    }
                  })
                ),

              isMutedToday &&
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "#9E5E76", background: "#FDF2F6", padding: "5px 9px", borderRadius: "7px" } },
                  h("span", null, "今日已免打扰，明日恢复"),
                  h(
                    "button",
                    {
                      type: "button",
                      onClick: function () { setPrefs(updateItemPref(meta.key, { dismissedDate: "", triggeredDate: "" })); },
                      style: { border: "none", background: "transparent", color: "#C45B84", fontWeight: 700, fontSize: "11px", cursor: "pointer" }
                    },
                    "立即恢复"
                  )
                ),

              h(
                "button",
                {
                  type: "button",
                  onClick: function () {
                    setPreviewCards([
                      {
                        key: meta.key,
                        badge: meta.badge,
                        title: meta.title,
                        body: meta.previewText,
                        subInfo: "触发方式：" + (cfg.mode === "on_login" ? "上线即提醒" : "每日定时 " + (cfg.time || meta.defaultTime)),
                        hintText: meta.hintText
                      }
                    ]);
                  },
                  style: {
                    alignSelf: "flex-end",
                    border: "1px solid #E5B9CA",
                    background: "#FFF7FA",
                    color: "#B84C76",
                    borderRadius: "999px",
                    padding: "4px 12px",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer"
                  }
                },
                "预览提醒卡片"
              )
            )
        );
      }),

      h(ReminderCanvasModal, {
        isOpen: previewCards.length > 0,
        cards: previewCards,
        isPreview: true,
        onClose: function () { setPreviewCards([]); }
      })
    );
  }

  // ==================== 6. Boot & Scheduled Auto Reminder Host ====================

  function AutoReminderHost(props) {
    var React = global.React;
    if (!React) return null;
    var h = React.createElement;
    var useEffect = React.useEffect;
    var useRef = React.useRef;
    var useState = React.useState;

    var waitForUpdateClosed = Boolean(props && props.waitForUpdateClosed);
    var [activeCards, setActiveCards] = useState([]);
    var bootDoneRef = useRef(false);
    var checkingRef = useRef(false);

    async function runCheck(triggerType) {
      if (checkingRef.current) return;
      checkingRef.current = true;
      try {
        var due = await evaluateDueReminders(triggerType, new Date());
        if (due.length > 0) {
          setActiveCards(function (prev) {
            if (!prev || prev.length === 0) return due;
            var existingKeys = {};
            for (var i = 0; i < prev.length; i++) existingKeys[prev[i].key] = true;
            var merged = prev.slice();
            for (var j = 0; j < due.length; j++) {
              if (!existingKeys[due[j].key]) merged.push(due[j]);
            }
            return merged;
          });
        }
      } catch (_) {}
      checkingRef.current = false;
    }

    // Boot check (waits gracefully for entry gate + update poster)
    useEffect(function () {
      if (waitForUpdateClosed || bootDoneRef.current) return;
      bootDoneRef.current = true;
      var timer = setTimeout(function () {
        runCheck("boot");
      }, 750);
      return function () { clearTimeout(timer); };
    }, [waitForUpdateClosed]);

    // Lightweight 30s foreground scheduler + visibilitychange wake-up check
    useEffect(function () {
      if (waitForUpdateClosed) return;
      var iv = setInterval(function () {
        runCheck("tick");
      }, 30000);
      var onVis = function () {
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          runCheck("tick");
        }
      };
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", onVis);
      }
      return function () {
        clearInterval(iv);
        if (typeof document !== "undefined") {
          document.removeEventListener("visibilitychange", onVis);
        }
      };
    }, [waitForUpdateClosed]);

    return h(ReminderCanvasModal, {
      isOpen: activeCards.length > 0,
      cards: activeCards,
      isPreview: false,
      onClose: function () { setActiveCards([]); }
    });
  }

  global.CoupleReminderPushEngine = {
    version: "1.0.0",
    ITEM_META: ITEM_META,
    getPrefs: getPrefs,
    savePrefs: savePrefs,
    updateItemPref: updateItemPref,
    probeMoodDiary: probeMoodDiary,
    probeHabitCheckin: probeHabitCheckin,
    probeDailyQuestion: probeDailyQuestion,
    probeSecretSurprise: probeSecretSurprise,
    evaluateDueReminders: evaluateDueReminders,
    ReminderCanvasModal: ReminderCanvasModal,
    SettingsSection: SettingsSection,
    AutoReminderHost: AutoReminderHost
  };
})(typeof window !== "undefined" ? window : globalThis);

