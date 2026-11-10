// ==============================================================================
// 代号鸢小手机 ·「傩·游戏」复古卡带游戏仓 (Nuo GameVault Engine)
// 风格：浅米色宣纸 + 复古游戏卡带拟物
// 架构：传讯名士通讯录动态读取 + AI 名士点游 (在玩/想玩/通关/封盘) + Steam/iTunes 静默抓封面
//       + 名士电竞时空罗盘 (只统计名士，不记录用户本人) + 应用内独立生态
// ==============================================================================

(function (window) {
  const React = window.React;
  if (!React) return;
  const { useState, useEffect } = React;
  const h = React.createElement;

  // ----------------------------------------------------------------------------
  // 1. 常量与配置
  // ----------------------------------------------------------------------------
  const DB_NAME = 't8_game_vault';
  const STORE_NAME = 'games';
  const TITLES_KEY = 't8_game_titles';

  const STATUS = {
    playing: { label: '在玩', icon: '🎮', color: '#D6724B', bg: '#FFF1E8' },
    wishlist: { label: '想玩', icon: '🌟', color: '#B8862B', bg: '#FFF7E0' },
    cleared: { label: '通关', icon: '🏆', color: '#4F8A5B', bg: '#EAF5EC' },
    dropped: { label: '封盘', icon: '💤', color: '#8A8178', bg: '#EFEBE4' }
  };
  const STATUS_ORDER = ['playing', 'wishlist', 'cleared', 'dropped'];
  const NEXT_STATUS = { playing: 'cleared', cleared: 'dropped', dropped: 'wishlist', wishlist: 'playing' };

  const PLATFORM_LABEL = { steam: 'STEAM', pc: 'PC', mobile: '手游', switch: 'SWITCH', ps: 'PS', xbox: 'XBOX' };

  const DEFAULT_TITLES = {
    '傅融': '特惠喜加一仓鼠',
    '刘辩': '全服最菜但最黏人少帝',
    '袁基': '白金算计大师',
    '孙策': '无双狂战小霸王',
    '左慈': '云游悟道散人'
  };

  const DEFAULT_LEAD_CHARACTERS = [
    { id: 'liubian', name: '刘辩', mbti: 'ENFP', constellation: '双鱼座', speakingStyle: '第一人称“朕”，任性撒娇、天真黏人', personality: '少帝苍凉而天真，强烈占有欲，极度依赖楼主', background: '汉少帝，被困深宫，对广陵王全然依赖。' },
    { id: 'furong', name: '傅融', mbti: 'ISTJ', constellation: '摩羯座', speakingStyle: '精打细算，爱算账，口嫌体正直', personality: '记账成癖，房产执念，嘴硬心软', background: '精明的账房先生，把一文钱掰成两半花。' },
    { id: 'yuanji', name: '袁基', mbti: 'INFJ', constellation: '天秤座', speakingStyle: '第一人称“基”，温润克制，言辞优雅', personality: '世家风范，深谋远虑，暗藏执念', background: '汝南袁氏长公子，围棋国手。' },
    { id: 'sunce', name: '孙策', mbti: 'ESTP', constellation: '狮子座', speakingStyle: '豪爽直率，称呼楼主“广陵王”，爱说“本霸王”', personality: '江东小霸王，热血狂傲，大开大合', background: '江东之虎，勇冠三军。' },
    { id: 'zuoci', name: '左慈', mbti: 'INTJ', constellation: '天蝎座', speakingStyle: '清冷超然、言简意赅、充满哲思', personality: '隐鸢阁阁主，出尘绝世，看淡沧海桑田', background: '道门至尊，守护天下秘宝。' }
  ];

  // 内置经典游戏离线字典 (Steam AppID 秒级匹配封面)
  const OFFLINE_GAMES = [
    { keys: ['黑神话悟空', 'blackmythwukong', '黑神话'], id: '2358720', platform: 'steam' },
    { keys: ['星露谷物语', 'stardewvalley', '星露谷'], id: '413150', platform: 'steam' },
    { keys: ['艾尔登法环', 'eldenring', '老头环'], id: '1245620', platform: 'steam' },
    { keys: ['博德之门3', 'baldursgate3', '博德之门'], id: '1086940', platform: 'steam' },
    { keys: ['赛博朋克2077', 'cyberpunk2077'], id: '1091500', platform: 'steam' },
    { keys: ['哈迪斯', 'hades'], id: '1145360', platform: 'steam' },
    { keys: ['双人成行', 'ittakestwo'], id: '1426210', platform: 'steam' },
    { keys: ['文明6', '文明VI', 'civilizationvi', 'civilization6', 'sidmeierscivilizationvi'], id: '289070', platform: 'steam' },
    { keys: ['只狼', 'sekiro'], id: '814380', platform: 'steam' },
    { keys: ['怪物猎人世界', 'monsterhunterworld'], id: '582010', platform: 'steam' },
    { keys: ['怪物猎人崛起', 'monsterhunterrise'], id: '1446780', platform: 'steam' },
    { keys: ['猛兽派对', 'beastparty', 'partyanimals'], id: '1260320', platform: 'steam' },
    { keys: ['极限竞速地平线5', 'forzahorizon5'], id: '1551360', platform: 'steam' },
    { keys: ['戴森球计划', 'dysonspheprogram', 'dysonsphereprogram'], id: '1366540', platform: 'steam' },
    { keys: ['缺氧', 'oxygennotincluded'], id: '457140', platform: 'steam' },
    { keys: ['泰拉瑞亚', 'terraria'], id: '105600', platform: 'steam' },
    { keys: ['饥荒', 'dontstarve'], id: '219740', platform: 'steam' },
    { keys: ['太吾绘卷', 'taiwuscrolls', 'thescrollsoftaiwu'], id: '838350', platform: 'steam' },
    { keys: ['空洞骑士', 'hollowknight'], id: '367520', platform: 'steam' },
    { keys: ['鬼谷八荒', 'tideofdestiny'], id: '1468810', platform: 'steam' },
    { keys: ['了不起的修仙模拟器'], id: '1189490', platform: 'steam' },
    { keys: ['幸福工厂', 'satisfactory'], id: '526870', platform: 'steam' },
    { keys: ['欧陆风云4', 'europauniversalis4', 'europauniversalisiv'], id: '236850', platform: 'steam' },
    { keys: ['十字军之王3', 'crusaderkings3', 'crusaderkingsiii'], id: '1158310', platform: 'steam' },
    { keys: ['全面战争三国', 'totalwarthreekingdoms'], id: '779340', platform: 'steam' },
    { keys: ['荒野大镖客2', '荒野大镖客救赎2', 'reddeadredemption2'], id: '1174180', platform: 'steam' },
    { keys: ['巫师3', '巫师3狂猎', 'thewitcher3'], id: '292030', platform: 'steam' },
    { keys: ['霍格沃茨之遗', 'hogwartslegacy'], id: '990080', platform: 'steam' },
    { keys: ['人类一败涂地', 'humanfallflat'], id: '477160', platform: 'steam' },
    { keys: ['胡闹厨房2', '分手厨房2', 'overcooked2'], id: '728880', platform: 'steam' },
    { keys: ['糖豆人', 'fallguys'], id: '1097150', platform: 'steam' },
    { keys: ['真三国无双8', 'dynastywarriors9', '真三国无双起源', 'dynastywarriorsorigins'], id: '2016920', platform: 'steam' },
    { keys: ['地平线零之曙光', 'horizonzerodawn'], id: '1151640', platform: 'steam' },
    { keys: ['街头霸王6', 'streetfighter6'], id: '1364780', platform: 'steam' },
    { keys: ['极品飞车', 'needforspeed'], id: '1262540', platform: 'steam' },
    { keys: ['纪念碑谷', 'monumentvalley'], id: '', platform: 'mobile' }
  ];

  const normalize = (s) => String(s || '').toLowerCase().replace(/[\s·・:：\-—_.,，。!！?？'"“”‘’()（）\[\]【】《》]/g, '');

  const steamCover = (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_600x900_2x.jpg`;
  const steamBanner = (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`;

  function normalizePlatform(p) {
    const s = String(p || '').toLowerCase();
    if (s.includes('steam')) return 'steam';
    if (s.includes('switch') || s === 'ns' || s.includes('任天堂')) return 'switch';
    if (s.includes('ps') || s.includes('playstation')) return 'ps';
    if (s.includes('xbox')) return 'xbox';
    if (s.includes('mobile') || s.includes('手游') || s.includes('ios') || s.includes('android') || s.includes('手机')) return 'mobile';
    return 'pc';
  }

  function normalizeStatus(s) {
    const v = String(s || '').toLowerCase();
    if (STATUS[v]) return v;
    if (v.includes('play') || v.includes('在玩')) return 'playing';
    if (v.includes('wish') || v.includes('想玩')) return 'wishlist';
    if (v.includes('clear') || v.includes('通关')) return 'cleared';
    if (v.includes('drop') || v.includes('封盘')) return 'dropped';
    return 'playing';
  }

  // ----------------------------------------------------------------------------
  // 2. 免 Key 封面检索引擎 (离线字典 → Steam → iTunes)
  // ----------------------------------------------------------------------------
  async function fetchJSON(url, ms) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), ms || 7000) : null;
    try {
      const res = await fetch(url, { signal: controller ? controller.signal : undefined, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function pickBest(items, getName, query) {
    if (!items || !items.length) return null;
    const q = normalize(query);
    let best = items.find((it) => normalize(getName(it)) === q);
    if (!best) best = items.find((it) => { const n = normalize(getName(it)); return n && q && (n.includes(q) || q.includes(n)); });
    return best || items[0];
  }

  async function searchSteam(query) {
    const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=schinese&cc=CN`;
    let data = null;
    try {
      data = await fetchJSON(url, 6000);
    } catch (e) {
      try {
        data = await fetchJSON('https://api.allorigins.win/raw?url=' + encodeURIComponent(url), 8000);
      } catch (e2) { data = null; }
    }
    const items = data && Array.isArray(data.items) ? data.items : [];
    const best = pickBest(items, (it) => it.name, query);
    if (!best || !best.id) return null;
    return { coverUrl: steamCover(best.id), bannerUrl: steamBanner(best.id), externalId: String(best.id), source: 'steam' };
  }

  async function searchItunes(query) {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=software&country=cn&limit=6`;
    try {
      const data = await fetchJSON(url, 7000);
      const items = data && Array.isArray(data.results) ? data.results : [];
      const best = pickBest(items, (it) => it.trackName, query);
      if (!best) return null;
      const cover = (best.artworkUrl512 || best.artworkUrl100 || '').replace('100x100', '512x512');
      if (!cover) return null;
      const shot = Array.isArray(best.screenshotUrls) && best.screenshotUrls[0] ? best.screenshotUrls[0] : '';
      return { coverUrl: cover, bannerUrl: shot, externalId: String(best.trackId || ''), source: 'itunes' };
    } catch (e) {
      return null;
    }
  }

  function matchOffline(title, original) {
    const ns = [normalize(title), normalize(original)].filter(Boolean);
    for (const g of OFFLINE_GAMES) {
      if (!g.id) continue;
      for (const k of g.keys) {
        const nk = normalize(k);
        if (ns.some((n) => n === nk || (nk.length >= 3 && n.includes(nk)) || (n.length >= 3 && nk.includes(n)))) {
          return { coverUrl: steamCover(g.id), bannerUrl: steamBanner(g.id), externalId: g.id, source: 'offline' };
        }
      }
    }
    return null;
  }

  async function resolveCover(title, original, platform) {
    const off = matchOffline(title, original);
    if (off) return off;
    const queries = [title, original].filter((q, i, a) => q && a.indexOf(q) === i);
    const p = normalizePlatform(platform);
    const order = p === 'mobile' ? ['itunes', 'steam'] : ['steam', 'itunes'];
    for (const eng of order) {
      for (const q of queries) {
        const r = eng === 'steam' ? await searchSteam(q) : await searchItunes(q);
        if (r) return r;
      }
    }
    return null;
  }

  // ----------------------------------------------------------------------------
  // 3. IndexedDB 卡带存储
  // ----------------------------------------------------------------------------
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function loadAllGames() {
    try {
      const db = await openDB();
      return await new Promise((resolve, reject) => {
        const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve((req.result || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('[NuoGame] 读取卡带失败:', e);
      return [];
    }
  }

  async function saveGames(list) {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      (list || []).forEach((g) => store.put(g));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function deleteGameById(id) {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ----------------------------------------------------------------------------
  // 4. 动态读取传讯名士通讯录 (复用「傩·观影」机制)
  // ----------------------------------------------------------------------------
  async function loadAllConfiguredCharacters() {
    if (typeof window.loadAllCinemaCharacters === 'function') {
      try {
        const list = await window.loadAllCinemaCharacters();
        if (Array.isArray(list) && list.length > 0) return list;
      } catch (e) { /* 回退到下方本地读取 */ }
    }
    let list = [];
    if (window.chatCharacterStore) {
      try {
        const stored = await window.chatCharacterStore.getAll();
        if (Array.isArray(stored) && stored.length) list = stored;
      } catch (e) {}
    }
    try {
      const local = JSON.parse(localStorage.getItem('t8_chat_list') || '[]');
      if (Array.isArray(local)) {
        const ids = new Set(list.map((c) => String(c.id || c.name)));
        local.forEach((c) => { if (c && !ids.has(String(c.id || c.name))) list.push(c); });
      }
    } catch (e) {}
    if (!list.length && Array.isArray(window.T8_INITIAL_CHATS)) list = window.T8_INITIAL_CHATS;
    let settings = {};
    try { settings = JSON.parse(localStorage.getItem('character_settings') || '{}'); } catch (e) {}
    const valid = list.filter((c) => c && typeof c === 'object' && (c.name || c.nickname) &&
      !String(c.id).startsWith('group') && c.type !== 'group' && c.type !== 'decor' && c.type !== 'moments');
    const result = valid.map((c) => {
      const name = String(c.name || c.nickname).trim();
      const id = c.id || name;
      const cs = settings[id] || settings[name] || {};
      const prof = c.profile || {};
      const fb = DEFAULT_LEAD_CHARACTERS.find((d) => d.name === name) || {};
      return {
        id, name,
        avatar: c.avatar || c.avatarUrl || prof.avatar || cs.avatar || '',
        avatarColor: c.avatarColor || prof.avatarColor || '#EAD6D6',
        mbti: prof.mbti || c.mbti || cs.mbti || fb.mbti || '未知',
        constellation: prof.constellation || c.constellation || cs.constellation || fb.constellation || '未知',
        personality: prof.personality || c.personality || cs.personality || c.desc || fb.personality || '性格鲜明、真挚深情',
        speakingStyle: prof.speakingStyle || prof.style || c.speakingStyle || c.style || cs.speakingStyle || cs.style || fb.speakingStyle || '专属说话风格与口癖',
        background: prof.background || prof.bio || c.background || cs.background || c.desc || fb.background || '《代号鸢》名士，与广陵王在乱世中共守广陵。',
        raw: c
      };
    });
    return result.length ? result : DEFAULT_LEAD_CHARACTERS;
  }

  // ----------------------------------------------------------------------------
  // 5. LLM 工具：调用与 JSON 解析
  // ----------------------------------------------------------------------------
  function callLLM(messages) {
    return new Promise((resolve, reject) => {
      if (!window.sendToLLM) { reject(new Error('未检测到大模型接口 (window.sendToLLM)')); return; }
      window.sendToLLM(messages, {}, (text) => resolve(text), (err) => reject(err));
    });
  }

  // 修复字符串内部未转义的双引号 (如 朕说"好")、字符串内的真实换行
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

  // 修复 AI 常见的不规范 JSON：代码围栏、注释、单引号、无引号键、多余逗号、内部引号
  function repairJSON(str) {
    let s = fixStringInternals(String(str || '').replace(/```(?:json)?/gi, ''));
    // 去除字符串外的注释
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
    try { return JSON.parse(chunk); } catch (e) { /* 继续修复 */ }
    return JSON.parse(repairJSON(chunk));
  }

  // 按括号配对（识别字符串）抽取所有含目标键的独立对象，容忍整体截断或个别条目损坏
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
            // 与 fixStringInternals 同步：后随非结构符号的引号视为字符串内部引号
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
        try { found.push(tryParse(chunk)); } catch (e) { console.warn('[NuoGame] 跳过无法解析的条目:', e.message, chunk.slice(0, 160)); }
        i = end + 1;
      } else {
        i = i + 1; // 外层包装对象：继续向内查找
      }
    }
    return found;
  }

  function parseJSONLoose(text) {
    const m = String(text || '').match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (!m) throw new Error('AI 未能返回标准 JSON 结构');
    return tryParse(m[0]);
  }

  async function getUserContext() {
    let userPersona = { name: '楼主', role: '广陵王/绣衣楼主', personality: '聪颖灵动、胸怀天下', background: '统领绣衣楼，密探天下要务' };
    try {
      const saved = JSON.parse(localStorage.getItem('user_personas') || '[]');
      const activeId = localStorage.getItem('active_persona_id');
      if (Array.isArray(saved) && saved.length) {
        const found = activeId ? saved.find((p) => String(p.id) === String(activeId)) : saved[0];
        if (found && found.name) {
          userPersona = {
            name: String(found.name).trim(), role: found.role || found.name,
            personality: found.personality || '真诚机敏', background: found.background || found.description || ''
          };
        }
      }
    } catch (e) {}
    let worldContext = '';
    try {
      if (window.getWorldBookContext) worldContext = await window.getWorldBookContext();
      else if (window.worldBookStore) {
        const data = await window.worldBookStore.getData();
        worldContext = typeof data === 'string' ? data : JSON.stringify(data);
      }
    } catch (e) {}
    return { userPersona, worldContext: worldContext || '' };
  }

  // ----------------------------------------------------------------------------
  // 6. AI 名士点游引擎 (在玩 / 想玩·邀约联机 / 通关 / 封盘)
  // ----------------------------------------------------------------------------
  async function generateGamesByAI(char, existingTitles) {
    const { userPersona, worldContext } = await getUserContext();
    const avoid = (existingTitles || []).slice(0, 40).join('、');

    const messages = [
      {
        role: 'system',
        content: `你正在沉浸式扮演《代号鸢》中的名士【${char.name}】。
你正在复古卡带游戏仓「傩·游戏」中，向广陵王（${userPersona.name}）展示你自己的游戏生涯：你正在沉迷的游戏、想拉对方联机的心愿单、已通关的神作及速评。

【你的全息人设配置】：
- 姓名：${char.name} (ID: ${char.id})
- MBTI人格：${char.mbti}
- 星座：${char.constellation}
- 语言风格：${char.speakingStyle}
- 性格特点：${char.personality}
- 生平背景：${char.background}

【对方（广陵王/楼主）的身份设定】：
- 姓名：${userPersona.name}
- 身份定位：${userPersona.role}
- 性格特点：${userPersona.personality}
- 经历背景：${userPersona.background}

【世界书当前背景】：
${worldContext ? worldContext.slice(0, 600) : '汉末三国风云，绣衣楼执掌天下密报，彼此在乱世中守望相助。'}

【点游任务要求】：
请根据你的性格、MBTI 与审美，挑选真实存在的知名电子游戏（Steam/PC、手游、Switch、PS、Xbox 均可，严禁杜撰假游戏名）：
1. 至少 3 款【在玩】（status 为 "playing"）：你正沉迷的游戏，给出累计时长 playtimeHours 和第一人称吐槽/沉迷心得。
2. 至少 3 款【想玩/邀约联机】（status 为 "wishlist"）：你想拉楼主一起玩的联机或心愿游戏，coopWithUser 设为 true 的至少 2 款，rating 为 0，playtimeHours 为 0。
3. 至少 3 款【通关】（status 为 "cleared"）：你已通关的游戏，给出评分 rating（6.0~9.9）、通关日期 clearedDate、通关速评。
4. 可选 0~2 款【封盘/弃坑】（status 为 "dropped"），写出弃坑理由。
其中已与楼主联机过的游戏（在玩或通关）可将 coopWithUser 设为 true，并给出 coopHours（联机时长，小时）。
共计至少 9 款。${avoid ? '\n请尽量避开已有游戏：' + avoid + '。' : ''}

必须直接返回且只返回合法 JSON 数组（严禁任何 Markdown 说明或多余字句），格式如下：
[
  {
    "gameTitle": "游戏标准中文名",
    "originalTitle": "官方原名或英文名",
    "platform": "steam | mobile | switch | ps | xbox | pc",
    "status": "playing",
    "playtimeHours": 42.5,
    "rating": 9.0,
    "clearedDate": "",
    "coopWithUser": false,
    "coopHours": 0,
    "comment": "你的第一人称专属评语（50-110字，强烈体现口癖、自称、情感，对楼主的借题发挥或傲娇吐槽）",
    "tags": ["动作RPG", "沉迷中"]
  }
]`
      },
      { role: 'user', content: '请为广陵王的【傩·游戏】卡带仓挑选至少 3 款在玩、3 款想玩、3 款通关游戏，共计至少 9 款，以 JSON 数组返回。' }
    ];

    let best = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await callLLM(messages);
      let arr = extractObjects(text, /["']?gameTitle["']?\s*:/).filter((g) => g && g.gameTitle);
      const count = (s) => arr.filter((g) => normalizeStatus(g.status) === s).length;
      if (arr.length > best.length) best = arr;
      if (count('playing') >= 3 && count('wishlist') >= 3 && count('cleared') >= 3) { best = arr; break; }
    }
    if (!best.length) throw new Error('未能从名士推荐中解析出有效游戏');

    const base = Date.now();
    const records = await Promise.all(best.map(async (g, idx) => {
      const status = normalizeStatus(g.status);
      const platform = normalizePlatform(g.platform);
      let cover = null;
      try { cover = await resolveCover(g.gameTitle, g.originalTitle, platform); } catch (e) {}
      const hours = Number(g.playtimeHours);
      const rating = Number(g.rating);
      return {
        id: `game_${char.id}_${base}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        charId: char.id,
        charName: char.name,
        charAvatar: char.avatar || '',
        title: String(g.gameTitle).trim(),
        originalTitle: g.originalTitle || '',
        platform,
        status,
        playtimeHours: status === 'wishlist' ? 0 : (isFinite(hours) ? Math.max(0, hours) : 0),
        rating: status === 'wishlist' ? 0 : (isFinite(rating) ? Math.min(10, Math.max(0, rating)) : 8.5),
        clearedDate: status === 'cleared' ? (g.clearedDate || new Date().toISOString().slice(0, 10)) : '',
        coopWithUser: !!g.coopWithUser,
        coopHours: status === 'wishlist' ? 0 : (Number(g.coopHours) > 0 ? Number(g.coopHours) : 0),
        comment: g.comment || '此局，与君同在。',
        tags: Array.isArray(g.tags) ? g.tags.slice(0, 4) : [],
        coverUrl: cover ? cover.coverUrl : '',
        bannerUrl: cover ? cover.bannerUrl : '',
        createdAt: base - idx * 1000,
        updatedAt: base - idx * 1000
      };
    }));
    return records;
  }

  async function generateTitlesByAI(characters, games) {
    const summary = characters.map((c) => {
      const gs = games.filter((g) => g.charName === c.name);
      const titles = gs.slice(0, 8).map((g) => `${g.title}(${STATUS[g.status].label})`).join('、') || '暂无游戏';
      return `- ${c.name}（${c.mbti}，${c.personality}）：${titles}`;
    }).join('\n');
    const text = await callLLM([
      {
        role: 'system',
        content: `你是《代号鸢》小手机「傩·游戏」的电竞时空罗盘评委。请根据每位名士的人设与游戏库，为他们各评一个幽默、传神、不超过 10 个字的"游戏人设称号"（如：特惠喜加一仓鼠、白金算计大师）。\n只返回合法 JSON 对象：{"名士名":"称号"}，不要任何多余文字。\n名士与游戏库：\n${summary}`
      },
      { role: 'user', content: '请评选称号，返回 JSON 对象。' }
    ]);
    const obj = parseJSONLoose(text);
    const out = {};
    Object.keys(obj || {}).forEach((k) => { if (typeof obj[k] === 'string' && obj[k].trim()) out[k] = obj[k].trim().slice(0, 14); });
    return out;
  }

  function loadTitlesCache() {
    try { return JSON.parse(localStorage.getItem(TITLES_KEY) || '{}') || {}; } catch (e) { return {}; }
  }

  // ----------------------------------------------------------------------------
  // 7. 名士电竞时空罗盘统计 (只统计名士，不记录用户)
  // ----------------------------------------------------------------------------
  function calcStats(games, characters, titleCache) {
    const total = games.length;
    const cleared = games.filter((g) => g.status === 'cleared').length;
    const started = games.filter((g) => g.status !== 'wishlist').length;
    const totalHours = Math.round(games.reduce((a, g) => a + (g.playtimeHours || 0), 0) * 10) / 10;
    const byStatus = {};
    STATUS_ORDER.forEach((s) => { byStatus[s] = games.filter((g) => g.status === s).length; });

    const chars = characters.map((c) => {
      const gs = games.filter((g) => g.charName === c.name);
      const hours = Math.round(gs.reduce((a, g) => a + (g.playtimeHours || 0), 0) * 10) / 10;
      const cl = gs.filter((g) => g.status === 'cleared').length;
      const wl = gs.filter((g) => g.status === 'wishlist').length;
      const coopGames = gs.filter((g) => g.coopWithUser);
      const coopHours = coopGames.reduce((a, g) => a + (g.coopHours || 0), 0);
      const rated = gs.filter((g) => g.rating > 0);
      const avg = rated.length ? Math.round(rated.reduce((a, g) => a + g.rating, 0) / rated.length * 10) / 10 : 0;
      let title = (titleCache && titleCache[c.name]) || DEFAULT_TITLES[c.name] || '';
      if (!title) {
        if (!gs.length) title = '尚未入坑的观望者';
        else if (coopGames.length >= 3) title = '联机缠人精';
        else if (hours >= 200) title = '通宵肝帝';
        else if (cl >= 3) title = '通关狂魔';
        else if (wl >= 3) title = '心愿囤积家';
        else title = '休闲游玩家';
      }
      return {
        char: c, count: gs.length, hours, cleared: cl, wishlist: wl, avg, title,
        coopCount: coopGames.length, coopHours: Math.round(coopHours * 10) / 10,
        coopScore: coopGames.length * 10 + coopHours
      };
    });

    const partners = chars.filter((c) => c.coopCount > 0).sort((a, b) => b.coopScore - a.coopScore);
    const top3 = games
      .filter((g) => (g.status === 'cleared' || g.status === 'playing' || g.status === 'dropped') && g.rating > 0)
      .sort((a, b) => b.rating - a.rating || (b.playtimeHours || 0) - (a.playtimeHours || 0))
      .slice(0, 3);

    return {
      total, cleared, started, totalHours, byStatus,
      clearRate: started ? Math.round(cleared / started * 100) : 0,
      chars, bestPartner: partners[0] || null, top3
    };
  }

  // ----------------------------------------------------------------------------
  // 8. 子组件：封面、卡带卡片
  // ----------------------------------------------------------------------------
  const GameCover = ({ game, width, height }) => {
    const [idx, setIdx] = useState(0);
    const sources = [game.coverUrl, game.bannerUrl].filter(Boolean);
    const src = sources[idx];
    const box = {
      width: width + 'px', height: height + 'px', borderRadius: '6px', flexShrink: 0, overflow: 'hidden',
      border: '2px solid #E0CBA4', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.6), 0 2px 6px rgba(120,90,50,0.2)',
      background: 'linear-gradient(160deg, #E9D5B2 0%, #D9B98A 100%)', position: 'relative'
    };
    if (!src) {
      return h('div', { style: { ...box, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '4px', padding: '4px', boxSizing: 'border-box' } },
        h('div', { style: { fontSize: '22px' } }, '🎮'),
        h('div', { style: { fontSize: '10px', fontWeight: 'bold', color: '#7A5524', textAlign: 'center', lineHeight: 1.25, wordBreak: 'break-all' } }, game.title)
      );
    }
    return h('div', { style: box },
      h('img', {
        src, alt: game.title, referrerPolicy: 'no-referrer',
        onError: () => setIdx((i) => i + 1),
        style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }
      })
    );
  };

  const GameCartridgeCard = ({ game, onEdit, onDelete, onCycleStatus }) => {
    const st = STATUS[game.status] || STATUS.playing;
    const showCoopInvite = game.status === 'wishlist' && game.coopWithUser;
    const showCoopPlaying = game.status === 'playing' && game.coopWithUser;
    const grip = 'repeating-linear-gradient(0deg, #CDB78F 0px, #CDB78F 2px, transparent 2px, transparent 6px)';

    return h('div', {
      onClick: onEdit,
      style: {
        display: 'flex', width: '100%', flexShrink: 0, position: 'relative', cursor: 'pointer', boxSizing: 'border-box',
        borderRadius: '14px 14px 8px 8px', overflow: 'hidden',
        background: 'linear-gradient(160deg, #FAF4E8 0%, #EFE3CC 100%)',
        border: '1px solid #D6B88A', boxShadow: '0 5px 14px rgba(140,100,50,0.18), inset 0 1px 0 rgba(255,255,255,0.8)'
      }
    },
      // 左侧防滑齿痕
      h('div', { style: { width: '12px', flexShrink: 0, background: grip, borderRight: '1px solid #D6B88A', opacity: 0.85 } }),
      // 卡带主体
      h('div', { style: { flex: 1, minWidth: 0, display: 'flex', gap: '10px', padding: '10px 10px 14px 10px', position: 'relative' } },
        h(GameCover, { game, width: 76, height: 102 }),
        h('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' } },
            h('span', { style: { fontSize: '8.5px', fontWeight: 'bold', letterSpacing: '0.5px', color: '#8C5E28', border: '1px solid #C9A872', borderRadius: '4px', padding: '0 4px', background: '#FFF9EC' } }, PLATFORM_LABEL[game.platform] || 'PC'),
            h('span', { style: { fontSize: '9.5px', fontWeight: 'bold', color: st.color, background: st.bg, border: `1px solid ${st.color}55`, borderRadius: '8px', padding: '0 6px' } }, `${st.icon} ${st.label}`),
            showCoopInvite && h('span', { style: { fontSize: '9px', fontWeight: 'bold', color: '#B85832', background: '#FFE9DC', border: '1px dashed #D6724B', borderRadius: '8px', padding: '0 5px' } }, '💌 邀约联机')
          ),
          h('div', { style: { fontSize: '14px', fontWeight: 'bold', color: '#3E3226', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, game.title),
          game.originalTitle && h('div', { style: { fontSize: '9.5px', color: '#A38C6D', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Georgia, serif' } }, game.originalTitle),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', color: '#7C6753' } },
            game.status !== 'wishlist' && h('span', null, `⏱ ${game.playtimeHours || 0}h`),
            game.rating > 0 && h('span', { style: { color: '#D6724B', fontWeight: 'bold' } }, `★ ${Number(game.rating).toFixed(1)}`),
            game.status === 'cleared' && game.clearedDate && h('span', null, game.clearedDate)
          ),
          h('div', {
            style: {
              fontSize: '11px', color: '#5D4A36', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical', overflow: 'hidden', background: 'rgba(255,255,255,0.55)', borderRadius: '8px', padding: '4px 7px'
            }
          }, game.comment),
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', gap: '6px' } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 } },
              game.charAvatar
                ? h('img', { src: game.charAvatar, alt: game.charName, style: { width: '15px', height: '15px', borderRadius: '50%', objectFit: 'cover' } })
                : h('div', { style: { width: '15px', height: '15px', borderRadius: '50%', background: '#D6724B', color: '#fff', fontSize: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' } }, (game.charName || '名')[0]),
              h('span', { style: { fontSize: '10px', color: '#8C5E28', fontWeight: 'bold', whiteSpace: 'nowrap' } }, game.charName)
            ),
            h('div', { style: { display: 'flex', gap: '5px' } },
              h('button', {
                onClick: (e) => { e.stopPropagation(); onCycleStatus(); },
                style: { border: '1px solid #D6B88A', background: '#FFF9EC', color: '#8C5E28', borderRadius: '8px', fontSize: '9.5px', padding: '2px 7px', cursor: 'pointer' }
              }, `换为${STATUS[NEXT_STATUS[game.status]].label}`),
              h('button', {
                onClick: (e) => { e.stopPropagation(); onDelete(); },
                style: { border: '1px solid #E5C8C0', background: '#FFF4F1', color: '#B5533C', borderRadius: '8px', fontSize: '9.5px', padding: '2px 7px', cursor: 'pointer' }
              }, '🗑')
            )
          )
        ),
        // 联机印章
        showCoopPlaying && h('div', {
          style: {
            position: 'absolute', right: '8px', top: '34px', transform: 'rotate(-10deg)', color: '#C0472B', border: '1.5px solid #C0472B',
            borderRadius: '5px', padding: '1px 5px', fontSize: '9px', fontWeight: 'bold', background: 'rgba(255,255,255,0.7)', pointerEvents: 'none'
          }
        }, `与${game.charName}联机中`),
        game.status === 'cleared' && h('div', {
          style: {
            position: 'absolute', right: '8px', top: '34px', transform: 'rotate(-12deg)', color: '#4F8A5B', border: '1.5px solid #4F8A5B',
            borderRadius: '50%', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', fontWeight: 'bold', background: 'rgba(255,255,255,0.6)', pointerEvents: 'none'
          }
        }, '通关')
      ),
      // 底部芯片触点
      h('div', { style: { position: 'absolute', left: '22px', right: '10px', bottom: 0, height: '5px', display: 'flex', gap: '3px' } },
        Array.from({ length: 18 }).map((_, i) => h('div', { key: i, style: { flex: 1, background: 'linear-gradient(180deg, #D9B86A 0%, #B8913F 100%)', borderRadius: '1px 1px 0 0' } }))
      )
    );
  };

  // ----------------------------------------------------------------------------
  // 9. 名士电竞时空罗盘弹窗
  // ----------------------------------------------------------------------------
  const GameStatsModal = ({ stats, characters, games, onClose, onToast }) => {
    const [busy, setBusy] = useState(false);
    const [titleCache, setTitleCache] = useState(loadTitlesCache());
    const live = calcStats(games, characters, titleCache);

    const handleAiTitles = async () => {
      if (busy) return;
      setBusy(true);
      try {
        const out = await generateTitlesByAI(characters, games);
        const merged = { ...titleCache, ...out };
        localStorage.setItem(TITLES_KEY, JSON.stringify(merged));
        setTitleCache(merged);
        onToast('称号已重新评选');
      } catch (e) {
        onToast('评选失败: ' + (e.message || '网络超时'));
      } finally { setBusy(false); }
    };

    const card = { background: '#FFFDF8', border: '1px solid rgba(214,168,110,0.4)', borderRadius: '14px', padding: '10px 12px', boxShadow: '0 2px 8px rgba(140,114,85,0.08)' };
    const sectionTitle = (t) => h('div', { style: { fontSize: '12px', fontWeight: 'bold', color: '#7C5832', marginBottom: '6px' } }, t);
    const avatarEl = (c, size) => c.avatar
      ? h('img', { src: c.avatar, alt: c.name, style: { width: size + 'px', height: size + 'px', borderRadius: '50%', objectFit: 'cover' } })
      : h('div', { style: { width: size + 'px', height: size + 'px', borderRadius: '50%', background: c.avatarColor || '#D6724B', color: '#fff', fontSize: (size / 2) + 'px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' } }, (c.name || '名')[0]);

    return h('div', {
      onClick: onClose,
      style: { position: 'absolute', inset: 0, zIndex: 10020, background: 'rgba(90,70,45,0.35)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }
    },
      h('div', {
        onClick: (e) => e.stopPropagation(),
        style: {
          width: '100%', maxHeight: '88%', overflowY: 'auto', boxSizing: 'border-box', padding: '14px 14px 24px',
          background: 'linear-gradient(180deg, #FBF8F2 0%, #F3EBDD 100%)', borderRadius: '22px 22px 0 0',
          display: 'flex', flexDirection: 'column', gap: '10px', WebkitOverflowScrolling: 'touch'
        }
      },
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          h('div', { style: { fontSize: '15px', fontWeight: 'bold', color: '#4A3C31' } }, '🧭 名士电竞时空罗盘'),
          h('button', { onClick: onClose, style: { border: 'none', background: 'none', fontSize: '16px', color: '#78716C', cursor: 'pointer' } }, '✕')
        ),
        // 总览
        h('div', { style: { ...card, display: 'flex', justifyContent: 'space-around', textAlign: 'center' } },
          [['藏卡总数', live.total], ['通关率', live.clearRate + '%'], ['总时长', live.totalHours + 'h']].map(([k, v]) =>
            h('div', { key: k },
              h('div', { style: { fontSize: '19px', fontWeight: 'bold', color: '#B85832' } }, v),
              h('div', { style: { fontSize: '10.5px', color: '#8C7255' } }, k)
            )
          )
        ),
        h('div', { style: { display: 'flex', gap: '6px', justifyContent: 'space-between' } },
          STATUS_ORDER.map((s) => h('div', { key: s, style: { flex: 1, textAlign: 'center', borderRadius: '10px', padding: '5px 0', background: STATUS[s].bg, border: `1px solid ${STATUS[s].color}44` } },
            h('div', { style: { fontSize: '14px', fontWeight: 'bold', color: STATUS[s].color } }, live.byStatus[s]),
            h('div', { style: { fontSize: '10px', color: STATUS[s].color } }, `${STATUS[s].icon}${STATUS[s].label}`)
          ))
        ),
        // 最佳搭子
        h('div', { style: card },
          sectionTitle('🤝 广陵最佳联机搭子'),
          live.bestPartner
            ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
              avatarEl(live.bestPartner.char, 40),
              h('div', null,
                h('div', { style: { fontSize: '14px', fontWeight: 'bold', color: '#B85832' } }, live.bestPartner.char.name),
                h('div', { style: { fontSize: '11px', color: '#7C6753' } }, `联机 ${live.bestPartner.coopCount} 款 · 共 ${live.bestPartner.coopHours} 小时`)
              )
            )
            : h('div', { style: { fontSize: '11.5px', color: '#A38C6D' } }, '暂无联机记录，让名士点游后就会评出搭子啦～')
        ),
        // 名士称号榜
        h('div', { style: card },
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' } },
            h('div', { style: { fontSize: '12px', fontWeight: 'bold', color: '#7C5832' } }, '🎖️ 名士游戏人设称号'),
            h('button', {
              onClick: handleAiTitles, disabled: busy || !games.length,
              style: { border: '1px solid #D6B88A', background: '#FFF9EC', color: '#8C5E28', borderRadius: '10px', fontSize: '10px', padding: '2px 8px', cursor: (busy || !games.length) ? 'not-allowed' : 'pointer', opacity: (busy || !games.length) ? 0.5 : 1 }
            }, busy ? '评选中...' : '✨ AI 重新评选')
          ),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
            live.chars.map((c) => h('div', { key: c.char.id || c.char.name, style: { display: 'flex', alignItems: 'center', gap: '8px' } },
              avatarEl(c.char, 30),
              h('div', { style: { flex: 1, minWidth: 0 } },
                h('div', { style: { fontSize: '12px', fontWeight: 'bold', color: '#4A3C31' } }, c.char.name,
                  h('span', { style: { marginLeft: '6px', fontSize: '10.5px', color: '#D6724B' } }, `「${c.title}」`)
                ),
                h('div', { style: { fontSize: '10px', color: '#8C7255' } }, `${c.count} 款 · ${c.hours}h · 通关 ${c.cleared}${c.avg ? ' · 均分 ' + c.avg : ''}`)
              )
            ))
          )
        ),
        // TOP3
        h('div', { style: card },
          sectionTitle('🏅 名士高分神作榜 TOP 3'),
          live.top3.length === 0
            ? h('div', { style: { fontSize: '11.5px', color: '#A38C6D' } }, '暂无已评分的游戏')
            : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
              live.top3.map((g, i) => h('div', { key: g.id, style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                h('div', { style: { width: '18px', fontSize: '15px', fontWeight: 'bold', color: i === 0 ? '#D6A21F' : '#A38C6D', textAlign: 'center' } }, i + 1),
                h(GameCover, { game: g, width: 34, height: 46 }),
                h('div', { style: { flex: 1, minWidth: 0 } },
                  h('div', { style: { fontSize: '12.5px', fontWeight: 'bold', color: '#3E3226', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, g.title),
                  h('div', { style: { fontSize: '10px', color: '#8C7255', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, `${g.charName}：${g.comment}`)
                ),
                h('div', { style: { fontSize: '14px', fontWeight: 'bold', color: '#D6724B' } }, Number(g.rating).toFixed(1))
              ))
            )
        )
      )
    );
  };

  // ----------------------------------------------------------------------------
  // 10. 卡带录入 / 编辑弹窗 (支持自动匹配封面与本地上传)
  // ----------------------------------------------------------------------------
  const GameEditModal = ({ initialGame, availableCharacters, onSave, onClose, onToast }) => {
    const g0 = initialGame || {};
    const [title, setTitle] = useState(g0.title || '');
    const [originalTitle, setOriginalTitle] = useState(g0.originalTitle || '');
    const [charName, setCharName] = useState(g0.charName || (availableCharacters[0] && availableCharacters[0].name) || '');
    const [platform, setPlatform] = useState(g0.platform || 'steam');
    const [status, setStatus] = useState(g0.status || 'playing');
    const [hours, setHours] = useState(g0.playtimeHours != null ? g0.playtimeHours : 0);
    const [rating, setRating] = useState(g0.rating != null ? g0.rating : 8.5);
    const [coop, setCoop] = useState(!!g0.coopWithUser);
    const [coopHours, setCoopHours] = useState(g0.coopHours || 0);
    const [coverUrl, setCoverUrl] = useState(g0.coverUrl || '');
    const [bannerUrl, setBannerUrl] = useState(g0.bannerUrl || '');
    const [comment, setComment] = useState(g0.comment || '');
    const [tags, setTags] = useState(Array.isArray(g0.tags) ? g0.tags.join(', ') : '');
    const [matching, setMatching] = useState(false);

    const lbl = { fontSize: '11px', fontWeight: 'bold', color: '#5D442A', display: 'block', marginBottom: '3px' };
    const inp = { width: '100%', padding: '8px 10px', borderRadius: '10px', border: '1px solid #D6A86E', boxSizing: 'border-box', fontSize: '12px', background: '#fff' };

    const handleMatch = async () => {
      if (!title.trim() || matching) return;
      setMatching(true);
      try {
        const r = await resolveCover(title.trim(), originalTitle.trim(), platform);
        if (r) { setCoverUrl(r.coverUrl); setBannerUrl(r.bannerUrl || ''); onToast('已匹配封面'); }
        else onToast('未找到封面，可手动上传');
      } catch (e) { onToast('匹配失败'); } finally { setMatching(false); }
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!title.trim()) { onToast('请填写游戏名'); return; }
      const ch = availableCharacters.find((c) => c.name === charName) || availableCharacters[0] || {};
      const now = Date.now();
      onSave({
        ...g0,
        id: g0.id || `game_${ch.id || 'custom'}_${now}_${Math.random().toString(36).slice(2, 6)}`,
        charId: ch.id || charName, charName: ch.name || charName, charAvatar: ch.avatar || '',
        title: title.trim(), originalTitle: originalTitle.trim(), platform, status,
        playtimeHours: status === 'wishlist' ? 0 : (Number(hours) || 0),
        rating: status === 'wishlist' ? 0 : Math.min(10, Math.max(0, Number(rating) || 0)),
        clearedDate: status === 'cleared' ? (g0.clearedDate || new Date().toISOString().slice(0, 10)) : '',
        coopWithUser: coop, coopHours: status === 'wishlist' ? 0 : (Number(coopHours) || 0),
        coverUrl, bannerUrl, comment: comment.trim(),
        tags: tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
        createdAt: g0.createdAt || now, updatedAt: now
      });
    };

    return h('div', {
      onClick: onClose,
      style: { position: 'absolute', inset: 0, zIndex: 10020, background: 'rgba(90,70,45,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px', boxSizing: 'border-box' }
    },
      h('div', {
        onClick: (e) => e.stopPropagation(),
        style: { width: '100%', maxWidth: '420px', maxHeight: '92%', overflowY: 'auto', boxSizing: 'border-box', background: '#FBF8F2', border: '1px solid #D6B88A', borderRadius: '18px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }
      },
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          h('h3', { style: { margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#2C251E' } }, g0.id ? '✏️ 编辑游戏卡带' : '➕ 手动录入卡带'),
          h('button', { onClick: onClose, style: { border: 'none', background: 'none', fontSize: '15px', cursor: 'pointer', color: '#78716C' } }, '✕')
        ),
        h('div', { style: { display: 'flex', gap: '6px' } },
          STATUS_ORDER.map((s) => h('button', {
            key: s, type: 'button', onClick: () => setStatus(s),
            style: {
              flex: 1, padding: '7px 0', borderRadius: '10px', fontSize: '11.5px', fontWeight: 'bold', cursor: 'pointer',
              border: status === s ? `2px solid ${STATUS[s].color}` : '1px solid #EBD8BF',
              background: status === s ? STATUS[s].bg : '#fff', color: status === s ? STATUS[s].color : '#78716C'
            }
          }, `${STATUS[s].icon}${STATUS[s].label}`))
        ),
        h('form', { onSubmit: handleSubmit, style: { display: 'flex', flexDirection: 'column', gap: '9px' } },
          h('div', { style: { display: 'flex', gap: '8px' } },
            h('div', { style: { flex: 1 } }, h('label', { style: lbl }, '游戏名 (中文)'),
              h('input', { type: 'text', value: title, onChange: (e) => setTitle(e.target.value), placeholder: '如：星露谷物语', style: inp })),
            h('div', { style: { flex: 1 } }, h('label', { style: lbl }, '原名 (可选)'),
              h('input', { type: 'text', value: originalTitle, onChange: (e) => setOriginalTitle(e.target.value), placeholder: 'Stardew Valley', style: inp }))
          ),
          h('div', { style: { display: 'flex', gap: '8px' } },
            h('div', { style: { flex: 1 } }, h('label', { style: lbl }, '名士'),
              h('select', { value: charName, onChange: (e) => setCharName(e.target.value), style: inp },
                availableCharacters.map((c) => h('option', { key: c.id || c.name, value: c.name }, c.name)))),
            h('div', { style: { flex: 1 } }, h('label', { style: lbl }, '平台'),
              h('select', { value: platform, onChange: (e) => setPlatform(e.target.value), style: inp },
                Object.keys(PLATFORM_LABEL).map((p) => h('option', { key: p, value: p }, PLATFORM_LABEL[p]))))
          ),
          status !== 'wishlist' && h('div', { style: { display: 'flex', gap: '8px' } },
            h('div', { style: { flex: 1 } }, h('label', { style: lbl }, '累计时长 (小时)'),
              h('input', { type: 'number', min: '0', step: '0.5', value: hours, onChange: (e) => setHours(e.target.value), style: inp })),
            h('div', { style: { flex: 1 } }, h('label', { style: lbl }, '评分 (0-10)'),
              h('input', { type: 'number', min: '0', max: '10', step: '0.1', value: rating, onChange: (e) => setRating(e.target.value), style: inp }))
          ),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            h('label', { style: { fontSize: '11.5px', color: '#5D442A', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' } },
              h('input', { type: 'checkbox', checked: coop, onChange: (e) => setCoop(e.target.checked) }),
              status === 'wishlist' ? '邀约楼主联机' : '与楼主联机过'),
            coop && status !== 'wishlist' && h('input', { type: 'number', min: '0', step: '0.5', value: coopHours, onChange: (e) => setCoopHours(e.target.value), placeholder: '联机小时', style: { ...inp, width: '100px' } })
          ),
          h('div', null, h('label', { style: lbl }, '卡带封面 (自动匹配 / 链接 / 本地上传)'),
            h('div', { style: { display: 'flex', gap: '6px' } },
              h('input', { type: 'text', value: coverUrl.startsWith('data:') ? '(已上传本地图片)' : coverUrl, readOnly: coverUrl.startsWith('data:'), onChange: (e) => setCoverUrl(e.target.value), placeholder: 'https://...', style: { ...inp, flex: 1, fontSize: '11px' } }),
              h('button', { type: 'button', onClick: handleMatch, disabled: matching, style: { padding: '8px 10px', borderRadius: '10px', border: '1px solid #D6A86E', background: '#fff', color: '#5D442A', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' } }, matching ? '匹配中' : '🔍 匹配'),
              h('label', { style: { padding: '8px 10px', borderRadius: '10px', border: '1px solid #D6A86E', background: '#fff', color: '#5D442A', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' } }, '🖼️ 上传',
                h('input', {
                  type: 'file', accept: 'image/*', style: { display: 'none' },
                  onChange: (e) => {
                    const file = e.target.files && e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => setCoverUrl(ev.target.result);
                    reader.readAsDataURL(file);
                  }
                })
              )
            )
          ),
          h('div', null, h('label', { style: lbl }, '名士评语 / 邀约短评'),
            h('textarea', { rows: 3, value: comment, onChange: (e) => setComment(e.target.value), placeholder: '写下该名士的游玩心得、吐槽或邀约...', style: inp })),
          h('div', null, h('label', { style: lbl }, '标签 (逗号隔开)'),
            h('input', { type: 'text', value: tags, onChange: (e) => setTags(e.target.value), placeholder: '动作RPG, 联机', style: inp })),
          h('button', {
            type: 'submit',
            style: { marginTop: '4px', padding: '12px', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg, #D6724B 0%, #B85832 100%)', color: '#fff', fontSize: '13.5px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(214,114,75,0.35)' }
          }, '💾 保存卡带')
        )
      )
    );
  };

  // ----------------------------------------------------------------------------
  // 11. 主模态窗口：傩·游戏 (NuoGameVaultAppModal)
  // ----------------------------------------------------------------------------
  function NuoGameVaultAppModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    const [games, setGames] = useState([]);
    const [characters, setCharacters] = useState(DEFAULT_LEAD_CHARACTERS);
    const [selectedChar, setSelectedChar] = useState(DEFAULT_LEAD_CHARACTERS[0].name); // '__all__' 表示全部
    const [currentTab, setCurrentTab] = useState('playing');
    const [isGenerating, setIsGenerating] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [editingGame, setEditingGame] = useState(null);
    const [toastMsg, setToastMsg] = useState(null);

    useEffect(() => {
      let alive = true;
      const refreshCharacters = async () => {
        try {
          const list = await loadAllConfiguredCharacters();
          if (alive && list && list.length) {
            setCharacters(list);
            setSelectedChar((prev) => (prev === '__all__' || list.some((c) => c.name === prev)) ? prev : list[0].name);
          }
        } catch (e) { console.error('刷新名士列表异常:', e); }
      };
      refreshCharacters();
      loadAllGames().then((list) => { if (alive) setGames(list); });
      window.addEventListener('reloadChats', refreshCharacters);
      return () => { alive = false; window.removeEventListener('reloadChats', refreshCharacters); };
    }, []);

    const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 2400); };

    const handleGenerate = async () => {
      if (isGenerating) return;
      if (selectedChar === '__all__') { showToast('请先在上方选择一位名士'); return; }
      const char = characters.find((c) => c.name === selectedChar) || characters[0];
      setIsGenerating(true);
      showToast(`🎮「${char.name}」正在翻找他的卡带盒...`);
      try {
        const existing = games.filter((g) => g.charName === char.name);
        const records = await generateGamesByAI(char, existing.map((g) => g.title));
        // 追加 + 去重
        const seen = new Set(existing.map((g) => normalize(g.title)));
        const fresh = records.filter((r) => {
          const k = normalize(r.title);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        if (!fresh.length) { showToast('这些游戏已经都在卡带架上啦，再点一次试试'); return; }
        await saveGames(fresh);
        setGames((prev) => [...fresh, ...prev]);
        const n = (s) => fresh.filter((g) => g.status === s).length;
        showToast(`🎉「${char.name}」入库：在玩${n('playing')} · 想玩${n('wishlist')} · 通关${n('cleared')}${n('dropped') ? ' · 封盘' + n('dropped') : ''}`);
      } catch (err) {
        console.error(err);
        showToast(`点游失败: ${err.message || '网络连接超时'}`);
      } finally { setIsGenerating(false); }
    };

    const handleSave = async (game) => {
      try {
        await saveGames([game]);
        setGames((prev) => {
          const idx = prev.findIndex((g) => g.id === game.id);
          if (idx >= 0) { const next = [...prev]; next[idx] = game; return next; }
          return [game, ...prev];
        });
        setEditingGame(null);
        showToast('卡带已保存');
      } catch (e) { showToast('保存失败'); }
    };

    const handleDelete = async (id) => {
      if (!window.confirm('确定要从卡带架上永久移除这张卡带吗？')) return;
      try {
        await deleteGameById(id);
        setGames((prev) => prev.filter((g) => g.id !== id));
        showToast('卡带已移除');
      } catch (e) { showToast('删除失败'); }
    };

    const handleCycle = async (game) => {
      const next = NEXT_STATUS[game.status];
      const updated = {
        ...game, status: next, updatedAt: Date.now(),
        clearedDate: next === 'cleared' ? (game.clearedDate || new Date().toISOString().slice(0, 10)) : '',
        rating: next === 'wishlist' ? 0 : (game.rating || 8.5),
        playtimeHours: next === 'wishlist' ? 0 : game.playtimeHours
      };
      await saveGames([updated]);
      setGames((prev) => prev.map((g) => g.id === game.id ? updated : g));
      showToast(`已转为「${STATUS[next].label}」`);
    };

    const scoped = selectedChar === '__all__' ? games : games.filter((g) => g.charName === selectedChar);
    const shelf = scoped.filter((g) => g.status === currentTab).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const overview = calcStats(scoped, characters, loadTitlesCache());
    const statsAll = calcStats(games, characters, loadTitlesCache());

    const avatarMini = (c) => c.avatar
      ? h('img', { src: c.avatar, alt: c.name, style: { width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' } })
      : h('div', { style: { width: '16px', height: '16px', borderRadius: '50%', background: c.avatarColor || '#D6724B', color: '#fff', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' } }, (c.name || '名')[0]);

    const chip = (key, label, avatar) => {
      const sel = selectedChar === key;
      return h('div', {
        key, onClick: () => setSelectedChar(key),
        style: {
          display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '14px', flexShrink: 0,
          border: sel ? '1.5px solid #D6724B' : '1px solid rgba(214,168,110,0.3)',
          background: sel ? 'linear-gradient(135deg, #FFF9F3 0%, #FCEFE6 100%)' : 'rgba(255,255,255,0.75)',
          color: sel ? '#B85832' : '#6D5947', fontSize: '11.5px', fontWeight: sel ? 'bold' : 'normal', cursor: 'pointer', whiteSpace: 'nowrap'
        }
      }, avatar, label);
    };

    const selectedLabel = selectedChar === '__all__' ? '名士' : selectedChar;

    return h('div', {
      className: 'settings-overlay open',
      style: { zIndex: 10000, background: 'linear-gradient(180deg, #FBF8F2 0%, #F5EFE6 50%, #EFE8DD 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: 'none' }
    },
      // 顶部导航栏
      h('div', {
        style: { height: '48px', padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, borderBottom: '1px solid rgba(214,168,110,0.35)', background: 'linear-gradient(135deg, #FAF7F2 0%, #F3EDE2 100%)', zIndex: 10 }
      },
        h('div', { onClick: onClose, style: { cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: '#8C5E28', fontSize: '13.5px', fontWeight: 'bold' } },
          h('span', { style: { fontSize: '18px' } }, '‹'), '桌面'),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
          h('span', { style: { fontSize: '16px' } }, '🕹️'),
          h('span', { style: { fontSize: '15.5px', fontWeight: 'bold', color: '#4A3C31', letterSpacing: '1px' } }, '傩 · 游戏')),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h('button', {
            onClick: () => setShowStats(true), title: '名士电竞时空罗盘',
            style: { background: 'linear-gradient(135deg, #FAF4E8 0%, #EFE3D0 100%)', border: '1px solid rgba(214,168,110,0.45)', color: '#8C5E28', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }
          }, '🧭'),
          h('button', {
            onClick: () => setEditingGame({ status: currentTab, charName: selectedChar === '__all__' ? undefined : selectedChar }),
            style: { background: 'linear-gradient(135deg, #D6724B 0%, #B85832 100%)', border: 'none', borderRadius: '14px', padding: '5px 10px', cursor: 'pointer', color: '#fff', fontSize: '11.5px', fontWeight: 'bold' }
          }, '➕ 录卡')
        )
      ),
      // 名士点游轮播条
      h('div', { style: { padding: '10px 14px 8px', background: 'rgba(247,241,230,0.9)', borderBottom: '1px solid rgba(214,168,110,0.25)', flexShrink: 0 } },
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' } },
          h('span', { style: { fontSize: '11.5px', fontWeight: 'bold', color: '#7C5832' } }, '🎮 名士点游 · 心境卡带'),
          h('button', {
            onClick: handleGenerate, disabled: isGenerating,
            style: { background: isGenerating ? 'rgba(214,114,75,0.4)' : 'linear-gradient(135deg, #D6724B 0%, #B85832 100%)', border: 'none', borderRadius: '12px', padding: '4px 10px', color: '#fff', fontSize: '11px', fontWeight: 'bold', cursor: isGenerating ? 'not-allowed' : 'pointer', boxShadow: '0 2px 8px rgba(214,114,75,0.35)' }
          }, isGenerating ? '⏳ 翻找中...' : `✨ 看看「${selectedLabel}」在玩什么`)
        ),
        h('div', { style: { display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px', WebkitOverflowScrolling: 'touch' } },
          chip('__all__', '全部', null),
          characters.map((c) => chip(c.name, c.name, avatarMini(c)))
        )
      ),
      // 概览条
      h('div', { style: { padding: '8px 14px 4px', flexShrink: 0 } },
        h('div', {
          onClick: () => setShowStats(true),
          style: { padding: '8px 12px', borderRadius: '12px', background: 'linear-gradient(135deg, #FAF5EB 0%, #F1E6D4 100%)', border: '1px solid rgba(214,168,110,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', boxShadow: '0 2px 8px rgba(140,114,85,0.08)' }
        },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            h('span', { style: { fontSize: '15px' } }, '🕹️'),
            h('div', { style: { display: 'flex', flexDirection: 'column' } },
              h('span', { style: { fontSize: '11px', fontWeight: 'bold', color: '#8C5E28' } }, `藏卡 ${overview.total} 款 · 累计 ${overview.totalHours} 小时`),
              h('span', { style: { fontSize: '9.5px', color: '#A38C6D' } }, `通关率 ${overview.clearRate}%${statsAll.bestPartner ? ' · 最佳搭子 ' + statsAll.bestPartner.char.name : ''}`)
            )
          ),
          h('div', { style: { padding: '2px 8px', borderRadius: '8px', background: 'rgba(214,114,75,0.12)', color: '#B85832', fontSize: '10px' } }, '罗盘 »')
        )
      ),
      // 四状态 Tab
      h('div', { style: { padding: '6px 14px', display: 'flex', gap: '6px', flexShrink: 0 } },
        STATUS_ORDER.map((s) => {
          const active = currentTab === s;
          return h('button', {
            key: s, onClick: () => setCurrentTab(s),
            style: {
              flex: 1, padding: '7px 0', borderRadius: '12px', fontWeight: 'bold', fontSize: '11.5px', cursor: 'pointer', transition: 'all 0.15s ease',
              border: active ? '1px solid rgba(214,168,110,0.35)' : '1px solid transparent',
              background: active ? '#FFFFFF' : 'rgba(238,230,218,0.6)', color: active ? STATUS[s].color : '#7C6753',
              boxShadow: active ? '0 2px 6px rgba(140,114,85,0.1)' : 'none'
            }
          }, `${STATUS[s].icon}${STATUS[s].label} (${scoped.filter((g) => g.status === s).length})`);
        })
      ),
      // 卡带架
      h('div', { style: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 14px 30px', display: 'flex', flexDirection: 'column', gap: '14px', WebkitOverflowScrolling: 'touch' } },
        shelf.length === 0
          ? h('div', {
            onClick: handleGenerate,
            style: { marginTop: '40px', padding: '30px 20px', borderRadius: '20px', border: '2px dashed rgba(214,168,110,0.45)', background: 'rgba(255,255,255,0.65)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: '8px', textAlign: 'center' }
          },
            h('div', { style: { fontSize: '32px' } }, '💾'),
            h('span', { style: { fontSize: '13.5px', fontWeight: 'bold', color: '#5D442A' } }, `「${STATUS[currentTab].label}」卡带架还是空的`),
            h('span', { style: { fontSize: '11px', color: '#8C7255' } }, '点击此处，让名士翻出他的卡带盒，批量入库')
          )
          : shelf.map((game) => h(GameCartridgeCard, {
            key: game.id, game,
            onEdit: () => setEditingGame(game),
            onDelete: () => handleDelete(game.id),
            onCycleStatus: () => handleCycle(game)
          }))
      ),
      showStats && h(GameStatsModal, { characters, games, onClose: () => setShowStats(false), onToast: showToast }),
      editingGame && h(GameEditModal, { initialGame: editingGame, availableCharacters: characters, onSave: handleSave, onClose: () => setEditingGame(null), onToast: showToast }),
      toastMsg && h('div', {
        style: { position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#FFF8E7', color: '#6B4423', border: '1px solid rgba(214,168,110,0.8)', padding: '8px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', zIndex: 10030, boxShadow: '0 4px 16px rgba(140,100,50,0.25)', maxWidth: '86%', textAlign: 'center' }
      }, toastMsg)
    );
  }

  window.NuoGameVaultAppModal = NuoGameVaultAppModal;
})(typeof window !== 'undefined' ? window : this);

