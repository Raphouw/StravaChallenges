import * as storage from './utils/storage.js';

// Listen for updates from auth-success page
chrome.runtime.onMessage.addListener(
  (
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ) => {
    if (message.action === 'AUTH_SUCCESS') {
      // Store JWT and user in chrome.storage.local
      Promise.all([
        storage.setAuthToken(message.jwt),
        storage.setUser(message.user),
      ]).then(() => {
        // Broadcast to all popup windows
        chrome.runtime.sendMessage({
          action: 'AUTH_SUCCESS',
          jwt: message.jwt,
          user: message.user,
        }).catch(() => {
          // Popup might not be open, that's fine
        });

        // Close the auth tab
        if (sender.tab?.id) {
          chrome.tabs.remove(sender.tab.id).catch(() => {
            // Tab might already be closed
          });
        }

        sendResponse({ success: true });
      }).catch((error) => {
        sendResponse({ success: false, error: error.message });
      });

      // Return true to indicate we'll send response asynchronously
      return true;
    }
  }
);

console.log('Strava Challenge background service worker loaded');
