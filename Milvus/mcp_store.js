/**
 * Milvus MCP (Model Context Protocol) 核心扩展引擎
 * 支持内置纯前端 Web-MCP 工具栈与外部标准 SSE/HTTP MCP 服务的统一调度
 */
(function () {
  const STORAGE_KEYS = {
    MASTER_ENABLED: "mcp_master_enabled",
    TOOL_OVERRIDES: "mcp_tool_overrides",
    EXTERNAL_SERVERS: "mcp_external_servers"
  };

  // 内置工具库定义
  const BUILTIN_TOOL_DEFINITIONS = [
    {
      name: "search_world_book",
      displayName: "世界书深度调阅",
      icon: "ph-books",
      category: "世界观与档案",
      description: "在世界书档案库中精确检索指定人物、势力、地点、法器或历史秘辛的详细设定卷宗。",
      inputSchema: {
        type: "object",
        properties: {
          keyword: {
            type: "string",
            description: "要调阅的关键词或条目名称，例如'宛城太守'、'绣衣楼密印'、'伏牛山'等"
          }
        },
        required: ["keyword"]
      },
      defaultEnabled: true,
      handler: async (args, context) => {
        const keyword = (args.keyword || "").trim().toLowerCase();
        if (!keyword) return { error: "关键词为空" };

        let matched = [];
        try {
          // 1. 从已启用的世界书中查找
          const worldBooksRaw = localStorage.getItem("world_books") || "[]";
          const worldBooks = JSON.parse(worldBooksRaw);
          for (const wb of worldBooks) {
            if (wb.enabled === false) continue;
            if (Array.isArray(wb.entries)) {
              for (const entry of wb.entries) {
                if (entry.enabled === false) continue;
                const title = (entry.title || entry.name || "").toLowerCase();
                const content = (entry.content || entry.description || "").toLowerCase();
                const keys = (Array.isArray(entry.keys) ? entry.keys.join(",") : (entry.keys || "")).toLowerCase();
                if (title.includes(keyword) || content.includes(keyword) || keys.includes(keyword)) {
                  matched.push({
                    title: entry.title || entry.name || "未命名条目",
                    content: entry.content || entry.description || "",
                    book: wb.title || wb.name || "通用世界书"
                  });
                }
              }
            }
          }
        } catch (e) {
          console.warn("[MCP] 检索世界书出错:", e);
        }

        if (matched.length === 0) {
          return {
            status: "not_found",
            message: `在世界书卷宗中未检索到与「${keyword}」完全匹配的条目，可根据通用时代常理与人设自主推断。`
          };
        }

        return {
          status: "success",
          count: matched.length,
          results: matched.slice(0, 3)
        };
      }
    },
    {
      name: "record_character_memo",
      displayName: "随身备忘录写入",
      icon: "ph-note-pencil",
      category: "动向与起居",
      description: "角色在对话中收到主公嘱托、发现了重要情报或有了私密心事时，主动将其写入自己的随身备忘录。",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "备忘录简明标题，如'提醒主公添衣'、'密查宛城暗桩账册'" },
          content: { type: "string", description: "备忘录详细内容与所思所虑" },
          tag: { type: "string", description: "备忘分类标签，如'提醒'、'密谋'、'起居'、'要务'等" }
        },
        required: ["title", "content"]
      },
      defaultEnabled: true,
      handler: async (args, context) => {
        const charName = context?.character || "名士";
        const cacheKey = `fangtian_dynamics_${charName}`;
        try {
          let dynData = { memos: [], assets: [] };
          const raw = localStorage.getItem(cacheKey);
          if (raw) {
            try { dynData = JSON.parse(raw); } catch (e) {}
          }
          if (!Array.isArray(dynData.memos)) dynData.memos = [];

          const newMemo = {
            id: Date.now(),
            tag: args.tag || "备忘",
            time: "刚刚 (对话自动记入)",
            title: args.title,
            content: args.content
          };

          dynData.memos.unshift(newMemo);
          localStorage.setItem(cacheKey, JSON.stringify(dynData));
          return {
            status: "success",
            message: `已成功将条目「${args.title}」记入【${charName}】的随身备忘录中。`
          };
        } catch (err) {
          return { error: `写入备忘录失败: ${err.message}` };
        }
      }
    },
    {
      name: "create_shop_order",
      displayName: "太疾驰商城记账",
      icon: "ph-shopping-bag",
      category: "消费与赠礼",
      description: "当角色在对话中为主公购置礼品、药材、珍馐或私下采办军备物资时，自动写入太疾驰商城的真实消费订单。",
      inputSchema: {
        type: "object",
        properties: {
          itemName: { type: "string", description: "购置物品名称，如'蒙顶甘露极品云雾茶'、'金丝楠木茶盏'" },
          category: { type: "string", description: "物品分类，如'珍馐餐饮'、'名贵文玩'、'疗伤丹药'、'锦缎衣饰'" },
          quantity: { type: "string", description: "数量，如'2罐'、'1对'、'1袭'" },
          cost: { type: "string", description: "花费金额，如'120 银铢'、'五十两白银'" },
          recipient: { type: "string", description: "受赠人，如'广陵王'、'主公'、'密探部属'" },
          reason: { type: "string", description: "购买动机与心意备注" }
        },
        required: ["itemName", "cost", "recipient", "reason"]
      },
      defaultEnabled: true,
      handler: async (args, context) => {
        const charName = context?.character || "名士";
        const cacheKey = `fangtian_orders_${charName}`;
        try {
          // 1. 同步写入方天水镜购物记录
          let orders = [];
          const raw = localStorage.getItem(cacheKey);
          if (raw) {
            try { orders = JSON.parse(raw); } catch (e) {}
          }
          if (!Array.isArray(orders)) orders = [];

          const newOrder = {
            id: Date.now(),
            itemName: args.itemName,
            category: args.category || "随身采买",
            quantity: args.quantity || "1 件",
            cost: args.cost,
            recipient: args.recipient,
            status: "太疾驰加急快马派送中",
            time: "刚刚 (对话自动采办)",
            reason: args.reason
          };
          orders.unshift(newOrder);
          localStorage.setItem(cacheKey, JSON.stringify(orders));

          // 2. 真实同步写入【太疾驰·订单与配送系统】(deliveryOrderStore / tjc_delivery_orders)
          const now = Date.now();
          const durationMinutes = 6; // 6分钟内快马送达，留足倒计时与催单时间
          const deliveryItem = {
            id: `item_${now}`,
            name: args.itemName,
            category: args.category || "名士私赠",
            priceStr: args.cost,
            desc: args.reason || `【${charName}】情深意切之赠`,
            count: 1,
            giver: charName
          };

          const orderPayload = {
            merchantName: `太疾驰·【${charName}】私采专线`,
            merchantLocation: "洛阳繁华东市",
            userAddress: "广陵王府·听雨阁",
            courier: {
              name: "太疾驰加急快马·戴宗",
              avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=TaiJiChi",
              vehicle: "八百里加急快马",
              rating: 5.0,
              phone: "传讯灵佩 #8888"
            },
            items: [deliveryItem],
            totalPriceStr: args.cost,
            totalBase: 0,
            payMethod: "friend_pay",
            payerRoleName: charName,
            durationMinutes: durationMinutes,
            status: "delivering"
          };

          if (window.deliveryOrderStore) {
            await window.deliveryOrderStore.addOrder(orderPayload);
          } else {
            const rawDelivery = localStorage.getItem("tjc_delivery_orders");
            let deliveryOrders = [];
            if (rawDelivery) {
              try { deliveryOrders = JSON.parse(rawDelivery); } catch (e) {}
            }
            if (!Array.isArray(deliveryOrders)) deliveryOrders = [];
            deliveryOrders.unshift({
              id: `TJC_${now}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
              orderTime: now,
              estimatedDeliveryTime: now + durationMinutes * 60 * 1000,
              durationMinutes: durationMinutes,
              rushCount: 0,
              ...orderPayload
            });
            localStorage.setItem("tjc_delivery_orders", JSON.stringify(deliveryOrders));
            window.dispatchEvent(new CustomEvent("deliveryOrdersUpdated"));
          }

          return {
            status: "success",
            message: `已成功在太疾驰商城为【${args.recipient}】生成加急快马配送订单「${args.itemName}」，正在火速派送中！`
          };
        } catch (err) {
          return { error: `太疾驰下单记账失败: ${err.message}` };
        }
      }
    },
    {
      name: "cast_chenwei_hexagram",
      displayName: "谶纬天机占卜",
      icon: "ph-sparkle",
      category: "奇物推演",
      description: "当面临凶吉未卜的险境、暗流涌动的战局或两人的缘分心事时，主动调用谶纬小摊摇签问卦，获取天机谶语。",
      inputSchema: {
        type: "object",
        properties: {
          queryTopic: { type: "string", description: "求测之事由，如'此去洛阳之吉凶'、'主公旧疾何日能愈'" }
        },
        required: ["queryTopic"]
      },
      defaultEnabled: true,
      handler: async (args, context) => {
        const hexagrams = [
          { hexagram: "上上卦·地天泰卦", poem: "天地交泰物顺通，风平浪静见长虹。任凭惊涛拍岸起，同舟共济万事融。", meaning: "阴阳和合，万事皆顺，虽有微澜终可履险如夷。" },
          { hexagram: "中平卦·水雷屯卦", poem: "万物始生多险难，龙潜深水待惊雷。莫向险峰轻纵马，韬光养晦待春回。", meaning: "草创初开，暗流丛生，宜静心积蓄力量，切勿操之过急。" },
          { hexagram: "上吉卦·火天大有", poem: "日丽中天照四方，顺天休命自芬芳。万邦来朝民安泰，千骑云屯护栋梁。", meaning: "得天时地利，贵人相助，所谋之事定能大放异彩。" },
          { hexagram: "暗伏卦·山水蒙卦", poem: "云遮雾绕不见峰，溪水潺潺入断垄。借得东风开明路，柳暗花明又相逢。", meaning: "迷雾在前，需擦亮慧眼，洞察秋毫，贵在坚持正道。" }
        ];

        const selected = hexagrams[Math.floor(Math.random() * hexagrams.length)];
        return {
          status: "success",
          topic: args.queryTopic,
          hexagram: selected.hexagram,
          poem: selected.poem,
          meaning: selected.meaning,
          advice: "请结合此谶语，以角色专属口吻向主公/对方阐明卦象玄机。"
        };
      }
    },
    {
      name: "simulate_sandplay",
      displayName: "沙盘军略兵推",
      icon: "ph-compass",
      category: "奇物推演",
      description: "在沙盘模拟器上推演军防调配、暗桩封锁、粮道转运或突袭伏击，计算地形优势与推演胜率。",
      inputSchema: {
        type: "object",
        properties: {
          topic: { type: "string", description: "兵棋推演主题，如'伏牛山隘口阻击战'、'宛南粮道暗线防卫'" },
          terrain: { type: "string", description: "战场地形要素，如'山谷险道'、'流水浅滩'、'深林关卡'" }
        },
        required: ["topic"]
      },
      defaultEnabled: true,
      handler: async (args, context) => {
        const rates = [88, 92, 95, 78, 85];
        const winRate = rates[Math.floor(Math.random() * rates.length)];
        return {
          status: "success",
          topic: args.topic,
          terrain: args.terrain || "险关隘口与隐秘小径",
          winRate: `阻击胜率约 ${winRate}%`,
          strategicAdvice: `依地形而守，设暗哨连环弩三处，断其粮道水源，敌纵有数倍之众亦难以破关。`
        };
      }
    },
    {
      name: "get_current_time_and_lunar",
      displayName: "现世时辰与节气感知",
      icon: "ph-sun",
      category: "时序与感知",
      description: "获取用户当前现实世界的真实时间、农历日期、干支生肖与二十四节气，便于角色在对白中应景问候。",
      inputSchema: {
        type: "object",
        properties: {}
      },
      defaultEnabled: true,
      handler: async () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const date = now.getDate();
        const hours = now.getHours();
        const minutes = now.getMinutes();

        let lunarStr = "农历岁次";
        let jieqiStr = "";
        try {
          if (window.Lunar) {
            const lunar = window.Lunar.fromDate(now);
            lunarStr = `${lunar.getYearInGanZhi()}年(${lunar.getYearShengXiao()}) 农历${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
            const jq = lunar.getJieQi();
            if (jq) jieqiStr = ` · 今日逢【${jq}】节气`;
          }
        } catch (e) {}

        const shichenList = ["子时(夜深)", "丑时(鸡鸣)", "寅时(平旦)", "卯时(日出)", "辰时(食时)", "巳时(隅中)", "午时(日中)", "未时(日昳)", "申时(晡时)", "酉时(日入)", "戌时(黄昏)", "亥时(人定)"];
        const shichen = shichenList[Math.floor((hours + 1) % 24 / 2)];

        return {
          status: "success",
          realTime: `${year}年${month}月${date}日 ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
          ancientShichen: shichen,
          lunarInfo: lunarStr + jieqiStr,
          note: "名士可感知此现世时序，自然在对白中嘘寒问暖、应景关切。"
        };
      }
    }
  ];

  class MCPHub {
    constructor() {
      this.masterEnabled = localStorage.getItem(STORAGE_KEYS.MASTER_ENABLED) !== "false"; // 默认开启
      this.toolOverrides = {};
      try {
        this.toolOverrides = JSON.parse(localStorage.getItem(STORAGE_KEYS.TOOL_OVERRIDES) || "{}");
      } catch (e) {}

      this.externalServers = [];
      try {
        this.externalServers = JSON.parse(localStorage.getItem(STORAGE_KEYS.EXTERNAL_SERVERS) || "[]");
      } catch (e) {}

      this.builtInTools = BUILTIN_TOOL_DEFINITIONS.map(t => ({
        ...t,
        enabled: this.toolOverrides[t.name] !== undefined ? this.toolOverrides[t.name] : t.defaultEnabled
      }));
    }

    isMasterEnabled() {
      return this.masterEnabled;
    }

    setMasterEnabled(enabled) {
      this.masterEnabled = !!enabled;
      localStorage.setItem(STORAGE_KEYS.MASTER_ENABLED, String(this.masterEnabled));
    }

    toggleTool(toolName, enabled) {
      const tool = this.builtInTools.find(t => t.name === toolName);
      if (tool) {
        tool.enabled = !!enabled;
        this.toolOverrides[toolName] = tool.enabled;
        localStorage.setItem(STORAGE_KEYS.TOOL_OVERRIDES, JSON.stringify(this.toolOverrides));
      }
    }

    // 获取供 OpenAI / Claude 使用的 tools 参数列表
    getActiveTools() {
      if (!this.masterEnabled) return [];

      const active = [];

      // 1. 内置工具
      for (const t of this.builtInTools) {
        if (t.enabled) {
          active.push({
            type: "function",
            function: {
              name: t.name,
              description: t.description,
              parameters: t.inputSchema
            }
          });
        }
      }

      // 2. 外部 MCP 服务工具
      for (const server of this.externalServers) {
        if (server.enabled && Array.isArray(server.tools)) {
          for (const extTool of server.tools) {
            active.push({
              type: "function",
              function: {
                name: extTool.name,
                description: `[来自外部MCP:${server.name}] ${extTool.description || ""}`,
                parameters: extTool.inputSchema || { type: "object", properties: {} }
              }
            });
          }
        }
      }

      return active;
    }

    // 执行指定工具
    async executeTool(toolName, toolArgs, context = {}) {
      console.log(`[MCP] 正在分发执行工具: ${toolName}`, toolArgs);

      // 1. 查找内置工具
      const builtIn = this.builtInTools.find(t => t.name === toolName);
      if (builtIn) {
        try {
          const res = await builtIn.handler(toolArgs, context);
          console.log(`[MCP] 内置工具 ${toolName} 执行完毕:`, res);
          return res;
        } catch (err) {
          console.error(`[MCP] 内置工具 ${toolName} 执行出错:`, err);
          return { error: err.message || "工具执行失败" };
        }
      }

      // 2. 查找外部 MCP 服务
      for (const server of this.externalServers) {
        if (server.enabled && Array.isArray(server.tools)) {
          const match = server.tools.find(t => t.name === toolName);
          if (match) {
            return await this.callExternalTool(server, toolName, toolArgs);
          }
        }
      }

      return { error: `未找到工具 [${toolName}]` };
    }

    // 远程调用外部 MCP 服务
    async callExternalTool(server, toolName, toolArgs) {
      const url = server.url.trim();
      try {
        const payload = {
          jsonrpc: "2.0",
          id: Date.now(),
          method: "tools/call",
          params: {
            name: toolName,
            arguments: toolArgs
          }
        };

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        return data.result || data;
      } catch (err) {
        console.error(`[MCP] 调用外部服务 ${server.name} 失败:`, err);
        return { error: `外部 MCP 服务连接异常: ${err.message}` };
      }
    }

    // 测试并刷新外部 MCP 服务工具列表
    async testAndFetchExternalServer(serverUrl) {
      const url = (serverUrl || "").trim();
      if (!url) throw new Error("请输入有效的 MCP 服务 URL");

      // 1. 发起 tools/list JSON-RPC 请求
      const payload = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {}
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`连接失败 (HTTP ${res.status}): ${res.statusText}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || "MCP 握手失败");

      const tools = data.result?.tools || data.tools || [];
      return tools;
    }

    // 添加外部 MCP 服务
    async addExternalServer(name, url) {
      const tools = await this.testAndFetchExternalServer(url);
      const newServer = {
        id: "mcp_srv_" + Date.now(),
        name: name || "自定义 MCP 节点",
        url: url.trim(),
        enabled: true,
        status: "connected",
        toolsCount: tools.length,
        tools: tools,
        updatedAt: new Date().toLocaleTimeString()
      };

      this.externalServers.push(newServer);
      localStorage.setItem(STORAGE_KEYS.EXTERNAL_SERVERS, JSON.stringify(this.externalServers));
      return newServer;
    }

    removeExternalServer(id) {
      this.externalServers = this.externalServers.filter(s => s.id !== id);
      localStorage.setItem(STORAGE_KEYS.EXTERNAL_SERVERS, JSON.stringify(this.externalServers));
    }

    toggleExternalServer(id, enabled) {
      const s = this.externalServers.find(item => item.id === id);
      if (s) {
        s.enabled = !!enabled;
        localStorage.setItem(STORAGE_KEYS.EXTERNAL_SERVERS, JSON.stringify(this.externalServers));
      }
    }
  }

  // 挂载到全局单例
  
  // 全局置顶浮动调用气泡管理器 (100% 独立挂载，不受组件切换影响)
  window.showMcpIndicator = function (toolName, displayName, status) {
    if (!document.getElementById("mcp-indicator-styles")) {
      const style = document.createElement("style");
      style.id = "mcp-indicator-styles";
      style.textContent = `
        @keyframes mcpSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes mcpPulse { 0% { box-shadow: 0 4px 15px rgba(78, 126, 142, 0.25); } 50% { box-shadow: 0 6px 25px rgba(78, 126, 142, 0.5); } 100% { box-shadow: 0 4px 15px rgba(78, 126, 142, 0.25); } }
      `;
      document.head.appendChild(style);
    }

    let container = document.getElementById("mcp-floating-indicator");

    if (status === "idle") {
      if (container) {
        container.style.opacity = "0";
        container.style.transform = "translate(-50%, 15px) scale(0.95)";
        setTimeout(() => {
          if (container && container.dataset.status === "idle") {
            container.remove();
          }
        }, 350);
      }
      return;
    }

    if (!container) {
      container = document.createElement("div");
      container.id = "mcp-floating-indicator";
      container.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translate(-50%, 15px) scale(0.95);
        z-index: 999999;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 250, 248, 0.98) 100%);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1.5px solid #4E7E8E;
        border-radius: 30px;
        padding: 7px 18px;
        box-shadow: 0 8px 25px rgba(78, 126, 142, 0.35);
        display: flex;
        align-items: center;
        gap: 9px;
        font-size: 13px;
        font-weight: 700;
        color: #2C434B;
        pointer-events: none;
        white-space: nowrap;
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        animation: mcpPulse 2s infinite ease-in-out;
      `;
      document.body.appendChild(container);
    }

    container.dataset.status = status;
    const isCalling = status === "calling";
    const iconBg = isCalling ? "#4E7E8E" : "#2E7D32";
    const iconContent = isCalling
      ? `<svg style="animation: mcpSpin 1s linear infinite; width: 13px; height: 13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`
      : `<svg style="width: 13px; height: 13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

    const label = displayName || toolName || "扩展工具";
    const text = isCalling
      ? `名士正在调用「${label}」...`
      : `已完成「${label}」调用`;

    container.innerHTML = `
      <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: ${iconBg}; color: #FFF; flex-shrink: 0; transition: background 0.3s;">
        ${iconContent}
      </span>
      <span style="letter-spacing: 0.2px;">${text}</span>
    `;

    // 优雅升起
    requestAnimationFrame(() => {
      container.style.opacity = "1";
      container.style.transform = "translate(-50%, 0) scale(1)";
    });

    if (!isCalling) {
      setTimeout(() => {
        if (container && container.dataset.status === "done") {
          container.style.opacity = "0";
          container.style.transform = "translate(-50%, 15px) scale(0.95)";
          setTimeout(() => {
            if (container && container.dataset.status === "done") {
              container.remove();
            }
          }, 350);
        }
      }, 1800);
    }
  };


  // 挂载到全局单例
  window.mcpHub = new MCPHub();
  console.log("[MCP] Milvus MCP Hub 初始化就绪，已装载内置工具:", window.mcpHub.builtInTools.length);
})();
