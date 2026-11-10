/**
 * 心纸居 · 密探专属2.5D交互小房间系统 (高自由度建造大师版)
 * 具备特性：
 * 1. 贴图全异步存入 IndexedDB，避免 LocalStorage 容量超限
 * 2. 统一以家具底边水平接触线 (Foot Anchor Y) 深度排序，无错位穿透
 * 3. 真实家具底部 Collider 物理碰撞检测与沿体滑动
 * 4. 全家具/窗户/墙面更换贴图，并标注清晰的推荐尺寸与比例
 * 5. 虚拟摄像机：平滑 Lerp 跟随名士、移动端双指 Pinch 捏合缩放 (0.75x ~ 2.2x)、拖拽漫游
 * 6. 自由造景营造模式：家具库自由添加、拖拽摆放、镜像翻转、删除及专属持久化
 */
(function () {
  const { useState, useEffect, useRef } = React;

  // =========================================================================
  // 一、 IndexedDB 专属材质存储引擎
  // =========================================================================
  const IDB_NAME = "t8_agent_room_textures_db";
  const IDB_STORE = "textures";

  const openTextureDB = () => {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE, { keyPath: "key" });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    });
  };

  const getIDBTexture = async (key) => {
    const db = await openTextureDB();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, "readonly");
        const store = tx.objectStore(IDB_STORE);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  };

  const setIDBTexture = async (key, data) => {
    const db = await openTextureDB();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, "readwrite");
        const store = tx.objectStore(IDB_STORE);
        store.put({ key, data, updatedAt: Date.now() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  };

  const deleteIDBTexture = async (key) => {
    const db = await openTextureDB();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, "readwrite");
        const store = tx.objectStore(IDB_STORE);
        store.delete(key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  };

  // 内置4款汉韵古典地砖预设
  const BUILTIN_FLOORS = [
    {
      id: "wood",
      name: "楠木地板",
      desc: "温润沉稳，古朴雅致",
      icon: "🪵",
      plankH: 24,
      colors: ["#7A5835", "#6E4E2D", "#84613C", "#68482A"],
      lineColor: "#4A331C"
    },
    {
      id: "tatami",
      name: "素雅草席",
      desc: "天然织蔺，草香怡人",
      icon: "🌾",
      plankH: 20,
      colors: ["#C2B280", "#BAAB76", "#C8B988", "#B4A570"],
      lineColor: "#827546"
    },
    {
      id: "bamboo",
      name: "青竹凉席",
      desc: "初夏截竹，幽翠生凉",
      icon: "🎋",
      plankH: 18,
      colors: ["#7D8B69", "#72805E", "#889673", "#6A7756"],
      lineColor: "#4E593D"
    },
    {
      id: "slate",
      name: "汉白玉砖",
      desc: "温润如玉，清冷出尘",
      icon: "🏛️",
      plankH: 30,
      colors: ["#E3DFD5", "#DDD9CF", "#E8E4DA", "#D5D1C7"],
      lineColor: "#B5B0A4"
    }
  ];

  // =========================================================================
  // 二、 全家具元数据与推荐尺寸标尺库
  // =========================================================================
  const FURNITURE_DEFS = {
    tea_table: {
      type: "tea_table",
      name: "古雅茶案",
      icon: "🍵",
      w: 180,
      h: 100,
      footOffsetX: 10,
      footOffsetY: 45,
      footW: 160,
      footH: 50,
      recomSize: "360 × 200",
      recomRatio: "9:5",
      recomDesc: "推荐透明PNG。古雅茶盘、棋桌或小案几"
    },
    bed: {
      type: "bed",
      name: "罗汉软榻",
      icon: "🛏️",
      w: 165,
      h: 180,
      footOffsetX: 12,
      footOffsetY: 40,
      footW: 140,
      footH: 135,
      recomSize: "330 × 360",
      recomRatio: "11:12",
      recomDesc: "推荐透明PNG。雕花软榻、拔步床、贵妃榻"
    },
    censer: {
      type: "censer",
      name: "博山香炉",
      icon: "🪔",
      w: 70,
      h: 90,
      footOffsetX: 8,
      footOffsetY: 35,
      footW: 54,
      footH: 50,
      recomSize: "140 × 180",
      recomRatio: "7:9",
      recomDesc: "推荐透明PNG。博山炉、青瓷瓶、案头雅玩"
    },
    screen: {
      type: "screen",
      name: "四折屏风",
      icon: "🖼️",
      w: 125,
      h: 185,
      footOffsetX: 10,
      footOffsetY: 120,
      footW: 105,
      footH: 60,
      recomSize: "240 × 360",
      recomRatio: "2:3",
      recomDesc: "推荐透明PNG。水墨折叠屏风、轻纱隔断"
    },
    guqin_desk: {
      type: "guqin_desk",
      name: "幽谷琴案",
      icon: "🎼",
      w: 160,
      h: 90,
      footOffsetX: 10,
      footOffsetY: 40,
      footW: 140,
      footH: 45,
      recomSize: "320 × 180",
      recomRatio: "16:9",
      recomDesc: "推荐透明PNG。七弦古琴几案、画桌"
    },
    bookshelf: {
      type: "bookshelf",
      name: "藏书多宝阁",
      icon: "📚",
      w: 130,
      h: 175,
      footOffsetX: 10,
      footOffsetY: 85,
      footW: 110,
      footH: 85,
      recomSize: "260 × 340",
      recomRatio: "13:17",
      recomDesc: "推荐透明PNG。博古架、多宝阁、药书橱"
    },
    carpet: {
      type: "carpet",
      name: "织锦地毯",
      icon: "🧶",
      w: 220,
      h: 130,
      footOffsetX: 0,
      footOffsetY: 0,
      footW: 0, // 地毯不阻挡通行
      footH: 0,
      isFloorDeco: true,
      recomSize: "440 × 260",
      recomRatio: "17:10",
      recomDesc: "推荐透明PNG。名士蒲团、缠枝纹祥云织毯"
    }
  };

  // 背景贴图规范
  const BG_SPECS = {
    wall: {
      name: "素雅照壁 (墙壁)",
      recomSize: "1120 × 240",
      recomRatio: "14:3",
      recomDesc: "横版长条，推荐山水远峰、竹影、宣纸暗纹"
    },
    window: {
      name: "雕花窗棂 (窗景)",
      recomSize: "360 × 160",
      recomRatio: "9:4",
      recomDesc: "横版风景，推荐四时佳境、落樱、竹林、夜月"
    },
    floor: {
      name: "地砖材质 (平铺)",
      recomSize: "256 × 256",
      recomRatio: "1:1",
      recomDesc: "正方形无缝贴图，四方连续平铺纹理"
    }
  };

  // 默认初始家具阵容
  const createDefaultFurnitures = () => [
    {
      id: "f_censer",
      type: "censer",
      x: 135,
      y: 255,
      flipX: false,
      ...FURNITURE_DEFS.censer
    },
    {
      id: "f_table",
      type: "tea_table",
      x: 230,
      y: 285,
      flipX: false,
      ...FURNITURE_DEFS.tea_table
    },
    {
      id: "f_bed",
      type: "bed",
      x: 460,
      y: 240,
      flipX: false,
      ...FURNITURE_DEFS.bed
    }
  ];

  // =========================================================================
  // 三、 2.5D 密探专属雅居主模态组件
  // =========================================================================
  const Agent25DPrivateRoomModal = ({ char, onClose }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const textureInputRef = useRef(null);

    // 模式切换与UI状态
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedFurnitureId, setSelectedFurnitureId] = useState(null);
    const [showBuildDrawer, setShowBuildDrawer] = useState(false);
    const [showFloorDrawer, setShowFloorDrawer] = useState(false);
    const [textureTarget, setTextureTarget] = useState(null); // { key, name, recomSize, recomRatio, recomDesc }

    // 房间地板
    const [currentFloorId, setCurrentFloorId] = useState("wood");

    // 家具实体列表 (State + Ref 保证渲染循环中实时读取)
    const [furnitures, setFurnitures] = useState(() => createDefaultFurnitures());
    const furnituresRef = useRef(furnitures);
    furnituresRef.current = furnitures;

    // 内存贴图材质池 (key => Image)
    const texturePool = useRef(new Map());

    // 虚拟摄像机状态
    const camera = useRef({
      x: 380,
      y: 410,
      zoom: 1.0,
      isFollowing: true,
      lastPinchDist: 0,
      isPanning: false,
      panStartX: 0,
      panStartY: 0,
      camStartX: 380,
      camStartY: 410
    });

    // 房间几何尺寸 (画布逻辑分辨率 760 x 820)
    const ROOM = {
      x: 100,
      y: 130,
      w: 560,
      h: 460
    };

    // 1. 初始化读取房间配置与 IndexedDB 材质
    useEffect(() => {
      if (!char || !char.id) return;
      const charId = char.id;

      // 读取房间布局
      try {
        const savedLayout = JSON.parse(localStorage.getItem(`t8_room_layout_${charId}`) || "null");
        if (savedLayout && Array.isArray(savedLayout.furnitures) && savedLayout.furnitures.length > 0) {
          const loaded = savedLayout.furnitures.map((f) => {
            const def = FURNITURE_DEFS[f.type] || FURNITURE_DEFS.tea_table;
            return { ...def, ...f };
          });
          setFurnitures(loaded);
        } else {
          setFurnitures(createDefaultFurnitures());
        }
        if (savedLayout && savedLayout.floorId) {
          setCurrentFloorId(savedLayout.floorId);
        }
      } catch (e) {
        console.warn("[AgentRoom] 读取房间布局失败:", e);
      }

      // 异步读取 IndexedDB 贴图并存入材质池
      const loadTextures = async () => {
        const keysToLoad = [
          `tex_${charId}_wall`,
          `tex_${charId}_window`,
          `tex_${charId}_floor`
        ];
        // 家具贴图
        const savedLayout = JSON.parse(localStorage.getItem(`t8_room_layout_${charId}`) || "null");
        const list = (savedLayout && savedLayout.furnitures) ? savedLayout.furnitures : createDefaultFurnitures();
        list.forEach((f) => keysToLoad.push(`tex_${charId}_${f.id}`));

        for (const k of keysToLoad) {
          const dataUrl = await getIDBTexture(k);
          if (dataUrl && typeof dataUrl === "string") {
            const img = new Image();
            img.src = dataUrl;
            img.onload = () => {
              texturePool.current.set(k, img);
            };
          }
        }
      };
      loadTextures();
    }, [char?.id]);

    // 保存布局至 localStorage
    const saveLayout = (newList, floorId) => {
      if (!char || !char.id) return;
      try {
        const data = {
          floorId: floorId || currentFloorId,
          furnitures: newList.map((f) => ({
            id: f.id,
            type: f.type,
            x: Math.round(f.x),
            y: Math.round(f.y),
            flipX: Boolean(f.flipX)
          })),
          updatedAt: Date.now()
        };
        localStorage.setItem(`t8_room_layout_${char.id}`, JSON.stringify(data));
      } catch (e) {
        console.warn("[AgentRoom] 保存布局失败:", e);
      }
    };

    // 2. 贴图上传处理 (写入 IndexedDB)
    const handleTextureUpload = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file || !textureTarget || !char) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target.result;
        const key = textureTarget.key;

        // 存入 IndexedDB
        await setIDBTexture(key, base64);

        // 缓存到内存 Image
        const img = new Image();
        img.src = base64;
        img.onload = () => {
          texturePool.current.set(key, img);
          if (textureTarget.type === "floor") {
            setCurrentFloorId("custom");
            saveLayout(furnituresRef.current, "custom");
          }
        };
        setTextureTarget(null);
      };
      reader.readAsDataURL(file);
    };

    // 恢复默认贴图 (从 IndexedDB 移除)
    const handleResetTexture = async () => {
      if (!textureTarget) return;
      await deleteIDBTexture(textureTarget.key);
      texturePool.current.delete(textureTarget.key);
      if (textureTarget.type === "floor") {
        setCurrentFloorId("wood");
        saveLayout(furnituresRef.current, "wood");
      }
      setTextureTarget(null);
    };

    // 3. 核心物理、碰撞、寻路与渲染主循环
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");

      let animationFrameId;
      let isRunning = true;

      // 预载名士立绘小人
      let avatarImg = null;
      let spriteUrl = (char && char.image) ? char.image : null;
      if (!spriteUrl && char && char.id) {
        try {
          const customMap = JSON.parse(localStorage.getItem("t8_mansion_custom_avatars") || "{}");
          if (customMap[char.id] && customMap[char.id].length > 0) {
            spriteUrl = customMap[char.id][0];
          }
        } catch (e) {}
      }
      if (!spriteUrl && char) {
        spriteUrl = char.avatar || char.avatarId || null;
      }
      if (spriteUrl && typeof spriteUrl === "object") {
        spriteUrl = spriteUrl.url || spriteUrl.src || spriteUrl.id || null;
      }

      if (spriteUrl) {
        const loadImg = (url) => {
          if (!url || typeof url !== "string") return;
          const img = new Image();
          img.src = url;
          img.onload = () => { avatarImg = img; };
        };

        const isDirectUrl = typeof spriteUrl === "string" && (
          spriteUrl.startsWith("data:") ||
          spriteUrl.startsWith("http://") ||
          spriteUrl.startsWith("https://") ||
          spriteUrl.startsWith("./") ||
          spriteUrl.startsWith("/") ||
          spriteUrl.startsWith("blob:")
        );

        if (isDirectUrl) {
          loadImg(spriteUrl);
        } else if (typeof window.resolveAvatarUrl === "function") {
          Promise.resolve(window.resolveAvatarUrl(spriteUrl, ""))
            .then((res) => {
              if (res) loadImg(res);
              else if (typeof spriteUrl === "string") loadImg(spriteUrl);
            })
            .catch(() => {
              if (typeof spriteUrl === "string") loadImg(spriteUrl);
            });
        } else if (typeof spriteUrl === "string") {
          loadImg(spriteUrl);
        }
      }

      // 香炉青烟粒子
      const roomParticles = {
        censerLit: true,
        smoke: []
      };

      // 名士实体
      const player = {
        x: 380,
        y: 400,
        targetX: null,
        targetY: null,
        speed: 185,
        facing: 1,
        isMoving: false,
        walkCycle: 0,
        pose: "idle",
        bubbleText: `楼主，欢迎造访我的雅室~ ✨`,
        bubbleTimer: 4.0
      };

      const say = (text, duration = 3.5) => {
        player.bubbleText = text;
        player.bubbleTimer = duration;
      };

      // 辅助画圆角矩形
      const drawRoundedRect = (x, y, w, h, r, fill, stroke = null, lineWidth = 2) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fill();
        }
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = lineWidth;
          ctx.stroke();
        }
      };

      // 碰撞检测算法：检测坐标 (px, py) 是否与房间墙壁或任意家具阻挡体重叠
      const checkCollision = (px, py) => {
        // 1. 房间边界
        const minX = ROOM.x + 30;
        const maxX = ROOM.x + ROOM.w - 30;
        const minY = ROOM.y + 135;
        const maxY = ROOM.y + ROOM.h - 22;
        if (px < minX || px > maxX || py < minY || py > maxY) return true;

        // 2. 名士底部占地包围盒 (约 34 x 16 px)
        const pBox = { x: px - 17, y: py - 9, w: 34, h: 18 };

        // 3. 遍历各家具底部 Collider
        for (const item of furnituresRef.current) {
          if (item.footW <= 0 || item.footH <= 0) continue; // 地毯等地物不阻挡通行
          const fBox = {
            x: item.x + item.footOffsetX,
            y: item.y + item.footOffsetY,
            w: item.footW,
            h: item.footH
          };
          if (
            pBox.x < fBox.x + fBox.w &&
            pBox.x + pBox.w > fBox.x &&
            pBox.y < fBox.y + fBox.h &&
            pBox.y + pBox.h > fBox.y
          ) {
            return true;
          }
        }
        return false;
      };

      // 绘制房间底座与背景（墙面、窗景、地板）
      const drawRoomBackground = (now) => {
        // 房间外深色环境
        ctx.fillStyle = "#1E1814";
        ctx.fillRect(-200, -200, canvas.width + 400, canvas.height + 400);

        // 房间古木框架外壳
        drawRoundedRect(ROOM.x - 12, ROOM.y - 12, ROOM.w + 24, ROOM.h + 24, 20, "#543C28", "#332114", 4);
        drawRoundedRect(ROOM.x + 6, ROOM.y + 6, ROOM.w - 12, ROOM.h - 12, 10, "#E8DFD0", "#3E2919", 3);

        // 照壁墙面 (支持自定义贴图)
        const wallKey = `tex_${char?.id}_wall`;
        const customWallImg = texturePool.current.get(wallKey);
        const wallX = ROOM.x + 6;
        const wallY = ROOM.y + 6;
        const wallW = ROOM.w - 12;
        const wallH = 118;

        if (customWallImg) {
          ctx.save();
          drawRoundedRect(wallX, wallY, wallW, wallH, 6, null, "#6E5034", 2);
          ctx.clip();
          ctx.drawImage(customWallImg, wallX, wallY, wallW, wallH);
          ctx.restore();
        } else {
          drawRoundedRect(wallX, wallY, wallW, wallH, 6, "#E5DAC8", "#6E5034", 2);
        }

        // 雕花窗棂与窗景 (支持自定义贴图)
        const winKey = `tex_${char?.id}_window`;
        const customWinImg = texturePool.current.get(winKey);
        const winX = ROOM.x + 230;
        const winY = ROOM.y + 16;
        const winW = 180;
        const winH = 80;

        if (customWinImg) {
          ctx.save();
          drawRoundedRect(winX, winY, winW, winH, 4, null, "#5C3E25", 3);
          ctx.clip();
          ctx.drawImage(customWinImg, winX, winY, winW, winH);
          ctx.restore();
        } else {
          drawRoundedRect(winX, winY, winW, winH, 4, "#F4EDE1", "#5C3E25", 3);
          // 默认窗格横竖条纹
          ctx.strokeStyle = "#805835";
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 1; i <= 5; i++) {
            const sx = winX + (winW / 6) * i;
            ctx.moveTo(sx, winY);
            ctx.lineTo(sx, winY + winH);
          }
          ctx.moveTo(winX, winY + winH / 2);
          ctx.lineTo(winX + winW, winY + winH / 2);
          ctx.stroke();
        }

        // 窗外晨曦微光投射斜光束
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(winX, winY + winH);
        ctx.lineTo(winX + winW, winY + winH);
        ctx.lineTo(winX + winW + 110, ROOM.y + ROOM.h - 40);
        ctx.lineTo(winX - 60, ROOM.y + ROOM.h - 40);
        ctx.closePath();
        const sunGrad = ctx.createLinearGradient(winX, winY, winX + 80, ROOM.y + ROOM.h);
        sunGrad.addColorStop(0, "rgba(255, 248, 220, 0.2)");
        sunGrad.addColorStop(1, "rgba(255, 240, 190, 0.02)");
        ctx.fillStyle = sunGrad;
        ctx.fill();
        ctx.restore();

        // 地板层绘制
        const floorTop = ROOM.y + 120;
        const floorBottom = ROOM.y + ROOM.h - 6;
        const floorLeft = ROOM.x + 6;
        const floorRight = ROOM.x + ROOM.w - 6;

        ctx.save();
        ctx.beginPath();
        ctx.rect(floorLeft, floorTop, floorRight - floorLeft, floorBottom - floorTop);
        ctx.clip();

        const customFloorImg = texturePool.current.get(`tex_${char?.id}_floor`);
        if (customFloorImg && currentFloorId === "custom") {
          try {
            const pattern = ctx.createPattern(customFloorImg, "repeat");
            ctx.fillStyle = pattern;
            ctx.fillRect(floorLeft, floorTop, floorRight - floorLeft, floorBottom - floorTop);
          } catch (e) {
            ctx.drawImage(customFloorImg, floorLeft, floorTop, floorRight - floorLeft, floorBottom - floorTop);
          }
        } else {
          const activeFloorDef = BUILTIN_FLOORS.find((f) => f.id === currentFloorId) || BUILTIN_FLOORS[0];
          const plankH = activeFloorDef.plankH || 24;
          let row = 0;
          for (let py = floorTop; py < floorBottom; py += plankH) {
            ctx.fillStyle = activeFloorDef.colors[row % activeFloorDef.colors.length];
            ctx.fillRect(floorLeft, py, floorRight - floorLeft, plankH);

            ctx.beginPath();
            ctx.moveTo(floorLeft, py);
            ctx.lineTo(floorRight, py);
            ctx.strokeStyle = activeFloorDef.lineColor || "#3F2C18";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            const stagger = (row % 2) * 65;
            for (let px = floorLeft + stagger; px < floorRight; px += 130) {
              ctx.beginPath();
              ctx.moveTo(px, py);
              ctx.lineTo(px, Math.min(py + plankH, floorBottom));
              ctx.stroke();
            }
            row++;
          }
        }
        ctx.restore();
      };

      // 单个家具实体渲染器 (支持自定义贴图与默认原画备选)
      const renderFurnitureEntity = (item) => {
        const customImg = texturePool.current.get(`tex_${char?.id}_${item.id}`);

        ctx.save();
        ctx.translate(item.x, item.y);
        if (item.flipX) {
          ctx.translate(item.w, 0);
          ctx.scale(-1, 1);
        }

        // 若拥有自定义贴图，优先渲染用户上传材质
        if (customImg) {
          ctx.drawImage(customImg, 0, 0, item.w, item.h);
        } else {
          // 默认古风原画渲染
          switch (item.type) {
            case "tea_table": {
              // 古雅茶案
              ctx.fillStyle = "rgba(40, 25, 15, 0.25)";
              ctx.beginPath();
              ctx.ellipse(item.w / 2, item.h - 4, item.w / 2 + 6, 14, 0, 0, Math.PI * 2);
              ctx.fill();
              drawRoundedRect(0, 5, item.w, item.h - 10, 6, "#4D341E", "#2A190C", 2.8);
              drawRoundedRect(6, 11, item.w - 12, item.h - 22, 4, "#5E4026", "#3A2312", 1.8);
              drawRoundedRect(50, 26, 24, 20, 6, "#8F6443", "#3C2413", 1.8);
              drawRoundedRect(88, 30, 14, 14, 4, "#F0EAE1", "#5C4129", 1.5);
              drawRoundedRect(110, 30, 14, 14, 4, "#F0EAE1", "#5C4129", 1.5);
              break;
            }
            case "bed": {
              // 罗汉软榻
              drawRoundedRect(0, 0, item.w, item.h, 8, "#6B492B", "#382312", 3);
              drawRoundedRect(8, 16, item.w - 16, item.h - 24, 6, "#E8DFC8", "#8F7556", 2);
              drawRoundedRect(item.w - 48, 24, 36, 26, 6, "#C77D58", "#7A4628", 2);
              break;
            }
            case "censer": {
              // 博山香炉
              drawRoundedRect(2, 38, 44, 20, 4, "#5A3D28", "#332114", 2);
              drawRoundedRect(8, 14, 32, 26, 6, "#B59458", "#61481E", 2.5);
              drawRoundedRect(16, 4, 16, 12, 4, "#D4B372", "#61481E", 2);
              break;
            }
            case "screen": {
              // 四折屏风
              drawRoundedRect(0, 0, item.w, item.h, 4, "rgba(240, 235, 225, 0.92)", "#6E4E2D", 2.5);
              for (let i = 1; i <= 3; i++) {
                ctx.beginPath();
                ctx.moveTo((item.w / 4) * i, 0);
                ctx.lineTo((item.w / 4) * i, item.h);
                ctx.strokeStyle = "#8B653B";
                ctx.lineWidth = 1.8;
                ctx.stroke();
              }
              break;
            }
            case "guqin_desk": {
              // 幽谷琴案
              drawRoundedRect(0, 10, item.w, item.h - 20, 6, "#4A321E", "#28170B", 2.5);
              drawRoundedRect(24, 25, 112, 18, 4, "#2C1B10", "#8F6443", 1.5);
              break;
            }
            case "bookshelf": {
              // 藏书多宝阁
              drawRoundedRect(0, 0, item.w, item.h, 4, "#583C25", "#322012", 3);
              drawRoundedRect(8, 12, item.w - 16, 45, 2, "#EDE2D0", "#8F6E4C", 1.5);
              drawRoundedRect(8, 65, item.w - 16, 45, 2, "#EDE2D0", "#8F6E4C", 1.5);
              break;
            }
            case "carpet": {
              // 织锦地毯
              drawRoundedRect(0, 0, item.w, item.h, 16, "rgba(214, 114, 75, 0.45)", "#9C4E2B", 2);
              drawRoundedRect(8, 8, item.w - 16, item.h - 16, 10, "rgba(248, 238, 222, 0.55)", "#B8734A", 1.5);
              break;
            }
            default: {
              drawRoundedRect(0, 0, item.w, item.h, 6, "#8B6A48", "#4A321C", 2);
            }
          }
        }

        ctx.restore();

        // 香炉青烟粒子
        if (item.type === "censer" && roomParticles.censerLit) {
          if (Math.random() < 0.35) {
            roomParticles.smoke.push({
              x: item.x + 24 + (Math.random() * 4 - 2),
              y: item.y + 4,
              vx: (Math.random() - 0.5) * 0.4,
              vy: -(0.6 + Math.random() * 0.5),
              alpha: 0.55,
              r: 2.5 + Math.random() * 2
            });
          }
        }

        // 建造模式下：被选中的家具显示高亮发光包围盒与微操角标
        if (isEditMode && selectedFurnitureId === item.id) {
          ctx.save();
          ctx.strokeStyle = "#D6724B";
          ctx.lineWidth = 2.5;
          ctx.setLineDash([5, 4]);
          ctx.strokeRect(item.x - 3, item.y - 3, item.w + 6, item.h + 6);
          ctx.setLineDash([]);

          // 1. 左上角：删除红色圆钮
          ctx.fillStyle = "#E04838";
          ctx.beginPath();
          ctx.arc(item.x - 4, item.y - 4, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.font = "bold 12px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("✕", item.x - 4, item.y - 4);

          // 2. 右上角：镜像翻转蓝色圆钮
          ctx.fillStyle = "#3B82F6";
          ctx.beginPath();
          ctx.arc(item.x + item.w + 4, item.y - 4, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.fillText("⇄", item.x + item.w + 4, item.y - 4);

          // 3. 左下角：换贴图橙色圆钮
          ctx.fillStyle = "#D97706";
          ctx.beginPath();
          ctx.arc(item.x - 4, item.y + item.h + 4, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.font = "bold 10px sans-serif";
          ctx.fillText("🎨", item.x - 4, item.y + item.h + 4);

          ctx.restore();
        }
      };

      // 绘制纯净名士小人 (无多余块状物，大号饱满清晰)
      const drawCharacter = (now) => {
        const pX = player.x;
        const pY = player.y;

        const targetH = 98;
        let drawW = 86;
        let drawH = targetH;
        if (avatarImg && avatarImg.width && avatarImg.height) {
          const aspect = avatarImg.width / avatarImg.height;
          drawW = Math.round(Math.min(115, Math.max(55, targetH * aspect)));
        }

        if (player.pose === "sleeping_bed") {
          ctx.save();
          ctx.translate(pX, pY);
          if (avatarImg) {
            ctx.save();
            ctx.globalAlpha = 0.95;
            ctx.drawImage(avatarImg, -drawW * 0.35, -drawH * 0.45, drawW * 0.72, drawH * 0.72);
            ctx.restore();
          }
          drawRoundedRect(-24, 0, 72, 36, 10, "rgba(214, 114, 75, 0.9)", "#8F4826", 2);
          ctx.fillStyle = "#F5EFE6";
          ctx.font = "bold 13px sans-serif";
          ctx.fillText("Zzz...", 54, -2);
          ctx.restore();
          return;
        }

        // 脚底自然柔和投影
        ctx.fillStyle = "rgba(40, 25, 15, 0.28)";
        ctx.beginPath();
        ctx.ellipse(pX, pY + 2, Math.max(22, drawW * 0.32), 7, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(pX, pY);

        if (player.facing === -1) {
          ctx.scale(-1, 1);
        }

        const bob = player.isMoving ? Math.sin(player.walkCycle * 9) * 3.5 : 0;

        if (avatarImg) {
          ctx.drawImage(avatarImg, -drawW / 2, -drawH + bob, drawW, drawH);
        } else {
          ctx.save();
          drawRoundedRect(-36, -72 + bob, 72, 72, 36, "#EAD7C2", "#8B6544", 2.5);
          ctx.fillStyle = "#5C4129";
          ctx.font = "bold 24px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText((char.name || "名")[0], 0, -36 + bob);
          ctx.restore();
        }

        ctx.restore();

        // 头顶气泡对白
        if (player.bubbleText && player.bubbleTimer > 0) {
          ctx.save();
          ctx.font = "bold 12.5px sans-serif";
          const tw = ctx.measureText(player.bubbleText).width;
          const bw = Math.max(76, tw + 22);
          const bx = pX - bw / 2;
          const by = pY - drawH - 18 + bob;

          drawRoundedRect(bx, by, bw, 28, 14, "#FFFBF2", "#8F6443", 1.8);
          ctx.beginPath();
          ctx.moveTo(pX - 4, by + 28);
          ctx.lineTo(pX, by + 34);
          ctx.lineTo(pX + 4, by + 28);
          ctx.fillStyle = "#FFFBF2";
          ctx.fill();
          ctx.strokeStyle = "#8F6443";
          ctx.stroke();

          ctx.fillStyle = "#5A3A1F";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(player.bubbleText, pX, by + 14);
          ctx.restore();
        }
      };

      // 4. 游戏动力学更新主循环
      let lastTime = performance.now();
      const gameLoop = (currentTime) => {
        if (!isRunning) return;
        const dt = Math.min((currentTime - lastTime) / 1000, 0.08);
        lastTime = currentTime;

        // 更新青烟粒子
        roomParticles.smoke.forEach((s) => {
          s.x += s.vx;
          s.y += s.vy;
          s.alpha -= dt * 0.18;
          s.r += dt * 1.5;
        });
        roomParticles.smoke = roomParticles.smoke.filter((s) => s.alpha > 0.02);

        if (player.bubbleTimer > 0) {
          player.bubbleTimer -= dt;
        }

        // 虚拟摄像机平滑跟随 (Lerp)
        const cam = camera.current;
        if (cam.isFollowing && !isEditMode) {
          cam.x += (player.x - cam.x) * 0.08;
          cam.y += (player.y - cam.y) * 0.08;
        }

        // 名士步进移动与滑动碰撞物理
        if (!isEditMode && player.targetX !== null && player.targetY !== null) {
          const dx = player.targetX - player.x;
          const dy = player.targetY - player.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 3) {
            player.isMoving = true;
            player.facing = dx >= 0 ? 1 : -1;
            player.walkCycle += dt;
            const step = player.speed * dt;
            const moveX = (dx / dist) * Math.min(step, dist);
            const moveY = (dy / dist) * Math.min(step, dist);

            // 优先双轴前进
            if (!checkCollision(player.x + moveX, player.y + moveY)) {
              player.x += moveX;
              player.y += moveY;
            } else if (!checkCollision(player.x + moveX, player.y)) {
              // X轴切向滑动
              player.x += moveX;
            } else if (!checkCollision(player.x, player.y + moveY)) {
              // Y轴切向滑动
              player.y += moveY;
            } else {
              // 彻底卡住阻挡
              player.targetX = null;
              player.targetY = null;
              player.isMoving = false;
            }
          } else {
            player.x = player.targetX;
            player.y = player.targetY;
            player.targetX = null;
            player.targetY = null;
            player.isMoving = false;
          }
        } else if (!isEditMode) {
          player.isMoving = false;
        }

        // 清空画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 应用虚拟摄像机视口变换矩阵 (平移 + 双指捏合缩放)
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(cam.zoom, cam.zoom);
        ctx.translate(-cam.x, -cam.y);

        // 绘制房间底座与背景
        drawRoomBackground(currentTime);

        // =====================================================================
        // 关键准则：统一采用家具底边水平接触线 (Foot Anchor Y) 深度排序渲染
        // =====================================================================
        const renderQueue = [];

        // 1. 压入所有家具
        furnituresRef.current.forEach((item) => {
          // 地毯作为地面装饰，排在所有立面家具下方
          const footAnchorY = item.isFloorDeco
            ? item.y - 1000
            : item.y + (item.footOffsetY || 0) + (item.footH || item.h);

          renderQueue.push({
            anchorY: footAnchorY,
            draw: () => renderFurnitureEntity(item)
          });
        });

        // 2. 压入名士小人实体 (以其脚底地面接触线作为基准)
        renderQueue.push({
          anchorY: player.y,
          draw: () => drawCharacter(currentTime)
        });

        // 3. 升序执行深度排序，从深至浅依次绘制
        renderQueue.sort((a, b) => a.anchorY - b.anchorY);
        renderQueue.forEach((entity) => entity.draw());

        // 绘制青烟
        roomParticles.smoke.forEach((s) => {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(220, 215, 205, ${s.alpha})`;
          ctx.fill();
        });

        ctx.restore();

        animationFrameId = requestAnimationFrame(gameLoop);
      };

      animationFrameId = requestAnimationFrame(gameLoop);

      // 5. 手势交互监听：移动端双指 Pinch 缩放、单指拖拽视口与家具微操
      let dragFurnitureItem = null;
      let dragOffset = { x: 0, y: 0 };

      // 将屏幕坐标转换至世界坐标
      const toWorldCoords = (clientX, clientY) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clickX = (clientX - rect.left) * scaleX;
        const clickY = (clientY - rect.top) * scaleY;
        const cam = camera.current;
        const worldX = cam.x + (clickX - canvas.width / 2) / cam.zoom;
        const worldY = cam.y + (clickY - canvas.height / 2) / cam.zoom;
        return { worldX, worldY, screenX: clickX, screenY: clickY };
      };

      const handlePointerDown = (e) => {
        const cam = camera.current;
        // 双指触控缩放初始化
        if (e.touches && e.touches.length === 2) {
          cam.lastPinchDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          cam.isFollowing = false;
          return;
        }

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const { worldX, worldY } = toWorldCoords(clientX, clientY);

        // A. 建造编辑模式下的交互
        if (isEditMode) {
          // 检查是否点击当前选中家具的微操角标
          if (selectedFurnitureId) {
            const activeF = furnituresRef.current.find((f) => f.id === selectedFurnitureId);
            if (activeF) {
              // 1. 删除角标 (左上角)
              if (Math.hypot(worldX - (activeF.x - 4), worldY - (activeF.y - 4)) < 16) {
                const nextList = furnituresRef.current.filter((f) => f.id !== selectedFurnitureId);
                setFurnitures(nextList);
                saveLayout(nextList);
                setSelectedFurnitureId(null);
                return;
              }
              // 2. 翻转角标 (右上角)
              if (Math.hypot(worldX - (activeF.x + activeF.w + 4), worldY - (activeF.y - 4)) < 16) {
                const nextList = furnituresRef.current.map((f) =>
                  f.id === selectedFurnitureId ? { ...f, flipX: !f.flipX } : f
                );
                setFurnitures(nextList);
                saveLayout(nextList);
                return;
              }
              // 3. 换材质角标 (左下角)
              if (Math.hypot(worldX - (activeF.x - 4), worldY - (activeF.y + activeF.h + 4)) < 16) {
                const def = FURNITURE_DEFS[activeF.type] || FURNITURE_DEFS.tea_table;
                setTextureTarget({
                  key: `tex_${char?.id}_${activeF.id}`,
                  name: activeF.name,
                  recomSize: def.recomSize,
                  recomRatio: def.recomRatio,
                  recomDesc: def.recomDesc
                });
                return;
              }
            }
          }

          // 检查是否点中了某个家具 (倒序检测，优先点中上层)
          for (let i = furnituresRef.current.length - 1; i >= 0; i--) {
            const item = furnituresRef.current[i];
            if (
              worldX >= item.x && worldX <= item.x + item.w &&
              worldY >= item.y && worldY <= item.y + item.h
            ) {
              setSelectedFurnitureId(item.id);
              dragFurnitureItem = item;
              dragOffset = { x: worldX - item.x, y: worldY - item.y };
              return;
            }
          }

          // 点在空旷处：解除选中，启动单指拖动平移房间视口
          setSelectedFurnitureId(null);
          cam.isPanning = true;
          cam.panStartX = clientX;
          cam.panStartY = clientY;
          cam.camStartX = cam.x;
          cam.camStartY = cam.y;
          cam.isFollowing = false;
          return;
        }

        // B. 漫游探索模式下的交互
        // 1. 点击名士互动对白
        const distToPlayer = Math.hypot(worldX - player.x, worldY - (player.y - 48));
        if (distToPlayer < 58) {
          const greetings = [
            `“楼主在此，心自清宁。” 🌸`,
            `“今日风清气爽，愿同楼主闲坐半日。” ✨`,
            `“要为楼主续上一盏新茶么？” 🍵`,
            `“这间雅居由楼主精心布置，甚是舒服呢~” 🪵`
          ];
          say(greetings[Math.floor(Math.random() * greetings.length)]);
          return;
        }

        // 2. 点击各家具触发功能 (如点香、坐榻)
        for (const item of furnituresRef.current) {
          if (
            worldX >= item.x && worldX <= item.x + item.w &&
            worldY >= item.y && worldY <= item.y + item.h
          ) {
            player.targetX = item.x + item.w / 2;
            player.targetY = Math.min(ROOM.y + ROOM.h - 30, item.y + item.h + 20);
            if (item.type === "censer") {
              setTimeout(() => {
                roomParticles.censerLit = !roomParticles.censerLit;
                say(roomParticles.censerLit ? "点燃沉香，青烟袅袅，幽香满室 🪔" : "熄了沉香，归于清宁 🍃");
              }, 400);
            } else if (item.type === "bed") {
              setTimeout(() => {
                if (player.pose === "sleeping_bed") {
                  player.pose = "idle";
                  say("伸个懒腰，神清气爽！✨");
                } else {
                  player.pose = "sleeping_bed";
                  player.x = item.x + item.w / 2;
                  player.y = item.y + item.h / 2;
                  say("卧榻小憩，沉香幽幽入梦来... 🌙", 4.5);
                }
              }, 400);
            } else if (item.type === "tea_table") {
              setTimeout(() => {
                say("沸泉初沸，且烹一壶新茶，与楼主共品 🍵");
              }, 400);
            }
            return;
          }
        }

        // 3. 点击地板寻路走动
        player.pose = "idle";
        player.targetX = worldX;
        player.targetY = worldY;
      };

      const handlePointerMove = (e) => {
        const cam = camera.current;

        // 双指 Pinch 缩放处理
        if (e.touches && e.touches.length === 2) {
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          if (cam.lastPinchDist > 0) {
            const factor = dist / cam.lastPinchDist;
            cam.zoom = Math.max(0.75, Math.min(2.2, cam.zoom * factor));
          }
          cam.lastPinchDist = dist;
          return;
        }

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const { worldX, worldY } = toWorldCoords(clientX, clientY);

        // 建造模式下：拖动摆放家具
        if (isEditMode && dragFurnitureItem) {
          const newX = Math.round((worldX - dragOffset.x) / 10) * 10;
          const newY = Math.round((worldY - dragOffset.y) / 10) * 10;
          const clampedX = Math.max(ROOM.x + 10, Math.min(ROOM.x + ROOM.w - dragFurnitureItem.w - 10, newX));
          const clampedY = Math.max(ROOM.y + 100, Math.min(ROOM.y + ROOM.h - dragFurnitureItem.h - 10, newY));

          const nextList = furnituresRef.current.map((f) =>
            f.id === dragFurnitureItem.id ? { ...f, x: clampedX, y: clampedY } : f
          );
          setFurnitures(nextList);
          return;
        }

        // 视口平移拖拽
        if (cam.isPanning) {
          const dx = (clientX - cam.panStartX) / cam.zoom;
          const dy = (clientY - cam.panStartY) / cam.zoom;
          cam.x = cam.camStartX - dx;
          cam.y = cam.camStartY - dy;
        }
      };

      const handlePointerUp = () => {
        const cam = camera.current;
        cam.lastPinchDist = 0;
        cam.isPanning = false;
        if (isEditMode && dragFurnitureItem) {
          saveLayout(furnituresRef.current);
          dragFurnitureItem = null;
        }
      };

      canvas.addEventListener("pointerdown", handlePointerDown);
      canvas.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      canvas.addEventListener("touchstart", handlePointerDown, { passive: true });
      canvas.addEventListener("touchmove", handlePointerMove, { passive: true });
      window.addEventListener("touchend", handlePointerUp);

      return () => {
        isRunning = false;
        cancelAnimationFrame(animationFrameId);
        canvas.removeEventListener("pointerdown", handlePointerDown);
        canvas.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        canvas.removeEventListener("touchstart", handlePointerDown);
        canvas.removeEventListener("touchmove", handlePointerMove);
        window.removeEventListener("touchend", handlePointerUp);
      };
    }, [isEditMode, currentFloorId, char]);

    // 添加新家具到房间
    const handleAddFurniture = (typeKey) => {
      const def = FURNITURE_DEFS[typeKey];
      if (!def) return;
      const newItem = {
        id: `f_${Date.now()}`,
        type: typeKey,
        x: 340,
        y: 350,
        flipX: false,
        ...def
      };
      const nextList = [...furnituresRef.current, newItem];
      setFurnitures(nextList);
      saveLayout(nextList);
      setSelectedFurnitureId(newItem.id);
      setShowBuildDrawer(false);
    };

    // 重置摄像机视角
    const handleResetCamera = () => {
      camera.current.x = 380;
      camera.current.y = 410;
      camera.current.zoom = 1.0;
      camera.current.isFollowing = true;
    };

    return React.createElement(
      "div",
      {
        className: "agent-private-room-overlay open",
        style: {
          position: "fixed",
          inset: 0,
          background: "#1E1814",
          zIndex: 100000,
          display: "flex",
          flexDirection: "column",
          animation: "fadeIn 0.28s ease-out",
          userSelect: "none",
          WebkitUserSelect: "none"
        }
      },
      // 顶部典雅导航栏
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 14px",
            paddingTop: "calc(var(--safe-top, 10px) + 6px)",
            background: "linear-gradient(180deg, rgba(46, 36, 28, 0.95) 0%, rgba(38, 30, 24, 0.88) 100%)",
            borderBottom: "1px solid rgba(190, 150, 105, 0.35)",
            zIndex: 10
          }
        },
        React.createElement(
          "button",
          {
            onClick: onClose,
            style: {
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(214, 168, 110, 0.5)",
              borderRadius: "14px",
              padding: "4px 10px",
              color: "#E8DFC8",
              fontSize: "11.5px",
              fontWeight: "bold",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "3px"
            }
          },
          "‹ 返回心纸居"
        ),
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "5px",
              color: "#F0E8D8",
              fontSize: "14px",
              fontWeight: "bold",
              letterSpacing: "0.5px"
            }
          },
          React.createElement("span", { style: { color: "#D4AF37", fontSize: "11px" } }, "❖"),
          `【${char?.name || "名士"}】专属雅室`,
          React.createElement("span", { style: { color: "#D4AF37", fontSize: "11px" } }, "❖")
        ),
        React.createElement(
          "div",
          { style: { display: "flex", gap: "6px" } },
          // 建造模式切换按钮
          React.createElement(
            "button",
            {
              onClick: () => {
                setIsEditMode(!isEditMode);
                setSelectedFurnitureId(null);
              },
              style: {
                background: isEditMode
                  ? "linear-gradient(135deg, #10B981, #059669)"
                  : "linear-gradient(135deg, #D6724B, #B85832)",
                border: "none",
                borderRadius: "12px",
                padding: "4px 11px",
                color: "#fff",
                fontSize: "11px",
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0,0,0,0.25)"
              }
            },
            isEditMode ? "✓ 完成营造" : "🔨 雅居营造"
          ),
          // 装修地板
          React.createElement(
            "button",
            {
              onClick: () => setShowFloorDrawer(!showFloorDrawer),
              style: {
                background: "rgba(255, 255, 255, 0.12)",
                border: "1px solid #D6A86E",
                borderRadius: "12px",
                padding: "4px 9px",
                color: "#fff",
                fontSize: "11px",
                fontWeight: "bold",
                cursor: "pointer"
              }
            },
            "🎨 铺地"
          )
        )
      ),

      // 画布主容器
      React.createElement(
        "div",
        {
          ref: containerRef,
          style: {
            flex: "1 1 0%",
            minHeight: 0,
            width: "100%",
            height: "100%",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            touchAction: "none"
          }
        },
        React.createElement("canvas", {
          ref: canvasRef,
          width: 760,
          height: 820,
          style: {
            width: "100%",
            height: "100%",
            maxWidth: "760px",
            maxHeight: "820px",
            objectFit: "contain",
            cursor: isEditMode ? "grab" : "pointer"
          }
        }),

        // 浮动摄像机控制按钮
        React.createElement(
          "div",
          {
            style: {
              position: "absolute",
              top: "14px",
              right: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              zIndex: 20
            }
          },
          React.createElement(
            "button",
            {
              onClick: handleResetCamera,
              style: {
                background: "rgba(30, 24, 20, 0.75)",
                border: "1px solid #D6A86E",
                borderRadius: "20px",
                padding: "4px 8px",
                color: "#F0E8D8",
                fontSize: "10.5px",
                cursor: "pointer",
                backdropFilter: "blur(6px)"
              },
              title: "复位视角"
            },
            "🎯 聚焦"
          ),
          React.createElement(
            "button",
            {
              onClick: () => {
                camera.current.zoom = 1.0;
              },
              style: {
                background: "rgba(30, 24, 20, 0.75)",
                border: "1px solid #D6A86E",
                borderRadius: "20px",
                padding: "4px 8px",
                color: "#F0E8D8",
                fontSize: "10.5px",
                cursor: "pointer",
                backdropFilter: "blur(6px)"
              },
              title: "恢复1.0x缩放"
            },
            "🔍 1.0x"
          )
        ),

        // 建造模式提示条
        isEditMode && React.createElement(
          "div",
          {
            style: {
              position: "absolute",
              top: "14px",
              left: "14px",
              background: "rgba(30, 24, 20, 0.85)",
              border: "1px solid #D6724B",
              borderRadius: "16px",
              padding: "4px 12px",
              color: "#F5EFE6",
              fontSize: "11px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              zIndex: 20
            }
          },
          React.createElement("span", null, "🛠️ 造景模式：拖拽摆放家具"),
          React.createElement(
            "button",
            {
              onClick: () => setShowBuildDrawer(!showBuildDrawer),
              style: {
                background: "linear-gradient(135deg, #D6724B, #B85832)",
                border: "none",
                borderRadius: "10px",
                padding: "2px 8px",
                color: "#fff",
                fontSize: "10.5px",
                fontWeight: "bold",
                cursor: "pointer"
              }
            },
            "+ 新增家具"
          ),
          React.createElement(
            "button",
            {
              onClick: () => {
                setTextureTarget({
                  key: `tex_${char?.id}_wall`,
                  ...BG_SPECS.wall
                });
              },
              style: {
                background: "rgba(255,255,255,0.12)",
                border: "1px solid #D6A86E",
                borderRadius: "10px",
                padding: "2px 8px",
                color: "#fff",
                fontSize: "10.5px",
                cursor: "pointer"
              }
            },
            "换墙壁"
          ),
          React.createElement(
            "button",
            {
              onClick: () => {
                setTextureTarget({
                  key: `tex_${char?.id}_window`,
                  ...BG_SPECS.window
                });
              },
              style: {
                background: "rgba(255,255,255,0.12)",
                border: "1px solid #D6A86E",
                borderRadius: "10px",
                padding: "2px 8px",
                color: "#fff",
                fontSize: "10.5px",
                cursor: "pointer"
              }
            },
            "换窗景"
          )
        )
      ),

      // 4. 百宝营造阁 (家具添加抽屉)
      showBuildDrawer && React.createElement(
        "div",
        {
          style: {
            background: "linear-gradient(180deg, #FBF8F2 0%, #F3EBD8 100%)",
            borderTop: "2px solid #D6A86E",
            padding: "12px 16px 20px",
            zIndex: 100,
            boxShadow: "0 -6px 25px rgba(0,0,0,0.4)"
          }
        },
        React.createElement(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" } },
          React.createElement("div", { style: { fontSize: "13px", fontWeight: "bold", color: "#5C4129" } }, "❖ 百宝营造阁 · 增设家具"),
          React.createElement(
            "button",
            {
              onClick: () => setShowBuildDrawer(false),
              style: { background: "none", border: "none", fontSize: "15px", color: "#8C7255", cursor: "pointer" }
            },
            "✕"
          )
        ),
        React.createElement(
          "div",
          { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" } },
          Object.keys(FURNITURE_DEFS).map((key) => {
            const def = FURNITURE_DEFS[key];
            return React.createElement(
              "button",
              {
                key,
                onClick: () => handleAddFurniture(key),
                style: {
                  background: "#fff",
                  border: "1px solid #E6D4BE",
                  borderRadius: "10px",
                  padding: "8px 4px",
                  textAlign: "center",
                  cursor: "pointer"
                }
              },
              React.createElement("div", { style: { fontSize: "18px", marginBottom: "2px" } }, def.icon),
              React.createElement("div", { style: { fontSize: "11px", fontWeight: "bold", color: "#5C4129" } }, def.name)
            );
          })
        )
      ),

      // 5. 材质贴图上传弹窗 (含推荐尺寸/比例指南)
      textureTarget && React.createElement(
        "div",
        {
          style: {
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100010,
            padding: "20px"
          },
          onClick: () => setTextureTarget(null)
        },
        React.createElement(
          "div",
          {
            style: {
              background: "linear-gradient(180deg, #FDFBF7 0%, #F4ECE0 100%)",
              border: "2px solid #D6A86E",
              borderRadius: "18px",
              padding: "18px 20px",
              width: "100%",
              maxWidth: "360px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
            },
            onClick: (e) => e.stopPropagation()
          },
          React.createElement(
            "div",
            { style: { fontSize: "14px", fontWeight: "bold", color: "#5C4129", marginBottom: "10px" } },
            `🎨 自定义换新贴图: 【${textureTarget.name}】`
          ),
          React.createElement(
            "div",
            {
              style: {
                background: "rgba(214, 168, 110, 0.15)",
                border: "1px solid rgba(214, 168, 110, 0.4)",
                borderRadius: "10px",
                padding: "8px 12px",
                marginBottom: "12px",
                fontSize: "11px",
                color: "#5C4129",
                lineHeight: "1.6"
              }
            },
            React.createElement("div", { style: { fontWeight: "bold", color: "#D6724B" } }, `📐 推荐分辨率: ${textureTarget.recomSize}`),
            React.createElement("div", null, `⚖️ 推荐比例: ${textureTarget.recomRatio}`),
            React.createElement("div", { style: { color: "#8C7255", marginTop: "2px" } }, textureTarget.recomDesc)
          ),
          React.createElement(
            "div",
            { style: { display: "flex", gap: "8px", justifyContent: "flex-end" } },
            React.createElement(
              "button",
              {
                onClick: handleResetTexture,
                style: {
                  background: "#EDE4D4",
                  border: "1px solid #D6C7B2",
                  borderRadius: "10px",
                  padding: "6px 12px",
                  color: "#6B5238",
                  fontSize: "11px",
                  fontWeight: "bold",
                  cursor: "pointer"
                }
              },
              "恢复默认"
            ),
            React.createElement(
              "button",
              {
                onClick: () => textureInputRef.current && textureInputRef.current.click(),
                style: {
                  background: "linear-gradient(135deg, #D6724B, #B85832)",
                  border: "none",
                  borderRadius: "10px",
                  padding: "6px 14px",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: "bold",
                  cursor: "pointer"
                }
              },
              "+ 上传贴图"
            )
          ),
          React.createElement("input", {
            type: "file",
            ref: textureInputRef,
            accept: "image/*",
            onChange: handleTextureUpload,
            style: { display: "none" }
          })
        )
      ),

      // 6. 地板材质抽屉
      showFloorDrawer && React.createElement(
        "div",
        {
          style: {
            background: "linear-gradient(180deg, #FBF8F2 0%, #F3EBD8 100%)",
            borderTop: "2px solid #D6A86E",
            padding: "14px 18px 22px",
            zIndex: 100,
            boxShadow: "0 -8px 30px rgba(0,0,0,0.5)"
          }
        },
        React.createElement(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" } },
          React.createElement("div", { style: { fontSize: "13px", fontWeight: "bold", color: "#5C4129" } }, "❖ 专属雅室 · 地板铺设"),
          React.createElement(
            "button",
            {
              onClick: () => setShowFloorDrawer(false),
              style: { background: "none", border: "none", fontSize: "16px", color: "#8C7255", cursor: "pointer" }
            },
            "✕"
          )
        ),
        React.createElement(
          "div",
          { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "12px" } },
          BUILTIN_FLOORS.map((floor) => {
            const isSelected = currentFloorId === floor.id;
            return React.createElement(
              "div",
              {
                key: floor.id,
                onClick: () => {
                  setCurrentFloorId(floor.id);
                  saveLayout(furnituresRef.current, floor.id);
                },
                style: {
                  background: isSelected ? "linear-gradient(135deg, #FFF8ED 0%, #F9ECE0 100%)" : "#fff",
                  border: isSelected ? "2px solid #D6724B" : "1px solid #E6D4BE",
                  borderRadius: "12px",
                  padding: "8px 6px",
                  textAlign: "center",
                  cursor: "pointer"
                }
              },
              React.createElement("div", { style: { fontSize: "18px", marginBottom: "3px" } }, floor.icon),
              React.createElement("div", { style: { fontSize: "11px", fontWeight: "bold", color: "#5C4129" } }, floor.name)
            );
          })
        ),
        React.createElement(
          "button",
          {
            onClick: () => {
              setTextureTarget({
                key: `tex_${char?.id}_floor`,
                type: "floor",
                ...BG_SPECS.floor
              });
            },
            style: {
              width: "100%",
              background: currentFloorId === "custom" ? "linear-gradient(135deg, #D6724B, #B85832)" : "#EDE4D4",
              border: "1px solid #D6A86E",
              borderRadius: "10px",
              padding: "7px 12px",
              color: currentFloorId === "custom" ? "#fff" : "#6B5238",
              fontSize: "11px",
              fontWeight: "bold",
              cursor: "pointer"
            }
          },
          currentFloorId === "custom" ? "✨ 已应用自定义贴图 (点击重置/更换)" : "+ 上传自定义地砖贴图 (推荐 256×256)"
        )
      )
    );
  };

  // =========================================================================
  // 密探专属雅间选择弹窗 (AgentRoomSelectModal)
  // =========================================================================
  const AgentRoomSelectModal = ({ chats = [], onClose, onSelectAgent }) => {
    return React.createElement(
      "div",
      {
        style: {
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.65)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 99998,
          padding: "20px",
          animation: "fadeIn 0.25s ease-out"
        },
        onClick: (e) => {
          if (e.target === e.currentTarget && typeof onClose === "function") {
            onClose();
          }
        }
      },
      React.createElement(
        "div",
        {
          style: {
            background: "linear-gradient(180deg, #FAF6EE 0%, #F2E9D6 100%)",
            border: "2px solid #D6A86E",
            borderRadius: "20px",
            width: "100%",
            maxWidth: "420px",
            maxHeight: "75vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.45)",
            overflow: "hidden"
          },
          onClick: (e) => e.stopPropagation()
        },
        React.createElement(
          "div",
          {
            style: {
              padding: "14px 18px",
              borderBottom: "1px solid #EBD8BF",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "rgba(255, 255, 255, 0.4)"
            }
          },
          React.createElement(
            "div",
            null,
            React.createElement(
              "div",
              { style: { fontSize: "15px", fontWeight: "bold", color: "#5D442A", display: "flex", alignItems: "center", gap: "6px" } },
              "⛩️ 密探专属心纸雅间",
              React.createElement("span", { style: { fontSize: "10.5px", background: "#D6724B", color: "#fff", padding: "1px 6px", borderRadius: "10px", fontWeight: "bold" } }, "独立居所")
            ),
            React.createElement("div", { style: { fontSize: "11px", color: "#8C7255", marginTop: "2px" } }, "选择一位密探，造访其专属的 2.5D 私密小居")
          ),
          React.createElement(
            "button",
            {
              onClick: onClose,
              style: {
                background: "rgba(0,0,0,0.06)",
                border: "none",
                borderRadius: "50%",
                width: "28px",
                height: "28px",
                fontSize: "14px",
                color: "#6B4A28",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }
            },
            "✕"
          )
        ),

        React.createElement(
          "div",
          {
            style: {
              flex: 1,
              overflowY: "auto",
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px"
            }
          },
          chats.length === 0 ? React.createElement(
            "div",
            { style: { textAlign: "center", padding: "30px 10px", color: "#A89078", fontSize: "12px" } },
            "传讯中暂无名士，请先结识名士后再来造访其专属雅居~"
          ) : chats.map((c) => {
            return React.createElement(
              "div",
              {
                key: c.id,
                style: {
                  background: "#fff",
                  border: "1px solid #EBD8BF",
                  borderRadius: "14px",
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.04)"
                }
              },
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 } },
                React.createElement(
                  typeof window.CharacterAvatarDisplay !== "undefined" ? window.CharacterAvatarDisplay : "img",
                  {
                    avatar: c.avatar,
                    name: c.name,
                    size: 42,
                    src: c.avatar,
                    style: { width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover" }
                  }
                ),
                React.createElement(
                  "div",
                  { style: { flex: 1, minWidth: 0 } },
                  React.createElement("div", { style: { fontSize: "13.5px", fontWeight: "bold", color: "#5D442A" } }, c.name),
                  React.createElement("div", { style: { fontSize: "10.5px", color: "#8C7255", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.personality || c.desc || "传讯名士")
                )
              ),
              React.createElement(
                "button",
                {
                  onClick: (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log("【密探选择】点击造访雅室:", c);
                    if (typeof onSelectAgent === "function") {
                      onSelectAgent(c);
                    }
                  },
                  style: {
                    background: "linear-gradient(135deg, #D6724B 0%, #B85832 100%)",
                    border: "none",
                    borderRadius: "12px",
                    padding: "6px 14px",
                    color: "#fff",
                    fontSize: "11px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(214, 114, 75, 0.3)"
                  }
                },
                "造访雅室 ›"
              )
            );
          })
        )
      )
    );
  };

  window.Agent25DPrivateRoomModal = Agent25DPrivateRoomModal;
  window.AgentRoomSelectModal = AgentRoomSelectModal;
})();
