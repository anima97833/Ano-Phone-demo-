/**
 * 心纸居 · 密探专属2.5D交互小房间系统 (Agent25DPrivateRoom & RoomSelectModal)
 * 纯原生 Canvas 2D 轻量化微立体引擎，支持走动寻路、家具互动、材质铺地与持久化
 */
(function () {
  const { useState, useEffect, useRef } = React;

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
  // 1. 2.5D 密探专属房间主组件 (Agent25DPrivateRoomModal)
  // =========================================================================
  const Agent25DPrivateRoomModal = ({ char, onClose }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const fileInputRef = useRef(null);


    const [speechText, setSpeechText] = useState("");
    const [speechTimer, setSpeechTimer] = useState(null);

    // 装修控制抽屉
    const [showDecorDrawer, setShowDecorDrawer] = useState(false);
    const [currentFloorId, setCurrentFloorId] = useState("wood");
    const [customFloorPattern, setCustomFloorPattern] = useState(null);

    // 从 localStorage 读取该密探专属房间配置
    useEffect(() => {
      try {
        if (!char || !char.id) return;
        const saved = JSON.parse(localStorage.getItem(`t8_agent_room_${char.id}`) || "{}");
        if (saved.floorId) setCurrentFloorId(saved.floorId);
        if (saved.customFloorPattern) setCustomFloorPattern(saved.customFloorPattern);
      } catch (e) {
        console.warn("读取房间配置失败:", e);
      }
    }, [char?.id]);

    if (!char) return null;

  // 保存房间配置
  const saveRoomConfig = (floorId, customPattern) => {
    try {
      if (!char || !char.id) return;
      const data = {
        floorId: floorId !== undefined ? floorId : currentFloorId,
        customFloorPattern: customPattern !== undefined ? customPattern : customFloorPattern,
        updatedAt: Date.now()
      };
      localStorage.setItem(`t8_agent_room_${char.id}`, JSON.stringify(data));
    } catch (e) {
      console.warn("保存房间配置失败:", e);
    }
  };

  // 切换地板
  const handleSelectFloor = (floorId) => {
    setCurrentFloorId(floorId);
    setCustomFloorPattern(null);
    saveRoomConfig(floorId, null);
  };

  // 上传自定义地砖贴图
  const handleCustomFloorUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      setCustomFloorPattern(base64);
      setCurrentFloorId("custom");
      saveRoomConfig("custom", base64);
    };
    reader.readAsDataURL(file);
  };

  // 核心引擎状态与渲染循环
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let animationFrameId;
    let isRunning = true;

    // 房间几何范围 (逻辑分辨率 760 x 820)
    const ROOM = {
      x: 100,
      y: 130,
      w: 560,
      h: 460
    };

    // 预载人物头像图片
    let avatarImg = null;
    if (char && char.avatar) {
        const img = new Image();
        img.src = char.avatar;
        img.onload = () => { avatarImg = img; };
      }

      // 自定义地砖图片缓存
      let customPatternImg = null;
      let customCanvasPattern = null;
      if (customFloorPattern) {
        const pImg = new Image();
        pImg.src = customFloorPattern;
        pImg.onload = () => {
          customPatternImg = pImg;
          try {
            customCanvasPattern = ctx.createPattern(pImg, "repeat");
          } catch (e) { }
        };
      }

      // 房间内物件与名士状态
      const roomState = {
        censerLit: true,
        censerSmoke: [],
        particles: []
      };

      // 小人实体
      const player = {
        x: 380,
        y: 380,
        targetX: null,
        targetY: null,
        speed: 180,
        facing: 1, // 1: right, -1: left
        isMoving: false,
        walkCycle: 0,
        pose: "idle", // 'idle' | 'sitting_tea' | 'sleeping_bed'
        bubbleText: `楼主，欢迎来到我的专属小居~ ✨`,
        bubbleTimer: 4.0
      };

      const say = (text, duration = 3.5) => {
        player.bubbleText = text;
        player.bubbleTimer = duration;
      };

      // 交互家具清单
      const furnitureList = [
        {
          id: "tea_table",
          name: "古雅茶案",
          hitBox: { x: 230, y: 280, w: 180, h: 100 },
          standPoint: { x: 320, y: 395 },
          interactRadius: 80,
          onInteract() {
            if (player.pose === "sitting_tea") {
              player.pose = "idle";
              player.y = 410;
              say("茶甘回味，舒心惬意。");
            } else {
              player.pose = "sitting_tea";
              player.x = 320;
              player.y = 350;
              player.facing = 1;
              say("沸泉初沸，且烹一壶新茶，与楼主共品 🍵");
            }
          }
        },
        {
          id: "bed",
          name: "罗汉软榻",
          hitBox: { x: 460, y: 230, w: 165, h: 180 },
          standPoint: { x: 450, y: 360 },
          interactRadius: 85,
          onInteract() {
            if (player.pose === "sleeping_bed") {
              player.pose = "idle";
              player.x = 440;
              player.y = 380;
              say("伸个懒腰，神清气爽！✨");
            } else {
              player.pose = "sleeping_bed";
              player.x = 520;
              player.y = 320;
              say("卧榻小憩，沉香幽幽入梦来... 🌙", 4.5);
            }
          }
        },
        {
          id: "censer",
          name: "博山香炉",
          hitBox: { x: 125, y: 250, w: 70, h: 90 },
          standPoint: { x: 195, y: 350 },
          interactRadius: 80,
          onInteract() {
            roomState.censerLit = !roomState.censerLit;
            if (roomState.censerLit) {
              say("点燃沉香，青烟袅袅，幽香满室 🪔");
            } else {
              say("熄了沉香，归于清宁 🍃");
            }
          }
        }
      ];

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

      // 绘制房间背景（墙壁、窗棂、透光、地板）
      const drawRoomBackground = (now) => {
        ctx.fillStyle = "#2C241E";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 房间古木框架外壳
        drawRoundedRect(ROOM.x - 12, ROOM.y - 12, ROOM.w + 24, ROOM.h + 24, 20, "#543C28", "#332114", 4);
        drawRoundedRect(ROOM.x + 6, ROOM.y + 6, ROOM.w - 12, ROOM.h - 12, 10, "#E8DFD0", "#3E2919", 3);

        // 上方素雅宣纸照壁
        drawRoundedRect(ROOM.x + 6, ROOM.y + 6, ROOM.w - 12, 115, 6, "#E5DAC8", "#6E5034", 2);

        // 雕花窗棂与古风窗格
        const winX = ROOM.x + 230;
        const winY = ROOM.y + 16;
        const winW = 180;
        const winH = 80;
        drawRoundedRect(winX, winY, winW, winH, 4, "#F4EDE1", "#5C3E25", 3);

        // 窗格横竖条纹
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

        // 窗外晨曦微光投射光束 (阳光斜映到地板上)
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(winX, winY + winH);
        ctx.lineTo(winX + winW, winY + winH);
        ctx.lineTo(winX + winW + 110, ROOM.y + ROOM.h - 40);
        ctx.lineTo(winX - 60, ROOM.y + ROOM.h - 40);
        ctx.closePath();
        const sunGrad = ctx.createLinearGradient(winX, winY, winX + 80, ROOM.y + ROOM.h);
        sunGrad.addColorStop(0, "rgba(255, 248, 220, 0.22)");
        sunGrad.addColorStop(1, "rgba(255, 240, 190, 0.04)");
        ctx.fillStyle = sunGrad;
        ctx.fill();
        ctx.restore();

        // 绘制地板层
        const floorTop = ROOM.y + 120;
        const floorBottom = ROOM.y + ROOM.h - 6;
        const floorLeft = ROOM.x + 6;
        const floorRight = ROOM.x + ROOM.w - 6;

        ctx.save();
        ctx.beginPath();
        ctx.rect(floorLeft, floorTop, floorRight - floorLeft, floorBottom - floorTop);
        ctx.clip();

        // 自定义贴图铺设
        if (customCanvasPattern && currentFloorId === "custom") {
          ctx.fillStyle = customCanvasPattern;
          ctx.fillRect(floorLeft, floorTop, floorRight - floorLeft, floorBottom - floorTop);
        } else {
          // 内置古典地板条带
          const activeFloorDef = BUILTIN_FLOORS.find(f => f.id === currentFloorId) || BUILTIN_FLOORS[0];
          const plankH = activeFloorDef.plankH || 24;
          let row = 0;
          for (let py = floorTop; py < floorBottom; py += plankH) {
            ctx.fillStyle = activeFloorDef.colors[row % activeFloorDef.colors.length];
            ctx.fillRect(floorLeft, py, floorRight - floorLeft, plankH);

            // 木纹缝隙线
            ctx.beginPath();
            ctx.moveTo(floorLeft, py);
            ctx.lineTo(floorRight, py);
            ctx.strokeStyle = activeFloorDef.lineColor || "#3F2C18";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // 交错垂直缝
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

      // 绘制家具
      const drawFurniture = (now) => {
        // 1. 博山香炉 (左侧架几)
        const cX = 135;
        const cY = 255;
        drawRoundedRect(cX - 2, cY + 36, 44, 20, 4, "#5A3D28", "#332114", 2);
        drawRoundedRect(cX + 4, cY + 12, 32, 26, 6, "#B59458", "#61481E", 2.5);
        drawRoundedRect(cX + 12, cY + 2, 16, 12, 4, "#D4B372", "#61481E", 2);

        // 香炉袅袅青烟
        if (roomState.censerLit) {
          if (Math.random() < 0.35) {
            roomState.censerSmoke.push({
              x: cX + 20 + (Math.random() * 4 - 2),
              y: cY + 2,
              vx: (Math.random() - 0.5) * 0.4,
              vy: -(0.6 + Math.random() * 0.5),
              alpha: 0.55,
              r: 2.5 + Math.random() * 2
            });
          }
        }
        roomState.censerSmoke.forEach(s => {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(220, 215, 205, ${s.alpha})`;
          ctx.fill();
        });

        // 2. 罗汉软榻 (右侧)
        const bX = 460;
        const bY = 240;
        const bW = 160;
        const bH = 170;
        drawRoundedRect(bX, bY, bW, bH, 8, "#6B492B", "#382312", 3);
        drawRoundedRect(bX + 8, bY + 18, bW - 16, bH - 26, 6, "#E8DFC8", "#8F7556", 2);
        drawRoundedRect(bX + bW - 48, bY + 26, 36, 26, 6, "#C77D58", "#7A4628", 2);

        // 3. 古雅茶案 (中间偏左)
        const tX = 230;
        const tY = 285;
        const tW = 180;
        const tH = 95;
        ctx.fillStyle = "rgba(40, 25, 15, 0.25)";
        ctx.beginPath();
        ctx.ellipse(tX + tW / 2, tY + tH + 6, tW / 2 + 10, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        drawRoundedRect(tX, tY, tW, tH, 6, "#4D341E", "#2A190C", 2.8);
        drawRoundedRect(tX + 6, tY + 6, tW - 12, tH - 12, 4, "#5E4026", "#3A2312", 1.8);
        drawRoundedRect(tX + 50, tY + 26, 24, 20, 6, "#8F6443", "#3C2413", 1.8);
        drawRoundedRect(tX + 88, tY + 30, 14, 14, 4, "#F0EAE1", "#5C4129", 1.5);
        drawRoundedRect(tX + 110, tY + 30, 14, 14, 4, "#F0EAE1", "#5C4129", 1.5);
        ctx.fillStyle = "#A89473";
        ctx.strokeStyle = "#5A4C36";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(tX - 22, tY + tH / 2 + 5, 20, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(tX + tW + 22, tY + tH / 2 + 5, 20, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      };

      // 绘制名士小人
      const drawCharacter = (now) => {
        const pX = player.x;
        const pY = player.y;

        if (player.pose === "sleeping_bed") {
          ctx.save();
          drawRoundedRect(pX - 18, pY - 8, 55, 28, 8, "#D6724B", "#5C2B18", 2);
          if (avatarImg) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(pX - 6, pY + 6, 16, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(avatarImg, pX - 22, pY - 10, 32, 32);
            ctx.restore();
          }
          ctx.fillStyle = "#8C6A48";
          ctx.font = "bold 13px sans-serif";
          ctx.fillText("Zzz...", pX + 42, pY - 6);
          ctx.restore();
          return;
        }

        ctx.fillStyle = "rgba(40, 25, 15, 0.3)";
        ctx.beginPath();
        ctx.ellipse(pX, pY + 22, 18, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(pX, pY);

        if (player.facing === -1) {
          ctx.scale(-1, 1);
        }

        const bob = player.isMoving ? Math.sin(player.walkCycle * 8) * 3 : 0;

        // 汉服古风披帛/衣服底座
        drawRoundedRect(-14, -8 + bob, 28, 30, 8, "#8B5738", "#4A2B18", 2.2);

        // 头像徽章 (圆形名士头像立绘)
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, -18 + bob, 20, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        if (avatarImg) {
          ctx.drawImage(avatarImg, -20, -38 + bob, 40, 40);
        } else {
          ctx.fillStyle = "#CBB49C";
          ctx.fill();
          ctx.fillStyle = "#5C4129";
          ctx.font = "bold 15px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText((char.name || "名")[0], 0, -12 + bob);
        }
        ctx.restore();

        // 头像金色边框
        ctx.strokeStyle = "#D4AF37";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, -18 + bob, 20, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();

        // 头顶气泡对白
        if (player.bubbleText && player.bubbleTimer > 0) {
          ctx.save();
          ctx.font = "bold 12px sans-serif";
          const tw = ctx.measureText(player.bubbleText).width;
          const bw = Math.max(70, tw + 20);
          const bx = pX - bw / 2;
          const by = pY - 68;

          drawRoundedRect(bx, by, bw, 26, 12, "#FFFBF2", "#8F6443", 1.8);
          ctx.beginPath();
          ctx.moveTo(pX - 4, by + 26);
          ctx.lineTo(pX, by + 32);
          ctx.lineTo(pX + 4, by + 26);
          ctx.fillStyle = "#FFFBF2";
          ctx.fill();
          ctx.strokeStyle = "#8F6443";
          ctx.stroke();

          ctx.fillStyle = "#5A3A1F";
          ctx.textAlign = "center";
          ctx.fillText(player.bubbleText, pX, by + 17);
          ctx.restore();
        }
      };

      // 游戏主循环逻辑
      let lastTime = performance.now();
      const gameLoop = (currentTime) => {
        if (!isRunning) return;
        const dt = Math.min((currentTime - lastTime) / 1000, 0.08);
        lastTime = currentTime;

        roomState.censerSmoke.forEach(s => {
          s.x += s.vx;
          s.y += s.vy;
          s.alpha -= dt * 0.18;
          s.r += dt * 1.5;
        });
        roomState.censerSmoke = roomState.censerSmoke.filter(s => s.alpha > 0.02);

        if (player.bubbleTimer > 0) {
          player.bubbleTimer -= dt;
        }

        if (player.targetX !== null && player.targetY !== null) {
          const dx = player.targetX - player.x;
          const dy = player.targetY - player.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 3) {
            player.isMoving = true;
            player.facing = dx >= 0 ? 1 : -1;
            player.walkCycle += dt;
            const step = player.speed * dt;
            player.x += (dx / dist) * Math.min(step, dist);
            player.y += (dy / dist) * Math.min(step, dist);
          } else {
            player.x = player.targetX;
            player.y = player.targetY;
            player.targetX = null;
            player.targetY = null;
            player.isMoving = false;
          }
        } else {
          player.isMoving = false;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawRoomBackground(currentTime);
        drawFurniture(currentTime);
        drawCharacter(currentTime);

        animationFrameId = requestAnimationFrame(gameLoop);
      };

      animationFrameId = requestAnimationFrame(gameLoop);

      // 处理点击与触摸画布 (寻路走动 / 点击家具交互)
      const handlePointer = (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const clickX = (clientX - rect.left) * scaleX;
        const clickY = (clientY - rect.top) * scaleY;

        for (const item of furnitureList) {
          const box = item.hitBox;
          if (
            clickX >= box.x && clickX <= box.x + box.w &&
            clickY >= box.y && clickY <= box.y + box.h
          ) {
            player.targetX = item.standPoint.x;
            player.targetY = item.standPoint.y;
            setTimeout(() => {
              item.onInteract();
            }, 300);
            return;
          }
        }

        const distToPlayer = Math.sqrt((clickX - player.x) ** 2 + (clickY - player.y) ** 2);
        if (distToPlayer < 40) {
          const greetings = [
            `“楼主在此，心自清宁。” 🌸`,
            `“今日风清气爽，愿同楼主闲坐半日。” ✨`,
            `“要为楼主续上一盏新茶么？” 🍵`,
            `“楼主换的地板，踩上去甚是舒服呢~” 🪵`
          ];
          say(greetings[Math.floor(Math.random() * greetings.length)]);
          return;
        }

        const minX = ROOM.x + 30;
        const maxX = ROOM.x + ROOM.w - 30;
        const minY = ROOM.y + 140;
        const maxY = ROOM.y + ROOM.h - 30;

        const targetX = Math.max(minX, Math.min(maxX, clickX));
        const targetY = Math.max(minY, Math.min(maxY, clickY));

        player.pose = "idle";
        player.targetX = targetX;
        player.targetY = targetY;
      };

      canvas.addEventListener("pointerdown", handlePointer);

      return () => {
        isRunning = false;
        cancelAnimationFrame(animationFrameId);
        canvas.removeEventListener("pointerdown", handlePointer);
      };
    }, [currentFloorId, customFloorPattern, char]);

  if (!char) return null;

  return React.createElement(
    "div",
    {
      className: "agent-private-room-overlay",
      style: {
        position: "fixed",
        inset: 0,
        background: "#1E1814",
        zIndex: 100000,
        display: "flex",
        flexDirection: "column",
        animation: "fadeIn 0.28s ease-out"
      }
    },
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 16px",
          paddingTop: "calc(var(--safe-top, 10px) + 8px)",
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
            padding: "5px 12px",
            color: "#E8DFC8",
            fontSize: "12px",
            fontWeight: "bold",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px"
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
            gap: "6px",
            color: "#F0E8D8",
            fontSize: "15px",
            fontWeight: "bold",
            letterSpacing: "1px"
          }
        },
        React.createElement("span", { style: { color: "#D4AF37", fontSize: "12px" } }, "❖"),
        `【${char.name}】的专属心纸小居`,
        React.createElement("span", { style: { color: "#D4AF37", fontSize: "12px" } }, "❖")
      ),
      React.createElement(
        "button",
        {
          onClick: () => setShowDecorDrawer(!showDecorDrawer),
          style: {
            background: showDecorDrawer ? "linear-gradient(135deg, #d6724b, #b85832)" : "rgba(255, 255, 255, 0.12)",
            border: "1px solid #D6A86E",
            borderRadius: "14px",
            padding: "5px 12px",
            color: "#fff",
            fontSize: "12px",
            fontWeight: "bold",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "3px"
          }
        },
        "🎨 装修铺地"
      )
    ),

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
          cursor: "pointer"
        }
      })
    ),

    showDecorDrawer && React.createElement(
      "div",
      {
        style: {
          background: "linear-gradient(180deg, #FBF8F2 0%, #F3EBD8 100%)",
          borderTop: "2px solid #D6A86E",
          borderTopLeftRadius: "20px",
          borderTopRightRadius: "20px",
          padding: "16px 20px 24px",
          boxShadow: "0 -8px 30px rgba(0,0,0,0.5)",
          zIndex: 100,
          animation: "slideUp 0.25s ease-out"
        }
      },
      React.createElement(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" } },
        React.createElement(
          "div",
          { style: { fontSize: "14px", fontWeight: "bold", color: "#5C4129" } },
          "❖ 专属小居 · 室内地板铺设"
        ),
        React.createElement(
          "button",
          {
            onClick: () => setShowDecorDrawer(false),
            style: {
              background: "none",
              border: "none",
              fontSize: "16px",
              color: "#8C7255",
              cursor: "pointer"
            }
          },
          "✕"
        )
      ),

      React.createElement(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "8px",
            marginBottom: "14px"
          }
        },
        BUILTIN_FLOORS.map(floor => {
          const isSelected = currentFloorId === floor.id && !customFloorPattern;
          return React.createElement(
            "div",
            {
              key: floor.id,
              onClick: () => handleSelectFloor(floor.id),
              style: {
                background: isSelected ? "linear-gradient(135deg, #FFF8ED 0%, #F9ECE0 100%)" : "#fff",
                border: isSelected ? "2px solid #D6724B" : "1px solid #E6D4BE",
                borderRadius: "12px",
                padding: "10px 6px",
                textAlign: "center",
                cursor: "pointer",
                boxShadow: isSelected ? "0 2px 8px rgba(214, 114, 75, 0.25)" : "none"
              }
            },
            React.createElement("div", { style: { fontSize: "20px", marginBottom: "4px" } }, floor.icon),
            React.createElement("div", { style: { fontSize: "11.5px", fontWeight: "bold", color: "#5C4129" } }, floor.name),
            React.createElement("div", { style: { fontSize: "9px", color: "#8C7255", marginTop: "2px" } }, floor.desc)
          );
        })
      ),

      React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px dashed #D6C7B2" } },
        React.createElement(
          "div",
          { style: { fontSize: "11px", color: "#8C7255" } },
          "想要更独特？可上传任意图片作为地砖平铺图案"
        ),
        React.createElement(
          "button",
          {
            onClick: () => fileInputRef.current && fileInputRef.current.click(),
            style: {
              background: currentFloorId === "custom" ? "linear-gradient(135deg, #D6724B, #B85832)" : "linear-gradient(135deg, #D6A86E, #B8864E)",
              border: "none",
              borderRadius: "12px",
              padding: "6px 14px",
              color: "#fff",
              fontSize: "11px",
              fontWeight: "bold",
              cursor: "pointer"
            }
          },
          currentFloorId === "custom" ? "✨ 已应用自定义贴图" : "+ 上传地砖贴图"
        ),
        React.createElement("input", {
          type: "file",
          ref: fileInputRef,
          accept: "image/*",
          onChange: handleCustomFloorUpload,
          style: { display: "none" }
        })
      )
    )
  );
};

// =========================================================================
// 2. 密探专属雅间选择弹窗 (AgentRoomSelectModal)
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
          React.createElement("div", { style: { fontSize: "11px", color: "#8C7255", marginTop: "2px" } }, "选择一位密探，探访其专属的 2.5D 可交互私密小居")
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
        ) : chats.map(c => {
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
