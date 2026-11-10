/**
 * 心纸居 · 密探专属2.5D交互小房间系统 (高自由度建造大师版)
 * 具备特性：
 * 1. 贴图全异步存入 IndexedDB，避免 LocalStorage 容量超限
 * 2. 统一以家具底边水平接触线 (Foot Anchor Y) 深度排序，无错位穿透
 * 3. 墙壁、窗户、茶案、罗汉软榻及所有自定义家具均具备真实物理碰撞阻挡与沿体滑动
 * 4. 全家具/窗户/墙面支持更换贴图，支持用户上传自定义新家具，并显著标注推荐尺寸与比例
 * 5. 虚拟摄像机：平滑 Lerp 跟随名士、移动端双指 Pinch 捏合缩放 (0.75x ~ 2.2x)、拖拽漫游
 * 6. 自由造景营造模式：家具库增设、自定义上传家具、拖拽摆放、缩放尺寸、镜像翻转、一键回收及持久化
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
      desc: "温润沉稳",
      icon: "🪵",
      plankH: 24,
      colors: ["#7A5835", "#6E4E2D", "#84613C", "#68482A"],
      lineColor: "#4A331C"
    },
    {
      id: "tatami",
      name: "素雅草席",
      desc: "天然织蔺",
      icon: "🌾",
      plankH: 20,
      colors: ["#C2B280", "#BAAB76", "#C8B988", "#B4A570"],
      lineColor: "#827546"
    },
    {
      id: "bamboo",
      name: "青竹凉席",
      desc: "幽翠生凉",
      icon: "🎋",
      plankH: 18,
      colors: ["#7D8B69", "#72805E", "#889673", "#6A7756"],
      lineColor: "#4E593D"
    },
    {
      id: "slate",
      name: "汉白玉砖",
      desc: "清冷出尘",
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
      footOffsetX: 6,
      footOffsetY: 22,
      footW: 168,
      footH: 72,
      recomSize: "360 × 200 px",
      recomRatio: "9 : 5",
      recomDesc: "推荐透明PNG（古木茶案、棋盘、食案）"
    },
    bed: {
      type: "bed",
      name: "罗汉软榻",
      icon: "🛏️",
      w: 165,
      h: 180,
      footOffsetX: 6,
      footOffsetY: 18,
      footW: 153,
      footH: 156,
      recomSize: "330 × 360 px",
      recomRatio: "11 : 12",
      recomDesc: "推荐透明PNG（雕花软榻、拔步床、卧榻）"
    },
    censer: {
      type: "censer",
      name: "博山香炉",
      icon: "🪔",
      w: 70,
      h: 90,
      footOffsetX: 6,
      footOffsetY: 20,
      footW: 58,
      footH: 64,
      recomSize: "140 × 180 px",
      recomRatio: "7 : 9",
      recomDesc: "推荐透明PNG（博山炉、花瓶、宫灯摆件）"
    },
    screen: {
      type: "screen",
      name: "四折屏风",
      icon: "🖼️",
      w: 125,
      h: 185,
      footOffsetX: 6,
      footOffsetY: 95,
      footW: 113,
      footH: 84,
      recomSize: "240 × 360 px",
      recomRatio: "2 : 3",
      recomDesc: "推荐透明PNG（水墨屏风、落地隔断）"
    },
    guqin_desk: {
      type: "guqin_desk",
      name: "幽谷琴案",
      icon: "🎼",
      w: 160,
      h: 90,
      footOffsetX: 6,
      footOffsetY: 20,
      footW: 148,
      footH: 64,
      recomSize: "320 × 180 px",
      recomRatio: "16 : 9",
      recomDesc: "推荐透明PNG（古琴案、书画长桌）"
    },
    bookshelf: {
      type: "bookshelf",
      name: "藏书多宝阁",
      icon: "📚",
      w: 130,
      h: 175,
      footOffsetX: 6,
      footOffsetY: 60,
      footW: 118,
      footH: 108,
      recomSize: "260 × 340 px",
      recomRatio: "13 : 17",
      recomDesc: "推荐透明PNG（博古架、书柜、武器架）"
    },
    carpet: {
      type: "carpet",
      name: "织锦地毯",
      icon: "🧶",
      w: 220,
      h: 130,
      footOffsetX: 0,
      footOffsetY: 0,
      footW: 0,
      footH: 0,
      isFloorDeco: true,
      recomSize: "440 × 260 px",
      recomRatio: "17 : 10",
      recomDesc: "推荐透明PNG（地毯、蒲团，无阻挡可踩踏）"
    },
    custom_small: {
      type: "custom_small",
      name: "自定义小摆件",
      icon: "🪴",
      w: 85,
      h: 95,
      footOffsetX: 6,
      footOffsetY: 22,
      footW: 73,
      footH: 68,
      recomSize: "170 × 190 px",
      recomRatio: "9 : 10",
      recomDesc: "推荐透明PNG（盆景、酒坛、立牌、宠物窝）"
    },
    custom_medium: {
      type: "custom_medium",
      name: "自定义中型家具",
      icon: "🪑",
      w: 150,
      h: 110,
      footOffsetX: 6,
      footOffsetY: 24,
      footW: 138,
      footH: 80,
      recomSize: "300 × 220 px",
      recomRatio: "15 : 11",
      recomDesc: "推荐透明PNG（桌椅、矮柜、浴桶、沙盘）"
    },
    custom_large: {
      type: "custom_large",
      name: "自定义大型家具",
      icon: "🏯",
      w: 165,
      h: 175,
      footOffsetX: 8,
      footOffsetY: 30,
      footW: 149,
      footH: 138,
      recomSize: "330 × 350 px",
      recomRatio: "11 : 12",
      recomDesc: "推荐透明PNG（大床、屏风、大型立柜）"
    }
  };

  // 背景贴图规范
  const BG_SPECS = {
    wall: {
      name: "素雅照壁 (墙壁)",
      recomSize: "1120 × 240 px",
      recomRatio: "14 : 3",
      recomDesc: "横版长条，推荐山水、竹影、墙纸纹理"
    },
    window: {
      name: "雕花窗棂 (窗景)",
      recomSize: "360 × 160 px",
      recomRatio: "9 : 4",
      recomDesc: "横版窗景，推荐庭院、落樱、夜月、雪景"
    },
    floor: {
      name: "地砖材质 (平铺)",
      recomSize: "256 × 256 px",
      recomRatio: "1 : 1",
      recomDesc: "正方形无缝纹理，自动四方连续平铺"
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
      x: 225,
      y: 285,
      flipX: false,
      ...FURNITURE_DEFS.tea_table
    },
    {
      id: "f_bed",
      type: "bed",
      x: 465,
      y: 245,
      flipX: false,
      ...FURNITURE_DEFS.bed
    }
  ];

  // 归一化家具碰撞盒（兼容旧存档并随宽高缩放）
  const normalizeFurnitureItem = (f) => {
    const def = FURNITURE_DEFS[f.type] || FURNITURE_DEFS.custom_medium;
    const w = Number(f.w) || def.w;
    const h = Number(f.h) || def.h;
    const isFloorDeco = f.isFloorDeco !== undefined ? f.isFloorDeco : Boolean(def.isFloorDeco);
    const interactSpeech = typeof f.interactSpeech === "string" ? f.interactSpeech : "";
    if (isFloorDeco) {
      return {
        ...def,
        ...f,
        w,
        h,
        footOffsetX: 0,
        footOffsetY: 0,
        footW: 0,
        footH: 0,
        isFloorDeco: true,
        interactSpeech
      };
    }
    const scaleX = w / def.w;
    const scaleY = h / def.h;
    return {
      ...def,
      ...f,
      w,
      h,
      footOffsetX: Math.round(def.footOffsetX * scaleX),
      footOffsetY: Math.round(def.footOffsetY * scaleY),
      footW: Math.max(24, Math.round(def.footW * scaleX)),
      footH: Math.max(24, Math.round(def.footH * scaleY)),
      isFloorDeco: false,
      interactSpeech
    };
  };

  // =========================================================================
  // 三、 2.5D 密探专属雅居主模态组件
  // =========================================================================
  const Agent25DPrivateRoomModal = ({ char, onClose }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const textureInputRef = useRef(null);
    const interactGifInputRef = useRef(null);
    const customFurnitureInputRef = useRef(null);
    const customFurnitureGifInputRef = useRef(null);
    const interactGifDomRef = useRef(null);

    // 模式切换与UI状态 (同步维护 Ref 供 Canvas 渲染循环无延迟读取)
    const [isEditMode, setIsEditMode] = useState(false);
    const isEditModeRef = useRef(false);
    isEditModeRef.current = isEditMode;

    const [selectedFurnitureId, setSelectedFurnitureId] = useState(null);
    const selectedFurnitureIdRef = useRef(null);
    selectedFurnitureIdRef.current = selectedFurnitureId;

    const [showBuildDrawer, setShowBuildDrawer] = useState(false);
    const [showFloorDrawer, setShowFloorDrawer] = useState(false);
    const [showTextureHubModal, setShowTextureHubModal] = useState(false);
    const [textureTarget, setTextureTarget] = useState(null); // { key, furnitureId, name, recomSize, recomRatio, recomDesc, type }
    const [editingInteractSpeech, setEditingInteractSpeech] = useState("");
    const [gifVersion, setGifVersion] = useState(0);

    // 自定义上传新家具弹窗状态
    const [showCustomUploadModal, setShowCustomUploadModal] = useState(false);
    const [customUploadName, setCustomUploadName] = useState("自定义家具");
    const [customUploadPreset, setCustomUploadPreset] = useState("custom_medium");
    const [customUploadSpeech, setCustomUploadSpeech] = useState("");
    const [customUploadGifDataUrl, setCustomUploadGifDataUrl] = useState(null);

    // 房间地板
    const [currentFloorId, setCurrentFloorId] = useState("wood");
    const currentFloorIdRef = useRef("wood");
    currentFloorIdRef.current = currentFloorId;

    // 家具实体列表 (State + Ref 保证渲染循环中实时读取)
    const [furnitures, setFurnitures] = useState(() => createDefaultFurnitures());
    const furnituresRef = useRef(furnitures);
    furnituresRef.current = furnitures;

    // 内存贴图材质池 (key => Image) 与家具绑定角色GIF池 (furnitureId => dataUrl)
    const texturePool = useRef(new Map());
    const gifUrlPool = useRef(new Map());

    // 虚拟摄像机状态
    const camera = useRef({
      x: 380,
      y: 390,
      zoom: 1.0,
      isFollowing: true,
      lastPinchDist: 0,
      isPanning: false,
      panStartX: 0,
      panStartY: 0,
      camStartX: 380,
      camStartY: 390
    });

    // 房间几何尺寸 (画布逻辑分辨率 760 x 820)
    const ROOM = {
      x: 100,
      y: 130,
      w: 560,
      h: 460,
      wallH: 118,
      winX: 330,
      winY: 146,
      winW: 180,
      winH: 80
    };

    // 1. 初始化读取房间配置与 IndexedDB 材质
    useEffect(() => {
      if (!char || !char.id) return;
      const charId = char.id;

      let initialList = createDefaultFurnitures().map(normalizeFurnitureItem);
      try {
        const savedLayout = JSON.parse(localStorage.getItem(`t8_room_layout_${charId}`) || "null");
        if (savedLayout && Array.isArray(savedLayout.furnitures)) {
          initialList = savedLayout.furnitures.map(normalizeFurnitureItem);
          setFurnitures(initialList);
        } else {
          setFurnitures(initialList);
        }
        if (savedLayout && savedLayout.floorId) {
          setCurrentFloorId(savedLayout.floorId);
        }
      } catch (e) {
        console.warn("[AgentRoom] 读取房间布局失败:", e);
      }

      // 异步读取 IndexedDB 贴图与角色交互 GIF 并存入内存池
      const loadTextures = async () => {
        const keysToLoad = [
          `tex_${charId}_wall`,
          `tex_${charId}_window`,
          `tex_${charId}_floor`
        ];
        initialList.forEach((f) => keysToLoad.push(`tex_${charId}_${f.id}`));

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

        // 读取各家具绑定的角色交互 GIF
        for (const f of initialList) {
          const gifKey = `tex_${charId}_${f.id}_gif`;
          const gifDataUrl = await getIDBTexture(gifKey);
          if (gifDataUrl && typeof gifDataUrl === "string") {
            gifUrlPool.current.set(f.id, gifDataUrl);
          }
        }
        setGifVersion((v) => v + 1);
      };
      loadTextures();
    }, [char?.id]);

    // 保存布局至 localStorage (含 interactSpeech 角色特定发言)
    const saveLayout = (newList, floorId) => {
      if (!char || !char.id) return;
      try {
        const data = {
          floorId: floorId || currentFloorIdRef.current,
          furnitures: newList.map((f) => ({
            id: f.id,
            type: f.type,
            name: f.name,
            x: Math.round(f.x),
            y: Math.round(f.y),
            w: Math.round(f.w),
            h: Math.round(f.h),
            flipX: Boolean(f.flipX),
            isFloorDeco: Boolean(f.isFloorDeco),
            interactSpeech: typeof f.interactSpeech === "string" ? f.interactSpeech : ""
          })),
          updatedAt: Date.now()
        };
        localStorage.setItem(`t8_room_layout_${char.id}`, JSON.stringify(data));
      } catch (e) {
        console.warn("[AgentRoom] 保存布局失败:", e);
      }
    };

    // 保存当前弹窗中编辑的家具特定发言
    const persistCurrentTargetSpeech = (speechText) => {
      if (!textureTarget || !textureTarget.furnitureId) return;
      const targetId = textureTarget.furnitureId;
      const nextList = furnituresRef.current.map((f) =>
        f.id === targetId ? { ...f, interactSpeech: (speechText || "").trim() } : f
      );
      setFurnitures(nextList);
      saveLayout(nextList);
    };

    // 2. 贴图上传处理 (写入 IndexedDB)
    const handleTextureUpload = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file || !textureTarget || !char) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target.result;
        const key = textureTarget.key;

        await setIDBTexture(key, base64);

        const img = new Image();
        img.src = base64;
        img.onload = () => {
          texturePool.current.set(key, img);
          if (textureTarget.type === "floor") {
            setCurrentFloorId("custom");
            saveLayout(furnituresRef.current, "custom");
          }
        };
        if (textureTarget.furnitureId) {
          persistCurrentTargetSpeech(editingInteractSpeech);
        }
      };
      reader.readAsDataURL(file);
      e.target.value = "";
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
    };

    // 家具绑定角色交互 GIF 上传 (写入 IndexedDB)
    const handleInteractGifUpload = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file || !textureTarget || !textureTarget.furnitureId || !char) return;
      const fId = textureTarget.furnitureId;
      const gifKey = `tex_${char.id}_${fId}_gif`;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target.result;
        await setIDBTexture(gifKey, base64);
        gifUrlPool.current.set(fId, base64);
        setGifVersion((v) => v + 1);
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    };

    // 清除家具绑定的角色交互 GIF
    const handleResetInteractGif = async () => {
      if (!textureTarget || !textureTarget.furnitureId || !char) return;
      const fId = textureTarget.furnitureId;
      const gifKey = `tex_${char.id}_${fId}_gif`;
      await deleteIDBTexture(gifKey);
      gifUrlPool.current.delete(fId);
      setGifVersion((v) => v + 1);
    };

    // 自定义新家具弹窗：预选绑定角色 GIF
    const handleCustomFurnitureGifSelect = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        setCustomUploadGifDataUrl(ev.target.result);
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    };

    // 上传自定义新家具并直接放入房间（同时保存绑定的角色GIF与特定发言）
    const handleCustomFurnitureUpload = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file || !char) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target.result;
        const presetKey = customUploadPreset in FURNITURE_DEFS ? customUploadPreset : "custom_medium";
        const def = FURNITURE_DEFS[presetKey];
        const newId = `f_custom_${Date.now()}`;
        const texKey = `tex_${char.id}_${newId}`;

        // 存入 IndexedDB
        await setIDBTexture(texKey, base64);

        const img = new Image();
        img.src = base64;
        img.onload = () => {
          texturePool.current.set(texKey, img);
        };

        // 若同时绑定了角色交互 GIF，一并存入 IndexedDB
        if (customUploadGifDataUrl) {
          const gifKey = `tex_${char.id}_${newId}_gif`;
          await setIDBTexture(gifKey, customUploadGifDataUrl);
          gifUrlPool.current.set(newId, customUploadGifDataUrl);
          setGifVersion((v) => v + 1);
        }

        const rawItem = {
          id: newId,
          type: presetKey,
          name: (customUploadName || "").trim() || def.name,
          x: 310,
          y: 340,
          w: def.w,
          h: def.h,
          flipX: false,
          isFloorDeco: Boolean(def.isFloorDeco),
          interactSpeech: (customUploadSpeech || "").trim()
        };
        const newItem = normalizeFurnitureItem(rawItem);
        const nextList = [...furnituresRef.current, newItem];
        setFurnitures(nextList);
        saveLayout(nextList);
        setIsEditMode(true);
        setSelectedFurnitureId(newItem.id);
        setCustomUploadSpeech("");
        setCustomUploadGifDataUrl(null);
        setShowCustomUploadModal(false);
        setShowBuildDrawer(false);
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    };

    // 选中家具操作：回收删除
    const handleRecycleFurniture = async (targetId) => {
      const idToRemove = targetId || selectedFurnitureIdRef.current;
      if (!idToRemove) return;
      const nextList = furnituresRef.current.filter((f) => f.id !== idToRemove);
      setFurnitures(nextList);
      saveLayout(nextList);
      if (selectedFurnitureIdRef.current === idToRemove) {
        setSelectedFurnitureId(null);
      }
    };

    // 选中家具操作：水平翻转
    const handleFlipFurniture = (targetId) => {
      const idToFlip = targetId || selectedFurnitureIdRef.current;
      if (!idToFlip) return;
      const nextList = furnituresRef.current.map((f) =>
        f.id === idToFlip ? { ...f, flipX: !f.flipX } : f
      );
      setFurnitures(nextList);
      saveLayout(nextList);
    };

    // 选中家具操作：缩放尺寸
    const handleScaleFurniture = (factor) => {
      const idToScale = selectedFurnitureIdRef.current;
      if (!idToScale) return;
      const nextList = furnituresRef.current.map((f) => {
        if (f.id !== idToScale) return f;
        const newW = Math.max(45, Math.min(340, Math.round(f.w * factor)));
        const newH = Math.max(45, Math.min(340, Math.round(f.h * factor)));
        return normalizeFurnitureItem({ ...f, w: newW, h: newH });
      });
      setFurnitures(nextList);
      saveLayout(nextList);
    };

    // 选中家具操作：打开换贴图与角色交互绑定弹窗
    const openFurnitureTextureModal = (item) => {
      if (!item || !char) return;
      const latestItem = furnituresRef.current.find((f) => f.id === item.id) || item;
      const def = FURNITURE_DEFS[latestItem.type] || FURNITURE_DEFS.custom_medium;
      setEditingInteractSpeech(latestItem.interactSpeech || "");
      setTextureTarget({
        key: `tex_${char.id}_${latestItem.id}`,
        furnitureId: latestItem.id,
        name: latestItem.name || def.name,
        recomSize: `${latestItem.w * 2} × ${latestItem.h * 2} px`,
        recomRatio: def.recomRatio || "自由比例",
        recomDesc: def.recomDesc || "推荐透明背景 PNG 图片"
      });
    };

    // 恢复初始默认家具布局
    const handleResetDefaultFurnitures = () => {
      const defList = createDefaultFurnitures().map(normalizeFurnitureItem);
      setFurnitures(defList);
      saveLayout(defList);
      setSelectedFurnitureId(null);
    };

    // 3. 核心物理、碰撞、寻路与渲染主循环 (仅依赖 char?.id，避免模式切换重置人物坐标)
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

      // 名士实体 (初始置于房间中下部空旷区，绝不与茶案/软榻重叠)
      const player = {
        x: 340,
        y: 475,
        targetX: null,
        targetY: null,
        speed: 185,
        facing: 1,
        isMoving: false,
        walkCycle: 0,
        pose: "idle",
        interactFurnitureId: null,
        bubbleText: `楼主，欢迎造访我的雅室~ ✨`,
        bubbleTimer: 4.0
      };

      const say = (text, duration = 3.6) => {
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

      // 碰撞检测算法：检测坐标 (px, py) 是否与墙纸、窗户或任意家具(含软榻/茶案/自定义家具)阻挡体重叠
      const checkCollision = (px, py) => {
        // 1. 房间四壁与照壁墙面、雕花窗棂边界阻挡
        const minX = ROOM.x + 36;
        const maxX = ROOM.x + ROOM.w - 36;
        const minY = ROOM.y + ROOM.wallH + 34; // 防止人物穿入上方照壁墙纸与窗户
        const maxY = ROOM.y + ROOM.h - 20;
        if (px < minX || px > maxX || py < minY || py > maxY) return true;

        // 窗户正下方微凸窗台阻挡区
        if (px >= ROOM.winX - 16 && px <= ROOM.winX + ROOM.winW + 16 && py < ROOM.y + ROOM.wallH + 44) {
          return true;
        }

        // 2. 名士底部+下身占地包围盒 (48 x 24 px，匹配放大后的人物宽度)
        const pBox = { x: px - 24, y: py - 20, w: 48, h: 24 };

        // 3. 遍历各家具(茶案、罗汉软榻、香炉、屏风及自定义家具)底部 Collider
        for (const item of furnituresRef.current) {
          if (item.isFloorDeco || item.footW <= 0 || item.footH <= 0) continue;
          const fBox = {
            x: item.x + (item.footOffsetX || 0),
            y: item.y + (item.footOffsetY || 0),
            w: item.footW || item.w,
            h: item.footH || item.h
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
      const drawRoomBackground = () => {
        ctx.fillStyle = "#1E1814";
        ctx.fillRect(-400, -400, canvas.width + 800, canvas.height + 800);

        // 房间古木框架外壳
        drawRoundedRect(ROOM.x - 12, ROOM.y - 12, ROOM.w + 24, ROOM.h + 24, 20, "#543C28", "#332114", 4);
        drawRoundedRect(ROOM.x + 6, ROOM.y + 6, ROOM.w - 12, ROOM.h - 12, 10, "#E8DFD0", "#3E2919", 3);

        // 照壁墙面 (支持自定义贴图)
        const wallKey = `tex_${char?.id}_wall`;
        const customWallImg = texturePool.current.get(wallKey);
        const wallX = ROOM.x + 6;
        const wallY = ROOM.y + 6;
        const wallW = ROOM.w - 12;
        const wallH = ROOM.wallH;

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
        const winX = ROOM.winX;
        const winY = ROOM.winY;
        const winW = ROOM.winW;
        const winH = ROOM.winH;

        if (customWinImg) {
          ctx.save();
          drawRoundedRect(winX, winY, winW, winH, 4, null, "#5C3E25", 3);
          ctx.clip();
          ctx.drawImage(customWinImg, winX, winY, winW, winH);
          ctx.restore();
        } else {
          drawRoundedRect(winX, winY, winW, winH, 4, "#F4EDE1", "#5C3E25", 3);
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

        // 建造模式下：墙纸与窗户也显示可换贴图虚线提示
        if (isEditModeRef.current) {
          ctx.save();
          ctx.strokeStyle = "rgba(214, 168, 110, 0.7)";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(winX - 2, winY - 2, winW + 4, winH + 4);
          ctx.setLineDash([]);
          ctx.fillStyle = "rgba(46, 36, 28, 0.75)";
          drawRoundedRect(winX + winW / 2 - 42, winY + winH / 2 - 11, 84, 22, 8, "rgba(46, 36, 28, 0.8)", "#D6A86E", 1);
          ctx.fillStyle = "#FFF8ED";
          ctx.font = "bold 10px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("🎨 点击换窗景", winX + winW / 2, winY + winH / 2);

          drawRoundedRect(wallX + 16, wallY + 12, 86, 22, 8, "rgba(46, 36, 28, 0.8)", "#D6A86E", 1);
          ctx.fillStyle = "#FFF8ED";
          ctx.fillText("🎨 点击换墙纸", wallX + 59, wallY + 23);
          ctx.restore();
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
        sunGrad.addColorStop(0, "rgba(255, 248, 220, 0.18)");
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

        const floorId = currentFloorIdRef.current;
        const customFloorImg = texturePool.current.get(`tex_${char?.id}_floor`);
        if (customFloorImg && floorId === "custom") {
          try {
            const pattern = ctx.createPattern(customFloorImg, "repeat");
            ctx.fillStyle = pattern;
            ctx.fillRect(floorLeft, floorTop, floorRight - floorLeft, floorBottom - floorTop);
          } catch (e) {
            ctx.drawImage(customFloorImg, floorLeft, floorTop, floorRight - floorLeft, floorBottom - floorTop);
          }
        } else {
          const activeFloorDef = BUILTIN_FLOORS.find((f) => f.id === floorId) || BUILTIN_FLOORS[0];
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

        if (customImg) {
          ctx.drawImage(customImg, 0, 0, item.w, item.h);
        } else {
          switch (item.type) {
            case "tea_table": {
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
              drawRoundedRect(0, 0, item.w, item.h, 8, "#6B492B", "#382312", 3);
              drawRoundedRect(8, 16, item.w - 16, item.h - 24, 6, "#E8DFC8", "#8F7556", 2);
              drawRoundedRect(item.w - 48, 24, 36, 26, 6, "#C77D58", "#7A4628", 2);
              break;
            }
            case "censer": {
              drawRoundedRect(2, 38, 44, 20, 4, "#5A3D28", "#332114", 2);
              drawRoundedRect(8, 14, 32, 26, 6, "#B59458", "#61481E", 2.5);
              drawRoundedRect(16, 4, 16, 12, 4, "#D4B372", "#61481E", 2);
              break;
            }
            case "screen": {
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
              drawRoundedRect(0, 10, item.w, item.h - 20, 6, "#4A321E", "#28170B", 2.5);
              drawRoundedRect(24, 25, 112, 18, 4, "#2C1B10", "#8F6443", 1.5);
              break;
            }
            case "bookshelf": {
              drawRoundedRect(0, 0, item.w, item.h, 4, "#583C25", "#322012", 3);
              drawRoundedRect(8, 12, item.w - 16, 45, 2, "#EDE2D0", "#8F6E4C", 1.5);
              drawRoundedRect(8, 65, item.w - 16, 45, 2, "#EDE2D0", "#8F6E4C", 1.5);
              break;
            }
            case "carpet": {
              drawRoundedRect(0, 0, item.w, item.h, 16, "rgba(214, 114, 75, 0.45)", "#9C4E2B", 2);
              drawRoundedRect(8, 8, item.w - 16, item.h - 16, 10, "rgba(248, 238, 222, 0.55)", "#B8734A", 1.5);
              break;
            }
            default: {
              drawRoundedRect(0, 0, item.w, item.h, 8, "#8B6A48", "#4A321C", 2);
              ctx.fillStyle = "#F5EFE6";
              ctx.font = "bold 12px sans-serif";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(item.name || "家具", item.w / 2, item.h / 2);
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

        // 建造模式下：绘制碰撞区浅色辅助线与选中角标
        if (isEditModeRef.current) {
          const isSelected = selectedFurnitureIdRef.current === item.id;
          ctx.save();
          if (isSelected) {
            ctx.strokeStyle = "#D6724B";
            ctx.lineWidth = 2.5;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(item.x - 3, item.y - 3, item.w + 6, item.h + 6);
            ctx.setLineDash([]);

            // 1. 左上角：回收删除红色圆钮
            ctx.fillStyle = "#E04838";
            ctx.beginPath();
            ctx.arc(item.x - 4, item.y - 4, 13, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#fff";
            ctx.font = "bold 12px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("✕", item.x - 4, item.y - 4);

            // 2. 右上角：镜像翻转蓝色圆钮
            ctx.fillStyle = "#3B82F6";
            ctx.beginPath();
            ctx.arc(item.x + item.w + 4, item.y - 4, 13, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#fff";
            ctx.fillText("⇄", item.x + item.w + 4, item.y - 4);

            // 3. 左下角：换贴图橙色圆钮
            ctx.fillStyle = "#D97706";
            ctx.beginPath();
            ctx.arc(item.x - 4, item.y + item.h + 4, 13, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#fff";
            ctx.font = "bold 11px sans-serif";
            ctx.fillText("🎨", item.x - 4, item.y + item.h + 4);
          } else {
            ctx.strokeStyle = "rgba(214, 168, 110, 0.45)";
            ctx.lineWidth = 1;
            ctx.strokeRect(item.x, item.y, item.w, item.h);
          }
          ctx.restore();
        }
      };

      // 绘制纯净名士小人（若正处于家具交互且绑定了角色 GIF，则由同步 DOM <img> 渲染流畅动图）
      const drawCharacter = () => {
        const pX = player.x;
        const pY = player.y;

        const targetH = 98;
        let drawW = 86;
        let drawH = targetH;
        if (avatarImg && avatarImg.width && avatarImg.height) {
          const aspect = avatarImg.width / avatarImg.height;
          drawW = Math.round(Math.min(115, Math.max(55, targetH * aspect)));
        }

        const hasActiveInteractGif =
          !isEditModeRef.current &&
          player.interactFurnitureId &&
          gifUrlPool.current.has(player.interactFurnitureId);

        // 脚底自然柔和投影
        ctx.fillStyle = "rgba(40, 25, 15, 0.28)";
        ctx.beginPath();
        ctx.ellipse(pX, pY + 2, Math.max(22, drawW * 0.32), 7, 0, 0, Math.PI * 2);
        ctx.fill();

        const bob = player.isMoving ? Math.sin(player.walkCycle * 9) * 3.5 : 0;

        if (!hasActiveInteractGif) {
          ctx.save();
          ctx.translate(pX, pY);

          if (player.facing === -1) {
            ctx.scale(-1, 1);
          }

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
        }

        // 头顶气泡对白
        if (player.bubbleText && player.bubbleTimer > 0) {
          ctx.save();
          ctx.font = "bold 12.5px sans-serif";
          const tw = ctx.measureText(player.bubbleText).width;
          const bw = Math.max(76, tw + 22);
          const bx = pX - bw / 2;
          const by = pY - drawH - 22 + bob;

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
        if (cam.isFollowing && !isEditModeRef.current) {
          cam.x += (player.x - cam.x) * 0.08;
          cam.y += ((player.y - 40) - cam.y) * 0.08;
        }

        // 名士步进移动与滑动碰撞物理
        if (!isEditModeRef.current && player.targetX !== null && player.targetY !== null) {
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

            if (!checkCollision(player.x + moveX, player.y + moveY)) {
              player.x += moveX;
              player.y += moveY;
            } else if (!checkCollision(player.x + moveX, player.y)) {
              player.x += moveX;
            } else if (!checkCollision(player.x, player.y + moveY)) {
              player.y += moveY;
            } else {
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
        } else if (!isEditModeRef.current) {
          player.isMoving = false;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 应用虚拟摄像机视口变换矩阵
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(cam.zoom, cam.zoom);
        ctx.translate(-cam.x, -cam.y);

        drawRoomBackground();

        // 统一采用家具底边水平接触线 (Foot Anchor Y) 深度排序渲染
        const renderQueue = [];

        furnituresRef.current.forEach((item) => {
          const footAnchorY = item.isFloorDeco
            ? item.y - 1000
            : item.y + (item.footOffsetY || 0) + (item.footH || item.h);

          renderQueue.push({
            anchorY: footAnchorY,
            draw: () => renderFurnitureEntity(item)
          });
        });

        renderQueue.push({
          anchorY: player.y,
          draw: () => drawCharacter()
        });

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

        // 同步更新家具交互绑定的动态角色 GIF 图层 (保证多帧 GIF 100% 流畅播放并精确跟随镜头缩放/平移)
        const gifEl = interactGifDomRef.current;
        if (gifEl) {
          const activeFId = !isEditModeRef.current ? player.interactFurnitureId : null;
          const gifDataUrl = activeFId ? gifUrlPool.current.get(activeFId) : null;
          if (gifDataUrl && containerRef.current) {
            const cRect = canvas.getBoundingClientRect();
            const wrapRect = containerRef.current.getBoundingClientRect();
            const canvasAspect = canvas.width / canvas.height;
            const rectAspect = cRect.width / Math.max(1, cRect.height);
            let renderW = cRect.width;
            let renderH = cRect.height;
            if (rectAspect > canvasAspect) {
              renderW = cRect.height * canvasAspect;
            } else {
              renderH = cRect.width / canvasAspect;
            }
            const offsetX = (cRect.left - wrapRect.left) + (cRect.width - renderW) / 2;
            const offsetY = (cRect.top - wrapRect.top) + (cRect.height - renderH) / 2;

            const bob = player.isMoving ? Math.sin(player.walkCycle * 9) * 3.5 : 0;
            const canvasX = (player.x - cam.x) * cam.zoom + canvas.width / 2;
            const canvasY = (player.y + bob - cam.y) * cam.zoom + canvas.height / 2;
            const cssX = offsetX + (canvasX / canvas.width) * renderW;
            const cssY = offsetY + (canvasY / canvas.height) * renderH;
            const cssScale = (renderH / canvas.height) * cam.zoom;

            if (gifEl.getAttribute("data-gif-id") !== activeFId || gifEl.src !== gifDataUrl) {
              gifEl.setAttribute("data-gif-id", activeFId);
              gifEl.src = gifDataUrl;
            }
            gifEl.style.display = "block";
            gifEl.style.left = `${cssX}px`;
            gifEl.style.top = `${cssY}px`;
            gifEl.style.height = `${Math.round(104 * cssScale)}px`;
            gifEl.style.width = "auto";
            gifEl.style.transform = `translate(-50%, -100%)${player.facing === -1 ? " scaleX(-1)" : ""}`;
          } else if (gifEl.style.display !== "none") {
            gifEl.style.display = "none";
          }
        }

        animationFrameId = requestAnimationFrame(gameLoop);
      };

      animationFrameId = requestAnimationFrame(gameLoop);

      // 5. 手势交互监听：移动端双指 Pinch 缩放、单指拖拽视口与家具微操
      let dragFurnitureItem = null;
      let dragOffset = { x: 0, y: 0 };

      const toWorldCoords = (clientX, clientY) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clickX = (clientX - rect.left) * scaleX;
        const clickY = (clientY - rect.top) * scaleY;
        const cam = camera.current;
        const worldX = cam.x + (clickX - canvas.width / 2) / cam.zoom;
        const worldY = cam.y + (clickY - canvas.height / 2) / cam.zoom;
        return { worldX, worldY };
      };

      const handlePointerDown = (e) => {
        const cam = camera.current;
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
        if (isEditModeRef.current) {
          const curSelId = selectedFurnitureIdRef.current;
          if (curSelId) {
            const activeF = furnituresRef.current.find((f) => f.id === curSelId);
            if (activeF) {
              // 1. 左上角回收删除角标
              if (Math.hypot(worldX - (activeF.x - 4), worldY - (activeF.y - 4)) < 18) {
                const nextList = furnituresRef.current.filter((f) => f.id !== curSelId);
                setFurnitures(nextList);
                saveLayout(nextList);
                setSelectedFurnitureId(null);
                return;
              }
              // 2. 右上角翻转角标
              if (Math.hypot(worldX - (activeF.x + activeF.w + 4), worldY - (activeF.y - 4)) < 18) {
                const nextList = furnituresRef.current.map((f) =>
                  f.id === curSelId ? { ...f, flipX: !f.flipX } : f
                );
                setFurnitures(nextList);
                saveLayout(nextList);
                return;
              }
              // 3. 左下角换贴图角标
              if (Math.hypot(worldX - (activeF.x - 4), worldY - (activeF.y + activeF.h + 4)) < 18) {
                openFurnitureTextureModal(activeF);
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

          // 检查是否点击了窗户 (直接唤起换窗景)
          if (
            worldX >= ROOM.winX && worldX <= ROOM.winX + ROOM.winW &&
            worldY >= ROOM.winY && worldY <= ROOM.winY + ROOM.winH
          ) {
            setTextureTarget({ key: `tex_${char?.id}_window`, ...BG_SPECS.window });
            return;
          }

          // 检查是否点击了照壁墙纸 (直接唤起换墙纸)
          if (
            worldX >= ROOM.x + 6 && worldX <= ROOM.x + ROOM.w - 6 &&
            worldY >= ROOM.y + 6 && worldY <= ROOM.y + ROOM.wallH
          ) {
            setTextureTarget({ key: `tex_${char?.id}_wall`, ...BG_SPECS.wall });
            return;
          }

          // 点在空旷处：解除选中，启动单指拖动平移视口
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
        if (distToPlayer < 56) {
          const greetings = [
            `“楼主在此，心自清宁。” 🌸`,
            `“今日风清气爽，愿同楼主闲坐半日。” ✨`,
            `“要为楼主续上一盏新茶么？” 🍵`,
            `“这间雅居由楼主精心布置，甚是趁心~” 🪵`
          ];
          say(greetings[Math.floor(Math.random() * greetings.length)]);
          return;
        }

        // 2. 点击窗户互动
        if (
          worldX >= ROOM.winX && worldX <= ROOM.winX + ROOM.winW &&
          worldY >= ROOM.winY && worldY <= ROOM.winY + ROOM.winH
        ) {
          player.interactFurnitureId = null;
          player.targetX = ROOM.winX + ROOM.winW / 2;
          player.targetY = ROOM.y + ROOM.wallH + 48;
          setTimeout(() => say("凭窗远眺，清风徐来，令人心旷神怡 🍃"), 350);
          return;
        }

        // 3. 点击各家具：走至家具旁并触发角色专属交互 GIF 与绑定特定发言
        for (let i = furnituresRef.current.length - 1; i >= 0; i--) {
          const item = furnituresRef.current[i];
          if (
            worldX >= item.x && worldX <= item.x + item.w &&
            worldY >= item.y && worldY <= item.y + item.h
          ) {
            const standX = Math.max(ROOM.x + 40, Math.min(ROOM.x + ROOM.w - 40, item.x + item.w / 2));
            const standY = item.isFloorDeco
              ? Math.max(ROOM.y + ROOM.wallH + 38, Math.min(ROOM.y + ROOM.h - 24, item.y + item.h * 0.65))
              : Math.min(ROOM.y + ROOM.h - 24, item.y + (item.footOffsetY || 0) + (item.footH || item.h) + 24);
            player.targetX = standX;
            player.targetY = standY;
            player.interactFurnitureId = item.id;

            setTimeout(() => {
              const latestItem = furnituresRef.current.find((f) => f.id === item.id) || item;
              if (latestItem.type === "censer") {
                roomParticles.censerLit = !roomParticles.censerLit;
              }
              const rawSpeech = typeof latestItem.interactSpeech === "string" ? latestItem.interactSpeech.trim() : "";
              if (rawSpeech) {
                const lines = rawSpeech.split(/[\n|｜]+/).map((s) => s.trim()).filter(Boolean);
                const chosen = lines.length > 0 ? lines[Math.floor(Math.random() * lines.length)] : rawSpeech;
                say(chosen, 4.5);
              } else if (latestItem.type === "censer") {
                say(roomParticles.censerLit ? "点燃沉香，青烟袅袅 🪔" : "熄了沉香，归于清宁 🍃");
              } else if (latestItem.type === "bed") {
                say("软榻温软，待倦时便可小憩片刻 🌙");
              } else if (latestItem.type === "tea_table") {
                say("沸泉初沸，且烹一壶新茶，与楼主共品 🍵");
              } else {
                say(`与【${latestItem.name || "雅室摆件"}】互动 ✨`);
              }
            }, 300);
            return;
          }
        }

        // 4. 点击地板寻路走动（脱离家具交互状态，恢复常规行走立绘）
        const clampedTargetX = Math.max(ROOM.x + 38, Math.min(ROOM.x + ROOM.w - 38, worldX));
        const clampedTargetY = Math.max(ROOM.y + ROOM.wallH + 36, Math.min(ROOM.y + ROOM.h - 22, worldY));
        player.interactFurnitureId = null;
        player.pose = "idle";
        player.targetX = clampedTargetX;
        player.targetY = clampedTargetY;
      };

      const handlePointerMove = (e) => {
        const cam = camera.current;

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
        if (isEditModeRef.current && dragFurnitureItem) {
          const newX = Math.round((worldX - dragOffset.x) / 8) * 8;
          const newY = Math.round((worldY - dragOffset.y) / 8) * 8;
          const clampedX = Math.max(ROOM.x + 10, Math.min(ROOM.x + ROOM.w - dragFurnitureItem.w - 10, newX));
          const clampedY = Math.max(ROOM.y + 90, Math.min(ROOM.y + ROOM.h - dragFurnitureItem.h - 8, newY));

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
        if (isEditModeRef.current && dragFurnitureItem) {
          saveLayout(furnituresRef.current);
          dragFurnitureItem = null;
        }
      };

      // 支持鼠标滚轮缩放 (PC端辅助测试双指缩放效果)
      const handleWheel = (e) => {
        e.preventDefault();
        const cam = camera.current;
        const delta = e.deltaY < 0 ? 1.08 : 0.92;
        cam.zoom = Math.max(0.75, Math.min(2.2, cam.zoom * delta));
      };

      canvas.addEventListener("pointerdown", handlePointerDown);
      canvas.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      canvas.addEventListener("wheel", handleWheel, { passive: false });

      return () => {
        isRunning = false;
        cancelAnimationFrame(animationFrameId);
        canvas.removeEventListener("pointerdown", handlePointerDown);
        canvas.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        canvas.removeEventListener("wheel", handleWheel);
      };
    }, [char?.id]);

    // 添加预设家具到房间
    const handleAddFurniture = (typeKey) => {
      const def = FURNITURE_DEFS[typeKey];
      if (!def) return;
      const newItem = normalizeFurnitureItem({
        id: `f_${Date.now()}`,
        type: typeKey,
        name: def.name,
        x: 310,
        y: 350,
        flipX: false,
        ...def
      });
      const nextList = [...furnituresRef.current, newItem];
      setFurnitures(nextList);
      saveLayout(nextList);
      setIsEditMode(true);
      setSelectedFurnitureId(newItem.id);
      setShowBuildDrawer(false);
    };

    // 重置摄像机视角
    const handleResetCamera = () => {
      camera.current.x = 380;
      camera.current.y = 390;
      camera.current.zoom = 1.0;
      camera.current.isFollowing = true;
    };

    const activeSelectedFurniture = furnitures.find((f) => f.id === selectedFurnitureId) || null;

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
      // 顶部导航栏
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 12px",
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
              cursor: "pointer"
            }
          },
          "‹ 返回"
        ),
        React.createElement(
          "div",
          {
            style: {
              color: "#F0E8D8",
              fontSize: "13.5px",
              fontWeight: "bold"
            }
          },
          `❖ ${char?.name || "名士"}雅室 ❖`
        ),
        React.createElement(
          "div",
          { style: { display: "flex", gap: "5px" } },
          React.createElement(
            "button",
            {
              onClick: () => {
                setCustomUploadName("自定义家具");
                setShowCustomUploadModal(true);
              },
              style: {
                background: "linear-gradient(135deg, #D97706, #B45309)",
                border: "none",
                borderRadius: "12px",
                padding: "4px 9px",
                color: "#fff",
                fontSize: "11px",
                fontWeight: "bold",
                cursor: "pointer"
              }
            },
            "+ 上传家具"
          ),
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
                padding: "4px 10px",
                color: "#fff",
                fontSize: "11px",
                fontWeight: "bold",
                cursor: "pointer"
              }
            },
            isEditMode ? "✓ 完成" : "🔨 营造"
          ),
          React.createElement(
            "button",
            {
              onClick: () => setShowTextureHubModal(true),
              style: {
                background: "rgba(255, 255, 255, 0.14)",
                border: "1px solid #D6A86E",
                borderRadius: "12px",
                padding: "4px 9px",
                color: "#fff",
                fontSize: "11px",
                fontWeight: "bold",
                cursor: "pointer"
              }
            },
            "🎨 换贴图"
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

        // 家具交互绑定的动态角色 GIF 同步渲染层 (确保多帧 GIF 动图 100% 流畅播放并跟随镜头缩放平移)
        React.createElement("img", {
          ref: interactGifDomRef,
          alt: "",
          style: {
            position: "absolute",
            display: "none",
            pointerEvents: "none",
            zIndex: 15,
            userSelect: "none",
            WebkitUserSelect: "none"
          }
        }),

        // 右上角浮动镜头控制按钮
        React.createElement(
          "div",
          {
            style: {
              position: "absolute",
              top: "12px",
              right: "12px",
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
                background: "rgba(30, 24, 20, 0.8)",
                border: "1px solid #D6A86E",
                borderRadius: "16px",
                padding: "4px 9px",
                color: "#F0E8D8",
                fontSize: "10.5px",
                cursor: "pointer"
              }
            },
            "🎯 跟随"
          ),
          React.createElement(
            "button",
            {
              onClick: () => {
                camera.current.zoom = Math.min(2.2, camera.current.zoom + 0.25);
              },
              style: {
                background: "rgba(30, 24, 20, 0.8)",
                border: "1px solid #D6A86E",
                borderRadius: "16px",
                padding: "4px 9px",
                color: "#F0E8D8",
                fontSize: "10.5px",
                cursor: "pointer"
              }
            },
            "🔍 放大"
          ),
          React.createElement(
            "button",
            {
              onClick: () => {
                camera.current.zoom = Math.max(0.75, camera.current.zoom - 0.25);
              },
              style: {
                background: "rgba(30, 24, 20, 0.8)",
                border: "1px solid #D6A86E",
                borderRadius: "16px",
                padding: "4px 9px",
                color: "#F0E8D8",
                fontSize: "10.5px",
                cursor: "pointer"
              }
            },
            "🔎 缩小"
          ),
          React.createElement(
            "button",
            {
              onClick: () => setShowFloorDrawer(!showFloorDrawer),
              style: {
                background: "rgba(30, 24, 20, 0.8)",
                border: "1px solid #D6A86E",
                borderRadius: "16px",
                padding: "4px 9px",
                color: "#F0E8D8",
                fontSize: "10.5px",
                cursor: "pointer"
              }
            },
            "🪵 地板"
          )
        ),

        // 左上角营造快捷工具条
        isEditMode && React.createElement(
          "div",
          {
            style: {
              position: "absolute",
              top: "12px",
              left: "12px",
              background: "rgba(30, 24, 20, 0.88)",
              border: "1px solid #D6724B",
              borderRadius: "14px",
              padding: "5px 10px",
              color: "#F5EFE6",
              fontSize: "11px",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "6px",
              zIndex: 20,
              maxWidth: "80%"
            }
          },
          React.createElement(
            "button",
            {
              onClick: () => setShowBuildDrawer(!showBuildDrawer),
              style: {
                background: "linear-gradient(135deg, #D6724B, #B85832)",
                border: "none",
                borderRadius: "8px",
                padding: "3px 8px",
                color: "#fff",
                fontSize: "10.5px",
                fontWeight: "bold",
                cursor: "pointer"
              }
            },
            "📦 预设家具库"
          ),
          React.createElement(
            "button",
            {
              onClick: () => {
                setCustomUploadName("自定义家具");
                setShowCustomUploadModal(true);
              },
              style: {
                background: "linear-gradient(135deg, #D97706, #B45309)",
                border: "none",
                borderRadius: "8px",
                padding: "3px 8px",
                color: "#fff",
                fontSize: "10.5px",
                fontWeight: "bold",
                cursor: "pointer"
              }
            },
            "✨ +上传新家具"
          ),
          React.createElement(
            "button",
            {
              onClick: () => setShowTextureHubModal(true),
              style: {
                background: "rgba(255,255,255,0.14)",
                border: "1px solid #D6A86E",
                borderRadius: "8px",
                padding: "3px 8px",
                color: "#fff",
                fontSize: "10.5px",
                cursor: "pointer"
              }
            },
            "🎨 全屋换贴图"
          ),
          React.createElement(
            "button",
            {
              onClick: handleResetDefaultFurnitures,
              style: {
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(214,168,110,0.4)",
                borderRadius: "8px",
                padding: "3px 8px",
                color: "#E8DFC8",
                fontSize: "10.5px",
                cursor: "pointer"
              }
            },
            "↺ 恢复初始家具"
          )
        ),

        // 底部选中家具悬浮微操栏 (支持换贴图/绑GIF发言、翻转、缩放、一键回收)
        isEditMode && activeSelectedFurniture && React.createElement(
          "div",
          {
            style: {
              position: "absolute",
              bottom: "14px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(34, 26, 20, 0.94)",
              border: "1.5px solid #D6724B",
              borderRadius: "16px",
              padding: "8px 12px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              zIndex: 30,
              width: "92%",
              maxWidth: "410px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)"
            }
          },
          React.createElement(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11.5px", color: "#F5EFE6" } },
            React.createElement(
              "span",
              { style: { fontWeight: "bold", color: "#FBBF24" } },
              `已选中：【${activeSelectedFurniture.name}】 (推荐贴图 ${activeSelectedFurniture.w * 2}×${activeSelectedFurniture.h * 2})`
            ),
            React.createElement(
              "button",
              {
                onClick: () => setSelectedFurnitureId(null),
                style: { background: "none", border: "none", color: "#D6C7B2", fontSize: "13px", cursor: "pointer" }
              },
              "✕"
            )
          ),
          React.createElement(
            "div",
            { style: { display: "flex", gap: "6px", justifyContent: "space-between" } },
            React.createElement(
              "button",
              {
                onClick: () => openFurnitureTextureModal(activeSelectedFurniture),
                style: {
                  flex: 1.3,
                  background: "linear-gradient(135deg, #D97706, #B45309)",
                  border: "none",
                  borderRadius: "8px",
                  padding: "5px 6px",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: "bold",
                  cursor: "pointer"
                }
              },
              "🎨 贴图/交互GIF"
            ),
            React.createElement(
              "button",
              {
                onClick: () => handleFlipFurniture(activeSelectedFurniture.id),
                style: {
                  flex: 0.9,
                  background: "#2563EB",
                  border: "none",
                  borderRadius: "8px",
                  padding: "5px 6px",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: "bold",
                  cursor: "pointer"
                }
              },
              "⇄ 翻转"
            ),
            React.createElement(
              "button",
              {
                onClick: () => handleScaleFurniture(1.12),
                style: {
                  background: "rgba(255,255,255,0.15)",
                  border: "1px solid #D6A86E",
                  borderRadius: "8px",
                  padding: "5px 7px",
                  color: "#fff",
                  fontSize: "11px",
                  cursor: "pointer"
                }
              },
              "➕放大"
            ),
            React.createElement(
              "button",
              {
                onClick: () => handleScaleFurniture(0.88),
                style: {
                  background: "rgba(255,255,255,0.15)",
                  border: "1px solid #D6A86E",
                  borderRadius: "8px",
                  padding: "5px 7px",
                  color: "#fff",
                  fontSize: "11px",
                  cursor: "pointer"
                }
              },
              "➖缩小"
            ),
            React.createElement(
              "button",
              {
                onClick: () => handleRecycleFurniture(activeSelectedFurniture.id),
                style: {
                  flex: 0.9,
                  background: "#DC2626",
                  border: "none",
                  borderRadius: "8px",
                  padding: "5px 6px",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: "bold",
                  cursor: "pointer"
                }
              },
              "🗑️ 回收"
            )
          )
        )
      ),

      // 4. 百宝营造阁 (预设家具库 + 自定义上传入口)
      showBuildDrawer && React.createElement(
        "div",
        {
          style: {
            background: "linear-gradient(180deg, #FBF8F2 0%, #F3EBD8 100%)",
            borderTop: "2px solid #D6A86E",
            padding: "12px 14px 18px",
            zIndex: 100,
            boxShadow: "0 -6px 25px rgba(0,0,0,0.4)"
          }
        },
        React.createElement(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" } },
          React.createElement("div", { style: { fontSize: "13px", fontWeight: "bold", color: "#5C4129" } }, "❖ 百宝营造阁 · 点击增设家具"),
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
          { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", marginBottom: "8px" } },
          ["tea_table", "bed", "censer", "screen", "guqin_desk", "bookshelf", "carpet"].map((key) => {
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
                  padding: "6px 4px",
                  textAlign: "center",
                  cursor: "pointer"
                }
              },
              React.createElement("div", { style: { fontSize: "17px" } }, def.icon),
              React.createElement("div", { style: { fontSize: "10.5px", fontWeight: "bold", color: "#5C4129" } }, def.name),
              React.createElement("div", { style: { fontSize: "9px", color: "#8C7255" } }, def.recomSize)
            );
          }),
          React.createElement(
            "button",
            {
              onClick: () => {
                setCustomUploadName("自定义家具");
                setShowCustomUploadModal(true);
              },
              style: {
                background: "linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)",
                border: "1.5px dashed #D97706",
                borderRadius: "10px",
                padding: "6px 4px",
                textAlign: "center",
                cursor: "pointer"
              }
            },
            React.createElement("div", { style: { fontSize: "17px" } }, "✨"),
            React.createElement("div", { style: { fontSize: "10.5px", fontWeight: "bold", color: "#B45309" } }, "+自定义家具"),
            React.createElement("div", { style: { fontSize: "9px", color: "#D97706" } }, "上传本地图片")
          )
        )
      ),

      // 5. 全屋家具/墙面/窗景一键换贴图与回收总览弹窗
      showTextureHubModal && React.createElement(
        "div",
        {
          style: {
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100005,
            padding: "16px"
          },
          onClick: () => setShowTextureHubModal(false)
        },
        React.createElement(
          "div",
          {
            style: {
              background: "linear-gradient(180deg, #FDFBF7 0%, #F4ECE0 100%)",
              border: "2px solid #D6A86E",
              borderRadius: "18px",
              padding: "16px",
              width: "100%",
              maxWidth: "400px",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
            },
            onClick: (e) => e.stopPropagation()
          },
          React.createElement(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" } },
            React.createElement("div", { style: { fontSize: "14px", fontWeight: "bold", color: "#5C4129" } }, "🎨 全屋贴图更换与交互管理"),
            React.createElement(
              "button",
              {
                onClick: () => setShowTextureHubModal(false),
                style: { background: "none", border: "none", fontSize: "16px", color: "#8C7255", cursor: "pointer" }
              },
              "✕"
            )
          ),
          React.createElement(
            "div",
            { style: { overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", paddingRight: "2px" } },
            // 墙面、窗景、地板三项基础结构
            [
              { key: `tex_${char?.id}_wall`, icon: "🏞️", ...BG_SPECS.wall },
              { key: `tex_${char?.id}_window`, icon: "🪟", ...BG_SPECS.window },
              { key: `tex_${char?.id}_floor`, type: "floor", icon: "🪵", ...BG_SPECS.floor }
            ].map((bg) =>
              React.createElement(
                "div",
                {
                  key: bg.key,
                  style: {
                    background: "#fff",
                    border: "1px solid #E6D4BE",
                    borderRadius: "10px",
                    padding: "8px 10px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }
                },
                React.createElement(
                  "div",
                  null,
                  React.createElement("div", { style: { fontSize: "12px", fontWeight: "bold", color: "#5C4129" } }, `${bg.icon} ${bg.name}`),
                  React.createElement("div", { style: { fontSize: "10px", color: "#D6724B" } }, `推荐尺寸: ${bg.recomSize} (${bg.recomRatio})`)
                ),
                React.createElement(
                  "button",
                  {
                    onClick: () => {
                      setShowTextureHubModal(false);
                      setTextureTarget(bg);
                    },
                    style: {
                      background: "linear-gradient(135deg, #D6724B, #B85832)",
                      border: "none",
                      borderRadius: "8px",
                      padding: "5px 10px",
                      color: "#fff",
                      fontSize: "10.5px",
                      fontWeight: "bold",
                      cursor: "pointer"
                    }
                  },
                  "换贴图"
                )
              )
            ),

            // 房间内所有现有家具列表 (支持换贴图/绑定GIF与发言 + 回收)
            furnitures.map((item) => {
              const def = FURNITURE_DEFS[item.type] || FURNITURE_DEFS.custom_medium;
              const hasGif = gifVersion >= 0 && gifUrlPool.current.has(item.id);
              const hasSpeech = Boolean(item.interactSpeech && item.interactSpeech.trim());
              return React.createElement(
                "div",
                {
                  key: item.id,
                  style: {
                    background: "#fff",
                    border: "1px solid #E6D4BE",
                    borderRadius: "10px",
                    padding: "8px 10px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }
                },
                React.createElement(
                  "div",
                  { style: { flex: 1, paddingRight: "6px" } },
                  React.createElement(
                    "div",
                    { style: { fontSize: "12px", fontWeight: "bold", color: "#5C4129", display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" } },
                    `${def.icon || "🪑"} ${item.name}`,
                    hasGif && React.createElement("span", { style: { fontSize: "9.5px", background: "#FEF3C7", color: "#B45309", border: "1px solid #F59E0B", borderRadius: "6px", padding: "0 4px" } }, "🎭GIF"),
                    hasSpeech && React.createElement("span", { style: { fontSize: "9.5px", background: "#DCFCE7", color: "#15803D", border: "1px solid #86EFAC", borderRadius: "6px", padding: "0 4px" } }, "💬发言")
                  ),
                  React.createElement("div", { style: { fontSize: "10px", color: "#D6724B" } }, `推荐尺寸: ${item.w * 2} × ${item.h * 2} px (${def.recomRatio})`)
                ),
                React.createElement(
                  "div",
                  { style: { display: "flex", gap: "6px", flexShrink: 0 } },
                  React.createElement(
                    "button",
                    {
                      onClick: () => {
                        setShowTextureHubModal(false);
                        openFurnitureTextureModal(item);
                      },
                      style: {
                        background: "linear-gradient(135deg, #D97706, #B45309)",
                        border: "none",
                        borderRadius: "8px",
                        padding: "5px 9px",
                        color: "#fff",
                        fontSize: "10.5px",
                        fontWeight: "bold",
                        cursor: "pointer"
                      }
                    },
                    "贴图/交互"
                  ),
                  React.createElement(
                    "button",
                    {
                      onClick: () => handleRecycleFurniture(item.id),
                      style: {
                        background: "#FEE2E2",
                        border: "1px solid #FCA5A5",
                        borderRadius: "8px",
                        padding: "5px 8px",
                        color: "#DC2626",
                        fontSize: "10.5px",
                        fontWeight: "bold",
                        cursor: "pointer"
                      }
                    },
                    "回收"
                  )
                )
              );
            })
          )
        )
      ),

      // 6. 自定义上传新家具模态弹窗 (支持同步绑定角色GIF与特定发言)
      showCustomUploadModal && React.createElement(
        "div",
        {
          style: {
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100010,
            padding: "16px"
          },
          onClick: () => setShowCustomUploadModal(false)
        },
        React.createElement(
          "div",
          {
            style: {
              background: "linear-gradient(180deg, #FDFBF7 0%, #F4ECE0 100%)",
              border: "2px solid #D6A86E",
              borderRadius: "18px",
              padding: "15px 16px",
              width: "100%",
              maxWidth: "370px",
              maxHeight: "86vh",
              overflowY: "auto",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
            },
            onClick: (e) => e.stopPropagation()
          },
          React.createElement(
            "div",
            { style: { fontSize: "14px", fontWeight: "bold", color: "#5C4129", marginBottom: "8px" } },
            "✨ 上传自定义新家具"
          ),
          React.createElement(
            "div",
            { style: { marginBottom: "8px" } },
            React.createElement("div", { style: { fontSize: "11px", color: "#6B5238", marginBottom: "3px" } }, "家具名称："),
            React.createElement("input", {
              type: "text",
              value: customUploadName,
              onChange: (e) => setCustomUploadName(e.target.value),
              placeholder: "例如：青铜酒樽 / 懒人软垫",
              style: {
                width: "100%",
                padding: "6px 10px",
                borderRadius: "8px",
                border: "1px solid #D6C7B2",
                fontSize: "12px",
                color: "#5C4129",
                boxSizing: "border-box"
              }
            })
          ),
          React.createElement(
            "div",
            { style: { marginBottom: "8px" } },
            React.createElement("div", { style: { fontSize: "11px", color: "#6B5238", marginBottom: "3px" } }, "规格与碰撞类型（附推荐贴图大小）："),
            React.createElement(
              "div",
              { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" } },
              [
                { key: "custom_small", label: "🪴 小型摆件", size: "170×190 (有碰撞)" },
                { key: "custom_medium", label: "🪑 中型案几", size: "300×220 (有碰撞)" },
                { key: "custom_large", label: "🏯 大型榻屏", size: "330×350 (有碰撞)" },
                { key: "carpet", label: "🧶 地面毯垫", size: "440×260 (可踩踏)" }
              ].map((opt) => {
                const active = customUploadPreset === opt.key;
                return React.createElement(
                  "div",
                  {
                    key: opt.key,
                    onClick: () => setCustomUploadPreset(opt.key),
                    style: {
                      background: active ? "#FFF7ED" : "#fff",
                      border: active ? "1.5px solid #D97706" : "1px solid #E6D4BE",
                      borderRadius: "8px",
                      padding: "5px 6px",
                      cursor: "pointer"
                    }
                  },
                  React.createElement("div", { style: { fontSize: "11px", fontWeight: "bold", color: "#5C4129" } }, opt.label),
                  React.createElement("div", { style: { fontSize: "9.5px", color: "#D6724B" } }, `推荐 ${opt.size}`)
                );
              })
            )
          ),
          React.createElement(
            "div",
            { style: { marginBottom: "8px", background: "rgba(214,168,110,0.12)", border: "1px solid #E6D4BE", borderRadius: "10px", padding: "7px 9px" } },
            React.createElement(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
              React.createElement("div", { style: { fontSize: "11px", fontWeight: "bold", color: "#5C4129" } }, "🎭 绑定角色交互 GIF（可选）："),
              React.createElement(
                "div",
                { style: { display: "flex", gap: "5px" } },
                customUploadGifDataUrl && React.createElement(
                  "button",
                  {
                    onClick: () => setCustomUploadGifDataUrl(null),
                    style: { background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: "6px", padding: "2px 6px", color: "#DC2626", fontSize: "10px", cursor: "pointer" }
                  },
                  "清除"
                ),
                React.createElement(
                  "button",
                  {
                    onClick: () => customFurnitureGifInputRef.current && customFurnitureGifInputRef.current.click(),
                    style: { background: "#FEF3C7", border: "1px solid #D97706", borderRadius: "6px", padding: "2px 8px", color: "#B45309", fontSize: "10.5px", fontWeight: "bold", cursor: "pointer" }
                  },
                  customUploadGifDataUrl ? "✓ 已选GIF (点击更换)" : "+ 选择角色GIF"
                )
              )
            ),
            React.createElement("input", {
              type: "file",
              ref: customFurnitureGifInputRef,
              accept: "image/gif,image/*",
              onChange: handleCustomFurnitureGifSelect,
              style: { display: "none" }
            })
          ),
          React.createElement(
            "div",
            { style: { marginBottom: "10px" } },
            React.createElement("div", { style: { fontSize: "11px", fontWeight: "bold", color: "#5C4129", marginBottom: "3px" } }, "💬 绑定交互角色特定发言（可选，多行随机触发）："),
            React.createElement("textarea", {
              rows: 2,
              value: customUploadSpeech,
              onChange: (e) => setCustomUploadSpeech(e.target.value),
              placeholder: "例如：这尊酒樽造型别致，且与楼主共饮一杯~",
              style: {
                width: "100%",
                padding: "6px 8px",
                borderRadius: "8px",
                border: "1px solid #D6C7B2",
                fontSize: "11.5px",
                color: "#5C4129",
                boxSizing: "border-box",
                resize: "none"
              }
            })
          ),
          React.createElement(
            "div",
            { style: { display: "flex", gap: "8px", justifyContent: "flex-end" } },
            React.createElement(
              "button",
              {
                onClick: () => setShowCustomUploadModal(false),
                style: {
                  background: "#EDE4D4",
                  border: "1px solid #D6C7B2",
                  borderRadius: "10px",
                  padding: "6px 12px",
                  color: "#6B5238",
                  fontSize: "11px",
                  cursor: "pointer"
                }
              },
              "取消"
            ),
            React.createElement(
              "button",
              {
                onClick: () => customFurnitureInputRef.current && customFurnitureInputRef.current.click(),
                style: {
                  background: "linear-gradient(135deg, #D97706, #B45309)",
                  border: "none",
                  borderRadius: "10px",
                  padding: "6px 14px",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: "bold",
                  cursor: "pointer"
                }
              },
              "📂 选择家具贴图并摆放"
            )
          ),
          React.createElement("input", {
            type: "file",
            ref: customFurnitureInputRef,
            accept: "image/*",
            onChange: handleCustomFurnitureUpload,
            style: { display: "none" }
          })
        )
      ),

      // 7. 单个构件材质贴图更换 + 绑定角色交互 GIF & 特定发言弹窗
      textureTarget && React.createElement(
        "div",
        {
          style: {
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100010,
            padding: "16px"
          },
          onClick: () => {
            if (textureTarget.furnitureId) {
              persistCurrentTargetSpeech(editingInteractSpeech);
            }
            setTextureTarget(null);
          }
        },
        React.createElement(
          "div",
          {
            style: {
              background: "linear-gradient(180deg, #FDFBF7 0%, #F4ECE0 100%)",
              border: "2px solid #D6A86E",
              borderRadius: "18px",
              padding: "15px 16px",
              width: "100%",
              maxWidth: "370px",
              maxHeight: "86vh",
              overflowY: "auto",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
            },
            onClick: (e) => e.stopPropagation()
          },
          React.createElement(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" } },
            React.createElement(
              "div",
              { style: { fontSize: "13.5px", fontWeight: "bold", color: "#5C4129" } },
              `🎨 贴图与交互: 【${textureTarget.name}】`
            ),
            React.createElement(
              "button",
              {
                onClick: () => {
                  if (textureTarget.furnitureId) {
                    persistCurrentTargetSpeech(editingInteractSpeech);
                  }
                  setTextureTarget(null);
                },
                style: { background: "none", border: "none", fontSize: "15px", color: "#8C7255", cursor: "pointer" }
              },
              "✕"
            )
          ),

          // 模块一：构件/家具自身外观贴图
          React.createElement(
            "div",
            {
              style: {
                background: "rgba(214, 168, 110, 0.14)",
                border: "1px solid rgba(214, 168, 110, 0.4)",
                borderRadius: "10px",
                padding: "8px 10px",
                marginBottom: "10px",
                fontSize: "11px",
                color: "#5C4129",
                lineHeight: "1.5"
              }
            },
            React.createElement("div", { style: { fontWeight: "bold", color: "#D6724B" } }, `📐 推荐尺寸: ${textureTarget.recomSize} (${textureTarget.recomRatio})`),
            React.createElement("div", { style: { color: "#8C7255", marginBottom: "6px" } }, textureTarget.recomDesc),
            React.createElement(
              "div",
              { style: { display: "flex", gap: "6px", justifyContent: "flex-end" } },
              React.createElement(
                "button",
                {
                  onClick: handleResetTexture,
                  style: {
                    background: "#EDE4D4",
                    border: "1px solid #D6C7B2",
                    borderRadius: "8px",
                    padding: "4px 10px",
                    color: "#6B5238",
                    fontSize: "10.5px",
                    fontWeight: "bold",
                    cursor: "pointer"
                  }
                },
                "恢复默认贴图"
              ),
              React.createElement(
                "button",
                {
                  onClick: () => textureInputRef.current && textureInputRef.current.click(),
                  style: {
                    background: "linear-gradient(135deg, #D6724B, #B85832)",
                    border: "none",
                    borderRadius: "8px",
                    padding: "4px 12px",
                    color: "#fff",
                    fontSize: "10.5px",
                    fontWeight: "bold",
                    cursor: "pointer"
                  }
                },
                "+ 上传外观贴图"
              )
            )
          ),

          // 模块二 & 三：当目标为家具时，支持绑定角色交互 GIF 图与特定发言
          textureTarget.furnitureId && React.createElement(
            React.Fragment,
            null,
            React.createElement(
              "div",
              {
                style: {
                  background: "#FFFBEB",
                  border: "1px solid #FDE68A",
                  borderRadius: "10px",
                  padding: "8px 10px",
                  marginBottom: "10px",
                  fontSize: "11px",
                  color: "#5C4129"
                }
              },
              React.createElement(
                "div",
                { style: { fontWeight: "bold", color: "#B45309", marginBottom: "4px" } },
                "🎭 绑定角色交互 GIF 图（点击该家具互动时展示）"
              ),
              gifVersion >= 0 && gifUrlPool.current.has(textureTarget.furnitureId)
                ? React.createElement(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" } },
                    React.createElement("img", {
                      src: gifUrlPool.current.get(textureTarget.furnitureId),
                      alt: "角色交互GIF预览",
                      style: {
                        height: "54px",
                        width: "auto",
                        borderRadius: "8px",
                        border: "1px solid #F59E0B",
                        background: "rgba(255,255,255,0.8)"
                      }
                    }),
                    React.createElement("span", { style: { fontSize: "10.5px", color: "#15803D", fontWeight: "bold" } }, "✓ 已绑定角色交互动图")
                  )
                : React.createElement(
                    "div",
                    { style: { fontSize: "10px", color: "#8C7255", marginBottom: "6px" } },
                    "未绑定（互动时保持角色默认立绘，支持透明背景 GIF / PNG）"
                  ),
              React.createElement(
                "div",
                { style: { display: "flex", gap: "6px", justifyContent: "flex-end" } },
                gifVersion >= 0 && gifUrlPool.current.has(textureTarget.furnitureId) && React.createElement(
                  "button",
                  {
                    onClick: handleResetInteractGif,
                    style: {
                      background: "#FEE2E2",
                      border: "1px solid #FCA5A5",
                      borderRadius: "8px",
                      padding: "4px 10px",
                      color: "#DC2626",
                      fontSize: "10.5px",
                      fontWeight: "bold",
                      cursor: "pointer"
                    }
                  },
                  "清除GIF"
                ),
                React.createElement(
                  "button",
                  {
                    onClick: () => interactGifInputRef.current && interactGifInputRef.current.click(),
                    style: {
                      background: "linear-gradient(135deg, #D97706, #B45309)",
                      border: "none",
                      borderRadius: "8px",
                      padding: "4px 12px",
                      color: "#fff",
                      fontSize: "10.5px",
                      fontWeight: "bold",
                      cursor: "pointer"
                    }
                  },
                  "+ 上传角色GIF"
                )
              ),
              React.createElement("input", {
                type: "file",
                ref: interactGifInputRef,
                accept: "image/gif,image/*",
                onChange: handleInteractGifUpload,
                style: { display: "none" }
              })
            ),

            React.createElement(
              "div",
              {
                style: {
                  background: "rgba(255,255,255,0.75)",
                  border: "1px solid #E6D4BE",
                  borderRadius: "10px",
                  padding: "8px 10px",
                  marginBottom: "10px"
                }
              },
              React.createElement(
                "div",
                { style: { fontSize: "11px", fontWeight: "bold", color: "#5C4129", marginBottom: "4px" } },
                "💬 绑定该交互下角色特定发言（支持多行随机触发）："
              ),
              React.createElement("textarea", {
                rows: 2,
                value: editingInteractSpeech,
                onChange: (e) => setEditingInteractSpeech(e.target.value),
                placeholder: "输入点击此家具时角色的专属台词（换行或用 | 分隔可设置多句随机台词）",
                style: {
                  width: "100%",
                  padding: "6px 8px",
                  borderRadius: "8px",
                  border: "1px solid #D6C7B2",
                  fontSize: "11.5px",
                  color: "#5C4129",
                  boxSizing: "border-box",
                  resize: "none"
                }
              })
            )
          ),

          React.createElement(
            "div",
            { style: { display: "flex", justifyContent: "flex-end" } },
            React.createElement(
              "button",
              {
                onClick: () => {
                  if (textureTarget.furnitureId) {
                    persistCurrentTargetSpeech(editingInteractSpeech);
                  }
                  setTextureTarget(null);
                },
                style: {
                  width: "100%",
                  background: "linear-gradient(135deg, #10B981, #059669)",
                  border: "none",
                  borderRadius: "10px",
                  padding: "7px 14px",
                  color: "#fff",
                  fontSize: "11.5px",
                  fontWeight: "bold",
                  cursor: "pointer"
                }
              },
              "✓ 保存交互与贴图设置"
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

      // 8. 地板材质抽屉
      showFloorDrawer && React.createElement(
        "div",
        {
          style: {
            background: "linear-gradient(180deg, #FBF8F2 0%, #F3EBD8 100%)",
            borderTop: "2px solid #D6A86E",
            padding: "12px 16px 20px",
            zIndex: 100,
            boxShadow: "0 -8px 30px rgba(0,0,0,0.5)"
          }
        },
        React.createElement(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" } },
          React.createElement("div", { style: { fontSize: "13px", fontWeight: "bold", color: "#5C4129" } }, "❖ 地板铺设"),
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
          { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "10px" } },
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
                  borderRadius: "10px",
                  padding: "6px 4px",
                  textAlign: "center",
                  cursor: "pointer"
                }
              },
              React.createElement("div", { style: { fontSize: "17px" } }, floor.icon),
              React.createElement("div", { style: { fontSize: "10.5px", fontWeight: "bold", color: "#5C4129" } }, floor.name)
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
              padding: "6px 12px",
              color: currentFloorId === "custom" ? "#fff" : "#6B5238",
              fontSize: "11px",
              fontWeight: "bold",
              cursor: "pointer"
            }
          },
          currentFloorId === "custom" ? "✨ 已应用自定义地砖 (点击更换/重置)" : "+ 上传自定义地砖贴图 (推荐 256×256)"
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
