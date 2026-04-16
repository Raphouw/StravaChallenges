// Intercept auth-success page before it fully loads
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url || tab.url;
  if (url?.includes('auth-success') && url?.includes('token=')) {
    const tokenMatch = url.match(/token=([^&]+)/);
    const userIdMatch = url.match(/userId=([^&]+)/);

    if (tokenMatch) {
      const jwt = decodeURIComponent(tokenMatch[1]);
      const userId = userIdMatch ? decodeURIComponent(userIdMatch[1]) : '';

      const storageData: Record<string, string> = {
        strava_challenge_jwt: jwt,
      };

      if (userId) {
        const userData = JSON.stringify({ id: userId });
        storageData.strava_challenge_user = userData;
      }

      chrome.storage.local.set(storageData, () => {
        chrome.tabs.remove(tabId);
      });
    }
  }
});

console.log('Strava Challenge background service worker loaded');
