/**
 * Milvus Habit Stats Jar Engine (Standalone Modular Engine)
 *
 * Provides Monthly Habit Statistics Jar (2D Glass Bead Physics + Interactive SVG Pie Chart)
 * for Couple Space -> 沧海一刻 (我的习惯 & TA的习惯), keeping app.min.js untouched and
 * moment_calendar_app.js ultra-clean.
 */
(function (global) {
  "use strict";

  var PERIOD_HABIT_ID = "habit_user_period";
  var MAX_RENDER_BEADS = 55;

  var STATUS_META = {
    done: {
      key: "done",
      label: "顺利完成",
      shortLabel: "完成",
      color: "#5E9E76",
      highlight: "#A7DFB9",
      stroke: "#3F7655",
      symbol: "✓",
      softBg: "rgba(94, 158, 118, 0.13)",
      textColor: "#3D6E50"
    },
    slacked: {
      key: "slacked",
      label: "偷懒摸鱼",
      shortLabel: "摸鱼",
      color: "#8B9BB4",
      highlight: "#D4DFEE",
      stroke: "#64748B",
      symbol: "z",
      softBg: "rgba(139, 155, 180, 0.16)",
      textColor: "#475569"
    },
    chaos: {
      key: "chaos",
      label: "意外翻车",
      shortLabel: "翻车",
      color: "#E05A5A",
      highlight: "#FCA5A5",
      stroke: "#B91C1C",
      symbol: "!",
      softBg: "rgba(224, 90, 90, 0.13)",
      textColor: "#B91C1C"
    }
  };

  var STATUS_ORDER = ["done", "slacked", "chaos"];

  // ==================== Pure Data & Sampling Utilities ====================

  function normalizeHabitStatus(log) {
    if (!log || typeof log !== "object") return null;
    if (log.status === "done" || log.status === "slacked" || log.status === "chaos") {
      return log.status;
    }
    if (log.done || log.checked) return "done";
    return null;
  }

  function isNonPeriodHabit(def) {
    return !!(def && def.id && def.type !== "period" && def.id !== PERIOD_HABIT_ID);
  }

  function countStatuses(statuses) {
    var counts = { done: 0, slacked: 0, chaos: 0 };
    if (!Array.isArray(statuses)) return counts;
    for (var i = 0; i < statuses.length; i++) {
      var s = statuses[i];
      if (counts[s] !== undefined) counts[s]++;
    }
    return counts;
  }

  /**
   * Proportionally sample beads when count > maxCount so the jar never overflows
   * while guaranteeing every non-zero status keeps at least 1 visible bead.
   */
  function sampleBeadsProportionally(statuses, maxCount) {
    var limit = maxCount || MAX_RENDER_BEADS;
    if (!Array.isArray(statuses) || statuses.length <= limit) {
      return Array.isArray(statuses) ? statuses.slice() : [];
    }
    var counts = countStatuses(statuses);
    var total = statuses.length;
    var presentKeys = STATUS_ORDER.filter(function (k) {
      return counts[k] > 0;
    });

    var alloc = { done: 0, slacked: 0, chaos: 0 };
    var used = 0;
    for (var i = 0; i < presentKeys.length; i++) {
      var k = presentKeys[i];
      var share = Math.max(1, Math.floor((counts[k] / total) * limit));
      alloc[k] = share;
      used += share;
    }

    // Trim if min-1 caused overshoot
    while (used > limit) {
      var maxKey = presentKeys.reduce(function (best, cur) {
        return alloc[cur] > alloc[best] ? cur : best;
      }, presentKeys[0]);
      if (alloc[maxKey] <= 1) break;
      alloc[maxKey]--;
      used--;
    }

    // Distribute remaining slots by largest fractional remainder
    while (used < limit) {
      var bestKey = presentKeys[0];
      var bestDiff = -Infinity;
      for (var j = 0; j < presentKeys.length; j++) {
        var key = presentKeys[j];
        var ideal = (counts[key] / total) * limit;
        var diff = ideal - alloc[key];
        if (diff > bestDiff) {
          bestDiff = diff;
          bestKey = key;
        }
      }
      alloc[bestKey]++;
      used++;
    }

    // Interleave deterministically so colors mix naturally as they drop
    var result = [];
    var rem = { done: alloc.done, slacked: alloc.slacked, chaos: alloc.chaos };
    var guard = 0;
    while (result.length < limit && guard < limit * 4) {
      guard++;
      for (var m = 0; m < STATUS_ORDER.length; m++) {
        var sk = STATUS_ORDER[m];
        if (rem[sk] > 0 && result.length < limit) {
          result.push(sk);
          rem[sk]--;
        }
      }
    }
    return result;
  }

  /**
   * Pure aggregation helper (unit-testable without React/DOM).
   */
  function aggregateMonthHabits(params) {
    var userDefs = (params.userDefs || []).filter(isNonPeriodHabit);
    var charDefs = (params.charDefs || []).filter(isNonPeriodHabit);
    var logsByHabitId = params.logsByHabitId || {};
    var year = params.year;
    var monthIndex = params.monthIndex;
    var scopeMode = params.scopeMode || "all"; // "all" | "current"
    var activeHabitId = params.activeHabitId || "";
    var activeOwnerTab = params.activeOwnerTab || "user";

    var monthPrefix =
      String(year) + "-" + String(monthIndex + 1).padStart(2, "0") + "-";

    var targetUserDefs =
      scopeMode === "current" && activeOwnerTab === "user" && activeHabitId
        ? userDefs.filter(function (d) {
            return d.id === activeHabitId;
          })
        : userDefs;

    var targetCharDefs =
      scopeMode === "current" && activeOwnerTab === "char" && activeHabitId
        ? charDefs.filter(function (d) {
            return d.id === activeHabitId;
          })
        : charDefs;

    var userStatuses = [];
    var charStatuses = [];
    var userDateMap = {}; // dateStr -> { any, slackOrChaos }
    var charDateMap = {};

    function collect(defs, outStatuses, dateMap) {
      for (var i = 0; i < defs.length; i++) {
        var logs = logsByHabitId[defs[i].id] || [];
        for (var j = 0; j < logs.length; j++) {
          var lg = logs[j];
          if (!lg || !lg.date || lg.date.indexOf(monthPrefix) !== 0) continue;
          var st = normalizeHabitStatus(lg);
          if (!st) continue;
          outStatuses.push(st);
          if (!dateMap[lg.date]) dateMap[lg.date] = { any: true, slackOrChaos: false };
          if (st === "slacked" || st === "chaos") {
            dateMap[lg.date].slackOrChaos = true;
          }
        }
      }
    }

    collect(targetUserDefs, userStatuses, userDateMap);
    collect(targetCharDefs, charStatuses, charDateMap);

    var coDays = 0;
    var coSlackOrChaosDays = 0;
    var userDates = Object.keys(userDateMap);
    for (var d = 0; d < userDates.length; d++) {
      var ds = userDates[d];
      if (charDateMap[ds]) {
        coDays++;
        if (userDateMap[ds].slackOrChaos && charDateMap[ds].slackOrChaos) {
          coSlackOrChaosDays++;
        }
      }
    }

    var userCounts = countStatuses(userStatuses);
    var charCounts = countStatuses(charStatuses);
    var bothCounts = {
      done: userCounts.done + charCounts.done,
      slacked: userCounts.slacked + charCounts.slacked,
      chaos: userCounts.chaos + charCounts.chaos
    };

    return {
      userStatuses: userStatuses,
      charStatuses: charStatuses,
      userCounts: userCounts,
      charCounts: charCounts,
      bothCounts: bothCounts,
      userTotal: userStatuses.length,
      charTotal: charStatuses.length,
      bothTotal: userStatuses.length + charStatuses.length,
      coDays: coDays,
      coSlackOrChaosDays: coSlackOrChaosDays
    };
  }

  // ==================== Animation Style Injection ====================

  function ensureJarShakeAnimation() {
    if (typeof document === "undefined") return;
    if (document.getElementById("milvus-habit-jar-anim-style")) return;
    var style = document.createElement("style");
    style.id = "milvus-habit-jar-anim-style";
    style.textContent =
      "@keyframes habitJarShake {" +
      "0%,100%{transform:translateX(0) rotate(0deg);}" +
      "18%{transform:translateX(-5px) rotate(-4deg);}" +
      "38%{transform:translateX(5px) rotate(4deg);}" +
      "58%{transform:translateX(-4px) rotate(-2.5deg);}" +
      "78%{transform:translateX(3px) rotate(2deg);}" +
      "}";
    document.head.appendChild(style);
  }

  // ==================== Component 1: Hand-Drawn SVG Stats Icon Button ====================

  function StatsIconButton(props) {
    var React = global.React;
    if (!React) return null;
    var h = React.createElement;
    var active = !!(props && props.active);
    var onClick = props && props.onClick;

    return h(
      "button",
      {
        type: "button",
        onClick: onClick,
        title: "习惯月度统计罐",
        "aria-label": "习惯月度统计罐",
        style: {
          width: "28px",
          height: "28px",
          borderRadius: "999px",
          border: active ? "1px solid #E2B46D" : "1px solid #E5E0D8",
          background: active ? "#FFF7ED" : "#FFFFFF",
          color: active ? "#9A5B13" : "#57534E",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
          flexShrink: 0,
          boxShadow: active ? "0 1px 4px rgba(226,180,109,0.28)" : "none",
          transition: "all 0.15s ease"
        }
      },
      h(
        "svg",
        {
          width: 16,
          height: 16,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 1.85,
          strokeLinecap: "round",
          strokeLinejoin: "round"
        },
        // Hand-drawn jar lid & neck
        h("path", { d: "M7.5 4h9" }),
        h("path", { d: "M8.8 4v2.1a4.2 4.2 0 0 0-3.3 4.1V17.6A3.4 3.4 0 0 0 8.9 21h6.2a3.4 3.4 0 0 0 3.4-3.4v-7.4a4.2 4.2 0 0 0-3.3-4.1V4" }),
        // Three colored beads inside jar: done (green), slacked (slate-blue), chaos (coral)
        h("circle", { cx: 9.6, cy: 16.4, r: 2.0, fill: "#5E9E76", stroke: "none" }),
        h("circle", { cx: 14.4, cy: 16.4, r: 2.0, fill: "#8B9BB4", stroke: "none" }),
        h("circle", { cx: 12.1, cy: 12.4, r: 1.9, fill: "#E05A5A", stroke: "none" })
      )
    );
  }

  // ==================== Component 2: 2D Glass Bead Physics Jar ====================

  function drawGlassBead(ctx, b) {
    var meta = STATUS_META[b.status] || STATUS_META.done;
    var r = b.r;

    ctx.save();
    ctx.translate(b.x, b.y);

    // 1. Soft radial gradient sphere (top-left light source)
    var grad = ctx.createRadialGradient(-r * 0.32, -r * 0.34, r * 0.1, 0, 0, r);
    grad.addColorStop(0, meta.highlight);
    grad.addColorStop(0.55, meta.color);
    grad.addColorStop(1, meta.stroke);

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Subtle rim for clear bead separation
    ctx.lineWidth = 0.85;
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.stroke();

    // 2. Specular glass highlight dot
    ctx.beginPath();
    ctx.ellipse(-r * 0.32, -r * 0.34, r * 0.24, r * 0.15, -0.55, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.58)";
    ctx.fill();

    // 3. Subtle rotated status glyph inside bead
    if (r >= 9.5) {
      ctx.rotate(b.angle);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "700 " + Math.round(r * 0.92) + "px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(meta.symbol, 0, 0.5);
    }

    ctx.restore();
  }

  function HabitBeadJarPhysics(props) {
    var React = global.React;
    if (!React) return null;
    var h = React.createElement;
    var useEffect = React.useEffect;
    var useRef = React.useRef;
    var useState = React.useState;

    var title = props.title;
    var subtitle = props.subtitle;
    var statuses = props.statuses || [];
    var shakeSignal = props.shakeSignal || 0;
    var onJarClick = props.onJarClick;

    var canvasRef = useRef(null);
    var ballsRef = useRef([]);
    var wakeRef = useRef(null);
    var [shaking, setShaking] = useState(false);

    var W = 166;
    var H = 228;
    var LEFT = 24;
    var RIGHT = W - 24;
    var FLOOR = H - 28;
    var CEIL = 34;

    var statusKey = statuses.join(",");

    useEffect(
      function () {
        ensureJarShakeAnimation();
        var canvas = canvasRef.current;
        if (!canvas) return;
        var ctx = canvas.getContext("2d");
        var dpr = Math.min((global.devicePixelRatio || 1), 2);
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        var sampled = sampleBeadsProportionally(statuses, MAX_RENDER_BEADS);
        var count = sampled.length;
        var radius =
          count <= 8 ? 20 : count <= 18 ? 15 : count <= 32 ? 12 : 9.5;
        var spawnGap = count <= 15 ? 6 : count <= 32 ? 4 : 2;

        ballsRef.current = sampled.map(function (st, idx) {
          return {
            x: W / 2 + (Math.random() - 0.5) * 46,
            y: 24,
            vx: (Math.random() - 0.5) * 2.2,
            vy: 1.0 + Math.random() * 0.9,
            r: radius,
            angle: (Math.random() - 0.5) * 0.5,
            vAngle: (Math.random() - 0.5) * 0.08,
            spawnFrame: idx * spawnGap,
            active: false,
            status: st
          };
        });

        var frame = 0;
        var calmFrames = 0;
        var rafId = 0;
        var sleeping = false;
        var unmounted = false;

        function renderFrame() {
          ctx.clearRect(0, 0, W, H);
          var balls = ballsRef.current;
          for (var i = 0; i < balls.length; i++) {
            if (balls[i].active) drawGlassBead(ctx, balls[i]);
          }
        }

        function step() {
          if (unmounted) return;
          frame++;
          var balls = ballsRef.current;
          var allActive = true;
          var totalEnergy = 0;

          for (var i = 0; i < balls.length; i++) {
            var b = balls[i];
            if (!b.active) {
              if (frame >= b.spawnFrame) {
                b.active = true;
                b.y = 20;
              } else {
                allActive = false;
                continue;
              }
            }
            b.vy += 0.38;
            b.vx *= 0.992;
            b.vy *= 0.994;
            b.x += b.vx;
            b.y += b.vy;
            b.angle += b.vAngle;
            b.vAngle *= 0.965;

            if (b.x - b.r < LEFT) {
              b.x = LEFT + b.r;
              b.vx = Math.abs(b.vx) * 0.48;
              b.vAngle = b.vy * 0.015;
            } else if (b.x + b.r > RIGHT) {
              b.x = RIGHT - b.r;
              b.vx = -Math.abs(b.vx) * 0.48;
              b.vAngle = -b.vy * 0.015;
            }
            if (b.y + b.r > FLOOR) {
              b.y = FLOOR - b.r;
              if (Math.abs(b.vy) > 1.1) {
                b.vy = -b.vy * 0.38;
              } else {
                b.vy = 0;
              }
              b.vx *= 0.84;
              b.vAngle *= 0.8;
            }
            if (b.y - b.r < CEIL && b.vy < 0) {
              b.y = CEIL + b.r;
              b.vy = Math.abs(b.vy) * 0.35;
            }
          }

          for (var iter = 0; iter < 4; iter++) {
            for (var aIdx = 0; aIdx < balls.length; aIdx++) {
              var a = balls[aIdx];
              if (!a.active) continue;
              for (var bIdx = aIdx + 1; bIdx < balls.length; bIdx++) {
                var o = balls[bIdx];
                if (!o.active) continue;
                var dx = o.x - a.x;
                var dy = o.y - a.y;
                var distSq = dx * dx + dy * dy;
                var minDist = a.r + o.r - 0.4;
                if (distSq < minDist * minDist && distSq > 0.0001) {
                  var dist = Math.sqrt(distSq);
                  var nx = dx / dist;
                  var ny = dy / dist;
                  var overlap = (minDist - dist) * 0.52;
                  a.x -= nx * overlap;
                  a.y -= ny * overlap;
                  o.x += nx * overlap;
                  o.y += ny * overlap;

                  if (iter === 0) {
                    var rvx = o.vx - a.vx;
                    var rvy = o.vy - a.vy;
                    var vn = rvx * nx + rvy * ny;
                    if (vn < 0) {
                      var impulse = -0.62 * vn;
                      a.vx -= impulse * nx;
                      a.vy -= impulse * ny;
                      o.vx += impulse * nx;
                      o.vy += impulse * ny;
                      a.vAngle += (Math.random() - 0.5) * 0.04;
                      o.vAngle += (Math.random() - 0.5) * 0.04;
                    }
                  }
                }
              }
            }
          }

          for (var k = 0; k < balls.length; k++) {
            var bk = balls[k];
            if (!bk.active) continue;
            if (bk.x - bk.r < LEFT) bk.x = LEFT + bk.r;
            if (bk.x + bk.r > RIGHT) bk.x = RIGHT - bk.r;
            if (bk.y + bk.r > FLOOR) bk.y = FLOOR - bk.r;
            if (bk.y - bk.r < CEIL) bk.y = CEIL + bk.r;
            totalEnergy += bk.vx * bk.vx + bk.vy * bk.vy;
          }

          renderFrame();

          // Sleep when all beads are settled to save mobile battery
          if (balls.length === 0 || (allActive && totalEnergy < 0.08)) {
            calmFrames++;
            if (calmFrames >= 45) {
              sleeping = true;
              rafId = 0;
              return;
            }
          } else {
            calmFrames = 0;
          }

          rafId = requestAnimationFrame(step);
        }

        wakeRef.current = function () {
          if (unmounted) return;
          calmFrames = 0;
          if (sleeping) {
            sleeping = false;
            rafId = requestAnimationFrame(step);
          }
        };

        renderFrame();
        if (sampled.length > 0) {
          rafId = requestAnimationFrame(step);
        }

        return function () {
          unmounted = true;
          if (rafId) cancelAnimationFrame(rafId);
        };
      },
      [statusKey]
    );

    // Trigger bounce on shakeSignal change
    useEffect(
      function () {
        if (!shakeSignal) return;
        setShaking(true);
        var balls = ballsRef.current;
        for (var i = 0; i < balls.length; i++) {
          var b = balls[i];
          if (!b.active) continue;
          b.vy -= 4.8 + Math.random() * 5.2;
          b.vx += (Math.random() - 0.5) * 6.4;
          b.vAngle += (Math.random() - 0.5) * 0.16;
        }
        if (wakeRef.current) wakeRef.current();
        var t = setTimeout(function () {
          setShaking(false);
        }, 500);
        return function () {
          clearTimeout(t);
        };
      },
      [shakeSignal]
    );

    return h(
      "div",
      {
        onClick: onJarClick,
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "6px",
          cursor: "pointer",
          userSelect: "none"
        }
      },
      h(
        "div",
        {
          style: {
            position: "relative",
            width: W + "px",
            height: H + "px",
            animation: shaking ? "habitJarShake 0.48s ease-in-out" : "none"
          }
        },
        h("img", {
          src: "emoji-time/透明罐子.png",
          alt: "习惯罐",
          style: {
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            pointerEvents: "none"
          }
        }),
        h("canvas", {
          ref: canvasRef,
          style: {
            position: "absolute",
            inset: 0,
            width: W + "px",
            height: H + "px",
            pointerEvents: "none"
          }
        }),
        // Glass specular sheen overlay
        h("div", {
          style: {
            position: "absolute",
            left: "24px",
            top: "38px",
            width: "26px",
            height: "120px",
            borderRadius: "999px",
            background: "linear-gradient(180deg, rgba(255,255,255,0.34), rgba(255,255,255,0.03))",
            pointerEvents: "none"
          }
        }),
        statuses.length === 0 &&
          h(
            "div",
            {
              style: {
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                paddingTop: "24px",
                fontSize: "11px",
                color: "#B5ACA2",
                pointerEvents: "none"
              }
            },
            "空空如也"
          )
      ),
      h("div", { style: { fontSize: "12.5px", fontWeight: 700, color: "#292524" } }, title),
      h("div", { style: { fontSize: "11px", color: "#8C857B" } }, subtitle)
    );
  }

  // ==================== Component 3: Interactive SVG Pie Chart ====================

  function polarToCartesian(cx, cy, r, angleDeg) {
    var rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function describeDonutArc(cx, cy, rOuter, rInner, startDeg, endDeg) {
    var sweep = endDeg - startDeg;
    if (sweep >= 359.99) {
      // Full ring drawn as two 180-deg arcs
      var pTop = polarToCartesian(cx, cy, rOuter, 0);
      var pBot = polarToCartesian(cx, cy, rOuter, 180);
      var iTop = polarToCartesian(cx, cy, rInner, 0);
      var iBot = polarToCartesian(cx, cy, rInner, 180);
      return [
        "M", pTop.x, pTop.y,
        "A", rOuter, rOuter, 0, 1, 1, pBot.x, pBot.y,
        "A", rOuter, rOuter, 0, 1, 1, pTop.x, pTop.y,
        "M", iTop.x, iTop.y,
        "A", rInner, rInner, 0, 1, 0, iBot.x, iBot.y,
        "A", rInner, rInner, 0, 1, 0, iTop.x, iTop.y,
        "Z"
      ].join(" ");
    }
    var largeArc = sweep > 180 ? 1 : 0;
    var oStart = polarToCartesian(cx, cy, rOuter, startDeg);
    var oEnd = polarToCartesian(cx, cy, rOuter, endDeg);
    var iEnd = polarToCartesian(cx, cy, rInner, endDeg);
    var iStart = polarToCartesian(cx, cy, rInner, startDeg);

    return [
      "M", oStart.x, oStart.y,
      "A", rOuter, rOuter, 0, largeArc, 1, oEnd.x, oEnd.y,
      "L", iEnd.x, iEnd.y,
      "A", rInner, rInner, 0, largeArc, 0, iStart.x, iStart.y,
      "Z"
    ].join(" ");
  }

  function HabitStatusPieChart(props) {
    var React = global.React;
    if (!React) return null;
    var h = React.createElement;
    var useState = React.useState;

    var counts = props.counts || { done: 0, slacked: 0, chaos: 0 };
    var total = props.total || 0;
    var centerLabel = props.centerLabel || "本月统计";

    var [selectedStatus, setSelectedStatus] = useState(null);

    var cx = 68;
    var cy = 68;
    var rOuterBase = 56;
    var rInner = 34;

    var slices = [];
    if (total > 0) {
      var cursor = 0;
      for (var i = 0; i < STATUS_ORDER.length; i++) {
        var k = STATUS_ORDER[i];
        var val = counts[k] || 0;
        if (val <= 0) continue;
        var sweep = (val / total) * 360;
        slices.push({
          key: k,
          val: val,
          pct: Math.round((val / total) * 100),
          startDeg: cursor,
          endDeg: cursor + sweep,
          meta: STATUS_META[k]
        });
        cursor += sweep;
      }
    }

    var focusKey = selectedStatus && counts[selectedStatus] > 0 ? selectedStatus : null;
    var centerPct =
      total === 0
        ? "0%"
        : focusKey
        ? Math.round((counts[focusKey] / total) * 100) + "%"
        : Math.round(((counts.done || 0) / total) * 100) + "%";
    var centerSub = focusKey
      ? STATUS_META[focusKey].shortLabel + " " + counts[focusKey] + "次"
      : total === 0
      ? "暂无记录"
      : centerLabel + "完成率";

    return h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "14px",
          flexWrap: "wrap",
          justifyContent: "center"
        }
      },
      // Left: SVG Donut Pie
      h(
        "div",
        { style: { position: "relative", width: "136px", height: "136px", flexShrink: 0 } },
        h(
          "svg",
          { width: 136, height: 136, viewBox: "0 0 136 136" },
          total === 0
            ? h("circle", {
                cx: cx,
                cy: cy,
                r: 45,
                fill: "none",
                stroke: "#E7E2DA",
                strokeWidth: 16,
                strokeDasharray: "4 4"
              })
            : slices.map(function (sl) {
                var isSel = focusKey === sl.key;
                var dPath = describeDonutArc(
                  cx,
                  cy,
                  isSel ? rOuterBase + 4 : rOuterBase,
                  rInner,
                  sl.startDeg,
                  sl.endDeg
                );
                return h("path", {
                  key: sl.key,
                  d: dPath,
                  fill: sl.meta.color,
                  stroke: "#FFFFFF",
                  strokeWidth: slices.length > 1 ? 1.5 : 0,
                  style: { cursor: "pointer", transition: "all 0.18s ease" },
                  onClick: function () {
                    setSelectedStatus(isSel ? null : sl.key);
                  }
                });
              })
        ),
        // Center readout
        h(
          "div",
          {
            style: {
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              textAlign: "center",
              padding: "0 16px"
            }
          },
          h(
            "div",
            {
              style: {
                fontSize: "20px",
                fontWeight: 800,
                color: focusKey ? STATUS_META[focusKey].textColor : "#292524",
                lineHeight: 1.1
              }
            },
            centerPct
          ),
          h(
            "div",
            { style: { fontSize: "10.5px", color: "#8C857B", marginTop: "3px" } },
            centerSub
          )
        )
      ),
      // Right: Legend bars
      h(
        "div",
        {
          style: {
            flex: 1,
            minWidth: "152px",
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          }
        },
        STATUS_ORDER.map(function (k) {
          var meta = STATUS_META[k];
          var val = counts[k] || 0;
          var pct = total > 0 ? Math.round((val / total) * 100) : 0;
          var isSel = focusKey === k;
          return h(
            "div",
            {
              key: k,
              onClick: function () {
                if (val > 0) setSelectedStatus(isSel ? null : k);
              },
              style: {
                padding: "6px 9px",
                borderRadius: "10px",
                background: isSel ? meta.softBg : "#FAF9F7",
                border: isSel ? "1px solid " + meta.color : "1px solid #EFECE6",
                cursor: val > 0 ? "pointer" : "default",
                transition: "all 0.15s ease"
              }
            },
            h(
              "div",
              {
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "12px",
                  marginBottom: "4px"
                }
              },
              h(
                "span",
                { style: { display: "inline-flex", alignItems: "center", gap: "6px", color: "#292524", fontWeight: 600 } },
                h("span", {
                  style: {
                    width: "9px",
                    height: "9px",
                    borderRadius: "50%",
                    background: meta.color,
                    display: "inline-block"
                  }
                }),
                meta.label
              ),
              h(
                "span",
                { style: { fontSize: "11.5px", color: meta.textColor, fontWeight: 700 } },
                val + "次 · " + pct + "%"
              )
            ),
            h(
              "div",
              {
                style: {
                  width: "100%",
                  height: "4px",
                  borderRadius: "999px",
                  background: "#EDE8E0",
                  overflow: "hidden"
                }
              },
              h("div", {
                style: {
                  width: pct + "%",
                  height: "100%",
                  borderRadius: "999px",
                  background: meta.color,
                  transition: "width 0.3s ease"
                }
              })
            )
          );
        })
      )
    );
  }

  // ==================== Component 4: Full Monthly Habit Stats View ====================

  function HabitStatsView(props) {
    var React = global.React;
    if (!React) return null;
    var h = React.createElement;
    var useEffect = React.useEffect;
    var useRef = React.useRef;
    var useState = React.useState;

    var charId = props.charId || "";
    var charName = props.charName || "TA";
    var year = props.year;
    var monthIndex = props.monthIndex;
    var onShiftMonth = props.onShiftMonth;
    var onBack = props.onBack;
    var activeHabit = props.activeHabit || null;
    var activeOwnerTab = props.activeOwnerTab || "user";
    var onExportNode = props.onExportNode;
    var isExporting = !!props.isExporting;

    var [scopeMode, setScopeMode] = useState("all"); // "all" | "current"
    var [pieOwner, setPieOwner] = useState("both"); // "both" | "user" | "char"
    var [jarShakeSignal, setJarShakeSignal] = useState(0);
    var [loading, setLoading] = useState(true);
    var [statsData, setStatsData] = useState({
      userStatuses: [],
      charStatuses: [],
      userCounts: { done: 0, slacked: 0, chaos: 0 },
      charCounts: { done: 0, slacked: 0, chaos: 0 },
      bothCounts: { done: 0, slacked: 0, chaos: 0 },
      userTotal: 0,
      charTotal: 0,
      bothTotal: 0,
      coDays: 0,
      coSlackOrChaosDays: 0
    });

    var exportRef = useRef(null);
    var reqSeqRef = useRef(0);

    var canUseCurrentScope = !!(activeHabit && isNonPeriodHabit(activeHabit));
    var effectiveScope = canUseCurrentScope ? scopeMode : "all";

    useEffect(
      function () {
        var seq = ++reqSeqRef.current;
        setLoading(true);

        (async function () {
          try {
            var store = global.momentCalendarStore;
            if (!store || typeof store.getHabitDefsByScope !== "function") {
              if (seq === reqSeqRef.current) setLoading(false);
              return;
            }
            var pair = await Promise.all([
              store.getHabitDefsByScope("user"),
              charId ? store.getHabitDefsByScope("char_" + charId) : Promise.resolve([])
            ]);
            var uDefs = (pair[0] || []).filter(isNonPeriodHabit);
            var cDefs = (pair[1] || []).filter(isNonPeriodHabit);
            var allDefs = uDefs.concat(cDefs);

            var logsList = await Promise.all(
              allDefs.map(function (d) {
                return store.getHabitLogsByHabit(d.id).catch(function () {
                  return [];
                });
              })
            );
            if (seq !== reqSeqRef.current) return;

            var logsByHabitId = {};
            for (var i = 0; i < allDefs.length; i++) {
              logsByHabitId[allDefs[i].id] = logsList[i] || [];
            }

            var aggregated = aggregateMonthHabits({
              userDefs: uDefs,
              charDefs: cDefs,
              logsByHabitId: logsByHabitId,
              year: year,
              monthIndex: monthIndex,
              scopeMode: effectiveScope,
              activeHabitId: activeHabit ? activeHabit.id : "",
              activeOwnerTab: activeOwnerTab
            });

            if (seq === reqSeqRef.current) {
              setStatsData(aggregated);
              setLoading(false);
            }
          } catch (_) {
            if (seq === reqSeqRef.current) setLoading(false);
          }
        })();
      },
      [charId, year, monthIndex, effectiveScope, activeHabit ? activeHabit.id : "", activeOwnerTab]
    );

    var handleShakeJars = function () {
      setJarShakeSignal(function (s) {
        return s + 1;
      });
    };

    var activePieCounts =
      pieOwner === "user"
        ? statsData.userCounts
        : pieOwner === "char"
        ? statsData.charCounts
        : statsData.bothCounts;
    var activePieTotal =
      pieOwner === "user"
        ? statsData.userTotal
        : pieOwner === "char"
        ? statsData.charTotal
        : statsData.bothTotal;

    return h(
      "div",
      {
        style: {
          flex: 1,
          overflowY: "auto",
          background: "#FAF9F7",
          padding: "14px 14px 36px",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }
      },
      // Top navigation & month switcher bar
      h(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "6px",
            flexShrink: 0
          }
        },
        h(
          "button",
          {
            type: "button",
            onClick: onBack,
            style: {
              border: "1px solid #E5E0D8",
              background: "#FFFFFF",
              color: "#44403C",
              fontSize: "11.5px",
              fontWeight: 600,
              borderRadius: "999px",
              padding: "4px 10px",
              cursor: "pointer"
            }
          },
          "‹ 返回日历"
        ),
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "6px" } },
          h(
            "button",
            {
              type: "button",
              onClick: function () {
                if (onShiftMonth) onShiftMonth(-1);
              },
              style: {
                border: "1px solid #EAEAEA",
                background: "#FFFFFF",
                borderRadius: "8px",
                width: "26px",
                height: "26px",
                cursor: "pointer"
              }
            },
            "‹"
          ),
          h(
            "span",
            { style: { fontSize: "14px", fontWeight: 700, color: "#292524" } },
            year + "年 " + (monthIndex + 1) + "月"
          ),
          h(
            "button",
            {
              type: "button",
              onClick: function () {
                if (onShiftMonth) onShiftMonth(1);
              },
              style: {
                border: "1px solid #EAEAEA",
                background: "#FFFFFF",
                borderRadius: "8px",
                width: "26px",
                height: "26px",
                cursor: "pointer"
              }
            },
            "›"
          )
        ),
        h(
          "button",
          {
            type: "button",
            disabled: isExporting,
            onClick: function () {
              if (onExportNode) {
                onExportNode(
                  exportRef,
                  "沧海一刻_习惯彩珠罐_" + year + "_" + (monthIndex + 1)
                );
              }
            },
            style: {
              border: "1px solid #E2B46D",
              background: "#FFF8EB",
              color: "#9A5B13",
              fontSize: "11.5px",
              borderRadius: "999px",
              padding: "4px 10px",
              cursor: isExporting ? "not-allowed" : "pointer"
            }
          },
          isExporting ? "导出中…" : "导出纪念图"
        )
      ),

      // Scope filter strip (All habits vs Current selected habit)
      canUseCurrentScope &&
        h(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "center",
              flexShrink: 0
            }
          },
          h(
            "div",
            {
              style: {
                display: "inline-flex",
                background: "#EFECE6",
                borderRadius: "999px",
                padding: "3px",
                gap: "2px"
              }
            },
            [
              { id: "all", label: "全部习惯汇总" },
              { id: "current", label: "仅看「" + (activeHabit.name || "当前习惯") + "」" }
            ].map(function (opt) {
              var active = effectiveScope === opt.id;
              return h(
                "button",
                {
                  key: opt.id,
                  type: "button",
                  onClick: function () {
                    setScopeMode(opt.id);
                  },
                  style: {
                    border: "none",
                    borderRadius: "999px",
                    padding: "4px 12px",
                    fontSize: "11.5px",
                    fontWeight: active ? 600 : 400,
                    background: active ? "#FFFFFF" : "transparent",
                    color: active ? "#292524" : "#78716C",
                    boxShadow: active ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
                    cursor: "pointer"
                  }
                },
                opt.label
              );
            })
          )
        ),

      // Main exportable stage: Dual Bead Jars + Highlight Strip + Pie Chart
      h(
        "div",
        {
          ref: exportRef,
          style: {
            background: "#FFFFFF",
            border: "1px solid #EFECE6",
            borderRadius: "18px",
            padding: "16px 10px 18px",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }
        },
        h(
          "div",
          { style: { textAlign: "center", fontSize: "12px", color: "#8C857B" } },
          loading
            ? "正在把本月彩珠装入玻璃罐…"
            : "点击任意彩珠罐摇一摇 ✨ · 绿完成 / 蓝灰摸鱼 / 红翻车"
        ),
        h(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-around",
              alignItems: "flex-end",
              gap: "6px"
            }
          },
          h(HabitBeadJarPhysics, {
            title: "我的习惯罐",
            subtitle:
              statsData.userTotal > MAX_RENDER_BEADS
                ? "本月共 " + statsData.userTotal + " 次（等比展示）"
                : "本月已装入 " + statsData.userTotal + " 颗",
            statuses: statsData.userStatuses,
            shakeSignal: jarShakeSignal,
            onJarClick: handleShakeJars
          }),
          h(HabitBeadJarPhysics, {
            title: charName + " 的习惯罐",
            subtitle:
              statsData.charTotal > MAX_RENDER_BEADS
                ? "本月共 " + statsData.charTotal + " 次（等比展示）"
                : "本月已装入 " + statsData.charTotal + " 颗",
            statuses: statsData.charStatuses,
            shakeSignal: jarShakeSignal,
            onJarClick: handleShakeJars
          })
        ),

        // Co-days highlight strip
        h(
          "div",
          {
            style: {
              margin: "2px 8px 0",
              padding: "10px 14px",
              borderRadius: "12px",
              background: "#FAF8F4",
              border: "1px solid #EFEAE0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "6px",
              fontSize: "12px",
              color: "#57534E"
            }
          },
          h("span", null, "本月双人同行打卡 " + statsData.coDays + " 天"),
          h(
            "span",
            { style: { fontWeight: 700, color: "#5E9E76" } },
            statsData.coSlackOrChaosDays > 0
              ? "同日摸鱼/翻车 " + statsData.coSlackOrChaosDays + " 天 🐟"
              : "双人完成率 " +
                  (statsData.bothTotal > 0
                    ? Math.round((statsData.bothCounts.done / statsData.bothTotal) * 100)
                    : 0) +
                  "%"
          )
        ),

        // Pie Chart Card
        h(
          "div",
          {
            style: {
              margin: "2px 6px 0",
              padding: "14px",
              borderRadius: "14px",
              background: "#FFFFFF",
              border: "1px solid #EFECE6",
              display: "flex",
              flexDirection: "column",
              gap: "12px"
            }
          },
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h(
              "span",
              { style: { fontSize: "13px", fontWeight: 700, color: "#292524" } },
              "月度习惯三态饼图"
            ),
            h(
              "div",
              {
                style: {
                  display: "inline-flex",
                  background: "#F3F4F6",
                  borderRadius: "999px",
                  padding: "2px"
                }
              },
              [
                { id: "both", label: "双人" },
                { id: "user", label: "我" },
                { id: "char", label: charName }
              ].map(function (sc) {
                var active = pieOwner === sc.id;
                return h(
                  "button",
                  {
                    key: sc.id,
                    type: "button",
                    onClick: function () {
                      setPieOwner(sc.id);
                    },
                    style: {
                      border: "none",
                      borderRadius: "999px",
                      padding: "3px 9px",
                      fontSize: "11px",
                      fontWeight: active ? 600 : 400,
                      background: active ? "#FFFFFF" : "transparent",
                      color: active ? "#292524" : "#78716C",
                      cursor: "pointer"
                    }
                  },
                  sc.label
                );
              })
            )
          ),
          h(HabitStatusPieChart, {
            counts: activePieCounts,
            total: activePieTotal,
            centerLabel:
              pieOwner === "both" ? "双人" : pieOwner === "user" ? "我的" : charName
          })
        )
      )
    );
  }

  global.HabitStatsJarEngine = {
    version: "1.0.0",
    STATUS_META: STATUS_META,
    MAX_RENDER_BEADS: MAX_RENDER_BEADS,
    normalizeHabitStatus: normalizeHabitStatus,
    sampleBeadsProportionally: sampleBeadsProportionally,
    aggregateMonthHabits: aggregateMonthHabits,
    StatsIconButton: StatsIconButton,
    HabitBeadJarPhysics: HabitBeadJarPhysics,
    HabitStatusPieChart: HabitStatusPieChart,
    HabitStatsView: HabitStatsView
  };
})(typeof window !== "undefined" ? window : globalThis);

