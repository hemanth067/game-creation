# Battle Royale 3D — Android / Google Play build

This project now contains a native Android WebView shell targeting Android 16 / API 36 and a GitHub Actions workflow that builds a release AAB.

## Important before publishing
1. Replace `REMOTE_SERVER_URL` in `android/app/src/main/java/com/hemanth/battleroyale3d/MainActivity.java` with the HTTPS URL of the deployed Node.js game server.
2. Configure Google and Facebook OAuth on that server (`GOOGLE_CLIENT_ID`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`).
3. Configure Google/Facebook OAuth authorized origins/redirect settings for the real HTTPS game domain.
4. Generate and protect your Play upload keystore, or use Play App Signing as appropriate.
5. Build `:android:app:bundleRelease` and upload the signed AAB to Play Console.

Google Play requires new apps and updates submitted from August 31, 2026 to target Android 16 (API 36) or higher. New apps use Android App Bundles on Google Play.
