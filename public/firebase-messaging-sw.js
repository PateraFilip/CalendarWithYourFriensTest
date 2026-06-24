importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// Konfigurace stejná jako v push-notifications.web.ts
const firebaseConfig = {
    apiKey: "AIzaSyDChsbgzCprt-_VZnx_-XzdpNjlSlE0Z8g",
    projectId: "calendar-notifications-4c44b",
    storageBucket: "calendar-notifications-4c44b.firebasestorage.app",
    messagingSenderId: "142991941579",
    appId: "1:142991941579:web:a8ec1a4d6896a70ea5604e" // TODO: nahradit skutečným web app ID
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Zpracování notifikace, když je aplikace na pozadí
messaging.onBackgroundMessage((payload) => {
    console.log("[firebase-messaging-sw.js] Přijata notifikace na pozadí ", payload);
    const notificationTitle = payload.notification?.title || "Nová notifikace";
    const notificationOptions = {
        body: payload.notification?.body,
        icon: "/favicon.ico"
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
