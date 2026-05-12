/**
 * Monitor Platform - 前端数据采集脚本
 * 
 * 使用方法：
 * 1. 在页面中引入此脚本
 * 2. 调用 Monitor.init() 初始化
 * 
 * 示例：
 * <script src="https://your-monitor-platform.com/monitor.js"></script>
 * <script>
 *   Monitor.init({
 *     projectId: 'your-project-id',
 *     apiKey: 'your-api-key',
 *     endpoint: 'https://your-monitor-platform.com/api/events'
 *   });
 * </script>
 */
(function() {
  'use strict';

  // 配置
  const config = {
    projectId: null,
    apiKey: null,
    endpoint: 'https://monitor-git-dev-calm-66s-projects.vercel.app/api/events',
    batchSize: 10,      // 批量大小
    flushInterval: 60000, // 1 分钟刷新
    maxRetries: 3       // 最大重试次数
  };

  // 事件队列
  let eventQueue = [];
  let flushTimer = null;
  let isFlushing = false;
  let authenticatedUserId = null;

  /**
   * 初始化监控
   */
  function init(options) {
    if (!options || !options.projectId || !options.apiKey) {
      console.error('[Monitor] projectId and apiKey are required');
      return;
    }

    config.projectId = options.projectId;
    config.apiKey = options.apiKey;
    config.endpoint = options.endpoint || config.endpoint;
    config.batchSize = options.batchSize || config.batchSize;
    config.flushInterval = options.flushInterval || config.flushInterval;

    // 自动追踪页面浏览
    trackPageview();

    // 启动定时刷新
    flushTimer = setInterval(flushEvents, config.flushInterval);

    // 页面卸载时刷新
    window.addEventListener('beforeunload', flushEvents);
    window.addEventListener('pagehide', flushEvents);

    // 页面可见性变化时刷新
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') {
        flushEvents();
      }
    });

    console.log('[Monitor] Initialized', { 
      projectId: config.projectId, 
      endpoint: config.endpoint 
    });
  }

  /**
   * 追踪页面浏览
   */
  function trackPageview(customData) {
    // 分离 metadata 字段和其他字段
    var metadata = customData || {};
    
    const payload = {
      eventType: 'pageview',
      pageUrl: window.location.href,
      pageTitle: document.title,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      userId: getCurrentUserId(metadata),
      // 使用浏览器当地时间（ISO 格式，包含时区信息）
      createdAt: new Date().toISOString(),
      metadata: metadata
    };

    queueEvent(payload);
  }

  /**
   * 追踪自定义事件
   */
  function trackEvent(eventName, eventData) {
    var metadata = eventData || {};

    const payload = {
      eventType: 'custom',
      eventName: eventName,
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      userId: getCurrentUserId(metadata),
      // 使用浏览器当地时间（ISO 格式，包含时区信息）
      createdAt: new Date().toISOString(),
      metadata: metadata
    };

    queueEvent(payload);
  }

  /**
   * 追踪点击事件
   */
  function trackClick(selector, eventName) {
    document.addEventListener('click', function(e) {
      const target = e.target.closest(selector);
      if (target) {
        trackEvent(eventName || 'click', {
          element: selector,
          text: target.textContent?.slice(0, 100),
          x: e.clientX,
          y: e.clientY
        });
      }
    });
  }

  /**
   * 从 ISO 字符串解析日期（保持时区信息）
   */
  function parseDate(isoString) {
    return new Date(isoString);
  }

  /**
   * 队列事件
   */
  function queueEvent(payload) {
    eventQueue.push(payload);

    // 达到批量大小时立即刷新
    if (eventQueue.length >= config.batchSize) {
      flushEvents();
    }
  }

  /**
   * 刷新事件队列
   */
  function flushEvents() {
    if (isFlushing || eventQueue.length === 0) {
      return;
    }

    isFlushing = true;
    const eventsToSend = [...eventQueue];
    eventQueue = [];

    sendEvents(eventsToSend, 0)
      .finally(function() {
        isFlushing = false;
      });
  }

  /**
   * 发送事件（带重试机制）
   */
  function sendEvents(events, retryCount) {
    return fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
        'X-Project-ID': config.projectId
      },
      body: JSON.stringify(events)
    })
    .then(function(response) {
      if (!response.ok) {
        throw new Error('Network response was not ok: ' + response.status);
      }
      return response.json();
    })
    .then(function(data) {
      console.log('[Monitor] Events sent successfully:', data);
    })
    .catch(function(error) {
      console.error('[Monitor] Send error:', error);

      // 重试机制（指数退避）
      if (retryCount < config.maxRetries) {
        const delay = 1000 * Math.pow(2, retryCount); // 1s, 2s, 4s
        console.log('[Monitor] Retrying in ' + delay + 'ms...');
        setTimeout(function() {
          sendEvents(events, retryCount + 1);
        }, delay);
      } else {
        console.error('[Monitor] Max retries reached, events lost');
        // 重试失败后将事件重新加入队列
        eventQueue = [...events, ...eventQueue];
      }
    });
  }

  /**
   * 获取或创建用户 ID
   */
  function getOrCreateUserId() {
    var storage;
    try {
      storage = window.localStorage;
    } catch (e) {
      storage = null;
    }

    if (storage) {
      var userId = storage.getItem('monitor_user_id');
      if (!userId) {
        userId = 'user_' + Math.random().toString(36).substring(2, 15);
        storage.setItem('monitor_user_id', userId);
      }
      return userId;
    } else {
      // 如果 localStorage 不可用，使用内存存储
      if (!window._monitorUserId) {
        window._monitorUserId = 'user_' + Math.random().toString(36).substring(2, 15);
      }
      return window._monitorUserId;
    }
  }

  function normalizeAuthenticatedUserId(usOnlyUserId) {
    if (!usOnlyUserId) return null;
    var normalized = String(usOnlyUserId).trim();
    if (!normalized) return null;
    return normalized.indexOf('user_') === 0 ? normalized : 'user_' + normalized;
  }

  function getStorage() {
    try {
      return window.localStorage;
    } catch (e) {
      return null;
    }
  }

  function identify(usOnlyUserId) {
    var normalized = normalizeAuthenticatedUserId(usOnlyUserId);
    if (!normalized) return;

    authenticatedUserId = normalized;

    var storage = getStorage();
    if (storage) {
      storage.setItem('monitor_authenticated_user_id', normalized);
    }
  }

  function clearUser() {
    authenticatedUserId = null;

    var storage = getStorage();
    if (storage) {
      storage.removeItem('monitor_authenticated_user_id');
    }
  }

  function getAuthenticatedUserId() {
    if (authenticatedUserId) return authenticatedUserId;

    var storage = getStorage();
    if (!storage) return null;

    var storedUserId = storage.getItem('monitor_authenticated_user_id');
    authenticatedUserId = normalizeAuthenticatedUserId(storedUserId);
    return authenticatedUserId;
  }

  function getCurrentUserId(metadata) {
    if (metadata && metadata.usOnlyUserId) {
      identify(metadata.usOnlyUserId);
    }

    return getAuthenticatedUserId() || getOrCreateUserId();
  }

  /**
   * 手动刷新
   */
  function flush() {
    flushEvents();
  }

  /**
   * 销毁监控
   */
  function destroy() {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
    window.removeEventListener('beforeunload', flushEvents);
    window.removeEventListener('pagehide', flushEvents);
    eventQueue = [];
    console.log('[Monitor] Destroyed');
  }

  // 导出全局对象
  window.Monitor = {
    init: init,
    trackPageview: trackPageview,
    trackEvent: trackEvent,
    trackClick: trackClick,
    identify: identify,
    clearUser: clearUser,
    flush: flush,
    destroy: destroy
  };

  // 自动初始化（如果配置了 data 属性）
  var script = document.currentScript || document.querySelector('script[src*="monitor.js"]');
  if (script) {
    var projectId = script.getAttribute('data-project-id');
    var apiKey = script.getAttribute('data-api-key');
    var endpoint = script.getAttribute('data-endpoint');

    if (projectId && apiKey) {
      init({
        projectId: projectId,
        apiKey: apiKey,
        endpoint: endpoint || undefined
      });
    }
  }
})();
