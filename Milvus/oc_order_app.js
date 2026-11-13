// ==============================================================================
// 代号鸢小手机 ·「OC点单」旗舰点单微应用容器 (Nuo OC Order App Modal)
// 模式：选项 1A（沉浸式同源 Iframe 内嵌 + 顶栏轻量返回与装修胶囊）
//       选项 2A（基础直连：打通小手机 API 通道 + 世界书 + 传讯名士 + 近期聊天 至 AI 一键全域建店）
//       选项 3A（自由建店 + 下拉一键导入传讯名士为店主或关联 NPC）
//       选项 4A（仅在点单程序内游玩，只读小手机数据）
// ==============================================================================

(function (window) {
  const React = window.React;
  if (!React) return;
  const { useState, useEffect, useRef } = React;
  const h = React.createElement;

  // 在宿主窗口直接读取并组装小手机五维全量数据（兼容 file:// 与 http:// 跨帧通信）
  async function buildHostSyncPayload() {
    const payload = {
      userPersonas: [],
      activePersonaId: null,
      activeUserPersona: null,
      characters: [],
      charSettings: {},
      worldBookContext: '',
      worldBookEntries: [],
      chatHistories: {},
      apiConfigs: [],
      selectedApiIndex: 0,
      minimaxConfig: null,
      apiReady: false
    };

    try {
      payload.userPersonas = JSON.parse(localStorage.getItem('user_personas') || '[]');
      payload.activePersonaId =
        localStorage.getItem('active_persona_id') ||
        localStorage.getItem('active_user_persona_id') ||
        null;
      if (Array.isArray(payload.userPersonas) && payload.userPersonas.length > 0) {
        payload.activeUserPersona =
          payload.userPersonas.find(p => p && String(p.id) === String(payload.activePersonaId)) ||
          payload.userPersonas[0];
      }
    } catch (e) {}

    try {
      payload.charSettings = JSON.parse(localStorage.getItem('character_settings') || '{}');
    } catch (e) {}

    try {
      payload.apiConfigs = JSON.parse(localStorage.getItem('api_configs') || '[]');
      payload.selectedApiIndex = parseInt(localStorage.getItem('selected_api_config_index') || '0', 10) || 0;
      const mmRaw = localStorage.getItem('minimax_api_config');
      if (mmRaw) payload.minimaxConfig = JSON.parse(mmRaw);
      const activeCfg = payload.apiConfigs[payload.selectedApiIndex] || payload.apiConfigs[0];
      payload.apiReady = Boolean(
        typeof window.sendToLLM === 'function' ||
        (activeCfg && activeCfg.url && activeCfg.apiKey) ||
        (payload.minimaxConfig && payload.minimaxConfig.apiKey && payload.minimaxConfig.groupId)
      );
    } catch (e) {}

    // 1. 读取传讯中的全量角色（优先 IndexedDB chatCharacterStore -> __T8_LIVE_CHATS -> t8_chat_list）
    let rawList = [];
    if (window.chatCharacterStore && typeof window.chatCharacterStore.getAll === 'function') {
      try {
        const stored = await window.chatCharacterStore.getAll();
        if (Array.isArray(stored) && stored.length > 0) {
          rawList = stored;
        }
      } catch (e) {
        console.warn('[NuoOCOrder] chatCharacterStore.getAll 异常:', e);
      }
    }

    if (rawList.length === 0 && Array.isArray(window.__T8_LIVE_CHATS) && window.__T8_LIVE_CHATS.length > 0) {
      rawList = window.__T8_LIVE_CHATS;
    }

    try {
      const localStored = JSON.parse(localStorage.getItem('t8_chat_list') || '[]');
      if (Array.isArray(localStored) && localStored.length > 0) {
        if (rawList.length === 0) {
          rawList = localStored;
        } else {
          const seenIds = new Set(rawList.map(c => String(c && (c.id || c.name))));
          const seenNames = new Set(rawList.map(c => c && (c.name || c.nickname)));
          localStored.forEach(c => {
            if (c && (c.name || c.nickname) && !seenIds.has(String(c.id || c.name)) && !seenNames.has(c.name || c.nickname)) {
              rawList.push(c);
            }
          });
        }
      }
    } catch (e) {}

    // 过滤掉群聊、装扮、动态等非名士条目
    const validChars = rawList.filter(c =>
      c && typeof c === 'object' && (c.name || c.nickname) &&
      !String(c.id).startsWith('group') && c.type !== 'group' && c.type !== 'decor' && c.type !== 'moments'
    );

    if (validChars.length > 0) {
      try {
        localStorage.setItem('t8_chat_list', JSON.stringify(validChars));
      } catch (e) {}
    }

    // 2. 为每位传讯角色解析真实头像（avatarStore）、角色设置（character_settings）、角色文档（characterDocStore）与最近聊天记录（chatHistoryStore）
    let customAvatarsMap = {};
    try {
      customAvatarsMap = JSON.parse(localStorage.getItem('t8_mansion_custom_avatars') || '{}');
    } catch (e) {}

    const resolveAvatarFromHost = async (rawAvatar, charId) => {
      if (customAvatarsMap[charId] && customAvatarsMap[charId][0]) {
        return customAvatarsMap[charId][0];
      }
      if (typeof rawAvatar === 'string' && (rawAvatar.startsWith('http') || rawAvatar.startsWith('data:image') || rawAvatar.startsWith('blob:'))) {
        return rawAvatar;
      }
      if (rawAvatar !== undefined && rawAvatar !== null && rawAvatar !== '' && window.avatarStore && typeof window.avatarStore.get === 'function') {
        const keysToTry = [rawAvatar];
        const asNum = Number(rawAvatar);
        if (!Number.isNaN(asNum) && asNum !== rawAvatar) keysToTry.push(asNum);
        const asStr = String(rawAvatar);
        if (asStr !== rawAvatar) keysToTry.push(asStr);
        if (charId !== undefined && charId !== null) {
          keysToTry.push(charId, Number(charId), String(charId));
        }
        for (const k of keysToTry) {
          try {
            const item = await window.avatarStore.get(k);
            if (item && item.avatarData) return item.avatarData;
            if (typeof item === 'string' && item.startsWith('data:image')) return item;
          } catch (e) {}
        }
      }
      return '';
    };

    const enrichedChars = [];
    for (const c of validChars) {
      const charIdStr = String(c.id || c.name || '');
      const charName = String(c.name || c.nickname || '名士').trim();
      const extraSetting =
        payload.charSettings[charIdStr] ||
        payload.charSettings[charName] ||
        {};
      const copy = {
        ...c,
        profile: c.profile ? { ...c.profile } : {},
        extraSetting
      };

      const rawAv = c.avatar !== undefined && c.avatar !== null ? c.avatar : (c.profile && c.profile.avatar);
      const resolvedAv = await resolveAvatarFromHost(rawAv, c.id);
      if (resolvedAv) {
        copy.avatar = resolvedAv;
        if (copy.profile) copy.profile.avatar = resolvedAv;
      }

      if (window.characterDocStore && typeof window.characterDocStore.getEnabledDocContext === 'function') {
        try {
          const docTxt = await window.characterDocStore.getEnabledDocContext(c.id);
          if (docTxt && docTxt.trim()) copy.docContext = docTxt.trim().slice(0, 800);
        } catch (e) {}
      }

      if (window.chatHistoryStore && typeof window.chatHistoryStore.getMessages === 'function') {
        try {
          const res = await window.chatHistoryStore.getMessages(c.id, 1, 30);
          if (res && Array.isArray(res.messages) && res.messages.length > 0) {
            const lines = res.messages
              .filter(m => m && m.text && !String(m.text).startsWith('data:image'))
              .slice(-25)
              .map(m => `${m.isMe ? '玩家' : charName}：${String(m.text).replace(/\s+/g, ' ').slice(0, 140)}`);
            if (lines.length > 0) {
              const joined = lines.join('\n');
              payload.chatHistories[charIdStr] = joined;
              payload.chatHistories[charName] = joined;
            }
          }
        } catch (e) {}
      }

      enrichedChars.push(copy);
    }

    payload.characters = enrichedChars;

    // 3. 读取世界书已开启条目
    try {
      if (window.worldBookStore && typeof window.worldBookStore.getData === 'function') {
        const data = await window.worldBookStore.getData();
        if (data && Array.isArray(data.books)) {
          const active = data.books.filter(b => b && b.enable);
          payload.worldBookEntries = active.map(b => ({
            id: b.id || ('wb_' + Math.random().toString(36).slice(2, 8)),
            title: b.title || '世界书设定',
            content: b.content || '',
            enabled: true
          }));
          if (active.length > 0) {
            payload.worldBookContext = active
              .map(b => `【设定：${b.title}】\n${b.content}`)
              .join('\n\n')
              .slice(0, 2200);
          }
        }
      }
      if (!payload.worldBookContext && typeof window.getWorldBookContext === 'function') {
        const wb = await window.getWorldBookContext();
        if (wb) payload.worldBookContext = String(wb).slice(0, 2200);
      }
    } catch (e) {}

    return payload;
  }

  const NuoOCOrderAppModal = ({ isOpen, onClose }) => {
    const iframeRef = useRef(null);

    // 向 OC 点单程序 iframe 推送宿主五维全量数据
    const pushSyncToIframe = async (showToastInIframe = false) => {
      try {
        const hostPayload = await buildHostSyncPayload();
        const win = iframeRef.current && iframeRef.current.contentWindow;
        if (win) {
          win.postMessage({
            type: 'OC_ORDER_HOST_SYNC_PAYLOAD',
            showToast: showToastInIframe,
            payload: hostPayload
          }, '*');
        }
      } catch (e) {
        console.warn('[NuoOCOrder] 推送宿主同步数据异常:', e);
      }
    };

    // 监听来自 OC 点单程序 iframe 的同步请求、LLM 代理请求或关闭请求
    useEffect(() => {
      if (!isOpen) return;
      const handleMessage = async (e) => {
        const data = e && e.data;
        if (!data || typeof data !== 'object') return;
        if (data.type === 'OC_ORDER_REQUEST_HOST_SYNC') {
          await pushSyncToIframe(Boolean(data.showToast));
        } else if (data.type === 'OC_ORDER_LLM_REQUEST') {
          const reqId = data.requestId;
          const win = iframeRef.current && iframeRef.current.contentWindow;
          if (!win || !reqId) return;
          if (typeof window.sendToLLM === 'function') {
            window.sendToLLM(
              data.messages || [],
              { disableMCP: true, ...(data.customConfig || {}) },
              (reply) => {
                win.postMessage({ type: 'OC_ORDER_LLM_RESPONSE', requestId: reqId, reply }, '*');
              },
              (err) => {
                win.postMessage({ type: 'OC_ORDER_LLM_RESPONSE', requestId: reqId, error: String(err || 'AI 调用失败') }, '*');
              }
            );
          } else {
            win.postMessage({ type: 'OC_ORDER_LLM_RESPONSE', requestId: reqId, error: '宿主未定义 sendToLLM' }, '*');
          }
        } else if (data.type === 'OC_ORDER_CLOSE_MODAL') {
          if (typeof onClose === 'function') onClose();
        }
      };
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleIframeLoad = () => {
      pushSyncToIframe(false);
    };

    return h(
      'div',
      {
        className: 'nuo-oc-order-modal-overlay',
        style: {
          position: 'fixed',
          inset: 0,
          zIndex: 10005,
          background: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }
      },
      h('iframe', {
        ref: iframeRef,
        src: './oc点单程序.html',
        title: 'OC点单',
        onLoad: handleIframeLoad,
        style: {
          flex: 1,
          width: '100%',
          height: '100%',
          border: 'none',
          background: '#f8fafc',
          display: 'block'
        }
      })
    );
  };

  window.NuoOCOrderAppModal = NuoOCOrderAppModal;
})(window);

