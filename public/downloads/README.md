# Android APK — neukládej do gitu

Soubor `CalendarWithFriends.apk` je ~114 MB. GitHub má limit **100 MB** na soubor v gitu, proto APK **nesmí** být ve větvi `main`.

## Jak publikovat APK

1. V GitHubu: **Releases → Create a new release**
2. Tag např. `v1.0.0`
3. Nahraj `CalendarWithFriends.apk` jako asset
4. Zkopíruj URL assetu (vypadá takto):

   `https://github.com/PateraFilip/CalendarWithYourFriensTest/releases/download/v1.0.0/CalendarWithFriends.apk`

5. Tu URL dej do `public/version.json` → pole `apkUrl` (a případně aktualizuj `DEFAULT_APK_URL` v `lib/appVersion.ts`)

Lokální APK můžeš nechat v `public/downloads/` — díky `.gitignore` se necommituje.
