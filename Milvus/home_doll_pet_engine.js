/**
 * Milvus/home_doll_pet_engine.js
 * 主屏幕桌面宠物总控引擎（独立模块化 · 严格零 AI · 统一 PetAdapter 插件接口）
 *
 * 特性：
 * 1. 默认行为「安静待在角落待机」（26fps 省电呼吸眨眼，仅戳/拖时 60fps 轻互动）
 * 2. 可选「自由漫步」与「坐上 Dock 栏晃脚」模式
 * 3. 内置 CottonDollAdapter（调用共享渲染内核 Milvus/cotton_doll_renderer.js，零外部依赖、像素级 Alpha 透明穿透）
 * 4. 统一 registerAdapter(type, factory) 接口，无缝扩展 Live2D 与 Spine 插件适配器
 * 5. 三重自动休眠（切后台 / 打开 z-index>=100 全屏 App / 关闭开关 时 0% CPU 占用）
 * 6. 对外暴露 window.HomeDollPetEngine API（含预留 say(text) 气泡接口，供后续自用扩展）
 */
(function (global) {
  "use strict";

  var BASE_W = 156;
  var BASE_H = 198;
  var adapters = {};

  // ==================== 1. Built-in CottonDollAdapter (Route B Shared Renderer) ====================

  function createCottonDollAdapter() {
    var canvas = null;
    var ctx = null;
    var dollState = null;
    var animState = null;
    var curClip = "idle";
    var turnDeg = 0;
    var extraForce = { vx: 0 };
    var dpr = 1;
    var cssW = BASE_W;
    var cssH = BASE_H;
    var paused = false;
    var rafId = 0;
    var lastFrameTs = 0;
    var activeScale = 1;

    function getRenderer() {
      return global.CottonDollRenderer || null;
    }

    function renderFrame(ts) {
      rafId = 0;
      if (paused || !canvas || !ctx || !dollState) return;
      var R = getRenderer();
      if (!R) return;

      // 动态降帧：静谧待机 26fps 省电，互动/拖拽/漫步 60fps 丝滑
      var isLowPower = curClip === "idle" && Math.abs(turnDeg) < 0.5;
      var minInterval = isLowPower ? 38 : 15;
      if (ts - lastFrameTs >= minInterval) {
        lastFrameTs = ts;
        R.stepSpineRigAnimation(dollState, animState, ts * 0.001, curClip, extraForce);
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cssW, cssH);
        var drawScale = 0.56 * activeScale;
        R.drawFullDoll(ctx, dollState, animState, {
          centerX: cssW * 0.5,
          centerY: cssH * 0.56,
          scale: drawScale,
          turnDeg: turnDeg,
          showCloth: true,
          showHair: true,
          useLiveAnim: true,
          forceLiveAnim: true
        });
        ctx.restore();
      }
      rafId = global.requestAnimationFrame(renderFrame);
    }

    function startLoop() {
      if (!rafId && !paused && canvas) {
        lastFrameTs = 0;
        rafId = global.requestAnimationFrame(renderFrame);
      }
    }

    function stopLoop() {
      if (rafId) {
        global.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    return {
      type: "cotton",
      mount: function (containerEl, petRecord, opts) {
        var R = getRenderer();
        if (!R) throw new Error("未加载 Milvus/cotton_doll_renderer.js");
        dollState = (petRecord && petRecord.snapshot)
          ? JSON.parse(JSON.stringify(petRecord.snapshot))
          : R.createDefaultState();
        animState = R.createAnimState();
        activeScale = (opts && opts.scale) || 1.0;
        curClip = (opts && opts.initialClip) || "idle";

        canvas = global.document.createElement("canvas");
        canvas.style.cssText = "display:block;width:100%;height:100%;pointer-events:none;";
        containerEl.innerHTML = "";
        containerEl.appendChild(canvas);
        ctx = canvas.getContext("2d", { willReadFrequently: true });
        this.resize((opts && opts.width) || BASE_W, (opts && opts.height) || BASE_H, opts && opts.dpr);
        paused = false;
        startLoop();
      },
      resize: function (w, h, nextDpr) {
        cssW = Math.max(48, Math.round(w || BASE_W));
        cssH = Math.max(60, Math.round(h || BASE_H));
        activeScale = cssW / BASE_W;
        dpr = Math.min(Number(nextDpr) || (global.devicePixelRatio || 1), 2);
        if (canvas) {
          canvas.width = Math.round(cssW * dpr);
          canvas.height = Math.round(cssH * dpr);
        }
      },
      setAnimation: function (clipName) {
        curClip = clipName || "idle";
      },
      listCustomActions: function () {
        return [
          { key: "cotton:wave", label: "招手问好" },
          { key: "cotton:happy", label: "开心蹦跳" },
          { key: "cotton:shy", label: "害羞摇摆" },
          { key: "cotton:sit", label: "坐下晃脚" },
          { key: "cotton:walk", label: "迈步走路" },
          { key: "cotton:idle", label: "呼吸待机" }
        ];
      },
      playCustomAction: function (key) {
        curClip = String(key || "idle").replace(/^cotton:/, "");
      },
      setTurnDeg: function (deg) {
        turnDeg = Math.max(-18, Math.min(18, Number(deg) || 0));
      },
      setDragVelocity: function (vx) {
        extraForce.vx = Number(vx) || 0;
      },
      hitTest: function (localX, localY) {
        if (!canvas || !ctx) return false;
        var px = Math.floor(localX * dpr);
        var py = Math.floor(localY * dpr);
        if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return false;
        try {
          var alpha = ctx.getImageData(px, py, 1, 1).data[3];
          return alpha > 18;
        } catch (_) {
          // 回退紧凑中心包围盒
          return localX > cssW * 0.16 && localX < cssW * 0.84 && localY > cssH * 0.1 && localY < cssH * 0.94;
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
        canvas = null;
        ctx = null;
        dollState = null;
        animState = null;
      }
    };
  }

  function registerAdapter(type, factory) {
    if (!type || typeof factory !== "function") return;
    adapters[String(type)] = factory;
  }

  registerAdapter("cotton", createCottonDollAdapter);

  // ==================== 2. Master Pet Controller (FSM + Drag + Triple Auto-Sleep) ====================

  function createPetController() {
    var rootEl = null;
    var stageEl = null;
    var bubbleEl = null;
    var menuEl = null;
    var curAdapter = null;
    var curPet = null;
    var cfg = null;

    var baseClip = "idle";
    var tempClipTimer = null;
    var manualActionLockUntil = 0;
    var manualWalkUntil = 0;
    var fallRafId = 0;
    var landTimer = null;
    var bubbleTimer = null;
    var roamTimer = null;
    var roamDir = -1;
    var sleepMonitorTimer = null;
    var isAppCovering = false;
    var isTabHidden = false;
    var menuOpen = false;

    // Pointer / Drag state
    var drag = {
      active: false,
      moved: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      lastX: 0,
      origLeft: 0,
      origTop: 0,
      downTime: 0,
      longPressTimer: null
    };
    var lastTapAt = 0;
    var mountSeq = 0;

    function getStore() {
      return global.HomeDollPetStore || null;
    }

    function getViewportSize() {
      return {
        w: global.innerWidth || 390,
        h: global.innerHeight || 844
      };
    }

    function getBoxSize() {
      var sc = (cfg && cfg.scale) || 1.0;
      return { w: Math.round(BASE_W * sc), h: Math.round(BASE_H * sc) };
    }

    function applyPositionFromNorm(nx, ny) {
      if (!rootEl) return;
      var vp = getViewportSize();
      var box = getBoxSize();
      var cx = Math.max(box.w * 0.48, Math.min(vp.w - box.w * 0.48, nx * vp.w));
      var cy = Math.max(box.h * 0.5 + 44, Math.min(vp.h - box.h * 0.48 - 10, ny * vp.h));
      rootEl.style.left = Math.round(cx - box.w * 0.5) + "px";
      rootEl.style.top = Math.round(cy - box.h * 0.5) + "px";
      rootEl.style.width = box.w + "px";
      rootEl.style.height = box.h + "px";
    }

    function computeBaseClip() {
      if (!cfg) return "idle";
      if (cfg.behaviorMode === "sit_dock") return "sit";
      return "idle";
    }

    function syncSleepState() {
      var covered = (cfg && cfg.alwaysOnTop === false) ? isAppCovering : false;
      var shouldPause = isTabHidden || covered || !cfg || !cfg.enabled;
      if (curAdapter && typeof curAdapter.setPaused === "function") {
        curAdapter.setPaused(shouldPause);
      }
    }

    // 仅当用户关闭「全局置顶」时，检测全屏 App 覆盖并自动休眠
    function checkCoveringApps() {
      if (!cfg || !cfg.enabled) { isAppCovering = true; syncSleepState(); return; }
      if (cfg.alwaysOnTop !== false) {
        if (isAppCovering) { isAppCovering = false; syncSleepState(); }
        return;
      }
      var covering = false;
      try {
        var doc = global.document;
        if (doc && doc.body) {
          var children = doc.body.querySelectorAll("div[style*='position: fixed'], div[style*='position:fixed']");
          for (var i = 0; i < children.length; i++) {
            var el = children[i];
            if (!el || el.id === "milvus-home-doll-pet-root" || el.contains(rootEl)) continue;
            var zi = parseInt(el.style.zIndex, 10) || 0;
            if (zi >= 100 && zi < 9000) {
              var r = el.getBoundingClientRect();
              if (r.width >= (global.innerWidth || 390) * 0.85 && r.height >= (global.innerHeight || 844) * 0.75) {
                covering = true;
                break;
              }
            }
          }
        }
      } catch (_) {}
      if (covering !== isAppCovering) {
        isAppCovering = covering;
        syncSleepState();
      }
    }

    function stopRoamLoop() {
      if (roamTimer) { clearInterval(roamTimer); roamTimer = null; }
    }

    function stopFallPhysics() {
      if (fallRafId) { global.cancelAnimationFrame(fallRafId); fallRafId = 0; }
      if (landTimer) { clearTimeout(landTimer); landTimer = null; }
      if (stageEl) {
        stageEl.style.transition = "";
        stageEl.style.transform = "";
        stageEl.style.transformOrigin = "50% 92%";
      }
    }

    function triggerLandingCushion() {
      if (!stageEl) return;
      stageEl.style.transformOrigin = "50% 92%";
      // 第一拍：触地压缩回弹（Q弹缓冲）
      stageEl.style.transition = "transform 0.11s cubic-bezier(0.22, 1, 0.36, 1)";
      stageEl.style.transform = "scale(1.16, 0.84) translateY(5px)";
      if (curAdapter && typeof curAdapter.setAnimation === "function") {
        curAdapter.setAnimation("land");
      }
      if (landTimer) clearTimeout(landTimer);
      landTimer = setTimeout(function () {
        if (!stageEl) return;
        // 第二拍：轻微回弹拉起
        stageEl.style.transition = "transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1)";
        stageEl.style.transform = "scale(0.96, 1.04) translateY(-2px)";
        landTimer = setTimeout(function () {
          if (!stageEl) return;
          // 第三拍：自然归位并等待落地过渡帧（如张飞-猫 014~017 约 520ms）播完后切回基础动作
          stageEl.style.transition = "transform 0.18s ease-out";
          stageEl.style.transform = "scale(1, 1) translateY(0)";
          landTimer = setTimeout(function () {
            landTimer = null;
            if (stageEl) { stageEl.style.transition = ""; stageEl.style.transform = ""; }
            if (!drag.active && Date.now() >= manualActionLockUntil && curAdapter && typeof curAdapter.setAnimation === "function") {
              curAdapter.setAnimation(baseClip);
            }
          }, 260);
        }, 160);
      }, 125);
    }

    function startFallToGround(startLeft, startTop, throwVx) {
      stopFallPhysics();
      if (!rootEl) return;
      var vp = getViewportSize();
      var box = getBoxSize();
      // 落脚基准线：屏幕底部上方留出自然站立空间（约 ny = 0.85）
      var floorTop = Math.max(36, Math.min(vp.h - box.h * 0.85, vp.h * 0.85 - box.h * 0.5));
      var dist = floorTop - startTop;

      // 若本身就放得很低（已在地面附近），直接播放轻巧落地缓冲，不强行弹跳
      if (dist <= 26) {
        var nx0 = (startLeft + box.w * 0.5) / vp.w;
        var ny0 = (startTop + box.h * 0.5) / vp.h;
        var st0 = getStore();
        if (st0) st0.saveConfig({ nx: nx0, ny: ny0 });
        triggerLandingCushion();
        return;
      }

      if (curAdapter && typeof curAdapter.setAnimation === "function") {
        curAdapter.setAnimation("fall");
      }
      if (stageEl) {
        stageEl.style.transformOrigin = "50% 85%";
        stageEl.style.transition = "transform 0.12s ease-out";
        stageEl.style.transform = "scale(0.93, 1.08)";
      }

      var curL = startLeft;
      var curT = startTop;
      var vx = Math.max(-280, Math.min(280, (Number(throwVx) || 0) * 18));
      var vy = 40;
      var gravity = 2150;
      var lastTs = performance.now();

      function stepFall(now) {
        fallRafId = 0;
        if (drag.active || !rootEl) return;
        var dt = Math.min(0.04, Math.max(0.008, (now - lastTs) * 0.001));
        lastTs = now;
        vy += gravity * dt;
        curT += vy * dt;
        curL += vx * dt;
        vx *= Math.pow(0.25, dt);

        var minL = -box.w * 0.12;
        var maxL = vp.w - box.w * 0.88;
        if (curL < minL) { curL = minL; vx = Math.abs(vx) * 0.45; }
        else if (curL > maxL) { curL = maxL; vx = -Math.abs(vx) * 0.45; }

        if (curT >= floorTop) {
          curT = floorTop;
          rootEl.style.left = Math.round(curL) + "px";
          rootEl.style.top = Math.round(curT) + "px";
          var nx = (curL + box.w * 0.5) / vp.w;
          var ny = (curT + box.h * 0.5) / vp.h;
          if (cfg) { cfg.nx = nx; cfg.ny = ny; }
          var st = getStore();
          if (st) st.saveConfig({ nx: nx, ny: ny });
          triggerLandingCushion();
          return;
        }

        rootEl.style.left = Math.round(curL) + "px";
        rootEl.style.top = Math.round(curT) + "px";
        fallRafId = global.requestAnimationFrame(stepFall);
      }

      fallRafId = global.requestAnimationFrame(stepFall);
    }

    function startRoamLoopIfNeeded() {
      stopRoamLoop();
      if (!cfg || !cfg.enabled) return;
      var needLoop = cfg.behaviorMode === "roam" || Date.now() < manualWalkUntil;
      if (!needLoop) return;
      roamTimer = setInterval(function () {
        if (!cfg || !cfg.enabled) { stopRoamLoop(); return; }
        var now = Date.now();
        var isTempWalking = now < manualWalkUntil;
        if (cfg.behaviorMode !== "roam" && !isTempWalking) {
          stopRoamLoop();
          if (curAdapter && typeof curAdapter.setTurnDeg === "function") curAdapter.setTurnDeg(0);
          if (!drag.active && !fallRafId && curAdapter && typeof curAdapter.setAnimation === "function") {
            curAdapter.setAnimation(baseClip);
          }
          return;
        }
        if (isAppCovering || isTabHidden || drag.active || fallRafId || tempClipTimer || menuOpen) return;
        if (!isTempWalking && now < manualActionLockUntil) return;
        if (!isTempWalking && curAdapter && typeof curAdapter.setAnimation === "function") curAdapter.setAnimation("walk");
        if (curAdapter && typeof curAdapter.setTurnDeg === "function") curAdapter.setTurnDeg(roamDir * 10);
        // 按固定像素速度悠闲漫步（约 24px/秒，复刻《张飞-猫》160ms 走 3px 的舒缓步频，不随宽屏变快）
        var vpW = Math.max(320, getViewportSize().w);
        var stepNorm = 1.15 / vpW;
        cfg.nx = Math.max(0.14, Math.min(0.86, (cfg.nx || 0.84) + roamDir * stepNorm));
        if (cfg.nx <= 0.15) roamDir = 1;
        else if (cfg.nx >= 0.85) roamDir = -1;
        applyPositionFromNorm(cfg.nx, cfg.ny);
      }, 45);
    }

    function playTempClip(clipName, durationMs) {
      if (!curAdapter) return;
      if (Date.now() < manualActionLockUntil) return;
      if (tempClipTimer) clearTimeout(tempClipTimer);
      if (typeof curAdapter.setAnimation === "function") curAdapter.setAnimation(clipName);
      tempClipTimer = setTimeout(function () {
        tempClipTimer = null;
        if (Date.now() < manualActionLockUntil) return;
        if (curAdapter && typeof curAdapter.setAnimation === "function") {
          curAdapter.setAnimation(baseClip);
        }
      }, durationMs || 2200);
    }

    function say(text, durationMs) {
      if (!bubbleEl || !text) return;
      bubbleEl.textContent = String(text).slice(0, 48);
      bubbleEl.style.opacity = "1";
      bubbleEl.style.transform = "translate(-50%, 0)";
      if (bubbleTimer) clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(function () {
        if (bubbleEl) {
          bubbleEl.style.opacity = "0";
          bubbleEl.style.transform = "translate(-50%, 6px)";
        }
      }, durationMs || 2800);
    }

    function closeMenu() {
      menuOpen = false;
      if (menuEl) menuEl.style.display = "none";
    }

    function listCurrentActions() {
      if (curAdapter && typeof curAdapter.listCustomActions === "function") {
        try { return curAdapter.listCustomActions() || []; } catch (_) {}
      }
      return [];
    }

    function playCurrentAction(key) {
      if (!curAdapter || !key) return;
      stopFallPhysics();
      if (tempClipTimer) { clearTimeout(tempClipTimer); tempClipTimer = null; }
      var kStr = String(key);
      var isWalkAct = /walk|run|move|crawl|carry|走|跑|漫步/i.test(kStr);
      var isIdleReset = /:(idle|stand|wait|default)$/i.test(kStr);
      if (isWalkAct) {
        manualActionLockUntil = Date.now() + 9500;
        manualWalkUntil = Date.now() + 9500;
      } else if (isIdleReset) {
        manualActionLockUntil = 0;
        manualWalkUntil = 0;
      } else {
        manualActionLockUntil = Date.now() + 9000;
        manualWalkUntil = 0;
      }
      if (typeof curAdapter.playCustomAction === "function") {
        try { curAdapter.playCustomAction(key); } catch (_) {}
      }
      startRoamLoopIfNeeded();
    }

    function rebuildQuickMenu() {
      if (!menuEl || !global.document) return;
      var doc = global.document;
      menuEl.innerHTML = "";
      var acts = listCurrentActions().slice(0, 10);
      var makeBtn = function (label, onClick, isDanger) {
        var btn = doc.createElement("button");
        btn.type = "button";
        btn.textContent = label;
        btn.style.cssText =
          "border:none;background:" + (isDanger ? "#F3F4F6" : "#FDF2F4") + ";color:" + (isDanger ? "#6B7280" : "#B76373") + ";" +
          "font-size:10px;font-weight:700;padding:4px 7px;border-radius:8px;cursor:pointer;font-family:inherit;white-space:nowrap;";
        btn.onclick = function (ev) { ev.stopPropagation(); onClick(); };
        menuEl.appendChild(btn);
      };
      if (acts.length > 0) {
        acts.forEach(function (a) {
          makeBtn(a.label.replace(/^(表情|动作|动画):/, "").slice(0, 8), function () { closeMenu(); playCurrentAction(a.key); }, false);
        });
      } else {
        makeBtn("招手", function () { closeMenu(); playTempClip("wave", 2400); }, false);
        makeBtn("坐下", function () { closeMenu(); var st = getStore(); if (st) st.saveConfig({ behaviorMode: cfg && cfg.behaviorMode === "sit_dock" ? "quiet" : "sit_dock" }); }, false);
      }
      makeBtn("收起", function () { closeMenu(); var st = getStore(); if (st) st.saveConfig({ enabled: false }); }, true);
    }

    function toggleMenu() {
      menuOpen = !menuOpen;
      if (menuOpen) {
        if (tempClipTimer) { clearTimeout(tempClipTimer); tempClipTimer = null; }
        rebuildQuickMenu();
      }
      if (menuEl) menuEl.style.display = menuOpen ? "flex" : "none";
    }

    function handlePoke() {
      var clips = ["wave", "shy", "happy"];
      var pick = clips[Math.floor(Math.random() * clips.length)];
      playTempClip(pick, 2200);
    }

    function ensureDom() {
      if (rootEl) return;
      var doc = global.document;
      if (!doc || !doc.body) return;

      rootEl = doc.createElement("div");
      rootEl.id = "milvus-home-doll-pet-root";
      rootEl.style.cssText =
        "position:fixed;z-index:9500;pointer-events:none;user-select:none;-webkit-user-select:none;" +
        "touch-action:none;transition:opacity 0.22s ease;display:none;";

      stageEl = doc.createElement("div");
      stageEl.style.cssText = "position:relative;width:100%;height:100%;pointer-events:auto;";
      rootEl.appendChild(stageEl);

      // 预留极简对话气泡（不接 AI，供 say() 接口展示）
      bubbleEl = doc.createElement("div");
      bubbleEl.style.cssText =
        "position:absolute;left:50%;bottom:calc(100% - 6px);transform:translate(-50%, 6px);" +
        "max-width:170px;padding:5px 10px;border-radius:12px;background:rgba(255,253,249,0.94);" +
        "border:1px solid rgba(196,111,127,0.35);box-shadow:0 4px 14px rgba(43,33,28,0.14);" +
        "color:#433128;font-size:11px;font-weight:700;line-height:1.4;white-space:nowrap;" +
        "overflow:hidden;text-overflow:ellipsis;pointer-events:none;opacity:0;transition:all 0.2s ease;";
      rootEl.appendChild(bubbleEl);

      // 长按/双击呼出的极简控台胶囊（动态展示当前模型全部动作/表情）
      menuEl = doc.createElement("div");
      menuEl.style.cssText =
        "position:absolute;left:50%;bottom:calc(100% + 4px);transform:translateX(-50%);" +
        "display:none;flex-wrap:wrap;justify-content:center;max-width:220px;gap:4px;padding:5px 6px;border-radius:14px;background:rgba(255,253,249,0.96);" +
        "border:1px solid rgba(228,212,195,0.95);box-shadow:0 6px 18px rgba(43,33,28,0.18);" +
        "pointer-events:auto;z-index:48;";
      rootEl.appendChild(menuEl);

      // 像素级透明穿透：点击透明处直接放行给下层主屏图标
      stageEl.addEventListener("pointerdown", function (ev) {
        if (!curAdapter || !rootEl) return;
        var rect = rootEl.getBoundingClientRect();
        var lx = ev.clientX - rect.left;
        var ly = ev.clientY - rect.top;
        if (typeof curAdapter.hitTest === "function" && !curAdapter.hitTest(lx, ly)) {
          // 透明区域：短暂关闭 pointer-events 让底层元素接收点击（桌面鼠标回退）
          return;
        }
        ev.stopPropagation();
        closeMenu();
        stopFallPhysics();
        drag.active = true;
        drag.moved = false;
        drag.pointerId = ev.pointerId;
        drag.startX = ev.clientX;
        drag.startY = ev.clientY;
        drag.lastX = ev.clientX;
        drag.lastVx = 0;
        drag.origLeft = rect.left;
        drag.origTop = rect.top;
        drag.downTime = Date.now();
        try { stageEl.setPointerCapture(ev.pointerId); } catch (_) {}

        if (drag.longPressTimer) clearTimeout(drag.longPressTimer);
        drag.longPressTimer = setTimeout(function () {
          if (drag.active && !drag.moved) {
            drag.active = false;
            toggleMenu();
          }
        }, 460);
      });

      stageEl.addEventListener("pointermove", function (ev) {
        if (!drag.active || ev.pointerId !== drag.pointerId || !rootEl) return;
        var dx = ev.clientX - drag.startX;
        var dy = ev.clientY - drag.startY;
        if (!drag.moved && Math.hypot(dx, dy) >= 8) {
          drag.moved = true;
          manualActionLockUntil = 0;
          manualWalkUntil = 0;
          if (drag.longPressTimer) { clearTimeout(drag.longPressTimer); drag.longPressTimer = null; }
          if (curAdapter && typeof curAdapter.setAnimation === "function") curAdapter.setAnimation("lift");
          if (stageEl) {
            stageEl.style.transformOrigin = "50% 18%";
            stageEl.style.transition = "transform 0.14s ease-out";
            stageEl.style.transform = "translateY(-4px) scale(0.98, 1.03)";
          }
        }
        if (drag.moved) {
          var vx = ev.clientX - drag.lastX;
          drag.lastX = ev.clientX;
          drag.lastVx = drag.lastVx * 0.55 + vx * 0.45;
          if (curAdapter && typeof curAdapter.setDragVelocity === "function") curAdapter.setDragVelocity(drag.lastVx);
          var vp = getViewportSize();
          var box = getBoxSize();
          var nl = Math.max(-box.w * 0.15, Math.min(vp.w - box.w * 0.85, drag.origLeft + dx));
          var nt = Math.max(36, Math.min(vp.h - box.h * 0.85, drag.origTop + dy));
          rootEl.style.left = Math.round(nl) + "px";
          rootEl.style.top = Math.round(nt) + "px";
        }
      });

      var finishDrag = function (ev) {
        if (!drag.active || (ev && ev.pointerId !== drag.pointerId)) return;
        if (drag.longPressTimer) { clearTimeout(drag.longPressTimer); drag.longPressTimer = null; }
        var wasMoved = drag.moved;
        var releaseVx = drag.lastVx || 0;
        drag.active = false;
        drag.moved = false;
        drag.lastVx = 0;
        if (curAdapter && typeof curAdapter.setDragVelocity === "function") curAdapter.setDragVelocity(0);

        if (wasMoved && rootEl) {
          var rect = rootEl.getBoundingClientRect();
          startFallToGround(rect.left, rect.top, releaseVx);
        } else {
          var now = Date.now();
          if (now - lastTapAt < 320) {
            lastTapAt = 0;
            toggleMenu();
          } else {
            lastTapAt = now;
            handlePoke();
          }
        }
      };

      stageEl.addEventListener("pointerup", finishDrag);
      stageEl.addEventListener("pointercancel", finishDrag);

      // 针对透明像素实时切换 pointer-events（桌面鼠标悬停精准穿透）
      doc.addEventListener("pointermove", function (ev) {
        if (!rootEl || !stageEl || !curAdapter || drag.active || !cfg || !cfg.enabled) return;
        var rect = rootEl.getBoundingClientRect();
        if (ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom) return;
        if (typeof curAdapter.hitTest === "function") {
          var hit = curAdapter.hitTest(ev.clientX - rect.left, ev.clientY - rect.top);
          stageEl.style.pointerEvents = hit ? "auto" : "none";
        }
      }, { passive: true });

      doc.body.appendChild(rootEl);
    }

    async function mountCurrentPet() {
      var mySeq = ++mountSeq;
      var st = getStore();
      if (!st) return;
      cfg = st.getConfig();
      ensureDom();
      if (!rootEl) return;

      if (!cfg.enabled) {
        rootEl.style.display = "none";
        stopRoamLoop();
        if (curAdapter) { curAdapter.destroy(); curAdapter = null; }
        return;
      }

      var allPets = await st.listAllPets();
      if (mySeq !== mountSeq) return;
      var chosen = cfg.activePetId
        ? allPets.find(function (p) { return String(p.id) === String(cfg.activePetId); })
        : null;
      if (!chosen && allPets.length > 0) {
        chosen = allPets[0];
        cfg.activePetId = chosen.id;
      }
      if (!chosen) {
        // 若尚无任何手作娃娃，用默认奶糖小兔兜底渲染
        chosen = { id: "default_bunny", type: "cotton", name: "奶糖小兔", snapshot: null };
      }

      var petChanged = !curPet || String(curPet.id) !== String(chosen.id) || curPet.type !== chosen.type;
      curPet = chosen;
      baseClip = computeBaseClip();

      rootEl.style.display = "block";
      rootEl.style.zIndex = cfg.alwaysOnTop !== false ? "9500" : "45";
      var box = getBoxSize();
      applyPositionFromNorm(cfg.nx, cfg.ny);

      if (petChanged || !curAdapter) {
        if (curAdapter) { curAdapter.destroy(); curAdapter = null; }
        var factory = adapters[chosen.type] || adapters.cotton;
        if (!factory) return;
        curAdapter = factory();
        try {
          await curAdapter.mount(stageEl, chosen, {
            width: box.w,
            height: box.h,
            scale: cfg.scale,
            initialClip: baseClip
          });
          try {
            if (typeof global.dispatchEvent === "function" && typeof CustomEvent === "function") {
              global.dispatchEvent(new CustomEvent("milvus-home-doll-pet-actions-ready"));
            }
          } catch (_) {}
        } catch (err) {
          console.warn("[HomeDollPet] 模型加载失败:", err);
          say("模型加载失败，请检查文件", 3200);
        }
      } else {
        if (typeof curAdapter.resize === "function") curAdapter.resize(box.w, box.h);
        if (!tempClipTimer && Date.now() >= manualActionLockUntil && typeof curAdapter.setAnimation === "function") {
          curAdapter.setAnimation(baseClip);
        }
        try {
          if (typeof global.dispatchEvent === "function" && typeof CustomEvent === "function") {
            global.dispatchEvent(new CustomEvent("milvus-home-doll-pet-actions-ready"));
          }
        } catch (_) {}
      }

      startRoamLoopIfNeeded();
      checkCoveringApps();
      syncSleepState();
    }

    function init() {
      var doc = global.document;
      if (!doc) return;
      doc.addEventListener("visibilitychange", function () {
        isTabHidden = doc.visibilityState === "hidden";
        syncSleepState();
      });
      global.addEventListener("resize", function () {
        if (cfg && cfg.enabled) applyPositionFromNorm(cfg.nx, cfg.ny);
      });
      global.addEventListener("milvus-home-doll-pet-updated", function () {
        mountCurrentPet();
      });
      if (!sleepMonitorTimer) {
        sleepMonitorTimer = setInterval(checkCoveringApps, 450);
      }
      mountCurrentPet();
    }

    return {
      init: init,
      refresh: mountCurrentPet,
      setAnimation: playTempClip,
      listActions: listCurrentActions,
      playAction: playCurrentAction,
      say: say,
      moveTo: function (nx, ny) {
        var st = getStore();
        if (st) st.saveConfig({ nx: nx, ny: ny });
      },
      setEnabled: function (enabled) {
        var st = getStore();
        if (st) st.saveConfig({ enabled: Boolean(enabled) });
      },
      setPet: async function (petId) {
        var st = getStore();
        if (st) st.saveConfig({ activePetId: String(petId || ""), enabled: true });
      },
      getState: function () {
        return { config: cfg, activePet: curPet ? { id: curPet.id, type: curPet.type, name: curPet.name } : null };
      }
    };
  }

  var controller = createPetController();

  // Lightweight React Layer for optional mount in app.min.js
  function HomeDollPetLayer() {
    var React = global.React;
    if (!React) return null;
    React.useEffect(function () {
      controller.refresh();
    }, []);
    return null;
  }

  if (typeof global.document !== "undefined") {
    if (global.document.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", function () { controller.init(); });
    } else {
      setTimeout(function () { controller.init(); }, 80);
    }
  }

  global.HomeDollPetLayer = HomeDollPetLayer;
  global.HomeDollPetEngine = {
    version: "1.0.0",
    registerAdapter: registerAdapter,
    refresh: controller.refresh,
    setAnimation: controller.setAnimation,
    listActions: controller.listActions,
    playAction: controller.playAction,
    say: controller.say,
    moveTo: controller.moveTo,
    setEnabled: controller.setEnabled,
    setPet: controller.setPet,
    getState: controller.getState
  };
})(typeof window !== "undefined" ? window : globalThis);

