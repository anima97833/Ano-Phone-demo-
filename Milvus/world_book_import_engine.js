/**
 * Milvus/world_book_import_engine.js
 * 设置 · 世界书多格式导入引擎（支持 txt / doc / docx / md / 通用 json）+ 手绘 SVG 导入按钮
 *
 * 兼容 JSON 格式：
 * 1. SillyTavern / TavernAI World Info / Lorebook: { entries: { "0": { comment, key, content, disable } } } 或 { entries: [...] }
 * 2. Character Card V2 内嵌世界书: { data: { character_book: { entries: [...] } } }
 * 3. 本应用原生格式: { books: [{ title, content, enable }] }
 * 4. 通用条目数组: [{ title/name/comment/key, content/text/description/value }]
 * 5. 通用键值字典: { "词条名": "词条内容", ... }
 */
(function (global) {
  "use strict";

  // ==================== 1. Binary & Text Decoding Helpers ====================

  function stripExt(filename) {
    return String(filename || "未命名世界书").replace(/\.[^.]+$/, "").trim() || "未命名世界书";
  }

  function smartDecodeBytes(bytes) {
    if (!bytes || bytes.length === 0) return "";
    // UTF-8 BOM
    if (bytes.length >= 3 && bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191) {
      return new TextDecoder("utf-8").decode(bytes.subarray(3));
    }
    // UTF-16 LE BOM
    if (bytes.length >= 2 && bytes[0] === 255 && bytes[1] === 254) {
      try {
        return new TextDecoder("utf-16le").decode(bytes.subarray(2));
      } catch (_) {}
    }
    // Try strict UTF-8 first
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (_) {
      // Fallback to GB18030 / GBK for Chinese Windows .txt/.doc files
      try {
        return new TextDecoder("gb18030").decode(bytes);
      } catch (_) {
        return new TextDecoder("utf-8").decode(bytes);
      }
    }
  }

  function decodeXmlEntities(str) {
    return String(str || "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(Number(n)); });
  }

  /**
   * Minimal pure-JS .docx reader: locates `word/document.xml` in ZIP local/central headers
   * and decompresses via native DecompressionStream("deflate-raw").
   */
  async function extractDocxText(bytes) {
    var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    var offset = 0;
    while (offset + 30 < bytes.length) {
      if (view.getUint32(offset, true) !== 0x04034b50) break;
      var compression = view.getUint16(offset + 8, true);
      var compSize = view.getUint32(offset + 18, true);
      var nameLen = view.getUint16(offset + 26, true);
      var extraLen = view.getUint16(offset + 28, true);
      var nameBytes = bytes.subarray(offset + 30, offset + 30 + nameLen);
      var entryName = new TextDecoder("utf-8").decode(nameBytes);
      var dataStart = offset + 30 + nameLen + extraLen;
      var dataEnd = dataStart + compSize;

      if (entryName === "word/document.xml" && compSize > 0 && dataEnd <= bytes.length) {
        var rawSlice = bytes.subarray(dataStart, dataEnd);
        var xmlText = "";
        if (compression === 0) {
          xmlText = new TextDecoder("utf-8").decode(rawSlice);
        } else if (compression === 8 && typeof DecompressionStream === "function") {
          var ds = new DecompressionStream("deflate-raw");
          var stream = new Blob([rawSlice]).stream().pipeThrough(ds);
          xmlText = await new Response(stream).text();
        }
        if (xmlText) {
          return decodeXmlEntities(
            xmlText
              .replace(/<\/w:p>/g, "\n")
              .replace(/<w:br[^>]*\/>/g, "\n")
              .replace(/<w:tab[^>]*\/>/g, "\t")
              .replace(/<[^>]+>/g, "")
          )
            .replace(/\n{3,}/g, "\n\n")
            .trim();
        }
      }
      if (compSize === 0) break;
      offset = dataEnd;
    }
    return "";
  }

  /**
   * Extracts readable text from legacy .doc (supports HTML-disguised .doc, RTF .doc, and binary OLE .doc).
   */
  function extractLegacyDocText(bytes) {
    var head = new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(256, bytes.length)));
    // Case A: HTML-saved .doc
    if (/<html|<body|<p|<!DOCTYPE/i.test(head)) {
      var html = smartDecodeBytes(bytes);
      return decodeXmlEntities(
        html
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, "\n")
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]+>/g, "")
      )
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }
    // Case B: RTF-saved .doc
    if (head.trim().indexOf("{\\rtf") === 0) {
      var rtf = smartDecodeBytes(bytes);
      return rtf
        .replace(/\\par[d]?/g, "\n")
        .replace(/\\'([0-9a-fA-F]{2})/g, "")
        .replace(/\\[a-z]+-?\d* ?/g, "")
        .replace(/[{}]/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }
    // Case C: Binary OLE2 .doc -> extract UTF-16LE CJK/ASCII readable runs
    var utf16 = "";
    try {
      utf16 = new TextDecoder("utf-16le").decode(bytes);
    } catch (_) {}
    var runs = utf16.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffefA-Za-z0-9，。！？、；：“”‘’（）《》\-\s]{6,}/g) || [];
    var filtered = runs
      .map(function (r) { return r.trim(); })
      .filter(function (r) { return r.length >= 6 && /[\u4e00-\u9fff]/.test(r); });
    if (filtered.length > 0) {
      return filtered.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    }
    return smartDecodeBytes(bytes).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim();
  }

  // ==================== 2. Multi-Format World Book Parsers ====================

  function parseMarkdownToEntries(mdText, fallbackTitle) {
    var text = String(mdText || "").replace(/\r\n/g, "\n").trim();
    if (!text) return [];
    var lines = text.split("\n");
    var sections = [];
    var curTitle = "";
    var curLines = [];

    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(/^#{1,3}\s+(.+?)\s*#*$/);
      if (m) {
        if (curLines.join("\n").trim()) {
          sections.push({
            title: curTitle || fallbackTitle,
            content: curLines.join("\n").trim(),
            enable: true
          });
        }
        curTitle = m[1].trim().slice(0, 60);
        curLines = [];
      } else {
        curLines.push(lines[i]);
      }
    }
    if (curLines.join("\n").trim()) {
      sections.push({
        title: curTitle || fallbackTitle,
        content: curLines.join("\n").trim(),
        enable: true
      });
    }
    if (sections.length === 0) {
      return [{ title: fallbackTitle, content: text, enable: true }];
    }
    return sections;
  }

  function normalizeJsonEntryObj(obj, fallbackTitle) {
    if (!obj || typeof obj !== "object") return null;
    var content = String(
      obj.content != null
        ? obj.content
        : obj.text != null
        ? obj.text
        : obj.description != null
        ? obj.description
        : obj.value != null
        ? obj.value
        : ""
    ).trim();
    if (!content) return null;

    var keyLabel = "";
    if (Array.isArray(obj.key) && obj.key.length > 0) {
      keyLabel = obj.key.filter(Boolean).slice(0, 3).join(" / ");
    } else if (typeof obj.key === "string" && obj.key.trim()) {
      keyLabel = obj.key.trim();
    } else if (Array.isArray(obj.keys) && obj.keys.length > 0) {
      keyLabel = obj.keys.filter(Boolean).slice(0, 3).join(" / ");
    }

    var title = String(
      obj.title || obj.comment || obj.name || keyLabel || fallbackTitle || "世界书条目"
    )
      .trim()
      .slice(0, 60);

    var enabled = true;
    if (obj.disable === true || obj.disabled === true || obj.enable === false || obj.enabled === false) {
      enabled = false;
    }

    return { title: title, content: content, enable: enabled };
  }

  function parseUniversalJsonToEntries(jsonText, fallbackTitle) {
    var parsed = JSON.parse(String(jsonText || "").replace(/^\uFEFF/, ""));
    var rawList = [];

    if (Array.isArray(parsed)) {
      rawList = parsed;
    } else if (parsed && typeof parsed === "object") {
      // 1. Character Card V2 embedded character_book
      if (parsed.data && parsed.data.character_book && parsed.data.character_book.entries) {
        var cbEntries = parsed.data.character_book.entries;
        rawList = Array.isArray(cbEntries) ? cbEntries : Object.values(cbEntries);
      }
      // 2. SillyTavern / TavernAI World Info { entries: { "0": {...} } } or { entries: [...] }
      else if (parsed.entries) {
        rawList = Array.isArray(parsed.entries) ? parsed.entries : Object.values(parsed.entries);
      }
      // 3. Milvus native { books: [...] }
      else if (Array.isArray(parsed.books)) {
        rawList = parsed.books;
      }
      // 4. Single entry object { title, content }
      else if (parsed.content || parsed.text || parsed.description) {
        rawList = [parsed];
      }
      // 5. Generic key-value dictionary { "东汉官制": "..." }
      else {
        var keys = Object.keys(parsed);
        for (var k = 0; k < keys.length; k++) {
          var v = parsed[keys[k]];
          if (typeof v === "string" && v.trim()) {
            rawList.push({ title: keys[k], content: v.trim(), enable: true });
          } else if (v && typeof v === "object") {
            var norm = normalizeJsonEntryObj(v, keys[k]);
            if (norm) rawList.push(norm);
          }
        }
      }
    }

    var out = [];
    for (var i = 0; i < rawList.length; i++) {
      var item = rawList[i];
      if (typeof item === "string" && item.trim()) {
        out.push({ title: fallbackTitle + " #" + (i + 1), content: item.trim(), enable: true });
      } else {
        var entry = normalizeJsonEntryObj(item, fallbackTitle + " #" + (i + 1));
        if (entry) out.push(entry);
      }
    }
    return out;
  }

  async function parseWorldBookFile(file) {
    if (!file) return [];
    var name = String(file.name || "世界书");
    var ext = (name.split(".").pop() || "").toLowerCase();
    var baseTitle = stripExt(name);
    var buf = await file.arrayBuffer();
    var bytes = new Uint8Array(buf);
    if (!bytes || bytes.length === 0) return [];

    if (ext === "json") {
      var jsonStr = smartDecodeBytes(bytes);
      return parseUniversalJsonToEntries(jsonStr, baseTitle);
    }

    if (ext === "md" || ext === "markdown") {
      var mdStr = smartDecodeBytes(bytes);
      return parseMarkdownToEntries(mdStr, baseTitle);
    }

    if (ext === "docx") {
      var docxText = await extractDocxText(bytes);
      if (!docxText) docxText = extractLegacyDocText(bytes);
      return docxText ? [{ title: baseTitle, content: docxText, enable: true }] : [];
    }

    if (ext === "doc") {
      var docText = extractLegacyDocText(bytes);
      return docText ? [{ title: baseTitle, content: docText, enable: true }] : [];
    }

    // Default .txt or other plain text
    var txt = smartDecodeBytes(bytes).replace(/\r\n/g, "\n").trim();
    if (!txt) return [];
    // If someone pasted JSON inside a .txt file, try JSON gracefully
    if ((txt[0] === "{" || txt[0] === "[") && txt.length > 10) {
      try {
        var maybeJson = parseUniversalJsonToEntries(txt, baseTitle);
        if (maybeJson.length > 0) return maybeJson;
      } catch (_) {}
    }
    return [{ title: baseTitle, content: txt, enable: true }];
  }

  function deduplicateAndStamp(newEntries, existingEntries) {
    var existingSet = {};
    var list = Array.isArray(existingEntries) ? existingEntries : [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e) existingSet[(e.title || "").trim() + "::" + (e.content || "").trim()] = true;
    }
    var baseId = Date.now();
    var accepted = [];
    for (var j = 0; j < newEntries.length; j++) {
      var ne = newEntries[j];
      if (!ne || !ne.content) continue;
      var sig = (ne.title || "").trim() + "::" + (ne.content || "").trim();
      if (existingSet[sig]) continue;
      existingSet[sig] = true;
      accepted.push({
        id: baseId + j,
        title: ne.title || "导入设定",
        content: ne.content,
        enable: ne.enable !== false
      });
    }
    return accepted;
  }

  // ==================== 3. Hand-Drawn SVG Import Floating Button ====================

  function HandDrawnImportSvg(h) {
    return h(
      "svg",
      {
        width: 26,
        height: 26,
        viewBox: "0 0 28 28",
        fill: "none",
        stroke: "#6A4728",
        strokeWidth: 1.9,
        strokeLinecap: "round",
        strokeLinejoin: "round"
      },
      // Open hand-drawn vintage book
      h("path", { d: "M4.5 11.5 C7.5 10.2, 11.2 10.5, 14 12.6 C16.8 10.5, 20.5 10.2, 23.5 11.5 L23.5 22 C20.5 20.8, 16.8 21, 14 23 C11.2 21, 7.5 20.8, 4.5 22 Z", fill: "#FFFDF6" }),
      h("path", { d: "M14 12.6 L14 23" }),
      // Subtle ruled lines on book pages
      h("path", { d: "M7.5 15.2 L11 15.8 M7.5 18.2 L11 18.8", stroke: "#C49A6C", strokeWidth: 1.5 }),
      h("path", { d: "M20.5 15.2 L17 15.8 M20.5 18.2 L17 18.8", stroke: "#C49A6C", strokeWidth: 1.5 }),
      // Incoming parchment import arrow
      h("path", { d: "M14 3.2 L14 9.6", stroke: "#D6724B", strokeWidth: 2.2 }),
      h("path", { d: "M10.8 6.8 L14 10 L17.2 6.8", stroke: "#D6724B", strokeWidth: 2.2 })
    );
  }

  function ImportButton(props) {
    var React = global.React;
    if (!React) return null;
    var h = React.createElement;
    var useRef = React.useRef;
    var useState = React.useState;

    var existingEntries = (props && props.existingEntries) || [];
    var onImportEntries = props && props.onImportEntries;
    var fileInputRef = useRef(null);
    var [busy, setBusy] = useState(false);

    async function handleFilesChange(ev) {
      var files = ev.target && ev.target.files ? Array.from(ev.target.files) : [];
      if (files.length === 0) return;
      setBusy(true);
      try {
        var collected = [];
        var failedFiles = [];
        for (var i = 0; i < files.length; i++) {
          try {
            var parsed = await parseWorldBookFile(files[i]);
            if (parsed.length > 0) {
              collected = collected.concat(parsed);
            } else {
              failedFiles.push(files[i].name);
            }
          } catch (_) {
            failedFiles.push(files[i].name);
          }
        }
        var fresh = deduplicateAndStamp(collected, existingEntries);
        if (fresh.length > 0 && typeof onImportEntries === "function") {
          onImportEntries(fresh);
          var msg = "✨ 成功导入 " + fresh.length + " 条世界书设定！";
          if (collected.length > fresh.length) {
            msg += "\n（已自动跳过 " + (collected.length - fresh.length) + " 条重复内容）";
          }
          if (failedFiles.length > 0) {
            msg += "\n未能解析：" + failedFiles.join("、");
          }
          alert(msg);
        } else if (collected.length > 0) {
          alert("所选文件中的 " + collected.length + " 条设定已全部存在，无需重复导入。");
        } else {
          alert("未能从所选文件中提取有效内容，请确认文件为 txt / doc / docx / md / json 格式。");
        }
      } catch (err) {
        alert("导入世界书失败：" + (err && err.message ? err.message : err));
      } finally {
        setBusy(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }

    return h(
      React.Fragment,
      null,
      h("input", {
        ref: fileInputRef,
        type: "file",
        multiple: true,
        accept: ".txt,.md,.markdown,.doc,.docx,.json",
        style: { display: "none" },
        onChange: handleFilesChange
      }),
      h(
        "button",
        {
          type: "button",
          disabled: busy,
          title: "导入世界书（支持 txt / doc / docx / md / 通用 json）",
          "aria-label": "导入世界书",
          onClick: function () {
            if (fileInputRef.current) fileInputRef.current.click();
          },
          style: {
            position: "absolute",
            bottom: "98px",
            right: "20px",
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: busy ? "#F2E6D6" : "linear-gradient(145deg, #FFFDF7 0%, #FCECD4 100%)",
            border: "2px solid #D9A773",
            boxShadow: "0 4px 14px rgba(173, 114, 58, 0.28)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            cursor: busy ? "wait" : "pointer",
            zIndex: 10,
            padding: 0
          }
        },
        HandDrawnImportSvg(h),
        h(
          "span",
          { style: { fontSize: "9.5px", fontWeight: 800, color: "#7D4E26", lineHeight: 1, marginTop: "1px" } },
          busy ? "导入中" : "导入"
        )
      )
    );
  }

  global.WorldBookImportEngine = {
    version: "1.0.0",
    parseMarkdownToEntries: parseMarkdownToEntries,
    parseUniversalJsonToEntries: parseUniversalJsonToEntries,
    parseWorldBookFile: parseWorldBookFile,
    deduplicateAndStamp: deduplicateAndStamp,
    ImportButton: ImportButton
  };
})(typeof window !== "undefined" ? window : globalThis);
