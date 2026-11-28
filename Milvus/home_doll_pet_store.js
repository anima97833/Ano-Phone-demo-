/**
 * Milvus/home_doll_pet_store.js
 * 主屏幕桌面宠物独立数据层（严格零 AI）
 * - 独立库 milvus_home_doll_pet_idb：存储用户设为桌宠的棉花娃、以及后续导入的 Live2D / Spine 模型
 * - 自动兼容读取「棉花手作」本地娃柜（CottonDollAtelierDB_V2），开启桌宠即可直接看到所有亲手制作的娃娃
 * - 轻量配置存于 localStorage（milvus_home_doll_pet_cfg），采用归一化坐标 nx/ny 适配任意分辨率
 */
(function (global) {
  "use strict";

  var PET_DB_NAME = "milvus_home_doll_pet_idb";
  var PET_DB_VER = 1;
  var PET_STORE = "pets";
  var CFG_KEY = "milvus_home_doll_pet_cfg";
  var ATELIER_DB_NAME = "CottonDollAtelierDB_V2";

  var DEFAULT_CFG = {
    enabled: false,
    activePetId: "",
    scale: 0.75,
    nx: 0.84,
    ny: 0.82,
    behaviorMode: "quiet", // "quiet" | "roam" | "sit_dock"
    corner: "bottom_right", // "bottom_right" | "bottom_left"
    alwaysOnTop: true, // 默认在所有页面最上方（含传讯等应用）
    soundEnabled: false
  };

  var petDbPromise = null;

  function emitPetUpdated(detail) {
    try {
      if (typeof global.dispatchEvent === "function" && typeof CustomEvent === "function") {
        global.dispatchEvent(new CustomEvent("milvus-home-doll-pet-updated", { detail: detail || {} }));
      }
    } catch (_) {}
  }

  function getConfig() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(CFG_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return Object.assign({}, DEFAULT_CFG, parsed);
        }
      }
    } catch (_) {}
    return Object.assign({}, DEFAULT_CFG);
  }

  function saveConfig(patch) {
    var next = Object.assign({}, getConfig(), patch || {});
    next.scale = Math.max(0.35, Math.min(1.5, Number(next.scale) || 0.75));
    next.nx = Math.max(0.06, Math.min(0.94, Number(next.nx) || 0.84));
    next.ny = Math.max(0.10, Math.min(0.94, Number(next.ny) || 0.82));
    next.alwaysOnTop = next.alwaysOnTop !== false;
    try {
      if (global.localStorage) global.localStorage.setItem(CFG_KEY, JSON.stringify(next));
    } catch (_) {}
    emitPetUpdated({ reason: "config", config: next });
    return next;
  }

  function openPetDB() {
    if (petDbPromise) return petDbPromise;
    petDbPromise = new Promise(function (resolve, reject) {
      if (typeof indexedDB === "undefined") { reject(new Error("不支持 IndexedDB")); return; }
      var req = indexedDB.open(PET_DB_NAME, PET_DB_VER);
      req.onupgradeneeded = function (ev) {
        var db = ev.target.result;
        if (!db.objectStoreNames.contains(PET_STORE)) {
          db.createObjectStore(PET_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = function (ev) { resolve(ev.target.result); };
      req.onerror = function (ev) { petDbPromise = null; reject(ev.target.error); };
    });
    return petDbPromise;
  }

  async function savePet(record) {
    if (!record || typeof record !== "object") throw new Error("无效桌宠数据");
    var db = await openPetDB();
    var rec = Object.assign({
      id: "pet_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      type: "cotton", // "cotton" | "live2d" | "spine"
      name: "奶糖小兔",
      sub: "棉花手作娃娃",
      thumb: "",
      snapshot: null,
      files: null, // For Live2D / Spine uploaded ZIP blobs/entries
      meta: null,
      createdAt: Date.now()
    }, record);

    await new Promise(function (resolve, reject) {
      var tx = db.transaction(PET_STORE, "readwrite");
      tx.objectStore(PET_STORE).put(rec);
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = function (ev) { reject(ev.target.error); };
    });
    emitPetUpdated({ reason: "save_pet", petId: rec.id });
    return rec;
  }

  async function getPetById(id) {
    if (!id) return null;
    try {
      var db = await openPetDB();
      var found = await new Promise(function (resolve) {
        var tx = db.transaction(PET_STORE, "readonly");
        var req = tx.objectStore(PET_STORE).get(String(id));
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { resolve(null); };
      });
      if (found) return found;
    } catch (_) {}
    var all = await listAllPets();
    return all.find(function (p) { return String(p.id) === String(id); }) || null;
  }

  async function deletePet(id) {
    if (!id) return false;
    try {
      var db = await openPetDB();
      await new Promise(function (resolve, reject) {
        var tx = db.transaction(PET_STORE, "readwrite");
        tx.objectStore(PET_STORE).delete(String(id));
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function (ev) { reject(ev.target.error); };
      });
      var cfg = getConfig();
      if (cfg.activePetId === String(id)) {
        saveConfig({ activePetId: "" });
      } else {
        emitPetUpdated({ reason: "delete_pet", petId: String(id) });
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  // 自动读取「棉花手作」娃柜（CottonDollAtelierDB_V2），让用户做的娃娃立即可见
  function readAtelierGalleryPets() {
    return new Promise(function (resolve) {
      if (typeof indexedDB === "undefined") { resolve([]); return; }
      try {
        var req = indexedDB.open(ATELIER_DB_NAME, 1);
        req.onupgradeneeded = function (ev) {
          var db = ev.target.result;
          if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "projectId" });
          if (!db.objectStoreNames.contains("gallery")) db.createObjectStore("gallery", { keyPath: "id" });
        };
        req.onerror = function () { resolve([]); };
        req.onsuccess = function (ev) {
          var db = ev.target.result;
          var out = [];
          try {
            var storeNames = [];
            if (db.objectStoreNames.contains("gallery")) storeNames.push("gallery");
            if (db.objectStoreNames.contains("projects")) storeNames.push("projects");
            if (!storeNames.length) { db.close(); resolve([]); return; }
            var tx = db.transaction(storeNames, "readonly");
            var pending = storeNames.length;
            var doneOne = function () {
              pending--;
              if (pending <= 0) {
                try { db.close(); } catch (_) {}
                resolve(out);
              }
            };
            if (storeNames.indexOf("gallery") >= 0) {
              var gReq = tx.objectStore("gallery").getAll();
              gReq.onsuccess = function () {
                var rows = Array.isArray(gReq.result) ? gReq.result : [];
                rows.forEach(function (it) {
                  if (!it || !it.snapshot) return;
                  out.push({
                    id: "atelier_" + String(it.id),
                    sourceId: String(it.id),
                    fromAtelier: true,
                    type: "cotton",
                    name: String(it.name || (it.snapshot.showcase && it.snapshot.showcase.name) || "棉花娃娃"),
                    sub: String(it.sub || "棉花手作娃柜"),
                    thumb: it.dataUrl || "",
                    snapshot: it.snapshot,
                    createdAt: Number(it.createdAt) || 0
                  });
                });
                doneOne();
              };
              gReq.onerror = doneOne;
            }
            if (storeNames.indexOf("projects") >= 0) {
              var pReq = tx.objectStore("projects").get("latest");
              pReq.onsuccess = function () {
                var row = pReq.result;
                if (row && row.data && row.data.face && row.data.body) {
                  out.push({
                    id: "atelier_latest_draft",
                    sourceId: "latest",
                    fromAtelier: true,
                    type: "cotton",
                    name: String((row.data.showcase && row.data.showcase.name) || "当前捏娃进度") + "（草稿）",
                    sub: "棉花手作最近编辑",
                    thumb: "",
                    snapshot: row.data,
                    createdAt: Number(row.updatedAt) || 1
                  });
                }
                doneOne();
              };
              pReq.onerror = doneOne;
            }
          } catch (_) {
            try { db.close(); } catch (__) {}
            resolve([]);
          }
        };
      } catch (_) {
        resolve([]);
      }
    });
  }

  async function listAllPets() {
    var stored = [];
    try {
      var db = await openPetDB();
      stored = await new Promise(function (resolve) {
        var tx = db.transaction(PET_STORE, "readonly");
        var req = tx.objectStore(PET_STORE).getAll();
        req.onsuccess = function () { resolve(Array.isArray(req.result) ? req.result : []); };
        req.onerror = function () { resolve([]); };
      });
    } catch (_) {}

    var atelier = await readAtelierGalleryPets();
    var seenIds = {};
    var merged = [];
    stored.forEach(function (p) {
      if (!p || !p.id) return;
      seenIds[String(p.id)] = true;
      if (p.sourceId) seenIds["atelier_" + String(p.sourceId)] = true;
      merged.push(p);
    });
    atelier.forEach(function (p) {
      if (!p || !p.id || seenIds[String(p.id)]) return;
      seenIds[String(p.id)] = true;
      merged.push(p);
    });

    merged.sort(function (a, b) { return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0); });
    return merged;
  }

  global.HomeDollPetStore = {
    version: "1.0.0",
    PET_DB_NAME: PET_DB_NAME,
    CFG_KEY: CFG_KEY,
    DEFAULT_CFG: DEFAULT_CFG,
    getConfig: getConfig,
    saveConfig: saveConfig,
    savePet: savePet,
    getPetById: getPetById,
    deletePet: deletePet,
    listAllPets: listAllPets,
    emitPetUpdated: emitPetUpdated
  };
})(typeof window !== "undefined" ? window : globalThis);

