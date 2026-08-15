
      // IndexedDB 数据库配置
      const DB_NAME = "t8_chat_db";
      const DB_VERSION = 15; // 修改为15
      const STORES = {
        AVATARS: "avatars",
        USER_SETTINGS: "user_settings", // 存储用户设置，包括头像和背景
        CHAT_CHARACTERS: "chat_characters", // 存储聊天角色列表
        CHAT_HISTORY: "chat_history", // 存储聊天历史记录
        WORLD_BOOK: "world_book", // 存储世界书数据
        RELATIONSHIP: "relationship", // 存储关系数据
        CALENDAR: "calendar", // 存储日历任务
        DIARY: "diary", // 存储日记数据
        AREAS: "areas", // 存储区域数据
        BOOKS: "books", // 存储书籍元数据
        BOOK_CONTENTS: "book_contents", // 存储书籍全文内容
        MUSIC_PLAYLIST: "music_playlist", // 存储音乐列表
        EMOJIS: "emojis", // [新增] 存储用户自定义表情包
        BACKPACK: "backpack", // ✅ 新增：背包存储
        LOCKSCREEN: "lockscreen", // ✅ 新增：锁屏图片存储
      };

      // 打开数据库连接
      function openDB() {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(DB_NAME, DB_VERSION);

          request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // 创建头像存储
            if (!db.objectStoreNames.contains(STORES.AVATARS)) {
              db.createObjectStore(STORES.AVATARS, { keyPath: "id" });
            }

            // 创建日记存储
            if (!db.objectStoreNames.contains(STORES.DIARY)) {
              db.createObjectStore(STORES.DIARY, { keyPath: "id" });
            }

            // 创建用户设置存储
            if (!db.objectStoreNames.contains(STORES.USER_SETTINGS)) {
              db.createObjectStore(STORES.USER_SETTINGS, { keyPath: "key" });
            }

            // 创建聊天角色存储
            if (!db.objectStoreNames.contains(STORES.CHAT_CHARACTERS)) {
              db.createObjectStore(STORES.CHAT_CHARACTERS, { keyPath: "id" });
            }

            // 创建聊天历史存储
            if (!db.objectStoreNames.contains(STORES.CHAT_HISTORY)) {
              // 使用复合键：characterId + messageId，确保唯一性
              const historyStore = db.createObjectStore(STORES.CHAT_HISTORY, {
                keyPath: ["characterId", "id"],
              });
              // 创建索引，以便按角色ID查询
              historyStore.createIndex("by_character", "characterId", {
                unique: false,
              });
            }

            // 创建世界书存储
            if (!db.objectStoreNames.contains(STORES.WORLD_BOOK)) {
              db.createObjectStore(STORES.WORLD_BOOK, { keyPath: "id" });
            }

            // 创建关系数据存储
            if (!db.objectStoreNames.contains(STORES.RELATIONSHIP)) {
              db.createObjectStore(STORES.RELATIONSHIP, { keyPath: "id" });
            }

            // 创建日历任务存储
            if (!db.objectStoreNames.contains(STORES.CALENDAR)) {
              db.createObjectStore(STORES.CALENDAR, { keyPath: "id" });
            }

            // 创建区域数据存储
            if (!db.objectStoreNames.contains(STORES.AREAS)) {
              db.createObjectStore(STORES.AREAS, { keyPath: "id" });
            }

            // 创建书籍元数据存储
            if (!db.objectStoreNames.contains(STORES.BOOKS)) {
              db.createObjectStore(STORES.BOOKS, { keyPath: "id" });
            }

            // 创建书籍内容存储
            if (!db.objectStoreNames.contains(STORES.BOOK_CONTENTS)) {
              db.createObjectStore(STORES.BOOK_CONTENTS, { keyPath: "id" });
            }

            // 创建音乐列表存储
            if (!db.objectStoreNames.contains(STORES.MUSIC_PLAYLIST)) {
              db.createObjectStore(STORES.MUSIC_PLAYLIST, { keyPath: "id" });
            }

            // 创建表情包存储
            if (!db.objectStoreNames.contains(STORES.EMOJIS)) {
              db.createObjectStore(STORES.EMOJIS, { keyPath: "id" });
            }

            // ✅ 新增：创建背包存储
            if (!db.objectStoreNames.contains(STORES.BACKPACK)) {
              db.createObjectStore(STORES.BACKPACK, { keyPath: "id" });
            }

            // ✅ 新增：创建锁屏图片存储
            if (!db.objectStoreNames.contains(STORES.LOCKSCREEN)) {
              db.createObjectStore(STORES.LOCKSCREEN, { keyPath: "id" });
            }
          };

          request.onsuccess = (event) => {
            resolve(event.target.result);
          };

          request.onerror = (event) => {
            reject("数据库打开失败: " + event.target.error);
          };
        });
      }
      window.openDB = openDB;

      // 音乐存储操作对象
      const musicStore = {
        getAll: async () => {
          const db = await openDB();
          return new Promise((resolve) => {
            const tx = db.transaction(STORES.MUSIC_PLAYLIST, "readonly");
            const request = tx.objectStore(STORES.MUSIC_PLAYLIST).getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
          });
        },
        save: async (song) => {
          const db = await openDB();
          return new Promise((resolve) => {
            const tx = db.transaction(STORES.MUSIC_PLAYLIST, "readwrite");
            // 过滤掉内存链接(audioSrc)，仅存持久化数据
            const { audioSrc, ...dataToSave } = song;
            const request = tx
              .objectStore(STORES.MUSIC_PLAYLIST)
              .put(dataToSave);
            request.onsuccess = () => resolve(true);
          });
        },
        delete: async (id) => {
          const db = await openDB();
          return new Promise((resolve) => {
            const tx = db.transaction(STORES.MUSIC_PLAYLIST, "readwrite");
            const request = tx.objectStore(STORES.MUSIC_PLAYLIST).delete(id);
            request.onsuccess = () => resolve(true);
          });
        },
      };
      window.musicStore = musicStore; // 暴露给全局

      // [新增] 表情包存储操作对象
      const emojiStore = {
        getAll: async () => {
          const db = await openDB();
          return new Promise((resolve) => {
            const tx = db.transaction(STORES.EMOJIS, "readonly");
            const request = tx.objectStore(STORES.EMOJIS).getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
          });
        },
        save: async (emoji) => {
          const db = await openDB();
          return new Promise((resolve) => {
            const tx = db.transaction(STORES.EMOJIS, "readwrite");
            const request = tx.objectStore(STORES.EMOJIS).put(emoji);
            request.onsuccess = () => resolve(true);
          });
        },
        delete: async (id) => {
          const db = await openDB();
          return new Promise((resolve) => {
            const tx = db.transaction(STORES.EMOJIS, "readwrite");
            const request = tx.objectStore(STORES.EMOJIS).delete(id);
            request.onsuccess = () => resolve(true);
          });
        },
      };
      window.emojiStore = emojiStore; // 暴露给全局

      // ✅ 新增：背包存储操作对象
      const backpackStore = {
        getAll: async () => {
          const db = await openDB();
          return new Promise((resolve) => {
            const tx = db.transaction(STORES.BACKPACK, "readonly");
            const request = tx.objectStore(STORES.BACKPACK).getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
          });
        },
        addItems: async (items) => {
          const db = await openDB();
          return new Promise((resolve) => {
            const tx = db.transaction(STORES.BACKPACK, "readwrite");
            const store = tx.objectStore(STORES.BACKPACK);
            items.forEach((item) => {
              // 加上时间戳和唯一ID
              store.put({
                ...item,
                id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                acquiredAt: Date.now(),
              });
            });
            tx.oncomplete = () => resolve(true);
          });
        },
      };
      window.backpackStore = backpackStore;

      // ✅ 新增：锁屏图片存储操作对象
      const lockScreenStore = {
        getAll: async () => {
          const db = await openDB();
          return new Promise((resolve) => {
            const tx = db.transaction(STORES.LOCKSCREEN, "readonly");
            const request = tx.objectStore(STORES.LOCKSCREEN).getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
          });
        },
        save: async (image) => {
          const db = await openDB();
          return new Promise((resolve) => {
            const tx = db.transaction(STORES.LOCKSCREEN, "readwrite");
            const request = tx.objectStore(STORES.LOCKSCREEN).put(image);
            request.onsuccess = () => resolve(true);
          });
        },
        delete: async (id) => {
          const db = await openDB();
          return new Promise((resolve) => {
            const tx = db.transaction(STORES.LOCKSCREEN, "readwrite");
            const request = tx.objectStore(STORES.LOCKSCREEN).delete(id);
            request.onsuccess = () => resolve(true);
          });
        },
        clearAll: async () => {
          const db = await openDB();
          return new Promise((resolve) => {
            const tx = db.transaction(STORES.LOCKSCREEN, "readwrite");
            const request = tx.objectStore(STORES.LOCKSCREEN).clear();
            request.onsuccess = () => resolve(true);
          });
        }
      };
      window.lockScreenStore = lockScreenStore;

      // 检查并创建必要的存储（兼容旧版本）
      async function ensureStoresExist() {
        try {
          const db = await openDB();
          const storeNames = db.objectStoreNames;

          // 检查是否缺少必要的存储
          const missingStores = [];
          if (!storeNames.contains(STORES.BOOKS))
            missingStores.push(STORES.BOOKS);
          if (!storeNames.contains(STORES.BOOK_CONTENTS))
            missingStores.push(STORES.BOOK_CONTENTS);

          // 如果缺少存储，需要升级数据库
          if (missingStores.length > 0) {
            // 关闭当前连接
            db.close();
            // 增加版本号并重新打开数据库
            const newVersion = DB_VERSION + 1;
            return new Promise((resolve, reject) => {
              const upgradeRequest = indexedDB.open(DB_NAME, newVersion);
              upgradeRequest.onupgradeneeded = (event) => {
                const upgradeDb = event.target.result;
                // 创建缺少的存储
                if (!upgradeDb.objectStoreNames.contains(STORES.BOOKS)) {
                  upgradeDb.createObjectStore(STORES.BOOKS, { keyPath: "id" });
                }
                if (
                  !upgradeDb.objectStoreNames.contains(STORES.BOOK_CONTENTS)
                ) {
                  upgradeDb.createObjectStore(STORES.BOOK_CONTENTS, {
                    keyPath: "id",
                  });
                }
              };
              upgradeRequest.onsuccess = (event) => {
                resolve(event.target.result);
              };
              upgradeRequest.onerror = (event) => {
                reject("数据库升级失败: " + event.target.error);
              };
            });
          }
          return db;
        } catch (error) {
          console.error("检查存储失败:", error);
          // 不抛出错误，让调用者继续执行
          return null;
        }
      }

      // 头像存储操作
      const avatarStore = {
        // 获取头像
        get: async (id) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.AVATARS, "readonly");
            const store = transaction.objectStore(STORES.AVATARS);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("获取头像失败");
          });
        },

        // 保存头像
        put: async (id, avatarData) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.AVATARS, "readwrite");
            const store = transaction.objectStore(STORES.AVATARS);
            const request = store.put({ id, avatarData });

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("保存头像失败");
          });
        },

        // 删除头像
        delete: async (id) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.AVATARS, "readwrite");
            const store = transaction.objectStore(STORES.AVATARS);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject("删除头像失败");
          });
        },
      };

      // 用户设置存储操作（新增）
      const settingsStore = {
        // 获取用户头像
        getUserAvatar: async () => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(
              STORES.USER_SETTINGS,
              "readonly",
            );
            const store = transaction.objectStore(STORES.USER_SETTINGS);
            const request = store.get("user_avatar");

            request.onsuccess = () => resolve(request.result?.value || "");
            request.onerror = () => reject("获取用户头像失败");
          });
        },

        // 设置用户头像
        setUserAvatar: async (avatarData) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(
              STORES.USER_SETTINGS,
              "readwrite",
            );
            const store = transaction.objectStore(STORES.USER_SETTINGS);
            const request = store.put({
              key: "user_avatar",
              value: avatarData,
            });

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("保存用户头像失败");
          });
        },

        // 获取页面背景
        getPageBackground: async () => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(
              STORES.USER_SETTINGS,
              "readonly",
            );
            const store = transaction.objectStore(STORES.USER_SETTINGS);
            const request = store.get("page_background");

            request.onsuccess = () => resolve(request.result?.value || "");
            request.onerror = () => reject("获取页面背景失败");
          });
        },

        // 设置页面背景
        setPageBackground: async (backgroundData) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(
              STORES.USER_SETTINGS,
              "readwrite",
            );
            const store = transaction.objectStore(STORES.USER_SETTINGS);
            const request = store.put({
              key: "page_background",
              value: backgroundData,
            });

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("保存页面背景失败");
          });
        },

        // 获取木桩训练角色图片
        getJumpGameCharImage: async () => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.USER_SETTINGS, "readonly");
            const store = transaction.objectStore(STORES.USER_SETTINGS);
            const request = store.get("jumpgame_char_image");
            request.onsuccess = () => resolve(request.result?.value || "");
            request.onerror = () => reject("获取木桩训练角色图片失败");
          });
        },

        // 设置木桩训练角色图片
        setJumpGameCharImage: async (imageData) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.USER_SETTINGS, "readwrite");
            const store = transaction.objectStore(STORES.USER_SETTINGS);
            const request = store.put({ key: "jumpgame_char_image", value: imageData });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("保存木桩训练角色图片失败");
          });
        },

        // 获取木桩训练道具图片
        getJumpGameItemImage: async () => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.USER_SETTINGS, "readonly");
            const store = transaction.objectStore(STORES.USER_SETTINGS);
            const request = store.get("jumpgame_item_image");
            request.onsuccess = () => resolve(request.result?.value || "");
            request.onerror = () => reject("获取木桩训练道具图片失败");
          });
        },

        // 设置木桩训练道具图片
        setJumpGameItemImage: async (imageData) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.USER_SETTINGS, "readwrite");
            const store = transaction.objectStore(STORES.USER_SETTINGS);
            const request = store.put({ key: "jumpgame_item_image", value: imageData });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("保存木桩训练道具图片失败");
          });
        },

        // 获取蹴鞠训练角色头像
        getCujuGameAvatar: async () => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.USER_SETTINGS, "readonly");
            const store = transaction.objectStore(STORES.USER_SETTINGS);
            const request = store.get("cujugame_avatar_image");
            request.onsuccess = () => resolve(request.result?.value || "");
            request.onerror = () => reject("获取蹴鞠训练角色头像失败");
          });
        },

        // 设置蹴鞠训练角色头像
        setCujuGameAvatar: async (imageData) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.USER_SETTINGS, "readwrite");
            const store = transaction.objectStore(STORES.USER_SETTINGS);
            const request = store.put({ key: "cujugame_avatar_image", value: imageData });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("保存蹴鞠训练角色头像失败");
          });
        },

        // 获取射箭训练角色1图片
        getArcheryGameChar1Image: async () => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.USER_SETTINGS, "readonly");
            const store = transaction.objectStore(STORES.USER_SETTINGS);
            const request = store.get("archerygame_char1_image");
            request.onsuccess = () => resolve(request.result?.value || "");
            request.onerror = () => reject("获取射箭训练角色1图片失败");
          });
        },

        // 设置射箭训练角色1图片
        setArcheryGameChar1Image: async (imageData) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.USER_SETTINGS, "readwrite");
            const store = transaction.objectStore(STORES.USER_SETTINGS);
            const request = store.put({ key: "archerygame_char1_image", value: imageData });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("保存射箭训练角色1图片失败");
          });
        },

        // 获取射箭训练角色2图片
        getArcheryGameChar2Image: async () => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.USER_SETTINGS, "readonly");
            const store = transaction.objectStore(STORES.USER_SETTINGS);
            const request = store.get("archerygame_char2_image");
            request.onsuccess = () => resolve(request.result?.value || "");
            request.onerror = () => reject("获取射箭训练角色2图片失败");
          });
        },

        // 设置射箭训练角色2图片
        setArcheryGameChar2Image: async (imageData) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.USER_SETTINGS, "readwrite");
            const store = transaction.objectStore(STORES.USER_SETTINGS);
            const request = store.put({ key: "archerygame_char2_image", value: imageData });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("保存射箭训练角色2图片失败");
          });
        },

        // 获取划船训练角色1头像
        getRowingGameChar1Image: async () => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.USER_SETTINGS, "readonly");
            const store = transaction.objectStore(STORES.USER_SETTINGS);
            const request = store.get("rowinggame_char1_image");
            request.onsuccess = () => resolve(request.result?.value || "");
            request.onerror = () => reject("获取划船训练角色1头像失败");
          });
        },

        // 设置划船训练角色1头像
        setRowingGameChar1Image: async (imageData) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.USER_SETTINGS, "readwrite");
            const store = transaction.objectStore(STORES.USER_SETTINGS);
            const request = store.put({ key: "rowinggame_char1_image", value: imageData });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("保存划船训练角色1头像失败");
          });
        },

        // 获取划船训练角色2头像
        getRowingGameChar2Image: async () => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.USER_SETTINGS, "readonly");
            const store = transaction.objectStore(STORES.USER_SETTINGS);
            const request = store.get("rowinggame_char2_image");
            request.onsuccess = () => resolve(request.result?.value || "");
            request.onerror = () => reject("获取划船训练角色2头像失败");
          });
        },

        // 设置划船训练角色2头像
        setRowingGameChar2Image: async (imageData) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.USER_SETTINGS, "readwrite");
            const store = transaction.objectStore(STORES.USER_SETTINGS);
            const request = store.put({ key: "rowinggame_char2_image", value: imageData });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("保存划船训练角色2头像失败");
          });
        },

        // 获取音律训练角色弹奏图片 (Active)
        getMusicGameCharActiveImage: async () => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.USER_SETTINGS, "readonly");
            const store = transaction.objectStore(STORES.USER_SETTINGS);
            const request = store.get("musicgame_char_active_image");
            request.onsuccess = () => resolve(request.result?.value || "");
            request.onerror = () => reject("获取音律训练角色弹奏图片失败");
          });
        },

        // 设置音律训练角色弹奏图片 (Active)
        setMusicGameCharActiveImage: async (imageData) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.USER_SETTINGS, "readwrite");
            const store = transaction.objectStore(STORES.USER_SETTINGS);
            const request = store.put({ key: "musicgame_char_active_image", value: imageData });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("保存音律训练角色弹奏图片失败");
          });
        },

        // 获取音律训练角色待机图片 (Idle)
        getMusicGameCharIdleImage: async () => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.USER_SETTINGS, "readonly");
            const store = transaction.objectStore(STORES.USER_SETTINGS);
            const request = store.get("musicgame_char_idle_image");
            request.onsuccess = () => resolve(request.result?.value || "");
            request.onerror = () => reject("获取音律训练角色待机图片失败");
          });
        },

        // 设置音律训练角色待机图片 (Idle)
        setMusicGameCharIdleImage: async (imageData) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.USER_SETTINGS, "readwrite");
            const store = transaction.objectStore(STORES.USER_SETTINGS);
            const request = store.put({ key: "musicgame_char_idle_image", value: imageData });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("保存音律训练角色待机图片失败");
          });
        },
      };

      // 迁移用户数据从 localStorage 到 IndexedDB（新增）
      async function migrateUserData() {
        try {
          console.log("开始迁移用户数据...");

          // 迁移用户头像
          const userAvatar = localStorage.getItem("user_avatar");
          if (userAvatar) {
            await settingsStore.setUserAvatar(userAvatar);
            console.log("用户头像迁移成功");
          }

          // 迁移页面背景
          const pageBackground = localStorage.getItem("page_background");
          if (pageBackground) {
            await settingsStore.setPageBackground(pageBackground);
            console.log("页面背景迁移成功");
          }

          // 验证迁移结果
          const migratedAvatar = await settingsStore.getUserAvatar();
          const migratedBackground = await settingsStore.getPageBackground();

          console.log("迁移验证结果:");
          console.log("用户头像:", migratedAvatar ? "已迁移" : "无数据");
          console.log("页面背景:", migratedBackground ? "已迁移" : "无数据");

          // 清除 localStorage 中的旧数据
          localStorage.removeItem("user_avatar");
          localStorage.removeItem("page_background");
          console.log("localStorage 旧数据已清除");

          console.log("用户数据迁移完成");
          return true;
        } catch (error) {
          console.error("用户数据迁移失败:", error);
          return false;
        }
      }

      // 聊天角色存储操作
      const chatCharacterStore = {
        // 获取所有聊天角色
        getAll: async () => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(
              STORES.CHAT_CHARACTERS,
              "readonly",
            );
            const store = transaction.objectStore(STORES.CHAT_CHARACTERS);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("获取聊天角色失败");
          });
        },

        // 保存聊天角色
        save: async (character) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(
              STORES.CHAT_CHARACTERS,
              "readwrite",
            );
            const store = transaction.objectStore(STORES.CHAT_CHARACTERS);
            const request = store.put(character);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("保存聊天角色失败");
          });
        },

        // 批量保存聊天角色
        saveAll: async (characters) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(
              STORES.CHAT_CHARACTERS,
              "readwrite",
            );
            const store = transaction.objectStore(STORES.CHAT_CHARACTERS);

            let count = 0;
            let error = null;

            characters.forEach((character) => {
              const request = store.put(character);
              request.onsuccess = () => {
                count++;
                if (count === characters.length) {
                  if (error) {
                    reject(error);
                  } else {
                    resolve();
                  }
                }
              };
              request.onerror = () => {
                error = "批量保存聊天角色失败";
                count++;
                if (count === characters.length) {
                  reject(error);
                }
              };
            });
          });
        },

        // 删除聊天角色
        delete: async (id) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(
              STORES.CHAT_CHARACTERS,
              "readwrite",
            );
            const store = transaction.objectStore(STORES.CHAT_CHARACTERS);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject("删除聊天角色失败");
          });
        },
      };

      // 聊天历史存储操作
      const chatHistoryStore = {
        // 保存单条聊天消息
        saveMessage: async (characterId, message) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(
              STORES.CHAT_HISTORY,
              "readwrite",
            );
            const store = transaction.objectStore(STORES.CHAT_HISTORY);
            // 添加characterId到消息对象
            const messageWithCharacterId = {
              ...message,
              characterId,
            };
            const request = store.put(messageWithCharacterId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("保存聊天消息失败");
          });
        },

        // 批量保存聊天消息
        saveMessages: async (characterId, messages) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(
              STORES.CHAT_HISTORY,
              "readwrite",
            );
            const store = transaction.objectStore(STORES.CHAT_HISTORY);
            const index = store.index("by_character");
            const range = IDBKeyRange.only(characterId);

            // 1. 先删除该角色的所有旧消息
            const deleteRequest = index.openCursor(range);
            let deleteCount = 0;
            let deleteError = null;

            deleteRequest.onsuccess = (event) => {
              const cursor = event.target.result;
              if (cursor) {
                const deleteMsgRequest = cursor.delete();
                deleteMsgRequest.onsuccess = () => {
                  deleteCount++;
                  cursor.continue();
                };
                deleteMsgRequest.onerror = () => {
                  deleteError = "删除旧消息失败";
                  cursor.continue();
                };
              } else {
                // 2. 旧消息删除完成后，保存新消息
                let saveCount = 0;
                let saveError = null;

                messages.forEach((message) => {
                  const messageWithCharacterId = {
                    ...message,
                    characterId,
                  };
                  const request = store.put(messageWithCharacterId);
                  request.onsuccess = () => {
                    saveCount++;
                    if (saveCount === messages.length) {
                      if (deleteError || saveError) {
                        reject(deleteError || saveError);
                      } else {
                        resolve();
                      }
                    }
                  };
                  request.onerror = () => {
                    saveError = "批量保存聊天消息失败";
                    saveCount++;
                    if (saveCount === messages.length) {
                      reject(saveError);
                    }
                  };
                });
              }
            };

            deleteRequest.onerror = () => {
              reject("删除旧消息失败");
            };
          });
        },

        // 分页获取聊天历史
        getMessages: async (characterId, page = 1, pageSize = 50) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.CHAT_HISTORY, "readonly");
            const store = transaction.objectStore(STORES.CHAT_HISTORY);
            const index = store.index("by_character");
            const range = IDBKeyRange.only(characterId);

            // 先获取总数
            const countRequest = index.count(range);

            countRequest.onsuccess = () => {
              const totalCount = countRequest.result;
              const totalPages = Math.ceil(totalCount / pageSize);
              const offset = (page - 1) * pageSize;

              // 逆序获取（最新的消息在后面）
              const request = index.openCursor(range, "prev");
              const messages = [];
              let cursorCount = 0;

              request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && cursorCount < offset + pageSize) {
                  if (cursorCount >= offset) {
                    messages.unshift(cursor.value);
                  }
                  cursorCount++;
                  cursor.continue();
                } else {
                  resolve({
                    messages,
                    page,
                    pageSize,
                    totalCount,
                    totalPages,
                  });
                }
              };

              request.onerror = () => {
                reject("获取聊天历史失败");
              };
            };

            countRequest.onerror = () => {
              reject("获取聊天历史计数失败");
            };
          });
        },

        // 获取最近的聊天消息
        getRecentMessages: async (characterId, limit = 10) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.CHAT_HISTORY, "readonly");
            const store = transaction.objectStore(STORES.CHAT_HISTORY);
            const index = store.index("by_character");
            const range = IDBKeyRange.only(characterId);

            const request = index.openCursor(range, "prev");
            const messages = [];
            let count = 0;

            request.onsuccess = (event) => {
              const cursor = event.target.result;
              if (cursor && count < limit) {
                messages.unshift(cursor.value);
                count++;
                cursor.continue();
              } else {
                resolve(messages);
              }
            };

            request.onerror = () => {
              reject("获取最近聊天消息失败");
            };
          });
        },

        // 获取全部聊天历史
        getAll: async () => {
          const db = await openDB();
          return new Promise((resolve) => {
            const transaction = db.transaction(
              STORES.CHAT_HISTORY,
              "readonly",
            );
            const store = transaction.objectStore(STORES.CHAT_HISTORY);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
          });
        },

        // 获取聊天历史总数
        count: async () => {
          const db = await openDB();
          return new Promise((resolve) => {
            const transaction = db.transaction(
              STORES.CHAT_HISTORY,
              "readonly",
            );
            const store = transaction.objectStore(STORES.CHAT_HISTORY);
            const request = store.count();
            request.onsuccess = () => resolve(request.result || 0);
            request.onerror = () => resolve(0);
          });
        },

        // 删除聊天历史
        deleteMessages: async (characterId) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(
              STORES.CHAT_HISTORY,
              "readwrite",
            );
            const store = transaction.objectStore(STORES.CHAT_HISTORY);
            const index = store.index("by_character");
            const range = IDBKeyRange.only(characterId);

            const request = index.openCursor(range);

            request.onsuccess = (event) => {
              const cursor = event.target.result;
              if (cursor) {
                cursor.delete();
                cursor.continue();
              } else {
                resolve();
              }
            };

            request.onerror = () => {
              reject("删除聊天历史失败");
            };
          });
        },
      };

      // 迁移聊天数据从localStorage到IndexedDB
      async function migrateChatData() {
        try {
          console.log("开始迁移聊天数据...");

          // 迁移聊天角色列表
          const savedChats = localStorage.getItem("t8_chat_list");
          if (savedChats) {
            try {
              const characters = JSON.parse(savedChats);
              if (Array.isArray(characters) && characters.length > 0) {
                await chatCharacterStore.saveAll(characters);
                console.log(
                  "聊天角色列表迁移成功，共",
                  characters.length,
                  "个角色",
                );
              }
            } catch (e) {
              console.error("解析聊天角色列表失败:", e);
            }
          }

          // 迁移聊天历史记录
          const chatKeys = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("t8_history_")) {
              chatKeys.push(key);
            }
          }

          console.log("发现", chatKeys.length, "个聊天历史记录");

          for (const key of chatKeys) {
            try {
              const characterId = key.replace("t8_history_", "");
              const savedHistory = localStorage.getItem(key);
              if (savedHistory) {
                const messages = JSON.parse(savedHistory);
                if (Array.isArray(messages) && messages.length > 0) {
                  await chatHistoryStore.saveMessages(characterId, messages);
                  console.log(
                    "迁移聊天历史记录成功:",
                    characterId,
                    "共",
                    messages.length,
                    "条消息",
                  );
                }
              }
            } catch (e) {
              console.error("迁移聊天历史记录失败:", key, e);
            }
          }

          // 清除localStorage中的旧数据
          localStorage.removeItem("t8_chat_list");
          chatKeys.forEach((key) => localStorage.removeItem(key));
          console.log("localStorage中的旧聊天数据已清除");

          console.log("聊天数据迁移完成");
          return true;
        } catch (error) {
          console.error("迁移聊天数据失败:", error);
          return false;
        }
      }

      // 世界书存储操作
      const worldBookStore = {
        // 保存世界书数据
        saveData: async (data) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.WORLD_BOOK, "readwrite");
            const store = transaction.objectStore(STORES.WORLD_BOOK);
            const request = store.put({ id: "world_book_data", ...data });

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("保存世界书数据失败");
          });
        },

        // 获取世界书数据
        getData: async () => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.WORLD_BOOK, "readonly");
            const store = transaction.objectStore(STORES.WORLD_BOOK);
            const request = store.get("world_book_data");

            request.onsuccess = () => resolve(request.result || {});
            request.onerror = () => reject("获取世界书数据失败");
          });
        },

        // 删除世界书数据
        deleteData: async () => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.WORLD_BOOK, "readwrite");
            const store = transaction.objectStore(STORES.WORLD_BOOK);
            const request = store.delete("world_book_data");

            request.onsuccess = () => resolve();
            request.onerror = () => reject("删除世界书数据失败");
          });
        },
      };

      // 关系数据存储操作
      const relationshipStore = {
        // 保存关系数据
        saveData: async (data) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(
              STORES.RELATIONSHIP,
              "readwrite",
            );
            const store = transaction.objectStore(STORES.RELATIONSHIP);
            const request = store.put({ id: "relationship_data", ...data });

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("保存关系数据失败");
          });
        },

        // 获取关系数据
        getData: async () => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.RELATIONSHIP, "readonly");
            const store = transaction.objectStore(STORES.RELATIONSHIP);
            const request = store.get("relationship_data");

            request.onsuccess = () => resolve(request.result || {});
            request.onerror = () => reject("获取关系数据失败");
          });
        },

        // 删除关系数据
        deleteData: async () => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(
              STORES.RELATIONSHIP,
              "readwrite",
            );
            const store = transaction.objectStore(STORES.RELATIONSHIP);
            const request = store.delete("relationship_data");

            request.onsuccess = () => resolve();
            request.onerror = () => reject("删除关系数据失败");
          });
        },
      };

      // 日历任务存储操作
      const calendarStore = {
        // 保存日历任务
        saveTasks: async (tasks) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.CALENDAR, "readwrite");
            const store = transaction.objectStore(STORES.CALENDAR);
            const request = store.put({ id: "calendar_tasks", tasks });

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("保存日历任务失败");
          });
        },

        // 获取日历任务
        getTasks: async () => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.CALENDAR, "readonly");
            const store = transaction.objectStore(STORES.CALENDAR);
            const request = store.get("calendar_tasks");

            request.onsuccess = () => resolve(request.result?.tasks || {});
            request.onerror = () => reject("获取日历任务失败");
          });
        },

        // 删除日历任务
        deleteTasks: async () => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.CALENDAR, "readwrite");
            const store = transaction.objectStore(STORES.CALENDAR);
            const request = store.delete("calendar_tasks");

            request.onsuccess = () => resolve();
            request.onerror = () => reject("删除日历任务失败");
          });
        },
      };

      // 区域数据存储操作
      const areaStore = {
        // 保存选中区域
        saveSelectedArea: async (area) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.AREAS, "readwrite");
            const store = transaction.objectStore(STORES.AREAS);
            const request = store.put({ id: "selected_area", ...area });

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("保存选中区域失败");
          });
        },

        // 获取选中区域
        getSelectedArea: async () => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.AREAS, "readonly");
            const store = transaction.objectStore(STORES.AREAS);
            const request = store.get("selected_area");

            request.onsuccess = () => resolve(request.result || {});
            request.onerror = () => reject("获取选中区域失败");
          });
        },

        // 保存区域列表
        saveAreas: async (areas) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.AREAS, "readwrite");
            const store = transaction.objectStore(STORES.AREAS);
            const request = store.put({ id: "saved_areas", areas });

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("保存区域列表失败");
          });
        },

        // 获取区域列表
        getAreas: async () => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.AREAS, "readonly");
            const store = transaction.objectStore(STORES.AREAS);
            const request = store.get("saved_areas");

            request.onsuccess = () => resolve(request.result?.areas || []);
            request.onerror = () => reject("获取区域列表失败");
          });
        },

        // 删除区域数据
        deleteAreaData: async (id) => {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.AREAS, "readwrite");
            const store = transaction.objectStore(STORES.AREAS);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject("删除区域数据失败");
          });
        },
      };

      // 迁移大结构化数据从localStorage到IndexedDB
      async function migrateLargeData() {
        try {
          console.log("开始迁移大结构化数据...");

          // 迁移世界书数据
          const worldBookData = localStorage.getItem("world_book_data");
          if (worldBookData) {
            try {
              const data = JSON.parse(worldBookData);
              await worldBookStore.saveData(data);
              console.log("世界书数据迁移成功");
              localStorage.removeItem("world_book_data");
            } catch (e) {
              console.error("迁移世界书数据失败:", e);
            }
          }

          // 迁移关系数据
          const relationshipData = localStorage.getItem("relationship_data");
          if (relationshipData) {
            try {
              const data = JSON.parse(relationshipData);
              await relationshipStore.saveData(data);
              console.log("关系数据迁移成功");
              localStorage.removeItem("relationship_data");
            } catch (e) {
              console.error("迁移关系数据失败:", e);
            }
          }

          // 迁移日历任务
          const calendarTasks = localStorage.getItem("日历任务");
          if (calendarTasks) {
            try {
              const tasks = JSON.parse(calendarTasks);
              await calendarStore.saveTasks(tasks);
              console.log("日历任务迁移成功");
              localStorage.removeItem("日历任务");
            } catch (e) {
              console.error("迁移日历任务失败:", e);
            }
          }

          // 迁移选中区域
          const selectedAreaData = localStorage.getItem("selected_area");
          if (selectedAreaData) {
            try {
              const area = JSON.parse(selectedAreaData);
              await areaStore.saveSelectedArea(area);
              console.log("选中区域迁移成功");
              localStorage.removeItem("selected_area");
            } catch (e) {
              console.error("迁移选中区域失败:", e);
            }
          }

          // 迁移保存的区域列表
          const savedAreasData = localStorage.getItem("saved_areas");
          if (savedAreasData) {
            try {
              const areas = JSON.parse(savedAreasData);
              await areaStore.saveAreas(areas);
              console.log("保存的区域列表迁移成功");
              localStorage.removeItem("saved_areas");
            } catch (e) {
              console.error("迁移保存的区域列表失败:", e);
            }
          }

          console.log("大结构化数据迁移完成");
          return true;
        } catch (error) {
          console.error("迁移大结构化数据失败:", error);
          return false;
        }
      }

      // 书籍存储操作
      const bookStore = {
        // 获取所有书籍
        getAll: async () => {
          try {
            // 先检查并确保存储存在
            await ensureStoresExist();
            const db = await openDB();
            return new Promise((resolve, reject) => {
              try {
                const transaction = db.transaction(STORES.BOOKS, "readonly");
                const store = transaction.objectStore(STORES.BOOKS);
                const request = store.getAll();

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject("获取书籍失败");
              } catch (error) {
                console.error("事务或存储操作失败:", error);
                // 如果存储不存在，返回空数组
                resolve([]);
              }
            });
          } catch (error) {
            console.error("获取书籍时检查存储失败:", error);
            // 出错时返回空数组，避免React组件渲染失败
            return [];
          }
        },

        // 保存书籍
        save: async (book) => {
          try {
            await ensureStoresExist();
            const db = await openDB();
            return new Promise((resolve, reject) => {
              const transaction = db.transaction(STORES.BOOKS, "readwrite");
              const store = transaction.objectStore(STORES.BOOKS);
              const request = store.put(book);

              request.onsuccess = () => resolve(book);
              request.onerror = () => reject("保存书籍失败");
            });
          } catch (error) {
            console.error("保存书籍时检查存储失败:", error);
            throw error;
          }
        },

        // 保存所有书籍
        saveAll: async (books) => {
          try {
            await ensureStoresExist();
            const db = await openDB();
            return new Promise((resolve, reject) => {
              const transaction = db.transaction(STORES.BOOKS, "readwrite");
              const store = transaction.objectStore(STORES.BOOKS);

              let completed = 0;
              const total = books.length;

              books.forEach((book) => {
                const request = store.put(book);
                request.onsuccess = () => {
                  completed++;
                  if (completed === total) {
                    resolve(books);
                  }
                };
                request.onerror = () => {
                  reject("保存书籍失败");
                };
              });

              if (total === 0) {
                resolve([]);
              }
            });
          } catch (error) {
            console.error("保存所有书籍时检查存储失败:", error);
            throw error;
          }
        },

        // 删除书籍
        delete: async (bookId) => {
          try {
            await ensureStoresExist();
            const db = await openDB();
            return new Promise((resolve, reject) => {
              const transaction = db.transaction(STORES.BOOKS, "readwrite");
              const store = transaction.objectStore(STORES.BOOKS);
              const request = store.delete(bookId);

              request.onsuccess = () => resolve(true);
              request.onerror = () => reject("删除书籍失败");
            });
          } catch (error) {
            console.error("删除书籍时检查存储失败:", error);
            throw error;
          }
        },

        // 获取书籍内容
        getContent: async (bookId) => {
          try {
            await ensureStoresExist();
            const db = await openDB();
            return new Promise((resolve, reject) => {
              const transaction = db.transaction(
                STORES.BOOK_CONTENTS,
                "readonly",
              );
              const store = transaction.objectStore(STORES.BOOK_CONTENTS);
              const request = store.get(bookId);

              request.onsuccess = () =>
                resolve(request.result ? request.result.content : null);
              request.onerror = () => reject("获取书籍内容失败");
            });
          } catch (error) {
            console.error("获取书籍内容时检查存储失败:", error);
            throw error;
          }
        },

        // 保存书籍内容
        saveContent: async (bookId, content) => {
          try {
            await ensureStoresExist();
            const db = await openDB();
            return new Promise((resolve, reject) => {
              const transaction = db.transaction(
                STORES.BOOK_CONTENTS,
                "readwrite",
              );
              const store = transaction.objectStore(STORES.BOOK_CONTENTS);
              const request = store.put({ id: bookId, content });

              request.onsuccess = () => resolve(true);
              request.onerror = () => reject("保存书籍内容失败");
            });
          } catch (error) {
            console.error("保存书籍内容时检查存储失败:", error);
            throw error;
          }
        },

        // 删除书籍内容
        deleteContent: async (bookId) => {
          try {
            await ensureStoresExist();
            const db = await openDB();
            return new Promise((resolve, reject) => {
              const transaction = db.transaction(
                STORES.BOOK_CONTENTS,
                "readwrite",
              );
              const store = transaction.objectStore(STORES.BOOK_CONTENTS);
              const request = store.delete(bookId);

              request.onsuccess = () => resolve(true);
              request.onerror = () => reject("删除书籍内容失败");
            });
          } catch (error) {
            console.error("删除书籍内容时检查存储失败:", error);
            throw error;
          }
        },

        // 更新书籍进度
        updateProgress: async (bookId, progress) => {
          try {
            await ensureStoresExist();
            const db = await openDB();
            return new Promise((resolve, reject) => {
              const transaction = db.transaction(STORES.BOOKS, "readwrite");
              const store = transaction.objectStore(STORES.BOOKS);
              const getRequest = store.get(bookId);

              getRequest.onsuccess = () => {
                const book = getRequest.result;
                if (book) {
                  book.progress = progress;
                  const putRequest = store.put(book);
                  putRequest.onsuccess = () => resolve(book);
                  putRequest.onerror = () => reject("更新书籍进度失败");
                } else {
                  reject("书籍不存在");
                }
              };
              getRequest.onerror = () => reject("获取书籍失败");
            });
          } catch (error) {
            console.error("更新书籍进度时检查存储失败:", error);
            throw error;
          }
        },
      };

      // 迁移书籍数据
      async function migrateBookData() {
        try {
          console.log("开始迁移书籍数据...");

          // 1. 读取localStorage中的书籍元数据
          const savedMeta = localStorage.getItem("morandi_books_meta");
          if (savedMeta) {
            const books = JSON.parse(savedMeta);

            // 2. 保存书籍元数据到IndexedDB
            await bookStore.saveAll(books);
            console.log("书籍元数据迁移成功:", books.length, "本");

            // 3. 迁移书籍内容
            for (const book of books) {
              const contentKey = `book_content_${book.id}`;
              const content = localStorage.getItem(contentKey);
              if (content) {
                await bookStore.saveContent(book.id, content);
                console.log(`书籍内容迁移成功: ${book.title}`);
                // 清理localStorage中的内容
                localStorage.removeItem(contentKey);
              }
            }

            // 4. 清理localStorage中的元数据
            localStorage.removeItem("morandi_books_meta");
            console.log("书籍数据迁移完成");
            return true;
          } else {
            console.log("未找到localStorage中的书籍数据");
            return false;
          }
        } catch (error) {
          console.error("迁移书籍数据失败:", error);
          return false;
        }
      }

      // 全量导出备份数据 (IndexedDB + localStorage)
      async function exportAllDatabaseData() {
        try {
          const db = await openDB();
          const storeNames = Array.from(db.objectStoreNames);
          const indexedDBData = {};

          // 1. 导出 IndexedDB 所有 Store 数据
          for (const storeName of storeNames) {
            try {
              const records = await new Promise((resolve) => {
                const tx = db.transaction(storeName, "readonly");
                const store = tx.objectStore(storeName);
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
              });
              indexedDBData[storeName] = records;
            } catch (err) {
              console.warn(`导出 store [${storeName}] 异常:`, err);
              indexedDBData[storeName] = [];
            }
          }

          // 2. 导出 localStorage 全量键值
          const localStorageData = {};
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
              localStorageData[key] = localStorage.getItem(key);
            }
          }

          // 3. 打包元数据
          const backupPayload = {
            meta: {
              appName: "Milvus-Phone",
              version: "1.0",
              dbVersion: DB_VERSION,
              exportTime: new Date().toISOString(),
              timestamp: Date.now(),
              summary: {
                charactersCount: (indexedDBData[STORES.CHAT_CHARACTERS] || []).length,
                chatHistoryCount: (indexedDBData[STORES.CHAT_HISTORY] || []).length,
                avatarsCount: (indexedDBData[STORES.AVATARS] || []).length,
                worldBookCount: (indexedDBData[STORES.WORLD_BOOK] || []).length,
                backpackCount: (indexedDBData[STORES.BACKPACK] || []).length,
                localStorageKeysCount: Object.keys(localStorageData).length,
              },
            },
            localStorage: localStorageData,
            indexedDB: indexedDBData,
          };

          return backupPayload;
        } catch (error) {
          console.error("全量导出失败:", error);
          throw error;
        }
      }

      // 全量导入还原备份数据
      async function importAllDatabaseData(backupPayload, mode = "overwrite") {
        try {
          if (!backupPayload || typeof backupPayload !== "object") {
            throw new Error("无效的备份文件格式！");
          }

          const hasIndexedDB =
            backupPayload.indexedDB && typeof backupPayload.indexedDB === "object";
          const hasLocalStorage =
            backupPayload.localStorage &&
            typeof backupPayload.localStorage === "object";

          if (!hasIndexedDB && !hasLocalStorage) {
            throw new Error("备份文件中未包含有效的数据内容！");
          }

          // 1. 还原 localStorage
          if (hasLocalStorage) {
            if (mode === "overwrite") {
              localStorage.clear();
            }
            for (const [key, value] of Object.entries(backupPayload.localStorage)) {
              if (value !== null && value !== undefined) {
                localStorage.setItem(key, value);
              }
            }
          }

          // 2. 还原 IndexedDB
          if (hasIndexedDB) {
            const db = await openDB();
            for (const [storeName, records] of Object.entries(
              backupPayload.indexedDB,
            )) {
              if (
                !db.objectStoreNames.contains(storeName) ||
                !Array.isArray(records)
              ) {
                continue;
              }

              await new Promise((resolve) => {
                const tx = db.transaction(storeName, "readwrite");
                const store = tx.objectStore(storeName);

                if (mode === "overwrite") {
                  store.clear();
                }

                for (const item of records) {
                  try {
                    store.put(item);
                  } catch (e) {
                    console.warn(`写入 store [${storeName}] 记录失败:`, e, item);
                  }
                }

                tx.oncomplete = () => resolve();
                tx.onerror = (e) => {
                  console.error(`Store [${storeName}] 写入事务失败:`, e);
                  resolve();
                };
              });
            }
          }

          return {
            success: true,
            restoredStores: hasIndexedDB
              ? Object.keys(backupPayload.indexedDB).length
              : 0,
            restoredLocalStorageKeys: hasLocalStorage
              ? Object.keys(backupPayload.localStorage).length
              : 0,
          };
        } catch (error) {
          console.error("全量导入恢复失败:", error);
          throw error;
        }
      }

      // 暴露全局变量，确保在React组件中可用
      window.settingsStore = settingsStore;
      window.migrateUserData = migrateUserData;
      window.chatCharacterStore = chatCharacterStore;
      window.chatHistoryStore = chatHistoryStore;
      window.migrateChatData = migrateChatData;
      window.worldBookStore = worldBookStore;
      window.relationshipStore = relationshipStore;
      window.calendarStore = calendarStore;
      window.areaStore = areaStore;
      window.bookStore = bookStore;
      window.avatarStore = avatarStore;
      window.migrateBookData = migrateBookData;
      window.migrateLargeData = migrateLargeData;
      window.exportAllDatabaseData = exportAllDatabaseData;
      window.importAllDatabaseData = importAllDatabaseData;
    