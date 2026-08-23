/**
 * mcp_store.js - Web-MCP 核心扩展引擎与智能工具调度中心
 * 支持纯前端 Web 工具链与外部 SSE/HTTP MCP 节点的统一调度与交互反馈
 */
(function (global) {
  const STORAGE_KEYS = {
    MASTER_ENABLED: "mcp_master_enabled",
    TOOL_OVERRIDES: "mcp_tool_overrides",
    EXTERNAL_SERVERS: "mcp_external_servers"
  };

  // 1. 内置 Web-MCP 工具库定义
  const BUILTIN_TOOL_DEFINITIONS = [
    {
      name: "search_world_book",
      displayName: "世界书深度调阅",
      icon: "ph-books",
      category: "设定与档案",
      description: "在世界书档案库中精确检索指定人物、势力、地点或历史背景的详细卷宗设定。",
      inputSchema: {
        type: "object",
        properties: {
          keyword: {
            type: "string",
            description: "要调阅的关键词或条目名称，例如'洛阳'、'听雨阁'、'密信'等"
          }
        },
        required: ["keyword"]
      },
      defaultEnabled: true,
      handler: async (args) => {
        const keyword = (args.keyword || "").trim().toLowerCase();
        if (!keyword) return { error: "关键词为空" };

        let matched = [];
        try {
          const raw = localStorage.getItem("world_books") || "[]";
          const books = JSON.parse(raw);
          for (const book of books) {
            if (book.enabled === false) continue;
            if (Array.isArray(book.entries)) {
              for (const entry of book.entries) {
                if (entry.enabled === false) continue;
                const title = (entry.title || entry.name || "").toLowerCase();
                const content = (entry.content || entry.description || "").toLowerCase();
                const keys = (Array.isArray(entry.keys) ? entry.keys.join(",") : (entry.keys || "")).toLowerCase();
                if (title.includes(keyword) || content.includes(keyword) || keys.includes(keyword)) {
                  matched.push({
                    title: entry.title || entry.name || "未命名条目",
                    content: entry.content || entry.description || "",
                    book: book.title || book.name || "通用世界书"
                  });
                }
              }
            }
          }
        } catch (e) {
          console.warn("[MCP] 检索世界书异常:", e);
        }

        if (matched.length === 0) {
          return {
            status: "not_found",
            message: `世界书中未检索到与「${keyword}」完全吻合的卷宗，可根据通用设定自由发挥。`
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
      displayName: "随身备忘录与日历写注",
      icon: "ph-note-pencil",
      category: "日程与待办",
      description: "当在对话中收到嘱托、交代要务或约定行程时，主动记入个人随身备忘录，并自动同步到主人的【我的日历·进行之事】中（注有【xxx写注】）。",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "日程待办简短标题，如'去驿站取密信'、'提醒主公添衣'" },
          content: { type: "string", description: "备忘详细嘱托内容与行动安排" },
          timeStr: { type: "string", description: "时间或时辰描述，如'明日辰时'、'今晚子夜'" },
          tag: { type: "string", description: "分类标签，如'要务'、'提醒'、'私事'" }
        },
        required: ["title", "content"]
      },
      defaultEnabled: true,
      handler: async (args, context) => {
        const charName = context?.character || "名士";
        const cacheKey = `fangtian_dynamics_${charName}`;
        try {
          // 1. 写入角色个人备忘录
          let dynData = { memos: [] };
          const rawDyn = localStorage.getItem(cacheKey);
          if (rawDyn) {
            try { dynData = JSON.parse(rawDyn); } catch (e) {}
          }
          if (!Array.isArray(dynData.memos)) dynData.memos = [];

          const newMemo = {
            id: Date.now(),
            tag: args.tag || "要务",
            time: "刚刚 (对话自动记入)",
            title: args.title || "待办日程",
            content: args.content || ""
          };
          dynData.memos.unshift(newMemo);
          localStorage.setItem(cacheKey, JSON.stringify(dynData));

          // 2. 真实同步写入【我的日历·进行之事】
          let calTasks = { 已毕之事: [], 进行之事: [], 未竟之事: [] };
          if (window.calendarStore) {
            try { calTasks = await window.calendarStore.getTasks(); } catch (e) {}
          }
          if (!Array.isArray(calTasks["进行之事"])) calTasks["进行之事"] = [];

          const now = new Date();
          const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

          const newCalTask = {
            id: Date.now(),
            title: args.title || "重要待办要务",
            subtitle: `【${charName}写注】`,
            time: args.timeStr || "明日辰时 (07:00 ~ 09:00)",
            year: tomorrow.getFullYear(),
            month: tomorrow.getMonth() + 1,
            day: String(tomorrow.getDate()),
            description: args.content || "",
            noteBy: `${charName}写注`,
            tag: `${charName}写注`
          };

          calTasks["进行之事"].unshift(newCalTask);
          if (window.calendarStore) {
            await window.calendarStore.saveTasks(calTasks);
          }
          window.dispatchEvent(new CustomEvent("calendar_tasks_updated", { detail: calTasks }));

          return {
            status: "success",
            message: `已成功将「${newCalTask.title}」记入备忘录，并已同步登记至【我的日历】（标注：【${charName}写注】）。`
          };
        } catch (err) {
          return { error: `写入备忘与日历失败: ${err.message}` };
        }
      }
    },
    {
      name: "create_shop_order",
      displayName: "太疾驰商城记账与派送",
      icon: "ph-shopping-bag",
      category: "消费与赠礼",
      description: "在对话中为主公购置礼品、佳肴或物资时，自动生成太疾驰商城订单并开启快马派送倒计时。",
      inputSchema: {
        type: "object",
        properties: {
          itemName: { type: "string", description: "购置物品名称，如'极品云雾茶'、'金丝楠木香囊'" },
          category: { type: "string", description: "品类，如'珍馐'、'文玩'、'丹药'" },
          cost: { type: "string", description: "金额，如'50 银铢'" },
          recipient: { type: "string", description: "受赠人" },
          reason: { type: "string", description: "购买动机与心意附言" }
        },
        required: ["itemName", "cost", "recipient", "reason"]
      },
      defaultEnabled: true,
      handler: async (args, context) => {
        const charName = context?.character || "名士";
        try {
          const durationMinutes = 6;
          const orderPayload = {
            merchantName: `太疾驰·【${charName}】私采专线`,
            userAddress: "广陵王府·听雨阁",
            courier: {
              name: "加急快马·戴宗",
              vehicle: "千里快马",
              rating: 5.0
            },
            items: [
              {
                id: `item_${Date.now()}`,
                name: args.itemName,
                category: args.category || "名士私赠",
                priceStr: args.cost,
                desc: args.reason || `【${charName}】情深意切之赠`,
                count: 1,
                giver: charName
              }
            ],
            totalPriceStr: args.cost,
            payerRoleName: charName,
            durationMinutes: durationMinutes,
            status: "delivering"
          };

          if (window.deliveryOrderStore) {
            await window.deliveryOrderStore.addOrder(orderPayload);
          }

          return {
            status: "success",
            message: `已成功在太疾驰商城为【${args.recipient}】生成加急派送订单「${args.itemName}」，快马火速派送中！`
          };
        } catch (err) {
          return { error: `商城下单失败: ${err.message}` };
        }
      }
    },
    {
      name: "cast_chenwei_hexagram",
      displayName: "谶纬天机占卜",
      icon: "ph-sparkle",
      category: "奇物推演",
      description: "面临吉凶难测之境或心事迷惘时，摇签问卜以获取天机谶语与指引。",
      inputSchema: {
        type: "object",
        properties: {
          queryTopic: { type: "string", description: "求测事由，如'此行洛阳之吉凶'、'主公旧疾何日能愈'" }
        },
        required: ["queryTopic"]
      },
      defaultEnabled: true,
      handler: async (args) => {
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
          advice: "请以角色专属口吻向主公/对方阐释卦象玄机。"
        };
      }
    },
    {
      name: "simulate_sandplay",
      displayName: "沙盘军略兵推",
      icon: "ph-compass",
      category: "奇物推演",
      description: "在沙盘上推演防务关隘、粮道转运或突袭阻击，计算地形胜率与军略策略。",
      inputSchema: {
        type: "object",
        properties: {
          topic: { type: "string", description: "兵棋推演主题，如'伏牛山隘口阻击战'" },
          terrain: { type: "string", description: "地形要素，如'险关峡谷'、'流水浅滩'" }
        },
        required: ["topic"]
      },
      defaultEnabled: true,
      handler: async (args) => {
        const rates = [88, 92, 95, 80, 85];
        const winRate = rates[Math.floor(Math.random() * rates.length)];
        return {
          status: "success",
          topic: args.topic,
          terrain: args.terrain || "险关峡谷与隐秘小道",
          winRate: `推演胜率约 ${winRate}%`,
          advice: "依山傍水设三处伏兵，断敌粮道，可操胜券。"
        };
      }
    },
    {
      name: "get_current_time_and_lunar",
      displayName: "现世时辰与节气感知",
      icon: "ph-sun",
      category: "时序与感知",
      description: "获取用户当前现实时间、古风十二时辰及应季问候背景。",
      inputSchema: { type: "object", properties: {} },
      defaultEnabled: true,
      handler: async () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const date = now.getDate();
        const hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, "0");

        const shichenList = ["子时(夜深)", "丑时(鸡鸣)", "寅时(平旦)", "卯时(日出)", "辰时(食时)", "巳时(隅中)", "午时(日中)", "未时(日昳)", "申时(晡时)", "酉时(日入)", "戌时(黄昏)", "亥时(人定)"];
        const shichen = shichenList[Math.floor((hours + 1) % 24 / 2)];

        return {
          status: "success",
          realTime: `${year}年${month}月${date}日 ${hours}:${minutes}`,
          ancientShichen: shichen,
          note: "名士可感知此现世时序，自然在对白中关切问候。"
        };
      }
    }
  ];

  // 2. MCP Hub 调度引擎类
  class MCPHub {
    constructor() {
      this.masterEnabled = localStorage.getItem(STORAGE_KEYS.MASTER_ENABLED) !== "false";
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

    // 格式化输出为 OpenAI 标准 tools 参数列表
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
      console.log(`[MCP] 执行工具: ${toolName}`, toolArgs);

      // 1. 内置工具
      const builtIn = this.builtInTools.find(t => t.name === toolName);
      if (builtIn) {
        try {
          return await builtIn.handler(toolArgs, context);
        } catch (err) {
          console.error(`[MCP] 工具 ${toolName} 出错:`, err);
          return { error: err.message || "工具执行失败" };
        }
      }

      // 2. 外部 MCP
      for (const server of this.externalServers) {
        if (server.enabled && Array.isArray(server.tools)) {
          if (server.tools.find(t => t.name === toolName)) {
            return await this.callExternalTool(server, toolName, toolArgs);
          }
        }
      }

      return { error: `未找到工具 [${toolName}]` };
    }

    async callExternalTool(server, toolName, toolArgs) {
      try {
        const payload = {
          jsonrpc: "2.0",
          id: Date.now(),
          method: "tools/call",
          params: { name: toolName, arguments: toolArgs }
        };
        const res = await fetch(server.url.trim(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        return data.result || data;
      } catch (err) {
        return { error: `外部服务连接异常: ${err.message}` };
      }
    }
  }

  // 3. 页面全局底部动态调用指示胶囊
  global.showMcpIndicator = function (toolName, displayName, status) {
    let container = document.getElementById("mcp-floating-indicator");

    if (status === "idle") {
      if (container) {
        container.style.opacity = "0";
        container.style.transform = "translate(-50%, 15px) scale(0.95)";
        setTimeout(() => container && container.remove(), 300);
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
      `;
      document.body.appendChild(container);
    }

    const isCalling = status === "calling";
    const label = displayName || toolName || "扩展工具";
    const text = isCalling ? `名士正在调用「${label}」...` : `已完成「${label}」调用`;
    const iconBg = isCalling ? "#4E7E8E" : "#2E7D32";

    container.innerHTML = `
      <span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:${iconBg};color:#fff;font-size:11px;">
        ${isCalling ? "⏳" : "✓"}
      </span>
      <span>${text}</span>
    `;

    setTimeout(() => {
      container.style.opacity = "1";
      container.style.transform = "translate(-50%, 0) scale(1)";
    }, 10);

    if (!isCalling) {
      setTimeout(() => {
        if (container) {
          container.style.opacity = "0";
          container.style.transform = "translate(-50%, 15px) scale(0.95)";
          setTimeout(() => container && container.remove(), 300);
        }
      }, 1800);
    }
  };

  // 全局挂载单例
  global.mcpHub = new MCPHub();
  console.log("[MCP] Web-MCP 引擎就绪，装载工具数:", global.mcpHub.builtInTools.length);
})(window);
