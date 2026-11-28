/**
 * Milvus/pet_adapter_live2d.js
 * 主屏幕桌宠 Live2D 插件适配器 + 统一 ZIP 模型包导入调度器（严格零 AI · 零预载开销）
 *
 * 借鉴 SullyOS-master 实战经验：
 * 1. 不打包专有二进制：仅在导入/启用 Live2D 时按需懒加载 vendor/ 或官方 Cubism Core + Pixi + pixi-live2d-display + JSZip
 * 2. Unicode NFC 路径归一化 + 大小写回退 + 缺失引用精准诊断
 * 3. Cubism 5/5.3（moc3 v6）核心兼容补丁：bridgeCubism6RenderOrders + enableCubism5HighPrecisionMasks
 * 4. 移动端防 OOM 纹理自动降采样（>1024/1536px 等比压缩保留 Alpha）
 * 5. 严格资源生命周期：destroy() 释放所有 Blob URL、Pixi 纹理并主动 loseContext 防 WebGL 上下文泄漏
 */
(function (global) {
  "use strict";

  var OFFICIAL_CUBISM_CORE = "https://cubism.live2d.com/sdk-web/core/06/live2dcubismcore.min.js";
  var CDN_JSZIP = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
  var CDN_PIXI = "https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js";
  var CDN_PIXI_LIVE2D = "https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js";

  var scriptPromises = {};

  function loadScriptOnce(url) {
    if (scriptPromises[url]) return scriptPromises[url];
    scriptPromises[url] = new Promise(function (resolve, reject) {
      var doc = global.document;
      if (!doc) { reject(new Error("非浏览器环境")); return; }
      var s = doc.createElement("script");
      s.src = url;
      s.async = true;
      s.onload = function () { resolve(url); };
      s.onerror = function () {
        delete scriptPromises[url];
        if (s.parentNode) s.parentNode.removeChild(s);
        reject(new Error("无法加载脚本：" + url));
      };
      doc.head.appendChild(s);
    });
    return scriptPromises[url];
  }

  async function loadWithLocalFallback(localPath, cdnUrl, checkFn, label) {
    if (checkFn()) return;
    try {
      await loadScriptOnce(localPath);
      if (checkFn()) return;
    } catch (_) {}
    await loadScriptOnce(cdnUrl);
    if (!checkFn()) throw new Error(label + " 加载完成但未注册全局变量");
  }

  async function ensureJSZip() {
    await loadWithLocalFallback(
      "./vendor/jszip.min.js",
      CDN_JSZIP,
      function () { return typeof global.JSZip === "function"; },
      "JSZip"
    );
    return global.JSZip;
  }

  async function ensureLive2DRuntime() {
    await loadWithLocalFallback(
      "./vendor/live2dcubismcore.min.js",
      OFFICIAL_CUBISM_CORE,
      function () { return Boolean(global.Live2DCubismCore); },
      "Live2D Cubism Core"
    );
    await loadWithLocalFallback(
      "./vendor/pixi.min.js",
      CDN_PIXI,
      function () { return Boolean(global.PIXI); },
      "PixiJS"
    );
    await loadWithLocalFallback(
      "./vendor/cubism4.min.js",
      CDN_PIXI_LIVE2D,
      function () { return Boolean(global.PIXI && global.PIXI.live2d && global.PIXI.live2d.Live2DModel); },
      "pixi-live2d-display"
    );
  }

  // ==================== 1. Shared ZIP Utilities & Unified Importer Registry ====================

  function normalizeZipPath(p) {
    return String(p || "")
      .normalize("NFC")
      .replace(/\\/g, "/")
      .replace(/^\.\/+/, "")
      .replace(/^\/+/, "");
  }

  function dirname(p) {
    var idx = p.lastIndexOf("/");
    return idx >= 0 ? p.slice(0, idx) : "";
  }

  function joinNormPath(baseDir, relPath) {
    var cleanRel = normalizeZipPath(relPath);
    if (!baseDir) return cleanRel;
    var parts = (baseDir + "/" + cleanRel).split("/");
    var stack = [];
    for (var i = 0; i < parts.length; i++) {
      var seg = parts[i];
      if (!seg || seg === ".") continue;
      if (seg === "..") stack.pop();
      else stack.push(seg);
    }
    return stack.join("/");
  }

  function downsampleImageBlob(blob, maxSide) {
    return new Promise(function (resolve) {
      if (!blob || typeof createImageBitmap !== "function" && typeof Image === "undefined") { resolve(blob); return; }
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onerror = function () { URL.revokeObjectURL(url); resolve(blob); };
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        var limit = maxSide || 1280;
        if (!w || !h || (w <= limit && h <= limit)) { resolve(blob); return; }
        var ratio = Math.min(limit / w, limit / h);
        var nw = Math.max(1, Math.round(w * ratio));
        var nh = Math.max(1, Math.round(h * ratio));
        try {
          var c = global.document.createElement("canvas");
          c.width = nw;
          c.height = nh;
          var ctx = c.getContext("2d");
          ctx.drawImage(img, 0, 0, nw, nh);
          c.toBlob(function (outBlob) { resolve(outBlob || blob); }, "image/png");
        } catch (_) {
          resolve(blob);
        }
      };
      img.src = url;
    });
  }

  function makeThumbDataUrl(blob) {
    return new Promise(function (resolve) {
      if (!blob) { resolve(""); return; }
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onerror = function () { URL.revokeObjectURL(url); resolve(""); };
      img.onload = function () {
        URL.revokeObjectURL(url);
        try {
          var c = global.document.createElement("canvas");
          c.width = 160;
          c.height = 200;
          var ctx = c.getContext("2d");
          var s = Math.min(160 / img.width, 200 / img.height);
          var dw = img.width * s, dh = img.height * s;
          ctx.drawImage(img, (160 - dw) * 0.5, (200 - dh) * 0.5, dw, dh);
          resolve(c.toDataURL("image/png"));
        } catch (_) {
          resolve("");
        }
      };
      img.src = url;
    });
  }

  var zipImporters = [];

  function registerZipImporter(kind, detectorFn, importFn) {
    zipImporters = zipImporters.filter(function (x) { return x.kind !== kind; });
    zipImporters.push({ kind: kind, detect: detectorFn, run: importFn });
  }

  async function importZip(file, onProgress) {
    var report = typeof onProgress === "function" ? onProgress : function () {};
    report("正在加载 ZIP 解析组件…");
    var JSZip = await ensureJSZip();
    report("正在读取压缩包目录…");
    var zip = await JSZip.loadAsync(file);

    var pathList = [];
    var entryMap = {};
    var lowerMap = {};
    Object.keys(zip.files).forEach(function (rawName) {
      var zf = zip.files[rawName];
      if (!zf || zf.dir) return;
      var norm = normalizeZipPath(rawName);
      if (!norm || norm.indexOf("__MACOSX/") === 0 || norm.indexOf("/.") >= 0 || norm.charAt(0) === ".") return;
      pathList.push(norm);
      entryMap[norm] = zf;
      lowerMap[norm.toLowerCase()] = norm;
    });

    for (var i = 0; i < zipImporters.length; i++) {
      var imp = zipImporters[i];
      if (imp.detect(pathList)) {
        return await imp.run({ file: file, pathList: pathList, entryMap: entryMap, lowerMap: lowerMap }, report);
      }
    }
    throw new Error("未在压缩包内识别到 Live2D（.model3.json）或 Spine（.atlas）模型文件");
  }

  // ==================== 2. Live2D ZIP Importer (SullyOS-grade validation) ====================

  function resolveEntryPath(baseDir, ref, entryMap, lowerMap) {
    if (!ref) return null;
    var joined = joinNormPath(baseDir, ref);
    if (entryMap[joined]) return joined;
    var low = lowerMap[joined.toLowerCase()];
    if (low) return low;
    return null;
  }

  async function importLive2DZip(ctx, report) {
    var modelPath = ctx.pathList.find(function (p) { return /\.model3\.json$/i.test(p); });
    if (!modelPath) throw new Error("未找到 .model3.json 入口文件");

    report("正在解析 Live2D 模型配置…");
    var modelText = await ctx.entryMap[modelPath].async("string");
    var modelJson = JSON.parse(modelText);
    var refs = (modelJson && modelJson.FileReferences) || {};
    var baseDir = dirname(modelPath);

    var neededRefs = [];
    if (refs.Moc) neededRefs.push({ key: "Moc", ref: refs.Moc, required: true });
    if (Array.isArray(refs.Textures)) {
      refs.Textures.forEach(function (t) { neededRefs.push({ key: "Texture", ref: t, required: true, isTexture: true }); });
    }
    if (refs.Physics) neededRefs.push({ key: "Physics", ref: refs.Physics, required: false });
    if (refs.Pose) neededRefs.push({ key: "Pose", ref: refs.Pose, required: false });
    if (refs.DisplayInfo) neededRefs.push({ key: "DisplayInfo", ref: refs.DisplayInfo, required: false });
    if (refs.UserData) neededRefs.push({ key: "UserData", ref: refs.UserData, required: false });

    var motionGroups = [];
    if (refs.Motions && typeof refs.Motions === "object") {
      Object.keys(refs.Motions).forEach(function (grp) {
        motionGroups.push(grp);
        var arr = Array.isArray(refs.Motions[grp]) ? refs.Motions[grp] : [];
        arr.forEach(function (m) {
          if (m && m.File) neededRefs.push({ key: "Motion", ref: m.File, required: false });
        });
      });
    }
    var expressions = [];
    if (Array.isArray(refs.Expressions)) {
      refs.Expressions.forEach(function (ex) {
        if (ex && ex.File) {
          expressions.push(ex.Name || ex.File);
          neededRefs.push({ key: "Expression", ref: ex.File, required: false });
        }
      });
    }

    var missingRequired = [];
    var filesToPack = {};
    filesToPack[modelPath] = new Blob([modelText], { type: "application/json" });

    var isMobile = (global.innerWidth || 900) <= 640;
    var maxTex = isMobile ? 1024 : 1536;
    var firstTexBlob = null;

    for (var i = 0; i < neededRefs.length; i++) {
      var item = neededRefs[i];
      var resolved = resolveEntryPath(baseDir, item.ref, ctx.entryMap, ctx.lowerMap);
      if (!resolved) {
        if (item.required) missingRequired.push(item.ref);
        continue;
      }
      if (filesToPack[resolved]) continue;
      report("正在提取资源 (" + (i + 1) + "/" + neededRefs.length + ")…");
      var rawBlob = await ctx.entryMap[resolved].async("blob");
      if (item.isTexture) {
        rawBlob = await downsampleImageBlob(rawBlob, maxTex);
        if (!firstTexBlob) firstTexBlob = rawBlob;
      }
      filesToPack[resolved] = rawBlob;
    }

    if (missingRequired.length > 0) {
      throw new Error("Live2D 模型包缺少必要文件：" + missingRequired.slice(0, 3).join("、"));
    }

    report("正在写入本地桌宠库…");
    var baseName = modelPath.split("/").pop().replace(/\.model3\.json$/i, "") || ctx.file.name.replace(/\.zip$/i, "");
    var thumb = firstTexBlob ? await makeThumbDataUrl(firstTexBlob) : "";

    var store = global.HomeDollPetStore;
    if (!store || typeof store.savePet !== "function") throw new Error("未检测到桌宠存储模块");
    var rec = await store.savePet({
      id: "pet_l2d_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      type: "live2d",
      name: String(baseName).slice(0, 20),
      sub: "Live2D 绑骨模型",
      thumb: thumb,
      files: { modelPath: modelPath, entries: filesToPack },
      meta: { motionGroups: motionGroups, expressions: expressions },
      createdAt: Date.now()
    });
    return rec;
  }

  registerZipImporter(
    "live2d",
    function (pathList) { return pathList.some(function (p) { return /\.model3\.json$/i.test(p); }); },
    importLive2DZip
  );

  // ==================== 3. SullyOS Cubism 5/5.3 Compatibility Bridges ====================

  function bridgeCubism6RenderOrders(model) {
    try {
      var rawModel = model && model.internalModel && model.internalModel.coreModel && model.internalModel.coreModel._model;
      var drawables = rawModel && rawModel.drawables;
      var renderOrders = rawModel && (typeof rawModel.getRenderOrders === "function" ? rawModel.getRenderOrders() : rawModel.renderOrders);
      if (drawables && !drawables.renderOrders && renderOrders) {
        var cnt = Number(drawables.count || renderOrders.length);
        drawables.renderOrders = typeof renderOrders.subarray === "function" ? renderOrders.subarray(0, cnt) : renderOrders;
      }
    } catch (_) {}
  }

  function enableCubism5HighPrecisionMasks(model) {
    try {
      var internal = model && model.internalModel;
      var renderer = internal && internal.renderer;
      var mocVer = internal && internal.coreModel && internal.coreModel.__moc && typeof internal.coreModel.__moc.getMocVersion === "function"
        ? internal.coreModel.__moc.getMocVersion()
        : null;
      if ((mocVer === null || mocVer >= 5) && renderer && typeof renderer.useHighPrecisionMask === "function") {
        renderer.useHighPrecisionMask(true);
      }
    } catch (_) {}
  }

  // ==================== 4. Live2D PetAdapter Implementation ====================

  function createLive2DPetAdapter() {
    var app = null;
    var model = null;
    var blobUrls = [];
    var cssW = 156;
    var cssH = 198;
    var motionGroups = [];
    var expressions = [];

    function makeBlobUrl(blob) {
      var u = URL.createObjectURL(blob);
      blobUrls.push(u);
      return u;
    }

    function revokeAllBlobUrls() {
      for (var i = 0; i < blobUrls.length; i++) {
        try { URL.revokeObjectURL(blobUrls[i]); } catch (_) {}
      }
      blobUrls = [];
    }

    function fitModel() {
      if (!model || !app) return;
      var mw = model.internalModel && model.internalModel.originalWidth ? model.internalModel.originalWidth : (model.width || 400);
      var mh = model.internalModel && model.internalModel.originalHeight ? model.internalModel.originalHeight : (model.height || 500);
      if (mw <= 0 || mh <= 0) return;
      var scale = Math.min((cssW * 0.94) / mw, (cssH * 0.94) / mh);
      model.scale.set(scale);
      model.anchor.set(0.5, 0.5);
      model.x = cssW * 0.5;
      model.y = cssH * 0.52;
    }

    return {
      type: "live2d",
      mount: async function (containerEl, petRecord, opts) {
        await ensureLive2DRuntime();
        var filesInfo = petRecord && petRecord.files;
        if (!filesInfo || !filesInfo.modelPath || !filesInfo.entries) {
          throw new Error("Live2D 模型数据缺失");
        }
        motionGroups = (petRecord.meta && petRecord.meta.motionGroups) || [];
        expressions = (petRecord.meta && petRecord.meta.expressions) || [];

        // 将 IndexedDB 中的全部资源 Blob 转为本地 Blob URL 并重写 .model3.json 引用
        var baseDir = dirname(filesInfo.modelPath);
        var entries = filesInfo.entries;
        var lowerMap = {};
        Object.keys(entries).forEach(function (k) { lowerMap[k.toLowerCase()] = k; });

        var urlByPath = {};
        Object.keys(entries).forEach(function (k) {
          if (k === filesInfo.modelPath) return;
          urlByPath[k] = makeBlobUrl(entries[k]);
        });

        var resolveUrl = function (rel) {
          var p = resolveEntryPath(baseDir, rel, entries, lowerMap);
          return p && urlByPath[p] ? urlByPath[p] : rel;
        };

        var modelBlob = entries[filesInfo.modelPath];
        var modelText = await modelBlob.text();
        var modelJson = JSON.parse(modelText);
        var refs = modelJson.FileReferences || {};
        if (refs.Moc) refs.Moc = resolveUrl(refs.Moc);
        if (Array.isArray(refs.Textures)) refs.Textures = refs.Textures.map(resolveUrl);
        if (refs.Physics) refs.Physics = resolveUrl(refs.Physics);
        if (refs.Pose) refs.Pose = resolveUrl(refs.Pose);
        if (refs.DisplayInfo) refs.DisplayInfo = resolveUrl(refs.DisplayInfo);
        if (refs.UserData) refs.UserData = resolveUrl(refs.UserData);
        if (refs.Motions && typeof refs.Motions === "object") {
          Object.keys(refs.Motions).forEach(function (g) {
            if (Array.isArray(refs.Motions[g])) {
              refs.Motions[g].forEach(function (m) { if (m && m.File) m.File = resolveUrl(m.File); });
            }
          });
        }
        if (Array.isArray(refs.Expressions)) {
          refs.Expressions.forEach(function (ex) { if (ex && ex.File) ex.File = resolveUrl(ex.File); });
        }

        // pixi-live2d-display 支持直接传 JSON 对象（带 url 字段作为基准标识）
        modelJson.url = makeBlobUrl(new Blob([JSON.stringify(modelJson)], { type: "application/json" }));

        cssW = Math.max(48, Math.round((opts && opts.width) || 156));
        cssH = Math.max(60, Math.round((opts && opts.height) || 198));
        var dpr = Math.min(global.devicePixelRatio || 1, 2);

        app = new global.PIXI.Application({
          width: cssW,
          height: cssH,
          backgroundAlpha: 0,
          transparent: true,
          antialias: true,
          autoDensity: true,
          resolution: dpr
        });
        app.view.style.cssText = "display:block;width:100%;height:100%;pointer-events:none;";
        containerEl.innerHTML = "";
        containerEl.appendChild(app.view);

        model = await global.PIXI.live2d.Live2DModel.from(modelJson, { autoInteract: false });
        bridgeCubism6RenderOrders(model);
        enableCubism5HighPrecisionMasks(model);
        app.stage.addChild(model);
        fitModel();
      },
      resize: function (w, h) {
        cssW = Math.max(48, Math.round(w || 156));
        cssH = Math.max(60, Math.round(h || 198));
        if (app && app.renderer) {
          app.renderer.resize(cssW, cssH);
          fitModel();
        }
      },
      setAnimation: function (clipName) {
        if (!model) return;
        try {
          if (clipName === "idle") {
            if (motionGroups.indexOf("Idle") >= 0) model.motion("Idle");
            return;
          }
          var nonIdle = motionGroups.filter(function (g) { return g.toLowerCase() !== "idle"; });
          if (nonIdle.length > 0) {
            var grp = nonIdle[Math.floor(Math.random() * nonIdle.length)];
            model.motion(grp);
          } else if (expressions.length > 0 && typeof model.expression === "function") {
            model.expression(expressions[Math.floor(Math.random() * expressions.length)]);
          }
        } catch (_) {}
      },
      hitTest: function (localX, localY) {
        return localX >= cssW * 0.14 && localX <= cssW * 0.86 && localY >= cssH * 0.08 && localY <= cssH * 0.94;
      },
      setPaused: function (paused) {
        if (!app || !app.ticker) return;
        if (paused) app.ticker.stop();
        else app.ticker.start();
      },
      destroy: function () {
        try {
          if (model) { model.destroy({ children: true, texture: true, baseTexture: true }); model = null; }
          if (app) {
            var gl = app.renderer && app.renderer.gl;
            app.destroy(true, { children: true, texture: true, baseTexture: true });
            if (gl && typeof gl.getExtension === "function") {
              var ext = gl.getExtension("WEBGL_lose_context");
              if (ext) ext.loseContext();
            }
            app = null;
          }
        } catch (_) {}
        revokeAllBlobUrls();
      }
    };
  }

  if (global.HomeDollPetEngine && typeof global.HomeDollPetEngine.registerAdapter === "function") {
    global.HomeDollPetEngine.registerAdapter("live2d", createLive2DPetAdapter);
  }

  global.HomeDollPetImporters = {
    version: "1.0.0",
    ensureJSZip: ensureJSZip,
    loadScriptOnce: loadScriptOnce,
    loadWithLocalFallback: loadWithLocalFallback,
    normalizeZipPath: normalizeZipPath,
    dirname: dirname,
    joinNormPath: joinNormPath,
    downsampleImageBlob: downsampleImageBlob,
    makeThumbDataUrl: makeThumbDataUrl,
    registerZipImporter: registerZipImporter,
    importZip: importZip
  };
})(typeof window !== "undefined" ? window : globalThis);

