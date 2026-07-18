const { withAndroidManifest } = require("@expo/config-plugins");

const CHANNEL_ID =
  "com.google.firebase.messaging.default_notification_channel_id";
const NOTIFICATION_COLOR =
  "com.google.firebase.messaging.default_notification_color";
const NOTIFICATION_ICON =
  "com.google.firebase.messaging.default_notification_icon";

/**
 * Resolves Android manifest merger conflicts between expo-notifications
 * and @react-native-firebase/messaging for FCM default notification meta-data.
 */
function withFirebaseMessagingManifestFix(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application?.[0];
    if (!application) {
      return config;
    }

    manifest.$ = {
      ...manifest.$,
      "xmlns:tools": "http://schemas.android.com/tools",
    };

    const metaData = application["meta-data"] ?? [];
    application["meta-data"] = metaData;

    const ensureMeta = (name, attrs) => {
      let entry = metaData.find((item) => item.$?.["android:name"] === name);
      if (!entry) {
        entry = { $: { "android:name": name, ...attrs } };
        metaData.push(entry);
        return;
      }
      Object.assign(entry.$, attrs);
    };

    ensureMeta(CHANNEL_ID, {
      "android:value": "default",
      "tools:replace": "android:value",
    });

    ensureMeta(NOTIFICATION_COLOR, {
      "android:resource": "@color/notification_icon_color",
      "tools:replace": "android:resource",
    });

    const iconEntry = metaData.find(
      (item) => item.$?.["android:name"] === NOTIFICATION_ICON
    );
    if (iconEntry) {
      iconEntry.$["tools:replace"] = "android:resource";
    }

    return config;
  });
}

module.exports = withFirebaseMessagingManifestFix;
