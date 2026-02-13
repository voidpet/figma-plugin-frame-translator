# Translate Frame Exporter (Figma Plugin)

This plugin translates text layers inside selected Figma frames into one or more target languages using your OpenAI API key, then exports PNG files in a single ZIP download.

## Requirements

- Figma Desktop app
- OpenAI API key
- Internet access from Figma to `https://api.openai.com`
- Required fonts installed locally (especially for non-Latin languages)

## Get the Code

Clone this repository locally.

```bash
git clone <your-repo-url>
```

## Install in Figma Desktop (Development)

1. Open Figma Desktop.
2. Open any design file (Drafts is fine).
3. Go to **Plugins** -> **Development** -> **Import plugin from manifest...**
4. Select this project's `manifest.json`.
5. Confirm the plugin appears under **Plugins** -> **Development** as **Translate Frame Exporter**.

## How to Use the Plugin in Figma Desktop

1. In your Figma file, select one or more layers of type `FRAME`.
2. Launch the plugin from **Plugins** -> **Development** -> **Translate Frame Exporter**.
3. Enter your OpenAI API key.
4. Set PNG export scale (default `1`, range `1` to `4`).
5. Choose one or more target languages.
6. Click **Translate & Export**.
7. Wait for processing to complete. The plugin will generate and download one ZIP file containing translated PNGs.

## What the Plugin Does During Export

- Clones each selected frame (original frames are not modified).
- Translates all text nodes in each clone per selected language.
- Applies script-aware fallback fonts when available.
- Exports each translated clone as PNG.
- Bundles outputs into a single ZIP file.

## Notes

- If no frames are selected, export will fail with an error.
- If a text node has missing fonts, install those fonts and rerun export.
- For scripts like Japanese, Korean, Thai, or Arabic, install compatible fonts (for example Noto families) to avoid fallback warnings.
- The plugin stores your API key and selected languages locally using Figma client storage for convenience.
- API usage cost depends on your OpenAI account and selected model.
