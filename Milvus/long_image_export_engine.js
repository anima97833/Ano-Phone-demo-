/**
 * Milvus Long Image Export Engine (Dual-Track Fallback + Mobile Long-Press Preview)
 *
 * Solves "当前环境未加载 html2canvas / 截图组件" and mobile <a download> failures across:
 *   - 笔墨诗书 (Milvus/ink_poetry_app.js)
 *   - 故事接龙 (Milvus/story_loom_app.js)
 *   - 沧海一刻 (Milvus/moment_calendar_app.js)
 *   - 聊天报告 (Milvus/chat_report_app.js)
 *
 * Track 1: Dynamically loads html2canvas@1.4.1 from multi-CDN mirrors and verifies untainted output.
 * Track 2: 100% offline pure Native Canvas 2D structured stationery renderer (zero external deps, zero CORS taint).
 * Mobile UX: Automatically opens a fullscreen scrollable <img> preview modal so iOS/Android/WeChat users
 *            can long-press to save to album, alongside one-click download / Web Share API.
 */
(function (global) {
  "use strict";

  var CDN_URLS = [
    "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",
    "https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"
  ];

  var CDN_TIMEOUT_MS = 4500;
  var PREVIEW_MODAL_ID = "milvus-long-image-preview-modal";

  // Capture any pre-loaded real html2canvas (ignoring our own proxy)
  var realHtml2CanvasFn =
    typeof global.html2canvas === "function" && !global.html2canvas.__isMilvusExportProxy
      ? global.html2canvas
      : null;

  var cdnLoadPromise = null;
  var cdnLoadAttempted = false;

  // ==================== Track 1: Dynamic Multi-CDN Loader ====================

  function loadScriptWithTimeout(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (typeof document === "undefined" || !document.head) {
        reject(new Error("DOM unavailable"));
        return;
      }
      var settled = false;
      var script = document.createElement("script");
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = url;

      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        try {
          if (script.parentNode) script.parentNode.removeChild(script);
        } catch (_) {}
        reject(new Error("Timeout loading " + url));
      }, timeoutMs || CDN_TIMEOUT_MS);

      script.onload = function () {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };

      script.onerror = function () {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          if (script.parentNode) script.parentNode.removeChild(script);
        } catch (_) {}
        reject(new Error("Failed loading " + url));
      };

      document.head.appendChild(script);
    });
  }

  function loadRealHtml2Canvas() {
    if (realHtml2CanvasFn) return Promise.resolve(realHtml2CanvasFn);
    if (cdnLoadPromise) return cdnLoadPromise;
    if (cdnLoadAttempted) return Promise.resolve(null);
    if (typeof document === "undefined") return Promise.resolve(null);

    cdnLoadPromise = (async function () {
      for (var i = 0; i < CDN_URLS.length; i++) {
        try {
          // Temporarily clear global.html2canvas so UMD bundle attaches the real implementation
          var prevProxy = global.html2canvas;
          try {
            delete global.html2canvas;
          } catch (_) {
            global.html2canvas = undefined;
          }
          await loadScriptWithTimeout(CDN_URLS[i], CDN_TIMEOUT_MS);
          if (
            typeof global.html2canvas === "function" &&
            !global.html2canvas.__isMilvusExportProxy
          ) {
            realHtml2CanvasFn = global.html2canvas;
            // Restore our dual-track proxy so all future calls still get fallback + mobile preview
            global.html2canvas = milvusHtml2CanvasProxy;
            cdnLoadAttempted = true;
            cdnLoadPromise = null;
            return realHtml2CanvasFn;
          } else {
            global.html2canvas = prevProxy;
          }
        } catch (_) {
          // Restore proxy before trying next CDN
          global.html2canvas = milvusHtml2CanvasProxy;
        }
      }
      cdnLoadAttempted = true;
      cdnLoadPromise = null;
      return null;
    })();

    return cdnLoadPromise;
  }

  // ==================== Track 2: Offline Native Canvas 2D Renderer ====================

  function isElementHidden(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = (el.tagName || "").toUpperCase();
    if (
      tag === "SCRIPT" ||
      tag === "STYLE" ||
      tag === "NOSCRIPT" ||
      tag === "BUTTON" ||
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      tag === "SVG"
    ) {
      return true;
    }
    if (el.getAttribute && el.getAttribute("data-export-ignore") === "true") {
      return true;
    }
    if (typeof global.getComputedStyle === "function") {
      try {
        var cs = global.getComputedStyle(el);
        if (cs && (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0")) {
          return true;
        }
      } catch (_) {}
    }
    return false;
  }

  function normalizeText(str) {
    if (!str) return "";
    return String(str)
      .replace(/\r\n/g, "\n")
      .replace(/\u00A0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /**
   * Walk DOM tree and extract structured visual blocks without duplicating nested text.
   * Returns array of: { type: 'title'|'subtitle'|'quote'|'meta'|'paragraph'|'divider', text?: string }
   */
  function extractStructuredBlocks(rootEl) {
    var blocks = [];
    if (!rootEl) return blocks;

    var BLOCK_TAGS = {
      DIV: 1,
      P: 1,
      H1: 1,
      H2: 1,
      H3: 1,
      H4: 1,
      H5: 1,
      H6: 1,
      LI: 1,
      BLOCKQUOTE: 1,
      SECTION: 1,
      ARTICLE: 1,
      HEADER: 1,
      FOOTER: 1,
      PRE: 1,
      HR: 1,
      TR: 1
    };

    var firstTitleSeen = false;

    function hasBlockChildren(el) {
      var children = el.childNodes || [];
      for (var i = 0; i < children.length; i++) {
        var c = children[i];
        if (c.nodeType === 1 && !isElementHidden(c)) {
          var t = (c.tagName || "").toUpperCase();
          if (BLOCK_TAGS[t]) return true;
        }
      }
      return false;
    }

    function getDirectInlineText(el) {
      var parts = [];
      var children = el.childNodes || [];
      for (var i = 0; i < children.length; i++) {
        var c = children[i];
        if (c.nodeType === 3) {
          parts.push(c.nodeValue || "");
        } else if (c.nodeType === 1 && !isElementHidden(c)) {
          var t = (c.tagName || "").toUpperCase();
          if (t === "BR") {
            parts.push("\n");
          } else if (!BLOCK_TAGS[t]) {
            parts.push(getDirectInlineText(c));
          }
        }
      }
      return parts.join("");
    }

    function classifyElement(el, text) {
      var tag = (el.tagName || "").toUpperCase();
      if (tag === "H1" || tag === "H2") {
        firstTitleSeen = true;
        return "title";
      }
      if (tag === "H3" || tag === "H4") {
        return firstTitleSeen ? "subtitle" : ((firstTitleSeen = true), "title");
      }
      if (tag === "BLOCKQUOTE") return "quote";

      // Inspect computed font size / weight when available
      if (typeof global.getComputedStyle === "function") {
        try {
          var cs = global.getComputedStyle(el);
          var fs = parseFloat(cs.fontSize) || 14;
          var fw = parseInt(cs.fontWeight, 10) || (cs.fontWeight === "bold" ? 700 : 400);
          if (fs >= 18 && text.length <= 42) {
            if (!firstTitleSeen) {
              firstTitleSeen = true;
              return "title";
            }
            return "subtitle";
          }
          if (fs <= 12 && text.length <= 60) {
            return "meta";
          }
          if (fw >= 600 && text.length <= 36 && text.indexOf("\n") === -1) {
            return "subtitle";
          }
        } catch (_) {}
      }

      if (!firstTitleSeen && text.length <= 28 && text.indexOf("\n") === -1) {
        firstTitleSeen = true;
        return "title";
      }
      return "paragraph";
    }

    function walk(node) {
      if (!node) return;
      if (node.nodeType === 3) {
        var txt = normalizeText(node.nodeValue);
        if (txt) {
          blocks.push({ type: firstTitleSeen ? "paragraph" : ((firstTitleSeen = true), "title"), text: txt });
        }
        return;
      }
      if (node.nodeType !== 1 || isElementHidden(node)) return;

      var tag = (node.tagName || "").toUpperCase();
      if (tag === "HR") {
        blocks.push({ type: "divider" });
        return;
      }

      if (tag === "BLOCKQUOTE") {
        var qText = normalizeText(node.innerText || node.textContent || "");
        if (qText) blocks.push({ type: "quote", text: qText });
        return;
      }

      if (hasBlockChildren(node)) {
        // Walk children in document order, flushing consecutive inline runs as a single block
        var inlineBuf = [];
        var flushInline = function () {
          var joined = normalizeText(inlineBuf.join(""));
          inlineBuf = [];
          if (joined) {
            blocks.push({ type: classifyElement(node, joined), text: joined });
          }
        };
        var children = node.childNodes || [];
        for (var i = 0; i < children.length; i++) {
          var c = children[i];
          if (c.nodeType === 3) {
            inlineBuf.push(c.nodeValue || "");
          } else if (c.nodeType === 1 && !isElementHidden(c)) {
            var ct = (c.tagName || "").toUpperCase();
            if (ct === "BR") {
              inlineBuf.push("\n");
            } else if (BLOCK_TAGS[ct]) {
              flushInline();
              walk(c);
            } else {
              inlineBuf.push(getDirectInlineText(c));
            }
          }
        }
        flushInline();
      } else {
        var leafText = normalizeText(getDirectInlineText(node) || node.innerText || node.textContent || "");
        if (leafText) {
          var kind = classifyElement(node, leafText);
          if (tag === "LI") {
            leafText = "• " + leafText;
          }
          blocks.push({ type: kind, text: leafText });
        }
      }
    }

    walk(rootEl);

    // Fallback if DOM walk yielded nothing (e.g. custom text container)
    if (blocks.length === 0) {
      var raw = normalizeText(rootEl.innerText || rootEl.textContent || "");
      if (raw) {
        var paras = raw.split(/\n{2,}/);
        for (var p = 0; p < paras.length; p++) {
          var part = paras[p].trim();
          if (part) {
            blocks.push({ type: p === 0 && part.length <= 36 ? "title" : "paragraph", text: part });
          }
        }
      }
    }

    return blocks;
  }

  function wrapLines(ctx, text, maxWidth) {
    var result = [];
    var paragraphs = String(text || "").split("\n");
    for (var p = 0; p < paragraphs.length; p++) {
      var para = paragraphs[p];
      if (!para) {
        result.push("");
        continue;
      }
      var line = "";
      for (var i = 0; i < para.length; i++) {
        var ch = para[i];
        var test = line + ch;
        var w = ctx.measureText ? ctx.measureText(test).width : test.length * 14;
        if (w > maxWidth && line.length > 0) {
          result.push(line);
          line = ch;
        } else {
          line = test;
        }
      }
      if (line) result.push(line);
    }
    return result;
  }

  function drawRoundedRect(ctx, x, y, w, h, r) {
    var radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function resolveBackgroundColor(el, options) {
    if (options && options.backgroundColor) return options.backgroundColor;
    if (el && typeof global.getComputedStyle === "function") {
      try {
        var bg = global.getComputedStyle(el).backgroundColor;
        if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") {
          return bg;
        }
      } catch (_) {}
    }
    return "#FFFDF9";
  }

  function formatTodayDate() {
    var d = new Date();
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    return yyyy + "." + mm + "." + dd;
  }

  function renderFallbackCanvas(targetEl, options) {
    var opts = options || {};
    var scale = Math.min(Math.max(Number(opts.scale) || 2, 1), 3);
    var logicalWidth = 420;
    var outerPad = 18;
    var cardPadX = 26;
    var cardPadTop = 32;
    var cardPadBottom = 30;
    var contentWidth = logicalWidth - outerPad * 2 - cardPadX * 2;
    var bgColor = resolveBackgroundColor(targetEl, opts);

    var blocks = extractStructuredBlocks(targetEl);
    if (blocks.length === 0) {
      blocks = [{ type: "paragraph", text: "（当前卡片暂无可导出的文字内容）" }];
    }

    var fontSans =
      '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", -apple-system, BlinkMacSystemFont, sans-serif';
    var fontSerif =
      '"Songti SC", "STSong", "Noto Serif SC", "SimSun", Georgia, serif';

    // First pass: create scratch canvas to measure wrapped lines & total height
    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext("2d");

    var layoutItems = [];
    var cursorY = outerPad + cardPadTop + 8; // extra 8px for top accent strip

    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (b.type === "divider") {
        cursorY += 10;
        layoutItems.push({ type: "divider", y: cursorY });
        cursorY += 14;
        continue;
      }

      if (b.type === "title") {
        ctx.font = "700 20px " + fontSerif;
        var tLines = wrapLines(ctx, b.text, contentWidth);
        layoutItems.push({
          type: "title",
          lines: tLines,
          y: cursorY,
          lineHeight: 30,
          font: "700 20px " + fontSerif,
          color: "#2B221E"
        });
        cursorY += tLines.length * 30 + 12;
      } else if (b.type === "subtitle") {
        ctx.font = "600 15px " + fontSans;
        var sLines = wrapLines(ctx, b.text, contentWidth);
        cursorY += 4;
        layoutItems.push({
          type: "subtitle",
          lines: sLines,
          y: cursorY,
          lineHeight: 24,
          font: "600 15px " + fontSans,
          color: "#5A463B"
        });
        cursorY += sLines.length * 24 + 8;
      } else if (b.type === "meta") {
        ctx.font = "400 12px " + fontSans;
        var mLines = wrapLines(ctx, b.text, contentWidth);
        layoutItems.push({
          type: "meta",
          lines: mLines,
          y: cursorY,
          lineHeight: 19,
          font: "400 12px " + fontSans,
          color: "#8E7E72"
        });
        cursorY += mLines.length * 19 + 8;
      } else if (b.type === "quote") {
        ctx.font = "400 14px " + fontSerif;
        var qLines = wrapLines(ctx, b.text, contentWidth - 28);
        var qBoxHeight = qLines.length * 24 + 18;
        cursorY += 4;
        layoutItems.push({
          type: "quote",
          lines: qLines,
          y: cursorY,
          boxHeight: qBoxHeight,
          lineHeight: 24,
          font: "400 14px " + fontSerif,
          color: "#4B3B32"
        });
        cursorY += qBoxHeight + 12;
      } else {
        ctx.font = "400 14.5px " + fontSans;
        var pLines = wrapLines(ctx, b.text, contentWidth);
        layoutItems.push({
          type: "paragraph",
          lines: pLines,
          y: cursorY,
          lineHeight: 25,
          font: "400 14.5px " + fontSans,
          color: "#382F2A"
        });
        cursorY += pLines.length * 25 + 10;
      }
    }

    var footerHeight = 46;
    var logicalHeight = Math.max(260, cursorY + footerHeight + cardPadBottom + outerPad);

    // Guard against mobile Safari canvas pixel memory limit (~16.7M px)
    var maxLogicalHeight = Math.floor(14000 / scale);
    if (logicalHeight > maxLogicalHeight) {
      logicalHeight = maxLogicalHeight;
    }

    canvas.width = Math.round(logicalWidth * scale);
    canvas.height = Math.round(logicalHeight * scale);
    ctx = canvas.getContext("2d");
    if (ctx.scale) ctx.scale(scale, scale);

    // 1. Outer soft warm backdrop
    ctx.fillStyle = "#F4EFE8";
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    // 2. Inner stationery card
    var cardX = outerPad;
    var cardY = outerPad;
    var cardW = logicalWidth - outerPad * 2;
    var cardH = logicalHeight - outerPad * 2;

    ctx.save();
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 16);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#E5D8C8";
    ctx.stroke();
    ctx.restore();

    // 3. Top subtle accent strip
    ctx.save();
    drawRoundedRect(ctx, cardX + cardPadX, cardY + 14, 42, 4, 2);
    ctx.fillStyle = "#C99A6B";
    ctx.fill();
    ctx.restore();

    // 4. Draw all layout blocks
    var textX = cardX + cardPadX;
    ctx.textBaseline = "top";

    for (var k = 0; k < layoutItems.length; k++) {
      var item = layoutItems[k];
      if (item.y > logicalHeight - outerPad - footerHeight - 10) break;

      if (item.type === "divider") {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(textX, item.y);
        ctx.lineTo(textX + contentWidth, item.y);
        ctx.strokeStyle = "#E7DDD1";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      } else if (item.type === "quote") {
        ctx.save();
        drawRoundedRect(ctx, textX, item.y, contentWidth, item.boxHeight, 8);
        ctx.fillStyle = "rgba(201, 154, 107, 0.08)";
        ctx.fill();
        ctx.fillStyle = "#C99A6B";
        ctx.fillRect(textX, item.y + 6, 3, item.boxHeight - 12);
        ctx.font = item.font;
        ctx.fillStyle = item.color;
        for (var ql = 0; ql < item.lines.length; ql++) {
          ctx.fillText(item.lines[ql], textX + 14, item.y + 9 + ql * item.lineHeight);
        }
        ctx.restore();
      } else {
        ctx.save();
        ctx.font = item.font;
        ctx.fillStyle = item.color;
        for (var l = 0; l < item.lines.length; l++) {
          ctx.fillText(item.lines[l], textX, item.y + l * item.lineHeight);
        }
        ctx.restore();
      }
    }

    // 5. Footer hairline + watermark
    var footerY = logicalHeight - outerPad - footerHeight;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(textX, footerY + 8);
    ctx.lineTo(textX + contentWidth, footerY + 8);
    ctx.strokeStyle = "#EAE1D6";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = "400 11px " + fontSans;
    ctx.fillStyle = "#A39386";
    ctx.textAlign = "center";
    ctx.fillText("鸢小手机 · 纪念长图 · " + formatTodayDate(), logicalWidth / 2, footerY + 20);
    ctx.restore();

    return canvas;
  }

  // ==================== Mobile Long-Press Save Preview Modal ====================

  function removePreviewModal() {
    if (typeof document === "undefined") return;
    var existing = document.getElementById(PREVIEW_MODAL_ID);
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  }

  function dataUrlToBlob(dataUrl) {
    try {
      var parts = dataUrl.split(",");
      var mimeMatch = parts[0].match(/:(.*?);/);
      var mime = mimeMatch ? mimeMatch[1] : "image/png";
      var binary = atob(parts[1]);
      var len = binary.length;
      var u8 = new Uint8Array(len);
      for (var i = 0; i < len; i++) u8[i] = binary.charCodeAt(i);
      return new Blob([u8], { type: mime });
    } catch (_) {
      return null;
    }
  }

  function triggerDownloadOrShare(dataUrl, filename) {
    var safeName = filename || "milvus-long-image-" + Date.now() + ".png";
    // Prefer native Web Share API with image File on mobile if available
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      typeof File === "function"
    ) {
      var blob = dataUrlToBlob(dataUrl);
      if (blob) {
        try {
          var file = new File([blob], safeName, { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: "纪念长图" }).catch(function () {});
            return;
          }
        } catch (_) {}
      }
    }
    // Standard anchor download fallback
    try {
      var a = document.createElement("a");
      a.href = dataUrl;
      a.download = safeName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (_) {}
  }

  function showPreviewModal(dataUrl, meta) {
    if (typeof document === "undefined" || !document.body || !dataUrl) return;
    removePreviewModal();

    var modeLabel =
      meta && meta.mode === "fallback" ? "离线手账排版模式" : "高清原样截图模式";

    var overlay = document.createElement("div");
    overlay.id = PREVIEW_MODAL_ID;
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:999999;background:rgba(15,12,10,0.82);" +
      "backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);" +
      "display:flex;flex-direction:column;align-items:center;justify-content:space-between;" +
      "padding:max(14px,env(safe-area-inset-top)) 14px max(16px,env(safe-area-inset-bottom));" +
      "box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;";

    // Top bar
    var topBar = document.createElement("div");
    topBar.style.cssText =
      "width:100%;max-width:460px;display:flex;align-items:center;justify-content:space-between;" +
      "gap:10px;padding:10px 14px;border-radius:14px;background:rgba(255,253,249,0.95);" +
      "color:#2C2420;box-shadow:0 4px 18px rgba(0,0,0,0.22);flex-shrink:0;";

    var tipBox = document.createElement("div");
    tipBox.style.cssText = "display:flex;flex-direction:column;gap:2px;min-width:0;";

    var tipTitle = document.createElement("div");
    tipTitle.textContent = "长图已生成 · 手机请长按图片保存";
    tipTitle.style.cssText = "font-size:13.5px;font-weight:700;color:#2C2420;";

    var tipSub = document.createElement("div");
    tipSub.textContent = modeLabel + " · 可上下滑动预览";
    tipSub.style.cssText = "font-size:11px;color:#8A7B70;";

    tipBox.appendChild(tipTitle);
    tipBox.appendChild(tipSub);

    var closeBtnTop = document.createElement("button");
    closeBtnTop.type = "button";
    closeBtnTop.textContent = "✕";
    closeBtnTop.setAttribute("aria-label", "关闭预览");
    closeBtnTop.style.cssText =
      "width:30px;height:30px;border:none;border-radius:999px;background:#EFE7DD;" +
      "color:#4A3F38;font-size:14px;font-weight:700;cursor:pointer;flex-shrink:0;";
    closeBtnTop.onclick = removePreviewModal;

    topBar.appendChild(tipBox);
    topBar.appendChild(closeBtnTop);

    // Scrollable image container
    var scrollWrap = document.createElement("div");
    scrollWrap.style.cssText =
      "flex:1;width:100%;max-width:460px;margin:12px 0;overflow-y:auto;-webkit-overflow-scrolling:touch;" +
      "border-radius:14px;background:rgba(255,255,255,0.06);padding:6px;box-sizing:border-box;" +
      "display:flex;justify-content:center;align-items:flex-start;";

    var img = document.createElement("img");
    img.src = dataUrl;
    img.alt = "纪念长图预览";
    img.style.cssText =
      "display:block;width:100%;height:auto;border-radius:12px;" +
      "box-shadow:0 8px 28px rgba(0,0,0,0.35);-webkit-touch-callout:default;";
    scrollWrap.appendChild(img);

    // Bottom action bar
    var bottomBar = document.createElement("div");
    bottomBar.style.cssText =
      "width:100%;max-width:460px;display:flex;gap:10px;flex-shrink:0;";

    var saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "💾 保存 / 分享图片";
    saveBtn.style.cssText =
      "flex:1;height:42px;border:none;border-radius:12px;" +
      "background:linear-gradient(135deg,#C89566,#A87246);color:#FFFDF9;" +
      "font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(168,114,70,0.35);";
    saveBtn.onclick = function () {
      triggerDownloadOrShare(dataUrl, meta && meta.filename);
    };

    var doneBtn = document.createElement("button");
    doneBtn.type = "button";
    doneBtn.textContent = "关闭";
    doneBtn.style.cssText =
      "width:88px;height:42px;border:1px solid rgba(255,255,255,0.28);border-radius:12px;" +
      "background:rgba(255,255,255,0.12);color:#FFFFFF;font-size:14px;font-weight:500;cursor:pointer;";
    doneBtn.onclick = removePreviewModal;

    bottomBar.appendChild(saveBtn);
    bottomBar.appendChild(doneBtn);

    overlay.appendChild(topBar);
    overlay.appendChild(scrollWrap);
    overlay.appendChild(bottomBar);

    overlay.addEventListener("click", function (ev) {
      if (ev.target === overlay) removePreviewModal();
    });

    var onKeyDown = function (ev) {
      if (ev.key === "Escape") {
        removePreviewModal();
        document.removeEventListener("keydown", onKeyDown);
      }
    };
    document.addEventListener("keydown", onKeyDown);

    document.body.appendChild(overlay);
  }

  // ==================== Dual-Track Entrypoint ====================

  function verifyCanvasDataUrl(canvas) {
    if (!canvas || !canvas.width || !canvas.height) return null;
    try {
      var url = canvas.toDataURL("image/png");
      if (typeof url === "string" && url.indexOf("data:image/png") === 0 && url.length > 120) {
        return url;
      }
    } catch (_) {}
    return null;
  }

  async function milvusHtml2CanvasProxy(targetEl, options) {
    var opts = options || {};
    var usedMode = "fallback";
    var finalCanvas = null;
    var finalDataUrl = null;

    // Track 1: Try real html2canvas (dynamically loaded from multi-CDN mirrors)
    if (!opts.forceFallback) {
      try {
        var realFn = await loadRealHtml2Canvas();
        if (typeof realFn === "function") {
          var mergedOpts = Object.assign(
            { scale: 2, useCORS: true, allowTaint: false, logging: false },
            opts
          );
          var realCanvas = await realFn(targetEl, mergedOpts);
          var verifiedUrl = verifyCanvasDataUrl(realCanvas);
          if (verifiedUrl) {
            finalCanvas = realCanvas;
            finalDataUrl = verifiedUrl;
            usedMode = "html2canvas";
          }
        }
      } catch (err) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[LongImageExportEngine] html2canvas failed, switching to offline Canvas fallback:", err);
        }
      }
    }

    // Track 2: 100% offline Native Canvas 2D fallback
    if (!finalCanvas) {
      finalCanvas = renderFallbackCanvas(targetEl, opts);
      finalDataUrl = verifyCanvasDataUrl(finalCanvas);
      usedMode = "fallback";
    }

    // Automatically open mobile-friendly long-press preview overlay
    if (!opts.skipPreviewModal && finalDataUrl && typeof document !== "undefined" && document.body) {
      setTimeout(function () {
        showPreviewModal(finalDataUrl, {
          mode: usedMode,
          filename: opts.filename || ""
        });
      }, 100);
    }

    return finalCanvas;
  }

  milvusHtml2CanvasProxy.__isMilvusExportProxy = true;

  // Expose drop-in window.html2canvas + explicit engine namespace
  global.html2canvas = milvusHtml2CanvasProxy;
  global.LongImageExportEngine = {
    version: "1.0.0",
    exportElement: milvusHtml2CanvasProxy,
    renderFallbackCanvas: renderFallbackCanvas,
    extractStructuredBlocks: extractStructuredBlocks,
    showPreviewModal: showPreviewModal,
    removePreviewModal: removePreviewModal,
    loadRealHtml2Canvas: loadRealHtml2Canvas
  };
})(typeof window !== "undefined" ? window : globalThis);

