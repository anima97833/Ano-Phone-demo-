/**
 * Milvus/cotton_doll_renderer.js
 * 棉花娃娃纯 2D 骨骼渲染内核（零 DOM/UI 依赖 · 棉花手作工坊与主屏桌宠单一真相源）
 */
(function (global) {
  'use strict';

  /* =========================================================================
   * 0. 颜色派生工具、数学函数与手作音效引擎
   * ========================================================================= */
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

  function hexToRgb(hex) {
    const h = (hex || '#FCEEE2').replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0');
    return [parseInt(full.slice(0, 2), 16) || 0, parseInt(full.slice(2, 4), 16) || 0, parseInt(full.slice(4, 6), 16) || 0];
  }
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  }
  // 从任意自由色盘颜色自动派生立体明暗与深色描边
  function shadeHex(hex, factor) {
    const [r, g, b] = hexToRgb(hex);
    if (factor < 0) {
      const k = 1 + factor;
      return rgbToHex(r * k, g * k, b * k);
    }
    return rgbToHex(r + (255 - r) * factor, g + (255 - g) * factor, b + (255 - b) * factor);
  }
  function hexAlpha(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${clamp(a, 0, 1).toFixed(3)})`;
  }

  /* =========================================================================
   * 1. Tomodachi 级全维度款式字典（无 Emoji · 全手绘缩略图）
   * ========================================================================= */
  const SKIN_SWATCHES = ['#FFF4EB', '#FCEEE2', '#F7DEC9', '#FADBD8', '#E9C4A3', '#D5A27B', '#B5805B', '#F2F0EE'];
  const EYE_SWATCHES = ['#3B2B26', '#6B422C', '#C47B3B', '#B84A58', '#4F77AD', '#5E997A', '#8868A8', '#D9A441'];
  const HAIR_SWATCHES = ['#2B2629', '#5A4136', '#C8A98E', '#E8AFB8', '#D67B4E', '#7C9EC2', '#9DC4B1', '#EDE8E4', '#9A82B8', '#C4474E'];
  const CLOTH_SWATCHES = ['#E598A4', '#F2D28C', '#8FB2A1', '#6986AC', '#B58C72', '#B59EC9', '#3D4452', '#FAF6EE', '#C4524C', '#7DA56E'];

  const FACE_PRESETS = [
    { id: 'mochi',  name: '奶团圆脸', faceWidth: 1.04, cheekPlump: 0.78, chinRound: 0.88 },
    { id: 'oval',   name: '标准鹅蛋', faceWidth: 0.96, cheekPlump: 0.36, chinRound: 0.62 },
    { id: 'vchin',  name: '精致瓜子', faceWidth: 0.94, cheekPlump: 0.25, chinRound: 0.22 },
    { id: 'chubby', name: '肉肉包子', faceWidth: 1.10, cheekPlump: 0.95, chinRound: 0.94 },
    { id: 'cool',   name: '清冷微瘦', faceWidth: 0.90, cheekPlump: 0.15, chinRound: 0.38 }
  ];

  const EAR_TYPES = [
    { id: 'none', name: '人类幼崽' },
    { id: 'bunny', name: '垂耳小兔' },
    { id: 'cat', name: '灵动猫耳' },
    { id: 'bear', name: '圆润熊耳' },
    { id: 'fox', name: '蓬松狐耳' },
    { id: 'puppy', name: '软耳小狗' }
  ];

  const FABRIC_TYPES = [
    { id: 'plush_5mm', name: '5mm短毛绒', sub: '蓬松绒边' },
    { id: 'peach_skin', name: '桃皮绒棉', sub: '柔滑细腻' },
    { id: 'teddy_curl', name: '泰迪卷毛', sub: '复古卷绒' },
    { id: 'elastic_rib', name: '高弹针织', sub: '细密竖纹' }
  ];

  const BROW_STYLES = [
    { id: 'none',      name: '无眉自画' },
    { id: 'soft_arch', name: '温柔弯眉' },
    { id: 'straight',  name: '元气平眉' },
    { id: 'worried',   name: '八字委屈' },
    { id: 'sharp',     name: '英气剑眉' },
    { id: 'raised',    name: '俏皮挑眉' },
    { id: 'dot',       name: '豆豆圆眉' },
    { id: 'thin',      name: '细柳弯眉' }
  ];

  const EYE_STYLES = [
    { id: 'none',   name: '无眼自画' },
    { id: 'round',  name: '甜系圆眼' },
    { id: 'cat',    name: '灵动猫眼' },
    { id: 'droopy', name: '软萌垂眼' },
    { id: 'fox',    name: '清冷狐眼' },
    { id: 'smile',  name: '弯月笑眼' },
    { id: 'star',   name: '闪耀星眼' },
    { id: 'button', name: '复古豆眼' },
    { id: 'closed', name: '眠眠闭眼' }
  ];

  const LASH_STYLES = [
    { id: 'none',  name: '自然无睫' },
    { id: 'soft',  name: '纤细眼尾' },
    { id: 'full',  name: '浓密娃娃' },
    { id: 'plush', name: '浓密厚睫' },
    { id: 'lower', name: '上下睫毛' }
  ];

  const HIGHLIGHT_STYLES = [
    { id: 'double', name: '双水光点' },
    { id: 'star',   name: '星芒高光' },
    { id: 'heart',  name: '爱心高光' },
    { id: 'crescent', name: '月牙微光' }
  ];

  const NOSE_STYLES = [
    { id: 'none', name: '无鼻' },
    { id: 'dot',  name: '小圆点' },
    { id: 'soft', name: '淡影小鼻' },
    { id: 'tri',  name: '娇俏三角' },
    { id: 'dash', name: '迷你横线' }
  ];

  const MOUTH_STYLES = [
    { id: 'none',     name: '无嘴自画' },
    { id: 'mini_dip', name: '乖巧微抿' },
    { id: 'smile',    name: '甜美微笑' },
    { id: 'cat',      name: '猫咪w嘴' },
    { id: 'pout',     name: '樱桃嘟唇' },
    { id: 'happy',    name: '元气大笑' },
    { id: 'sad',      name: '委屈撇嘴' },
    { id: 'tongue',   name: '俏皮吐舌' },
    { id: 'fang',     name: '小虎牙' },
    { id: 'oh',       name: '呆萌o嘴' }
  ];

  const BLUSH_STYLES = [
    { id: 'none',  name: '无腮红' },
    { id: 'soft',  name: '柔雾圆腮' },
    { id: 'slash', name: '刺绣斜线' },
    { id: 'oval',  name: '微醺椭圆' },
    { id: 'nose',  name: '鼻梁晒伤' }
  ];

  const HAIR_BACK_STYLES = [
    { id: 'none',       name: '无后发自画' },
    { id: 'short_bob',  name: '乖巧波波' },
    { id: 'long_str',   name: '齐腰长直' },
    { id: 'twin_tails', name: '元气双马尾' },
    { id: 'twin_buns',  name: '软萌双丸子' },
    { id: 'curly_puff', name: '绵羊蓬卷' },
    { id: 'wolf_cut',   name: '少年狼尾' },
    { id: 'hime_curl',  name: '姬发大卷' }
  ];

  const HAIR_BANG_STYLES = [
    { id: 'none',       name: '无刘海自画' },
    { id: 'widow_peak', name: '美人尖古风' },
    { id: 'full',       name: '乖巧齐刘海' },
    { id: 'air',        name: '空气八字' },
    { id: 'side',       name: '甜美斜分' },
    { id: 'choppy',     name: '眉上碎刘海' },
    { id: 'center',     name: '龙须中分' },
    { id: 'spiky',      name: '少年碎发' },
    { id: 'open',       name: '清透露额' }
  ];

  const HAIR_SIDE_STYLES = [
    { id: 'none',        name: '无鬓角' },
    { id: 'inward_curl', name: '内扣龙须' },
    { id: 'soft',        name: '自然贴脸' },
    { id: 'long',        name: '长款鬓角' },
    { id: 'curl',        name: '微卷耳鬓' },
    { id: 'short',       name: '利落短鬓' }
  ];

  const POSE_PRESETS = [
    { id: 'stand',  name: '乖巧站姿', headTilt: 0,     leftArm: 0.56,  rightArm: -0.56, leftLeg: 0.04,  rightLeg: -0.04 },
    { id: 'cheer',  name: '举手欢呼', headTilt: -0.08, leftArm: 2.25,  rightArm: -2.25, leftLeg: 0.14,  rightLeg: -0.14 },
    { id: 'wave',   name: '挥手问好', headTilt: 0.14,  leftArm: 0.48,  rightArm: -2.30, leftLeg: 0.06,  rightLeg: -0.08 },
    { id: 'sit',    name: '坐姿团子', headTilt: -0.06, leftArm: 0.72,  rightArm: -0.72, leftLeg: 0.55,  rightLeg: -0.55 },
    { id: 'jump',   name: '开心跳跃', headTilt: 0.12,  leftArm: 1.95,  rightArm: -1.65, leftLeg: 0.36,  rightLeg: -0.28 },
    { id: 'shy',    name: '歪头卖萌', headTilt: -0.20, leftArm: -0.18, rightArm: 0.18,  leftLeg: -0.08, rightLeg: 0.08 }
  ];

  // Spine 级连贯骨骼动画状态机剪辑（供展台实时播放及后续小手机名士接入）
  const ANIM_CLIPS = [
    { id: 'idle',   name: '呼吸待机', sub: '柔缓呼吸眨眼' },
    { id: 'wave',   name: '招手问好', sub: '高举连续挥手' },
    { id: 'walk',   name: '迈步走路', sub: '摆臂迈腿步态' },
    { id: 'sit',    name: '坐下晃脚', sub: '坐姿交替晃脚' },
    { id: 'happy',  name: '开心蹦跳', sub: '蓄力弹跳欢呼' },
    { id: 'shy',    name: '害羞摇摆', sub: '歪头轻晃身子' },
    { id: 'static', name: '手动定格', sub: '自由拖骨摆姿' }
  ];

  const AHOGE_STYLES = [
    { id: 'none',   name: '无呆毛' },
    { id: 'single', name: '单撮呆毛' },
    { id: 'heart',  name: '爱心呆毛' },
    { id: 'double', name: '双根天线' },
    { id: 'curl',   name: '卷卷毛' }
  ];

  const OUTFIT_DRESSES = [
    { id: 'none',          name: '不穿裙装', sleeve: 'none' },
    { id: 'berry_overall', name: '背带裙',   sleeve: 'puff' },
    { id: 'lace_lolita',   name: '洛丽塔裙', sleeve: 'puff' },
    { id: 'apron_maid',    name: '荷叶围裙', sleeve: 'short' },
    { id: 'hanfu_ruqun',   name: '齐胸襦裙', sleeve: 'wide' }
  ];

  const OUTFIT_TOPS = [
    { id: 'none',         name: '不穿单衣', sleeve: 'none' },
    { id: 'knit_sweater', name: '麻花毛衣', sleeve: 'long' },
    { id: 'sailor_top',   name: '学院水手', sleeve: 'short' },
    { id: 'shirt_bow',    name: '领结衬衫', sleeve: 'long' },
    { id: 'hoodie',       name: '软糯卫衣', sleeve: 'long' }
  ];

  const OUTFIT_BOTTOMS = [
    { id: 'none',          name: '无下装' },
    { id: 'pleated_skirt', name: '百褶短裙' },
    { id: 'denim_shorts',  name: '翻边短裤' },
    { id: 'bloomers',      name: '南瓜短裤' }
  ];

  const OUTFIT_SHOES = [
    { id: 'none',       name: '赤脚肉垫' },
    { id: 'mary_jane',  name: '白袜玛丽珍' },
    { id: 'bear_boots', name: '小熊短靴' },
    { id: 'stripe_shoe',name: '条纹袜皮鞋' }
  ];

  const OUTFIT_PATTERNS = [
    { id: 'solid',  name: '纯色' },
    { id: 'plaid',  name: '苏格兰格' },
    { id: 'dots',   name: '甜美波点' },
    { id: 'stripe', name: '学院条纹' },
    { id: 'cherry', name: '樱桃印花' }
  ];

  const ACCESSORIES_CATALOG = [
    { id: 'ribbon_bow',  name: '丝带蝴蝶结', x: 0,   y: -124, color: '#DF7A8A' },
    { id: 'beret_hat',   name: '羊毛贝雷帽', x: 6,   y: -130, color: '#D68492' },
    { id: 'crown',       name: '小巧皇冠',   x: 0,   y: -132, color: '#E8BC5A' },
    { id: 'pearl_clip',  name: '珍珠发夹',   x: -54, y: -96,  color: '#FFF6E3' },
    { id: 'round_glass', name: '复古圆眼镜', x: 0,   y: -46,  color: '#B8864B' },
    { id: 'star_glass',  name: '甜酷墨镜',   x: 0,   y: -46,  color: '#463C4A' },
    { id: 'knit_scarf',  name: '针织围巾',   x: 0,   y: 20,   color: '#D96B78' },
    { id: 'bear_bag',    name: '小熊斜挎包', x: 30,  y: 62,   color: '#C69572' },
    { id: 'mini_bunny',  name: '手持小兔',   x: -64, y: 56,   color: '#FFFDF9' },
    { id: 'name_badge',  name: '工坊姓名牌', x: 24,  y: 44,   color: '#FFFDF5' }
  ];

  const BACKGROUNDS = [
    { id: 'worktable',    name: '手作软木台', top: '#F5E9DA', bot: '#E2CEB7' },
    { id: 'sun_window',   name: '午后暖阳窗', top: '#FFF7E8', bot: '#F3DEC2' },
    { id: 'berry_picnic', name: '草莓格子垫', top: '#FCECF0', bot: '#F2D4DC' },
    { id: 'star_box',     name: '星空收藏盒', top: '#272E44', bot: '#161A29' }
  ];


  function createDefaultState() {
    return {
      version: 5,
      projectId: 'doll_' + Date.now(),
      step: 0,
      subTab: 'face',
      body: {
        bodyType: 'chibi', // 'chibi' | 'slender'
        faceWidth: 1.07,
        cheekPlump: 0.82,
        chinRound: 0.88,
        ears: 'none',
        skinColor: '#FAF0EA',
        fabricType: 'plush_5mm',
        sculptOffsets: Array.from({ length: 56 }, () => ({ dx: 0, dy: 0 }))
      },
      sculptUI: {
        active: false,
        brush: 'move', // 'move' | 'inflate' | 'pinch' | 'smooth'
        radius: 42,
        symmetry: true
      },
      face: {
        browStyle: 'soft_arch',
        browColor: '#9C8272',
        browY: -28,
        browSpacing: 38,
        browTilt: 0,
        browThickness: 2.2,
        eyeStyle: 'round',
        eyeColorL: '#3F2B24',
        eyeColorR: '#3F2B24',
        heterochromia: false,
        eyeSize: 1.15,
        eyeSpacing: 39,
        eyeY: 9,
        eyeTilt: 0,
        lashStyle: 'plush',
        highlightStyle: 'crescent',
        noseStyle: 'soft',
        noseY: 11,
        noseSize: 1.1,
        mouthStyle: 'mini_dip',
        mouthColor: '#3F2C26',
        mouthY: 32,
        mouthScale: 0.95,
        blushStyle: 'soft',
        blushColor: '#F09CA8',
        blushAlpha: 0.50,
        marks: { moleL: false, moleR: false, freckles: false, bandaid: false, huadian: false, starCheek: false }
      },
      craft: {
        cutProgress: 0,
        cutSamples: [],
        mirrorEmbroidery: true,
        embTool: 'line', // 'line' | 'pen' | 'fill' | 'airbrush' | 'circle' | 'ellipse' | 'dot' | 'eyedropper' | 'eraser'
        embColor: '#C46F7F',
        embWidth: 2.6,
        airStrength: 0.35,
        freeStrokes: [],
        aligned: false,
        sewProgress: 0,
        sewSamples: [],
        sewThreadColor: '#C46F7F',
        turned: false,
        fillLevel: 0,
        closed: false
      },
      hair: {
        backStyle: 'short_bob',
        bangStyle: 'widow_peak',
        sideStyle: 'inward_curl',
        ahogeStyle: 'none',
        mainColor: '#232125',
        tipEnabled: false,
        tipColor: '#3C3940',
        customBackStrokes: [],
        customFrontStrokes: []
      },
      hairDraw: { layer: 'front', tool: 'line', color: '#232125', width: 6, airStrength: 0.35, mirror: true },
      pose: {
        animClip: 'idle',
        headTilt: 0,
        leftArm: 0.56,
        rightArm: -0.56,
        leftLeg: 0.04,
        rightLeg: -0.04
      },
      outfit: {
        dress: 'berry_overall',
        top: 'none',
        bottom: 'none',
        shoes: 'mary_jane',
        pattern: 'solid',
        mainColor: '#E598A4',
        accentColor: '#FFF7F8',
        bottomColor: '#6986AC',
        shoeColor: '#7A4F48',
        customStrokes: []
      },
      outfitDraw: { tool: 'line', color: '#C46F7F', width: 4.5, airStrength: 0.35, mirror: true },
      accessories: [],
      customAccStrokes: [],
      accDraw: { tool: 'line', color: '#E4B854', width: 3.4, airStrength: 0.35, mirror: true },
      selectedAccUid: null,
      showcase: {
        name: '奶糖小兔',
        note: '一针一线亲手缝制的小可爱，愿你永远蓬松温暖。',
        background: 'worktable',
        turnAngle: 0
      }
    };
  }


  /* =========================================================================
   * 3. C∞ 连续平滑脸型与布艺绒感渲染核心
   * ========================================================================= */
  // Catmull-Rom 转平滑闭合贝塞尔路径（彻底消灭多边形折线感）
  function traceSmoothClosedCurve(c, pts) {
    const n = pts.length;
    if (n < 3) return;
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const p3 = pts[(i + 2) % n];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      c.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
    c.closePath();
  }

  // 真正流畅的棉花娃娃脸型参数方程（全程 C∞ 无分支平滑 + Nomad 推捏形变偏移）
  function ensureSculptOffsets(body) {
    if (!Array.isArray(body.sculptOffsets) || body.sculptOffsets.length !== 56) {
      body.sculptOffsets = Array.from({ length: 56 }, () => ({ dx: 0, dy: 0 }));
    }
    return body.sculptOffsets;
  }

  function generateSmoothHeadPoints(body, scale = 1) {
    const rxBase = 98 * (body.faceWidth || 1) * scale;
    const ryBase = 90 * scale;
    const cheek = body.cheekPlump ?? 0.72;
    const chinR = body.chinRound ?? 0.84;
    const offs = ensureSculptOffsets(body);
    const pts = [];
    const N = 56;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 - Math.PI * 0.5;
      const ca = Math.cos(a), sa = Math.sin(a);
      const posSa = Math.max(0, sa);
      const negSa = Math.max(0, -sa);
      const cheekBell = Math.exp(-Math.pow((sa - 0.36) / 0.44, 2));
      const chinCurve = Math.pow(posSa, 2.8);
      const chinFactor = 1 - (1 - chinR) * 0.24 * chinCurve;
      const browCurve = 1 - 0.028 * Math.pow(negSa, 2.2);
      const x = ca * rxBase * (1 + 0.095 * cheek * cheekBell) * chinFactor * browCurve + (offs[i].dx || 0) * scale;
      const y = sa * ryBase * (1 + (1 - chinR) * 0.055 * chinCurve) + (offs[i].dy || 0) * scale;
      pts.push({ x, y });
    }
    return pts;
  }

  // Nomad Sculpt 风格推捏塑形笔刷（Move / Inflate / Pinch / Smooth + 自动对称 + 拉普拉斯顺滑防折角）

  function generateLimbPoints(kind, isSlender, scale = 1) {
    const pts = [];
    const N = 32;
    if (kind === 'torso') {
      // 真实棉花娃娃紧凑躯干：下缘收在胯部裆位，彻底消除两腿间多余垂肚
      const hTop = (isSlender ? 56 : 48) * scale;
      const hBot = (isSlender ? 41 : 34) * scale;
      const topW = 34 * scale, botW = 43 * scale;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 - Math.PI * 0.5;
        const sa = Math.sin(a);
        const t = (sa + 1) * 0.5;
        const rx = lerp(topW, botW, Math.pow(t, 0.78));
        const y = sa < 0 ? sa * hTop : sa * hBot;
        pts.push({ x: Math.cos(a) * rx, y });
      }
    } else if (kind === 'arm') {
      const len = (isSlender ? 40 : 34) * scale;
      const w = 15.5 * scale;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 - Math.PI * 0.5;
        const handBulge = Math.sin(a) > 0.3 ? 1.08 : 1.0;
        pts.push({ x: Math.cos(a) * w * handBulge, y: Math.sin(a) * len });
      }
    } else if (kind === 'leg') {
      const len = (isSlender ? 44 : 36) * scale;
      const w = 17.5 * scale;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 - Math.PI * 0.5;
        const foot = Math.sin(a) > 0.35 ? 1.12 : 1.0;
        pts.push({ x: Math.cos(a) * w * foot, y: Math.sin(a) * len });
      }
    }
    return pts;
  }

  // 真实 4 种布料材质 + 基于包围盒自适应半径的 3D 蓬松立体渲染（支持两遍无缝融合：'outline' | 'fill' | 'both'）
  function fillPlushShape(c, pts, baseColor, fabricType = 'plush_5mm', fillLevel = 88, passMode = 'both') {
    if (!pts || pts.length < 3) return;
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    pts.forEach(p => { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; });
    const cx = (minX + maxX) * 0.5, cy = (minY + maxY) * 0.5;
    const rad = Math.max(maxX - minX, maxY - minY) * 0.62 || 60;

    const shadowCol = shadeHex(baseColor, -0.11);
    const lightCol = shadeHex(baseColor, 0.13);
    const outlineCol = hexAlpha(shadeHex(baseColor, -0.22), 0.54);

    c.save();
    // Pass A: 仅外轮廓（用于四肢与躯干无缝一体化描边，消除肩部/胯部割裂线）
    if (passMode === 'outline') {
      if (fabricType === 'plush_5mm' || fabricType === 'teddy_curl') {
        traceSmoothClosedCurve(c, pts);
        c.strokeStyle = hexAlpha(baseColor, 0.72);
        c.lineWidth = fabricType === 'teddy_curl' ? 7.5 : 5.4;
        c.lineJoin = 'round';
        c.stroke();
      }
      traceSmoothClosedCurve(c, pts);
      c.strokeStyle = outlineCol;
      c.lineWidth = fabricType === 'teddy_curl' ? 3.2 : 2.6;
      c.lineJoin = 'round';
      c.stroke();
      c.restore();
      return;
    }

    // 1) 5mm短毛绒 / 泰迪卷毛外缘柔绒晕边（哑光毛绒质感，不再像塑料球）
    if (passMode === 'both' && (fabricType === 'plush_5mm' || fabricType === 'teddy_curl')) {
      traceSmoothClosedCurve(c, pts);
      c.strokeStyle = hexAlpha(baseColor, 0.65);
      c.lineWidth = fabricType === 'teddy_curl' ? 6.5 : 4.6;
      c.lineJoin = 'round';
      c.stroke();
    }

    // 2) 主体填充 + 柔和哑光绒面立体渐变
    traceSmoothClosedCurve(c, pts);
    if (fillLevel > 8) {
      const g = c.createRadialGradient(cx - rad * 0.18, cy - rad * 0.22, rad * 0.12, cx, cy, rad * 1.12);
      g.addColorStop(0, lightCol);
      g.addColorStop(0.45, baseColor);
      g.addColorStop(0.84, baseColor);
      g.addColorStop(1, shadowCol);
      c.fillStyle = g;
    } else {
      c.fillStyle = baseColor;
    }
    c.fill();

    // 3) 4 种布料肌理（真正肉眼可见！）
    c.save();
    c.clip();
    if (fabricType === 'plush_5mm') {
      // 细密短绒高光微粒
      c.fillStyle = 'rgba(255,255,255,0.16)';
      for (let y = minY; y < maxY; y += 9) {
        for (let x = minX; x < maxX; x += 9) {
          if (((Math.round(x + y) * 13) % 7) === 0) {
            c.fillRect(x, y, 2, 1.2);
          }
        }
      }
    } else if (fabricType === 'teddy_curl') {
      // 泰迪卷毛小圈肌理
      c.strokeStyle = hexAlpha(shadowCol, 0.42);
      c.lineWidth = 1.3;
      for (let y = minY + 6; y < maxY; y += 14) {
        for (let x = minX + 6; x < maxX; x += 14) {
          const ox = (Math.round(y / 14) % 2) * 7;
          c.beginPath(); c.arc(x + ox, y, 4.2, 0.2, Math.PI * 1.65); c.stroke();
        }
      }
    } else if (fabricType === 'elastic_rib') {
      // 高弹针织细竖纹
      c.strokeStyle = hexAlpha(shadowCol, 0.25);
      c.lineWidth = 1.1;
      for (let x = minX; x < maxX; x += 6) {
        c.beginPath(); c.moveTo(x, minY); c.lineTo(x, maxY); c.stroke();
      }
    } else if (fabricType === 'peach_skin') {
      // 桃皮绒丝滑柔光带
      const sheen = c.createLinearGradient(minX, minY, maxX, maxY);
      sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
      sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
      sheen.addColorStop(1, 'rgba(0,0,0,0.06)');
      c.fillStyle = sheen; c.fillRect(minX, minY, maxX - minX, maxY - minY);
    }

    c.restore();

    // 4) 极柔和绒布边缘线（passMode === 'fill' 时跳过内线，实现四肢与躯干自然无缝融合）
    if (passMode === 'both') {
      traceSmoothClosedCurve(c, pts);
      c.strokeStyle = outlineCol;
      c.lineWidth = fabricType === 'teddy_curl' ? 1.8 : 1.25;
      c.stroke();
    }
    c.restore();
  }


  /* =========================================================================
   * 4. Tomodachi 级五官渲染器（眉/眼/异瞳/睫毛/高光/鼻/嘴/腮红/印记/自由绣）
   * ========================================================================= */
  function drawFaceAll(c, f, craft, scale = 1, showFreeEmb = true, blinkVal = 0) {
    c.save();
    c.scale(scale, scale);

    // 1) 腮红
    if (f.blushStyle !== 'none' && f.blushAlpha > 0.02) {
      const bxOff = f.eyeSpacing + 14, by = f.eyeY + 19;
      if (f.blushStyle === 'nose') {
        const g = c.createRadialGradient(0, by - 4, 2, 0, by - 4, bxOff + 14);
        g.addColorStop(0, hexAlpha(f.blushColor, f.blushAlpha * 0.85));
        g.addColorStop(1, hexAlpha(f.blushColor, 0));
        c.fillStyle = g;
        c.beginPath(); c.ellipse(0, by - 4, bxOff + 16, 13, 0, 0, Math.PI * 2); c.fill();
      } else {
        [-1, 1].forEach(dir => {
          const bx = dir * bxOff;
          const rx = f.blushStyle === 'oval' ? 22 : 18;
          const ry = f.blushStyle === 'oval' ? 11 : 15;
          const g = c.createRadialGradient(bx, by, 2, bx, by, rx);
          g.addColorStop(0, hexAlpha(f.blushColor, f.blushAlpha));
          g.addColorStop(1, hexAlpha(f.blushColor, 0));
          c.fillStyle = g;
          c.beginPath(); c.ellipse(bx, by, rx, ry, 0, 0, Math.PI * 2); c.fill();
          if (f.blushStyle === 'slash') {
            c.strokeStyle = hexAlpha(shadeHex(f.blushColor, -0.18), f.blushAlpha + 0.25);
            c.lineWidth = 1.7; c.lineCap = 'round';
            for (let k = -1; k <= 1; k++) {
              c.beginPath(); c.moveTo(bx + k * 6 - 3, by + 4.5); c.lineTo(bx + k * 6 + 3, by - 4.5); c.stroke();
            }
          }
        });
      }
    }

    // 2) 眉毛（支持 none 自画 + 7种款式）
    if (f.browStyle !== 'none') {
      c.save();
      c.strokeStyle = f.browColor; c.fillStyle = f.browColor;
      c.lineWidth = f.browThickness || 2.6; c.lineCap = 'round';
      [-1, 1].forEach(dir => {
        c.save();
        c.translate(dir * f.browSpacing, f.eyeY + f.browY);
        c.rotate(dir * (f.browTilt || 0));
        if (f.browStyle === 'dot') {
          c.beginPath(); c.ellipse(0, 0, 5.5, 4.2, 0, 0, Math.PI * 2); c.fill();
        } else if (f.browStyle === 'straight') {
          c.beginPath(); c.moveTo(-12, 0); c.lineTo(12, 0); c.stroke();
        } else if (f.browStyle === 'worried') {
          c.beginPath(); c.moveTo(-11 * dir, -4); c.quadraticCurveTo(0, -1, 11 * dir, 4.5); c.stroke();
        } else if (f.browStyle === 'sharp') {
          c.beginPath(); c.moveTo(-12 * dir, 4); c.lineTo(2 * dir, -3.5); c.lineTo(12 * dir, 0); c.stroke();
        } else if (f.browStyle === 'raised') {
          c.beginPath(); c.moveTo(-11 * dir, 2); c.quadraticCurveTo(2 * dir, -7, 12 * dir, -2); c.stroke();
        } else if (f.browStyle === 'thin') {
          c.lineWidth = Math.max(1.4, (f.browThickness || 2.6) * 0.65);
          c.beginPath(); c.moveTo(-12, 2); c.quadraticCurveTo(0, -5, 12, 2); c.stroke();
        } else {
          c.beginPath(); c.moveTo(-12, 2); c.quadraticCurveTo(0, -4.5, 12, 1.5); c.stroke();
        }
        c.restore();
      });
      c.restore();
    }

    // 3) 眼睛（支持 none 自画 + 8种款式）
    if (f.eyeStyle !== 'none') [-1, 1].forEach(dir => {
      const irisCol = (dir === 1 && f.heterochromia) ? f.eyeColorR : f.eyeColorL;
      c.save();
      c.translate(dir * f.eyeSpacing, f.eyeY);
      c.rotate(dir * (f.eyeTilt || 0));
      const blinkScaleY = (f.eyeStyle !== 'smile' && f.eyeStyle !== 'closed') ? Math.max(0.08, 1 - (blinkVal || 0) * 0.92) : 1;
      c.scale(f.eyeSize || 1, (f.eyeSize || 1) * blinkScaleY);

      if (f.eyeStyle === 'smile') {
        c.strokeStyle = irisCol; c.lineWidth = 3.8; c.lineCap = 'round';
        c.beginPath(); c.arc(0, 6, 13, Math.PI * 1.12, Math.PI * 1.88); c.stroke();
        if (f.lashStyle !== 'none') {
          c.lineWidth = 2; c.beginPath(); c.moveTo(dir * 11, -1); c.lineTo(dir * 16, -5); c.stroke();
        }
      } else if (f.eyeStyle === 'closed') {
        c.strokeStyle = irisCol; c.lineWidth = 3.3; c.lineCap = 'round';
        c.beginPath(); c.arc(0, -4, 13, Math.PI * 0.14, Math.PI * 0.86); c.stroke();
        for (let k = -1; k <= 1; k++) {
          c.lineWidth = 1.9;
          c.beginPath(); c.moveTo(k * 7, 8); c.lineTo(k * 8.5, 13); c.stroke();
        }
      } else if (f.eyeStyle === 'button') {
        c.fillStyle = irisCol;
        c.beginPath(); c.arc(0, 0, 8.2, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#FFFFFF';
        c.beginPath(); c.arc(-2.8, -2.8, 2.6, 0, Math.PI * 2); c.fill();
      } else {
        // 完整精绣虹膜眼型：round / cat / droopy / fox / star
        const rx = f.eyeStyle === 'fox' ? 15 : (f.eyeStyle === 'cat' ? 14 : 13.2);
        const ry = f.eyeStyle === 'fox' ? 9.5 : (f.eyeStyle === 'cat' ? 11.8 : 13.8);
        const outerTilt = f.eyeStyle === 'cat' ? -0.14 : (f.eyeStyle === 'droopy' ? 0.16 : 0);
        c.rotate(dir * outerTilt);

        // 眼白底（柔和微露）
        c.fillStyle = '#FFFDFB';
        c.beginPath(); c.ellipse(0, 0, rx + 1.5, ry + 0.8, 0, 0, Math.PI * 2); c.fill();

        // 眼眶深色缎面底 + 棉花娃娃精绣虹膜渐变（上深下透亮月牙光）
        c.save();
        c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); c.clip();
        const ig = c.createLinearGradient(0, -ry, 0, ry);
        ig.addColorStop(0, shadeHex(irisCol, -0.45));
        ig.addColorStop(0.52, irisCol);
        ig.addColorStop(1, shadeHex(irisCol, 0.42));
        c.fillStyle = ig;
        c.fillRect(-rx - 2, -ry - 2, rx * 2 + 4, ry * 2 + 4);

        // 下缘通透柔光月牙（真实精绣棉花娃娃眼眸灵魂）
        const lowG = c.createRadialGradient(0, ry * 0.65, 1, 0, ry * 0.55, rx * 0.85);
        lowG.addColorStop(0, shadeHex(irisCol, 0.72));
        lowG.addColorStop(0.65, hexAlpha(shadeHex(irisCol, 0.48), 0.5));
        lowG.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = lowG;
        c.beginPath(); c.ellipse(0, ry * 0.46, rx * 0.82, ry * 0.55, 0, 0, Math.PI * 2); c.fill();

        // 瞳孔
        c.fillStyle = shadeHex(irisCol, -0.62);
        if (f.eyeStyle === 'star') {
          drawStarPath(c, 0, 0.5, 5, rx * 0.5, rx * 0.24); c.fill();
        } else {
          c.beginPath(); c.ellipse(0, 0.5, rx * 0.42, ry * 0.42, 0, 0, Math.PI * 2); c.fill();
        }

        // 高光款式
        c.fillStyle = '#FFFFFF';
        if (f.highlightStyle === 'double') {
          c.beginPath(); c.arc(-4.5, -4.4, 4.0, 0, Math.PI * 2); c.fill();
          c.beginPath(); c.arc(4.2, 4.2, 1.9, 0, Math.PI * 2); c.fill();
        } else if (f.highlightStyle === 'star') {
          c.beginPath(); c.arc(-4.5, -4.2, 3.4, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#FFF9DC';
          drawStarPath(c, 4.2, 3.6, 4, 4.6, 1.5); c.fill();
        } else if (f.highlightStyle === 'heart') {
          c.beginPath(); c.arc(-4.4, -4.2, 3.2, 0, Math.PI * 2); c.fill();
          drawTinyHeart(c, 3.8, 3.5, 3.2, '#FFEAF0');
        } else {
          c.beginPath(); c.ellipse(-4.2, -4.2, 4.2, 3.4, -0.3, 0, Math.PI * 2); c.fill();
          c.beginPath(); c.arc(4.8, -1.6, 1.6, 0, Math.PI * 2); c.fill();
          c.strokeStyle = 'rgba(255, 245, 248, 0.88)'; c.lineWidth = 2.1; c.lineCap = 'round';
          c.beginPath(); c.arc(0, 1.5, rx * 0.62, Math.PI * 0.22, Math.PI * 0.78); c.stroke();
        }
        c.restore();

        // 精绣上眼线 + 温柔双眼皮褶线（plush 为加厚丝绒弯睫，还原手工厚绣眼线感）
        if (f.lashStyle === 'plush') {
          c.strokeStyle = '#3B2820'; c.lineWidth = 6.2; c.lineCap = 'round';
          c.beginPath(); c.ellipse(0, -1.2, rx + 2.2, ry + 0.6, 0, Math.PI * 1.02, Math.PI * 1.98); c.stroke();
          // 外眼角微垂小睫毛
          c.lineWidth = 2.4;
          c.beginPath(); c.moveTo(dir * (rx + 1.5), -1); c.lineTo(dir * (rx + 5.2), 4.5); c.stroke();
          c.strokeStyle = 'rgba(138, 96, 86, 0.52)'; c.lineWidth = 1.3;
          c.beginPath(); c.ellipse(0, -5.5, rx * 0.78, ry * 0.88, 0, Math.PI * 1.18, Math.PI * 1.82); c.stroke();
        } else {
          c.strokeStyle = '#331E1C'; c.lineWidth = f.lashStyle === 'full' ? 3.8 : 2.8; c.lineCap = 'round';
          c.beginPath(); c.ellipse(0, 0, rx, ry, 0, Math.PI * 1.04, Math.PI * 1.96); c.stroke();
          c.strokeStyle = 'rgba(138, 96, 86, 0.58)'; c.lineWidth = 1.3;
          c.beginPath(); c.ellipse(0, -2.5, rx * 0.86, ry * 0.96, 0, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
        }

        // 睫毛
        if (f.lashStyle !== 'none' && f.lashStyle !== 'plush') {
          c.lineWidth = 2;
          c.beginPath(); c.moveTo(dir * (rx - 1), -ry * 0.35); c.lineTo(dir * (rx + 5.5), -ry * 0.68); c.stroke();
          if (f.lashStyle === 'full' || f.lashStyle === 'lower') {
            c.beginPath(); c.moveTo(dir * (rx - 4), -ry * 0.68); c.lineTo(dir * (rx + 2), -ry * 1.02); c.stroke();
          }
          if (f.lashStyle === 'lower') {
            c.lineWidth = 1.4;
            for (let k = -1; k <= 1; k++) {
              c.beginPath(); c.moveTo(k * 5, ry - 0.5); c.lineTo(k * 6, ry + 3.8); c.stroke();
            }
          }
        }
      }
      c.restore();
    });

    // 4) 鼻子（5款）
    if (f.noseStyle !== 'none') {
      c.save();
      c.translate(0, f.noseY);
      c.scale(f.noseSize || 1, f.noseSize || 1);
      if (f.noseStyle === 'dot') {
        c.fillStyle = '#A87C6A'; c.beginPath(); c.arc(0, 0, 2.2, 0, Math.PI * 2); c.fill();
      } else if (f.noseStyle === 'soft') {
        const ng = c.createRadialGradient(0, 0, 1, 0, 0, 8.5);
        ng.addColorStop(0, 'rgba(238, 158, 168, 0.42)');
        ng.addColorStop(1, 'rgba(238, 158, 168, 0)');
        c.fillStyle = ng;
        c.beginPath(); c.ellipse(0, 0, 8.5, 6.5, 0, 0, Math.PI * 2); c.fill();
      } else if (f.noseStyle === 'tri') {
        c.fillStyle = '#C98A7C';
        c.beginPath(); c.moveTo(0, 3); c.lineTo(-3.5, -2); c.lineTo(3.5, -2); c.closePath(); c.fill();
      } else if (f.noseStyle === 'dash') {
        c.strokeStyle = '#9C7262'; c.lineWidth = 2; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-3.5, 0); c.lineTo(3.5, 0); c.stroke();
      }
      c.restore();
    }

    // 5) 嘴巴（支持 none 无嘴自画 + 8款 + 独立唇色）
    if (f.mouthStyle !== 'none') {
      c.save();
      c.translate(0, f.mouthY);
      c.scale(f.mouthScale || 1, f.mouthScale || 1);
      c.strokeStyle = f.mouthColor; c.fillStyle = f.mouthColor;
      c.lineWidth = 2.6; c.lineCap = 'round'; c.lineJoin = 'round';
      if (f.mouthStyle === 'mini_dip') {
        c.lineWidth = 2.8;
        c.beginPath();
        c.moveTo(-5.5, 0);
        c.quadraticCurveTo(-2.5, 0, 0, 1.8);
        c.quadraticCurveTo(2.5, 0, 5.5, 0);
        c.stroke();
      } else if (f.mouthStyle === 'smile') {
        c.beginPath(); c.arc(0, -4, 8.5, Math.PI * 0.16, Math.PI * 0.84); c.stroke();
      } else if (f.mouthStyle === 'cat') {
        c.beginPath();
        c.arc(-5.6, -2, 5.6, Math.PI * 0.1, Math.PI * 0.92);
        c.arc(5.6, -2, 5.6, Math.PI * 0.08, Math.PI * 0.9);
        c.stroke();
      } else if (f.mouthStyle === 'pout') {
        c.beginPath(); c.ellipse(0, 0, 5.5, 3.8, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.ellipse(-1.5, -1, 2, 1, 0, 0, Math.PI * 2); c.fill();
      } else if (f.mouthStyle === 'happy') {
        c.fillStyle = shadeHex(f.mouthColor, -0.05);
        c.beginPath(); c.arc(0, -3, 10, 0.06, Math.PI - 0.06); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#F5A6B2';
        c.beginPath(); c.ellipse(0, 3.8, 5.5, 2.8, 0, 0, Math.PI * 2); c.fill();
      } else if (f.mouthStyle === 'sad') {
        c.beginPath(); c.arc(0, 8, 8.5, Math.PI * 1.18, Math.PI * 1.82); c.stroke();
      } else if (f.mouthStyle === 'tongue') {
        c.beginPath(); c.arc(0, -4, 8.5, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
        c.fillStyle = '#F08898';
        c.beginPath(); c.arc(2.5, 3.5, 4.5, 0, Math.PI); c.fill(); c.stroke();
      } else if (f.mouthStyle === 'fang') {
        c.beginPath(); c.arc(0, -4, 9, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
        c.fillStyle = '#FFFFFF';
        c.beginPath(); c.moveTo(4, 2.5); c.lineTo(6.8, 7.2); c.lineTo(8.5, 1.5); c.closePath(); c.fill();
      } else if (f.mouthStyle === 'oh') {
        c.fillStyle = hexAlpha(f.mouthColor, 0.72);
        c.beginPath(); c.ellipse(0, 1, 4.5, 5.8, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      }
      c.restore();
    }

    // 6) 面部印记
    const mk = f.marks || {};
    if (mk.moleL) { c.fillStyle = '#4A3228'; c.beginPath(); c.arc(-f.eyeSpacing - 6, f.eyeY + 15, 2, 0, Math.PI * 2); c.fill(); }
    if (mk.moleR) { c.fillStyle = '#4A3228'; c.beginPath(); c.arc(f.eyeSpacing + 6, f.eyeY + 15, 2, 0, Math.PI * 2); c.fill(); }
    if (mk.freckles) {
      c.fillStyle = '#C48D74';
      [-1, 1].forEach(dir => {
        [[dir * (f.eyeSpacing + 6), f.eyeY + 15], [dir * (f.eyeSpacing + 14), f.eyeY + 18], [dir * (f.eyeSpacing + 18), f.eyeY + 12]].forEach(([x, y]) => {
          c.beginPath(); c.arc(x, y, 1.35, 0, Math.PI * 2); c.fill();
        });
      });
    }
    if (mk.bandaid) {
      c.save(); c.translate(f.eyeSpacing + 14, f.eyeY + 20); c.rotate(-0.22);
      c.fillStyle = '#F2CFA8'; c.strokeStyle = '#B88D68'; c.lineWidth = 1.2;
      c.beginPath(); c.roundRect(-12, -5, 24, 10, 4); c.fill(); c.stroke();
      c.fillStyle = '#FAF0E2'; c.fillRect(-4, -4, 8, 8);
      c.restore();
    }
    if (mk.huadian) {
      c.fillStyle = '#D64C5C';
      drawTinyHeart(c, 0, f.eyeY + f.browY - 8, 5.5, '#D64C5C');
    }
    if (mk.starCheek) {
      c.fillStyle = '#EAB748';
      drawStarPath(c, -f.eyeSpacing - 14, f.eyeY + 18, 5, 5.5, 2.5); c.fill();
    }

    // 7) 玩家自由刺绣与手绘五官层（支持平滑实线/平针/结粒点/闭合填色 + 镜像对称）
    if (showFreeEmb && craft && craft.freeStrokes && craft.freeStrokes.length) {
      drawCustomStrokes(c, craft.freeStrokes);
    }
    c.restore();
  }

  // 通用自由手绘渲染器（支持平滑实线、针脚虚线、闭合色块填色、珠光圆点与左右对称镜像）
  // 通用矢量局部橡皮擦（支持逐点擦断线段、整块移除填色/珠点，并同步镜像擦除）

  function drawCustomStrokes(c, strokes) {
    if (!strokes || !strokes.length) return;
    strokes.forEach(st => {
      if (!st.points || !st.points.length) return;
      const drawOne = (flipX) => {
        c.save();
        if (st.type === 'dot') {
          const p = st.points[0];
          c.fillStyle = st.color;
          c.beginPath(); c.arc(p.x * flipX, p.y, st.width * 1.2, 0, Math.PI * 2); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.55)';
          c.beginPath(); c.arc(p.x * flipX - st.width * 0.35, p.y - st.width * 0.35, st.width * 0.35, 0, Math.PI * 2); c.fill();
        } else if (st.type === 'circle' && st.points.length >= 2) {
          const p0 = st.points[0], p1 = st.points[st.points.length - 1];
          const cx = ((p0.x + p1.x) * 0.5) * flipX, cy = (p0.y + p1.y) * 0.5;
          const r = Math.max(2, Math.hypot(p1.x - p0.x, p1.y - p0.y) * 0.5);
          c.fillStyle = st.color;
          c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
        } else if (st.type === 'ellipse' && st.points.length >= 2) {
          const p0 = st.points[0], p1 = st.points[st.points.length - 1];
          const cx = ((p0.x + p1.x) * 0.5) * flipX, cy = (p0.y + p1.y) * 0.5;
          const rx = Math.max(2, Math.abs(p1.x - p0.x) * 0.5);
          const ry = Math.max(2, Math.abs(p1.y - p0.y) * 0.5);
          c.fillStyle = st.color;
          c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); c.fill();
        } else if (st.type === 'airbrush') {
          const r = Math.max(6, (st.width || 6) * 2.6);
          const str = clamp(st.strength ?? 0.35, 0.05, 1.0);
          // 柔和径向雾化喷枪：弱阈值轻扫渐变，强阈值厚涂上色
          const dabAlpha = 0.04 + Math.pow(str, 1.45) * 0.42;
          st.points.forEach(p => {
            const px = p.x * flipX, py = p.y;
            const g = c.createRadialGradient(px, py, r * 0.08, px, py, r);
            g.addColorStop(0, hexAlpha(st.color, dabAlpha));
            g.addColorStop(0.55, hexAlpha(st.color, dabAlpha * 0.42));
            g.addColorStop(1, hexAlpha(st.color, 0));
            c.fillStyle = g;
            c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fill();
          });
        } else if (st.type === 'fill' && st.points.length > 2) {
          c.fillStyle = st.color;
          c.beginPath();
          st.points.forEach((p, idx) => { if (idx === 0) c.moveTo(p.x * flipX, p.y); else c.lineTo(p.x * flipX, p.y); });
          c.closePath(); c.fill();
        } else if (st.points.length > 1) {
          c.strokeStyle = st.color; c.lineWidth = st.width; c.lineCap = 'round'; c.lineJoin = 'round';
          if (st.type === 'pen') c.setLineDash([st.width * 1.5, st.width * 0.5]);
          c.beginPath();
          st.points.forEach((p, idx) => { if (idx === 0) c.moveTo(p.x * flipX, p.y); else c.lineTo(p.x * flipX, p.y); });
          c.stroke();
        }
        c.restore();
      };
      drawOne(1);
      if (st.mirror) drawOne(-1);
    });
  }

  function drawStarPath(c, cx, cy, spikes, outerR, innerR) {
    let rot = Math.PI / 2 * 3, step = Math.PI / spikes;
    c.beginPath(); c.moveTo(cx, cy - outerR);
    for (let i = 0; i < spikes; i++) {
      c.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR); rot += step;
      c.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR); rot += step;
    }
    c.closePath();
  }
  function drawTinyHeart(c, x, y, s, col) {
    c.save(); c.translate(x, y); c.fillStyle = col;
    c.beginPath(); c.moveTo(0, s * 0.7);
    c.bezierCurveTo(-s * 1.2, -s * 0.2, -s * 0.7, -s * 1.1, 0, -s * 0.35);
    c.bezierCurveTo(s * 0.7, -s * 1.1, s * 1.2, -s * 0.2, 0, s * 0.7);
    c.fill(); c.restore();
  }


  /* =========================================================================
   * 5. 完整娃娃组装、4层发型、带衣袖娃衣、配饰渲染
   * ========================================================================= */
  function fillOutfitPattern(c, mainCol, accentCol, pattern, bounds) {
    c.fillStyle = mainCol;
    c.fill();
    if (pattern === 'solid') return;
    c.save(); c.clip();
    const { x, y, w, h } = bounds;
    if (pattern === 'plaid') {
      c.fillStyle = hexAlpha(accentCol, 0.34);
      for (let gx = x; gx < x + w; gx += 16) c.fillRect(gx, y, 5, h);
      for (let gy = y; gy < y + h; gy += 16) c.fillRect(x, gy, w, 5);
      c.strokeStyle = hexAlpha(shadeHex(mainCol, -0.35), 0.32); c.lineWidth = 1;
      for (let gx = x + 8; gx < x + w; gx += 16) { c.beginPath(); c.moveTo(gx, y); c.lineTo(gx, y + h); c.stroke(); }
    } else if (pattern === 'dots') {
      c.fillStyle = hexAlpha(accentCol, 0.65);
      for (let gy = y + 6; gy < y + h; gy += 14) {
        for (let gx = x + 6; gx < x + w; gx += 14) {
          c.beginPath(); c.arc(gx + (Math.round(gy / 14) % 2) * 7, gy, 2.5, 0, Math.PI * 2); c.fill();
        }
      }
    } else if (pattern === 'stripe') {
      c.fillStyle = hexAlpha(accentCol, 0.55);
      for (let gy = y; gy < y + h; gy += 12) c.fillRect(x, gy, w, 4);
    } else if (pattern === 'cherry') {
      for (let gy = y + 12; gy < y + h; gy += 22) {
        for (let gx = x + 12; gx < x + w; gx += 22) {
          c.fillStyle = '#D44252';
          c.beginPath(); c.arc(gx - 2.5, gy + 2, 2.8, 0, Math.PI * 2); c.arc(gx + 2.5, gy + 2, 2.8, 0, Math.PI * 2); c.fill();
          c.strokeStyle = '#4B8A50'; c.lineWidth = 1;
          c.beginPath(); c.moveTo(gx - 2, gy); c.lineTo(gx, gy - 5); c.lineTo(gx + 2, gy); c.stroke();
        }
      }
    }
    c.restore();
  }

  function getActiveSleeveType(outfit) {
    const o = outfit || {};
    if (o.dress && o.dress !== 'none') {
      const d = OUTFIT_DRESSES.find(x => x.id === o.dress);
      return d ? d.sleeve : 'none';
    }
    if (o.top && o.top !== 'none') {
      const t = OUTFIT_TOPS.find(x => x.id === o.top);
      return t ? t.sleeve : 'none';
    }
    return 'none';
  }

  // 动态采样当前实际脸廓边缘点（含脸宽/腮肉/下巴与 Nomad 推捏偏移），确保耳朵永远牢牢吸附在脸上！
  function sampleHeadEdgeForEar(body, dir, targetAngleFromTop, scale = 0.86) {
    const pts = generateSmoothHeadPoints(body, scale);
    // generateSmoothHeadPoints 从 -PI/2 (头顶正中) 顺时针采样 N=56 点
    const N = pts.length;
    const rawIdx = dir > 0 ? (targetAngleFromTop / (Math.PI * 2)) * N : N - (targetAngleFromTop / (Math.PI * 2)) * N;
    const i0 = ((Math.floor(rawIdx) % N) + N) % N;
    const i1 = (i0 + 1) % N;
    const frac = rawIdx - Math.floor(rawIdx);
    return {
      x: lerp(pts[i0].x, pts[i1].x, frac),
      y: lerp(pts[i0].y, pts[i1].y, frac)
    };
  }

  function drawSmoothEars(c, headY, body, shiftX) {
    const ear = body.ears;
    if (ear === 'none') return;
    const base = body.skinColor, fType = body.fabricType;
    [-1, 1].forEach(dir => {
      c.save();
      if (ear === 'bunny') {
        const anc = sampleHeadEdgeForEar(body, dir, Math.PI * 0.34, 0.86);
        c.translate(anc.x + shiftX, headY + anc.y + 18);
        c.rotate(dir * 0.28);
        const pts = [];
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          pts.push({ x: Math.cos(a) * 18, y: Math.sin(a) * 48 });
        }
        fillPlushShape(c, pts, base, fType, 75);
        c.fillStyle = 'rgba(236, 166, 178, 0.5)';
        c.beginPath(); c.ellipse(0, 4, 9, 30, 0, 0, Math.PI * 2); c.fill();
      } else if (ear === 'cat' || ear === 'fox') {
        const tall = ear === 'fox' ? 1.25 : 1.0;
        const anc = sampleHeadEdgeForEar(body, dir, Math.PI * 0.24, 0.86);
        c.translate(anc.x + shiftX, headY + anc.y - 6);
        c.rotate(dir * 0.34);
        const pts = [
          { x: 0, y: -32 * tall }, { x: 18, y: -6 }, { x: 24, y: 18 },
          { x: 0, y: 24 }, { x: -24, y: 18 }, { x: -18, y: -6 }
        ];
        fillPlushShape(c, pts, base, fType, 75);
        c.fillStyle = ear === 'fox' ? '#FFF6EE' : 'rgba(236, 166, 178, 0.55)';
        c.beginPath(); c.moveTo(0, -18 * tall); c.quadraticCurveTo(12, 4, 11, 13); c.lineTo(-11, 13); c.quadraticCurveTo(-12, 4, 0, -18 * tall); c.fill();
      } else if (ear === 'bear') {
        const anc = sampleHeadEdgeForEar(body, dir, Math.PI * 0.25, 0.86);
        c.translate(anc.x + shiftX, headY + anc.y - 4);
        const pts = [];
        for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; pts.push({ x: Math.cos(a) * 23, y: Math.sin(a) * 22 }); }
        fillPlushShape(c, pts, base, fType, 78);
        c.fillStyle = 'rgba(236, 166, 178, 0.48)';
        c.beginPath(); c.arc(0, 2, 11, 0, Math.PI * 2); c.fill();
      } else if (ear === 'puppy') {
        const anc = sampleHeadEdgeForEar(body, dir, Math.PI * 0.44, 0.86);
        c.translate(anc.x + shiftX, headY + anc.y + 18);
        c.rotate(dir * 0.14);
        const pts = [];
        for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; pts.push({ x: Math.cos(a) * 21, y: Math.sin(a) * 38 }); }
        fillPlushShape(c, pts, shadeHex(base, -0.06), fType, 75);
      }
      c.restore();
    });
  }

  function makeHairGrad(c, yTop, yBot, hair) {
    const g = c.createLinearGradient(0, yTop, 0, yBot);
    g.addColorStop(0, shadeHex(hair.mainColor, 0.18));
    g.addColorStop(0.42, hair.mainColor);
    g.addColorStop(1, hair.tipEnabled ? hair.tipColor : shadeHex(hair.mainColor, -0.22));
    return g;
  }

  function drawHairBack(c, headY, hair, shiftX, outfitMainColor = '#E598A4') {
    c.save();
    c.translate(shiftX, headY);
    const strokeCol = shadeHex(hair.mainColor, -0.42);
    c.fillStyle = makeHairGrad(c, -90, 145, hair);
    c.strokeStyle = strokeCol; c.lineWidth = 2;

    const st = hair.backStyle;
    if (st === 'short_bob') {
      c.beginPath(); c.ellipse(0, -4, 98, 86, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    } else if (st === 'long_str') {
      c.beginPath();
      c.moveTo(-94, -18); c.quadraticCurveTo(-104, 82, -84, 150);
      c.quadraticCurveTo(0, 162, 84, 150); c.quadraticCurveTo(104, 82, 94, -18);
      c.arc(0, -10, 95, 0, Math.PI, true); c.closePath(); c.fill(); c.stroke();
    } else if (st === 'twin_tails') {
      c.beginPath(); c.ellipse(0, -6, 95, 84, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      [-1, 1].forEach(dir => {
        c.save(); c.translate(dir * 92, -14); c.rotate(dir * 0.18);
        c.beginPath(); c.moveTo(0, -18); c.quadraticCurveTo(dir * 40, 26, dir * 24, 114);
        c.quadraticCurveTo(0, 124, -dir * 12, 94); c.quadraticCurveTo(-dir * 18, 28, 0, -18);
        c.fill(); c.stroke();
        c.fillStyle = outfitMainColor || '#E598A4'; c.beginPath(); c.arc(0, -10, 7.5, 0, Math.PI * 2); c.fill();
        c.restore();
      });
    } else if (st === 'twin_buns') {
      c.beginPath(); c.ellipse(0, -6, 95, 84, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      [-1, 1].forEach(dir => {
        c.beginPath(); c.arc(dir * 75, -68, 28, 0, Math.PI * 2); c.fill(); c.stroke();
      });
    } else if (st === 'curly_puff') {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        c.beginPath(); c.arc(Math.cos(a) * 82, Math.sin(a) * 76 + 8, 32, 0, Math.PI * 2); c.fill(); c.stroke();
      }
    } else if (st === 'wolf_cut') {
      c.beginPath();
      c.moveTo(-94, -14); c.lineTo(-104, 52); c.lineTo(-78, 42); c.lineTo(-86, 86);
      c.lineTo(-42, 74); c.lineTo(0, 94); c.lineTo(42, 74); c.lineTo(86, 86);
      c.lineTo(78, 42); c.lineTo(104, 52); c.lineTo(94, -14);
      c.arc(0, -10, 95, 0, Math.PI, true); c.closePath(); c.fill(); c.stroke();
    } else if (st === 'hime_curl') {
      c.beginPath(); c.ellipse(0, -6, 96, 85, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      [-1, 1].forEach(dir => {
        c.beginPath(); c.ellipse(dir * 74, 78, 30, 56, dir * -0.1, 0, Math.PI * 2); c.fill(); c.stroke();
      });
    }
    // 玩家手绘后发层
    if (hair.customBackStrokes && hair.customBackStrokes.length) {
      drawCustomStrokes(c, hair.customBackStrokes);
    }
    c.restore();
  }

  function drawHairFront(c, headY, hair, shiftX) {
    c.save();
    c.translate(shiftX, headY);
    const strokeCol = shadeHex(hair.mainColor, -0.42);
    c.fillStyle = makeHairGrad(c, -92, 60, hair);
    c.strokeStyle = strokeCol; c.lineWidth = 2;

    // 1) 鬓角侧发 (支持 none / inward_curl 内扣龙须等)
    const sd = hair.sideStyle;
    if (sd !== 'none') [-1, 1].forEach(dir => {
      if (sd === 'inward_curl') {
        c.save();
        c.strokeStyle = hair.mainColor; c.lineWidth = 10.5; c.lineCap = 'round';
        c.beginPath();
        c.moveTo(dir * 78, -28);
        c.bezierCurveTo(dir * 96, 20, dir * 92, 68, dir * 68, 94);
        c.stroke();
        c.restore();
        return;
      }
      c.beginPath();
      if (sd === 'long') {
        c.moveTo(dir * 70, -52); c.quadraticCurveTo(dir * 102, 8, dir * 82, 92);
        c.quadraticCurveTo(dir * 62, 76, dir * 64, -10);
      } else if (sd === 'curl') {
        c.moveTo(dir * 70, -52); c.bezierCurveTo(dir * 106, -5, dir * 68, 35, dir * 86, 68);
        c.quadraticCurveTo(dir * 64, 58, dir * 64, -10);
      } else if (sd === 'short') {
        c.moveTo(dir * 72, -52); c.quadraticCurveTo(dir * 94, -16, dir * 80, 22);
        c.quadraticCurveTo(dir * 66, 12, dir * 66, -18);
      } else {
        c.moveTo(dir * 72, -52); c.quadraticCurveTo(dir * 100, -4, dir * 84, 54);
        c.quadraticCurveTo(dir * 66, 46, dir * 64, -12);
      }
      c.closePath(); c.fill(); c.stroke();
    });

    // 2) 前刘海 (8款含美人尖古风)
    const bg = hair.bangStyle;
    if (bg === 'widow_peak') {
      c.save();
      c.fillStyle = hair.mainColor; c.strokeStyle = strokeCol; c.lineWidth = 1.6;
      c.beginPath();
      c.arc(0, -10, 96, Math.PI * 1.04, Math.PI * 1.96);
      c.quadraticCurveTo(96, 16, 86, 22);
      c.quadraticCurveTo(72, -10, 56, -34);
      c.quadraticCurveTo(36, -50, 18, -44);
      c.quadraticCurveTo(0, -28, -18, -44);
      c.quadraticCurveTo(-36, -50, -56, -34);
      c.quadraticCurveTo(-72, -10, -86, 22);
      c.quadraticCurveTo(-96, 16, -95, -22);
      c.closePath(); c.fill(); c.stroke();
      c.restore();
    } else if (bg === 'full') {
      c.beginPath(); c.arc(0, -10, 92, Math.PI * 1.08, Math.PI * 1.92);
      c.lineTo(74, -16); c.quadraticCurveTo(44, -10, 30, -25);
      c.quadraticCurveTo(16, -8, 0, -10); c.quadraticCurveTo(-16, -8, -30, -25);
      c.quadraticCurveTo(-44, -10, -74, -16); c.closePath(); c.fill(); c.stroke();
    } else if (bg === 'air') {
      [-1, 1].forEach(dir => {
        c.beginPath(); c.moveTo(0, -86); c.quadraticCurveTo(dir * 54, -88, dir * 86, -24);
        c.quadraticCurveTo(dir * 56, -6, dir * 32, -22); c.quadraticCurveTo(dir * 14, -46, 0, -54);
        c.closePath(); c.fill(); c.stroke();
      });
    } else if (bg === 'side') {
      c.beginPath(); c.arc(0, -10, 92, Math.PI * 1.08, Math.PI * 1.92);
      c.quadraticCurveTo(22, -4, -36, -16); c.quadraticCurveTo(-62, -22, -84, -28);
      c.closePath(); c.fill(); c.stroke();
    } else if (bg === 'choppy') {
      c.beginPath(); c.arc(0, -10, 92, Math.PI * 1.12, Math.PI * 1.88);
      c.lineTo(66, -34); c.lineTo(46, -24); c.lineTo(26, -38); c.lineTo(0, -26);
      c.lineTo(-26, -38); c.lineTo(-46, -24); c.lineTo(-66, -34); c.closePath(); c.fill(); c.stroke();
    } else if (bg === 'center') {
      [-1, 1].forEach(dir => {
        c.beginPath(); c.moveTo(0, -88); c.quadraticCurveTo(dir * 62, -84, dir * 86, -18);
        c.quadraticCurveTo(dir * 68, 12, dir * 56, 22); c.quadraticCurveTo(dir * 34, -22, 0, -56);
        c.closePath(); c.fill(); c.stroke();
      });
    } else if (bg === 'spiky') {
      c.beginPath(); c.arc(0, -10, 92, Math.PI * 1.08, Math.PI * 1.92);
      c.lineTo(64, -14); c.lineTo(42, -32); c.lineTo(18, -6); c.lineTo(-4, -28);
      c.lineTo(-28, -8); c.lineTo(-50, -30); c.lineTo(-74, -14); c.closePath(); c.fill(); c.stroke();
    } else if (bg === 'open') {
      c.beginPath(); c.arc(0, -10, 92, Math.PI * 1.14, Math.PI * 1.86);
      c.quadraticCurveTo(0, -68, -82, -44); c.closePath(); c.fill(); c.stroke();
    }

    // 3) 呆毛 (5款)
    const ah = hair.ahogeStyle;
    c.strokeStyle = strokeCol; c.fillStyle = hair.mainColor;
    if (ah === 'single') {
      c.beginPath(); c.moveTo(-4, -88); c.quadraticCurveTo(-10, -124, 18, -114); c.quadraticCurveTo(4, -108, 4, -88); c.fill(); c.stroke();
    } else if (ah === 'heart') {
      [-1, 1].forEach(dir => {
        c.beginPath(); c.moveTo(0, -88); c.bezierCurveTo(dir * 26, -124, dir * 32, -96, 0, -104); c.stroke();
      });
    } else if (ah === 'double') {
      [-1, 1].forEach(dir => {
        c.beginPath(); c.moveTo(dir * 8, -88); c.quadraticCurveTo(dir * 24, -118, dir * 36, -104); c.stroke();
      });
    } else if (ah === 'curl') {
      c.lineWidth = 3.2; c.beginPath(); c.arc(4, -104, 11, 0.5, Math.PI * 2.1); c.stroke();
    }

    // 天使光环高光（有预设刘海时显示）
    if (bg !== 'none') {
      c.strokeStyle = 'rgba(255,255,255,0.42)'; c.lineWidth = 3.2; c.lineCap = 'round';
      c.beginPath(); c.arc(0, -14, 72, Math.PI * 1.24, Math.PI * 1.76); c.stroke();
    }
    // 玩家手绘前发层
    if (hair.customFrontStrokes && hair.customFrontStrokes.length) {
      drawCustomStrokes(c, hair.customFrontStrokes);
    }
    c.restore();
  }

  function drawOutfitTorso(c, torsoY, isSlender, outfit, shiftX, legAngles = { l: 0, r: 0 }) {
    c.save(); c.translate(shiftX, torsoY);
    const h = isSlender ? 64 : 54;
    const strokeCol = 'rgba(84, 62, 50, 0.76)';
    c.strokeStyle = strokeCol; c.lineWidth = 1.45; c.lineJoin = 'round';

    // 根据双腿骨骼角度动态驱动裙摆跟随摆动与外张（Spine 网格式裙摆变形）
    const lFlare = clamp(legAngles.l * 24, -10, 26);
    const rFlare = clamp(-legAngles.r * 24, -10, 26);
    const sway = (legAngles.l + legAngles.r) * 14;

    // 1) 下装（仅百褶裙在此绘制；短裤/南瓜裤已升级为两遍无缝一体化骨骼短裤，在 drawFullDoll 中与裤腿统一融合）
    if (outfit.dress === 'none' && outfit.bottom === 'pleated_skirt') {
      c.beginPath();
      c.moveTo(-36, 12); c.lineTo(36, 12);
      c.lineTo(52 + rFlare + sway * 0.4, h + 8 - Math.abs(rFlare) * 0.12);
      c.lineTo(-52 - lFlare + sway * 0.4, h + 8 - Math.abs(lFlare) * 0.12);
      c.closePath();
      fillOutfitPattern(c, outfit.bottomColor, outfit.accentColor, outfit.pattern, { x: -75, y: 12, w: 150, h: h + 10 });
      c.stroke();
      for (let k = -2; k <= 2; k++) {
        const tx = k * 14;
        const bx = k * 19 + sway * 0.35 + (k < 0 ? -lFlare * 0.45 : (k > 0 ? rFlare * 0.45 : 0));
        c.beginPath(); c.moveTo(tx, 14); c.lineTo(bx, h + 6); c.stroke();
      }
    }

    // 2) 连衣裙（裙摆跟随腿部动作自然摆动外扩）
    if (outfit.dress !== 'none') {
      c.fillStyle = outfit.accentColor;
      c.beginPath(); c.moveTo(-32, -h * 0.72); c.lineTo(32, -h * 0.72); c.lineTo(40, 14); c.lineTo(-40, 14); c.closePath(); c.fill(); c.stroke();
      const hemR = 58 + rFlare + sway * 0.35;
      const hemL = -58 - lFlare + sway * 0.35;
      c.beginPath();
      c.moveTo(-34, -14); c.lineTo(34, -14);
      c.quadraticCurveTo(hemR * 1.02, h * 0.62, hemR, h + 12);
      c.quadraticCurveTo(sway * 0.4, h + 16, hemL, h + 12);
      c.quadraticCurveTo(hemL * 1.02, h * 0.62, -34, -14); c.closePath();
      fillOutfitPattern(c, outfit.mainColor, outfit.accentColor, outfit.pattern, { x: -85, y: -14, w: 170, h: h + 32 });
      c.stroke();

      if (outfit.dress === 'berry_overall') {
        c.fillStyle = outfit.mainColor;
        [-20, 12].forEach(bx => { c.fillRect(bx, -h * 0.72, 8, 34); c.strokeRect(bx, -h * 0.72, 8, 34); });
        c.fillStyle = '#D94E5A'; c.beginPath(); c.arc(0, 16, 9, 0, Math.PI * 2); c.fill();
      } else if (outfit.dress === 'lace_lolita' || outfit.dress === 'apron_maid') {
        c.fillStyle = outfit.accentColor;
        for (let x = -48; x <= 48; x += 16) { c.beginPath(); c.arc(x, h + 10, 9, 0, Math.PI * 2); c.fill(); c.stroke(); }
        if (outfit.dress === 'apron_maid') { c.beginPath(); c.roundRect(-25, -8, 50, h + 8, 10); c.fill(); c.stroke(); }
        c.fillStyle = shadeHex(outfit.mainColor, -0.22);
        c.beginPath(); c.moveTo(0, -18); c.lineTo(-12, -25); c.lineTo(-12, -11); c.closePath();
        c.moveTo(0, -18); c.lineTo(12, -25); c.lineTo(12, -11); c.closePath(); c.fill();
      } else if (outfit.dress === 'hanfu_ruqun') {
        // 齐胸系带与飘带
        c.fillStyle = outfit.accentColor; c.fillRect(-36, -18, 72, 10); c.strokeRect(-36, -18, 72, 10);
        c.strokeStyle = outfit.accentColor; c.lineWidth = 4; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-6, -10); c.quadraticCurveTo(-18, 22, -10, h + 6);
        c.moveTo(6, -10); c.quadraticCurveTo(18, 22, 10, h + 6); c.stroke();
      }
    } else if (outfit.top !== 'none') {
      // 3) 单件上衣
      c.beginPath();
      c.moveTo(-34, -h * 0.74); c.lineTo(34, -h * 0.74);
      c.quadraticCurveTo(46, 0, 42, 24); c.lineTo(-42, 24);
      c.quadraticCurveTo(-46, 0, -34, -h * 0.74); c.closePath();
      fillOutfitPattern(c, outfit.mainColor, outfit.accentColor, outfit.pattern, { x: -46, y: -h * 0.74, w: 92, h: h * 0.74 + 26 });
      c.stroke();

      if (outfit.top === 'knit_sweater') {
        c.strokeStyle = hexAlpha(outfit.accentColor, 0.55); c.lineWidth = 2.2;
        [-14, 0, 14].forEach(x => { c.beginPath(); c.moveTo(x, -h * 0.65); c.lineTo(x, 20); c.stroke(); });
      } else if (outfit.top === 'sailor_top') {
        c.fillStyle = outfit.accentColor;
        c.beginPath(); c.moveTo(-24, -h * 0.72); c.lineTo(24, -h * 0.72); c.lineTo(0, -2); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#C84B58'; c.beginPath(); c.arc(0, -2, 6, 0, Math.PI * 2); c.fill();
      } else if (outfit.top === 'shirt_bow') {
        c.fillStyle = outfit.accentColor;
        c.beginPath(); c.moveTo(-18, -h * 0.72); c.lineTo(0, -h * 0.45); c.lineTo(18, -h * 0.72); c.stroke();
        c.beginPath(); c.moveTo(0, -h * 0.46); c.lineTo(-10, -h * 0.54); c.lineTo(-10, -h * 0.38); c.closePath();
        c.moveTo(0, -h * 0.46); c.lineTo(10, -h * 0.54); c.lineTo(10, -h * 0.38); c.closePath(); c.fill();
      } else if (outfit.top === 'hoodie') {
        c.fillStyle = hexAlpha(outfit.accentColor, 0.65);
        c.beginPath(); c.roundRect(-18, 2, 36, 16, 6); c.fill(); c.stroke();
      }
    }
    c.restore();
  }

  // 自然贴肩衣袖渲染（绘制在衣身/背带下层，肩部自然衔接无生硬球块感）
  function drawSleeveOnArm(c, sleeveType, outfit, isSlender) {
    if (sleeveType === 'none') return;
    const len = isSlender ? 40 : 34;
    c.save();
    c.strokeStyle = 'rgba(84, 62, 50, 0.72)'; c.lineWidth = 1.35; c.lineJoin = 'round';
    const col = outfit.dress !== 'none' && sleeveType === 'puff' ? outfit.accentColor : outfit.mainColor;
    const g = c.createLinearGradient(-16, -len * 0.6, 16, len * 0.4);
    g.addColorStop(0, shadeHex(col, 0.08));
    g.addColorStop(0.7, col);
    g.addColorStop(1, shadeHex(col, -0.10));
    c.fillStyle = g;
    if (sleeveType === 'puff') {
      // 柔和微灯笼袖：上端顺着肩窝自然收窄，下端微收松紧袖口
      c.beginPath();
      c.moveTo(-13, -len * 0.66);
      c.bezierCurveTo(-20, -len * 0.32, -19, len * 0.02, -14, len * 0.14);
      c.quadraticCurveTo(0, len * 0.22, 14, len * 0.14);
      c.bezierCurveTo(19, len * 0.02, 20, -len * 0.32, 13, -len * 0.66);
      c.closePath();
      c.fill(); c.stroke();
      // 细微袖口松紧线
      c.strokeStyle = hexAlpha(shadeHex(col, -0.25), 0.45); c.lineWidth = 1;
      c.beginPath(); c.moveTo(-13, len * 0.10); c.quadraticCurveTo(0, len * 0.17, 13, len * 0.10); c.stroke();
    } else if (sleeveType === 'short') {
      c.beginPath();
      c.moveTo(-13, -len * 0.68); c.lineTo(-16, len * 0.04);
      c.quadraticCurveTo(0, len * 0.12, 16, len * 0.04); c.lineTo(13, -len * 0.68);
      c.closePath(); c.fill(); c.stroke();
    } else if (sleeveType === 'long') {
      c.beginPath();
      c.moveTo(-13, -len * 0.68); c.lineTo(-16, len * 0.42);
      c.quadraticCurveTo(0, len * 0.50, 16, len * 0.42); c.lineTo(13, -len * 0.68);
      c.closePath(); c.fill(); c.stroke();
      c.fillStyle = outfit.accentColor;
      c.beginPath(); c.roundRect(-16.5, len * 0.36, 33, 6.5, 3); c.fill(); c.stroke();
    } else if (sleeveType === 'wide') {
      c.beginPath();
      c.moveTo(-13, -len * 0.66); c.lineTo(-20, len * 0.50);
      c.quadraticCurveTo(0, len * 0.60, 22, len * 0.54); c.lineTo(13, -len * 0.66);
      c.closePath(); c.fill(); c.stroke();
    }
    c.restore();
  }

  // 绑定至下肢骨骼的无缝一体短裤/南瓜裤（passMode: 'outline' | 'fill'）
  function drawPantLegOnLeg(c, outfit, isSlender, passMode = 'fill') {
    const len = (isSlender ? 44 : 36) * 0.92;
    c.save();
    c.beginPath();
    if (outfit.bottom === 'bloomers') {
      c.moveTo(-18.5, -len * 0.88);
      c.bezierCurveTo(-24, -len * 0.35, -23, len * 0.08, -17, len * 0.22);
      c.quadraticCurveTo(0, len * 0.30, 17, len * 0.22);
      c.bezierCurveTo(23, len * 0.08, 24, -len * 0.35, 18.5, -len * 0.88);
    } else {
      c.moveTo(-18.5, -len * 0.88);
      c.lineTo(-19.5, len * 0.14);
      c.quadraticCurveTo(0, len * 0.20, 19.5, len * 0.14);
      c.lineTo(18.5, -len * 0.88);
    }
    c.closePath();
    if (passMode === 'outline') {
      c.strokeStyle = 'rgba(84, 62, 50, 0.78)'; c.lineWidth = 2.8; c.lineJoin = 'round';
      c.stroke();
    } else {
      fillOutfitPattern(c, outfit.bottomColor, outfit.accentColor, outfit.pattern, { x: -24, y: -len, w: 48, h: len * 1.4 });
      if (outfit.bottom === 'denim_shorts') {
        c.fillStyle = shadeHex(outfit.bottomColor, 0.18);
        c.strokeStyle = 'rgba(84, 62, 50, 0.72)'; c.lineWidth = 1.25;
        c.beginPath(); c.roundRect(-20, len * 0.06, 40, 6.5, 2.5); c.fill(); c.stroke();
      }
    }
    c.restore();
  }

  function drawShortsHipPelvis(c, outfit, isSlender, passMode = 'fill') {
    const hBot = isSlender ? 43 : 36; // 完整覆盖至躯干胯底，绝不露出裸肚皮
    c.save();
    c.beginPath();
    c.moveTo(-40, 12); c.lineTo(40, 12);
    c.quadraticCurveTo(44, (12 + hBot) * 0.55, 34, hBot - 3);
    c.quadraticCurveTo(0, hBot + 5, -34, hBot - 3);
    c.quadraticCurveTo(-44, (12 + hBot) * 0.55, -40, 12);
    c.closePath();
    if (passMode === 'outline') {
      c.strokeStyle = 'rgba(84, 62, 50, 0.78)'; c.lineWidth = 2.8; c.lineJoin = 'round';
      c.stroke();
    } else {
      fillOutfitPattern(c, outfit.bottomColor, outfit.accentColor, outfit.pattern, { x: -46, y: 12, w: 92, h: hBot });
      // 腰头明线与精致小纽扣
      c.strokeStyle = hexAlpha(outfit.accentColor, 0.52); c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(-38, 18); c.lineTo(38, 18); c.stroke();
      c.fillStyle = outfit.accentColor; c.beginPath(); c.arc(0, 15, 2.4, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  // 严丝合缝包裹棉花小脚丫的鞋袜（彻底杜绝脚趾穿模）
  function drawShoesOnLeg(c, shoeId, outfit, isSlender) {
    if (shoeId === 'none') return;
    const footY = (isSlender ? 44 : 36) * 0.92; // 精确匹配 legPts 底部坐标
    c.save();
    c.strokeStyle = 'rgba(74, 52, 42, 0.82)'; c.lineWidth = 1.45; c.lineJoin = 'round';
    if (shoeId === 'mary_jane' || shoeId === 'stripe_shoe') {
      // 贴合小腿的短袜
      c.fillStyle = '#FFFDF9';
      c.beginPath();
      c.moveTo(-16.5, footY - 26); c.lineTo(16.5, footY - 26);
      c.lineTo(18.2, footY - 4); c.lineTo(-18.2, footY - 4); c.closePath();
      c.fill();
      if (shoeId === 'stripe_shoe') {
        c.fillStyle = outfit.mainColor;
        c.fillRect(-16.8, footY - 23, 33.6, 3);
        c.fillRect(-17.2, footY - 17, 34.4, 3);
      }
      c.strokeStyle = 'rgba(130, 110, 98, 0.45)'; c.lineWidth = 1.1;
      c.beginPath(); c.moveTo(-16.5, footY - 26); c.quadraticCurveTo(0, footY - 23.5, 16.5, footY - 26); c.stroke();

      // 完整包裹脚底与脚尖的圆润玛丽珍娃鞋（完全覆盖 footY 与 ±18.5 脚宽）
      c.strokeStyle = 'rgba(74, 52, 42, 0.85)'; c.lineWidth = 1.5;
      const sg = c.createRadialGradient(-4, footY - 10, 2, 0, footY - 4, 22);
      sg.addColorStop(0, shadeHex(outfit.shoeColor, 0.16));
      sg.addColorStop(0.7, outfit.shoeColor);
      sg.addColorStop(1, shadeHex(outfit.shoeColor, -0.20));
      c.fillStyle = sg;
      c.beginPath();
      c.moveTo(-18.8, footY - 12);
      c.bezierCurveTo(-20.2, footY - 2, -16, footY + 3.5, 0, footY + 3.5);
      c.bezierCurveTo(16, footY + 3.5, 20.2, footY - 2, 18.8, footY - 12);
      c.quadraticCurveTo(0, footY - 18, -18.8, footY - 12);
      c.closePath();
      c.fill(); c.stroke();

      // 鞋口露出的白袜圆弧与搭扣横带
      c.fillStyle = '#FFFDF9';
      c.beginPath(); c.ellipse(0, footY - 11.5, 10.5, 4.8, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = outfit.shoeColor; c.lineWidth = 3.2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-12.5, footY - 12.5); c.quadraticCurveTo(0, footY - 9.5, 12.5, footY - 12.5); c.stroke();
      c.fillStyle = '#E6BF6A'; c.beginPath(); c.arc(9.5, footY - 11.8, 2.2, 0, Math.PI * 2); c.fill();
    } else if (shoeId === 'bear_boots') {
      // 完整包裹脚掌与脚踝的毛绒雪地短靴
      const bg = c.createLinearGradient(-19, footY - 22, 19, footY + 3);
      bg.addColorStop(0, shadeHex(outfit.shoeColor, 0.14));
      bg.addColorStop(1, shadeHex(outfit.shoeColor, -0.14));
      c.fillStyle = bg;
      c.beginPath();
      c.moveTo(-18, footY - 22);
      c.lineTo(-19.8, footY - 4);
      c.quadraticCurveTo(-19, footY + 3.5, 0, footY + 3.5);
      c.quadraticCurveTo(19, footY + 3.5, 19.8, footY - 4);
      c.lineTo(18, footY - 22);
      c.closePath();
      c.fill(); c.stroke();
      // 靴口蓬松毛绒翻边
      c.fillStyle = '#FAF3E8';
      c.beginPath(); c.roundRect(-19.5, footY - 25, 39, 8.5, 4.5); c.fill(); c.stroke();
    }
    c.restore();
  }

  function drawAccessoryItem(c, acc, shiftX, isSelected, dollName = '小可爱') {
    c.save();
    c.translate(acc.x + shiftX, acc.y);
    c.rotate(acc.rot || 0);
    c.scale(acc.scale || 1, acc.scale || 1);
    const col = acc.color || '#DF7A8A';
    c.strokeStyle = '#433128'; c.lineWidth = 1.8;

    if (acc.id === 'ribbon_bow') {
      c.fillStyle = col;
      [-1, 1].forEach(dir => {
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(dir * 32, -22, dir * 30, 4);
        c.quadraticCurveTo(dir * 26, 20, 0, 4); c.closePath(); c.fill(); c.stroke();
      });
      c.fillStyle = shadeHex(col, 0.2); c.beginPath(); c.arc(0, 2, 7, 0, Math.PI * 2); c.fill(); c.stroke();
    } else if (acc.id === 'beret_hat') {
      c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, 56, 23, -0.08, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-4, -22); c.lineTo(2, -31); c.stroke();
    } else if (acc.id === 'crown') {
      c.fillStyle = col;
      c.beginPath(); c.moveTo(-24, 10); c.lineTo(-28, -12); c.lineTo(-10, -1); c.lineTo(0, -18);
      c.lineTo(10, -1); c.lineTo(28, -12); c.lineTo(24, 10); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#E05A6B'; c.beginPath(); c.arc(0, 1, 3.5, 0, Math.PI * 2); c.fill();
    } else if (acc.id === 'pearl_clip') {
      [-10, 0, 10].forEach((px, i) => {
        c.fillStyle = i === 1 ? col : '#FFFFFF';
        c.beginPath(); c.arc(px, i * 1.4, 5.5 - i * 0.5, 0, Math.PI * 2); c.fill(); c.stroke();
      });
    } else if (acc.id === 'round_glass' || acc.id === 'star_glass') {
      c.strokeStyle = col; c.lineWidth = 2.5;
      c.fillStyle = acc.id === 'star_glass' ? hexAlpha(col, 0.72) : 'rgba(220, 240, 250, 0.22)';
      [-36, 36].forEach(gx => { c.beginPath(); c.arc(gx, 0, 21, 0, Math.PI * 2); c.fill(); c.stroke(); });
      c.beginPath(); c.moveTo(-15, 0); c.quadraticCurveTo(0, -5, 15, 0); c.stroke();
    } else if (acc.id === 'knit_scarf') {
      c.fillStyle = col;
      c.beginPath(); c.roundRect(-42, -11, 84, 22, 10); c.fill(); c.stroke();
      c.beginPath(); c.roundRect(10, 4, 18, 36, 6); c.fill(); c.stroke();
    } else if (acc.id === 'bear_bag') {
      c.strokeStyle = shadeHex(col, -0.3); c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(-42, -56); c.lineTo(6, 4); c.stroke();
      c.fillStyle = col; c.strokeStyle = '#433128'; c.lineWidth = 1.6;
      [-10, 10].forEach(ex => { c.beginPath(); c.arc(ex, -11, 6, 0, Math.PI * 2); c.fill(); c.stroke(); });
      c.beginPath(); c.arc(0, 0, 16, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#433128'; c.beginPath(); c.arc(-5, -2, 1.8, 0, Math.PI * 2); c.arc(5, -2, 1.8, 0, Math.PI * 2); c.fill();
    } else if (acc.id === 'mini_bunny') {
      c.fillStyle = col;
      [-6, 6].forEach(ex => { c.beginPath(); c.ellipse(ex, -18, 4.5, 12, 0, 0, Math.PI * 2); c.fill(); c.stroke(); });
      c.beginPath(); c.arc(0, 0, 15, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#D97786'; c.beginPath(); c.arc(-5, -1, 1.8, 0, Math.PI * 2); c.arc(5, -1, 1.8, 0, Math.PI * 2); c.fill();
    } else if (acc.id === 'name_badge') {
      c.fillStyle = col; c.strokeStyle = '#D4A359'; c.lineWidth = 2;
      c.beginPath(); c.roundRect(-26, -13, 52, 26, 7); c.fill(); c.stroke();
      c.fillStyle = '#433128'; c.font = '800 9px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText((dollName || '小可爱').slice(0, 4), 0, 1);
    }

    if (isSelected) {
      c.strokeStyle = '#C46F7F'; c.lineWidth = 1.6; c.setLineDash([4, 3]);
      c.beginPath(); c.arc(0, 0, 36, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    }
    c.restore();
  }

  const HEAD_SCALE = 0.82;
  function getSkeletonJoints(isSlender) {
    const torsoY = isSlender ? 48 : 42;
    const headY = isSlender ? -54 : -48;
    const neckY = torsoY - (isSlender ? 40 : 34);
    const armLen = isSlender ? 54 : 46;
    const legLen = isSlender ? 56 : 46;
    return {
      torsoY, headY, neckY, armLen, legLen,
      actualHeadY: neckY + (headY - neckY) * HEAD_SCALE,
      faceScale: 0.86 * HEAD_SCALE,
      leftArm:  { x: -34, y: torsoY - (isSlender ? 30 : 24) },
      rightArm: { x: 34,  y: torsoY - (isSlender ? 30 : 24) },
      leftLeg:  { x: -20, y: torsoY + (isSlender ? 36 : 28) },
      rightLeg: { x: 20,  y: torsoY + (isSlender ? 36 : 28) }
    };
  }


  function drawFullDoll(c, dollState, animState, opts = {}) {
    const state = dollState || createDefaultState();
    const centerX = opts.centerX ?? 0;
    const centerY = opts.centerY ?? 0;
    const scale = opts.scale ?? 1;
    const turnDeg = opts.turnDeg ?? 0;
    const showCloth = opts.showCloth !== false;
    const showHair = opts.showHair !== false;
    const useLiveAnim = opts.useLiveAnim !== false;
    const forceLiveAnim = Boolean(opts.forceLiveAnim);
    const body = state.body;
    const isAnimLive = forceLiveAnim || (useLiveAnim && (state.step === 5 || state.step === 3 || state.step === 4) && !(state.step === 5 && state.subTab === 'pose' && state.pose && state.pose.animClip === 'static'));
    const a = (isAnimLive && animState) ? animState : {
      rootX: 0, rootY: 0, bodyTilt: 0, squashX: 1, squashY: 1,
      headTilt: state.pose.headTilt || 0, headY: 0, hairSway: 0,
      leftArm: state.pose.leftArm ?? 0.56, rightArm: state.pose.rightArm ?? -0.56,
      leftLeg: state.pose.leftLeg ?? 0.04, rightLeg: state.pose.rightLeg ?? -0.04
    };
    const isSlender = body.bodyType === 'slender';
    const turnShift = (turnDeg / 18) * 16;
    const j = getSkeletonJoints(isSlender);
    const torsoY = j.torsoY, headY = j.headY, neckY = j.neckY;
    const sleeveType = showCloth ? getActiveSleeveType(state.outfit) : 'none';

    c.save();
    c.translate(centerX + a.rootX * scale, centerY + a.rootY * scale);
    c.scale(scale * a.squashX, scale * a.squashY);
    c.rotate(a.bodyTilt || 0);

    // 1) 后发片（随歪头骨骼 + 二级发丝摆动物理）
    if (showHair) {
      c.save(); c.translate(0, neckY + (a.headY || 0)); c.rotate((a.headTilt || 0) + (a.hairSway || 0) * 0.45); c.scale(HEAD_SCALE, HEAD_SCALE); c.translate(0, -neckY);
      drawHairBack(c, headY, state.hair, -turnShift * 0.45 + (a.hairSway || 0) * 14, state.outfit && state.outfit.mainColor);
      c.restore();
    }

    // 2) 四肢与躯干两遍无缝融合渲染（Pass 1 统一外轮廓 → Pass 2 统一绒布填充，彻底消除肩部/胯部拼接线！）
    const legOffsetY = isSlender ? 26 : 22;
    const armOffsetY = isSlender ? 22 : 18;
    const legPts = generateLimbPoints('leg', isSlender, 0.92);
    const torsoPts = generateLimbPoints('torso', isSlender, 1.0);
    const armPts = generateLimbPoints('arm', isSlender, 0.94);

    const legs = [
      { key: 'leftLeg', pivot: j.leftLeg, ang: a.leftLeg || 0 },
      { key: 'rightLeg', pivot: j.rightLeg, ang: a.rightLeg || 0 }
    ];
    const arms = [
      { key: 'leftArm', pivot: j.leftArm, ang: a.leftArm ?? 0.56 },
      { key: 'rightArm', pivot: j.rightArm, ang: a.rightArm ?? -0.56 }
    ];

    // Pass 1：只画腿 + 躯干 + 手臂的联合外轮廓
    legs.forEach(lg => {
      c.save(); c.translate(lg.pivot.x + turnShift * 0.2, lg.pivot.y); c.rotate(lg.ang); c.translate(0, legOffsetY);
      fillPlushShape(c, legPts, body.skinColor, body.fabricType, 86, 'outline');
      c.restore();
    });
    c.save(); c.translate(turnShift * 0.25, torsoY);
    fillPlushShape(c, torsoPts, body.skinColor, body.fabricType, 88, 'outline');
    c.restore();
    arms.forEach(ar => {
      c.save(); c.translate(ar.pivot.x + turnShift * 0.3, ar.pivot.y); c.rotate(ar.ang); c.translate(0, armOffsetY);
      fillPlushShape(c, armPts, body.skinColor, body.fabricType, 84, 'outline');
      c.restore();
    });

    // Pass 2：裸娃无缝绒布填充（腿 + 鞋袜 → 躯干）
    legs.forEach(lg => {
      c.save(); c.translate(lg.pivot.x + turnShift * 0.2, lg.pivot.y); c.rotate(lg.ang); c.translate(0, legOffsetY);
      fillPlushShape(c, legPts, body.skinColor, body.fabricType, 86, 'fill');
      if (showCloth && state.outfit.shoes !== 'none') {
        drawShoesOnLeg(c, state.outfit.shoes, state.outfit, isSlender);
      } else {
        const fg = c.createRadialGradient(0, 26, 2, 0, 26, 15);
        fg.addColorStop(0, 'rgba(242, 166, 178, 0.42)');
        fg.addColorStop(1, 'rgba(242, 166, 178, 0)');
        c.fillStyle = fg; c.beginPath(); c.ellipse(0, 26, 15, 11, 0, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    });

    c.save(); c.translate(turnShift * 0.25, torsoY);
    fillPlushShape(c, torsoPts, body.skinColor, body.fabricType, 88, 'fill');
    const ng = c.createRadialGradient(0, -44, 4, 0, -38, 36);
    ng.addColorStop(0, 'rgba(168, 128, 114, 0.22)');
    ng.addColorStop(1, 'rgba(168, 128, 114, 0)');
    c.fillStyle = ng; c.beginPath(); c.ellipse(0, -38, 34, 13, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = hexAlpha(shadeHex(body.skinColor, -0.26), 0.34); c.lineWidth = 1.3; c.lineCap = 'round';
    c.beginPath(); c.arc(0, 12, 2.8, 0, Math.PI); c.stroke();
    c.restore();

    // 3.5) 两遍无缝一体化短裤/南瓜裤（裤腿与胯部无内线融合，完全包裹胯底，绝不露出裸肚）
    if (showCloth && state.outfit.dress === 'none' && (state.outfit.bottom === 'denim_shorts' || state.outfit.bottom === 'bloomers')) {
      legs.forEach(lg => {
        c.save(); c.translate(lg.pivot.x + turnShift * 0.2, lg.pivot.y); c.rotate(lg.ang); c.translate(0, legOffsetY);
        drawPantLegOnLeg(c, state.outfit, isSlender, 'outline');
        c.restore();
      });
      c.save(); c.translate(turnShift * 0.35, torsoY);
      drawShortsHipPelvis(c, state.outfit, isSlender, 'outline');
      c.restore();

      legs.forEach(lg => {
        c.save(); c.translate(lg.pivot.x + turnShift * 0.2, lg.pivot.y); c.rotate(lg.ang); c.translate(0, legOffsetY);
        drawPantLegOnLeg(c, state.outfit, isSlender, 'fill');
        c.restore();
      });
      c.save(); c.translate(turnShift * 0.35, torsoY);
      drawShortsHipPelvis(c, state.outfit, isSlender, 'fill');
      c.restore();
    }

    // 4) 手臂绒布填充 + 粉嫩手尖腮红 + 衣袖（衣袖先于衣身/背带绘制，让背带与领口自然压住肩线）
    arms.forEach(ar => {
      c.save(); c.translate(ar.pivot.x + turnShift * 0.3, ar.pivot.y); c.rotate(ar.ang); c.translate(0, armOffsetY);
      fillPlushShape(c, armPts, body.skinColor, body.fabricType, 84, 'fill');
      const hg = c.createRadialGradient(0, 24, 2, 0, 24, 13);
      hg.addColorStop(0, 'rgba(242, 162, 174, 0.45)');
      hg.addColorStop(1, 'rgba(242, 162, 174, 0)');
      c.fillStyle = hg; c.beginPath(); c.ellipse(0, 24, 12, 10, 0, 0, Math.PI * 2); c.fill();
      if (showCloth) drawSleeveOnArm(c, sleeveType, state.outfit, isSlender);
      c.restore();
    });

    // 5) 躯干服装（自然覆盖在肩袖与裤腰之上，裙摆随双腿骨骼动态变形）
    if (showCloth) drawOutfitTorso(c, torsoY, isSlender, state.outfit, turnShift * 0.35, { l: a.leftLeg || 0, r: a.rightLeg || 0 });

    // 6) 玩家手绘娃衣层
    if (showCloth && state.outfit.customStrokes && state.outfit.customStrokes.length) {
      c.save(); c.translate(turnShift * 0.35, 0);
      drawCustomStrokes(c, state.outfit.customStrokes);
      c.restore();
    }

    // 7) 绑骨头部组（小耳朵 + 流畅脸型 + 五官 + 前刘海，统一绕颈部歪头并带呼吸跟随）
    c.save();
    c.translate(0, neckY + (a.headY || 0));
    c.rotate(a.headTilt || 0);
    c.scale(HEAD_SCALE, HEAD_SCALE);
    c.translate(0, -neckY);

    if (body.ears === 'none') {
      // 柔和贴面人类小绒耳：实时吸附在当前实际脸廓边缘（无论脸宽或推捏怎么变都贴合！）
      [-1, 1].forEach(dir => {
        const anc = sampleHeadEdgeForEar(body, dir, Math.PI * 0.56, 0.86);
        c.save();
        c.translate(anc.x + dir * 2.5 + turnShift * 0.52, headY + anc.y);
        const epts = [];
        for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; epts.push({ x: Math.cos(a) * 11, y: Math.sin(a) * 14 }); }
        fillPlushShape(c, epts, body.skinColor, body.fabricType, 72);
        c.restore();
      });
    } else {
      drawSmoothEars(c, headY, body, turnShift * 0.28);
    }

    c.save();
    c.translate(turnShift * 0.55, headY);
    const headPts = generateSmoothHeadPoints(body, 0.86);
    fillPlushShape(c, headPts, body.skinColor, body.fabricType, 90);
    c.save();
    traceSmoothClosedCurve(c, headPts); c.clip();
    c.translate(turnShift * 0.45, 0);
    drawFaceAll(c, state.face, state.craft, 0.86, true, a.blink || 0);
    c.restore();
    c.restore();

    if (showHair) drawHairFront(c, headY, state.hair, turnShift * 0.72);
    c.restore(); // 结束头部歪头组

    // 8) 装饰与手绘首饰层
    if (showCloth && state.accessories.length) {
      state.accessories.forEach(acc => drawAccessoryItem(c, acc, turnShift * 0.65, !forceLiveAnim && acc.uid === state.selectedAccUid && state.step === 5, state.showcase && state.showcase.name));
    }
    if (showCloth && state.customAccStrokes && state.customAccStrokes.length) {
      c.save(); c.translate(turnShift * 0.65, 0);
      drawCustomStrokes(c, state.customAccStrokes);
      c.restore();
    }
    c.restore();
  }

  // Spine 级多通道骨骼连贯动画状态机（平滑 Cross-Fade + 呼吸挤压拉伸 + 滞后跟随 + 自然眨眼）
  function createAnimState() {
    return { rootX: 0, rootY: 0, bodyTilt: 0, squashX: 1, squashY: 1, headTilt: 0, headY: 0, hairSway: 0, leftArm: 0.56, rightArm: -0.56, leftLeg: 0.04, rightLeg: -0.04, blink: 0, nextBlinkAt: 2.2 };
  }

  function stepSpineRigAnimation(dollState, animState, tSec, clipOverride, extraForce) {
    const state = dollState || {};
    const pose = state.pose || {};
    const clip = clipOverride || pose.animClip || 'idle';
    const a = animState || createAnimState();

    // 1) 自然周期性眨眼（所有状态通用，每 2.8~4.6 秒轻眨一次）
    if (tSec >= a.nextBlinkAt) {
      const dt = tSec - a.nextBlinkAt;
      if (dt < 0.14) {
        a.blink = Math.sin((dt / 0.14) * Math.PI);
      } else {
        a.blink = 0;
        a.nextBlinkAt = tSec + 2.6 + Math.random() * 2.2;
      }
    }

    // 2) 计算当前动作剪辑的目标骨骼通道
    const tgt = {
      rootX: 0, rootY: 0, bodyTilt: 0, squashX: 1, squashY: 1,
      headTilt: pose.headTilt || 0, headY: 0, hairSway: 0,
      leftArm: pose.leftArm ?? 0.56, rightArm: pose.rightArm ?? -0.56,
      leftLeg: pose.leftLeg ?? 0.04, rightLeg: pose.rightLeg ?? -0.04
    };

    if (clip === 'idle') {
      const br = Math.sin(tSec * 2.2);
      tgt.rootY = br * 1.8;
      tgt.squashX = 1 + br * 0.014;
      tgt.squashY = 1 - br * 0.014;
      tgt.headTilt = Math.sin(tSec * 1.1) * 0.05;
      tgt.headY = Math.sin(tSec * 2.2 - 0.5) * 1.4;
      tgt.hairSway = Math.sin(tSec * 1.1 - 0.65) * 0.08;
      tgt.leftArm = 0.54 + Math.sin(tSec * 2.2 - 0.4) * 0.07;
      tgt.rightArm = -0.54 - Math.sin(tSec * 2.2 - 0.4) * 0.07;
      tgt.leftLeg = 0.04; tgt.rightLeg = -0.04;
    } else if (clip === 'wave') {
      const wv = Math.sin(tSec * 7.8);
      const bodyS = Math.sin(tSec * 3.9);
      tgt.rootY = Math.abs(bodyS) * -3.5;
      tgt.bodyTilt = -0.04 + bodyS * 0.03;
      tgt.headTilt = 0.13 + Math.sin(tSec * 3.9 - 0.45) * 0.06;
      tgt.hairSway = Math.sin(tSec * 3.9 - 0.8) * 0.12;
      tgt.leftArm = 0.48 + Math.sin(tSec * 3.9) * 0.09;
      tgt.rightArm = -2.28 + wv * 0.34; // 高举右手连贯招手！
      tgt.leftLeg = 0.06; tgt.rightLeg = -0.08;
    } else if (clip === 'walk') {
      const ph = tSec * 5.6;
      const stride = Math.sin(ph);
      const bounce = Math.abs(Math.sin(ph));
      tgt.rootY = -bounce * 9.5 + 3;
      tgt.rootX = Math.cos(ph) * 2.5;
      tgt.bodyTilt = stride * 0.075;
      tgt.squashX = 1 - bounce * 0.025;
      tgt.squashY = 1 + bounce * 0.025;
      tgt.headTilt = -stride * 0.06; // 头部相位滞后跟随
      tgt.headY = Math.sin(ph * 2 - 0.6) * 2.2;
      tgt.hairSway = Math.sin(ph - 0.85) * 0.16;
      tgt.leftLeg = stride * 0.48 + 0.05;
      tgt.rightLeg = -stride * 0.48 - 0.05;
      tgt.leftArm = 0.52 - stride * 0.46; // 经典对侧摆臂
      tgt.rightArm = -0.52 - stride * 0.46;
    } else if (clip === 'sit') {
      const kick = Math.sin(tSec * 4.4);
      tgt.rootY = 16 + Math.sin(tSec * 2.2) * 1.5;
      tgt.squashX = 1.03; tgt.squashY = 0.97;
      tgt.headTilt = Math.sin(tSec * 1.8) * 0.09;
      tgt.hairSway = Math.sin(tSec * 1.8 - 0.6) * 0.10;
      tgt.leftArm = 0.72 + Math.sin(tSec * 2.2) * 0.08;
      tgt.rightArm = -0.72 - Math.sin(tSec * 2.2) * 0.08;
      tgt.leftLeg = 0.56 + kick * 0.18;   // 坐姿交替晃小脚丫
      tgt.rightLeg = -0.56 + kick * 0.18;
    } else if (clip === 'happy') {
      const cyc = (tSec * 2.1) % 1; // 0..1 单次弹跳周期
      let jumpY = 0, sqY = 1;
      if (cyc < 0.22) {
        // 蓄力下蹲
        const k = Math.sin((cyc / 0.22) * Math.PI);
        jumpY = k * 7; sqY = 1 - k * 0.09;
      } else if (cyc < 0.78) {
        // 腾空抛物线
        const k = Math.sin(((cyc - 0.22) / 0.56) * Math.PI);
        jumpY = -k * 26; sqY = 1 + k * 0.06;
      } else {
        // 落地回弹
        const k = Math.sin(((cyc - 0.78) / 0.22) * Math.PI);
        jumpY = k * 5; sqY = 1 - k * 0.07;
      }
      tgt.rootY = jumpY;
      tgt.squashY = sqY; tgt.squashX = 2 - sqY;
      tgt.headTilt = Math.sin(tSec * 4.2) * 0.1;
      tgt.hairSway = Math.sin(tSec * 4.2 - 0.7) * 0.18;
      const airLift = clamp(-jumpY / 26, 0, 1);
      tgt.leftArm = 1.65 + airLift * 0.65;
      tgt.rightArm = -1.65 - airLift * 0.65;
      tgt.leftLeg = 0.1 + airLift * 0.34;
      tgt.rightLeg = -0.1 - airLift * 0.34;
    } else if (clip === 'lift') {
      const sway = Math.sin(tSec * 6.2) * 0.14 + clamp((extraForce && extraForce.vx || 0) * 0.015, -0.28, 0.28);
      tgt.rootY = -6;
      tgt.squashX = 0.96; tgt.squashY = 1.05;
      tgt.bodyTilt = sway * 0.6;
      tgt.headTilt = -sway * 0.45;
      tgt.hairSway = sway * 1.1;
      tgt.leftArm = 1.45 + Math.sin(tSec * 7) * 0.18;
      tgt.rightArm = -1.45 - Math.sin(tSec * 7) * 0.18;
      tgt.leftLeg = 0.22 + Math.sin(tSec * 8.5) * 0.24;
      tgt.rightLeg = -0.22 + Math.sin(tSec * 8.5 + 1.1) * 0.24;
    } else if (clip === 'shy') {
      const sw = Math.sin(tSec * 2.8);
      tgt.bodyTilt = sw * 0.08;
      tgt.rootY = Math.abs(sw) * 2.2;
      tgt.headTilt = -0.14 + sw * 0.09;
      tgt.hairSway = Math.sin(tSec * 2.8 - 0.7) * 0.12;
      tgt.leftArm = -0.14 + sw * 0.12;
      tgt.rightArm = 0.14 + sw * 0.12;
      tgt.leftLeg = -0.10 + sw * 0.06;
      tgt.rightLeg = 0.10 + sw * 0.06;
    }

    // 3) Spine Mix Cross-Fade 平滑融合各通道
    const mix = clip === 'static' ? 0.28 : 0.16;
    ['rootX', 'rootY', 'bodyTilt', 'squashX', 'squashY', 'headTilt', 'headY', 'hairSway', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'].forEach(k => {
      a[k] = lerp(a[k], tgt[k], mix);
    });
  }

  global.CottonDollRenderer = {
    version: '1.0.0',
    HEAD_SCALE,
    clamp, lerp, dist, hexToRgb, rgbToHex, shadeHex, hexAlpha,
    SKIN_SWATCHES, EYE_SWATCHES, HAIR_SWATCHES, CLOTH_SWATCHES,
    FACE_PRESETS, EAR_TYPES, FABRIC_TYPES, BROW_STYLES, EYE_STYLES, LASH_STYLES, HIGHLIGHT_STYLES,
    NOSE_STYLES, MOUTH_STYLES, BLUSH_STYLES, HAIR_BACK_STYLES, HAIR_BANG_STYLES, HAIR_SIDE_STYLES,
    POSE_PRESETS, ANIM_CLIPS, AHOGE_STYLES, OUTFIT_DRESSES, OUTFIT_TOPS, OUTFIT_BOTTOMS, OUTFIT_SHOES,
    OUTFIT_PATTERNS, ACCESSORIES_CATALOG, BACKGROUNDS,
    createDefaultState,
    createAnimState,
    traceSmoothClosedCurve,
    ensureSculptOffsets,
    generateSmoothHeadPoints,
    generateLimbPoints,
    fillPlushShape,
    drawFaceAll,
    drawCustomStrokes,
    drawStarPath,
    drawTinyHeart,
    fillOutfitPattern,
    getActiveSleeveType,
    sampleHeadEdgeForEar,
    drawSmoothEars,
    makeHairGrad,
    drawHairBack,
    drawHairFront,
    drawOutfitTorso,
    drawSleeveOnArm,
    drawPantLegOnLeg,
    drawShortsHipPelvis,
    drawShoesOnLeg,
    drawAccessoryItem,
    getSkeletonJoints,
    drawFullDoll,
    stepSpineRigAnimation
  };
})(typeof window !== 'undefined' ? window : globalThis);
