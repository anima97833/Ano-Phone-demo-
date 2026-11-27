/**
 * Milvus/han_workshop_app.js
 * 主屏幕应用「东汉工坊」独立模块化启动台与插件宿主引擎
 *
 * 视觉风格：1:1 复刻极简雾白新拟态（Mist-Porcelain Neumorphism）× 黛青细线矢量（#1D5A4C）
 * - 零 Emoji，100% 极简细线矢量 SVG
 * - 双列大气留白工位格（支持后续蛋糕工坊、饮品工坊等独立子玩法模块通过 registerWorkshop 热插拔接入，无需再改动 app.min.js）
 */
(function (global) {
  "use strict";

  // ==================== 1. Built-in Default Slots & Plugin Registry ====================

  var DEFAULT_SLOTS = [
    {
      id: "cake",
      title: "蛋糕工坊",
      subtitle: "Cake Studio",
      icon: "cake",
      status: "upcoming", // "ready" | "upcoming" | "empty"
      component: null
    },
    {
      id: "drink",
      title: "饮品工坊",
      subtitle: "Drink Lab",
      icon: "drink",
      status: "upcoming",
      component: null
    },
    {
      id: "sachet",
      title: "香囊造物",
      subtitle: "Sachet Craft",
      icon: "leaf",
      status: "upcoming",
      component: null
    },
    {
      id: "lacquer",
      title: "器物绘彩",
      subtitle: "Lacquer Art",
      icon: "brush",
      status: "upcoming",
      component: null
    },
    {
      id: "slot_5",
      title: "预留工位",
      subtitle: "Open Slot",
      icon: "plus",
      status: "empty",
      component: null
    },
    {
      id: "slot_6",
      title: "预留工位",
      subtitle: "Open Slot",
      icon: "plus",
      status: "empty",
      component: null
    }
  ];

  var registry = DEFAULT_SLOTS.map(function (s) { return Object.assign({}, s); });

  function notifyRegistryChanged() {
    try {
      if (typeof global.dispatchEvent === "function" && typeof CustomEvent === "function") {
        global.dispatchEvent(new CustomEvent("milvus-han-workshop-registry-changed"));
      }
    } catch (_) {}
  }

  /**
   * Hot-plug API for future workshop mini-games (e.g. Cake Frosting, Drink Mixing).
   * Calling registerWorkshop("cake", { title, subtitle, component }) activates that slot
   * with zero edits to app.min.js or han_workshop_app.js.
   */
  function registerWorkshop(slotId, config) {
    if (!slotId || !config) return;
    var idx = registry.findIndex(function (s) { return s.id === slotId; });
    if (idx >= 0) {
      registry[idx] = Object.assign({}, registry[idx], config, {
        id: slotId,
        status: config.component ? "ready" : (config.status || registry[idx].status)
      });
    } else {
      registry.push(Object.assign({
        id: slotId,
        title: config.title || "新工坊",
        subtitle: config.subtitle || "Workshop",
        icon: config.icon || "spark",
        status: config.component ? "ready" : "upcoming",
        component: null
      }, config));
    }
    notifyRegistryChanged();
  }

  function getWorkshops() {
    return registry.slice();
  }

  // ==================== 2. Minimal Jade-Teal Line SVG Icon Library (Zero Emoji) ====================

  function WorkshopIcon(h, name, opts) {
    var size = (opts && opts.size) || 28;
    var color = (opts && opts.color) || "#1E5F50";
    var sw = (opts && opts.strokeWidth) || 1.75;
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
      case "menu":
        return h("svg", common,
          h("path", { d: "M4 7h16M4 12h16M4 17h16" })
        );
      case "back":
        return h("svg", common,
          h("path", { d: "M15 5l-7 7 7 7M8 12h11" })
        );
      case "cake":
        return h("svg", common,
          h("path", { d: "M4 14h16v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6z" }),
          h("path", { d: "M6 14v-3a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3" }),
          h("path", { d: "M4 14c1.5 1.5 3.5 1.5 5 0 1.5 1.5 3.5 1.5 5 0 1.5 1.5 3.5 1.5 5 0" }),
          h("path", { d: "M12 9V6" }),
          h("path", { d: "M12 3.5c.8 1 .8 2 0 2.5-.8-.5-.8-1.5 0-2.5z" })
        );
      case "drink":
        return h("svg", common,
          h("path", { d: "M7 8h10l-1.2 11a1.5 1.5 0 0 1-1.5 1.3H9.7A1.5 1.5 0 0 1 8.2 19L7 8z" }),
          h("path", { d: "M6 8h12" }),
          h("path", { d: "M13 8l1.6-4.5H17" }),
          h("path", { d: "M8 13h8" })
        );
      case "leaf":
        return h("svg", common,
          h("path", { d: "M18.5 5.5C12 5.5 6.5 9.5 6 17.5c8-.5 12.5-5.5 12.5-12z" }),
          h("path", { d: "M6 17.5L13.5 10" })
        );
      case "brush":
        return h("svg", common,
          h("path", { d: "M18.5 4.5l1 1-9.5 9.5-2.5-2.5L17 3l1.5 1.5z" }),
          h("path", { d: "M8.5 13.5c-2 .4-3 1.8-3.2 3.5-.1 1-.6 1.7-1.5 2 2.2.7 4.6-.1 5.7-1.8.6-.9.7-2 .2-2.9" })
        );
      case "plus":
        return h("svg", common,
          h("path", { d: "M12 6v12M6 12h12" })
        );
      default:
        return h("svg", common,
          h("path", { d: "M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" })
        );
    }
  }

  // ==================== 3. Main Fullscreen App: 东汉工坊 ====================

  function HanWorkshopAppPage(props) {
    var React = global.React;
    if (!React) return null;
    var h = React.createElement;
    var useEffect = React.useEffect;
    var useState = React.useState;

    var onClose = props && (props.onClose || props.onBack);
    var [slots, setSlots] = useState(function () { return getWorkshops(); });
    var [activeSlotId, setActiveSlotId] = useState(null);
    var [menuOpen, setMenuOpen] = useState(false);
    var [toast, setToast] = useState("");

    useEffect(function () {
      var onReg = function () { setSlots(getWorkshops()); };
      global.addEventListener("milvus-han-workshop-registry-changed", onReg);
      return function () { global.removeEventListener("milvus-han-workshop-registry-changed", onReg); };
    }, []);

    function flashToast(msg) {
      setToast(msg);
      setTimeout(function () {
        setToast(function (cur) { return cur === msg ? "" : cur; });
      }, 2200);
    }

    var activeSlot = activeSlotId
      ? slots.find(function (s) { return s.id === activeSlotId; })
      : null;

    // If a registered sub-workshop component is active, render it fullscreen with back handler
    if (activeSlot && typeof activeSlot.component === "function") {
      return h(activeSlot.component, {
        onBack: function () { setActiveSlotId(null); },
        onClose: function () { setActiveSlotId(null); }
      });
    }

    return h(
      "div",
      {
        style: {
          position: "fixed",
          inset: 0,
          zIndex: 1010,
          background: "#EBF0F2",
          color: "#1B5648",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
          overflow: "hidden"
        }
      },

      // Top Minimalist Header (1:1 Reference: Left bold stacked title, Right clean 3-bar menu)
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "max(26px, calc(env(safe-area-inset-top) + 14px)) 24px 18px",
            flexShrink: 0
          }
        },
        h(
          "div",
          null,
          h(
            "div",
            {
              style: {
                fontSize: "20px",
                fontWeight: 900,
                letterSpacing: "1.6px",
                color: "#1A5648",
                lineHeight: 1.15
              }
            },
            "东汉工坊"
          ),
          h(
            "div",
            {
              style: {
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "2.2px",
                color: "#43786B",
                marginTop: "3px"
              }
            },
            "HAN WORKSHOP"
          )
        ),
        h(
          "div",
          { style: { position: "relative" } },
          h(
            "button",
            {
              type: "button",
              onClick: function () { setMenuOpen(function (v) { return !v; }); },
              title: "工坊菜单",
              style: {
                width: "40px",
                height: "40px",
                border: "none",
                borderRadius: "12px",
                background: "#EBF0F2",
                boxShadow: menuOpen
                  ? "inset 3px 3px 7px rgba(173, 188, 194, 0.55), inset -3px -3px 7px rgba(255, 255, 255, 0.9)"
                  : "-4px -4px 10px rgba(255, 255, 255, 0.88), 4px 4px 10px rgba(173, 188, 194, 0.44)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer"
              }
            },
            WorkshopIcon(h, "menu", { size: 22, color: "#1A5648", strokeWidth: 2.2 })
          ),
          menuOpen &&
            h(
              "div",
              {
                style: {
                  position: "absolute",
                  top: "48px",
                  right: 0,
                  minWidth: "136px",
                  background: "#F1F5F6",
                  borderRadius: "14px",
                  padding: "6px",
                  boxShadow: "0 12px 26px rgba(26, 86, 72, 0.14), 0 0 0 1px rgba(255,255,255,0.85) inset",
                  zIndex: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px"
                }
              },
              h(
                "button",
                {
                  type: "button",
                  onClick: function () {
                    setMenuOpen(false);
                    if (onClose) onClose();
                  },
                  style: {
                    border: "none",
                    background: "transparent",
                    color: "#1A5648",
                    fontSize: "13px",
                    fontWeight: 700,
                    padding: "9px 12px",
                    borderRadius: "9px",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer"
                  }
                },
                WorkshopIcon(h, "back", { size: 15, color: "#1A5648" }),
                "返回主屏幕"
              )
            )
        )
      ),

      // Main 2-Column Airy Neumorphic Card Grid (1:1 Reference Layout)
      h(
        "div",
        {
          onClick: function () { if (menuOpen) setMenuOpen(false); },
          style: {
            flex: 1,
            overflowY: "auto",
            padding: "8px 22px max(34px, env(safe-area-inset-bottom))"
          }
        },
        h(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "20px",
              maxWidth: "420px",
              margin: "0 auto"
            }
          },
          slots.map(function (slot) {
            var isEmpty = slot.status === "empty";
            var isReady = slot.status === "ready" && typeof slot.component === "function";

            return h(
              "button",
              {
                key: slot.id,
                type: "button",
                onClick: function () {
                  if (isReady) {
                    setActiveSlotId(slot.id);
                  } else if (isEmpty) {
                    flashToast("该工位已预留，静候新造物玩法入驻");
                  } else {
                    flashToast("「" + slot.title + "」正在筹备打磨中，敬请期待");
                  }
                },
                style: {
                  position: "relative",
                  aspectRatio: "1 / 1.04",
                  borderRadius: "24px",
                  border: isEmpty ? "1.5px dashed rgba(30, 95, 80, 0.22)" : "1px solid rgba(255, 255, 255, 0.65)",
                  background: isEmpty ? "rgba(235, 240, 242, 0.65)" : "#EDF2F4",
                  boxShadow: isEmpty
                    ? "inset 4px 4px 10px rgba(176, 191, 197, 0.28), inset -4px -4px 10px rgba(255, 255, 255, 0.72)"
                    : "-8px -8px 18px rgba(255, 255, 255, 0.92), 9px 9px 20px rgba(173, 188, 194, 0.45)",
                  padding: "20px 18px",
                  boxSizing: "border-box",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  alignItems: "stretch",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "transform 0.16s ease, box-shadow 0.16s ease"
                }
              },
              // Top-right crisp vector icon (1:1 reference placement)
              h(
                "div",
                {
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start"
                  }
                },
                isReady
                  ? h("span", {
                      style: {
                        width: "7px",
                        height: "7px",
                        borderRadius: "50%",
                        background: "#268C73",
                        marginTop: "4px"
                      }
                    })
                  : h("span", null),
                WorkshopIcon(h, slot.icon, {
                  size: 30,
                  color: isEmpty ? "rgba(30, 95, 80, 0.34)" : "#1E5F50",
                  strokeWidth: 1.75
                })
              ),

              // Bottom-left stacked title + airy subtitle (1:1 reference placement)
              h(
                "div",
                null,
                h(
                  "div",
                  {
                    style: {
                      fontSize: "15.5px",
                      fontWeight: 800,
                      color: isEmpty ? "rgba(26, 86, 72, 0.46)" : "#1D5B4D",
                      lineHeight: 1.35,
                      letterSpacing: "0.4px"
                    }
                  },
                  slot.title
                ),
                h(
                  "div",
                  {
                    style: {
                      fontSize: "11.5px",
                      fontWeight: 600,
                      color: isEmpty ? "rgba(67, 120, 107, 0.42)" : "#56857A",
                      marginTop: "3px",
                      letterSpacing: "0.3px"
                    }
                  },
                  isReady ? slot.subtitle : (isEmpty ? "待启封空位" : slot.subtitle + " · 筹备中")
                )
              )
            );
          })
        )
      ),

      // Subtle bottom return pill for easy one-handed exit on mobile
      h(
        "div",
        {
          style: {
            padding: "8px 24px max(18px, env(safe-area-inset-bottom))",
            display: "flex",
            justifyContent: "center",
            flexShrink: 0
          }
        },
        h(
          "button",
          {
            type: "button",
            onClick: onClose,
            style: {
              border: "none",
              borderRadius: "999px",
              padding: "8px 22px",
              background: "#EDF2F4",
              color: "#3A6E62",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "1px",
              boxShadow: "-4px -4px 10px rgba(255, 255, 255, 0.9), 4px 4px 10px rgba(173, 188, 194, 0.42)",
              cursor: "pointer"
            }
          },
          "返回桌面"
        )
      ),

      // Minimal floating toast
      toast &&
        h(
          "div",
          {
            style: {
              position: "fixed",
              bottom: "74px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1050,
              background: "rgba(26, 86, 72, 0.92)",
              color: "#F0F6F4",
              padding: "8px 18px",
              borderRadius: "999px",
              fontSize: "12px",
              fontWeight: 600,
              whiteSpace: "nowrap",
              boxShadow: "0 8px 20px rgba(26, 86, 72, 0.24)"
            }
          },
          toast
        )
    );
  }

  global.HanWorkshopApp = {
    version: "1.0.0",
    registerWorkshop: registerWorkshop,
    getWorkshops: getWorkshops,
    HanWorkshopAppPage: HanWorkshopAppPage
  };
  global.HanWorkshopAppPage = HanWorkshopAppPage;
})(typeof window !== "undefined" ? window : globalThis);
