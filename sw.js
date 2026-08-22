// 鸢小手机 Service Worker
const CACHE_NAME = 'yuan-phone-pwa-v1787357551692';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './Milvus/style.css',
  './Milvus/app.min.js',
  './Milvus/db.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg',
  './icons/apple-touch-icon.png'
];

// 安装阶段：预缓存核心静态文件
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline assets');
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[Service Worker] Pre-cache warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 激活阶段：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 拦截请求：Network-First 策略（优先获取最新网络资源，断网时降级到缓存）
self.addEventListener('fetch', (event) => {
  // 只处理 GET 请求，跳过跨域 API 请求如 AI 模型 / Pixabay
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // 对于外链 API 请求（LLM、CDN等），直接走网络
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 如果网络请求成功，克隆一份写入缓存
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // 网络请求失败（离线时），从缓存获取
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // 兜底返回主页
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
