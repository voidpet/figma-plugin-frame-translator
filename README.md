# Multilingual Frame Exporter (Figma Plugin)

This plugin translates text layers inside selected Figma frames into one or more target languages using your OpenAI API key, then exports PNG files into a single ZIP download.

## What it does

- Uses selected `FRAME` nodes on the current page.
- Clones each frame (original frame is not modified).
- Translates all text nodes in each clone for each selected language.
- Exports each translated clone as PNG and downloads one ZIP file.
- Uses script-aware fallback fonts when possible, while preserving existing text styles.

## Files

- `manifest.json`
- `code.js`
- `ui.html`

## Install in Figma (development)

1. Open Figma Desktop.
2. Go to **Plugins** -> **Development** -> **Import plugin from manifest...**
3. Select this folder's `manifest.json`.

## Usage

1. Select one or more frame layers in your file.
2. Run the plugin from **Plugins** -> **Development** -> **Multilingual Frame Exporter**.
3. Enter your OpenAI API key.
4. Optionally change export scale.
5. Select target languages (use Select all / Deselect all for faster selection).
6. Click **Translate & Export**.

## Notes

- Figma must be able to access `https://api.openai.com`.
- If a text layer uses missing fonts, install fonts first.
- For non-Latin scripts, install compatible fonts (for example Noto family) if you see fallback warnings.
- The plugin saves your last OpenAI API key and language selections locally in the plugin UI.
- API usage cost depends on your OpenAI account and model.
