importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Config is injected at build time by vite.config.ts — do not edit %%placeholders%% manually.
// In dev mode the placeholders remain, Firebase is skipped gracefully.
var _FCM = {
  apiKey:            '%%VITE_FIREBASE_API_KEY%%',
  authDomain:        '%%VITE_FIREBASE_AUTH_DOMAIN%%',
  projectId:         '%%VITE_FIREBASE_PROJECT_ID%%',
  storageBucket:     '%%VITE_FIREBASE_STORAGE_BUCKET%%',
  messagingSenderId: '%%VITE_FIREBASE_MESSAGING_SENDER_ID%%',
  appId:             '%%VITE_FIREBASE_APP_ID%%',
};

if (_FCM.apiKey && _FCM.apiKey.indexOf('%%') === -1) {
  firebase.initializeApp(_FCM);
  var _msg = firebase.messaging();

  _msg.onBackgroundMessage(function (payload) {
    var n = payload.notification || {};
    var d = payload.data        || {};
    self.registration.showNotification(n.title || 'Slovak Life', {
      body:    n.body  || '',
      icon:    n.icon  || '/favicon.svg',
      tag:     d.tag   || 'slovaklife',
      data:    d,
    });
  });
}
