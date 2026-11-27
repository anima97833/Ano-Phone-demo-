/**
 * Milvus/couple_surprise_journal_ui.js
 * 情侣空间 · 秘密惊喜「备礼历程（备礼手记）」独立 UI 模块（window.CoupleSurpriseJournalModal）
 *
 * 1:1 复刻参考图「航海日志」构图模式：
 * - 顶部木纹卷轴标题牌「备礼手记」+ 菱形「?」徽标 + 橙色木牌「✕」关闭按钮
 * - 顶部和风暖金浪花落日横幅（纯手绘 SVG）：
 *     左：金黄锯齿撕票日期卡（YYYY年M月D日 / 第 N 次 + 天气图标）
 *     右上：深褐木牌耗时/寻访里程标
 *     右中：小木舟载红结行囊 + 角色徽章 + 斜盖朱红四字锯齿印章（如：跋涉寻礼）
 * - 主体奶黄宣纸时间轴：
 *     顶行「心声」浅绿棕小胶囊 + 角色筹备絮语
 *     每条事件：彩色圆形双感叹号徽标（翠绿/暖金/灰褐）+ 浅米时间地点胶囊 + 关键词翠绿高亮正文
 * - 底部支持通过 LongImageExportEngine（window.html2canvas）一键保存纪念长图
 */
(function (global) {
  "use strict";

  var MOOD_BADGE_COLORS = {
    joy: { bg: "#7EB64E", ring: "#5E9234" },
    twist: { bg: "#E3A739", ring: "#B9801F" },
    calm: { bg: "#A69682", ring: "#827360" }
  };

  function renderHighlightedText(h, text, highlight) {
    var str = String(text || "");
    var kw = String(highlight || "").trim();
    if (!kw || str.indexOf(kw) < 0) return str;
    var parts = str.split(kw);
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i]) out.push(parts[i]);
      if (i < parts.length - 1) {
        out.push(
          h(
            "span",
            {
              key: "hl_" + i,
              style: { color: "#4C8C4A", fontWeight: 800 }
            },
            kw
          )
        );
      }
    }
    return out;
  }

  function WeatherBadgeSvg(h, weather) {
    if (weather === "moon") {
      return h(
        "svg",
        { width: 28, height: 28, viewBox: "0 0 32 32" },
        h("path", {
          d: "M21 6a10 10 0 1 0 5 17.5A8.5 8.5 0 1 1 21 6z",
          fill: "#FFF4C2",
          stroke: "#C78B28",
          strokeWidth: 1.6
        })
      );
    }
    if (weather === "cloud") {
      return h(
        "svg",
        { width: 28, height: 28, viewBox: "0 0 32 32" },
        h("path", {
          d: "M9 22h14a5 5 0 0 0 .6-9.95A6.5 6.5 0 0 0 11 11a4.5 4.5 0 0 0-2 11z",
          fill: "#FFF8E1",
          stroke: "#C78B28",
          strokeWidth: 1.6
        })
      );
    }
    // Default sun (复刻参考图撕票卡右侧暖阳)
    return h(
      "svg",
      { width: 30, height: 30, viewBox: "0 0 32 32" },
      h("circle", { cx: 16, cy: 16, r: 7.5, fill: "#FCE48B", stroke: "#CF8B26", strokeWidth: 1.5 }),
      [0, 45, 90, 135, 180, 225, 270, 315].map(function (deg) {
        return h("line", {
          key: deg,
          x1: 16,
          y1: 3.5,
          x2: 16,
          y2: 6.5,
          stroke: "#E5A538",
          strokeWidth: 2,
          strokeLinecap: "round",
          transform: "rotate(" + deg + " 16 16)"
        });
      })
    );
  }

  function DoubleBangBadge(h, mood) {
    var palette = MOOD_BADGE_COLORS[mood] || MOOD_BADGE_COLORS.joy;
    return h(
      "div",
      {
        style: {
          width: "26px",
          height: "26px",
          borderRadius: "50%",
          background: palette.bg,
          border: "2px solid " + palette.ring,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 2px 4px rgba(0,0,0,0.12)",
          position: "relative",
          zIndex: 2
        }
      },
      h(
        "svg",
        { width: 15, height: 15, viewBox: "0 0 16 16", fill: "#FFFFFF" },
        h("path", { d: "M4.5 2.5 L6.8 2.5 L6 10 L4.7 10 Z" }),
        h("circle", { cx: 5.3, cy: 12.6, r: 1.2 }),
        h("path", { d: "M9.4 2.5 L11.7 2.5 L10.9 10 L9.6 10 Z" }),
        h("circle", { cx: 10.2, cy: 12.6, r: 1.2 })
      )
    );
  }

  function CoupleSurpriseJournalModal(props) {
    var React = global.React;
    if (!React) return null;
    var h = React.createElement;
    var useRef = React.useRef;
    var useState = React.useState;

    var record = props && props.record;
    var onClose = props && props.onClose;
    if (!record) return null;

    var Engine = global.CoupleSurpriseEngine;
    var journal =
      Engine && typeof Engine.ensurePrepJournal === "function"
        ? Engine.ensurePrepJournal(record)
        : record.prepJournal || { events: [] };

    var charName = record.charName || "TA";
    var stampRaw = String(journal.stampText || "费尽心思").replace(/\s+/g, "");
    var stampLine1 = stampRaw.slice(0, 2) || "费尽";
    var stampLine2 = stampRaw.slice(2, 4) || "心思";

    var exportRef = useRef(null);
    var [exporting, setExporting] = useState(false);

    async function handleExportJournal() {
      if (exporting || !exportRef.current || typeof global.html2canvas !== "function") return;
      setExporting(true);
      try {
        var canvas = await global.html2canvas(exportRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#FBF6E8"
        });
        var url = canvas.toDataURL("image/png");
        var a = document.createElement("a");
        a.href = url;
        a.download = "备礼手记_" + (record.occasionName || "秘密惊喜") + ".png";
        a.click();
      } catch (_) {}
      setExporting(false);
    }

    return h(
      "div",
      {
        onClick: function (e) { if (e.target === e.currentTarget && onClose) onClose(); },
        style: {
          position: "fixed",
          inset: 0,
          zIndex: 1035,
          background: "rgba(32, 22, 14, 0.72)",
          backdropFilter: "blur(3px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "14px",
          fontFamily: "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif"
        }
      },
      h(
        "div",
        {
          style: {
            width: "100%",
            maxWidth: "390px",
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
            background: "#D89A68",
            borderRadius: "16px",
            padding: "5px",
            boxShadow: "0 16px 40px rgba(0,0,0,0.42)",
            position: "relative"
          }
        },
        // Top Wooden Header Bar (复刻参考图顶部「航海日志 ?」+ 右上橙木牌「✕」)
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 8px 8px",
              flexShrink: 0
            }
          },
          h(
            "div",
            {
              style: {
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "linear-gradient(180deg, #B57A4B 0%, #8E5931 100%)",
                border: "1.5px solid #6E4120",
                borderRadius: "6px",
                padding: "4px 12px",
                boxShadow: "0 2px 5px rgba(0,0,0,0.2)"
              }
            },
            h(
              "span",
              {
                style: {
                  fontSize: "15px",
                  fontWeight: 900,
                  color: "#FFFDF5",
                  letterSpacing: "1.5px",
                  textShadow: "0 1.5px 0 #5D3418"
                }
              },
              "备礼手记"
            ),
            h(
              "span",
              {
                title: charName + " 为「" + record.occasionName + "」暗中筹备惊喜的真实经过",
                style: {
                  width: "18px",
                  height: "18px",
                  background: "#E8C58E",
                  color: "#6B3E1D",
                  fontSize: "11px",
                  fontWeight: 900,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: "rotate(45deg)",
                  borderRadius: "3px"
                }
              },
              h("span", { style: { transform: "rotate(-45deg)" } }, "?")
            )
          ),
          h(
            "button",
            {
              type: "button",
              onClick: onClose,
              style: {
                width: "30px",
                height: "30px",
                border: "2px solid #8A3D17",
                borderRadius: "7px",
                background: "linear-gradient(180deg, #F0853E 0%, #D96426 100%)",
                color: "#FFFFFF",
                fontSize: "15px",
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0,0,0,0.22)"
              }
            },
            "✕"
          )
        ),

        // Scrollable Parchment Sheet (导出区域)
        h(
          "div",
          {
            style: {
              flex: 1,
              overflowY: "auto",
              borderRadius: "10px",
              background: "#FBF6E8",
              border: "2px solid #C9B28B"
            }
          },
          h(
            "div",
            { ref: exportRef, style: { background: "#FBF6E8", paddingBottom: "14px" } },

            // ===== Hero Banner (1:1 复刻参考图：和风浪花落日 + 撕票日期卡 + 木牌里程 + 小舟 + 斜盖朱红印章) =====
            h(
              "div",
              {
                style: {
                  position: "relative",
                  height: "144px",
                  background: "linear-gradient(180deg, #F4D88E 0%, #F1CA78 65%, #3C7E8C 66%, #2F6A78 100%)",
                  overflow: "hidden"
                }
              },
              // Japanese wave + red sun + birds + boat SVG
              h(
                "svg",
                {
                  viewBox: "0 0 380 144",
                  style: { position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }
                },
                // Red sun
                h("circle", { cx: 136, cy: 64, r: 42, fill: "#D8573B" }),
                // White stylized wave crest (left)
                h("path", {
                  d: "M0 84 Q34 20 96 42 Q122 52 108 72 Q96 86 140 84 Q188 82 222 58 Q254 36 296 66 L380 72 L380 144 L0 144 Z",
                  fill: "#3C7E8C"
                }),
                h("path", {
                  d: "M0 78 Q34 14 96 36 Q124 46 112 66 Q94 52 72 64 Q44 76 18 92 Z",
                  fill: "#FBF4E4"
                }),
                // Wave foam curves
                h("path", { d: "M12 126 Q66 108 122 126 T234 126 T356 126", fill: "none", stroke: "rgba(255,250,235,0.45)", strokeWidth: 3 }),
                // Tiny white birds
                h("path", { d: "M212 34 q4-4 8 0 q4-4 8 0", fill: "none", stroke: "#FFFDF6", strokeWidth: 2, strokeLinecap: "round" }),
                h("path", { d: "M232 48 q3-3 6 0 q3-3 6 0", fill: "none", stroke: "#FFFDF6", strokeWidth: 1.8, strokeLinecap: "round" }),
                // Wooden Boat carrying Red Bundle (右中下小木舟)
                h("g", { transform: "translate(188, 66)" },
                  // Boat hull
                  h("path", { d: "M6 26 L124 26 L112 50 Q65 58 18 50 Z", fill: "#8C6239", stroke: "#5B3B1E", strokeWidth: 2.2 }),
                  h("line", { x1: 12, y1: 36, x2: 118, y2: 36, stroke: "#6E4926", strokeWidth: 1.6 }),
                  // Red gift bundle in boat
                  h("path", { d: "M42 12 C32 2, 22 4, 20 10 C26 14, 34 14, 42 13 Z", fill: "#C94B31" }),
                  h("path", { d: "M45 12 C55 2, 65 4, 67 10 C61 14, 53 14, 45 13 Z", fill: "#DC5E42" }),
                  h("rect", { x: 26, y: 12, width: 35, height: 22, rx: 6, fill: "#C9462D", stroke: "#7C2414", strokeWidth: 1.5 }),
                  // Character avatar medallion on boat
                  h("circle", { cx: 88, cy: 20, r: 15, fill: "#FFF5E0", stroke: "#6E4120", strokeWidth: 2 }),
                  h(
                    "text",
                    { x: 88, y: 25, textAnchor: "middle", fontSize: "13", fontWeight: "900", fill: "#6A3B1C" },
                    charName.slice(0, 1)
                  )
                ),
                // Bottom parchment edge
                h("rect", { x: 0, y: 136, width: 380, height: 10, fill: "#FBF6E8" })
              ),

              // Top-right dark wooden duration/distance sign (复刻参考图右上「航程：3.8小时 / 229海里」)
              h(
                "div",
                {
                  style: {
                    position: "absolute",
                    top: "14px",
                    right: "12px",
                    background: "rgba(116, 76, 36, 0.9)",
                    border: "1.5px solid #5B3818",
                    borderRadius: "6px",
                    padding: "4px 10px",
                    color: "#FFF8E4",
                    fontSize: "11px",
                    fontWeight: 700,
                    lineHeight: 1.4,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.22)"
                  }
                },
                h("div", null, journal.durationText || "筹备：3.5小时"),
                h("div", null, journal.distanceText || "寻访：3处街市")
              ),

              // Bottom-left Gold Ticket Date Card (复刻参考图左下「2026年X月X日 / 第 1 次 + 太阳」)
              h(
                "div",
                {
                  style: {
                    position: "absolute",
                    left: "8px",
                    bottom: "16px",
                    background: "linear-gradient(180deg, #FBD665 0%, #F4BA3C 100%)",
                    border: "1.5px solid #C6831B",
                    borderRadius: "8px",
                    padding: "5px 9px",
                    display: "flex",
                    alignItems: "center",
                    gap: "7px",
                    boxShadow: "0 3px 8px rgba(0,0,0,0.18)"
                  }
                },
                h(
                  "div",
                  null,
                  h(
                    "div",
                    { style: { fontSize: "11px", fontWeight: 800, color: "#6E3F13", lineHeight: 1.25 } },
                    journal.prepDate || ""
                  ),
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: "4px", marginTop: "3px" } },
                    h("span", { style: { fontSize: "11.5px", fontWeight: 800, color: "#7B4716" } }, "第"),
                    h(
                      "span",
                      {
                        style: {
                          background: "#DE7E2D",
                          color: "#FFFFFF",
                          fontSize: "12px",
                          fontWeight: 900,
                          padding: "0 8px",
                          borderRadius: "4px",
                          lineHeight: "17px"
                        }
                      },
                      String(journal.seqNumber || 1)
                    ),
                    h("span", { style: { fontSize: "11.5px", fontWeight: 800, color: "#7B4716" } }, "次")
                  )
                ),
                h("div", { style: { width: "1px", height: "30px", borderLeft: "1.5px dashed #C78926" } }),
                WeatherBadgeSvg(h, journal.weather)
              ),

              // Tilted Crimson Stamp Seal (复刻参考图右下角「艰苦跋涉」斜盖朱红印章)
              h(
                "div",
                {
                  style: {
                    position: "absolute",
                    right: "8px",
                    bottom: "8px",
                    width: "62px",
                    height: "62px",
                    borderRadius: "50%",
                    background: "rgba(255, 248, 238, 0.92)",
                    border: "3px dashed #C85037",
                    boxShadow: "inset 0 0 0 2px #C85037, 0 3px 8px rgba(0,0,0,0.18)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: "rotate(-14deg)",
                    color: "#C4472E",
                    fontWeight: 900,
                    fontSize: "14px",
                    lineHeight: 1.15,
                    letterSpacing: "1px"
                  }
                },
                h("div", null, stampLine1),
                h("div", null, stampLine2)
              )
            ),

            // ===== Top Voice / Heartbeat Note Row (复刻参考图「语音」行) =====
            journal.voiceNote &&
              h(
                "div",
                {
                  style: {
                    padding: "10px 14px 10px",
                    borderBottom: "1px solid #E8DFC8",
                    display: "flex",
                    flexDirection: "column",
                    gap: "5px"
                  }
                },
                h(
                  "span",
                  {
                    style: {
                      alignSelf: "flex-start",
                      background: "#B6A566",
                      color: "#FFFFFF",
                      fontSize: "10.5px",
                      fontWeight: 700,
                      padding: "2px 10px",
                      borderRadius: "4px"
                    }
                  },
                  "备礼心声"
                ),
                h(
                  "div",
                  { style: { fontSize: "12.5px", color: "#68523B", lineHeight: 1.6 } },
                  "「" + journal.voiceNote + "」"
                )
              ),

            // ===== Timeline Events List (1:1 复刻参考图时间轴列表) =====
            h(
              "div",
              { style: { display: "flex", flexDirection: "column" } },
              (journal.events || []).map(function (ev, idx) {
                return h(
                  "div",
                  {
                    key: idx,
                    style: {
                      padding: "12px 14px",
                      borderBottom:
                        idx < (journal.events || []).length - 1
                          ? "1px solid #E8DFC8"
                          : "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: "7px"
                    }
                  },
                  // Row header: Circular !! badge + beige time/location pill
                  h(
                    "div",
                    { style: { display: "flex", alignItems: "center" } },
                    DoubleBangBadge(h, ev.mood),
                    h(
                      "div",
                      {
                        style: {
                          marginLeft: "-8px",
                          padding: "3px 14px 3px 16px",
                          background: "#EFE5C7",
                          borderRadius: "0 12px 12px 0",
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#7A5E3D",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "10px"
                        }
                      },
                      h("span", null, ev.time || ""),
                      h("span", null, ev.location || "")
                    )
                  ),
                  // Narrative body with green bold keyword highlight
                  h(
                    "div",
                    {
                      style: {
                        fontSize: "13px",
                        lineHeight: 1.72,
                        color: "#574230",
                        paddingLeft: "4px"
                      }
                    },
                    renderHighlightedText(h, ev.text, ev.highlight || charName)
                  )
                );
              })
            )
          )
        ),

        // Bottom Action Buttons
        h(
          "div",
          { style: { display: "flex", gap: "8px", padding: "8px 4px 4px", flexShrink: 0 } },
          h(
            "button",
            {
              type: "button",
              disabled: exporting,
              onClick: handleExportJournal,
              style: {
                flex: 1.4,
                height: "38px",
                border: "1.5px solid #7E4822",
                borderRadius: "10px",
                background: "linear-gradient(180deg, #ED8340 0%, #D45F24 100%)",
                color: "#FFFFFF",
                fontSize: "13px",
                fontWeight: 800,
                cursor: exporting ? "not-allowed" : "pointer"
              }
            },
            exporting ? "生成长图中…" : "📸 保存备礼手记长图"
          ),
          h(
            "button",
            {
              type: "button",
              onClick: onClose,
              style: {
                flex: 1,
                height: "38px",
                border: "1.5px solid #8E5B32",
                borderRadius: "10px",
                background: "#FFF8EB",
                color: "#6E4120",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer"
              }
            },
            "返回礼盒"
          )
        )
      )
    );
  }

  global.CoupleSurpriseJournalModal = CoupleSurpriseJournalModal;
})(typeof window !== "undefined" ? window : globalThis);

