// Content script: aggressively blocks ALL new windows/popups

(function () {
  let isEnabled = true;

  chrome.storage.sync.get(['enabled'], (result) => {
    isEnabled = result.enabled !== false;
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'setState') isEnabled = msg.enabled;
  });

  function incrementCount() {
    chrome.storage.sync.get(['blockedTotal', 'blockedSession'], (r) => {
      chrome.storage.sync.set({
        blockedTotal: (r.blockedTotal || 0) + 1,
        blockedSession: (r.blockedSession || 0) + 1,
      });
    });
  }

  // ── 1. Override window.open (catches JS-triggered popups, ad scripts, timers) ──
  const _open = window.open.bind(window);
  Object.defineProperty(window, 'open', {
    get() {
      return function (...args) {
        if (!isEnabled) return _open(...args);
        incrementCount();
        const url = args[0];
        if (url && url !== '' && url !== 'about:blank') {
          window.location.href = url;
        }
        return null;
      };
    },
    configurable: false,
  });

  // ── 2. Block setTimeout/setInterval from sneaking in delayed window.open calls ──
  // Wrap them so inline string-based evals that call window.open are also caught
  const _setTimeout = window.setTimeout;
  const _setInterval = window.setInterval;

  window.setTimeout = function (fn, delay, ...args) {
    if (typeof fn === 'string' && fn.includes('window.open')) {
      if (isEnabled) { incrementCount(); return; }
    }
    return _setTimeout(fn, delay, ...args);
  };

  window.setInterval = function (fn, delay, ...args) {
    if (typeof fn === 'string' && fn.includes('window.open')) {
      if (isEnabled) { incrementCount(); return; }
    }
    return _setInterval(fn, delay, ...args);
  };

  // ── 3. Block form submissions that target a new window ──
  document.addEventListener('submit', (e) => {
    if (!isEnabled) return;
    const form = e.target;
    const t = form.getAttribute('target');
    if (t && t !== '_self' && t !== '_top' && t !== '_parent') {
      form.setAttribute('target', '_self');
    }
  }, true);

  // ── 4. Intercept all clicks on links with target="_blank" or similar ──
  document.addEventListener('click', (e) => {
    if (!isEnabled) return;
    const link = e.target.closest('a');
    if (!link) return;
    const target = link.getAttribute('target');
    if (target && target !== '_self' && target !== '_top' && target !== '_parent') {
      e.preventDefault();
      e.stopImmediatePropagation();
      const href = link.href;
      if (href && href !== '#' && !href.startsWith('javascript:')) {
        incrementCount();
        window.location.href = href;
      }
    }
  }, true);

  // ── 5. Sanitize existing + dynamically added links/forms ──
  function sanitize(root) {
    root.querySelectorAll('a[target], form[target]').forEach((el) => {
      const t = el.getAttribute('target');
      if (t && t !== '_self' && t !== '_top' && t !== '_parent') {
        el.setAttribute('target', '_self');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { if (isEnabled) sanitize(document); });
  } else {
    sanitize(document);
  }

  const observer = new MutationObserver((mutations) => {
    if (!isEnabled) return;
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        const tag = node.tagName;
        if (tag === 'A' || tag === 'FORM') {
          const t = node.getAttribute('target');
          if (t && t !== '_self' && t !== '_top' && t !== '_parent') {
            node.setAttribute('target', '_self');
          }
        }
        if (node.querySelectorAll) sanitize(node);
      });
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
