/**
 * Milvus/pet_adapter_frames.js
 * 主屏幕桌宠「PNG 序列帧 / GIF / WebP 动图」插件适配器（严格零 AI · 零外部依赖）
 *
 * 完美适配 Python 桌宠常见素材包（如 张飞-猫/graph/ 分动作文件夹）：
 * 1. 自动按子文件夹归类动作（sit/idle、walk、lifted up/drag、stretch/draw/write 等）并自然数字排序
 * 2. 导入时自动等比压缩至 ≤360px 透明 WebP/PNG（50MB 原图 → ~1.5~3MB），手机端秒开不卡顿
 * 3. 支持直接上传单张透明 .gif / .webp 动图
 * 4. Canvas 2D 逐帧播放 + 漫步自动左右镜像 + 像素级 Alpha 透明点击穿透
 */
(function (global) {
  "use strict";

  function getImporters() {
    return global.HomeDollPetImporters || null;
  }

  function compressFrameBlob(blob, maxSide) {
    return new Promise(function (resolve) {
      if (!blob || typeof Image === "undefined") { resolve(blob); return; }
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onerror = function () { URL.revokeObjectURL(url); resolve(blob); };
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        var limit = maxSide || 360;
        if (!w || !h) { resolve(blob); return; }
        var ratio = (w > limit || h > limit) ? Math.min(limit / w, limit / h) : 1;
        var nw = Math.max(1, Math.round(w * ratio));
        var nh = Math.max(1, Math.round(h * ratio));
        try {
          var c = global.document.createElement("canvas");
          c.width = nw;
          c.height = nh;
          c.getContext("2d").drawImage(img, 0, 0, nw, nh);
          c.toBlob(function (webpBlob) {
            if (webpBlob && webpBlob.size > 0) {
              resolve(webpBlob);
            } else {
              c.toBlob(function (pngBlob) { resolve(pngBlob || blob); }, "image/png");
            }
          }, "image/webp", 0.86);
        } catch (_) {
          resolve(blob);
        }
      };
      img.src = url;
    });
  }

  function naturalSort(a, b) {
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
  }

  function pickFolderByRegex(names, regex) {
    return names.find(function (n) { return regex.test(n); }) || "";
  }

  // ==================== 1. PNG Sequence & Java Shimeji-ee ZIP Importer ====================

  async function importShimejiZip(ctx, shimeEntries, report) {
    var imp = getImporters();
    // 忽略 unused 目录，建立帧号 -> 路径映射
    var byNum = {};
    shimeEntries.forEach(function (item) {
      if (!byNum[item.num]) byNum[item.num] = item.path;
    });

    // Shimeji-ee 通用标准动作帧表（全网 99% Java Shimeji 通用）
    var SHIMEJI_PRESETS = {
      idle: [1, 1, 1, 1, 2, 1],
      walk: [1, 2, 1, 3],
      sit: [26, 27, 28, 29, 28, 27, 11],
      lift: [5, 6, 7, 8, 9, 10, 9, 8, 7, 6],
      poke_sprawl: [15, 16, 17, 16],
      poke_play: [22, 23, 24, 25, 30, 31, 32, 33]
    };

    var uniqueNums = [];
    Object.keys(SHIMEJI_PRESETS).forEach(function (act) {
      SHIMEJI_PRESETS[act].forEach(function (n) {
        if (byNum[n] && uniqueNums.indexOf(n) < 0) uniqueNums.push(n);
      });
    });
    if (!uniqueNums.length) {
      uniqueNums = Object.keys(byNum).map(Number).sort(function (a, b) { return a - b; });
    }

    var compressedByNum = {};
    for (var i = 0; i < uniqueNums.length; i++) {
      var n = uniqueNums[i];
      if (i === 0 || i % 4 === 0 || i === uniqueNums.length - 1) {
        report("正在导入 Shimeji 帧 (" + (i + 1) + "/" + uniqueNums.length + ")…");
      }
      var raw = await ctx.entryMap[byNum[n]].async("blob");
      compressedByNum[n] = await compressFrameBlob(raw, 320);
    }

    var actions = {};
    Object.keys(SHIMEJI_PRESETS).forEach(function (act) {
      var seq = [];
      SHIMEJI_PRESETS[act].forEach(function (n) {
        if (compressedByNum[n]) seq.push(compressedByNum[n]);
      });
      if (seq.length) actions[act] = seq;
    });
    var actionNames = Object.keys(actions);
    if (!actionNames.length) {
      actions.idle = uniqueNums.map(function (n) { return compressedByNum[n]; }).filter(Boolean);
      actionNames = ["idle"];
    }

    report("正在写入本地桌宠库…");
    var thumbBlob = compressedByNum[1] || compressedByNum[uniqueNums[0]];
    var thumb = (imp && thumbBlob) ? await imp.makeThumbDataUrl(thumbBlob) : "";
    var baseName = ctx.file.name.replace(/\.zip$/i, "") || "Shimeji 桌宠";
    var store = global.HomeDollPetStore;
    if (!store || typeof store.savePet !== "function") throw new Error("未检测到桌宠存储模块");

    return await store.savePet({
      id: "pet_shimeji_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      type: "frames",
      name: String(baseName).slice(0, 20),
      sub: "Shimeji 桌宠 · " + actionNames.length + " 组动作",
      thumb: thumb,
      files: { isAnimatedImage: false, actions: actions, fps: 7 },
      meta: { isShimeji: true, actionNames: actionNames, totalFrames: uniqueNums.length },
      createdAt: Date.now()
    });
  }

  async function importFramesZip(ctx, report) {
    var imp = getImporters();
    var imgPaths = ctx.pathList.filter(function (p) {
      return /\.(png|webp|gif|jpg|jpeg)$/i.test(p) && !/(?:^|\/)unused\//i.test(p);
    });
    if (imgPaths.length === 0) throw new Error("压缩包中未找到图片序列帧");

    // 优先检测是否为 Java Shimeji-ee 标准帧包（shime1.png ~ shime46.png）
    var shimeEntries = [];
    imgPaths.forEach(function (p) {
      var m = p.match(/(?:^|\/)shime(\d+)\.png$/i);
      if (m) shimeEntries.push({ num: parseInt(m[1], 10), path: p });
    });
    if (shimeEntries.length >= 3) {
      return await importShimejiZip(ctx, shimeEntries, report);
    }

    // 按直接父目录归类动作文件夹
    var groups = {};
    imgPaths.forEach(function (p) {
      var parts = p.split("/");
      var folder = parts.length >= 2 ? parts[parts.length - 2] : "default";
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(p);
    });

    var folderNames = Object.keys(groups).sort(naturalSort);
    var totalFrames = 0;
    folderNames.forEach(function (f) {
      groups[f].sort(naturalSort);
      totalFrames += groups[f].length;
    });

    var actions = {};
    var processed = 0;
    var firstThumbBlob = null;
    var preferredIdle = pickFolderByRegex(folderNames, /sit|idle|stand|wait|default|待机|坐/i) || folderNames[0];

    for (var fi = 0; fi < folderNames.length; fi++) {
      var fname = folderNames[fi];
      var list = groups[fname];
      actions[fname] = [];
      for (var i = 0; i < list.length; i++) {
        processed++;
        if (processed === 1 || processed % 4 === 0 || processed === totalFrames) {
          report("正在压缩序列帧 (" + processed + "/" + totalFrames + ")…");
        }
        var rawBlob = await ctx.entryMap[list[i]].async("blob");
        var compact = await compressFrameBlob(rawBlob, 360);
        if (!firstThumbBlob && fname === preferredIdle) firstThumbBlob = compact;
        actions[fname].push(compact);
      }
    }

    if (!firstThumbBlob && actions[folderNames[0]] && actions[folderNames[0]][0]) {
      firstThumbBlob = actions[folderNames[0]][0];
    }

    report("正在写入本地桌宠库…");
    var baseName = ctx.file.name.replace(/\.zip$/i, "") || "序列帧桌宠";
    var thumb = (imp && firstThumbBlob) ? await imp.makeThumbDataUrl(firstThumbBlob) : "";

    var store = global.HomeDollPetStore;
    if (!store || typeof store.savePet !== "function") throw new Error("未检测到桌宠存储模块");
    return await store.savePet({
      id: "pet_frames_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      type: "frames",
      name: String(baseName).slice(0, 20),
      sub: "序列帧桌宠 · " + folderNames.length + " 组动作",
      thumb: thumb,
      files: { isAnimatedImage: false, actions: actions, fps: 10 },
      meta: { actionNames: folderNames, totalFrames: totalFrames },
      createdAt: Date.now()
    });
  }

  // ==================== 2. Single GIF / Animated WebP Importer ====================

  async function importAnimatedImage(file, onProgress) {
    var report = typeof onProgress === "function" ? onProgress : function () {};
    var imp = getImporters();
    report("正在导入动图桌宠…");
    var thumb = imp ? await imp.makeThumbDataUrl(file) : "";
    var baseName = String(file.name || "动图桌宠").replace(/\.(gif|webp)$/i, "");
    var store = global.HomeDollPetStore;
    if (!store || typeof store.savePet !== "function") throw new Error("未检测到桌宠存储模块");
    return await store.savePet({
      id: "pet_gif_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      type: "frames",
      name: baseName.slice(0, 20),
      sub: "动态图桌宠",
      thumb: thumb,
      files: { isAnimatedImage: true, imageBlob: file },
      meta: { isAnimatedImage: true },
      createdAt: Date.now()
    });
  }

  // ==================== 3. Frames / GIF PetAdapter Implementation ====================

  function createFramesPetAdapter() {
    var canvas = null;
    var ctx = null;
    var imgEl = null;
    var isAnimImg = false;
    var blobUrls = [];
    var loadedFrames = {}; // folderName -> Image[]
    var actionNames = [];
    var idleFolder = "";
    var walkFolder = "";
    var liftFolder = "";
    var sitFolder = "";
    var pokeFolders = [];

    var curFolder = "";
    var frameIdx = 0;
    var fps = 10;
    var turnDeg = 0;
    var cssW = 156;
    var cssH = 198;
    var dpr = 1;
    var paused = false;
    var rafId = 0;
    var lastFrameTs = 0;

    function revokeAll() {
      for (var i = 0; i < blobUrls.length; i++) {
        try { URL.revokeObjectURL(blobUrls[i]); } catch (_) {}
      }
      blobUrls = [];
    }

    function loadBlobImage(blob) {
      return new Promise(function (resolve) {
        var u = URL.createObjectURL(blob);
        blobUrls.push(u);
        var im = new Image();
        im.onload = function () { resolve(im); };
        im.onerror = function () { resolve(null); };
        im.src = u;
      });
    }

    function drawCurrentFrame() {
      if (!canvas || !ctx) return;
      var list = loadedFrames[curFolder] || loadedFrames[idleFolder] || [];
      if (!list.length) return;
      var im = list[frameIdx % list.length];
      if (!im || !im.naturalWidth) return;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      var s = Math.min((cssW * 0.94) / im.naturalWidth, (cssH * 0.94) / im.naturalHeight);
      var dw = im.naturalWidth * s;
      var dh = im.naturalHeight * s;
      ctx.translate(cssW * 0.5, cssH * 0.52);
      if (turnDeg > 2) ctx.scale(-1, 1); // 漫步转向水平镜像
      ctx.drawImage(im, -dw * 0.5, -dh * 0.5, dw, dh);
      ctx.restore();
    }

    function tick(ts) {
      rafId = 0;
      if (paused || isAnimImg || !canvas) return;
      var interval = 1000 / Math.max(4, fps);
      if (ts - lastFrameTs >= interval) {
        lastFrameTs = ts;
        var list = loadedFrames[curFolder] || [];
        if (list.length > 0) {
          frameIdx = (frameIdx + 1) % list.length;
          drawCurrentFrame();
        }
      }
      rafId = global.requestAnimationFrame(tick);
    }

    function startLoop() {
      if (!rafId && !paused && !isAnimImg && canvas) {
        lastFrameTs = 0;
        rafId = global.requestAnimationFrame(tick);
      }
    }

    function stopLoop() {
      if (rafId) { global.cancelAnimationFrame(rafId); rafId = 0; }
    }

    return {
      type: "frames",
      mount: async function (containerEl, petRecord, opts) {
        var filesInfo = petRecord && petRecord.files;
        if (!filesInfo) throw new Error("序列帧桌宠数据缺失");
        cssW = Math.max(48, Math.round((opts && opts.width) || 156));
        cssH = Math.max(60, Math.round((opts && opts.height) || 198));
        dpr = Math.min(global.devicePixelRatio || 1, 2);
        containerEl.innerHTML = "";

        if (filesInfo.isAnimatedImage && filesInfo.imageBlob) {
          isAnimImg = true;
          var u = URL.createObjectURL(filesInfo.imageBlob);
          blobUrls.push(u);
          imgEl = global.document.createElement("img");
          imgEl.src = u;
          imgEl.style.cssText = "display:block;width:100%;height:100%;object-fit:contain;pointer-events:none;";
          containerEl.appendChild(imgEl);
          return;
        }

        isAnimImg = false;
        fps = Number(filesInfo.fps) || 10;
        var rawActions = filesInfo.actions || {};
        actionNames = Object.keys(rawActions);
        if (!actionNames.length) throw new Error("未找到任何序列帧动作");

        for (var i = 0; i < actionNames.length; i++) {
          var name = actionNames[i];
          var blobs = Array.isArray(rawActions[name]) ? rawActions[name] : [];
          var imgs = [];
          for (var j = 0; j < blobs.length; j++) {
            var im = await loadBlobImage(blobs[j]);
            if (im) imgs.push(im);
          }
          if (imgs.length) loadedFrames[name] = imgs;
        }

        actionNames = Object.keys(loadedFrames);
        idleFolder = pickFolderByRegex(actionNames, /idle|sit|stand|wait|default|待机|坐/i) || actionNames[0];
        sitFolder = pickFolderByRegex(actionNames, /sit|sleep|rest|坐|睡/i) || idleFolder;
        walkFolder = pickFolderByRegex(actionNames, /walk|run|move|走|跑/i) || idleFolder;
        liftFolder = pickFolderByRegex(actionNames, /lift|drag|grab|carry|拎|提|抓/i) || idleFolder;
        pokeFolders = actionNames.filter(function (n) {
          return n !== idleFolder && n !== walkFolder && n !== liftFolder;
        });
        if (!pokeFolders.length) pokeFolders = actionNames.slice();

        curFolder = idleFolder;
        frameIdx = 0;

        canvas = global.document.createElement("canvas");
        canvas.style.cssText = "display:block;width:100%;height:100%;pointer-events:none;";
        containerEl.appendChild(canvas);
        ctx = canvas.getContext("2d", { willReadFrequently: true });
        this.resize(cssW, cssH, dpr);
        drawCurrentFrame();
        paused = false;
        startLoop();
      },
      resize: function (w, h, nextDpr) {
        cssW = Math.max(48, Math.round(w || 156));
        cssH = Math.max(60, Math.round(h || 198));
        dpr = Math.min(Number(nextDpr) || (global.devicePixelRatio || 1), 2);
        if (canvas) {
          canvas.width = Math.round(cssW * dpr);
          canvas.height = Math.round(cssH * dpr);
          drawCurrentFrame();
        }
      },
      setAnimation: function (clipName) {
        if (isAnimImg) return;
        var next = idleFolder;
        if (clipName === "walk") next = walkFolder;
        else if (clipName === "lift") next = liftFolder;
        else if (clipName === "sit") next = sitFolder;
        else if (clipName === "wave" || clipName === "happy" || clipName === "shy") {
          next = pokeFolders[Math.floor(Math.random() * pokeFolders.length)] || idleFolder;
        }
        if (next !== curFolder) {
          curFolder = next;
          frameIdx = 0;
          drawCurrentFrame();
        }
      },
      setTurnDeg: function (deg) {
        turnDeg = Number(deg) || 0;
        if (isAnimImg && imgEl) {
          imgEl.style.transform = turnDeg > 2 ? "scaleX(-1)" : "";
        }
      },
      hitTest: function (localX, localY) {
        if (isAnimImg) {
          return localX >= cssW * 0.14 && localX <= cssW * 0.86 && localY >= cssH * 0.1 && localY <= cssH * 0.94;
        }
        if (!canvas || !ctx) return false;
        var px = Math.floor(localX * dpr);
        var py = Math.floor(localY * dpr);
        if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return false;
        try {
          return ctx.getImageData(px, py, 1, 1).data[3] > 18;
        } catch (_) {
          return localX >= cssW * 0.14 && localX <= cssW * 0.86 && localY >= cssH * 0.1 && localY <= cssH * 0.94;
        }
      },
      setPaused: function (isPaused) {
        paused = Boolean(isPaused);
        if (paused) stopLoop();
        else startLoop();
      },
      destroy: function () {
        stopLoop();
        if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
        if (imgEl && imgEl.parentNode) imgEl.parentNode.removeChild(imgEl);
        canvas = null; ctx = null; imgEl = null;
        loadedFrames = {};
        revokeAll();
      }
    };
  }

  var impRef = getImporters();
  if (impRef && typeof impRef.registerZipImporter === "function") {
    impRef.registerZipImporter(
      "frames",
      function (pathList) {
        var hasL2d = pathList.some(function (p) { return /\.model3\.json$/i.test(p); });
        var hasSpine = pathList.some(function (p) { return /\.atlas(\.txt)?$/i.test(p); });
        var hasImgs = pathList.some(function (p) { return /\.(png|webp|gif|jpg|jpeg)$/i.test(p); });
        return !hasL2d && !hasSpine && hasImgs;
      },
      importFramesZip
    );
    impRef.importAnimatedImage = importAnimatedImage;
  }

  if (global.HomeDollPetEngine && typeof global.HomeDollPetEngine.registerAdapter === "function") {
    global.HomeDollPetEngine.registerAdapter("frames", createFramesPetAdapter);
  }

  global.HomeDollPetFramesAdapter = {
    version: "1.0.0",
    importAnimatedImage: importAnimatedImage
  };
})(typeof window !== "undefined" ? window : globalThis);

