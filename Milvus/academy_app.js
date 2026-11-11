// ==============================================================================
// 代号鸢小手机 ·「今日学宫」辟雍太学教务与校园生活微应用容器 (Nuo Academy App Modal)
// 模式：选项 1A（丝滑同源 Iframe 内嵌 + ↗ 独立窗口双模）
//       选项 2A（名士分身切换 + 伴读双响应）
//       选项 3A（打通 API 配置 + 玩家身份配置库 + 传讯名士全息档案 + 世界书 + 传讯聊天记录）
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
      characters: [],
      charSettings: {},
      worldBookContext: '',
      chatHistories: {},
      apiConfigs: [],
      selectedApiIndex: 0,
      minimaxConfig: null,
      apiReady: false
    };

    try {
      payload.userPersonas = JSON.parse(localStorage.getItem('user_personas') || '[]');
      payload.activePersonaId = localStorage.getItem('active_persona_id') || localStorage.getItem('active_user_persona_id') || null;
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
        console.warn('[NuoAcademy] chatCharacterStore.getAll 异常:', e);
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

    // 同步一份最新快照至 localStorage 便于同源秒读
    if (validChars.length > 0) {
      try {
        localStorage.setItem('t8_chat_list', JSON.stringify(validChars));
      } catch (e) {}
    }

    // 2. 为每位传讯角色解析真实头像（avatarStore）、角色挂载文档（characterDocStore）与最近 18 条传讯聊天记录（chatHistoryStore）
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
      const copy = { ...c, profile: c.profile ? { ...c.profile } : {} };
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
          const res = await window.chatHistoryStore.getMessages(c.id, 1, 35);
          if (res && Array.isArray(res.messages) && res.messages.length > 0) {
            const charName = String(c.name || c.nickname || '名士').trim();
            const lines = res.messages
              .filter(m => m && m.text && !String(m.text).startsWith('data:image'))
              .slice(-30)
              .map(m => `${m.isMe ? '玩家' : charName}：${String(m.text).replace(/\s+/g, ' ').slice(0, 140)}`);
            if (lines.length > 0) {
              payload.chatHistories[String(c.id)] = lines.join('\n');
              payload.chatHistories[charName] = lines.join('\n');
            }
          }
        } catch (e) {}
      }

      enrichedChars.push(copy);
    }

    payload.characters = enrichedChars;

    // 3. 读取世界书已开启条目
    try {
      if (typeof window.getWorldBookContext === 'function') {
        const wb = await window.getWorldBookContext();
        if (wb) payload.worldBookContext = String(wb).slice(0, 1800);
      }
      if (!payload.worldBookContext && window.worldBookStore && typeof window.worldBookStore.getData === 'function') {
        const data = await window.worldBookStore.getData();
        if (data && Array.isArray(data.books)) {
          const active = data.books.filter(b => b && b.enable);
          if (active.length > 0) {
            payload.worldBookContext = active.map(b => `【设定：${b.title}】\n${b.content}`).join('\n\n').slice(0, 1800);
          }
        }
      }
    } catch (e) {}

    return payload;
  }

  const NuoAcademyAppModal = ({ isOpen, onClose }) => {
    const iframeRef = useRef(null);
    const [bridgeStatus, setBridgeStatus] = useState({
      connected: false,
      personaName: '广陵王',
      charCount: 0,
      apiReady: false
    });
    const [radioPlaying, setRadioPlaying] = useState(false);

    // 监听小手机电台后台播放状态，展示不断连提示
    useEffect(() => {
      if (!isOpen) return;
      const player = window.radioGlobalPlayer;
      if (player && typeof player.subscribe === 'function') {
        const unsub = player.subscribe((st) => {
          setRadioPlaying(Boolean(st && st.isPlaying));
        });
        return () => {
          if (typeof unsub === 'function') unsub();
        };
      }
    }, [isOpen]);

    // 向今日学宫 iframe 推送宿主全量数据（兼容 file:// 与 http://）
    const pushSyncToIframe = async (showToastInIframe = false) => {
      try {
        const hostPayload = await buildHostSyncPayload();
        const win = iframeRef.current && iframeRef.current.contentWindow;
        if (win) {
          win.postMessage({
            type: 'ACADEMY_HOST_SYNC_PAYLOAD',
            showToast: showToastInIframe,
            payload: hostPayload
          }, '*');
        }
        setBridgeStatus((prev) => ({
          connected: true,
          personaName: prev.personaName || '广陵王',
          charCount: hostPayload.characters.length || prev.charCount || 5,
          apiReady: hostPayload.apiReady
        }));
      } catch (e) {
        console.warn('[NuoAcademy] 推送宿主同步数据异常:', e);
      }
    };

    // 监听来自今日学宫 iframe 的状态回报、同步请求、LLM 代理请求或关闭请求
    useEffect(() => {
      if (!isOpen) return;
      const handleMessage = async (e) => {
        const data = e && e.data;
        if (!data || typeof data !== 'object') return;
        if (data.type === 'ACADEMY_BRIDGE_READY' || data.type === 'ACADEMY_SYNC_COMPLETE') {
          setBridgeStatus({
            connected: true,
            personaName: data.personaName || '广陵王',
            charCount: data.charCount || 5,
            apiReady: Boolean(data.apiReady)
          });
        } else if (data.type === 'ACADEMY_REQUEST_HOST_SYNC') {
          await pushSyncToIframe(Boolean(data.showToast));
        } else if (data.type === 'ACADEMY_LLM_REQUEST') {
          const reqId = data.requestId;
          const win = iframeRef.current && iframeRef.current.contentWindow;
          if (!win || !reqId) return;
          if (typeof window.sendToLLM === 'function') {
            window.sendToLLM(
              data.messages || [],
              { disableMCP: true, ...(data.customConfig || {}) },
              (reply) => {
                win.postMessage({ type: 'ACADEMY_LLM_RESPONSE', requestId: reqId, reply }, '*');
              },
              (err) => {
                win.postMessage({ type: 'ACADEMY_LLM_RESPONSE', requestId: reqId, error: String(err || 'AI 调用失败') }, '*');
              }
            );
          } else {
            win.postMessage({ type: 'ACADEMY_LLM_RESPONSE', requestId: reqId, error: '宿主未定义 sendToLLM' }, '*');
          }
        } else if (data.type === 'ACADEMY_CLOSE_MODAL') {
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

    const handleManualSync = () => {
      pushSyncToIframe(true);
    };

    const handleOpenStandalone = async () => {
      try {
        await buildHostSyncPayload();
      } catch (e) {}
      window.open('./今日学宫.html', '_blank');
    };

    return h(
      'div',
      {
        className: 'nuo-academy-modal-overlay',
        style: {
          position: 'fixed',
          inset: 0,
          zIndex: 10005,
          background: '#f7f6f9',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }
      },
      // 主体：全屏同源今日学宫 Iframe
      h('iframe', {
        ref: iframeRef,
        src: './今日学宫.html',
        title: '今日学宫',
        onLoad: handleIframeLoad,
        style: {
          flex: 1,
          width: '100%',
          height: '100%',
          border: 'none',
          background: '#f7f6f9',
          display: 'block'
        }
      })
    );
  };

  window.NuoAcademyAppModal = NuoAcademyAppModal;
})(window);
