/**
 * db.js - 本地 IndexedDB 持久化数据库引擎
 * 为 Ano-Phone 提供纯前端无后端的可靠本地数据存储与状态同步
 */
(function (global) {
  const DB_NAME = "AnoPhoneDB";
  const DB_VERSION = 1;

  const STORES = {
    SETTINGS: "settings",
    CHARACTERS: "characters",
    CHATS: "chats",
    CALENDAR: "calendar",
    ORDERS: "orders",
    WORLD_BOOKS: "world_books"
  };

  let dbInstance = null;
  let openDbPromise = null;

  function openDB() {
    if (dbInstance) return Promise.resolve(dbInstance);
    if (openDbPromise) return openDbPromise;

    openDbPromise = new Promise((resolve) => {
      let request;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (err) {
        console.error("[DB] 打开 IndexedDB 异常:", err);
        return resolve(null);
      }

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        Object.values(STORES).forEach((storeName) => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: "id" });
          }
        });
      };

      request.onsuccess = (e) => {
        dbInstance = e.target.result;
        dbInstance.onversionchange = () => {
          try { dbInstance.close(); } catch (err) {}
          dbInstance = null;
          openDbPromise = null;
        };
        dbInstance.onclose = () => {
          dbInstance = null;
          openDbPromise = null;
        };
        resolve(dbInstance);
      };

      request.onerror = (e) => {
        console.error("[DB] 打开 IndexedDB 失败，降级到 localStorage:", e);
        dbInstance = null;
        resolve(null);
      };
    }).finally(() => {
      openDbPromise = null;
    });

    return openDbPromise;
  }

  // 通用键值存储封装
  class KeyValueStore {
    constructor(storeName) {
      this.storeName = storeName;
    }

    async get(key, defaultValue = null) {
      const db = await openDB();
      if (!db) {
        try {
          const raw = localStorage.getItem(`${this.storeName}_${key}`);
          return raw !== null ? JSON.parse(raw) : defaultValue;
        } catch (e) {
          return defaultValue;
        }
      }

      return new Promise((resolve) => {
        try {
          const tx = db.transaction(this.storeName, "readonly");
          const store = tx.objectStore(this.storeName);
          const req = store.get(key);
          req.onsuccess = () => {
            if (req.result && req.result.value !== undefined) {
              resolve(req.result.value);
            } else {
              // 尝试从 localStorage 补充
              try {
                const raw = localStorage.getItem(`${this.storeName}_${key}`);
                resolve(raw !== null ? JSON.parse(raw) : defaultValue);
              } catch {
                resolve(defaultValue);
              }
            }
          };
          req.onerror = () => resolve(defaultValue);
        } catch (err) {
          resolve(defaultValue);
        }
      });
    }

    async set(key, value) {
      // 双重写入 localStorage 作为快速缓存
      try {
        localStorage.setItem(`${this.storeName}_${key}`, JSON.stringify(value));
      } catch (e) {}

      const db = await openDB();
      if (!db) return;

      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction(this.storeName, "readwrite");
          const store = tx.objectStore(this.storeName);
          store.put({ id: key, value: value, updatedAt: Date.now() });
          tx.oncomplete = () => resolve(true);
          tx.onerror = (e) => reject(e);
        } catch (err) {
          resolve(false);
        }
      });
    }

    async remove(key) {
      try {
        localStorage.removeItem(`${this.storeName}_${key}`);
      } catch (e) {}

      const db = await openDB();
      if (!db) return;

      return new Promise((resolve) => {
        try {
          const tx = db.transaction(this.storeName, "readwrite");
          const store = tx.objectStore(this.storeName);
          store.delete(key);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    }
  }

  // 暴露全局实例
  global.settingsStore = new KeyValueStore(STORES.SETTINGS);
  global.chatStore = new KeyValueStore(STORES.CHATS);
  global.calendarStore = {
    async getTasks() {
      const raw = localStorage.getItem("cached_calendar_tasks");
      if (raw) {
        try { return JSON.parse(raw); } catch (e) {}
      }
      return { 已毕之事: [], 进行之事: [], 未竟之事: [] };
    },
    async saveTasks(tasks) {
      localStorage.setItem("cached_calendar_tasks", JSON.stringify(tasks));
      await global.settingsStore.set("calendar_tasks", tasks);
    }
  };

  global.deliveryOrderStore = {
    async getOrders() {
      const raw = localStorage.getItem("tjc_delivery_orders");
      if (raw) {
        try { return JSON.parse(raw); } catch (e) {}
      }
      return [];
    },
    async addOrder(orderPayload) {
      const orders = await this.getOrders();
      const now = Date.now();
      const newOrder = {
        id: `TJC_${now}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        orderTime: now,
        estimatedDeliveryTime: now + (orderPayload.durationMinutes || 6) * 60 * 1000,
        rushCount: 0,
        ...orderPayload
      };
      orders.unshift(newOrder);
      localStorage.setItem("tjc_delivery_orders", JSON.stringify(orders));
      window.dispatchEvent(new CustomEvent("deliveryOrdersUpdated", { detail: orders }));
      return newOrder;
    }
  };

  console.log("[DB] IndexedDB & 本地存储层已成功初始化");
})(window);
