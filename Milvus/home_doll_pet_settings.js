/**
 * Milvus/home_doll_pet_settings.js
 * 「设置 → 高级设置 → 桌面宠物」独立管理页面（严格零 AI · 零 Emoji 矢量风）
 * - 开启总开关后，自动列出用户在「棉花手作」制作的所有娃娃及后续导入的 Live2D / Spine 模型
 * - 对无缩略图的草稿娃娃使用 CottonDollRenderer 实时绘制迷你预览
 * - 支持一键选用、行为模式（默认安静待机 / 坐姿晃脚 / 自由漫步）、大小缩放、停靠角重置与外部 ZIP 上传
 */
(function (global) {
  "use strict";

  function MiniCottonPreview(props) {
    var React = global.React;
    if (!React) return null;
    var canvasRef = React.useRef(null);
    var snapshot = props && props.snapshot;

    React.useEffect(function () {
      var cv = canvasRef.current;
      var R = global.CottonDollRenderer;
      if (!cv || !R) return;
      var dpr = Math.min(global.devicePixelRatio || 1, 2);
      cv.width = Math.round(92 * dpr);
      cv.height = Math.round(112 * dpr);
      var ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, 92, 112);
      var st = snapshot || R.createDefaultState();
      var anim = R.createAnimState();
      R.drawFullDoll(ctx, st, anim, {
        centerX: 46,
        centerY: 62,
        scale: 0.34,
        turnDeg: 0,
        showCloth: true,
        showHair: true,
        useLiveAnim: false
      });
      ctx.restore();
    }, [snapshot]);

    return React.createElement("canvas", {
      ref: canvasRef,
      style: { width: "92px", height: "112px", display: "block", margin: "0 auto" }
    });
  }

  function HomeDollPetSettingsPage(props) {
    var React = global.React;
    if (!React) return null;
    var h = React.createElement;
    var useState = React.useState;
    var useEffect = React.useEffect;
    var useRef = React.useRef;

    var onClose = props && (props.onClose || props.onBack);
    var store = global.HomeDollPetStore;
    var [cfg, setCfg] = useState(function () { return store ? store.getConfig() : { enabled: false, scale: 1, behaviorMode: "quiet", corner: "bottom_right" }; });
    var [pets, setPets] = useState([]);
    var [loading, setLoading] = useState(true);
    var [importStatus, setImportStatus] = useState("");
    var [importing, setImporting] = useState(false);
    var fileInputRef = useRef(null);

    async function loadAll() {
      if (!store) { setLoading(false); return; }
      setCfg(store.getConfig());
      try {
        var list = await store.listAllPets();
        setPets(Array.isArray(list) ? list : []);
      } catch (_) {
        setPets([]);
      }
      setLoading(false);
    }

    useEffect(function () {
      loadAll();
      var onUpd = function () { loadAll(); };
      global.addEventListener("milvus-home-doll-pet-updated", onUpd);
      return function () { global.removeEventListener("milvus-home-doll-pet-updated", onUpd); };
    }, []);

    function updateCfg(patch) {
      if (!store) return;
      var next = store.saveConfig(patch);
      setCfg(next);
    }

    function handleToggleEnabled() {
      var nextEnabled = !cfg.enabled;
      var patch = { enabled: nextEnabled };
      if (nextEnabled && !cfg.activePetId && pets.length > 0) {
        patch.activePetId = pets[0].id;
      }
      updateCfg(patch);
    }

    function handleSelectPet(pet) {
      updateCfg({ activePetId: pet.id, enabled: true });
    }

    async function handleDeletePet(ev, pet) {
      ev.stopPropagation();
      if (!store || pet.fromAtelier) return;
      await store.deletePet(pet.id);
      loadAll();
    }

    async function handleZipSelected(ev) {
      var file = ev.target && ev.target.files && ev.target.files[0];
      if (ev.target) ev.target.value = "";
      if (!file) return;
      var importer = global.HomeDollPetImporters;
      if (!importer || typeof importer.importZip !== "function") {
        setImportStatus("外部模型上传插件尚未就绪。");
        return;
      }
      setImporting(true);
      setImportStatus("正在解析模型包：" + file.name + "…");
      try {
        var fname = file.name || "";
        var isGlb = /\.(glb|vrm)$/i.test(fname);
        var isAnimImg = /\.(gif|webp)$/i.test(fname);
        var rec = (isGlb && typeof importer.importGlbFile === "function")
          ? await importer.importGlbFile(file, function (stage) { setImportStatus(stage); })
          : (isAnimImg && typeof importer.importAnimatedImage === "function")
            ? await importer.importAnimatedImage(file, function (stage) { setImportStatus(stage); })
            : await importer.importZip(file, function (stage) { setImportStatus(stage); });
        if (rec && rec.id) {
          updateCfg({ activePetId: rec.id, enabled: true });
          setImportStatus("导入成功：「" + rec.name + "」已设为当前桌面宠物！");
          loadAll();
        }
      } catch (err) {
        setImportStatus("导入失败：" + (err && err.message ? err.message : String(err)));
      } finally {
        setImporting(false);
      }
    }

    var typeBadge = function (t) {
      if (t === "live2d") return { text: "Live2D", bg: "#EEF2FF", color: "#4F46E5" };
      if (t === "spine") return { text: "Spine", bg: "#FEF3C7", color: "#B45309" };
      if (t === "frames") return { text: "序列帧", bg: "#ECFDF5", color: "#047857" };
      if (t === "glb") return { text: "3D手办", bg: "#F3E8FF", color: "#7E22CE" };
      return { text: "棉花手作", bg: "#FDF2F4", color: "#B76373" };
    };

    var pillBtn = function (label, active, onClick) {
      return h("button", {
        type: "button",
        onClick: onClick,
        style: {
          flex: 1,
          padding: "8px 6px",
          borderRadius: "10px",
          border: active ? "1.5px solid #1E5F50" : "1px solid #E5E7EB",
          background: active ? "#EAF4F1" : "#FFFFFF",
          color: active ? "#1E5F50" : "#555",
          fontSize: "12px",
          fontWeight: active ? 700 : 500,
          cursor: "pointer"
        }
      }, label);
    };

    return h(
      "div",
      {
        style: {
          position: "fixed",
          inset: 0,
          zIndex: 1030,
          background: "#F5F7F8",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
          color: "#222"
        }
      },
      // Header
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "max(16px, env(safe-area-inset-top)) 16px 12px",
            background: "#FFFFFF",
            borderBottom: "1px solid #EBEEEF",
            flexShrink: 0
          }
        },
        h("button", {
          type: "button",
          onClick: onClose,
          style: {
            border: "none",
            background: "transparent",
            color: "#1E5F50",
            fontSize: "15px",
            fontWeight: 700,
            cursor: "pointer",
            padding: "4px 6px"
          }
        }, "‹ 返回"),
        h("div", { style: { fontSize: "16px", fontWeight: 700, color: "#1F2937" } }, "桌面宠物"),
        h("div", { style: { width: "48px" } })
      ),

      // Scrollable Body
      h(
        "div",
        { style: { flex: 1, overflowY: "auto", padding: "14px 16px 36px", display: "flex", flexDirection: "column", gap: "14px" } },

        // 1. Master Switch Card
        h(
          "div",
          { style: { background: "#FFFFFF", borderRadius: "16px", padding: "14px 16px", boxShadow: "0 2px 10px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" } },
          h(
            "div",
            { style: { flex: 1 } },
            h("div", { style: { fontSize: "15px", fontWeight: 700, color: "#1F2937" } }, "开启主屏幕桌面宠物"),
            h("div", { style: { fontSize: "12px", color: "#6B7280", marginTop: "3px" } }, "开启后，在主屏角落安静陪伴，轻戳互动、长按可唤出小菜单")
          ),
          h(
            "label",
            { style: { position: "relative", display: "inline-block", width: "46px", height: "26px", flexShrink: 0, cursor: "pointer" } },
            h("input", { type: "checkbox", checked: Boolean(cfg.enabled), onChange: handleToggleEnabled, style: { opacity: 0, width: 0, height: 0 } }),
            h(
              "span",
              { style: { position: "absolute", inset: 0, backgroundColor: cfg.enabled ? "#1E5F50" : "#D1D5DB", borderRadius: "26px", transition: "0.22s" } },
              h("span", { style: { position: "absolute", width: "20px", height: "20px", left: cfg.enabled ? "23px" : "3px", bottom: "3px", background: "#FFF", borderRadius: "50%", transition: "0.22s", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" } })
            )
          )
        ),

        // 2. Handmade Cotton Dolls & Uploaded Models Gallery
        cfg.enabled &&
        h(
          "div",
          { style: { background: "#FFFFFF", borderRadius: "16px", padding: "14px 16px", boxShadow: "0 2px 10px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: "10px" } },
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h("div", { style: { fontSize: "14px", fontWeight: 700, color: "#1F2937" } }, "我的手作娃娃与模型 (" + pets.length + ")"),
            h("button", {
              type: "button",
              onClick: loadAll,
              style: { border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#4B5563", fontSize: "11px", fontWeight: 600, padding: "4px 9px", borderRadius: "10px", cursor: "pointer" }
            }, "刷新列表")
          ),
          loading
            ? h("div", { style: { textAlign: "center", padding: "20px 0", fontSize: "12.5px", color: "#9CA3AF" } }, "正在读取娃柜…")
            : pets.length === 0
              ? h(
                "div",
                { style: { textAlign: "center", padding: "18px 10px", background: "#FAF7F2", borderRadius: "12px", border: "1px dashed #E4D4C3", fontSize: "12px", color: "#755B4E", lineHeight: 1.6 } },
                "尚未检测到你亲手制作的棉花娃娃。",
                h("br"),
                "可前往「东汉工坊 → 棉花手作」捏一只专属娃娃，保存或生成出生证后会自动出现在这里（当前主屏已默认展示「奶糖小兔」）。"
              )
              : h(
                "div",
                { style: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" } },
                pets.map(function (pet) {
                  var isActive = String(cfg.activePetId) === String(pet.id) || (!cfg.activePetId && pets[0] && pets[0].id === pet.id);
                  var badge = typeBadge(pet.type);
                  return h(
                    "div",
                    {
                      key: pet.id,
                      onClick: function () { handleSelectPet(pet); },
                      style: {
                        position: "relative",
                        borderRadius: "14px",
                        padding: "10px 8px",
                        background: isActive ? "#F2F9F6" : "#FAF9F7",
                        border: isActive ? "2px solid #1E5F50" : "1.2px solid #E8E3DC",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "6px",
                        cursor: "pointer"
                      }
                    },
                    h("span", {
                      style: {
                        position: "absolute",
                        top: "6px",
                        left: "6px",
                        fontSize: "9.5px",
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: "8px",
                        background: badge.bg,
                        color: badge.color
                      }
                    }, badge.text),
                    !pet.fromAtelier &&
                    h("button", {
                      type: "button",
                      onClick: function (ev) { handleDeletePet(ev, pet); },
                      title: "移除",
                      style: {
                        position: "absolute",
                        top: "5px",
                        right: "5px",
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        border: "none",
                        background: "rgba(0,0,0,0.06)",
                        color: "#9CA3AF",
                        fontSize: "12px",
                        cursor: "pointer"
                      }
                    }, "×"),
                    pet.thumb
                      ? h("img", { src: pet.thumb, alt: pet.name, style: { width: "86px", height: "110px", objectFit: "cover", borderRadius: "10px", border: "1px solid #EAE2D7" } })
                      : pet.type === "cotton"
                        ? h(MiniCottonPreview, { snapshot: pet.snapshot })
                        : h("div", { style: { width: "86px", height: "110px", borderRadius: "10px", background: "#EEF2F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "#64748B", fontWeight: 700 } }, badge.text),
                    h("div", { style: { fontSize: "12.5px", fontWeight: 700, color: "#1F2937", maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, pet.name),
                    h("div", { style: { fontSize: "10.5px", color: isActive ? "#1E5F50" : "#888", fontWeight: isActive ? 700 : 400 } }, isActive ? "当前陪伴中" : "点击设为桌宠")
                  );
                })
              )
        ),

        // 3. Behavior & Appearance Controls
        cfg.enabled &&
        h(
          "div",
          { style: { background: "#FFFFFF", borderRadius: "16px", padding: "14px 16px", boxShadow: "0 2px 10px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: "12px" } },
          h("div", { style: { fontSize: "14px", fontWeight: 700, color: "#1F2937" } }, "待机行为与外观"),
          h(
            "div",
            null,
            h("div", { style: { fontSize: "12px", color: "#6B7280", marginBottom: "6px" } }, "行为模式"),
            h(
              "div",
              { style: { display: "flex", gap: "8px" } },
              pillBtn("角落安静待机", cfg.behaviorMode === "quiet", function () { updateCfg({ behaviorMode: "quiet" }); }),
              pillBtn("坐姿晃脚", cfg.behaviorMode === "sit_dock", function () { updateCfg({ behaviorMode: "sit_dock" }); }),
              pillBtn("自由漫步", cfg.behaviorMode === "roam", function () { updateCfg({ behaviorMode: "roam" }); })
            )
          ),
          h(
            "div",
            null,
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" } },
              h("span", { style: { fontSize: "12px", color: "#6B7280" } }, "桌宠尺寸（支持超小迷你尺寸）"),
              h("span", { style: { fontSize: "12px", fontWeight: 700, color: "#1E5F50" } }, Math.round((cfg.scale || 0.75) * 100) + "%")
            ),
            h("input", {
              type: "range",
              min: 0.35,
              max: 1.5,
              step: 0.05,
              value: Number(cfg.scale) || 0.75,
              onChange: function (ev) { updateCfg({ scale: parseFloat(ev.target.value) }); },
              style: { width: "100%", accentColor: "#1E5F50", cursor: "pointer", marginBottom: "8px" }
            }),
            h(
              "div",
              { style: { display: "flex", gap: "6px" } },
              pillBtn("迷你 45%", Math.abs((cfg.scale || 0.75) - 0.45) < 0.03, function () { updateCfg({ scale: 0.45 }); }),
              pillBtn("偏小 65%", Math.abs((cfg.scale || 0.75) - 0.65) < 0.03, function () { updateCfg({ scale: 0.65 }); }),
              pillBtn("标准 90%", Math.abs((cfg.scale || 0.75) - 0.9) < 0.03, function () { updateCfg({ scale: 0.9 }); }),
              pillBtn("偏大 120%", Math.abs((cfg.scale || 0.75) - 1.2) < 0.03, function () { updateCfg({ scale: 1.2 }); })
            )
          ),
          h(
            "div",
            { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", paddingTop: "4px", borderTop: "1px solid #F3F4F6" } },
            h(
              "div",
              null,
              h("div", { style: { fontSize: "13px", fontWeight: 700, color: "#1F2937" } }, "全局置顶悬浮"),
              h("div", { style: { fontSize: "11px", color: "#6B7280", marginTop: "2px" } }, "打开传讯、工坊等应用时也常驻在最上方陪伴")
            ),
            h(
              "label",
              { style: { position: "relative", display: "inline-block", width: "44px", height: "24px", flexShrink: 0, cursor: "pointer" } },
              h("input", {
                type: "checkbox",
                checked: cfg.alwaysOnTop !== false,
                onChange: function () { updateCfg({ alwaysOnTop: cfg.alwaysOnTop === false }); },
                style: { opacity: 0, width: 0, height: 0 }
              }),
              h(
                "span",
                { style: { position: "absolute", inset: 0, backgroundColor: cfg.alwaysOnTop !== false ? "#1E5F50" : "#D1D5DB", borderRadius: "24px", transition: "0.22s" } },
                h("span", { style: { position: "absolute", width: "18px", height: "18px", left: cfg.alwaysOnTop !== false ? "23px" : "3px", bottom: "3px", background: "#FFF", borderRadius: "50%", transition: "0.22s", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" } })
              )
            )
          ),
          h(
            "div",
            null,
            h("div", { style: { fontSize: "12px", color: "#6B7280", marginBottom: "6px" } }, "停靠角落复位"),
            h(
              "div",
              { style: { display: "flex", gap: "8px" } },
              pillBtn("停靠右下角", cfg.nx >= 0.5, function () { updateCfg({ corner: "bottom_right", nx: 0.84, ny: 0.82 }); }),
              pillBtn("停靠左下角", cfg.nx < 0.5, function () { updateCfg({ corner: "bottom_left", nx: 0.16, ny: 0.82 }); })
            )
          )
        ),

        // 4. External Live2D / Spine ZIP Upload
        cfg.enabled &&
          h(
            "div",
            { style: { background: "#FFFFFF", borderRadius: "16px", padding: "14px 16px", boxShadow: "0 2px 10px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: "8px" } },
            h("div", { style: { fontSize: "14px", fontWeight: 700, color: "#1F2937" } }, "导入外部模型（Live2D / Spine / Shimeji / 3D GLB & VRM）"),
            h("div", { style: { fontSize: "12px", color: "#6B7280", lineHeight: 1.5 } }, "支持 Live2D、Spine（3.8~4.3）、Java Shimeji、Python 序列帧 .zip、透明 .gif/.webp，以及 Nomad .glb 与 MateEngine/VRoid .vrm 3D 模型。"),
            h("input", { ref: fileInputRef, type: "file", accept: ".zip,application/zip,.gif,.webp,image/gif,image/webp,.glb,.vrm,model/gltf-binary", onChange: handleZipSelected, style: { display: "none" } }),
            h("button", {
              type: "button",
              disabled: importing,
              onClick: function () { if (fileInputRef.current) fileInputRef.current.click(); },
              style: {
                width: "100%",
                padding: "10px",
                borderRadius: "12px",
                border: "1.5px dashed #1E5F50",
                background: "#F4FAF8",
                color: "#1E5F50",
                fontSize: "13px",
                fontWeight: 700,
                cursor: importing ? "wait" : "pointer"
              }
            }, importing ? "正在解析与导入模型…" : "选择本地 .zip / .vrm / .glb / .gif 上传"),
            importStatus && h("div", { style: { fontSize: "11.5px", color: "#1E5F50", background: "#F0FDF9", padding: "7px 10px", borderRadius: "10px", lineHeight: 1.45 } }, importStatus)
          )
      )
    );
  }

  global.HomeDollPetSettingsPage = HomeDollPetSettingsPage;
})(typeof window !== "undefined" ? window : globalThis);
