// Intercept auth-success page before it fully loads
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url || tab.url;
  if (url?.includes('auth-success') && url?.includes('token=')) {
    const tokenMatch = url.match(/token=([^&]+)/);
    const userIdMatch = url.match(/userId=([^&]+)/);
    const nameMatch = url.match(/name=([^&]+)/);
    const profileUrlMatch = url.match(/profileUrl=([^&]+)/);
    const stravaIdMatch = url.match(/stravaId=([^&]+)/);

    if (tokenMatch) {
      const jwt = decodeURIComponent(tokenMatch[1]);
      const userId = userIdMatch ? decodeURIComponent(userIdMatch[1]) : '';
      const name = nameMatch ? decodeURIComponent(nameMatch[1]) : '';
      const profileUrl = profileUrlMatch ? decodeURIComponent(profileUrlMatch[1]) : '';
      const stravaId = stravaIdMatch ? decodeURIComponent(stravaIdMatch[1]) : '';

      const storageData: Record<string, string> = {
        strava_challenge_jwt: jwt,
      };

      if (userId) {
        const userData = JSON.stringify({
          id: userId,
          name,
          profile_pic_url: profileUrl,
          strava_id: parseInt(stravaId, 10) || 0,
        });
        storageData.strava_challenge_user = userData;
      }

      chrome.storage.local.set(storageData, () => {
        chrome.tabs.remove(tabId);

        // Open popup automatically
        chrome.action.openPopup().catch(() => {
          // If openPopup fails (e.g., no focus), create a notification instead
          chrome.notifications.create('auth-success', {
            type: 'basic',
            iconUrl: 'icons/icon-128.svg',
            title: 'Strava Challenge',
            message: 'Authentication successful! Click to open the extension.',
            buttons: [{ title: 'Open' }],
          });
        });
      });
    }
  }
});

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId === 'auth-success') {
    chrome.action.openPopup();
    chrome.notifications.clear(notificationId);
  }
});

console.log('Strava Challenge background service worker loaded');
