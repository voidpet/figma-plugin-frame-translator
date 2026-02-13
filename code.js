figma.showUI(__html__, { width: 420, height: 560 });
const OPENAI_MODEL = "gpt-4.1-mini";
const SETTINGS_KEY = "frame-translator-exporter-settings-v1";
const BUNGEE_STYLE_PREFERENCES = [
  "Black",
  "ExtraBold",
  "Bold",
  "SemiBold",
  "DemiBold",
  "Medium",
  "Regular",
];
const LANGUAGE_BUNGEE_FALLBACKS = {
  Japanese: [
    "M PLUS Rounded 1c",
    "Noto Sans JP",
    "Hiragino Kaku Gothic ProN",
    "Yu Gothic",
    "Meiryo",
  ],
  Korean: ["Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic"],
  German: ["Bungee", "Anton", "Archivo Black", "Arial Black", "Impact"],
  French: ["Bungee", "Anton", "Archivo Black", "Arial Black", "Impact"],
  "Spanish (Latin America)": [
    "Bungee",
    "Anton",
    "Archivo Black",
    "Arial Black",
    "Impact",
  ],
  "Portuguese (Brazil)": [
    "Bungee",
    "Anton",
    "Archivo Black",
    "Arial Black",
    "Impact",
  ],
  Italian: ["Bungee", "Anton", "Archivo Black", "Arial Black", "Impact"],
  "Spanish (Spain)": [
    "Bungee",
    "Anton",
    "Archivo Black",
    "Arial Black",
    "Impact",
  ],
  Turkish: ["Bungee", "Anton", "Archivo Black", "Arial Black", "Impact"],
  Thai: ["Noto Sans Thai", "Sarabun", "Prompt", "Thonburi"],
  Indonesian: ["Bungee", "Anton", "Archivo Black", "Arial Black", "Impact"],
  Vietnamese: ["Bungee", "Anton", "Archivo Black", "Arial Black", "Impact"],
  Polish: ["Bungee", "Anton", "Archivo Black", "Arial Black", "Impact"],
  Arabic: [
    "Cairo",
    "Tajawal",
    "Noto Kufi Arabic",
    "Noto Sans Arabic",
    "Geeza Pro",
  ],
  Russian: [
    "Russo One",
    "Exo 2",
    "Roboto Condensed",
    "Noto Sans",
    "Arial",
    "Tahoma",
  ],
};

async function sendSavedSettingsToUI() {
  try {
    const saved = await figma.clientStorage.getAsync(SETTINGS_KEY);
    figma.ui.postMessage({
      type: "init-settings",
      settings: saved && typeof saved === "object" ? saved : {},
    });
  } catch (error) {
    figma.ui.postMessage({
      type: "init-settings",
      settings: {},
    });
  }
}

function buildAvailableFontIndex(fonts) {
  const index = new Map();
  for (const item of fonts) {
    const family = item.fontName.family;
    const style = item.fontName.style;
    if (!index.has(family)) {
      index.set(family, new Set());
    }
    index.get(family).add(style);
  }
  return index;
}

function resolveLanguageFallbackFont(language, fontIndex) {
  const families = LANGUAGE_BUNGEE_FALLBACKS[language] || [];
  for (const family of families) {
    const styleSet = fontIndex.get(family);
    if (!styleSet) {
      continue;
    }
    for (const preferredStyle of BUNGEE_STYLE_PREFERENCES) {
      if (styleSet.has(preferredStyle)) {
        return { family, style: preferredStyle };
      }
    }
    const anyStyle = styleSet.values().next();
    if (anyStyle && !anyStyle.done) {
      return { family, style: anyStyle.value };
    }
  }
  return null;
}

async function ensureFontLoaded(fontName, loadedFonts) {
  const key = `${fontName.family}__${fontName.style}`;
  if (loadedFonts.has(key)) {
    return;
  }
  await figma.loadFontAsync(fontName);
  loadedFonts.set(key, true);
}

function captureTextNodeLayout(node) {
  return {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    centerX: node.x + node.width / 2,
    centerY: node.y + node.height / 2,
    textAlignHorizontal: node.textAlignHorizontal,
    textAutoResize: node.textAutoResize,
  };
}

function measureNaturalSizeForFixedTextNode(node, layout) {
  const width = layout.width;
  const height = layout.height;
  node.textAutoResize = "WIDTH_AND_HEIGHT";
  const natural = { width: node.width, height: node.height };
  node.textAutoResize = "NONE";
  node.resize(width, height);
  return natural;
}

function getFontSizeRuns(node) {
  const runs = [];
  const length = node.characters.length;
  if (!length) {
    return runs;
  }

  let runStart = 0;
  let runSize = node.getRangeFontSize(0, 1);
  for (let i = 1; i < length; i += 1) {
    const size = node.getRangeFontSize(i, i + 1);
    if (size !== runSize) {
      runs.push({ start: runStart, end: i, size: runSize });
      runStart = i;
      runSize = size;
    }
  }
  runs.push({ start: runStart, end: length, size: runSize });
  return runs;
}

function scaleFontSizes(node, factor, minFontSize) {
  const runs = getFontSizeRuns(node);
  if (!runs.length) {
    return false;
  }

  let changed = false;
  for (const run of runs) {
    const currentSize = Number(run.size);
    if (!Number.isFinite(currentSize)) {
      continue;
    }
    const nextSize = Math.max(
      minFontSize,
      Math.round(currentSize * factor * 100) / 100,
    );
    if (nextSize < currentSize) {
      node.setRangeFontSize(run.start, run.end, nextSize);
      changed = true;
    }
  }
  return changed;
}

function lineHeightsEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (a === figma.mixed || b === figma.mixed) {
    return false;
  }
  if (!a || !b || typeof a !== "object" || typeof b !== "object") {
    return false;
  }
  return a.unit === b.unit && a.value === b.value;
}

function getLineHeightRuns(node) {
  const runs = [];
  const length = node.characters.length;
  if (!length) {
    return runs;
  }

  let runStart = 0;
  let runHeight = node.getRangeLineHeight(0, 1);
  for (let i = 1; i < length; i += 1) {
    const value = node.getRangeLineHeight(i, i + 1);
    if (!lineHeightsEqual(value, runHeight)) {
      runs.push({ start: runStart, end: i, lineHeight: runHeight });
      runStart = i;
      runHeight = value;
    }
  }
  runs.push({ start: runStart, end: length, lineHeight: runHeight });
  return runs;
}

function scalePixelLineHeights(node, factor) {
  const runs = getLineHeightRuns(node);
  if (!runs.length) {
    return false;
  }

  let changed = false;
  for (const run of runs) {
    const lineHeight = run.lineHeight;
    if (
      !lineHeight ||
      lineHeight === figma.mixed ||
      typeof lineHeight !== "object"
    ) {
      continue;
    }
    if (lineHeight.unit !== "PIXELS") {
      continue;
    }

    const currentValue = Number(lineHeight.value);
    if (!Number.isFinite(currentValue)) {
      continue;
    }

    const nextValue = Math.max(
      8,
      Math.round(currentValue * factor * 100) / 100,
    );
    if (nextValue < currentValue) {
      node.setRangeLineHeight(run.start, run.end, {
        unit: "PIXELS",
        value: nextValue,
      });
      changed = true;
    }
  }
  return changed;
}

function normalizeMultilineLineHeight(node) {
  if (node.characters.indexOf("\n") < 0) {
    return false;
  }

  const runs = getLineHeightRuns(node);
  let changed = false;
  for (const run of runs) {
    const lineHeight = run.lineHeight;
    if (
      !lineHeight ||
      lineHeight === figma.mixed ||
      typeof lineHeight !== "object"
    ) {
      continue;
    }
    if (lineHeight.unit !== "PIXELS") {
      continue;
    }

    const fontSize = Number(node.getRangeFontSize(run.start, run.start + 1));
    const currentValue = Number(lineHeight.value);
    if (
      !Number.isFinite(fontSize) ||
      !Number.isFinite(currentValue) ||
      fontSize <= 0
    ) {
      continue;
    }

    const maxDesired = Math.round(fontSize * 1.28 * 100) / 100;
    if (currentValue > maxDesired) {
      node.setRangeLineHeight(run.start, run.end, {
        unit: "PIXELS",
        value: maxDesired,
      });
      changed = true;
    }
  }
  return changed;
}

function fitTextNodeToOriginalBounds(node, layout) {
  const minFontSize = 8;
  const maxIterations = 12;
  let iteration = 0;
  let lastOverflow = false;

  while (iteration < maxIterations) {
    let currentWidth;
    let currentHeight;

    if (layout.textAutoResize === "NONE") {
      const natural = measureNaturalSizeForFixedTextNode(node, layout);
      currentWidth = natural.width;
      currentHeight = natural.height;
    } else {
      currentWidth = node.width;
      currentHeight = node.height;
    }

    const overflowX = currentWidth > layout.width + 0.5;
    const overflowY = currentHeight > layout.height + 0.5;
    lastOverflow = overflowX || overflowY;
    if (!lastOverflow) {
      return { reduced: iteration > 0, stillOverflowing: false };
    }

    const widthRatio = layout.width / Math.max(currentWidth, 1);
    const heightRatio = layout.height / Math.max(currentHeight, 1);
    const factor = Math.min(widthRatio, heightRatio, 0.98);
    if (!(factor > 0 && factor < 1)) {
      break;
    }

    const sizeChanged = scaleFontSizes(node, factor, minFontSize);
    const lineHeightChanged = scalePixelLineHeights(node, factor);
    if (!sizeChanged && !lineHeightChanged) {
      break;
    }
    iteration += 1;
  }

  return { reduced: iteration > 0, stillOverflowing: lastOverflow };
}

function shouldFitAutoResizeNode(node, layout) {
  const autoSize = layout.textAutoResize;
  if (
    autoSize !== "WIDTH_AND_HEIGHT" &&
    autoSize !== "WIDTH" &&
    autoSize !== "HEIGHT"
  ) {
    return false;
  }

  const tooWide = node.width > layout.width * 1.12;
  const tooTall = node.height > layout.height * 1.25;
  return tooWide || tooTall;
}

function restoreCenteredPositionIfNeeded(node, layout) {
  const autoSize = layout.textAutoResize;
  const canShiftByContent =
    autoSize === "WIDTH_AND_HEIGHT" ||
    autoSize === "HEIGHT" ||
    autoSize === "WIDTH";

  if (!canShiftByContent) {
    return;
  }

  node.x = layout.centerX - node.width / 2;
  node.y = layout.centerY - node.height / 2;
}

function extractNumericTokens(text) {
  if (!text) {
    return [];
  }
  const matches = text.match(/\d+\s*[xXvV]\s*\d+|\d+%?|\d+[A-Za-z]+/g) || [];
  const seen = new Set();
  const result = [];
  for (const token of matches) {
    if (!seen.has(token)) {
      seen.add(token);
      result.push(token);
    }
  }
  return result;
}

function normalizeToken(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function translationHasToken(text, token) {
  const normalizedText = normalizeToken(text);
  const normalizedToken = normalizeToken(token);
  return normalizedText.indexOf(normalizedToken) >= 0;
}

function enforceNumericTokens(sourceText, translatedText) {
  const tokens = extractNumericTokens(sourceText);
  if (!tokens.length) {
    return { text: translatedText, addedTokens: [] };
  }

  const outputText = String(translatedText == null ? "" : translatedText);
  const missing = [];
  for (const token of tokens) {
    if (!translationHasToken(outputText, token)) {
      missing.push(token);
    }
  }

  if (!missing.length) {
    return { text: outputText, addedTokens: [] };
  }

  return {
    text: `${missing.join(" ")} ${outputText}`.trim(),
    addedTokens: missing,
  };
}

function getSelectedFrames() {
  return figma.currentPage.selection.filter((node) => node.type === "FRAME");
}

async function loadFontsForTextNode(node) {
  if (node.hasMissingFont) {
    throw new Error(
      `Missing font in text node "${node.name}". Please install fonts first.`,
    );
  }

  const fontNames = node.getRangeAllFontNames(0, node.characters.length);
  const unique = new Map();
  for (const fontName of fontNames) {
    unique.set(`${fontName.family}__${fontName.style}`, fontName);
  }
  for (const fontName of unique.values()) {
    await figma.loadFontAsync(fontName);
  }
}

async function translateTextsWithOpenAI({ apiKey, targetLanguage, texts }) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You are a senior localization specialist for consumer app UI copy.",
            "Translate with natural, idiomatic wording for native speakers.",
            "Preserve meaning, tone, and intent; avoid literal or awkward phrasing.",
            "Keep placeholders/tokens unchanged (for example: {name}, {{count}}, %s, $VAR, URLs, emoji).",
            "Preserve line breaks and bullet structure when present.",
            "Do not add extra text, explanations, or metadata.",
            "Return only valid JSON and keep output order and array length identical to input.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `Target language: ${targetLanguage}`,
            "Task: translate each UI string for a mobile app interface.",
            "Requirements:",
            "- Use concise, polished product copy suitable for buttons, labels, and messages.",
            "- Prefer commonly used localization terms in the target language.",
            "- Keep capitalization and punctuation intent appropriate for the target language.",
            "- Do not force all-caps or title case unless the source already uses it.",
            "- Keep the same number of lines as the source string when possible.",
            "- For short labels/buttons, keep translation very compact and punchy (avoid long phrasing).",
            "- Target translated length around source length; avoid expanding beyond ~120% unless necessary.",
            "- For display headings, prefer short imperative phrasing (1-4 words total).",
            "- Preserve all numeric and gameplay tokens exactly (for example: 4v4, 3D, 100%, x2).",
            "- Keep brand/product names unchanged.",
            "- If source is already in target language, keep it as-is unless awkward.",
            "Output rules:",
            '- Return this JSON shape exactly: {"translations":["..."]}.',
            "- Same number of items as input, same order.",
            "- No markdown, no comments, no keys other than translations.",
            'Return this JSON shape exactly: {"translations":["..."]}.',
            `Input JSON: ${JSON.stringify({ texts })}`,
          ].join("\n"),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI request failed (${response.status}): ${errorText || "Unknown error"}`,
    );
  }

  const json = await response.json();
  const content =
    json &&
    json.choices &&
    json.choices[0] &&
    json.choices[0].message &&
    json.choices[0].message.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response.");
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse OpenAI JSON: ${String(error)}`);
  }

  const translations = parsed && parsed.translations;
  if (!Array.isArray(translations) || translations.length !== texts.length) {
    throw new Error(
      "Invalid translation response length. Ensure the model returns one translation per input.",
    );
  }

  return translations.map((item) => String(item == null ? "" : item));
}

async function exportTranslatedFrame({
  frame,
  targetLanguage,
  apiKey,
  scale,
  fontIndex,
  loadedFonts,
  warnings,
}) {
  const clone = frame.clone();
  clone.name = `${frame.name} - ${targetLanguage}`;
  clone.x = frame.x + frame.width + 300;
  clone.y = frame.y;

  const textNodes = clone.findAll((n) => n.type === "TEXT");

  for (const textNode of textNodes) {
    await loadFontsForTextNode(textNode);
  }

  const texts = textNodes.map((node) => node.characters);
  const translations = texts.length
    ? await translateTextsWithOpenAI({
        apiKey,
        targetLanguage,
        texts,
      })
    : [];
  const languageFallbackFont = resolveLanguageFallbackFont(
    targetLanguage,
    fontIndex,
  );
  if (!languageFallbackFont) {
    warnings.add(
      `No installed fallback font mapping found for ${targetLanguage}. Install one of the configured display fonts to match Bungee style.`,
    );
  }

  for (let i = 0; i < textNodes.length; i += 1) {
    const textNode = textNodes[i];
    const translatedText = translations[i];
    const originalLayout = captureTextNodeLayout(textNode);
    const sourceText = texts[i];
    const numericEnforced = enforceNumericTokens(sourceText, translatedText);

    let finalText = numericEnforced.text;
    if (!finalText || !finalText.trim()) {
      warnings.add(
        `Empty translation returned for "${textNode.name}" (${targetLanguage}). Kept original text.`,
      );
      finalText = sourceText;
      textNode.characters = finalText;
    } else {
      textNode.characters = finalText;
      if (numericEnforced.addedTokens.length) {
        warnings.add(
          `Preserved numeric token(s) ${numericEnforced.addedTokens.join(", ")} for "${textNode.name}" (${targetLanguage}).`,
        );
      }
    }

    if (languageFallbackFont && finalText && finalText.trim()) {
      try {
        await ensureFontLoaded(languageFallbackFont, loadedFonts);
        textNode.fontName = languageFallbackFont;
      } catch (error) {
        warnings.add(
          `Could not apply fallback font "${languageFallbackFont.family} ${languageFallbackFont.style}" on "${textNode.name}" (${targetLanguage}).`,
        );
      }
    }

    const lineHeightNormalized = normalizeMultilineLineHeight(textNode);
    if (lineHeightNormalized) {
      warnings.add(
        `Adjusted line spacing for "${textNode.name}" (${targetLanguage}) to avoid large gaps.`,
      );
    }

    // Fit after final font is applied; fallback font can change metrics.
    if (
      originalLayout.textAutoResize === "NONE" ||
      shouldFitAutoResizeNode(textNode, originalLayout)
    ) {
      const fitResult = fitTextNodeToOriginalBounds(textNode, originalLayout);
      if (fitResult.reduced) {
        warnings.add(
          `Reduced font size to fit bounds for "${textNode.name}" (${targetLanguage}).`,
        );
      }
      if (fitResult.stillOverflowing) {
        warnings.add(
          `Text still overflows bounds for "${textNode.name}" (${targetLanguage}). Consider shorter copy or larger text area.`,
        );
      }
    }

    restoreCenteredPositionIfNeeded(textNode, originalLayout);
  }

  const bytes = await clone.exportAsync({
    format: "PNG",
    constraint: { type: "SCALE", value: scale },
  });

  clone.remove();

  return {
    fileName: `${frame.name}__${targetLanguage}.png`
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, "_"),
    bytes,
  };
}

async function runExport(payload) {
  const { apiKey, languages, scale = 1 } = payload;

  if (!apiKey || !apiKey.trim()) {
    throw new Error("OpenAI API key is required.");
  }
  const frames = getSelectedFrames();
  if (!frames.length) {
    throw new Error("Please select at least one frame.");
  }

  const selectedLanguages = (languages || [])
    .map((lang) => String(lang).trim())
    .filter(Boolean);
  if (!selectedLanguages.length) {
    throw new Error("Please select at least one language.");
  }

  const total = frames.length * selectedLanguages.length;
  let completed = 0;
  const allFiles = [];
  const warnings = new Set();
  const availableFonts = await figma.listAvailableFontsAsync();
  const fontIndex = buildAvailableFontIndex(availableFonts);
  const loadedFonts = new Map();

  for (const frame of frames) {
    for (const language of selectedLanguages) {
      figma.ui.postMessage({
        type: "progress",
        message: `Exporting "${frame.name}" in ${language}...`,
        completed,
        total,
      });

      const result = await exportTranslatedFrame({
        frame,
        targetLanguage: language,
        apiKey: apiKey.trim(),
        scale: Number(scale) || 1,
        fontIndex,
        loadedFonts,
        warnings,
      });

      completed += 1;
      allFiles.push({
        fileName: result.fileName,
        bytes: Array.from(result.bytes),
      });
    }
  }

  figma.ui.postMessage({
    type: "zip",
    zipName: `translated_frames_${Date.now()}.zip`,
    files: allFiles,
    warnings: Array.from(warnings),
    message: `Done. Exported ${completed} file(s).`,
  });
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === "request-settings") {
    await sendSavedSettingsToUI();
    return;
  }

  if (msg.type === "save-settings") {
    try {
      await figma.clientStorage.setAsync(
        SETTINGS_KEY,
        msg.payload && typeof msg.payload === "object" ? msg.payload : {},
      );
    } catch (error) {
      // Ignore storage failures and continue plugin flow.
    }
    return;
  }

  if (msg.type === "close") {
    figma.closePlugin();
    return;
  }

  if (msg.type !== "export") {
    return;
  }

  try {
    await runExport(msg.payload || {});
  } catch (error) {
    figma.ui.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

sendSavedSettingsToUI();
