# MiiOS iOS (GitHub Pages)

This is the GitHub Pages-ready web version of MiiOS. It keeps the original MiiOS HOME layout and adds iPhone/PWA metadata, a web app manifest, safe-area styling, and a small offline cache.

## Publish with GitHub Pages
1. Create a GitHub repository named `miios-ios`.
2. Extract this ZIP on your computer.
3. Upload **the contents of this folder** to the repository's root (so `index.html` is at the top level, not inside another folder).
4. In the repository, open **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
6. Wait for GitHub Pages to publish. The URL will look like `https://YOUR-USERNAME.github.io/miios-ios/`.
7. Open that URL in Safari on your iPhone, tap Share, then **Add to Home Screen**.

## Notes
- Camera access requires HTTPS; GitHub Pages provides HTTPS. Allow Safari camera permission when prompted.
- Music imported into the player is selected locally in the browser. It is not uploaded to GitHub.
- Photos and settings are stored in the browser on that device. They do not automatically sync between devices.
- iOS may limit background audio and offline behavior according to Safari's own rules.
- Mii Plaza and Games are still placeholders in this base version.
