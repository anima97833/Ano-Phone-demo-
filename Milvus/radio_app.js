// ==============================================================================
// 代号鸢小手机 ·「傩·电台」复古木质收音机 (Nuo Radio & Tuner Engine)
// 风格：浅米色复古木壳收音机 + 象牙旋钮 + 调频刻度盘 (±0.6MHz自动吸附)
// 架构：传讯名士动态读取 + 全局常驻播放器 (退出后台继续播) + hls.js 自适应流媒体
//       + 名士正在收听/一键同听 + AI心境点台 + 四时段节目单 + 收藏听后感
//       + 用户自带电台 (mp3/m3u8) + Radio Browser 全球搜索 + 睡眠定时 + 电台罗盘
// ==============================================================================

(function (window) {
  const React = window.React;
  if (!React) return;
  const { useState, useEffect, useRef } = React;
  const h = React.createElement;

  // ----------------------------------------------------------------------------
  // 通用名士头像组件 (对齐情侣空间：优先直链，其次从 IndexedDB avatarStore 获取，失败以名士首字兜底)
  // ----------------------------------------------------------------------------
  const NuoAvatar = ({ avatar, name = '名', color = '#D6724B', size = 16, style = {} }) => {
    const [imgUrl, setImgUrl] = useState(null);
    const [isFailed, setIsFailed] = useState(false);

    useEffect(() => {
      let isMounted = true;
      setIsFailed(false);
      if (!avatar) {
        setImgUrl(null);
        return;
      }
      if (typeof avatar === 'string' && (
        avatar.startsWith('data:image') ||
        avatar.startsWith('http://') ||
        avatar.startsWith('https://') ||
        avatar.startsWith('blob:') ||
        avatar.startsWith('/') ||
        avatar.startsWith('./')
      )) {
        setImgUrl(avatar);
        return;
      }
      const fetchAvatar = async () => {
        try {
          if (typeof window.resolveAvatarUrl === 'function') {
            const res = await window.resolveAvatarUrl(avatar, '');
            if (isMounted && res) {
              setImgUrl(res);
              return;
            }
          }
          const store = window.avatarStore || (typeof avatarStore !== 'undefined' ? avatarStore : null);
          if (store && typeof store.get === 'function') {
            const item = await store.get(avatar);
            if (isMounted && item && item.avatarData) {
              setImgUrl(item.avatarData);
              return;
            }
          }
        } catch (e) {
          console.warn('[NuoRadio] 头像读取失败:', e);
        }
        if (isMounted) setIsFailed(true);
      };
      fetchAvatar();
      return () => { isMounted = false; };
    }, [avatar]);

    const baseStyle = {
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      flexShrink: 0,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      ...style
    };

    if (imgUrl && !isFailed) {
      return h('img', {
        src: imgUrl,
        alt: name,
        onError: () => setIsFailed(true),
        style: {
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          objectFit: 'cover',
          display: 'block'
        }
      });
    }

    return h(
      'div',
      {
        style: {
          ...baseStyle,
          background: color || '#D6724B',
          color: '#fff',
          fontSize: `${Math.max(8, Math.round(size * 0.55))}px`,
          fontWeight: 'bold',
          lineHeight: 1
        }
      },
      (name || '名')[0]
    );
  };

  // ----------------------------------------------------------------------------
  // 1. 常量与预设高可靠电台池
  // ----------------------------------------------------------------------------
  const DB_NAME = 't8_radio';
  const TITLES_KEY = 't8_radio_titles';
  const MIN_FREQ = 87.5;
  const MAX_FREQ = 108.0;

  const PRESET_STATIONS = [
    {
      id: 'cnr_voice_china',
      name: 'CNR-1 中国之声 · 国家广播',
      frequency: 'FM 106.1',
      freqMhz: 106.1,
      category: 'cnr',
      categoryLabel: '国家广播',
      streamUrl: 'https://lhttp.qtfm.cn/live/15318317/64k.mp3',
      backupStreamUrl: 'http://ngcdn001.cnr.cn/live/zgzs/index.m3u8',
      description: '中央人民广播电台旗舰频率，全天候权威综合新闻资讯与声音画卷。',
      coverUrl: 'http://pic.qtfm.cn/2017/0413/20170413034613.jpeg',
      bitrate: '128 kbps',
      genreTags: ['权威', '新闻', '国风']
    },
    {
      id: 'big_b_cpop',
      name: 'Big B Radio · 华语流行 C-POP',
      frequency: 'FM 97.4',
      freqMhz: 97.4,
      category: 'cpop',
      categoryLabel: '华语流行',
      streamUrl: 'https://antares.dribbcast.com/proxy/cpop?mp=/s',
      backupStreamUrl: 'https://cn.bigbigmix.com/audio/stream',
      description: '24小时不间断华语流行热歌、经典港台金曲与两岸独立创作精选。',
      coverUrl: 'https://antares.dribbcast.com/cpop.jpg',
      bitrate: '128 kbps AAC',
      genreTags: ['华语', '流行', '金曲']
    },
    {
      id: 'big_big_mix',
      name: 'BIG BIG MIX · 乐享精选歌单',
      frequency: 'FM 101.7',
      freqMhz: 101.7,
      category: 'cpop',
      categoryLabel: '乐享流行',
      streamUrl: 'https://cn.bigbigmix.com/audio/stream',
      backupStreamUrl: 'https://antares.dribbcast.com/proxy/cpop?mp=/s',
      description: '精选城市白领与青年听众热歌单，旋律轻快温暖，全天陪伴。',
      coverUrl: 'https://cn.bigbigmix.com/favicon.ico',
      bitrate: '128 kbps MP3',
      genreTags: ['都市', '流行', '轻快']
    },
    {
      id: 'cnr_economic',
      name: 'CNR-2 经济之声 · 财富生活',
      frequency: 'FM 96.6',
      freqMhz: 96.6,
      category: 'cnr',
      categoryLabel: '经济资讯',
      streamUrl: 'https://lhttp.qtfm.cn/live/15318318/64k.mp3',
      backupStreamUrl: 'http://ngcdn002.cnr.cn/live/jjzs/index.m3u8',
      description: '聆听财富声音，品味财经智慧与品质生活慢调。',
      coverUrl: 'http://pic.qtfm.cn/2017/0413/20170413034613.jpeg',
      bitrate: '128 kbps',
      genreTags: ['理财', '资讯', '算账']
    },
    {
      id: 'plaza_one',
      name: 'Nightwave Plaza · 蒸汽波漫游',
      frequency: 'FM 93.3',
      freqMhz: 93.3,
      category: 'lofi',
      categoryLabel: '蒸汽波',
      streamUrl: 'https://radio.plaza.one/mp3',
      backupStreamUrl: 'https://plaza.one/mp3',
      description: '全天候经典 CityPop 与 Vaporwave 怀旧电波，仿佛漫步在雨夜街道。',
      coverUrl: 'https://plaza.one/apple-touch-icon.png',
      bitrate: '128 kbps MP3',
      genreTags: ['蒸汽波', '复古', 'CityPop']
    },
    {
      id: 'groove_salad',
      name: 'Groove Salad · 慢摇治愈',
      frequency: 'FM 91.5',
      freqMhz: 91.5,
      category: 'chill',
      categoryLabel: '慢摇治愈',
      streamUrl: 'https://ice1.somafm.com/groovesalad-128-mp3',
      backupStreamUrl: 'https://ice2.somafm.com/groovesalad-128-mp3',
      description: '二十年经典极品 Downtempo 与 Chillout 氛围慢摇，抚平深夜浮躁。',
      coverUrl: 'https://api.somafm.com/logos/256/groovesalad256.png',
      bitrate: '128 kbps MP3',
      genreTags: ['慢摇', '环境音', '治愈']
    },
    {
      id: 'lush_vocal',
      name: 'Lush · 空灵女声',
      frequency: 'FM 94.2',
      freqMhz: 94.2,
      category: 'chill',
      categoryLabel: '空灵人声',
      streamUrl: 'https://ice1.somafm.com/lush-128-mp3',
      backupStreamUrl: 'https://ice2.somafm.com/lush-128-mp3',
      description: '空灵唯美的 Dream-pop 与独立女声，如同置身薄雾轻风的晨曦。',
      coverUrl: 'https://api.somafm.com/logos/256/lush256.png',
      bitrate: '128 kbps MP3',
      genreTags: ['空灵', '人声', '轻灵']
    },
    {
      id: 'deep_space',
      name: 'Deep Space One · 深空冥想',
      frequency: 'FM 88.3',
      freqMhz: 88.3,
      category: 'chill',
      categoryLabel: '深空助眠',
      streamUrl: 'https://ice1.somafm.com/deepspaceone-128-mp3',
      backupStreamUrl: 'https://ice2.somafm.com/deepspaceone-128-mp3',
      description: '纯粹环境声学与太空电子音，助眠、冥想与深度专注的灵魂伴侣。',
      coverUrl: 'https://api.somafm.com/logos/256/deepspaceone256.png',
      bitrate: '128 kbps MP3',
      genreTags: ['冥想', '助眠', '出尘']
    },
    {
      id: 'secret_agent',
      name: 'Secret Agent · 特工爵士',
      frequency: 'FM 98.7',
      freqMhz: 98.7,
      category: 'jazz',
      categoryLabel: '特工爵士',
      streamUrl: 'https://ice1.somafm.com/secretagent-128-mp3',
      backupStreamUrl: 'https://ice2.somafm.com/secretagent-128-mp3',
      description: '致敬黄金谍战调频，优雅灵动的复古冲浪爵士，暗涌如棋局。',
      coverUrl: 'https://api.somafm.com/logos/256/secretagent256.png',
      bitrate: '128 kbps MP3',
      genreTags: ['爵士', '博弈', '优雅']
    },
    {
      id: 'boot_liquor',
      name: 'Boot Liquor · 温暖公路民谣',
      frequency: 'FM 89.6',
      freqMhz: 89.6,
      category: 'lofi',
      categoryLabel: '温暖民谣',
      streamUrl: 'https://ice1.somafm.com/bootliquor-128-mp3',
      backupStreamUrl: 'https://ice2.somafm.com/bootliquor-128-mp3',
      description: '悠扬温暖的木吉他与公路民谣，穿透黄昏与旷野的思绪。',
      coverUrl: 'https://api.somafm.com/logos/256/bootliquor256.png',
      bitrate: '128 kbps MP3',
      genreTags: ['民谣', '吉他', '旷野']
    }
  ];

  const DEFAULT_RADIO_TITLES = {
    '傅融': '财经早盘蹲守员',
    '刘辩': '深夜点歌黏人精',
    '袁基': '暗夜棋局解语人',
    '孙策': '旷野公路狂飙客',
    '左慈': '万籁深空悟道仙'
  };

  const DEFAULT_LEAD_CHARACTERS = [
    { id: 'liubian', name: '刘辩', mbti: 'ENFP', constellation: '双鱼座', speakingStyle: '第一人称“朕”，任性撒娇、天真黏人、强烈占有欲', personality: '少帝苍凉而天真，极度依赖楼主', background: '汉少帝，被困深宫，对广陵王全然依赖。' },
    { id: 'furong', name: '傅融', mbti: 'ISTJ', constellation: '摩羯座', speakingStyle: '精打细算、爱算账、口嫌体正直、句句不离买房与铜钱', personality: '记账成癖，房产执念，嘴硬心软', background: '精明的账房先生，把一文钱掰成两半花。' },
    { id: 'yuanji', name: '袁基', mbti: 'INFJ', constellation: '天秤座', speakingStyle: '第一人称“基”，温润克制、言辞优雅如棋局博弈', personality: '世家风范，深谋远虑，暗藏执念', background: '汝南袁氏长公子，围棋国手。' },
    { id: 'sunce', name: '孙策', mbti: 'ESTP', constellation: '狮子座', speakingStyle: '豪爽直率，称呼楼主“广陵王”，爱说“本霸王”，烈火骄阳', personality: '江东小霸王，热血狂傲，大开大合', background: '江东之虎，勇冠三军。' },
    { id: 'zuoci', name: '左慈', mbti: 'INTJ', constellation: '天蝎座', speakingStyle: '清冷超然、道骨仙风、言简意赅、充满哲思玄理', personality: '隐鸢阁阁主，出尘绝世，看淡沧海桑田', background: '道门至尊，守护天下秘宝。' }
  ];

  // ----------------------------------------------------------------------------
  // 2. Radio Browser 在线电台检索 API (全球开源免Key)
  // ----------------------------------------------------------------------------
  async function fetchRadioBrowserChina(limit = 20) {
    const servers = ['de1', 'nl1', 'at1'];
    for (const s of servers) {
      try {
        const url = `https://${s}.api.radio-browser.info/json/stations/bycountry/China?order=votes&reverse=true&limit=${limit}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'YuanPhoneRadio/1.0' } });
        if (!res.ok) continue;
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.filter(item => item && item.url_resolved && item.name).map((item, idx) => {
            const freq = +(88.0 + (idx % 19) * 1.0).toFixed(1);
            return {
              id: `rb_${item.stationuuid || idx}`,
              name: String(item.name).trim(),
              frequency: `FM ${freq}`,
              freqMhz: freq,
              category: 'online',
              categoryLabel: item.tags ? item.tags.split(',')[0] : '在线广播',
              streamUrl: item.url_resolved,
              description: item.state ? `地区：${item.state} · 格式：${item.codec || 'MP3'}` : `在线电台 · ${item.codec || 'MP3'}`,
              coverUrl: item.favicon || '',
              bitrate: item.bitrate ? `${item.bitrate} kbps` : '',
              genreTags: ['在线广播', item.state || '国内']
            };
          });
        }
      } catch (e) {}
    }
    return [];
  }

  async function searchRadioBrowser(keyword, limit = 15) {
    if (!keyword || !keyword.trim()) return [];
    const servers = ['de1', 'nl1', 'at1'];
    for (const s of servers) {
      try {
        const url = `https://${s}.api.radio-browser.info/json/stations/byname/${encodeURIComponent(keyword.trim())}?limit=${limit}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'YuanPhoneRadio/1.0' } });
        if (!res.ok) continue;
        const data = await res.json();
        if (Array.isArray(data)) {
          return data.filter(item => item && item.url_resolved && item.name).map((item, idx) => {
            const freq = +(88.5 + (idx % 19) * 1.0).toFixed(1);
            return {
              id: `rb_search_${item.stationuuid || idx}`,
              name: String(item.name).trim(),
              frequency: `FM ${freq}`,
              freqMhz: freq,
              category: 'online',
              categoryLabel: item.country || '搜索电台',
              streamUrl: item.url_resolved,
              description: `${item.country || '全球'} · ${item.codec || 'MP3'} ${item.bitrate ? item.bitrate + 'k' : ''}`,
              coverUrl: item.favicon || '',
              bitrate: item.bitrate ? `${item.bitrate} kbps` : '',
              genreTags: ['网络搜索', item.country || '全球']
            };
          });
        }
      } catch (e) {}
    }
    return [];
  }

  // ----------------------------------------------------------------------------
  // 3. IndexedDB 持久化存储 (t8_radio)
  // ----------------------------------------------------------------------------
  function openRadioDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        ['picks', 'listening_now', 'schedules', 'favorites', 'character_reviews', 'custom_stations'].forEach(store => {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: 'id' });
          }
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getFromStore(storeName) {
    try {
      const db = await openRadioDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn(`[NuoRadio] 读取 ${storeName} 失败:`, e);
      return [];
    }
  }

  async function putToStore(storeName, items) {
    const db = await openRadioDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const s = tx.objectStore(storeName);
      (Array.isArray(items) ? items : [items]).forEach(it => s.put(it));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function deleteFromStore(storeName, id) {
    const db = await openRadioDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ----------------------------------------------------------------------------
  // 4. 全局收音机单例播放器 (Global Player with HLS & Fallback)
  // ----------------------------------------------------------------------------
  class RadioGlobalPlayer {
    constructor() {
      this.audio = null;
      this.hls = null;
      this.listeners = new Set();
      this.timerId = null;

      this.state = {
        currentStation: PRESET_STATIONS[0],
        isPlaying: false,
        isLoading: false,
        volume: 0.8,
        isMuted: false,
        errorMsg: null,
        coopCharName: null,
        sleepTimerRemainingSec: 0
      };

      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const lastVol = parseFloat(localStorage.getItem('t8_radio_volume') || '0.8');
        this.state.volume = isNaN(lastVol) ? 0.8 : lastVol;
        this.initAudio();
      }
    }

    initAudio() {
      if (typeof window === 'undefined') return;
      const audio = new Audio();
      audio.preload = 'none';
      audio.volume = this.state.volume;
      try { audio.referrerPolicy = 'no-referrer'; } catch (e) {}

      audio.addEventListener('waiting', () => this.updateState({ isLoading: true }));
      audio.addEventListener('canplay', () => this.updateState({ isLoading: false }));
      audio.addEventListener('playing', () => this.updateState({ isLoading: false, isPlaying: true, errorMsg: null }));
      audio.addEventListener('pause', () => this.updateState({ isPlaying: false }));
      audio.addEventListener('error', () => {
        if (this.state.isPlaying || this.state.isLoading) {
          this.handleStreamFail();
        }
      });

      this.audio = audio;
    }

    subscribe(listener) {
      this.listeners.add(listener);
      listener(this.state);
      return () => this.listeners.delete(listener);
    }

    getState() {
      return this.state;
    }

    updateState(partial) {
      this.state = { ...this.state, ...partial };
      this.listeners.forEach(fn => fn(this.state));
    }

    playStation(station, coopCharName = null) {
      this.updateState({
        currentStation: station,
        coopCharName: coopCharName !== undefined ? coopCharName : this.state.coopCharName,
        errorMsg: null
      });
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('t8_radio_last_station', station.id);
      }
      this.playStream(station.streamUrl, station.backupStreamUrl);
    }

    togglePlay() {
      if (this.state.isPlaying) {
        this.pause();
      } else {
        this.playStream(this.state.currentStation.streamUrl, this.state.currentStation.backupStreamUrl);
      }
    }

    pause() {
      if (this.audio) this.audio.pause();
      this.updateState({ isPlaying: false });
    }

    handleStreamFail() {
      const backup = this.state.currentStation?.backupStreamUrl;
      if (backup && this.audio && this.audio.src !== backup) {
        console.warn('[NuoRadio] 主流连接中断，自动切换备用流:', backup);
        this.playStream(backup, null);
      } else {
        this.updateState({
          isLoading: false,
          isPlaying: false,
          errorMsg: '电台电波微弱或网络受阻，请轻拨换台'
        });
      }
    }

    playStream(url, backupUrl) {
      if (!this.audio) this.initAudio();
      const audio = this.audio;
      if (!audio) return;

      if (this.hls) {
        this.hls.destroy();
        this.hls = null;
      }

      this.updateState({ isLoading: true, errorMsg: null });

      const onFail = () => {
        if (backupUrl && audio.src !== backupUrl) {
          this.playStream(backupUrl, null);
        } else {
          this.handleStreamFail();
        }
      };

      if (url.includes('.m3u8')) {
        if (audio.canPlayType('application/vnd.apple.mpegurl')) {
          audio.src = url;
          audio.load();
          audio.play().catch(onFail);
        } else if (window.Hls && window.Hls.isSupported()) {
          const hls = new window.Hls({ enableWorker: true, lowLatencyMode: true });
          hls.loadSource(url);
          hls.attachMedia(audio);
          hls.on(window.Hls.Events.MANIFEST_PARSED, () => audio.play().catch(onFail));
          hls.on(window.Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
              hls.destroy();
              this.hls = null;
              onFail();
            }
          });
          this.hls = hls;
        } else {
          audio.src = url;
          audio.load();
          audio.play().catch(onFail);
        }
      } else {
        audio.src = url;
        audio.load();
        audio.play().catch(onFail);
      }
    }

    nextStation(list = PRESET_STATIONS) {
      const idx = list.findIndex(s => s.id === this.state.currentStation.id);
      const next = (idx + 1) % list.length;
      this.playStation(list[next], null);
    }

    prevStation(list = PRESET_STATIONS) {
      const idx = list.findIndex(s => s.id === this.state.currentStation.id);
      const prev = (idx - 1 + list.length) % list.length;
      this.playStation(list[prev], null);
    }

    setVolume(val) {
      const cl = Math.max(0, Math.min(1, val));
      this.updateState({ volume: cl, isMuted: cl === 0 });
      if (this.audio) this.audio.volume = this.state.isMuted ? 0 : cl;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('t8_radio_volume', String(cl));
      }
    }

    toggleMute() {
      const next = !this.state.isMuted;
      this.updateState({ isMuted: next });
      if (this.audio) this.audio.volume = next ? 0 : this.state.volume;
    }

    setSleepTimer(minutes) {
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
      if (!minutes || minutes <= 0) {
        this.updateState({ sleepTimerRemainingSec: 0 });
        return;
      }
      let remaining = minutes * 60;
      this.updateState({ sleepTimerRemainingSec: remaining });

      this.timerId = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(this.timerId);
          this.timerId = null;
          this.pause();
          this.updateState({ sleepTimerRemainingSec: 0 });
        } else {
          // 临近最后15秒淡出音量
          if (remaining <= 15 && this.audio && !this.state.isMuted) {
            this.audio.volume = Math.max(0, this.state.volume * (remaining / 15));
          }
          this.updateState({ sleepTimerRemainingSec: remaining });
        }
      }, 1000);
    }
  }

  const radioGlobalPlayer = new RadioGlobalPlayer();
  window.radioGlobalPlayer = radioGlobalPlayer;

  // ----------------------------------------------------------------------------
  // 5. 频率吸附算法 (±0.6 MHz 自动捕捉)
  // ----------------------------------------------------------------------------
  function findStationByFrequency(freqMhz, stationList = PRESET_STATIONS) {
    let closest = null;
    let minDiff = 0.6;
    for (const st of stationList) {
      const diff = Math.abs(st.freqMhz - freqMhz);
      if (diff < minDiff) {
        minDiff = diff;
        closest = st;
      }
    }
    return closest;
  }

  // ----------------------------------------------------------------------------
  // 6. JSON 容错与 AI 通信底层 (复用经严苛验证的 repairJSON / extractObjects)
  // ----------------------------------------------------------------------------
  function fixStringInternals(s) {
    let out = '';
    let inStr = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (!inStr) {
        if (ch === '"') inStr = true;
        out += ch;
        continue;
      }
      if (ch === '\\') { out += ch + (s[i + 1] || ''); i++; continue; }
      if (ch === '\n' || ch === '\r') { out += ch === '\n' ? '\\n' : ''; continue; }
      if (ch === '"') {
        let k = i + 1;
        while (k < s.length && /\s/.test(s[k])) k++;
        const nx = s[k];
        if (nx === undefined || nx === ',' || nx === '}' || nx === ']' || nx === ':') { inStr = false; out += ch; }
        else out += '\\"';
        continue;
      }
      out += ch;
    }
    return out;
  }

  function repairJSON(str) {
    let s = fixStringInternals(String(str || '').replace(/```(?:json)?/gi, ''));
    let out = '';
    let inStr = false;
    let quote = '';
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (inStr) {
        out += ch;
        if (ch === '\\') { out += s[i + 1] || ''; i++; }
        else if (ch === quote) inStr = false;
        continue;
      }
      if (ch === '"' || ch === "'") { inStr = true; quote = ch; out += ch; continue; }
      if (ch === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; out += '\n'; continue; }
      if (ch === '/' && s[i + 1] === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i++; continue; }
      out += ch;
    }
    return out
      .replace(/([{,]\s*)'([^'\n]*?)'\s*:/g, '$1"$2":')
      .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
      .replace(/:\s*'([^'\n]*?)'(\s*[,}\]])/g, ': "$1"$2')
      .replace(/,\s*([\]}])/g, '$1');
  }

  function tryParse(chunk) {
    try { return JSON.parse(chunk); } catch (e) {}
    return JSON.parse(repairJSON(chunk));
  }

  function extractObjects(text, keyHint) {
    const found = [];
    const s = String(text || '');
    let i = 0;
    while (i < s.length) {
      if (s[i] !== '{') { i++; continue; }
      let depth = 0, inStr = false, quote = '', j = i, end = -1, inner = 0;
      for (; j < s.length; j++) {
        const ch = s[j];
        if (inStr) {
          if (ch === '\\') j++;
          else if (ch === quote) {
            let k = j + 1;
            while (k < s.length && /\s/.test(s[k])) k++;
            const nx = s[k];
            if (quote !== '"' || nx === undefined || nx === ',' || nx === '}' || nx === ']' || nx === ':') inStr = false;
          }
          continue;
        }
        if (ch === '"' || ch === "'") { inStr = true; quote = ch; continue; }
        if (ch === '{') { depth++; inner++; }
        else if (ch === '}') { depth--; if (depth === 0) { end = j; break; } }
      }
      if (end < 0) break;
      const chunk = s.slice(i, end + 1);
      if (keyHint.test(chunk) && inner === 1) {
        try { found.push(tryParse(chunk)); } catch (e) { console.warn('[NuoRadio] 跳过条目:', e.message); }
        i = end + 1;
      } else {
        i = i + 1;
      }
    }
    return found;
  }

  function callLLM(messages) {
    return new Promise((resolve, reject) => {
      if (!window.sendToLLM) { reject(new Error('未检测到大模型接口 (window.sendToLLM)')); return; }
      window.sendToLLM(messages, {}, text => resolve(text), err => reject(err));
    });
  }

  async function getContextInfo() {
    let userPersona = { name: '楼主', role: '广陵王/绣衣楼主', personality: '聪颖灵动、胸怀天下', background: '统领绣衣楼，密探天下要务' };
    try {
      const saved = JSON.parse(localStorage.getItem('user_personas') || '[]');
      const activeId = localStorage.getItem('active_persona_id');
      if (Array.isArray(saved) && saved.length) {
        const found = activeId ? saved.find(p => String(p.id) === String(activeId)) : saved[0];
        if (found && found.name) {
          userPersona = { name: String(found.name).trim(), role: found.role || found.name, personality: found.personality || '真诚机敏', background: found.background || '' };
        }
      }
    } catch (e) {}

    let worldContext = '';
    try {
      if (window.getWorldBookContext) worldContext = await window.getWorldBookContext();
      else if (window.worldBookStore) {
        const d = await window.worldBookStore.getData();
        worldContext = typeof d === 'string' ? d : JSON.stringify(d);
      }
    } catch (e) {}

    return { userPersona, worldContext: worldContext || '' };
  }

  // ----------------------------------------------------------------------------
  // 7. AI 业务引擎：名士在听、心境点台、节目单、听后感
  // ----------------------------------------------------------------------------

  // 7.1 生成名士此刻在听 (Listening Now)
  async function generateListeningNowByAI(characters, stationPool) {
    const { userPersona, worldContext } = await getContextInfo();
    const stationDesc = stationPool.map(s => `- ID: "${s.id}", 名字: "${s.name}", 风格: "${s.categoryLabel}", 标签: [${(s.genreTags || []).join(', ')}]`).join('\n');

    const prompt = [
      {
        role: 'system',
        content: `你正在沉浸式扮演《代号鸢》中的多位名士。你正在复古木质收音机「傩·电台」中，向广陵王（${userPersona.name}）展示此刻你们分别正在收听哪个电台频道，并留下一句带有专属口癖与心境的短心声。

【可选电台池（必须严格从中选择 stationId，不可编造ID）】：
${stationDesc}

【对方（广陵王）身份】：${userPersona.name}（${userPersona.role}，${userPersona.personality}）
【世界书背景】：${worldContext ? worldContext.slice(0, 400) : '汉末乱世风云，共守广陵。'}

请为以下每位名士各选一个最符合其人设偏好的电台，并写下一句第一人称内心碎语或对楼主说的悄悄话（30-60字）：
${characters.map(c => `- ${c.name}（${c.mbti}，${c.speakingStyle}）`).join('\n')}

必须直接返回合法 JSON 数组（严禁任何Markdown说明或多余废话），格式如下：
[
  {
    "charName": "刘辩",
    "stationId": "big_b_cpop",
    "thought": "（第一人称心声与口癖）"
  }
]`
      },
      { role: 'user', content: '请为所有名士生成此刻正在收听的电台及心声，以JSON数组返回。' }
    ];

    const text = await callLLM(prompt);
    const parsed = extractObjects(text, /["']?stationId["']?\s*:/);
    const now = Date.now();
    return parsed.map((item, idx) => {
      const st = stationPool.find(s => s.id === item.stationId) || stationPool[idx % stationPool.length];
      return {
        id: item.charName,
        charName: item.charName,
        stationId: st.id,
        stationName: st.name,
        thought: item.thought || '静听风起，此心与君同。',
        updatedAt: now
      };
    });
  }

  // 7.2 名士心境点台 (AI Recommendations)
  async function generateRadioPicksByAI(char, stationPool, existingIds = []) {
    const { userPersona, worldContext } = await getContextInfo();
    const stationDesc = stationPool.map(s => `- ID: "${s.id}", 名字: "${s.name}", 分类: "${s.categoryLabel}", 标签: [${(s.genreTags || []).join(', ')}], 介绍: "${s.description}"`).join('\n');

    const prompt = [
      {
        role: 'system',
        content: `你正在沉浸式扮演《代号鸢》中的名士【${char.name}】。
你正在复古木质收音机「傩·电台」中，为广陵王（${userPersona.name}）挑选并安利适合与你一同收听的电台频道。

【你的人设全息档案】：
- 姓名：${char.name} (MBTI: ${char.mbti}, 星座: ${char.constellation})
- 语言风格与口癖：${char.speakingStyle}
- 性格特点：${char.personality}
- 生平背景：${char.background}

【广陵王身份设定】：${userPersona.name} (${userPersona.role}, ${userPersona.personality})
【世界书背景】：${worldContext ? worldContext.slice(0, 500) : '汉末三国风云，绣衣楼密探天下。'}

【可选真实电台池（严格从中挑选 stationId，必须真实存在）】：
${stationDesc}

【任务要求】：
请挑选至少 3 个你最想安利给楼主的电台（尽量避开已推荐的ID: ${existingIds.join(', ') || '无'}）：
给出：
1. stationId: 真实匹配池中的ID
2. reason: 你的第一人称专属推荐语与点台理由（60-120字，强烈体现你的口癖、第一人称自称、情感羁绊或傲娇吐槽）
3. mood: 心境氛围（如：微醺心动、雨夜抚慰、筹谋对弈、快意驰骋、空灵绝尘）
4. bestTime: 最适收听时段（如：晨曦、午后茶歇、华灯初上、深夜三更）
5. tags: 2-3个简短标签

必须直接返回且只返回合法 JSON 数组（严禁任何Markdown说明），格式如下：
[
  {
    "stationId": "secret_agent",
    "reason": "（第一人称推荐理由）",
    "mood": "暗夜博弈",
    "bestTime": "华灯初上",
    "tags": ["爵士", "谋算"]
  }
]`
      },
      { role: 'user', content: `请为广陵王挑选至少 3 个你最喜爱的电台，以 JSON 数组返回。` }
    ];

    const text = await callLLM(prompt);
    const parsed = extractObjects(text, /["']?stationId["']?\s*:/);
    const now = Date.now();
    return parsed.map((item, idx) => {
      const st = stationPool.find(s => s.id === item.stationId) || stationPool[idx % stationPool.length];
      return {
        id: `pick_${char.id}_${st.id}_${now}_${idx}`,
        charId: char.id,
        charName: char.name,
        charAvatar: char.avatar || '',
        stationId: st.id,
        stationName: st.name,
        stationFreq: st.frequency,
        reason: item.reason || '闲来信手一拨，偶得此音，甚合我意，楼主不妨同听。',
        mood: item.mood || '清雅从容',
        bestTime: item.bestTime || '静夜',
        tags: Array.isArray(item.tags) ? item.tags : ['心境电台'],
        createdAt: now - idx * 1000
      };
    });
  }

  // 7.3 名士四时段节目单 (Schedule)
  async function generateScheduleByAI(char, stationPool) {
    const { userPersona } = await getContextInfo();
    const stationDesc = stationPool.map(s => `"${s.id}"(${s.name})`).join(', ');

    const prompt = [
      {
        role: 'system',
        content: `你正在沉浸式扮演《代号鸢》名士【${char.name}】（MBTI: ${char.mbti}，语言风格：${char.speakingStyle}）。
请为你在「傩·电台」中的全天收听日程排定一档专属节目单：分为【晨起/清晨】、【午后/茶歇】、【暮夜/华灯】、【宵禁/深夜】四个时段。
每个时段必须从以下电台池中挑选一个 stationId：[${stationDesc}]，并给出一句生动的在听心境与吐槽。

必须直接返回 JSON 对象（不要任何Markdown）：
{
  "morning": { "stationId": "...", "comment": "..." },
  "afternoon": { "stationId": "...", "comment": "..." },
  "evening": { "stationId": "...", "comment": "..." },
  "midnight": { "stationId": "...", "comment": "..." }
}`
      },
      { role: 'user', content: `请为【${char.name}】排定全天四时段电台日程。` }
    ];

    const text = await callLLM(prompt);
    const fixed = repairJSON(text);
    const parsed = tryParse(fixed);
    return {
      id: char.name,
      charName: char.name,
      schedule: parsed,
      updatedAt: Date.now()
    };
  }

  // 7.4 名士听后感 (Review on a Favorite or Custom Station)
  async function generateStationReviewByAI(char, station) {
    const { userPersona } = await getContextInfo();
    const prompt = [
      {
        role: 'system',
        content: `你正在沉浸式扮演《代号鸢》名士【${char.name}】（MBTI: ${char.mbti}，口癖自称：${char.speakingStyle}）。
广陵王（${userPersona.name}）在复古收音机「傩·电台」里收藏了一个电台频道：
- 电台名称：${station.name}
- 频率或格式：${station.frequency || station.streamUrl}
- 简介与标签：${station.description || '自定义网络电台'}

请以你的第一人称与口癖，写一段你陪广陵王听了这个电台后的【真实听后感/傲娇吐槽/温存点评】（60-120字）。
必须直接输出文字，严禁任何前缀说明。`
      },
      { role: 'user', content: '请写下你的听后感。' }
    ];

    const text = await callLLM(prompt);
    return text.replace(/^["']|["']$/g, '').trim();
  }

  // ----------------------------------------------------------------------------
  // 8. 拟物子组件：调频刻度盘、象牙旋钮、喇叭动感光谱
  // ----------------------------------------------------------------------------

  // 8.1 浅米色复古调频刻度盘 (Frequency Dial with ±0.6MHz Snapping)
  const FrequencyDial = ({ currentFreq, onFreqChange, isLocked }) => {
    const dialRef = useRef(null);
    const percentage = Math.min(100, Math.max(0, ((currentFreq - MIN_FREQ) / (MAX_FREQ - MIN_FREQ)) * 100));

    const handleClick = (e) => {
      if (!dialRef.current) return;
      const rect = dialRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.min(1, Math.max(0, clickX / rect.width));
      const newFreq = +(MIN_FREQ + ratio * (MAX_FREQ - MIN_FREQ)).toFixed(1);
      onFreqChange(newFreq);
    };

    const majorTicks = [88, 92, 96, 100, 104, 108];

    return h('div', {
      ref: dialRef,
      onClick: handleClick,
      title: '点击刻度盘任意位置可平滑调频',
      style: {
        position: 'relative', width: '100%', padding: '12px 14px 14px', borderRadius: '16px',
        background: 'linear-gradient(180deg, #FBF4E8 0%, #EDE1CE 100%)',
        boxShadow: 'inset 0 2px 6px rgba(120,90,50,0.25), 0 2px 6px rgba(255,255,255,0.8)',
        border: '1.5px solid #D6B88A', boxSizing: 'border-box', overflow: 'hidden', cursor: 'pointer', userSelect: 'none'
      }
    },
      // 刻度盘玻璃微光反射
      h('div', {
        style: {
          position: 'absolute', top: 0, left: 0, right: 0, height: '45%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, transparent 100%)', pointerEvents: 'none'
        }
      }),
      // 顶部刻度标头与信号锁定 LED
      h('div', {
        style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', position: 'relative', zIndex: 2 }
      },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h('span', { style: { fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.1em', color: '#7C5832', fontFamily: 'monospace' } }, 'FM TUNING BAND'),
          h('span', { style: { fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(140,114,85,0.12)', color: '#8C5E28', fontFamily: 'monospace' } }, '87.5 - 108.0 MHz')
        ),
        // 信号锁定指示灯
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '5px' } },
          h('div', {
            style: {
              width: '8px', height: '8px', borderRadius: '50%',
              background: isLocked ? '#4F8A5B' : '#C7B9A5',
              boxShadow: isLocked ? '0 0 8px #4F8A5B' : 'none',
              transition: 'all 0.2s ease'
            }
          }),
          h('span', { style: { fontSize: '9.5px', fontWeight: 'bold', color: isLocked ? '#4F8A5B' : '#A3927D' } }, isLocked ? 'SIGNAL LOCKED' : 'SEARCHING')
        )
      ),
      // 刻度标尺骨架
      h('div', { style: { position: 'relative', height: '36px', width: '100%' } },
        // 大刻度数值标签
        h('div', { style: { display: 'flex', justifyContent: 'space-between', position: 'absolute', top: 0, left: 0, right: 0 } },
          majorTicks.map(t => h('span', { key: t, style: { fontSize: '10px', fontWeight: 'bold', color: '#8C5E28', fontFamily: 'monospace' } }, t))
        ),
        // 密集成行刻度线
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', position: 'absolute', bottom: '2px', left: 0, right: 0, height: '18px' } },
          Array.from({ length: 41 }).map((_, i) => {
            const isMajor = i % 8 === 0;
            const isMid = i % 4 === 0;
            return h('div', {
              key: i,
              style: {
                width: isMajor ? '2px' : '1px',
                height: isMajor ? '16px' : isMid ? '10px' : '6px',
                background: isMajor ? '#8C5E28' : '#C2AA86',
                borderRadius: '1px'
              }
            });
          })
        ),
        // 红色朱砂调谐指针
        h('div', {
          style: {
            position: 'absolute', left: `${percentage}%`, top: '-4px', bottom: '-4px', width: '2px',
            background: 'linear-gradient(180deg, #E65100 0%, #D6724B 100%)',
            boxShadow: '0 0 6px rgba(214,114,75,0.7)', transform: 'translateX(-50%)',
            transition: 'left 0.1s ease-out', zIndex: 5
          }
        },
          // 指针顶端菱形刻度指示
          h('div', {
            style: {
              position: 'absolute', top: '-2px', left: '50%', transform: 'translateX(-50%) rotate(45deg)',
              width: '6px', height: '6px', background: '#D6724B'
            }
          })
        )
      )
    );
  };

  // 8.2 象牙复古大旋钮 (Ivory Tuning Knob)
  const TuningKnob = ({ angle, onRotateStep, label = 'TUNING' }) => {
    return h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', userSelect: 'none' } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        // 逆时针微调
        h('button', {
          type: 'button', onClick: () => onRotateStep(-1), title: '向低频调谐',
          style: { width: '30px', height: '30px', borderRadius: '50%', border: '1px solid #D6B88A', background: '#FFFDF9', color: '#8C5E28', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }
        }, '‹'),
        // 象牙主体旋钮
        h('div', {
          onClick: () => onRotateStep(1), title: '旋转调频换台',
          style: {
            width: '68px', height: '68px', borderRadius: '50%',
            background: 'linear-gradient(145deg, #FFFDF9 0%, #EFE5D2 100%)',
            boxShadow: '0 6px 14px rgba(140,114,85,0.22), inset 0 2px 3px rgba(255,255,255,0.9), inset 0 -2px 4px rgba(120,90,50,0.15)',
            border: '1.5px solid #D6B88A', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }
        },
          // 旋钮内同心凹槽圈
          h('div', {
            style: {
              width: '52px', height: '52px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #F5EDE0 0%, #E6D7BD 100%)',
              boxShadow: 'inset 0 2px 5px rgba(120,90,50,0.2), 0 1px 2px rgba(255,255,255,0.8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: `rotate(${angle}deg)`, transition: 'transform 0.15s ease'
            }
          },
            // 指示凹点
            h('div', {
              style: {
                position: 'absolute', top: '7px', width: '5px', height: '5px', borderRadius: '50%',
                background: '#D6724B', boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
              }
            }),
            // 中心黄铜轴心
            h('div', {
              style: {
                width: '18px', height: '18px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #E0C086 0%, #B89248 100%)',
                boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.6), 0 1px 3px rgba(100,70,30,0.3)'
              }
            })
          )
        ),
        // 顺时针微调
        h('button', {
          type: 'button', onClick: () => onRotateStep(1), title: '向高频调谐',
          style: { width: '30px', height: '30px', borderRadius: '50%', border: '1px solid #D6B88A', background: '#FFFDF9', color: '#8C5E28', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }
        }, '›')
      ),
      h('span', { style: { fontSize: '9px', fontWeight: 'bold', color: '#8C7255', letterSpacing: '0.08em', fontFamily: 'monospace' } }, label)
    );
  };

  // 8.3 喇叭跳动动态光谱格栅 (Speaker Grill & Spectrum)
  const SpeakerGrill = ({ isPlaying }) => {
    const [bars, setBars] = useState(() => Array.from({ length: 18 }, () => 18));

    useEffect(() => {
      if (!isPlaying) {
        setBars(Array.from({ length: 18 }, () => 12));
        return;
      }
      const t = setInterval(() => {
        setBars(Array.from({ length: 18 }, () => Math.floor(Math.random() * 65) + 15));
      }, 100);
      return () => clearInterval(t);
    }, [isPlaying]);

    return h('div', {
      style: {
        width: '100%', padding: '10px 12px', borderRadius: '14px',
        background: 'linear-gradient(180deg, #FAF4E8 0%, #EDE1CE 100%)',
        border: '1px solid rgba(214,168,110,0.4)',
        boxShadow: 'inset 0 2px 4px rgba(120,90,50,0.12)', boxSizing: 'border-box'
      }
    },
      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', height: '32px' } },
        bars.map((hgt, i) => h('div', {
          key: i,
          style: {
            flex: 1, maxWidth: '6px', height: `${isPlaying ? hgt : 8}%`, minHeight: '3px', borderRadius: '2px',
            background: isPlaying ? 'linear-gradient(180deg, #D6724B 0%, #B85832 70%, #8C5E28 100%)' : '#D1C2A5',
            boxShadow: isPlaying ? '0 0 4px rgba(214,114,75,0.4)' : 'none',
            transition: 'height 0.1s ease'
          }
        }))
      )
    );
  };

  // ----------------------------------------------------------------------------
  // 9. 主模态窗口：傩·电台 (NuoRadioAppModal)
  // ----------------------------------------------------------------------------
  function NuoRadioAppModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    const [playerState, setPlayerState] = useState(() => radioGlobalPlayer.getState());
    const { currentStation, isPlaying, isLoading, volume, isMuted, errorMsg, coopCharName, sleepTimerRemainingSec } = playerState;

    const [currentFreq, setCurrentFreq] = useState(currentStation.freqMhz);
    const [knobAngle, setKnobAngle] = useState(45);
    const [activeTab, setActiveTab] = useState('radio'); // 'radio' | 'characters' | 'schedule' | 'favorites' | 'compass'

    const [characters, setCharacters] = useState(DEFAULT_LEAD_CHARACTERS);
    const [selectedChar, setSelectedChar] = useState(DEFAULT_LEAD_CHARACTERS[0].name);

    // 数据列表
    const [listeningNowList, setListeningNowList] = useState([]);
    const [radioPicks, setRadioPicks] = useState([]);
    const [favorites, setFavorites] = useState([]);
    const [customStations, setCustomStations] = useState([]);
    const [scheduleMap, setScheduleMap] = useState({});
    const [characterReviews, setCharacterReviews] = useState({});
    const [chinaStations, setChinaStations] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    // 交互状态
    const [isGenerating, setIsGenerating] = useState(false);
    const [showAddCustom, setShowAddCustom] = useState(false);
    const [toastMsg, setToastMsg] = useState(null);

    // 自带电台表单
    const [newCustomName, setNewCustomName] = useState('');
    const [newCustomUrl, setNewCustomUrl] = useState('');
    const [newCustomDesc, setNewCustomDesc] = useState('');

    const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 2500); };

    // 合并全部可选电台池 (预设 + 自带)
    const allStationPool = [...PRESET_STATIONS, ...customStations];

    // 初始化与监听
    useEffect(() => {
      let isMounted = true;

      // 订阅全局播放器状态
      const unsub = radioGlobalPlayer.subscribe(st => {
        if (isMounted) {
          setPlayerState(st);
          setCurrentFreq(st.currentStation.freqMhz);
        }
      });

      // 加载通讯录与数据库
      const initData = async () => {
        try {
          if (window.loadAllCinemaCharacters) {
            const list = await window.loadAllCinemaCharacters();
            if (isMounted && list && list.length > 0) {
              setCharacters(list);
              setSelectedChar(list[0].name);
            }
          }
        } catch (e) {}

        const [picks, nows, favs, customs, scheds, revs] = await Promise.all([
          getFromStore('picks'),
          getFromStore('listening_now'),
          getFromStore('favorites'),
          getFromStore('custom_stations'),
          getFromStore('schedules'),
          getFromStore('character_reviews')
        ]);

        if (isMounted) {
          setRadioPicks(picks);
          setListeningNowList(nows);
          setFavorites(favs);
          setCustomStations(customs);
          const sMap = {}; scheds.forEach(s => { sMap[s.id] = s; });
          setScheduleMap(sMap);
          const rMap = {}; revs.forEach(r => { rMap[r.id] = r; });
          setCharacterReviews(rMap);
        }
      };

      initData();
      return () => { isMounted = false; unsub(); };
    }, []);

    // 播放指定电台
    const handleSelectStation = (st, charName = null) => {
      radioGlobalPlayer.playStation(st, charName);
      if (charName) showToast(`📻 与「${charName}」同听：${st.name}`);
    };

    // 调频旋钮步进
    const handleRotateStep = (delta) => {
      setKnobAngle(prev => (prev + delta * 30) % 360);
      if (delta > 0) radioGlobalPlayer.nextStation(allStationPool);
      else radioGlobalPlayer.prevStation(allStationPool);
    };

    // 刻度盘点击调频
    const handleFreqChange = (freq) => {
      setCurrentFreq(freq);
      const matched = findStationByFrequency(freq, allStationPool);
      if (matched && matched.id !== currentStation.id) {
        handleSelectStation(matched, null);
      }
    };

    // 收藏/取消收藏
    const handleToggleFavorite = async (st) => {
      const exists = favorites.some(f => f.id === st.id);
      if (exists) {
        await deleteFromStore('favorites', st.id);
        setFavorites(prev => prev.filter(f => f.id !== st.id));
        showToast('已移出收藏台');
      } else {
        const item = { id: st.id, station: st, createdAt: Date.now() };
        await putToStore('favorites', item);
        setFavorites(prev => [item, ...prev]);
        showToast('已收藏电台');
      }
    };

    // 生成名士此刻在听
    const handleGenerateListeningNow = async () => {
      if (isGenerating) return;
      setIsGenerating(true);
      showToast('📻 正在探查名士们此刻锁定的电台频率...');
      try {
        const list = await generateListeningNowByAI(characters, allStationPool);
        await putToStore('listening_now', list);
        setListeningNowList(list);
        showToast('🎉 名士实时收听状态已同步！');
      } catch (e) {
        showToast('同步失败: ' + (e.message || '网络超时'));
      } finally {
        setIsGenerating(false);
      }
    };

    // 生成名士心境点台
    const handleGeneratePicks = async () => {
      if (isGenerating) return;
      const char = characters.find(c => c.name === selectedChar) || characters[0];
      setIsGenerating(true);
      showToast(`✨「${char.name}」正在旋动电台旋钮，为你精选心境频道...`);
      try {
        const existingIds = radioPicks.filter(p => p.charName === char.name).map(p => p.stationId);
        const newPicks = await generateRadioPicksByAI(char, allStationPool, existingIds);
        // 追加并去重
        const seen = new Set(existingIds);
        const fresh = newPicks.filter(p => {
          if (seen.has(p.stationId)) return false;
          seen.add(p.stationId);
          return true;
        });
        if (fresh.length === 0) {
          showToast(`「${char.name}」已推荐过这些电台，可稍后再点`);
          return;
        }
        await putToStore('picks', fresh);
        setRadioPicks(prev => [...fresh, ...prev]);
        showToast(`🎉「${char.name}」为你推荐了 ${fresh.length} 个专属电台！`);
      } catch (e) {
        showToast('推荐失败: ' + (e.message || '网络超时'));
      } finally {
        setIsGenerating(false);
      }
    };

    // 生成名士四时段节目单
    const handleGenerateSchedule = async () => {
      if (isGenerating) return;
      const char = characters.find(c => c.name === selectedChar) || characters[0];
      setIsGenerating(true);
      showToast(`📜 正在为「${char.name}」编排全天收听日程...`);
      try {
        const sched = await generateScheduleByAI(char, allStationPool);
        await putToStore('schedules', sched);
        setScheduleMap(prev => ({ ...prev, [char.name]: sched }));
        showToast(`🎉「${char.name}」的四时段节目单已排定！`);
      } catch (e) {
        showToast('日程生成失败: ' + (e.message || '网络超时'));
      } finally {
        setIsGenerating(false);
      }
    };

    // 请求名士对某个电台写听后感
    const handleAskReview = async (st, char) => {
      const reviewKey = `${char.name}_${st.id}`;
      showToast(`✨ 正在询问「${char.name}」对此台的听后感...`);
      try {
        const reviewText = await generateStationReviewByAI(char, st);
        const item = { id: reviewKey, charName: char.name, stationId: st.id, stationName: st.name, review: reviewText, createdAt: Date.now() };
        await putToStore('character_reviews', item);
        setCharacterReviews(prev => ({ ...prev, [reviewKey]: item }));
        showToast(`💬「${char.name}」留下了独家点评！`);
      } catch (e) {
        showToast('点评生成失败: ' + (e.message || '网络超时'));
      }
    };

    // 保存用户自带电台
    const handleSaveCustomStation = async (e) => {
      e.preventDefault();
      if (!newCustomName.trim() || !newCustomUrl.trim()) {
        showToast('请填写电台名称与直链地址');
        return;
      }
      const freq = +(89.0 + (customStations.length % 18) * 1.0).toFixed(1);
      const customItem = {
        id: `custom_${Date.now()}`,
        name: newCustomName.trim(),
        frequency: `FM ${freq}`,
        freqMhz: freq,
        category: 'custom',
        categoryLabel: '自建私台',
        streamUrl: newCustomUrl.trim(),
        backupStreamUrl: '',
        description: newCustomDesc.trim() || '用户自定义音频流',
        genreTags: ['自建', '私享']
      };
      await putToStore('custom_stations', customItem);
      setCustomStations(prev => [customItem, ...prev]);
      setShowAddCustom(false);
      setNewCustomName(''); setNewCustomUrl(''); setNewCustomDesc('');
      showToast('自建电台已保存！');
    };

    // 删除用户自带电台
    const handleDeleteCustomStation = async (id) => {
      if (!window.confirm('确定要删除此自建电台吗？')) return;
      await deleteFromStore('custom_stations', id);
      setCustomStations(prev => prev.filter(s => s.id !== id));
      showToast('已删除自建电台');
    };

    // 在线搜索 Radio Browser
    const handleSearchOnline = async () => {
      if (!searchKeyword.trim() || isSearching) return;
      setIsSearching(true);
      showToast('🔍 正在联通全球电台库...');
      try {
        const res = await searchRadioBrowser(searchKeyword.trim(), 15);
        setSearchResults(res);
        if (res.length === 0) showToast('未搜索到相关电台');
      } catch (e) {
        showToast('搜索失败');
      } finally {
        setIsSearching(false);
      }
    };

    // 格式化倒计时
    const formatTimer = (sec) => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // 罗盘数据汇总计算 (只统计名士)
    const computeCompassStats = () => {
      const charStats = characters.map(c => {
        const picks = radioPicks.filter(p => p.charName === c.name);
        const sched = scheduleMap[c.name];
        // 估算收听总时长 (每次推荐约计 15 小时，日程计 20 小时)
        const hours = picks.length * 12 + (sched ? 28 : 0);
        // 偏好风格统计
        const tagMap = {};
        picks.forEach(p => {
          (p.tags || []).forEach(t => { tagMap[t] = (tagMap[t] || 0) + 1; });
        });
        const topTag = Object.keys(tagMap).sort((a, b) => tagMap[b] - tagMap[a])[0] || '随性慢调';
        const title = DEFAULT_RADIO_TITLES[c.name] || '漫游调频常客';
        return { char: c, hours, topTag, title, picksCount: picks.length };
      });

      // 最佳耳机搭子：与用户收藏电台类别重合度最高的名士
      let bestMatch = charStats[0];
      if (favorites.length > 0) {
        const favCats = favorites.map(f => f.station.category);
        bestMatch = charStats.reduce((best, curr) => {
          const cPicks = radioPicks.filter(p => p.charName === curr.char.name);
          const matchCount = cPicks.filter(p => {
            const st = allStationPool.find(s => s.id === p.stationId);
            return st && favCats.includes(st.category);
          }).length;
          return matchCount > (best.matchCount || 0) ? { ...curr, matchCount } : best;
        }, { ...charStats[0], matchCount: 0 });
      }

      return { charStats, bestMatch };
    };

    const compassData = computeCompassStats();
    const isLocked = Boolean(findStationByFrequency(currentFreq, allStationPool));

    return h('div', {
      className: 'settings-overlay open',
      style: {
        zIndex: 10000,
        background: 'linear-gradient(180deg, #FBF8F2 0%, #F5EFE6 50%, #EFE8DD 100%)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: 'none'
      }
    },
      // 顶部导航栏
      h('div', {
        style: {
          height: '48px', padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, borderBottom: '1px solid rgba(214, 168, 110, 0.35)',
          background: 'linear-gradient(135deg, #FAF7F2 0%, #F3EDE2 100%)', zIndex: 10
        }
      },
        h('div', {
          onClick: onClose,
          style: { cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: '#8C5E28', fontSize: '13.5px', fontWeight: 'bold' }
        },
          h('span', { style: { fontSize: '18px' } }, '‹'), '桌面'
        ),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
          h('span', { style: { fontSize: '16px' } }, '📻'),
          h('span', { style: { fontSize: '15.5px', fontWeight: 'bold', color: '#4A3C31', letterSpacing: '1px' } }, '傩 · 电台')
        ),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
          // 睡眠定时器按钮
          h('button', {
            onClick: () => {
              const next = sleepTimerRemainingSec > 0 ? 0 : 30;
              radioGlobalPlayer.setSleepTimer(next);
              showToast(next > 0 ? `⏰ 设定 ${next} 分钟后静止关机` : '已取消定时关闭');
            },
            title: '睡眠定时关机',
            style: {
              background: sleepTimerRemainingSec > 0 ? '#FFE9DC' : 'rgba(255,255,255,0.7)',
              border: sleepTimerRemainingSec > 0 ? '1px solid #D6724B' : '1px solid rgba(214,168,110,0.4)',
              color: sleepTimerRemainingSec > 0 ? '#D6724B' : '#8C5E28',
              borderRadius: '12px', padding: '3px 8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer'
            }
          }, sleepTimerRemainingSec > 0 ? `⏳ ${formatTimer(sleepTimerRemainingSec)}` : '⏰ 定时')
        )
      ),

      // 拟物复古收音机机身主体卡片 (浅米色木质外壳 + 调频刻度盘 + 铭牌 + 大旋钮)
      h('div', {
        style: {
          margin: '10px 14px 6px', padding: '14px', borderRadius: '20px',
          background: 'linear-gradient(160deg, #F7EFE1 0%, #EDE1CE 100%)',
          border: '2px solid #D6B88A',
          boxShadow: '0 8px 20px rgba(140,114,85,0.18), inset 0 2px 3px rgba(255,255,255,0.8)',
          display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0
        }
      },
        // 1. 调频长条刻度盘
        h(FrequencyDial, { currentFreq, onFreqChange: handleFreqChange, isLocked }),

        // 2. 液晶状态铭牌 (浅米色高保真纸面铭牌)
        h('div', {
          style: {
            padding: '8px 12px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #FFFDF8 0%, #F5ECDD 100%)',
            border: '1px solid rgba(214,168,110,0.5)',
            boxShadow: 'inset 0 1px 3px rgba(140,114,85,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px'
          }
        },
          h('div', { style: { display: 'flex', flexDirection: 'column', minWidth: 0 } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
              h('span', { style: { fontSize: '11px', fontWeight: 'bold', color: '#D6724B', fontFamily: 'monospace' } }, currentStation.frequency),
              h('span', { style: { fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: '#FFF1E8', color: '#B85832', border: '1px solid #E5C3B3' } }, currentStation.categoryLabel),
              coopCharName && h('span', { style: { fontSize: '9px', fontWeight: 'bold', color: '#B85832', background: '#FFE9DC', border: '1px dashed #D6724B', borderRadius: '8px', padding: '0 5px' } }, `💖 与${coopCharName}同听中`)
            ),
            h('span', { style: { fontSize: '13.5px', fontWeight: 'bold', color: '#3E3226', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, currentStation.name)
          ),
          // 收藏心愿小按钮
          h('button', {
            type: 'button', onClick: () => handleToggleFavorite(currentStation),
            style: { border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer', color: favorites.some(f => f.id === currentStation.id) ? '#D6724B' : '#C7B9A5' }
          }, favorites.some(f => f.id === currentStation.id) ? '♥' : '♡')
        ),

        // 3. 动态跳动脉冲光谱
        h(SpeakerGrill, { isPlaying }),

        // 4. 底部主控制台：上一台、大播停键、下一台、调谐大旋钮、音量
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' } },
          // 播控三键
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            h('button', {
              type: 'button', onClick: () => radioGlobalPlayer.prevStation(allStationPool), title: '上一台',
              style: { width: '34px', height: '34px', borderRadius: '50%', border: '1px solid #D6B88A', background: '#FFFDF9', color: '#8C5E28', fontSize: '14px', cursor: 'pointer' }
            }, '⏮'),
            h('button', {
              type: 'button', onClick: () => radioGlobalPlayer.togglePlay(),
              style: {
                width: '46px', height: '46px', borderRadius: '50%', border: 'none',
                background: 'linear-gradient(135deg, #D6724B 0%, #B85832 100%)',
                color: '#fff', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(214,114,75,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }
            }, isLoading ? '⏳' : isPlaying ? '⏸' : '▶'),
            h('button', {
              type: 'button', onClick: () => radioGlobalPlayer.nextStation(allStationPool), title: '下一台',
              style: { width: '34px', height: '34px', borderRadius: '50%', border: '1px solid #D6B88A', background: '#FFFDF9', color: '#8C5E28', fontSize: '14px', cursor: 'pointer' }
            }, '⏭')
          ),

          // 音量滑块
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '4px', flex: 1, maxWidth: '100px' } },
            h('button', {
              type: 'button', onClick: () => radioGlobalPlayer.toggleMute(),
              style: { border: 'none', background: 'none', fontSize: '13px', cursor: 'pointer', color: '#8C5E28' }
            }, isMuted ? '🔇' : '🔊'),
            h('input', {
              type: 'range', min: '0', max: '1', step: '0.05', value: isMuted ? 0 : volume,
              onChange: (e) => radioGlobalPlayer.setVolume(parseFloat(e.target.value)),
              style: { width: '100%', accentColor: '#D6724B', cursor: 'pointer' }
            })
          ),

          // 象牙调谐旋钮
          h(TuningKnob, { angle: knobAngle, onRotateStep: handleRotateStep, label: 'TUNER' })
        ),

        // 错误提示条
        errorMsg && h('div', { style: { fontSize: '11px', color: '#C0472B', textAlign: 'center', background: '#FCEBE8', borderRadius: '8px', padding: '4px' } }, errorMsg)
      ),

      // 导航分页 Tab 切换栏
      h('div', {
        style: {
          padding: '4px 14px', display: 'flex', gap: '6px', flexShrink: 0,
          borderBottom: '1px solid rgba(214,168,110,0.25)', background: 'rgba(247,241,230,0.7)'
        }
      },
        [
          ['radio', '📻 预设电台'],
          ['characters', '🎧 名士在听'],
          ['schedule', '📜 四时日程'],
          ['favorites', '⭐ 收藏/自带'],
          ['compass', '🧭 电台罗盘']
        ].map(([key, label]) => {
          const sel = activeTab === key;
          return h('button', {
            key, onClick: () => setActiveTab(key),
            style: {
              flex: 1, padding: '6px 0', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
              border: sel ? '1px solid rgba(214,168,110,0.45)' : '1px solid transparent',
              background: sel ? '#FFFFFF' : 'transparent',
              color: sel ? '#B85832' : '#7C6753',
              boxShadow: sel ? '0 2px 6px rgba(140,114,85,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }
          }, label);
        })
      ),

      // 内容列表展示区
      h('div', {
        style: {
          flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 14px 24px',
          display: 'flex', flexDirection: 'column', gap: '10px', WebkitOverflowScrolling: 'touch'
        }
      },
        // TAB 1: 预设电台列表
        activeTab === 'radio' && PRESET_STATIONS.map(st => {
          const isCurr = currentStation.id === st.id;
          return h('div', {
            key: st.id, onClick: () => handleSelectStation(st, null),
            style: {
              padding: '10px 12px', borderRadius: '14px', cursor: 'pointer',
              background: isCurr ? 'linear-gradient(135deg, #FFF9F3 0%, #FCEEE3 100%)' : 'rgba(255,255,255,0.7)',
              border: isCurr ? '1.5px solid #D6724B' : '1px solid rgba(214,168,110,0.3)',
              boxShadow: isCurr ? '0 3px 8px rgba(214,114,75,0.15)' : '0 1px 3px rgba(0,0,0,0.03)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px'
            }
          },
            h('div', { style: { flex: 1, minWidth: 0 } },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' } },
                h('span', { style: { fontSize: '10px', fontWeight: 'bold', color: '#D6724B', fontFamily: 'monospace' } }, st.frequency),
                h('span', { style: { fontSize: '9px', padding: '0 4px', borderRadius: '4px', background: '#F5EDE0', color: '#8C5E28' } }, st.categoryLabel),
                isCurr && isPlaying && h('span', { style: { fontSize: '9px', color: '#4F8A5B', fontWeight: 'bold' } }, '● 正在播放')
              ),
              h('div', { style: { fontSize: '13px', fontWeight: 'bold', color: '#3E3226', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, st.name),
              h('div', { style: { fontSize: '10.5px', color: '#8C7255', marginTop: '2px', lineHeight: 1.3 } }, st.description)
            ),
            h('button', {
              type: 'button', onClick: (e) => { e.stopPropagation(); handleToggleFavorite(st); },
              style: { border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer', color: favorites.some(f => f.id === st.id) ? '#D6724B' : '#C7B9A5' }
            }, favorites.some(f => f.id === st.id) ? '♥' : '♡')
          );
        }),

        // TAB 2: 名士在听与心境点台
        activeTab === 'characters' && h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
          // 顶部名士头像栏与操作键
          h('div', {
            style: {
              padding: '10px 12px', borderRadius: '16px', background: 'rgba(255,255,255,0.75)',
              border: '1px solid rgba(214,168,110,0.3)', display: 'flex', flexDirection: 'column', gap: '8px'
            }
          },
            h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
              h('span', { style: { fontSize: '11.5px', fontWeight: 'bold', color: '#7C5832' } }, '🎧 名士此刻正在收听'),
              h('button', {
                type: 'button', onClick: handleGenerateListeningNow, disabled: isGenerating,
                style: {
                  background: 'linear-gradient(135deg, #D6724B 0%, #B85832 100%)', border: 'none',
                  borderRadius: '12px', padding: '4px 10px', color: '#fff', fontSize: '10.5px', fontWeight: 'bold', cursor: 'pointer'
                }
              }, isGenerating ? '同步中...' : '🔄 探查名士在听')
            ),
            // 名士横向轮播
            h('div', { style: { display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', WebkitOverflowScrolling: 'touch' } },
              characters.map(c => {
                const nowItem = listeningNowList.find(n => n.charName === c.name);
                const isSel = selectedChar === c.name;
                return h('div', {
                  key: c.name, onClick: () => {
                    setSelectedChar(c.name);
                    if (nowItem) {
                      const st = allStationPool.find(s => s.id === nowItem.stationId);
                      if (st) handleSelectStation(st, c.name);
                    }
                  },
                  style: {
                    padding: '6px 10px', borderRadius: '14px', flexShrink: 0, cursor: 'pointer',
                    background: isSel ? 'linear-gradient(135deg, #FFF9F3 0%, #FCEEE3 100%)' : '#FFFDF9',
                    border: isSel ? '1.5px solid #D6724B' : '1px solid rgba(214,168,110,0.3)',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }
                },
                  h(NuoAvatar, {
                    avatar: c.avatar,
                    name: c.name,
                    color: c.avatarColor,
                    size: 22
                  }),
                  h('div', { style: { display: 'flex', flexDirection: 'column' } },
                    h('span', { style: { fontSize: '11px', fontWeight: 'bold', color: isSel ? '#B85832' : '#4A3C31' } }, c.name),
                    h('span', { style: { fontSize: '9px', color: '#8C7255', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, nowItem ? nowItem.stationName : '未锁定')
                  )
                );
              })
            ),
            // 选中名士的心声展开
            (() => {
              const currentNow = listeningNowList.find(n => n.charName === selectedChar);
              if (!currentNow) return null;
              return h('div', {
                style: {
                  fontSize: '11.5px', color: '#5D442A', background: '#FAF5EB', borderRadius: '10px',
                  padding: '6px 10px', borderLeft: '3px solid #D6724B', fontStyle: 'italic'
                }
              }, `「${selectedChar}」心声：“${currentNow.thought}”`);
            })()
          ),

          // 点台生成按钮栏
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' } },
            h('span', { style: { fontSize: '12px', fontWeight: 'bold', color: '#7C5832' } }, `✨「${selectedChar}」的心境点台清单`),
            h('button', {
              type: 'button', onClick: handleGeneratePicks, disabled: isGenerating,
              style: {
                background: 'linear-gradient(135deg, #D6724B 0%, #B85832 100%)', border: 'none',
                borderRadius: '12px', padding: '5px 12px', color: '#fff', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer'
              }
            }, isGenerating ? '点台中...' : `✨ 听「${selectedChar}」点台`)
          ),

          // 点台卡片列表
          radioPicks.filter(p => p.charName === selectedChar).length === 0
            ? h('div', {
              onClick: handleGeneratePicks,
              style: {
                padding: '24px', borderRadius: '16px', border: '2px dashed #D6B88A', background: 'rgba(255,255,255,0.6)',
                textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px'
              }
            },
              h('span', { style: { fontSize: '26px' } }, '📻'),
              h('span', { style: { fontSize: '12.5px', fontWeight: 'bold', color: '#5D442A' } }, `暂无「${selectedChar}」的点台记录`),
              h('span', { style: { fontSize: '10.5px', color: '#8C7255' } }, '点击此处，让名士为你安利专属频道')
            )
            : radioPicks.filter(p => p.charName === selectedChar).map(pick => {
              const st = allStationPool.find(s => s.id === pick.stationId);
              return h('div', {
                key: pick.id, onClick: () => st && handleSelectStation(st, pick.charName),
                style: {
                  padding: '12px', borderRadius: '16px', background: 'rgba(255,255,255,0.85)',
                  border: '1px solid rgba(214,168,110,0.35)', boxShadow: '0 2px 6px rgba(140,114,85,0.06)',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px'
                }
              },
                h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
                  h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
                    h('span', { style: { fontSize: '10px', fontWeight: 'bold', color: '#D6724B' } }, pick.stationFreq),
                    h('span', { style: { fontSize: '13.5px', fontWeight: 'bold', color: '#3E3226' } }, pick.stationName)
                  ),
                  h('span', { style: { fontSize: '9.5px', color: '#8C5E28', background: '#F5EDE0', padding: '1px 6px', borderRadius: '6px' } }, `适合：${pick.bestTime}`)
                ),
                h('div', {
                  style: {
                    fontSize: '11.5px', color: '#5D442A', background: '#FFFDF9', borderRadius: '8px',
                    padding: '6px 8px', lineHeight: 1.45, borderLeft: '3px solid #D6B88A'
                  }
                }, pick.reason),
                h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' } },
                  h('div', { style: { display: 'flex', gap: '4px' } },
                    (pick.tags || []).map(t => h('span', { key: t, style: { fontSize: '9px', background: 'rgba(214,114,75,0.1)', color: '#B85832', padding: '1px 5px', borderRadius: '4px' } }, t))
                  ),
                  h('button', {
                    type: 'button', style: { border: 'none', background: 'linear-gradient(135deg, #D6724B 0%, #B85832 100%)', color: '#fff', borderRadius: '8px', padding: '2px 8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }
                  }, '▶ 收听')
                )
              );
            })
        ),

        // TAB 3: 四时段节目单
        activeTab === 'schedule' && h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
            h('span', { style: { fontSize: '12px', fontWeight: 'bold', color: '#7C5832' } }, `📜「${selectedChar}」全天收听日程`),
            h('button', {
              type: 'button', onClick: handleGenerateSchedule, disabled: isGenerating,
              style: {
                background: 'linear-gradient(135deg, #D6724B 0%, #B85832 100%)', border: 'none',
                borderRadius: '12px', padding: '4px 12px', color: '#fff', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer'
              }
            }, isGenerating ? '编排中...' : '✨ 重新编排日程')
          ),
          (() => {
            const schedObj = scheduleMap[selectedChar];
            if (!schedObj || !schedObj.schedule) {
              return h('div', {
                onClick: handleGenerateSchedule,
                style: {
                  padding: '24px', borderRadius: '16px', border: '2px dashed #D6B88A', background: 'rgba(255,255,255,0.6)',
                  textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px'
                }
              },
                h('span', { style: { fontSize: '26px' } }, '📜'),
                h('span', { style: { fontSize: '12.5px', fontWeight: 'bold', color: '#5D442A' } }, `暂未为「${selectedChar}」排定日程`),
                h('span', { style: { fontSize: '10.5px', color: '#8C7255' } }, '点击此处，一键生成晨暮四时收听规划')
              );
            }
            const s = schedObj.schedule;
            const slots = [
              ['morning', '🌅 晨起 / 清晨', s.morning],
              ['afternoon', '🍵 午后 / 茶歇', s.afternoon],
              ['evening', '🏮 暮夜 / 华灯', s.evening],
              ['midnight', '🌙 宵禁 / 深夜', s.midnight]
            ];
            return slots.map(([key, label, data]) => {
              if (!data) return null;
              const st = allStationPool.find(item => item.id === data.stationId) || allStationPool[0];
              return h('div', {
                key, onClick: () => st && handleSelectStation(st, selectedChar),
                style: {
                  padding: '10px 12px', borderRadius: '14px', background: 'rgba(255,255,255,0.85)',
                  border: '1px solid rgba(214,168,110,0.3)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px'
                }
              },
                h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
                  h('span', { style: { fontSize: '12px', fontWeight: 'bold', color: '#B85832' } }, label),
                  h('span', { style: { fontSize: '11px', fontWeight: 'bold', color: '#3E3226' } }, st ? st.name : '未知电台')
                ),
                h('div', { style: { fontSize: '11px', color: '#5D442A', background: '#FAF5EB', borderRadius: '8px', padding: '5px 8px' } }, data.comment)
              );
            });
          })()
        ),

        // TAB 4: 收藏与自带电台
        activeTab === 'favorites' && h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
          // 顶部自带电台录入入口
          h('div', {
            style: {
              padding: '10px 12px', borderRadius: '14px', background: 'linear-gradient(135deg, #FFF9F3 0%, #F5ECDD 100%)',
              border: '1px solid #D6B88A', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }
          },
            h('div', { style: { display: 'flex', flexDirection: 'column' } },
              h('span', { style: { fontSize: '12.5px', fontWeight: 'bold', color: '#4A3C31' } }, '➕ 用户自带直链电台'),
              h('span', { style: { fontSize: '9.5px', color: '#8C5E28' } }, '支持粘贴 mp3 / m3u8 直链，名士将为你专属点评')
            ),
            h('button', {
              type: 'button', onClick: () => setShowAddCustom(true),
              style: {
                background: 'linear-gradient(135deg, #D6724B 0%, #B85832 100%)', border: 'none',
                borderRadius: '12px', padding: '5px 12px', color: '#fff', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer'
              }
            }, '录入直链')
          ),

          // Radio Browser 在线搜索栏
          h('div', { style: { display: 'flex', gap: '6px' } },
            h('input', {
              type: 'text', placeholder: '在 Radio Browser 全球库中搜索电台...', value: searchKeyword,
              onChange: (e) => setSearchKeyword(e.target.value), onKeyDown: (e) => e.key === 'Enter' && handleSearchOnline(),
              style: { flex: 1, padding: '7px 10px', borderRadius: '10px', border: '1px solid #D6A86E', fontSize: '11.5px', background: '#fff' }
            }),
            h('button', {
              type: 'button', onClick: handleSearchOnline, disabled: isSearching,
              style: { padding: '7px 12px', borderRadius: '10px', border: '1px solid #D6A86E', background: '#FAF4E8', color: '#8C5E28', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }
            }, isSearching ? '搜索中' : '🔍 搜索')
          ),

          // 搜索结果展示
          searchResults.length > 0 && h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
            h('span', { style: { fontSize: '11px', fontWeight: 'bold', color: '#7C5832' } }, `🔍 全球电台搜索结果 (${searchResults.length})`),
            searchResults.map(st => h('div', {
              key: st.id, onClick: () => handleSelectStation(st, null),
              style: { padding: '8px 10px', borderRadius: '12px', background: '#fff', border: '1px solid rgba(214,168,110,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }
            },
              h('div', { style: { flex: 1, minWidth: 0 } },
                h('div', { style: { fontSize: '12px', fontWeight: 'bold', color: '#3E3226', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, st.name),
                h('div', { style: { fontSize: '9.5px', color: '#8C7255' } }, st.description)
              ),
              h('button', {
                type: 'button', onClick: (e) => { e.stopPropagation(); handleToggleFavorite(st); },
                style: { border: 'none', background: 'none', fontSize: '16px', color: favorites.some(f => f.id === st.id) ? '#D6724B' : '#C7B9A5', cursor: 'pointer' }
              }, favorites.some(f => f.id === st.id) ? '♥' : '♡')
            ))
          ),

          // 自带电台列表
          customStations.length > 0 && h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
            h('span', { style: { fontSize: '11.5px', fontWeight: 'bold', color: '#7C5832' } }, `📁 我的自建电台 (${customStations.length})`),
            customStations.map(st => h('div', {
              key: st.id, onClick: () => handleSelectStation(st, null),
              style: { padding: '10px 12px', borderRadius: '14px', background: '#FFFDF9', border: '1px solid #D6B88A', display: 'flex', flexDirection: 'column', gap: '4px', cursor: 'pointer' }
            },
              h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
                h('span', { style: { fontSize: '13px', fontWeight: 'bold', color: '#3E3226' } }, st.name),
                h('button', {
                  type: 'button', onClick: (e) => { e.stopPropagation(); handleDeleteCustomStation(st.id); },
                  style: { border: 'none', background: 'none', color: '#C0472B', fontSize: '11px', cursor: 'pointer' }
                }, '🗑 删除')
              ),
              h('span', { style: { fontSize: '9.5px', color: '#8C7255', wordBreak: 'break-all' } }, st.streamUrl),
              // 听听名士怎么说按钮
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' } },
                h('span', { style: { fontSize: '10px', color: '#8C5E28' } }, '听听名士怎么说：'),
                characters.slice(0, 3).map(c => h('button', {
                  key: c.name, type: 'button', onClick: (e) => { e.stopPropagation(); handleAskReview(st, c); },
                  style: { border: '1px solid #D6B88A', background: '#FAF4E8', color: '#8C5E28', borderRadius: '8px', padding: '1px 6px', fontSize: '9.5px', cursor: 'pointer' }
                }, c.name))
              ),
              // 查阅已生成的听后感
              (() => {
                const reviews = Object.values(characterReviews).filter(r => r.stationId === st.id);
                if (reviews.length === 0) return null;
                return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' } },
                  reviews.map(r => h('div', {
                    key: r.id, style: { fontSize: '10.5px', color: '#5D442A', background: '#F5EDE0', padding: '4px 8px', borderRadius: '6px' }
                  }, `「${r.charName}」：“${r.review}”`))
                );
              })()
            ))
          ),

          // 收藏台展示
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
            h('span', { style: { fontSize: '11.5px', fontWeight: 'bold', color: '#7C5832' } }, `♥ 我的收藏频道 (${favorites.length})`),
            favorites.length === 0
              ? h('div', { style: { padding: '20px', textAlign: 'center', color: '#A38C6D', fontSize: '11.5px' } }, '暂无收藏的电台，点击任意频道的爱心即可收藏')
              : favorites.map(fav => {
                const st = fav.station;
                return h('div', {
                  key: fav.id, onClick: () => handleSelectStation(st, null),
                  style: { padding: '10px 12px', borderRadius: '14px', background: '#fff', border: '1px solid rgba(214,168,110,0.3)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px' }
                },
                  h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
                    h('span', { style: { fontSize: '13px', fontWeight: 'bold', color: '#3E3226' } }, st.name),
                    h('button', {
                      type: 'button', onClick: (e) => { e.stopPropagation(); handleToggleFavorite(st); },
                      style: { border: 'none', background: 'none', color: '#D6724B', fontSize: '16px', cursor: 'pointer' }
                    }, '♥')
                  ),
                  h('span', { style: { fontSize: '10px', color: '#8C7255' } }, st.description),
                  h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' } },
                    h('span', { style: { fontSize: '9.5px', color: '#8C5E28' } }, '求名士评：'),
                    characters.slice(0, 3).map(c => h('button', {
                      key: c.name, type: 'button', onClick: (e) => { e.stopPropagation(); handleAskReview(st, c); },
                      style: { border: '1px solid #D6B88A', background: '#FAF4E8', color: '#8C5E28', borderRadius: '8px', padding: '1px 6px', fontSize: '9.5px', cursor: 'pointer' }
                    }, c.name))
                  ),
                  (() => {
                    const reviews = Object.values(characterReviews).filter(r => r.stationId === st.id);
                    if (reviews.length === 0) return null;
                    return reviews.map(r => h('div', {
                      key: r.id, style: { fontSize: '10.5px', color: '#5D442A', background: '#F5EDE0', padding: '4px 8px', borderRadius: '6px', marginTop: '2px' }
                    }, `「${r.charName}」：“${r.review}”`));
                  })()
                );
              })
          )
        ),

        // TAB 5: 电台时空罗盘 (只统计名士)
        activeTab === 'compass' && h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
          // 罗盘总览卡
          h('div', {
            style: {
              padding: '12px 14px', borderRadius: '16px', background: '#FFFDF8',
              border: '1px solid rgba(214,168,110,0.4)', boxShadow: '0 2px 8px rgba(140,114,85,0.08)',
              display: 'flex', flexDirection: 'column', gap: '8px'
            }
          },
            h('span', { style: { fontSize: '13px', fontWeight: 'bold', color: '#7C5832' } }, '🧭 名士电台收听罗盘'),
            h('span', { style: { fontSize: '10px', color: '#A38C6D' } }, '汇总名士们的电台收听时长、偏好频道与专属电台人设'),
            // 最佳搭子
            h('div', {
              style: {
                marginTop: '4px', padding: '10px', borderRadius: '12px', background: 'linear-gradient(135deg, #FFF9F3 0%, #F5ECDD 100%)',
                border: '1px solid #D6B88A', display: 'flex', alignItems: 'center', gap: '10px'
              }
            },
              h(NuoAvatar, {
                avatar: compassData.bestMatch.char.avatar,
                name: compassData.bestMatch.char.name,
                color: compassData.bestMatch.char.avatarColor,
                size: 40
              }),
              h('div', { style: { display: 'flex', flexDirection: 'column' } },
                h('span', { style: { fontSize: '11px', color: '#8C5E28', fontWeight: 'bold' } }, '🎧 广陵最佳耳机搭子'),
                h('span', { style: { fontSize: '14px', fontWeight: 'bold', color: '#B85832' } }, `${compassData.bestMatch.char.name} ·「${compassData.bestMatch.title}」`),
                h('span', { style: { fontSize: '9.5px', color: '#7C6753' } }, `与你偏好最为相投，同爱${compassData.bestMatch.topTag}调频`)
              )
            )
          ),

          // 名士电台称号与偏好清单
          h('div', {
            style: {
              padding: '12px 14px', borderRadius: '16px', background: '#FFFDF8',
              border: '1px solid rgba(214,168,110,0.4)', display: 'flex', flexDirection: 'column', gap: '8px'
            }
          },
            h('span', { style: { fontSize: '12px', fontWeight: 'bold', color: '#7C5832' } }, '🎖️ 名士电台人设称号'),
            compassData.charStats.map(item => h('div', {
              key: item.char.name,
              style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed rgba(214,168,110,0.2)' }
            },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                h(NuoAvatar, {
                  avatar: item.char.avatar,
                  name: item.char.name,
                  color: item.char.avatarColor,
                  size: 26
                }),
                h('div', { style: { display: 'flex', flexDirection: 'column' } },
                  h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
                    h('span', { style: { fontSize: '12px', fontWeight: 'bold', color: '#3E3226' } }, item.char.name),
                    h('span', { style: { fontSize: '10.5px', color: '#D6724B', fontWeight: 'bold' } }, `「${item.title}」`)
                  ),
                  h('span', { style: { fontSize: '9.5px', color: '#8C7255' } }, `偏好：${item.topTag} · 已安利 ${item.picksCount} 个频道`)
                )
              ),
              h('span', { style: { fontSize: '11px', fontWeight: 'bold', color: '#B85832' } }, `累计 ${item.hours}h`)
            ))
          )
        )
      ),

      // 录入自建直链电台弹窗
      showAddCustom && h('div', {
        onClick: () => setShowAddCustom(false),
        style: {
          position: 'absolute', inset: 0, zIndex: 10020, background: 'rgba(90,70,45,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px', boxSizing: 'border-box'
        }
      },
        h('div', {
          onClick: (e) => e.stopPropagation(),
          style: {
            width: '100%', maxWidth: '380px', background: '#FBF8F2', borderRadius: '18px',
            border: '1px solid #D6B88A', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px'
          }
        },
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
            h('span', { style: { fontSize: '14.5px', fontWeight: 'bold', color: '#3E3226' } }, '➕ 录入自带直链电台'),
            h('button', { onClick: () => setShowAddCustom(false), style: { border: 'none', background: 'none', fontSize: '15px', color: '#78716C', cursor: 'pointer' } }, '✕')
          ),
          h('form', { onSubmit: handleSaveCustomStation, style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
            h('div', null,
              h('label', { style: { fontSize: '11px', fontWeight: 'bold', color: '#5D442A', display: 'block', marginBottom: '2px' } }, '电台名称'),
              h('input', {
                type: 'text', placeholder: '如：私享古典慢调、我的播客流', value: newCustomName, onChange: (e) => setNewCustomName(e.target.value),
                style: { width: '100%', padding: '7px 10px', borderRadius: '10px', border: '1px solid #D6A86E', boxSizing: 'border-box', fontSize: '12px' }
              })
            ),
            h('div', null,
              h('label', { style: { fontSize: '11px', fontWeight: 'bold', color: '#5D442A', display: 'block', marginBottom: '2px' } }, '直链地址 (支持 http/https 的 mp3、aac 或 m3u8)'),
              h('input', {
                type: 'text', placeholder: 'https://.../stream.mp3', value: newCustomUrl, onChange: (e) => setNewCustomUrl(e.target.value),
                style: { width: '100%', padding: '7px 10px', borderRadius: '10px', border: '1px solid #D6A86E', boxSizing: 'border-box', fontSize: '11px' }
              })
            ),
            h('div', null,
              h('label', { style: { fontSize: '11px', fontWeight: 'bold', color: '#5D442A', display: 'block', marginBottom: '2px' } }, '简要描述 / 标签 (名士将据此为你点评)'),
              h('input', {
                type: 'text', placeholder: '深夜慢摇，温暖民谣', value: newCustomDesc, onChange: (e) => setNewCustomDesc(e.target.value),
                style: { width: '100%', padding: '7px 10px', borderRadius: '10px', border: '1px solid #D6A86E', boxSizing: 'border-box', fontSize: '12px' }
              })
            ),
            h('button', {
              type: 'submit',
              style: {
                marginTop: '4px', padding: '10px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, #D6724B 0%, #B85832 100%)', color: '#fff',
                fontSize: '13px', fontWeight: 'bold', cursor: 'pointer'
              }
            }, '💾 保存电台')
          )
        )
      ),

      // Toast 提示条
      toastMsg && h('div', {
        style: {
          position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          background: '#FFF8E7', color: '#6B4423', border: '1px solid rgba(214,168,110,0.8)',
          padding: '8px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
          zIndex: 10030, boxShadow: '0 4px 16px rgba(140,100,50,0.25)', maxWidth: '86%', textAlign: 'center'
        }
      }, toastMsg)
    );
  }

  window.NuoRadioAppModal = NuoRadioAppModal;

})(typeof window !== 'undefined' ? window : this);
