/**
 * Milvus/couple_surprise_app.js
 * 情侣空间 ·「秘密惊喜（锦囊行囊 · 到日揭晓）」独立 UI 模块（window.CoupleSurprisePage）
 *
 * 视觉严格参照：
 * - 图 1：暖杏和风「收拾行囊」主界面（顶部红结锦囊舞台 + 中部 2×4 虚线背包好物槽 + 下部左右金额/信件槽 + 底部清空篮与封存按钮）
 * - 图 2：背包选物弹窗（顶部已选 2×4 槽位预览 + 分类标签条 + 带 xN 数量角标的物品网格 + 橙红确定按钮）
 * - 图 3：复古奶油粉红信笺样式（左上曲别针 + 右上卷角 + 珊瑚红漆刷标题横幅 + 双爱心称呼 + 暖棕墨水正文 + 折纸压痕 + 底部日期落款与小印章）
 */
(function (global) {
  "use strict";

  var QUICK_OCCASIONS = ["纪念日", "TA的生日", "我的生日", "七夕", "冬至", "专属秘密日"];
  var BAG_CATEGORIES = [
    { id: "all", label: "全部" },
    { id: "food", label: "吃食" },
    { id: "gift", label: "奇珍礼物" },
    { id: "ticket", label: "票券凭证" },
    { id: "other", label: "其他" }
  ];
  var COIN_PRESETS = [50, 100, 188, 520, 1314];

  // ==================== 1. Custom Hand-Drawn SVG Artwork ====================

  function FuroshikiBundleArt(h, opts) {
    var itemCount = (opts && opts.itemCount) || 0;
    var hasCoins = !!(opts && opts.hasCoins);
    var hasLetter = !!(opts && opts.hasLetter);
    var statusText = (opts && opts.statusText) || "收拾行囊中";

    return h(
      "div",
      {
        style: {
          position: "relative",
          width: "100%",
          height: "152px",
          background:
            "radial-gradient(circle at 50% 25%, #FFE7A6 0%, #F7D488 55%, #E7BA6A 100%)",
          borderRadius: "18px 18px 0 0",
          overflow: "hidden",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center"
        }
      },
      // Background clouds & wave accents
      h(
        "svg",
        {
          viewBox: "0 0 360 152",
          style: { position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }
        },
        h("path", { d: "M-10 46 H55 a10 10 0 0 1 0 20 H18 a8 8 0 0 0 0 16 H68", fill: "none", stroke: "rgba(255,250,235,0.68)", strokeWidth: 9, strokeLinecap: "round" }),
        h("path", { d: "M370 36 H305 a9 9 0 0 0 0 18 H340 a8 8 0 0 1 0 16 H290", fill: "none", stroke: "rgba(255,250,235,0.68)", strokeWidth: 8, strokeLinecap: "round" }),
        // Decorative hanging charm on right
        h("g", { transform: "translate(300, 92) rotate(14)" },
          h("rect", { x: 0, y: 0, width: 28, height: 42, rx: 6, fill: "#EB763B", stroke: "#8A3B1B", strokeWidth: 1.5 }),
          h("path", { d: "M8 10 h12 M14 10 v22", stroke: "#FFF4E0", strokeWidth: 2, strokeLinecap: "round" })
        ),
        // Bottom cream wave border
        h("path", {
          d: "M0 138 Q90 124 180 138 T360 138 L360 152 L0 152 Z",
          fill: "#FAF3E6"
        })
      ),
      // Center Red Furoshiki Bundle (图1 核心红结包袱)
      h(
        "svg",
        {
          viewBox: "0 0 220 138",
          style: { width: "210px", height: "132px", position: "relative", zIndex: 2, marginBottom: "4px" }
        },
        // Bow ears
        h("path", { d: "M108 26 C82 4, 52 8, 42 22 C54 34, 82 34, 108 30 Z", fill: "#C94B31", stroke: "#8F2D1A", strokeWidth: 2 }),
        h("path", { d: "M112 26 C138 4, 168 8, 178 22 C166 34, 138 34, 112 30 Z", fill: "#D4563B", stroke: "#8F2D1A", strokeWidth: 2 }),
        // Bundle outer cloth
        h("path", { d: "M38 34 Q110 20 182 34 L194 122 Q110 134 26 122 Z", fill: "#C9462D", stroke: "#8A2B18", strokeWidth: 2.2 }),
        // Bow center knot
        h("rect", { x: 96, y: 17, width: 28, height: 18, rx: 7, fill: "#E06145", stroke: "#8F2D1A", strokeWidth: 2 }),
        // Inner dark wooden pocket opening
        h("rect", { x: 46, y: 42, width: 128, height: 64, rx: 10, fill: "#5B3829", stroke: "#8A2B18", strokeWidth: 1.8 }),
        // Peeking items inside bundle based on packed contents
        itemCount > 0 &&
          h("g", null,
            h("rect", { x: 56, y: 54, width: 28, height: 26, rx: 5, fill: "#F6C25B", stroke: "#8A5316", strokeWidth: 1.5 }),
            h("path", { d: "M70 54 v26 M56 67 h28", stroke: "#D4563B", strokeWidth: 2.2 })
          ),
        itemCount >= 2 &&
          h("g", null,
            h("circle", { cx: 102, cy: 66, r: 13, fill: "#8AC4A3", stroke: "#3F7356", strokeWidth: 1.5 }),
            h("circle", { cx: 102, cy: 66, r: 5, fill: "#FFF4D6" })
          ),
        hasCoins &&
          h("g", null,
            h("circle", { cx: 128, cy: 68, r: 11, fill: "#F4C244", stroke: "#9A6712", strokeWidth: 1.6 }),
            h("rect", { x: 124.5, y: 64.5, width: 7, height: 7, fill: "#5B3829" })
          ),
        hasLetter &&
          h("g", { transform: "translate(142, 52) rotate(8)" },
            h("rect", { x: 0, y: 0, width: 24, height: 18, rx: 3, fill: "#FFF6F2", stroke: "#C97969", strokeWidth: 1.4 }),
            h("path", { d: "M1 2 L12 11 L23 2", fill: "none", stroke: "#C97969", strokeWidth: 1.4 }),
            h("circle", { cx: 12, cy: 10, r: 2.8, fill: "#D4563B" })
          ),
        // Little wooden ladder on right (图1 标志性小木梯)
        h("g", { stroke: "#B68857", strokeWidth: 3.2, strokeLinecap: "round" },
          h("line", { x1: 146, y1: 78, x2: 146, y2: 122 }),
          h("line", { x1: 166, y1: 78, x2: 166, y2: 122 }),
          h("line", { x1: 146, y1: 88, x2: 166, y2: 88 }),
          h("line", { x1: 146, y1: 100, x2: 166, y2: 100 }),
          h("line", { x1: 146, y1: 112, x2: 166, y2: 112 })
        ),
        // Front cloth shelf bar + status text
        h("rect", { x: 46, y: 84, width: 96, height: 24, rx: 4, fill: "#6D4130" }),
        h(
          "text",
          {
            x: 94,
            y: 100,
            textAnchor: "middle",
            fill: "#FCEBD2",
            fontSize: "11",
            fontWeight: "700"
          },
          statusText
        )
      )
    );
  }

  function LockSlotIcon(h) {
    return h(
      "svg",
      { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "#A89A89", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
      h("rect", { x: 5, y: 11, width: 14, height: 10, rx: 2.5, fill: "rgba(168,154,137,0.22)" }),
      h("path", { d: "M8 11V7.5a4 4 0 0 1 8 0V11" })
    );
  }

  function ItemTypeBadgeIcon(h, category) {
    if (category === "food") return "🍡";
    if (category === "ticket") return "📜";
    if (category === "gift") return "🎁";
    return "✨";
  }

  // ==================== 2. Figure 3 Retro Coral-Brush Letter Card ====================

  /**
   * 1:1 inspired by 图3:
   * - Cream-pink paper sheet with subtle fold line, top-left terracotta paperclip, top-right curl
   * - Coral-terracotta paint-roller brushstroke header banner with subtitle + bold white title
   * - Dual pink hearts next to salutation, chestnut-brown ink body, bottom date + signature + tiny beret-bird seal
   */
  function Figure3LetterCard(h, opts) {
    var occasionName = (opts && opts.occasionName) || "秘密惊喜";
    var title = (opts && opts.title) || "见字如晤";
    var salutation = (opts && opts.salutation) || "亲爱的你：";
    var body = (opts && opts.body) || "";
    var revealDate = (opts && opts.revealDate) || "";
    var sign = (opts && opts.sign) || "";
    var editable = !!(opts && opts.editable);
    var onChangeTitle = opts && opts.onChangeTitle;
    var onChangeBody = opts && opts.onChangeBody;
    var onChangeSign = opts && opts.onChangeSign;
    var cardRef = opts && opts.cardRef;

    return h(
      "div",
      {
        ref: cardRef,
        style: {
          position: "relative",
          background: "linear-gradient(180deg, #FFFDFB 0%, #FFF7F4 55%, #FDF3EE 100%)",
          borderRadius: "16px 6px 16px 16px",
          padding: "22px 20px 20px",
          boxShadow: "0 10px 28px rgba(135, 84, 68, 0.16), inset 0 0 0 1px rgba(217, 138, 122, 0.25)",
          color: "#7A523F",
          fontFamily: "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
          overflow: "visible"
        }
      },
      // Top-left terracotta paperclip (图3 左上曲别针)
      h(
        "svg",
        {
          width: 28,
          height: 36,
          viewBox: "0 0 28 36",
          style: { position: "absolute", top: "-8px", left: "-6px", pointerEvents: "none" }
        },
        h("path", {
          d: "M10 6 L18 16 C21 20, 20 26, 16 29 C12 31, 7 29, 5 25 L1 19",
          fill: "none",
          stroke: "#D48872",
          strokeWidth: 3.2,
          strokeLinecap: "round"
        })
      ),
      // Top-right curled paper corner (图3 右上卷角)
      h("div", {
        style: {
          position: "absolute",
          top: 0,
          right: 0,
          width: "26px",
          height: "26px",
          background: "linear-gradient(225deg, #EEDAD3 45%, #FFFDFB 50%)",
          borderBottomLeftRadius: "10px",
          boxShadow: "-2px 2px 5px rgba(135,84,68,0.1)",
          pointerEvents: "none"
        }
      }),
      // Top Coral Paint-Roller Brushstroke Banner (图3 珊瑚红漆刷横幅)
      h(
        "div",
        {
          style: {
            position: "relative",
            margin: "0 auto 16px",
            maxWidth: "256px",
            background: "linear-gradient(135deg, #DC8D7B 0%, #CB7766 100%)",
            borderRadius: "18px 22px 16px 20px",
            padding: "9px 18px 10px",
            textAlign: "center",
            boxShadow: "0 4px 12px rgba(203, 119, 102, 0.28)",
            transform: "rotate(-1.2deg)"
          }
        },
        // Paint roller accent SVG on right edge
        h(
          "svg",
          {
            width: 34,
            height: 24,
            viewBox: "0 0 34 24",
            style: { position: "absolute", top: "-6px", right: "-12px", pointerEvents: "none" }
          },
          h("rect", { x: 10, y: 2, width: 20, height: 10, rx: 4, fill: "#D48170" }),
          h("path", { d: "M10 7 H4 V18 H12", fill: "none", stroke: "#C97766", strokeWidth: 2.5, strokeLinecap: "round" })
        ),
        // Small warm-gold subtitle
        h(
          "div",
          { style: { fontSize: "11px", fontWeight: 700, color: "#FFE69C", letterSpacing: "1px", marginBottom: "2px" } },
          occasionName
        ),
        // Bold crisp white main title
        editable
          ? h("input", {
              type: "text",
              value: title,
              onChange: function (e) { if (onChangeTitle) onChangeTitle(e.target.value); },
              placeholder: "写一个信件标题…",
              maxLength: 20,
              style: {
                width: "100%",
                background: "rgba(255,255,255,0.18)",
                border: "none",
                borderRadius: "8px",
                color: "#FFFFFF",
                fontSize: "17px",
                fontWeight: 800,
                textAlign: "center",
                padding: "3px 6px",
                outline: "none",
                boxSizing: "border-box"
              }
            })
          : h(
              "div",
              { style: { fontSize: "18px", fontWeight: 800, color: "#FFFFFF", letterSpacing: "1.5px" } },
              title || "秘密邀请函"
            )
      ),
      // Salutation with dual tiny floating hearts (图3 左上双爱心称呼)
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "5px", marginBottom: "10px" } },
        h(
          "svg",
          { width: 18, height: 14, viewBox: "0 0 20 16", style: { flexShrink: 0 } },
          h("path", { d: "M6 12 C6 12, 1 8.5, 1 5.5 C1 3.8, 2.4 2.6, 3.9 2.6 C4.9 2.6, 5.7 3.2, 6 3.9 C6.3 3.2, 7.1 2.6, 8.1 2.6 C9.6 2.6, 11 3.8, 11 5.5 C11 8.5, 6 12, 6 12 Z", fill: "#F19FA6" }),
          h("path", { d: "M15 8 C15 8, 12 6, 12 4.2 C12 3.2, 12.8 2.5, 13.7 2.5 C14.3 2.5, 14.8 2.9, 15 3.3 C15.2 2.9, 15.7 2.5, 16.3 2.5 C17.2 2.5, 18 3.2, 18 4.2 C18 6, 15 8, 15 8 Z", fill: "#F5B8BD" })
        ),
        h("span", { style: { fontSize: "14px", fontWeight: 700, color: "#C47D6E" } }, salutation)
      ),
      // Letter Body (warm chestnut-brown ink)
      editable
        ? h("textarea", {
            value: body,
            onChange: function (e) { if (onChangeBody) onChangeBody(e.target.value); },
            placeholder: "在这里写下想在揭晓那天对 TA 说的话吧…",
            rows: 6,
            style: {
              width: "100%",
              boxSizing: "border-box",
              border: "1px dashed #DFB7AC",
              borderRadius: "10px",
              background: "rgba(255,255,255,0.65)",
              padding: "10px 12px",
              fontSize: "13.5px",
              lineHeight: "1.8",
              color: "#7A523F",
              outline: "none",
              resize: "vertical",
              fontFamily: "inherit"
            }
          })
        : h(
            "div",
            {
              style: {
                fontSize: "13.5px",
                lineHeight: "1.85",
                color: "#7A523F",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                minHeight: "88px",
                padding: "2px 2px 12px"
              }
            },
            body || "（这封信虽无只言片语，心意却已满溢。）"
          ),
      // Horizontal paper crease line (图3 纸张折痕)
      h("div", {
        style: {
          height: "1px",
          background: "linear-gradient(90deg, transparent, rgba(203,145,130,0.32), transparent)",
          margin: "12px 0 10px"
        }
      }),
      // Bottom metadata row: Date + Signature
      h(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
            paddingRight: "28px"
          }
        },
        h(
          "div",
          { style: { fontSize: "11.5px", fontWeight: 700, color: "#BA6E5C" } },
          "揭晓日期：" + (revealDate ? revealDate.replace(/-/g, ".") : "待定")
        ),
        editable
          ? h("input", {
              type: "text",
              value: sign,
              onChange: function (e) { if (onChangeSign) onChangeSign(e.target.value); },
              placeholder: "落款（如：阿鸢）",
              maxLength: 18,
              style: {
                width: "116px",
                border: "none",
                borderBottom: "1px dashed #D49A8A",
                background: "transparent",
                fontSize: "12px",
                fontWeight: 700,
                color: "#7A523F",
                textAlign: "right",
                outline: "none",
                padding: "2px 4px"
              }
            })
          : sign &&
              h("div", { style: { fontSize: "12px", fontWeight: 700, color: "#7A523F" } }, "—— " + sign)
      ),
      // Cute bottom-right beret-bird stamp (呼应图3 右下角戴贝雷帽的小鸡萌宠)
      h(
        "svg",
        {
          width: 34,
          height: 34,
          viewBox: "0 0 36 36",
          style: { position: "absolute", right: "-6px", bottom: "-6px", pointerEvents: "none" }
        },
        h("circle", { cx: 18, cy: 21, r: 11, fill: "#FAD25A", stroke: "#C98C24", strokeWidth: 1.4 }),
        // Red beret hat
        h("ellipse", { cx: 20, cy: 11, rx: 10, ry: 4.5, fill: "#D94F4F", transform: "rotate(12 20 11)" }),
        h("circle", { cx: 22, cy: 7, r: 1.8, fill: "#B93838" }),
        // Round glasses & beak
        h("circle", { cx: 14, cy: 20, r: 3.2, fill: "#FFFFFF", stroke: "#8C633A", strokeWidth: 1.1 }),
        h("circle", { cx: 21, cy: 20, r: 3.2, fill: "#FFFFFF", stroke: "#8C633A", strokeWidth: 1.1 }),
        h("circle", { cx: 14.3, cy: 20, r: 1.2, fill: "#3F2B1D" }),
        h("circle", { cx: 20.7, cy: 20, r: 1.2, fill: "#3F2B1D" }),
        h("polygon", { points: "16,23 19,23 17.5,25.5", fill: "#E67B35" })
      )
    );
  }

  // ==================== 3. Main Page Component ====================

  function CoupleSurprisePage(props) {
    var React = global.React;
    if (!React) return null;
    var h = React.createElement;
    var useEffect = React.useEffect;
    var useRef = React.useRef;
    var useState = React.useState;

    var Engine = global.CoupleSurpriseEngine;
    var taCharacter = (props && props.taCharacter) || {};
    var mePersona = (props && props.mePersona) || {};
    var onBack = props && props.onBack;
    var charId = String(taCharacter.id || taCharacter.name || "default_char");
    var charName = String(taCharacter.name || "TA");
    var userName = String(mePersona.name || mePersona.nickname || "我");

    var [activeTab, setActiveTab] = useState("from_char"); // "from_char" | "from_user"
    var [records, setRecords] = useState([]);
    var [loading, setLoading] = useState(true);
    var [toast, setToast] = useState("");
    var [vaultBalance, setVaultBalance] = useState(function () {
      return Engine ? Engine.getVaultCoins() : 500;
    });

    // User packing draft state (图1 主界面)
    var [occasionName, setOccasionName] = useState("");
    var [revealDate, setRevealDate] = useState(function () {
      return Engine ? Engine.addDaysToLocalDate(7) : "";
    });
    var [packedItems, setPackedItems] = useState([]); // Array of actual backpack item objects (max 5)
    var [packedCoins, setPackedCoins] = useState(0);
    var [packedLetter, setPackedLetter] = useState({ title: "", body: "", sign: userName });
    var [isSealing, setIsSealing] = useState(false);

    // Sub-modals for 图2 背包选物 / 金额 / 图3 信件
    var [showBagPicker, setShowBagPicker] = useState(false);
    var [bagRawItems, setBagRawItems] = useState([]);
    var [bagCategory, setBagCategory] = useState("all");
    var [pickerDraftItems, setPickerDraftItems] = useState([]);

    var [showCoinModal, setShowCoinModal] = useState(false);
    var [coinInput, setCoinInput] = useState("");

    var [showLetterModal, setShowLetterModal] = useState(false);
    var [letterDraft, setLetterDraft] = useState({ title: "", body: "", sign: userName });

    // Character prepare modal (让 TA 偷偷筹备一个惊喜日)
    var [showCharPrepModal, setShowCharPrepModal] = useState(false);
    var [charPrepOccasion, setCharPrepOccasion] = useState("");
    var [charPrepDate, setCharPrepDate] = useState(function () {
      return Engine ? Engine.addDaysToLocalDate(7) : "";
    });
    var [isPreparingChar, setIsPreparingChar] = useState(false);

    // Reveal modal, prep journal modal & shaking card id
    var [revealedModalRec, setRevealedModalRec] = useState(null);
    var [showJournalRec, setShowJournalRec] = useState(null);
    var [shakingId, setShakingId] = useState("");
    var [isRevealing, setIsRevealing] = useState(false);
    var revealExportRef = useRef(null);

    function flashToast(msg) {
      setToast(msg);
      setTimeout(function () {
        setToast(function (cur) { return cur === msg ? "" : cur; });
      }, 2400);
    }

    async function reloadAll() {
      if (!Engine) return;
      setLoading(true);
      try {
        var list = await Engine.getSurprisesByChar(charId);
        setRecords(list.map(function (r) { return Engine.sanitizeRecordForView(r); }));
        setVaultBalance(Engine.getVaultCoins());
      } catch (_) {}
      setLoading(false);
    }

    useEffect(
      function () {
        reloadAll();
        var onVault = function () {
          if (Engine) setVaultBalance(Engine.getVaultCoins());
        };
        var onSurpriseUpdated = function (ev) {
          var targetCid = ev && ev.detail && ev.detail.charId;
          if (!targetCid || String(targetCid) === String(charId)) {
            reloadAll();
          }
        };
        if (typeof global.addEventListener === "function") {
          global.addEventListener("walletTransactionsUpdated", onVault);
          global.addEventListener("milvus-surprise-updated", onSurpriseUpdated);
          return function () {
            global.removeEventListener("walletTransactionsUpdated", onVault);
            global.removeEventListener("milvus-surprise-updated", onSurpriseUpdated);
          };
        }
      },
      [charId]
    );

    if (!Engine) {
      return h(
        "div",
        { style: { position: "fixed", inset: 0, zIndex: 1005, background: "#FAF3E6", display: "flex", alignItems: "center", justifyContent: "center" } },
        "秘密惊喜引擎未加载"
      );
    }

    var charRecords = records.filter(function (r) { return r.direction === "from_char"; });
    var userRecords = records.filter(function (r) { return r.direction === "from_user"; });
    var sealedCharCount = charRecords.filter(function (r) { return r.status === "sealed"; }).length;

    // ---- Handlers ----

    async function handleOpenBagPicker() {
      var raw = await Engine.getBackpackItems();
      setBagRawItems(raw);
      setPickerDraftItems(packedItems.slice());
      setBagCategory("all");
      setShowBagPicker(true);
    }

    function handlePickFromGroup(group) {
      if (pickerDraftItems.length >= Engine.MAX_BAG_SLOTS) {
        flashToast("行囊最多放入 " + Engine.MAX_BAG_SLOTS + " 件背包好物哦");
        return;
      }
      var usedIdSet = {};
      for (var i = 0; i < pickerDraftItems.length; i++) usedIdSet[pickerDraftItems[i].id] = true;
      var nextAvailable = null;
      for (var j = 0; j < group.items.length; j++) {
        if (!usedIdSet[group.items[j].id]) {
          nextAvailable = group.items[j];
          break;
        }
      }
      if (!nextAvailable) return;
      setPickerDraftItems(pickerDraftItems.concat([nextAvailable]));
    }

    function handleRemovePickerSlot(slotIdx) {
      setPickerDraftItems(function (prev) {
        return prev.filter(function (_, idx) { return idx !== slotIdx; });
      });
    }

    async function handleSealUserSurprise() {
      if (isSealing) return;
      setIsSealing(true);
      try {
        await Engine.sealUserSurprise({
          charId: charId,
          charName: charName,
          occasionName: occasionName,
          revealDate: revealDate,
          items: packedItems,
          coins: packedCoins,
          letter: packedLetter
        });
        setOccasionName("");
        setPackedItems([]);
        setPackedCoins(0);
        setPackedLetter({ title: "", body: "", sign: userName });
        flashToast("🎁 秘密惊喜已封存，静待那一天揭晓！");
        await reloadAll();
      } catch (err) {
        flashToast(err && err.message ? err.message : "封存失败");
      }
      setIsSealing(false);
    }

    async function handleCancelUserRecord(recId) {
      try {
        await Engine.cancelUserSurprise(recId);
        flashToast("已撤回包裹，物品与五铢钱均已原路退还");
        await reloadAll();
      } catch (err) {
        flashToast(err && err.message ? err.message : "撤回失败");
      }
    }

    async function handlePrepareCharSurprise() {
      if (isPreparingChar) return;
      setIsPreparingChar(true);
      try {
        await Engine.prepareCharSurprise({
          taCharacter: taCharacter,
          charId: charId,
          charName: charName,
          userName: userName,
          occasionName: charPrepOccasion,
          revealDate: charPrepDate
        });
        setShowCharPrepModal(false);
        setCharPrepOccasion("");
        flashToast("✨ " + charName + " 已悄悄包好了一份秘密包裹！");
        await reloadAll();
      } catch (err) {
        flashToast(err && err.message ? err.message : "筹备失败");
      }
      setIsPreparingChar(false);
    }

    async function handleClickCharCard(rec) {
      if (rec.isLocked) {
        setShakingId(rec.id);
        flashToast("还没到日子呢！还有 " + rec.daysLeft + " 天才能拆开看～");
        setTimeout(function () { setShakingId(""); }, 500);
        return;
      }
      if (isRevealing) return;
      setIsRevealing(true);
      try {
        var res = await Engine.revealAndClaimCharSurprise(rec.id);
        setRevealedModalRec(res.record);
        if (res.newlyClaimed) {
          flashToast("🎉 已拆封！礼物已入背包，五铢钱已入账金库");
        }
        await reloadAll();
      } catch (err) {
        flashToast(err && err.message ? err.message : "拆封失败");
      }
      setIsRevealing(false);
    }

    async function handleClickUserCardReveal(rec) {
      if (!Engine.isRevealable(rec.revealDate)) {
        flashToast("距离揭晓日还有 " + rec.daysLeft + " 天，到那天再亲手送给 " + charName + " 吧～");
        return;
      }
      if (isRevealing) return;
      setIsRevealing(true);
      try {
        var updated = await Engine.revealUserSurpriseWithReaction(rec.id, taCharacter);
        setRevealedModalRec(updated);
        await reloadAll();
      } catch (err) {
        flashToast(err && err.message ? err.message : "送出失败");
      }
      setIsRevealing(false);
    }

    async function handleExportRevealImage() {
      if (!revealExportRef.current || typeof global.html2canvas !== "function") {
        flashToast("当前暂无法导出长图");
        return;
      }
      try {
        var canvas = await global.html2canvas(revealExportRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#FFF9F5"
        });
        var url = canvas.toDataURL("image/png");
        var a = document.createElement("a");
        a.href = url;
        a.download = "秘密惊喜_" + ((revealedModalRec && revealedModalRec.occasionName) || "纪念") + ".png";
        a.click();
      } catch (_) {
        flashToast("导出失败，请稍后重试");
      }
    }

    var hasLetterDraft = !!(packedLetter && (packedLetter.body.trim() || packedLetter.title.trim()));
    var totalPackedKinds = packedItems.length + (packedCoins > 0 ? 1 : 0) + (hasLetterDraft ? 1 : 0);

    // ---- Render Sub-View A: TA 为我准备的 ----
    function renderFromCharTab() {
      return h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "12px" } },
        // Top summary banner
        h(
          "div",
          {
            style: {
              background: "linear-gradient(135deg, #FFF7E8 0%, #FCEAD2 100%)",
              border: "1.5px solid #E5C191",
              borderRadius: "16px",
              padding: "14px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px"
            }
          },
          h(
            "div",
            null,
            h(
              "div",
              { style: { fontSize: "14px", fontWeight: 800, color: "#6A3E24" } },
              charName + " 为你准备了 " + charRecords.length + " 个包裹"
            ),
            h(
              "div",
              { style: { fontSize: "11.5px", color: "#9C6F4E", marginTop: "3px" } },
              sealedCharCount > 0
                ? "其中 " + sealedCharCount + " 个尚未拆封 · 不到揭晓日不可偷看哦"
                : "约定一个重要日子，让 TA 悄悄为你打包一份惊喜吧"
            )
          ),
          h(
            "button",
            {
              type: "button",
              onClick: function () { setShowCharPrepModal(true); },
              style: {
                border: "none",
                borderRadius: "999px",
                padding: "7px 13px",
                background: "linear-gradient(135deg, #D9694B, #C24D33)",
                color: "#FFFDF9",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                flexShrink: 0,
                boxShadow: "0 3px 10px rgba(194,77,51,0.28)"
              }
            },
            "+ 约定惊喜日"
          )
        ),

        // Bundle Grid
        loading
          ? h("div", { style: { textAlign: "center", padding: "36px", color: "#A28D78", fontSize: "13px" } }, "正在清点秘密包裹…")
          : charRecords.length === 0
          ? h(
              "div",
              {
                style: {
                  background: "#FFFDF8",
                  border: "1.5px dashed #DEC6A5",
                  borderRadius: "18px",
                  padding: "36px 20px",
                  textAlign: "center",
                  color: "#9A8268"
                }
              },
              h("div", { style: { fontSize: "34px", marginBottom: "8px" } }, "🎀"),
              h("div", { style: { fontSize: "13.5px", fontWeight: 700, color: "#6E523A" } }, charName + " 还没有封存好的秘密包裹"),
              h("div", { style: { fontSize: "12px", marginTop: "6px" } }, "点击右上角「+ 约定惊喜日」，设定日期让 TA 偷偷去准备吧～")
            )
          : h(
              "div",
              { style: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" } },
              charRecords.map(function (rec, idx) {
                var isLocked = !!rec.isLocked;
                var canOpenNow = !isLocked && rec.status !== "revealed";
                var isRevealed = rec.status === "revealed";
                return h(
                  "div",
                  {
                    key: rec.id,
                    onClick: function () { handleClickCharCard(rec); },
                    style: {
                      background: canOpenNow
                        ? "linear-gradient(180deg, #FFFDF5 0%, #FFF2D6 100%)"
                        : "#FFFDF9",
                      border: canOpenNow
                        ? "2px solid #E5A63E"
                        : isRevealed
                        ? "1.5px solid #CFE0D5"
                        : "1.5px solid #E6D2B8",
                      borderRadius: "16px",
                      padding: "14px 12px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      gap: "7px",
                      cursor: "pointer",
                      position: "relative",
                      boxShadow: canOpenNow
                        ? "0 6px 18px rgba(229,166,62,0.22)"
                        : "0 3px 10px rgba(120,86,52,0.06)",
                      transform: shakingId === rec.id ? "rotate(-3deg) scale(0.98)" : "none",
                      transition: "transform 0.15s ease"
                    }
                  },
                  // Badge top-right
                  h(
                    "span",
                    {
                      style: {
                        position: "absolute",
                        top: "8px",
                        right: "8px",
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: "999px",
                        background: canOpenNow ? "#E5A63E" : isRevealed ? "#5E9E76" : "#EFE3D2",
                        color: canOpenNow || isRevealed ? "#FFFFFF" : "#8B6F52"
                      }
                    },
                    canOpenNow ? "✨ 可拆封" : isRevealed ? "已珍藏" : "剩 " + rec.daysLeft + " 天"
                  ),
                  // Mini Red Furoshiki SVG
                  h(
                    "svg",
                    { width: 64, height: 58, viewBox: "0 0 80 72", style: { marginTop: "6px" } },
                    h("path", { d: "M38 18 C24 4, 12 8, 8 16 C16 22, 28 22, 38 20 Z", fill: isRevealed ? "#82B59A" : "#C94B31" }),
                    h("path", { d: "M42 18 C56 4, 68 8, 72 16 C64 22, 52 22, 42 20 Z", fill: isRevealed ? "#94C4AA" : "#DA5C41" }),
                    h("rect", { x: 14, y: 22, width: 52, height: 42, rx: 12, fill: isRevealed ? "#6FA88B" : "#C9462D" }),
                    h("rect", { x: 33, y: 12, width: 14, height: 11, rx: 4, fill: isRevealed ? "#A5D4BB" : "#E86C50" }),
                    h("circle", { cx: 40, cy: 43, r: 9, fill: "rgba(255,248,232,0.9)" }),
                    h(
                      "text",
                      { x: 40, y: 47, textAnchor: "middle", fontSize: "11", fontWeight: "800", fill: isRevealed ? "#4B7F64" : "#B63D26" },
                      isLocked ? "密" : isRevealed ? "阅" : "拆"
                    )
                  ),
                  h("div", { style: { fontSize: "13px", fontWeight: 800, color: "#573B26" } }, rec.occasionName),
                  h("div", { style: { fontSize: "11px", color: "#9C846C" } }, "揭晓日：" + rec.revealDate),
                  h(
                    "div",
                    {
                      style: {
                        fontSize: "11px",
                        color: "#8B6C54",
                        background: "#F8F1E6",
                        borderRadius: "8px",
                        padding: "5px 8px",
                        width: "100%",
                        boxSizing: "border-box",
                        lineHeight: 1.45
                      }
                    },
                    isLocked
                      ? "「" + (rec.teaserNote || "不许提前偷看哦") + "」"
                      : isRevealed
                      ? "点击重温信件与礼物"
                      : "日子到了！点击解开红结"
                  ),
                  h("div", { style: { fontSize: "10px", color: "#BBA58C" } }, "包裹 #" + (charRecords.length - idx))
                );
              })
            )
      );
    }

    // ---- Render Sub-View B: 我为 TA 准备的 (图1 主界面) ----
    function renderFromUserTab() {
      var daysPreview = Engine.isValidDateStr(revealDate) ? Engine.getDaysUntilReveal(revealDate) : 0;

      return h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "14px" } },

        // Step A: Occasion Name + Date Picker Card
        h(
          "div",
          {
            style: {
              background: "#FFFDF8",
              border: "1.5px solid #E5CFAF",
              borderRadius: "16px",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: "10px"
            }
          },
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h("span", { style: { fontSize: "13px", fontWeight: 800, color: "#6A4428" } }, "第一步 · 定下要揭晓的重要日子"),
            h(
              "span",
              { style: { fontSize: "11px", color: "#B86E3C", fontWeight: 600 } },
              daysPreview === 0 ? "今日即可送出" : "距揭晓 " + daysPreview + " 天"
            )
          ),
          h(
            "div",
            { style: { display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: "8px" } },
            h("input", {
              type: "text",
              value: occasionName,
              onChange: function (e) { setOccasionName(e.target.value); },
              placeholder: "当天是什么日子？（如：冬至）",
              maxLength: 16,
              style: {
                border: "1px solid #DEC6A5",
                borderRadius: "10px",
                padding: "8px 10px",
                fontSize: "12.5px",
                background: "#FFFFFF",
                color: "#4E3422",
                outline: "none"
              }
            }),
            h("input", {
              type: "date",
              value: revealDate,
              onChange: function (e) { setRevealDate(e.target.value); },
              style: {
                border: "1px solid #DEC6A5",
                borderRadius: "10px",
                padding: "7px 8px",
                fontSize: "12px",
                background: "#FFFFFF",
                color: "#4E3422",
                outline: "none"
              }
            })
          ),
          h(
            "div",
            { style: { display: "flex", flexWrap: "wrap", gap: "6px" } },
            QUICK_OCCASIONS.map(function (tag) {
              var active = occasionName === tag;
              return h(
                "button",
                {
                  key: tag,
                  type: "button",
                  onClick: function () { setOccasionName(tag); },
                  style: {
                    border: active ? "1px solid #D9694B" : "1px solid #E8D7BE",
                    background: active ? "#FFF0EB" : "#FAF4EA",
                    color: active ? "#C24D33" : "#7D6248",
                    fontSize: "11px",
                    borderRadius: "999px",
                    padding: "3px 9px",
                    cursor: "pointer"
                  }
                },
                tag
              );
            })
          )
        ),

        // Step B: 图1 布局「收拾行囊」打包卡片
        h(
          "div",
          {
            style: {
              background: "#FAF3E6",
              border: "1.5px solid #E3C9A3",
              borderRadius: "20px",
              overflow: "hidden",
              boxShadow: "0 8px 22px rgba(138, 92, 46, 0.1)"
            }
          },
          // Top Furoshiki Bundle Stage
          FuroshikiBundleArt(h, {
            itemCount: packedItems.length,
            hasCoins: packedCoins > 0,
            hasLetter: hasLetterDraft,
            statusText: totalPackedKinds > 0 ? "已装入 " + totalPackedKinds + " 份心意" : "收拾行囊中"
          }),

          // Packing body
          h(
            "div",
            { style: { padding: "6px 14px 16px", display: "flex", flexDirection: "column", gap: "14px" } },

            // Section 1: 背包好物 (2 rows × 4 cols dashed grid, 5 active + 3 decorative lock)
            h(
              "div",
              {
                style: {
                  position: "relative",
                  background: "#F4E1BE",
                  border: "1.5px solid #D9B786",
                  borderRadius: "12px",
                  padding: "20px 10px 12px"
                }
              },
              // Jade-green ribbon header (图1 标志性青玉色标签条)
              h(
                "div",
                {
                  style: {
                    position: "absolute",
                    top: "-11px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "#76B7A8",
                    color: "#22463E",
                    fontSize: "12px",
                    fontWeight: 800,
                    padding: "3px 18px",
                    borderRadius: "4px",
                    boxShadow: "0 2px 6px rgba(68,118,106,0.22)",
                    whiteSpace: "nowrap"
                  }
                },
                "背包好物 (" + packedItems.length + "/" + Engine.MAX_BAG_SLOTS + ")"
              ),
              h(
                "div",
                { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" } },
                [0, 1, 2, 3, 4, 5, 6, 7].map(function (slotIdx) {
                  var isLockedSlot = slotIdx >= Engine.MAX_BAG_SLOTS;
                  var item = !isLockedSlot ? packedItems[slotIdx] : null;
                  return h(
                    "button",
                    {
                      key: slotIdx,
                      type: "button",
                      onClick: function () {
                        if (isLockedSlot) {
                          flashToast("当前行囊最多放入 " + Engine.MAX_BAG_SLOTS + " 件背包好物");
                          return;
                        }
                        handleOpenBagPicker();
                      },
                      style: {
                        aspectRatio: "1 / 1",
                        borderRadius: "12px",
                        border: item ? "2px solid #C87E45" : "2px dashed #B8946B",
                        background: item ? "#FFFDF7" : "rgba(255,248,234,0.48)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "2px",
                        padding: "4px",
                        cursor: isLockedSlot ? "default" : "pointer",
                        opacity: isLockedSlot ? 0.65 : 1,
                        position: "relative",
                        overflow: "hidden"
                      }
                    },
                    isLockedSlot
                      ? LockSlotIcon(h)
                      : item
                      ? h(
                          React.Fragment,
                          null,
                          h("span", { style: { fontSize: "20px", lineHeight: 1 } }, ItemTypeBadgeIcon(h, Engine.classifyBackpackCategory(item))),
                          h(
                            "span",
                            {
                              style: {
                                fontSize: "10px",
                                fontWeight: 700,
                                color: "#5E3C23",
                                maxWidth: "100%",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap"
                              }
                            },
                            item.name
                          )
                        )
                      : h("span", { style: { fontSize: "24px", fontWeight: 700, color: "#B58D62", lineHeight: 1 } }, "+")
                  );
                })
              )
            ),

            // Section 2: Lower Dual Area (Left: 金库金额, Right: 一纸书信)
            h(
              "div",
              { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" } },
              // Left: 金库金额
              h(
                "div",
                {
                  style: {
                    position: "relative",
                    background: "#F4E1BE",
                    border: "1.5px solid #D9B786",
                    borderRadius: "12px",
                    padding: "18px 10px 12px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center"
                  }
                },
                h(
                  "div",
                  {
                    style: {
                      position: "absolute",
                      top: "-11px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "#76B7A8",
                      color: "#22463E",
                      fontSize: "11.5px",
                      fontWeight: 800,
                      padding: "3px 14px",
                      borderRadius: "4px",
                      whiteSpace: "nowrap"
                    }
                  },
                  "金库金额"
                ),
                h(
                  "button",
                  {
                    type: "button",
                    onClick: function () {
                      setCoinInput(packedCoins > 0 ? String(packedCoins) : "");
                      setShowCoinModal(true);
                    },
                    style: {
                      width: "76px",
                      height: "76px",
                      borderRadius: "12px",
                      border: packedCoins > 0 ? "2px solid #D99B29" : "2px dashed #B8946B",
                      background: packedCoins > 0 ? "#FFFBEB" : "rgba(255,248,234,0.48)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "3px",
                      cursor: "pointer"
                    }
                  },
                  packedCoins > 0
                    ? h(
                        React.Fragment,
                        null,
                        h("span", { style: { fontSize: "20px" } }, "🪙"),
                        h("span", { style: { fontSize: "12px", fontWeight: 800, color: "#A16207" } }, packedCoins + " 铢")
                      )
                    : h("span", { style: { fontSize: "26px", fontWeight: 700, color: "#B58D62" } }, "+")
                ),
                h("div", { style: { fontSize: "10.5px", color: "#8C6D4B", marginTop: "6px" } }, "金库余：" + vaultBalance + " 铢")
              ),

              // Right: 一纸书信
              h(
                "div",
                {
                  style: {
                    position: "relative",
                    background: "#F4E1BE",
                    border: "1.5px solid #D9B786",
                    borderRadius: "12px",
                    padding: "18px 10px 12px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center"
                  }
                },
                h(
                  "div",
                  {
                    style: {
                      position: "absolute",
                      top: "-11px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "#76B7A8",
                      color: "#22463E",
                      fontSize: "11.5px",
                      fontWeight: 800,
                      padding: "3px 14px",
                      borderRadius: "4px",
                      whiteSpace: "nowrap"
                    }
                  },
                  "一纸书信"
                ),
                h(
                  "button",
                  {
                    type: "button",
                    onClick: function () {
                      setLetterDraft({
                        title: packedLetter.title || (occasionName ? occasionName + " · 给" + charName : ""),
                        body: packedLetter.body || "",
                        sign: packedLetter.sign || userName
                      });
                      setShowLetterModal(true);
                    },
                    style: {
                      width: "76px",
                      height: "76px",
                      borderRadius: "12px",
                      border: hasLetterDraft ? "2px solid #D47A68" : "2px dashed #B8946B",
                      background: hasLetterDraft ? "#FFF5F2" : "rgba(255,248,234,0.48)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "3px",
                      cursor: "pointer"
                    }
                  },
                  hasLetterDraft
                    ? h(
                        React.Fragment,
                        null,
                        h("span", { style: { fontSize: "20px" } }, "💌"),
                        h("span", { style: { fontSize: "11px", fontWeight: 800, color: "#B85543" } }, packedLetter.body.trim().length + " 字")
                      )
                    : h("span", { style: { fontSize: "26px", fontWeight: 700, color: "#B58D62" } }, "+")
                ),
                h("div", { style: { fontSize: "10.5px", color: "#8C6D4B", marginTop: "6px" } }, hasLetterDraft ? "点击编辑信笺" : "写一封秘密信")
              )
            ),

            // Bottom Action Bar (图1 底部清空小篮 + 封存主按钮)
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "12px", marginTop: "2px" } },
              h(
                "button",
                {
                  type: "button",
                  onClick: function () {
                    setPackedItems([]);
                    setPackedCoins(0);
                    setPackedLetter({ title: "", body: "", sign: userName });
                    flashToast("已清空当前行囊草稿");
                  },
                  style: {
                    border: "1px solid #DEC49F",
                    background: "#FFF9EE",
                    borderRadius: "12px",
                    padding: "6px 10px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "#7B5B3B",
                    cursor: "pointer",
                    flexShrink: 0
                  }
                },
                h("span", { style: { fontSize: "16px", lineHeight: 1.1 } }, "🧺"),
                "清空草稿"
              ),
              h(
                "button",
                {
                  type: "button",
                  disabled: isSealing,
                  onClick: handleSealUserSurprise,
                  style: {
                    flex: 1,
                    height: "44px",
                    border: "2px solid #96573D",
                    borderRadius: "12px",
                    background:
                      totalPackedKinds > 0 && occasionName.trim()
                        ? "linear-gradient(180deg, #E27A4E 0%, #C65531 100%)"
                        : "linear-gradient(180deg, #B59584 0%, #9E7D6D 100%)",
                    color: "#FFFDF9",
                    fontSize: "15px",
                    fontWeight: 800,
                    letterSpacing: "1px",
                    cursor: isSealing ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 12px rgba(150, 87, 61, 0.28)"
                  }
                },
                isSealing ? "正在系紧红结…" : "封存惊喜！"
              )
            )
          )
        ),

        // User's already-sealed bundles list
        userRecords.length > 0 &&
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "8px" } },
            h("div", { style: { fontSize: "12.5px", fontWeight: 800, color: "#6E4D32", paddingLeft: "4px" } }, "我已封存给 " + charName + " 的包裹 (" + userRecords.length + ")"),
            userRecords.map(function (rec) {
              var ready = Engine.isRevealable(rec.revealDate);
              var isRevealed = rec.status === "revealed";
              return h(
                "div",
                {
                  key: rec.id,
                  style: {
                    background: "#FFFDF9",
                    border: ready && !isRevealed ? "1.5px solid #E5A63E" : "1px solid #E6D5BE",
                    borderRadius: "14px",
                    padding: "12px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "10px"
                  }
                },
                h(
                  "div",
                  { style: { minWidth: 0 } },
                  h(
                    "div",
                    { style: { fontSize: "13px", fontWeight: 800, color: "#523723" } },
                    "🎀 " + rec.occasionName + " · " + rec.revealDate
                  ),
                  h(
                    "div",
                    { style: { fontSize: "11px", color: "#967B62", marginTop: "3px" } },
                    "含 " + (rec.items ? rec.items.length : 0) + " 件好物" +
                      (rec.coins > 0 ? " · " + rec.coins + " 铢" : "") +
                      (rec.letter && rec.letter.body ? " · 1 封信" : "")
                  )
                ),
                h(
                  "div",
                  { style: { display: "flex", gap: "6px", flexShrink: 0 } },
                  !isRevealed &&
                    h(
                      "button",
                      {
                        type: "button",
                        onClick: function () { handleCancelUserRecord(rec.id); },
                        style: {
                          border: "1px solid #DFCBB2",
                          background: "#FAF4EA",
                          color: "#8C6D4F",
                          fontSize: "11px",
                          borderRadius: "999px",
                          padding: "5px 9px",
                          cursor: "pointer"
                        }
                      },
                      "撤回退还"
                    ),
                  h(
                    "button",
                    {
                      type: "button",
                      onClick: function () { handleClickUserCardReveal(rec); },
                      style: {
                        border: "none",
                        background: isRevealed ? "#5E9E76" : ready ? "#D9694B" : "#E6D5BE",
                        color: isRevealed || ready ? "#FFFFFF" : "#7D654E",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        borderRadius: "999px",
                        padding: "5px 11px",
                        cursor: "pointer"
                      }
                    },
                    isRevealed ? "看 TA 反应" : ready ? "✨ 送出拆封" : "剩 " + rec.daysLeft + " 天"
                  )
                )
              );
            })
          )
      );
    }

    // ---- Modal 1: 图2 风格背包选物弹窗 ----
    function renderBagPickerModal() {
      if (!showBagPicker) return null;
      var groups = Engine.groupBackpackItems(bagRawItems);
      var usedIds = {};
      for (var i = 0; i < pickerDraftItems.length; i++) usedIds[pickerDraftItems[i].id] = true;

      var filtered = groups.filter(function (g) {
        return bagCategory === "all" || g.category === bagCategory;
      });

      return h(
        "div",
        {
          onClick: function (e) { if (e.target === e.currentTarget) setShowBagPicker(false); },
          style: {
            position: "fixed",
            inset: 0,
            zIndex: 1020,
            background: "rgba(38, 26, 16, 0.58)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px"
          }
        },
        h(
          "div",
          {
            style: {
              width: "100%",
              maxWidth: "380px",
              maxHeight: "84vh",
              background: "#FAF5E4",
              border: "3px solid #D9B888",
              borderRadius: "18px",
              boxShadow: "0 14px 36px rgba(0,0,0,0.3)",
              display: "flex",
              flexDirection: "column",
              position: "relative",
              overflow: "hidden"
            }
          },
          // Top header
          h(
            "div",
            {
              style: {
                padding: "14px 16px 10px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }
            },
            h(
              "div",
              { style: { fontSize: "14.5px", fontWeight: 800, color: "#4A321F" } },
              "为 " + charName + " 挑选背包好物 (" + pickerDraftItems.length + "/" + Engine.MAX_BAG_SLOTS + ")"
            ),
            h(
              "button",
              {
                type: "button",
                onClick: function () { setShowBagPicker(false); },
                style: {
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#DF6A38",
                  color: "#FFFFFF",
                  fontWeight: 800,
                  cursor: "pointer"
                }
              },
              "✕"
            )
          ),
          // Top 2×4 selected preview slots (图2 上半部分)
          h(
            "div",
            { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", padding: "0 16px 12px" } },
            [0, 1, 2, 3, 4, 5, 6, 7].map(function (idx) {
              var locked = idx >= Engine.MAX_BAG_SLOTS;
              var picked = !locked ? pickerDraftItems[idx] : null;
              return h(
                "div",
                {
                  key: idx,
                  onClick: function () { if (picked) handleRemovePickerSlot(idx); },
                  style: {
                    height: "56px",
                    borderRadius: "10px",
                    border: picked ? "2px solid #D97A42" : "2px dashed #C09E75",
                    background: picked ? "#FFFDF7" : "rgba(255,255,255,0.45)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "2px",
                    cursor: picked ? "pointer" : "default",
                    opacity: locked ? 0.6 : 1
                  }
                },
                locked
                  ? LockSlotIcon(h)
                  : picked
                  ? h(
                      React.Fragment,
                      null,
                      h("span", { style: { fontSize: "16px" } }, ItemTypeBadgeIcon(h, Engine.classifyBackpackCategory(picked))),
                      h(
                        "span",
                        { style: { fontSize: "9.5px", fontWeight: 700, color: "#5A3B22", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                        picked.name
                      )
                    )
                  : null
              );
            })
          ),
          // Category Tabs (图2 中部橙/杏标签条)
          h(
            "div",
            { style: { display: "flex", gap: "4px", padding: "0 14px", overflowX: "auto", flexShrink: 0 } },
            BAG_CATEGORIES.map(function (cat) {
              var active = bagCategory === cat.id;
              return h(
                "button",
                {
                  key: cat.id,
                  type: "button",
                  onClick: function () { setBagCategory(cat.id); },
                  style: {
                    border: "none",
                    borderRadius: "8px 8px 0 0",
                    padding: "6px 11px",
                    fontSize: "12px",
                    fontWeight: 700,
                    background: active ? "#DF6232" : "#E6B676",
                    color: active ? "#FFFFFF" : "#5B3B1E",
                    cursor: "pointer",
                    whiteSpace: "nowrap"
                  }
                },
                cat.label
              );
            })
          ),
          // Scrollable Item Grid (图2 下半部分带 xN 角标)
          h(
            "div",
            {
              style: {
                flex: 1,
                overflowY: "auto",
                margin: "0 14px",
                padding: "12px 10px",
                background: "#EAE0CB",
                borderRadius: "0 8px 8px 8px",
                minHeight: "140px"
              }
            },
            filtered.length === 0
              ? h("div", { style: { textAlign: "center", padding: "32px 10px", fontSize: "12.5px", color: "#8C775E" } }, "该分类下暂无背包物品")
              : h(
                  "div",
                  { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" } },
                  filtered.map(function (g) {
                    var remaining = g.items.filter(function (it) { return !usedIds[it.id]; }).length;
                    return h(
                      "button",
                      {
                        key: g.groupKey,
                        type: "button",
                        disabled: remaining <= 0,
                        onClick: function () { handlePickFromGroup(g); },
                        style: {
                          position: "relative",
                          background: remaining > 0 ? "#FFFDF7" : "#E5DEC9",
                          border: "1.5px solid #D5C1A0",
                          borderRadius: "12px",
                          padding: "12px 6px 8px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "4px",
                          cursor: remaining > 0 ? "pointer" : "not-allowed",
                          opacity: remaining > 0 ? 1 : 0.5
                        }
                      },
                      h(
                        "span",
                        {
                          style: {
                            position: "absolute",
                            top: "4px",
                            right: "6px",
                            fontSize: "11px",
                            fontWeight: 800,
                            color: "#4E3422"
                          }
                        },
                        "x" + remaining
                      ),
                      h("span", { style: { fontSize: "24px" } }, ItemTypeBadgeIcon(h, g.category)),
                      h(
                        "span",
                        {
                          style: {
                            fontSize: "11px",
                            fontWeight: 700,
                            color: "#4E3422",
                            maxWidth: "100%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                          }
                        },
                        g.name
                      )
                    );
                  })
                )
          ),
          // Bottom Confirm Button (图2 橙红确定按钮)
          h(
            "div",
            { style: { padding: "12px 16px 14px", display: "flex", justifyContent: "center" } },
            h(
              "button",
              {
                type: "button",
                onClick: function () {
                  setPackedItems(pickerDraftItems.slice());
                  setShowBagPicker(false);
                },
                style: {
                  width: "160px",
                  height: "38px",
                  border: "none",
                  borderRadius: "10px",
                  background: "linear-gradient(180deg, #ED743B 0%, #D45424 100%)",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 4px 10px rgba(212,84,36,0.3)"
                }
              },
              "确定"
            )
          )
        )
      );
    }

    // ---- Modal 2: 金库封钱弹窗 ----
    function renderCoinModal() {
      if (!showCoinModal) return null;
      return h(
        "div",
        {
          onClick: function (e) { if (e.target === e.currentTarget) setShowCoinModal(false); },
          style: { position: "fixed", inset: 0, zIndex: 1020, background: "rgba(38,26,16,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "18px" }
        },
        h(
          "div",
          { style: { width: "100%", maxWidth: "330px", background: "#FFFDF8", borderRadius: "18px", padding: "18px", border: "2px solid #E2C391", display: "flex", flexDirection: "column", gap: "12px" } },
          h("div", { style: { fontSize: "15px", fontWeight: 800, color: "#5A3921" } }, "🪙 封入五铢钱"),
          h("div", { style: { fontSize: "12px", color: "#8E7052" } }, "当前金库可用余额：" + vaultBalance + " 铢（封存时扣除，撤回可全额退还）"),
          h("input", {
            type: "number",
            min: 0,
            max: vaultBalance,
            value: coinInput,
            onChange: function (e) { setCoinInput(e.target.value); },
            placeholder: "输入金额（0 表示不放）",
            style: { border: "1.5px solid #DFC49C", borderRadius: "10px", padding: "9px 12px", fontSize: "15px", fontWeight: 700, color: "#5A3921", outline: "none" }
          }),
          h(
            "div",
            { style: { display: "flex", flexWrap: "wrap", gap: "6px" } },
            COIN_PRESETS.map(function (v) {
              return h(
                "button",
                {
                  key: v,
                  type: "button",
                  onClick: function () { setCoinInput(String(v)); },
                  style: { border: "1px solid #E5C99A", background: "#FFF7E6", color: "#9A6217", fontSize: "12px", fontWeight: 700, borderRadius: "999px", padding: "4px 10px", cursor: "pointer" }
                },
                v + " 铢"
              );
            })
          ),
          h(
            "div",
            { style: { display: "flex", gap: "8px", marginTop: "4px" } },
            h(
              "button",
              {
                type: "button",
                onClick: function () { setShowCoinModal(false); },
                style: { flex: 1, height: "38px", border: "1px solid #DFCBB2", borderRadius: "10px", background: "#FAF4EA", color: "#7B6147", fontWeight: 600, cursor: "pointer" }
              },
              "取消"
            ),
            h(
              "button",
              {
                type: "button",
                onClick: function () {
                  var amt = Math.max(0, Math.floor(Number(coinInput) || 0));
                  if (amt > vaultBalance) {
                    flashToast("超出当前金库余额（" + vaultBalance + " 铢）");
                    return;
                  }
                  setPackedCoins(amt);
                  setShowCoinModal(false);
                },
                style: { flex: 1, height: "38px", border: "none", borderRadius: "10px", background: "#D9694B", color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }
              },
              "确认封入"
            )
          )
        )
      );
    }

    // ---- Modal 3: 图3 风格信件编辑弹窗 ----
    function renderLetterModal() {
      if (!showLetterModal) return null;
      return h(
        "div",
        {
          onClick: function (e) { if (e.target === e.currentTarget) setShowLetterModal(false); },
          style: { position: "fixed", inset: 0, zIndex: 1020, background: "rgba(38,26,16,0.62)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", overflowY: "auto" }
        },
        h(
          "div",
          { style: { width: "100%", maxWidth: "360px", display: "flex", flexDirection: "column", gap: "12px" } },
          Figure3LetterCard(h, {
            occasionName: occasionName || "秘密惊喜",
            title: letterDraft.title,
            salutation: "亲爱的 " + charName + "：",
            body: letterDraft.body,
            revealDate: revealDate,
            sign: letterDraft.sign,
            editable: true,
            onChangeTitle: function (v) { setLetterDraft(function (d) { return Object.assign({}, d, { title: v }); }); },
            onChangeBody: function (v) { setLetterDraft(function (d) { return Object.assign({}, d, { body: v }); }); },
            onChangeSign: function (v) { setLetterDraft(function (d) { return Object.assign({}, d, { sign: v }); }); }
          }),
          h(
            "div",
            { style: { display: "flex", gap: "10px" } },
            h(
              "button",
              {
                type: "button",
                onClick: function () { setShowLetterModal(false); },
                style: { flex: 1, height: "40px", border: "1px solid rgba(255,255,255,0.4)", borderRadius: "12px", background: "rgba(255,255,255,0.16)", color: "#FFFFFF", fontWeight: 600, cursor: "pointer" }
              },
              "返回"
            ),
            h(
              "button",
              {
                type: "button",
                onClick: function () {
                  setPackedLetter(Object.assign({}, letterDraft));
                  setShowLetterModal(false);
                },
                style: { flex: 1.5, height: "40px", border: "none", borderRadius: "12px", background: "linear-gradient(135deg, #DC8D7B, #C66756)", color: "#FFFFFF", fontWeight: 800, cursor: "pointer" }
              },
              "💌 放入行囊"
            )
          )
        )
      );
    }

    // ---- Modal 4: 约定惊喜日（让 TA 偷偷筹备） ----
    function renderCharPrepModal() {
      if (!showCharPrepModal) return null;
      return h(
        "div",
        {
          onClick: function (e) { if (e.target === e.currentTarget && !isPreparingChar) setShowCharPrepModal(false); },
          style: { position: "fixed", inset: 0, zIndex: 1020, background: "rgba(38,26,16,0.58)", display: "flex", alignItems: "center", justifyContent: "center", padding: "18px" }
        },
        h(
          "div",
          { style: { width: "100%", maxWidth: "340px", background: "#FFFDF8", borderRadius: "18px", padding: "18px", border: "2px solid #E2C391", display: "flex", flexDirection: "column", gap: "12px" } },
          h("div", { style: { fontSize: "15px", fontWeight: 800, color: "#5A3921" } }, "🎁 让 " + charName + " 悄悄准备惊喜"),
          h("div", { style: { fontSize: "12px", color: "#8C6F52", lineHeight: 1.55 } }, "填好日子与揭晓日期后，" + charName + " 会在后台背着你打包好礼物、五铢钱与书信。若选未来日期，到那天之前你都看不到具体内容哦！"),
          h("input", {
            type: "text",
            value: charPrepOccasion,
            onChange: function (e) { setCharPrepOccasion(e.target.value); },
            placeholder: "当天是什么日子？（如：我的生日）",
            maxLength: 16,
            style: { border: "1.5px solid #DEC6A5", borderRadius: "10px", padding: "9px 10px", fontSize: "13px", outline: "none" }
          }),
          h("input", {
            type: "date",
            value: charPrepDate,
            onChange: function (e) { setCharPrepDate(e.target.value); },
            style: { border: "1.5px solid #DEC6A5", borderRadius: "10px", padding: "8px 10px", fontSize: "13px", outline: "none" }
          }),
          h(
            "div",
            { style: { display: "flex", gap: "8px", marginTop: "4px" } },
            h(
              "button",
              {
                type: "button",
                disabled: isPreparingChar,
                onClick: function () { setShowCharPrepModal(false); },
                style: { flex: 1, height: "38px", border: "1px solid #DFCBB2", borderRadius: "10px", background: "#FAF4EA", color: "#7B6147", fontWeight: 600, cursor: "pointer" }
              },
              "取消"
            ),
            h(
              "button",
              {
                type: "button",
                disabled: isPreparingChar,
                onClick: handlePrepareCharSurprise,
                style: { flex: 1.4, height: "38px", border: "none", borderRadius: "10px", background: isPreparingChar ? "#C9A598" : "#D9694B", color: "#FFFFFF", fontWeight: 700, cursor: isPreparingChar ? "not-allowed" : "pointer" }
              },
              isPreparingChar ? charName + " 正在秘密打包…" : "开始秘密筹备"
            )
          )
        )
      );
    }

    // ---- Modal 5: 到日拆封仪式弹窗（含图3信笺 + 礼物/五铢钱 + 长图导出） ----
    function renderRevealModal() {
      if (!revealedModalRec) return null;
      var rec = revealedModalRec;
      var isFromChar = rec.direction === "from_char";
      return h(
        "div",
        {
          onClick: function (e) { if (e.target === e.currentTarget) setRevealedModalRec(null); },
          style: { position: "fixed", inset: 0, zIndex: 1025, background: "rgba(28,18,12,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: "14px", overflowY: "auto" }
        },
        h(
          "div",
          { style: { width: "100%", maxWidth: "375px", maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px" } },
          h(
            "div",
            {
              ref: revealExportRef,
              style: {
                background: "#FFF9F5",
                borderRadius: "20px",
                padding: "18px 14px",
                display: "flex",
                flexDirection: "column",
                gap: "14px"
              }
            },
            h(
              "div",
              { style: { textAlign: "center" } },
              h("div", { style: { fontSize: "16px", fontWeight: 800, color: "#683C24" } }, "✨ " + rec.occasionName + " · 秘密揭晓"),
              h("div", { style: { fontSize: "11.5px", color: "#9C7B63", marginTop: "2px" } }, isFromChar ? "来自 " + rec.charName + " 的专属行囊" : "送给 " + rec.charName + " 的专属行囊")
            ),

            // Gifts + Coins summary strip
            ((rec.items && rec.items.length > 0) || rec.coins > 0) &&
              h(
                "div",
                { style: { background: "#FAF0DF", border: "1px solid #E5CCA4", borderRadius: "14px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" } },
                rec.items && rec.items.length > 0 &&
                  h(
                    "div",
                    { style: { display: "flex", flexWrap: "wrap", gap: "6px" } },
                    rec.items.map(function (it, idx) {
                      return h(
                        "span",
                        {
                          key: it.id || idx,
                          style: {
                            background: "#FFFDF8",
                            border: "1px solid #DEC39A",
                            borderRadius: "999px",
                            padding: "4px 10px",
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "#5C3D23"
                          }
                        },
                        ItemTypeBadgeIcon(h, Engine.classifyBackpackCategory(it)) + " " + it.name
                      );
                    })
                  ),
                rec.coins > 0 &&
                  h(
                    "div",
                    { style: { fontSize: "12.5px", fontWeight: 800, color: "#A16207" } },
                    "🪙 五铢钱红包：" + rec.coins + " 铢" + (isFromChar ? "（已自动存入我的金库）" : "")
                  )
              ),

            // Figure 3 Letter Card
            rec.letter && rec.letter.body &&
              Figure3LetterCard(h, {
                occasionName: rec.occasionName,
                title: rec.letter.title,
                salutation: "亲爱的 " + (isFromChar ? userName : rec.charName) + "：",
                body: rec.letter.body,
                revealDate: rec.revealDate,
                sign: rec.letter.sign || (isFromChar ? rec.charName : userName),
                editable: false
              }),

            // Character's unboxing reaction (for user-prepared bundles)
            !isFromChar && rec.charReaction &&
              h(
                "div",
                { style: { background: "#FFF4EE", border: "1px solid #EBC7B8", borderRadius: "14px", padding: "12px 14px", fontSize: "13px", lineHeight: 1.75, color: "#684231" } },
                h("div", { style: { fontSize: "11.5px", fontWeight: 800, color: "#C25943", marginBottom: "4px" } }, rec.charName + " 拆开包裹时的反应："),
                rec.charReaction
              )
          ),
          h(
            "div",
            { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
            isFromChar &&
              global.CoupleSurpriseJournalModal &&
              h(
                "button",
                {
                  type: "button",
                  onClick: function () { setShowJournalRec(rec); },
                  style: {
                    flex: "1 1 100%",
                    height: "40px",
                    border: "1.5px solid #D49C5E",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, #FFF5DB, #F9E3B1)",
                    color: "#7A4519",
                    fontSize: "13.5px",
                    fontWeight: 800,
                    cursor: "pointer"
                  }
                },
                "📜 查看 " + rec.charName + " 的备礼历程"
              ),
            h(
              "button",
              {
                type: "button",
                onClick: handleExportRevealImage,
                style: { flex: 1.3, height: "40px", border: "none", borderRadius: "12px", background: "linear-gradient(135deg, #D98A7A, #C26755)", color: "#FFFFFF", fontWeight: 800, cursor: "pointer" }
              },
              "📸 保存纪念长图"
            ),
            h(
              "button",
              {
                type: "button",
                onClick: function () { setRevealedModalRec(null); },
                style: { flex: 1, height: "40px", border: "1px solid rgba(255,255,255,0.4)", borderRadius: "12px", background: "rgba(255,255,255,0.16)", color: "#FFFFFF", fontWeight: 600, cursor: "pointer" }
              },
              "收好关闭"
            )
          )
        )
      );
    }

    // ---- Main Fullscreen Container ----
    return h(
      "div",
      {
        style: {
          position: "fixed",
          inset: 0,
          zIndex: 1005,
          background: "#F5ECE0",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif"
        }
      },
      // Top Navigation Bar
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "max(12px, env(safe-area-inset-top)) 14px 10px",
            background: "#FFFDF9",
            borderBottom: "1px solid #EBE0D0",
            flexShrink: 0
          }
        },
        h(
          "button",
          {
            type: "button",
            onClick: onBack,
            style: {
              border: "none",
              background: "transparent",
              color: "#6B4F38",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              padding: "4px 6px"
            }
          },
          "‹ 返回"
        ),
        h("div", { style: { fontSize: "15.5px", fontWeight: 800, color: "#4E3422" } }, "秘密惊喜"),
        h(
          "div",
          { style: { fontSize: "11.5px", color: "#9C7B5C", fontWeight: 600 } },
          "🪙 " + vaultBalance
        )
      ),

      // Horizontal Dual-Perspective Selector Bar (横向选择条)
      h(
        "div",
        { style: { padding: "10px 14px 4px", flexShrink: 0 } },
        h(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              background: "#E9DEC9",
              borderRadius: "999px",
              padding: "4px",
              gap: "4px"
            }
          },
          [
            { id: "from_char", label: "🎁 " + charName + " 为我准备的" },
            { id: "from_user", label: "🎀 我为 " + charName + " 准备的" }
          ].map(function (tab) {
            var active = activeTab === tab.id;
            return h(
              "button",
              {
                key: tab.id,
                type: "button",
                onClick: function () { setActiveTab(tab.id); },
                style: {
                  border: "none",
                  borderRadius: "999px",
                  padding: "8px 10px",
                  fontSize: "12.5px",
                  fontWeight: active ? 800 : 500,
                  background: active ? "#FFFDF9" : "transparent",
                  color: active ? "#B84C33" : "#755E47",
                  boxShadow: active ? "0 2px 6px rgba(138,84,48,0.12)" : "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }
              },
              tab.label
            );
          })
        )
      ),

      // Scrollable Body
      h(
        "div",
        { style: { flex: 1, overflowY: "auto", padding: "10px 14px 28px" } },
        activeTab === "from_char" ? renderFromCharTab() : renderFromUserTab()
      ),

      // Floating Toast
      toast &&
        h(
          "div",
          {
            style: {
              position: "fixed",
              bottom: "28px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1040,
              background: "rgba(56, 36, 22, 0.9)",
              color: "#FFFDF9",
              padding: "9px 16px",
              borderRadius: "999px",
              fontSize: "12.5px",
              fontWeight: 600,
              boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
              whiteSpace: "nowrap",
              maxWidth: "88vw",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }
          },
          toast
        ),

      renderBagPickerModal(),
      renderCoinModal(),
      renderLetterModal(),
      renderCharPrepModal(),
      renderRevealModal(),
      showJournalRec &&
        global.CoupleSurpriseJournalModal &&
        h(global.CoupleSurpriseJournalModal, {
          record: showJournalRec,
          onClose: function () { setShowJournalRec(null); }
        })
    );
  }

  global.CoupleSurprisePage = CoupleSurprisePage;
})(typeof window !== "undefined" ? window : globalThis);

