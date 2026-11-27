/**
 * Milvus/chat_reply_count_engine.js
 * 传讯（私聊 & 群聊）自主控制 AI 输出条数独立引擎
 *
 * 架构：
 * - 100% IndexedDB 持久化（复用主库 t8_chat_db -> user_settings，零 localStorage 占用）+ 内存热缓存
 * - 默认关闭（enabled: false）：零 Prompt 注入、零后处理干预，100% 沿用当前默认途径
 * - 开启后支持两种模式：
 *     1) fixed（固定数目）：精确指定每轮输出 N 条气泡
 *     2) range（区间范围）：指定最少~最多弹性区间，兼顾活人感与可控性
 * - 双闸门精准控制：
 *     闸门 A：buildPromptDirective(chatId, isGroup, plotMode)
 *     闸门 B：enforceReplyLines(lines, chatId, isGroup, plotMode)（无损合并/自然标点拆句，保护功能标签与群聊发言人归属）
 * - 原生风格设置卡片组件：ReplyCountSettingsCard（可直接嵌入对话偏好设置-进阶配置）
 */
(function (global) {
  "use strict";

  var IDB_KEY = "milvus_chat_reply_count_prefs_v1";

  var DEFAULT_CHAT_CONFIG = {
    enabled: false,
    mode: "range", // "fixed" | "range"
    fixedCount: 3,
    minCount: 2,
    maxCount: 5,
    strictAlign: true
  };

  var FIXED_PRESETS_SOLO = [1, 2, 3, 5, 8];
  var FIXED_PRESETS_GROUP = [2, 4, 6, 8, 10];
  var RANGE_PRESETS_SOLO = [
    { label: "简短 1~2", min: 1, max: 2 },
    { label: "适中 2~4", min: 2, max: 4 },
    { label: "充实 3~6", min: 3, max: 6 },
    { label: "畅聊 5~8", min: 5, max: 8 }
  ];
  var RANGE_PRESETS_GROUP = [
    { label: "精简 2~4", min: 2, max: 4 },
    { label: "标准 4~6", min: 4, max: 6 },
    { label: "热闹 5~9", min: 5, max: 9 },
    { label: "狂欢 8~12", min: 8, max: 12 }
  ];

  // Protected special-tag line detector (never split or destroy functional tags)
  var PROTECTED_TAG_RE =
    /(\[撤回|\[发红包|\[发起|\[送礼|\[位置|\[构造状态|\[生成图片|\[简笔画|<语音>|\[语音:|\[表情:|\[掷骰子\]|\[猜拳\]|\[Favour:|\[记入|\[日程|\[修改|\[颁发头衔|\[禁言|\[解禁|\[拍一拍|\[接受通话\]|\[拒绝通话\]|\[发起通话\])/;

  var GROUP_SPEAKER_RE = /^\s*[\[【]([^\]】]{1,20})[\]】]\s*[:：]\s*/;

  // ==================== 1. Hot Cache + Main IDB Persistence ====================

  var _prefsCache = { perChat: {} };
  var _hydrated = false;
  var _hydratePromise = null;
  var _listeners = [];

  function hasMainIDB() {
    return (
      typeof global !== "undefined" &&
      typeof global.openDB === "function" &&
      global.STORES &&
      global.STORES.USER_SETTINGS
    );
  }

  async function idbRead(key) {
    if (!hasMainIDB()) return null;
    try {
      var db = await global.openDB();
      return await new Promise(function (resolve) {
        var tx = db.transaction([global.STORES.USER_SETTINGS], "readonly");
        var req = tx.objectStore(global.STORES.USER_SETTINGS).get(key);
        req.onsuccess = function () {
          resolve(req.result ? req.result.value : null);
        };
        req.onerror = function () {
          resolve(null);
        };
      });
    } catch (_) {
      return null;
    }
  }

  async function idbWrite(key, value) {
    if (!hasMainIDB()) return false;
    try {
      var db = await global.openDB();
      return await new Promise(function (resolve) {
        var tx = db.transaction([global.STORES.USER_SETTINGS], "readwrite");
        tx.objectStore(global.STORES.USER_SETTINGS).put({
          key: key,
          value: value,
          updatedAt: Date.now()
        });
        tx.oncomplete = function () {
          resolve(true);
        };
        tx.onerror = function () {
          resolve(false);
        };
      });
    } catch (_) {
      return false;
    }
  }

  function clampInt(val, min, max, fallback) {
    var n = Math.floor(Number(val));
    if (!Number.isFinite(n)) n = fallback;
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  function normalizeConfig(raw, isGroup) {
    var maxLimit = isGroup ? 15 : 12;
    var minFloor = isGroup ? 2 : 1;
    var src = raw && typeof raw === "object" ? raw : {};
    var mode = src.mode === "fixed" ? "fixed" : "range";
    var fixedCount = clampInt(src.fixedCount, minFloor, maxLimit, isGroup ? 5 : 3);
    var minCount = clampInt(src.minCount, minFloor, maxLimit, isGroup ? 3 : 2);
    var maxCount = clampInt(src.maxCount, minFloor, maxLimit, isGroup ? 7 : 5);
    if (minCount > maxCount) maxCount = minCount;

    return {
      enabled: Boolean(src.enabled),
      mode: mode,
      fixedCount: fixedCount,
      minCount: minCount,
      maxCount: maxCount,
      strictAlign: src.strictAlign !== false
    };
  }

  function hydrate() {
    if (_hydrated) return Promise.resolve(_prefsCache);
    if (_hydratePromise) return _hydratePromise;
    _hydratePromise = (async function () {
      var saved = await idbRead(IDB_KEY);
      if (saved && typeof saved === "object" && saved.perChat && typeof saved.perChat === "object") {
        _prefsCache = { perChat: Object.assign({}, saved.perChat) };
      }
      _hydrated = true;
      _hydratePromise = null;
      notifyListeners();
      return _prefsCache;
    })();
    return _hydratePromise;
  }

  function notifyListeners() {
    for (var i = 0; i < _listeners.length; i++) {
      try {
        _listeners[i](_prefsCache);
      } catch (_) {}
    }
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return function () {};
    _listeners.push(fn);
    return function () {
      var idx = _listeners.indexOf(fn);
      if (idx >= 0) _listeners.splice(idx, 1);
    };
  }

  function getPrefsSync(chatId, isGroup) {
    var cid = String(chatId || "__default__");
    var raw = _prefsCache.perChat && _prefsCache.perChat[cid];
    return normalizeConfig(raw || DEFAULT_CHAT_CONFIG, !!isGroup);
  }

  async function updateChatPrefs(chatId, patch, isGroup) {
    var cid = String(chatId || "__default__");
    var current = getPrefsSync(cid, isGroup);
    var merged = normalizeConfig(Object.assign({}, current, patch || {}), isGroup);
    if (!_prefsCache.perChat) _prefsCache.perChat = {};
    _prefsCache.perChat[cid] = merged;
    notifyListeners();
    await idbWrite(IDB_KEY, _prefsCache);
    return merged;
  }

  // ==================== 2. Gate A: Pre-Request Prompt Directive ====================

  function buildPromptDirective(chatId, isGroup, plotMode) {
    var cfg = getPrefsSync(chatId, isGroup);
    if (!cfg.enabled) return "";

    var isOffline = plotMode === "offline";
    var unit = isOffline ? "个自然段" : "条独立消息气泡";

    if (cfg.mode === "fixed") {
      if (isGroup) {
        return (
          "\n【群聊输出条数铁律（用户已开启自主控制，最高优先级，覆盖前文默认句数）】\n" +
          "本次群聊回复【必须且只能】输出恰好 " + cfg.fixedCount + " 条发言（每条严格以 [角色名]: 内容 开头并独占一行，用单个换行符分隔，不要输出多余空行或编号）。\n"
        );
      }
      return (
        "\n【输出条数铁律（用户已开启自主控制，最高优先级）】\n" +
        "本次回复【必须且只能】输出恰好 " + cfg.fixedCount + " " + unit +
        "（每条严格独占一行，用单个换行符分隔，不要输出多余空行或序号）。" +
        (isOffline ? "请合理分配每段篇幅。" : "像真实聊天一样自然拆成 " + cfg.fixedCount + " 句发来，不要全部挤在同一行。") +
        "\n"
      );
    }

    // Range mode
    if (isGroup) {
      return (
        "\n【群聊输出条数铁律（用户已开启自主控制，最高优先级，覆盖前文默认句数）】\n" +
        "本次群聊回复的总发言条数【必须严格控制在 " + cfg.minCount + " 至 " + cfg.maxCount + " 条之间】" +
        "（每条严格以 [角色名]: 内容 开头并独占一行，用单个换行符分隔，根据剧情自然起伏，绝不少于 " + cfg.minCount + " 条、绝不超过 " + cfg.maxCount + " 条）。\n"
      );
    }
    return (
      "\n【输出条数铁律（用户已开启自主控制，最高优先级）】\n" +
      "本次回复的条数【必须严格控制在 " + cfg.minCount + " 至 " + cfg.maxCount + " " + unit + "之间】" +
      "（每条独占一行，用单个换行符分隔，根据当下情绪与话题自然起伏，绝不少于 " + cfg.minCount + " 条、绝不超过 " + cfg.maxCount + " 条）。\n"
    );
  }

  // ==================== 3. Gate B: Lossless Post-Reply Alignment ====================

  function isProtectedTagLine(line) {
    return PROTECTED_TAG_RE.test(String(line || ""));
  }

  function extractGroupSpeaker(line) {
    var m = String(line || "").match(GROUP_SPEAKER_RE);
    if (!m) return { speaker: "", prefix: "", body: String(line || "").trim() };
    return {
      speaker: m[1].trim(),
      prefix: m[0],
      body: String(line || "").slice(m[0].length).trim()
    };
  }

  function splitByChineseSentenceBoundary(text) {
    var s = String(text || "").trim();
    if (s.length < 12) return [s];
    // Split after 。！？… (optionally followed by closing quote/bracket) when followed by more text
    var parts = [];
    var re = /[^。！？…]+[。！？…]+(?:[”’」』）\)]+)?/g;
    var match;
    var lastIdx = 0;
    while ((match = re.exec(s)) !== null) {
      var seg = match[0].trim();
      if (seg) parts.push(seg);
      lastIdx = re.lastIndex;
    }
    var tail = s.slice(lastIdx).trim();
    if (tail) parts.push(tail);
    if (parts.length <= 1) return [s];
    return parts;
  }

  /**
   * Losslessly aligns reply lines into [minTarget, maxTarget]:
   * - Never drops text when reducing (merges adjacent normal lines; same-speaker only in group chat)
   * - Never fabricates empty lines when expanding (splits longest splittable sentence cleanly)
   * - Never breaks protected functional tag lines
   */
  function enforceReplyLines(lines, chatId, isGroup, plotMode) {
    if (!Array.isArray(lines) || lines.length === 0) return lines;
    var cfg = getPrefsSync(chatId, isGroup);
    if (!cfg.enabled || !cfg.strictAlign || plotMode === "offline") {
      return lines;
    }

    var minTarget = cfg.mode === "fixed" ? cfg.fixedCount : cfg.minCount;
    var maxTarget = cfg.mode === "fixed" ? cfg.fixedCount : cfg.maxCount;
    var out = lines.map(function (l) { return String(l || "").trim(); }).filter(Boolean);
    if (out.length === 0) return out;

    // Case 1: Too many lines -> lossless merge from the back
    var mergeGuard = 0;
    while (out.length > maxTarget && mergeGuard < 50) {
      mergeGuard++;
      var merged = false;
      for (var i = out.length - 1; i >= 1; i--) {
        var cur = out[i];
        var prev = out[i - 1];
        if (isProtectedTagLine(cur) || isProtectedTagLine(prev)) continue;

        if (isGroup) {
          var spCur = extractGroupSpeaker(cur);
          var spPrev = extractGroupSpeaker(prev);
          if (spCur.speaker && spPrev.speaker && spCur.speaker === spPrev.speaker) {
            out[i - 1] = prev + " " + spCur.body;
            out.splice(i, 1);
            merged = true;
            break;
          }
        } else {
          out[i - 1] = prev + " " + cur;
          out.splice(i, 1);
          merged = true;
          break;
        }
      }
      if (!merged) break; // Respect speaker/tag boundaries rather than corrupting attribution
    }

    // Case 2: Too few lines -> natural sentence-boundary split on longest normal line
    var splitGuard = 0;
    while (out.length < minTarget && splitGuard < 30) {
      splitGuard++;
      var bestIdx = -1;
      var bestLen = 0;
      var bestPieces = null;

      for (var j = 0; j < out.length; j++) {
        var candidate = out[j];
        if (isProtectedTagLine(candidate)) continue;
        var sp = isGroup ? extractGroupSpeaker(candidate) : { prefix: "", body: candidate };
        if (sp.body.length < 14) continue;
        var pieces = splitByChineseSentenceBoundary(sp.body);
        if (pieces.length >= 2 && sp.body.length > bestLen) {
          bestLen = sp.body.length;
          bestIdx = j;
          bestPieces = { prefix: sp.prefix, pieces: pieces };
        }
      }

      if (bestIdx < 0 || !bestPieces) break;

      // Split into two balanced halves so each bubble stays natural
      var mid = Math.ceil(bestPieces.pieces.length / 2);
      var firstHalf = bestPieces.prefix + bestPieces.pieces.slice(0, mid).join("");
      var secondHalf = bestPieces.prefix + bestPieces.pieces.slice(mid).join("");
      out.splice(bestIdx, 1, firstHalf.trim(), secondHalf.trim());
    }

    return out;
  }

  // ==================== 4. Native Settings Card Component ====================

  function ReplyCountSettingsCard(props) {
    var React = global.React;
    if (!React) return null;
    var h = React.createElement;
    var useEffect = React.useEffect;
    var useState = React.useState;

    var chatId = props && props.chatId;
    var isGroup = !!(props && props.isGroup);
    var plotMode = (props && props.plotMode) || "online";
    var maxLimit = isGroup ? 15 : 12;
    var minFloor = isGroup ? 2 : 1;

    var [cfg, setCfg] = useState(function () {
      return getPrefsSync(chatId, isGroup);
    });

    useEffect(
      function () {
        hydrate().then(function () {
          setCfg(getPrefsSync(chatId, isGroup));
        });
        return subscribe(function () {
          setCfg(getPrefsSync(chatId, isGroup));
        });
      },
      [chatId, isGroup]
    );

    function applyPatch(patch) {
      updateChatPrefs(chatId, patch, isGroup).then(function (next) {
        setCfg(next);
      });
    }

    var summaryText = !cfg.enabled
      ? "关闭状态：沿用系统默认自由输出条数"
      : cfg.mode === "fixed"
      ? "当前生效：每轮固定输出 " + cfg.fixedCount + " 条气泡"
      : "当前生效：每轮弹性输出 " + cfg.minCount + " ~ " + cfg.maxCount + " 条气泡";

    var fixedPresets = isGroup ? FIXED_PRESETS_GROUP : FIXED_PRESETS_SOLO;
    var rangePresets = isGroup ? RANGE_PRESETS_GROUP : RANGE_PRESETS_SOLO;

    return h(
      "div",
      {
        style: {
          background: "#FFFDF9",
          border: "1px solid #F2E5D5",
          borderRadius: "12px",
          padding: "12px 14px",
          marginBottom: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "10px"
        }
      },
      // Header Row with Master Toggle
      h(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" } },
        h(
          "div",
          { style: { flex: 1, minWidth: 0 } },
          h(
            "div",
            { className: "cs-label", style: { margin: 0, fontWeight: 700, color: "#5D4E37" } },
            "💬 自主控制 AI 输出条数"
          ),
          h(
            "div",
            { className: "cs-desc", style: { marginTop: "3px", color: cfg.enabled ? "#C25528" : "#8C8275" } },
            summaryText
          )
        ),
        h(
          "label",
          { className: "toggle-switch" },
          h("input", {
            type: "checkbox",
            className: "toggle-input",
            checked: !!cfg.enabled,
            onChange: function () {
              applyPatch({ enabled: !cfg.enabled });
            }
          }),
          h("span", { className: "toggle-slider" })
        )
      ),

      // Expanded Controls when Enabled
      cfg.enabled &&
        h(
          "div",
          {
            style: {
              borderTop: "1px dashed #EADBC8",
              paddingTop: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "10px"
            }
          },
          // Mode Segmented Selector
          h(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                background: "#F3ECE1",
                borderRadius: "999px",
                padding: "3px",
                gap: "4px"
              }
            },
            [
              { id: "fixed", label: "固定数目" },
              { id: "range", label: "区间范围（中间值）" }
            ].map(function (m) {
              var active = cfg.mode === m.id;
              return h(
                "button",
                {
                  key: m.id,
                  type: "button",
                  onClick: function () {
                    applyPatch({ mode: m.id });
                  },
                  style: {
                    border: "none",
                    borderRadius: "999px",
                    padding: "6px 8px",
                    fontSize: "12px",
                    fontWeight: active ? 700 : 500,
                    background: active ? "#FFFFFF" : "transparent",
                    color: active ? "#C25528" : "#7A6B5B",
                    boxShadow: active ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                    cursor: "pointer"
                  }
                },
                m.label
              );
            })
          ),

          // Mode 1: Fixed Count Controls
          cfg.mode === "fixed"
            ? h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "8px" } },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" } },
                  h("span", { style: { fontSize: "12px", color: "#5D4E37", fontWeight: 600 } }, "固定输出条数"),
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: "6px" } },
                    h(
                      "button",
                      {
                        type: "button",
                        onClick: function () { applyPatch({ fixedCount: cfg.fixedCount - 1 }); },
                        style: { width: "26px", height: "26px", borderRadius: "8px", border: "1px solid #DECBB4", background: "#FFF", cursor: "pointer", fontWeight: 700 }
                      },
                      "-"
                    ),
                    h("span", { style: { minWidth: "42px", textAlign: "center", fontSize: "13.5px", fontWeight: 800, color: "#C25528" } }, cfg.fixedCount + " 条"),
                    h(
                      "button",
                      {
                        type: "button",
                        onClick: function () { applyPatch({ fixedCount: cfg.fixedCount + 1 }); },
                        style: { width: "26px", height: "26px", borderRadius: "8px", border: "1px solid #DECBB4", background: "#FFF", cursor: "pointer", fontWeight: 700 }
                      },
                      "+"
                    )
                  )
                ),
                h("input", {
                  type: "range",
                  min: minFloor,
                  max: maxLimit,
                  step: 1,
                  value: cfg.fixedCount,
                  onChange: function (e) { applyPatch({ fixedCount: Number(e.target.value) }); },
                  style: { width: "100%", accentColor: "#D6724B" }
                }),
                h(
                  "div",
                  { style: { display: "flex", flexWrap: "wrap", gap: "6px" } },
                  fixedPresets.map(function (n) {
                    var sel = cfg.fixedCount === n;
                    return h(
                      "button",
                      {
                        key: n,
                        type: "button",
                        onClick: function () { applyPatch({ fixedCount: n }); },
                        style: {
                          border: sel ? "1px solid #D6724B" : "1px solid #E5D6C3",
                          background: sel ? "#FFF0E8" : "#FAF6F0",
                          color: sel ? "#C25528" : "#786958",
                          fontSize: "11px",
                          fontWeight: sel ? 700 : 500,
                          borderRadius: "999px",
                          padding: "3px 10px",
                          cursor: "pointer"
                        }
                      },
                      n + " 条"
                    );
                  })
                )
              )
            : // Mode 2: Range Controls
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "8px" } },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" } },
                  h("span", { style: { fontSize: "12px", color: "#5D4E37", fontWeight: 600 } }, "最少条数：" + cfg.minCount + " 条"),
                  h("input", {
                    type: "range",
                    min: minFloor,
                    max: maxLimit,
                    step: 1,
                    value: cfg.minCount,
                    onChange: function (e) {
                      var v = Number(e.target.value);
                      applyPatch({ minCount: v, maxCount: Math.max(v, cfg.maxCount) });
                    },
                    style: { width: "56%", accentColor: "#D6724B" }
                  })
                ),
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" } },
                  h("span", { style: { fontSize: "12px", color: "#5D4E37", fontWeight: 600 } }, "最多条数：" + cfg.maxCount + " 条"),
                  h("input", {
                    type: "range",
                    min: minFloor,
                    max: maxLimit,
                    step: 1,
                    value: cfg.maxCount,
                    onChange: function (e) {
                      var v = Number(e.target.value);
                      applyPatch({ maxCount: v, minCount: Math.min(v, cfg.minCount) });
                    },
                    style: { width: "56%", accentColor: "#D6724B" }
                  })
                ),
                h(
                  "div",
                  { style: { display: "flex", flexWrap: "wrap", gap: "6px" } },
                  rangePresets.map(function (p) {
                    var sel = cfg.minCount === p.min && cfg.maxCount === p.max;
                    return h(
                      "button",
                      {
                        key: p.label,
                        type: "button",
                        onClick: function () { applyPatch({ minCount: p.min, maxCount: p.max }); },
                        style: {
                          border: sel ? "1px solid #D6724B" : "1px solid #E5D6C3",
                          background: sel ? "#FFF0E8" : "#FAF6F0",
                          color: sel ? "#C25528" : "#786958",
                          fontSize: "11px",
                          fontWeight: sel ? 700 : 500,
                          borderRadius: "999px",
                          padding: "3px 9px",
                          cursor: "pointer"
                        }
                      },
                      p.label
                    );
                  })
                )
              ),

          // Strict align toggle
          h(
            "div",
            { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", paddingTop: "2px" } },
            h(
              "span",
              { style: { fontSize: "11.5px", color: "#7B6C5B" } },
              "智能无损对齐（模型条数偏离时自动合并/按句号拆分，不丢字）"
            ),
            h("input", {
              type: "checkbox",
              checked: cfg.strictAlign !== false,
              onChange: function () { applyPatch({ strictAlign: cfg.strictAlign === false }); },
              style: { accentColor: "#D6724B", cursor: "pointer" }
            })
          ),

          plotMode === "offline" &&
            h(
              "div",
              { style: { fontSize: "11px", color: "#A16207", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "8px", padding: "6px 8px" } },
              "当前为线下剧情模式：仅通过提示词引导段落数量，不做硬性标点切分，保留完整文风。"
            )
        )
    );
  }

  // Kick off background hydration on script load
  if (typeof setTimeout === "function") {
    setTimeout(function () { hydrate().catch(function () {}); }, 0);
  }

  global.ChatReplyCountEngine = {
    version: "1.0.0",
    DEFAULT_CHAT_CONFIG: DEFAULT_CHAT_CONFIG,
    hydrate: hydrate,
    getPrefsSync: getPrefsSync,
    updateChatPrefs: updateChatPrefs,
    normalizeConfig: normalizeConfig,
    buildPromptDirective: buildPromptDirective,
    enforceReplyLines: enforceReplyLines,
    ReplyCountSettingsCard: ReplyCountSettingsCard
  };
})(typeof window !== "undefined" ? window : globalThis);

