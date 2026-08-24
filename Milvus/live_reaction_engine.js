/**
 * Milvus Ambient Particle Effects Engine (灵犀生境 · 全屏沉浸式环境氛围粒子引擎)
 * 纯前端毫秒级情境意图捕获与全屏前景粒子氛围调度器
 */
(function () {
  const STORAGE_KEY = "ambient_effects_enabled";
  const DISPLAY_DURATION_MS = 5000; // 5 秒持续时间
  const FADE_OUT_DURATION_MS = 800; // 0.8 秒平滑淡出

  // 1. 5 大高频自然与情感氛围字典库
  const AMBIENT_EFFECTS = [
    {
      id: "rain",
      name: "细雨微濛",
      keywords: /(?:下雨|雨天|淋雨|大雨|细雨|毛毛雨|阵雨|雨水|淅沥|打伞|雨声|落雨|避雨)/i,
      tint: "rgba(100, 130, 160, 0.12)",
      particleCount: 65,
      createParticle: (i, count) => {
        const drop = document.createElement("div");
        drop.className = "ambient-particle-rain";
        const left = Math.random() * 100;
        const height = 18 + Math.random() * 22; // 18px ~ 40px
        const duration = 0.45 + Math.random() * 0.45; // 0.45s ~ 0.9s
        const delay = Math.random() * 2.0; // 0 ~ 2.0s
        const opacity = 0.4 + Math.random() * 0.6;

        drop.style.left = left + "vw";
        drop.style.height = height + "px";
        drop.style.animationDuration = duration + "s";
        drop.style.animationDelay = delay + "s";
        drop.style.opacity = opacity;
        return drop;
      }
    },
    {
      id: "snow",
      name: "飞雪漫天",
      keywords: /(?:下雪|雪花|大雪|飘雪|初雪|雪天|雪景|鹅毛大雪|好冷|天冷|寒冷|冻僵|结冰|积雪|下雪了|好冷啊|冷死)/i,
      tint: "rgba(200, 220, 245, 0.12)",
      particleCount: 42,
      createParticle: (i, count) => {
        const flake = document.createElement("div");
        flake.className = "ambient-particle-snow";
        const left = Math.random() * 100;
        const size = 4 + Math.random() * 7; // 4px ~ 11px
        const duration = 2.2 + Math.random() * 2.5; // 2.2s ~ 4.7s
        const delay = Math.random() * 2.2;
        const opacity = 0.5 + Math.random() * 0.5;

        flake.style.left = left + "vw";
        flake.style.width = size + "px";
        flake.style.height = size + "px";
        flake.style.animationDuration = duration + "s";
        flake.style.animationDelay = delay + "s";
        flake.style.opacity = opacity;
        return flake;
      }
    },
    {
      id: "night",
      name: "星汉璀璨",
      keywords: /(?:晚安|夜深|星空|星星|月亮|月色|深夜|好梦|入睡|夜色|繁星|星辰|夜阑|星河|睡吧|歇息吧|夜幕)/i,
      tint: "linear-gradient(180deg, rgba(15, 23, 60, 0.38) 0%, rgba(30, 40, 80, 0.18) 100%)",
      particleCount: 38,
      extraElement: () => {
        const moon = document.createElement("div");
        moon.className = "ambient-moon";
        moon.innerHTML = "🌙";
        return moon;
      },
      createParticle: (i, count) => {
        const star = document.createElement("div");
        star.className = "ambient-particle-star";
        const top = Math.random() * 85; // 0 ~ 85vh
        const left = Math.random() * 100;
        const size = 2 + Math.random() * 4; // 2px ~ 6px
        const duration = 0.9 + Math.random() * 2.0; // 0.9s ~ 2.9s
        const delay = Math.random() * 2.0;

        star.style.top = top + "vh";
        star.style.left = left + "vw";
        star.style.width = size + "px";
        star.style.height = size + "px";
        star.style.animationDuration = duration + "s";
        star.style.animationDelay = delay + "s";
        return star;
      }
    },
    {
      id: "petals",
      name: "落樱缤纷",
      keywords: /(?:樱花|花瓣|桃花|春天|落花|花开|花落|飘花|落英缤纷|梨花|花海|赏花|花枝|杏花|繁花)/i,
      tint: "rgba(255, 210, 220, 0.1)",
      particleCount: 32,
      createParticle: (i, count) => {
        const petal = document.createElement("div");
        petal.className = "ambient-particle-petal";
        const left = -5 + Math.random() * 105;
        const size = 14 + Math.random() * 12; // 14px ~ 26px
        const duration = 2.8 + Math.random() * 2.6; // 2.8s ~ 5.4s
        const delay = Math.random() * 2.0;
        const emojis = ["🌸", "🌸", "🌸", "💮", "🌺"];
        const selected = emojis[Math.floor(Math.random() * emojis.length)];

        petal.innerHTML = selected;
        petal.style.left = left + "vw";
        petal.style.fontSize = size + "px";
        petal.style.animationDuration = duration + "s";
        petal.style.animationDelay = delay + "s";
        petal.style.opacity = 0.8 + Math.random() * 0.2;
        return petal;
      }
    },
    {
      id: "hearts",
      name: "心旌微漾",
      keywords: /(?:心动|喜欢你|爱你|么么哒|亲亲|表白|告白|恋爱|好喜欢|爱死你|比心|mua|心悦|动心|喜欢|抱抱|亲一口|吻|好爱|心跳)/i,
      tint: "rgba(255, 160, 190, 0.1)",
      particleCount: 26,
      createParticle: (i, count) => {
        const heart = document.createElement("div");
        heart.className = "ambient-particle-heart";
        const left = 5 + Math.random() * 90;
        const size = 16 + Math.random() * 16; // 16px ~ 32px
        const duration = 2.4 + Math.random() * 2.2; // 2.4s ~ 4.6s
        const delay = Math.random() * 2.2;
        const emojis = ["💖", "❤️", "💕", "💗", "✨"];
        const selected = emojis[Math.floor(Math.random() * emojis.length)];

        heart.innerHTML = selected;
        heart.style.left = left + "vw";
        heart.style.fontSize = size + "px";
        heart.style.animationDuration = duration + "s";
        heart.style.animationDelay = delay + "s";
        return heart;
      }
    },
    {
      id: "heat",
      name: "酷暑热浪",
      keywords: /(?:好热|天热|酷暑|太阳|热死|热浪|晒死|高温|炎热|桑拿天|像蒸笼|热炸了|好晒|太热|好烫)/i,
      tint: "linear-gradient(0deg, rgba(255, 120, 10, 0.14) 0%, rgba(255, 200, 50, 0.05) 100%)",
      particleCount: 36,
      createParticle: (i, count) => {
        if (i < 22) {
          // 热气流模糊竖纹
          const heat = document.createElement("div");
          heat.className = "ambient-particle-heat";
          const left = Math.random() * 100;
          const height = 40 + Math.random() * 50; // 40px ~ 90px
          const duration = 1.8 + Math.random() * 1.8; // 1.8s ~ 3.6s
          const delay = Math.random() * 2.2;

          heat.style.left = left + "vw";
          heat.style.height = height + "px";
          heat.style.animationDuration = duration + "s";
          heat.style.animationDelay = delay + "s";
          return heat;
        } else {
          // 升腾火星粒子
          const spark = document.createElement("div");
          spark.className = "ambient-particle-spark";
          const left = 5 + Math.random() * 90;
          const size = 12 + Math.random() * 14;
          const duration = 1.6 + Math.random() * 1.6;
          const delay = Math.random() * 2.0;
          const emojis = ["🔥", "✨", "☀️", "🔥"];
          spark.innerHTML = emojis[Math.floor(Math.random() * emojis.length)];

          spark.style.left = left + "vw";
          spark.style.fontSize = size + "px";
          spark.style.animationDuration = duration + "s";
          spark.style.animationDelay = delay + "s";
          return spark;
        }
      }
    },
    {
      id: "leaves",
      name: "秋风落叶",
      keywords: /(?:落叶|秋天|秋风|枫叶|金秋|叶落|萧瑟|深秋|层林尽染|金叶|落红|叶黄|起风了|秋意|一叶知秋)/i,
      tint: "rgba(180, 90, 20, 0.08)",
      particleCount: 34,
      createParticle: (i, count) => {
        const leaf = document.createElement("div");
        leaf.className = "ambient-particle-leaf";
        const left = -5 + Math.random() * 105;
        const size = 15 + Math.random() * 13; // 15px ~ 28px
        const duration = 3.5 + Math.random() * 2.5; // 3.5s ~ 6.0s
        const delay = Math.random() * 2.4;
        const emojis = ["🍂", "🍁", "🍃", "🍂", "🍁"];
        const selected = emojis[Math.floor(Math.random() * emojis.length)];

        leaf.innerHTML = selected;
        leaf.style.left = left + "vw";
        leaf.style.fontSize = size + "px";
        leaf.style.animationDuration = duration + "s";
        leaf.style.animationDelay = delay + "s";
        leaf.style.opacity = 0.8 + Math.random() * 0.2;
        return leaf;
      }
    },
    {
      id: "ocean",
      name: "海浪涌动",
      keywords: /(?:大海|海浪|海边|沙滩|波浪|海水|潮声|浪花|冲浪|听海|海风|海鸥|退潮|涨潮|乘风破浪|海洋)/i,
      tint: "linear-gradient(0deg, rgba(14, 165, 233, 0.16) 0%, rgba(56, 189, 248, 0.04) 60%)",
      particleCount: 46,
      createParticle: (i, count) => {
        const bubble = document.createElement("div");
        bubble.className = "ambient-particle-bubble";
        const left = Math.random() * 100;
        const size = 6 + Math.random() * 16; // 6px ~ 22px
        const duration = 2.2 + Math.random() * 2.6; // 2.2s ~ 4.8s
        const delay = Math.random() * 2.2;
        const opacity = 0.6 + Math.random() * 0.4;

        bubble.style.left = left + "vw";
        bubble.style.width = size + "px";
        bubble.style.height = size + "px";
        bubble.style.animationDuration = duration + "s";
        bubble.style.animationDelay = delay + "s";
        bubble.style.opacity = opacity;
        return bubble;
      }
    },
    {
      id: "fireworks",
      name: "节日烟花",
      keywords: /(?:烟花|过年|庆祝|新年快乐|生日快乐|恭喜|节日快乐|撒花|庆功|元旦|中秋|璀璨|放烟花|放炮|大吉大利|放彩带|花火)/i,
      tint: "rgba(10, 20, 50, 0.25)",
      particleCount: 5, // 5 个多点爆炸核心
      createParticle: (clusterIndex, totalClusters) => {
        const cluster = document.createElement("div");
        cluster.className = "ambient-firework-cluster";

        const top = 15 + Math.random() * 55; // 15% ~ 70%
        const left = 15 + Math.random() * 70; // 15% ~ 85%
        cluster.style.top = top + "vh";
        cluster.style.left = left + "vw";

        const colors = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#C77DFF", "#F472B6", "#FBBF24"];
        const clusterColor = colors[clusterIndex % colors.length];
        const rayCount = 16;
        const baseDelay = clusterIndex * 0.4 + Math.random() * 0.2; // 各核心错开时机

        for (let r = 0; r < rayCount; r++) {
          const ray = document.createElement("div");
          ray.className = "ambient-particle-firework";
          const deg = (360 / rayCount) * r + (Math.random() * 10 - 5);
          const dist = 55 + Math.random() * 45; // 55px ~ 100px
          const rayDuration = 1.1 + Math.random() * 0.4;

          ray.style.setProperty("--rot", deg + "deg");
          ray.style.setProperty("--dist", dist + "px");
          ray.style.background = `linear-gradient(180deg, #FFFFFF 0%, ${clusterColor} 100%)`;
          ray.style.boxShadow = `0 0 8px ${clusterColor}`;
          ray.style.animationDuration = rayDuration + "s";
          ray.style.animationDelay = baseDelay + "s";

          cluster.appendChild(ray);
        }

        return cluster;
      }
    },
    {
      id: "mist",
      name: "缥缈薄雾",
      keywords: /(?:薄雾|迷雾|仙境|云雾|如梦|缥缈|烟雨|朦胧|白茫茫|雾气弥漫|雾里看花|如烟|梦中|大雾|雾霭|仙气)/i,
      tint: "rgba(255, 255, 255, 0.14)",
      particleCount: 10,
      createParticle: (i, count) => {
        const mist = document.createElement("div");
        mist.className = "ambient-particle-mist";
        const top = 10 + Math.random() * 75;
        const left = -15 + Math.random() * 115;
        const size = 100 + Math.random() * 90; // 100px ~ 190px
        const duration = 4.5 + Math.random() * 3.5; // 4.5s ~ 8.0s
        const delay = Math.random() * 2.0;

        mist.style.top = top + "vh";
        mist.style.left = left + "vw";
        mist.style.width = size + "px";
        mist.style.height = size + "px";
        mist.style.animationDuration = duration + "s";
        mist.style.animationDelay = delay + "s";
        return mist;
      }
    },
    {
      id: "coins",
      name: "财源滚滚",
      keywords: /(?:发财|暴富|红包|金币|赚钱|买买买|有钱|金子|富婆|财富|发大财|恭喜发财|压岁钱|涨工资|数钱|财运|大把大把)/i,
      tint: "linear-gradient(180deg, rgba(251, 191, 36, 0.16) 0%, rgba(245, 158, 11, 0.05) 100%)",
      particleCount: 42,
      createParticle: (i, count) => {
        if (i < 26) {
          const coin = document.createElement("div");
          coin.className = "ambient-particle-coin";
          const left = -5 + Math.random() * 105;
          const size = 16 + Math.random() * 14; // 16px ~ 30px
          const duration = 1.6 + Math.random() * 1.6; // 1.6s ~ 3.2s
          const delay = Math.random() * 2.2;
          const emojis = ["💰", "🪙", "💵", "💎", "🪙"];
          coin.innerHTML = emojis[Math.floor(Math.random() * emojis.length)];

          coin.style.left = left + "vw";
          coin.style.fontSize = size + "px";
          coin.style.animationDuration = duration + "s";
          coin.style.animationDelay = delay + "s";
          return coin;
        } else {
          const spark = document.createElement("div");
          spark.className = "ambient-particle-gold-sparkle";
          const left = Math.random() * 100;
          const size = 4 + Math.random() * 6;
          const duration = 1.4 + Math.random() * 1.4;
          const delay = Math.random() * 2.2;

          spark.style.left = left + "vw";
          spark.style.width = size + "px";
          spark.style.height = size + "px";
          spark.style.animationDuration = duration + "s";
          spark.style.animationDelay = delay + "s";
          return spark;
        }
      }
    },
    {
      id: "cheers",
      name: "举杯欢聚",
      keywords: /(?:干杯|喝酒|微醺|聚餐|畅饮|啤酒|把酒言欢|敬一杯|喝一杯|酒馆|不醉不归|饮酒|小酌|cheers|酒逢知己|碰杯)/i,
      tint: "linear-gradient(0deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.04) 60%)",
      particleCount: 38,
      extraElement: () => {
        const cups = document.createElement("div");
        cups.className = "ambient-cheers-center";
        cups.innerHTML = "🍻";
        return cups;
      },
      createParticle: (i, count) => {
        const bubble = document.createElement("div");
        bubble.className = "ambient-particle-champagne";
        const left = 5 + Math.random() * 90;
        const size = 4 + Math.random() * 12; // 4px ~ 16px
        const duration = 1.5 + Math.random() * 1.8; // 1.5s ~ 3.3s
        const delay = Math.random() * 2.2;

        bubble.style.left = left + "vw";
        bubble.style.width = size + "px";
        bubble.style.height = size + "px";
        bubble.style.animationDuration = duration + "s";
        bubble.style.animationDelay = delay + "s";
        return bubble;
      }
    },
    {
      id: "tea",
      name: "暖茶袅袅",
      keywords: /(?:喝茶|品茗|热茶|下午茶|咖啡|暖胃|清茶|煮茶|泡茶|茶道|新茶|绿茶|红茶|奶茶|暖和一下|茶香)/i,
      tint: "linear-gradient(0deg, rgba(120, 80, 40, 0.10) 0%, rgba(180, 140, 90, 0.03) 100%)",
      particleCount: 16,
      extraElement: () => {
        const tea = document.createElement("div");
        tea.className = "ambient-tea-cup";
        tea.innerHTML = "🍵";
        return tea;
      },
      createParticle: (i, count) => {
        const steam = document.createElement("div");
        steam.className = "ambient-particle-steam";
        const left = 35 + Math.random() * 30; // 聚焦在中央茶杯上方
        const width = 30 + Math.random() * 40; // 30px ~ 70px
        const height = 50 + Math.random() * 60; // 50px ~ 110px
        const duration = 3.0 + Math.random() * 2.5; // 3.0s ~ 5.5s
        const delay = Math.random() * 2.5;

        steam.style.left = left + "vw";
        steam.style.width = width + "px";
        steam.style.height = height + "px";
        steam.style.animationDuration = duration + "s";
        steam.style.animationDelay = delay + "s";
        return steam;
      }
    },
    {
      id: "sleepy",
      name: "困意哈欠",
      keywords: /(?:好困|打瞌睡|困了|想睡觉|哈欠|迷迷糊糊|困死|睡意|眼皮打架|好困啊|困倦|迷糊|眯一会儿|困意|呵欠)/i,
      tint: "linear-gradient(180deg, rgba(99, 102, 241, 0.12) 0%, rgba(168, 85, 247, 0.08) 100%)",
      particleCount: 22,
      createParticle: (i, count) => {
        if (i < 16) {
          const zzz = document.createElement("div");
          zzz.className = "ambient-particle-zzz";
          const left = 10 + Math.random() * 75;
          const size = 16 + Math.random() * 16; // 16px ~ 32px
          const duration = 3.0 + Math.random() * 2.2;
          const delay = Math.random() * 2.5;
          const letters = ["Z", "z", "Zzz", "zZz", "💤"];
          zzz.innerHTML = letters[Math.floor(Math.random() * letters.length)];

          zzz.style.left = left + "vw";
          zzz.style.fontSize = size + "px";
          zzz.style.animationDuration = duration + "s";
          zzz.style.animationDelay = delay + "s";
          return zzz;
        } else {
          const cloud = document.createElement("div");
          cloud.className = "ambient-particle-cloud";
          const left = 5 + Math.random() * 85;
          const top = 10 + Math.random() * 35;
          const size = 26 + Math.random() * 22;
          const duration = 3.5 + Math.random() * 2.5;
          const delay = Math.random() * 2.0;
          cloud.innerHTML = "☁️";

          cloud.style.left = left + "vw";
          cloud.style.top = top + "vh";
          cloud.style.fontSize = size + "px";
          cloud.style.animationDuration = duration + "s";
          cloud.style.animationDelay = delay + "s";
          return cloud;
        }
      }
    },
    {
      id: "angry",
      name: "暴躁抓狂",
      keywords: /(?:气死|抓狂|暴躁|烦死了|炸毛|生气|火大|掀桌|气死我了|恼火|想打人|怒了|忍无可忍|崩溃了|火冒三丈|发飙)/i,
      tint: "radial-gradient(circle at center, rgba(239, 68, 68, 0.05) 30%, rgba(220, 38, 38, 0.18) 100%)",
      particleCount: 38,
      createParticle: (i, count) => {
        if (i < 18) {
          const anger = document.createElement("div");
          anger.className = "ambient-particle-anger";
          const left = 8 + Math.random() * 84;
          const top = 12 + Math.random() * 76;
          const size = 20 + Math.random() * 18;
          const delay = Math.random() * 1.8;
          const symbols = ["💢", "💥", "⚡", "💢", "🔥"];
          anger.innerHTML = symbols[Math.floor(Math.random() * symbols.length)];

          anger.style.left = left + "vw";
          anger.style.top = top + "vh";
          anger.style.fontSize = size + "px";
          anger.style.animationDelay = delay + "s";
          return anger;
        } else {
          const spark = document.createElement("div");
          spark.className = "ambient-particle-spark-red";
          const left = 10 + Math.random() * 80;
          const top = 15 + Math.random() * 70;
          const deg = Math.random() * 360;
          const delay = Math.random() * 1.8;

          spark.style.left = left + "vw";
          spark.style.top = top + "vh";
          spark.style.setProperty("--rot", deg + "deg");
          spark.style.animationDelay = delay + "s";
          return spark;
        }
      }
    },
    {
      id: "slash",
      name: "刀光剑影",
      keywords: /(?:拔剑|出剑|战斗|杀伐|斩断|破敌|刀剑|一剑|亮剑|受死|交锋|挥剑|击溃|斩首|剑法|刀光|刀剑无眼)/i,
      tint: "linear-gradient(135deg, rgba(15, 23, 42, 0.28) 0%, rgba(8, 47, 73, 0.15) 100%)",
      particleCount: 30,
      createParticle: (i, count) => {
        if (i < 4) {
          const blade = document.createElement("div");
          blade.className = "ambient-sword-blade";
          const degs = [-35, 45, -60, 25];
          const tops = [35, 55, 45, 65];
          blade.style.top = tops[i] + "vh";
          blade.style.setProperty("--slash-deg", degs[i] + "deg");
          blade.style.animationDelay = (i * 0.38) + "s";
          return blade;
        } else {
          const spark = document.createElement("div");
          spark.className = "ambient-particle-slash-spark";
          const left = 35 + Math.random() * 30;
          const top = 35 + Math.random() * 30;
          const deg = Math.random() * 360;
          const dist = 35 + Math.random() * 45;
          const delay = (i % 4) * 0.38 + Math.random() * 0.2;

          spark.style.left = left + "vw";
          spark.style.top = top + "vh";
          spark.style.setProperty("--rot", deg + "deg");
          spark.style.setProperty("--dist", dist + "px");
          spark.style.animationDelay = delay + "s";
          return spark;
        }
      }
    },
    {
      id: "array",
      name: "奇门阵法",
      keywords: /(?:结界|符咒|阵法|施法|奇门|阴阳|遁甲|八卦|破阵|启阵|乾坤|天罡|封印|布阵|咒文|太极)/i,
      tint: "radial-gradient(circle at center, rgba(147, 51, 234, 0.18) 0%, rgba(30, 10, 60, 0.12) 100%)",
      particleCount: 32,
      extraElement: () => {
        const core = document.createElement("div");
        core.className = "ambient-array-core";
        return core;
      },
      createParticle: (i, count) => {
        const rune = document.createElement("div");
        rune.className = "ambient-particle-rune";
        const runes = ["乾", "坤", "震", "巽", "坎", "离", "艮", "兑", "☯", "✦", "天", "地"];
        const left = 20 + Math.random() * 60;
        const top = 40 + Math.random() * 35;
        const size = 18 + Math.random() * 16;
        const delay = Math.random() * 2.8;

        rune.innerHTML = runes[Math.floor(Math.random() * runes.length)];
        rune.style.left = left + "vw";
        rune.style.top = top + "vh";
        rune.style.fontSize = size + "px";
        rune.style.animationDelay = delay + "s";
        return rune;
      }
    },
    {
      id: "intel",
      name: "密令朱印",
      keywords: /(?:密令|密探|情报|绣衣|暗号|机密|飞鸽传书|刺探|据点|密报|暗探|密函|谍报|绝密|耳目|密使)/i,
      tint: "linear-gradient(180deg, rgba(20, 15, 15, 0.22) 0%, rgba(153, 27, 27, 0.10) 100%)",
      particleCount: 28,
      extraElement: () => {
        const stamp = document.createElement("div");
        stamp.className = "ambient-seal-stamp";
        stamp.innerHTML = "【绝密】";
        return stamp;
      },
      createParticle: (i, count) => {
        if (i < 20) {
          const paper = document.createElement("div");
          paper.className = "ambient-particle-intel-paper";
          const left = -5 + Math.random() * 105;
          const w = 12 + Math.random() * 18;
          const h = 8 + Math.random() * 14;
          const duration = 2.5 + Math.random() * 2.5;
          const delay = Math.random() * 2.2;

          paper.style.left = left + "vw";
          paper.style.width = w + "px";
          paper.style.height = h + "px";
          paper.style.animationDuration = duration + "s";
          paper.style.animationDelay = delay + "s";
          return paper;
        } else {
          const feather = document.createElement("div");
          feather.className = "ambient-particle-feather";
          const left = 5 + Math.random() * 90;
          const duration = 3.5 + Math.random() * 2.5;
          const delay = Math.random() * 2.0;

          feather.innerHTML = "🪶";
          feather.style.left = left + "vw";
          feather.style.animationDuration = duration + "s";
          feather.style.animationDelay = delay + "s";
          return feather;
        }
      }
    },
    {
      id: "bloodmoon",
      name: "血月戮夜",
      keywords: /(?:血月|绝杀|死战|伏击|嗜血|斩草除根|不死不休|同归于尽|杀气|修罗|血战|喋血|杀无赦|屠戮|喋血残阳)/i,
      tint: "radial-gradient(circle at center, rgba(220, 38, 38, 0.14) 0%, rgba(69, 10, 10, 0.36) 100%)",
      particleCount: 28,
      extraElement: () => {
        const moon = document.createElement("div");
        moon.className = "ambient-blood-moon";
        return moon;
      },
      createParticle: (i, count) => {
        if (i < 12) {
          const mist = document.createElement("div");
          mist.className = "ambient-particle-blood-mist";
          const left = -10 + Math.random() * 110;
          const size = 90 + Math.random() * 90;
          const duration = 3.5 + Math.random() * 2.5;
          const delay = Math.random() * 2.0;

          mist.style.left = left + "vw";
          mist.style.width = size + "px";
          mist.style.height = size + "px";
          mist.style.animationDuration = duration + "s";
          mist.style.animationDelay = delay + "s";
          return mist;
        } else {
          const spark = document.createElement("div");
          spark.className = "ambient-particle-spark-red";
          const left = 10 + Math.random() * 80;
          const top = 20 + Math.random() * 65;
          const deg = Math.random() * 360;
          const delay = Math.random() * 2.0;

          spark.style.left = left + "vw";
          spark.style.top = top + "vh";
          spark.style.setProperty("--rot", deg + "deg");
          spark.style.animationDelay = delay + "s";
          return spark;
        }
      }
    },
    {
      id: "shield",
      name: "金钟护体",
      keywords: /(?:保护|防御|护体|挡住|守住|结界护身|护盾|有我在|别怕|护你周全|安然无恙|防守|抵挡|护卫|有我在呢)/i,
      tint: "radial-gradient(circle at center, rgba(251, 191, 36, 0.18) 25%, rgba(217, 119, 6, 0.05) 85%)",
      particleCount: 24,
      extraElement: () => {
        const barrier = document.createElement("div");
        barrier.className = "ambient-shield-barrier";
        return barrier;
      },
      createParticle: (i, count) => {
        if (i < 4) {
          const ripple = document.createElement("div");
          ripple.className = "ambient-shield-ripple";
          ripple.style.animationDelay = (i * 0.55) + "s";
          return ripple;
        } else {
          const spark = document.createElement("div");
          spark.className = "ambient-particle-gold-sparkle";
          const left = 10 + Math.random() * 80;
          const top = 15 + Math.random() * 70;
          const size = 5 + Math.random() * 7;
          const duration = 1.6 + Math.random() * 1.6;
          const delay = Math.random() * 2.2;

          spark.style.left = left + "vw";
          spark.style.top = top + "vh";
          spark.style.width = size + "px";
          spark.style.height = size + "px";
          spark.style.animationDuration = duration + "s";
          spark.style.animationDelay = delay + "s";
          return spark;
        }
      }
    },
    {
      id: "lanterns",
      name: "天灯祈愿",
      keywords: /(?:孔明灯|放天灯|放灯|祈福|祈愿|心愿|天灯|许愿灯|求签|上香|福星高照|所求皆所愿)/i,
      tint: "linear-gradient(180deg, rgba(20, 15, 35, 0.35) 0%, rgba(120, 53, 15, 0.15) 100%)",
      particleCount: 30,
      createParticle: (i, count) => {
        if (i < 10) {
          const lantern = document.createElement("div");
          lantern.className = "ambient-particle-lantern";
          const left = 5 + Math.random() * 85;
          const size = 30 + Math.random() * 26; // 30px ~ 56px
          const duration = 3.5 + Math.random() * 2.5; // 3.5s ~ 6.0s
          const delay = Math.random() * 2.5;
          const emojis = ["🏮", "🪔", "🏮"];
          lantern.innerHTML = emojis[Math.floor(Math.random() * emojis.length)];

          lantern.style.left = left + "vw";
          lantern.style.fontSize = size + "px";
          lantern.style.animationDuration = duration + "s";
          lantern.style.animationDelay = delay + "s";
          return lantern;
        } else {
          const spark = document.createElement("div");
          spark.className = "ambient-particle-gold-sparkle";
          const left = Math.random() * 100;
          const size = 3 + Math.random() * 5;
          const duration = 2.5 + Math.random() * 2.5;
          const delay = Math.random() * 2.5;

          spark.style.left = left + "vw";
          spark.style.width = size + "px";
          spark.style.height = size + "px";
          spark.style.animationDuration = duration + "s";
          spark.style.animationDelay = delay + "s";
          return spark;
        }
      }
    },
    {
      id: "butterflies",
      name: "灵蝶蹁跹",
      keywords: /(?:蝴蝶|庄周梦蝶|梦蝶|蹁跹|蝶影|幻蝶|彩蝶|蝶恋花|化蝶|蝶舞|灵蝶)/i,
      tint: "radial-gradient(circle at center, rgba(168, 85, 247, 0.12) 0%, rgba(59, 130, 246, 0.06) 100%)",
      particleCount: 26,
      createParticle: (i, count) => {
        if (i < 6) {
          const cluster = document.createElement("div");
          cluster.className = "ambient-butterfly-cluster";
          const left = 15 + Math.random() * 70;
          const top = 25 + Math.random() * 55;
          const size = 26 + Math.random() * 18;
          const delay = Math.random() * 2.0;

          cluster.innerHTML = `<span class="ambient-butterfly-wing" style="font-size:${size}px">🦋</span>`;
          cluster.style.left = left + "vw";
          cluster.style.top = top + "vh";
          cluster.style.animationDelay = delay + "s";
          return cluster;
        } else {
          const spark = document.createElement("div");
          spark.className = "ambient-particle-gold-sparkle";
          const left = 10 + Math.random() * 80;
          const top = 20 + Math.random() * 60;
          const size = 4 + Math.random() * 6;
          const delay = Math.random() * 2.5;

          spark.style.left = left + "vw";
          spark.style.top = top + "vh";
          spark.style.width = size + "px";
          spark.style.height = size + "px";
          spark.style.animationDelay = delay + "s";
          return spark;
        }
      }
    },
    {
      id: "lotus",
      name: "清塘荷韵",
      keywords: /(?:荷花|荷塘|莲花|水波|涟漪|采莲|荷叶|荷韵|映日荷花|出水芙蓉|青莲|池塘)/i,
      tint: "linear-gradient(0deg, rgba(20, 184, 166, 0.12) 0%, rgba(16, 185, 129, 0.04) 60%)",
      particleCount: 22,
      createParticle: (i, count) => {
        if (i < 4) {
          const ripple = document.createElement("div");
          ripple.className = "ambient-water-ripple";
          const left = 18 + i * 22;
          const width = 60 + Math.random() * 40;
          ripple.style.left = left + "%";
          ripple.style.width = width + "px";
          ripple.style.height = (width * 0.45) + "px";
          ripple.style.animationDelay = (i * 0.75) + "s";
          return ripple;
        } else {
          const lotus = document.createElement("div");
          lotus.className = "ambient-particle-lotus";
          const left = 8 + Math.random() * 84;
          const size = 20 + Math.random() * 16;
          const delay = Math.random() * 2.0;
          const emojis = ["🪷", "🌸", "🪷", "🍃"];
          lotus.innerHTML = emojis[Math.floor(Math.random() * emojis.length)];

          lotus.style.left = left + "vw";
          lotus.style.fontSize = size + "px";
          lotus.style.animationDelay = delay + "s";
          return lotus;
        }
      }
    },
    {
      id: "bamboo",
      name: "竹影幽风",
      keywords: /(?:竹林|幽静|清幽|翠竹|竹影|隐居|听风|竹叶|竹海|竹影摇曳|修竹|墨竹)/i,
      tint: "linear-gradient(135deg, rgba(22, 101, 52, 0.12) 0%, rgba(20, 83, 45, 0.04) 100%)",
      particleCount: 36,
      createParticle: (i, count) => {
        const leaf = document.createElement("div");
        leaf.className = "ambient-particle-bamboo";
        const left = -10 + Math.random() * 115;
        const w = 18 + Math.random() * 16;
        const h = 5 + Math.random() * 4;
        const duration = 2.2 + Math.random() * 2.2;
        const delay = Math.random() * 2.4;

        leaf.style.left = left + "vw";
        leaf.style.width = w + "px";
        leaf.style.height = h + "px";
        leaf.style.animationDuration = duration + "s";
        leaf.style.animationDelay = delay + "s";
        return leaf;
      }
    },
    {
      id: "meteors",
      name: "璀璨流星",
      keywords: /(?:流星|流星雨|流星划过|星愿|陨石|划破长空|夜空流星|对着流星许愿)/i,
      tint: "linear-gradient(180deg, rgba(15, 23, 42, 0.38) 0%, rgba(30, 27, 75, 0.20) 100%)",
      particleCount: 22,
      createParticle: (i, count) => {
        if (i < 6) {
          const meteor = document.createElement("div");
          meteor.className = "ambient-particle-meteor";
          const left = 45 + Math.random() * 65; // 从右上方划过
          const top = -10 + Math.random() * 40;
          const length = 100 + Math.random() * 80;
          const duration = 0.8 + Math.random() * 0.5;
          const delay = i * 0.45 + Math.random() * 0.2;

          meteor.style.left = left + "vw";
          meteor.style.top = top + "vh";
          meteor.style.width = length + "px";
          meteor.style.animationDuration = duration + "s";
          meteor.style.animationDelay = delay + "s";
          return meteor;
        } else {
          const star = document.createElement("div");
          star.className = "ambient-particle-star";
          const top = Math.random() * 85;
          const left = Math.random() * 100;
          const size = 2 + Math.random() * 4;
          const duration = 1.0 + Math.random() * 2.0;

          star.style.top = top + "vh";
          star.style.left = left + "vw";
          star.style.width = size + "px";
          star.style.height = size + "px";
          star.style.animationDuration = duration + "s";
          return star;
        }
      }
    },
    {
      id: "thunder",
      name: "雷电交加",
      keywords: /(?:打雷|闪电|雷阵雨|雷鸣|惊雷|轰鸣|电闪雷鸣|狂风暴雨|霹雳|雷暴|雷霆)/i,
      tint: "linear-gradient(180deg, rgba(30, 41, 59, 0.40) 0%, rgba(15, 23, 42, 0.25) 100%)",
      particleCount: 50,
      extraElement: () => {
        const wrap = document.createElement("div");
        wrap.className = "ambient-thunder-wrapper";

        const flash = document.createElement("div");
        flash.className = "ambient-flash-overlay";

        const bolt = document.createElement("div");
        bolt.className = "ambient-lightning-bolt";
        bolt.style.setProperty("--bolt-deg", (Math.random() * 16 - 8) + "deg");

        wrap.appendChild(flash);
        wrap.appendChild(bolt);
        return wrap;
      },
      createParticle: (i, count) => {
        const drop = document.createElement("div");
        drop.className = "ambient-particle-rain";
        const left = Math.random() * 100;
        const height = 24 + Math.random() * 30; // 狂暴大雨
        const duration = 0.35 + Math.random() * 0.35;
        const delay = Math.random() * 1.5;

        drop.style.left = left + "vw";
        drop.style.height = height + "px";
        drop.style.animationDuration = duration + "s";
        drop.style.animationDelay = delay + "s";
        drop.style.opacity = 0.6 + Math.random() * 0.4;
        return drop;
      }
    },
    {
      id: "sunrise",
      name: "破晓朝阳",
      keywords: /(?:早安|日出|清晨|朝阳|破晓|天亮了|晨曦|东方既白|曙光|旭日东升|迎接朝阳)/i,
      tint: "linear-gradient(0deg, rgba(249, 115, 22, 0.22) 0%, rgba(251, 191, 36, 0.12) 50%, rgba(254, 215, 170, 0.04) 100%)",
      particleCount: 26,
      extraElement: () => {
        const sun = document.createElement("div");
        sun.className = "ambient-sunrise-glow";
        return sun;
      },
      createParticle: (i, count) => {
        const beam = document.createElement("div");
        beam.className = "ambient-particle-sunbeam";
        const left = 5 + Math.random() * 90;
        const size = 6 + Math.random() * 14;
        const duration = 2.5 + Math.random() * 2.5;
        const delay = Math.random() * 2.5;

        beam.style.left = left + "vw";
        beam.style.width = size + "px";
        beam.style.height = size + "px";
        beam.style.animationDuration = duration + "s";
        beam.style.animationDelay = delay + "s";
        return beam;
      }
    },
    {
      id: "rainbow",
      name: "雨后彩虹",
      keywords: /(?:彩虹|天晴了|放晴|雨过天晴|晴空万里|放晴了|七彩|阳光总在风雨后|雨停了)/i,
      tint: "linear-gradient(180deg, rgba(56, 189, 248, 0.12) 0%, rgba(244, 114, 182, 0.06) 100%)",
      particleCount: 24,
      extraElement: () => {
        const rainbow = document.createElement("div");
        rainbow.className = "ambient-rainbow-arch";
        return rainbow;
      },
      createParticle: (i, count) => {
        const spark = document.createElement("div");
        spark.className = "ambient-particle-gold-sparkle";
        const left = 5 + Math.random() * 90;
        const top = 15 + Math.random() * 65;
        const size = 5 + Math.random() * 8;
        const duration = 1.8 + Math.random() * 2.0;
        const delay = Math.random() * 2.2;

        spark.style.left = left + "vw";
        spark.style.top = top + "vh";
        spark.style.width = size + "px";
        spark.style.height = size + "px";
        spark.style.animationDuration = duration + "s";
        spark.style.animationDelay = delay + "s";
        return spark;
      }
    }
  ];

  class AmbientEffectEngine {
    constructor() {
      this.enabled = localStorage.getItem(STORAGE_KEY) !== "false"; // 默认开启
      this.effects = AMBIENT_EFFECTS;
      this.activeOverlay = null;
      this.decayTimer = null;
      this.lastTriggeredText = "";
      this.lastTriggeredTime = 0;

      // 启动自动拦截引擎
      this.initAutoInterceptors();
      this.initDOMInputListener();
    }

    isEnabled() {
      return this.enabled;
    }

    setEnabled(val) {
      this.enabled = !!val;
      localStorage.setItem(STORAGE_KEY, String(this.enabled));
      if (!this.enabled) {
        this.clearActiveEffect();
      }
      console.log(`[AmbientEffect] 动效控制开关已设置为: ${this.enabled ? '开启' : '关闭'}`);
    }

    // 匹配文本中的自然场景或情感意图
    matchEffect(text) {
      if (!text || typeof text !== "string") return null;
      const clean = text.trim();
      if (!clean) return null;
      for (const eff of this.effects) {
        if (eff.keywords.test(clean)) {
          return eff;
        }
      }
      return null;
    }

    // 清除当前正在播放的粒子层
    clearActiveEffect() {
      if (this.decayTimer) {
        clearTimeout(this.decayTimer);
        this.decayTimer = null;
      }
      if (this.activeOverlay) {
        try {
          this.activeOverlay.remove();
        } catch (e) {}
        this.activeOverlay = null;
      }
    }

    // 触发全屏沉浸式粒子氛围
    spawnEffect(effectOrId) {
      if (!this.enabled) return;

      const effect = typeof effectOrId === "string"
        ? this.effects.find(e => e.id === effectOrId)
        : effectOrId;

      if (!effect) return;

      // 如果当前已有正在播放的效果，立即清除以平滑切换
      this.clearActiveEffect();

      // 1. 创建全屏 Overlay 根容器
      const overlay = document.createElement("div");
      overlay.className = "ambient-effect-layer ambient-overlay open";
      overlay.setAttribute("data-effect-id", effect.id);

      // 2. 叠加氛围色调蒙层
      if (effect.tint) {
        const tint = document.createElement("div");
        tint.className = "ambient-tint";
        tint.style.background = effect.tint;
        overlay.appendChild(tint);
      }

      // 3. 创建粒子容器
      const particlesContainer = document.createElement("div");
      particlesContainer.className = "ambient-particles-container";

      // 4. 批量生成粒子 DOM
      const count = effect.particleCount || 40;
      for (let i = 0; i < count; i++) {
        const particle = effect.createParticle(i, count);
        if (particle) {
          if (Array.isArray(particle)) {
            particle.forEach(p => p && particlesContainer.appendChild(p));
          } else {
            particlesContainer.appendChild(particle);
          }
        }
      }

      // 5. 附加特殊元素（如月亮）
      if (typeof effect.extraElement === "function") {
        const extra = effect.extraElement();
        if (extra) {
          particlesContainer.appendChild(extra);
        }
      }

      overlay.appendChild(particlesContainer);

      // 挂载到 body 顶层
      const targetBody = document.body || document.documentElement;
      if (targetBody) {
        targetBody.appendChild(overlay);
        this.activeOverlay = overlay;
      }

      // 6. 持续 5 秒后启动平滑淡出，800ms 后自毁
      this.decayTimer = setTimeout(() => {
        if (overlay) {
          overlay.classList.add("ambient-fade-out");
          setTimeout(() => {
            try {
              overlay.remove();
            } catch (e) {}
            if (this.activeOverlay === overlay) {
              this.activeOverlay = null;
            }
          }, FADE_OUT_DURATION_MS);
        }
      }, DISPLAY_DURATION_MS);

      console.log(`[AmbientEffect] 🌌 触发全屏氛围粒子:「${effect.name}」(${effect.id})，持续 5s`);
    }

    // 智能消息拦截入口（含 1.5s 去重保护）
    onMessage(text) {
      if (!this.enabled || !text || typeof text !== "string") return null;
      const clean = text.trim();
      if (!clean) return null;

      const now = Date.now();
      if (this.lastTriggeredText === clean && (now - this.lastTriggeredTime) < 1500) {
        return null;
      }

      const matched = this.matchEffect(clean);
      if (matched) {
        this.lastTriggeredText = clean;
        this.lastTriggeredTime = now;
        // 延迟 50ms 上屏，配合视觉节奏
        setTimeout(() => {
          this.spawnEffect(matched);
        }, 50);
        return matched;
      }
      return null;
    }

    // 1. 自动挂载 chatHistoryStore 与 sendToLLM 拦截器
    initAutoInterceptors() {
      const tryHookStore = () => {
        if (window.chatHistoryStore && !window.chatHistoryStore.__ambient_hooked) {
          window.chatHistoryStore.__ambient_hooked = true;
          
          // 拦截 saveMessage
          const origSaveMessage = window.chatHistoryStore.saveMessage;
          if (typeof origSaveMessage === "function") {
            window.chatHistoryStore.saveMessage = async (charId, msg) => {
              try {
                if (msg && msg.text && typeof msg.text === "string") {
                  window.liveReactionEngine.onMessage(msg.text);
                }
              } catch (e) {}
              return await origSaveMessage.call(window.chatHistoryStore, charId, msg);
            };
          }

          // 拦截 saveMessages
          const origSaveMessages = window.chatHistoryStore.saveMessages;
          if (typeof origSaveMessages === "function") {
            window.chatHistoryStore.saveMessages = async (charId, msgs) => {
              try {
                if (Array.isArray(msgs) && msgs.length > 0) {
                  const lastMsg = msgs[msgs.length - 1];
                  if (lastMsg && lastMsg.text && typeof lastMsg.text === "string") {
                    window.liveReactionEngine.onMessage(lastMsg.text);
                  }
                }
              } catch (e) {}
              return await origSaveMessages.call(window.chatHistoryStore, charId, msgs);
            };
          }
          console.log("[AmbientEffect] ✅ 已成功接驳 chatHistoryStore 消息引擎");
        }

        // 拦截 sendToLLM
        if (window.sendToLLM && !window.sendToLLM.__ambient_hooked) {
          const origSendToLLM = window.sendToLLM;
          const hookedSendToLLM = async function (messages, customConfigOrChunk, onFinish, onError) {
            // 提取最新一条用户消息
            try {
              if (Array.isArray(messages) && messages.length > 0) {
                const userMsgs = messages.filter(m => m.role === "user");
                if (userMsgs.length > 0) {
                  const lastUser = userMsgs[userMsgs.length - 1];
                  if (lastUser && typeof lastUser.content === "string") {
                    window.liveReactionEngine.onMessage(lastUser.content);
                  }
                }
              }
            } catch (err) {}

            const wrappedOnFinish = (reply) => {
              try {
                if (reply && typeof reply === "string") {
                  window.liveReactionEngine.onMessage(reply);
                }
              } catch (err) {}
              if (typeof onFinish === "function") {
                onFinish(reply);
              }
            };

            return await origSendToLLM(messages, customConfigOrChunk, wrappedOnFinish, onError);
          };
          hookedSendToLLM.__ambient_hooked = true;
          window.sendToLLM = hookedSendToLLM;
          console.log("[AmbientEffect] ✅ 已成功接驳 sendToLLM 对话流引擎");
        }
      };

      tryHookStore();
      const interval = setInterval(tryHookStore, 500);
      setTimeout(() => clearInterval(interval), 15000);
    }

    // 2. DOM 输入与发送按钮监听（回车与点击即时零延迟触发）
    initDOMInputListener() {
      if (typeof document === "undefined") return;

      // 监听回车发送
      document.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          const target = e.target;
          if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
            const val = target.value;
            if (val && typeof val === "string") {
              this.onMessage(val);
            }
          }
        }
      }, true);

      // 监听点击发送按钮
      document.addEventListener("click", (e) => {
        const btn = e.target.closest("button, .chat-send-btn, .ai-trigger-btn");
        if (btn) {
          const container = btn.closest(".chat-input-bar, .chat-input-container, div");
          const input = container ? container.querySelector("textarea, input[type='text']") : null;
          if (input && input.value) {
            this.onMessage(input.value);
          }
        }
      }, true);
    }

    // 开发者测试命令（支持文本如 '下雨了' 或 id 如 'rain'）
    test(keywordOrId = "下雨了") {
      const matched = this.matchEffect(keywordOrId);
      if (matched) {
        this.spawnEffect(matched);
        console.log("✅ [AmbientEffect] 测试触发成功:", matched);
      } else {
        const direct = this.effects.find(e => e.id === keywordOrId);
        if (direct) {
          this.spawnEffect(direct);
          console.log("✅ [AmbientEffect] 按 ID 触发成功:", direct);
        } else {
          console.warn("⚠️ [AmbientEffect] 未能匹配到任何氛围效果:", keywordOrId);
        }
      }
    }
  }

  // 挂载到全局
  const engine = new AmbientEffectEngine();
  window.ambientEffectEngine = engine;
  window.liveReactionEngine = engine; // 保持兼容

  console.log("[AmbientEffect] 灵犀生境全屏环境氛围粒子引擎装载就绪，已加载特效数:", engine.effects.length);
})();
