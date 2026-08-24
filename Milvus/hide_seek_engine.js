/**
 * ==========================================================================
 * 「府邸捉迷藏 / 躲猫猫」高阶互动博弈算法引擎 (Hide & Seek Engine v2.0)
 * 支持：攻守双模式（我藏TA抓 / TA藏我抓）、锦囊道具系统、听香寻踪、心跳危机QTE、情趣赌约
 * ==========================================================================
 */

(function () {
  'use strict';

  // 13 区域拓扑结构 (古风府邸地图)
  const ROOMS = [
    "客厅", "厨房", "小阳台", "大客厅", "大阳台", "庭院",
    "走廊", "浴室", "次卧", "客卧", "书房", "主卧", "主卧浴室"
  ];

  const ANCIENT_ROOM_NAMES = {
    "客厅": "府邸前厅",
    "厨房": "庖厨膳房",
    "小阳台": "临水露台",
    "大客厅": "正殿阔厅",
    "大阳台": "观景外台",
    "庭院": "幽径庭院",
    "走廊": "雕花长廊",
    "浴室": "沐芳浴室",
    "次卧": "暖阁客卧",
    "客卧": "临窗厢房",
    "书房": "墨香书阁",
    "主卧": "锦绣寝殿",
    "主卧浴室": "内寝浴房"
  };

  const ADJ = {
    "客厅": ["厨房", "大客厅", "走廊"],
    "厨房": ["客厅", "小阳台"],
    "小阳台": ["厨房", "浴室"],
    "大客厅": ["客厅", "大阳台"],
    "大阳台": ["大客厅", "庭院"],
    "庭院": ["大阳台"],
    "走廊": ["客厅", "浴室", "次卧", "客卧", "书房", "主卧"],
    "浴室": ["走廊", "小阳台"],
    "次卧": ["走廊"],
    "客卧": ["走廊"],
    "书房": ["走廊"],
    "主卧": ["走廊", "主卧浴室"],
    "主卧浴室": ["主卧"]
  };

  const ROOM_SPOTS = {
    "客厅": ["锦缎沙发后", "紫绡窗帘后"],
    "厨房": ["梨木橱柜里", "冰鉴储物后"],
    "小阳台": [], // 无藏点房间，照面即被抓
    "大客厅": ["红木软榻后", "八宝窗帘后", "紫檀茶几下"],
    "大阳台": [],
    "庭院": ["翠竹林后", "听雨水缸后"],
    "走廊": [],
    "浴室": ["素纱浴帘后"],
    "次卧": ["拔步床底", "红木衣柜", "素锦窗帘后"],
    "客卧": ["雕花床底", "香樟衣柜", "轻纱窗帘后"],
    "书房": ["沉香木床底", "卷轴书柜后", "百宝书架后", "水墨窗帘后"],
    "主卧": ["凤尾雕花床底", "双开大衣柜", "重重锦幔后"],
    "主卧浴室": ["白玉浴屏后"]
  };

  const HIDEABLE = ROOMS.filter(r => ROOM_SPOTS[r] && ROOM_SPOTS[r].length > 0);
  const DOOR_ROOM = "小阳台";
  const MAX_TURNS = 12;

  // 专属角色香气与信物音色
  const CHARACTER_SCENTS = {
    "袁基": {
      name: "杜若沉水香",
      desc: "温润清雅的幽兰杜若香，隐约带着玉佩微鸣与书卷气息",
      sound: "微风轻拂袖摆的沙沙声"
    },
    "傅融": {
      name: "冷杉铜钱香",
      desc: "沉稳清冽的寒松冷杉香，伴随着随身铜钱与账册微响",
      sound: "极其收敛的轻捷落地声"
    },
    "孙策": {
      name: "骄阳海风香",
      desc: "炽烈明朗的烈阳青木香，伴随红绳发带与佩剑流苏晃动",
      sound: "轻快的忍俊不禁笑意"
    },
    "左慈": {
      name: "雪顶白鹤冷香",
      desc: "清冷飘逸的雪松冷香，隐隐有仙鹤羽衣与轻纱之气",
      sound: "仿若羽毛拂过地面的轻响"
    },
    "刘辩": {
      name: "御苑沉香药气",
      desc: "缠绵温存的温润沉香与药香，带着锦衣华服的细软声",
      sound: "隐约的轻细喘息与衣角摩擦"
    }
  };

  // 预设情趣赌约
  const PRESET_BETS = [
    { id: "bet_massage", title: "研墨捶肩一炷香", desc: "输者需在今夜为赢者研墨捶肩，不可偷懒。" },
    { id: "bet_nickname", title: "唤三声专属爱称", desc: "输者今日无论何时，皆需唤对方三声专属爱称。" },
    { id: "bet_wish", title: "兑现愿望清单一条", desc: "输者需在三日内无条件兑现愿望清单中的一条心愿。" },
    { id: "bet_kiss", title: "任由对方捏脸/亲一下", desc: "输者需闭上双眼，任由赢者轻捏脸颊或轻吻一下。" },
    { id: "bet_cook", title: "烹制指定膳食", desc: "输者需亲自下厨，为赢者烹制一道心仪的古法菜肴。" }
  ];

  const BELL_BY_DIST = { 0: 1.0, 1: 0.55, 2: 0.25, 3: 0.10, 4: 0.05 };
  const BELL_LABEL = {
    0: "铃铛在脚边·清脆·随身而动",
    1: "铃铛在隔壁·清晰·能辨方向",
    2: "铃铛远处闷响·只辨大致方位",
    3: "铃铛隐约难辨·似隔重重帘栊",
    4: "铃铛几不可闻·仿若在府邸另一端"
  };

  const STEP_BY_DIST = { 0: 0.9, 1: 0.5, 2: 0.2, 3: 0.08, 4: 0.05 };
  const STEP_LABEL = {
    0: "脚步就在身边·近在咫尺！",
    1: "脚步在隔壁·正步步逼近",
    2: "脚步远处微响·大致方向",
    3: "脚步极轻·似隔重重回廊",
    4: "脚步几不可闻·在府邸远端"
  };

  const BREATH_MAX = 3;
  const SIGMA = 0.22;
  const UNIFORM = 1.0 / ROOMS.length;
  const MIX = 0.05;

  function normalizeRoom(r) {
    if (!r) return "客厅";
    if (ROOMS.includes(r)) return r;
    for (const [k, v] of Object.entries(ANCIENT_ROOM_NAMES)) {
      if (v === r || r.includes(v) || v.includes(r) || r.includes(k) || k.includes(r)) return k;
    }
    return "客厅";
  }

  function distance(a, b) {
    if (!a || !b) return -1;
    if (a === b) return 0;
    const seen = new Set([a]);
    const queue = [[a, 0]];
    while (queue.length > 0) {
      const [node, d] = queue.shift();
      const neighbors = ADJ[node] || [];
      for (const n of neighbors) {
        if (seen.has(n)) continue;
        if (n === b) return d + 1;
        seen.add(n);
        queue.push([n, d + 1]);
      }
    }
    return -1;
  }

  function crossesDoor(a, b) {
    return a !== b && (a === DOOR_ROOM || b === DOOR_ROOM);
  }

  function bellWord(b) {
    if (b < 0.15) return "听不太清";
    if (b < 0.40) return "远处隐约";
    if (b < 0.70) return "隔壁清晰";
    return "极近·清晰可闻";
  }

  function confWord(p) {
    if (p < 0.30) return "或许";
    if (p < 0.55) return "多半";
    if (p < 0.80) return "八成";
    return "笃定";
  }

  /**
   * 贝叶斯置信度概率图 (Bayesian Belief Map)
   */
  class BeliefMap {
    constructor(probs = null) {
      if (!probs) {
        this.probs = {};
        ROOMS.forEach(r => (this.probs[r] = UNIFORM));
      } else {
        this.probs = { ...probs };
        this._normalize();
      }
    }

    _normalize() {
      const s = Object.values(this.probs).reduce((a, b) => a + b, 0) || 1.0;
      ROOMS.forEach(r => {
        this.probs[r] = (this.probs[r] || 0) / s;
      });
    }

    _mixUniform(mix = MIX) {
      ROOMS.forEach(r => {
        this.probs[r] = (1 - mix) * (this.probs[r] || 0) + mix * UNIFORM;
      });
      this._normalize();
    }

    reset() {
      this.probs = {};
      ROOMS.forEach(r => (this.probs[r] = UNIFORM));
    }

    update(obsBell, myRoom, holdingBreath = false, sameRoom = false) {
      if (sameRoom) {
        this.probs = {};
        ROOMS.forEach(r => (this.probs[r] = 0.0));
        this.probs[myRoom] = 1.0;
        return;
      }
      if (holdingBreath) {
        this._mixUniform(0.20);
        return;
      }
      const newProbs = {};
      ROOMS.forEach(r => {
        const d = r === myRoom ? 0 : distance(r, myRoom);
        const expected = BELL_BY_DIST[d] !== undefined ? BELL_BY_DIST[d] : 0.05;
        const lik = Math.exp(-Math.pow(obsBell - expected, 2) / (2 * SIGMA * SIGMA));
        newProbs[r] = (this.probs[r] || 0) * lik;
      });
      this.probs = newProbs;
      this._normalize();
      this._mixUniform();
    }

    top(n = 2) {
      return Object.entries(this.probs)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n);
    }

    suggestNext(myRoom, targetBias = null) {
      if (targetBias && ROOMS.includes(targetBias)) {
        if (targetBias === myRoom) return myRoom;
        const neighbors = ADJ[myRoom] || [];
        if (neighbors.includes(targetBias)) return targetBias;
        let best = neighbors[0];
        let minD = 999;
        for (const n of neighbors) {
          const d = distance(n, targetBias);
          if (d < minD) {
            minD = d;
            best = n;
          }
        }
        return best;
      }

      const topList = this.top(1);
      const top1 = topList.length > 0 ? topList[0][0] : myRoom;
      if (top1 === myRoom) return myRoom;
      const neighbors = ADJ[myRoom] || [];
      if (neighbors.length === 0) return myRoom;
      if (neighbors.includes(top1)) return top1;

      let best = neighbors[0];
      let minD = 999;
      for (const n of neighbors) {
        const d = distance(n, top1);
        if (d < minD) {
          minD = d;
          best = n;
        }
      }
      return best;
    }

    generateThought(obsBell, myRoom, holdingBreath = false, sameRoom = false, characterName = "名士") {
      const topList = this.top(2);
      const [a, ap] = topList[0] || ["客厅", 0.5];
      const nxt = this.suggestNext(myRoom);
      const conf = confWord(ap);
      const roomAName = ANCIENT_ROOM_NAMES[a] || a;
      const nxtName = ANCIENT_ROOM_NAMES[nxt] || nxt;
      const myRoomName = ANCIENT_ROOM_NAMES[myRoom] || myRoom;

      if (holdingBreath) {
        return `屏住声息了么……踪迹飘忽，${conf}是在【${roomAName}】。${nxt !== myRoom ? `且去【${nxtName}】探探。` : `且在原地静候片刻。`}`;
      }
      if (sameRoom) {
        return `这股清甜气息……原来就在这【${myRoomName}】里！让我翻翻看藏在何处～`;
      }
      const bellW = bellWord(obsBell);
      if (a === myRoom) {
        return `声响${bellW}，${conf}就在此间【${myRoomName}】，待我仔细搜查一番。`;
      } else if ((ADJ[myRoom] || []).includes(a)) {
        return `声响${bellW}，${conf}是在邻近的【${roomAName}】，且往那边去寻。`;
      } else {
        return `声响${bellW}，${conf}是在【${roomAName}】一带，先往【${nxtName}】过去。`;
      }
    }
  }

  /**
   * 捉迷藏核心状态机 (HideSeekGame v2.0)
   */
  class HideSeekGame {
    constructor() {
      this.mode = "player_hide"; // "player_hide" | "player_seek"
      this.state = "idle"; // "idle" | "running" | "caught" | "escaped"
      this.turn = 0;
      this.maxTurns = MAX_TURNS;
      this.characterName = "名士";
      this.bet = PRESET_BETS[0];

      // 玩家状态
      this.playerRoom = null;
      this.playerSpot = null;
      this.holdingBreath = false;
      this.breathRemaining = 3; // 一局总共限用 3 次
      this.stealthTurns = 0; // 踏雪无痕剩余回合

      // AI 伴侣状态
      this.aiRoom = null;
      this.aiSpot = null;
      this.aiLuredRoom = null; // 调虎离山目标
      this.aiDistractedTurns = 0;

      // 锦囊道具与机关
      this.inventory = {
        rock: 1,    // 调虎离山 (投掷石子)
        decoy: 1,   // 障眼法 (外衫假人)
        stealth: 1, // 踏雪无痕 (静步)
        lock: 1     // 机关落锁 (门闩)
      };
      this.placedDecoy = null; // { room, spot }
      this.lockedDoors = {}; // { roomA_roomB: remainingTurns }

      this.doorClosed = false;
      this.lastDoorCreak = false;
      this.lastDoorOpenedByMe = false;

      // 贝叶斯与搜寻状态
      this.belief = new BeliefMap();
      this.lastSearchRoom = null;
      this.lastSearchSpot = null;
      this.lastSearchHit = false;
      this.lastStepFrom = null;
      this.lastStepTo = null;
      this.lastAiReason = "";
      this.historyLog = [];
    }

    /**
     * 初始化与开始游戏
     */
    start({
      mode = "player_hide",
      playerRoom = null,
      playerSpot = null,
      characterName = "名士",
      bet = null
    } = {}) {
      this.mode = mode;
      this.state = "running";
      this.turn = 1;
      this.maxTurns = MAX_TURNS;
      this.characterName = characterName || "名士";
      this.bet = bet || PRESET_BETS[0];

      this.holdingBreath = false;
      this.breathRemaining = 3;
      this.stealthTurns = 0;
      this.aiLuredRoom = null;
      this.aiDistractedTurns = 0;
      this.placedDecoy = null;
      this.lockedDoors = {};
      this.doorClosed = false;
      this.lastDoorCreak = false;
      this.lastDoorOpenedByMe = false;

      this.inventory = {
        rock: 1,
        decoy: 1,
        stealth: 1,
        lock: 1
      };

      if (this.mode === "player_hide") {
        // 玩家躲藏，AI 寻找
        this.playerRoom = playerRoom ? normalizeRoom(playerRoom) : HIDEABLE[Math.floor(Math.random() * HIDEABLE.length)];
        const spots = ROOM_SPOTS[this.playerRoom] || [];
        this.playerSpot = playerSpot || (spots.length > 0 ? spots[Math.floor(Math.random() * spots.length)] : null);
        this.aiRoom = "客厅";
        this.aiSpot = null;
        this.belief.reset();
        this.historyLog = [
          `【开局】你悄悄藏在了【${ANCIENT_ROOM_NAMES[this.playerRoom] || this.playerRoom}】的「${this.playerSpot || "暗角"}」。`,
          `【赌约】本局赌注已立下：【${this.bet.title}】（${this.bet.desc}）。`,
          `${this.characterName} 在【${ANCIENT_ROOM_NAMES[this.aiRoom]}】闭目数十声，提步搜寻！`
        ];
        this._updateAiObservation();
      } else {
        // AI 躲藏，玩家寻找
        this.playerRoom = "客厅";
        this.playerSpot = null;
        this.aiRoom = HIDEABLE[Math.floor(Math.random() * HIDEABLE.length)];
        const spots = ROOM_SPOTS[this.aiRoom] || [];
        this.aiSpot = spots[Math.floor(Math.random() * spots.length)];
        this.historyLog = [
          `【开局】${this.characterName} 已悄然匿身于府邸深处……`,
          `【赌约】本局赌注已立下：【${this.bet.title}】（${this.bet.desc}）。`,
          `你已在【${ANCIENT_ROOM_NAMES[this.playerRoom]}】备好心绪，循香辨音，准备将 TA 抓个现行！`
        ];
      }

      return this.snapshot();
    }

    // ==========================================
    // 模式一：我藏 TA 抓（玩家操作）
    // ==========================================

    /**
     * 玩家移动 (逃往邻接房间并选新藏点)
     */
    playerMove(targetRoom, spot = null) {
      if (this.state !== "running") return { ok: false, msg: "游戏已结束" };
      const room = normalizeRoom(targetRoom);
      if (!ROOMS.includes(room)) return { ok: false, msg: "未知房间" };
      const cur = this.playerRoom;
      const neighbors = ADJ[cur] || [];
      if (!neighbors.includes(room) && room !== cur) {
        return { ok: false, msg: `无法从 ${ANCIENT_ROOM_NAMES[cur] || cur} 直接前往 ${ANCIENT_ROOM_NAMES[room] || room}` };
      }

      // 检查门锁
      const lockKey = [cur, room].sort().join("_");
      if (this.lockedDoors[lockKey] > 0) {
        return { ok: false, msg: `该通道已被门闩落锁，暂时无法通行！` };
      }

      this.lastDoorOpenedByMe = false;
      if (this.doorClosed && crossesDoor(cur, room)) {
        this.doorClosed = false;
        this.lastDoorCreak = true;
        this.historyLog.push(`你推开了关着的露台木门，发出“吱呀”一声轻响！`);
      }

      this.playerRoom = room;
      this.holdingBreath = false;

      const availableSpots = ROOM_SPOTS[room] || [];
      if (spot && availableSpots.includes(spot)) {
        this.playerSpot = spot;
      } else {
        this.playerSpot = availableSpots.length > 0 ? availableSpots[Math.floor(Math.random() * availableSpots.length)] : null;
      }

      this.historyLog.push(`你轻手轻脚转移到了【${ANCIENT_ROOM_NAMES[room] || room}】${this.playerSpot ? `的「${this.playerSpot}」` : ""}`);

      // 无藏点房间照面即抓
      if (this.playerRoom === this.aiRoom && availableSpots.length === 0) {
        this.state = "caught";
        this.historyLog.push(`糟糕！【${ANCIENT_ROOM_NAMES[room] || room}】没有遮掩之处，与 ${this.characterName} 撞了个正着，被当场抓住！`);
        return { ok: true, caught: true, snapshot: this.snapshot() };
      }

      // AI 回合行动
      const aiResult = this.aiStep();
      return { ok: true, caught: this.state === "caught", aiResult, snapshot: this.snapshot() };
    }

    /**
     * 玩家原地静候（不移动、不屏息，AI 自主推进一回合）
     */
    playerWait() {
      if (this.state !== "running") return { ok: false, msg: "游戏已结束" };
      this.holdingBreath = false;
      this.historyLog.push(`你隐匿在【${ANCIENT_ROOM_NAMES[this.playerRoom] || this.playerRoom}】${this.playerSpot ? ("「" + this.playerSpot + "」") : ""}，静静观察着回廊声响……`);
      const aiResult = this.aiStep();
      return { ok: true, msg: "原地静候片刻", aiResult, snapshot: this.snapshot() };
    }

    /**
     * 玩家屏息 (整局限用3次)
     */
    playerHoldBreath() {
      if (this.state !== "running") return { ok: false, msg: "游戏已结束" };
      if (this.breathRemaining <= 0) {
        return { ok: false, msg: "本局屏息机会（共3次）已全部用尽！", snapshot: this.snapshot() };
      }

      this.breathRemaining--;
      this.holdingBreath = true;
      this.historyLog.push(`你敛声屏气（本局剩余 ${this.breathRemaining}/3 次），身上铃铛与气息彻底静止。`);
      const aiResult = this.aiStep();
      return { ok: true, msg: `屏息成功（剩余 ${this.breathRemaining} 次）`, aiResult, snapshot: this.snapshot() };
    }

    /**
     * 使用道具锦囊
     */
    useItem(itemType, target = null) {
      if (this.state !== "running") return { ok: false, msg: "游戏已结束" };
      if (!this.inventory[itemType] || this.inventory[itemType] <= 0) {
        return { ok: false, msg: "该锦囊已用尽" };
      }

      this.inventory[itemType]--;

      if (itemType === "rock") {
        // 调虎离山：投掷石子到相邻房间
        const neighbors = ADJ[this.playerRoom] || [];
        const targetRoom = target && neighbors.includes(target) ? target : (neighbors[0] || this.playerRoom);
        this.aiLuredRoom = targetRoom;
        this.aiDistractedTurns = 2;
        this.historyLog.push(`🪨 你施展【调虎离山】，将碎瓦轻掷入【${ANCIENT_ROOM_NAMES[targetRoom]}】，发出清脆声响！`);
      } else if (itemType === "decoy") {
        // 障眼法：在当前藏点放置假人外衫
        if (!this.playerSpot) {
          return { ok: false, msg: "当前位置没有隐蔽藏点可放置假人" };
        }
        this.placedDecoy = { room: this.playerRoom, spot: this.playerSpot };
        this.historyLog.push(`🎎 你施展【障眼法】，在「${this.playerSpot}」留下了一件假人外衫与小香囊！`);
      } else if (itemType === "stealth") {
        // 踏雪无痕：2回合绝对静音
        this.stealthTurns = 2;
        this.historyLog.push(`🪶 你施展【踏雪无痕】，提气轻身，接下来的步履将无声无息！`);
      } else if (itemType === "lock") {
        // 机关落锁：锁死当前房间与指定邻房通道 2 回合
        const neighbors = ADJ[this.playerRoom] || [];
        const targetRoom = target && neighbors.includes(target) ? target : neighbors[0];
        if (targetRoom) {
          const lockKey = [this.playerRoom, targetRoom].sort().join("_");
          this.lockedDoors[lockKey] = 2;
          this.historyLog.push(`🗝️ 你施展【机关落锁】，顺手将通往【${ANCIENT_ROOM_NAMES[targetRoom]}】的门闩扣紧，封阻 2 回合！`);
        }
      }

      const aiResult = this.aiStep();
      return { ok: true, msg: "锦囊使用成功", aiResult, snapshot: this.snapshot() };
    }

    /**
     * 关门/开门
     */
    setDoor(closed) {
      if (this.state !== "running") return { ok: false, msg: "游戏已结束" };
      const reachable = [DOOR_ROOM, ...(ADJ[DOOR_ROOM] || [])];
      if (!reachable.includes(this.playerRoom)) {
        return { ok: false, msg: `木门在露台附近，你在【${ANCIENT_ROOM_NAMES[this.playerRoom] || this.playerRoom}】够不着。` };
      }
      if (this.doorClosed === closed) {
        return { ok: false, msg: `门本来就${closed ? "关着" : "开着"}。` };
      }
      this.doorClosed = closed;
      this.historyLog.push(`你轻轻把露台的木门${closed ? "掩上了" : "打开了"}。`);
      const aiResult = this.aiStep();
      return { ok: true, aiResult, snapshot: this.snapshot() };
    }

    /**
     * AI 执行单回合搜查与移动 (我藏TA抓模式)
     */
    aiStep() {
      this.turn++;

      // 递减持续状态
      if (this.stealthTurns > 0) this.stealthTurns--;
      if (this.aiDistractedTurns > 0) {
        this.aiDistractedTurns--;
        if (this.aiDistractedTurns === 0) this.aiLuredRoom = null;
      }
      for (const k of Object.keys(this.lockedDoors)) {
        if (this.lockedDoors[k] > 0) this.lockedDoors[k]--;
      }

      // 回合耗尽，玩家成功逃脱胜出！
      if (this.turn > this.maxTurns) {
        this.state = "escaped";
        this.historyLog.push(`🏆 坚持满 ${this.maxTurns} 回合！${this.characterName} 始终未能捉到你，无奈含笑投降！你大获全胜！`);
        return { action: "escaped", win: true };
      }

      this._updateAiObservation();

      const sameRoom = this.playerRoom === this.aiRoom && !this.holdingBreath && this.stealthTurns === 0;
      const mySpots = ROOM_SPOTS[this.aiRoom] || [];

      // 1. 同一房间搜藏点
      if (this.playerRoom === this.aiRoom && mySpots.length > 0 && !this.holdingBreath) {
        const spotToSearch = mySpots[Math.floor(Math.random() * mySpots.length)];
        this.lastSearchRoom = this.aiRoom;
        this.lastSearchSpot = spotToSearch;

        // 检查是否命中假人外衫
        if (this.placedDecoy && this.placedDecoy.room === this.aiRoom && this.placedDecoy.spot === spotToSearch) {
          this.placedDecoy = null;
          this.historyLog.push(`${this.characterName} 掀开「${spotToSearch}」——“抓到……咦？！怎只是一件外衫？” TA 被障眼法骗过，扑了个空！`);
          return { action: "decoy_hit", spot: spotToSearch };
        }

        // 检查是否抓到玩家
        if (this.playerSpot === spotToSearch) {
          this.lastSearchHit = true;
          this.state = "caught";
          this.historyLog.push(`${this.characterName} 径直走向「${spotToSearch}」——“找到你了，小机灵鬼。” 你被当场逮住！`);
          return { action: "search", hit: true, spot: spotToSearch };
        } else {
          this.lastSearchHit = false;
          this.historyLog.push(`${this.characterName} 仔细搜查了「${spotToSearch}」，并未发现你！趁现在快转移！`);
          return { action: "search", hit: false, spot: spotToSearch };
        }
      }

      // 2. 根据调虎离山或贝叶斯寻找下一个目标
      const nextRoom = this.belief.suggestNext(this.aiRoom, this.aiLuredRoom);
      const prev = this.aiRoom;
      this.lastDoorOpenedByMe = false;
      this.lastDoorCreak = false;

      // 检查门闩阻挡
      const lockKey = [prev, nextRoom].sort().join("_");
      if (this.lockedDoors[lockKey] > 0) {
        this.historyLog.push(`${this.characterName} 试图前往【${ANCIENT_ROOM_NAMES[nextRoom]}】，却发现门闩被扣死，只得在门外驻足！`);
        return { action: "blocked_lock", room: nextRoom };
      }

      // 遇关着的门被挡住一回合
      if (this.doorClosed && crossesDoor(prev, nextRoom) && (ADJ[prev] || []).includes(nextRoom)) {
        this.doorClosed = false;
        this.lastDoorOpenedByMe = true;
        this.historyLog.push(`${this.characterName} 被掩上的露台木门挡住了脚步，花费片刻推开了门！`);
        return { action: "open_door", room: nextRoom };
      }

      if (nextRoom && nextRoom !== prev && (ADJ[prev] || []).includes(nextRoom)) {
        this.aiRoom = nextRoom;
        this.lastStepFrom = prev;
        this.lastStepTo = nextRoom;
        const sound = this.getStepSound();
        this.historyLog.push(`${this.characterName} 步履从容地离开了【${ANCIENT_ROOM_NAMES[prev]}】，前往【${ANCIENT_ROOM_NAMES[nextRoom]}】……（${sound.label}）`);

        // 无藏点房间照面即抓
        if (this.playerRoom === this.aiRoom && (ROOM_SPOTS[this.playerRoom] || []).length === 0) {
          this.state = "caught";
          this.historyLog.push(`${this.characterName} 踏入【${ANCIENT_ROOM_NAMES[this.playerRoom]}】，此处无从遮蔽，被抓个正着！`);
          return { action: "move", room: nextRoom, caught: true };
        }
        return { action: "move", room: nextRoom, caught: false };
      }

      this.historyLog.push(`${this.characterName} 在【${ANCIENT_ROOM_NAMES[this.aiRoom]}】驻足聆听，仔细辨别着回廊风声……`);
      return { action: "wait", room: this.aiRoom };
    }

    _updateAiObservation() {
      const sameRoom = this.playerRoom === this.aiRoom;
      const d = sameRoom ? 0 : distance(this.playerRoom, this.aiRoom);
      const isMuted = this.holdingBreath || this.stealthTurns > 0;
      const bell = isMuted ? 0.05 : (BELL_BY_DIST[d] !== undefined ? BELL_BY_DIST[d] : 0.05);

      this.belief.update(bell, this.aiRoom, isMuted, sameRoom);
      if (this.lastDoorCreak && !sameRoom) {
        const nearDoor = [DOOR_ROOM, ...(ADJ[DOOR_ROOM] || [])];
        ROOMS.forEach(r => {
          this.belief.probs[r] *= nearDoor.includes(r) ? 3.0 : 1.0;
        });
        this.belief._normalize();
      }
      this.lastAiReason = this.belief.generateThought(bell, this.aiRoom, isMuted, sameRoom, this.characterName);
    }

    // ==========================================
    // 模式二：TA 藏 我抓（玩家操作）
    // ==========================================

    /**
     * 玩家移动寻找伴侣
     */
    seekerMove(targetRoom) {
      if (this.state !== "running") return { ok: false, msg: "游戏已结束" };
      const room = normalizeRoom(targetRoom);
      if (!ROOMS.includes(room)) return { ok: false, msg: "未知房间" };
      const cur = this.playerRoom;
      const neighbors = ADJ[cur] || [];
      if (!neighbors.includes(room) && room !== cur) {
        return { ok: false, msg: `无法从 ${ANCIENT_ROOM_NAMES[cur]} 直接前往 ${ANCIENT_ROOM_NAMES[room]}` };
      }

      this.playerRoom = room;
      this.turn++;

      // 伴侣偶有轻微转移或发出声息
      const clue = this.getSeekerClue();
      this.historyLog.push(`你提步来到了【${ANCIENT_ROOM_NAMES[room]}】。${clue.text}`);

      if (this.turn > this.maxTurns) {
        this.state = "escaped";
        this.historyLog.push(`⏳ 已过 ${this.maxTurns} 回合！${this.characterName} 从暗处轻巧现身，笑意吟吟：“掌门找了半晌，莫不是寻不着我？” TA 赢下了这局！`);
        return { ok: true, win: false, snapshot: this.snapshot() };
      }

      return { ok: true, clue, snapshot: this.snapshot() };
    }

    /**
     * 玩家在当前房间搜查具体藏点
     */
    seekerSearch(spot) {
      if (this.state !== "running") return { ok: false, msg: "游戏已结束" };
      const availableSpots = ROOM_SPOTS[this.playerRoom] || [];
      if (!availableSpots.includes(spot)) {
        return { ok: false, msg: `【${ANCIENT_ROOM_NAMES[this.playerRoom]}】并无「${spot}」` };
      }

      this.turn++;
      this.lastSearchRoom = this.playerRoom;
      this.lastSearchSpot = spot;

      if (this.playerRoom === this.aiRoom && this.aiSpot === spot) {
        this.state = "caught";
        this.historyLog.push(`🎯 你一把掀开「${spot}」——“抓到你了！” ${this.characterName} 惊呼一声，被你紧紧拉入怀中抓个正着！`);
        return { ok: true, caught: true, snapshot: this.snapshot() };
      } else {
        this.historyLog.push(`你仔细翻看了「${spot}」，空空如也。`);
        if (this.turn > this.maxTurns) {
          this.state = "escaped";
          this.historyLog.push(`⏳ 已过 ${this.maxTurns} 回合！未能抓到 ${this.characterName}，TA 胜出了这一局！`);
          return { ok: true, caught: false, win: false, snapshot: this.snapshot() };
        }
        return { ok: true, caught: false, snapshot: this.snapshot() };
      }
    }

    getSeekerClue() {
      const d = distance(this.playerRoom, this.aiRoom);
      const scent = CHARACTER_SCENTS[this.characterName] || CHARACTER_SCENTS["袁基"];

      if (d === 0) {
        return {
          intensity: 1.0,
          level: "近在眼前",
          scent: scent.name,
          text: `【暗香浓郁】${scent.desc}近在咫尺，耳边甚至能听到「${scent.sound}」，TA 就在这间屋子里！`
        };
      } else if (d === 1) {
        return {
          intensity: 0.6,
          level: "隔壁隐约",
          scent: scent.name,
          text: `【暗香浮动】空气中飘来一缕淡淡的「${scent.name}」，似在相邻的隔壁房间……`
        };
      } else if (d === 2) {
        return {
          intensity: 0.3,
          level: "远处游丝",
          scent: scent.name,
          text: `【气息游丝】隐约辨出轻微的「${scent.name}」，还在更深处的回廊。`
        };
      } else {
        return {
          intensity: 0.05,
          level: "渺茫难寻",
          scent: scent.name,
          text: `【静寂无声】暂未察觉明显气息，唯有轻风拂过廊下风铃。`
        };
      }
    }

    getStepSound() {
      if (!this.playerRoom || !this.lastStepTo) {
        return { intensity: 0.05, label: "脚步几不可闻" };
      }
      const d = distance(this.playerRoom, this.lastStepTo);
      return {
        intensity: STEP_BY_DIST[d] || 0.05,
        label: STEP_LABEL[d] || "脚步极轻·似隔重重回廊",
        direction: this.lastStepTo
      };
    }

    /**
     * 生成当前快照
     */
    snapshot() {
      const isPlayerHide = this.mode === "player_hide";
      const myRoom = isPlayerHide ? this.playerRoom : this.playerRoom;
      const targetRoom = isPlayerHide ? this.aiRoom : this.aiRoom;
      const d = distance(myRoom, targetRoom);
      const sameRoom = d === 0;

      const isMuted = this.holdingBreath || this.stealthTurns > 0;
      const bell = isMuted ? 0.05 : (BELL_BY_DIST[d] !== undefined ? BELL_BY_DIST[d] : 0.05);
      const bellLabel = isMuted ? "铃声悄绝·踏雪无痕" : (BELL_LABEL[d] || "铃声几不可闻");

      // 紧张度 (0.0 ~ 1.0)
      const tension = sameRoom ? 1.0 : (d === 1 ? 0.75 : (d === 2 ? 0.4 : 0.1));

      return {
        mode: this.mode,
        state: this.state,
        turn: this.turn,
        maxTurns: this.maxTurns,
        characterName: this.characterName,
        bet: this.bet,

        // 玩家与 AI 坐标
        playerRoom: this.playerRoom,
        playerRoomName: ANCIENT_ROOM_NAMES[this.playerRoom] || this.playerRoom,
        playerSpot: this.playerSpot,
        playerNeighbors: (ADJ[this.playerRoom] || []).map(r => ({ key: r, name: ANCIENT_ROOM_NAMES[r] || r })),
        playerSpots: ROOM_SPOTS[this.playerRoom] || [],

        aiRoom: this.aiRoom,
        aiRoomName: ANCIENT_ROOM_NAMES[this.aiRoom] || this.aiRoom,
        aiSpot: this.aiSpot,

        distance: d,
        tension: tension,
        isNearDanger: d <= 1,

        // 道具状态
        inventory: { ...this.inventory },
        placedDecoy: this.placedDecoy ? { ...this.placedDecoy } : null,
        stealthTurns: this.stealthTurns,
        lockedDoors: { ...this.lockedDoors },

        // 声音与香气感知
        bellIntensity: bell,
        bellLabel: bellLabel,
        stepSound: this.getStepSound(),
        seekerClue: this.mode === "player_seek" ? this.getSeekerClue() : null,

        // 屏息（整局限用 3 次）
        holdingBreath: this.holdingBreath,
        breathRemaining: this.breathRemaining,
        breathMax: BREATH_MAX,
        doorClosed: this.doorClosed,
        doorOpenedByMe: this.lastDoorOpenedByMe,

        // 心声与历史记录
        aiThought: isPlayerHide ? this.lastAiReason : `【${this.characterName}心想】：不知掌门能否在这九曲回廊间，寻到我留下的蛛丝马迹？`,
        historyLog: [...this.historyLog]
      };
    }
  }

  // 挂载全局
  window.HideSeekGame = HideSeekGame;
  window.HideSeekConfig = {
    ROOMS,
    ANCIENT_ROOM_NAMES,
    ADJ,
    ROOM_SPOTS,
    HIDEABLE,
    DOOR_ROOM,
    MAX_TURNS,
    CHARACTER_SCENTS,
    PRESET_BETS
  };

  console.log('✅ [HideSeekEngine v2.0] 府邸捉迷藏高阶双向博弈引擎就绪');
})();
