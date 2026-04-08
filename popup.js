const toggle = document.getElementById('toggle');
const dot = document.getElementById('dot');
const statusText = document.getElementById('statusText');
const blockedCount = document.getElementById('blockedCount');
const sessionCount = document.getElementById('sessionCount');
const resetBtn = document.getElementById('resetBtn');

function updateUI(enabled) {
  dot.className = 'dot' + (enabled ? '' : ' off');
  statusText.className = 'status-text' + (enabled ? '' : ' off');
  statusText.textContent = enabled ? 'ACTIVE — blocking new windows' : 'PAUSED — new windows allowed';
}

// Load saved state
chrome.storage.sync.get(['enabled', 'blockedTotal', 'blockedSession'], (result) => {
  const enabled = result.enabled !== false;
  toggle.checked = enabled;
  updateUI(enabled);
  blockedCount.textContent = result.blockedTotal || 0;
  sessionCount.textContent = result.blockedSession || 0;
});

// Toggle handler
toggle.addEventListener('change', () => {
  const enabled = toggle.checked;
  chrome.storage.sync.set({ enabled });
  updateUI(enabled);

  // Notify all tabs
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, { type: 'setState', enabled }).catch(() => {});
    });
  });
});

// Reset counters
resetBtn.addEventListener('click', () => {
  chrome.storage.sync.set({ blockedTotal: 0, blockedSession: 0 });
  blockedCount.textContent = '0';
  sessionCount.textContent = '0';
});
