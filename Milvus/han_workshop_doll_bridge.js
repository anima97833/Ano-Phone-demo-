/**
 * Milvus/han_workshop_doll_bridge.js
 * 「东汉工坊 · 棉花手作（棉花娃娃手作工坊）」纯宿主桥接引擎（严格零 AI）
 *
 * 1. 通过 window.HanWorkshopApp.registerWorkshop("slot_5", ...) 自动热插拔入驻，零改动 app.min.js
 * 2. 全屏托管同源 <iframe src="./棉花手作.html">，兼容 file:// 与 http://
 * 3. 不接入任何 LLM / 记忆胶囊 / 世界书 / 角色共创，仅提供：
 *    - 返回东汉工坊（WORKSHOP_DOLL_CLOSE）
 *    - 轻量化好友名单同步（仅 id/name，供「赠予好友」下拉框使用）
 *    - 存入「我的背包」（backpackStore.addItems）
 *    - 传讯画框大图转发（type: "image", isEmoji: false）
 */
(function (global) {
  "use strict";

  async function getSimpleFriendList() {
    var rawList = [];
    try {
      if (global.chatCharacterStore && typeof global.chatCharacterStore.getAll === "function") {
        var stored = await global.chatCharacterStore.getAll();
        if (Array.isArray(stored) && stored.length > 0) rawList = stored;
      }
    } catch (_) {}
    if (rawList.length === 0 && Array.isArray(global.__T8_LIVE_CHATS)) rawList = global.__T8_LIVE_CHATS;
    if (rawList.length === 0) {
      try {
        var localList = JSON.parse((global.localStorage && global.localStorage.getItem("t8_chat_list")) || "[]");
        if (Array.isArray(localList)) rawList = localList;
      } catch (_) {}
    }

    var seen = {};
    var out = [];
    for (var i = 0; i < rawList.length; i++) {
      var c = rawList[i];
      if (!c || typeof c !== "object") continue;
      if (String(c.id || "").indexOf("group") === 0 || c.type === "group" || c.type === "decor" || c.type === "moments") continue;
      var cid = String(c.id || c.name || "");
      var cname = String(c.name || c.nickname || "").trim();
      if (!cid || !cname || seen[cid]) continue;
      seen[cid] = true;
      out.push({ id: cid, name: cname });
    }
    return out;
  }

  function compressDataUrl(dataUrl, maxSide, quality) {
    return new Promise(function (resolve) {
      if (!dataUrl || typeof Image === "undefined" || typeof document === "undefined") { resolve(dataUrl || ""); return; }
      var img = new Image();
      img.onerror = function () { resolve(dataUrl); };
      img.onload = function () {
        try {
          var limit = maxSide || 680;
          var w = img.naturalWidth || img.width || 600;
          var h = img.naturalHeight || img.height || 600;
          if (w > limit || h > limit) {
            var r = Math.min(limit / w, limit / h);
            w = Math.max(1, Math.round(w * r));
            h = Math.max(1, Math.round(h * r));
          }
          var c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          c.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL("image/jpeg", quality || 0.84) || dataUrl);
        } catch (_) { resolve(dataUrl); }
      };
      img.src = dataUrl;
    });
  }

  async function saveDollToBackpack(payload) {
    var bp = global.backpackStore;
    if (!bp || (typeof bp.addItems !== "function" && typeof bp.add !== "function" && typeof bp.save !== "function" && typeof bp.put !== "function")) {
      return { ok: false, message: "未检测到「我的背包」存储模块" };
    }
    var thumb = await compressDataUrl(payload && payload.posterDataUrl || "", 540, 0.82);
    var item = {
      id: "doll_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      name: String((payload && payload.dollName) || "奶糖小兔").slice(0, 24),
      price: 0,
      merchant: "东汉工坊 · 棉花娃娃手作工坊",
      type: "手作棉花娃",
      category: "decor",
      description: String((payload && payload.dollDesc) || "一针一线亲手缝制的棉花娃娃").slice(0, 120),
      image: thumb,
      acquiredAt: Date.now()
    };
    try {
      if (typeof bp.addItems === "function") await bp.addItems([item]);
      else if (typeof bp.add === "function") await bp.add(item);
      else if (typeof bp.save === "function") await bp.save(item);
      else await bp.put(item);
      return { ok: true, message: "已收入「设置 → 隐私 → 我的背包」：" + item.name };
    } catch (e) {
      return { ok: false, message: "存入背包失败：" + (e && e.message ? e.message : e) };
    }
  }

  async function sendDollToChat(payload) {
    var rawCharId = payload && payload.charId;
    if (rawCharId === undefined || rawCharId === null || String(rawCharId).trim() === "") {
      return { ok: false, message: "请先选择一位要赠予的传讯好友" };
    }
    var chStore = global.chatHistoryStore;
    if (!chStore || (typeof chStore.saveMessage !== "function" && typeof chStore.saveMessages !== "function")) {
      return { ok: false, message: "未检测到传讯消息存储模块" };
    }

    var targetChar = null;
    try {
      if (global.chatCharacterStore && typeof global.chatCharacterStore.getAll === "function") {
        var allChars = await global.chatCharacterStore.getAll();
        if (Array.isArray(allChars)) {
          targetChar = allChars.find(function (c) {
            return c && (String(c.id) === String(rawCharId) || (payload.charName && String(c.name) === String(payload.charName)));
          }) || null;
        }
      }
    } catch (_) {}
    if (!targetChar) {
      try {
        var lsChars = JSON.parse((global.localStorage && global.localStorage.getItem("t8_chat_list")) || "[]");
        if (Array.isArray(lsChars)) {
          targetChar = lsChars.find(function (c) {
            return c && (String(c.id) === String(rawCharId) || (payload.charName && String(c.name) === String(payload.charName)));
          }) || null;
        }
      } catch (_) {}
    }

    var targetId = targetChar && targetChar.id !== undefined ? targetChar.id : rawCharId;
    var targetName = (targetChar && (targetChar.name || targetChar.nickname)) || payload.charName || "好友";

    var thumb = await compressDataUrl(payload.posterDataUrl || "", 640, 0.84);
    var now = Date.now();
    var d = new Date(now);
    var timeStr = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    var userNote = String(payload.forwardNote || "").trim().slice(0, 120);
    var itemTitle = String(payload.dollName || "奶糖小兔");
    var captionTitle = "《" + itemTitle + "》 · 棉花娃娃出生证（东汉工坊手作纪念图）";

    var msgsToSave = [];
    if (thumb) {
      msgsToSave.push({
        id: now,
        type: "image",
        isEmoji: false,
        isMe: true,
        sender: "user",
        time: timeStr,
        timestamp: now,
        text: captionTitle,
        content: thumb
      });
    } else {
      msgsToSave.push({
        id: now,
        type: "text",
        isMe: true,
        sender: "user",
        time: timeStr,
        timestamp: now,
        text: "【东汉工坊 · 棉花手作】" + captionTitle
      });
    }
    if (userNote) {
      msgsToSave.push({
        id: now + 1,
        type: "text",
        isMe: true,
        sender: "user",
        time: timeStr,
        timestamp: now + 1,
        text: userNote
      });
    }

    var primaryMsg = msgsToSave[0];
    try {
      if (typeof chStore.saveMessage === "function") {
        for (var i = 0; i < msgsToSave.length; i++) await chStore.saveMessage(targetId, msgsToSave[i]);
      } else {
        var prevRes = typeof chStore.getMessages === "function" ? await chStore.getMessages(targetId, 1, 200) : null;
        var prevList = (prevRes && Array.isArray(prevRes.messages)) ? prevRes.messages : [];
        await chStore.saveMessages(targetId, prevList.concat(msgsToSave));
      }
      try {
        var lsKey = "t8_chat_history_" + targetId;
        var rawHist = global.localStorage && global.localStorage.getItem(lsKey);
        if (rawHist) {
          var arr = JSON.parse(rawHist);
          if (Array.isArray(arr)) {
            for (var j = 0; j < msgsToSave.length; j++) arr.push(msgsToSave[j]);
            global.localStorage.setItem(lsKey, JSON.stringify(arr));
          }
        }
      } catch (_) {}

      var previewText = "[棉花手作] 《" + itemTitle + "》";
      try {
        var listRaw = global.localStorage && global.localStorage.getItem("t8_chat_list");
        if (listRaw) {
          var list = JSON.parse(listRaw);
          if (Array.isArray(list)) {
            var next = list.map(function (c) {
              return c && String(c.id) === String(targetId)
                ? Object.assign({}, c, { lastMessage: previewText, lastTime: timeStr, time: timeStr, updatedAt: now })
                : c;
            });
            global.localStorage.setItem("t8_chat_list", JSON.stringify(next));
          }
        }
      } catch (_) {}
      try {
        if (targetChar && global.chatCharacterStore && typeof global.chatCharacterStore.save === "function") {
          targetChar.lastMessage = previewText;
          targetChar.lastTime = timeStr;
          targetChar.time = timeStr;
          targetChar.updatedAt = now;
          await global.chatCharacterStore.save(targetChar);
        }
      } catch (_) {}

      if (typeof global.dispatchEvent === "function" && typeof CustomEvent === "function") {
        global.dispatchEvent(new CustomEvent("reloadChats"));
        global.dispatchEvent(new CustomEvent("milvus-forum-share-sent", { detail: { charId: String(targetId), msg: primaryMsg } }));
        global.dispatchEvent(new CustomEvent("chatHistoryUpdated", { detail: { chatId: String(targetId) } }));
      }
      return { ok: true, message: "已成功赠予至「" + targetName + "」的传讯聊天" };
    } catch (e) {
      return { ok: false, message: "转发传讯失败：" + (e && e.message ? e.message : e) };
    }
  }

  async function setDollAsHomePet(payload) {
    var store = global.HomeDollPetStore;
    if (!store || typeof store.savePet !== "function") {
      return { ok: false, message: "未检测到桌宠存储模块" };
    }
    try {
      var thumb = await compressDataUrl(payload && payload.thumb || "", 220, 0.76);
      var rec = await store.savePet({
        id: payload && payload.sourceId ? ("atelier_" + String(payload.sourceId)) : ("pet_cotton_" + Date.now()),
        sourceId: payload && payload.sourceId ? String(payload.sourceId) : "",
        type: "cotton",
        name: String((payload && payload.dollName) || "奶糖小兔").slice(0, 20),
        sub: String((payload && payload.dollSub) || "棉花手作娃娃").slice(0, 36),
        thumb: thumb,
        snapshot: (payload && payload.snapshot) || null,
        createdAt: Date.now()
      });
      store.saveConfig({ activePetId: rec.id, enabled: true });
      return { ok: true, message: "已将「" + rec.name + "」设为桌面宠物！返回主屏幕即可看到" };
    } catch (e) {
      return { ok: false, message: "设为桌宠失败：" + (e && e.message ? e.message : e) };
    }
  }

  function DollWorkshopHostModal(props) {
    var React = global.React;
    if (!React) return null;
    var h = React.createElement;
    var useEffect = React.useEffect;
    var useRef = React.useRef;

    var onClose = props && (props.onClose || props.onBack);
    var iframeRef = useRef(null);

    async function pushFriendList() {
      var win = iframeRef.current && iframeRef.current.contentWindow;
      if (!win) return;
      var friends = await getSimpleFriendList();
      win.postMessage({ type: "WORKSHOP_DOLL_HOST_SYNC", payload: { friends: friends } }, "*");
    }

    useEffect(function () {
      var onMessage = async function (ev) {
        var data = ev && ev.data;
        if (!data || typeof data !== "object" || !data.type) return;
        var win = iframeRef.current && iframeRef.current.contentWindow;
        if (win && ev.source && ev.source !== win) return;

        if (data.type === "WORKSHOP_DOLL_CLOSE" || data.type === "WORKSHOP_CAKE_CLOSE") {
          if (typeof onClose === "function") onClose();
          return;
        }
        if (data.type === "WORKSHOP_DOLL_REQUEST_SYNC") {
          await pushFriendList();
          return;
        }
        if (!win) return;

        var reqId = data.requestId;
        var p = data.payload || {};
        if (data.type === "WORKSHOP_DOLL_SAVE_BACKPACK") {
          var bpRes = await saveDollToBackpack(p);
          win.postMessage({ type: "WORKSHOP_DOLL_ACTION_RESULT", requestId: reqId, result: bpRes }, "*");
        } else if (data.type === "WORKSHOP_DOLL_SEND_CHAT") {
          var chRes = await sendDollToChat(p);
          win.postMessage({ type: "WORKSHOP_DOLL_ACTION_RESULT", requestId: reqId, result: chRes }, "*");
        } else if (data.type === "WORKSHOP_DOLL_SET_HOME_PET") {
          var petRes = await setDollAsHomePet(p);
          win.postMessage({ type: "WORKSHOP_DOLL_ACTION_RESULT", requestId: reqId, result: petRes }, "*");
        }
      };

      global.addEventListener("message", onMessage);
      return function () { global.removeEventListener("message", onMessage); };
    }, [onClose]);

    return h(
      "div",
      {
        style: {
          position: "fixed",
          inset: 0,
          zIndex: 1020,
          background: "#201A17",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          touchAction: "none"
        }
      },
      h("iframe", {
        ref: iframeRef,
        src: "./棉花手作.html",
        title: "东汉工坊 · 棉花手作",
        onLoad: function () { pushFriendList(); },
        style: {
          flex: 1,
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
          background: "#201A17"
        }
      })
    );
  }

  // Hot-plug into 东汉工坊 reserved slot_5 ("棉花手作")
  if (global.HanWorkshopApp && typeof global.HanWorkshopApp.registerWorkshop === "function") {
    global.HanWorkshopApp.registerWorkshop("slot_5", {
      title: "棉花手作",
      subtitle: "棉花娃娃 · 捏娃",
      icon: "doll",
      component: DollWorkshopHostModal
    });
  }

  global.HanWorkshopDollBridge = {
    version: "1.0.0",
    saveDollToBackpack: saveDollToBackpack,
    sendDollToChat: sendDollToChat
  };
})(typeof window !== "undefined" ? window : globalThis);

