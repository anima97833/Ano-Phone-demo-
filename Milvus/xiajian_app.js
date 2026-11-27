/**
 * Milvus/xiajian_app.js
 * 主屏幕应用「狭间 · 天道收容所」独立全屏 UI 模块（Step 3）
 *
 * 严格遵循：
 * - 全页面零 Emoji，100% 定制极简矢量 SVG
 * - WebGL 实时氛围着色器背景（雾气/裂隙脉动/飘浮余烬，随危险等级 1~5 动态变幻）
 * - 1:1 复刻三张参考图：
 *     图 1：仙人观测日志（做旧羊皮纸机密手札 + turn.js 真实物理翻页 + 矢量 SVG 鬼画符污染层）
 *     图 2：收容物活点地图（折叠羊皮纸 + Ⅰ~Ⅶ 罗马数字节点 + 活点地图实时巡游点位 + 黄铜罗盘）
 *     图 3：收容物机密档案（红黑牛皮文件夹 + 燕尾夹 + 留空相框 + 手绘红圈灾级 + 撕裂横线便签 + 涂黑解密）
 * - 携名士双人巡视剧场（7分克系规则怪谈 × 5分角色反差，仅在狭间内演绎完结）
 * - 用户自建收容物 + 简单简介 AI 一键润色
 */
(function (global) {
  "use strict";

  // ==================== 1. WebGL Atmospheric Shader Backdrop ====================

  var VERT_SRC =
    "attribute vec2 a_pos;" +
    "void main(){gl_Position=vec4(a_pos,0.0,1.0);}";

  var FRAG_SRC =
    "precision mediump float;" +
    "uniform vec2 u_res;" +
    "uniform float u_time;" +
    "uniform vec3 u_colorA;" +
    "uniform vec3 u_colorB;" +
    "uniform float u_intensity;" +
    "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}" +
    "float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);" +
    "float a=hash(i);float b=hash(i+vec2(1.0,0.0));float c=hash(i+vec2(0.0,1.0));float d=hash(i+vec2(1.0,1.0));" +
    "return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}" +
    "float fbm(vec2 p){float v=0.0;float a=0.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.05;a*=0.5;}return v;}" +
    "void main(){" +
    "vec2 uv=gl_FragCoord.xy/u_res.xy;" +
    "vec2 p=uv*vec2(u_res.x/max(u_res.y,1.0),1.0);" +
    "float t=u_time*0.18;" +
    "float n1=fbm(p*2.6+vec2(t,-t*0.7));" +
    "float n2=fbm(p*4.8-vec2(t*0.6,t*0.9)+n1*1.3);" +
    "float rift=smoothstep(0.56,0.78,abs(sin(p.x*3.2+n2*3.4-t))*n2);" +
    "vec3 base=mix(vec3(0.08,0.09,0.10),u_colorA,n1*0.65);" +
    "base=mix(base,u_colorB,rift*0.55*u_intensity);" +
    // Subtle floating ash specks
    "vec2 cell=floor(p*18.0+vec2(0.0,-u_time*0.45));" +
    "float speck=step(0.986,hash(cell))*smoothstep(0.35,0.0,length(fract(p*18.0+vec2(0.0,-u_time*0.45))-0.5));" +
    "base+=u_colorB*speck*0.55*u_intensity;" +
    // Soft dark vignette
    "float vig=smoothstep(0.95,0.22,length(uv-0.5));" +
    "gl_FragColor=vec4(base*(0.55+0.45*vig),1.0);" +
    "}";

  var MOOD_PALETTES = {
    jade_mist: { a: [0.16, 0.30, 0.27], b: [0.38, 0.66, 0.56] },
    amber_dust: { a: [0.28, 0.22, 0.14], b: [0.76, 0.52, 0.24] },
    crimson_rift: { a: [0.26, 0.10, 0.10], b: [0.78, 0.24, 0.20] },
    void_ash: { a: [0.14, 0.11, 0.14], b: [0.82, 0.28, 0.22] }
  };

  function XiajianWebGLBackdrop(props) {
    var React = global.React;
    if (!React) return null;
    var h = React.createElement;
    var useEffect = React.useEffect;
    var useRef = React.useRef;

    var mood = (props && props.mood) || "jade_mist";
    var intensity = Number((props && props.intensity) || 0.55);
    var canvasRef = useRef(null);
    var moodRef = useRef({ mood: mood, intensity: intensity });
    moodRef.current = { mood: mood, intensity: intensity };

    useEffect(function () {
      var canvas = canvasRef.current;
      if (!canvas) return;
      var gl = null;
      try {
        gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" }) ||
          canvas.getContext("experimental-webgl");
      } catch (_) { }
      if (!gl) return;

      function compile(type, src) {
        var sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        return sh;
      }

      var prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT_SRC));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG_SRC));
      gl.linkProgram(prog);
      gl.useProgram(prog);

      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      var locPos = gl.getAttribLocation(prog, "a_pos");
      gl.enableVertexAttribArray(locPos);
      gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);

      var uRes = gl.getUniformLocation(prog, "u_res");
      var uTime = gl.getUniformLocation(prog, "u_time");
      var uColorA = gl.getUniformLocation(prog, "u_colorA");
      var uColorB = gl.getUniformLocation(prog, "u_colorB");
      var uIntensity = gl.getUniformLocation(prog, "u_intensity");

      var start = Date.now();
      var rafId = 0;
      var alive = true;

      function resize() {
        var w = Math.min(canvas.clientWidth || 360, 480);
        var hPx = Math.min(canvas.clientHeight || 640, 820);
        // Half-res for silky 60fps on mobile with minimal GPU load
        canvas.width = Math.max(160, Math.floor(w * 0.6));
        canvas.height = Math.max(240, Math.floor(hPx * 0.6));
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
      resize();

      function render() {
        if (!alive) return;
        var pal = MOOD_PALETTES[moodRef.current.mood] || MOOD_PALETTES.jade_mist;
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, (Date.now() - start) / 1000);
        gl.uniform3f(uColorA, pal.a[0], pal.a[1], pal.a[2]);
        gl.uniform3f(uColorB, pal.b[0], pal.b[1], pal.b[2]);
        gl.uniform1f(uIntensity, moodRef.current.intensity);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        rafId = requestAnimationFrame(render);
      }
      rafId = requestAnimationFrame(render);

      return function () {
        alive = false;
        if (rafId) cancelAnimationFrame(rafId);
      };
    }, []);

    return h("canvas", {
      ref: canvasRef,
      style: {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0
      }
    });
  }

  // ==================== 2. Minimal Vector SVG Icon Library (ZERO Emoji) ====================

  function XjIcon(h, name, opts) {
    var size = (opts && opts.size) || 16;
    var color = (opts && opts.color) || "currentColor";
    var sw = (opts && opts.strokeWidth) || 1.8;
    var common = {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: color,
      strokeWidth: sw,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: { display: "block", flexShrink: 0 }
    };
    switch (name) {
      case "back":
        return h("svg", common, h("path", { d: "M15 5l-7 7 7 7M8 12h11" }));
      case "plus":
        return h("svg", common, h("path", { d: "M12 5v14M5 12h14" }));
      case "close":
        return h("svg", common, h("path", { d: "M6 6l12 12M18 6L6 18" }));
      case "heart_crack":
        return h("svg", common,
          h("path", { d: "M12 20s-7.5-4.8-8.5-9.5C2.8 7 5.2 4.5 8.2 4.5c1.7 0 3 .9 3.8 2.1.8-1.2 2.1-2.1 3.8-2.1 3 0 5.4 2.5 4.7 6C19.5 15.2 12 20 12 20z" }),
          h("path", { d: "M12 7l-1.5 3.2 2.4 1.6L11 15.5" })
        );
      case "lock":
        return h("svg", common,
          h("rect", { x: 5, y: 11, width: 14, height: 10, rx: 2 }),
          h("path", { d: "M8 11V7.5a4 4 0 0 1 8 0V11" })
        );
      case "wave_slash":
        return h("svg", common,
          h("path", { d: "M4 12c2-3 4-3 6 0s4 3 6 0 2-3 4 0" }),
          h("path", { d: "M4 4l16 16" })
        );
      case "blades":
        return h("svg", common,
          h("path", { d: "M5 19L19 5M14 5h5v5M5 5l14 14M5 14v5h5" })
        );
      case "infinity_break":
        return h("svg", common,
          h("path", { d: "M7.5 15.5a3.5 3.5 0 1 1 0-7c2.5 0 4.5 7 9 7a3.5 3.5 0 1 0 0-7c-1.8 0-3.2 1.2-4.5 3" })
        );
      case "folder":
        return h("svg", common,
          h("path", { d: "M3 7a2 2 0 0 1 2-2h4.5l2 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" })
        );
      case "map":
        return h("svg", common,
          h("path", { d: "M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6zM9 4v14M15 6v14" })
        );
      case "book":
        return h("svg", common,
          h("path", { d: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22V5.5z" }),
          h("path", { d: "M8 8h8M8 12h6" })
        );
      case "eye":
        return h("svg", common,
          h("path", { d: "M2.5 12S6.5 6 12 6s9.5 6 9.5 6-4 6-9.5 6S2.5 12 2.5 12z" }),
          h("circle", { cx: 12, cy: 12, r: 2.5 })
        );
      case "spark":
        return h("svg", common,
          h("path", { d: "M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" })
        );
      case "rift":
        return h("svg", common,
          h("circle", { cx: 12, cy: 12, r: 9 }),
          h("path", { d: "M12 3l-2 5 3.5 2.5-3 4.5 2.5 6" })
        );
      case "trash":
        return h("svg", common,
          h("path", { d: "M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" })
        );
      case "camera":
        return h("svg", common,
          h("rect", { x: 3, y: 6, width: 18, height: 13, rx: 2 }),
          h("circle", { cx: 12, cy: 12.5, r: 3 }),
          h("path", { d: "M8 6l1.5-2h5L16 6" })
        );
      case "scroll":
        return h("svg", common,
          h("path", { d: "M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" }),
          h("path", { d: "M8 9h7M8 13h7M8 17h4M19 8h2M19 12h2M19 16h2" })
        );
      default:
        return h("svg", common, h("circle", { cx: 12, cy: 12, r: 6 }));
    }
  }

  // Hand-drawn Home Screen App Icon SVG (exported for Step 4)
  function XiajianHomeIconSvg(h, size) {
    var s = size || 28;
    return h(
      "svg",
      {
        width: s,
        height: s,
        viewBox: "0 0 32 32",
        fill: "none",
        stroke: "#F4E8D4",
        strokeWidth: 1.8,
        strokeLinecap: "round",
        strokeLinejoin: "round"
      },
      // Outer Jianmu tree ring cracked by rift
      h("circle", { cx: 16, cy: 16, r: 11.5, stroke: "#8AC0AB", strokeDasharray: "4 2.5" }),
      h("circle", { cx: 16, cy: 16, r: 7.5, stroke: "#F4E8D4" }),
      // Central crimson heavenly rift crack
      h("path", { d: "M16 4.5 L13.5 12 L18.5 15.5 L14 21.5 L16.5 27.5", stroke: "#E05246", strokeWidth: 2.2 }),
      // Tiny talisman seal bars
      h("path", { d: "M9 11h4M19 21h4", stroke: "#E2B974", strokeWidth: 1.6 })
    );
  }

  // Vector SVG Corruption Glyphs for Observation Logbook (鬼画符污染层)
  function CorruptGlyphSvg(h, glyphType) {
    if (!glyphType || glyphType === "none") return null;
    if (glyphType === "spiral") {
      return h(
        "svg",
        {
          viewBox: "0 0 180 180",
          style: { position: "absolute", right: "6px", bottom: "26px", width: "130px", height: "130px", opacity: 0.24, pointerEvents: "none" }
        },
        h("path", {
          d: "M90 90 m0 -8 a8 8 0 1 1 -8 8 a16 16 0 1 1 16 16 a28 28 0 1 1 -28 -28 a42 42 0 1 1 42 42 a58 58 0 1 1 -58 -58",
          fill: "none",
          stroke: "#8C1D18",
          strokeWidth: 2.4,
          strokeLinecap: "round"
        }),
        h("path", { d: "M24 34 L156 146 M148 28 L34 152", stroke: "#2E1E1A", strokeWidth: 1.2, strokeDasharray: "5 4" })
      );
    }
    if (glyphType === "talisman") {
      return h(
        "svg",
        {
          viewBox: "0 0 140 200",
          style: { position: "absolute", right: "10px", top: "48px", width: "92px", height: "148px", opacity: 0.26, pointerEvents: "none" }
        },
        h("rect", { x: 18, y: 12, width: 104, height: 176, fill: "none", stroke: "#9E261E", strokeWidth: 2.2, strokeDasharray: "8 3" }),
        h("path", { d: "M70 22 v152 M36 52 h68 M42 84 C68 62, 98 106, 40 124 C76 116, 102 152, 62 168", fill: "none", stroke: "#9E261E", strokeWidth: 2.8, strokeLinecap: "round" }),
        h("circle", { cx: 70, cy: 52, r: 9, fill: "none", stroke: "#2B1B17", strokeWidth: 1.8 })
      );
    }
    if (glyphType === "eye") {
      return h(
        "svg",
        {
          viewBox: "0 0 180 120",
          style: { position: "absolute", right: "10px", bottom: "32px", width: "136px", height: "90px", opacity: 0.24, pointerEvents: "none" }
        },
        h("path", { d: "M12 60 Q90 6 168 60 Q90 114 12 60 Z", fill: "none", stroke: "#2E1C18", strokeWidth: 2.6 }),
        h("ellipse", { cx: 90, cy: 60, rx: 12, ry: 34, fill: "#8C1D18" }),
        h("path", { d: "M34 32 L22 18 M146 32 L158 18 M90 16 L90 4", stroke: "#8C1D18", strokeWidth: 2 })
      );
    }
    // scratch
    return h(
      "svg",
      {
        viewBox: "0 0 180 120",
        style: { position: "absolute", right: "8px", bottom: "20px", width: "140px", height: "86px", opacity: 0.22, pointerEvents: "none" }
      },
      h("path", { d: "M18 20 L158 84 M28 40 L166 100 M12 60 L144 112", stroke: "#4B2B23", strokeWidth: 2.2, strokeLinecap: "round" })
    );
  }

  // ==================== 3. Figure 3: 1:1 Red-Black Classified Archive Folder ====================

  function ArchiveFolderCard(props) {
    var React = global.React;
    var h = React.createElement;
    var anomaly = props.anomaly;
    var onUnlockRedacted = props.onUnlockRedacted;
    var onOpenMediaCapture = props.onOpenMediaCapture;
    var catalog = global.XiajianCatalogData || {};
    var traitsDict = catalog.DANGER_TRAITS || {};

    return h(
      "div",
      {
        style: {
          position: "relative",
          background: "#351A19",
          borderRadius: "14px",
          padding: "8px 8px 12px",
          boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
          border: "1.5px solid #6E2D28"
        }
      },
      // Top dark-red folder tab (图3 顶部暗红文件夹标签栏)
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 10px 8px"
          }
        },
        h(
          "div",
          {
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "#8D2621",
              border: "1.5px solid #C65548",
              borderRadius: "6px 14px 4px 4px",
              padding: "4px 14px",
              color: "#1F0D0D",
              fontSize: "13px",
              fontWeight: 900,
              letterSpacing: "3px"
            }
          },
          h("span", null, "狭 间"),
          XjIcon(h, "rift", { size: 14, color: "#1F0D0D", strokeWidth: 2.2 }),
          h("span", null, "档 案")
        ),
        // Black binder clip SVG on top-right (图3 右上黑色金属燕尾夹)
        h(
          "svg",
          { width: 34, height: 28, viewBox: "0 0 36 30" },
          h("rect", { x: 6, y: 2, width: 24, height: 11, rx: 2, fill: "#1B1919", stroke: "#4A4444", strokeWidth: 1.2 }),
          h("path", { d: "M12 13 L16 26 M24 13 L20 26 M16 26 Q18 29 20 26", fill: "none", stroke: "#C9C4BC", strokeWidth: 1.8, strokeLinecap: "round" })
        )
      ),

      // Inner vintage cream dossier sheet with vertical crimson binding string (图3 内页+右侧贯穿红绳)
      h(
        "div",
        {
          style: {
            position: "relative",
            background: "#F4EEE2",
            borderRadius: "6px",
            padding: "12px 14px 16px",
            color: "#29221F",
            overflow: "hidden"
          }
        },
        // Vertical crimson string on right edge
        h("div", {
          style: {
            position: "absolute",
            top: 0,
            bottom: 0,
            right: "10px",
            width: "2.5px",
            background: "#A82420",
            pointerEvents: "none"
          }
        }),

        // Section 1 Black Header Bar: 基本情报 (图3 黑色粗横条)
        h(
          "div",
          {
            style: {
              background: "#1A1717",
              color: "#ECE4D6",
              fontSize: "11.5px",
              fontWeight: 800,
              letterSpacing: "3px",
              padding: "4px 12px",
              textAlign: "right",
              marginRight: "10px",
              marginBottom: "12px"
            }
          },
          "基 本 情 报"
        ),

        // Upper grid: Left Empty Photo Frame (留空) + Right Structured Metadata
        h(
          "div",
          { style: { display: "flex", gap: "12px", alignItems: "flex-start", marginRight: "10px", marginBottom: "14px" } },
          // Left: Polaroid / Black Frame (点击按需采录或重绘影像)
          h(
            "div",
            {
              onClick: function () { if (onOpenMediaCapture) onOpenMediaCapture(anomaly); },
              title: anomaly.imageUrl ? "点击重新采录或替换档案影像" : "点击按需生成或上传档案影像",
              style: {
                position: "relative",
                width: "112px",
                flexShrink: 0,
                background: "#181515",
                padding: "6px 6px 20px",
                transform: "rotate(-2deg)",
                boxShadow: "0 6px 14px rgba(0,0,0,0.28)",
                cursor: "pointer"
              }
            },
            // Checkered washi tape on top
            h("div", {
              style: {
                position: "absolute",
                top: "-8px",
                left: "18px",
                width: "54px",
                height: "14px",
                transform: "rotate(-16deg)",
                backgroundImage:
                  "repeating-linear-gradient(45deg, #2B2D5C 0 5px, #121226 5px 10px)",
                opacity: 0.9,
                zIndex: 2
              }
            }),
            // Archival Photo or Click-to-Capture Empty Frame
            anomaly.imageUrl
              ? h(
                  "div",
                  {
                    style: {
                      position: "relative",
                      width: "100%",
                      height: "126px",
                      background: "#1A1414",
                      overflow: "hidden",
                      border: "1px solid rgba(244,232,212,0.22)"
                    }
                  },
                  h("img", {
                    src: anomaly.imageUrl,
                    alt: anomaly.name,
                    style: {
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                      filter: "contrast(1.06) sepia(0.16)"
                    }
                  }),
                  h(
                    "div",
                    {
                      style: {
                        position: "absolute",
                        right: "3px",
                        bottom: "3px",
                        background: "rgba(18, 15, 14, 0.78)",
                        color: "#F4E8D4",
                        fontSize: "9px",
                        padding: "2px 5px",
                        borderRadius: "3px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px"
                      }
                    },
                    XjIcon(h, "camera", { size: 9, color: "#F4E8D4" }),
                    "重采"
                  )
                )
              : h(
                  "div",
                  {
                    style: {
                      width: "100%",
                      height: "126px",
                      background: "linear-gradient(180deg, #6E1C1A 0%, #3E1212 100%)",
                      border: "1px dashed rgba(244,232,212,0.45)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      color: "rgba(244,232,212,0.82)",
                      fontSize: "10px",
                      textAlign: "center",
                      padding: "6px",
                      boxSizing: "border-box"
                    }
                  },
                  XjIcon(h, "camera", { size: 22, color: "rgba(244,232,212,0.72)", strokeWidth: 1.6 }),
                  h("span", null, anomaly.code),
                  h("span", { style: { fontSize: "9px", opacity: 0.85, border: "1px solid rgba(244,232,212,0.4)", padding: "1px 5px", borderRadius: "3px" } }, "点击采录影像")
                ),
            // Bottom 3 tiny blossom/seal glyphs on black frame
            h(
              "div",
              { style: { display: "flex", gap: "5px", marginTop: "6px", paddingLeft: "2px" } },
              [0, 1, 2].map(function (i) {
                return h("span", {
                  key: i,
                  style: {
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    border: "1.5px solid #D9CBB8",
                    display: "inline-block"
                  }
                });
              })
            )
          ),

          // Right: Name, Reaction Type, Danger Level Ⅰ~Ⅴ (with hand-drawn red circle!), Response Guide
          h(
            "div",
            { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "8px" } },
            // Name Row
            h(
              "div",
              { style: { borderBottom: "1px solid #C8BEB0", paddingBottom: "5px" } },
              h("div", { style: { fontSize: "10px", color: "#8B7D6E", fontWeight: 700, letterSpacing: "1px" } }, "名 称"),
              h("div", { style: { fontSize: "18px", fontWeight: 900, color: "#1C1817", marginTop: "2px" } }, anomaly.name)
            ),
            // Reaction Type + Scale
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px" } },
              h("span", { style: { background: "#D5CCC0", color: "#4D433B", padding: "1px 6px", fontWeight: 700, fontSize: "10px" } }, "反应类型"),
              h("span", { style: { fontWeight: 800, color: "#2D2522" } }, anomaly.reactionType + " · " + anomaly.scale)
            ),
            // Danger Level Ⅰ Ⅱ Ⅲ Ⅳ Ⅴ with hand-drawn red brush circle (图3 标志性红圈评级)
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
              h("span", { style: { background: "#D5CCC0", color: "#4D433B", padding: "1px 6px", fontWeight: 700, fontSize: "10px" } }, "危险等级"),
              h(
                "div",
                { style: { display: "inline-flex", alignItems: "center", gap: "7px" } },
                [1, 2, 3, 4, 5].map(function (lv) {
                  var romans = ["", "Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ"];
                  var active = anomaly.dangerLevel === lv;
                  return h(
                    "span",
                    {
                      key: lv,
                      style: {
                        position: "relative",
                        fontSize: active ? "14px" : "11.5px",
                        fontWeight: active ? 900 : 600,
                        color: active ? "#1A1514" : "#ADA398",
                        padding: "0 3px"
                      }
                    },
                    romans[lv],
                    active &&
                    h(
                      "svg",
                      {
                        width: 28,
                        height: 26,
                        viewBox: "0 0 30 28",
                        style: { position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }
                      },
                      h("path", {
                        d: "M15 3 C24 2, 28 10, 25 18 C22 25, 11 26, 5 20 C1 15, 4 5, 17 5",
                        fill: "none",
                        stroke: "#B42B24",
                        strokeWidth: 2.3,
                        strokeLinecap: "round"
                      })
                    )
                  );
                })
              )
            ),
            // Containment difficulty + 5D Danger Trait Badges (极简矢量SVG)
            h(
              "div",
              { style: { display: "flex", flexWrap: "wrap", gap: "5px" } },
              h(
                "span",
                { style: { display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "10px", fontWeight: 700, padding: "2px 6px", border: "1px solid #9B8E80", color: "#4A3F37" } },
                XjIcon(h, "lock", { size: 11, color: "#4A3F37" }),
                "收容难度：" + (anomaly.containmentDifficulty || "低")
              ),
              (anomaly.traits || []).map(function (tid) {
                var tr = traitsDict[tid];
                if (!tr) return null;
                return h(
                  "span",
                  {
                    key: tid,
                    style: {
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                      fontSize: "10px",
                      fontWeight: 700,
                      padding: "2px 6px",
                      background: "rgba(180,43,36,0.1)",
                      border: "1px solid rgba(180,43,36,0.4)",
                      color: "#9A221C"
                    }
                  },
                  XjIcon(h, tr.icon, { size: 11, color: "#9A221C" }),
                  tr.label
                );
              })
            ),
            // Response Guide
            h(
              "div",
              { style: { marginTop: "2px" } },
              h("div", { style: { display: "inline-block", background: "#D5CCC0", color: "#4D433B", padding: "1px 6px", fontWeight: 700, fontSize: "10px", marginBottom: "4px" } }, "应对指南"),
              h("div", { style: { fontSize: "11.5px", lineHeight: 1.55, color: "#3B322D" } }, anomaly.responseGuide)
            )
          )
        ),

        // Section 2 Black Header Bar: 怪异情报
        h(
          "div",
          {
            style: {
              background: "#1A1717",
              color: "#ECE4D6",
              fontSize: "11.5px",
              fontWeight: 800,
              letterSpacing: "3px",
              padding: "4px 12px",
              textAlign: "right",
              marginRight: "10px",
              marginBottom: "10px"
            }
          },
          "怪 异 情 报"
        ),

        // Torn Lined Grid Note Paper (图3 下半部分手撕方格便签纸 + 米色胶带)
        h(
          "div",
          {
            style: {
              position: "relative",
              marginRight: "10px",
              backgroundColor: "#FAF7F2",
              backgroundImage:
                "linear-gradient(to right, rgba(160,150,140,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(160,150,140,0.16) 1px, transparent 1px)",
              backgroundSize: "14px 14px",
              border: "1px solid #D8CFC2",
              borderLeft: "18px solid #EDE6DC",
              padding: "14px 14px 16px",
              boxShadow: "0 3px 10px rgba(0,0,0,0.08)"
            }
          },
          // Top masking tape
          h("div", {
            style: {
              position: "absolute",
              top: "-8px",
              left: "16px",
              width: "58px",
              height: "14px",
              background: "rgba(181, 152, 114, 0.72)",
              transform: "rotate(-4deg)"
            }
          }),
          // Notebook holes on left margin
          [16, 46, 76, 106].map(function (topPx) {
            return h("div", {
              key: topPx,
              style: {
                position: "absolute",
                left: "-13px",
                top: topPx + "px",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#D8CEBF"
              }
            });
          }),
          h(
            "div",
            { style: { fontSize: "12.5px", lineHeight: 1.8, color: "#342B26" } },
            anomaly.description
          ),
          // Redacted secret block (click to decrypt)
          anomaly.redactedSecret &&
          h(
            "div",
            {
              onClick: function () {
                if (!anomaly.redactedUnlocked && onUnlockRedacted) onUnlockRedacted(anomaly.id);
              },
              style: {
                marginTop: "10px",
                padding: "8px 10px",
                borderRadius: "4px",
                background: anomaly.redactedUnlocked ? "rgba(180,43,36,0.07)" : "#1E1B1A",
                border: anomaly.redactedUnlocked ? "1px dashed #B42B24" : "1px solid #1E1B1A",
                color: anomaly.redactedUnlocked ? "#7E1F1B" : "#D6CEC2",
                fontSize: "12px",
                lineHeight: 1.65,
                cursor: anomaly.redactedUnlocked ? "default" : "pointer"
              }
            },
            anomaly.redactedUnlocked
              ? h(
                React.Fragment,
                null,
                h("div", { style: { fontSize: "10px", fontWeight: 800, letterSpacing: "1px", marginBottom: "3px" } }, "[ 已验权解密 · 隐秘档案 ]"),
                anomaly.redactedSecret
              )
              : "██████████████████  [ 点击验权揭露涂黑机密 ]"
          )
        )
      )
    );
  }

  // ==================== 4. Figure 2: 1:1 Marauder's Map Live Anomaly Map ====================

  function LiveAnomalyMapCard(props) {
    var React = global.React;
    var h = React.createElement;
    var useEffect = React.useEffect;
    var useState = React.useState;

    var anomaly = props.anomaly;
    var catalog = global.XiajianCatalogData || {};
    var nodes = catalog.MAP_NODES || [];
    var edges = catalog.MAP_EDGES || [];
    var patrol = Array.isArray(anomaly.patrolNodes) && anomaly.patrolNodes.length > 0 ? anomaly.patrolNodes : ["I", "II"];

    var [stepIdx, setStepIdx] = useState(0);

    // Marauder's Map live patrol movement timer
    useEffect(
      function () {
        setStepIdx(0);
        if (patrol.length <= 1) return;
        var timer = setInterval(function () {
          setStepIdx(function (prev) { return (prev + 1) % patrol.length; });
        }, 2500);
        return function () { clearInterval(timer); };
      },
      [anomaly.id]
    );

    var nodeMap = {};
    for (var i = 0; i < nodes.length; i++) nodeMap[nodes[i].id] = nodes[i];
    var activeNodeId = patrol[stepIdx % patrol.length];
    var activeNode = nodeMap[activeNodeId] || nodes[0] || { roman: "Ⅰ", name: "广陵十三坊", region: "扬州", x: 50, y: 78 };

    var radiusByLevel = { 1: 18, 2: 28, 3: 42, 4: 60, 5: 150 };
    var influenceR = radiusByLevel[anomaly.dangerLevel] || 24;

    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "12px" } },
      // Map Parchment Sheet (1:1 复刻图2 折叠羊皮纸地图 + 缎带标题 + Ⅰ~Ⅶ 活点路径 + 左下黄铜罗盘)
      h(
        "div",
        {
          style: {
            position: "relative",
            width: "100%",
            aspectRatio: "360 / 430",
            background: "linear-gradient(180deg, #EBE5D5 0%, #DFD7C4 50%, #E7E0CE 100%)",
            borderRadius: "10px",
            border: "2px solid #BFB49E",
            boxShadow: "0 10px 26px rgba(0,0,0,0.35)",
            overflow: "hidden"
          }
        },
        // Top Ribbon Banner (图2 顶部缎带标题)
        h(
          "div",
          {
            style: {
              position: "absolute",
              top: "8px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 5,
              background: "#F4EFE2",
              border: "1.5px solid #B7AB93",
              padding: "5px 22px",
              boxShadow: "0 3px 8px rgba(0,0,0,0.14)",
              fontSize: "13px",
              fontWeight: 900,
              color: "#3F3830",
              letterSpacing: "3px",
              whiteSpace: "nowrap"
            }
          },
          "东 汉 狭 间 舆 图"
        ),

        // Full-canvas Vector Map SVG (architectural grid + dashed patrol path + Roman nodes + influence ring)
        h(
          "svg",
          {
            viewBox: "0 0 360 430",
            style: { position: "absolute", inset: 0, width: "100%", height: "100%" }
          },
          // Vintage fold creases
          h("line", { x1: 0, y1: 145, x2: 360, y2: 145, stroke: "rgba(90,78,62,0.12)", strokeWidth: 2 }),
          h("line", { x1: 0, y1: 288, x2: 360, y2: 288, stroke: "rgba(90,78,62,0.12)", strokeWidth: 2 }),
          // Stylized Han architecture & courtyard blocks (复刻图2 灰褐古建插画底纹)
          h("g", { fill: "#CEC4AF", stroke: "#9A8F7A", strokeWidth: 1.2, opacity: 0.72 },
            h("rect", { x: 22, y: 42, width: 78, height: 42, rx: 2 }),
            h("rect", { x: 258, y: 46, width: 78, height: 44, rx: 2 }),
            h("rect", { x: 18, y: 152, width: 64, height: 112, rx: 4 }),
            h("rect", { x: 266, y: 170, width: 72, height: 54, rx: 2 }),
            h("rect", { x: 266, y: 242, width: 72, height: 46, rx: 2 }),
            h("rect", { x: 118, y: 158, width: 124, height: 116, rx: 3, fill: "#C5BAA4" }),
            h("line", { x1: 118, y1: 158, x2: 242, y2: 274, stroke: "#EBE5D5", strokeWidth: 4 }),
            h("line", { x1: 242, y1: 158, x2: 118, y2: 274, stroke: "#EBE5D5", strokeWidth: 4 }),
            h("circle", { cx: 180, cy: 216, r: 18, fill: "#DDD5C2", stroke: "#EBE5D5", strokeWidth: 3 }),
            h("rect", { x: 112, y: 344, width: 136, height: 48, rx: 2 })
          ),
          // Subtle trees / Jianmu root dots
          [
            [56, 118], [94, 124], [250, 120], [300, 128],
            [100, 294], [262, 312], [68, 326], [308, 360]
          ].map(function (pt, idx) {
            return h("g", { key: idx, fill: "#A79C87", opacity: 0.65 },
              h("circle", { cx: pt[0], cy: pt[1], r: 7 }),
              h("line", { x1: pt[0], y1: pt[1] + 6, x2: pt[0], y2: pt[1] + 14, stroke: "#8C806B", strokeWidth: 1.5 })
            );
          }),

          // Zigzag purple-crimson dashed path connecting Ⅰ~Ⅶ (图2 标志性虚线路径)
          edges.map(function (edge, idx) {
            var a = nodeMap[edge[0]];
            var b = nodeMap[edge[1]];
            if (!a || !b) return null;
            return h("line", {
              key: idx,
              x1: (a.x / 100) * 360,
              y1: (a.y / 100) * 430,
              x2: (b.x / 100) * 360,
              y2: (b.y / 100) * 430,
              stroke: "#A55178",
              strokeWidth: 3,
              strokeDasharray: "4 6",
              strokeLinecap: "round"
            });
          }),

          // Scale-dependent influence aura around live active node
          h("circle", {
            cx: (activeNode.x / 100) * 360,
            cy: (activeNode.y / 100) * 430,
            r: influenceR,
            fill: "rgba(180, 58, 46, 0.12)",
            stroke: "rgba(180, 58, 46, 0.55)",
            strokeWidth: 1.5,
            strokeDasharray: "5 4",
            style: { transition: "cx 1.2s ease, cy 1.2s ease" }
          }),

          // Roman numeral nodes Ⅰ~Ⅶ
          nodes.map(function (nd) {
            var inPatrol = patrol.indexOf(nd.id) >= 0;
            var isCur = nd.id === activeNodeId;
            var cx = (nd.x / 100) * 360;
            var cy = (nd.y / 100) * 430;
            return h(
              "g",
              { key: nd.id },
              h("circle", {
                cx: cx,
                cy: cy,
                r: 17,
                fill: isCur ? "#FFF8EE" : "#EFE9DA",
                stroke: isCur ? "#B43A2E" : inPatrol ? "#8C5A6A" : "#8A8070",
                strokeWidth: isCur ? 2.5 : 1.6
              }),
              h(
                "text",
                {
                  x: cx,
                  y: cy + 5,
                  textAnchor: "middle",
                  fontSize: "13",
                  fontWeight: "800",
                  fill: isCur ? "#B43A2E" : "#564E44"
                },
                nd.roman
              )
            );
          })
        ),

        // Live Moving Marauder's Map Pin (动态移动定位标)
        h(
          "div",
          {
            style: {
              position: "absolute",
              left: activeNode.x + "%",
              top: activeNode.y + "%",
              transform: "translate(-50%, -118%)",
              transition: "left 1.25s cubic-bezier(0.4, 0, 0.2, 1), top 1.25s cubic-bezier(0.4, 0, 0.2, 1)",
              zIndex: 6,
              pointerEvents: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center"
            }
          },
          h(
            "svg",
            { width: 34, height: 42, viewBox: "0 0 36 44" },
            h("path", {
              d: "M18 42 C18 42 4 28 4 16 A14 14 0 1 1 32 16 C32 28 18 42 18 42 Z",
              fill: "#FFF8EE",
              stroke: "#B43A2E",
              strokeWidth: 2.2
            }),
            h("circle", { cx: 18, cy: 16, r: 9, fill: "#D4574B" }),
            h("circle", { cx: 18, cy: 16, r: 3, fill: "#FFF8EE" })
          )
        ),

        // Bottom-left Vintage Brass Compass SVG (复刻图2 左下角黄铜罗盘)
        h(
          "svg",
          {
            width: 56,
            height: 56,
            viewBox: "0 0 60 60",
            style: { position: "absolute", left: "10px", bottom: "10px", zIndex: 5, filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.28))" }
          },
          h("circle", { cx: 30, cy: 30, r: 26, fill: "#E7C266", stroke: "#A87C26", strokeWidth: 2.5 }),
          h("circle", { cx: 30, cy: 30, r: 20, fill: "#FAF3E1", stroke: "#C9A14A", strokeWidth: 1.2 }),
          h("polygon", { points: "30,13 34,30 30,27 26,30", fill: "#3A548A" }),
          h("polygon", { points: "30,47 34,30 30,33 26,30", fill: "#C84B3E" }),
          h("circle", { cx: 30, cy: 30, r: 3.5, fill: "#D9794A" })
        ),

        // Live Radar Readout Pill (bottom-right)
        h(
          "div",
          {
            style: {
              position: "absolute",
              right: "10px",
              bottom: "12px",
              zIndex: 5,
              background: "rgba(28, 25, 23, 0.88)",
              border: "1px solid rgba(226, 185, 116, 0.45)",
              borderRadius: "8px",
              padding: "6px 10px",
              color: "#F3EAD8",
              fontSize: "11px",
              lineHeight: 1.4
            }
          },
          h("div", { style: { color: "#E28074", fontWeight: 800 } }, "实时感应：" + activeNode.roman + " · " + activeNode.name),
          h("div", { style: { fontSize: "10px", color: "#B9B0A0" } }, activeNode.region + " ｜ 覆盖量级：" + anomaly.scale)
        )
      ),

      // Sighting Timeline List
      h(
        "div",
        {
          style: {
            background: "rgba(244, 238, 226, 0.94)",
            border: "1px solid #C8BCA8",
            borderRadius: "10px",
            padding: "12px 14px",
            color: "#332B26"
          }
        },
        h("div", { style: { fontSize: "12px", fontWeight: 800, letterSpacing: "1px", marginBottom: "8px", color: "#6E2D28" } }, "历史出没与收容轨迹"),
        (anomaly.sightings || []).map(function (s, idx) {
          var nd = nodeMap[s.nodeId];
          return h(
            "div",
            {
              key: idx,
              style: {
                padding: "6px 0",
                borderTop: idx > 0 ? "1px dashed #D1C6B4" : "none",
                fontSize: "12px",
                lineHeight: 1.6
              }
            },
            h("span", { style: { fontWeight: 800, color: "#7E2E28", marginRight: "6px" } }, "[" + s.date + " · " + (nd ? nd.name : s.nodeId) + "]"),
            s.note
          );
        })
      )
    );
  }

  // ==================== 5. Figure 1: 1:1 Vintage Observation Logbook (turn.js) ====================

  function ObservationLogPageContent(h, log, anomaly) {
    var isCorrupt = log.checkState === "corrupted" || log.checkState === "breach";
    var isUneasy = log.checkState === "uneasy";

    return h(
      "div",
      {
        style: {
          position: "relative",
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          padding: "16px 16px 18px",
          background: isCorrupt
            ? "linear-gradient(160deg, #E2D2B4 0%, #D4BC97 60%, #C7AA82 100%)"
            : "linear-gradient(160deg, #EFE3C8 0%, #E5D4B3 100%)",
          color: "#2C221A",
          fontFamily: "'Songti SC', 'STSong', 'Noto Serif SC', Georgia, serif",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          overflow: "hidden",
          boxShadow: "inset 14px 0 22px rgba(70, 48, 28, 0.16), inset -4px 0 12px rgba(70, 48, 28, 0.12)"
        }
      },
      // Top-left vintage paperclip SVG (图1 左上金属回形针)
      h(
        "svg",
        { width: 22, height: 34, viewBox: "0 0 22 36", style: { position: "absolute", top: "-4px", left: "10px", pointerEvents: "none" } },
        h("path", { d: "M7 2 v24 a4 4 0 0 0 8 0 V8 a2 2 0 0 0 -4 0 v16", fill: "none", stroke: "#5C4C3E", strokeWidth: 2.2, strokeLinecap: "round" })
      ),

      // Vector SVG Corrupt Glyphs when仙人被异常影响
      CorruptGlyphSvg(h, log.glyphType),

      // Top Header & Metadata Table (图1 复古观测报告表头)
      h(
        "div",
        null,
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1.5px solid #6E5840", paddingBottom: "8px", paddingLeft: "18px" } },
          h(
            "div",
            null,
            h("div", { style: { fontSize: "15px", fontWeight: 900, letterSpacing: "2px", color: "#2A1F17" } }, "仙人观测手札"),
            h("div", { style: { fontSize: "10px", color: "#68533E", letterSpacing: "1px", marginTop: "2px" } }, "狭间司隙司 · " + (log.formCode || anomaly.code))
          ),
          // Winged Jianmu Crest SVG (呼应图1 顶部双蛇杖徽记)
          h(
            "svg",
            { width: 28, height: 28, viewBox: "0 0 32 32", fill: "none", stroke: "#5E4936", strokeWidth: 1.5 },
            h("path", { d: "M16 4v24M8 9c4 0 6 2 8 4 2-2 4-4 8-4M11 16c3 2 7 2 10 0M12 22c2.5 1.5 5.5 1.5 8 0" })
          )
        ),

        // Key-Value Metadata + Status Checkboxes (图1 表单字段与勾选框)
        h(
          "div",
          { style: { display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "8px", marginTop: "10px", fontSize: "11px", lineHeight: 1.65 } },
          h(
            "div",
            null,
            h("div", null, h("strong", null, "对象："), anomaly.code + " " + anomaly.name),
            h("div", null, h("strong", null, "日期："), log.date || "建安三年"),
            h("div", null, h("strong", null, "时辰："), log.shichen || "子时"),
            h("div", null, h("strong", null, "执笔："), log.recorder || "司隙官")
          ),
          h(
            "div",
            { style: { borderLeft: "1px dashed #8F7A60", paddingLeft: "8px", fontSize: "10.5px" } },
            h("div", { style: { fontWeight: 800, marginBottom: "2px" } }, "状态核验"),
            [
              { id: "normal", label: "封印正常" },
              { id: "uneasy", label: "异常躁动" },
              { id: "corrupted", label: "认知污染" }
            ].map(function (st) {
              var checked = log.checkState === st.id || (st.id === "corrupted" && log.checkState === "breach");
              return h(
                "div",
                { key: st.id, style: { display: "flex", alignItems: "center", gap: "5px", color: checked && isCorrupt ? "#8C1D18" : "#3A2C20" } },
                h("span", { style: { display: "inline-block", width: "10px", height: "10px", border: "1px solid #594634", textAlign: "center", lineHeight: "9px", fontSize: "9px", fontWeight: 900 } }, checked ? "×" : ""),
                h("span", null, st.label)
              );
            })
          )
        ),

        // Divider + Observation Narrative Body
        h(
          "div",
          { style: { marginTop: "12px", borderTop: "1px solid #8F7A60", paddingTop: "10px" } },
          h(
            "div",
            {
              style: {
                fontSize: "12px",
                fontWeight: 900,
                color: isCorrupt ? "#8C1D18" : "#3E2E20",
                marginBottom: "6px",
                letterSpacing: "0.5px"
              }
            },
            log.summaryTitle || "观测记事"
          ),
          h(
            "div",
            {
              style: {
                fontSize: "12.5px",
                lineHeight: 1.8,
                color: isCorrupt ? "#3B1B18" : "#2D221A",
                transform: isCorrupt ? "rotate(-0.8deg)" : isUneasy ? "rotate(0.4deg)" : "none"
              }
            },
            log.body
          ),
          log.corruptWhisper &&
          h(
            "div",
            {
              style: {
                marginTop: "10px",
                padding: "6px 8px",
                borderLeft: "2.5px solid #9A261E",
                color: "#8E1F18",
                fontSize: "11.5px",
                fontWeight: 700,
                fontStyle: "italic",
                lineHeight: 1.55,
                transform: "rotate(-1.2deg)"
              }
            },
            log.corruptWhisper
          )
        )
      ),

      // Bottom Stamp Row (图1 底部朱红 CONFIDENTIAL/绝密 印章 + 页码)
      h(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "12px" } },
        h(
          "div",
          {
            style: {
              border: "2px solid #962A22",
              color: "#962A22",
              padding: "2px 8px",
              fontSize: "10.5px",
              fontWeight: 900,
              letterSpacing: "2px",
              transform: "rotate(-6deg)",
              opacity: 0.82
            }
          },
          isCorrupt ? "污 染 封 存" : "绝 密 归 档"
        ),
        h(
          "div",
          { style: { fontSize: "10.5px", color: "#6E5A44", fontWeight: 700 } },
          "第 " + (log.pageNo || 1) + " 页"
        )
      )
    );
  }

  function escHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildCorruptGlyphSvgHtml(glyphType) {
    if (!glyphType || glyphType === "none") return "";
    if (glyphType === "spiral") {
      return '<svg viewBox="0 0 180 180" style="position:absolute;right:6px;bottom:26px;width:130px;height:130px;opacity:0.24;pointer-events:none"><path d="M90 90 m0 -8 a8 8 0 1 1 -8 8 a16 16 0 1 1 16 16 a28 28 0 1 1 -28 -28 a42 42 0 1 1 42 42 a58 58 0 1 1 -58 -58" fill="none" stroke="#8C1D18" stroke-width="2.4" stroke-linecap="round"/><path d="M24 34 L156 146 M148 28 L34 152" stroke="#2E1E1A" stroke-width="1.2" stroke-dasharray="5 4"/></svg>';
    }
    if (glyphType === "talisman") {
      return '<svg viewBox="0 0 140 200" style="position:absolute;right:10px;top:48px;width:92px;height:148px;opacity:0.26;pointer-events:none"><rect x="18" y="12" width="104" height="176" fill="none" stroke="#9E261E" stroke-width="2.2" stroke-dasharray="8 3"/><path d="M70 22 v152 M36 52 h68 M42 84 C68 62, 98 106, 40 124 C76 116, 102 152, 62 168" fill="none" stroke="#9E261E" stroke-width="2.8" stroke-linecap="round"/><circle cx="70" cy="52" r="9" fill="none" stroke="#2B1B17" stroke-width="1.8"/></svg>';
    }
    if (glyphType === "eye") {
      return '<svg viewBox="0 0 180 120" style="position:absolute;right:10px;bottom:32px;width:136px;height:90px;opacity:0.24;pointer-events:none"><path d="M12 60 Q90 6 168 60 Q90 114 12 60 Z" fill="none" stroke="#2E1C18" stroke-width="2.6"/><ellipse cx="90" cy="60" rx="12" ry="34" fill="#8C1D18"/><path d="M34 32 L22 18 M146 32 L158 18 M90 16 L90 4" stroke="#8C1D18" stroke-width="2"/></svg>';
    }
    return '<svg viewBox="0 0 180 120" style="position:absolute;right:8px;bottom:20px;width:140px;height:86px;opacity:0.22;pointer-events:none"><path d="M18 20 L158 84 M28 40 L166 100 M12 60 L144 112" stroke="#4B2B23" stroke-width="2.2" stroke-linecap="round"/></svg>';
  }

  function buildObservationPageHtml(log, anomaly) {
    var isCorrupt = log.checkState === "corrupted" || log.checkState === "breach";
    var isUneasy = log.checkState === "uneasy";
    var bg = isCorrupt
      ? "linear-gradient(160deg, #E2D2B4 0%, #D4BC97 60%, #C7AA82 100%)"
      : "linear-gradient(160deg, #EFE3C8 0%, #E5D4B3 100%)";
    var states = [
      { id: "normal", label: "封印正常" },
      { id: "uneasy", label: "异常躁动" },
      { id: "corrupted", label: "认知污染" }
    ];
    var checksHtml = states.map(function (st) {
      var checked = log.checkState === st.id || (st.id === "corrupted" && log.checkState === "breach");
      var clr = checked && isCorrupt ? "#8C1D18" : "#3A2C20";
      return '<div style="display:flex;align-items:center;gap:5px;color:' + clr + '">' +
        '<span style="display:inline-block;width:10px;height:10px;border:1px solid #594634;text-align:center;line-height:9px;font-size:9px;font-weight:900">' + (checked ? "×" : "") + "</span>" +
        "<span>" + st.label + "</span></div>";
    }).join("");
    var whisperHtml = log.corruptWhisper
      ? '<div style="margin-top:8px;padding:6px 8px;border-left:2.5px solid #9A261E;color:#8E1F18;font-size:11.5px;font-weight:700;font-style:italic;line-height:1.5;transform:rotate(-1.2deg)">' + escHtml(log.corruptWhisper) + "</div>"
      : "";
    var bodyRot = isCorrupt ? "rotate(-0.8deg)" : isUneasy ? "rotate(0.4deg)" : "none";

    return (
      '<div style="position:relative;width:100%;height:100%;box-sizing:border-box;padding:16px 16px 18px;background:' + bg +
      ';color:#2C221A;font-family:\'Songti SC\',\'STSong\',\'Noto Serif SC\',Georgia,serif;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;box-shadow:inset 14px 0 22px rgba(70,48,28,0.16),inset -4px 0 12px rgba(70,48,28,0.12);user-select:none">' +
      '<svg width="22" height="34" viewBox="0 0 22 36" style="position:absolute;top:-4px;left:10px;pointer-events:none"><path d="M7 2 v24 a4 4 0 0 0 8 0 V8 a2 2 0 0 0 -4 0 v16" fill="none" stroke="#5C4C3E" stroke-width="2.2" stroke-linecap="round"/></svg>' +
      buildCorruptGlyphSvgHtml(log.glyphType) +
      '<div style="position:relative;z-index:1;overflow:hidden">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1.5px solid #6E5840;padding-bottom:8px;padding-left:18px">' +
          '<div><div style="font-size:15px;font-weight:900;letter-spacing:2px;color:#2A1F17">仙人观测手札</div>' +
          '<div style="font-size:10px;color:#68533E;letter-spacing:1px;margin-top:2px">狭间司隙司 · ' + escHtml(log.formCode || anomaly.code) + "</div></div>" +
          '<svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="#5E4936" stroke-width="1.5"><path d="M16 4v24M8 9c4 0 6 2 8 4 2-2 4-4 8-4M11 16c3 2 7 2 10 0M12 22c2.5 1.5 5.5 1.5 8 0"/></svg>' +
        "</div>" +
        '<div style="display:grid;grid-template-columns:1.25fr 1fr;gap:8px;margin-top:9px;font-size:11px;line-height:1.6">' +
          '<div><div><strong>对象：</strong>' + escHtml(anomaly.code + " " + anomaly.name) + "</div>" +
          "<div><strong>日期：</strong>" + escHtml(log.date || "建安三年") + "</div>" +
          "<div><strong>时辰：</strong>" + escHtml(log.shichen || "子时") + "</div>" +
          "<div><strong>执笔：</strong>" + escHtml(log.recorder || "司隙官") + "</div></div>" +
          '<div style="border-left:1px dashed #8F7A60;padding-left:8px;font-size:10.5px"><div style="font-weight:800;margin-bottom:2px">状态核验</div>' + checksHtml + "</div>" +
        "</div>" +
        '<div style="margin-top:10px;border-top:1px solid #8F7A60;padding-top:9px">' +
          '<div style="font-size:12px;font-weight:900;color:' + (isCorrupt ? "#8C1D18" : "#3E2E20") + ';margin-bottom:5px">' + escHtml(log.summaryTitle || "观测记事") + "</div>" +
          '<div style="font-size:12px;line-height:1.72;color:' + (isCorrupt ? "#3B1B18" : "#2D221A") + ';transform:' + bodyRot + '">' + escHtml(log.body) + "</div>" +
          whisperHtml +
        "</div>" +
      "</div>" +
      '<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:flex-end;margin-top:8px">' +
        '<div style="border:2px solid #962A22;color:#962A22;padding:2px 8px;font-size:10.5px;font-weight:900;letter-spacing:2px;transform:rotate(-6deg);opacity:0.82">' + (isCorrupt ? "污 染 封 存" : "绝 密 归 档") + "</div>" +
        '<div style="font-size:10.5px;color:#6E5A44;font-weight:700">第 ' + escHtml(log.pageNo || 1) + " 页</div>" +
      "</div></div>"
    );
  }

  function TurnJsObservationLogbook(props) {
    var React = global.React;
    var h = React.createElement;
    var useEffect = React.useEffect;
    var useRef = React.useRef;
    var useState = React.useState;

    var anomaly = props.anomaly;
    var logs = Array.isArray(anomaly.observationLogs) ? anomaly.observationLogs : [];
    var onAppendLog = props.onAppendLog;
    var isAppending = !!props.isAppending;
    var isLazyLoading = !!props.isLazyLoading;
    var onTriggerLazyLogs = props.onTriggerLazyLogs;

    var stageWrapRef = useRef(null);
    var turnHostRef = useRef(null);
    var turnInstanceRef = useRef(null);
    var [curPage, setCurPage] = useState(1);
    var [turnReady, setTurnReady] = useState(false);

    var bookKey = anomaly.id + "_" + logs.length;

    // Completely decouple turn.js DOM from React reconciliation so React re-renders
    // NEVER overwrite turn.js inline positioning/transform styles!
    useEffect(
      function () {
        setCurPage(1);
        turnInstanceRef.current = null;
        var host = turnHostRef.current;
        var wrap = stageWrapRef.current;
        var $ = global.jQuery || global.$;
        if (!host || !$ || typeof $.fn.turn !== "function" || logs.length === 0) {
          setTurnReady(false);
          if (host) host.innerHTML = "";
          return;
        }

        host.innerHTML = "";
        var availW = wrap ? Math.floor(wrap.clientWidth) : 340;
        var pageW = Math.max(260, Math.min(availW || 340, 372));
        var pageH = 446;

        host.style.width = pageW + "px";
        host.style.height = pageH + "px";
        host.style.margin = "0 auto";
        host.style.position = "relative";
        host.style.overflow = "hidden";
        host.style.borderRadius = "6px";
        host.style.boxShadow = "0 12px 28px rgba(0,0,0,0.48)";

        var bookDiv = document.createElement("div");
        bookDiv.style.width = pageW + "px";
        bookDiv.style.height = pageH + "px";
        bookDiv.style.position = "relative";

        for (var i = 0; i < logs.length; i++) {
          var pageDiv = document.createElement("div");
          pageDiv.style.width = pageW + "px";
          pageDiv.style.height = pageH + "px";
          pageDiv.innerHTML = buildObservationPageHtml(logs[i], anomaly);
          bookDiv.appendChild(pageDiv);
        }
        host.appendChild(bookDiv);

        var $book = $(bookDiv);
        try {
          $book.turn({
            width: pageW,
            height: pageH,
            display: "single",
            autoCenter: false,
            gradients: true,
            elevation: 50,
            acceleration: true,
            duration: 520,
            when: {
              turning: function (_e, page) {
                setCurPage(page);
              },
              turned: function (_e, page) {
                setCurPage(page);
              }
            }
          });
          turnInstanceRef.current = $book;
          setTurnReady(true);
        } catch (_) {
          host.innerHTML = "";
          turnInstanceRef.current = null;
          setTurnReady(false);
        }

        return function () {
          try {
            if (turnInstanceRef.current && typeof turnInstanceRef.current.turn === "function") {
              turnInstanceRef.current.turn("destroy");
            }
          } catch (_) { }
          turnInstanceRef.current = null;
          if (host) host.innerHTML = "";
        };
      },
      [bookKey]
    );

    function goPrev(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      var $book = turnInstanceRef.current;
      if ($book && typeof $book.turn === "function") {
        try {
          var cur = $book.turn("page");
          if (cur > 1) {
            $book.turn("previous");
            setCurPage(cur - 1);
          }
          return;
        } catch (_) { }
      }
      setCurPage(function (p) { return Math.max(1, p - 1); });
    }

    function goNext(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      var $book = turnInstanceRef.current;
      if ($book && typeof $book.turn === "function") {
        try {
          var cur = $book.turn("page");
          var total = $book.turn("pages");
          if (cur < total) {
            $book.turn("next");
            setCurPage(cur + 1);
          }
          return;
        } catch (_) { }
      }
      setCurPage(function (p) { return Math.min(logs.length, p + 1); });
    }

    if (logs.length === 0) {
      return h(
        "div",
        {
          style: {
            width: "100%",
            maxWidth: "380px",
            margin: "0 auto",
            minHeight: "360px",
            borderRadius: "8px",
            background: "linear-gradient(160deg, #EFE3C8 0%, #DFCCA7 100%)",
            color: "#3A2C20",
            border: "1.5px solid #9B8568",
            boxShadow: "0 12px 28px rgba(0,0,0,0.42)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "28px 20px",
            boxSizing: "border-box",
            textAlign: "center",
            gap: "12px",
            fontFamily: "'Songti SC', 'STSong', 'Noto Serif SC', Georgia, serif"
          }
        },
        XjIcon(h, "book", { size: 32, color: "#7E2E28", strokeWidth: 1.6 }),
        h(
          "div",
          { style: { fontSize: "15px", fontWeight: 900, letterSpacing: "2px", color: "#2D2118" } },
          isLazyLoading ? "正在调阅司隙司封存手札…" : "《仙人观测手札》尚未启封"
        ),
        h(
          "div",
          { style: { fontSize: "12px", lineHeight: 1.7, color: "#68543F", maxWidth: "280px" } },
          isLazyLoading
            ? "司隙官正在按需调档并补全 4 页观测日志（含正常巡检、异动征兆与鬼画符污染页），请稍候。"
            : "该异常由世界书裂隙投射生成，为节省算力，手札将在您查阅时按需现写并永久归档。"
        ),
        !isLazyLoading &&
          h(
            "button",
            {
              type: "button",
              onClick: onTriggerLazyLogs,
              style: {
                marginTop: "4px",
                border: "1.5px solid #8D2621",
                background: "#8D2621",
                color: "#FFF6E6",
                borderRadius: "8px",
                padding: "8px 18px",
                fontSize: "12.5px",
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer"
              }
            },
            XjIcon(h, "spark", { size: 14, color: "#FFF6E6" }),
            "立即调阅并生成 4 页手札"
          )
      );
    }

    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" } },
      h(
        "div",
        { style: { fontSize: "11px", color: "#C8BFB0", textAlign: "center" } },
        "可拖拽纸页折角或点击下方按钮物理翻页阅读"
      ),
      // Isolated turn.js stage container (imperative DOM, zero React style clobbering)
      h(
        "div",
        {
          ref: stageWrapRef,
          style: {
            width: "100%",
            maxWidth: "372px",
            minHeight: "446px",
            position: "relative"
          }
        },
        h("div", { ref: turnHostRef, style: { display: turnReady ? "block" : "none" } }),
        !turnReady &&
          h(
            "div",
            {
              style: {
                width: "100%",
                height: "446px",
                borderRadius: "6px",
                overflow: "hidden",
                boxShadow: "0 12px 28px rgba(0,0,0,0.48)"
              }
            },
            ObservationLogPageContent(h, logs[Math.max(0, Math.min(logs.length - 1, curPage - 1))], anomaly)
          )
      ),
      // Pagination + AI Append Controls
      h(
        "div",
        { style: { width: "100%", maxWidth: "372px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" } },
        h(
          "button",
          {
            type: "button",
            onClick: goPrev,
            disabled: curPage <= 1,
            style: {
              border: "1px solid rgba(226,185,116,0.45)",
              background: "rgba(30,26,24,0.86)",
              color: curPage <= 1 ? "#6E655B" : "#F3EAD8",
              borderRadius: "8px",
              padding: "7px 14px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: curPage <= 1 ? "not-allowed" : "pointer"
            }
          },
          "上一页"
        ),
        h("span", { style: { fontSize: "12px", color: "#DFD5C3", fontWeight: 700 } }, curPage + " / " + logs.length),
        h(
          "button",
          {
            type: "button",
            onClick: goNext,
            disabled: curPage >= logs.length,
            style: {
              border: "1px solid rgba(226,185,116,0.45)",
              background: "rgba(30,26,24,0.86)",
              color: curPage >= logs.length ? "#6E655B" : "#F3EAD8",
              borderRadius: "8px",
              padding: "7px 14px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: curPage >= logs.length ? "not-allowed" : "pointer"
            }
          },
          "下一页"
        )
      ),
      h(
        "button",
        {
          type: "button",
          disabled: isAppending,
          onClick: onAppendLog,
          style: {
            width: "100%",
            maxWidth: "372px",
            height: "38px",
            border: "1px solid rgba(196, 152, 92, 0.55)",
            borderRadius: "10px",
            background: "rgba(42, 34, 28, 0.88)",
            color: "#EAD8B8",
            fontSize: "12.5px",
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            cursor: isAppending ? "wait" : "pointer"
          }
        },
        XjIcon(h, "spark", { size: 14, color: "#E2B974" }),
        isAppending ? "司隙官正在续写 3~5 页手札…" : "AI 续写仙人观测日志（+3~5页）"
      )
    );
  }

  // ==================== 6. Main Fullscreen Xiajian App Component ====================

  function XiajianAppPage(props) {
    var React = global.React;
    if (!React) return null;
    var h = React.createElement;
    var useEffect = React.useEffect;
    var useState = React.useState;

    var onClose = props && (props.onClose || props.onBack);
    var Engine = global.XiajianEngine;
    var Catalog = global.XiajianCatalogData;

    var [anomalies, setAnomalies] = useState([]);
    var [characters, setCharacters] = useState([]);
    var [levelFilter, setLevelFilter] = useState(0); // 0 = all, 1..5
    var [selectedId, setSelectedId] = useState(null);
    var [detailTab, setDetailTab] = useState("archive"); // "archive" | "map" | "logs"
    var [toast, setToast] = useState("");
    var [isAppendingLog, setIsAppendingLog] = useState(false);

    // World Book Projection & Lazy Logbook & On-Demand Media Capture State
    var [wbSummary, setWbSummary] = useState({ count: 0, titles: [] });
    var [isProjecting, setIsProjecting] = useState(false);
    var [isLazyLoadingLogs, setIsLazyLoadingLogs] = useState(false);
    var [showMediaModal, setShowMediaModal] = useState(false);

    // Dual Inspection Theatre Modal State
    var [showVisitModal, setShowVisitModal] = useState(false);
    var [selectedCharId, setSelectedCharId] = useState("");
    var [clarity, setClarity] = useState(100);
    var [visitTurns, setVisitTurns] = useState([]);
    var [customActionText, setCustomActionText] = useState("");
    var [isRunningVisit, setIsRunningVisit] = useState(false);

    // Custom Anomaly Creator Modal State (Dual-Tab: "self" | "character")
    var [showCreateModal, setShowCreateModal] = useState(false);
    var [createTab, setCreateTab] = useState("self");
    var [draftName, setDraftName] = useState("");
    var [draftLevel, setDraftLevel] = useState(2);
    var [draftDiff, setDraftDiff] = useState("中");
    var [draftTraits, setDraftTraits] = useState([]);
    var [draftBrief, setDraftBrief] = useState("");
    var [isPolishing, setIsPolishing] = useState(false);
    var [submitCharId, setSubmitCharId] = useState("__random__");
    var [submitCount, setSubmitCount] = useState(4);
    var [submitCue, setSubmitCue] = useState("");
    var [isCharSubmitting, setIsCharSubmitting] = useState(false);

    function flashToast(msg) {
      setToast(msg);
      setTimeout(function () {
        setToast(function (cur) { return cur === msg ? "" : cur; });
      }, 2400);
    }

    async function refreshData() {
      if (!Engine) return;
      var list = await Engine.getAllAnomalies();
      setAnomalies(list);
      var chars = await Engine.getAvailableCharacters();
      setCharacters(chars);
      if (!selectedCharId && chars.length > 0) {
        setSelectedCharId(String(chars[0].id));
      }
      if (typeof Engine.getEnabledWorldBookSummary === "function") {
        try {
          var wb = await Engine.getEnabledWorldBookSummary();
          setWbSummary(wb || { count: 0, titles: [] });
        } catch (_) {}
      }
    }

    useEffect(function () {
      refreshData();
    }, []);

    if (!Engine || !Catalog) {
      return h(
        "div",
        { style: { position: "fixed", inset: 0, zIndex: 1010, background: "#141819", color: "#EFE6D5", display: "flex", alignItems: "center", justifyContent: "center" } },
        "狭间收容所模块未加载"
      );
    }

    var selectedAnomaly = anomalies.find(function (a) { return a.id === selectedId; }) || null;
    var activeLevelMeta = selectedAnomaly
      ? Catalog.DANGER_LEVELS[selectedAnomaly.dangerLevel] || Catalog.DANGER_LEVELS[1]
      : Catalog.DANGER_LEVELS[1];

    var visibleAnomalies = levelFilter === 0
      ? anomalies
      : anomalies.filter(function (a) { return a.dangerLevel === levelFilter; });

    // Handlers
    async function handleUnlockRedacted(aid) {
      await Engine.unlockRedactedSecret(aid);
      await refreshData();
      flashToast("机密涂黑段落已验权揭露");
    }

    async function handleAppendLog() {
      if (!selectedAnomaly || isAppendingLog) return;
      setIsAppendingLog(true);
      try {
        var added = await Engine.appendObservationLogWithAI(selectedAnomaly, 4);
        await refreshData();
        var cnt = Array.isArray(added) ? added.length : 1;
        flashToast("已连续续写 " + cnt + " 页新的仙人观测日志");
      } catch (e) {
        flashToast("续写失败：" + (e && e.message ? e.message : e));
      }
      setIsAppendingLog(false);
    }

    async function handleWorldBookProject() {
      if (isProjecting || typeof Engine.generateWorldBookProjectionBatch !== "function") return;
      setIsProjecting(true);
      flashToast(
        wbSummary.count > 0
          ? "正在基于已开启的 " + wbSummary.count + " 篇世界书投射裂隙异常…"
          : "正在基于汉末建木裂隙投射 4~6 宗新异常…"
      );
      try {
        var res = await Engine.generateWorldBookProjectionBatch({ count: 5 });
        await refreshData();
        var n = (res && res.records && res.records.length) || 0;
        flashToast(
          "裂隙投射完成：新增 " + n + " 宗收容物" +
          (res && res.usedAi ? "（世界书 AI 投射）" : "（离线建木模板）")
        );
      } catch (e) {
        flashToast("裂隙投射失败：" + (e && e.message ? e.message : e));
      }
      setIsProjecting(false);
    }

    async function handleDeleteCustomAnomaly(ev, item) {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      if (!item || !item.isCustom || typeof Engine.deleteCustomAnomaly !== "function") return;
      await Engine.deleteCustomAnomaly(item.id);
      if (typeof Engine.deleteAnomalyMedia === "function") {
        try { await Engine.deleteAnomalyMedia(item.id); } catch (_) {}
      }
      if (selectedId === item.id) setSelectedId(null);
      await refreshData();
      flashToast("已从狭间卷宗移除：" + item.name);
    }

    async function triggerLazyLogs(targetAnomaly) {
      var target = targetAnomaly || selectedAnomaly;
      if (!target || isLazyLoadingLogs || typeof Engine.generateInitialObservationLogsLazy !== "function") return;
      setIsLazyLoadingLogs(true);
      try {
        await Engine.generateInitialObservationLogsLazy(target);
        await refreshData();
        flashToast("已调阅并归档《仙人观测手札》");
      } catch (e) {
        flashToast("调阅手札失败：" + (e && e.message ? e.message : e));
      }
      setIsLazyLoadingLogs(false);
    }

    function handleSelectDetailTab(tabId) {
      setDetailTab(tabId);
      if (
        tabId === "logs" &&
        selectedAnomaly &&
        (!Array.isArray(selectedAnomaly.observationLogs) || selectedAnomaly.observationLogs.length === 0)
      ) {
        triggerLazyLogs(selectedAnomaly);
      }
    }

    async function handleMediaSaved() {
      await refreshData();
    }

    async function handleOpenVisit() {
      if (!selectedAnomaly) return;
      setClarity(100);
      setCustomActionText("");
      var history = await Engine.getVisitRecords(selectedAnomaly.id);
      setVisitTurns(history.slice(0, 6).reverse());
      setShowVisitModal(true);
    }

    async function handleRunAction(actionId) {
      if (!selectedAnomaly || isRunningVisit) return;
      var charObj = characters.find(function (c) { return String(c.id) === String(selectedCharId); }) || characters[0];
      if (!charObj) {
        flashToast("通讯录中暂无可同行的名士");
        return;
      }
      setIsRunningVisit(true);
      try {
        var rec = await Engine.runDualInspection({
          anomaly: selectedAnomaly,
          charObj: charObj,
          actionId: actionId,
          userCustomInput: customActionText,
          historyTurns: visitTurns
        });
        setVisitTurns(function (prev) { return prev.concat([rec]); });
        setClarity(function (c) { return Math.max(0, Math.min(100, c + (rec.clarityDelta || 0))); });
        setCustomActionText("");
      } catch (e) {
        flashToast("巡视演绎失败：" + (e && e.message ? e.message : e));
      }
      setIsRunningVisit(false);
    }

    async function handlePolishCreate() {
      if (isPolishing) return;
      setIsPolishing(true);
      try {
        var created = await Engine.polishCustomAnomalyWithAI({
          name: draftName,
          dangerLevel: draftLevel,
          containmentDifficulty: draftDiff,
          traits: draftTraits,
          brief: draftBrief
        });
        setShowCreateModal(false);
        setDraftName("");
        setDraftBrief("");
        setDraftTraits([]);
        await refreshData();
        setSelectedId(created.id);
        setDetailTab("archive");
        flashToast("已由 AI 润色并收入狭间卷宗：" + created.code);
      } catch (e) {
        flashToast(e && e.message ? e.message : "录入失败");
      }
      setIsPolishing(false);
    }

    async function handleCharacterSubmit() {
      var CharSubmit = global.XiajianCharSubmitEngine;
      if (isCharSubmitting || !CharSubmit || typeof CharSubmit.generateCharacterSubmittedAnomaly !== "function") return;
      if (!characters || characters.length === 0) {
        flashToast("传讯通讯录暂无名士，请先添加角色或切换「亲自录入」");
        return;
      }
      var picked = null;
      if (submitCharId && submitCharId !== "__random__") {
        picked = characters.find(function (c) { return String(c.id) === String(submitCharId); }) || null;
      }
      if (!picked) {
        picked = characters[Math.floor(Math.random() * characters.length)];
      }
      setIsCharSubmitting(true);
      try {
        var res = await CharSubmit.generateCharacterSubmittedAnomaly({
          charObj: picked,
          optionalCue: submitCue,
          count: submitCount
        });
        setShowCreateModal(false);
        setSubmitCue("");
        await refreshData();
        var recs = Array.isArray(res && res.records) ? res.records : (res && res.record ? [res.record] : []);
        if (recs.length > 0) {
          setSelectedId(recs[0].id);
          setDetailTab("chronicle");
          flashToast(
            "名士「" + (res.charName || picked.name) + "」已呈报 " + recs.length + " 宗卷宗与第一人称历程单"
          );
        }
      } catch (e) {
        flashToast("名士呈报失败：" + (e && e.message ? e.message : e));
      }
      setIsCharSubmitting(false);
    }

    // ---- Main Render ----
    return h(
      "div",
      {
        style: {
          position: "fixed",
          inset: 0,
          zIndex: 1010,
          background: "#131718",
          color: "#F2EAE0",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
          overflow: "hidden"
        }
      },
      // Live WebGL Atmospheric Shader Backdrop
      h(XiajianWebGLBackdrop, {
        mood: selectedAnomaly ? selectedAnomaly.webglMood || activeLevelMeta.webglMood : "jade_mist",
        intensity: selectedAnomaly ? activeLevelMeta.corruptIntensity : 0.45
      }),

      // Top Header Bar
      h(
        "div",
        {
          style: {
            position: "relative",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "max(12px, env(safe-area-inset-top)) 14px 10px",
            background: "rgba(18, 22, 23, 0.78)",
            backdropFilter: "blur(8px)",
            borderBottom: "1px solid rgba(226, 185, 116, 0.2)"
          }
        },
        h(
          "button",
          {
            type: "button",
            onClick: function () {
              if (selectedAnomaly) setSelectedId(null);
              else if (onClose) onClose();
            },
            style: {
              border: "none",
              background: "transparent",
              color: "#E8DCC8",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "13.5px",
              fontWeight: 700,
              cursor: "pointer",
              padding: "4px 2px"
            }
          },
          XjIcon(h, "back", { size: 16, color: "#E8DCC8" }),
          selectedAnomaly ? "返回目录" : "退出狭间"
        ),
        h(
          "div",
          { style: { textAlign: "center" } },
          h("div", { style: { fontSize: "15.5px", fontWeight: 900, letterSpacing: "3px", color: "#F6EBD8" } }, selectedAnomaly ? selectedAnomaly.code : "狭 间"),
          h("div", { style: { fontSize: "10px", color: "#9DB5AA", letterSpacing: "1px" } }, selectedAnomaly ? selectedAnomaly.name : "建木根隙 · 天道异常收容所")
        ),
        !selectedAnomaly
          ? h(
            "button",
            {
              type: "button",
              onClick: function () { setShowCreateModal(true); },
              style: {
                border: "1px solid rgba(226, 185, 116, 0.55)",
                background: "rgba(180, 58, 46, 0.25)",
                color: "#F5E6D0",
                borderRadius: "999px",
                padding: "5px 10px",
                fontSize: "11.5px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                cursor: "pointer"
              }
            },
            XjIcon(h, "plus", { size: 13, color: "#F5E6D0" }),
            "录入异常"
          )
          : h("div", { style: { width: "66px" } })
      ),

      // Main Content Area
      !selectedAnomaly
        ? // ===== Catalog View =====
        h(
          "div",
          { style: { position: "relative", zIndex: 2, flex: 1, overflowY: "auto", padding: "12px 14px 32px", display: "flex", flexDirection: "column", gap: "12px" } },
          // Jianmu Stability Status Banner + World Book Rift Projection CTA
          h(
            "div",
            {
              style: {
                background: "rgba(22, 28, 30, 0.84)",
                border: "1px solid rgba(138, 192, 171, 0.3)",
                borderRadius: "12px",
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }
            },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" } },
              h(
                "div",
                { style: { minWidth: 0, flex: 1 } },
                h("div", { style: { fontSize: "12.5px", fontWeight: 800, color: "#DCECE5" } }, "建木根系状态：微澜波动"),
                h(
                  "div",
                  { style: { fontSize: "11px", color: "#8FA39B", marginTop: "2px", lineHeight: 1.5 } },
                  "当前在册异常 " + anomalies.length + " 宗 · 所有影响仅限狭间内演绎"
                ),
                h(
                  "div",
                  { style: { fontSize: "10.5px", color: "#C8B89E", marginTop: "3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } },
                  wbSummary.count > 0
                    ? "投射源（已开启世界书 " + wbSummary.count + " 篇）：" + wbSummary.titles.slice(0, 3).join("、") + (wbSummary.count > 3 ? " 等" : "")
                    : "未开启世界书条目（将按默认汉末建木裂隙投射）"
                )
              ),
              XjIcon(h, "rift", { size: 22, color: "#8AC0AB" })
            ),
            h(
              "button",
              {
                type: "button",
                disabled: isProjecting,
                onClick: handleWorldBookProject,
                style: {
                  width: "100%",
                  height: "36px",
                  border: "1px solid rgba(226, 185, 116, 0.55)",
                  borderRadius: "8px",
                  background: isProjecting
                    ? "rgba(80, 72, 66, 0.65)"
                    : "linear-gradient(135deg, rgba(141, 38, 33, 0.88) 0%, rgba(92, 26, 24, 0.92) 100%)",
                  color: "#FFF4E0",
                  fontSize: "12px",
                  fontWeight: 800,
                  letterSpacing: "1px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  cursor: isProjecting ? "wait" : "pointer"
                }
              },
              XjIcon(h, "spark", { size: 14, color: "#E2B974" }),
              isProjecting ? "正在从世界书裂隙投射 4~6 宗新异常…" : "世界书裂隙投射 · 批量生成 4~6 宗异常"
            )
          ),

          // Danger Level Filter Strip (0=全部, 1~5)
          h(
            "div",
            { style: { display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "2px" } },
            [
              { id: 0, label: "全部卷宗" },
              { id: 1, label: "Ⅰ 微澜·个体" },
              { id: 2, label: "Ⅱ 诡影·群体" },
              { id: 3, label: "Ⅲ 祸坊·街区" },
              { id: 4, label: "Ⅳ 倾郡·郡县" },
              { id: 5, label: "Ⅴ 覆汉·全域" }
            ].map(function (f) {
              var active = levelFilter === f.id;
              return h(
                "button",
                {
                  key: f.id,
                  type: "button",
                  onClick: function () { setLevelFilter(f.id); },
                  style: {
                    border: active ? "1px solid #E2B974" : "1px solid rgba(255,255,255,0.16)",
                    background: active ? "rgba(180, 58, 46, 0.35)" : "rgba(22, 26, 28, 0.72)",
                    color: active ? "#FFF4E0" : "#B8B0A4",
                    borderRadius: "999px",
                    padding: "5px 11px",
                    fontSize: "11.5px",
                    fontWeight: active ? 800 : 500,
                    whiteSpace: "nowrap",
                    cursor: "pointer"
                  }
                },
                f.label
              );
            })
          ),

          // Anomaly Dossier Cards
          visibleAnomalies.map(function (item) {
            var lv = Catalog.DANGER_LEVELS[item.dangerLevel] || Catalog.DANGER_LEVELS[1];
            return h(
              "div",
              {
                key: item.id,
                onClick: function () {
                  setSelectedId(item.id);
                  setDetailTab("archive");
                },
                style: {
                  background: "rgba(244, 238, 226, 0.94)",
                  borderRadius: "12px",
                  borderLeft: "5px solid " + lv.color,
                  padding: "12px 14px",
                  color: "#28211D",
                  cursor: "pointer",
                  boxShadow: "0 6px 18px rgba(0,0,0,0.3)"
                }
              },
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" } },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "8px" } },
                  h("span", { style: { fontSize: "11px", fontWeight: 900, color: "#7E2E28", fontFamily: "monospace" } }, item.code),
                  h("span", { style: { fontSize: "15px", fontWeight: 900, color: "#1C1614" } }, item.name)
                ),
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 } },
                  h(
                    "span",
                    {
                      style: {
                        fontSize: "10.5px",
                        fontWeight: 800,
                        padding: "2px 8px",
                        borderRadius: "4px",
                        background: lv.color,
                        color: "#FFFFFF"
                      }
                    },
                    lv.roman + " · " + lv.stampText
                  ),
                  item.isCustom &&
                    h(
                      "button",
                      {
                        type: "button",
                        title: "移出卷宗",
                        onClick: function (ev) { handleDeleteCustomAnomaly(ev, item); },
                        style: {
                          border: "1px solid rgba(140, 120, 105, 0.35)",
                          background: "rgba(255,255,255,0.65)",
                          color: "#7E2E28",
                          borderRadius: "5px",
                          padding: "3px 5px",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center"
                        }
                      },
                      XjIcon(h, "trash", { size: 12, color: "#7E2E28" })
                    )
                )
              ),
              h(
                "div",
                { style: { fontSize: "12px", color: "#574C43", marginTop: "6px", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } },
                item.description
              ),
              h(
                "div",
                { style: { display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px", alignItems: "center" } },
                h("span", { style: { fontSize: "10.5px", color: "#6E5E50", fontWeight: 700 } }, item.reactionType),
                h("span", { style: { fontSize: "10.5px", color: "#8B7D6E" } }, "｜ 收容难度：" + item.containmentDifficulty),
                item.source === "worldbook_projection" &&
                  h("span", { style: { fontSize: "10px", fontWeight: 700, color: "#2F584A", background: "rgba(77,119,104,0.14)", padding: "1px 6px", borderRadius: "4px" } }, "世界书投射"),
                item.source === "character_submission" && item.submitter && item.submitter.charName &&
                  h("span", { style: { fontSize: "10px", fontWeight: 800, color: "#EFE6D6", background: "#231E1B", padding: "1px 6px", borderRadius: "4px" } }, "呈报：" + item.submitter.charName),
                item.imageUrl &&
                  h("span", { style: { fontSize: "10px", fontWeight: 700, color: "#5C4A38", background: "rgba(155,142,128,0.18)", padding: "1px 6px", borderRadius: "4px" } }, "已采影像"),
                (item.traits || []).map(function (tid) {
                  var tr = Catalog.DANGER_TRAITS[tid];
                  if (!tr) return null;
                  return h(
                    "span",
                    { key: tid, style: { display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "10px", fontWeight: 700, color: "#9A221C", background: "rgba(180,43,36,0.1)", padding: "1px 6px", borderRadius: "4px" } },
                    XjIcon(h, tr.icon, { size: 10, color: "#9A221C" }),
                    tr.label
                  );
                })
              )
            );
          })
        )
        : // ===== Triple-View Detail Page (Archive / Live Map / turn.js Logbook) =====
        h(
          "div",
          { style: { position: "relative", zIndex: 2, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" } },
          // 3 or 4-Tab Switcher Bar (auto-adds「名士历程」for character-submitted anomalies)
          (function () {
            var hasChronicle = Array.isArray(selectedAnomaly.submitterChronicle) && selectedAnomaly.submitterChronicle.length > 0;
            var tabs = [
              { id: "archive", label: "收容档案", icon: "folder" },
              { id: "map", label: "活点舆图", icon: "map" },
              { id: "logs", label: "仙人观测志", icon: "book" }
            ];
            if (hasChronicle) {
              tabs.push({ id: "chronicle", label: "名士历程", icon: "scroll" });
            }
            return h(
              "div",
              { style: { padding: "10px 14px 6px", flexShrink: 0 } },
              h(
                "div",
                {
                  style: {
                    display: "grid",
                    gridTemplateColumns: "repeat(" + tabs.length + ", 1fr)",
                    gap: "5px",
                    background: "rgba(18,22,24,0.8)",
                    padding: "4px",
                    borderRadius: "10px",
                    border: "1px solid rgba(255,255,255,0.12)"
                  }
                },
                tabs.map(function (t) {
                  var active = detailTab === t.id;
                  return h(
                    "button",
                    {
                      key: t.id,
                      type: "button",
                      onClick: function () { handleSelectDetailTab(t.id); },
                      style: {
                        border: "none",
                        borderRadius: "8px",
                        padding: "7px 4px",
                        background: active ? "#8D2621" : "transparent",
                        color: active ? "#FFF6E6" : "#B8AEA0",
                        fontSize: tabs.length === 4 ? "11px" : "12px",
                        fontWeight: active ? 800 : 500,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "4px",
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                      }
                    },
                    XjIcon(h, t.icon, { size: 13, color: active ? "#FFF6E6" : "#B8AEA0" }),
                    t.label
                  );
                })
              )
            );
          })(),

          // Scrollable Tab Body
          h(
            "div",
            { style: { flex: 1, overflowY: "auto", padding: "6px 14px 18px" } },
            detailTab === "archive"
              ? h(ArchiveFolderCard, {
                  anomaly: selectedAnomaly,
                  onUnlockRedacted: handleUnlockRedacted,
                  onOpenMediaCapture: function () { setShowMediaModal(true); }
                })
              : detailTab === "map"
                ? h(LiveAnomalyMapCard, { anomaly: selectedAnomaly })
                : detailTab === "chronicle" && global.XiajianCharSubmitEngine && global.XiajianCharSubmitEngine.CharacterChronicleBinder
                  ? h(global.XiajianCharSubmitEngine.CharacterChronicleBinder, { anomaly: selectedAnomaly })
                  : h(TurnJsObservationLogbook, {
                      anomaly: selectedAnomaly,
                      onAppendLog: handleAppendLog,
                      isAppending: isAppendingLog,
                      isLazyLoading: isLazyLoadingLogs,
                      onTriggerLazyLogs: function () { triggerLazyLogs(selectedAnomaly); }
                    })
          ),

          // Sticky Bottom CTA: Enter Containment Room with a Character
          h(
            "div",
            {
              style: {
                padding: "10px 14px max(12px, env(safe-area-inset-bottom))",
                background: "rgba(18, 22, 24, 0.88)",
                borderTop: "1px solid rgba(226, 185, 116, 0.22)",
                flexShrink: 0
              }
            },
            h(
              "button",
              {
                type: "button",
                onClick: handleOpenVisit,
                style: {
                  width: "100%",
                  height: "44px",
                  border: "1.5px solid #D99B58",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #9A2B24 0%, #6D1B17 100%)",
                  color: "#FFF4E0",
                  fontSize: "14px",
                  fontWeight: 800,
                  letterSpacing: "1.5px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(154, 43, 36, 0.4)"
                }
              },
              XjIcon(h, "eye", { size: 17, color: "#FFF4E0" }),
              "携名士踏入收容室 · 双人巡视"
            )
          )
        ),

      // ===== Modal 1: Dual Inspection Theatre =====
      showVisitModal && selectedAnomaly &&
      h(
        "div",
        {
          style: {
            position: "fixed",
            inset: 0,
            zIndex: 1030,
            background: "rgba(12, 14, 15, 0.88)",
            backdropFilter: "blur(6px)",
            display: "flex",
            flexDirection: "column",
            padding: "max(12px, env(safe-area-inset-top)) 14px max(14px, env(safe-area-inset-bottom))"
          }
        },
        // Top bar: Companion selector + Clarity bar + Exit
        h(
          "div",
          { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "10px" } },
          h(
            "div",
            { style: { fontSize: "14px", fontWeight: 800, color: "#F5EBD8" } },
            selectedAnomaly.code + " · 收容室巡视"
          ),
          h(
            "button",
            {
              type: "button",
              onClick: function () {
                setShowVisitModal(false);
                flashToast("已退出狭间收容室，一切异常影响已净化归零");
              },
              style: {
                border: "1px solid rgba(255,255,255,0.28)",
                background: "rgba(255,255,255,0.1)",
                color: "#F5EBD8",
                borderRadius: "999px",
                padding: "4px 12px",
                fontSize: "12px",
                cursor: "pointer"
              }
            },
            "撤离并净化"
          )
        ),

        // Companion Picker & Clarity Bar
        h(
          "div",
          { style: { background: "rgba(28,32,34,0.92)", border: "1px solid rgba(226,185,116,0.25)", borderRadius: "10px", padding: "10px 12px", marginBottom: "10px", display: "flex", flexDirection: "column", gap: "8px" } },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" } },
            h("span", { style: { fontSize: "12px", color: "#C5BCAE" } }, "同行名士："),
            h(
              "select",
              {
                value: selectedCharId,
                onChange: function (e) { setSelectedCharId(e.target.value); },
                style: {
                  flex: 1,
                  background: "#171B1C",
                  color: "#F3EAD8",
                  border: "1px solid #4A433B",
                  borderRadius: "6px",
                  padding: "5px 8px",
                  fontSize: "12.5px"
                }
              },
              characters.map(function (c) {
                return h("option", { key: c.id, value: c.id }, c.name);
              })
            )
          ),
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "11.5px" } },
            h("span", { style: { color: "#9DB5AA" } }, "灵台清明度"),
            h(
              "div",
              { style: { flex: 1, height: "6px", background: "#2A2E30", borderRadius: "999px", overflow: "hidden" } },
              h("div", {
                style: {
                  width: clarity + "%",
                  height: "100%",
                  background: clarity > 60 ? "#5E9E76" : clarity > 30 ? "#D49B3E" : "#C93B32",
                  transition: "width 0.35s ease"
                }
              })
            ),
            h("span", { style: { fontWeight: 800, color: "#E8DCC8", minWidth: "34px", textAlign: "right" } }, clarity + "%")
          )
        ),

        // Theatre Log Stream
        h(
          "div",
          { style: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", paddingBottom: "10px" } },
          visitTurns.length === 0
            ? h(
              "div",
              { style: { textAlign: "center", padding: "36px 16px", color: "#9D9589", fontSize: "12.5px", lineHeight: 1.7 } },
              "铜锁已启，幽暗收容室就在眼前。\n请选择下方行动，与同行名士共同直面「" + selectedAnomaly.name + "」。"
            )
            : visitTurns.map(function (turn) {
              return h(
                "div",
                {
                  key: turn.id,
                  style: {
                    background: "rgba(244, 238, 226, 0.96)",
                    color: "#2A221D",
                    borderRadius: "10px",
                    padding: "12px 14px",
                    borderLeft: "4px solid #9A2B24"
                  }
                },
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" } },
                  h("span", { style: { fontSize: "11px", fontWeight: 800, color: "#7E2E28" } }, "行动：" + turn.actionLabel + " ｜ 同行：" + turn.charName),
                  h(
                    "span",
                    { style: { fontSize: "10.5px", fontWeight: 800, padding: "2px 7px", borderRadius: "4px", background: "#231E1D", color: "#F2C48D" } },
                    turn.affectedTag || "异常感应"
                  )
                ),
                h("div", { style: { fontSize: "13px", lineHeight: 1.8, color: "#2D2520" } }, turn.sceneText),
                turn.charDialogue &&
                h(
                  "div",
                  { style: { marginTop: "8px", padding: "7px 10px", background: "rgba(154,43,36,0.08)", borderLeft: "2.5px solid #9A2B24", fontSize: "12.5px", fontWeight: 700, color: "#5E1E19" } },
                  turn.charName + "：" + turn.charDialogue
                ),
                turn.affectedDesc &&
                h("div", { style: { marginTop: "6px", fontSize: "11px", color: "#7A6B5D" } }, "异常状态：" + turn.affectedDesc)
              );
            })
        ),

        // Custom input + 4 Action Buttons
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "8px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.12)" } },
          h("input", {
            type: "text",
            value: customActionText,
            onChange: function (e) { setCustomActionText(e.target.value); },
            placeholder: "可补充一句你的举动或对名士说的话（可选）…",
            style: {
              width: "100%",
              boxSizing: "border-box",
              background: "#1B2022",
              border: "1px solid #4A433B",
              borderRadius: "8px",
              padding: "8px 10px",
              color: "#F3EAD8",
              fontSize: "12.5px",
              outline: "none"
            }
          }),
          h(
            "div",
            { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" } },
            Engine.INSPECTION_ACTIONS.map(function (act) {
              var isWarn = act.id === "communicate" && (selectedAnomaly.traits || []).indexOf("non_comm") >= 0;
              return h(
                "button",
                {
                  key: act.id,
                  type: "button",
                  disabled: isRunningVisit,
                  onClick: function () { handleRunAction(act.id); },
                  style: {
                    border: isWarn ? "1px solid #C94A3F" : "1px solid rgba(226,185,116,0.4)",
                    borderRadius: "8px",
                    padding: "8px 4px",
                    background: isRunningVisit ? "#2B2D2E" : isWarn ? "rgba(180,43,36,0.35)" : "rgba(42,36,32,0.92)",
                    color: "#F5EBD8",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: isRunningVisit ? "wait" : "pointer"
                  }
                },
                isRunningVisit ? "演绎中" : act.label
              );
            })
          )
        )
      ),

      // ===== Modal 2: Dual-Tab Anomaly Submission (亲自录入 / 传讯名士呈报) =====
      showCreateModal &&
      h(
        "div",
        {
          onClick: function (e) { if (e.target === e.currentTarget && !isPolishing && !isCharSubmitting) setShowCreateModal(false); },
          style: { position: "fixed", inset: 0, zIndex: 1035, background: "rgba(12,14,15,0.78)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }
        },
        h(
          "div",
          { style: { width: "100%", maxWidth: "374px", background: "#F4EEE2", color: "#28211D", borderRadius: "14px", padding: "16px", border: "2px solid #8D2621", display: "flex", flexDirection: "column", gap: "10px", maxHeight: "86vh", overflowY: "auto" } },
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h("span", { style: { fontSize: "15px", fontWeight: 900, color: "#7A1F1B" } }, "狭间异常收录 · 双档口"),
            h(
              "button",
              { type: "button", onClick: function () { if (!isPolishing && !isCharSubmitting) setShowCreateModal(false); }, style: { border: "none", background: "transparent", cursor: "pointer", color: "#5C4D42" } },
              XjIcon(h, "close", { size: 18, color: "#5C4D42" })
            )
          ),
          // Dual-Tab Switcher: 亲自录入 / 名士呈报
          h(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "6px",
                background: "#E6DDD0",
                padding: "4px",
                borderRadius: "9px"
              }
            },
            [
              { id: "self", label: "亲自录入" },
              { id: "character", label: "传讯名士呈报" }
            ].map(function (tab) {
              var active = createTab === tab.id;
              return h(
                "button",
                {
                  key: tab.id,
                  type: "button",
                  disabled: isPolishing || isCharSubmitting,
                  onClick: function () { setCreateTab(tab.id); },
                  style: {
                    border: "none",
                    borderRadius: "7px",
                    padding: "7px 8px",
                    background: active ? "#8D2621" : "transparent",
                    color: active ? "#FFF6E6" : "#5C4E42",
                    fontSize: "12.5px",
                    fontWeight: active ? 800 : 600,
                    cursor: "pointer"
                  }
                },
                tab.label
              );
            })
          ),

          createTab === "self"
            ? h(
                React.Fragment,
                null,
                h("input", {
                  type: "text",
                  value: draftName,
                  onChange: function (e) { setDraftName(e.target.value); },
                  placeholder: "收容物名称（如：故人油纸伞）",
                  style: { border: "1px solid #C8BCA8", borderRadius: "8px", padding: "8px 10px", fontSize: "13px", background: "#FFFDF9" }
                }),
                h(
                  "div",
                  { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" } },
                  h(
                    "select",
                    {
                      value: draftLevel,
                      onChange: function (e) { setDraftLevel(Number(e.target.value)); },
                      style: { border: "1px solid #C8BCA8", borderRadius: "8px", padding: "7px 8px", fontSize: "12px", background: "#FFFDF9" }
                    },
                    [1, 2, 3, 4, 5].map(function (lv) {
                      var m = Catalog.DANGER_LEVELS[lv];
                      return h("option", { key: lv, value: lv }, m.roman + "级 · " + m.title + "（" + m.scale + "）");
                    })
                  ),
                  h(
                    "select",
                    {
                      value: draftDiff,
                      onChange: function (e) { setDraftDiff(e.target.value); },
                      style: { border: "1px solid #C8BCA8", borderRadius: "8px", padding: "7px 8px", fontSize: "12px", background: "#FFFDF9" }
                    },
                    ["低", "中", "高"].map(function (d) {
                      return h("option", { key: d, value: d }, "收容难度：" + d);
                    })
                  )
                ),
                h(
                  "div",
                  { style: { display: "flex", flexWrap: "wrap", gap: "6px" } },
                  Object.keys(Catalog.DANGER_TRAITS).map(function (tid) {
                    var tr = Catalog.DANGER_TRAITS[tid];
                    var on = draftTraits.indexOf(tid) >= 0;
                    return h(
                      "button",
                      {
                        key: tid,
                        type: "button",
                        onClick: function () {
                          setDraftTraits(function (prev) {
                            return prev.indexOf(tid) >= 0 ? prev.filter(function (x) { return x !== tid; }) : prev.concat([tid]);
                          });
                        },
                        style: {
                          border: on ? "1px solid #9A221C" : "1px solid #C8BCA8",
                          background: on ? "rgba(180,43,36,0.14)" : "#FFFDF9",
                          color: on ? "#9A221C" : "#5C4D42",
                          borderRadius: "6px",
                          padding: "4px 8px",
                          fontSize: "11px",
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          cursor: "pointer"
                        }
                      },
                      XjIcon(h, tr.icon, { size: 11, color: on ? "#9A221C" : "#5C4D42" }),
                      tr.label
                    );
                  })
                ),
                h("textarea", {
                  rows: 4,
                  value: draftBrief,
                  onChange: function (e) { setDraftBrief(e.target.value); },
                  placeholder: "写一两句你的收容物脑洞简介，AI 将自动润色为完整 SCP 东汉风卷宗、活点巡游轨迹与 4 页仙人观测日志…",
                  style: { border: "1px solid #C8BCA8", borderRadius: "8px", padding: "8px 10px", fontSize: "12.5px", lineHeight: 1.6, background: "#FFFDF9", resize: "vertical" }
                }),
                h(
                  "button",
                  {
                    type: "button",
                    disabled: isPolishing,
                    onClick: handlePolishCreate,
                    style: {
                      height: "40px",
                      border: "none",
                      borderRadius: "10px",
                      background: isPolishing ? "#A88B84" : "#8D2621",
                      color: "#FFF6E6",
                      fontSize: "13.5px",
                      fontWeight: 800,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      cursor: isPolishing ? "wait" : "pointer"
                    }
                  },
                  XjIcon(h, "spark", { size: 15, color: "#FFF6E6" }),
                  isPolishing ? "AI 正在编纂卷宗与观测手札…" : "AI 一键润色并收录入库"
                )
              )
            : h(
                React.Fragment,
                null,
                h(
                  "div",
                  { style: { fontSize: "11.5px", lineHeight: 1.65, color: "#5C4D42", background: "#EBE2D2", borderRadius: "8px", padding: "9px 11px", borderLeft: "3px solid #2A231E" } },
                  "由传讯中的某位名士基于自身人设卡口吻、已开启世界书与近期境遇，一次性呈报 3~5 宗新异常，并附带第一人称复古活页【遭遇历程单】。"
                ),
                h(
                  "div",
                  { style: { display: "grid", gridTemplateColumns: "1.45fr 1fr", gap: "8px" } },
                  h(
                    "div",
                    { style: { display: "flex", flexDirection: "column", gap: "5px" } },
                    h("span", { style: { fontSize: "11.5px", fontWeight: 800, color: "#4D4036" } }, "选择呈报名士"),
                    h(
                      "select",
                      {
                        value: submitCharId,
                        onChange: function (e) { setSubmitCharId(e.target.value); },
                        style: { border: "1px solid #C8BCA8", borderRadius: "8px", padding: "8px 8px", fontSize: "12px", background: "#FFFDF9", color: "#28211D" }
                      },
                      h("option", { value: "__random__" }, "随机抽选名士"),
                      characters.map(function (c) {
                        return h("option", { key: c.id, value: c.id }, c.name + (c.mbti ? "（" + c.mbti + "）" : ""));
                      })
                    )
                  ),
                  h(
                    "div",
                    { style: { display: "flex", flexDirection: "column", gap: "5px" } },
                    h("span", { style: { fontSize: "11.5px", fontWeight: 800, color: "#4D4036" } }, "呈报数量"),
                    h(
                      "select",
                      {
                        value: submitCount,
                        onChange: function (e) { setSubmitCount(Number(e.target.value)); },
                        style: { border: "1px solid #C8BCA8", borderRadius: "8px", padding: "8px 8px", fontSize: "12px", background: "#FFFDF9", color: "#28211D" }
                      },
                      [3, 4, 5].map(function (n) {
                        return h("option", { key: n, value: n }, "一次 " + n + " 宗");
                      })
                    )
                  )
                ),
                h("textarea", {
                  rows: 3,
                  value: submitCue,
                  onChange: function (e) { setSubmitCue(e.target.value); },
                  placeholder: "可选：留一句模糊引子（如：夜巡旧坊 / 收到无名木匣），留空则完全交由名士按人设自由发散…",
                  style: { border: "1px solid #C8BCA8", borderRadius: "8px", padding: "8px 10px", fontSize: "12.5px", lineHeight: 1.6, background: "#FFFDF9", resize: "vertical" }
                }),
                h(
                  "button",
                  {
                    type: "button",
                    disabled: isCharSubmitting || characters.length === 0,
                    onClick: handleCharacterSubmit,
                    style: {
                      height: "40px",
                      border: "none",
                      borderRadius: "10px",
                      background: isCharSubmitting ? "#6E655D" : "#221D1A",
                      color: "#F5ECE0",
                      fontSize: "13px",
                      fontWeight: 800,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      cursor: isCharSubmitting ? "wait" : "pointer"
                    }
                  },
                  XjIcon(h, "scroll", { size: 15, color: "#E2B974" }),
                  isCharSubmitting ? "名士正在整理 " + submitCount + " 宗卷宗与历程单…" : "请名士呈报 " + submitCount + " 宗异常与历程单"
                )
              )
        )
      ),

      // ===== Modal 3: On-Demand Archival Media Capture (Step 3) =====
      showMediaModal && selectedAnomaly && global.XiajianMediaEngine && global.XiajianMediaEngine.MediaCaptureModal &&
      h(global.XiajianMediaEngine.MediaCaptureModal, {
        anomaly: selectedAnomaly,
        onClose: function () { setShowMediaModal(false); },
        onSaved: handleMediaSaved
      }),

      // Floating Toast
      toast &&
      h(
        "div",
        {
          style: {
            position: "fixed",
            bottom: "26px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1050,
            background: "rgba(24, 20, 18, 0.94)",
            border: "1px solid rgba(226,185,116,0.45)",
            color: "#F5EBD8",
            padding: "8px 16px",
            borderRadius: "999px",
            fontSize: "12px",
            fontWeight: 700,
            whiteSpace: "nowrap",
            maxWidth: "88vw",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }
        },
        toast
      )
    );
  }

  global.XiajianAppPage = XiajianAppPage;
  global.XiajianHomeIconSvg = XiajianHomeIconSvg;
})(typeof window !== "undefined" ? window : globalThis);

