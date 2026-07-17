importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

const firebaseConfig = {
    apiKey: "AIzaSyDChsbgzCprt-_VZnx_-XzdpNjlSlE0Z8g",
    projectId: "calendar-notifications-4c44b",
    storageBucket: "calendar-notifications-4c44b.firebasestorage.app",
    messagingSenderId: "142991941579",
    appId: "1:142991941579:web:a8ec1a4d6896a70ea5604e"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification?.title || "Nová notifikace";
    const notificationOptions = {
        body: payload.notification?.body,
        icon: "/favicon.ico",
        data: payload.data || {}
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const eventId = event.notification?.data?.eventId;
    const url = eventId ? `/events/${eventId}` : '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});
