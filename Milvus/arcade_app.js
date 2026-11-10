// ==============================================================================
// 代号鸢小手机 ·「傩·掌机」复古掌机模拟器 (Nuo Arcade Console Engine)
// 结构：1:1 纯原版照搬 (轻拟物 ArcadeApp)
// 特性：Ruffle WASM 引擎 + 经典 Game Boy 灰蓝拟物机身 + 穿透 Shadow DOM 按键网桥
//       + 触屏实体手感十字键与A/B键 + PC 键盘无缝映射 + 卡带收纳盒与 .swf 自由导入
// ==============================================================================

(function (window) {
  const React = window.React;
  if (!React) return;
  const { useState, useEffect, useRef } = React;
  const h = React.createElement;

  // ----------------------------------------------------------------------------
  // 1. 样式与动画注入
  // ----------------------------------------------------------------------------
  function ensureArcadeStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('nuo-arcade-styles')) return;
    const style = document.createElement('style');
    style.id = 'nuo-arcade-styles';
    style.textContent = `
      @keyframes spinArcade { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      .spin-arcade-animation { animation: spinArcade 1s linear infinite; }
      @keyframes fadeInArcade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes bounceArcade { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
    `;
    document.head.appendChild(style);
  }

  // ----------------------------------------------------------------------------
  // 2. 内联 SVG 图标库
  // ----------------------------------------------------------------------------
  function IconArrowLeft({ size = 15, color = '#FFFFFF', strokeWidth = 3 }) {
    return h('svg', {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round'
    },
      h('path', { d: 'm12 19-7-7 7-7' }),
      h('path', { d: 'M19 12H5' })
    );
  }

  function IconVolume2({ size = 14, color = '#1E293B' }) {
    return h('svg', {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round'
    },
      h('polygon', { points: '11 5 6 9 2 9 2 15 6 15 11 19 11 5' }),
      h('path', { d: 'M15.54 8.46a5 5 0 0 1 0 7.07' }),
      h('path', { d: 'M19.07 4.93a10 10 0 0 1 0 14.14' })
    );
  }

  function IconVolumeX({ size = 14, color = '#DC2626' }) {
    return h('svg', {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round'
    },
      h('polygon', { points: '11 5 6 9 2 9 2 15 6 15 11 19 11 5' }),
      h('line', { x1: '22', y1: '9', x2: '16', y2: '15' }),
      h('line', { x1: '16', y1: '9', x2: '22', y2: '15' })
    );
  }

  function IconDisc({ size = 13, color = '#1E293B', strokeWidth = 2.5 }) {
    return h('svg', {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round'
    },
      h('circle', { cx: '12', cy: '12', r: '10' }),
      h('circle', { cx: '12', cy: '12', r: '3' })
    );
  }

  function IconMaximize2({ size = 13, color = '#1E293B' }) {
    return h('svg', {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round'
    },
      h('polyline', { points: '15 3 21 3 21 9' }),
      h('polyline', { points: '9 21 3 21 3 15' }),
      h('line', { x1: '21', y1: '3', x2: '14', y2: '10' }),
      h('line', { x1: '3', y1: '21', x2: '10', y2: '14' })
    );
  }

  function IconMinimize2({ size = 13, color = '#1E293B' }) {
    return h('svg', {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round'
    },
      h('polyline', { points: '4 14 10 14 10 20' }),
      h('polyline', { points: '20 10 14 10 14 4' }),
      h('line', { x1: '14', y1: '10', x2: '21', y2: '3' }),
      h('line', { x1: '3', y1: '21', x2: '10', y2: '14' })
    );
  }

  function IconUpload({ size = 16, color = '#2563EB', strokeWidth = 2.5 }) {
    return h('svg', {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round'
    },
      h('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
      h('polyline', { points: '17 8 12 3 7 8' }),
      h('line', { x1: '12', y1: '3', x2: '12', y2: '15' })
    );
  }

  function IconTrash2({ size = 13, color = '#DC2626' }) {
    return h('svg', {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round'
    },
      h('path', { d: 'M3 6h18' }),
      h('path', { d: 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' }),
      h('path', { d: 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' }),
      h('line', { x1: '10', y1: '11', x2: '10', y2: '17' }),
      h('line', { x1: '14', y1: '11', x2: '14', y2: '17' })
    );
  }

  function IconPlay({ size = 10, fill = '#FFFFFF' }) {
    return h('svg', {
      width: size, height: size, viewBox: '0 0 24 24', fill: fill, stroke: 'none'
    },
      h('polygon', { points: '5 3 19 12 5 21 5 3' })
    );
  }

  function IconX({ size = 14, color = '#1E293B', strokeWidth = 3 }) {
    return h('svg', {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round'
    },
      h('line', { x1: '18', y1: '6', x2: '6', y2: '18' }),
      h('line', { x1: '6', y1: '6', x2: '18', y2: '18' })
    );
  }

  function IconRefreshCw({ size = 24, color = '#38BDF8' }) {
    return h('svg', {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
      className: 'spin-arcade-animation'
    },
      h('path', { d: 'M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }),
      h('path', { d: 'M3 3v5h5' }),
      h('path', { d: 'M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16' }),
      h('path', { d: 'M16 21h5v-5' })
    );
  }

  function IconAlertCircle({ size = 28, color = '#EF4444' }) {
    return h('svg', {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round'
    },
      h('circle', { cx: '12', cy: '12', r: '10' }),
      h('line', { x1: '12', y1: '8', x2: '12', y2: '12' }),
      h('line', { x1: '12', y1: '16', x2: '12.01', y2: '16' })
    );
  }

  // ----------------------------------------------------------------------------
  // 3. 卡带数据存储管理（纯内存运行时卡带库，零存储膨胀）
  // ----------------------------------------------------------------------------
  const CARTRIDGE_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1'];
  const CARTRIDGE_EMOJIS = ['🎮', '👾', '🕹️', '⚔️', '🚀', '🐱', '⭐', '💎', '🔥', '🏆'];

  let inMemorySWFGames = [];

  async function loadAllSWFGames() {
    return [...inMemorySWFGames].sort(
      (a, b) => (b.lastPlayedAt || b.createdAt) - (a.lastPlayedAt || a.createdAt)
    );
  }

  async function saveSWFGame(game) {
    const index = inMemorySWFGames.findIndex((g) => g.id === game.id);
    if (index >= 0) {
      inMemorySWFGames[index] = game;
    } else {
      inMemorySWFGames.push(game);
    }
  }

  async function deleteSWFGame(id) {
    inMemorySWFGames = inMemorySWFGames.filter((g) => g.id !== id);
  }

  async function updateGameLastPlayed(id) {
    const game = inMemorySWFGames.find((g) => g.id === id);
    if (game) {
      game.lastPlayedAt = Date.now();
    }
  }

  async function importSWFFile(file) {
    const buffer = await file.arrayBuffer();
    const cleanTitle = file.name.replace(/\.swf$/i, '').trim() || '未命名Flash游戏';
    const randomColor = CARTRIDGE_COLORS[Math.floor(Math.random() * CARTRIDGE_COLORS.length)];
    const randomEmoji = CARTRIDGE_EMOJIS[Math.floor(Math.random() * CARTRIDGE_EMOJIS.length)];

    const newGame = {
      id: `swf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: cleanTitle,
      fileSize: file.size,
      data: buffer,
      coverEmoji: randomEmoji,
      color: randomColor,
      createdAt: Date.now(),
      lastPlayedAt: Date.now(),
    };

    await saveSWFGame(newGame);
    return newGame;
  }

  // ----------------------------------------------------------------------------
  // 4. Ruffle WASM 引擎动态载入（多源容灾）
  // ----------------------------------------------------------------------------
  let ruffleLoadingPromise = null;
  function ensureRuffleLoaded() {
    if (typeof window === 'undefined') return Promise.resolve();
    if (window.RufflePlayer) return Promise.resolve();
    if (ruffleLoadingPromise) return ruffleLoadingPromise;

    ruffleLoadingPromise = new Promise((resolve, reject) => {
      const ruffleObj = window.RufflePlayer || {};
      window.RufflePlayer = ruffleObj;
      ruffleObj.config = {
        autoplay: 'on',
        unmuteOverlay: 'hidden',
        letterbox: 'on',
        warnOnUnsupportedContent: false,
      };

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@ruffle-rs/ruffle';
      script.async = true;

      script.onload = () => {
        resolve();
      };

      script.onerror = () => {
        console.warn('[Ruffle] unpkg 加载失败，切换 jsdelivr...');
        const fallbackScript = document.createElement('script');
        fallbackScript.src = 'https://cdn.jsdelivr.net/npm/@ruffle-rs/ruffle';
        fallbackScript.async = true;
        fallbackScript.onload = () => resolve();
        fallbackScript.onerror = () => reject(new Error('无法载入 Flash 模拟器引擎，请检查网络连接'));
        document.head.appendChild(fallbackScript);
      };

      document.head.appendChild(script);
    });

    return ruffleLoadingPromise;
  }

  // ----------------------------------------------------------------------------
  // 5. 按键规格与网桥定义（Shadow DOM 穿透直通 Flash AS2/AS3）
  // ----------------------------------------------------------------------------
  const KEY_SPECS = {
    ArrowUp: { code: 'ArrowUp', key: 'ArrowUp', keyCode: 38 },
    ArrowDown: { code: 'ArrowDown', key: 'ArrowDown', keyCode: 40 },
    ArrowLeft: { code: 'ArrowLeft', key: 'ArrowLeft', keyCode: 37 },
    ArrowRight: { code: 'ArrowRight', key: 'ArrowRight', keyCode: 39 },
    Space: { code: 'Space', key: ' ', keyCode: 32 },
    Enter: { code: 'Enter', key: 'Enter', keyCode: 13 },
    ShiftLeft: { code: 'ShiftLeft', key: 'Shift', keyCode: 16 },
    KeyW: { code: 'KeyW', key: 'w', keyCode: 87 },
    KeyS: { code: 'KeyS', key: 's', keyCode: 83 },
    KeyA: { code: 'KeyA', key: 'a', keyCode: 65 },
    KeyD: { code: 'KeyD', key: 'd', keyCode: 68 },
    KeyZ: { code: 'KeyZ', key: 'z', keyCode: 90 },
    KeyX: { code: 'KeyX', key: 'x', keyCode: 88 },
    KeyJ: { code: 'KeyJ', key: 'j', keyCode: 74 },
    KeyK: { code: 'KeyK', key: 'k', keyCode: 75 },
  };

  function dispatchRuffleKey(eventType, spec) {
    const { code, key, keyCode } = spec;
    const eventInit = {
      code,
      key,
      bubbles: true,
      cancelable: true,
      composed: true, // 核心：允许穿透 Shadow DOM 边界
    };

    let evt;
    try {
      evt = new KeyboardEvent(eventType, eventInit);
      Object.defineProperty(evt, 'keyCode', { value: keyCode, configurable: true });
      Object.defineProperty(evt, 'which', { value: keyCode, configurable: true });
      Object.defineProperty(evt, 'charCode', {
        value: eventType === 'keydown' ? keyCode : 0,
        configurable: true,
      });
      evt.__fromArcadeBridge = true;
    } catch {
      evt = new KeyboardEvent(eventType, eventInit);
      evt.__fromArcadeBridge = true;
    }

    // 1. 直达 RufflePlayer 宿主元素及其内部 ShadowRoot (Canvas + Container)
    const players = document.querySelectorAll('ruffle-player');
    players.forEach((p) => {
      try {
        p.dispatchEvent(evt);
        const shadow = p.shadowRoot;
        if (shadow) {
          const canvas = shadow.querySelector('canvas');
          if (canvas) {
            canvas.dispatchEvent(evt);
          }
          const container = shadow.getElementById('container');
          if (container) {
            container.dispatchEvent(evt);
          }
        }
      } catch {
        // ignore
      }
    });

    // 2. 向 window 与 document 派发
    try {
      window.dispatchEvent(evt);
      document.dispatchEvent(evt);
    } catch {
      // ignore
    }
  }

  // ----------------------------------------------------------------------------
  // 6. Ruffle 播放器视口组件
  // ----------------------------------------------------------------------------
  function RufflePlayerView({ gameData, gameTitle, isMuted = false }) {
    const containerRef = useRef(null);
    const playerRef = useRef(null);
    const blobUrlRef = useRef(null);

    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);

    useEffect(() => {
      let isCancelled = false;

      if (!gameData || gameData.byteLength === 0) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMsg(null);

      // 清理旧播放器
      if (playerRef.current) {
        try {
          playerRef.current.remove();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

      ensureRuffleLoaded()
        .then(() => {
          if (isCancelled || !containerRef.current) return;

          const ruffle = window.RufflePlayer && window.RufflePlayer.newest ? window.RufflePlayer.newest() : null;
          if (!ruffle) {
            throw new Error('RufflePlayer 初始化异常');
          }

          const player = ruffle.createPlayer();
          playerRef.current = player;

          // 设置播放器在容器内自适应填满与可聚焦状态
          player.style.width = '100%';
          player.style.height = '100%';
          player.style.display = 'block';
          player.style.outline = 'none';
          player.setAttribute('tabindex', '0');

          // 挂载到 DOM
          containerRef.current.innerHTML = '';
          containerRef.current.appendChild(player);

          // 生成 Blob URL 载入
          const blob = new Blob([gameData], { type: 'application/x-shockwave-flash' });
          const blobUrl = URL.createObjectURL(blob);
          blobUrlRef.current = blobUrl;

          const loadPromise = player.load({
            url: blobUrl,
            allowScriptAccess: false,
            parameters: {},
            scale: 'showAll',
            letterbox: 'on',
          });

          // 自动聚焦保证物理按键与触控事件直达 WASM 核心
          setTimeout(() => {
            try {
              player.focus();
              const canvas = player.shadowRoot && player.shadowRoot.querySelector('canvas');
              if (canvas) {
                canvas.setAttribute('tabindex', '0');
                canvas.focus();
              }
            } catch {
              // ignore
            }
          }, 200);

          return loadPromise;
        })
        .then(() => {
          if (!isCancelled) {
            setIsLoading(false);
          }
        })
        .catch((err) => {
          if (!isCancelled) {
            console.error('[Ruffle] 运行失败:', err);
            setErrorMsg(err.message || 'Flash 游戏加载失败');
            setIsLoading(false);
          }
        });

      return () => {
        isCancelled = true;
        if (playerRef.current) {
          try {
            playerRef.current.remove();
          } catch {
            // ignore
          }
          playerRef.current = null;
        }
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
      };
    }, [gameData]);

    // 静音控制
    useEffect(() => {
      if (playerRef.current) {
        try {
          playerRef.current.volume = isMuted ? 0 : 1;
        } catch {
          // ignore
        }
      }
    }, [isMuted]);

    return h('div', {
      style: {
        width: '100%',
        height: '100%',
        position: 'relative',
        background: '#0F172A',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }
    },
      // 挂载 Ruffle Player 的视口
      h('div', {
        ref: containerRef,
        onClick: () => {
          if (playerRef.current) {
            try {
              playerRef.current.focus();
              const canvas = playerRef.current.shadowRoot && playerRef.current.shadowRoot.querySelector('canvas');
              if (canvas) canvas.focus();
            } catch {
              // ignore
            }
          }
        },
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }
      }),

      // 加载提示
      isLoading && h('div', {
        style: {
          position: 'absolute',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.92)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          zIndex: 10,
        }
      },
        h(IconRefreshCw, { size: 24, color: '#38BDF8' }),
        h('span', {
          style: {
            fontSize: '12px',
            fontWeight: 800,
            color: '#38BDF8',
            fontFamily: 'monospace',
            letterSpacing: '1px',
          }
        }, 'RUFFLE WASM BOOTING...'),
        h('span', { style: { fontSize: '11px', color: '#94A3B8' } }, `正在装载 ${gameTitle}`)
      ),

      // 错误提示
      errorMsg && h('div', {
        style: {
          position: 'absolute',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          textAlign: 'center',
          zIndex: 10,
        }
      },
        h(IconAlertCircle, { size: 28, color: '#EF4444' }),
        h('span', { style: { fontSize: '13px', fontWeight: 800, color: '#F87171', marginTop: '8px' } }, errorMsg),
        h('span', { style: { fontSize: '11px', color: '#94A3B8', marginTop: '6px' } }, '请确认该文件为有效的 .swf 文件，或检查网络以载入模拟器')
      )
    );
  }

  // ----------------------------------------------------------------------------
  // 7. 卡带收纳盒弹窗组件
  // ----------------------------------------------------------------------------
  function CartridgeLibraryModal({
    games,
    activeGameId,
    onSelectGame,
    onImportFile,
    onDeleteGame,
    onClose,
  }) {
    const fileInputRef = useRef(null);

    const handleFileChange = async (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        await onImportFile(files[0]);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    const formatSize = (bytes) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return h('div', {
      onClick: onClose,
      style: {
        position: 'absolute',
        inset: 0,
        zIndex: 120,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeInArcade 0.2s ease-out',
      }
    },
      h('div', {
        onClick: (e) => e.stopPropagation(),
        style: {
          width: '100%',
          maxWidth: '340px',
          maxHeight: '85%',
          background: '#E2E8F0',
          border: '3px solid #334155',
          borderRadius: '24px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }
      },
        // 顶部标题条
        h('div', {
          style: {
            background: 'linear-gradient(180deg, #475569 0%, #334155 100%)',
            borderBottom: '2.5px solid #1E293B',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }
        },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
            h('span', { style: { fontSize: '16px' } }, '📼'),
            h('span', {
              style: {
                fontSize: '15px',
                fontWeight: 900,
                color: '#F8FAFC',
                fontFamily: '"ZCOOL KuaiLe", sans-serif',
                letterSpacing: '0.5px',
              }
            }, '卡带收纳盒（SWF游戏库）')
          ),
          h('button', {
            onClick: onClose,
            style: {
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: '#FFFFFF',
              border: '2px solid #1E293B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }
          },
            h(IconX, { size: 14, color: '#1E293B', strokeWidth: 3 })
          )
        ),

        // 隐藏的真实文件选取器
        h('input', {
          ref: fileInputRef,
          type: 'file',
          accept: '.swf',
          style: { display: 'none' },
          onChange: handleFileChange,
        }),

        // 卡带列表区
        h('div', {
          style: {
            flex: 1,
            overflowY: 'auto',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }
        },
          // 上传新卡带按钮
          h('button', {
            onClick: () => fileInputRef.current && fileInputRef.current.click(),
            style: {
              width: '100%',
              padding: '12px',
              borderRadius: '16px',
              background: '#F1F5F9',
              border: '2px dashed #64748B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }
          },
            h(IconUpload, { size: 16, color: '#2563EB', strokeWidth: 2.5 }),
            h('span', {
              style: {
                fontSize: '13px',
                fontWeight: 900,
                color: '#1E293B',
                fontFamily: '"ZCOOL KuaiLe", sans-serif',
              }
            }, '+ 导入本地 .swf 游戏')
          ),

          h('div', {
            style: {
              fontSize: '11px',
              color: '#64748B',
              textAlign: 'center',
              lineHeight: 1.4,
              padding: '2px 4px 4px',
            }
          },
            '⚡ 内存即开即玩：SWF游戏仅在当前网页会话中加载运行，不占用永久磁盘空间，零存储负担。'
          ),

          // 游戏卡带列表
          games.length === 0
            ? h('div', {
                style: {
                  padding: '30px 10px',
                  textAlign: 'center',
                  color: '#64748B',
                  fontSize: '12px',
                }
              },
                h('div', { style: { fontSize: '28px', marginBottom: '8px' } }, '🕹️'),
                '卡带盒空空如也~',
                h('br', null),
                '快点击上方按钮导入电脑中的 .swf 经典游戏吧！'
              )
            : games.map((g) => {
                const isSelected = g.id === activeGameId;
                return h('div', {
                  key: g.id,
                  onClick: () => onSelectGame(g),
                  style: {
                    borderRadius: '14px',
                    background: '#FFFFFF',
                    border: isSelected ? '2.5px solid #2563EB' : '2px solid #CBD5E1',
                    boxShadow: isSelected
                      ? '0 4px 12px rgba(37,99,235,0.25), inset 0 0 0 2px #93C5FD'
                      : '0 2px 4px rgba(0,0,0,0.05)',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    position: 'relative',
                  }
                },
                  h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' } },
                    h('div', {
                      style: {
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: g.color || '#60A5FA',
                        border: '2px solid #334155',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        boxShadow: '0 2px 0 #334155',
                        flexShrink: 0,
                      }
                    }, g.coverEmoji || '🎮'),
                    h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' } },
                      h('span', {
                        style: {
                          fontSize: '13px',
                          fontWeight: 800,
                          color: '#1E293B',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }
                      }, g.title),
                      h('span', { style: { fontSize: '11px', color: '#64748B', marginTop: '2px' } }, `大小: ${formatSize(g.fileSize)}`)
                    )
                  ),
                  h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
                    h('button', {
                      onClick: (e) => {
                        e.stopPropagation();
                        onSelectGame(g);
                      },
                      title: '插入运行',
                      style: {
                        padding: '4px 10px',
                        borderRadius: '10px',
                        background: isSelected ? '#2563EB' : '#10B981',
                        border: '1.5px solid #1E293B',
                        color: '#FFFFFF',
                        fontSize: '11px',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        boxShadow: '0 1.5px 0 #1E293B',
                      }
                    },
                      h(IconPlay, { size: 10, fill: '#FFFFFF' }),
                      isSelected ? '运行中' : '运行'
                    ),
                    h('button', {
                      onClick: (e) => {
                        e.stopPropagation();
                        onDeleteGame(g.id);
                      },
                      title: '删除卡带',
                      style: {
                        width: '26px',
                        height: '26px',
                        borderRadius: '8px',
                        background: '#FEE2E2',
                        border: '1.5px solid #DC2626',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0,
                      }
                    },
                      h(IconTrash2, { size: 13, color: '#DC2626' })
                    )
                  )
                );
              })
        )
      )
    );
  }

  // ----------------------------------------------------------------------------
  // 8. 傩·掌机主界面（1:1 原版 Game Boy 拟物掌机复刻）
  // ----------------------------------------------------------------------------
  function ArcadeApp({ onBack }) {
    const [games, setGames] = useState([]);
    const [activeGame, setActiveGame] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showLibraryModal, setShowLibraryModal] = useState(false);
    const [pressedKey, setPressedKey] = useState(null);

    const containerRef = useRef(null);
    const screenRef = useRef(null);

    // 1. 初始化读取卡带库
    useEffect(() => {
      let isMounted = true;
      ensureArcadeStyles();
      loadAllSWFGames().then((list) => {
        if (!isMounted) return;
        setGames(list);
        if (list.length > 0) {
          setActiveGame(list[0]);
        }
      });
      return () => {
        isMounted = false;
      };
    }, []);

    // 2. 虚拟按键动作触发器
    const handleButtonDown = (action) => {
      setPressedKey(action);

      // 自动让 Ruffle Player 获取焦点
      const player = document.querySelector('ruffle-player');
      if (player) {
        try {
          player.focus();
          const canvas = player.shadowRoot && player.shadowRoot.querySelector('canvas');
          if (canvas) canvas.focus();
        } catch {
          // ignore
        }
      }

      switch (action) {
        case 'UP':
          dispatchRuffleKey('keydown', KEY_SPECS.ArrowUp);
          dispatchRuffleKey('keydown', KEY_SPECS.KeyW);
          break;
        case 'DOWN': // 黄金矿工：下方向键放钩子！
          dispatchRuffleKey('keydown', KEY_SPECS.ArrowDown);
          dispatchRuffleKey('keydown', KEY_SPECS.KeyS);
          break;
        case 'LEFT':
          dispatchRuffleKey('keydown', KEY_SPECS.ArrowLeft);
          dispatchRuffleKey('keydown', KEY_SPECS.KeyA);
          break;
        case 'RIGHT':
          dispatchRuffleKey('keydown', KEY_SPECS.ArrowRight);
          dispatchRuffleKey('keydown', KEY_SPECS.KeyD);
          break;
        case 'A': // 主动作键：同时合并发送 空格 + 下方向键 + Z + J
          dispatchRuffleKey('keydown', KEY_SPECS.Space);
          dispatchRuffleKey('keydown', KEY_SPECS.ArrowDown);
          dispatchRuffleKey('keydown', KEY_SPECS.KeyZ);
          dispatchRuffleKey('keydown', KEY_SPECS.KeyJ);
          break;
        case 'B': // 副动作键：发送 上方向键(炸药) + X + K + W
          dispatchRuffleKey('keydown', KEY_SPECS.ArrowUp);
          dispatchRuffleKey('keydown', KEY_SPECS.KeyX);
          dispatchRuffleKey('keydown', KEY_SPECS.KeyK);
          dispatchRuffleKey('keydown', KEY_SPECS.KeyW);
          break;
        case 'SPACE': // 独立空格键
          dispatchRuffleKey('keydown', KEY_SPECS.Space);
          dispatchRuffleKey('keydown', KEY_SPECS.ArrowDown);
          break;
        case 'START':
          dispatchRuffleKey('keydown', KEY_SPECS.Enter);
          dispatchRuffleKey('keydown', KEY_SPECS.Space);
          break;
        case 'SELECT':
          dispatchRuffleKey('keydown', KEY_SPECS.ShiftLeft);
          break;
      }
    };

    const handleButtonUp = (action) => {
      setPressedKey(null);

      switch (action) {
        case 'UP':
          dispatchRuffleKey('keyup', KEY_SPECS.ArrowUp);
          dispatchRuffleKey('keyup', KEY_SPECS.KeyW);
          break;
        case 'DOWN':
          dispatchRuffleKey('keyup', KEY_SPECS.ArrowDown);
          dispatchRuffleKey('keyup', KEY_SPECS.KeyS);
          break;
        case 'LEFT':
          dispatchRuffleKey('keyup', KEY_SPECS.ArrowLeft);
          dispatchRuffleKey('keyup', KEY_SPECS.KeyA);
          break;
        case 'RIGHT':
          dispatchRuffleKey('keyup', KEY_SPECS.ArrowRight);
          dispatchRuffleKey('keyup', KEY_SPECS.KeyD);
          break;
        case 'A':
          dispatchRuffleKey('keyup', KEY_SPECS.Space);
          dispatchRuffleKey('keyup', KEY_SPECS.ArrowDown);
          dispatchRuffleKey('keyup', KEY_SPECS.KeyZ);
          dispatchRuffleKey('keyup', KEY_SPECS.KeyJ);
          break;
        case 'B':
          dispatchRuffleKey('keyup', KEY_SPECS.ArrowUp);
          dispatchRuffleKey('keyup', KEY_SPECS.KeyX);
          dispatchRuffleKey('keyup', KEY_SPECS.KeyK);
          dispatchRuffleKey('keyup', KEY_SPECS.KeyW);
          break;
        case 'SPACE':
          dispatchRuffleKey('keyup', KEY_SPECS.Space);
          dispatchRuffleKey('keyup', KEY_SPECS.ArrowDown);
          break;
        case 'START':
          dispatchRuffleKey('keyup', KEY_SPECS.Enter);
          dispatchRuffleKey('keyup', KEY_SPECS.Space);
          break;
        case 'SELECT':
          dispatchRuffleKey('keyup', KEY_SPECS.ShiftLeft);
          break;
      }
    };

    // 3. 全局物理键盘事件监听与桥接（PC 实体键盘按键无缝直通 Flash 游戏）
    useEffect(() => {
      const handleGlobalKeyDown = (e) => {
        if (e.__fromArcadeBridge) return;

        // 阻止方向键与空格导致宿主网页滚动
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
          e.preventDefault();
        }

        const player = document.querySelector('ruffle-player');
        if (player && document.activeElement !== player) {
          try {
            player.focus();
            const canvas = player.shadowRoot && player.shadowRoot.querySelector('canvas');
            if (canvas) canvas.focus();
          } catch {
            // ignore
          }
        }

        const spec = KEY_SPECS[e.code] || {
          code: e.code,
          key: e.key,
          keyCode: e.keyCode || e.which || 0,
        };

        dispatchRuffleKey('keydown', spec);

        if (e.code === 'Space') {
          dispatchRuffleKey('keydown', KEY_SPECS.ArrowDown);
          dispatchRuffleKey('keydown', KEY_SPECS.KeyS);
        }
      };

      const handleGlobalKeyUp = (e) => {
        if (e.__fromArcadeBridge) return;

        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
          e.preventDefault();
        }

        const spec = KEY_SPECS[e.code] || {
          code: e.code,
          key: e.key,
          keyCode: e.keyCode || e.which || 0,
        };

        dispatchRuffleKey('keyup', spec);

        if (e.code === 'Space') {
          dispatchRuffleKey('keyup', KEY_SPECS.ArrowDown);
          dispatchRuffleKey('keyup', KEY_SPECS.KeyS);
        }
      };

      window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
      window.addEventListener('keyup', handleGlobalKeyUp, { capture: true });

      return () => {
        window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
        window.removeEventListener('keyup', handleGlobalKeyUp, { capture: true });
      };
    }, []);

    // 4. 选择卡带
    const handleSelectGame = (game) => {
      setActiveGame(game);
      updateGameLastPlayed(game.id);
      setShowLibraryModal(false);
    };

    // 5. 上传本地 SWF
    const handleImportFile = async (file) => {
      const newGame = await importSWFFile(file);
      setGames((prev) => [newGame, ...prev]);
      setActiveGame(newGame);
      setShowLibraryModal(false);
    };

    // 6. 删除卡带
    const handleDeleteGame = async (id) => {
      await deleteSWFGame(id);
      const remain = games.filter((g) => g.id !== id);
      setGames(remain);
      if (activeGame && activeGame.id === id) {
        setActiveGame(remain.length > 0 ? remain[0] : null);
      }
    };

    // 7. 全屏切换
    const toggleFullscreen = () => {
      const targetElem = screenRef.current || containerRef.current;
      if (!targetElem) return;
      if (!document.fullscreenElement) {
        targetElem.requestFullscreen().catch(() => {});
        setIsFullscreen(true);
      } else {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    };

    return h('div', {
      ref: containerRef,
      style: {
        width: '100%',
        height: '100%',
        background: '#CBD5E1', // 经典复古灰白 Game Boy 机身
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        userSelect: 'none',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }
    },
      // 1. 掌机顶端控制条
      h('div', {
        style: {
          height: '42px',
          background: '#94A3B8',
          borderBottom: '2.5px solid #475569',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 10px',
          flexShrink: 0,
          zIndex: 20,
        }
      },
        // 返回桌面键
        h('button', {
          onClick: (e) => {
            e.stopPropagation();
            onBack();
          },
          style: {
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #38BDF8 0%, #0284C7 100%)',
            border: '2px solid #1E293B',
            boxShadow: '0 2px 0 #1E293B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
          },
          title: '返回桌面'
        },
          h(IconArrowLeft, { size: 15, color: '#FFFFFF', strokeWidth: 3.5 })
        ),

        // 掌机顶部品牌标
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
          h('span', {
            style: {
              fontSize: '13px',
              fontWeight: 900,
              color: '#1E293B',
              fontFamily: '"ZCOOL KuaiLe", sans-serif',
              letterSpacing: '0.5px',
            }
          }, '🕹️ 傩·掌机 (NUO BOY)')
        ),

        // 右侧功能快捷键：音量、卡带库、全屏
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '5px' } },
          h('button', {
            onClick: () => setIsMuted(!isMuted),
            title: isMuted ? '开声音' : '静音',
            style: {
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: isMuted ? '#FEE2E2' : '#FFFFFF',
              border: '1.5px solid #1E293B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }
          },
            isMuted ? h(IconVolumeX, { size: 14, color: '#DC2626' }) : h(IconVolume2, { size: 14, color: '#1E293B' })
          ),

          h('button', {
            onClick: () => setShowLibraryModal(true),
            title: '卡带收纳盒',
            style: {
              height: '28px',
              padding: '0 8px',
              borderRadius: '8px',
              background: '#FDE047',
              border: '1.5px solid #1E293B',
              boxShadow: '0 1.5px 0 #1E293B',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 900,
              color: '#1E293B',
              fontFamily: '"ZCOOL KuaiLe", sans-serif',
            }
          },
            h(IconDisc, { size: 13, strokeWidth: 2.5 }),
            '卡带'
          ),

          h('button', {
            onClick: toggleFullscreen,
            title: '全屏切换',
            style: {
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: '#FFFFFF',
              border: '1.5px solid #1E293B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }
          },
            isFullscreen ? h(IconMinimize2, { size: 13 }) : h(IconMaximize2, { size: 13 })
          )
        )
      ),

      // 2. 掌机上部：复古微凹点阵屏幕视窗
      h('div', {
        style: {
          padding: '10px 14px 6px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flexShrink: 0,
        }
      },
        // 屏幕外边框（深灰色斜角面板，带 BATTERY 红色指示灯）
        h('div', {
          style: {
            width: '100%',
            height: '240px',
            background: '#334155',
            border: '3px solid #1E293B',
            borderRadius: '16px 16px 28px 16px',
            boxShadow: 'inset 2px 2px 6px rgba(0,0,0,0.5), 0 3px 0 #1E293B',
            display: 'flex',
            flexDirection: 'column',
            padding: '8px 10px',
            boxSizing: 'border-box',
            position: 'relative',
          }
        },
          // 屏幕顶部标头：立体声标识与电源指示灯
          h('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px',
              padding: '0 4px',
            }
          },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
              h('div', {
                style: {
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: activeGame ? '#22C55E' : '#EF4444',
                  boxShadow: activeGame
                    ? '0 0 6px #22C55E, 0 0 10px #4ADE80'
                    : '0 0 6px #EF4444',
                }
              }),
              h('span', {
                style: {
                  fontSize: '8.5px',
                  fontWeight: 900,
                  color: '#94A3B8',
                  letterSpacing: '0.8px',
                  fontFamily: 'monospace',
                }
              }, 'POWER')
            ),
            h('span', {
              style: {
                fontSize: '8px',
                fontWeight: 800,
                color: '#64748B',
                letterSpacing: '1px',
                fontFamily: 'monospace',
              }
            }, 'DOT MATRIX WITH STEREO SOUND')
          ),

          // 真实 Flash 渲染画面视口
          h('div', {
            ref: screenRef,
            style: {
              flex: 1,
              background: '#0F172A',
              border: '2px solid #000000',
              borderRadius: '8px',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: 'inset 0 0 12px rgba(0,0,0,0.8)',
            }
          },
            activeGame
              ? h(RufflePlayerView, {
                  gameData: activeGame.data,
                  gameTitle: activeGame.title,
                  isMuted: isMuted,
                })
              : h('div', {
                  onClick: () => setShowLibraryModal(true),
                  style: {
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background: 'radial-gradient(circle, #1E293B 0%, #0F172A 100%)',
                  }
                },
                  h('div', {
                    style: {
                      fontSize: '36px',
                      marginBottom: '8px',
                      animation: 'bounceArcade 1.5s infinite',
                    }
                  }, '📼'),
                  h('span', {
                    style: {
                      fontSize: '13px',
                      fontWeight: 900,
                      color: '#FDE047',
                      fontFamily: '"ZCOOL KuaiLe", sans-serif',
                      letterSpacing: '1px',
                    }
                  }, '点击插入 SWF 卡带'),
                  h('span', {
                    style: {
                      fontSize: '10px',
                      color: '#94A3B8',
                      marginTop: '4px',
                    }
                  }, '支持本地任意 .swf 文件免安装即插即玩')
                )
          )
        )
      ),

      // 3. 掌机中部：游戏标题滚动小条
      h('div', {
        style: {
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }
      },
        h('span', {
          style: {
            fontSize: '11px',
            fontWeight: 900,
            color: '#475569',
            fontFamily: '"ZCOOL KuaiLe", sans-serif',
          }
        }, activeGame ? `当前: ${activeGame.title}` : '未插入卡带'),
        h('span', {
          style: {
            fontSize: '10px',
            color: '#64748B',
            fontFamily: 'monospace',
          }
        }, 'PC: WASD / 方向键 / Z / X')
      ),

      // 4. 掌机下部：物理按键操作区（十字方向键 + A/B动作键）
      h('div', {
        style: {
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '4px 16px',
        }
      },
        // 左侧：实体手感十字方向键 (D-Pad)
        h('div', {
          style: {
            width: '110px',
            height: '110px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }
        },
          // 十字键底盘阴影槽
          h('div', {
            style: {
              position: 'absolute',
              width: '104px',
              height: '36px',
              background: '#94A3B8',
              borderRadius: '6px',
              boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.3)',
            }
          }),
          h('div', {
            style: {
              position: 'absolute',
              width: '36px',
              height: '104px',
              background: '#94A3B8',
              borderRadius: '6px',
              boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.3)',
            }
          }),

          // 上键
          h('button', {
            onPointerDown: () => handleButtonDown('UP'),
            onPointerUp: () => handleButtonUp('UP'),
            onPointerLeave: () => handleButtonUp('UP'),
            style: {
              position: 'absolute',
              top: '4px',
              width: '34px',
              height: '36px',
              background: pressedKey === 'UP' ? '#0F172A' : '#1E293B',
              border: '2px solid #0F172A',
              borderRadius: '6px 6px 0 0',
              boxShadow: pressedKey === 'UP' ? 'none' : '0 2px 0 #0F172A',
              color: '#94A3B8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              padding: 0,
            }
          }, '▲'),

          // 下键
          h('button', {
            onPointerDown: () => handleButtonDown('DOWN'),
            onPointerUp: () => handleButtonUp('DOWN'),
            onPointerLeave: () => handleButtonUp('DOWN'),
            style: {
              position: 'absolute',
              bottom: '4px',
              width: '34px',
              height: '36px',
              background: pressedKey === 'DOWN' ? '#0F172A' : '#1E293B',
              border: '2px solid #0F172A',
              borderRadius: '0 0 6px 6px',
              boxShadow: pressedKey === 'DOWN' ? 'none' : '0 2px 0 #0F172A',
              color: '#94A3B8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              padding: 0,
            }
          }, '▼'),

          // 左键
          h('button', {
            onPointerDown: () => handleButtonDown('LEFT'),
            onPointerUp: () => handleButtonUp('LEFT'),
            onPointerLeave: () => handleButtonUp('LEFT'),
            style: {
              position: 'absolute',
              left: '4px',
              width: '36px',
              height: '34px',
              background: pressedKey === 'LEFT' ? '#0F172A' : '#1E293B',
              border: '2px solid #0F172A',
              borderRadius: '6px 0 0 6px',
              boxShadow: pressedKey === 'LEFT' ? 'none' : '0 2px 0 #0F172A',
              color: '#94A3B8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              padding: 0,
            }
          }, '◀'),

          // 右键
          h('button', {
            onPointerDown: () => handleButtonDown('RIGHT'),
            onPointerUp: () => handleButtonUp('RIGHT'),
            onPointerLeave: () => handleButtonUp('RIGHT'),
            style: {
              position: 'absolute',
              right: '4px',
              width: '36px',
              height: '34px',
              background: pressedKey === 'RIGHT' ? '#0F172A' : '#1E293B',
              border: '2px solid #0F172A',
              borderRadius: '0 6px 6px 0',
              boxShadow: pressedKey === 'RIGHT' ? 'none' : '0 2px 0 #0F172A',
              color: '#94A3B8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              padding: 0,
            }
          }, '▶'),

          // 中心圆盘
          h('div', {
            style: {
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: '#1E293B',
              boxShadow: 'inset 1px 1px 3px rgba(0,0,0,0.6)',
              zIndex: 5,
              pointerEvents: 'none',
            }
          })
        ),

        // 中间：独立空格键 (长胶囊按键，适配黄金矿工等一键放钩)
        h('div', {
          style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            margin: '0 4px',
            zIndex: 10,
          }
        },
          h('button', {
            onPointerDown: () => handleButtonDown('SPACE'),
            onPointerUp: () => handleButtonUp('SPACE'),
            onPointerLeave: () => handleButtonUp('SPACE'),
            style: {
              width: '68px',
              height: '32px',
              borderRadius: '16px',
              background: pressedKey === 'SPACE' ? '#1E293B' : 'radial-gradient(circle at 35% 35%, #475569 0%, #1E293B 100%)',
              border: '2px solid #0F172A',
              boxShadow: pressedKey === 'SPACE' ? 'none' : '0 3px 0 #0F172A, 0 4px 8px rgba(0,0,0,0.25)',
              color: '#FDE047',
              fontSize: '11px',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: pressedKey === 'SPACE' ? 'translateY(2px)' : 'none',
              fontFamily: '"ZCOOL KuaiLe", sans-serif',
              letterSpacing: '0.5px',
            }
          }, '␣ 空格'),
          h('span', {
            style: {
              fontSize: '8px',
              fontWeight: 800,
              color: '#64748B',
              marginTop: '4px',
              fontFamily: 'monospace',
            }
          }, '放钩/确认')
        ),

        // 右侧：经典斜置 A / B 圆形动作按键
        h('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            transform: 'rotate(-20deg)',
          }
        },
          // B 键
          h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
            h('button', {
              onPointerDown: () => handleButtonDown('B'),
              onPointerUp: () => handleButtonUp('B'),
              onPointerLeave: () => handleButtonUp('B'),
              style: {
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: pressedKey === 'B'
                  ? '#991B1B'
                  : 'radial-gradient(circle at 35% 35%, #F43F5E 0%, #BE123C 100%)',
                border: '2.5px solid #4C0519',
                boxShadow: pressedKey === 'B' ? 'none' : '0 4px 0 #4C0519, 0 6px 12px rgba(0,0,0,0.25)',
                color: '#FFFFFF',
                fontSize: '15px',
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: pressedKey === 'B' ? 'translateY(3px)' : 'none',
              }
            }, 'B'),
            h('span', {
              style: {
                fontSize: '8.5px',
                fontWeight: 900,
                color: '#475569',
                marginTop: '4px',
                transform: 'rotate(20deg)',
                fontFamily: 'monospace',
              }
            }, '(炸药/X)')
          ),

          // A 键
          h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '-12px' } },
            h('button', {
              onPointerDown: () => handleButtonDown('A'),
              onPointerUp: () => handleButtonUp('A'),
              onPointerLeave: () => handleButtonUp('A'),
              style: {
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: pressedKey === 'A'
                  ? '#991B1B'
                  : 'radial-gradient(circle at 35% 35%, #F43F5E 0%, #BE123C 100%)',
                border: '2.5px solid #4C0519',
                boxShadow: pressedKey === 'A' ? 'none' : '0 4px 0 #4C0519, 0 6px 12px rgba(0,0,0,0.25)',
                color: '#FFFFFF',
                fontSize: '15px',
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: pressedKey === 'A' ? 'translateY(3px)' : 'none',
              }
            }, 'A'),
            h('span', {
              style: {
                fontSize: '8.5px',
                fontWeight: 900,
                color: '#475569',
                marginTop: '4px',
                transform: 'rotate(20deg)',
                fontFamily: 'monospace',
              }
            }, '(放钩/Z)')
          )
        )
      ),

      // 5. 掌机最底端：斜置 SELECT & START 橡胶条键 + 扬声器小孔
      h('div', {
        style: {
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          flexShrink: 0,
        }
      },
        // SELECT / START 按键
        h('div', { style: { display: 'flex', gap: '16px' } },
          h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
            h('button', {
              onPointerDown: () => handleButtonDown('SELECT'),
              onPointerUp: () => handleButtonUp('SELECT'),
              onPointerLeave: () => handleButtonUp('SELECT'),
              style: {
                width: '32px',
                height: '10px',
                borderRadius: '5px',
                background: pressedKey === 'SELECT' ? '#0F172A' : '#334155',
                border: '1.5px solid #0F172A',
                boxShadow: pressedKey === 'SELECT' ? 'none' : '0 1.5px 0 #0F172A',
                cursor: 'pointer',
                transform: 'rotate(-25deg)',
              }
            }),
            h('span', {
              style: {
                fontSize: '7.5px',
                fontWeight: 900,
                color: '#64748B',
                marginTop: '6px',
                fontFamily: 'monospace',
              }
            }, 'SELECT')
          ),

          h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
            h('button', {
              onPointerDown: () => handleButtonDown('START'),
              onPointerUp: () => handleButtonUp('START'),
              onPointerLeave: () => handleButtonUp('START'),
              style: {
                width: '32px',
                height: '10px',
                borderRadius: '5px',
                background: pressedKey === 'START' ? '#0F172A' : '#334155',
                border: '1.5px solid #0F172A',
                boxShadow: pressedKey === 'START' ? 'none' : '0 1.5px 0 #0F172A',
                cursor: 'pointer',
                transform: 'rotate(-25deg)',
              }
            }),
            h('span', {
              style: {
                fontSize: '7.5px',
                fontWeight: 900,
                color: '#64748B',
                marginTop: '6px',
                fontFamily: 'monospace',
              }
            }, 'START')
          )
        ),

        // 右下角拟物扬声器微孔
        h('div', { style: { display: 'flex', gap: '3px', transform: 'rotate(-25deg)' } },
          [1, 2, 3, 4, 5].map((idx) =>
            h('div', {
              key: idx,
              style: {
                width: '3px',
                height: '18px',
                borderRadius: '2px',
                background: '#64748B',
                boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.5)',
              }
            })
          )
        )
      ),

      // 卡带库管理弹窗
      showLibraryModal && h(CartridgeLibraryModal, {
        games: games,
        activeGameId: activeGame ? activeGame.id : null,
        onSelectGame: handleSelectGame,
        onImportFile: handleImportFile,
        onDeleteGame: handleDeleteGame,
        onClose: () => setShowLibraryModal(false),
      })
    );
  }

  // ----------------------------------------------------------------------------
  // 9. 顶层 Modal 宿主容器（集成到手机系统）
  // ----------------------------------------------------------------------------
  function NuoArcadeAppModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    return h('div', {
      className: 'settings-overlay open',
      style: {
        zIndex: 10000,
        background: '#CBD5E1',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
      }
    },
      h(ArcadeApp, { onBack: onClose })
    );
  }

  window.NuoArcadeAppModal = NuoArcadeAppModal;

})(typeof window !== 'undefined' ? window : this);
