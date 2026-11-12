/**
 * ============================================================================
 * 傩 · 云镜 (Nuo Browser & AI Cloud Mirror)
 * 轻拟物现代浅紫高级风 · 名士私密搜索足迹、AI仿真网页快照与冲浪探索
 * 
 * 核心特性：
 * 1. 深度聚合四维上下文：
 *    - 名士基础配置 (姓名、ID、MBTI、星座、语言风格、性格特点、个人背景)
 *    - 用户身份配置 (设置-身份配置库已选定的 activeUser)
 *    - 世界书设定 (设置-世界书设置中启用的条目)
 *    - 传讯近 30 条聊天记录 (chatHistoryStore / localStorage)
 * 2. 双轨仿真引擎：站内渲染 AI 拟真网页卡片与名士独家私密便签，彻底告别 iframe 跨域白屏；
 * 3. 广陵机要邮驿 (Nuo Mail)：深度读取名士自身配置、玩家身份设定、世界书与近30条聊天记录，生成5~8封大汉江湖往来密函与账单（主要、社交、推广账单）；
 * 4. 严格定宽定高的 NuoAvatar，杜绝大图撑爆布局；
 * 5. 全流程 IndexedDB + localStorage 本地持久化。
 * ============================================================================
 */

(function (global) {
  'use strict';

  const React = global.React;
  const { useState, useEffect, useRef, useMemo } = React;
  const h = React.createElement;

  // ----------------------------------------------------------------------------
  // 0. 通用高鲁棒性名士头像组件 (严格边界约束，防止大图撑破布局)
  // ----------------------------------------------------------------------------
  const NuoAvatar = ({ avatar, name = '名', color = '#8B5CF6', size = 16, style = {} }) => {
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
          console.warn('[NuoBrowser] 头像读取失败:', e);
        }
        if (isMounted) setIsFailed(true);
      };
      fetchAvatar();
      return () => { isMounted = false; };
    }, [avatar]);

    const baseStyle = {
      width: `${size}px`,
      height: `${size}px`,
      minWidth: `${size}px`,
      maxWidth: `${size}px`,
      minHeight: `${size}px`,
      maxHeight: `${size}px`,
      borderRadius: '50%',
      flexShrink: 0,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      ...style
    };

    if (imgUrl && !isFailed) {
      return h(
        'div',
        { style: baseStyle },
        h('img', {
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
        })
      );
    }

    return h(
      'div',
      {
        style: {
          ...baseStyle,
          background: color || '#8B5CF6',
          color: '#fff',
          fontSize: `${Math.max(8, Math.round(size * 0.55))}px`,
          fontWeight: 'bold',
          lineHeight: 1,
          userSelect: 'none'
        }
      },
      (name || '名')[0]
    );
  };

  // ----------------------------------------------------------------------------
  // 1. 常量与色彩风格 (轻拟物高级浅紫主题)
  // ----------------------------------------------------------------------------
  const DB_NAME = 't8_nuo_browser';
  const DB_VERSION = 3;
  const STORE_SHORTCUTS = 'shortcuts';
  const STORE_RECORDS = 'char_records';
  const STORE_HISTORY = 'char_history';
  const STORE_MAILS = 'char_mails';

  const PALETTE = [
    '#6B4E7D', '#4D7298', '#588157', '#9E2A2B',
    '#3D5A80', '#B56576', '#2A9D8F', '#8B5CF6'
  ];

  const PRESET_SHORTCUTS = [
    { id: 'sc_wiki', title: '维基百科', url: 'https://zh.wikipedia.org', letter: '维', bgColor: '#4D7298', textColor: '#FFFFFF' },
    { id: 'sc_baidu', title: '百度搜索', url: 'https://www.baidu.com', letter: '度', bgColor: '#3D5A80', textColor: '#FFFFFF' },
    { id: 'sc_bing', title: '必应搜索', url: 'https://cn.bing.com', letter: '必', bgColor: '#2A9D8F', textColor: '#FFFFFF' },
    { id: 'sc_bili', title: 'Bilibili', url: 'https://www.bilibili.com', letter: '哔', bgColor: '#B56576', textColor: '#FFFFFF' },
    { id: 'sc_github', title: 'GitHub', url: 'https://github.com', letter: 'GH', bgColor: '#6B4E7D', textColor: '#FFFFFF' },
    { id: 'sc_gov', title: '广陵公署', url: 'https://guangling.intranet/gov', letter: '公', bgColor: '#8B5CF6', textColor: '#FFFFFF' }
  ];

  // 预置主角兜底人设
  const DEFAULT_LEAD_CHARACTERS = [
    {
      id: 'furong',
      name: '傅融',
      avatarColor: '#5C6B73',
      mbti: 'ISTJ (物流师)',
      constellation: '处女座',
      personality: '严谨务实、精打细算、外冷内热、表面爱财实则极具担当',
      speakingStyle: '语调清冷平缓，习惯算账对比性价比，偶尔言不由衷的小吐槽，话少却句句在理',
      background: '绣衣楼副官，掌管广陵钱粮案牍，一心想买属于自己的宅邸'
    },
    {
      id: 'liubian',
      name: '刘辩',
      avatarColor: '#8C3A44',
      mbti: 'ENFP (竞选者)',
      constellation: '天蝎座',
      personality: '热烈偏执、深情任性、依赖感极强、渴望被全然接纳与偏爱',
      speakingStyle: '亲昵自然、喜欢带小情绪撒娇抱怨，偶尔语出惊人，对特定之人毫无防备',
      background: '曾居九五之尊，身陷乱世倾轧，视广陵王为生命中唯一的暖阳'
    },
    {
      id: 'yuanji',
      name: '袁基',
      avatarColor: '#4A6B6C',
      mbti: 'INFJ (提倡者)',
      constellation: '天秤座',
      personality: '温润如玉、谦和克制、深谋远虑、世家风骨下藏着极深沉的执念',
      speakingStyle: '儒雅文质、礼数周全、循循善诱，善用诗词茶道隐喻心意，言辞温柔却滴水不漏',
      background: '汝南袁氏长公子，太仆，表面顺从世家棋局，暗中为护一人周全谋篇布局'
    },
    {
      id: 'zuoci',
      name: '左慈',
      avatarColor: '#586A8A',
      mbti: 'INTJ (建筑师)',
      constellation: '水瓶座',
      personality: '清冷出尘、仙风道骨、看透天机却难断尘缘红线、宠溺徒儿',
      speakingStyle: '空灵淡雅，常带道家谶语或星象隐喻，看似漠不关心，实则护短至极',
      background: '天机阁阁主，隐世仙师，抚育广陵王成长，视其为长生岁月里唯一的牵挂'
    },
    {
      id: 'sunce',
      name: '孙策',
      avatarColor: '#964B38',
      mbti: 'ESTP (企业家)',
      constellation: '白羊座',
      personality: '阳光炽烈、坦荡直率、英勇无畏、热血少年将军、爱恨分明',
      speakingStyle: '爽朗大方、充满生命力与自信，喜欢直白表达喜爱，偶尔大咧咧却极其体贴',
      background: '江东小霸王，勇武盖世，驰骋沙场，向往与心爱之人并肩纵马'
    }
  ];

  // 预置名士高品质反差萌搜索记录与仿真快照
  const PRESET_CHAR_RECORDS = {
    '傅融': [
      {
        query: '相府假山倒塌房东要求全额赔偿合法吗',
        searchTime: '15分钟前',
        pageTitle: '《大汉律·官署民宅租赁修缮判例汇编》',
        sourceSite: '大汉廷尉律政智库 · 官方判例',
        snapshotSnippet: '依律，非承租人故意损毁且属于地基沉降引发之风貌损耗，应由出租方承担至少七成修复资费。若强行扣留押金，可向广陵郡丞提起复核。',
        privateNote: '把第七条抄在账本扉页，等明日房东来催，直接摊在他面前。若能省下那二十两，正好给楼主买点止咳的雪梨。'
      },
      {
        query: '哪款记账软件终身免会员费且支持多币种折算',
        searchTime: '昨夜子时',
        pageTitle: '【良心推荐】开源财务簿记系统横向测评',
        sourceSite: '精打细算指南网',
        snapshotSnippet: '经实测，本地离线单机簿记最为稳妥，不仅零附加开销，更支持自定义铜铢、金饼与粮秣平准折算公式，适合严谨账房主管。',
        privateNote: '市面上的软件动辄每月十文钱，纯属掠夺。还是自己刻竹简账簿最省钱。'
      },
      {
        query: '频繁咳嗽应炖梨还是煮枇杷叶',
        searchTime: '昨日酉时',
        pageTitle: '杏林堂：秋冬润燥化痰验方',
        sourceSite: '华佗医馆经方荟萃',
        snapshotSnippet: '干咳无痰者宜用雪梨川贝，文火慢煨两柱香；若兼有气虚乏力，辅以少许冰糖与百合最佳，切忌重油重辣。',
        privateNote: '楼主近日开会咳了好几声，还硬撑着看公文。晚上悄悄炖好温在食盒里，就说是膳房剩下的。'
      },
      {
        query: '城南旧米铺换季清仓是真打折还是掺了陈粮',
        searchTime: '前天午后',
        pageTitle: '洛阳与广陵粮市行规暗访',
        sourceSite: '市井民生调查报',
        snapshotSnippet: '换季折扣通常为新粮上市前腾仓，需细验米粒腹白与清香。若无霉味即可大量购入，置于陶坛密封可存一年。',
        privateNote: '验过了，是好粮。买了两石，省下了半个月的伙食余资。'
      },
      {
        query: '私房钱藏在什么地方既防潮又绝不会被同僚发现',
        searchTime: '三天前',
        pageTitle: '古代隐秘存金巧思十二法',
        sourceSite: '民间秘辛杂谈',
        snapshotSnippet: '最危险之处即最安全之处。梁上易惹飞贼，地底易受潮气，唯有伪装成枯燥案卷或夹于典籍书脊最为妥当。',
        privateNote: '最后还是缝在剑穗暗格里了。离自己最近才最安心。'
      }
    ],
    '刘辩': [
      {
        query: '怎么让喜欢的人整天待在自己身边不回府',
        searchTime: '半个时辰前',
        pageTitle: '恋爱心事：如何让心上人更依赖你？',
        sourceSite: '洛阳心语微澜阁',
        snapshotSnippet: '适当展现脆弱与需要，比故作坚强更能触动对方的心弦。为她准备独特的惊喜，制造只有你们二人共享的静谧时光。',
        privateNote: '她总是有那么多公文要批，绣衣楼有那么多人找她……什么时候她才能只看着我一个人。'
      },
      {
        query: '洛阳最甜最软的奶酥糕每天几点开炉',
        searchTime: '昨夜亥时',
        pageTitle: '京华食记：百年糕点坊独家指南',
        sourceSite: '洛阳饕餮周刊',
        snapshotSnippet: '城东苏记奶酥每日辰正初刻出炉第一屉，皮酥馅润，甜而不腻，常有达官显贵排长队抢购。',
        privateNote: '明天让暗卫早点去排队。她尝到甜的东西，眉头应该就不会皱那么紧了。'
      },
      {
        query: '喝过毒酒对心脉到底会有什么长期损伤',
        searchTime: '前天深夜',
        pageTitle: '本草医话：奇毒愈后调摄方略',
        sourceSite: '悬壶千金方',
        snapshotSnippet: '鸩毒虽解，余毒多滞于少阴心经，遇寒则痛，需常温养气血，忌忧思过甚与大喜大悲。',
        privateNote: '其实心口有时还是隐隐作痛……但只要握着她的手，好像就没那么难捱了。'
      },
      {
        query: '好看的首饰佩剑姑娘会更喜欢哪一个',
        searchTime: '大前天',
        pageTitle: '广陵风尚：名士淑媛赠礼指南',
        sourceSite: '风雅雅集专栏',
        snapshotSnippet: '寻常闺秀偏好明珠翠羽，而志在四方者更爱精巧短刃与灵动暗器，礼轻情意重，重在投其所好。',
        privateNote: '那我把短刃镶上最漂亮的宝石送给她，两者兼得。'
      },
      {
        query: '宫城里的金丝雀飞出去后还会记得养它的人吗',
        searchTime: '五天前',
        pageTitle: '禽鸟异闻录与性灵志',
        sourceSite: '百晓生天地志',
        snapshotSnippet: '飞鸟慕广宇，羁禽思旧林。若待以至诚至爱，即便翱翔天地，倦时亦知归处。',
        privateNote: '我知道广陵是她的天地。我愿意陪着她，做她停歇的那棵树。'
      }
    ],
    '袁基': [
      {
        query: '初次赠送贴身私密手作之物是否会显得失礼轻浮',
        searchTime: '1小时前',
        pageTitle: '《周礼·大宗伯冠婚六礼仪注详释》',
        sourceSite: '儒林雅乐通典',
        snapshotSnippet: '礼尚往来，敬在内而形于外。若两相倾心，香囊、玉佩皆可寄托相思，但需辞意谦抑，方显君子端方风度。',
        privateNote: '香囊上的鸢鸟已绣了七日，针脚略显生疏。若直接相赠，不知她会作何反应。'
      },
      {
        query: '受惊后的鸢雀怎样喂养才肯主动靠近人手',
        searchTime: '昨夜',
        pageTitle: '驯鸢杂录：灵禽习性与情愫建立',
        sourceSite: '太仆寺禽兽良鉴',
        snapshotSnippet: '鸢雀性烈通灵，切忌逼迫。当以粟谷置于掌心，静坐凝神，待其自来，日久自通人性。',
        privateNote: '她也是这般性子。若逼得紧了便会振翅飞走，唯有耐心守候，方能让她放下所有戒备。'
      },
      {
        query: '茶道中如何让茶香余韵持久而不显苦涩',
        searchTime: '昨日午后',
        pageTitle: '品茗至味：顾渚紫笋点茶火候论',
        sourceSite: '江南茶经注',
        snapshotSnippet: '水过三沸则水老，茶经重碾方得细末。注汤击拂需缓，浮沫如雪，入口先甘后润。',
        privateNote: '今日试了新焙的茶，回甘甚好。待她下次登门，当亲手烹予她品尝。'
      },
      {
        query: '世家大族宗子不得不娶门当户对女子的宗法渊源',
        searchTime: '三天前',
        pageTitle: '两汉世家谱系与联姻制度考',
        sourceSite: '史馆宗谱考录',
        snapshotSnippet: '门阀联姻旨在固势，个人情愫常被宗法裹挟。然纵观青史，亦不乏破局之人以滔天智计扭转乾坤者。',
        privateNote: '袁氏的枷锁束缚得了所有人，但束缚不了我。我的心意，只由我自己做主。'
      },
      {
        query: '安神宁心的熏香方子哪些不会令人产生依赖',
        searchTime: '四天前',
        pageTitle: '香乘：文人书斋燕居调香集',
        sourceSite: '名香谱系考',
        snapshotSnippet: '沉檀龙麝过烈，唯合欢皮、柏子仁配以春采降真香，幽雅清冽，能抚平焦躁而不夺人神志。',
        privateNote: '她夜里常被密报惊醒，配一囊放在她案几旁，或可助她安眠一整夜。'
      }
    ],
    '左慈': [
      {
        query: '近期天机星晦暗而紫微垣微动主何吉凶',
        searchTime: '破晓时分',
        pageTitle: '太史公天官书与天象推演精微',
        sourceSite: '方仙道真经藏书阁',
        snapshotSnippet: '星宿移位，变数骤生。当权者有颠沛之厄，然有贵人自东南起，挽狂澜于既倒，成败皆系于一心。',
        privateNote: '这乱世的杀劫终究还是避不开。为师不能替你挡下所有风雨，但只要你回头，阁中烛火永远为你亮着。'
      },
      {
        query: '辟谷修行之人为何在特定时刻会极度渴望甜食',
        searchTime: '昨夜子时',
        pageTitle: '抱朴子内篇：修仙饮食摄生考',
        sourceSite: '天机真隐杂记',
        snapshotSnippet: '丹道修气，凡躯虽静，心识未绝。人间百味中，甘味入脾，最易勾连往昔温存回忆，此非魔障，乃真情未泯。',
        privateNote: '分明已经辟谷数百年……为何看着她送来的酥糖，竟也会忍不住尝上一块。'
      },
      {
        query: '徒儿心性过于坚韧不肯示弱做师尊的该如何宽慰',
        searchTime: '前日申时',
        pageTitle: '名师指引：道家师徒因缘与心境疏导',
        sourceSite: '仙师坛讲义录',
        snapshotSnippet: '木强则折，水善利万物。对待要强的晚辈，不必言辞说教，只需化作温和包容之渊，容其倦怠。',
        privateNote: '小家伙从小到大受了伤从不哭喊。为师宁愿你任性胡闹一些，也胜过这般独自硬扛。'
      },
      {
        query: '长生之人与寿数有限的凡人如何安然共处',
        searchTime: '四天前',
        pageTitle: '列仙传佚卷：仙凡之恋与岁月叹',
        sourceSite: '隐世残卷校勘',
        snapshotSnippet: '山中方七日，世上已千年。长生者常惧送别，然若能珍惜当下朝夕，一瞬亦可胜过虚妄万载。',
        privateNote: '万载岁月不过弹指一挥。但只要与你相伴的光阴，哪怕只有数十载，亦足以慰藉平生。'
      },
      {
        query: '观星盘破损了该用什么材质的晶石修补',
        searchTime: '六天前',
        pageTitle: '玄门法器炼制通宝要诀',
        sourceSite: '炼器秘要图录',
        snapshotSnippet: '天玑盘需以东海深潭玄冰晶打磨，引北斗辰光浸润三月，方能重新沟通周天星斗。',
        privateNote: '那日她拿去把玩不小心磕裂了边角，见她慌乱，为师只道无妨。修补好便是。'
      }
    ],
    '孙策': [
      {
        query: '江东哪个水域野钓大青鱼绝不空军',
        searchTime: '20分钟前',
        pageTitle: '【江东钓鱼佬必看】长江沿岸神仙钓位大公开',
        sourceSite: '水乡渔乐志',
        snapshotSnippet: '采石矶下回水湾处，水深流缓，水草丰美，底栖巨青极多，挂嫩玉米或螺蛳必连竿狂拉！',
        privateNote: '下回打完仗回广陵，一定要拖着她去钓鱼！烤鱼的味道我亲自调，肯定比相府那冰块副官做的强！'
      },
      {
        query: '送喜欢的姑娘短刃还是名马比较讨喜',
        searchTime: '昨夜',
        pageTitle: '直男武将送礼避坑指南',
        sourceSite: '大汉军营英雄榜',
        snapshotSnippet: '宝马配英雄，但姑娘更看重贴心与长久陪伴。送一柄能护身的百炼短匕，再教她两招防身枪法，心意立显。',
        privateNote: '我新得的乌金匕首轻便又锋利，已经让人打磨好了。下次见面就塞进她手里！'
      },
      {
        query: '怎么一招制服广陵王身边那个冷脸算账的副官',
        searchTime: '前天午后',
        pageTitle: '近身搏击三十六式与步战技巧',
        sourceSite: '江东水师演武典',
        snapshotSnippet: '面对下盘稳固、防守严密的对手，切忌硬拼正面，当以迅雷之势切入侧翼，夺其重心即可。',
        privateNote: '那家伙每次见到我都摆着一张臭脸，还防贼似的挡在她前头。真想找机会跟他好好‘切磋’一番！'
      },
      {
        query: '姑娘受了委屈不肯说该怎么哄她开心',
        searchTime: '三天前',
        pageTitle: '少年心事：哄人开心的十种热血方式',
        sourceSite: '江东子弟热血周报',
        snapshotSnippet: '不必长篇大论打听原由，直接带她纵马吹风、登高望远，痛痛快快大笑一场，阴霾自然烟消云散！',
        privateNote: '谁敢给她气受，小爷提枪掀了他的老巢！不管怎样，有我在，没人能欺负她！'
      },
      {
        query: '扬州城最近新开的酒楼哪家烧鹅最香脆',
        searchTime: '五天前',
        pageTitle: '淮扬名菜谱：金牌脆皮烧鹅探店',
        sourceSite: '江南食客录',
        snapshotSnippet: '城北张记选用散养麻鹅，炭火慢烤，皮脆肉嫩，蘸以特调酸梅酱，入口唇齿生香。',
        privateNote: '记下来了，等她来江东，我包下整座酒楼请她吃个痛快！'
      }
    ]
  };

  // ----------------------------------------------------------------------------
  // Nuo Mail 名士预置高品质往来密函与账单数据
  // ----------------------------------------------------------------------------
  const PRESET_CHAR_MAILS = {
    '傅融': [
      {
        category: 'primary',
        senderName: '广陵王',
        senderAddress: 'wang@xiuyilou.gov',
        subject: '关于公署假山与雪梨膏的批复',
        dateStr: '11月10日',
        previewText: '傅副官亲启：修缮银两已着户曹拨付，不必再同房东争执...',
        fullContent: '傅副官如面：\n\n昨日公文已阅。断无扣你月钱之理，切莫再为此事彻夜看律法案卷。\n西市买来的雪梨膏记得每日温水冲服，夜里咳嗽切忌强撑。\n\n广陵王 手书',
        privateMemo: '楼主手头本就不宽裕，改日我还是亲自去房东那再磨一磨，能省二两是二两。',
        attachmentName: '雪梨膏说明.pdf'
      },
      {
        category: 'primary',
        senderName: '大汉相府户曹',
        senderAddress: 'hucao@xiangfu.gov',
        subject: '【公函】广陵驻点年度财务账册预审通告',
        dateStr: '11月9日',
        previewText: '致广陵王府傅融副官：本季各郡账目核验在即，请于下月初一前送交...',
        fullContent: '傅融副官台鉴：\n\n大汉相府户曹查验天下赋税与官司开支。贵署上季修缮、粮草与密探折损款目尚有三处细节需复核印信，望如期呈缴。\n\n大汉相府户曹 印',
        privateMemo: '年年查账，每一笔我都核对了三遍，挑不出毛病的。',
        attachmentName: '对账表.xlsx'
      },
      {
        category: 'social',
        senderName: '前绣衣楼密探',
        senderAddress: 'agent@guangling.org',
        subject: '【故人来信】洛阳城南旧暗桩折损账本手录',
        dateStr: '11月8日',
        previewText: '傅长官：洛阳近来盘查甚严，旧暗桩补贴已发，附上收据明细...',
        fullContent: '傅长官：\n\n承蒙你暗中打点，兄弟们皆已安顿。洛阳城南的旧茶摊虽拆了，但大家伙儿心里都记着你的照拂。随信附上折损账目，分文未敢多领。\n\n旧部 敬上',
        privateMemo: '账目倒是记得清楚，这笔钱先替他留着吧，往后要是想置产成家还用得上。',
        attachmentName: ''
      },
      {
        category: 'promotions',
        senderName: '城东王记鲜蔬',
        senderAddress: 'laowang@veg.com',
        subject: '【立冬特惠】秋末大白菜量大从优，买三送一包送到门！',
        dateStr: '11月7日',
        previewText: '尊敬的大管家：小店新到上等霜打白菜两百斤，清脆甘甜...',
        fullContent: '傅长官尊鉴：\n\n知晓您平日里最持家有道！特给老主顾送来特惠传单：秋末老白菜量大从优，十文钱三棵，买五送二还包送到府门前！\n\n城东王记 启',
        privateMemo: '十文钱三棵还包送？便宜！明日去订一百斤，府里腌酸菜够吃一冬。',
        attachmentName: ''
      },
      {
        category: 'promotions',
        senderName: '广陵钱庄通商号',
        senderAddress: 'bank@guangling.fin',
        subject: '【对账单】个人结余银票利息已入账提醒',
        dateStr: '11月5日',
        previewText: '尊敬的贵宾傅融：截至本月朔日，您存入的保本生息银票已计息完毕...',
        fullContent: '尊敬的客户：\n\n五年期积善置业存单已计入本期利息银一两二钱三分。当前总本息已妥善入库保管，凭印信随时可支取。\n\n广陵通商钱庄 谨启',
        privateMemo: '一两二钱三分！离在广陵城北买一座带小院的宅子又近了一步。',
        attachmentName: '月度流水.pdf'
      }
    ],
    '张飞': [
      {
        category: 'primary',
        senderName: '广陵王',
        senderAddress: 'wang@xiuyilou.gov',
        subject: '给张将军：新裁火狐皮领大氅已收到，附回赠雪梨膏',
        dateStr: '11月10日',
        previewText: '翼德亲启：昨夜冒雪送来的火狐皮领甚暖，军中事务虽繁，也需顾念身子...',
        fullContent: '翼德亲启：\n\n昨夜冒雪送来的火狐皮领大氅针脚细密，甚是暖和，我很喜欢。军中防务虽紧，切莫再趁夜巡营贪凉。\n听闻你近日偶有咳疾，随信附上广陵特产雪梨膏，每日命亲兵温水化开。\n\n广陵王 手书',
        privateMemo: '楼主喜欢就好！俺特地让挑的最整齐的一张皮子。雪梨膏甜丝丝的，比俺平日喝的苦药强百倍。',
        attachmentName: '回执.png'
      },
      {
        category: 'primary',
        senderName: '幽州刘备兄长',
        senderAddress: 'liubei@yuzhou.gov',
        subject: '【家书】三弟切莫贪杯，广陵行事需多加体察楼主心意',
        dateStr: '11月8日',
        previewText: '三弟见信如面：闻汝驻守广陵，切戒暴怒与酗酒，军政重任在肩...',
        fullContent: '三弟见信如面：\n\n闻汝在广陵协助楼主，愚兄甚慰。然汝性急好饮，广陵乃四战重地，暗流涌动，切莫因酒误事。\n遇事多与楼主商议，切勿鲁莽动武。\n\n兄 玄德 书',
        privateMemo: '大哥又来念叨俺戒酒……俺最近真没多喝，顶多三两巡营暖身子！',
        attachmentName: ''
      },
      {
        category: 'social',
        senderName: '幽州塞外故交',
        senderAddress: 'comrade@youzhou.mil',
        subject: '【塞外来信】托商队捎去两坛塞外烧刀子与烈马鞍鞯',
        dateStr: '11月6日',
        previewText: '张将军：塞北草枯鹰健，兄弟们在关外弄到两匹乌骓纯种马与烧刀子...',
        fullContent: '翼德将军虎鉴：\n\n阔别多日！关外入冬早，商队南下广陵，特托掌柜带去塞北正宗烧刀子两大坛，还有老马匠亲手揉的熟牛皮鞍鞯！\n改日凯旋，定要与将军喝个痛快！\n\n关外老卒 敬上',
        privateMemo: '好烈酒！先藏在营帐后头，可别让楼主和军师瞧见了。',
        attachmentName: ''
      },
      {
        category: 'promotions',
        senderName: '大汉军械兵工坊',
        senderAddress: 'smith@hanarmory.gov',
        subject: '【会员专享】丈八蛇矛防潮除锈特调桐油半价特惠',
        dateStr: '11月4日',
        previewText: '尊敬的将军客户：江南多潮润，精钢长矛易生暗锈，本坊特调防潮桐油...',
        fullContent: '大将尊鉴：\n\n江南湿润易蚀铁兵，兵工坊新推“龙鳞防锈透光桐油”，涂抹一次保半年寒光逼人！凭此函可享半价优惠，送擦矛细鹿皮一张！\n\n军工坊掌墨师 呈',
        privateMemo: '俺的蛇矛确实得擦了，这桐油买上五桶，连弟兄们的佩刀一起抹了。',
        attachmentName: '保养说明.pdf'
      },
      {
        category: 'promotions',
        senderName: '城西三碗不过冈刘记酒肆',
        senderAddress: 'liu_tavern@market.com',
        subject: '【账目催结】本月赊欠雕花春酒两千三百文结清提醒',
        dateStr: '11月2日',
        previewText: '尊敬的张爷：小店本小利微，月底盘点在即，敬请得空拨冗结清...',
        fullContent: '张将军大驾：\n\n承蒙将军多次光顾小店！本月军士巡夜打酒共赊欠雕花春四坛、酱牛肉二十斤，计钱两千三百文。月底打烊盘账，望将军见谅！\n\n刘掌柜 谨拜',
        privateMemo: '哎呀！上回赢了赌马请弟兄们吃肉，竟忘了给钱。明日带够碎银赶紧结了，免得掌柜找到楼主那告状。',
        attachmentName: '欠条存根.jpg'
      }
    ],
    '孙策': [
      {
        category: 'primary',
        senderName: '广陵王',
        senderAddress: 'wang@xiuyilou.gov',
        subject: '江东防务与两地密讯对接备忘录',
        dateStr: '11月10日',
        previewText: '伯符亲启：沿江岗哨调配已妥，切记水战重在风信，勿争一时之勇...',
        fullContent: '伯符亲启：\n\n江防各处快报已悉。入冬江风冷烈，虽知你水性与武略冠绝三军，亦切忌单骑探哨。\n广陵已在渡口设暗哨三处为你呼应，遇事切勿莽进。\n\n广陵王 手书',
        privateMemo: '她总是担心我单枪匹马涉险……不过有她在后方盯着渡口，我打起仗来更踏实了！',
        attachmentName: '江防要图.pdf'
      },
      {
        category: 'primary',
        senderName: '吴夫人与周瑜',
        senderAddress: 'zhouyu@dongwu.gov',
        subject: '公瑾手书：伯符行事切莫莽撞，切勿惊扰绣衣楼',
        dateStr: '11月8日',
        previewText: '兄长台鉴：广陵乃多方耳目聚焦之地，楼主心思机敏，万不可鲁莽行事...',
        fullContent: '伯符吾兄：\n\n广陵局势瞬息万变，朝堂与江东宿怨未解，楼主处境亦难。你在广陵务必谨言慎行，多听楼主谋划，休要凡事提枪便上！\n母上近来安康，勿念。\n\n弟 周瑜 顿首',
        privateMemo: '公瑾又来长篇大论教训我！我分明很听她的话好不好。',
        attachmentName: ''
      },
      {
        category: 'social',
        senderName: '太史慈',
        senderAddress: 'taishici@dongwu.mil',
        subject: '【战友邀约】改日江边比试长枪，输者请吃烤全鹅',
        dateStr: '11月6日',
        previewText: '少将军：营中新打磨了一杆玄铁透甲枪，江边芦苇荡见！',
        fullContent: '伯符将军：\n\n军营枯燥，闻听你近日枪法大进。改日风和日丽，江畔比试五十合，输者请全军吃城北张记脆皮烤鹅！\n敢不敢来？\n\n太史慈 拜',
        privateMemo: '子义这家伙真是哪壶不开提哪壶，比就比，这次定让他输得心服口服！',
        attachmentName: ''
      },
      {
        category: 'promotions',
        senderName: '江东渔具行',
        senderAddress: 'fishing@jiangdong.biz',
        subject: '【新品画册】特级蚕丝野钓线与极品海竿春季画册',
        dateStr: '11月4日',
        previewText: '少将军亲启：新到太湖野钓大鱼竿，拉力百斤不断，专为霸王设计...',
        fullContent: '少主尊前：\n\n小行新进波斯精炼蚕丝线，柔韧坚固；另有特制紫竹钓竿，专钓江中几十斤的大青鱼！特呈上新品画册一卷！\n\n江东渔具坊 呈',
        privateMemo: '这竿子看着带劲！等得空了带她去江边钓鱼，烤了给她尝鲜。',
        attachmentName: '渔具图册.pdf'
      },
      {
        category: 'promotions',
        senderName: '扬州百晓生',
        senderAddress: 'baixiaosheng@news.han',
        subject: '【最新刊登】本期江东少年英雄英武榜：孙策位列榜首！',
        dateStr: '11月1日',
        previewText: '百晓生快讯：本月少年名将风云录已发售，江东小霸王威震淮扬...',
        fullContent: '扬州群英快览：\n\n本期《江东英武志》孙策将军勇冠江淮，位居榜首！全城茶肆热销，特赠名将精装珍藏拓印本一本！\n\n扬州百晓阁 谨奉',
        privateMemo: '榜首？哈哈！一会儿拿去给她显摆显摆，看她还笑不笑我幼稚。',
        attachmentName: '百晓排名.png'
      }
    ],
    '袁基': [
      {
        category: 'primary',
        senderName: '广陵王',
        senderAddress: 'wang@xiuyilou.gov',
        subject: '关于回赠茶礼与春社雅集参订的私函',
        dateStr: '11月10日',
        previewText: '长公子亲启：日前送至绣衣楼的谷雨云雾茶已品过，清甜回甘...',
        fullContent: '长公子如面：\n\n日前送来的谷雨云雾甚是甘醇，近来公牍繁复，烹茶小憩颇慰风尘。\n朝中近来若有变动，望公子万事保全自身为上。春社之约，定当践诺。\n\n广陵王 谨覆',
        privateMemo: '她喜这茶便好。朝中那些明枪暗箭，我自会替她料理干净，绝不教惊扰到她。',
        attachmentName: '回礼清单.pdf'
      },
      {
        category: 'primary',
        senderName: '汝南袁氏宗族',
        senderAddress: 'clan@yuanshi.org',
        subject: '【宗族密报】朝堂风向变动，家族门生安置事宜简报',
        dateStr: '11月8日',
        previewText: '长公子台鉴：司空府与相府近日对广陵粮道颇有微词，族中长老请示...',
        fullContent: '长公子钧鉴：\n\n族中门生三十余人待选官职，相府暗中有掣肘之意。且近日有流言称广陵暗通江淮，长老望公子借太仆之权尽早敲定布局。\n\n袁氏宗族执事 叩禀',
        privateMemo: '那些老家伙成日只盯着权势争竞，若敢打广陵的主意，便休怪我不念同族之情。',
        attachmentName: '门生名册.xlsx'
      },
      {
        category: 'social',
        senderName: '太学名士友人',
        senderAddress: 'scholar@taixue.edu',
        subject: '【拜帖】清谈雅集品茗论道邀请拜帖',
        dateStr: '11月5日',
        previewText: '袁太仆尊前：洛阳太学诸生欲于下浣举办曲水流觞雅集，恭候大驾...',
        fullContent: '袁公台鉴：\n\n京华秋意渐深，诸子拟于西园行曲水之引，共论《易》理与乐府旧辞。素仰先生高风，谨具名帖，伏惟垂赏光降！\n\n太学学士 谨拜',
        privateMemo: '文人虚礼，去之无益。倒不如省下半日闲暇，为她挑几样时新果盒。',
        attachmentName: ''
      },
      {
        category: 'promotions',
        senderName: '天宝阁拍卖行',
        senderAddress: 'tianbao@auction.biz',
        subject: '【珍藏图录】孤本《广陵散》残卷与前朝古玉春拍图录',
        dateStr: '11月3日',
        previewText: '尊敬的贵宾袁长公子：本次春拍专场将呈献绝世古琴残谱与和阗暖玉...',
        fullContent: '太仆尊鉴：\n\n天宝阁有幸征集得蔡中郎旧藏琴谱残卷二折，以及温润前朝古玉双螭佩。知公子雅好博古，特先期呈递绝密图录供审！\n\n天宝阁奉茶执事 谨呈',
        privateMemo: '前朝古玉温润，正合她体质；琴谱亦可一览。命管事全数拍下吧。',
        attachmentName: '春拍图谱.pdf'
      },
      {
        category: 'promotions',
        senderName: '珍禽阁',
        senderAddress: 'birds@rarepet.com',
        subject: '【到货通知】极品灵雀特级坚果谷物配方到货通知',
        dateStr: '11月1日',
        previewText: '长公子台前：您订购的南中野果碎与雪山红豆精料已由镖局护送抵京...',
        fullContent: '袁长公子尊前：\n\n府上养护灵鸟所需的精配谷料已送抵东院偏厅。此批皆为今年头道新粮，清香无杂，灵雀定然开怀。\n\n珍禽阁大掌柜 拜上',
        privateMemo: '小雀近日换毛胃口欠佳，换了新料，想来能欢腾些。',
        attachmentName: ''
      }
    ],
    '左慈': [
      {
        category: 'primary',
        senderName: '广陵王',
        senderAddress: 'wang@xiuyilou.gov',
        subject: '师尊亲启：徒儿近日身子已大好，切莫再寄苦药',
        dateStr: '11月10日',
        previewText: '师尊安好：上次送来的安神丸已按时服下，咳嗽早止了，只是方子太苦...',
        fullContent: '师尊亲启：\n\n广陵诸事粗安。上次仙童送来的安神药丸已按时服下，身子早已无碍，师尊切莫再费心炼丹伤神。\n山中天寒，望师尊多添炭火，徒儿得闲便回天机阁看望您。\n\n徒儿 谨启',
        privateMemo: '总是嫌苦……下次还是在药蜜里多裹两层糖霜吧。她平素操劳，若不看着，又不知如何委屈自己。',
        attachmentName: ''
      },
      {
        category: 'primary',
        senderName: '方仙道长生阁',
        senderAddress: 'celestial@tianji.org',
        subject: '【天机秘录】本季星象晦明变化与九宫天机推演报录',
        dateStr: '11月7日',
        previewText: '阁主法鉴：紫微垣近来星芒微摇，东南分野似有暗星冲煞...',
        fullContent: '左慈仙师座前：\n\n天机阁星官谨报：紫微与七杀星宿交错，东南广陵一带机运玄微，天象所示死生难辨。敢问阁主是否起卦推演？\n\n天机阁执事道童 稽首',
        privateMemo: '天道纷纭，何足道哉。只要她平安，便是逆天改命，又待如何。',
        attachmentName: '星图演变.pdf'
      },
      {
        category: 'social',
        senderName: '终南山隐世仙友',
        senderAddress: 'immortal@zhongnan.tao',
        subject: '【问道书】终南山新辟灵药圃，邀仙友共论丹道',
        dateStr: '11月5日',
        previewText: '元放道兄仙鉴：昔年共探丹经，转瞬又经甲子。今山中新植九叶芝草...',
        fullContent: '道兄如晤：\n\n尘世碌碌，唯长生大道长存。弟于终南深谷得九叶灵芝幼苗，特邀道兄赴谷烹泉煮雪，再续旧谈。\n\n山中野叟 顿首',
        privateMemo: '凡尘虽苦，却有放不下之人。仙谷清修虽妙，到底不及人间烟火一顾。',
        attachmentName: ''
      },
      {
        category: 'promotions',
        senderName: '市井药材行',
        senderAddress: 'herb@market.med',
        subject: '【供货单】百年老野山参、茯苓大宗特价供应单',
        dateStr: '11月3日',
        previewText: '仙长法眼：长白山客商新抵上等野山参三十支，气血充盈，炼丹极佳...',
        fullContent: '左仙长道鉴：\n\n小行蒙仙长多年垂顾！今有辽东客商送来整箱鹿茸、老山参及赤茯苓，药性极猛，知仙长炼制仙家甘露，特具单奉览！\n\n老德济药号 拜',
        privateMemo: '山参药力醇厚，正可熬膏给那孩子补元气。全数买下令人送去广陵。',
        attachmentName: '药材清单.xlsx'
      },
      {
        category: 'promotions',
        senderName: '悬壶堂',
        senderAddress: 'doc@xuanhu.med',
        subject: '【医理辨析】关于辟谷期间偶服甜食是否破戒的药理辨析',
        dateStr: '10月29日',
        previewText: '道长钧鉴：世人多惑于辟谷之节制，今撰医案一篇，证甘味润燥之功...',
        fullContent: '仙师座右：\n\n医道本于自然。辟谷服气之士，若因心神倦怠而偶服饴糖果脯，不仅无碍冲和，反有益于脾土润养。特附医理浅说一份供览。\n\n悬壶散人 呈',
        privateMemo: '既是医理所容……那往后多备些酥糖放在阁中，也合乎常理。',
        attachmentName: '医理考.pdf'
      }
    ]
  };

  // ----------------------------------------------------------------------------
  // 2. 本地 IndexedDB 数据库支持 (快捷方式与角色搜索足迹持久化)
  // ----------------------------------------------------------------------------
  let dbPromise = null;
  const SHORTCUTS_CACHE_KEY = 't8_nuo_browser_shortcuts_cache';
  const SHORTCUTS_INITED_KEY = 't8_nuo_browser_shortcuts_seeded';

  function getDB() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_SHORTCUTS)) {
            db.createObjectStore(STORE_SHORTCUTS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_RECORDS)) {
            db.createObjectStore(STORE_RECORDS, { keyPath: 'charKey' });
          }
          if (!db.objectStoreNames.contains(STORE_HISTORY)) {
            db.createObjectStore(STORE_HISTORY, { keyPath: 'charName' });
          }
          if (!db.objectStoreNames.contains(STORE_MAILS)) {
            const mailStore = db.createObjectStore(STORE_MAILS, { keyPath: 'id' });
            mailStore.createIndex('charName', 'charName', { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  async function loadDbShortcuts() {
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_SHORTCUTS, 'readwrite');
        const store = tx.objectStore(STORE_SHORTCUTS);
        const req = store.getAll();
        req.onsuccess = () => {
          const res = req.result;
          const isSeeded = localStorage.getItem(SHORTCUTS_INITED_KEY);
          if (!isSeeded) {
            localStorage.setItem(SHORTCUTS_INITED_KEY, 'true');
            PRESET_SHORTCUTS.forEach(sc => store.put(sc));
            try { localStorage.setItem(SHORTCUTS_CACHE_KEY, JSON.stringify(PRESET_SHORTCUTS)); } catch (e) {}
            resolve(PRESET_SHORTCUTS);
            return;
          }
          if (Array.isArray(res) && res.length > 0) {
            try { localStorage.setItem(SHORTCUTS_CACHE_KEY, JSON.stringify(res)); } catch (e) {}
            resolve(res);
            return;
          }
          // 若 IndexedDB 查询结果为空，读取 localStorage 双重校验
          const cached = localStorage.getItem(SHORTCUTS_CACHE_KEY);
          if (cached !== null) {
            try {
              const list = JSON.parse(cached);
              resolve(Array.isArray(list) ? list : []);
              return;
            } catch (e) {}
          }
          resolve([]);
        };
        req.onerror = () => {
          try {
            const cached = JSON.parse(localStorage.getItem(SHORTCUTS_CACHE_KEY) || '[]');
            resolve(cached);
          } catch (e) {
            resolve([]);
          }
        };
      });
    } catch (e) {
      try {
        const cached = JSON.parse(localStorage.getItem(SHORTCUTS_CACHE_KEY) || '[]');
        return cached;
      } catch (err) {
        return [];
      }
    }
  }

  async function saveDbShortcut(sc) {
    try {
      const db = await getDB();
      const tx = db.transaction(STORE_SHORTCUTS, 'readwrite');
      tx.objectStore(STORE_SHORTCUTS).put(sc);
    } catch (e) {}
    try {
      const cached = JSON.parse(localStorage.getItem(SHORTCUTS_CACHE_KEY) || '[]');
      const filtered = cached.filter(s => s.id !== sc.id);
      filtered.push(sc);
      localStorage.setItem(SHORTCUTS_CACHE_KEY, JSON.stringify(filtered));
      localStorage.setItem(SHORTCUTS_INITED_KEY, 'true');
    } catch (e) {}
  }

  async function deleteDbShortcut(id) {
    try {
      const db = await getDB();
      const tx = db.transaction(STORE_SHORTCUTS, 'readwrite');
      tx.objectStore(STORE_SHORTCUTS).delete(id);
    } catch (e) {}
    try {
      const cached = JSON.parse(localStorage.getItem(SHORTCUTS_CACHE_KEY) || '[]');
      const filtered = cached.filter(s => s.id !== id);
      localStorage.setItem(SHORTCUTS_CACHE_KEY, JSON.stringify(filtered));
      localStorage.setItem(SHORTCUTS_INITED_KEY, 'true');
    } catch (e) {}
  }

  // ----------------------------------------------------------------------------
  // 动态人设兜底生成器：针对自建或非五大主角名士（如张飞、华佗、周瑜等）
  // ----------------------------------------------------------------------------
  function getDynamicFallbackRecords(charInfo) {
    const name = (charInfo && charInfo.name) || '名士';
    if (PRESET_CHAR_RECORDS[name]) {
      return PRESET_CHAR_RECORDS[name];
    }
    return [
      {
        query: `${name} 专属兵刃装备日常保养与除锈指南`,
        searchTime: '15分钟前',
        pageTitle: `《天下武备考录 · ${name} 篇》`,
        sourceSite: '大汉军械兵工录',
        snapshotSnippet: `精钢与玄铁所铸兵刃，遇潮易生浮锈。日常当以鹿皮蘸特调熟桐油细细摩挲，月余一淬，方能寒光夺目，锋锐无匹。`,
        privateNote: `趁着今日无战事，把兵刃擦得锃亮。等楼主来巡视，定要让她瞧瞧本将的威风！`
      },
      {
        query: `广陵城哪里的陈年老酒最烈最够劲`,
        searchTime: '昨夜子时',
        pageTitle: '广陵风物志：十佳酒肆与佳酿暗访',
        sourceSite: '市井食客百晓生',
        snapshotSnippet: `城西刘记三碗不过岗，以山泉古法酿造，入口如烈火入喉，后劲绵长，非酒量豪迈之豪杰不敢轻易饮尽三盏。`,
        privateNote: `好酒！改日拉上楼主和兄弟们一起痛饮三百杯，谁先喝趴下谁请客！`
      },
      {
        query: `给重要的心上人送礼物送什么显得威风又体贴`,
        searchTime: '昨日午后',
        pageTitle: '豪杰心事：如何让心仪之人喜笑颜开',
        sourceSite: '江湖情缘杂谈',
        snapshotSnippet: `直爽之人赠礼，切忌拐弯抹角。一件能贴身御寒的锦袍，或是一匹驯服的良驹，胜过虚饰之辞千万。`,
        privateNote: `寻常金银珠宝太俗气！我得亲自猎一袭上等火狐皮，给楼主缝一件冬日暖裘大氅！`
      },
      {
        query: `怎么才能不着痕迹地保护一个人周全`,
        searchTime: '三天前',
        pageTitle: '近卫兵法与贴身护卫要义',
        sourceSite: '太尉府亲卫手册',
        snapshotSnippet: `上乘护卫，如影随形而声息全无。立于危难之前，挡于兵刃之先，以己之躯化作铜墙铁壁。`,
        privateNote: `管他天下风云怎么变，只要有我在此，谁也休想动楼主一根头发！`
      },
      {
        query: `心情烦闷时大吼三声到底能不能舒缓心气`,
        searchTime: '五天前',
        pageTitle: '黄帝内经：七情郁结与声气宣泄论',
        sourceSite: '悬壶养生通考',
        snapshotSnippet: `肝气郁结则宜发散，长啸当风能通畅百脉。然宜在空旷川野，免惊及近邻四舍。`,
        privateNote: `难怪每次吼完都觉得浑身舒坦！下回楼主若是烦了，我也带她去江边大喊几声！`
      }
    ];
  }

  // 动态生成名士兜底信札（支持自定义名士与未预置名士）
  function getDynamicFallbackMails(charInfo) {
    const name = (charInfo && charInfo.name) || '名士';
    if (PRESET_CHAR_MAILS[name]) {
      return PRESET_CHAR_MAILS[name];
    }
    return [
      {
        category: 'primary',
        senderName: '广陵王',
        senderAddress: 'wang@xiuyilou.gov',
        subject: `致${name}：近日风声微紧，遇事切莫独自犯险`,
        dateStr: '今日 辰时',
        previewText: '闻你近来四方奔走，暗线谍报皆已送达，万事以自身安危为重...',
        fullContent: `${name}如面：\\n\\n近日各方线报杂乱，绣衣楼诸事虽繁，亦不及你安危万一。\\n若遇棘手难决之事，随时遣信鸽报我，切莫一人强扛。\\n\\n广陵王 手书`,
        privateMemo: '楼主总是把旁人的安危放在心上……此番大局，我定护楼中周全。',
        attachmentName: '机要批复.pdf'
      },
      {
        category: 'primary',
        senderName: '大汉太尉府兵曹',
        senderAddress: 'bingcao@taiwei.gov',
        subject: '【官署公牒】关于江淮防务粮饷拨付核实备忘',
        dateStr: '昨日 子时',
        previewText: '关防密令：江淮沿岸驿站联防调配已下达，着即核定文书印信...',
        fullContent: '台鉴：\\n\\n太尉府例行核验江淮各驻防点布防录与公帑度支。各部需恪遵规程，勿误军机。\\n\\n太尉府 押',
        privateMemo: '公文中规中矩，无甚波澜，依法依例批转便是。',
        attachmentName: '防务牒文.pdf'
      },
      {
        category: 'social',
        senderName: '江湖同道故友',
        senderAddress: 'friend@jianghu.org',
        subject: '【故人拜帖】近来可好？托南来商队带去些时令土仪',
        dateStr: '3日前',
        previewText: '展信舒颜：自上次一别已有半载，江南冬冷，带去些暖身老茶与干果...',
        fullContent: '故友亲启：\\n\\n塞北风雪渐紧，思及当年同舟共济之谊，不胜唏嘘。商队带去老白茶两饼，闲暇烹茶暖身。\\n望保重千万。\\n\\n故人 敬上',
        privateMemo: '故人依旧有心，这茶饼闻着清香，得空泡一壶与楼主同饮。',
        attachmentName: ''
      },
      {
        category: 'promotions',
        senderName: '广陵万宝珍奇行',
        senderAddress: 'wanbao@bazaar.han',
        subject: '【岁末市肆】四方奇珍特展入场券与定制贺礼画册',
        dateStr: '5日前',
        previewText: '贵客尊鉴：西域新进琉璃盏、上等文房古墨到埠，持函立享贵宾席位...',
        fullContent: '尊驾台鉴：\\n\\n小行新到西域温润暖玉佩、端溪名砚数方，专备雅人逸士之需。特寄贵宾雅集请柬，恭候光临！\\n\\n万宝行掌柜 呈',
        privateMemo: '西域暖玉？不知楼主会不会喜欢，改日路过瞧一眼。',
        attachmentName: '图册.pdf'
      },
      {
        category: 'promotions',
        senderName: '城中太白老酒楼',
        senderAddress: 'taibai@tavern.market',
        subject: '【冬酿尝新】新蒸桂花冬酿开坛，持信凭引赠小菜双拼',
        dateStr: '1周前',
        previewText: '老客官吉祥：冬酿初熟，酒香扑鼻，小二已备好雅间与炭火暖炉...',
        fullContent: '雅客尊前：\\n\\n今年桂花蜜浸冬酿已开坛！酒色澄金，香冽甘温。凭此帖携友光临，送风干鹿脯与炙羊排！\\n\\n太白酒楼 谨启',
        privateMemo: '冬酿暖胃倒是不错，挑个雪天叫上大家一块儿尝尝。',
        attachmentName: ''
      }
    ];
  }

  // 判断并纠正历史缓存污染（非傅融名士若误存了傅融的假山/记账预设，视为污染需纠正）
  function isContaminatedRecords(charName, records) {
    if (charName === '傅融') return false;
    if (!Array.isArray(records) || records.length === 0) return false;
    const firstQuery = (records[0] && records[0].query) || '';
    return firstQuery.includes('相府假山') || firstQuery.includes('记账软件');
  }

  // 往昔搜索足迹持久化归档 (全面依托 IndexedDB STORE_HISTORY，彻底规避 localStorage 5MB QuotaExceeded 限制)
  async function loadCharHistory(charName) {
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        if (!db.objectStoreNames.contains(STORE_HISTORY)) {
          // 降级尝试从 localStorage 读取兼容旧数据
          try {
            const raw = localStorage.getItem(`t8_browser_history_${charName}`);
            if (raw) resolve(JSON.parse(raw));
            else resolve([]);
          } catch (e) { resolve([]); }
          return;
        }
        const tx = db.transaction(STORE_HISTORY, 'readonly');
        const store = tx.objectStore(STORE_HISTORY);
        const req = store.get(charName);
        req.onsuccess = () => {
          if (req.result && Array.isArray(req.result.batches) && req.result.batches.length > 0) {
            resolve(req.result.batches);
          } else {
            // 兼容迁移：如果 IndexedDB 暂无，尝试读取旧 localStorage
            try {
              const raw = localStorage.getItem(`t8_browser_history_${charName}`);
              if (raw) {
                const list = JSON.parse(raw);
                if (Array.isArray(list) && list.length > 0) {
                  // 异步迁移写入 IndexedDB 并清理 localStorage 释放配额
                  saveCharHistoryBatch(charName, []).catch(() => {});
                  resolve(list);
                  return;
                }
              }
            } catch (e) {}
            resolve([]);
          }
        };
        req.onerror = () => resolve([]);
      });
    } catch (e) {
      console.warn('[NuoBrowser] 加载历史足迹异常:', e);
      return [];
    }
  }

  async function saveCharHistoryBatch(charName, newRecords) {
    try {
      const existing = await loadCharHistory(charName);
      let updated = existing;
      if (Array.isArray(newRecords) && newRecords.length > 0) {
        const batchEntry = {
          id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
          dateStr: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
          records: newRecords
        };
        // 最新生成的批次排在最前，最多保留 50 批次（约 250 条历史搜索）
        updated = [batchEntry, ...existing].slice(0, 50);
      }

      const db = await getDB();
      if (db.objectStoreNames.contains(STORE_HISTORY)) {
        const tx = db.transaction(STORE_HISTORY, 'readwrite');
        const store = tx.objectStore(STORE_HISTORY);
        store.put({ charName, batches: updated, updatedAt: Date.now() });
      }

      // 清理 localStorage 里的膨胀历史数据，释放浏览器存储空间，防止再次 QuotaExceededError
      try {
        localStorage.removeItem(`t8_browser_history_${charName}`);
      } catch (e) {}

      return updated;
    } catch (e) {
      console.warn('[NuoBrowser] 保存历史足迹至 IndexedDB 失败:', e);
      return [];
    }
  }

  async function clearCharHistory(charName) {
    try {
      const db = await getDB();
      if (db.objectStoreNames.contains(STORE_HISTORY)) {
        const tx = db.transaction(STORE_HISTORY, 'readwrite');
        const store = tx.objectStore(STORE_HISTORY);
        store.delete(charName);
      }
    } catch (e) {}
    try {
      localStorage.removeItem(`t8_browser_history_${charName}`);
    } catch (e) {}
  }

  async function loadCharRecords(char) {
    const charName = typeof char === 'string' ? char : (char ? char.name : '名士');
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_RECORDS, 'readonly');
        const store = tx.objectStore(STORE_RECORDS);
        const req = store.get(charName);
        req.onsuccess = () => {
          if (req.result && Array.isArray(req.result.records) && req.result.records.length > 0) {
            if (isContaminatedRecords(charName, req.result.records)) {
              const fallback = getDynamicFallbackRecords(typeof char === 'object' ? char : { name: charName });
              saveCharRecords(charName, fallback);
              resolve(fallback);
              return;
            }
            resolve(req.result.records);
          } else {
            const cached = localStorage.getItem(`t8_browser_records_${charName}`);
            if (cached) {
              try {
                const list = JSON.parse(cached);
                if (Array.isArray(list) && list.length > 0) {
                  if (isContaminatedRecords(charName, list)) {
                    const fallback = getDynamicFallbackRecords(typeof char === 'object' ? char : { name: charName });
                    saveCharRecords(charName, fallback);
                    resolve(fallback);
                    return;
                  }
                  resolve(list);
                  return;
                }
              } catch (e) {}
            }
            const fallback = getDynamicFallbackRecords(typeof char === 'object' ? char : { name: charName });
            resolve(fallback);
          }
        };
        req.onerror = () => {
          resolve(getDynamicFallbackRecords(typeof char === 'object' ? char : { name: charName }));
        };
      });
    } catch (e) {
      return getDynamicFallbackRecords(typeof char === 'object' ? char : { name: charName });
    }
  }

  async function saveCharRecords(charName, records) {
    try {
      const db = await getDB();
      const tx = db.transaction(STORE_RECORDS, 'readwrite');
      tx.objectStore(STORE_RECORDS).put({ charKey: charName, records, updatedAt: Date.now() });
    } catch (e) {}
    try {
      localStorage.setItem(`t8_browser_records_${charName}`, JSON.stringify(records));
    } catch (e) {}
  }

  // ----------------------------------------------------------------------------
  // Nuo Mail 邮件数据层 (全面依托 IndexedDB STORE_MAILS，支持长期永久历史归档)
  // ----------------------------------------------------------------------------
  async function loadCharMails(char) {
    const charName = typeof char === 'string' ? char : (char ? char.name : '名士');
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        if (!db.objectStoreNames.contains(STORE_MAILS)) {
          resolve(getDynamicFallbackMails(typeof char === 'object' ? char : { name: charName }));
          return;
        }
        const tx = db.transaction(STORE_MAILS, 'readonly');
        const store = tx.objectStore(STORE_MAILS);
        const idx = store.index('charName');
        const req = idx.getAll(charName);
        req.onsuccess = () => {
          const list = req.result;
          if (Array.isArray(list) && list.length > 0) {
            // 按时间戳倒序排列（最新邮件在最前）
            list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            resolve(list);
          } else {
            const fallback = getDynamicFallbackMails(typeof char === 'object' ? char : { name: charName });
            saveCharMailsBatch(charName, fallback).catch(() => {});
            resolve(fallback);
          }
        };
        req.onerror = () => {
          resolve(getDynamicFallbackMails(typeof char === 'object' ? char : { name: charName }));
        };
      });
    } catch (e) {
      console.warn('[NuoMail] 加载名士邮件异常:', e);
      return getDynamicFallbackMails(typeof char === 'object' ? char : { name: charName });
    }
  }

  async function saveCharMailsBatch(charName, newMails) {
    try {
      if (!Array.isArray(newMails) || newMails.length === 0) return [];
      const db = await getDB();
      if (!db.objectStoreNames.contains(STORE_MAILS)) return newMails;
      const tx = db.transaction(STORE_MAILS, 'readwrite');
      const store = tx.objectStore(STORE_MAILS);
      newMails.forEach((m, idx) => {
        const item = {
          ...m,
          charName: charName,
          id: m.id || `mail_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
          timestamp: m.timestamp || (Date.now() - idx * 60000)
        };
        store.put(item);
      });
      return new Promise((resolve) => {
        tx.oncomplete = () => resolve(newMails);
        tx.onerror = () => resolve(newMails);
      });
    } catch (e) {
      console.warn('[NuoMail] 批量持久化邮件异常:', e);
      return newMails;
    }
  }

  async function updateCharMail(mail) {
    try {
      if (!mail || !mail.id) return;
      const db = await getDB();
      if (!db.objectStoreNames.contains(STORE_MAILS)) return;
      const tx = db.transaction(STORE_MAILS, 'readwrite');
      tx.objectStore(STORE_MAILS).put(mail);
    } catch (e) {
      console.warn('[NuoMail] 更新邮件状态异常:', e);
    }
  }

  async function deleteCharMail(id) {
    try {
      if (!id) return;
      const db = await getDB();
      if (!db.objectStoreNames.contains(STORE_MAILS)) return;
      const tx = db.transaction(STORE_MAILS, 'readwrite');
      tx.objectStore(STORE_MAILS).delete(id);
    } catch (e) {
      console.warn('[NuoMail] 删除邮件异常:', e);
    }
  }

  // ----------------------------------------------------------------------------
  // 健壮 JSON 容错与多层解析器 (解决换行/单引号/尾逗号/对象包装问题)
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
      .replace(/,\s*([\]}])/g, '$1');
  }


  // 健壮对象提取器 (平衡花括号匹配，安全提取 JSON 块)
  function extractObjects(str) {
    const list = [];
    let i = 0;
    const s = String(str || '');
    while (i < s.length) {
      if (s[i] !== '{') { i++; continue; }
      let depth = 0, inStr = false, quote = '', j = i, end = -1;
      for (; j < s.length; j++) {
        const ch = s[j];
        if (inStr) {
          if (ch === '\\') j++;
          else if (ch === quote) inStr = false;
          continue;
        }
        if (ch === '"' || ch === "'") { inStr = true; quote = ch; continue; }
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) { end = j; break; }
        }
      }
      if (end !== -1) {
        list.push(s.slice(i, end + 1));
        i = end + 1;
      } else {
        i++;
      }
    }
    return list;
  }

  function tryParseJson(chunk) {
    if (!chunk || typeof chunk !== 'string') return null;
    try { return JSON.parse(chunk); } catch (e) {}
    try { return JSON.parse(repairJSON(chunk)); } catch (e) {}
    return null;
  }

  function parseSearchRecordsFromLLM(text, defaultCharName = '名士') {
    if (!text || typeof text !== 'string') return [];
    console.log('[NuoBrowser] 接收到大模型原始输出全文:', text);

    let rawList = [];

    // 尝试一：直接作为 JSON 或对象数组解析
    const parsedRoot = tryParseJson(text);
    if (Array.isArray(parsedRoot)) {
      rawList = parsedRoot;
    } else if (parsedRoot && typeof parsedRoot === 'object') {
      const candidates = [
        parsedRoot.records, parsedRoot.searches, parsedRoot.list,
        parsedRoot.data, parsedRoot.history, parsedRoot.search_history,
        parsedRoot.searchRecords
      ];
      for (const c of candidates) {
        if (Array.isArray(c)) { rawList = c; break; }
      }
      if (rawList.length === 0 && (parsedRoot.query || parsedRoot.pageTitle || parsedRoot.title)) {
        rawList = [parsedRoot];
      }
    }

    // 尝试二：若直接解析未果，使用深层花括号平衡提取器遍历抽取每个 {...} 对象
    if (!Array.isArray(rawList) || rawList.length === 0) {
      const s = String(text || '');
      let i = 0;
      while (i < s.length) {
        if (s[i] !== '{') { i++; continue; }
        let depth = 0, inStr = false, quote = '', j = i, end = -1;
        for (; j < s.length; j++) {
          const ch = s[j];
          if (inStr) {
            if (ch === '\\') j++;
            else if (ch === quote) inStr = false;
            continue;
          }
          if (ch === '"' || ch === "'") { inStr = true; quote = ch; continue; }
          if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) { end = j; break; }
          }
        }
        if (end !== -1) {
          const chunk = s.slice(i, end + 1);
          const obj = tryParseJson(chunk);
          if (obj && typeof obj === 'object') {
            rawList.push(obj);
          }
          i = end + 1;
        } else {
          i++;
        }
      }
    }

    console.log('[NuoBrowser] 初步抽取的原始对象条数:', rawList.length);

    // 标准化与全字段映射清洗
    const normalized = rawList.map((item, idx) => {
      const query = item.query || item.search_term || item.keyword || item.searchQuery || item.title || item.pageTitle || '';
      if (!query || typeof query !== 'string' || query.trim() === '') return null;

      const pageTitle = item.pageTitle || item.title || item.page_title || `《${query}》相关见闻`;
      const sourceSite = item.sourceSite || item.site || item.source_site || item.source || '广陵天机阁·网络经纬';
      const searchTime = item.searchTime || item.time || item.search_time || (idx === 0 ? '10分钟前' : idx === 1 ? '半个时辰前' : '昨夜子时');
      const snapshotSnippet = item.snapshotSnippet || item.snippet || item.content || item.summary || item.text || `关于「${query}」的大汉坊间记录与深度解说。`;
      const privateNote = item.privateNote || item.note || item.memo || item.private_note || item.comment || `「${defaultCharName}」在云镜旁写下的私密留痕便签。`;

      return {
        query: query.trim(),
        searchTime: String(searchTime).trim(),
        pageTitle: String(pageTitle).trim(),
        sourceSite: String(sourceSite).trim(),
        snapshotSnippet: String(snapshotSnippet).trim(),
        privateNote: String(privateNote).trim()
      };
    }).filter(Boolean);

    console.log('[NuoBrowser] 最终清洗出的合规记录:', normalized);
    return normalized;
  }

  // ----------------------------------------------------------------------------
  // 3. 深度四维上下文装配引擎 (按要求装配四大维度的全部真实信息)
  // ----------------------------------------------------------------------------
  async function buildFullCharacterContext(char) {
    // 维度 1: 名士自身基础配置
    const charInfo = {
      id: (char && (char.id || char.name)) || 'furong',
      name: (char && char.name) || '傅融',
      mbti: (char && char.mbti) || '未知',
      constellation: (char && char.constellation) || '未知',
      speakingStyle: (char && (char.speakingStyle || char.style)) || '未指定',
      personality: (char && char.personality) || '未指定',
      background: (char && (char.background || char.desc)) || '未指定'
    };

    // 维度 2: 玩家在「设置-身份配置库」中选定的身份
    let activeUser = null;
    try {
      const savedPersonas = JSON.parse(localStorage.getItem('user_personas') || '[]');
      const activeId = localStorage.getItem('active_persona_id');
      if (savedPersonas.length > 0 && activeId) {
        activeUser = savedPersonas.find(p => String(p.id) === String(activeId)) || savedPersonas[0];
      }
    } catch (e) {}

    // 维度 3: 用户在「设置-世界书设置」中开启的世界书条目 (兼容 async Promise)
    let worldBookText = '';
    try {
      if (typeof window.getWorldBookContext === 'function') {
        const res = window.getWorldBookContext();
        worldBookText = (res && typeof res.then === 'function') ? await res : res;
      } else if (window.worldBookStore && typeof window.worldBookStore.getData === 'function') {
        const wbData = await window.worldBookStore.getData();
        const activeBooks = (wbData?.books || []).filter(b => b.enabled !== false);
        worldBookText = activeBooks.map(b => `【${b.title}】：${b.content}`).join('\n');
      } else {
        const rawWb = localStorage.getItem('world_book_data');
        if (rawWb) worldBookText = rawWb;
      }
      if (typeof worldBookText !== 'string') {
        worldBookText = JSON.stringify(worldBookText || '');
      }
    } catch (e) {
      console.warn('[NuoBrowser] 读取世界书失败:', e);
      worldBookText = '';
    }

    // 维度 4: 传讯中近 30 条聊天记录
    let recentChatText = '';
    try {
      let msgs = [];
      const charId = charInfo.id;
      if (window.chatHistoryStore && typeof window.chatHistoryStore.getRecentMessages === 'function') {
        msgs = await window.chatHistoryStore.getRecentMessages(charId, 30);
      }
      if ((!msgs || msgs.length === 0) && window.chatHistoryStore && typeof window.chatHistoryStore.getMessages === 'function') {
        const res = await window.chatHistoryStore.getMessages(charId, 1, 30);
        msgs = Array.isArray(res) ? res : (res && res.messages) || [];
      }
      if (!msgs || msgs.length === 0) {
        const localKey = `t8_chat_history_${charId}` || `t8_chat_history_${charInfo.name}`;
        const raw = localStorage.getItem(localKey) || localStorage.getItem(`t8_messages_${charId}`);
        if (raw) msgs = JSON.parse(raw) || [];
      }
      if (Array.isArray(msgs) && msgs.length > 0) {
        const slice = msgs.slice(-30);
        recentChatText = slice.map(m => {
          const sender = m.isMe ? (activeUser ? activeUser.name : '主公/广陵王') : charInfo.name;
          const text = m.text || m.content || (m.image ? '[发送了图片]' : '');
          return `${sender}: ${text}`;
        }).join('\n');
      }
    } catch (e) {
      console.warn('[NuoBrowser] 聊天记录读取失败:', e);
    }

    return { charInfo, activeUser, worldBookText, recentChatText };
  }

  // ----------------------------------------------------------------------------
  // 方向 1：真实网络搜索引擎客户端 (全模型兼容 · 轻量客户端代理 + 知识库)
  // ----------------------------------------------------------------------------
  const REAL_SEARCH_CONFIG_KEY = 't8_browser_real_search_config';

  function getRealSearchConfig() {
    try {
      const raw = localStorage.getItem(REAL_SEARCH_CONFIG_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
      enabled: true,
      provider: 'builtin', // 'builtin' | 'tavily' | 'bocha'
      apiKey: ''
    };
  }

  function saveRealSearchConfig(cfg) {
    try {
      localStorage.setItem(REAL_SEARCH_CONFIG_KEY, JSON.stringify(cfg));
    } catch (e) {}
  }

  // 判断是否为情感、人际、咨询或对话式提问（此类问题在维基百科中无专有名词词条，应完全保留大模型自拟的高沉浸度论坛/见闻快照，避免匹配到风马牛不相及的明星/影视词条）
  function isConversationalAdviceQuery(q) {
    if (!q || typeof q !== 'string') return false;
    return /(如何|怎样|怎么|如何哄|哄|逗|讨好|心上人|心仪|喜欢一个人|送什么|怎么办|开心|生气|委屈|吵架|谈恋爱|相处|搭讪|追求|表白|送礼|生闷气|喜欢)/.test(q);
  }

  function extractQueryKeywords(str) {
    const clean = (str || '').replace(/[《》“”"'?？,，.。!！:：]/g, '');
    const tokens = [];
    for (let len = 4; len >= 2; len--) {
      for (let i = 0; i <= clean.length - len; i++) {
        tokens.push(clean.slice(i, i + len));
      }
    }
    return tokens;
  }

  // 严格相关性与非虚构实体校验器
  function isSearchHitRelevant(query, hit) {
    if (!hit || !hit.title || !hit.snippet) return false;
    // 情感/咨询建议类提问，百科词条必然不相关（如搜"如何哄女孩"绝不能匹配到"章若楠"）
    if (isConversationalAdviceQuery(query)) return false;

    const fullText = (hit.title + ' ' + hit.snippet).toLowerCase();

    // 强行过滤无关影视作品、演职人员、偶像组合（除非搜索词自身明确包含影视/动漫等意图）
    if (/(电视剧|电影|演员|配音|动画|漫画|轻小说|艺人|主演|女子组合|单曲)/.test(fullText) && !/(电视剧|电影|小说|动漫|演员)/.test(query)) {
      return false;
    }

    // 必须与搜索词具有真实核心实体词重合
    const keywords = extractQueryKeywords(query);
    return keywords.some(k => fullText.includes(k.toLowerCase()));
  }

  function cleanSearchQueryForWeb(q) {
    if (!q || typeof q !== 'string') return '';
    return q
      .replace(/[《》“”"'']/g, '')
      .replace(/(如何|怎样|怎么|为什么|应该|合法吗|能不能|到底|请问)/g, '')
      .replace(/(最新|相关|介绍|大全|攻略|指南)/g, '')
      .trim();
  }

  // 1. 内置免配置维基/百科通用检索器 (CORS-friendly, origin=*)
  async function queryBuiltinKnowledge(q) {
    // 凡属于情感互动、送礼哄人、情缘杂谈的，百科均无实体词条，直接跳过交由名士剧情自洽
    if (isConversationalAdviceQuery(q)) return null;

    const cleaned = cleanSearchQueryForWeb(q) || q;
    try {
      const url = `https://zh.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleaned)}&utf8=1&format=json&origin=*`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (!res.ok) return null;
      const data = await res.json();
      const hits = data.query?.search;
      if (Array.isArray(hits) && hits.length > 0) {
        // 过滤出与名士搜索实体真正紧密相关的条目
        for (const candidate of hits.slice(0, 3)) {
          const candidateSnippet = (candidate.snippet || '').replace(/<[^>]+>/g, '').trim();
          const hitObj = {
            title: candidate.title,
            snippet: candidateSnippet,
            source: '全球中文百科网络',
            url: `https://zh.wikipedia.org/wiki/${encodeURIComponent(candidate.title)}`
          };
          if (isSearchHitRelevant(q, hitObj) && candidateSnippet.length > 20) {
            return hitObj;
          }
        }
      }
    } catch (e) {}
    return null;
  }

  // 2. Tavily AI 真实搜索
  async function queryTavilySearch(q, apiKey) {
    if (!apiKey) return null;
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: q,
          search_depth: 'basic',
          max_results: 2
        }),
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (Array.isArray(data.results) && data.results.length > 0) {
        const first = data.results[0];
        return {
          title: first.title,
          snippet: first.content || first.snippet || '',
          source: 'Tavily 全网实时搜索',
          url: first.url
        };
      }
    } catch (e) {}
    return null;
  }

  // 3. 博查 (Bocha) AI 中文搜索
  async function queryBochaSearch(q, apiKey) {
    if (!apiKey) return null;
    try {
      const res = await fetch('https://api.bochaai.com/v1/web-search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: q, count: 2 }),
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) return null;
      const data = await res.json();
      const pages = data.data?.webPages?.value;
      if (Array.isArray(pages) && pages.length > 0) {
        const first = pages[0];
        return {
          title: first.name || first.title,
          snippet: first.snippet || first.summary || '',
          source: '博查全网实时搜索',
          url: first.url
        };
      }
    } catch (e) {}
    return null;
  }

  // 统一真实网络搜索调用器
  async function fetchRealWebSearch(query) {
    const cfg = getRealSearchConfig();
    if (!cfg.enabled) return null;

    let result = null;
    if (cfg.provider === 'tavily' && cfg.apiKey) {
      result = await queryTavilySearch(query, cfg.apiKey);
    } else if (cfg.provider === 'bocha' && cfg.apiKey) {
      result = await queryBochaSearch(query, cfg.apiKey);
    }

    if (!result) {
      result = await queryBuiltinKnowledge(query);
    }
    return result;
  }

  // 增强名士搜索足迹：对部分条目进行真实互联网搜索增强（虚实双轨）
  async function enrichRecordsWithRealWebSearch(records) {
    if (!Array.isArray(records) || records.length === 0) return records;
    const cfg = getRealSearchConfig();
    if (!cfg.enabled) return records;

    const enriched = await Promise.all(records.map(async (item, idx) => {
      // 对前 3 条进行真实网络搜索检索尝试
      if (idx < 3 && item.query) {
        try {
          const hit = await fetchRealWebSearch(item.query);
          // 仅当检索结果具备高度相关性且非虚构无关人物时，才采纳为真实快照
          if (hit && hit.snippet) {
            return {
              ...item,
              // 保留 AI 生成的贴合剧情的标题风格，避免被生硬的短人名/无关条目冲刷
              pageTitle: item.pageTitle || hit.title,
              sourceSite: hit.source || item.sourceSite,
              snapshotSnippet: hit.snippet,
              realUrl: hit.url,
              isRealSearch: true
            };
          }
        } catch (e) {}
      }
      return {
        ...item,
        isRealSearch: false
      };
    }));

    return enriched;
  }

  // ----------------------------------------------------------------------------
  // 4. 名士 AI 搜索足迹生成引擎 (虚实双轨融合)
  // ----------------------------------------------------------------------------
  async function generateCharacterSearchFootprints(char) {
    if (!char) char = DEFAULT_LEAD_CHARACTERS[0];
    const ctx = await buildFullCharacterContext(char);
    const { charInfo, activeUser, worldBookText, recentChatText } = ctx;

    const systemPrompt = `你是一个深谙《代号鸢》与现代智能手机融合设定的剧情编剧与名士性格模拟专家。
现在，名士「${charInfo.name}」正在自己的轻拟物手机「鸢云镜」中私密上网与搜索。
请根据该名士的真实设定、当前玩家人设、世界书背景以及两人最近30条密讯聊天记录，以极具活人感、呼吸感、反差萌与生活烟火气的口吻，生成这位名士【最近真实偷偷搜索过的 5 条搜索记录】以及【每条搜索所点击的仿真网页快照详情】。

【虚实双轨特别要求】：
- 5条搜索中，至少 2~3 条为名士在现实互联网中请教现代知识、健康养生、实用技巧或生活常识（如止咳偏方、兵刃除锈、如何哄心上人、法律常识、物价等），搜索词简练贴合搜索引擎习惯。
- 另外 2~3 条为古风与心底深处的私密情感、相府日常或对楼主未说出口的关怀。

【名士自身配置】
- 姓名：${charInfo.name} (ID: ${charInfo.id})
- MBTI：${charInfo.mbti}
- 星座：${charInfo.constellation}
- 性格特点：${charInfo.personality}
- 语言风格：${charInfo.speakingStyle}
- 个人背景：${charInfo.background}

${activeUser ? `【用户(玩家/广陵王)身份设定】
- 姓名：${activeUser.name}
- 性别：${activeUser.gender || '未知'}
- 性格：${activeUser.personality || '未知'}
- 说话风格：${activeUser.style || '未知'}` : ''}

${worldBookText ? `【当前世界书背景条目】\n${typeof worldBookText === 'string' ? worldBookText.slice(0, 1000) : ''}` : ''}

${recentChatText ? `【两人最近密讯聊天真实记录(近30条)】\n${recentChatText}` : '【最近暂无聊天记录，请依据人设与日常反差生成】'}

【生成要求】：
1. 搜索词必须紧扣两人最近聊天的具体细节、未说出口的心事、日常顾虑或名士专属人设爱好。
2. 每条搜索记录必须包含：
   - query: 简短贴切的搜索词（10~25字以内）
   - searchTime: 搜索时间说明（如"10分钟前"、"昨夜子时"、"今日破晓"）
   - pageTitle: 搜索点击进入的网页标题
   - sourceSite: 来源站点名（如"大汉工部律政库"、"洛阳百姓网"、"现代生活养生堂"等）
   - snapshotSnippet: 网页正文核心快照摘要（100~200字，栩栩如生的网页说明或帖子）
   - privateNote: 名士在该条目下偷偷写下的【私密便签/心底批注】（30~80字，展现极强活人感）

请严格输出为以下合法 JSON 数组格式，不要输出任何其他多余 markdown 说明：
[
  {
    "query": "搜索词",
    "searchTime": "昨夜子时",
    "pageTitle": "网页标题",
    "sourceSite": "来源站点",
    "snapshotSnippet": "网页正文摘要",
    "privateNote": "名士私密批注"
  }
]
`;

    if (!window.sendToLLM) {
      throw new Error('未检测到大模型接口 (window.sendToLLM)');
    }

    return new Promise((resolve, reject) => {
      window.sendToLLM(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请立即生成名士「${charInfo.name}」的最新5条私密搜索足迹与网页快照 JSON。要求输出纯 JSON 数组格式。` }
        ],
        { disableMCP: true },
        async (finalText) => {
          const parsed = parseSearchRecordsFromLLM(finalText, charInfo.name);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // 真实网络搜索结果增强
            const enriched = await enrichRecordsWithRealWebSearch(parsed);
            resolve(enriched);
            return;
          }
          console.warn('[NuoBrowser] 未能提取到有效数组，启用该名士动态人设兜底');
          const fallback = getDynamicFallbackRecords(charInfo);
          const enrichedFallback = await enrichRecordsWithRealWebSearch(fallback);
          resolve(enrichedFallback);
        },
        (err) => {
          console.warn('[NuoBrowser] AI 调用异常:', err);
          reject(new Error(typeof err === 'string' ? err : (err && err.message) || '模型服务调用失败，请检查设置中的API配置'));
        }
      );
    });
  }

  // ----------------------------------------------------------------------------
  // Nuo Mail AI 邮件解析器与全息大汉生态推演生成器
  // ----------------------------------------------------------------------------
  function sanitizeMailList(list, charName) {
    if (!Array.isArray(list)) return [];
    return list
      .filter(item => item && (item.subject || item.senderName || item.fullContent || item.previewText))
      .map((item, idx) => {
        const cat = String(item.category || '').toLowerCase();
        const validCategory = (cat === 'social' || cat.includes('社交') || cat.includes('同袍') || cat.includes('江湖'))
          ? 'social'
          : (cat === 'promotions' || cat.includes('推广') || cat.includes('账单') || cat.includes('商肆') || cat.includes('市井'))
          ? 'promotions'
          : 'primary';

        const fallbackDate = ['今日 辰时', '昨日 酉时', '昨日 子时', '3日前', '5日前', '11月10日', '11月8日'][idx % 7];

        return {
          id: item.id || `mail_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          charName: charName,
          category: validCategory,
          senderName: String(item.senderName || '大汉故友').trim(),
          senderAddress: String(item.senderAddress || `${(item.senderName || 'friend').toLowerCase()}@han.org`).trim(),
          subject: String(item.subject || '【机要公函】随札呈阅').trim(),
          dateStr: String(item.dateStr || fallbackDate).trim(),
          previewText: String(item.previewText || (item.fullContent ? item.fullContent.slice(0, 50) : '')).trim(),
          fullContent: String(item.fullContent || item.previewText || '见信安好。诸事已按前令核办。').trim(),
          privateMemo: String(item.privateMemo || '公文已收讫，需留心后续各方动向。').trim(),
          attachmentName: item.attachmentName ? String(item.attachmentName).trim() : '',
          isStarred: !!item.isStarred,
          isRead: !!item.isRead,
          timestamp: Number(item.timestamp) || (Date.now() - idx * 3600000)
        };
      });
  }

  function parseMailsFromLLM(text, defaultCharName = '名士') {
    if (!text || typeof text !== 'string') return [];
    let clean = text.replace(/\`\`\`(?:json)?/gi, '').trim();

    // 1. 直接尝试 JSON.parse
    try {
      const obj = JSON.parse(clean);
      if (Array.isArray(obj) && obj.length > 0) return sanitizeMailList(obj, defaultCharName);
      if (obj && Array.isArray(obj.mails) && obj.mails.length > 0) return sanitizeMailList(obj.mails, defaultCharName);
    } catch (e) {}

    // 2. 提取外层中括号
    const startArr = clean.indexOf('[');
    const endArr = clean.lastIndexOf(']');
    if (startArr !== -1 && endArr > startArr) {
      try {
        const arr = JSON.parse(clean.slice(startArr, endArr + 1));
        if (Array.isArray(arr) && arr.length > 0) return sanitizeMailList(arr, defaultCharName);
      } catch (e) {}
    }

    // 3. 逐个提取对象块
    const chunks = extractObjects(clean);
    const list = [];
    for (const chunk of chunks) {
      try {
        const parsed = JSON.parse(chunk);
        if (parsed && (parsed.subject || parsed.senderName || parsed.fullContent)) list.push(parsed);
      } catch (e) {
        const rep = repairJSON(chunk);
        try {
          const parsedRep = JSON.parse(rep);
          if (parsedRep && (parsedRep.subject || parsedRep.senderName || parsedRep.fullContent)) list.push(parsedRep);
        } catch (e2) {}
      }
    }
    return sanitizeMailList(list, defaultCharName);
  }

  async function generateCharacterMails(char) {
    if (!char) char = DEFAULT_LEAD_CHARACTERS[0];
    const { charInfo, userPersona, worldBookText, recentChatText } = await buildFullCharacterContext(char);

    const systemPrompt = `你现在是《代号鸢》高沉浸度活人感世界架构师。
【核心定位】：
当前正在生成属于名士「${charInfo.name}」个人私密收件箱（广陵机要邮驿 · Nuo Mail）中的最新往来信札。
注意：这是【${charInfo.name}自己收到或发送的信件】，收件人是名士本人，绝非玩家的邮箱！
你必须深度读取该名士的角色设定、玩家设定、世界书与近30条聊天记录，构筑属于名士的鲜活大汉社会生态（不仅是二人世界，而是涵盖朝堂、相府、廷尉、宗族、江湖同袍、市井商肆、钱庄、甚至广告传单的真实人际网络）。

【名士专属档案】：
- 姓名：${charInfo.name}
- 身份/背景：${charInfo.background || '大汉名士'}
- MBTI 性格：${charInfo.mbti || '未知'}
- 星座：${charInfo.constellation || '未知'}
- 性格特征：${charInfo.personality || '鲜活生动'}
- 语言风格：${charInfo.speakingStyle || '符合时代与身份'}

${userPersona ? `【广陵王（玩家）当前身份设定】：\\n- 尊号/身份：${userPersona.name || '广陵王'}\\n- 设定背景：${userPersona.background || '绣衣楼楼主'}` : ''}

${worldBookText ? `【当前世界书背景条目】：\\n${typeof worldBookText === 'string' ? worldBookText.slice(0, 1000) : ''}` : ''}

${recentChatText ? `【两人最近密讯聊天真实记录（近30条）】：\\n${recentChatText}` : '【最近暂无聊天记录，请依据名士人设与大汉生态自洽推演。】'}

【生成规则与生态分布】：
请一次性为名士「${charInfo.name}」生成【5~8 封】风格迥异、社会生态极为丰富的信札。
必须涵盖以下三大类别（category）：
1. 类别 "primary"（主要，1~2 封）：
   - 必须包含 1 封来自【广陵王】（玩家）的手书或密函，紧扣两人最近聊天的具体细节、未尽话题、心事或事务；
   - 以及 1 封来自顶头上司、大汉朝廷官署（如相府户曹、太尉府、廷尉、天机阁或本家族宗长）的正式公函或公文批复。
2. 类别 "social"（社交，2~3 封）：
   - 来自名士过去的故交、战友、同门、同僚、江湖同道、客卿的私人叙旧、求助、赠礼或拜帖；
3. 类别 "promotions"（推广与账单，2~3 封）：
   - 极具市井生活气息的商肆账单、催款通知、钱庄对账单、武器养护折扣、药铺供货单、茶肆新茶传单或市井小报八卦（反差萌，展现大汉市井真实生活！）。

【每封邮件字段规范】：
- category: "primary" | "social" | "promotions"
- senderName: 发件人姓名/机构（如"广陵王"、"大汉相府户曹"、"幽州塞外故交"、"城东王记鲜蔬"、"广陵钱庄通商号"等）
- senderAddress: 仿真实邮箱（如"wang@xiuyilou.gov"、"hucao@xiangfu.gov"、"comrade@youzhou.mil"、"laowang@veg.com"）
- subject: 邮件标题（如"【公函】广陵驻点年度财务账册预审通告"、"【立冬特惠】秋末大白菜量大从优"）
- dateStr: 时间描述（如"今日 辰时"、"昨日 子时"、"11月10日"、"3日前"）
- previewText: 摘要预览（30~60字，列表页展示）
- fullContent: 信件完整正文（150~350字），行文讲究大汉尺牍风骨（称谓、问候、正文、祝颂、落款），充满角色代入感与时代文风
- privateMemo: 📌「${charInfo.name}」的心底私密便笺（20~60字），名士阅毕后写在信件角落或心中的真实想法/私密吐槽/打算（极强活人感）
- attachmentName: 随信附件名称（如"雪梨膏说明.pdf"、"欠条存根.jpg"、"防务牒文.pdf"，无附件则填 ""）

请严格输出为以下合法 JSON 数组格式，不要输出任何其他 markdown 说明：
[
  {
    "category": "primary",
    "senderName": "发件人",
    "senderAddress": "sender@domain.han",
    "subject": "邮件标题",
    "dateStr": "11月10日",
    "previewText": "摘要预览...",
    "fullContent": "信件完整正文...",
    "privateMemo": "名士私密便笺...",
    "attachmentName": "附件.pdf"
  }
]
`;

    if (!window.sendToLLM) {
      throw new Error('未检测到大模型接口 (window.sendToLLM)');
    }

    return new Promise((resolve, reject) => {
      window.sendToLLM(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请立即为名士「${charInfo.name}」生成最新 5~8 封私密往来邮件 JSON 数组。` }
        ],
        { disableMCP: true },
        async (finalText) => {
          const parsed = parseMailsFromLLM(finalText, charInfo.name);
          if (Array.isArray(parsed) && parsed.length >= 3) {
            resolve(parsed);
            return;
          }
          console.warn('[NuoMail] 未能提取到有效邮件数组，启用动态人设兜底');
          resolve(getDynamicFallbackMails(charInfo));
        },
        (err) => {
          console.warn('[NuoMail] AI 生成邮件异常:', err);
          reject(new Error(typeof err === 'string' ? err : (err && err.message) || '模型服务调用失败，请检查设置中的API配置'));
        }
      );
    });
  }

  // ----------------------------------------------------------------------------
  // 5. 主应用组件 (NuoBrowserAppModal)
  // ----------------------------------------------------------------------------
  const NuoBrowserAppModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    // 状态管理
    const [characters, setCharacters] = useState(DEFAULT_LEAD_CHARACTERS);
    const [selectedCharName, setSelectedCharName] = useState(DEFAULT_LEAD_CHARACTERS[0].name);
    const [shortcuts, setShortcuts] = useState([]);
    const [charRecords, setCharRecords] = useState([]);
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [toastMsg, setToastMsg] = useState(null);

    // 浏览状态 (新标签页 vs 仿真网页浏览)
    const [isNewTab, setIsNewTab] = useState(true);
    const [currentUrl, setCurrentUrl] = useState('');
    const [inputUrl, setInputUrl] = useState('');
    const [activeSnapshot, setActiveSnapshot] = useState(null); // 当前阅读的仿真快照
    const [historyList, setHistoryList] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newUrl, setNewUrl] = useState('');
    // 往昔历史足迹弹窗状态
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyBatches, setHistoryBatches] = useState([]);
    // 真实网络搜索配置弹窗状态 (方向1: 虚实双轨联网)
    const [showNetConfigModal, setShowNetConfigModal] = useState(false);
    const [netConfig, setNetConfig] = useState(getRealSearchConfig());

    // ------------------------------------------------------------------------
    // Nuo Mail 状态管理 (广陵机要邮驿 · 名士私密收件箱)
    // ------------------------------------------------------------------------
    const [isMailView, setIsMailView] = useState(false);
    const [charMails, setCharMails] = useState([]);
    const [mailCategory, setMailCategory] = useState('primary'); // 'all' | 'primary' | 'social' | 'promotions' | 'starred'
    const [mailSearchTerm, setMailSearchTerm] = useState('');
    const [activeReadingMail, setActiveReadingMail] = useState(null);
    const [isMailGenerating, setIsMailGenerating] = useState(false);
    const [replyInput, setReplyInput] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // 手机端分类抽屉展开状态
    const [showComposeModal, setShowComposeModal] = useState(false);
    const [composeForm, setComposeForm] = useState({ subject: '', content: '' });

    const showToast = (msg) => {
      setToastMsg(msg);
      setTimeout(() => setToastMsg(null), 2500);
    };

    // 初始化加载名士列表与快捷网站
    useEffect(() => {
      let isMounted = true;
      const init = async () => {
        try {
          if (window.loadAllCinemaCharacters) {
            const list = await window.loadAllCinemaCharacters();
            if (isMounted && list && list.length > 0) {
              setCharacters(list);
              setSelectedCharName(list[0].name);
            }
          }
        } catch (e) {}

        const sc = await loadDbShortcuts();
        if (isMounted) setShortcuts(sc);
      };
      init();
      return () => { isMounted = false; };
    }, []);

    // 切换名士时加载该名士的搜索足迹、往昔历史与专属往来信札
    useEffect(() => {
      let isMounted = true;
      const loadRecords = async () => {
        const records = await loadCharRecords(selectedCharName);
        if (isMounted) {
          setCharRecords(records);
          const hist = await loadCharHistory(selectedCharName);
          setHistoryBatches(hist);
          const mails = await loadCharMails(selectedCharName);
          setCharMails(mails || []);
        }
      };
      loadRecords();
      setActiveReadingMail(null);
      return () => { isMounted = false; };
    }, [selectedCharName]);

    // 当前选中的名士对象
    const currentChar = useMemo(() => {
      return characters.find(c => c.name === selectedCharName) || characters[0];
    }, [characters, selectedCharName]);

    // AI 生成名士最新搜索足迹
    const handleTriggerAiGenerate = async () => {
      if (isAiGenerating) return;
      setIsAiGenerating(true);
      showToast(`✨ 正在调阅「${currentChar.name}」近30条密讯与人设推演...`);
      try {
        const newRecords = await generateCharacterSearchFootprints(currentChar);
        if (!newRecords || newRecords.length === 0) {
          throw new Error('模型未返回有效搜索数据');
        }
        setCharRecords(newRecords);
        await saveCharRecords(currentChar.name, newRecords);
        const updatedHist = await saveCharHistoryBatch(currentChar.name, newRecords);
        setHistoryBatches(updatedHist);
        showToast(`✅ 已更新「${currentChar.name}」最新私密搜索与网页快照！`);
      } catch (err) {
        console.error('[NuoBrowser] 探秘异常:', err);
        const errMsg = err && err.message ? err.message : '请检查设置中的API配置';
        showToast(`❌ 生成失败: ${errMsg}`);
      } finally {
        setIsAiGenerating(false);
      }
    };

    // 点击某条搜索足迹进入仿真网页浏览
    const handleOpenRecordSnapshot = (rec) => {
      const simUrl = `https://nuo-cloud.guangling/search?q=${encodeURIComponent(rec.query)}`;
      setActiveSnapshot(rec);
      setCurrentUrl(simUrl);
      setInputUrl(rec.query);
      setIsNewTab(false);

      // 维护历史
      const newHist = historyList.slice(0, historyIndex + 1);
      newHist.push({ url: simUrl, title: rec.pageTitle, snapshot: rec });
      setHistoryList(newHist);
      setHistoryIndex(newHist.length - 1);
    };

    // 自由输入网址或普通搜索
    const handleNavigate = (target, title) => {
      let finalUrl = target.trim();
      if (!finalUrl) return;

      // 若在地址栏输入 mail 或广陵邮驿地址，则直接切入 Nuo Mail 邮箱界面
      if (finalUrl.toLowerCase() === 'mail' || finalUrl.includes('mail.guangling.gov')) {
        handleOpenMailHub();
        return;
      }

      const isWeb = finalUrl.startsWith('http://') || finalUrl.startsWith('https://');
      const fakeRec = {
        query: finalUrl,
        searchTime: '刚刚',
        pageTitle: title || (isWeb ? finalUrl : `关于「${finalUrl}」的广陵网络探索`),
        sourceSite: isWeb ? '外部网络站点' : '广陵天机阁 · 综合搜索',
        snapshotSnippet: isWeb
          ? `该站点已在云镜中建立安全连接。因部分现代外网同源限制，如遇白屏可轻点右上角「新窗口全尺寸打开」进行真实浏览。`
          : `正在天机阁全网检索与「${finalUrl}」相关的名士情报、律法案卷与市井见闻。已定位相关条目 32 条。`,
        privateNote: `「${currentChar.name}」在云镜旁静静注视着你的这次探索。`
      };

      setActiveSnapshot(fakeRec);
      setCurrentUrl(finalUrl);
      setInputUrl(finalUrl);
      setIsNewTab(false);

      const newHist = historyList.slice(0, historyIndex + 1);
      newHist.push({ url: finalUrl, title: fakeRec.pageTitle, snapshot: fakeRec });
      setHistoryList(newHist);
      setHistoryIndex(newHist.length - 1);
    };

    const handleInputSubmit = (e) => {
      e.preventDefault();
      handleNavigate(inputUrl);
    };

    const handleGoHome = () => {
      setIsNewTab(true);
      setIsMailView(false);
      setActiveReadingMail(null);
      setCurrentUrl('');
      setInputUrl('');
      setActiveSnapshot(null);
    };

    const handleBackNav = () => {
      if (historyIndex > 0) {
        const prev = historyList[historyIndex - 1];
        setHistoryIndex(historyIndex - 1);
        setCurrentUrl(prev.url);
        setInputUrl(prev.snapshot ? prev.snapshot.query : prev.url);
        setActiveSnapshot(prev.snapshot || null);
        setIsNewTab(false);
      } else {
        handleGoHome();
      }
    };

    const handleForwardNav = () => {
      if (historyIndex < historyList.length - 1) {
        const next = historyList[historyIndex + 1];
        setHistoryIndex(historyIndex + 1);
        setCurrentUrl(next.url);
        setInputUrl(next.snapshot ? next.snapshot.query : next.url);
        setActiveSnapshot(next.snapshot || null);
        setIsNewTab(false);
      }
    };

    const handleAddShortcut = async (e) => {
      e.preventDefault();
      if (!newTitle.trim() || !newUrl.trim()) return;
      let url = newUrl.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      const randomColor = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      const item = {
        id: `sc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: newTitle.trim(),
        url,
        letter: newTitle.trim().slice(0, 2).toUpperCase(),
        bgColor: randomColor,
        textColor: '#FFFFFF'
      };
      await saveDbShortcut(item);
      const updated = await loadDbShortcuts();
      setShortcuts(updated);
      setNewTitle('');
      setNewUrl('');
      setShowAddModal(false);
      showToast('✅ 快捷网站已添加至本地数据库');
    };

    const handleDeleteShortcut = async (id) => {
      // 1. 立即乐观更新界面状态，带来清脆删除手感
      setShortcuts(prev => prev.filter(s => s.id !== id));
      // 2. 双重持久化删除
      await deleteDbShortcut(id);
      const updated = await loadDbShortcuts();
      setShortcuts(updated);
      showToast('🗑️ 快捷网站已删除');
    };

    const handleOpenExternal = () => {
      // 需求：AI生成出来的网址往往无法直接在外部打开，因此默认以百度搜索该标题/搜索词
      const searchTitle = (activeSnapshot && (activeSnapshot.pageTitle || activeSnapshot.query)) || inputUrl || (currentChar ? `${currentChar.name} 代号鸢` : '代号鸢');
      const target = `https://www.baidu.com/s?wd=${encodeURIComponent(searchTitle)}`;
      window.open(target, '_blank', 'noopener,noreferrer');
    };

    // ------------------------------------------------------------------------
    // Nuo Mail 交互与渲染引擎 (Gmail 桌面风 · 浅紫现代轻拟物)
    // ------------------------------------------------------------------------
    const handleOpenMailHub = () => {
      setIsMailView(true);
      setActiveReadingMail(null);
      loadCharMails(selectedCharName).then(mails => {
        setCharMails(mails || []);
      });
      showToast(`✉️ 已进入「${selectedCharName}」的私密收件箱`);
    };

    const handleCloseMailHub = () => {
      setIsMailView(false);
      setActiveReadingMail(null);
    };

    // AI 生成 5~8 封名士专属往来信札 (读入名士自身配置、玩家身份设定、世界书与近30条聊天记录)
    const handleTriggerMailGenerate = async () => {
      if (isMailGenerating) return;
      setIsMailGenerating(true);
      showToast(`✉️ 正在为「${selectedCharName}」联机飞鸽驿馆，生成最新往来信札与生活账单...`);
      try {
        const generated = await generateCharacterMails(currentChar);
        if (Array.isArray(generated) && generated.length > 0) {
          await saveCharMailsBatch(selectedCharName, generated);
          const reloaded = await loadCharMails(selectedCharName);
          setCharMails(reloaded);
          showToast(`✉️ 已收取「${selectedCharName}」最新 ${generated.length} 封机要往来密函与账单！`);
        } else {
          showToast('⚠️ 未能收取到新信札，已保留原有信件');
        }
      } catch (err) {
        console.error('[NuoMail] 生成信件失败:', err);
        showToast(`⚠️ 信件收取异常: ${(err && err.message) || err}`);
      } finally {
        setIsMailGenerating(false);
      }
    };

    const handleToggleStar = async (mailId, e) => {
      if (e) e.stopPropagation();
      const updatedList = charMails.map(m => {
        if (m.id === mailId) {
          const nextStarred = !m.isStarred;
          const updatedMail = { ...m, isStarred: nextStarred };
          updateCharMail(updatedMail).catch(() => {});
          if (activeReadingMail && activeReadingMail.id === mailId) {
            setActiveReadingMail(updatedMail);
          }
          return updatedMail;
        }
        return m;
      });
      setCharMails(updatedList);
    };

    const handleDeleteMail = async (mailId, e) => {
      if (e) e.stopPropagation();
      await deleteCharMail(mailId);
      const updatedList = charMails.filter(m => m.id !== mailId);
      setCharMails(updatedList);
      if (activeReadingMail && activeReadingMail.id === mailId) {
        setActiveReadingMail(null);
      }
      showToast('🗑️ 信札已移入废件箱');
    };

    const handleSendReply = (mail) => {
      if (!replyInput.trim()) {
        showToast('⚠️ 请先输入批复或密令内容');
        return;
      }
      const replyText = replyInput.trim();
      const updatedMail = {
        ...mail,
        replyText: replyText,
        replyTime: '刚刚'
      };
      updateCharMail(updatedMail).catch(() => {});
      setActiveReadingMail(updatedMail);
      setCharMails(charMails.map(m => m.id === mail.id ? updatedMail : m));
      setReplyInput('');
      showToast(`🕊️ 已将楼主手书批复飞鸽传达给「${mail.senderName}」与「${selectedCharName}」！`);
    };

    const handleSendCompose = async () => {
      if (!composeForm.subject.trim() || !composeForm.content.trim()) {
        showToast('⚠️ 请完整填写密函标题与正文');
        return;
      }
      const newMail = {
        id: `mail_${Date.now()}_compose`,
        charName: selectedCharName,
        category: 'primary',
        senderName: '广陵王',
        senderAddress: 'wang@xiuyilou.gov',
        subject: composeForm.subject.trim(),
        dateStr: '刚刚',
        previewText: composeForm.content.trim().slice(0, 50),
        fullContent: composeForm.content.trim(),
        privateMemo: '收到楼主手书指令，定当恪尽职守，办妥此事。',
        attachmentName: '',
        isStarred: true,
        isRead: false,
        timestamp: Date.now()
      };
      await saveCharMailsBatch(selectedCharName, [newMail]);
      const reloaded = await loadCharMails(selectedCharName);
      setCharMails(reloaded);
      setShowComposeModal(false);
      setComposeForm({ subject: '', content: '' });
      showToast(`🕊️ 已将密函加急送达「${selectedCharName}」！`);
    };

    // 渲染信件阅读长卷
    const renderActiveReadingMail = (mail) => {
      return h(
        'div',
        {
          style: {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#FFFFFF',
            overflowY: 'auto',
            padding: '16px 24px'
          }
        },
        // 顶部操作栏
        h(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(220, 210, 235, 0.7)',
              paddingBottom: '12px',
              marginBottom: '16px'
            }
          },
          h(
            'button',
            {
              type: 'button',
              onClick: () => setActiveReadingMail(null),
              style: {
                padding: '5px 12px',
                borderRadius: '14px',
                border: '1px solid rgba(215, 205, 230, 0.8)',
                backgroundColor: '#FAF9FD',
                color: '#4B3F5C',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }
            },
            '← 返回收件箱'
          ),
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            h(
              'span',
              {
                onClick: () => handleToggleStar(mail.id),
                style: { cursor: 'pointer', fontSize: '18px', color: mail.isStarred ? '#F59E0B' : '#C4BDD0' },
                title: mail.isStarred ? '取消绝密星标' : '加为绝密星标'
              },
              mail.isStarred ? '★' : '☆'
            ),
            h(
              'button',
              {
                type: 'button',
                onClick: () => handleDeleteMail(mail.id),
                style: {
                  padding: '4px 10px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#DC2626',
                  fontSize: '11px',
                  cursor: 'pointer'
                }
              },
              '🗑️ 移至废件箱'
            )
          )
        ),

        // 标题
        h(
          'h2',
          {
            style: {
              fontSize: '18px',
              fontWeight: 800,
              color: '#261C33',
              margin: '0 0 14px 0',
              lineHeight: 1.3
            }
          },
          mail.subject
        ),

        // 发件人信息卡片
        h(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              padding: '8px 12px',
              borderRadius: '12px',
              backgroundColor: '#FAF9FD',
              border: '1px solid rgba(230, 220, 245, 0.8)'
            }
          },
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
            h(
              'div',
              {
                style: {
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#8B5CF6',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '15px'
                }
              },
              (mail.senderName || '汉')[0]
            ),
            h(
              'div',
              { style: { display: 'flex', flexDirection: 'column' } },
              h(
                'div',
                { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
                h('span', { style: { fontWeight: 700, fontSize: '13px', color: '#261C33' } }, mail.senderName),
                h('span', { style: { fontSize: '11px', color: '#8A7B9B' } }, `<${mail.senderAddress}>`)
              ),
              h('span', { style: { fontSize: '10px', color: '#7E6B93' } }, `发往：名士「${currentChar.name}」<${currentChar.id || 'noble'}@guangling.gov>`)
            )
          ),
          h('div', { style: { fontSize: '11px', color: '#8A7B9B' } }, mail.dateStr)
        ),

        // 正文长卷（宣纸质感）
        h(
          'div',
          {
            style: {
              backgroundColor: '#FAF7F2',
              border: '1px solid #EADBCE',
              borderRadius: '12px',
              padding: '20px 24px',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02), 0 2px 8px rgba(100, 80, 120, 0.04)',
              marginBottom: '16px',
              lineHeight: 1.8,
              fontSize: '13px',
              color: '#3A2E26',
              fontFamily: "'Songti SC', 'SimSun', serif, -apple-system, sans-serif",
              whiteSpace: 'pre-wrap'
            }
          },
          mail.fullContent
        ),

        // 名士心底私密便笺 (活人感精髓)
        mail.privateMemo && h(
          'div',
          {
            style: {
              backgroundColor: '#FEF9E7',
              border: '1px dashed #E5C378',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '16px',
              boxShadow: '0 2px 6px rgba(229, 195, 120, 0.15)'
            }
          },
          h(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#92400E',
                marginBottom: '4px'
              }
            },
            '📌',
            `「${currentChar.name}」的心底私密便笺 (仅楼主可见)`
          ),
          h(
            'div',
            {
              style: {
                fontSize: '12px',
                color: '#78350F',
                lineHeight: 1.5,
                fontStyle: 'italic'
              }
            },
            `"${mail.privateMemo}"`
          )
        ),

        // 附件组件
        mail.attachmentName && h(
          'div',
          {
            onClick: () => showToast(`📎 已调用广陵秘库验真并调阅附件「${mail.attachmentName}」`),
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              backgroundColor: '#F3EEF8',
              color: '#6B21A8',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: '16px',
              maxWidth: '320px'
            }
          },
          h('span', null, '📎'),
          h('span', null, mail.attachmentName),
          h('span', { style: { fontSize: '10px', color: '#8B5CF6', marginLeft: 'auto' } }, '点击调阅')
        ),

        // 已批复记录
        mail.replyText && h(
          'div',
          {
            style: {
              backgroundColor: '#F3E8FF',
              border: '1px solid #D8B4FE',
              borderRadius: '10px',
              padding: '10px 14px',
              marginBottom: '16px',
              fontSize: '12px',
              color: '#581C87'
            }
          },
          h('div', { style: { fontWeight: 700, marginBottom: '2px' } }, '🕊️ 广陵王手书批复已送达：'),
          h('div', null, mail.replyText)
        ),

        // 底部快速批复输入栏
        h(
          'div',
          {
            style: {
              marginTop: 'auto',
              borderTop: '1px solid rgba(220, 210, 235, 0.7)',
              paddingTop: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }
          },
          h('div', { style: { fontSize: '11px', fontWeight: 600, color: '#655A73' } },
            `以「广陵王」身份手书批复或向「${currentChar.name}」下达密令：`
          ),
          h(
            'div',
            { style: { display: 'flex', gap: '8px' } },
            h('input', {
              type: 'text',
              value: replyInput,
              onChange: (e) => setReplyInput(e.target.value),
              onKeyDown: (e) => { if (e.key === 'Enter') handleSendReply(mail); },
              placeholder: '输入批复内容，例如：账目已知悉，按原定密令行事，勿惊扰世家...',
              style: {
                flex: 1,
                height: '36px',
                borderRadius: '18px',
                border: '1px solid rgba(215, 205, 230, 0.9)',
                padding: '0 14px',
                fontSize: '12px',
                color: '#261C33',
                outline: 'none',
                backgroundColor: '#FAF9FD'
              }
            }),
            h(
              'button',
              {
                type: 'button',
                onClick: () => handleSendReply(mail),
                style: {
                  padding: '0 18px',
                  height: '36px',
                  borderRadius: '18px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }
              },
              '飞鸽发送'
            )
          )
        )
      );
    };

    // ------------------------------------------------------------------------
    // 渲染移动端自适应信件列表视图 (自适应横向分类页签 + 双行信札列表卡片)
    // ------------------------------------------------------------------------
    const renderMailListView = (mails) => {
      return h(
        'div',
        { style: { flex: 1, width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' } },

        // A. 顶部三大分类页签 (自适应横向分布，绝不竖向折字)
        h(
          'div',
          {
            style: {
              display: 'flex',
              borderBottom: '1px solid rgba(220, 210, 235, 0.7)',
              backgroundColor: '#FFFFFF',
              flexShrink: 0
            }
          },
          [
            { key: 'primary', icon: '👑', title: '主要', badge: charMails.filter(m => m.category === 'primary').length },
            { key: 'social', icon: '🏮', title: '社交', badge: charMails.filter(m => m.category === 'social').length },
            { key: 'promotions', icon: '📜', title: '推广账单', badge: charMails.filter(m => m.category === 'promotions').length }
          ].map(tab => {
            const isTabActive = mailCategory === tab.key;
            return h(
              'div',
              {
                key: tab.key,
                onClick: () => setMailCategory(tab.key),
                style: {
                  flex: 1,
                  padding: '10px 4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  borderBottom: isTabActive ? '3px solid #8B5CF6' : '3px solid transparent',
                  backgroundColor: isTabActive ? 'rgba(139, 92, 246, 0.04)' : 'transparent',
                  color: isTabActive ? '#8B5CF6' : '#554A63',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap'
                }
              },
              h('span', { style: { fontSize: '14px' } }, tab.icon),
              h('span', { style: { fontWeight: isTabActive ? 700 : 600, fontSize: '12px' } }, tab.title),
              tab.badge > 0 && h(
                'span',
                {
                  style: {
                    fontSize: '10px',
                    padding: '1px 5px',
                    borderRadius: '8px',
                    backgroundColor: isTabActive ? 'rgba(139, 92, 246, 0.15)' : 'rgba(200, 190, 220, 0.25)',
                    color: isTabActive ? '#8B5CF6' : '#6A5C7A',
                    fontWeight: 'bold'
                  }
                },
                tab.badge
              )
            );
          })
        ),

        // B. 列表工具条：数量与刷新
        h(
          'div',
          {
            style: {
              padding: '6px 12px',
              backgroundColor: '#FAF9FD',
              borderBottom: '1px solid rgba(230, 220, 245, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: '#7E6B93',
              flexShrink: 0
            }
          },
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' } },
            h('span', { style: { fontWeight: 600, whiteSpace: 'nowrap' } }, `共 ${charMails.length} 封往来信札`),
            mailSearchTerm && h('span', { style: { color: '#8B5CF6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, `（搜索："${mailSearchTerm}"）`)
          ),
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 } },
            h(
              'span',
              {
                onClick: () => loadCharMails(selectedCharName).then(setCharMails),
                style: { cursor: 'pointer', color: '#8B5CF6', fontWeight: 600 }
              },
              '🔄 刷新'
            )
          )
        ),

        // C. 信件行滚动流 (双行自适应设计，绝无横向溢出)
        h(
          'div',
          { style: { flex: 1, overflowY: 'auto' } },
          mails.length === 0
            ? h(
                'div',
                {
                  style: {
                    padding: '60px 20px',
                    textAlign: 'center',
                    color: '#8A7B9B',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px'
                  }
                },
                h('span', { style: { fontSize: '36px' } }, '📭'),
                h('div', { style: { fontWeight: 600, fontSize: '14px', color: '#4A3D5C' } }, '此分类下暂无往来信札'),
                h('div', { style: { fontSize: '11px', maxWidth: '300px', lineHeight: 1.5 } },
                  `轻触右上角「✨ 收信 (5-8封)」，可即时联机大汉江湖生态，生成属于「${currentChar.name}」的最新密函与账单。`
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    onClick: handleTriggerMailGenerate,
                    style: {
                      marginTop: '8px',
                      padding: '7px 18px',
                      borderRadius: '16px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }
                  },
                  '✨ 立即收取 5~8 封密函'
                )
              )
            : mails.map(m => {
                const isPrimary = m.category === 'primary';
                const isSocial = m.category === 'social';
                return h(
                  'div',
                  {
                    key: m.id,
                    onClick: () => setActiveReadingMail(m),
                    style: {
                      padding: '10px 12px',
                      borderBottom: '1px solid rgba(230, 225, 240, 0.7)',
                      cursor: 'pointer',
                      backgroundColor: '#FFFFFF',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'background-color 0.1s'
                    },
                    onMouseEnter: (e) => (e.currentTarget.style.backgroundColor = '#F6F2FA'),
                    onMouseLeave: (e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')
                  },
                  // 第一行：星标 + 发件人 + 分类微标签 + 附件标识 + 时间 + 删除
                  h(
                    'div',
                    { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' } },
                    h(
                      'div',
                      { style: { display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' } },
                      h(
                        'span',
                        {
                          onClick: (e) => handleToggleStar(m.id, e),
                          style: {
                            cursor: 'pointer',
                            fontSize: '14px',
                            color: m.isStarred ? '#F59E0B' : '#C4BDD0',
                            lineHeight: 1
                          },
                          title: m.isStarred ? '取消星标' : '加为绝密星标'
                        },
                        m.isStarred ? '★' : '☆'
                      ),
                      h(
                        'span',
                        {
                          style: {
                            fontWeight: 700,
                            fontSize: '13px',
                            color: '#261C33',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }
                        },
                        m.senderName
                      ),
                      h(
                        'span',
                        {
                          style: {
                            fontSize: '9px',
                            padding: '1px 5px',
                            borderRadius: '6px',
                            fontWeight: 600,
                            flexShrink: 0,
                            backgroundColor: isPrimary ? 'rgba(139, 92, 246, 0.12)' : isSocial ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                            color: isPrimary ? '#7C3AED' : isSocial ? '#059669' : '#D97706'
                          }
                        },
                        isPrimary ? '主要' : isSocial ? '社交' : '市井'
                      )
                    ),
                    h(
                      'div',
                      { style: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 } },
                      m.attachmentName && h(
                        'span',
                        { style: { color: '#7C3AED', fontSize: '11px' }, title: `附件: ${m.attachmentName}` },
                        '📎'
                      ),
                      h('span', { style: { fontSize: '10px', color: '#8A7B9B' } }, m.dateStr),
                      h(
                        'span',
                        {
                          onClick: (e) => handleDeleteMail(m.id, e),
                          style: {
                            cursor: 'pointer',
                            fontSize: '11px',
                            color: '#B5A8C5',
                            opacity: 0.7,
                            padding: '1px 3px'
                          },
                          title: '移至废件箱'
                        },
                        '🗑️'
                      )
                    )
                  ),
                  // 第二行：标题与正文摘要预览 (自动截断，单行不换行，保持整洁)
                  h(
                    'div',
                    {
                      style: {
                        fontSize: '11.5px',
                        color: '#261C33',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.4
                      }
                    },
                    h('span', { style: { fontWeight: 600, color: '#3A2E47' } }, m.subject),
                    h('span', { style: { color: '#7E6B93', marginLeft: '6px' } }, m.previewText)
                  )
                );
              })
        )
      );
    };

    // 渲染拟写密函弹窗
    const renderComposeModal = () => {
      if (!showComposeModal) return null;
      return h(
        'div',
        {
          style: {
            position: 'fixed',
            bottom: '20px',
            right: '30px',
            width: '420px',
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.2)',
            border: '1px solid rgba(220, 210, 235, 0.9)',
            zIndex: 100002,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }
        },
        // Header
        h(
          'div',
          {
            style: {
              padding: '10px 16px',
              backgroundColor: '#F3EEF8',
              borderBottom: '1px solid rgba(220, 210, 235, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontWeight: 700,
              fontSize: '13px',
              color: '#381E72'
            }
          },
          h('span', null, `✏️ 拟写密函 · 发往「${currentChar.name}」`),
          h(
            'span',
            {
              onClick: () => setShowComposeModal(false),
              style: { cursor: 'pointer', fontSize: '14px', color: '#8A7B9B' }
            },
            '✕'
          )
        ),
        // Fields
        h(
          'div',
          { style: { padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' } },
          h('div', { style: { fontSize: '11px', color: '#655A73' } },
            `发件人：广陵王 <wang@xiuyilou.gov> ➔ 收件人：${currentChar.name}`
          ),
          h('input', {
            type: 'text',
            value: composeForm.subject,
            onChange: (e) => setComposeForm({ ...composeForm, subject: e.target.value }),
            placeholder: '密函标题...',
            style: {
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(215, 205, 230, 0.8)',
              fontSize: '12px',
              outline: 'none'
            }
          }),
          h('textarea', {
            rows: 5,
            value: composeForm.content,
            onChange: (e) => setComposeForm({ ...composeForm, content: e.target.value }),
            placeholder: '密函正文（书写楼主指令、叮嘱或心意）...',
            style: {
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(215, 205, 230, 0.8)',
              fontSize: '12px',
              outline: 'none',
              resize: 'vertical'
            }
          }),
          h(
            'button',
            {
              type: 'button',
              onClick: handleSendCompose,
              style: {
                alignSelf: 'flex-end',
                padding: '8px 20px',
                borderRadius: '16px',
                border: 'none',
                background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }
            },
            '🕊️ 密函加急送出'
          )
        )
      );
    };

    // ------------------------------------------------------------------------
    // 渲染移动端自适应 · 拟物 Gmail Nuo Mail 主应用 (带抽屉侧边栏)
    // ------------------------------------------------------------------------
    const renderNuoMailApp = () => {
      const filteredMails = charMails.filter(m => {
        if (mailCategory === 'starred') {
          if (!m.isStarred) return false;
        } else if (mailCategory !== 'all') {
          if (m.category !== mailCategory) return false;
        }
        if (mailSearchTerm.trim()) {
          const kw = mailSearchTerm.trim().toLowerCase();
          const match = (m.subject && m.subject.toLowerCase().includes(kw)) ||
                        (m.senderName && m.senderName.toLowerCase().includes(kw)) ||
                        (m.previewText && m.previewText.toLowerCase().includes(kw)) ||
                        (m.fullContent && m.fullContent.toLowerCase().includes(kw)) ||
                        (m.privateMemo && m.privateMemo.toLowerCase().includes(kw));
          if (!match) return false;
        }
        return true;
      });

      const primaryCount = charMails.filter(m => m.category === 'primary').length;
      const socialCount = charMails.filter(m => m.category === 'social').length;
      const promotionsCount = charMails.filter(m => m.category === 'promotions').length;
      const starredCount = charMails.filter(m => m.isStarred).length;

      return h(
        'div',
        {
          style: {
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#FAF9FD',
            color: '#261C33',
            overflow: 'hidden',
            position: 'relative'
          }
        },
        // 1. 移动端自适应顶栏 (Row 1: 侧栏按钮 + 标题 + AI收信 + 返回 + 头像)
        h(
          'div',
          {
            style: {
              height: '48px',
              padding: '0 12px',
              borderBottom: '1px solid rgba(220, 210, 235, 0.6)',
              backgroundColor: '#F3EEF8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              flexShrink: 0
            }
          },
          // 左侧：汉堡按钮（收放侧边栏）与标题
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            h(
              'button',
              {
                type: 'button',
                onClick: () => setIsSidebarOpen(prev => !prev),
                style: {
                  width: '32px',
                  height: '32px',
                  borderRadius: '16px',
                  border: '1px solid rgba(215, 205, 230, 0.8)',
                  backgroundColor: isSidebarOpen ? '#8B5CF6' : '#FFFFFF',
                  color: isSidebarOpen ? '#FFFFFF' : '#4B3F5C',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '15px',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                },
                title: isSidebarOpen ? '收起分类栏' : '展开分类栏'
              },
              isSidebarOpen ? '✕' : '☰'
            ),
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: '5px' } },
              h('span', { style: { fontSize: '18px' } }, '✉️'),
              h('span', { style: { fontWeight: 800, fontSize: '13px', color: '#381E72', letterSpacing: '-0.2px' } }, '机要邮驿'),
              h(
                'span',
                {
                  style: {
                    fontSize: '10px',
                    backgroundColor: 'rgba(139, 92, 246, 0.12)',
                    color: '#6B21A8',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap'
                  }
                },
                `「${currentChar.name}」`
              )
            )
          ),
          // 右侧：紧凑型 AI 收信 + 返回云镜 + 头像
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 } },
            h(
              'button',
              {
                type: 'button',
                onClick: handleTriggerMailGenerate,
                disabled: isMailGenerating,
                style: {
                  padding: '5px 10px',
                  borderRadius: '14px',
                  border: 'none',
                  background: isMailGenerating ? '#9CA3AF' : 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
                  color: '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: isMailGenerating ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 6px rgba(139, 92, 246, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                },
                title: '依据名士配置、用户设定、世界书与近30条聊天记录，生成5~8封大汉江湖往来密函'
              },
              isMailGenerating ? '⏳ 收信中...' : '✨ 收信 (5-8封)'
            ),
            h(
              'button',
              {
                type: 'button',
                onClick: handleCloseMailHub,
                style: {
                  padding: '5px 9px',
                  borderRadius: '14px',
                  border: '1px solid rgba(200, 190, 220, 0.8)',
                  backgroundColor: '#FFFFFF',
                  color: '#4B3F5C',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                },
                title: '返回云镜'
              },
              '← 返回'
            ),
            h(NuoAvatar, {
              avatar: currentChar.avatar,
              name: currentChar.name,
              color: currentChar.avatarColor,
              size: 28
            })
          )
        ),

        // Row 2: 独立搜索胶囊栏（全宽弹性自适应，绝不撑爆屏幕）
        h(
          'div',
          {
            style: {
              padding: '6px 12px 7px',
              backgroundColor: '#F3EEF8',
              borderBottom: '1px solid rgba(220, 210, 235, 0.7)',
              flexShrink: 0
            }
          },
          h(
            'div',
            {
              style: {
                width: '100%',
                height: '32px',
                borderRadius: '16px',
                backgroundColor: '#FFFFFF',
                border: '1px solid rgba(215, 205, 230, 0.9)',
                boxShadow: '0 1px 3px rgba(100, 80, 120, 0.05)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 10px',
                gap: '6px',
                boxSizing: 'border-box'
              }
            },
            h('span', { style: { color: '#8B5CF6', fontSize: '13px' } }, '🔍'),
            h('input', {
              type: 'text',
              value: mailSearchTerm,
              onChange: (e) => setMailSearchTerm(e.target.value),
              placeholder: `搜索「${currentChar.name}」的信札、公文或商肆账单...`,
              style: {
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: '11px',
                color: '#261C33',
                backgroundColor: 'transparent'
              }
            }),
            mailSearchTerm && h(
              'span',
              {
                onClick: () => setMailSearchTerm(''),
                style: { cursor: 'pointer', color: '#9B8EAA', fontSize: '12px', fontWeight: 'bold' }
              },
              '✕'
            )
          )
        ),

        // 2. 主体区 (抽屉侧边栏 + 100% 宽度邮件区)
        h(
          'div',
          {
            style: {
              flex: 1,
              display: 'flex',
              position: 'relative',
              overflow: 'hidden'
            }
          },
          // 手机端遮罩层：展开侧边栏时轻触背景即可快速收回
          isSidebarOpen && h(
            'div',
            {
              onClick: () => setIsSidebarOpen(false),
              style: {
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(25, 15, 40, 0.45)',
                backdropFilter: 'blur(3px)',
                zIndex: 900,
                transition: 'opacity 0.2s ease'
              }
            }
          ),

          // 抽屉式侧边栏 (默认收起，点 ☰ 呼出，点分类或 ✕ 自动收起)
          isSidebarOpen && h(
            'div',
            {
              style: {
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: '240px',
                maxWidth: '82%',
                backgroundColor: '#F7F4FB',
                borderRight: '1px solid rgba(220, 210, 235, 0.9)',
                boxShadow: '4px 0 20px rgba(70, 40, 90, 0.25)',
                zIndex: 901,
                padding: '14px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                overflowY: 'auto'
              }
            },
            // 抽屉顶栏
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid rgba(220, 210, 235, 0.6)' } },
              h('span', { style: { fontSize: '12px', fontWeight: 700, color: '#381E72' } }, '📁 机要信箱分类'),
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => setIsSidebarOpen(false),
                  style: { border: 'none', background: 'none', color: '#8A7B9B', fontSize: '14px', cursor: 'pointer', padding: '2px 6px' }
                },
                '✕'
              )
            ),
            // 拟写密函按钮
            h(
              'button',
              {
                type: 'button',
                onClick: () => {
                  setIsSidebarOpen(false);
                  setShowComposeModal(true);
                },
                style: {
                  width: '100%',
                  padding: '9px 14px',
                  borderRadius: '18px',
                  border: 'none',
                  backgroundColor: '#E8DEF8',
                  color: '#381E72',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(100, 80, 120, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }
              },
              h('span', { style: { fontSize: '15px' } }, '✏️'),
              '拟写密函'
            ),
            // 分类导航文件夹
            h(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 } },
              [
                { key: 'all', icon: '📥', label: '收件箱', count: charMails.length },
                { key: 'primary', icon: '👑', label: '机要公文', count: primaryCount },
                { key: 'social', icon: '🏮', label: '江湖同袍', count: socialCount },
                { key: 'promotions', icon: '📜', label: '市井账单', count: promotionsCount },
                { key: 'starred', icon: '⭐', label: '绝密星标', count: starredCount }
              ].map(folder => {
                const isSel = mailCategory === folder.key;
                return h(
                  'div',
                  {
                    key: folder.key,
                    onClick: () => {
                      setMailCategory(folder.key);
                      setActiveReadingMail(null);
                      setIsSidebarOpen(false); // 选中分类后自动收回侧边栏
                    },
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '14px',
                      cursor: 'pointer',
                      backgroundColor: isSel ? 'rgba(139, 92, 246, 0.16)' : 'transparent',
                      color: isSel ? '#4A154B' : '#554A63',
                      fontWeight: isSel ? 700 : 500,
                      fontSize: '12px'
                    }
                  },
                  h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                    h('span', null, folder.icon),
                    folder.label
                  ),
                  folder.count > 0 && h(
                    'span',
                    {
                      style: {
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '10px',
                        backgroundColor: isSel ? '#8B5CF6' : 'rgba(180, 170, 200, 0.25)',
                        color: isSel ? '#FFFFFF' : '#6A5C7A'
                      }
                    },
                    folder.count
                  )
                );
              })
            ),
            // 名士卡片
            h(
              'div',
              {
                style: {
                  padding: '9px 10px',
                  borderRadius: '10px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid rgba(220, 210, 235, 0.7)',
                  fontSize: '10px',
                  color: '#655A73'
                }
              },
              h('div', { style: { fontWeight: 'bold', color: '#381E72', marginBottom: '2px' } }, `名士：${currentChar.name}`),
              h('div', { style: { color: '#8A7B9B', lineHeight: 1.3 } }, `${currentChar.mbti || ''} · ${currentChar.constellation || ''}`),
              h('div', { style: { fontSize: '9px', color: '#10B981', marginTop: '3px', fontWeight: 600 } }, '● 广陵机要署加密信道正常')
            )
          ),

          // 右侧邮件主列表区 (独占 100% 宽度，完美适配手机屏幕)
          h(
            'div',
            {
              style: {
                flex: 1,
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#FFFFFF',
                overflow: 'hidden'
              }
            },
            activeReadingMail ? renderActiveReadingMail(activeReadingMail) : renderMailListView(filteredMails)
          )
        )
      );
    };

    // --------------------------------------------------------------------------
    // 渲染 UI
    // --------------------------------------------------------------------------
    return h(
      'div',
      {
        style: {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#FAF9FD',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        }
      },

      // Toast 浮动提示条
      toastMsg && h(
        'div',
        {
          style: {
            position: 'fixed',
            top: '70px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, rgba(88,55,104,0.95) 0%, rgba(139,92,246,0.95) 100%)',
            color: '#fff',
            padding: '7px 18px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 'bold',
            zIndex: 100000,
            boxShadow: '0 4px 16px rgba(139,92,246,0.35)',
            pointerEvents: 'none'
          }
        },
        toastMsg
      ),

      // 若处于邮箱视图，则渲染整套 Gmail 桌面风轻拟物 Nuo Mail 界面；否则渲染云镜浏览器主视图
      isMailView
        ? renderNuoMailApp()
        : [
      // 1. Chrome 浅紫拟物顶栏 (Chrome Header)
      h(
        'div',
        {
          style: {
            backgroundColor: '#F3EEF8',
            borderBottom: '1px solid rgba(220, 210, 235, 0.8)',
            padding: '8px 12px 6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            boxShadow: '0 2px 6px rgba(100, 80, 120, 0.05)',
            flexShrink: 0,
            zIndex: 20
          }
        },
        // 第一排：退出、前进后退、刷新、主页、地址栏、真实新窗口
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
          // 退出返回桌面
          h(
            'button',
            {
              type: 'button',
              onClick: onClose,
              style: {
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'rgba(235, 230, 245, 0.9)',
                color: '#524366',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                fontSize: '16px',
                fontWeight: 'bold'
              },
              title: '退出网络探索返回桌面'
            },
            '‹'
          ),
          // 导航控制器
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 } },
            h(
              'button',
              {
                type: 'button',
                onClick: handleBackNav,
                disabled: isNewTab && historyIndex <= 0,
                style: {
                  width: '24px',
                  height: '24px',
                  border: 'none',
                  background: 'none',
                  color: isNewTab && historyIndex <= 0 ? '#C4BDD0' : '#4B3F5C',
                  cursor: isNewTab && historyIndex <= 0 ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px'
                },
                title: '后退'
              },
              '◀'
            ),
            h(
              'button',
              {
                type: 'button',
                onClick: handleForwardNav,
                disabled: historyIndex >= historyList.length - 1,
                style: {
                  width: '24px',
                  height: '24px',
                  border: 'none',
                  background: 'none',
                  color: historyIndex >= historyList.length - 1 ? '#C4BDD0' : '#4B3F5C',
                  cursor: historyIndex >= historyList.length - 1 ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px'
                },
                title: '前进'
              },
              '▶'
            ),
            h(
              'button',
              {
                type: 'button',
                onClick: handleGoHome,
                style: {
                  width: '24px',
                  height: '24px',
                  border: 'none',
                  background: 'none',
                  color: isNewTab ? '#8B5CF6' : '#4B3F5C',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px'
                },
                title: '返回云镜主页'
              },
              '🏠'
            )
          ),

          // Omnibox 极简胶囊地址栏
          h(
            'form',
            {
              onSubmit: handleInputSubmit,
              style: {
                flex: 1,
                height: '32px',
                borderRadius: '16px',
                backgroundColor: '#FFFFFF',
                border: '1px solid rgba(215, 205, 230, 0.9)',
                boxShadow: 'inset 0 1px 2px rgba(100, 80, 120, 0.08)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 10px',
                gap: '6px'
              }
            },
            isNewTab
              ? h('span', { style: { fontWeight: 800, fontSize: '13px', color: '#8B5CF6' } }, '鸢')
              : h('span', { style: { fontSize: '12px' }, title: '安全连接' }, '🛡️'),
            h('input', {
              type: 'text',
              value: inputUrl,
              onChange: (e) => setInputUrl(e.target.value),
              placeholder: '在鸢云镜检索名士见闻或输入网址...',
              style: {
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: '11.5px',
                color: '#2B2338',
                backgroundColor: 'transparent',
                width: '100%'
              }
            }),
            inputUrl && h(
              'button',
              {
                type: 'button',
                onClick: () => setInputUrl(''),
                style: { border: 'none', background: 'none', color: '#A29AA8', cursor: 'pointer', fontSize: '11px' }
              },
              '✕'
            ),
            h(
              'button',
              {
                type: 'button',
                onClick: () => {
                  setIsBookmarked(!isBookmarked);
                  showToast(isBookmarked ? '已取消收藏' : '⭐ 已加入云镜收藏夹');
                },
                style: { border: 'none', background: 'none', color: isBookmarked ? '#F59E0B' : '#A29AA8', cursor: 'pointer' },
                title: '收藏此页'
              },
              isBookmarked ? '★' : '☆'
            )
          ),

          // 真实外部浏览器打开按键
          h(
            'button',
            {
              type: 'button',
              onClick: handleOpenExternal,
              style: {
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'rgba(235, 230, 245, 0.9)',
                color: '#524366',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                fontSize: '13px'
              },
              title: '在外部全尺寸窗口打开'
            },
            '↗'
          )
        ),

        // 第二排：预留 Mail 接口、Images 与快捷书签条
        h(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '2px',
              fontSize: '11px',
              color: '#4B3F5C'
            }
          },
          // 快捷书签滚条
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none' } },
            h('span', { style: { fontWeight: 600, color: '#7E689B', display: 'flex', alignItems: 'center', gap: '3px' } }, '📁 常用:'),
            shortcuts.slice(0, 5).map(sc => h(
              'span',
              {
                key: sc.id,
                onClick: () => handleNavigate(sc.url, sc.title),
                style: {
                  background: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(220, 210, 235, 0.6)',
                  borderRadius: '6px',
                  padding: '1px 6px',
                  cursor: 'pointer',
                  fontSize: '10px',
                  whiteSpace: 'nowrap'
                }
              },
              sc.title
            ))
          ),
          // 预留 Mail 接口与 Images
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, fontWeight: 600 } },
            h('span', { onClick: handleOpenMailHub, style: { cursor: 'pointer', color: '#8B5CF6' }, title: '广陵机要邮驿 · Nuo Mail (名士私密收件箱)' }, '✉️ Mail'),
            h('span', { onClick: () => showToast('🖼️ 密探图鉴画卷枢纽即将接入'), style: { cursor: 'pointer', color: '#655A73' } }, 'Images')
          )
        )
      ),

      // 2. 名士快捷切换横向滚动条 (名士胶囊选择器)
      h(
        'div',
        {
          style: {
            padding: '8px 14px 6px',
            background: 'linear-gradient(180deg, #F9F5FD 0%, #FAF9FD 100%)',
            borderBottom: '1px solid rgba(220, 210, 235, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexShrink: 0
          }
        },
        h(
          'div',
          { style: { display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } },
          characters.map(c => {
            const isSel = selectedCharName === c.name;
            return h(
              'div',
              {
                key: c.id || c.name,
                onClick: () => {
                  setSelectedCharName(c.name);
                  if (!isNewTab) handleGoHome();
                },
                style: {
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 10px',
                  borderRadius: '14px',
                  border: isSel ? '1.5px solid #8B5CF6' : '1px solid rgba(215, 205, 230, 0.6)',
                  background: isSel ? 'linear-gradient(135deg, #F3EEF8 0%, #E9DEFB 100%)' : '#FFFFFF',
                  color: isSel ? '#6B21A8' : '#5D506E',
                  boxShadow: isSel ? '0 2px 6px rgba(139, 92, 246, 0.2)' : 'none',
                  fontSize: '11px',
                  fontWeight: isSel ? 'bold' : 'normal',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }
              },
              h(NuoAvatar, {
                avatar: c.avatar,
                name: c.name,
                color: c.avatarColor || '#8B5CF6',
                size: 16
              }),
              c.name
            );
          })
        ),
        // AI 探秘图标按钮（简约大气）
        h(
          'button',
          {
            onClick: handleTriggerAiGenerate,
            disabled: isAiGenerating,
            title: isAiGenerating ? '推演中...' : `✨ 探秘「${selectedCharName}」私密搜索`,
            style: {
              background: isAiGenerating ? 'rgba(139, 92, 246, 0.4)' : 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
              border: 'none',
              borderRadius: '12px',
              padding: '4px 10px',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: isAiGenerating ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(139, 92, 246, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.15s ease'
            }
          },
          isAiGenerating ? '⏳' : '✨'
        )
      ),

      // 3. 主视窗展示区 (新标签页 vs 仿真网页快照浏览)
      h(
        'div',
        {
          style: {
            flex: 1,
            overflowY: 'auto',
            position: 'relative',
            backgroundColor: '#FAF9FD',
            backgroundImage: 'radial-gradient(circle at 50% 12%, #F5EFFB 0%, #FAF9FD 75%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '16px 14px 30px'
          }
        },

        // A. 新标签页主页 (Chrome New Tab)
        isNewTab ? h(
          'div',
          { style: { width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', alignItems: 'center' } },

          // 鸢云镜 艺术大 Logo 与副标题
          h(
            'div',
            { style: { textAlign: 'center', marginTop: '6px', marginBottom: '18px' } },
            h(
              'h1',
              {
                style: {
                  fontSize: '44px',
                  fontWeight: 800,
                  letterSpacing: '-1px',
                  margin: 0,
                  lineHeight: 1.1,
                  background: 'linear-gradient(135deg, #583768 0%, #8B5CF6 55%, #A78BFA 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 2px 8px rgba(139, 92, 246, 0.15))'
                }
              },
              '鸢云镜'
            ),
            h(
              'div',
              { style: { fontSize: '10px', fontWeight: 600, color: '#8C77A0', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '3px' } },
              `广陵秘网 · 名士「${currentChar.name}」私密云镜`
            )
          ),

          // 核心搜索框胶囊 (带简约大气 AI 图标)
          h(
            'form',
            {
              onSubmit: handleInputSubmit,
              style: {
                width: '100%',
                borderRadius: '24px',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 4px 16px rgba(139, 92, 246, 0.15), 0 1px 3px rgba(0,0,0,0.06)',
                border: '1px solid rgba(220, 210, 235, 0.8)',
                padding: '6px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '20px'
              }
            },
            h('span', { style: { color: '#8B5CF6', fontSize: '14px' } }, '🔍'),
            h('input', {
              type: 'text',
              value: inputUrl,
              onChange: (e) => setInputUrl(e.target.value),
              placeholder: `在鸢云镜检索「${currentChar.name}」关注的事物或输入网址...`,
              style: {
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: '12px',
                color: '#2D2833',
                backgroundColor: 'transparent'
              }
            }),
            h(
              'button',
              {
                type: 'button',
                onClick: handleTriggerAiGenerate,
                disabled: isAiGenerating,
                title: 'AI 探秘搜索',
                style: {
                  border: 'none',
                  borderRadius: '14px',
                  backgroundColor: '#F1EDF8',
                  color: '#6A4D80',
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  cursor: isAiGenerating ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }
              },
              isAiGenerating ? '⏳' : '✨'
            )
          ),

          // 🌟 名士私密搜索足迹专区 (核心活人感与窥探反差萌)
          h(
            'div',
            {
              style: {
                width: '100%',
                borderRadius: '18px',
                background: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(10px)',
                border: '1.5px solid rgba(220, 210, 235, 0.9)',
                boxShadow: '0 4px 14px rgba(100, 80, 120, 0.06)',
                padding: '14px',
                marginBottom: '20px'
              }
            },
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' } },
              h(
                'div',
                { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
                h(NuoAvatar, { avatar: currentChar.avatar, name: currentChar.name, color: currentChar.avatarColor, size: 20 }),
                h('span', { style: { fontSize: '12px', fontWeight: 'bold', color: '#4A3459' } }, `「${currentChar.name}」的私密搜索足迹`),
                h('span', { style: { fontSize: '9.5px', color: '#9D8BAE', background: '#F4EFFB', padding: '1px 6px', borderRadius: '8px' } }, `${currentChar.mbti}`)
              ),
              h(
                'div',
                { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
                h(
                  'button',
                  {
                    type: 'button',
                    onClick: () => {
                      setNetConfig(getRealSearchConfig());
                      setShowNetConfigModal(true);
                    },
                    title: '配置真实网络搜索源 (Tavily/博查/免密内置百科)',
                    style: {
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      background: '#ECFDF5',
                      color: '#059669',
                      fontSize: '10px',
                      fontWeight: 700,
                      borderRadius: '10px',
                      padding: '2px 7px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px'
                    }
                  },
                  '🌐 联网'
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    onClick: async () => {
                      const hist = await loadCharHistory(currentChar.name);
                      setHistoryBatches(hist);
                      setShowHistoryModal(true);
                    },
                    title: '查看过往所有AI生成的搜索记录',
                    style: {
                      border: '1px solid rgba(139, 92, 246, 0.35)',
                      background: '#F5F0FF',
                      color: '#7C3AED',
                      fontSize: '10px',
                      fontWeight: 700,
                      borderRadius: '10px',
                      padding: '2px 7px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px'
                    }
                  },
                  '📜 历史'
                ),
                h('span', { style: { fontSize: '10px', color: '#8B5CF6', fontWeight: 600 } }, '点击阅读快照')
              )
            ),

            // 搜索足迹条目列表
            h(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
              charRecords.map((rec, idx) => h(
                'div',
                {
                  key: idx,
                  onClick: () => handleOpenRecordSnapshot(rec),
                  style: {
                    padding: '9px 12px',
                    borderRadius: '12px',
                    background: '#FFFFFF',
                    border: '1px solid rgba(225, 215, 240, 0.8)',
                    boxShadow: '0 1px 4px rgba(100, 80, 120, 0.04)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }
                },
                h(
                  'div',
                  { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
                  h(
                    'div',
                    { style: { display: 'flex', alignItems: 'center', gap: '5px' } },
                    h('span', { style: { color: rec.isRealSearch ? '#10B981' : '#8B5CF6', fontSize: '11px' } }, rec.isRealSearch ? '🌐' : '🔎'),
                    h('span', { style: { fontSize: '11.5px', fontWeight: 'bold', color: '#3A2E47' } }, rec.query),
                    rec.isRealSearch && h('span', { style: { fontSize: '8.5px', color: '#059669', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '0 4px', borderRadius: '4px', fontWeight: 700 } }, '实时联网')
                  ),
                  h('span', { style: { fontSize: '9px', color: '#A29AA8' } }, rec.searchTime)
                ),
                h(
                  'div',
                  { style: { fontSize: '9.5px', color: '#6A4D80', background: '#FAF5FF', padding: '3px 8px', borderRadius: '6px', borderLeft: '2.5px solid #8B5CF6', display: 'flex', alignItems: 'center', gap: '4px' } },
                  h('span', { style: { fontWeight: 'bold', flexShrink: 0 } }, '密录便签:'),
                  h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, rec.privateNote)
                )
              ))
            )
          ),

          // 拟物快捷网站圆盘网格
          h(
            'div',
            {
              style: {
                width: '100%',
                borderRadius: '18px',
                background: 'rgba(255, 255, 255, 0.75)',
                border: '1px dashed rgba(200, 185, 220, 0.8)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }
            },
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
              h('span', { style: { fontSize: '11.5px', fontWeight: 'bold', color: '#564268' } }, '🌐 常用快捷网站'),
              h(
                'button',
                {
                  onClick: () => setIsEditMode(!isEditMode),
                  style: {
                    border: 'none',
                    borderRadius: '10px',
                    background: isEditMode ? '#EF4444' : 'rgba(235, 230, 245, 0.7)',
                    color: isEditMode ? '#FFFFFF' : '#6A4D80',
                    fontSize: '9.5px',
                    fontWeight: 'bold',
                    padding: '2px 8px',
                    cursor: 'pointer'
                  }
                },
                isEditMode ? '✓ 完成' : '✎ 管理'
              )
            ),

            // 圆盘网格
            h(
              'div',
              {
                style: {
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '12px 6px',
                  justifyItems: 'center'
                }
              },
              shortcuts.map(sc => h(
                'div',
                {
                  key: sc.id,
                  style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', position: 'relative', width: '56px', cursor: 'pointer' }
                },
                isEditMode && h(
                  'button',
                  {
                    type: 'button',
                    onClick: (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteShortcut(sc.id);
                    },
                    style: {
                      position: 'absolute',
                      top: '-6px',
                      right: '0px',
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: '#EF4444',
                      color: '#FFFFFF',
                      border: '1.5px solid #FFFFFF',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 25,
                      boxShadow: '0 2px 5px rgba(0,0,0,0.25)'
                    },
                    title: `删除 ${sc.title}`
                  },
                  '✕'
                ),
                // 拟物圆形底座
                h(
                  'div',
                  {
                    onClick: () => handleNavigate(sc.url, sc.title),
                    style: {
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      backgroundColor: sc.bgColor || '#8B5CF6',
                      color: sc.textColor || '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 800,
                      boxShadow: '0 3px 8px rgba(100, 80, 120, 0.12), inset 0 -2px 4px rgba(0,0,0,0.1), inset 0 2px 3px rgba(255,255,255,0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.7)'
                    }
                  },
                  sc.letter
                ),
                h('span', {
                  onClick: () => handleNavigate(sc.url, sc.title),
                  style: { fontSize: '10px', color: '#4B4255', width: '100%', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
                }, sc.title)
              )),
              // 添加快捷按键
              h(
                'div',
                {
                  onClick: () => setShowAddModal(true),
                  style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '56px', cursor: 'pointer' },
                  title: '添加新快捷网站'
                },
                h(
                  'div',
                  {
                    style: {
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(235, 230, 245, 0.8)',
                      color: '#76628A',
                      border: '1px dashed rgba(160, 140, 185, 0.8)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px'
                    }
                  },
                  '+'
                ),
                h('span', { style: { fontSize: '10px', color: '#76628A' } }, '添加')
              )
            )
          )
        )

        // B. 仿真网页浏览与私密便签卡片 (彻底告别 iframe 白屏)
        : h(
          'div',
          { style: { width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '12px' } },

          // 网页状态栏
          h(
            'div',
            {
              style: {
                backgroundColor: '#FAF5FF',
                border: '1px solid #E9D8FD',
                borderRadius: '12px',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: '#6B46C1'
              }
            },
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' } },
              h('span', null, '🧭'),
              h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 'bold' } },
                activeSnapshot ? activeSnapshot.sourceSite : currentUrl
              )
            ),
            h(
              'button',
              {
                type: 'button',
                onClick: handleOpenExternal,
                style: {
                  border: 'none',
                  backgroundColor: '#8B5CF6',
                  color: '#FFFFFF',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  flexShrink: 0
                }
              },
              '新窗口打开 ↗'
            )
          ),

          // 核心网页详情正文卡片
          h(
            'div',
            {
              style: {
                borderRadius: '18px',
                backgroundColor: '#FFFFFF',
                border: '1px solid rgba(220, 210, 235, 0.9)',
                boxShadow: '0 4px 20px rgba(100, 80, 120, 0.08)',
                padding: '18px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }
            },
            // 标题
            h('h2', { style: { fontSize: '16px', fontWeight: 800, color: '#3A284C', margin: 0, lineHeight: 1.3 } },
              activeSnapshot ? activeSnapshot.pageTitle : currentUrl
            ),
            // 真实联网快照提示条
            activeSnapshot && activeSnapshot.isRealSearch && h(
              'div',
              {
                style: {
                  fontSize: '10.5px',
                  color: '#065F46',
                  background: 'linear-gradient(135deg, #ECFDF5 0%, #F0FDF4 100%)',
                  border: '1px solid #A7F3D0',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }
              },
              h('span', null, '🌐'),
              h('span', null, '已通过互联网真实节点同步最新快照数据'),
              h('span', { style: { marginLeft: 'auto', color: '#059669', fontWeight: 'bold', fontSize: '9.5px' } }, '实时联网')
            ),
            // 元信息
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '10px', color: '#8E7CA1', borderBottom: '1px solid #F1EBF7', paddingBottom: '8px' } },
              h('span', null, `🌐 来源: ${activeSnapshot ? activeSnapshot.sourceSite : '天机阁索引'}`),
              h('span', null, `⏱️ 记录于: ${activeSnapshot ? activeSnapshot.searchTime : '刚刚'}`)
            ),
            // 快照正文段落
            h('div', { style: { fontSize: '12.5px', lineHeight: 1.6, color: '#4D3E5E' } },
              activeSnapshot ? activeSnapshot.snapshotSnippet : '已载入指定站点。'
            ),

            // ⭐ 灵魂高亮：名士私密心事便签 (以拟物手写便签呈现)
            activeSnapshot && activeSnapshot.privateNote && h(
              'div',
              {
                style: {
                  marginTop: '6px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #FFFDF5 0%, #FFF8E7 100%)',
                  border: '1.5px dashed #E5C384',
                  boxShadow: '0 3px 10px rgba(214, 168, 110, 0.15)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }
              },
              h(
                'div',
                { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
                h(
                  'div',
                  { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
                  h(NuoAvatar, { avatar: currentChar.avatar, name: currentChar.name, color: currentChar.avatarColor, size: 18 }),
                  h('span', { style: { fontSize: '11px', fontWeight: 'bold', color: '#8C5E28' } }, `「${currentChar.name}」的私藏心事手记`)
                ),
                h('span', { style: { fontSize: '10px' } }, '📌 仅广陵王可见')
              ),
              h('div', { style: { fontSize: '11.5px', color: '#684518', lineHeight: 1.5, fontStyle: 'italic' } },
                `“${activeSnapshot.privateNote}”`
              )
            ),

            // 返回按钮
            h(
              'div',
              { style: { display: 'flex', justifyContent: 'flex-end', marginTop: '10px' } },
              h(
                'button',
                {
                  onClick: handleGoHome,
                  style: {
                    border: 'none',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #F3EEF8 0%, #E9DEFB 100%)',
                    color: '#6B21A8',
                    padding: '6px 14px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }
                },
                '← 返回云镜探索首页'
              )
            )
          )
        )
      ),

          ],

      // 拟写密函模态框
      renderComposeModal(),
      // 4. 添加快捷网站模态弹窗
      showAddModal && h(
        'div',
        {
          style: {
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            padding: '20px'
          }
        },
        h(
          'div',
          {
            style: {
              width: '100%',
              maxWidth: '300px',
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '20px',
              boxShadow: '0 12px 36px rgba(0,0,0,0.22)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }
          },
          h(
            'div',
            { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
            h('span', { style: { fontSize: '14px', fontWeight: 800, color: '#3A2E47' } }, '添加快捷网站'),
            h('button', { onClick: () => setShowAddModal(false), style: { border: 'none', background: 'none', cursor: 'pointer', color: '#8C77A0' } }, '✕')
          ),
          h(
            'form',
            { onSubmit: handleAddShortcut, style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
            h('div', null,
              h('label', { style: { fontSize: '11px', color: '#665C73', fontWeight: 600 } }, '网站名称'),
              h('input', {
                type: 'text',
                required: true,
                value: newTitle,
                onChange: (e) => setNewTitle(e.target.value),
                placeholder: '例如：百度、GitHub、广陵公署',
                style: { width: '100%', padding: '8px 10px', borderRadius: '10px', border: '1px solid #D5CCE0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', marginTop: '4px' }
              })
            ),
            h('div', null,
              h('label', { style: { fontSize: '11px', color: '#665C73', fontWeight: 600 } }, '网址 (URL)'),
              h('input', {
                type: 'text',
                required: true,
                value: newUrl,
                onChange: (e) => setNewUrl(e.target.value),
                placeholder: 'https://...',
                style: { width: '100%', padding: '8px 10px', borderRadius: '10px', border: '1px solid #D5CCE0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', marginTop: '4px' }
              })
            ),
            h(
              'div',
              { style: { display: 'flex', gap: '8px', marginTop: '6px' } },
              h('button', {
                type: 'button',
                onClick: () => setShowAddModal(false),
                style: { flex: 1, padding: '8px 0', borderRadius: '10px', border: '1px solid #D5CCE0', backgroundColor: '#F5F2F8', color: '#554A63', fontSize: '12px', cursor: 'pointer' }
              }, '取消'),
              h('button', {
                type: 'submit',
                style: { flex: 1, padding: '8px 0', borderRadius: '10px', border: 'none', backgroundColor: '#8B5CF6', color: '#FFFFFF', fontSize: '12px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 3px 8px rgba(139, 92, 246, 0.3)' }
              }, '保存至数据库')
            )
          )
        )
      ),

      // 5. 往昔搜索历史弹窗 (历史查看)
      showHistoryModal && h(
        'div',
        {
          style: {
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(25, 18, 35, 0.45)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            padding: '16px'
          },
          onClick: (e) => {
            if (e.target === e.currentTarget) setShowHistoryModal(false);
          }
        },
        h(
          'div',
          {
            style: {
              width: '100%',
              maxWidth: '380px',
              maxHeight: '80vh',
              backgroundColor: '#FAF9FD',
              borderRadius: '22px',
              border: '1.5px solid rgba(220, 210, 235, 0.95)',
              boxShadow: '0 16px 40px rgba(50, 30, 80, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }
          },
          // 弹窗顶栏
          h(
            'div',
            {
              style: {
                padding: '14px 16px',
                borderBottom: '1px solid rgba(225, 215, 240, 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, #FAF8FE 0%, #F3EDFA 100%)'
              }
            },
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
              h(NuoAvatar, { avatar: currentChar.avatar, name: currentChar.name, color: currentChar.avatarColor, size: 24 }),
              h('div', null,
                h('div', { style: { fontSize: '13px', fontWeight: 800, color: '#3A284C' } }, `「${currentChar.name}」往昔搜索历史`),
                h('div', { style: { fontSize: '9.5px', color: '#8A759E' } }, `已记录 ${historyBatches.reduce((acc, b) => acc + (b.records ? b.records.length : 0), 0)} 条私密搜索`)
              )
            ),
            h(
              'button',
              {
                onClick: () => setShowHistoryModal(false),
                style: {
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: 'rgba(215, 205, 230, 0.5)',
                  color: '#655577',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }
              },
              '✕'
            )
          ),
          // 弹窗提示与清空操作条
          historyBatches.length > 0 && h(
            'div',
            {
              style: {
                padding: '6px 14px',
                background: '#F7F3FB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #ECE4F5',
                fontSize: '10px',
                color: '#8A759E'
              }
            },
            h('span', null, '💡 轻触任意条目即可立即阅读网页快照'),
            h(
              'button',
              {
                type: 'button',
                onClick: async () => {
                  await clearCharHistory(currentChar.name);
                  setHistoryBatches([]);
                  showToast('🗑️ 已清空该名士往昔历史');
                },
                style: {
                  border: 'none',
                  background: 'none',
                  color: '#EF4444',
                  fontSize: '10px',
                  cursor: 'pointer',
                  padding: '2px 4px'
                }
              },
              '清空历史'
            )
          ),
          // 列表内容区
          h(
            'div',
            {
              style: {
                flex: 1,
                overflowY: 'auto',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }
            },
            historyBatches.length === 0
              ? h(
                'div',
                { style: { padding: '36px 16px', textAlign: 'center', color: '#9B8CAE', fontSize: '11px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' } },
                h('span', { style: { fontSize: '26px' } }, '📜'),
                h('span', null, `暂无「${currentChar.name}」的往昔搜索留痕`),
                h('span', { style: { fontSize: '9.5px', color: '#B3A6C4' } }, '每次点击「✨」探秘后，推演记录都会自动归档至此')
              )
              : historyBatches.map((batch) => h(
                'div',
                {
                  key: batch.id,
                  style: {
                    borderRadius: '14px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid rgba(225, 215, 240, 0.9)',
                    padding: '10px 12px',
                    boxShadow: '0 2px 6px rgba(100, 80, 120, 0.04)'
                  }
                },
                h(
                  'div',
                  { style: { fontSize: '10px', fontWeight: 700, color: '#8B5CF6', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' } },
                  h('span', null, '🕒'),
                  h('span', null, batch.dateStr || '过往记录')
                ),
                h(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
                  (batch.records || []).map((rec, rIdx) => h(
                    'div',
                    {
                      key: rIdx,
                      onClick: () => {
                        handleOpenRecordSnapshot(rec);
                        setShowHistoryModal(false);
                      },
                      style: {
                        padding: '6px 8px',
                        borderRadius: '8px',
                        backgroundColor: '#FAF7FD',
                        border: '1px solid #EFE8F6',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        transition: 'background 0.15s ease'
                      }
                    },
                    h(
                      'div',
                      { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
                      h('span', { style: { fontSize: '11px', fontWeight: 'bold', color: '#3A2E47' } }, `🔎 ${rec.query}`),
                      h('span', { style: { fontSize: '9px', color: '#A29AA8' } }, rec.searchTime)
                    ),
                    h('div', { style: { fontSize: '9px', color: '#6A4D80', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, `便签: ${rec.privateNote}`)
                  ))
                )
              ))
          )
        )
      ),

      // 6. 真实网络搜索配置弹窗 (方向1: 虚实双轨联网)
      showNetConfigModal && h(
        'div',
        {
          style: {
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(25, 18, 35, 0.45)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            padding: '16px'
          },
          onClick: (e) => {
            if (e.target === e.currentTarget) setShowNetConfigModal(false);
          }
        },
        h(
          'div',
          {
            style: {
              width: '100%',
              maxWidth: '340px',
              backgroundColor: '#FFFFFF',
              borderRadius: '22px',
              border: '1.5px solid rgba(220, 210, 235, 0.95)',
              boxShadow: '0 16px 40px rgba(50, 30, 80, 0.25)',
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }
          },
          h(
            'div',
            { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
              h('span', { style: { fontSize: '15px' } }, '🌐'),
              h('span', { style: { fontSize: '14px', fontWeight: 800, color: '#3A2E47' } }, '真实联网搜索配置')
            ),
            h('button', {
              onClick: () => setShowNetConfigModal(false),
              style: { border: 'none', background: 'none', cursor: 'pointer', color: '#8C77A0', fontSize: '14px' }
            }, '✕')
          ),
          h('div', { style: { fontSize: '10.5px', color: '#6A5C7A', lineHeight: 1.5 } },
            '开启后，名士探秘将自动检索真实互联网网页与百科知识，虚实双轨呈现真实网页快照。'
          ),
          // 开关
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#F8F6FC', borderRadius: '12px' } },
            h('span', { style: { fontSize: '11.5px', fontWeight: 600, color: '#3A2E47' } }, '真实网络检索增强'),
            h('input', {
              type: 'checkbox',
              checked: netConfig.enabled !== false,
              onChange: (e) => {
                const updated = { ...netConfig, enabled: e.target.checked };
                setNetConfig(updated);
                saveRealSearchConfig(updated);
              },
              style: { cursor: 'pointer', width: '16px', height: '16px' }
            })
          ),
          // 引擎选择
          h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
            h('label', { style: { fontSize: '10.5px', fontWeight: 600, color: '#4D3E5E' } }, '联网数据节点源'),
            h(
              'select',
              {
                value: netConfig.provider || 'builtin',
                onChange: (e) => {
                  const updated = { ...netConfig, provider: e.target.value };
                  setNetConfig(updated);
                  saveRealSearchConfig(updated);
                },
                style: {
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '10px',
                  border: '1px solid #D5CCE0',
                  fontSize: '11px',
                  outline: 'none',
                  backgroundColor: '#FFFFFF',
                  color: '#3A2E47'
                }
              },
              h('option', { value: 'builtin' }, '免密内置百科网络 (零配置·即开即用)'),
              h('option', { value: 'tavily' }, 'Tavily AI Search (全球全网深度检索)'),
              h('option', { value: 'bocha' }, '博查 Bocha AI (中文互联网全网搜索)')
            )
          ),
          // API Key 输入框 (当选择 Tavily 或 Bocha 时)
          (netConfig.provider === 'tavily' || netConfig.provider === 'bocha') && h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
            h('label', { style: { fontSize: '10.5px', fontWeight: 600, color: '#4D3E5E' } }, `${netConfig.provider === 'tavily' ? 'Tavily' : '博查'} API Key`),
            h('input', {
              type: 'password',
              value: netConfig.apiKey || '',
              onChange: (e) => {
                const updated = { ...netConfig, apiKey: e.target.value.trim() };
                setNetConfig(updated);
              },
              placeholder: 'tvly-... 或 bocha-...',
              style: {
                width: '100%',
                padding: '7px 10px',
                borderRadius: '10px',
                border: '1px solid #D5CCE0',
                fontSize: '11px',
                outline: 'none',
                boxSizing: 'border-box'
              }
            }),
            h('span', { style: { fontSize: '9px', color: '#9D8BAE' } }, '免费在官网注册即可获取，留空将自动降级为内置免密网络')
          ),
          h(
            'button',
            {
              type: 'button',
              onClick: () => {
                saveRealSearchConfig(netConfig);
                setShowNetConfigModal(false);
                showToast('✅ 联网搜索配置已保存');
              },
              style: {
                marginTop: '4px',
                padding: '8px 0',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
                color: '#FFFFFF',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 3px 10px rgba(139, 92, 246, 0.3)'
              }
            },
            '保存联网配置'
          )
        )
      )
    );
  };

  // 全局暴露
  global.NuoBrowserAppModal = NuoBrowserAppModal;
  global.parseMailsFromLLM = parseMailsFromLLM;
  global.extractObjects = extractObjects;
  global.generateCharacterMails = generateCharacterMails;

})(typeof window !== 'undefined' ? window : this);
