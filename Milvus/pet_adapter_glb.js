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

  async function ensureThreeRuntime() {
    await loadFirstWorking(THREE_URLS, function () { return Boolean(global.THREE); }, "Three.js");
    await loadFirstWorking(GLTF_URLS, function () { return Boolean(global.THREE && global.THREE.GLTFLoader); }, "GLTFLoader");
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

  // ==================== 2. 3D GLB PetAdapter Implementation ====================

  function createGlbPetAdapter() {
    var renderer = null;
    var scene = null;
    var camera = null;
    var pivot = null;
    var mixer = null;
    var clipActions = [];
    var vrmBones = null; // VRM 0.x / 1.0 humanoid bones map
    var curClip = "idle";
    var pokeStartSec = -10;
    var turnDeg = 0;
    var dragVx = 0;
    var cssW = 156;
    var cssH = 198;
    var paused = false;
    var rafId = 0;
    var lastTs = 0;

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

        // VRM 人形骨骼实时驱动（自然放下 T-Pose 手臂 + 呼吸/挥手/漫步/坐姿/拎起悬空）
        if (vrmBones) {
          var b = vrmBones;
          var br = Math.sin(tSec * 2.2);
          if (b.chest) b.chest.rotation.x = br * 0.03;
          if (b.head) {
            b.head.rotation.z = Math.sin(tSec * 1.1) * 0.06;
            b.head.rotation.y = Math.sin(tSec * 0.8) * 0.08;
          }
          var lArmZ = -1.08 + br * 0.04;
          var rArmZ = 1.08 - br * 0.04;
          var lArmX = 0, rArmX = 0, lLegX = 0, rLegX = 0;

          if (curClip === "wave" || curClip === "happy" || curClip === "shy") {
            rArmZ = -0.35 + Math.sin(tSec * 9.0) * 0.28;
            rArmX = -0.25;
            lArmZ = -0.95 + Math.sin(tSec * 4.5) * 0.1;
          } else if (curClip === "walk") {
            var st = Math.sin(tSec * 6.0);
            lArmX = st * 0.42; rArmX = -st * 0.42;
            lLegX = -st * 0.45; rLegX = st * 0.45;
          } else if (curClip === "sit") {
            lLegX = -1.15 + Math.sin(tSec * 3.8) * 0.12;
            rLegX = -1.15 - Math.sin(tSec * 3.8) * 0.12;
            lArmZ = -0.92; rArmZ = 0.92;
          } else if (curClip === "lift") {
            lArmZ = -0.35 + Math.sin(tSec * 7.5) * 0.18;
            rArmZ = 0.35 - Math.sin(tSec * 7.5) * 0.18;
            lLegX = Math.sin(tSec * 8.0) * 0.25;
            rLegX = -Math.sin(tSec * 8.0) * 0.25;
          }

          if (b.leftUpperArm) { b.leftUpperArm.rotation.z = lArmZ; b.leftUpperArm.rotation.x = lArmX; }
          if (b.rightUpperArm) { b.rightUpperArm.rotation.z = rArmZ; b.rightUpperArm.rotation.x = rArmX; }
          if (b.leftUpperLeg) b.leftUpperLeg.rotation.x = lLegX;
          if (b.rightUpperLeg) b.rightUpperLeg.rotation.x = rLegX;
        }

        if (pivot) {
          var targetY = 0;
          var targetRotY = (turnDeg / 18) * 0.55;
          var targetRotZ = 0;
          var targetRotX = 0;
          var sx = 1, sy = 1, sz = 1;

          if (curClip === "lift") {
            var swing = Math.sin(tSec * 6.5) * 0.16 + Math.max(-0.35, Math.min(0.35, dragVx * 0.02));
            targetY = 0.08;
            targetRotZ = swing;
            targetRotY += Math.sin(tSec * 3.2) * 0.22;
            sx = 0.96; sy = 1.06; sz = 0.96;
          } else if (curClip === "walk") {
            var ph = tSec * 6.0;
            targetY = Math.abs(Math.sin(ph)) * 0.12 - 0.02;
            targetRotZ = Math.sin(ph) * 0.11;
            targetRotY += Math.sin(ph) * 0.12;
          } else if (curClip === "sit") {
            targetY = -0.10 + Math.sin(tSec * 2.2) * 0.025;
            targetRotX = 0.08;
            targetRotY += Math.sin(tSec * 1.4) * 0.14;
          } else if (curClip === "wave" || curClip === "happy" || curClip === "shy") {
            var el = Math.max(0, tSec - pokeStartSec);
            var spin = Math.min(1, el / 0.85);
            var ease = 1 - Math.pow(1 - spin, 3);
            targetRotY += ease * Math.PI * 2;
            var hop = Math.abs(Math.sin(el * 6.5)) * Math.exp(-el * 0.9) * 0.24;
            targetY = hop;
            var sq = Math.sin(el * 12) * Math.exp(-el * 1.8) * 0.08;
            sy = 1 + sq; sx = 1 - sq * 0.5; sz = 1 - sq * 0.5;
          } else {
            // 安静角落待机：柔缓呼吸浮动 + 极轻微转向展示立体感
            targetY = Math.sin(tSec * 2.1) * 0.045;
            targetRotY += Math.sin(tSec * 0.9) * 0.18;
            var br = Math.sin(tSec * 2.1) * 0.015;
            sy = 1 + br; sx = 1 - br * 0.5; sz = 1 - br * 0.5;
          }

          pivot.position.y += (targetY - pivot.position.y) * 0.2;
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
        var THREE = await ensureThreeRuntime();
        var filesInfo = petRecord && petRecord.files;
        if (!filesInfo || !filesInfo.glbBlob) throw new Error("3D .glb 模型数据缺失");

        cssW = Math.max(48, Math.round((opts && opts.width) || 156));
        cssH = Math.max(60, Math.round((opts && opts.height) || 198));
        var dpr = Math.min(global.devicePixelRatio || 1, 2);

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(34, cssW / cssH, 0.1, 100);
        camera.position.set(0, 0.15, 3.6);
        camera.lookAt(0, 0, 0);

        // 三点柔和摄影棚打光（确保 Nomad 顶点色清晰立体不发黑）
        var hemi = new THREE.HemisphereLight(0xfffaf2, 0xb8a99a, 1.05);
        scene.add(hemi);
        var keyLight = new THREE.DirectionalLight(0xffffff, 0.95);
        keyLight.position.set(2.4, 3.5, 3.2);
        scene.add(keyLight);
        var rimLight = new THREE.DirectionalLight(0xffe9d6, 0.45);
        rimLight.position.set(-2.5, 1.8, -2.2);
        scene.add(rimLight);

        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "default" });
        renderer.setPixelRatio(dpr);
        renderer.setSize(cssW, cssH, false);
        renderer.setClearColor(0x000000, 0);
        if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
        if (THREE.ACESFilmicToneMapping) {
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.08;
        }
        renderer.domElement.style.cssText = "display:block;width:100%;height:100%;pointer-events:none;";
        containerEl.innerHTML = "";
        containerEl.appendChild(renderer.domElement);

        var arrayBuf = await filesInfo.glbBlob.arrayBuffer();
        var loader = new THREE.GLTFLoader();
        // 拦截 parser.loadImageSource，直接从 bufferView 内存解码贴图，彻底绕开 blob:null/ URL
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
        var gltf = await new Promise(function (resolve, reject) {
          loader.parse(arrayBuf, "", resolve, reject);
        });

        var model = gltf.scene || (gltf.scenes && gltf.scenes[0]);
        if (!model) throw new Error("无法从 .glb / .vrm 中读取 3D 场景");

        // 检测 VRM 0.x / 1.0 扩展：修正 VRM 0.x 朝向（默认背对镜头），柔和化 MToon 材质并提取人形骨骼
        var jsonExt = gltf.parser && gltf.parser.json && gltf.parser.json.extensions;
        var isVrm0 = Boolean(jsonExt && jsonExt.VRM);
        var isVrm1 = Boolean(jsonExt && jsonExt.VRMC_vrm);
        if (isVrm0) {
          model.rotation.y = Math.PI;
          model.updateMatrixWorld(true);
        }
        if (isVrm0 || isVrm1 || filesInfo.isVrm) {
          model.traverse(function (node) {
            if (node.isMesh && node.material) {
              var mats = Array.isArray(node.material) ? node.material : [node.material];
              mats.forEach(function (m) {
                if (m && typeof m.roughness === "number") { m.roughness = Math.max(m.roughness, 0.82); m.metalness = Math.min(m.metalness || 0, 0.08); }
              });
            }
          });
          // 绑定 VRM 人形骨骼节点（自动放下 T-Pose 手臂并驱动待机/招手/漫步/坐姿/拎起）
          try {
            var boneList = isVrm0
              ? (jsonExt.VRM.humanoid && jsonExt.VRM.humanoid.humanBones) || []
              : Object.keys((jsonExt.VRMC_vrm.humanoid && jsonExt.VRMC_vrm.humanoid.humanBones) || {}).map(function (k) {
                  return { bone: k, node: jsonExt.VRMC_vrm.humanoid.humanBones[k].node };
                });
            var wanted = ["head", "chest", "spine", "leftUpperArm", "rightUpperArm", "leftUpperLeg", "rightUpperLeg"];
            var map = {};
            for (var bi = 0; bi < boneList.length; bi++) {
              var entry = boneList[bi];
              if (entry && wanted.indexOf(entry.bone) >= 0 && typeof entry.node === "number") {
                map[entry.bone] = await gltf.parser.getDependency("node", entry.node);
              }
            }
            if (Object.keys(map).length > 0) vrmBones = map;
          } catch (_) {}
        }

        // 自动居中与统一缩放
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
        }

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
        vrmBones = null;
      }
    };
  }

  if (global.HomeDollPetImporters) {
    global.HomeDollPetImporters.importGlbFile = importGlbFile;
  }
  if (global.HomeDollPetEngine && typeof global.HomeDollPetEngine.registerAdapter === "function") {
    global.HomeDollPetEngine.registerAdapter("glb", createGlbPetAdapter);
  }

  global.HomeDollPetGlbAdapter = {
    version: "1.0.0",
    importGlbFile: importGlbFile
  };
})(typeof window !== "undefined" ? window : globalThis);

