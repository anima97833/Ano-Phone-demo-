// ==============================================================================
// 代号鸢小手机 ·「傩·观影」时光放映室核心引擎 (Nuo Cinema Engine)
// 风格：民国老上海 / 胶卷放映机复古拟物
// 架构：双轨搜片 (AI主动选片+JustWatch自动检索) + 全要素人设融合 + 独立应用内生态
// ==============================================================================

(function (window) {
  const React = window.React;
  if (!React) return;
  const { useState, useEffect, useRef } = React;

  // ----------------------------------------------------------------------------
  // 1. 在线免Key影视检索引擎 (基于 JustWatch 公开反代接口)
  // ----------------------------------------------------------------------------
  const JUSTWATCH_API = 'https://imdb.iamidiotareyoutoo.com/justwatch';

  async function searchMoviesOnline(query) {
    const trimmed = (query || '').trim();
    if (!trimmed) return [];

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 9000) : null;

    try {
      const url = `${JUSTWATCH_API}?q=${encodeURIComponent(trimmed)}`;
      const res = await fetch(url, {
        method: 'GET',
        signal: controller ? controller.signal : undefined,
        headers: { Accept: 'application/json' }
      });
      if (timeoutId) clearTimeout(timeoutId);
      if (!res.ok) throw new Error('网络响应异常: ' + res.status);
      const data = await res.json();
      if (!data || !data.ok || !Array.isArray(data.description)) return [];

      return data.description.map((item, idx) => {
        let poster = '';
        if (Array.isArray(item.photo_url) && item.photo_url.length > 0) {
          poster = item.photo_url[0];
        }
        let backdrop = '';
        if (Array.isArray(item.backdrops) && item.backdrops.length > 0) {
          backdrop = item.backdrops[0];
        }
        return {
          id: item.id || `movie_${Date.now()}_${idx}`,
          title: item.title || '未知影片',
          year: typeof item.year === 'number' ? item.year : new Date().getFullYear(),
          runtimeMinutes: typeof item.runtime === 'number' ? item.runtime : 110,
          posterUrl: poster,
          backdropUrl: backdrop,
          type: item.type || 'MOVIE'
        };
      });
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      console.warn('[NuoCinema] 搜片连接中断或超时:', err);
      return [];
    }
  }

  // ----------------------------------------------------------------------------
  // 2. 初始预置票根与 IndexedDB 存储适配
  // ----------------------------------------------------------------------------
  const CINEMA_STORAGE_KEY = 't8_cinema_movies';

  function getPresetCinemaTickets() {
    const now = Date.now();
    return [
      {
        id: 'ticket_spirited_away',
        title: '千与千寻',
        originalTitle: 'Spirited Away',
        posterUrl: 'https://images.justwatch.com/poster/355163221/s592/spirited-away.jpg',
        backdropUrl: 'https://images.justwatch.com/backdrop/176258301/s1920/spirited-away.jpg',
        year: 2001,
        runtimeMinutes: 125,
        status: 'watched',
        rating: 9.8,
        watchedDate: '2026-09-18',
        comment: '朕才不会像戏中那个贪吃的蠢人一样变成猪。不过若是和你困在神隐小镇，倒也不错...握紧朕的手，不许松开。',
        tags: ['宫崎骏', '神作', '心动'],
        companionName: '刘辩',
        companionAvatar: '',
        createdAt: now - 86400000 * 5,
        updatedAt: now - 86400000 * 5
      },
      {
        id: 'ticket_interstellar',
        title: '星际穿越',
        originalTitle: 'Interstellar',
        posterUrl: 'https://images.justwatch.com/poster/8732599/s332/interstellar.jpg',
        backdropUrl: 'https://images.justwatch.com/backdrop/8732600/s1920/interstellar.jpg',
        year: 2014,
        runtimeMinutes: 169,
        status: 'watched',
        rating: 9.6,
        watchedDate: '2026-09-20',
        comment: '爱是唯一可以超越维度之物...戏中人耗费几十年跨越星系，基愿借这微光，在楼主身侧多留一刻。',
        tags: ['科幻', '宿命', '温润'],
        companionName: '袁基',
        companionAvatar: '',
        createdAt: now - 86400000 * 4,
        updatedAt: now - 86400000 * 4
      },
      {
        id: 'ticket_farewell_concubine',
        title: '霸王别姬',
        originalTitle: 'Farewell My Concubine',
        posterUrl: 'https://images.justwatch.com/poster/8730999/s332/farewell-my-concubine.jpg',
        backdropUrl: '',
        year: 1993,
        runtimeMinutes: 171,
        status: 'watched',
        rating: 9.7,
        watchedDate: '2026-09-25',
        comment: '说好是一辈子，差一年，一个月，一天，一个时辰，都不算一辈子。广陵王，江东的风很大，但本霸王会护着你。',
        tags: ['经典传奇', '一生一世', '深情'],
        companionName: '孙策',
        companionAvatar: '',
        createdAt: now - 86400000 * 3,
        updatedAt: now - 86400000 * 3
      },
      {
        id: 'ticket_parasite',
        title: '寄生虫',
        originalTitle: 'Parasite',
        posterUrl: 'https://images.justwatch.com/poster/151740924/s332/parasite.jpg',
        backdropUrl: '',
        year: 2019,
        runtimeMinutes: 132,
        status: 'wishlist',
        rating: 0,
        watchedDate: '',
        comment: '听说讲的是关于宅院地契与谋生的戏。这买房暗室的门道，倒值得一探究竟。楼主何时得空，咱们选便宜的早场票？',
        tags: ['悬疑', '买房', '精打细算'],
        companionName: '傅融',
        companionAvatar: '',
        createdAt: now - 86400000 * 2,
        updatedAt: now - 86400000 * 2
      },
      {
        id: 'ticket_pianist',
        title: '海上钢琴师',
        originalTitle: 'The Legend of 1900',
        posterUrl: 'https://images.justwatch.com/poster/8734999/s332/the-legend-of-1900.jpg',
        backdropUrl: '',
        year: 1998,
        runtimeMinutes: 165,
        status: 'wishlist',
        rating: 0,
        watchedDate: '',
        comment: '陆地太大了，他走不上去...楼主，隐鸢阁外的红尘万丈，老夫亦愿陪你驻足片刻，看看这方有限琴键上的悲欢。',
        tags: ['清冷出尘', '艺术', '知音'],
        companionName: '左慈',
        companionAvatar: '',
        createdAt: now - 86400000,
        updatedAt: now - 86400000
      },
      {
        id: 'ticket_roman_holiday',
        title: '罗马假日',
        originalTitle: 'Roman Holiday',
        posterUrl: 'https://images.justwatch.com/poster/8736111/s332/roman-holiday.jpg',
        backdropUrl: '',
        year: 1953,
        runtimeMinutes: 118,
        status: 'wishlist',
        rating: 0,
        watchedDate: '',
        comment: '公主偷跑出宫游玩一日的故事？哼，深宫里的人最懂这种滋味。广陵王，下次休沐日，不许带护卫，只许陪朕微服私访。',
        tags: ['浪漫', '心愿邀约', '微服私访'],
        companionName: '刘辩',
        companionAvatar: '',
        createdAt: now,
        updatedAt: now
      }
    ];
  }

  async function loadCinemaTickets() {
    try {
      if (typeof window.dbManager !== 'undefined') {
        const saved = await window.dbManager.get(CINEMA_STORAGE_KEY);
        if (saved) {
          const list = JSON.parse(saved);
          if (Array.isArray(list) && list.length > 0) return list;
        }
      } else {
        const local = localStorage.getItem(CINEMA_STORAGE_KEY);
        if (local) return JSON.parse(local);
      }
    } catch (e) {
      console.warn('[NuoCinema] 读取票根失败:', e);
    }
    const presets = getPresetCinemaTickets();
    await saveAllCinemaTickets(presets);
    return presets;
  }

  async function saveAllCinemaTickets(list) {
    try {
      const json = JSON.stringify(list || []);
      if (typeof window.dbManager !== 'undefined') {
        await window.dbManager.set(CINEMA_STORAGE_KEY, json);
      } else {
        localStorage.setItem(CINEMA_STORAGE_KEY, json);
      }
    } catch (e) {
      console.error('[NuoCinema] 保存票根异常:', e);
    }
  }

  function calculateCinemaStats(movies) {
    const list = movies || [];
    const watched = list.filter(m => m.status === 'watched');
    const wishlist = list.filter(m => m.status === 'wishlist');

    const totalMinutes = watched.reduce((sum, m) => sum + (Number(m.runtimeMinutes) || 0), 0);
    const totalHours = (totalMinutes / 60).toFixed(1);

    const rated = watched.filter(m => typeof m.rating === 'number' && m.rating > 0);
    const avgRating = rated.length > 0
      ? (rated.reduce((sum, m) => sum + m.rating, 0) / rated.length).toFixed(1)
      : '0.0';

    // 统计同行最频次的名士
    const companionCounts = {};
    watched.forEach(m => {
      const name = m.companionName || '独享光影';
      companionCounts[name] = (companionCounts[name] || 0) + 1;
    });
    let topCompanion = '暂无同行';
    let topCount = 0;
    Object.keys(companionCounts).forEach(name => {
      if (companionCounts[name] > topCount) {
        topCount = companionCounts[name];
        topCompanion = name;
      }
    });

    const top3 = [...watched]
      .filter(m => m.rating > 0)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3);

    return {
      totalWatched: watched.length,
      totalWishlist: wishlist.length,
      totalMinutes,
      totalHours,
      avgRating,
      topCompanion,
      topCompanionCount: topCount,
      top3
    };
  }

  // ----------------------------------------------------------------------------
  // 3. 基础名士预置档案（若传讯未初始化时的完美拟真兜底）
  // ----------------------------------------------------------------------------
  const DEFAULT_LEAD_CHARACTERS = [
    {
      name: '刘辩',
      id: 'liubian',
      mbti: 'ESFP',
      constellation: '狮子座',
      speakingStyle: '第一人称自称“朕”或自然自称，傲娇纯情、依赖楼主、霸道占有欲、口硬心软',
      personality: '天真热烈又暗藏身居深宫的苍凉，重度依赖心上人，占有欲强，害怕被丢下',
      background: '大汉少帝，自幼困于未央宫，视广陵王为生命中唯一的火光与退路。'
    },
    {
      name: '傅融',
      id: 'furong',
      mbti: 'ISTJ',
      constellation: '金牛座',
      speakingStyle: '第一人称“我”，言简意赅、时常念叨五铢钱、契税房产与开销账本，口嫌体正直',
      personality: '恪尽职守、视财如命，表面冰山理性，实则对楼主极度包容体贴，愿默默承担所有琐碎',
      background: '绣衣楼暗探兼主薄，实为前朝宗室遗孤，背负沉重债务与复兴执念，一心想在广陵买属于自己的大宅。'
    },
    {
      name: '袁基',
      id: 'yuanji',
      mbti: 'INFJ',
      constellation: '天秤座',
      speakingStyle: '第一人称“基”，自持克制、温润如玉、辞致典雅、字里行间暗藏深情与算计',
      personality: '汝南袁氏长公子，端方君子，看似春风和煦，实则心机深沉、占有欲极强，愿以自身为局守候一人',
      background: '太仆、袁氏宗族长子，在家族利益与朝堂漩涡中步步为营，唯独对楼主毫无保留。'
    },
    {
      name: '孙策',
      id: 'sunce',
      mbti: 'ESTP',
      constellation: '白羊座',
      speakingStyle: '第一人称“我”或“本霸王”，爽朗豪放、阳光炽烈、大开大合、直呼楼主“喂”或心上人昵称',
      personality: '江东小霸王，热血肆意，爱恨分明，行动派，胜负欲极强，喜欢带心上人策马吹风',
      background: '江东猛虎之子，征战四方，志在天下，满腔赤忱少年意气。'
    },
    {
      name: '左慈',
      id: 'zuoci',
      mbti: 'INTJ',
      constellation: '天蝎座',
      speakingStyle: '第一人称“老夫”或“我”，清冷超然、道骨仙风、言简意赅、充满哲思玄理',
      personality: '隐鸢阁阁主，出尘绝世，寿算不知几何，看淡沧海桑田，唯独将楼主护在心尖',
      background: '道门至尊，守护天下秘宝与天命运转，对楼主亦师亦伴亦护道人。'
    }
  ];

  // ----------------------------------------------------------------------------
  // 3.1 动态读取传讯名士通讯录与人设库全量配置
  // ----------------------------------------------------------------------------
  async function loadAllConfiguredCharacters() {
    let list = [];

    // 1. 优先从 IndexedDB chatCharacterStore 读取
    if (typeof window !== 'undefined' && window.chatCharacterStore) {
      try {
        const stored = await window.chatCharacterStore.getAll();
        if (stored && Array.isArray(stored) && stored.length > 0) {
          list = stored;
        }
      } catch (e) {
        console.warn('chatCharacterStore 获取角色失败:', e);
      }
    }

    // 2. 从 localStorage t8_chat_list 补充/回退
    try {
      const localStored = JSON.parse(localStorage.getItem('t8_chat_list') || '[]');
      if (Array.isArray(localStored) && localStored.length > 0) {
        if (list.length === 0) {
          list = localStored;
        } else {
          const existingIds = new Set(list.map(c => String(c.id || c.name)));
          const existingNames = new Set(list.map(c => c.name));
          localStored.forEach(c => {
            if (c && !existingIds.has(String(c.id || c.name)) && !existingNames.has(c.name)) {
              list.push(c);
            }
          });
        }
      }
    } catch (e) {}

    // 3. 从 window.T8_INITIAL_CHATS 回退
    if (list.length === 0 && typeof window !== 'undefined' && Array.isArray(window.T8_INITIAL_CHATS)) {
      list = window.T8_INITIAL_CHATS;
    }

    // 4. 过滤掉群聊、装扮、动态等非独立名士条目
    let valid = list.filter(c => 
      c && typeof c === 'object' && (c.name || c.nickname) &&
      !String(c.id).startsWith('group') && c.type !== 'group' && c.type !== 'decor' && c.type !== 'moments'
    );

    // 5. 从 character_settings 注入额外详细人设
    let charSettings = {};
    try {
      charSettings = JSON.parse(localStorage.getItem('character_settings') || '{}');
    } catch (e) {}

    // 6. 规整化数据模型
    let result = valid.map(c => {
      const name = String(c.name || c.nickname || '名士').trim();
      const id = c.id || name;
      const cs = charSettings[id] || charSettings[name] || {};
      const prof = c.profile || {};
      
      // 预置主角兜底模板
      const fallback = DEFAULT_LEAD_CHARACTERS.find(d => 
        d.name === name || 
        (name.includes('辩') && d.name === '刘辩') || 
        (name.includes('融') && d.name === '傅融') || 
        (name.includes('基') && d.name === '袁基') || 
        (name.includes('策') && d.name === '孙策') || 
        ((name.includes('慈') || name.includes('师尊')) && d.name === '左慈')
      ) || {};

      const avatar = c.avatar || c.avatarUrl || prof.avatar || cs.avatar || '';
      const avatarColor = c.avatarColor || prof.avatarColor || '#EAD6D6';
      const mbti = prof.mbti || c.mbti || cs.mbti || fallback.mbti || '未知';
      const constellation = prof.constellation || c.constellation || cs.constellation || fallback.constellation || '未知';
      const personality = prof.personality || c.personality || cs.personality || c.desc || fallback.personality || '性格鲜明、真挚深情';
      const speakingStyle = prof.speakingStyle || prof.style || c.speakingStyle || c.style || cs.speakingStyle || cs.style || fallback.speakingStyle || '专属说话风格口吻与口癖';
      const background = prof.background || prof.bio || c.background || cs.background || c.desc || fallback.background || '《代号鸢》名士，与广陵王在乱世风云中共守广陵。';

      return {
        id,
        name,
        avatar,
        avatarColor,
        mbti,
        constellation,
        personality,
        speakingStyle,
        background,
        raw: c
      };
    });

    if (result.length === 0) {
      return DEFAULT_LEAD_CHARACTERS;
    }

    return result;
  }


  // ----------------------------------------------------------------------------
  // 4. AI 名士全要素推片与影评思考引擎
  // ----------------------------------------------------------------------------
  async function generateMovieByAI(selectedCharOrName) {
    if (!window.sendToLLM) {
      throw new Error('未检测到大模型接口 (window.sendToLLM)');
    }

    // 1. 获取名士全息档案 (优先使用已传入的完整名士对象，否则动态调取传讯通讯录)
    let char = null;
    if (selectedCharOrName && typeof selectedCharOrName === 'object' && selectedCharOrName.name) {
      char = selectedCharOrName;
    } else {
      const allChars = await loadAllConfiguredCharacters();
      char = allChars.find(c => c.name === selectedCharOrName) || allChars[0] || DEFAULT_LEAD_CHARACTERS[0];
    }

    // 2. 获取用户身份设定
    let userName = '楼主';
    let userPersona = { name: '楼主', role: '广陵王/绣衣楼主', personality: '聪颖灵动、胸怀天下', background: '统领绣衣楼，密探天下要务' };
    try {
      const savedPersonas = JSON.parse(localStorage.getItem('user_personas') || '[]');
      const activeId = localStorage.getItem('active_persona_id');
      if (Array.isArray(savedPersonas) && savedPersonas.length > 0) {
        const found = activeId ? savedPersonas.find(p => String(p.id) === String(activeId)) : savedPersonas[0];
        if (found && found.name) {
          userPersona = {
            name: String(found.name).trim(),
            role: found.role || found.name,
            personality: found.personality || '真诚机敏',
            background: found.background || found.description || ''
          };
          userName = userPersona.name;
        }
      }
    } catch (e) { }

    // 3. 获取开启的世界书上下文
    let worldContext = '';
    try {
      if (window.getWorldBookContext) {
        worldContext = await window.getWorldBookContext();
      } else if (window.worldBookStore) {
        const data = await window.worldBookStore.getData();
        worldContext = typeof data === 'string' ? data : JSON.stringify(data);
      }
    } catch (e) { }

    const promptMessages = [
      {
        role: 'system',
        content: `你正在沉浸式扮演《代号鸢》中的名士【${char.name}】。
你正在民国胶卷复古放映室「傩·观影」中，为广陵王（${userName}）挑选一组最契合你心境、性格、彼此羁绊与MBTI的电影手账推荐。

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

【推片任务要求】：
请根据你的性格与MBTI，挑选：
1. 至少 3 部【已放映/已看】电影（status 为 "watched"）：你们两人已在放映室同席看过的经典佳作，给出你本人的真实评分（7.0~9.9）与专属第一人称观后速评。
2. 至少 3 部【待上映/想看】电影（status 为 "wishlist"）：你暗暗期待、想找由头邀约楼主同去放映室看的心愿电影，给出你极具傲娇、深情或符合人设的邀约短评（rating 为 0，watchedDate 为空）。
共计必须推荐至少 6 部真实中外知名佳片（如霸王别姬、千与千寻、大话西游、星际穿越、海上钢琴师、罗马假日、肖申克的救赎、春光乍泄、泰坦尼克号、情书、楚门的世界等，不可杜撰假片名）。

必须直接返回且只返回合法 JSON 数组（严禁任何Markdown说明文本或多余字句），格式如下：
[
  {
    "movieTitle": "电影标准中文片名",
    "originalTitle": "官方原名或英文名",
    "status": "watched",
    "rating": 9.5,
    "watchedDate": "2026-09-22",
    "comment": "你的第一人称专属观后速评（60-120字，强烈体现你的口癖、第一人称自称、深层情感、对楼主的借题发挥或傲娇吐槽）",
    "tags": ["经典传奇", "心动"]
  },
  {
    "movieTitle": "电影标准中文片名",
    "originalTitle": "官方原名或英文名",
    "status": "wishlist",
    "rating": 0,
    "watchedDate": "",
    "comment": "你的第一人称专属邀约短评（60-120字，傲娇说明为何一定要楼主陪你去看）",
    "tags": ["心愿邀约", "待同往"]
  }
]`
      },
      {
        role: 'user',
        content: `请为广陵王的【傩·观影】放映室挑选至少3部已放映电影和至少3部待上映电影，共计至少6部，请以JSON数组格式返回。`
      }
    ];

    let responseText = '';
    await new Promise((resolve, reject) => {
      window.sendToLLM(
        promptMessages,
        {},
        (fullText) => {
          responseText = fullText;
          resolve();
        },
        (err) => {
          reject(err);
        }
      );
    });

    // 智能解析 JSON (支持数组或包含 movies/list/watched/wishlist 的对象)
    let parsedList = [];
    const jsonMatch = responseText.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (!jsonMatch) throw new Error('AI 未能返回标准 JSON 结构');

    let rawData = null;
    try {
      rawData = JSON.parse(jsonMatch[0]);
    } catch (e) {
      const fixedStr = jsonMatch[0].replace(/,\s*([\]}])/g, '$1');
      rawData = JSON.parse(fixedStr);
    }

    if (Array.isArray(rawData)) {
      parsedList = rawData;
    } else if (rawData && typeof rawData === 'object') {
      if (Array.isArray(rawData.movies)) parsedList = rawData.movies;
      else if (Array.isArray(rawData.list)) parsedList = rawData.list;
      else if (Array.isArray(rawData.films)) parsedList = rawData.films;
      else {
        const fromWatched = Array.isArray(rawData.watched) ? rawData.watched.map(x => ({ ...x, status: 'watched' })) : [];
        const fromWishlist = Array.isArray(rawData.wishlist) ? rawData.wishlist.map(x => ({ ...x, status: 'wishlist' })) : [];
        parsedList = [...fromWatched, ...fromWishlist];
        if (parsedList.length === 0 && rawData.movieTitle) parsedList = [rawData];
      }
    }

    parsedList = (parsedList || []).filter(p => p && p.movieTitle);
    if (parsedList.length === 0) {
      throw new Error('未能从名士推荐中解析出有效电影');
    }

    // 并行异步调用免 Key 检索真实海报与片长
    const baseTime = Date.now();
    const newTickets = await Promise.all(parsedList.map(async (parsedItem, idx) => {
      let bestMatch = null;
      try {
        const searchResults = await searchMoviesOnline(parsedItem.movieTitle);
        if (searchResults && searchResults.length > 0) bestMatch = searchResults[0];
      } catch (e) {}

      const isWatched = parsedItem.status === 'watched';
      return {
        id: `ticket_${baseTime}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        title: parsedItem.movieTitle,
        originalTitle: parsedItem.originalTitle || (bestMatch ? bestMatch.title : parsedItem.movieTitle),
        posterUrl: (bestMatch && bestMatch.posterUrl) ? bestMatch.posterUrl : 'https://images.justwatch.com/poster/355163221/s592/spirited-away.jpg',
        backdropUrl: (bestMatch && bestMatch.backdropUrl) ? bestMatch.backdropUrl : '',
        year: (bestMatch && bestMatch.year) ? bestMatch.year : (new Date().getFullYear()),
        runtimeMinutes: (bestMatch && bestMatch.runtimeMinutes) ? bestMatch.runtimeMinutes : 115,
        status: isWatched ? 'watched' : 'wishlist',
        rating: isWatched ? (typeof parsedItem.rating === 'number' ? Math.min(10, Math.max(0, parsedItem.rating)) : 8.8) : 0,
        watchedDate: isWatched ? (parsedItem.watchedDate || new Date().toISOString().slice(0, 10)) : '',
        comment: parsedItem.comment || (isWatched ? '与君同坐暗室，戏散人未散。' : '此片甚合心意，待与君同往。'),
        tags: Array.isArray(parsedItem.tags) ? parsedItem.tags : (isWatched ? ['名士同席', '心动'] : ['心愿邀约', '待同往']),
        companionName: char.name,
        companionAvatar: char.avatar || '',
        createdAt: baseTime - idx * 1000,
        updatedAt: baseTime - idx * 1000
      };
    }));

    return newTickets;
  }

  // ----------------------------------------------------------------------------
  // 5. 子组件：实体纸质剪角打孔票根卡片 (MovieTicketCard)
  // ----------------------------------------------------------------------------
  const MovieTicketCard = ({ movie, onEdit, onDelete, onToggleStatus }) => {
    const [showMenu, setShowMenu] = useState(false);
    const isWatched = movie.status === 'watched';

    return React.createElement(
      'div',
      {
        style: {
          width: '100%',
          display: 'flex',
          flexShrink: 0,
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #FAF7F0 0%, #F4ECE1 100%)',
          boxShadow: '0 6px 18px rgba(0, 0, 0, 0.28), 0 1px 3px rgba(0,0,0,0.1)',
          position: 'relative',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          border: '1px solid rgba(214, 168, 110, 0.45)',
          boxSizing: 'border-box'
        },
        onClick: onEdit
      },
      // 顶部打孔镂空圆凹槽
      React.createElement('div', {
        style: {
          position: 'absolute',
          left: '92px',
          top: '-8px',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          backgroundColor: '#F5EFE6',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
          zIndex: 5
        }
      }),
      // 底部打孔镂空圆凹槽
      React.createElement('div', {
        style: {
          position: 'absolute',
          left: '92px',
          bottom: '-8px',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          backgroundColor: '#F5EFE6',
          boxShadow: 'inset 0 -2px 4px rgba(0,0,0,0.5)',
          zIndex: 5
        }
      }),
      // 左侧：电影海报与齿痕截面
      React.createElement(
        'div',
        {
          style: {
            width: '100px',
            padding: '10px 8px 10px 10px',
            borderRight: '1.5px dashed #D1C7B7',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            background: 'linear-gradient(135deg, #F3ECE0 0%, #E8DFC8 100%)'
          }
        },
        React.createElement(
          'div',
          {
            style: {
              width: '74px',
              height: '106px',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: '#E5DACB',
              boxShadow: '0 3px 8px rgba(0,0,0,0.25)',
              position: 'relative'
            }
          },
          movie.posterUrl
            ? React.createElement('img', {
              src: movie.posterUrl,
              alt: movie.title,
              style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }
            })
            : React.createElement(
              'div',
              {
                style: {
                  width: '100%', height: '100%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: '#8C7255', fontSize: '11px'
                }
              },
              '🎞️ 无海报'
            ),
          // 年份胶卷标贴
          movie.year > 0 && React.createElement(
            'span',
            {
              style: {
                position: 'absolute',
                top: '4px',
                left: '4px',
                background: 'rgba(74, 60, 49, 0.85)',
                color: '#8C5E28',
                fontSize: '8.5px',
                fontWeight: 'bold',
                padding: '1px 4px',
                borderRadius: '4px',
                fontFamily: 'monospace'
              }
            },
            movie.year
          )
        ),
        // 片长标识
        movie.runtimeMinutes > 0 && React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              marginTop: '5px',
              fontSize: '9.5px',
              fontWeight: 'bold',
              color: '#78716C',
              fontFamily: 'monospace'
            }
          },
          '⏱️ ' + movie.runtimeMinutes + 'm'
        )
      ),
      // 右侧：票面详细与名士手写观后感
      React.createElement(
        'div',
        {
          style: {
            flex: 1,
            padding: '10px 12px 10px 14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minWidth: 0,
            position: 'relative'
          }
        },
        // 顶部行：片名 + 英文原名 + 菜单按钮
        React.createElement(
          'div',
          null,
          React.createElement(
            'div',
            { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' } },
            React.createElement(
              'div',
              { style: { minWidth: 0, flex: 1, paddingRight: '6px' } },
              React.createElement(
                'h3',
                {
                  style: {
                    margin: 0,
                    fontSize: '14.5px',
                    fontWeight: 'bold',
                    color: '#2C251E',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }
                },
                movie.title
              ),
              movie.originalTitle && movie.originalTitle !== movie.title && React.createElement(
                'p',
                {
                  style: {
                    margin: '2px 0 0',
                    fontSize: '10px',
                    color: '#8C7E6A',
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }
                },
                movie.originalTitle
              )
            ),
            // 操作更多按钮
            React.createElement(
              'div',
              {
                onClick: (e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                },
                style: {
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#78716C',
                  fontSize: '14px',
                  cursor: 'pointer'
                }
              },
              '⋮'
            ),
            showMenu && React.createElement(
              'div',
              {
                onClick: (e) => e.stopPropagation(),
                style: {
                  position: 'absolute',
                  top: '28px',
                  right: '10px',
                  background: '#FFFFFF',
                  borderRadius: '10px',
                  boxShadow: '0 6px 18px rgba(0,0,0,0.22)',
                  padding: '4px',
                  zIndex: 30,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  border: '1px solid #E5E5E5'
                }
              },
              React.createElement(
                'button',
                {
                  onClick: () => { setShowMenu(false); onToggleStatus(); },
                  style: {
                    border: 'none', background: 'none', padding: '6px 12px', fontSize: '11px',
                    textAlign: 'left', cursor: 'pointer', color: '#44403C', whiteSpace: 'nowrap'
                  }
                },
                isWatched ? '转为「待上映」' : '转为「已放映」'
              ),
              React.createElement(
                'button',
                {
                  onClick: () => { setShowMenu(false); onEdit(); },
                  style: {
                    border: 'none', background: 'none', padding: '6px 12px', fontSize: '11px',
                    textAlign: 'left', cursor: 'pointer', color: '#44403C', whiteSpace: 'nowrap'
                  }
                },
                '✏️ 编辑票根'
              ),
              React.createElement(
                'button',
                {
                  onClick: () => { setShowMenu(false); onDelete(); },
                  style: {
                    border: 'none', background: 'none', padding: '6px 12px', fontSize: '11px',
                    textAlign: 'left', cursor: 'pointer', color: '#B91C1C', whiteSpace: 'nowrap'
                  }
                },
                '🗑️ 销毁票根'
              )
            )
          ),
          // 评分与状态行
          React.createElement(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' } },
            isWatched ? React.createElement(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: '3px', color: '#D97706', fontSize: '12.5px', fontWeight: 'bold' } },
              '★ ' + (typeof movie.rating === 'number' ? movie.rating.toFixed(1) : '8.8')
            ) : React.createElement(
              'span',
              {
                style: {
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: '6px',
                  background: 'rgba(37, 99, 235, 0.12)',
                  color: '#2563EB',
                  fontWeight: 'bold'
                }
              },
              '待放映'
            ),
            movie.watchedDate && React.createElement(
              'span',
              { style: { fontSize: '10px', color: '#A8A29E', fontFamily: 'monospace' } },
              movie.watchedDate
            )
          )
        ),
        // 中部：名士手写短评与朱砂印章
        movie.comment ? React.createElement(
          'div',
          {
            style: {
              margin: '6px 0',
              padding: '6px 8px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.65)',
              borderLeft: '2.5px solid #D6724B',
              fontSize: '11px',
              lineHeight: '1.45',
              color: '#44403C',
              fontStyle: 'normal'
            }
          },
          movie.companionName && React.createElement(
            'span',
            {
              style: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                marginRight: '6px',
                padding: '1px 5px',
                borderRadius: '4px',
                background: 'rgba(185, 28, 28, 0.12)',
                border: '1px solid rgba(185, 28, 28, 0.35)',
                color: '#B91C1C',
                fontSize: '9.5px',
                fontWeight: 'bold',
                letterSpacing: '0.5px'
              }
            },
            movie.companionAvatar ? React.createElement('img', {
              src: movie.companionAvatar,
              alt: movie.companionName,
              style: { width: '12px', height: '12px', borderRadius: '50%', objectFit: 'cover' }
            }) : null,
            movie.companionName + ' · 评'
          ),
          movie.comment
        ) : null,
        // 底部标签栏
        Array.isArray(movie.tags) && movie.tags.length > 0 && React.createElement(
          'div',
          { style: { display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' } },
          movie.tags.slice(0, 3).map((tag, i) => React.createElement(
            'span',
            {
              key: i,
              style: {
                fontSize: '9px',
                padding: '1px 6px',
                borderRadius: '6px',
                background: 'rgba(120, 113, 108, 0.12)',
                color: '#78716C',
                fontWeight: '500'
              }
            },
            '#' + tag
          ))
        )
      )
    );
  };

  // ----------------------------------------------------------------------------
  // 6. 子组件：个人观影时空盘 (MovieStatsModal - 完全复刻原版)
  // ----------------------------------------------------------------------------
  const MovieStatsModal = ({ stats, movies, onClose }) => {
    return React.createElement(
      'div',
      {
        onClick: onClose,
        style: {
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.72)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 10005,
          boxSizing: 'border-box'
        }
      },
      React.createElement(
        'div',
        {
          onClick: (e) => e.stopPropagation(),
          style: {
            width: '100%',
            maxWidth: '350px',
            background: 'linear-gradient(180deg, #FAF7F2 0%, #F4ECE1 100%)',
            borderRadius: '24px',
            padding: '20px 18px',
            boxSizing: 'border-box',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            border: '1.5px solid #D6A86E',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }
        },
        // 顶部标题
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          React.createElement(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            React.createElement('span', { style: { fontSize: '20px' } }, '📊'),
            React.createElement('h3', { style: { margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#2C251E' } }, '个人观影时空盘')
          ),
          React.createElement(
            'button',
            {
              onClick: onClose,
              style: {
                width: '28px', height: '28px', borderRadius: '50%',
                background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#78716C', fontSize: '13px'
              }
            },
            '✕'
          )
        ),
        // 四大核心数据格
        React.createElement(
          'div',
          { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } },
          React.createElement(
            'div',
            { style: { padding: '12px 10px', background: '#fff', borderRadius: '14px', border: '1px solid #EBD8BF', textAlign: 'center' } },
            React.createElement('div', { style: { fontSize: '18px', fontWeight: 'bold', color: '#D97706' } }, stats.totalWatched),
            React.createElement('div', { style: { fontSize: '10.5px', color: '#78716C', marginTop: '2px' } }, '已放映部数')
          ),
          React.createElement(
            'div',
            { style: { padding: '12px 10px', background: '#fff', borderRadius: '14px', border: '1px solid #EBD8BF', textAlign: 'center' } },
            React.createElement('div', { style: { fontSize: '18px', fontWeight: 'bold', color: '#2563EB' } }, stats.totalWishlist),
            React.createElement('div', { style: { fontSize: '10.5px', color: '#78716C', marginTop: '2px' } }, '待上映片单')
          ),
          React.createElement(
            'div',
            { style: { padding: '12px 10px', background: '#fff', borderRadius: '14px', border: '1px solid #EBD8BF', textAlign: 'center' } },
            React.createElement('div', { style: { fontSize: '18px', fontWeight: 'bold', color: '#16A34A' } }, stats.totalHours + 'h'),
            React.createElement('div', { style: { fontSize: '10.5px', color: '#78716C', marginTop: '2px' } }, '穿梭总时长')
          ),
          React.createElement(
            'div',
            { style: { padding: '12px 10px', background: '#fff', borderRadius: '14px', border: '1px solid #EBD8BF', textAlign: 'center' } },
            React.createElement('div', { style: { fontSize: '18px', fontWeight: 'bold', color: '#D6724B' } }, stats.avgRating),
            React.createElement('div', { style: { fontSize: '10.5px', color: '#78716C', marginTop: '2px' } }, '综合平均分')
          )
        ),
        // 同行羁绊榜
        React.createElement(
          'div',
          {
            style: {
              padding: '10px 14px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #FAF4E8 0%, #EFE3D0 100%)',
              border: '1px solid rgba(214, 168, 110, 0.45)',
              color: '#8C5E28',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 2px 6px rgba(140, 114, 85, 0.08)'
            }
          },
          React.createElement('span', { style: { fontSize: '12px', fontWeight: 'bold' } }, '🎭 最佳影伴'),
          React.createElement('span', { style: { fontSize: '13px', fontWeight: 'bold', color: '#5A3D1E' } }, stats.topCompanion + (stats.topCompanionCount > 0 ? ` (${stats.topCompanionCount}次)` : ''))
        ),
        // TOP 3 传世佳片金榜
        React.createElement(
          'div',
          null,
          React.createElement('div', { style: { fontSize: '12px', fontWeight: 'bold', color: '#44403C', marginBottom: '8px' } }, '🏆 评分榜 TOP 3'),
          stats.top3 && stats.top3.length > 0 ? React.createElement(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
            stats.top3.map((m, idx) => React.createElement(
              'div',
              {
                key: m.id,
                style: {
                  padding: '8px 10px',
                  background: '#fff',
                  borderRadius: '10px',
                  border: '1px solid #EBD8BF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }
              },
              React.createElement(
                'div',
                { style: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 } },
                React.createElement('span', { style: { fontSize: '12px', fontWeight: 'bold', color: idx === 0 ? '#D97706' : (idx === 1 ? '#78716C' : '#B45309') } }, '#' + (idx + 1)),
                React.createElement('span', { style: { fontSize: '12.5px', fontWeight: '600', color: '#2C251E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, m.title)
              ),
              React.createElement('span', { style: { fontSize: '12px', fontWeight: 'bold', color: '#D97706' } }, '★ ' + (Number(m.rating) || 0).toFixed(1))
            ))
          ) : React.createElement('div', { style: { fontSize: '11px', color: '#A8A29E', textAlign: 'center', padding: '10px 0' } }, '暂无已评分影片')
        )
      )
    );
  };

  // ----------------------------------------------------------------------------
  // 7. 子组件：手动录票 / 编辑弹窗 (MovieEditModal)
  // ----------------------------------------------------------------------------
  const MovieEditModal = ({ initialMovie, availableCharacters = DEFAULT_LEAD_CHARACTERS, onSave, onClose }) => {
    const chars = (availableCharacters && availableCharacters.length > 0) ? availableCharacters : DEFAULT_LEAD_CHARACTERS;
    const [title, setTitle] = useState(initialMovie?.title || '');
    const [originalTitle, setOriginalTitle] = useState(initialMovie?.originalTitle || '');
    const [posterUrl, setPosterUrl] = useState(initialMovie?.posterUrl || '');
    const [year, setYear] = useState(initialMovie?.year || new Date().getFullYear());
    const [runtimeMinutes, setRuntimeMinutes] = useState(initialMovie?.runtimeMinutes || 110);
    const [status, setStatus] = useState(initialMovie?.status || 'watched');
    const [rating, setRating] = useState(typeof initialMovie?.rating === 'number' ? initialMovie.rating : 8.5);
    const [watchedDate, setWatchedDate] = useState(initialMovie?.watchedDate || new Date().toISOString().slice(0, 10));
    const [comment, setComment] = useState(initialMovie?.comment || '');
    const [companionName, setCompanionName] = useState(initialMovie?.companionName || chars[0]?.name || '名士');
    const [tags, setTags] = useState((initialMovie?.tags || ['神作', '经典']).join(', '));

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!title.trim()) { alert('请输入影片名称！'); return; }

      const movieToSave = {
        id: initialMovie?.id || `ticket_${Date.now()}`,
        title: title.trim(),
        originalTitle: originalTitle.trim() || title.trim(),
        posterUrl: posterUrl.trim() || 'https://images.justwatch.com/poster/355163221/s592/spirited-away.jpg',
        backdropUrl: initialMovie?.backdropUrl || '',
        year: Number(year) || new Date().getFullYear(),
        runtimeMinutes: Number(runtimeMinutes) || 110,
        status,
        rating: status === 'watched' ? Number(rating) : 0,
        watchedDate: status === 'watched' ? watchedDate : '',
        comment: comment.trim(),
        companionName: companionName.trim(),
        companionAvatar: (chars.find(c => c.name === companionName.trim())?.avatar) || initialMovie?.companionAvatar || '',
        tags: tags.split(/[,， ]+/).filter(Boolean),
        createdAt: initialMovie?.createdAt || Date.now(),
        updatedAt: Date.now()
      };

      onSave(movieToSave);
    };

    return React.createElement(
      'div',
      {
        onClick: onClose,
        style: {
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.72)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          zIndex: 10006
        }
      },
      React.createElement(
        'div',
        {
          onClick: (e) => e.stopPropagation(),
          style: {
            width: '100%',
            maxHeight: '90%',
            backgroundColor: '#FAF7F2',
            borderRadius: '24px 24px 0 0',
            padding: '18px 16px 24px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.3)',
            overflowY: 'auto'
          }
        },
        // 头部
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          React.createElement('h3', { style: { margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#2C251E' } }, initialMovie?.id ? '✏️ 编辑电影票根' : '➕ 录制专属电影票根'),
          React.createElement('button', { onClick: onClose, style: { border: 'none', background: 'none', fontSize: '15px', cursor: 'pointer', color: '#78716C' } }, '✕')
        ),
        // 状态切换
        React.createElement(
          'div',
          { style: { display: 'flex', gap: '8px' } },
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: () => setStatus('watched'),
              style: {
                flex: 1, padding: '8px', borderRadius: '12px', border: status === 'watched' ? '2px solid #D97706' : '1px solid #EBD8BF',
                background: status === 'watched' ? '#FFFBEB' : '#fff', color: status === 'watched' ? '#D97706' : '#78716C',
                fontWeight: 'bold', fontSize: '12px', cursor: 'pointer'
              }
            },
            '⭐ 已放映 (看过)'
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: () => setStatus('wishlist'),
              style: {
                flex: 1, padding: '8px', borderRadius: '12px', border: status === 'wishlist' ? '2px solid #2563EB' : '1px solid #EBD8BF',
                background: status === 'wishlist' ? '#EFF6FF' : '#fff', color: status === 'wishlist' ? '#2563EB' : '#78716C',
                fontWeight: 'bold', fontSize: '12px', cursor: 'pointer'
              }
            },
            '⏳ 待上映 (想看)'
          )
        ),
        // 表单输入
        React.createElement(
          'form',
          { onSubmit: handleSubmit, style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
          React.createElement(
            'div',
            null,
            React.createElement('label', { style: { fontSize: '11px', fontWeight: 'bold', color: '#5D442A', display: 'block', marginBottom: '3px' } }, '片名 (中文)'),
            React.createElement('input', {
              type: 'text', value: title, onChange: (e) => setTitle(e.target.value), placeholder: '如：霸王别姬、星际穿越',
              style: { width: '100%', padding: '8px 10px', borderRadius: '10px', border: '1px solid #D6A86E', boxSizing: 'border-box', fontSize: '12px' }
            })
          ),
          React.createElement(
            'div',
            { style: { display: 'flex', gap: '8px' } },
            React.createElement(
              'div',
              { style: { flex: 1 } },
              React.createElement('label', { style: { fontSize: '11px', fontWeight: 'bold', color: '#5D442A', display: 'block', marginBottom: '3px' } }, '同行名士'),
              React.createElement(
                'select',
                {
                  value: companionName, onChange: (e) => setCompanionName(e.target.value),
                  style: { width: '100%', padding: '8px 10px', borderRadius: '10px', border: '1px solid #D6A86E', boxSizing: 'border-box', fontSize: '12px', background: '#fff' }
                },
                chars.map(c => React.createElement('option', { key: c.id || c.name, value: c.name }, c.name))
              )
            ),
            status === 'watched' && React.createElement(
              'div',
              { style: { width: '100px' } },
              React.createElement('label', { style: { fontSize: '11px', fontWeight: 'bold', color: '#5D442A', display: 'block', marginBottom: '3px' } }, '评分 (0-10)'),
              React.createElement('input', {
                type: 'number', step: '0.1', min: '0', max: '10', value: rating, onChange: (e) => setRating(e.target.value),
                style: { width: '100%', padding: '8px 10px', borderRadius: '10px', border: '1px solid #D6A86E', boxSizing: 'border-box', fontSize: '12px' }
              })
            )
          ),
          React.createElement(
            'div',
            null,
            React.createElement('label', { style: { fontSize: '11px', fontWeight: 'bold', color: '#5D442A', display: 'block', marginBottom: '3px' } }, '海报封面 (支持在线图片链接或本地上传)'),
            React.createElement(
              'div',
              { style: { display: 'flex', gap: '6px' } },
              React.createElement('input', {
                type: 'text', value: posterUrl, onChange: (e) => setPosterUrl(e.target.value), placeholder: 'https://...',
                style: { flex: 1, padding: '8px 10px', borderRadius: '10px', border: '1px solid #D6A86E', boxSizing: 'border-box', fontSize: '11px' }
              }),
              React.createElement(
                'label',
                {
                  style: {
                    padding: '8px 12px', borderRadius: '10px', border: '1px solid #D6A86E', background: '#fff',
                    color: '#5D442A', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap'
                  }
                },
                '🖼️ 上传',
                React.createElement('input', {
                  type: 'file', accept: 'image/*', style: { display: 'none' },
                  onChange: (e) => {
                    const file = e.target.files && e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      setPosterUrl(ev.target.result);
                    };
                    reader.readAsDataURL(file);
                  }
                })
              )
            )
          ),
          React.createElement(
            'div',
            null,
            React.createElement('label', { style: { fontSize: '11px', fontWeight: 'bold', color: '#5D442A', display: 'block', marginBottom: '3px' } }, '名士手写观后感 / 邀约短评'),
            React.createElement('textarea', {
              rows: 3, value: comment, onChange: (e) => setComment(e.target.value),
              placeholder: '写下该名士在此处的评语、借题发挥的心思或傲娇吐槽...',
              style: { width: '100%', padding: '8px 10px', borderRadius: '10px', border: '1px solid #D6A86E', boxSizing: 'border-box', fontSize: '12px' }
            })
          ),
          React.createElement(
            'div',
            null,
            React.createElement('label', { style: { fontSize: '11px', fontWeight: 'bold', color: '#5D442A', display: 'block', marginBottom: '3px' } }, '标签 (逗号隔开)'),
            React.createElement('input', {
              type: 'text', value: tags, onChange: (e) => setTags(e.target.value), placeholder: '经典, 催泪, 治愈',
              style: { width: '100%', padding: '8px 10px', borderRadius: '10px', border: '1px solid #D6A86E', boxSizing: 'border-box', fontSize: '12px' }
            })
          ),
          React.createElement(
            'button',
            {
              type: 'submit',
              style: {
                marginTop: '6px', padding: '12px', borderRadius: '14px', border: 'none',
                background: 'linear-gradient(135deg, #D6724B 0%, #B85832 100%)', color: '#fff',
                fontSize: '13.5px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(214,114,75,0.35)'
              }
            },
            '💾 签发并保存票根'
          )
        )
      )
    );
  };

  // ----------------------------------------------------------------------------
  // 8. 主模态窗口：傩·观影 (NuoCinemaAppModal)
  // ----------------------------------------------------------------------------
  function NuoCinemaAppModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    const [movies, setMovies] = useState([]);
    const [currentTab, setCurrentTab] = useState('watched'); // 'watched' | 'wishlist'
    const [characters, setCharacters] = useState(DEFAULT_LEAD_CHARACTERS);
    const [selectedCharName, setSelectedCharName] = useState(DEFAULT_LEAD_CHARACTERS[0].name);
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [editingMovie, setEditingMovie] = useState(null);
    const [toastMsg, setToastMsg] = useState(null);

    // 动态加载传讯名士与电影票据
    useEffect(() => {
      let isMounted = true;

      const refreshCharacters = async () => {
        try {
          const list = await loadAllConfiguredCharacters();
          if (isMounted && list && list.length > 0) {
            setCharacters(list);
            setSelectedCharName(prev => {
              const exists = list.some(c => c.name === prev);
              return exists ? prev : list[0].name;
            });
          }
        } catch (e) {
          console.error('刷新名士列表异常:', e);
        }
      };

      refreshCharacters();
      loadCinemaTickets().then((list) => {
        if (isMounted) setMovies(list);
      });

      // 监听传讯角色变动事件
      window.addEventListener('reloadChats', refreshCharacters);
      return () => {
        isMounted = false;
        window.removeEventListener('reloadChats', refreshCharacters);
      };
    }, []);

    const showToast = (msg) => {
      setToastMsg(msg);
      setTimeout(() => setToastMsg(null), 2400);
    };

    // 触发 AI 名士推片（批量生成至少 3 部已放映 + 3 部待上映）
    const handleTriggerAiMovie = async () => {
      if (isAiGenerating) return;
      const currentChar = characters.find(c => c.name === selectedCharName) || characters[0];
      const charName = currentChar ? currentChar.name : selectedCharName;
      setIsAiGenerating(true);
      showToast(`🎞️「${charName}」正在翻阅胶卷库，精选多部佳片...`);
      try {
        const newTickets = await generateMovieByAI(currentChar);
        if (!newTickets || newTickets.length === 0) throw new Error('未获取到推荐电影');
        const updated = [...newTickets, ...movies];
        setMovies(updated);
        await saveAllCinemaTickets(updated);
        const watchedCount = newTickets.filter(t => t.status === 'watched').length;
        const wishlistCount = newTickets.filter(t => t.status === 'wishlist').length;
        showToast(`🎉「${charName}」已推片：${watchedCount}部已放映 + ${wishlistCount}部待上映！`);
      } catch (err) {
        console.error(err);
        showToast(`推片失败: ${err.message || '网络连接超时'}`);
      } finally {
        setIsAiGenerating(false);
      }
    };

    const handleSaveMovie = async (movie) => {
      let updated;
      const existIdx = movies.findIndex(m => m.id === movie.id);
      if (existIdx >= 0) {
        updated = [...movies];
        updated[existIdx] = movie;
      } else {
        updated = [movie, ...movies];
      }
      setMovies(updated);
      await saveAllCinemaTickets(updated);
      setEditingMovie(null);
      showToast('票根已保存');
    };

    const handleDeleteMovie = async (id) => {
      if (!window.confirm('确定要从票夹中销毁此张票根吗？')) return;
      const updated = movies.filter(m => m.id !== id);
      setMovies(updated);
      await saveAllCinemaTickets(updated);
      showToast('票根已销毁');
    };

    const handleToggleStatus = async (movie) => {
      const nextStatus = movie.status === 'watched' ? 'wishlist' : 'watched';
      const updated = movies.map(m => m.id === movie.id ? { ...m, status: nextStatus } : m);
      setMovies(updated);
      await saveAllCinemaTickets(updated);
      showToast(nextStatus === 'watched' ? '已转为已放映' : '已转为待上映');
    };

    const stats = calculateCinemaStats(movies);
    const filteredMovies = movies.filter(m => m.status === currentTab);

    return React.createElement(
      'div',
      {
        className: 'settings-overlay open',
        style: {
          zIndex: 10000,
          background: 'linear-gradient(180deg, #FBF8F2 0%, #F5EFE6 50%, #EFE8DD 100%)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          userSelect: 'none'
        }
      },
      // 顶部导航栏
      React.createElement(
        'div',
        {
          style: {
            height: '48px',
            padding: '0 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            borderBottom: '1px solid rgba(214, 168, 110, 0.35)',
            background: 'linear-gradient(135deg, #FAF7F2 0%, #F3EDE2 100%)',
            backdropFilter: 'blur(10px)',
            zIndex: 10
          }
        },
        React.createElement(
          'div',
          {
            onClick: onClose,
            style: { cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: '#8C5E28', fontSize: '13.5px', fontWeight: 'bold' }
          },
          React.createElement('span', { style: { fontSize: '18px' } }, '‹'),
          '桌面'
        ),
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
          React.createElement('span', { style: { fontSize: '16px' } }, '📽️'),
          React.createElement('span', { style: { fontSize: '15.5px', fontWeight: 'bold', color: '#4A3C31', letterSpacing: '1px' } }, '傩 · 观影')
        ),
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          React.createElement(
            'button',
            {
              onClick: () => setShowStatsModal(true),
              style: {
                background: 'linear-gradient(135deg, #FAF4E8 0%, #EFE3D0 100%)', border: '1px solid rgba(214, 168, 110, 0.45)', color: '#8C5E28',
                borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px'
              },
              title: '个人观影时空盘'
            },
            '📊'
          ),
          React.createElement(
            'button',
            {
              onClick: () => setEditingMovie({ status: currentTab, rating: 8.5 }),
              style: {
                background: 'linear-gradient(135deg, #D6724B 0%, #B85832 100%)', border: 'none',
                borderRadius: '14px', padding: '5px 10px', cursor: 'pointer',
                color: '#fff', fontSize: '11.5px', fontWeight: 'bold'
              }
            },
            '➕ 录票'
          )
        )
      ),
      // 名士点影轮播条 (AI 核心入口)
      React.createElement(
        'div',
        {
          style: {
            padding: '10px 14px 8px',
            background: 'rgba(247, 241, 230, 0.9)',
            borderBottom: '1px solid rgba(214, 168, 110, 0.25)',
            flexShrink: 0
          }
        },
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' } },
          React.createElement('span', { style: { fontSize: '11.5px', fontWeight: 'bold', color: '#7C5832' } }, '🎞️ 名士点影 · 心境推片'),
          React.createElement(
            'button',
            {
              onClick: handleTriggerAiMovie,
              disabled: isAiGenerating,
              style: {
                background: isAiGenerating ? 'rgba(214, 114, 75, 0.4)' : 'linear-gradient(135deg, #D6724B 0%, #B85832 100%)',
                border: 'none',
                borderRadius: '12px',
                padding: '4px 10px',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: isAiGenerating ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(214, 114, 75, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }
            },
            isAiGenerating ? '⏳ 思考中...' : `✨ 听听「${selectedCharName}」看什么`
          )
        ),
        // 传讯名士快捷切换横向滚动条
        React.createElement(
          'div',
          { style: { display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px', WebkitOverflowScrolling: 'touch' } },
          characters.map(c => {
            const isSelected = selectedCharName === c.name;
            return React.createElement(
              'div',
              {
                key: c.id || c.name,
                onClick: () => setSelectedCharName(c.name),
                style: {
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 10px',
                  borderRadius: '14px',
                  border: isSelected ? '1.5px solid #D6724B' : '1px solid rgba(214, 168, 110, 0.3)',
                  background: isSelected ? 'linear-gradient(135deg, #FFF9F3 0%, #FCEFE6 100%)' : 'rgba(255, 255, 255, 0.75)',
                  color: isSelected ? '#B85832' : '#6D5947',
                  boxShadow: isSelected ? '0 2px 6px rgba(214, 114, 75, 0.18)' : 'none',
                  fontSize: '11.5px',
                  fontWeight: isSelected ? 'bold' : 'normal',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }
              },
              c.avatar ? React.createElement('img', {
                src: c.avatar,
                alt: c.name,
                style: { width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }
              }) : React.createElement('div', {
                style: {
                  width: '16px', height: '16px', borderRadius: '50%',
                  background: c.avatarColor || '#D6724B',
                  color: '#fff', fontSize: '9px', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
                }
              }, (c.name || '名')[0]),
              c.name
            );
          })
        )
      ),
      // 胶卷时光概览条 (点击展开时空盘)
      React.createElement(
        'div',
        { style: { padding: '8px 14px 4px', flexShrink: 0 } },
        React.createElement(
          'div',
          {
            onClick: () => setShowStatsModal(true),
            style: {
              padding: '8px 12px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #FAF5EB 0%, #F1E6D4 100%)',
              border: '1px solid rgba(214, 168, 110, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(140, 114, 85, 0.08)'
            }
          },
          React.createElement(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            React.createElement('span', { style: { fontSize: '15px' } }, '🎞️'),
            React.createElement(
              'div',
              { style: { display: 'flex', flexDirection: 'column' } },
              React.createElement('span', { style: { fontSize: '11px', fontWeight: 'bold', color: '#FDE047' } }, `已放映 ${stats.totalWatched} 部 · 穿梭 ${stats.totalHours} 小时`),
              React.createElement('span', { style: { fontSize: '9.5px', color: '#A8A29E' } }, `均分 ${stats.avgRating} · 点击查看个人观影时空盘`)
            )
          ),
          React.createElement(
            'div',
            { style: { padding: '2px 8px', borderRadius: '8px', background: 'rgba(214, 114, 75, 0.12)', color: '#B85832', fontSize: '10px' } },
            '时空盘 »'
          )
        )
      ),
      // 双 Tab 切换栏：已放映 vs 待上映
      React.createElement(
        'div',
        { style: { padding: '6px 14px', display: 'flex', gap: '8px', flexShrink: 0 } },
        React.createElement(
          'button',
          {
            onClick: () => setCurrentTab('watched'),
            style: {
              flex: 1, padding: '7px 0', borderRadius: '12px',
              border: currentTab === 'watched' ? '1px solid rgba(214, 168, 110, 0.35)' : '1px solid transparent',
              background: currentTab === 'watched' ? '#FFFFFF' : 'rgba(238, 230, 218, 0.6)',
              color: currentTab === 'watched' ? '#D6724B' : '#7C6753',
              fontWeight: 'bold', fontSize: '12px', cursor: 'pointer',
              boxShadow: currentTab === 'watched' ? '0 2px 6px rgba(140, 114, 85, 0.1)' : 'none',
              transition: 'all 0.15s ease'
            }
          },
          `⭐ 已放映 (${movies.filter(m => m.status === 'watched').length})`
        ),
        React.createElement(
          'button',
          {
            onClick: () => setCurrentTab('wishlist'),
            style: {
              flex: 1, padding: '7px 0', borderRadius: '12px',
              border: currentTab === 'wishlist' ? '1px solid rgba(214, 168, 110, 0.35)' : '1px solid transparent',
              background: currentTab === 'wishlist' ? '#FFFFFF' : 'rgba(238, 230, 218, 0.6)',
              color: currentTab === 'wishlist' ? '#2563EB' : '#7C6753',
              fontWeight: 'bold', fontSize: '12px', cursor: 'pointer',
              boxShadow: currentTab === 'wishlist' ? '0 2px 6px rgba(140, 114, 85, 0.1)' : 'none',
              transition: 'all 0.15s ease'
            }
          },
          `⏳ 待上映 (${movies.filter(m => m.status === 'wishlist').length})`
        )
      ),
      // 票根列表展示流
      React.createElement(
        'div',
        {
          style: {
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '8px 14px 30px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            WebkitOverflowScrolling: 'touch'
          }
        },
        filteredMovies.length === 0 ? React.createElement(
          'div',
          {
            onClick: handleTriggerAiMovie,
            style: {
              marginTop: '40px', padding: '30px 20px', borderRadius: '20px',
              border: '2px dashed rgba(214, 168, 110, 0.45)', background: 'rgba(255, 255, 255, 0.65)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', gap: '8px', textAlign: 'center', boxShadow: '0 2px 10px rgba(140, 114, 85, 0.05)'
            }
          },
          React.createElement('div', { style: { fontSize: '32px' } }, '🎟️'),
          React.createElement('span', { style: { fontSize: '13.5px', fontWeight: 'bold', color: '#5D442A' } }, currentTab === 'watched' ? '放映室暂无已看票根' : '暂无待上映清单'),
          React.createElement('span', { style: { fontSize: '11px', color: '#8C7255' } }, '点击此处，即刻听听名士推荐并批量精选收入票夹')
        ) : filteredMovies.map(movie => React.createElement(MovieTicketCard, {
          key: movie.id,
          movie,
          onEdit: () => setEditingMovie(movie),
          onDelete: () => handleDeleteMovie(movie.id),
          onToggleStatus: () => handleToggleStatus(movie)
        }))
      ),
      // 弹窗装配
      showStatsModal && React.createElement(MovieStatsModal, {
        stats,
        movies,
        onClose: () => setShowStatsModal(false)
      }),
      editingMovie && React.createElement(MovieEditModal, {
        initialMovie: editingMovie,
        availableCharacters: characters,
        onSave: handleSaveMovie,
        onClose: () => setEditingMovie(null)
      }),
      // 轻量 Toast 提示
      toastMsg && React.createElement(
        'div',
        {
          style: {
            position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(74, 60, 49, 0.94)', color: '#FFF8E7', border: '1px solid rgba(214, 168, 110, 0.6)',
            padding: '8px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
            zIndex: 10010, boxShadow: '0 4px 16px rgba(74, 60, 49, 0.35)', whiteSpace: 'nowrap'
          }
        },
        toastMsg
      )
    );
  }

  // 挂载到全局 window 对象
  window.loadAllCinemaCharacters = loadAllConfiguredCharacters;
  window.NuoCinemaAppModal = NuoCinemaAppModal;

})(typeof window !== 'undefined' ? window : this);

