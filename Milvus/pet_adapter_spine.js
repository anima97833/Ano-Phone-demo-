/**
 * Milvus/pet_adapter_spine.js
 * 主屏幕桌宠 Spine 绑骨动画插件适配器（严格零 AI · 版本自动嗅探 · 零预载开销）
 *
 * 核心特性：
 * 1. 自动嗅探 .json (skeleton.spine) 或 .skel 二进制头中的 Spine 主次版本号（3.8 / 4.1 / 4.2）
 * 2. 按版本按需懒加载对应 spine-player 运行时（优先本地 ./vendor/，回退 jsDelivr CDN）
 * 3. 解析 .atlas 全部贴图页，NFC 路径归一化 + 缺失贴图报错 + 移动端防 OOM 自动降采样
 * 4. 通过 rawDataURIs 本地注入模型资源，兼容离线 IndexedDB 与 file:// 规避跨域污染
 * 5. destroy() 彻底 dispose 并主动 loseContext，防止多次切换模型导致 WebGL 上下文泄漏
 */
(function (global) {
  "use strict";

  var SPINE_RUNTIMES = {
    "4.3": [
      "./vendor/spine-player-4.3.min.js",
      "https://cdn.jsdelivr.net/npm/@esotericsoftware/spine-player@4.3/dist/iife/spine-player.js",
      "https://unpkg.com/@esotericsoftware/spine-player@4.3/dist/iife/spine-player.js"
    ],
    "4.2": [
      "./vendor/spine-player-4.2.min.js",
      "https://cdn.jsdelivr.net/npm/@esotericsoftware/spine-player@4.2.69/dist/iife/spine-player.js",
      "https://unpkg.com/@esotericsoftware/spine-player@4.2.69/dist/iife/spine-player.js"
    ],
    "4.1": [
      "./vendor/spine-player-4.1.min.js",
      "https://cdn.jsdelivr.net/npm/@esotericsoftware/spine-player@4.1.40/dist/iife/spine-player.js",
      "https://unpkg.com/@esotericsoftware/spine-player@4.1.40/dist/iife/spine-player.js"
    ],
    "3.8": [
      "./vendor/spine-player-3.8.min.js",
      "https://cdn.jsdelivr.net/gh/EsotericSoftware/spine-runtimes@3.8/spine-ts/build/spine-player.js"
    ]
  };

  var loadedSpineVersion = "";

  function getImporters() {
    return global.HomeDollPetImporters || null;
  }

  function loadFreshScript(url) {
    return new Promise(function (resolve, reject) {
      var doc = global.document;
      if (!doc) { reject(new Error("非浏览器环境")); return; }
      var s = doc.createElement("script");
      s.src = url;
      s.async = true;
      s.onload = function () { resolve(url); };
      s.onerror = function () {
        if (s.parentNode) s.parentNode.removeChild(s);
        reject(new Error("无法加载 Spine 运行时：" + url));
      };
      doc.head.appendChild(s);
    });
  }

  var lastSkeletonError = "";

  // UTF-8 安全解码 data:...;base64,...（修复官方 Spine 4.x Downloader.dataUriToString 直接用 atob 导致中文如 "归云.png" 变成乱码 "å½äº.png" 的 Bug，以及 3.8 XMLHttpRequest overrideMimeType("text/html") 乱码 Bug）
  function decodeDataUriUtf8(dataUri) {
    if (!dataUri || typeof dataUri !== "string" || dataUri.indexOf("data:") !== 0) return dataUri;
    var b64Idx = dataUri.indexOf("base64,");
    if (b64Idx >= 0) {
      var b64 = dataUri.slice(b64Idx + 7);
      var binStr = global.atob ? global.atob(b64) : Buffer.from(b64, "base64").toString("binary");
      var bytes = new Uint8Array(binStr.length);
      for (var i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i) & 0xff;
      if (typeof TextDecoder !== "undefined") {
        return new TextDecoder("utf-8").decode(bytes);
      }
      return decodeURIComponent(escape(binStr));
    }
    var commaIdx = dataUri.indexOf(",");
    return commaIdx >= 0 ? decodeURIComponent(dataUri.slice(commaIdx + 1)) : dataUri;
  }

  // 诊断与 UTF-8 补丁：修复官方 Spine Player UTF-8 中文名乱码 + 截获真实解析报错
  function patchSkeletonReaders(spineLib) {
    if (!spineLib) return;
    // 1) 修复 Spine 4.1 / 4.2 / 4.3 Downloader.prototype.dataUriToString 的 atob Latin-1 乱码
    if (spineLib.Downloader && spineLib.Downloader.prototype) {
      spineLib.Downloader.prototype.dataUriToString = function (dataUri) {
        return decodeDataUriUtf8(dataUri);
      };
    }
    // 2) 修复 Spine 3.8 webgl.AssetManager.prototype.downloadText 的 text/html 无 charset 乱码
    var amTargets = [
      spineLib.AssetManager,
      spineLib.AssetManagerBase,
      spineLib.webgl && spineLib.webgl.AssetManager
    ];
    amTargets.forEach(function (AM) {
      if (!AM || !AM.prototype || AM.prototype.__utf8Patched) return;
      if (typeof AM.prototype.downloadText === "function") {
        var origDlText = AM.prototype.downloadText;
        AM.prototype.downloadText = function (url, success, error) {
          var rawMap = this.rawDataUris || (this.downloader && this.downloader.rawDataUris);
          var mapped = rawMap && rawMap[url];
          if (mapped && typeof mapped === "string" && mapped.indexOf("data:") === 0) {
            try {
              var txt = decodeDataUriUtf8(mapped);
              setTimeout(function () { success(txt); }, 0);
              return;
            } catch (_) {}
          }
          return origDlText.apply(this, arguments);
        };
      }
      AM.prototype.__utf8Patched = true;
    });

    // 3) 截获 SkeletonJson / SkeletonBinary 真实异常信息
    ["SkeletonJson", "SkeletonBinary"].forEach(function (cls) {
      var C = spineLib && spineLib[cls];
      if (!C || !C.prototype || C.prototype.__petPatched) return;
      var orig = C.prototype.readSkeletonData;
      if (typeof orig !== "function") return;
      C.prototype.readSkeletonData = function () {
        try {
          return orig.apply(this, arguments);
        } catch (e) {
          lastSkeletonError = String((e && e.message) || e || "未知解析错误");
          throw e;
        }
      };
      C.prototype.__petPatched = true;
    });
  }

  // Spine 官方 3.8 运行时对编辑器版本 "3.8.75" 有硬编码拒绝（Unsupported skeleton data）。
  // 3.8.75 导出数据格式与 3.8.x 运行时一致，仅在内存中把版本号改为等长的 3.8.99 即可加载（不修改用户原文件）。
  async function patchKnownBadSpineVersion(blob, isBinary) {
    if (!blob) return blob;
    try {
      if (isBinary) {
        var u8 = new Uint8Array(await blob.arrayBuffer());
        var limit = Math.min(96, u8.length - 6);
        var target = [51, 46, 56, 46, 55, 53]; // "3.8.75"
        for (var i = 0; i <= limit; i++) {
          var hit = true;
          for (var j = 0; j < 6; j++) { if (u8[i + j] !== target[j]) { hit = false; break; } }
          if (hit) {
            u8[i + 4] = 57; u8[i + 5] = 57; // "3.8.99"
            return new Blob([u8], { type: "application/octet-stream" });
          }
        }
        return blob;
      }
      var text = await blob.text();
      if (/"spine"\s*:\s*"3\.8\.75"/.test(text)) {
        text = text.replace(/("spine"\s*:\s*")3\.8\.75(")/, "$13.8.99$2");
        return new Blob([text], { type: "application/json" });
      }
    } catch (_) {}
    return blob;
  }

  async function ensureSpineRuntime(versionKey) {
    var ver = SPINE_RUNTIMES[versionKey] ? versionKey : "4.2";
    if (loadedSpineVersion === ver && global.spine && global.spine.SpinePlayer) {
      patchSkeletonReaders(global.spine);
      return global.spine;
    }
    var candidates = SPINE_RUNTIMES[ver];
    // 切换不同主次版本时清理旧全局，避免版本冲突
    if (loadedSpineVersion && loadedSpineVersion !== ver) {
      try { delete global.spine; } catch (_) { global.spine = undefined; }
    }
    var lastErr = null;
    for (var i = 0; i < candidates.length; i++) {
      try {
        await loadFreshScript(candidates[i]);
        if (global.spine && global.spine.SpinePlayer) {
          loadedSpineVersion = ver;
          patchSkeletonReaders(global.spine);
          return global.spine;
        }
      } catch (e) {
        lastErr = e;
      }
    }
    throw new Error("Spine " + ver + " 运行时加载失败（" + (lastErr && lastErr.message || "网络异常") + "），请检查网络或将 spine-player-" + ver + ".min.js 放入 vendor/");
  }

  function blobToDataUri(blob, fallbackMime) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("读取资源失败")); };
      reader.onload = function () {
        var res = String(reader.result || "");
        if (fallbackMime && res.indexOf("data:application/octet-stream") === 0) {
          res = res.replace("data:application/octet-stream", "data:" + fallbackMime);
        }
        resolve(res);
      };
      reader.readAsDataURL(blob);
    });
  }

  function detectSpineVersionFromJson(jsonObj) {
    var raw = jsonObj && jsonObj.skeleton && jsonObj.skeleton.spine;
    if (!raw) return "4.2";
    var m = String(raw).match(/(\d+\.\d+)/);
    return m ? m[1] : "4.2";
  }

  function detectSpineVersionFromBinary(uint8) {
    if (!uint8 || !uint8.length) return "4.2";
    var headLen = Math.min(128, uint8.length);
    var ascii = "";
    for (var i = 0; i < headLen; i++) {
      var ch = uint8[i];
      ascii += (ch >= 32 && ch <= 126) ? String.fromCharCode(ch) : " ";
    }
    var m = ascii.match(/\b(3\.8|4\.0|4\.1|4\.2|4\.3)\.\d+/);
    return m ? m[1] : "4.2";
  }

  function parseAtlasTexturePages(atlasText) {
    var lines = String(atlasText || "").split(/\r?\n/);
    var pages = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      if (/\.(png|webp|jpg|jpeg)$/i.test(line) && line.indexOf(":") < 0) {
        if (pages.indexOf(line) < 0) pages.push(line);
      }
    }
    return pages;
  }

  function resolveEntryPath(baseDir, ref, entryMap, lowerMap) {
    var imp = getImporters();
    if (!ref || !imp) return null;
    var joined = imp.joinNormPath(baseDir, ref);
    if (entryMap[joined]) return joined;
    var low = lowerMap[joined.toLowerCase()];
    if (low) return low;
    return null;
  }

  // ==================== 1. Spine ZIP Importer ====================

  async function importSpineZip(ctx, report) {
    var imp = getImporters();
    var atlasPath = ctx.pathList.find(function (p) { return /\.atlas(\.txt)?$/i.test(p); });
    if (!atlasPath) throw new Error("未找到 .atlas 图集描述文件");

    var skelPath = ctx.pathList.find(function (p) {
      return /\.skel(\.bytes)?$/i.test(p) || (/\.json$/i.test(p) && !/\.model3\.json$/i.test(p) && !/\.vtube\.json$/i.test(p));
    });
    if (!skelPath) throw new Error("未找到 Spine 骨骼文件（.json 或 .skel）");

    var isBinary = /\.skel(\.bytes)?$/i.test(skelPath);
    var baseDir = imp.dirname(atlasPath);

    report("正在嗅探 Spine 骨骼版本…");
    var detectedVer = "4.2";
    var animations = [];
    var skelBlob = null;

    if (isBinary) {
      var u8 = await ctx.entryMap[skelPath].async("uint8array");
      detectedVer = detectSpineVersionFromBinary(u8);
      skelBlob = new Blob([u8], { type: "application/octet-stream" });
    } else {
      var skelText = await ctx.entryMap[skelPath].async("string");
      var skelJson = JSON.parse(skelText);
      detectedVer = detectSpineVersionFromJson(skelJson);
      if (skelJson && skelJson.animations && typeof skelJson.animations === "object") {
        animations = Object.keys(skelJson.animations);
      }
      skelBlob = new Blob([skelText], { type: "application/json" });
    }

    if (!SPINE_RUNTIMES[detectedVer]) {
      throw new Error("检测到 Spine 版本为 " + detectedVer + "，当前仅支持 3.8 / 4.1 / 4.2 / 4.3 导出格式。");
    }

    report("正在解析 .atlas 贴图页（Spine " + detectedVer + "）…");
    var atlasText = await ctx.entryMap[atlasPath].async("string");
    var texRefs = parseAtlasTexturePages(atlasText);
    if (texRefs.length === 0) {
      // 兜底查找同目录 png
      ctx.pathList.forEach(function (p) {
        if (/\.png$/i.test(p) && imp.dirname(p) === baseDir) {
          texRefs.push(p.split("/").pop());
        }
      });
    }

    var isMobile = (global.innerWidth || 900) <= 640;
    var maxTex = isMobile ? 1024 : 1536;
    var missing = [];
    var entries = {};
    entries[atlasPath] = new Blob([atlasText], { type: "text/plain" });
    entries[skelPath] = skelBlob;
    var firstTexBlob = null;

    for (var i = 0; i < texRefs.length; i++) {
      var tref = texRefs[i];
      var resolved = resolveEntryPath(baseDir, tref, ctx.entryMap, ctx.lowerMap);
      if (!resolved) {
        missing.push(tref);
        continue;
      }
      report("正在处理 Spine 贴图 (" + (i + 1) + "/" + texRefs.length + ")…");
      var rawBlob = await ctx.entryMap[resolved].async("blob");
      rawBlob = await imp.downsampleImageBlob(rawBlob, maxTex);
      if (!firstTexBlob) firstTexBlob = rawBlob;
      entries[resolved] = rawBlob;
    }

    if (missing.length > 0) {
      throw new Error("Spine 模型包缺少贴图文件：" + missing.slice(0, 3).join("、"));
    }

    report("正在写入本地桌宠库…");
    var baseName = skelPath.split("/").pop().replace(/\.(json|skel(\.bytes)?)$/i, "") || ctx.file.name.replace(/\.zip$/i, "");
    var thumb = firstTexBlob ? await imp.makeThumbDataUrl(firstTexBlob) : "";

    var store = global.HomeDollPetStore;
    if (!store || typeof store.savePet !== "function") throw new Error("未检测到桌宠存储模块");
    return await store.savePet({
      id: "pet_spine_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      type: "spine",
      name: String(baseName).slice(0, 20),
      sub: "Spine " + detectedVer + " 绑骨模型",
      thumb: thumb,
      files: {
        atlasPath: atlasPath,
        skelPath: skelPath,
        isBinary: isBinary,
        spineVersion: detectedVer,
        entries: entries
      },
      meta: { animations: animations, spineVersion: detectedVer },
      createdAt: Date.now()
    });
  }

  // ==================== 2. Spine PetAdapter Implementation ====================

  function createSpinePetAdapter() {
    var player = null;
    var hostDiv = null;
    var cssW = 156;
    var cssH = 198;
    var animNames = [];
    var idleAnimName = "";

    function pickIdleAnim(list) {
      if (!list || !list.length) return "";
      var found = list.find(function (n) { return /idle|stand|wait|breath|daiji|待机/i.test(n); });
      return found || list[0];
    }

    return {
      type: "spine",
      mount: async function (containerEl, petRecord, opts) {
        var filesInfo = petRecord && petRecord.files;
        if (!filesInfo || !filesInfo.atlasPath || !filesInfo.skelPath || !filesInfo.entries) {
          throw new Error("Spine 模型数据缺失");
        }
        var spineLib = await ensureSpineRuntime(filesInfo.spineVersion || "4.2");
        lastSkeletonError = "";

        // 构造 rawDataURIs（纯本地内存注入，兼容 IndexedDB 与 file://，并对齐 NFC/NFD 中文贴图路径）
        var rawDataURIs = {};
        var entries = Object.assign({}, filesInfo.entries);
        entries[filesInfo.skelPath] = await patchKnownBadSpineVersion(entries[filesInfo.skelPath], filesInfo.isBinary);
        var keys = Object.keys(entries);
        var registerUriAliases = function (pathKey, uri) {
          if (!pathKey || !uri) return;
          rawDataURIs[pathKey] = uri;
          if (typeof pathKey.normalize === "function") {
            rawDataURIs[pathKey.normalize("NFC")] = uri;
            rawDataURIs[pathKey.normalize("NFD")] = uri;
          }
          var shortName = pathKey.split("/").pop();
          if (shortName) {
            if (!rawDataURIs[shortName]) rawDataURIs[shortName] = uri;
            if (typeof shortName.normalize === "function") {
              rawDataURIs[shortName.normalize("NFC")] = uri;
              rawDataURIs[shortName.normalize("NFD")] = uri;
            }
          }
        };
        for (var i = 0; i < keys.length; i++) {
          var k = keys[i];
          var mime = /\.png$/i.test(k) ? "image/png"
            : (/\.json$/i.test(k) ? "application/json;charset=utf-8"
              : (/\.atlas/i.test(k) ? "text/plain;charset=utf-8" : "application/octet-stream"));
          var dataUri = await blobToDataUri(entries[k], mime);
          registerUriAliases(k, dataUri);
        }
        // 额外将 .atlas 中声明的原始贴图页名与已解析贴图精确绑定
        try {
          var atlasBlob = entries[filesInfo.atlasPath];
          if (atlasBlob) {
            var atlasTxt = await atlasBlob.text();
            var pages = parseAtlasTexturePages(atlasTxt);
            var imp = getImporters();
            var baseDir = imp ? imp.dirname(filesInfo.atlasPath) : "";
            var lowerMap = {};
            keys.forEach(function (ek) { lowerMap[ek.toLowerCase()] = ek; });
            pages.forEach(function (pg) {
              var resolved = resolveEntryPath(baseDir, pg, entries, lowerMap);
              if (resolved && rawDataURIs[resolved]) {
                var fullPg = baseDir ? (baseDir + "/" + pg) : pg;
                registerUriAliases(fullPg, rawDataURIs[resolved]);
                registerUriAliases(pg, rawDataURIs[resolved]);
              }
            });
          }
        } catch (_) {}

        cssW = Math.max(48, Math.round((opts && opts.width) || 156));
        cssH = Math.max(60, Math.round((opts && opts.height) || 198));
        containerEl.innerHTML = "";
        hostDiv = global.document.createElement("div");
        hostDiv.style.cssText = "width:100%;height:100%;pointer-events:none;overflow:hidden;";
        containerEl.appendChild(hostDiv);

        await new Promise(function (resolve, reject) {
          var playerCfg = {
            skeleton: filesInfo.skelPath, // Spine 4.2 / 4.3 标准字段
            atlas: filesInfo.atlasPath,   // Spine 4.2 / 4.3 标准字段
            atlasUrl: filesInfo.atlasPath, // Spine 3.8 / 4.1 兼容字段
            rawDataURIs: rawDataURIs,
            alpha: true,
            backgroundColor: "#00000000",
            showControls: false,
            preserveDrawingBuffer: false,
            premultipliedAlpha: true,
            success: function (pl) {
              try {
                if (pl.skeleton && pl.skeleton.data && Array.isArray(pl.skeleton.data.animations)) {
                  animNames = pl.skeleton.data.animations.map(function (a) { return a.name; });
                } else {
                  animNames = (petRecord.meta && petRecord.meta.animations) || [];
                }
                idleAnimName = pickIdleAnim(animNames);
                if (idleAnimName && pl.setAnimation) {
                  pl.setAnimation(idleAnimName, true);
                }
              } catch (_) {}
              resolve(pl);
            },
            error: function (_pl, msg) {
              var plain = String(msg || "未知错误").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "");
              var hint = "";
              if (lastSkeletonError) {
                plain = plain.replace(/\{\}\s*$/, "") + " 真实原因：" + lastSkeletonError;
                if (/region not found|not found in atlas/i.test(lastSkeletonError)) {
                  hint = "（骨骼引用的部件在 .atlas 中找不到：请确认 .atlas 与 .json 来自同一次导出，且贴图未被改名）";
                } else if (/skin|animation|slot|bone|timeline/i.test(lastSkeletonError)) {
                  hint = "（骨骼数据与运行时版本不匹配：请核对导出版本与 skeleton.spine 字段）";
                }
              }
              reject(new Error("Spine 渲染初始化失败：" + plain + hint));
            }
          };
          if (filesInfo.isBinary) {
            playerCfg.binaryUrl = filesInfo.skelPath;
            playerCfg.skelUrl = filesInfo.skelPath; // 兼容 Spine 3.8 命名
          } else {
            playerCfg.jsonUrl = filesInfo.skelPath;
          }

          player = new spineLib.SpinePlayer(hostDiv, playerCfg);
        });
      },
      resize: function (w, h) {
        cssW = Math.max(48, Math.round(w || 156));
        cssH = Math.max(60, Math.round(h || 198));
        if (player && typeof player.resize === "function") {
          try { player.resize(); } catch (_) {}
        }
      },
      setAnimation: function (clipName) {
        if (!player || !player.animationState) return;
        try {
          if (clipName === "idle") {
            if (idleAnimName) player.animationState.setAnimation(0, idleAnimName, true);
            return;
          }
          var nonIdle = animNames.filter(function (n) { return n !== idleAnimName; });
          var chosen = nonIdle.length > 0 ? nonIdle[Math.floor(Math.random() * nonIdle.length)] : idleAnimName;
          if (chosen) {
            player.animationState.setAnimation(0, chosen, false);
            if (idleAnimName) player.animationState.addAnimation(0, idleAnimName, true, 0);
          }
        } catch (_) {}
      },
      hitTest: function (localX, localY) {
        return localX >= cssW * 0.14 && localX <= cssW * 0.86 && localY >= cssH * 0.08 && localY <= cssH * 0.94;
      },
      setPaused: function (paused) {
        if (!player) return;
        try {
          if (paused && typeof player.pause === "function") player.pause();
          else if (!paused && typeof player.play === "function") player.play();
        } catch (_) {}
      },
      destroy: function () {
        try {
          if (player) {
            var gl = player.gl || (player.canvas && player.canvas.getContext && player.canvas.getContext("webgl2")) || (player.canvas && player.canvas.getContext && player.canvas.getContext("webgl"));
            if (typeof player.dispose === "function") player.dispose();
            if (gl && typeof gl.getExtension === "function") {
              var ext = gl.getExtension("WEBGL_lose_context");
              if (ext) ext.loseContext();
            }
            player = null;
          }
        } catch (_) {}
        if (hostDiv && hostDiv.parentNode) hostDiv.parentNode.removeChild(hostDiv);
        hostDiv = null;
        animNames = [];
        idleAnimName = "";
      }
    };
  }

  var impRef = getImporters();
  if (impRef && typeof impRef.registerZipImporter === "function") {
    impRef.registerZipImporter(
      "spine",
      function (pathList) { return pathList.some(function (p) { return /\.atlas(\.txt)?$/i.test(p); }); },
      importSpineZip
    );
  }
  if (global.HomeDollPetEngine && typeof global.HomeDollPetEngine.registerAdapter === "function") {
    global.HomeDollPetEngine.registerAdapter("spine", createSpinePetAdapter);
  }

  global.HomeDollPetSpineAdapter = {
    version: "1.0.0",
    supportedVersions: Object.keys(SPINE_RUNTIMES),
    detectSpineVersionFromJson: detectSpineVersionFromJson,
    detectSpineVersionFromBinary: detectSpineVersionFromBinary
  };
})(typeof window !== "undefined" ? window : globalThis);

