import { idbGetAll, idbPut } from "./db.js";

console.log("backup.js laddad");

/* blob <-> dataURL konverteringar */
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    if (!blob) return resolve(null);
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/* dataURL -> Blob */
async function dataUrlToBlob(dataUrl) {
  if (!dataUrl) return null;
  const res = await fetch(dataUrl);
  return await res.blob();
}

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

export async function exportAll() {
  const patterns = await idbGetAll("patterns");
  const progress = await idbGetAll("progress");

  const patternsExport = [];
  for (const p of patterns) {
    const imageDataUrl = p.image ? await blobToDataUrl(p.image) : null;
    const { image, ...rest } = p;
    patternsExport.push({
      ...rest,
      imageDataUrl,
    });
  }

  const exportObj = {
    schema: "virk-app-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    patterns: patternsExport,
    progress
  };

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  downloadJson(exportObj, `virk-app-backup-${ts}.json`);
}

export async function importAllFromFile(file) {
  const text = await file.text();
  const data = JSON.parse(text);

  if (!data || data.schema !== "virk-app-backup") {
    throw new Error("Fel filformat");
  }

  const patterns = Array.isArray(data.patterns) ? data.patterns : [];
  const progress = Array.isArray(data.progress) ? data.progress : [];

  for (const p of patterns) {
    const { imageDataUrl, ...rest } = p;
    const imageBlob = imageDataUrl ? await dataUrlToBlob(imageDataUrl) : null;

    await idbPut("patterns", {
      ...rest,
      image: imageBlob,
      imageMeta: rest.imageMeta ?? null,
    });
  }

  for (const pr of progress) {
    if (pr?.patternId) {
      await idbPut("progress", pr);
    }
  }

  return {
    patternsImported: patterns.length,
    progressImported: progress.length
  };
}