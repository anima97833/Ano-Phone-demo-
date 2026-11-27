/**
 * Milvus/xiajian_media_engine.js
 * 主屏幕应用「狭间 · 天道收容所」独立档案影像采录引擎（Step 2）
 *
 * 功能：
 * 1. 复用朋友圈生图管线（window.translateMomentTextToVisualPrompt + window.generateAIImage）
 * 2. 支持三轨按需采录：
 *    - 商业作图 AI（读取 image_generation_api_config）
 *    - 内置免费生图（Pollinations.ai Flux，支持换 seed 重绘）
 *    - 本地上传图片（离屏 Canvas 自动压缩至 ≤ 960px JPEG，存入 IndexedDB）
 * 3. 支持 5 套高契合度快捷画风 + 用户自由手写画风（记忆上次偏好）
 * 4. 严格零 Emoji，100% 极简矢量 SVG 图标，持久化至 milvus_xiajian_idb -> anomaly_media
 */
(function (global) {
  "use strict";

  var STYLE_PREF_KEY = "xiajian_media_last_style_v1";

  var STYLE_PRESETS = [
    {
      id: "archival_film",
      label: "民国旧档案胶片",
      enPrompt: "vintage 1920s archival sepia photograph, eerie grainy film texture, dim tungsten shadow, mysterious artifact evidence photo"
    },
    {
      id: "ink_folklore",
      label: "中式志怪残卷水墨",
      enPrompt: "ancient Chinese ink wash illustration on aged rice paper, eerie folk horror aesthetic, muted crimson and jade accents, atmospheric mist"
    },
    {
      id: "dark_engraving",
      label: "克系暗黑铜版画",
      enPrompt: "dark lovecraftian antique copperplate engraving, intricate crosshatching linework, occult shadows, aged parchment background"
    },
    {
      id: "field_sketch",
      label: "博物标本手绘",
      enPrompt: "aged botanical and occult field journal sketch on yellowed parchment, sepia ink line drawing, subtle watercolor wash"
    },
    {
      id: "gongbi_surreal",
      label: "工笔重彩诡异风",
      enPrompt: "traditional Chinese gongbi fine-brush painting, dark surreal haunting mood, antique gold leaf and cinnabar red details"
    }
  ];

  // ==================== 1. Config & Prompt Pipeline (Mirrors Moments) ====================

  function getCommercialImgGenStatus() {
    try {
      var raw = global.localStorage && global.localStorage.getItem("image_generation_api_config");
      if (!raw) return { configured: false, enabled: false, provider: "" };
      var cfg = JSON.parse(raw);
      var configured = Boolean(cfg && cfg.apiKey && cfg.url);
      var enabled = configured && cfg.enabled !== false;
      return {
        configured: configured,
        enabled: enabled,
        provider: String((cfg && (cfg.provider || cfg.model)) || "自定义作图API")
      };
    } catch (_) {
      return { configured: false, enabled: false, provider: "" };
    }
  }

  function loadLastStylePref() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STYLE_PREF_KEY);
      if (raw) {
        var obj = JSON.parse(raw);
        if (obj && typeof obj === "object") {
          return {
            presetId: typeof obj.presetId === "string" ? obj.presetId : "",
            customStyle: typeof obj.customStyle === "string" ? obj.customStyle : ""
          };
        }
      }
    } catch (_) {}
    return { presetId: STYLE_PRESETS[0].id, customStyle: "" };
  }

  function saveLastStylePref(presetId, customStyle) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(
          STYLE_PREF_KEY,
          JSON.stringify({ presetId: typeof presetId === "string" ? presetId : "", customStyle: String(customStyle || "").trim() })
        );
      }
    } catch (_) {}
  }

  // Dedicated artifact/anomaly subject dictionary (avoids Moments' scenic dict turning 竹简 into a garden bridge!)
  var ARTIFACT_VISUAL_DICT = [
    [/竹简|简牍|竹册|朱批|书简|诏书|卷宗|残册|帛书|书卷/, "close-up centered photograph of an ancient Han dynasty bound bamboo slip scroll unrolled on a dark wooden table, faint glowing cinnabar red ink brush markings on weathered bamboo slats"],
    [/铜镜|古镜|镜子|镜面|菱花镜/, "close-up centered view of an antique corroded Han dynasty bronze mirror resting on dark cloth, eerie misty reflection on the tarnished metal surface"],
    [/铃|铜铃|风铃|钟|磬|编钟/, "close-up centered view of an ancient weathered Chinese ritual bronze bell suspended in dim candlelight, verdigris patina, mysterious shadows"],
    [/灯|烛|纸灯|灯笼|青灯|油灯|长明灯/, "close-up centered view of an eerie antique Chinese wooden lantern with pale ghostly flame glowing inside a dark chamber"],
    [/碗|粥|瓷碗|茶盏|酒杯|玉杯|皿|盆/, "close-up centered view of an antique cracked Chinese celadon porcelain bowl resting on a dark table, faint cold mist rising from inside"],
    [/鼎|炉|香炉|铜鼎|漏壶|铜壶|酒壶/, "close-up centered view of an ancient three-legged Chinese ritual bronze vessel with faint pale incense smoke curling upward in darkness"],
    [/伞|油纸伞|衣|袍|裙|绣鞋|履|帽|冠/, "close-up centered view of an antique weathered Chinese oiled-paper umbrella or embroidered silk robe displayed in a dim eerie chamber"],
    [/面具|傩面|戏服|傀儡|木偶|人偶|纸人/, "close-up centered view of an eerie antique Chinese wooden nuo opera mask or jointed wooden puppet in dramatic chiaroscuro lighting"],
    [/印|玉玺|官印|符|镇符|签|卦|罗盘|铜钱/, "close-up centered view of an ancient carved Chinese jade seal and cinnabar vermilion paper talisman resting on a dark stone desk"],
    [/剑|刀|刃|戟|枪|箭|锁|铜锁|锁链/, "close-up centered view of an antique rusted Han dynasty ritual bronze sword or heavy ornate iron lock wrapped in red cord"],
    [/碑|石碑|残碑|石像|神像|祭坛|棺|冢/, "close-up centered view of a weathered ancient Chinese carved stone stele covered in faint moss and glowing crimson fissures"],
    [/琴|古琴|琵琶|笛|箫|鼓/, "close-up centered view of an antique weathered Chinese seven-string guqin zither with frayed silk strings in dim moody lighting"],
    [/舆图|地图|画卷|屏风|扇|折扇|团扇/, "close-up centered view of an antique yellowed silk scroll map with intricate dark ink alleys and faint red ink marks on a wooden table"]
  ];

  function buildOfflineArtifactSubjectEn(anomaly) {
    var combined =
      String((anomaly && anomaly.name) || "") +
      " " +
      String((anomaly && anomaly.reactionType) || "") +
      " " +
      String((anomaly && anomaly.description) || "").slice(0, 120);
    for (var i = 0; i < ARTIFACT_VISUAL_DICT.length; i++) {
      if (ARTIFACT_VISUAL_DICT[i][0].test(combined)) {
        return ARTIFACT_VISUAL_DICT[i][1];
      }
    }
    return "close-up centered archival evidence shot of a mysterious ancient Han dynasty paranormal relic resting on a dark wooden table, dim eerie tungsten shadow";
  }

  function hasConfiguredTextApi() {
    try {
      var mm = JSON.parse((global.localStorage && global.localStorage.getItem("minimax_api_config")) || "null");
      if (mm && mm.apiKey && mm.groupId) return true;
      var cfgs = JSON.parse((global.localStorage && global.localStorage.getItem("api_configs")) || "[]");
      return Array.isArray(cfgs) && cfgs.some(function (c) { return c && c.url && c.apiKey; });
    } catch (_) {
      return false;
    }
  }

  /**
   * Builds a strictly accurate English visual prompt for the specific anomaly artifact/entity
   * + optional preset/custom art style. Uses window.sendToLLM with a 12s timeout (focused on
   * exact physical subject, NEVER substituting landscapes/bridges), falling back to our
   * artifact-specific keyword dictionary.
   */
  async function buildAnomalyVisualPrompt(anomaly, opts) {
    var presetId = opts && typeof opts.presetId === "string" ? opts.presetId : "";
    var customStyle = String((opts && opts.customStyle) || "").trim();
    var preset = presetId
      ? STYLE_PRESETS.find(function (p) { return p.id === presetId; }) || null
      : null;

    var nameCn = String((anomaly && anomaly.name) || "未知异物").trim();
    var typeCn = String((anomaly && anomaly.reactionType) || "怪异").trim();
    var descCn = String((anomaly && anomaly.description) || "").trim().slice(0, 180);

    var translated = "";
    if (typeof global.sendToLLM === "function" && hasConfiguredTextApi()) {
      try {
        translated = await new Promise(function (resolve) {
          var settled = false;
          var timer = setTimeout(function () {
            if (!settled) { settled = true; resolve(""); }
          }, 12000);
          global.sendToLLM(
            [
              {
                role: "system",
                content:
                  "You are an expert English image-generation prompt writer for an ancient Han-dynasty supernatural containment archive (SCP-style). " +
                  "Convert the Chinese anomaly dossier (and optional user art style) into ONE precise English prompt (28-50 words). " +
                  "CRITICAL RULES:\n" +
                  "1. Depict the EXACT physical object, relic, or creature named in the dossier as a clear, centered close-up subject (e.g., bamboo slips scroll with red ink, bronze mirror, porcelain bowl, lantern, stele).\n" +
                  "2. NEVER substitute the object with generic landscapes, gardens, bridges, mountains, or pavilions unless the anomaly itself is explicitly an outdoor building.\n" +
                  "3. If a custom art style is provided in Chinese, translate that art style accurately into English style keywords.\n" +
                  "4. Output ONLY clean English prompt tokens, no Chinese characters, no quotes, no explanation."
              },
              {
                role: "user",
                content:
                  "Anomaly Name: " + nameCn +
                  "\nType: " + typeCn +
                  "\nPhysical Description: " + descCn +
                  (customStyle ? "\nRequested Art Style: " + customStyle : "")
              }
            ],
            { temperature: 0.3, top_p: 0.9, disableMCP: true },
            function (res) {
              if (!settled) { settled = true; clearTimeout(timer); resolve(String(res || "")); }
            },
            function () {
              if (!settled) { settled = true; clearTimeout(timer); resolve(""); }
            }
          );
        });
      } catch (_) {}
    }

    var cleanedEn = String(translated || "")
      .replace(/[\u4e00-\u9fa5]/g, " ")
      .replace(/["'`{}\[\]]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    var subjectEn = cleanedEn.length >= 16 ? cleanedEn : buildOfflineArtifactSubjectEn(anomaly);

    var parts = [];
    if (preset && preset.enPrompt) parts.push(preset.enPrompt);
    // If customStyle has English tokens and LLM wasn't used, keep its ASCII portion
    if (customStyle && cleanedEn.length < 16) {
      var asciiStyle = customStyle.replace(/[\u4e00-\u9fa5]/g, " ").replace(/\s+/g, " ").trim();
      if (asciiStyle.length >= 3) parts.push(asciiStyle);
    }
    parts.push(subjectEn);
    parts.push("centered vertical portrait composition, dramatic chiaroscuro lighting, highly detailed, no text, no letters, no watermark");
    return parts.join(", ");
  }

  function buildBuiltinFluxUrl(prompt) {
    var seed = Math.floor(Math.random() * 1000000);
    return (
      "https://image.pollinations.ai/prompt/" +
      encodeURIComponent(prompt) +
      "?width=768&height=1024&seed=" +
      seed +
      "&nologo=true&enhance=false&model=flux"
    );
  }

  /**
   * Generate image via commercial API (window.generateAIImage) OR forced built-in Flux.
   */
  async function generateAnomalyImage(anomaly, opts) {
    var mode = (opts && opts.mode) || "commercial_ai"; // "commercial_ai" | "builtin_flux"
    var visualPrompt = await buildAnomalyVisualPrompt(anomaly, opts);
    var imageUrl = "";

    if (mode === "builtin_flux") {
      imageUrl = buildBuiltinFluxUrl(visualPrompt);
    } else if (typeof global.generateAIImage === "function") {
      imageUrl = await global.generateAIImage(visualPrompt, { ignoreDisabled: false });
    } else {
      imageUrl = buildBuiltinFluxUrl(visualPrompt);
    }

    if (!imageUrl) {
      throw new Error("未能生成有效影像链接");
    }

    var chosenPresetId = opts && typeof opts.presetId === "string" ? opts.presetId : "";
    var preset = chosenPresetId
      ? STYLE_PRESETS.find(function (p) { return p.id === chosenPresetId; })
      : null;
    saveLastStylePref(chosenPresetId, opts && opts.customStyle);

    return {
      imageUrl: imageUrl,
      visualPrompt: visualPrompt,
      styleLabel: (opts && opts.customStyle)
        ? String(opts.customStyle).slice(0, 20)
        : (preset ? preset.label : "不限定画风"),
      styleCustom: String((opts && opts.customStyle) || "").trim(),
      sourceMode: mode
    };
  }

  /**
   * Compress a locally uploaded image File via offscreen Canvas (<= 960px, JPEG 0.85)
   * so IndexedDB storage remains fast and lightweight.
   */
  function compressImageFileToDataUrl(file, maxSide, quality) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error("未选择图片文件"));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("读取图片文件失败")); };
      reader.onload = function () {
        var rawDataUrl = String(reader.result || "");
        if (typeof Image === "undefined" || typeof document === "undefined") {
          resolve(rawDataUrl);
          return;
        }
        var img = new Image();
        img.onerror = function () { resolve(rawDataUrl); };
        img.onload = function () {
          try {
            var limit = maxSide || 960;
            var w = img.naturalWidth || img.width || 640;
            var h = img.naturalHeight || img.height || 640;
            if (w > limit || h > limit) {
              var ratio = Math.min(limit / w, limit / h);
              w = Math.max(1, Math.round(w * ratio));
              h = Math.max(1, Math.round(h * ratio));
            }
            var canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, w, h);
            var compressed = canvas.toDataURL("image/jpeg", quality || 0.85);
            resolve(compressed || rawDataUrl);
          } catch (_) {
            resolve(rawDataUrl);
          }
        };
        img.src = rawDataUrl;
      };
      reader.readAsDataURL(file);
    });
  }

  // ==================== 2. Zero-Emoji Vector SVG Icons ====================

  function MediaSvg(h, name, size, color) {
    var common = {
      width: size || 15,
      height: size || 15,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: color || "currentColor",
      strokeWidth: 1.85,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: { display: "block", flexShrink: 0 }
    };
    if (name === "close") return h("svg", common, h("path", { d: "M6 6l12 12M18 6L6 18" }));
    if (name === "upload") return h("svg", common, h("path", { d: "M12 16V4m0 0l-4 4m4-4l4 4M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" }));
    if (name === "trash") return h("svg", common, h("path", { d: "M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" }));
    if (name === "spark") return h("svg", common, h("path", { d: "M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" }));
    return h("svg", common,
      h("rect", { x: 3, y: 5, width: 18, height: 14, rx: 2 }),
      h("circle", { cx: 8.5, cy: 10, r: 1.5 }),
      h("path", { d: "M21 15l-5-5-8 8" })
    );
  }

  // ==================== 3. On-Demand Media Capture Modal ====================

  function MediaCaptureModal(props) {
    var React = global.React;
    if (!React) return null;
    var h = React.createElement;
    var useRef = React.useRef;
    var useState = React.useState;

    var anomaly = props && props.anomaly;
    var onClose = props && props.onClose;
    var onSaved = props && props.onSaved;
    if (!anomaly) return null;

    var initPref = loadLastStylePref();
    var [presetId, setPresetId] = useState(initPref.presetId);
    var [customStyle, setCustomStyle] = useState(initPref.customStyle || "");
    var [previewUrl, setPreviewUrl] = useState(anomaly.imageUrl || "");
    var [previewMeta, setPreviewMeta] = useState(anomaly.mediaMeta || null);
    var [busyMode, setBusyMode] = useState(""); // "" | "commercial_ai" | "builtin_flux" | "local_upload"
    var [imgLoading, setImgLoading] = useState(false);
    var [statusMsg, setStatusMsg] = useState("");
    var fileRef = useRef(null);

    var apiStatus = getCommercialImgGenStatus();
    var Engine = global.XiajianEngine;

    async function handleGenerate(mode) {
      if (busyMode) return;
      setBusyMode(mode);
      setStatusMsg(mode === "commercial_ai" ? "正在转译画面并调用作图 AI…" : "正在启动内置 Flux 引擎显影…");
      try {
        var res = await generateAnomalyImage(anomaly, {
          mode: mode,
          presetId: presetId,
          customStyle: customStyle
        });
        setPreviewUrl(res.imageUrl);
        setPreviewMeta(res);
        setImgLoading(true);
        if (Engine && typeof Engine.saveAnomalyMedia === "function") {
          await Engine.saveAnomalyMedia(anomaly.id, res);
        }
        setStatusMsg("影像已采录并存入狭间档案库（IndexedDB）");
        if (onSaved) onSaved(res.imageUrl, res);
      } catch (e) {
        setStatusMsg("生图失败：" + (e && e.message ? e.message : e));
      }
      setBusyMode("");
    }

    async function handleUploadFile(ev) {
      var file = ev.target && ev.target.files && ev.target.files[0];
      if (!file) return;
      setBusyMode("local_upload");
      setStatusMsg("正在压缩并封存本地影像…");
      try {
        var dataUrl = await compressImageFileToDataUrl(file, 960, 0.85);
        var meta = {
          imageUrl: dataUrl,
          styleLabel: "本地上传影像",
          styleCustom: customStyle,
          sourceMode: "local_upload"
        };
        if (Engine && typeof Engine.saveAnomalyMedia === "function") {
          await Engine.saveAnomalyMedia(anomaly.id, meta);
        }
        setPreviewUrl(dataUrl);
        setPreviewMeta(meta);
        setStatusMsg("本地影像已封存入 IndexedDB");
        if (onSaved) onSaved(dataUrl, meta);
      } catch (e) {
        setStatusMsg("上传失败：" + (e && e.message ? e.message : e));
      }
      setBusyMode("");
      if (fileRef.current) fileRef.current.value = "";
    }

    async function handleClearImage() {
      if (Engine && typeof Engine.deleteAnomalyMedia === "function") {
        await Engine.deleteAnomalyMedia(anomaly.id);
      }
      setPreviewUrl("");
      setPreviewMeta(null);
      setStatusMsg("已清除影像，恢复留空相框");
      if (onSaved) onSaved("", null);
    }

    return h(
      "div",
      {
        onClick: function (e) { if (e.target === e.currentTarget && !busyMode && onClose) onClose(); },
        style: {
          position: "fixed",
          inset: 0,
          zIndex: 1040,
          background: "rgba(12, 14, 15, 0.82)",
          backdropFilter: "blur(5px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px"
        }
      },
      h(
        "div",
        {
          style: {
            width: "100%",
            maxWidth: "375px",
            maxHeight: "88vh",
            overflowY: "auto",
            background: "#F4EEE2",
            color: "#29221F",
            borderRadius: "14px",
            border: "2px solid #8D2621",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            boxShadow: "0 14px 36px rgba(0,0,0,0.45)"
          }
        },
        // Header
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
          h(
            "div",
            null,
            h("div", { style: { fontSize: "15px", fontWeight: 900, color: "#7A1F1B" } }, "档案影像采录"),
            h("div", { style: { fontSize: "11px", color: "#7D6F61", marginTop: "2px" } }, anomaly.code + " · " + anomaly.name)
          ),
          h(
            "button",
            { type: "button", onClick: function () { if (!busyMode && onClose) onClose(); }, style: { border: "none", background: "transparent", cursor: "pointer", color: "#5C4D42" } },
            MediaSvg(h, "close", 18, "#5C4D42")
          )
        ),

        // Preview Frame
        h(
          "div",
          {
            style: {
              position: "relative",
              width: "100%",
              height: "196px",
              borderRadius: "8px",
              background: "#1B1717",
              border: "1.5px solid #4A3835",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }
          },
          previewUrl
            ? h("img", {
                src: previewUrl,
                alt: anomaly.name,
                onLoad: function () { setImgLoading(false); },
                onError: function () {
                  setImgLoading(false);
                  setStatusMsg("外链显影超时，可点击内置绘图重掷或上传本地图片");
                },
                style: {
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  filter: "contrast(1.04) sepia(0.14)"
                }
              })
            : h(
                "div",
                { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", color: "#A89E92", fontSize: "12px" } },
                MediaSvg(h, "image", 26, "#A89E92"),
                "当前相框留空 · 选择画风后按需采录"
              ),
          (busyMode || imgLoading) &&
            h(
              "div",
              {
                style: {
                  position: "absolute",
                  inset: 0,
                  background: "rgba(18, 15, 14, 0.72)",
                  color: "#F3E6D0",
                  fontSize: "12px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }
              },
              "影像显影中，请稍候…"
            )
        ),

        // Art Style Presets (click again to deselect) + Free Custom Style Input
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "7px" } },
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h("span", { style: { fontSize: "11.5px", fontWeight: 800, color: "#4D4036" } }, "选择或自拟画风"),
            h("span", { style: { fontSize: "10px", color: "#8C7E70" } }, presetId ? "再次点击已选画风可取消" : "当前未选预设画风")
          ),
          h(
            "div",
            { style: { display: "flex", flexWrap: "wrap", gap: "6px" } },
            STYLE_PRESETS.map(function (st) {
              var active = presetId === st.id;
              return h(
                "button",
                {
                  key: st.id,
                  type: "button",
                  onClick: function () { setPresetId(active ? "" : st.id); },
                  style: {
                    border: active ? "1.5px solid #8D2621" : "1px solid #C8BCA8",
                    background: active ? "rgba(141, 38, 33, 0.12)" : "#FFFDF9",
                    color: active ? "#8D2621" : "#5A4D42",
                    borderRadius: "6px",
                    padding: "4px 8px",
                    fontSize: "11px",
                    fontWeight: active ? 800 : 500,
                    cursor: "pointer"
                  }
                },
                st.label
              );
            })
          ),
          h("input", {
            type: "text",
            value: customStyle,
            onChange: function (e) { setCustomStyle(e.target.value); },
            placeholder: "自由补充想要的画风（如：暗黑油画厚涂 / 黑白版画 / 赛博道教）…",
            style: {
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid #C8BCA8",
              borderRadius: "8px",
              padding: "8px 10px",
              fontSize: "12px",
              background: "#FFFDF9",
              color: "#2B221D",
              outline: "none"
            }
          })
        ),

        // Three Capture Tracks
        h(
          "div",
          { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" } },
          h(
            "button",
            {
              type: "button",
              disabled: !!busyMode,
              onClick: function () { handleGenerate("commercial_ai"); },
              style: {
                height: "38px",
                border: "none",
                borderRadius: "8px",
                background: busyMode ? "#A88B84" : "#8D2621",
                color: "#FFF6E6",
                fontSize: "12px",
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
                cursor: busyMode ? "wait" : "pointer"
              }
            },
            MediaSvg(h, "spark", 14, "#FFF6E6"),
            apiStatus.enabled ? "作图 AI 生成" : "AI 智能生图"
          ),
          h(
            "button",
            {
              type: "button",
              disabled: !!busyMode,
              onClick: function () { handleGenerate("builtin_flux"); },
              style: {
                height: "38px",
                border: "1.5px solid #4D7768",
                borderRadius: "8px",
                background: "#EAF3EF",
                color: "#2F584A",
                fontSize: "12px",
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
                cursor: busyMode ? "wait" : "pointer"
              }
            },
            MediaSvg(h, "image", 14, "#2F584A"),
            "内置免费生图"
          )
        ),

        // Local Upload + Clear Row
        h(
          "div",
          { style: { display: "flex", gap: "8px" } },
          h("input", {
            ref: fileRef,
            type: "file",
            accept: "image/*",
            style: { display: "none" },
            onChange: handleUploadFile
          }),
          h(
            "button",
            {
              type: "button",
              disabled: !!busyMode,
              onClick: function () { if (fileRef.current) fileRef.current.click(); },
              style: {
                flex: 1,
                height: "36px",
                border: "1px dashed #9B8E80",
                borderRadius: "8px",
                background: "#FFFDF9",
                color: "#4D4036",
                fontSize: "12px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
                cursor: busyMode ? "wait" : "pointer"
              }
            },
            MediaSvg(h, "upload", 14, "#4D4036"),
            "本地上传图片（存 IndexedDB）"
          ),
          previewUrl &&
            h(
              "button",
              {
                type: "button",
                disabled: !!busyMode,
                onClick: handleClearImage,
                title: "清除影像恢复留空",
                style: {
                  width: "40px",
                  height: "36px",
                  border: "1px solid #D4B5AF",
                  borderRadius: "8px",
                  background: "#FDF3F1",
                  color: "#9A221C",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer"
                }
              },
              MediaSvg(h, "trash", 15, "#9A221C")
            )
        ),

        statusMsg &&
          h(
            "div",
            { style: { fontSize: "11px", color: "#6E5A48", background: "#ECE4D6", borderRadius: "6px", padding: "6px 9px", lineHeight: 1.5 } },
            statusMsg
          ),
        previewMeta && previewMeta.sourceMode &&
          h(
            "div",
            { style: { fontSize: "10.5px", color: "#8C7E70", textAlign: "right" } },
            "当前来源：" +
              (previewMeta.sourceMode === "local_upload"
                ? "本地上传"
                : previewMeta.sourceMode === "builtin_flux"
                ? "内置免费 Flux"
                : "作图 AI") +
              (previewMeta.styleLabel ? " ｜ 画风：" + previewMeta.styleLabel : "")
          )
      )
    );
  }

  global.XiajianMediaEngine = {
    version: "1.0.0",
    STYLE_PRESETS: STYLE_PRESETS,
    getCommercialImgGenStatus: getCommercialImgGenStatus,
    buildAnomalyVisualPrompt: buildAnomalyVisualPrompt,
    generateAnomalyImage: generateAnomalyImage,
    compressImageFileToDataUrl: compressImageFileToDataUrl,
    MediaCaptureModal: MediaCaptureModal
  };
})(typeof window !== "undefined" ? window : globalThis);

