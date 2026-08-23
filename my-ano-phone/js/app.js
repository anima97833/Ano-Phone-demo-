/**
 * app.js - 核心 React 业务逻辑与跨模块调度
 * 基于 React 18 UMD 纯原生构建，支持大模型多轮交互与 Web-MCP 真实联动
 */
(function (global) {
  const { useState, useEffect, useRef } = React;
  const h = React.createElement;

  // 1. LLM 通信层 (支持 OpenAI 兼容 API + 双重 Tool-Calling 闭环)
  async function sendToLLM(messages, onChunk, onFinish, onError) {
    const apiKey = localStorage.getItem("llm_api_key") || "";
    const baseUrl = localStorage.getItem("llm_base_url") || "https://api.openai.com/v1";
    const modelName = localStorage.getItem("llm_model_name") || "gpt-4o-mini";

    if (!apiKey) {
      onError(new Error("请先在「系统设置」中填写您的大模型 API Key！"));
      return;
    }

    let tools = [];
    let mcpPrompt = "";
    if (window.mcpHub && window.mcpHub.isMasterEnabled()) {
      const activeTools = window.mcpHub.getActiveTools();
      if (activeTools && activeTools.length > 0) {
        tools = activeTools;
        const toolListStr = activeTools.map(t => `- ${t.function.name}: ${t.function.description}`).join("\n");
        mcpPrompt = `\n\n【系统 MCP 扩展工具已就绪】\n当对话涉及日程记事、查阅世界书、商城采买记账、算卦占卜等，请主动调用对应工具：\n${toolListStr}\n支持原生 tool_call 或文本中输出 [TOOL_CALL: 工具名 {"参数": "值"}]。`;
      }
    }

    const enrichedMessages = JSON.parse(JSON.stringify(messages));
    if (mcpPrompt) {
      if (enrichedMessages.length > 0 && enrichedMessages[0].role === "system") {
        enrichedMessages[0].content += mcpPrompt;
      } else {
        enrichedMessages.unshift({ role: "system", content: mcpPrompt.trim() });
      }
    }

    try {
      const payload = {
        model: modelName,
        messages: enrichedMessages,
        temperature: 0.7
      };
      if (tools.length > 0) payload.tools = tools;

      const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`API 请求失败 (HTTP ${res.status}): ${await res.text()}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0]?.message;
      let replyText = choice?.content || "";
      const toolCalls = choice?.tool_calls;

      // 1. 处理原生 tool_calls
      if (Array.isArray(toolCalls)) {
        for (const tc of toolCalls) {
          const fnName = tc.function?.name;
          let fnArgs = {};
          try { fnArgs = JSON.parse(tc.function.arguments); } catch (e) {}
          if (fnName && window.mcpHub) {
            window.showMcpIndicator?.(fnName, fnName, "calling");
            await window.mcpHub.executeTool(fnName, fnArgs, { messages });
            window.showMcpIndicator?.(fnName, fnName, "done");
          }
        }
      }

      // 2. 处理标签兜底 [TOOL_CALL: toolName {...}]
      const toolRegex = /\[(?:TOOL_CALL|TOOL|MCP)[:：]\s*([a-zA-Z0-9_-]+)\s*(\{[\s\S]*?\})\s*\]/gi;
      let match;
      while ((match = toolRegex.exec(replyText)) !== null) {
        const fnName = match[1];
        let fnArgs = {};
        try { fnArgs = JSON.parse(match[2]); } catch (e) {}
        if (fnName && window.mcpHub) {
          window.showMcpIndicator?.(fnName, fnName, "calling");
          await window.mcpHub.executeTool(fnName, fnArgs, { messages });
          window.showMcpIndicator?.(fnName, fnName, "done");
        }
      }
      replyText = replyText.replace(toolRegex, "").trim();

      onFinish(replyText || "（已完成要务指令与日程登记）");
    } catch (err) {
      console.error("[Chat] 通信异常:", err);
      onError(err);
    }
  }

  // 2. 主页面与导航组件
  function PhoneApp() {
    const [currentApp, setCurrentApp] = useState("launcher"); // launcher, chat, calendar, shop, settings
    const [timeStr, setTimeStr] = useState("");
    const [shichenStr, setShichenStr] = useState("午时");

    useEffect(() => {
      const updateClock = () => {
        const d = new Date();
        const h = String(d.getHours()).padStart(2, "0");
        const m = String(d.getMinutes()).padStart(2, "0");
        setTimeStr(`${h}:${m}`);
      };
      updateClock();
      const timer = setInterval(updateClock, 1000);
      return () => clearInterval(timer);
    }, []);

    // 渲染各个页面视图
    return h("div", { className: "phone-case" },
      h("div", { className: "phone-screen" },
        // 顶部状态栏
        h("div", { className: "status-bar" },
          h("span", null, timeStr),
          h("div", { className: "dynamic-island" }, "Ano·灵动岛"),
          h("div", { className: "status-right" }, "5G 􀛨 100%")
        ),

        // 视口容器
        h("div", { className: "app-viewport" },
          currentApp === "launcher" && h(LauncherView, { onOpenApp: setCurrentApp, timeStr }),
          currentApp === "chat" && h(ChatView, { onBack: () => setCurrentApp("launcher") }),
          currentApp === "calendar" && h(CalendarView, { onBack: () => setCurrentApp("launcher") }),
          currentApp === "shop" && h(ShopView, { onBack: () => setCurrentApp("launcher") }),
          currentApp === "settings" && h(SettingsView, { onBack: () => setCurrentApp("launcher") })
        ),

        // 底部 Home Bar 触发返回
        h("div", {
          className: "home-bar-area",
          onClick: () => setCurrentApp("launcher"),
          title: "轻触返回主屏幕"
        }, h("div", { className: "home-bar" }))
      )
    );
  }

  // 桌面主屏幕 Launcher
  function LauncherView({ onOpenApp, timeStr }) {
    const apps = [
      { id: "chat", name: "密聊名士", icon: "💬", bg: "#EBF3F5" },
      { id: "calendar", name: "我的日历", icon: "📅", bg: "#FFF4EB" },
      { id: "shop", name: "太疾驰商城", icon: "🐎", bg: "#F0EBF8" },
      { id: "settings", name: "系统设置", icon: "⚙️", bg: "#EBF5EB" }
    ];

    return h("div", { className: "launcher-view" },
      h("div", { className: "launcher-header" },
        h("div", { className: "clock-widget" },
          h("div", { className: "clock-time" }, timeStr || "12:00"),
          h("div", { className: "clock-lunar" }, "今日吉日 · 宜品茗清谈、谋划远略")
        )
      ),

      h("div", { className: "app-grid" },
        apps.map(app => h("div", {
          key: app.id,
          className: "app-icon-item",
          onClick: () => onOpenApp(app.id)
        },
          h("div", { className: "app-icon-box", style: { background: app.bg } }, app.icon),
          h("span", { className: "app-icon-label" }, app.name)
        ))
      )
    );
  }

  // 密聊应用 ChatView
  function ChatView({ onBack }) {
    const [messages, setMessages] = useState([
      { id: 1, role: "assistant", content: "主公，别来无恙。今日有何要务吩咐？在下随时听候差遣。" }
    ]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, [messages]);

    const handleSend = () => {
      if (!inputText.trim() || loading) return;
      const userMsg = { id: Date.now(), role: "user", content: inputText };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setInputText("");
      setLoading(true);

      const apiHistory = newMessages.map(m => ({ role: m.role, content: m.content }));

      sendToLLM(
        apiHistory,
        null,
        (reply) => {
          setMessages([...newMessages, { id: Date.now() + 1, role: "assistant", content: reply }]);
          setLoading(false);
        },
        (err) => {
          setMessages([...newMessages, { id: Date.now() + 1, role: "assistant", content: `【系统提示】: ${err.message}` }]);
          setLoading(false);
        }
      );
    };

    return h("div", { className: "chat-view" },
      h("div", { className: "page-header" },
        h("button", { className: "header-back-btn", onClick: onBack }, "‹ 返回"),
        h("span", { className: "header-title" }, "水镜密聊 · 随身名士"),
        h("span", { style: { width: 24 } })
      ),

      h("div", { className: "chat-messages-scroll", ref: scrollRef },
        messages.map(m => h("div", { key: m.id, className: `chat-bubble-row ${m.role}` },
          m.role === "assistant" && h("div", { className: "chat-avatar" }, "📜"),
          h("div", { className: "chat-bubble-content" }, m.content)
        )),
        loading && h("div", { className: "chat-bubble-row assistant" },
          h("div", { className: "chat-avatar" }, "📜"),
          h("div", { className: "chat-bubble-content", style: { color: "#888" } }, "名士正在研墨构思与调度要务...")
        )
      ),

      h("div", { className: "chat-input-bar" },
        h("input", {
          className: "chat-input",
          placeholder: "例如：帮我记下明日辰时去驿站取密信...",
          value: inputText,
          onChange: (e) => setInputText(e.target.value),
          onKeyDown: (e) => e.key === "Enter" && handleSend()
        }),
        h("button", { className: "chat-send-btn", onClick: handleSend }, "↑")
      )
    );
  }

  // 日历应用 CalendarView (真实联动展示 AI 角色写注的日程)
  function CalendarView({ onBack }) {
    const [tasks, setTasks] = useState([]);

    const loadTasks = async () => {
      if (window.calendarStore) {
        const data = await window.calendarStore.getTasks();
        setTasks(data["进行之事"] || []);
      }
    };

    useEffect(() => {
      loadTasks();
      const listener = () => loadTasks();
      window.addEventListener("calendar_tasks_updated", listener);
      return () => window.removeEventListener("calendar_tasks_updated", listener);
    }, []);

    return h("div", { className: "chat-view" },
      h("div", { className: "page-header" },
        h("button", { className: "header-back-btn", onClick: onBack }, "‹ 返回"),
        h("span", { className: "header-title" }, "我的日历 · 进行之事"),
        h("span", { style: { width: 24 } })
      ),

      h("div", { className: "list-view-container" },
        tasks.length === 0
          ? h("div", { style: { textAlign: "center", color: "#999", marginTop: 40 } }, "暂无进行中的要务。\n可在对话中让名士帮您记下日程！")
          : tasks.map(t => h("div", { key: t.id, className: "card-item" },
              h("div", { className: `card-tag ${t.noteBy ? "special" : ""}` }, t.noteBy || "待办日程"),
              h("div", { className: "card-title" }, t.title),
              h("div", { className: "card-desc" }, t.description || "无详细备注"),
              h("div", { style: { fontSize: 11.5, color: "#888", marginTop: 6 } }, `时辰: ${t.time || "待定"}`)
            ))
      )
    );
  }

  // 商城应用 ShopView (真实联动外卖订单派送)
  function ShopView({ onBack }) {
    const [orders, setOrders] = useState([]);

    const loadOrders = async () => {
      if (window.deliveryOrderStore) {
        const list = await window.deliveryOrderStore.getOrders();
        setOrders(list || []);
      }
    };

    useEffect(() => {
      loadOrders();
      const listener = () => loadOrders();
      window.addEventListener("deliveryOrdersUpdated", listener);
      return () => window.removeEventListener("deliveryOrdersUpdated", listener);
    }, []);

    return h("div", { className: "chat-view" },
      h("div", { className: "page-header" },
        h("button", { className: "header-back-btn", onClick: onBack }, "‹ 返回"),
        h("span", { className: "header-title" }, "太疾驰 · 派送专线"),
        h("span", { style: { width: 24 } })
      ),

      h("div", { className: "list-view-container" },
        orders.length === 0
          ? h("div", { style: { textAlign: "center", color: "#999", marginTop: 40 } }, "暂无加急快马订单。\n在对话中名士为主公采买时将自动生成派送单！")
          : orders.map(o => h("div", { key: o.id, className: "card-item" },
              h("div", { className: "card-tag special" }, "🏇 八百里加急快马派送中"),
              h("div", { className: "card-title" }, o.items?.[0]?.name || "私赠物资"),
              h("div", { className: "card-desc" }, o.items?.[0]?.desc || "情深意切之赠"),
              h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: "#666" } },
                h("span", null, `赠礼人: ${o.payerRoleName || "名士"}`),
                h("span", { style: { color: "#C27D56", fontWeight: "bold" } }, o.totalPriceStr || "已结清")
              )
            ))
      )
    );
  }

  // 设置界面 SettingsView
  function SettingsView({ onBack }) {
    const [apiKey, setApiKey] = useState(localStorage.getItem("llm_api_key") || "");
    const [baseUrl, setBaseUrl] = useState(localStorage.getItem("llm_base_url") || "https://api.openai.com/v1");
    const [modelName, setModelName] = useState(localStorage.getItem("llm_model_name") || "gpt-4o-mini");
    const [mcpEnabled, setMcpEnabled] = useState(window.mcpHub ? window.mcpHub.isMasterEnabled() : true);
    const [savedTip, setSavedTip] = useState(false);

    const handleSave = () => {
      localStorage.setItem("llm_api_key", apiKey.trim());
      localStorage.setItem("llm_base_url", baseUrl.trim());
      localStorage.setItem("llm_model_name", modelName.trim());
      if (window.mcpHub) window.mcpHub.setMasterEnabled(mcpEnabled);
      setSavedTip(true);
      setTimeout(() => setSavedTip(false), 2000);
    };

    return h("div", { className: "chat-view" },
      h("div", { className: "page-header" },
        h("button", { className: "header-back-btn", onClick: onBack }, "‹ 返回"),
        h("span", { className: "header-title" }, "系统与模型设置"),
        h("span", { style: { width: 24 } })
      ),

      h("div", { className: "list-view-container" },
        h("div", { className: "settings-group" },
          h("div", { className: "settings-group-title" }, "大模型 API 配置"),
          h("div", { className: "form-row" },
            h("label", { className: "form-label" }, "API Base URL"),
            h("input", { className: "form-input", value: baseUrl, onChange: (e) => setBaseUrl(e.target.value) })
          ),
          h("div", { className: "form-row" },
            h("label", { className: "form-label" }, "API Key"),
            h("input", { className: "form-input", type: "password", placeholder: "sk-...", value: apiKey, onChange: (e) => setApiKey(e.target.value) })
          ),
          h("div", { className: "form-row" },
            h("label", { className: "form-label" }, "Model Name"),
            h("input", { className: "form-input", value: modelName, onChange: (e) => setModelName(e.target.value) })
          )
        ),

        h("div", { className: "settings-group" },
          h("div", { className: "settings-group-title" }, "Web-MCP 智能扩展引擎"),
          h("div", { className: "toggle-row" },
            h("span", null, "启用内置 MCP 工具栈"),
            h("input", {
              type: "checkbox",
              checked: mcpEnabled,
              onChange: (e) => setMcpEnabled(e.target.checked)
            })
          )
        ),

        h("button", {
          onClick: handleSave,
          style: {
            background: "#4E7E8E",
            color: "#FFF",
            border: "none",
            borderRadius: 12,
            padding: "12px",
            fontSize: 15,
            fontWeight: "600",
            cursor: "pointer"
          }
        }, savedTip ? "✓ 配置已成功保存！" : "保存设置")
      )
    );
  }

  // 挂载 React 根节点
  const rootElement = document.getElementById("root");
  if (rootElement && ReactDOM) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(h(PhoneApp));
  }
})(window);
