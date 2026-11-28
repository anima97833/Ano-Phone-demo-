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

  // Shimeji & Python 序列帧（如张飞-猫）动作中文名映射表
  var SHIMEJI_ACTION_LABELS = {
    idle: "站立待机",
    walk: "迈步走动",
    run: "撒欢奔跑",
    sit: "坐姿晃脚",
    spin: "摇头卖萌",
    lift: "拎起晃悠",
    fall: "空中下落",
    land: "落地缓冲",
    trip: "平地摔跤",
    crawl: "匍匐爬行",
    climb: "攀爬抓墙",
    carry: "搬物行走",
    pull: "拔起互动",
    divide: "分身搞怪",
    poke_sprawl: "趴卧小憩",
    poke_play: "开心玩耍",
    cat_sit: "坐姿舔毛",
    cat_walk: "迈步散步",
    cat_stretch: "伸个懒腰",
    "cat_lifted up": "拎起挣扎",
    cat_draw: "提笔画画",
    cat_write: "书写公文"
  };

  // 从 Shimeji 包内的 conf/actions.xml 解析真实的 <Action Name="..."> 帧号序列
  function parseShimejiActionsXml(xmlText) {
    var out = {};
    if (!xmlText) return out;
    var actionRe = /<Action\s+([^>]+)>([\s\S]*?)<\/Action>/g;
    var m;
    while ((m = actionRe.exec(xmlText)) !== null) {
      var nameM = m[1].match(/Name="([^"]+)"/i);
      if (!nameM) continue;
      var actName = nameM[1];
      var seq = [];
      var imgRe = /Image="[^"]*?shime(\d+)\.png"/gi;
      var im;
      while ((im = imgRe.exec(m[2])) !== null) {
        var num = parseInt(im[1], 10);
        if (num && seq[seq.length - 1] !== num) seq.push(num);
      }
      if (seq.length) out[actName] = seq;
    }
    return out;
  }

  async function importShimejiZip(ctx, shimeEntries, report) {
    var imp = getImporters();
    // 忽略 unused 目录，建立帧号 -> 路径映射
    var byNum = {};
    shimeEntries.forEach(function (item) {
      if (!byNum[item.num]) byNum[item.num] = item.path;
    });

    // 优先读取压缩包自带的 actions.xml（如 guangling_package_v1 中的自定义帧表：Walk=3,47,2,47、Run=48,49 等）
    var xmlActions = {};
    var xmlPath = ctx.pathList.find(function (p) { return /(?:^|\/)actions\.xml$/i.test(p); });
    if (xmlPath && ctx.entryMap[xmlPath]) {
      try {
        var xmlText = await ctx.entryMap[xmlPath].async("string");
        xmlActions = parseShimejiActionsXml(xmlText);
      } catch (_) {}
    }

    var pickXml = function (names, fallback) {
      for (var i = 0; i < names.length; i++) {
        if (xmlActions[names[i]] && xmlActions[names[i]].length) return xmlActions[names[i]];
      }
      return fallback;
    };

    // 严格遵循 Shimeji-ee 帧语义：shime4 是 Falling（下落），绝不混入 walk！
    var SHIMEJI_PRESETS = {
      idle:   pickXml(["Look", "Stand"], [1]),
      walk:   pickXml(["Walk", "Dash"], [1, 2, 1, 3]),
      run:    pickXml(["Run"], []),
      sit:    pickXml(["SitAndDangleLegs", "SitAndLookAtMouse", "Sit"], [31, 32, 31, 33]),
      spin:   pickXml(["SitAndSpinHeadAction"], []),
      lift:   pickXml(["Pinched", "Resisting"], [9, 7, 5, 1, 6, 8, 10]),
      fall:   pickXml(["Falling"], [4]),
      land:   pickXml(["Bouncing"], [18, 19]),
      trip:   pickXml(["Tripping"], [19, 18, 20, 19]),
      crawl:  pickXml(["Creep"], [20, 21]),
      climb:  pickXml(["ClimbWall"], [14, 12, 13]),
      carry:  pickXml(["WalkWithIe"], [34, 35, 34, 36]),
      pull:   pickXml(["PullUpShimeji1"], []),
      divide: pickXml(["Divide1"], [])
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
    var sizeByNum = {};
    for (var i = 0; i < uniqueNums.length; i++) {
      var n = uniqueNums[i];
      if (i === 0 || i % 4 === 0 || i === uniqueNums.length - 1) {
        report("正在导入 Shimeji 帧 (" + (i + 1) + "/" + uniqueNums.length + ")…");
      }
      var raw = await ctx.entryMap[byNum[n]].async("blob");
      sizeByNum[n] = raw ? raw.size : n;
      compressedByNum[n] = await compressFrameBlob(raw, 320);
    }

    var actions = {};
    var allowSingle = { idle: 1, fall: 1, land: 1 };
    Object.keys(SHIMEJI_PRESETS).forEach(function (act) {
      var rawSeq = SHIMEJI_PRESETS[act];
      if (!rawSeq || !rawSeq.length) return;
      var seq = [];
      var lastSize = -1;
      rawSeq.forEach(function (n) {
        if (compressedByNum[n]) {
          if (sizeByNum[n] !== lastSize || seq.length === 0) {
            seq.push(compressedByNum[n]);
            lastSize = sizeByNum[n];
          }
        }
      });
      if (seq.length >= 2 || (allowSingle[act] && seq.length >= 1)) {
        actions[act] = seq;
      }
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
    var fallFolder = "";
    var landFolder = "";
    var sitFolder = "";
    var pokeFolders = [];

    var curFolder = "";
    var curStateClip = "idle";
    var isShimejiPack = false;
    var playOnceCurrent = false;
    var customLockUntilTs = 0;
    var frameIdx = 0;
    var fps = 10;
    var turnDeg = 0;
    var dragVx = 0;
    var swingAngle = 0;
    var gifMode = "idle";
    var cssW = 156;
    var cssH = 198;
    var dpr = 1;
    var paused = false;
    var rafId = 0;
    var lastFrameTs = 0;
    var lastDrawTs = 0;

    function revokeAll() {
      for (var i = 0; i < blobUrls.length; i++) {
        try { URL.revokeObjectURL(blobUrls[i]); } catch (_) {}
      }
      blobUrls = [];
    }

    var measureCanvas = null;
    var measureCtx = null;

    function computeOpaqueBBox(im) {
      var w = im.naturalWidth || 1;
      var h = im.naturalHeight || 1;
      var fallback = { left: 0, top: 0, right: w, bottom: h, bw: w, bh: h, ax: w * 0.5, ay: h };
      try {
        if (!measureCanvas) {
          measureCanvas = global.document.createElement("canvas");
          measureCtx = measureCanvas.getContext("2d", { willReadFrequently: true });
        }
        // 降采样到最长边 <= 160px 极速测算非透明包围盒（类似 PIL img.getbbox()）
        var scale = Math.min(1, 160 / Math.max(w, h));
        var sw = Math.max(1, Math.round(w * scale));
        var sh = Math.max(1, Math.round(h * scale));
        measureCanvas.width = sw;
        measureCanvas.height = sh;
        measureCtx.clearRect(0, 0, sw, sh);
        measureCtx.drawImage(im, 0, 0, sw, sh);
        var data = measureCtx.getImageData(0, 0, sw, sh).data;
        var minX = sw, minY = sh, maxX = -1, maxY = -1;
        for (var y = 0; y < sh; y++) {
          var rowOff = y * sw * 4;
          for (var x = 0; x < sw; x++) {
            if (data[rowOff + x * 4 + 3] > 20) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX < minX || maxY < minY) return fallback;
        var inv = 1 / scale;
        var left = minX * inv;
        var top = minY * inv;
        var right = (maxX + 1) * inv;
        var bottom = (maxY + 1) * inv;
        var bw = Math.max(1, right - left);
        var bh = Math.max(1, bottom - top);
        return {
          left: left,
          top: top,
          right: right,
          bottom: bottom,
          bw: bw,
          bh: bh,
          ax: (left + right) * 0.5,
          ay: bottom
        };
      } catch (_) {
        return fallback;
      }
    }

    function loadBlobImage(blob) {
      return new Promise(function (resolve) {
        var u = URL.createObjectURL(blob);
        blobUrls.push(u);
        var im = new Image();
        im.onload = function () {
          im.__bbox = computeOpaqueBBox(im);
          resolve(im);
        };
        im.onerror = function () { resolve(null); };
        im.src = u;
      });
    }

    var folderMetrics = {}; // folderName -> { refBw, refBh }

    function drawCurrentFrame(ts) {
      if (!canvas || !ctx) return;
      var list = loadedFrames[curFolder] || loadedFrames[idleFolder] || [];
      if (!list.length) return;
      var im = list[frameIdx % list.length];
      if (!im || !im.naturalWidth) return;

      var now = ts || performance.now();
      var targetAngle = 0;
      if (curStateClip === "lift") {
        targetAngle = Math.max(-0.42, Math.min(0.42, dragVx * 0.028)) + Math.sin(now * 0.0085) * 0.08;
      } else if (curStateClip === "fall") {
        targetAngle = Math.sin(now * 0.014) * 0.1;
      }
      swingAngle += (targetAngle - swingAngle) * 0.24;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      var bb = im.__bbox || { left: 0, top: 0, right: im.naturalWidth, bottom: im.naturalHeight, bw: im.naturalWidth, bh: im.naturalHeight, ax: im.naturalWidth * 0.5, ay: im.naturalHeight };
      var fm = folderMetrics[curFolder] || { refBw: bb.bw, refBh: bb.bh };
      // 按非透明有效身形高度/宽度统一缩放，彻底消除不同动作/不同图片留白导致的忽大忽小
      var s = Math.min((cssW * 0.88) / Math.max(1, fm.refBw), (cssH * 0.82) / Math.max(1, fm.refBh));
      var dw = im.naturalWidth * s;
      var dh = im.naturalHeight * s;
      var axScaled = bb.ax * s;
      var ayScaled = bb.ay * s;
      var topScaled = bb.top * s;

      // Shimeji 与《张飞-猫》原图均默认朝左（desktop_pet.py: left_img = canvas, right_img = FLIP_LEFT_RIGHT）
      var shouldFlipX = turnDeg > 2;
      if (curStateClip === "lift") {
        // 拎起时以头顶/后颈锚点 (ax, top) 为摆动支点，自然垂挂
        ctx.translate(cssW * 0.5, cssH * 0.14);
        ctx.rotate(swingAngle);
        if (shouldFlipX) ctx.scale(-1, 1);
        ctx.drawImage(im, -axScaled, -topScaled, dw, dh);
      } else {
        // 复刻 desktop_pet.py 脚底锚点对齐：每帧脚底 (ax, bottom) 牢牢钉在统一地面基准线上，零抖动！
        ctx.translate(cssW * 0.5, cssH * 0.92);
        if (Math.abs(swingAngle) > 0.003) ctx.rotate(swingAngle);
        if (shouldFlipX) ctx.scale(-1, 1);
        ctx.drawImage(im, -axScaled, -ayScaled, dw, dh);
      }
      ctx.restore();
    }

    function applyGifTransform(ts) {
      if (!imgEl) return;
      var now = ts || performance.now();
      var flip = turnDeg > 2 ? -1 : 1;
      var rotDeg = 0;
      var ty = 0;
      if (curStateClip === "lift") {
        var tgt = Math.max(-24, Math.min(24, dragVx * 1.6)) + Math.sin(now * 0.0085) * 5.5;
        swingAngle += (tgt - swingAngle) * 0.22;
        rotDeg = swingAngle;
        imgEl.style.transformOrigin = "50% 16%";
      } else if (curStateClip === "walk" || gifMode === "walk") {
        swingAngle *= 0.8;
        ty = -Math.abs(Math.sin(now * 0.013)) * 5.5;
        rotDeg = Math.sin(now * 0.013) * 2.5;
        imgEl.style.transformOrigin = "50% 90%";
      } else if (gifMode === "hop") {
        swingAngle *= 0.8;
        ty = -Math.abs(Math.sin(now * 0.016)) * 12;
        imgEl.style.transformOrigin = "50% 90%";
      } else {
        swingAngle *= 0.8;
        rotDeg = swingAngle;
        imgEl.style.transformOrigin = "50% 90%";
      }
      imgEl.style.transform = "translateY(" + ty.toFixed(1) + "px) rotate(" + rotDeg.toFixed(1) + "deg) scaleX(" + flip + ")";
    }

    function tick(ts) {
      rafId = 0;
      if (paused) return;
      if (isAnimImg) {
        if (imgEl && ts - lastDrawTs >= 24) {
          lastDrawTs = ts;
          applyGifTransform(ts);
        }
        rafId = global.requestAnimationFrame(tick);
        return;
      }
      if (!canvas) return;
      var interval = 1000 / Math.max(4, fps);
      var advanced = false;
      if (ts - lastFrameTs >= interval) {
        lastFrameTs = ts;
        var list = loadedFrames[curFolder] || [];
        if (list.length > 0) {
          if (playOnceCurrent) {
            if (frameIdx < list.length - 1) {
              frameIdx++;
              advanced = true;
            }
          } else {
            frameIdx = (frameIdx + 1) % list.length;
            advanced = true;
          }
        }
      }
      // 拎起摆动/漫步颠簸时 40fps 平滑补间旋转与起伏
      var needSmooth = curStateClip === "lift" || curStateClip === "fall" || curStateClip === "walk" || Math.abs(swingAngle) > 0.005;
      if (advanced || (needSmooth && ts - lastDrawTs >= 24)) {
        lastDrawTs = ts;
        drawCurrentFrame(ts);
      }
      rafId = global.requestAnimationFrame(tick);
    }

    function startLoop() {
      if (!rafId && !paused && (canvas || imgEl)) {
        lastFrameTs = 0;
        lastDrawTs = 0;
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
          imgEl.style.cssText = "display:block;width:100%;height:100%;object-fit:contain;pointer-events:none;will-change:transform;";
          containerEl.appendChild(imgEl);
          paused = false;
          startLoop();
          return;
        }

        isAnimImg = false;
        isShimejiPack = Boolean(petRecord && petRecord.meta && petRecord.meta.isShimeji);
        // 与《张飞-猫》desktop_pet.py 同步：约 155~160ms/帧（6.5fps）悠闲迈步，不再过快
        fps = isShimejiPack ? 7 : 6.5;
        var rawActions = filesInfo.actions || {};
        actionNames = Object.keys(rawActions);
        if (!actionNames.length) throw new Error("未找到任何序列帧动作");

        for (var i = 0; i < actionNames.length; i++) {
          var name = actionNames[i];
          var blobs = Array.isArray(rawActions[name]) ? rawActions[name] : [];
          var imgs = [];
          var lastBlobSize = -1;
          for (var j = 0; j < blobs.length; j++) {
            var b = blobs[j];
            var bSize = b && b.size ? b.size : j;
            var im = await loadBlobImage(b);
            if (im) {
              // 避免连续相同字节的重复静态帧卡顿
              if (bSize !== lastBlobSize || imgs.length === 0) {
                imgs.push(im);
                lastBlobSize = bSize;
              }
            }
          }
          if (imgs.length) loadedFrames[name] = imgs;
        }

        // 若旧存档中某个非基础静态动作（如旧版 poke_sprawl）去重后只剩 1 帧，自动补入有效动态帧；idle/fall/land 保留原样
        var fallbackPool = loadedFrames.poke_play || loadedFrames.lift || loadedFrames.walk || [];
        Object.keys(loadedFrames).forEach(function (k) {
          if (k === "idle" || k === "fall" || k === "land") return;
          if (loadedFrames[k].length === 1 && fallbackPool.length > 1) {
            loadedFrames[k] = loadedFrames[k].concat(fallbackPool.slice(0, 4));
          }
        });

        actionNames = Object.keys(loadedFrames);
        idleFolder = pickFolderByRegex(actionNames, /idle|sit|stand|wait|default|待机|坐/i) || actionNames[0];
        sitFolder = pickFolderByRegex(actionNames, /sit|sleep|rest|坐|睡/i) || idleFolder;
        walkFolder = pickFolderByRegex(actionNames, /walk|run|move|走|跑/i) || idleFolder;
        liftFolder = pickFolderByRegex(actionNames, /lift|drag|grab|carry|held|拎|提|抓/i) || idleFolder;
        fallFolder = pickFolderByRegex(actionNames, /^fall$|drop|jump|落|跳/i) || liftFolder;
        landFolder = pickFolderByRegex(actionNames, /^land$|crouch|bounce|sprawl|落/i) || sitFolder;

        // 复刻《张飞-猫》desktop_pet.py 机制：若拎起文件夹含 >=14 帧（如 cat_lifted up 共 17 帧 001~017），
        // 自动将中间 003~013 帧拆为「空中挣扎循环」，将末尾 014~017 帧拆为「单次落地过渡动作」！
        if (!isShimejiPack && liftFolder && loadedFrames[liftFolder] && loadedFrames[liftFolder].length >= 14 && !loadedFrames.__auto_land__) {
          var fullLift = loadedFrames[liftFolder];
          loadedFrames.__auto_lift_loop__ = fullLift.slice(2, fullLift.length - 4);
          loadedFrames.__auto_land__ = fullLift.slice(fullLift.length - 4);
          liftFolder = "__auto_lift_loop__";
          fallFolder = "__auto_lift_loop__";
          landFolder = "__auto_land__";
        }

        // 计算每个动作组的非透明身形包围盒基准（maxBw / maxBh），保证同组动作内部零缩放跳变、跨组动作身形高度一致
        folderMetrics = {};
        Object.keys(loadedFrames).forEach(function (fname) {
          var arr = loadedFrames[fname] || [];
          var maxBw = 1, maxBh = 1;
          for (var k = 0; k < arr.length; k++) {
            var b = arr[k] && arr[k].__bbox;
            if (b) {
              if (b.bw > maxBw) maxBw = b.bw;
              if (b.bh > maxBh) maxBh = b.bh;
            }
          }
          folderMetrics[fname] = { refBw: maxBw, refBh: maxBh };
        });

        pokeFolders = actionNames.filter(function (n) {
          return n !== idleFolder && n !== walkFolder && n !== liftFolder && !/^__auto_/.test(n);
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
        var clip = clipName || "idle";
        // 若用户刚手动点播了某个特定动作（除拖拽拎起/下落/落地外），锁定期间不被自动漫步/待机打断
        if (clip !== "lift" && clip !== "fall" && clip !== "land" && Date.now() < customLockUntilTs) return;
        curStateClip = clip;
        if (isAnimImg) {
          if (clip === "walk") gifMode = "walk";
          else if (clip === "idle" || clip === "sit" || clip === "land") gifMode = "idle";
          return;
        }
        var next = idleFolder;
        playOnceCurrent = false;
        if (clip === "walk") next = walkFolder;
        else if (clip === "lift") next = liftFolder;
        else if (clip === "fall") next = fallFolder;
        else if (clip === "land") { next = landFolder; playOnceCurrent = true; }
        else if (clip === "sit") next = sitFolder;
        else if (clip === "wave" || clip === "happy" || clip === "shy") {
          next = pokeFolders[Math.floor(Math.random() * pokeFolders.length)] || idleFolder;
        }
        if (next !== curFolder || playOnceCurrent) {
          curFolder = next;
          frameIdx = 0;
          lastFrameTs = 0;
          drawCurrentFrame();
        }
      },
      listCustomActions: function () {
        if (isAnimImg) {
          return [
            { key: "gif:walk", label: "来回散步" },
            { key: "gif:hop", label: "开心蹦跳" },
            { key: "gif:idle", label: "原地待机" }
          ];
        }
        return actionNames
          .filter(function (n) { return n !== "fall" && n !== "land" && !/^__auto_/.test(n); })
          .map(function (n) {
            return { key: "frame:" + n, label: SHIMEJI_ACTION_LABELS[n] || n };
          });
      },
      playCustomAction: function (key) {
        if (!key) return;
        var k = String(key);
        if (isAnimImg) {
          var gm = k.replace(/^gif:/, "");
          gifMode = gm;
          curStateClip = gm === "walk" ? "walk" : "idle";
          customLockUntilTs = gm === "idle" ? 0 : Date.now() + 9500;
          return;
        }
        var target = k.replace(/^frame:/, "");
        if (loadedFrames[target]) {
          playOnceCurrent = false;
          customLockUntilTs = target === idleFolder ? 0 : Date.now() + 9500;
          // 若点击的是 cat_lifted up 且已拆出中间挣扎循环，播放挣扎循环更自然
          curFolder = (/lift|held/i.test(target) && loadedFrames.__auto_lift_loop__) ? "__auto_lift_loop__" : target;
          curStateClip = /walk|run|move|crawl|carry/i.test(target) ? "walk" : (/lift|held/i.test(target) ? "lift" : target);
          frameIdx = 0;
          lastFrameTs = 0;
          drawCurrentFrame();
        }
      },
      setTurnDeg: function (deg) {
        turnDeg = Number(deg) || 0;
      },
      setDragVelocity: function (vx) {
        dragVx = Number(vx) || 0;
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

