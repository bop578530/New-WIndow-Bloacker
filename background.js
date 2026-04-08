// background.js - service worker

// Catch ALL new tabs/windows opened from any source (ads, iframes, JS timers, etc.)
chrome.tabs.onCreated.addListener(async (tab) => {
  const result = await chrome.storage.sync.get(['enabled', 'blockedTotal', 'blockedSession']);
  const isEnabled = result.enabled !== false;
  if (!isEnabled) return;

  // Any tab that has an opener = was opened programmatically (not user typing URL)
  if (tab.openerTabId !== undefined) {
    // Wait briefly for URL to populate if still loading
    const waitForUrl = () => new Promise((resolve) => {
      if (tab.url && tab.url !== '' && tab.url !== 'about:blank' && tab.url !== 'about:newtab') {
        return resolve(tab.url);
      }
      // Poll for URL
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const t = await chrome.tabs.get(tab.id);
          if ((t.url && t.url !== '' && t.url !== 'about:blank') || attempts > 10) {
            clearInterval(poll);
            resolve(t.url || '');
          }
        } catch {
          clearInterval(poll);
          resolve('');
        }
      }, 50);
    });

    const url = await waitForUrl();

    try {
      await chrome.tabs.remove(tab.id);
      // Update blocked counters
      chrome.storage.sync.set({
        blockedTotal: (result.blockedTotal || 0) + 1,
        blockedSession: (result.blockedSession || 0) + 1,
      });
      // Redirect opener to the URL if it was a real destination
      if (url && url !== '' && url !== 'about:blank' && url !== 'about:newtab') {
        await chrome.tabs.update(tab.openerTabId, { url });
      }
    } catch (e) {
      // Tab may have already been removed or navigated
    }
  }
});
