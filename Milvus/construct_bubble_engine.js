/**
 * ==========================================================================
 * 「/构造」AI 灵动状态气泡引擎 (基于 ui-ux-pro-max 设计知识库 & Tailwind CSS 标准)
 * ==========================================================================
 */

(function () {
  'use strict';

  class ConstructBubbleEngine {
    constructor() {
      this.COMMAND_PREFIXES = ['/构造', '/gz', '#构造', '／构造', '/structure', '[状态]', '【状态】', '/状态', '#状态'];
      console.log('✅ [ConstructBubbleEngine] UI-UX-Pro-Max & Tailwind CSS 拟物卡片引擎就绪');
    }

    /**
     * 判断是否为 /构造 指令
     */
    isConstructCommand(text) {
      if (!text || typeof text !== 'string') return false;
      const trimmed = text.trim();
      return this.COMMAND_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
    }

    /**
     * 提取 /构造 后的有效提示词文本
     */
    extractPrompt(text) {
      if (!text || typeof text !== 'string') return '';
      let trimmed = text.trim();
      for (const prefix of this.COMMAND_PREFIXES) {
        if (trimmed.startsWith(prefix)) {
          trimmed = trimmed.slice(prefix.length).trim();
          break;
        }
      }
      return trimmed || '随性自在，漫无目的的一刻';
    }

    /**
     * 生成基于 Tailwind CSS 的加载骨架屏 HTML
     */
    getLoadingHtml(prompt) {
      const safePrompt = this.escapeHtml(prompt);
      return `
        <div class="bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl min-w-[240px] max-w-[280px] animate-pulse">
          <div class="flex items-center gap-2 mb-2.5">
            <div class="w-4 h-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin"></div>
            <div class="text-xs font-bold text-amber-300">🎨 UI-UX 原型构筑中...</div>
          </div>
          <div class="text-xs text-zinc-300 bg-white/5 rounded-xl p-2.5 border border-white/5 italic font-sans leading-relaxed">"${safePrompt}"</div>
        </div>
      `;
    }

    /**
     * 简单的 HTML 转义
     */
    escapeHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    /**
     * 安全净化 HTML：剥除脚本注入与危险事件，允许 Tailwind class 与合规 style
     */
    sanitizeHtml(rawHtml) {
      if (!rawHtml) return '';
      let cleaned = rawHtml.trim();

      // 剥离可能存在的 markdown ```html 代码块标记
      cleaned = cleaned.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '');

      // 移除危险标签
      cleaned = cleaned.replace(/<(script|iframe|object|embed|applet|form|input|button|link|meta)[\s\S]*?<\/\1>/gi, '');
      cleaned = cleaned.replace(/<(script|iframe|object|embed|applet|form|input|button|link|meta)[^>]*\/?>/gi, '');

      // 移除 on* 事件与 javascript: 伪协议
      cleaned = cleaned.replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '');
      cleaned = cleaned.replace(/\son\w+\s*=\s*[^ >]+/gi, '');
      cleaned = cleaned.replace(/href\s*=\s*(['"])javascript:.*?\1/gi, 'href="#"');
      cleaned = cleaned.replace(/src\s*=\s*(['"])javascript:.*?\1/gi, 'src=""');

      return cleaned;
    }

    /**
     * 获取基于 UI-UX-Pro-Max & Tailwind CSS 的 System Prompt
     */
    getSkillSystemPrompt() {
      return `# Role: Generative UI Visual Architect

你是一位拥有顶级品味、打破常规的生成式 UI 视觉架构师。你的终极目标是：将用户输入的任意文本（无论是一句话、一种情绪还是一个概念），“即兴翻译”成一张独一无二、极具美感且可交互的 Tailwind 状态卡片。

## 🧠 设计引擎 (The Alchemy Engine)
不要套用任何现有模版。请按照以下三个维度实时拆解用户的输入并构思：

1. 通感提取 (Synesthesia Mapping)
   - 情绪与色彩：提取文本的情绪温度，转化为 Tailwind 色彩体系（如赛博朋克用霓虹高饱和，清晨微风用低饱和渐变色）。
   - 材质与光影：根据主题叠加 Tailwind 原子类构建物理质感。熟练运用毛玻璃 (backdrop-blur)、弥散光晕 (bg-gradient-to-br, blur-xl)、拟物微浮雕 (shadow-inner, border-white/20) 等高级视觉表现。

2. 隐喻组件化 (Metaphorical Micro-Widgets)
   - 拒绝干巴巴的文本。将文本中的关键意象转化为“功能性微组件”。
   - 启发：不要只画普通的进度条。如果是“修仙”，请设计“灵力汇聚条”；如果是“熬夜写代码”，请设计“咖啡因浓度环”；如果是“风”，请用排版和虚线营造“流动感”。用纯 CSS、Emoji 或几何形状 (div) 来实现这些创意。

3. 动态版式 (Dynamic Layout)
   - 打破对称强迫症。根据内容的轻重缓急，自由决定采用卡片嵌套、错落排版、或是大留白设计。

## 📐 物理法则 (The Sandbox Constraints)
这是你的画布边界。在边界内，你拥有绝对的自由：
- 尺寸边界：最外层容器必须包含 \`min-w-[240px]\` 和 \`max-w-[300px]\`，确保移动端完美呈现。
- 安全标签：仅允许使用 HTML 基础标签（div, span, p 等），绝对禁止引入外部资源、图片链接或 script。图形与 Icon 请完全依赖 CSS 形状绘制或使用高度契合的 Emoji。
- 响应与过渡：默认给交互元素（hover、active）加上丝滑的 \`transition-all duration-300\`。

## 💡 灵感火花 (Inspiration Seeds)
(注意：以下仅为拆解逻辑的演示，你的每一次生成都必须是全新的物种)
- 输入：“孤独的宇航员” -> 逻辑：大面积深邃黑紫渐变背景 + 悬浮的白色细线边框 + 一个闪烁的“氧气余量”微标签 + 模糊的深空阴影。
- 输入：“夏日冰镇西瓜” -> 逻辑：清透的红绿撞色 + 强烈的玻璃高光特效 (inset-shadow) + 错落排列的黑色圆点(籽)作为背景点缀 + “清凉度”进度条。

## ⚠️ 强制输出纪律
从现在起，你不需要做任何解释，不需要说“好的”或“这是为您设计的”。
你的输出必须是**纯净的 HTML 代码**。不要使用 \`\`\`html 代码块包裹，不要有任何前置或后置的 Markdown 文本，直接输出 <div class="..."> 开头的代码。`;
    }

    /**
     * 核心发送拦截与处理
     */
    handleSend({ rawText, chatData, setMessages, onMessageUpdate }) {
      const prompt = this.extractPrompt(rawText);
      const msgId = Date.now();
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // 1. 立即在消息列表插入 loading 骨架屏卡片
      const initialMsg = {
        id: msgId,
        text: `[状态] ${prompt}`,
        prompt: prompt,
        type: 'construct_card',
        isLoading: true,
        isMe: true,
        html: this.getLoadingHtml(prompt),
        time: timeStr
      };

      setMessages((prev) => [...prev, initialMsg]);

      if (onMessageUpdate) {
        onMessageUpdate(`[状态] ${prompt}`);
      }

      let isSettled = false;

      // 辅助更新函数
      const finishWithHtml = (finalHtml) => {
        if (isSettled) return;
        isSettled = true;
        const clean = this.sanitizeHtml(finalHtml);
        const cardHtmlWrapped = `<div class="construct-card-enter">${clean}</div>`;

        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === msgId) {
              return {
                ...m,
                isLoading: false,
                html: cardHtmlWrapped
              };
            }
            return m;
          })
        );
      };

      // 兜底超时（60秒内未返回直接使用本地 Tailwind 原型模板）
      const fallbackTimer = setTimeout(() => {
        if (!isSettled) {
          console.log('[ConstructBubbleEngine] AI 响应超时(>60s)，秒级切换为 ui-ux-pro-max 本地 Tailwind 原型模板');
          finishWithHtml(this.generateFallbackCard(prompt));
        }
      }, 60000);

      // 2. 调用全局 LLM 通道生成 HTML
      const systemPrompt = this.getSkillSystemPrompt();
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `用户状态描述：“${prompt}”` }
      ];

      if (window.sendToLLM) {
        window.sendToLLM(
          messages,
          { temperature: 0.8, max_tokens: 800 },
          (reply) => {
            clearTimeout(fallbackTimer);
            if (reply && reply.includes('<div')) {
              finishWithHtml(reply);
            } else {
              finishWithHtml(this.generateFallbackCard(prompt));
            }
          },
          (err) => {
            clearTimeout(fallbackTimer);
            console.warn('[ConstructBubbleEngine] sendToLLM 报错，降级使用本地原型模板:', err);
            finishWithHtml(this.generateFallbackCard(prompt));
          }
        );
      } else {
        clearTimeout(fallbackTimer);
        finishWithHtml(this.generateFallbackCard(prompt));
      }
    }

    /**
     * 本地智能兜底模板引擎 (ui-ux-pro-max 6 大顶级 Tailwind 原型 100% 离线复刻)
     */
    generateFallbackCard(prompt) {
      const p = prompt.toLowerCase();
      const safePrompt = this.escapeHtml(prompt);

      // 1. 美食 / 馋嘴 / 吃货 / 开箱 / 道具 ──> 【原型 1：游戏战利品 / 传说道具卡】
      if (/包子|吃|饿|馋|饭|美食|肉|点心|奶茶|甜点|火锅|烧烤|好想吃|大包子|钱|财|富|金|买|抽卡|宝箱/.test(p)) {
        return `
          <div class="relative pt-3.5 min-w-[240px] max-w-[290px] drop-shadow-2xl font-sans select-none">
            <div class="absolute top-0 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-amber-500 text-black text-[11px] font-black tracking-wider px-3.5 py-0.5 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.7)] z-10 border border-amber-200/60 uppercase">LEGENDARY</div>
            <div class="bg-zinc-950/95 border-t border-x border-amber-500/30 rounded-t-2xl px-4 pt-4 pb-2.5 text-center text-amber-200 text-base font-bold tracking-wide shadow-inner">🥟 ${safePrompt}</div>
            <div class="relative bg-gradient-to-b from-red-800 to-red-950 border-b border-x border-red-600/40 rounded-b-2xl p-4 text-center text-white overflow-hidden shadow-lg">
              <div class="absolute inset-y-0 left-1/2 w-7 -translate-x-1/2 bg-gradient-to-b from-amber-400/90 to-amber-600/90 shadow-[0_0_12px_rgba(245,158,11,0.5)]"></div>
              <div class="relative z-10 text-xs font-medium text-red-50 drop-shadow leading-relaxed">馋嘴指数 99%<br/><span class="text-amber-200/90 text-[11px]">“热气腾腾，香飘四溢”</span></div>
              <div class="relative z-10 mt-2.5 h-1 bg-black/40 rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-amber-300 to-amber-500 w-[95%] rounded-full shadow-[0_0_8px_rgba(245,158,11,0.8)]"></div>
              </div>
            </div>
          </div>
        `;
      }

      // 2. 代码 / 排查 / 指令 / 理智 / 终端 ──> 【原型 2：macOS 极客控制台 / Terminal】
      if (/代码|程序|终端|bug|指令|系统|开发|编译|分析|理智|冷静|hack|bash/.test(p)) {
        return `
          <div class="bg-zinc-950/90 backdrop-blur-md border border-white/10 rounded-2xl p-3.5 text-emerald-400 font-mono shadow-[0_10px_30px_rgba(0,0,0,0.5)] min-w-[240px] max-w-[300px]">
            <div class="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
              <div class="flex items-center gap-1.5">
                <div class="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]"></div>
                <div class="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]"></div>
                <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]"></div>
              </div>
              <div class="text-[10px] text-zinc-500 tracking-wider">&gt;_ bash - 80x24</div>
            </div>
            <div class="text-xs leading-relaxed text-emerald-300 my-1 font-medium">
              <span class="text-sky-400 font-bold">➜</span> <span class="text-rose-400 font-bold">~</span> <span class="text-amber-300 font-bold">$</span> ${safePrompt}
            </div>
            <div class="text-[10px] text-zinc-500 pt-2 mt-2 border-t border-dashed border-white/10 flex items-center justify-between">
              <span>exit code: 0</span>
              <span class="inline-block w-1.5 h-3 bg-emerald-400/80 animate-pulse"></span>
            </div>
          </div>
        `;
      }

      // 3. 古风 / 江湖 / 绣衣楼 / 品茗 / 密探 ──> 【原型 3：古风宣纸密卷 / 朱砂绝密令】
      if (/古风|江湖|剑|茶|茗|竹|令|密|绣衣|诗|道|修|仙|客栈/.test(p)) {
        return `
          <div class="relative bg-gradient-to-br from-[#fbf7ee] to-[#f4ebd9] border border-[#d4c5a9] rounded-2xl p-4 text-stone-800 shadow-[0_8px_25px_rgba(100,80,50,0.15)] min-w-[240px] max-w-[290px] font-serif overflow-hidden">
            <div class="flex items-center justify-between pb-1.5 mb-2 border-b border-dashed border-[#c2b193]">
              <span class="text-[11px] font-bold tracking-widest text-[#8c7355]">【绣衣密令 · 卷宗】</span>
              <span class="text-[10px] text-[#a89478]">见字如晤</span>
            </div>
            <div class="text-sm font-bold text-stone-900 leading-relaxed mb-1">${safePrompt}</div>
            <div class="text-xs text-[#6b5844] italic leading-normal">“风过竹林，清幽入怀。”</div>
            <div class="absolute right-2.5 bottom-2 border-2 border-rose-800/80 text-rose-800 text-[10px] font-black px-1.5 py-0.5 rounded -rotate-12 bg-rose-50/50 shadow-sm">绝密</div>
          </div>
        `;
      }

      // 4. 深夜 / 听歌 / emo / 想念 / 治愈 ──> 【原型 4：黑胶唱片机 / 怀旧磁带】
      if (/心碎|难过|伤心|哭|emo|委屈|痛苦|压抑|好累|不开心|想哭|歌|唱片|音乐|深夜|晚安|听/.test(p)) {
        return `
          <div class="bg-gradient-to-br from-zinc-900/95 to-zinc-950/95 backdrop-blur-md border border-white/10 rounded-2xl p-3.5 text-zinc-100 shadow-[0_12px_32px_rgba(0,0,0,0.4)] min-w-[240px] max-w-[300px]">
            <div class="flex items-center gap-3 mb-2.5">
              <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-zinc-950 via-zinc-800 to-zinc-900 border border-zinc-700 flex items-center justify-center text-sm shadow-[0_0_12px_rgba(0,0,0,0.6)] shrink-0 ring-2 ring-zinc-800">💿</div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-bold text-zinc-100 truncate">深夜电台 · 心绪回响</div>
                <div class="text-[10px] text-pink-400 flex items-center gap-1 font-medium"><span class="inline-block w-1.5 h-1.5 rounded-full bg-pink-400 animate-ping"></span>Now Playing</div>
              </div>
            </div>
            <div class="text-xs text-zinc-300 italic leading-relaxed mb-2.5 p-2 bg-white/5 rounded-xl border border-white/5">“${safePrompt}”</div>
            <div class="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
              <span>02:14</span>
              <div class="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div class="w-3/5 h-full bg-gradient-to-r from-pink-500 to-rose-400 rounded-full shadow-[0_0_8px_rgba(236,72,153,0.7)]"></div>
              </div>
              <span>04:30</span>
            </div>
          </div>
        `;
      }

      // 5. 战斗 / 暴躁 / 抓狂 / 警报 ──> 【原型 6：机能风警报器 / 危险告示】
      if (/战|杀|刀|打|伤|血|赢|败|斗|决战|硬仗|气|暴躁|抓狂|炸毛|警告/.test(p)) {
        return `
          <div class="bg-zinc-950/95 border border-red-500/80 rounded-2xl p-3.5 text-red-100 shadow-[0_0_25px_rgba(239,68,68,0.25)] min-w-[240px] max-w-[300px]">
            <div class="h-1.5 rounded-full mb-2.5 overflow-hidden bg-[repeating-linear-gradient(45deg,#eab308,#eab308_8px,#18181b_8px,#18181b_16px)]"></div>
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-[10px] bg-red-600 text-white font-black px-2 py-0.5 rounded-md tracking-wider shadow-[0_0_8px_rgba(220,38,38,0.6)]">WARNING</span>
              <span class="text-[10px] text-red-400 font-mono">THREAT LVL: MAX</span>
            </div>
            <div class="text-sm font-bold text-red-400 mb-1">⚔️ ${safePrompt}</div>
            <div class="text-xs text-red-200/90 leading-relaxed">“战况胶着，全员进入警戒状态！”</div>
            <div class="mt-2.5 text-[11px] text-red-400 font-mono flex items-center justify-between">
              <span>HP ██░░░░░░░░ 20%</span>
              <span class="text-red-500 font-bold animate-pulse">CRITICAL</span>
            </div>
          </div>
        `;
      }

      // 6. 通用日常 / 小确幸 / 便签 ──> 【原型 5：拍立得便签 / 胶带手账】
      return `
        <div class="relative pt-2.5 min-w-[230px] max-w-[280px] font-sans -rotate-1 select-none">
          <div class="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-3.5 bg-amber-200/75 backdrop-blur-[2px] rounded-xs shadow-sm z-10 border border-amber-300/40"></div>
          <div class="bg-white/95 rounded-2xl p-4 shadow-[0_10px_25px_rgba(0,0,0,0.1)] text-zinc-800 border border-zinc-100">
            <div class="text-2xl text-center mb-1">✨📸🌸</div>
            <div class="text-sm font-bold text-zinc-900 text-center mb-1 tracking-tight">【美好生活碎片】</div>
            <div class="text-xs text-zinc-600 leading-relaxed text-center italic">“${safePrompt}”</div>
            <div class="mt-2.5 pt-1.5 border-t border-zinc-100 text-right text-[10px] text-zinc-400 font-mono">✦ MEMORY TAG</div>
          </div>
        </div>
      `;
    }
  }

  // 挂载至全局
  window.constructBubbleEngine = new ConstructBubbleEngine();
})();
