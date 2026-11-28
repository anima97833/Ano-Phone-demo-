/**
 * Milvus/pet_adapter_glb.js
 * 主屏幕桌宠 3D 模型（Nomad Sculpt .glb / 带骨骼 .glb）插件适配器（严格零 AI · 零预载开销）
 *
 * 核心特性：
 * 1. 按需懒加载 Three.js r147 UMD + GLTFLoader（本地 ./vendor/ 优先 → jsDelivr → unpkg 双镜像）
 * 2. 直接通过 loader.parse(ArrayBuffer) 纯本地解析，100% 兼容离线 IndexedDB 与 file:// 协议
 * 3. 三点柔光摄影棚打光 + sRGB 色管，完美还原 Nomad 顶点色与 PBR 材质（潮玩盲盒手办质感）
 * 4. 自带骨骼动画自动播放；静态 Nomad 雕塑自动赋予 3D 呼吸微浮、轻戳 Q 弹转圈与拎起惯性摆动
 * 5. destroy() 彻底遍历释放 Geometry / Material / Texture 并主动 loseContext 防显存泄漏
 */
(function (global) {
  "use strict";

  var THREE_URLS = [
    "./vendor/three.min.js",
    "https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js",
    "https://unpkg.com/three@0.147.0/build/three.min.js"
  ];
  var GLTF_URLS = [
    "./vendor/GLTFLoader.js",
    "https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/loaders/GLTFLoader.js",
    "https://unpkg.com/three@0.147.0/examples/js/loaders/GLTFLoader.js"
  ];
  var VRM_URLS = [
    "./vendor/three-vrm.min.js",
    "https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@1.0.9/lib/three-vrm.min.js",
    "https://unpkg.com/@pixiv/three-vrm@1.0.9/lib/three-vrm.min.js"
  ];

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

  async function loadFirstWorking(urls, checkFn, label) {
    if (checkFn()) return;
    var lastErr = null;
    for (var i = 0; i < urls.length; i++) {
      try {
        await loadScriptOnce(urls[i]);
        if (checkFn()) return;
      } catch (e) {
        lastErr = e;
      }
    }
    throw new Error(label + " 加载失败：" + (lastErr && lastErr.message || "请检查网络"));
  }

  // 纯内存解码 glTF/VRM 内嵌 bufferView 贴图（彻底弃用 URL.createObjectURL("blob:null/...")，100% 兼容 file:// 协议，并将 2048px 超大贴图自动降采样至 <=512px 使显存从 350MB 降至 22MB）
  function decodeBufferViewToTexture(THREE, bufferView, mimeType) {
    var mime = mimeType || "image/png";
    var blob = new Blob([bufferView], { type: mime });
    var maxSide = 512;

    function sourceToCanvasTexture(imgSource, w, h) {
      var ratio = (w > maxSide || h > maxSide) ? Math.min(maxSide / w, maxSide / h) : 1;
      var cw = Math.max(2, Math.round(w * ratio));
      var ch = Math.max(2, Math.round(h * ratio));
      var cv = global.document.createElement("canvas");
      cv.width = cw;
      cv.height = ch;
      var ctx = cv.getContext("2d");
      ctx.drawImage(imgSource, 0, 0, cw, ch);
      if (imgSource && typeof imgSource.close === "function") {
        try { imgSource.close(); } catch (_) {}
      }
      var tex = new THREE.CanvasTexture(cv);
      tex.flipY = false;
      tex.needsUpdate = true;
      tex.userData = { mimeType: mime };
      return tex;
    }

    function decodeViaDataUrl() {
      return new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onerror = function () {
          var fallback = new THREE.Texture();
          fallback.userData = { mimeType: mime };
          resolve(fallback);
        };
        reader.onload = function () {
          var img = new Image();
          img.onload = function () {
            resolve(sourceToCanvasTexture(img, img.naturalWidth || img.width || 256, img.naturalHeight || img.height || 256));
          };
          img.onerror = function () {
            var fallback = new THREE.Texture();
            fallback.userData = { mimeType: mime };
            resolve(fallback);
          };
          img.src = String(reader.result || "");
        };
        reader.readAsDataURL(blob);
      });
    }

    if (typeof global.createImageBitmap === "function") {
      return global.createImageBitmap(blob).then(function (bmp) {
        return sourceToCanvasTexture(bmp, bmp.width || 256, bmp.height || 256);
      }, function () {
        return decodeViaDataUrl();
      });
    }
    return decodeViaDataUrl();
  }

  async function ensureThreeRuntime(needVrm) {
    await loadFirstWorking(THREE_URLS, function () { return Boolean(global.THREE); }, "Three.js");
    await loadFirstWorking(GLTF_URLS, function () { return Boolean(global.THREE && global.THREE.GLTFLoader); }, "GLTFLoader");
    if (needVrm) {
      await loadFirstWorking(VRM_URLS, function () { return Boolean(global.THREE_VRM && global.THREE_VRM.VRMLoaderPlugin); }, "THREE_VRM");
    }
    return global.THREE;
  }

  // ==================== 1. Direct .glb / .vrm File Importer ====================

  async function importGlbFile(file, onProgress) {
    var report = typeof onProgress === "function" ? onProgress : function () {};
    if (!file) throw new Error("未选择 .glb / .vrm 文件");
    var isVrm = /\.vrm$/i.test(file.name || "");
    var sizeMB = Math.round((file.size / (1024 * 1024)) * 10) / 10;
    if (sizeMB > 20) {
      report("检测到高模（" + sizeMB + "MB），正在写入本地库…（桌面端可直接预览，手机端建议轻量化导出）");
    } else {
      report("正在导入 " + (isVrm ? "VRM 3D 人形模型" : "3D 模型") + "（" + sizeMB + "MB）…");
    }

    var baseName = String(file.name || (isVrm ? "VRM桌宠" : "3D手办")).replace(/\.(glb|vrm)$/i, "");
    var store = global.HomeDollPetStore;
    if (!store || typeof store.savePet !== "function") throw new Error("未检测到桌宠存储模块");

    return await store.savePet({
      id: (isVrm ? "pet_vrm_" : "pet_glb_") + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      type: "glb",
      name: baseName.slice(0, 20),
      sub: (isVrm ? "VRM 3D模型 · " : "3D 手办 · ") + sizeMB + "MB",
      thumb: "",
      files: { glbBlob: file, isVrm: isVrm },
      meta: { sizeMB: sizeMB, isVrm: isVrm },
      createdAt: Date.now()
    });
  }

  // ==================== 1.5. Independent VRMA Motion Store (milvus_vrm_motions_idb) ====================

  var VRMA_DB = "milvus_vrm_motions_idb";
  var VRMA_STORE = "motions";
  var vrmaDbPromise = null;

  function openVrmaDB() {
    if (vrmaDbPromise) return vrmaDbPromise;
    vrmaDbPromise = new Promise(function (resolve, reject) {
      if (typeof indexedDB === "undefined") { reject(new Error("不支持 IndexedDB")); return; }
      var req = indexedDB.open(VRMA_DB, 1);
      req.onupgradeneeded = function (ev) {
        var db = ev.target.result;
        if (!db.objectStoreNames.contains(VRMA_STORE)) db.createObjectStore(VRMA_STORE, { keyPath: "id" });
      };
      req.onsuccess = function (ev) { resolve(ev.target.result); };
      req.onerror = function (ev) { vrmaDbPromise = null; reject(ev.target.error); };
    });
    return vrmaDbPromise;
  }

  async function saveVrmaMotion(file) {
    if (!file) throw new Error("未选择 .vrma 动作文件");
    var db = await openVrmaDB();
    var rec = {
      id: "vrma_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      name: String(file.name || "VRM动作").replace(/\.vrma$/i, "").slice(0, 20),
      blob: file,
      createdAt: Date.now()
    };
    await new Promise(function (resolve, reject) {
      var tx = db.transaction(VRMA_STORE, "readwrite");
      tx.objectStore(VRMA_STORE).put(rec);
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = function (ev) { reject(ev.target.error); };
    });
    if (global.HomeDollPetStore && typeof global.HomeDollPetStore.emitPetUpdated === "function") {
      global.HomeDollPetStore.emitPetUpdated({ reason: "vrma_added", id: rec.id });
    }
    return rec;
  }

  async function listVrmaMotions() {
    try {
      var db = await openVrmaDB();
      return await new Promise(function (resolve) {
        var tx = db.transaction(VRMA_STORE, "readonly");
        var req = tx.objectStore(VRMA_STORE).getAll();
        req.onsuccess = function () { resolve(Array.isArray(req.result) ? req.result : []); };
        req.onerror = function () { resolve([]); };
      });
    } catch (_) {
      return [];
    }
  }

  var EXPR_LABELS = {
    neutral: "复原表情", happy: "开心", angry: "生气", sad: "难过",
    relaxed: "放松", surprised: "惊讶", blink: "眨眼", blinkLeft: "左眨眼", blinkRight: "右眨眼"
  };

  // 从 GLB 二进制头部自动探测是否含 VRM / VRMC_vrm 扩展（兼容早期未标记 isVrm 的本地存档）
  function detectIsVrmFromArrayBuffer(arrayBuf) {
    try {
      if (!arrayBuf || arrayBuf.byteLength < 28) return false;
      var dv = new DataView(arrayBuf);
      if (dv.getUint32(0, true) !== 0x46546C67) return false; // 'glTF'
      var jsonLen = dv.getUint32(12, true);
      if (20 + jsonLen > arrayBuf.byteLength) return false;
      var jsonBytes = new Uint8Array(arrayBuf, 20, Math.min(jsonLen, 512 * 1024));
      var jsonStr = new TextDecoder("utf-8").decode(jsonBytes);
      return jsonStr.indexOf('"VRM"') >= 0 || jsonStr.indexOf('"VRMC_vrm"') >= 0;
    } catch (_) {
      return false;
    }
  }

  // SullyOS 同款 VRM 演出预设（融合情绪 + 手势骨骼 + 微表情 + 原生 MorphTarget 兜底 + 镜头推拉）
  var SULLY_VRM_PERFORMANCES = [
    { key: "perf:wave",      label: "挥手问好", emotion: "happy",     gesture: "wave",      faces: ["smile-eyes", "grin"], camera: "medium" },
    { key: "perf:happy",     label: "开心欢呼", emotion: "happy",     gesture: "nod",       faces: ["grin", "smile-eyes"], camera: "push-in" },
    { key: "perf:wink",      label: "俏皮眨眼", emotion: "happy",     gesture: "tilt",      faces: ["wink", "grin"],       camera: "push-in" },
    { key: "perf:angry",     label: "生气摇头", emotion: "angry",     gesture: "shake",     faces: ["brow-angry", "pout"], camera: "close" },
    { key: "perf:sad",       label: "委屈低头", emotion: "sad",       gesture: "shy",       faces: ["brow-sad"],           camera: "pull-out" },
    { key: "perf:surprised", label: "惊讶凑近", emotion: "surprised", gesture: "lean-in",   faces: ["brow-up"],            camera: "push-in" },
    { key: "perf:explain",   label: "比划交谈", emotion: "happy",     gesture: "explain",   faces: ["grin"],               camera: "medium", speaking: true },
    { key: "perf:tehe",      label: "吐舌卖萌", emotion: "relaxed",   gesture: "tilt",      faces: ["wink", "tehe"],       camera: "push-in" },
    { key: "perf:sit",       label: "坐姿晃脚", emotion: "calm",      gesture: "sit",       faces: [],                     camera: "medium" },
    { key: "perf:idle",      label: "自然待机", emotion: "calm",      gesture: "idle",      faces: [],                     camera: "medium" }
  ];

  // ==================== 2. 3D GLB / VRM PetAdapter Implementation ====================

  function createGlbPetAdapter() {
    var renderer = null;
    var scene = null;
    var camera = null;
    var pivot = null;
    var mixer = null;
    var clipActions = [];
    var currentVrm = null; // @pixiv/three-vrm VRM 实例
    var vrmExpressions = [];
    var morphMeshes = [];  // [{ mesh, names: string[] }] 供 VRM 空 preset（如 Angry/Sorrow binds:[]）直接驱动底层 VRoid MorphTarget
    var activePerf = null; // 当前 SullyOS 演出指令
    var activePerfStartSec = 0;
    var activePerfUntilSec = 0;
    var activeCustomExpr = "";
    var customExprUntilSec = 0;
    var vrmaMotionList = [];
    var activeVrmaAction = null;
    var activeVrmaUntilSec = 0;
    var nextBlinkSec = 1.8;
    var curClip = "idle";
    var pokeStartSec = -10;
    var turnDeg = 0;
    var dragVx = 0;
    var cssW = 156;
    var cssH = 198;
    var paused = false;
    var rafId = 0;
    var lastTs = 0;

    // SullyOS setBone: 用 YXZ 欧拉角转四元数并 slerp 平滑驱动 VRM 归一化骨骼
    function setVrmBone(THREE, vrm, boneName, x, y, z, alpha) {
      if (!vrm || !vrm.humanoid || !vrm.humanoid.getNormalizedBoneNode) return;
      var node = vrm.humanoid.getNormalizedBoneNode(boneName);
      if (!node) return;
      var targetQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, "YXZ"));
      node.quaternion.slerp(targetQ, Math.max(0.05, Math.min(1, alpha)));
    }

    // 针对部分 VRM 模型（如秦彻Q版）blendShapeGroups 中 Angry/Sorrow 未绑 binds 但底层 mesh 含 72 个 VRoid morphTarget 的自动驱动
    function applyDirectMorphTargets(activeKey, weight) {
      if (!morphMeshes.length) return;
      var rules = {
        happy:     [/笑い|にこり|口角上げ|にやり|happy|joy|smile/i],
        angry:     [/怒り|つり目|じと目|ｷﾘｯ|angry|anger/i],
        sad:       [/悲しい|困る|はぅ|sad|sorrow/i],
        surprised: [/驚き|びっくり|瞳小|surprised|shock/i],
        wink:      [/ウィンク２右|ウィンク右|wink/i],
        tehe:      [/ぺろっ|てへぺろ|ω|なごみ/i],
        blink:     [/0\.まばたき|^まばたき$|blink/i]
      };
      morphMeshes.forEach(function (entry) {
        var inf = entry.mesh.morphTargetInfluences;
        if (!inf) return;
        // 先衰减之前我们直驱过的通道
        if (!entry.drivenIndices) entry.drivenIndices = {};
        Object.keys(entry.drivenIndices).forEach(function (idxStr) {
          var idx = Number(idxStr);
          inf[idx] = inf[idx] * 0.72;
          if (inf[idx] < 0.01) { inf[idx] = 0; delete entry.drivenIndices[idxStr]; }
        });
        if (!activeKey || weight <= 0.01) return;
        var pats = rules[activeKey] || [];
        entry.names.forEach(function (nm, idx) {
          if (idx >= inf.length) return;
          for (var pi = 0; pi < pats.length; pi++) {
            if (pats[pi].test(nm)) {
              inf[idx] = Math.max(inf[idx] || 0, weight);
              entry.drivenIndices[idx] = 1;
              break;
            }
          }
        });
      });
    }

    function disposeScene(obj) {
      if (!obj) return;
      obj.traverse(function (node) {
        if (node.geometry && typeof node.geometry.dispose === "function") {
          node.geometry.dispose();
        }
        if (node.material) {
          var mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach(function (m) {
            if (!m) return;
            ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap"].forEach(function (k) {
              if (m[k] && typeof m[k].dispose === "function") m[k].dispose();
            });
            if (typeof m.dispose === "function") m.dispose();
          });
        }
      });
    }

    function renderLoop(ts) {
      rafId = 0;
      if (paused || !renderer || !scene || !camera) return;

      var isLowPower = curClip === "idle" && Math.abs(dragVx) < 0.2;
      var minInterval = isLowPower ? 33 : 16;
      if (ts - lastTs >= minInterval) {
        var dt = lastTs ? Math.min(0.08, (ts - lastTs) * 0.001) : 0.016;
        lastTs = ts;
        var tSec = ts * 0.001;

        if (mixer) mixer.update(dt);

        // @pixiv/three-vrm SullyOS 同款归一化人形骨骼 + 情绪/微表情/口型驱动
        var playingVrma = Boolean(activeVrmaAction && tSec < activeVrmaUntilSec);
        if (activeVrmaAction && !playingVrma) {
          try { activeVrmaAction.stop(); } catch (_) {}
          activeVrmaAction = null;
        }
        if (activePerf && tSec >= activePerfUntilSec) {
          activePerf = null;
        }
        var THREE = global.THREE;
        if (currentVrm && currentVrm.humanoid && THREE) {
          var blend = 1 - Math.exp(-dt * 8.5);
          var br = Math.sin(tSec * 2.2);
          var perf = activePerf;
          var gesture = perf ? perf.gesture : (curClip === "wave" || curClip === "happy" ? "wave" : curClip === "shy" ? "shy" : curClip);
          var emotion = perf ? perf.emotion : (curClip === "wave" || curClip === "happy" ? "happy" : "calm");
          var faces = (perf && perf.faces) || [];
          var speaking = Boolean(perf && perf.speaking);
          var localT = perf ? Math.max(0, tSec - activePerfStartSec) : tSec;

          if (!playingVrma) {
            var headX = 0, headY = Math.sin(tSec * 0.85) * 0.08, headZ = Math.sin(tSec * 1.1) * 0.05;
            var bodyX = br * 0.03, bodyY = 0, bodyZ = 0;
            // SullyOS VRM 归一化坐标系：leftUpperArm Z = +1.08 为自然垂手，rightUpperArm Z = -1.08 为自然垂手！
            var leftLift = 0, rightLift = 0;
            var leftArmX = 0.04, rightArmX = 0.04;
            var leftLowerX = -0.08, rightLowerX = -0.08;
            var leftLowerZ = -0.06, rightLowerZ = 0.06;
            var lLegX = 0, rLegX = 0, lKneeX = 0, rKneeX = 0;
            var eyeX = 0, eyeY = 0;

            if (gesture === "wave") {
              rightLift = 0.88;
              rightArmX = -0.18;
              rightLowerX = -0.28;
              rightLowerZ = 0.92 + Math.sin(localT * 8.5) * 0.26;
              leftLift = 0.12 + Math.sin(localT * 4.2) * 0.06;
              headZ = -0.14;
              headY = 0.10;
              bodyZ = -0.08;
            } else if (gesture === "nod") {
              var beat = Math.sin(localT * 8.4);
              headX = beat * 0.26;
              bodyX = beat * 0.14;
              leftLift = 0.52 + Math.abs(beat) * 0.25;
              rightLift = 0.52 + Math.abs(beat) * 0.25;
              leftLowerX = -0.45; rightLowerX = -0.45;
              leftLowerZ = -0.55; rightLowerZ = 0.55;
            } else if (gesture === "shake") {
              var sweep = Math.sin(localT * 7.5);
              headY = sweep * 0.36;
              headZ = -sweep * 0.08;
              bodyY = sweep * 0.18;
              // 双手叉腰生气姿态
              leftLift = 0.42; rightLift = 0.42;
              leftLowerX = -0.35; rightLowerX = -0.35;
              leftLowerZ = -0.82; rightLowerZ = 0.82;
            } else if (gesture === "shy") {
              headX = 0.26;
              headZ = -0.16 + Math.sin(localT * 2.5) * 0.06;
              bodyX = 0.12;
              eyeY = -0.35;
              leftLift = 0.36; rightLift = 0.36;
              leftLowerX = -0.34; rightLowerX = -0.34;
              leftLowerZ = -0.78; rightLowerZ = 0.78;
            } else if (gesture === "tilt") {
              headZ = -0.28;
              headY = 0.14;
              bodyZ = -0.14;
              rightLift = 0.62;
              rightLowerX = -0.42;
              rightLowerZ = 0.72;
            } else if (gesture === "lean-in") {
              headX = -0.16;
              bodyX = 0.22;
              leftLift = 0.48; rightLift = 0.48;
              leftLowerX = -0.38; rightLowerX = -0.38;
              leftLowerZ = -0.45; rightLowerZ = 0.45;
            } else if (gesture === "explain") {
              var sw = Math.sin(localT * 3.6);
              var acc = (Math.sin(localT * 9.2) + 1) * 0.5;
              headY = sw * 0.18;
              headZ = -sw * 0.10;
              bodyY = sw * 0.16;
              leftLift = 0.28 + acc * 0.24;
              rightLift = 0.34 + acc * 0.28;
              leftLowerX = -0.28 - acc * 0.12;
              rightLowerX = -0.26 - acc * 0.12;
              leftLowerZ = -0.46;
              rightLowerZ = 0.54;
            } else if (gesture === "walk") {
              var st = Math.sin(tSec * 6.5);
              leftArmX = st * 0.42; rightArmX = -st * 0.42;
              leftLift = 0.12; rightLift = 0.12;
              lLegX = -st * 0.48; rLegX = st * 0.48;
            } else if (gesture === "sit") {
              lLegX = -1.25 + Math.sin(tSec * 3.8) * 0.14;
              rLegX = -1.25 - Math.sin(tSec * 3.8) * 0.14;
              lKneeX = 0.85; rKneeX = 0.85;
              leftLift = 0.15; rightLift = 0.15;
              headZ = Math.sin(tSec * 1.8) * 0.12;
            } else if (gesture === "lift") {
              leftLift = 0.78 + Math.sin(tSec * 8.0) * 0.18;
              rightLift = 0.78 - Math.sin(tSec * 8.0) * 0.18;
              lLegX = Math.sin(tSec * 8.5) * 0.32;
              rLegX = -Math.sin(tSec * 8.5) * 0.32;
            }

            setVrmBone(THREE, currentVrm, "head", headX, headY, headZ, blend);
            setVrmBone(THREE, currentVrm, "neck", headX * 0.28, headY * 0.25, headZ * 0.28, blend);
            setVrmBone(THREE, currentVrm, "chest", bodyX, bodyY, bodyZ, blend * 0.75);
            setVrmBone(THREE, currentVrm, "spine", bodyX * 0.5, bodyY * 0.4, bodyZ * 0.5, blend * 0.6);
            setVrmBone(THREE, currentVrm, "leftUpperArm", leftArmX + leftLift * 0.38, -0.06, 1.08 - leftLift, blend);
            setVrmBone(THREE, currentVrm, "rightUpperArm", rightArmX + rightLift * 0.36, 0.06, -1.08 + rightLift, blend);
            setVrmBone(THREE, currentVrm, "leftLowerArm", leftLowerX, 0, leftLowerZ, blend);
            setVrmBone(THREE, currentVrm, "rightLowerArm", rightLowerX, 0, rightLowerZ, blend);
            setVrmBone(THREE, currentVrm, "leftUpperLeg", lLegX, 0, 0, blend);
            setVrmBone(THREE, currentVrm, "rightUpperLeg", rLegX, 0, 0, blend);
            setVrmBone(THREE, currentVrm, "leftLowerLeg", lKneeX, 0, 0, blend);
            setVrmBone(THREE, currentVrm, "rightLowerLeg", rKneeX, 0, 0, blend);
            setVrmBone(THREE, currentVrm, "leftEye", -eyeY * 0.14, eyeX * 0.18, 0, Math.min(1, blend * 1.8));
            setVrmBone(THREE, currentVrm, "rightEye", -eyeY * 0.14, eyeX * 0.18, 0, Math.min(1, blend * 1.8));
          }

          // SullyOS 表情包络 + 微表情叠加层 + 原生 MorphTarget 直驱兜底
          var manager = currentVrm.expressionManager;
          if (manager) {
            var blinkVal = 0;
            if (tSec >= nextBlinkSec) {
              var bdt = tSec - nextBlinkSec;
              if (bdt < 0.15) blinkVal = Math.pow(Math.sin((bdt / 0.15) * Math.PI), 0.75);
              else nextBlinkSec = tSec + 2.2 + Math.random() * 2.8;
            }
            if (activeCustomExpr && tSec >= customExprUntilSec) {
              try { manager.setValue(activeCustomExpr, 0); } catch (_) {}
              activeCustomExpr = "";
            }

            // 清零基础预设防止残留
            ["happy", "angry", "sad", "surprised", "relaxed", "blink", "blinkLeft", "blinkRight", "aa", "ih", "ou", "ee", "oh"].forEach(function (p) {
              try { manager.setValue(p, 0); } catch (_) {}
            });

            if (activeCustomExpr) {
              try { manager.setValue(activeCustomExpr, 1.0); } catch (_) {}
              applyDirectMorphTargets(activeCustomExpr, 0.95);
            } else {
              manager.setValue("blink", blinkVal);
              if (emotion === "happy") manager.setValue("happy", 0.85);
              else if (emotion === "angry") manager.setValue("angry", 0.92);
              else if (emotion === "sad") manager.setValue("sad", 0.92);
              else if (emotion === "surprised") manager.setValue("surprised", 0.92);
              else if (emotion === "relaxed") manager.setValue("relaxed", 0.85);

              // SullyOS 微表情层 (wink / grin / pout / smile-eyes / brow-*)
              if (faces.indexOf("wink") >= 0) {
                manager.setValue("blink", 0);
                manager.setValue("blinkRight", 0.98);
              }
              if (faces.indexOf("grin") >= 0) manager.setValue("ih", 0.65);
              if (faces.indexOf("pout") >= 0) manager.setValue("ou", 0.72);
              if (faces.indexOf("smile-eyes") >= 0) manager.setValue("blink", Math.max(blinkVal, 0.45));

              // 说话动态口型 viseme
              if (speaking) {
                var mouth = 0.25 + Math.max(0, Math.sin(tSec * 12.2)) * 0.42 + Math.max(0, Math.sin(tSec * 7.7)) * 0.18;
                var vowel = (Math.sin(tSec * 8.1) + 1) * 0.5;
                manager.setValue("aa", mouth * (0.6 + (1 - vowel) * 0.35));
                manager.setValue("oh", mouth * (1 - vowel) * 0.35);
                manager.setValue("ee", mouth * vowel * 0.4);
              }

              // Direct MorphTarget 兜底（解决秦彻 Q 版等 VRM 的 Angry/Sorrow preset binds 为空或被 Neutral 压制的问题）
              var directKey = faces.indexOf("tehe") >= 0 ? "tehe"
                : faces.indexOf("wink") >= 0 ? "wink"
                : emotion !== "calm" && emotion !== "neutral" ? emotion
                : (blinkVal > 0.2 ? "blink" : "");
              applyDirectMorphTargets(directKey, directKey === "blink" ? blinkVal : 0.92);
            }
          }

          currentVrm.update(dt);
        }

        if (pivot) {
          var targetY = 0;
          var targetZ = 0;
          var targetRotY = (turnDeg / 18) * 0.55;
          var targetRotZ = 0;
          var targetRotX = 0;
          var sx = 1, sy = 1, sz = 1;
          var activeG = activePerf ? activePerf.gesture : curClip;
          var activeCam = activePerf ? activePerf.camera : "medium";
          if (activeCam === "push-in" || activeCam === "close") targetZ = 0.42;
          else if (activeCam === "pull-out") targetZ = -0.22;

          if (activeG === "lift") {
            var swing = Math.sin(tSec * 6.5) * 0.16 + Math.max(-0.35, Math.min(0.35, dragVx * 0.02));
            targetY = 0.08;
            targetRotZ = swing;
            targetRotY += Math.sin(tSec * 3.2) * 0.22;
            sx = 0.96; sy = 1.06; sz = 0.96;
          } else if (activeG === "walk") {
            var ph = tSec * 6.0;
            targetY = Math.abs(Math.sin(ph)) * 0.12 - 0.02;
            targetRotZ = Math.sin(ph) * 0.11;
            targetRotY += Math.sin(ph) * 0.12;
          } else if (activeG === "sit") {
            targetY = -0.14 + Math.sin(tSec * 2.2) * 0.025;
            targetRotX = 0.06;
            targetRotY += Math.sin(tSec * 1.4) * 0.14;
          } else if (activeG === "nod" || activeG === "wave") {
            var el = Math.max(0, tSec - (activePerf ? activePerfStartSec : pokeStartSec));
            var hop = Math.abs(Math.sin(el * 6.8)) * Math.exp(-el * 0.65) * 0.18;
            targetY = hop;
            targetRotY += Math.sin(el * 3.2) * 0.18;
          } else if (activeG === "shake") {
            var elS = Math.max(0, tSec - (activePerf ? activePerfStartSec : pokeStartSec));
            targetRotY += Math.sin(elS * 7.5) * 0.22;
            targetY = Math.abs(Math.sin(elS * 7.5)) * 0.05;
          } else if (activeG === "shy") {
            targetY = -0.04;
            targetRotY += Math.sin(tSec * 1.8) * 0.12;
          } else {
            targetY = Math.sin(tSec * 2.1) * 0.04;
            targetRotY += Math.sin(tSec * 0.9) * 0.16;
            var br2 = Math.sin(tSec * 2.1) * 0.012;
            sy = 1 + br2; sx = 1 - br2 * 0.5; sz = 1 - br2 * 0.5;
          }

          pivot.position.y += (targetY - pivot.position.y) * 0.2;
          pivot.position.z += (targetZ - pivot.position.z) * 0.16;
          pivot.rotation.y += (targetRotY - pivot.rotation.y) * 0.16;
          pivot.rotation.z += (targetRotZ - pivot.rotation.z) * 0.2;
          pivot.rotation.x += (targetRotX - pivot.rotation.x) * 0.2;
          pivot.scale.set(sx, sy, sz);
        }

        renderer.render(scene, camera);
      }
      rafId = global.requestAnimationFrame(renderLoop);
    }

    function startLoop() {
      if (!rafId && !paused && renderer) {
        lastTs = 0;
        rafId = global.requestAnimationFrame(renderLoop);
      }
    }

    function stopLoop() {
      if (rafId) { global.cancelAnimationFrame(rafId); rafId = 0; }
    }

    return {
      type: "glb",
      mount: async function (containerEl, petRecord, opts) {
        var filesInfo = petRecord && petRecord.files;
        if (!filesInfo || !filesInfo.glbBlob) throw new Error("3D .glb / .vrm 模型数据缺失");
        var arrayBuf = await filesInfo.glbBlob.arrayBuffer();
        var isVrm = Boolean(
          filesInfo.isVrm ||
          (petRecord.meta && petRecord.meta.isVrm) ||
          detectIsVrmFromArrayBuffer(arrayBuf)
        );
        var THREE = await ensureThreeRuntime(true);

        cssW = Math.max(48, Math.round((opts && opts.width) || 156));
        cssH = Math.max(60, Math.round((opts && opts.height) || 198));
        var dpr = Math.min(global.devicePixelRatio || 1, 2);

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(30, cssW / cssH, 0.05, 100);
        camera.position.set(0, 0.12, 3.35);
        camera.lookAt(0, 0.05, 0);

        // SullyOS VRMAvatarCanvas 同款三点高通透打光（2.35 + 3.1 + 2.4）
        var hemi = new THREE.HemisphereLight(0xe8edff, 0x9c8e84, isVrm ? 2.15 : 1.15);
        scene.add(hemi);
        var keyLight = new THREE.DirectionalLight(0xffe9dc, isVrm ? 2.45 : 1.05);
        keyLight.position.set(1.7, 2.8, 2.6);
        scene.add(keyLight);
        var rimLight = new THREE.DirectionalLight(0x8297ff, isVrm ? 1.55 : 0.5);
        rimLight.position.set(-2.2, 1.8, -1.5);
        scene.add(rimLight);

        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "default" });
        renderer.setPixelRatio(dpr);
        renderer.setSize(cssW, cssH, false);
        renderer.setClearColor(0x000000, 0);
        if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
        if (!isVrm && THREE.ACESFilmicToneMapping) {
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.08;
        }
        renderer.domElement.style.cssText = "display:block;width:100%;height:100%;pointer-events:none;";
        containerEl.innerHTML = "";
        containerEl.appendChild(renderer.domElement);

        var loader = new THREE.GLTFLoader();
        // 1) 拦截 parser.loadImageSource，直接从 bufferView 内存解码贴图，彻底绕开 file:// 下的 blob:null/ URL
        loader.register(function (parser) {
          var origLoadImageSource = parser.loadImageSource;
          parser.loadImageSource = function (sourceIndex) {
            if (this.sourceCache[sourceIndex] !== undefined) {
              return this.sourceCache[sourceIndex].then(function (t) { return t.clone(); });
            }
            var sourceDef = this.json && this.json.images && this.json.images[sourceIndex];
            if (!sourceDef || sourceDef.bufferView === undefined) {
              return origLoadImageSource.apply(this, arguments);
            }
            var promise = this.getDependency("bufferView", sourceDef.bufferView).then(function (bufferView) {
              return decodeBufferViewToTexture(THREE, bufferView, sourceDef.mimeType);
            });
            this.sourceCache[sourceIndex] = promise;
            return promise;
          };
          return { name: "DIRECT_BUFFERVIEW_TEXTURE_DECODER" };
        });
        // 2) 注册官方 @pixiv/three-vrm VRMLoaderPlugin
        if (global.THREE_VRM && global.THREE_VRM.VRMLoaderPlugin) {
          loader.register(function (parser) {
            return new global.THREE_VRM.VRMLoaderPlugin(parser);
          });
        }
        var gltf = await new Promise(function (resolve, reject) {
          loader.parse(arrayBuf, "", resolve, reject);
        });

        currentVrm = (gltf.userData && gltf.userData.vrm) || null;
        if (currentVrm && global.THREE_VRM && global.THREE_VRM.VRMUtils) {
          var VU = global.THREE_VRM.VRMUtils;
          if (typeof VU.removeUnnecessaryVertices === "function") VU.removeUnnecessaryVertices(currentVrm.scene);
          if (typeof VU.combineSkeletons === "function") VU.combineSkeletons(currentVrm.scene);
          if (typeof VU.rotateVRM0 === "function") VU.rotateVRM0(currentVrm);
        }

        var model = (currentVrm && currentVrm.scene) || gltf.scene || (gltf.scenes && gltf.scenes[0]);
        if (!model) throw new Error("无法从 .glb / .vrm 中读取 3D 场景");

        // 采集底层网格的 MorphTarget 名称表（供空 preset 表情直接驱动脸部 72 个 VRoid 形态键）
        morphMeshes = [];
        var jsonMeshes = (gltf.parser && gltf.parser.json && gltf.parser.json.meshes) || [];
        var allTargetNames = [];
        jsonMeshes.forEach(function (jm) {
          var tns = (jm.extras && jm.extras.targetNames) || (jm.primitives && jm.primitives[0] && jm.primitives[0].extras && jm.primitives[0].extras.targetNames);
          if (Array.isArray(tns) && tns.length > allTargetNames.length) allTargetNames = tns;
        });
        model.traverse(function (node) {
          if (node.isMesh) {
            node.frustumCulled = false;
            if (Array.isArray(node.morphTargetInfluences) && node.morphTargetInfluences.length > 0) {
              var names = [];
              if (node.morphTargetDictionary) {
                Object.keys(node.morphTargetDictionary).forEach(function (k) {
                  names[node.morphTargetDictionary[k]] = k;
                });
              }
              if (!names.length && allTargetNames.length) names = allTargetNames.slice();
              morphMeshes.push({ mesh: node, names: names });
            }
          }
        });

        // 自动居中与统一缩放
        model.updateMatrixWorld(true);
        var box = new THREE.Box3().setFromObject(model);
        var size = new THREE.Vector3();
        var center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        var maxDim = Math.max(size.x, size.y, size.z) || 1;
        var normScale = 1.82 / maxDim;
        model.scale.setScalar(normScale);
        model.position.set(-center.x * normScale, -center.y * normScale, -center.z * normScale);

        pivot = new THREE.Group();
        pivot.add(model);
        scene.add(pivot);

        // 若自带骨骼动画，自动绑定播放
        if (Array.isArray(gltf.animations) && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model);
          clipActions = gltf.animations.map(function (c) { return mixer.clipAction(c); });
          clipActions[0].play();
        } else if (currentVrm) {
          mixer = new THREE.AnimationMixer(currentVrm.scene);
        }

        // 采集 VRM 自带表情与已上传的 .vrma 动作列表
        vrmExpressions = [];
        if (currentVrm && currentVrm.expressionManager && currentVrm.expressionManager.expressionMap) {
          var rawEx = Object.keys(currentVrm.expressionManager.expressionMap);
          var skipLip = { aa: 1, ih: 1, ou: 1, ee: 1, oh: 1 };
          vrmExpressions = rawEx.filter(function (k) { return !skipLip[k]; });
        }
        vrmaMotionList = currentVrm ? await listVrmaMotions() : [];

        curClip = (opts && opts.initialClip) || "idle";
        paused = false;
        renderer.render(scene, camera);
        startLoop();
      },
      resize: function (w, h) {
        cssW = Math.max(48, Math.round(w || 156));
        cssH = Math.max(60, Math.round(h || 198));
        if (renderer && camera) {
          camera.aspect = cssW / cssH;
          camera.updateProjectionMatrix();
          renderer.setSize(cssW, cssH, false);
        }
      },
      setAnimation: function (clipName) {
        curClip = clipName || "idle";
        if (curClip === "wave" || curClip === "happy" || curClip === "shy") {
          pokeStartSec = performance.now() * 0.001;
          if (clipActions.length > 1) {
            clipActions.forEach(function (a) { a.stop(); });
            clipActions[1 + Math.floor(Math.random() * (clipActions.length - 1))].reset().play();
          }
        } else if (curClip === "idle" && clipActions.length > 0) {
          clipActions.forEach(function (a, i) { if (i === 0) a.play(); else a.stop(); });
        }
      },
      listCustomActions: function () {
        var out = [];
        // 1) 若是 VRM 人形模型，优先提供 SullyOS 同款全身动作+表情耦合演出按钮（即便模型未绑某个 preset 也有完整肢体+原生形态键反馈）
        if (currentVrm) {
          SULLY_VRM_PERFORMANCES.forEach(function (p) {
            out.push({ key: p.key, label: p.label });
          });
        }
        // 2) 已上传的 .vrma 外部动作
        vrmaMotionList.forEach(function (m) {
          out.push({ key: "vrma:" + m.id, label: "VRMA:" + m.name });
        });
        // 3) 内置 glTF 动画
        clipActions.forEach(function (a, i) {
          var nm = (a && a.getClip && a.getClip().name) || ("动画" + (i + 1));
          out.push({ key: "anim:" + i, label: "动画:" + nm });
        });
        // 4) 模型自带的自定义表情（非标准预设的额外表情）
        var stdSkip = { neutral: 1, happy: 1, angry: 1, sad: 1, relaxed: 1, surprised: 1, blink: 1, blinkLeft: 1, blinkRight: 1 };
        vrmExpressions.forEach(function (ex) {
          if (!stdSkip[ex]) {
            out.push({ key: "expr:" + ex, label: "表情:" + (EXPR_LABELS[ex] || ex) });
          }
        });
        return out;
      },
      playCustomAction: async function (key) {
        if (!key) return;
        var k = String(key);
        var nowSec = performance.now() * 0.001;
        if (k.indexOf("perf:") === 0) {
          var found = SULLY_VRM_PERFORMANCES.find(function (p) { return p.key === k; });
          if (found) {
            activeCustomExpr = "";
            if (found.gesture === "idle") {
              activePerf = null;
              curClip = "idle";
              applyDirectMorphTargets("", 0);
            } else {
              activePerf = found;
              activePerfStartSec = nowSec;
              activePerfUntilSec = nowSec + (found.gesture === "sit" ? 30.0 : 7.5);
            }
            return;
          }
        }
        if (k.indexOf("expr:") === 0 && currentVrm && currentVrm.expressionManager) {
          var exName = k.slice(5);
          if (activeCustomExpr) {
            try { currentVrm.expressionManager.setValue(activeCustomExpr, 0); } catch (_) {}
          }
          if (exName === "neutral") {
            activeCustomExpr = "";
            activePerf = null;
            applyDirectMorphTargets("", 0);
            return;
          }
          // 同时匹配对应的 SullyOS 肢体动作让反馈立竿见影
          var matchedPerf = SULLY_VRM_PERFORMANCES.find(function (p) { return p.emotion === exName; });
          if (matchedPerf) {
            activePerf = matchedPerf;
            activePerfStartSec = nowSec;
            activePerfUntilSec = nowSec + 7.5;
          }
          activeCustomExpr = exName;
          customExprUntilSec = nowSec + 7.5;
          try { currentVrm.expressionManager.setValue(exName, 1.0); } catch (_) {}
          applyDirectMorphTargets(exName, 0.95);
          return;
        }
        if (k.indexOf("anim:") === 0 && clipActions.length > 0) {
          var idx = parseInt(k.slice(5), 10) || 0;
          clipActions.forEach(function (a, i) { if (i === idx) a.reset().play(); else a.stop(); });
          return;
        }
        if (k.indexOf("vrma:") === 0 && currentVrm && mixer && global.THREE) {
          var mid = k.slice(5);
          var rec = vrmaMotionList.find(function (m) { return m.id === mid; });
          if (!rec || !rec.blob) return;
          try {
            var ab = await rec.blob.arrayBuffer();
            var loader = new global.THREE.GLTFLoader();
            var gltf = await new Promise(function (resolve, reject) { loader.parse(ab, "", resolve, reject); });
            var rawClip = gltf.animations && gltf.animations[0];
            var vrmaExt = gltf.parser && gltf.parser.json && gltf.parser.json.extensions && gltf.parser.json.extensions.VRMC_vrm_animation;
            var humanBones = vrmaExt && vrmaExt.humanoid && vrmaExt.humanoid.humanBones;
            if (!rawClip || !humanBones) return;
            // 将 .vrma 节点名重定向到 VRM 归一化骨骼节点名
            var nodeIndexToBone = {};
            Object.keys(humanBones).forEach(function (bName) {
              var nIdx = humanBones[bName] && humanBones[bName].node;
              if (typeof nIdx === "number") nodeIndexToBone[nIdx] = bName;
            });
            var nodeNameToVrmNodeName = {};
            var nodesJson = (gltf.parser.json && gltf.parser.json.nodes) || [];
            Object.keys(nodeIndexToBone).forEach(function (nIdxStr) {
              var bName = nodeIndexToBone[nIdxStr];
              var srcNode = nodesJson[Number(nIdxStr)];
              var dstNode = currentVrm.humanoid.getNormalizedBoneNode && currentVrm.humanoid.getNormalizedBoneNode(bName);
              if (srcNode && srcNode.name && dstNode && dstNode.name) {
                nodeNameToVrmNodeName[srcNode.name] = dstNode.name;
              }
            });
            var tracks = [];
            rawClip.tracks.forEach(function (tr) {
              var dot = tr.name.lastIndexOf(".");
              if (dot < 0) return;
              var srcName = tr.name.slice(0, dot);
              var prop = tr.name.slice(dot + 1);
              if (prop !== "quaternion") return;
              var mapped = nodeNameToVrmNodeName[srcName];
              if (mapped) {
                var clone = tr.clone();
                clone.name = mapped + ".quaternion";
                tracks.push(clone);
              }
            });
            if (tracks.length > 0) {
              var retargeted = new global.THREE.AnimationClip(rec.name, rawClip.duration, tracks);
              if (activeVrmaAction) activeVrmaAction.stop();
              activeVrmaAction = mixer.clipAction(retargeted);
              activeVrmaAction.reset().play();
              activeVrmaUntilSec = performance.now() * 0.001 + Math.max(3.5, rawClip.duration || 4);
            }
          } catch (e) {
            console.warn("[HomeDollPet] VRMA 动作播放失败:", e);
          }
        }
      },
      setTurnDeg: function (deg) {
        turnDeg = Number(deg) || 0;
      },
      setDragVelocity: function (vx) {
        dragVx = Number(vx) || 0;
      },
      hitTest: function (localX, localY) {
        return localX >= cssW * 0.14 && localX <= cssW * 0.86 && localY >= cssH * 0.1 && localY <= cssH * 0.92;
      },
      setPaused: function (isPaused) {
        paused = Boolean(isPaused);
        if (paused) stopLoop();
        else startLoop();
      },
      destroy: function () {
        stopLoop();
        try {
          if (mixer) { mixer.stopAllAction(); mixer = null; }
          clipActions = [];
          if (scene) { disposeScene(scene); scene = null; }
          if (renderer) {
            var gl = renderer.getContext && renderer.getContext();
            renderer.dispose();
            if (renderer.domElement && renderer.domElement.parentNode) {
              renderer.domElement.parentNode.removeChild(renderer.domElement);
            }
            if (gl && typeof gl.getExtension === "function") {
              var ext = gl.getExtension("WEBGL_lose_context");
              if (ext) ext.loseContext();
            }
            renderer = null;
          }
        } catch (_) {}
        camera = null;
        pivot = null;
        currentVrm = null;
      }
    };
  }

  if (global.HomeDollPetImporters) {
    global.HomeDollPetImporters.importGlbFile = importGlbFile;
    global.HomeDollPetImporters.importVrmaMotion = saveVrmaMotion;
  }
  if (global.HomeDollPetEngine && typeof global.HomeDollPetEngine.registerAdapter === "function") {
    global.HomeDollPetEngine.registerAdapter("glb", createGlbPetAdapter);
  }

  global.HomeDollPetGlbAdapter = {
    version: "1.1.0",
    importGlbFile: importGlbFile,
    saveVrmaMotion: saveVrmaMotion,
    listVrmaMotions: listVrmaMotions
  };
})(typeof window !== "undefined" ? window : globalThis);

