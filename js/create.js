import { registerPWA } from "./pwa.js";
registerPWA();
import { idbGet, idbPut } from "./db.js";
import { imageFileToResizedBlob } from "./image.js";

const form = document.querySelector("form");
const partsContainer = document.getElementById("partsContainer");
const addPartBtn = document.getElementById("addPartBtn");

const params = new URLSearchParams(window.location.search);
const editId = params.get("edit");

// --- Bootstrap validering ---
(() => {
  "use strict";
  const forms = document.querySelectorAll(".needs-validation");
  Array.from(forms).forEach(f => {
    f.addEventListener("submit", evt => {
      if (!f.checkValidity()) {
        evt.preventDefault();
        evt.stopPropagation();
      }
      f.classList.add("was-validated");
    }, false);
  });
})();

// --- Bild-state ---
let currentImageBlob = null;
let currentImageMeta = null;
let removeImageFlag = false;

const imgInput = document.getElementById("pattern_image");
const preview = document.getElementById("imagePreview");
const removeImageBtn = document.getElementById("removeImageBtn");

function showPreviewFromBlob(blob) {
  if (!preview) return;

  if (!blob) {
    preview.classList.add("d-none");
    preview.src = "";
    removeImageBtn?.classList.add("d-none");
    return;
  }

  const url = URL.createObjectURL(blob);
  preview.src = url;
  preview.classList.remove("d-none");
  removeImageBtn?.classList.remove("d-none");
  preview.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
}

imgInput?.addEventListener("change", async () => {
  const file = imgInput.files?.[0];
  if (!file) return;

  removeImageFlag = false;
  const { blob, meta } = await imageFileToResizedBlob(file, {
    maxWidth: 1400,
    maxHeight: 1400,
    mimeType: "image/jpeg",
    quality: 0.82
  });

  currentImageBlob = blob;
  currentImageMeta = meta;
  showPreviewFromBlob(blob);
});

removeImageBtn?.addEventListener("click", () => {
  removeImageFlag = true;
  currentImageBlob = null;
  currentImageMeta = null;
  if (imgInput) imgInput.value = "";
  showPreviewFromBlob(null);
});

// --- Dynamisk hantering av delar och varv ---
let partIndex = 0;

function escapeAttr(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function createRow(partIdx, rowIdx, instructionValue = "", rowNumberValue = "") {
  const row = document.createElement("div");
  row.className = "input-group";
  row.dataset.rowIndex = rowIdx;

  row.innerHTML = `
    <span class="input-group-text">Varv</span>
    <input type="number" min="1" class="form-control" name="parts[${partIdx}][rows][${rowIdx}][row_number]"
           placeholder="1" value="${escapeAttr(rowNumberValue || "")}" aria-label="Varvnummer">
    <input type="text" class="form-control" name="parts[${partIdx}][rows][${rowIdx}][instruction]"
           placeholder="t.ex. 6 fm i magisk ring" value="${escapeAttr(instructionValue || "")}" aria-label="Instruktion">
    <button type="button" class="btn btn-outline-secondary removeRowBtn" title="Ta bort varv">
      <i class="bi bi-x-lg"></i>
    </button>
  `;
  return row;
}

function createPartCard(partIdx, partNameValue = "", partId = crypto.randomUUID()) {
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.partIndex = partIdx;
  card.dataset.partId = partId;

  card.innerHTML = `
    <div class="card-header d-flex gap-2 align-items-center">
      <i class="bi bi-diagram-3 me-2"></i>

      <!-- part_id (stabil nyckel) -->
      <input type="hidden" name="parts[${partIdx}][part_id]" value="${escapeAttr(partId)}">

      <input type="text" class="form-control" name="parts[${partIdx}][name]" placeholder="t.ex. Kropp"
             value="${escapeAttr(partNameValue || "")}" required>

      <button type="button" class="btn btn-outline-primary btn-sm addRowBtn">
        <i class="bi bi-plus-circle me-1"></i>Lägg till varv
      </button>

      <button type="button" class="btn btn-outline-secondary btn-sm"
              data-bs-toggle="collapse" data-bs-target="#paste-${partIdx}"
              aria-expanded="false" aria-controls="paste-${partIdx}">
        <i class="bi bi-clipboard-plus me-1"></i>Klistra in varv
      </button>

      <button type="button" class="btn btn-outline-danger btn-sm ms-auto removePartBtn" title="Ta bort del">
        <i class="bi bi-trash"></i>
      </button>
    </div>

    <div class="card-body">
      <div class="collapse mb-3" id="paste-${partIdx}">
        <div class="mb-2">
          <label class="form-label">Klistra in rader för denna del</label>
          <textarea class="form-control pasteText" data-part-index="${partIdx}" rows="6"></textarea>
        </div>

        <div class="row g-2 align-items-center">
          <div class="col-12 col-md-auto">
            <div class="form-check">
              <input class="form-check-input pasteExpand" type="checkbox" id="expand-${partIdx}" checked>
              <label class="form-check-label" for="expand-${partIdx}">Expandera intervall</label>
            </div>
          </div>

          <div class="col-12 col-md-auto">
            <div class="form-check">
              <input class="form-check-input pasteAutoNumber" type="checkbox" id="autonum-${partIdx}" checked>
              <label class="form-check-label" for="autonum-${partIdx}">Numrera rader utan “Varv …”</label>
            </div>
          </div>

          <div class="col-12 col-md-auto">
            <div class="form-check">
              <input class="form-check-input pasteSmartSplit" type="checkbox" id="smartsplit-${partIdx}" checked>
              <label class="form-check-label" for="smartsplit-${partIdx}">Smart radbryt</label>
            </div>
          </div>

          <div class="col-12 col-md-auto ms-md-auto">
            <button type="button" class="btn btn-outline-secondary btn-sm pasteRowsExample" data-part-index="${partIdx}">
              <i class="bi bi-file-earmark-text me-1"></i>Exempel
            </button>
            <button type="button" class="btn btn-outline-secondary btn-sm pasteRowsAppend" data-part-index="${partIdx}">
              <i class="bi bi-plus-lg me-1"></i>Lägg till
            </button>
            <button type="button" class="btn btn-primary btn-sm pasteRowsReplace" data-part-index="${partIdx}">
              <i class="bi bi-arrow-repeat me-1"></i>Ersätt
            </button>
          </div>
        </div>
      </div>

      <div class="vstack gap-2 rowsContainer"></div>

      <div class="mt-3">
        <label class="form-label">Anteckningar (valfritt)</label>
        <textarea class="form-control" name="parts[${partIdx}][notes]" rows="2"
                  placeholder="Ex: Sy fast mellan varv 14 och 18, byt färg efter varv 10 …"></textarea>
      </div>
    </div>
  `;

  // starta med ett första varv
  const rowsContainer = card.querySelector(".rowsContainer");
  rowsContainer.appendChild(createRow(partIdx, 1, "", 1));

  return card;
}

function addPart(defaultName = "", partId = null) {
  partIndex++;
  const card = createPartCard(partIndex, defaultName, partId || crypto.randomUUID());
  partsContainer.appendChild(card);
}

addPartBtn?.addEventListener("click", () => addPart(""));

// Init – lägg till första del
addPart("Kropp");

// --- Hjälpfunktioner för index och nästa varvnummer ---
function getMaxRowIdx(rowsContainer) {
  let max = 0;
  rowsContainer.querySelectorAll(".input-group").forEach(g => {
    const idx = parseInt(g.dataset.rowIndex, 10);
    if (!isNaN(idx) && idx > max) max = idx;
  });
  return max;
}
function getMaxRowNumber(rowsContainer) {
  let max = 0;
  rowsContainer.querySelectorAll('input[name$="[row_number]"]').forEach(inp => {
    const v = parseInt(inp.value, 10);
    if (!isNaN(v) && v > max) max = v;
  });
  return max;
}

// --- Parser per del (din) ---
function normalizeRowsText(text, { smartSplit = true } = {}) {
  if (!text) return "";
  let t = text.replace(/\u00A0/g, " ").replace(/\s{2,}/g, " ").trim();

  if (smartSplit) {
    t = t.replace(/\s+(Varv\s*\d+(?:\s*[-–]\s*\d+)?\s*:)/gi, "\n$1");
    t = t.replace(/\s+(R(?:ow|ound)?\s*\d+(?:\s*[-–]\s*\d+)?\s*:)/gi, "\n$1");
  }

  t = t.replace(/\r\n?/g, "\n")
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean)
    .join("\n");

  return t;
}
const rowRe = /^(?:varv|v|r|row|round)\s*(\d+)\s*(?:[-–]\s*(\d+))?\s*[:.\-]?\s*(.*)$/i;

function parseRowsText(text, { expandRanges = true, autoNumberLoose = true, startAt = 1, smartSplit = true } = {}) {
  const t = normalizeRowsText(text, { smartSplit });
  const lines = t.split("\n");
  const out = [];
  let next = startAt;

  for (const line of lines) {
    const m = line.match(rowRe);
    if (m) {
      const start = parseInt(m[1], 10);
      const end = m[2] ? parseInt(m[2], 10) : null;
      const instr = (m[3] || "").trim();

      if (expandRanges && end && end >= start) {
        for (let n = start; n <= end; n++) out.push({ row_number: n, instruction: instr });
        next = end + 1;
      } else {
        out.push({ row_number: start, instruction: instr });
        next = Math.max(next, start + 1);
      }
    } else if (autoNumberLoose && line) {
      out.push({ row_number: next++, instruction: line });
    }
  }
  return out;
}

// --- Delegation för knappar i del-korten ---
partsContainer?.addEventListener("click", (e) => {
  const addRowBtn = e.target.closest(".addRowBtn");
  const removePartBtn = e.target.closest(".removePartBtn");
  const removeRowBtn = e.target.closest(".removeRowBtn");
  const replaceBtn = e.target.closest(".pasteRowsReplace");
  const appendBtn = e.target.closest(".pasteRowsAppend");
  const exampleBtn = e.target.closest(".pasteRowsExample");

  if (addRowBtn) {
    const card = addRowBtn.closest(".card");
    const partIdx = card.dataset.partIndex;
    const rowsContainer = card.querySelector(".rowsContainer");
    let nextIdx = getMaxRowIdx(rowsContainer) + 1;
    const nextRowNumber = getMaxRowNumber(rowsContainer) + 1;
    rowsContainer.appendChild(createRow(partIdx, nextIdx, "", nextRowNumber));
    return;
  }

  if (removePartBtn) {
    removePartBtn.closest(".card")?.remove();
    return;
  }

  if (removeRowBtn) {
    removeRowBtn.closest(".input-group")?.remove();
    return;
  }

  if (exampleBtn) {
    const card = exampleBtn.closest(".card");
    const partIdx = card.dataset.partIndex;
    const pasteBox = card.querySelector(`.pasteText[data-part-index="${partIdx}"]`);
    if (pasteBox) {
      pasteBox.value =
`Varv 1: 6 fm i en mr [6]
Varv 2-3: fm i alla 6 m [6]
Varv 4: (färg 03) öka i följande 2 m, (färg 16) öka i följande 3 m [11]
Varv 5: (färg 03) fm i följande 4 m, (färg 16) fm i följande 7 m [11]
Byt till färg (16)
Varv 6-7: fm i alla m [11]`;
    }
    return;
  }

  if (replaceBtn || appendBtn) {
    const btn = replaceBtn || appendBtn;
    const card = btn.closest(".card");
    const partIdx = card.dataset.partIndex;
    const rowsContainer = card.querySelector(".rowsContainer");

    const pasteBox = card.querySelector(`.pasteText[data-part-index="${partIdx}"]`);
    const expandCb = card.querySelector(`#expand-${partIdx}`);
    const autoNumCb = card.querySelector(`#autonum-${partIdx}`);
    const smartSplit = card.querySelector(`#smartsplit-${partIdx}`);

    const text = pasteBox?.value || "";
    const startAt = replaceBtn ? 1 : Math.max(1, getMaxRowNumber(rowsContainer) + 1);

    const parsed = parseRowsText(text, {
      expandRanges: !!expandCb?.checked,
      autoNumberLoose: !!autoNumCb?.checked,
      startAt,
      smartSplit: !!smartSplit?.checked
    });

    if (replaceBtn) rowsContainer.innerHTML = "";

    let nextIdx = replaceBtn ? 1 : getMaxRowIdx(rowsContainer) + 1;

    if (parsed.length === 0) {
      if (replaceBtn && rowsContainer.children.length === 0) {
        rowsContainer.appendChild(createRow(partIdx, nextIdx++, "", startAt));
      }
      return;
    }

    for (const r of parsed) {
      rowsContainer.appendChild(createRow(partIdx, nextIdx++, r.instruction || "", r.row_number || ""));
    }
    return;
  }
});

// --- Fill form from IndexedDB pattern (edit) ---
async function fillFormFromPattern(p) {
  document.getElementById("pattern_name").value = p.name || "";
  document.getElementById("pattern_description").value = p.description || "";

  partsContainer.innerHTML = "";
  partIndex = 0;

  for (const part of (p.parts || [])) {
    addPart(part.name || "", part.part_id); // <-- behåll part_id!
    const card = partsContainer.lastElementChild;

    const notes = card.querySelector(`textarea[name="parts[${partIndex}][notes]"]`);
    if (notes) notes.value = part.notes || "";

    const rowsContainer = card.querySelector(".rowsContainer");
    rowsContainer.innerHTML = "";

    let rowIdx = 0;
    for (const r of (part.rows || [])) {
      rowIdx++;
      rowsContainer.appendChild(createRow(partIndex, rowIdx, r.instruction || "", r.row_number ?? ""));
    }
    if (!rowsContainer.children.length) {
      rowsContainer.appendChild(createRow(partIndex, 1, "", 1));
    }
  }

  if (!partsContainer.children.length) addPart("Kropp");

  // Bild
  currentImageBlob = p.image || null;
  currentImageMeta = p.imageMeta || null;
  removeImageFlag = false;
  showPreviewFromBlob(currentImageBlob);

  document.querySelector("h1").textContent = "Redigera mönster";
  document.querySelector('button[type="submit"]').innerHTML =
    `<i class="bi bi-save me-1"></i>Spara ändringar`;
}

if (editId) {
  const p = await idbGet("patterns", editId);
  if (p) await fillFormFromPattern(p);
}

// --- Submit: spara till IndexedDB ---
form?.addEventListener("submit", async (evt) => {
  evt.preventDefault();
  if (!form.checkValidity()) return;

  const fd = new FormData(form);
  const now = Date.now();

  const patternId = editId || crypto.randomUUID();
  const pattern = {
    id: patternId,
    name: fd.get("name") || "",
    description: fd.get("description") || "",
    parts: [],
    image: null,
    imageMeta: null,
    createdAt: now,
    updatedAt: now
  };

  let existing = null;
  if (editId) {
    existing = await idbGet("patterns", editId);
    if (existing?.createdAt) pattern.createdAt = existing.createdAt;
  }

  // parts + rows + part_id
  const partsMap = new Map();

  for (const [key, value] of fd.entries()) {
    const mPartId   = key.match(/^parts\[(\d+)\]\[part_id\]$/);
    const mPartName = key.match(/^parts\[(\d+)\]\[name\]$/);
    const mPartNotes = key.match(/^parts\[(\d+)\]\[notes\]$/);
    const mRow = key.match(/^parts\[(\d+)\]\[rows\]\[(\d+)\]\[(row_number|instruction)\]$/);

    if (mPartId) {
      const pidx = mPartId[1];
      if (!partsMap.has(pidx)) partsMap.set(pidx, { part_id: "", name: "", notes: "", rows: new Map() });
      partsMap.get(pidx).part_id = value;
    } else if (mPartName) {
      const pidx = mPartName[1];
      if (!partsMap.has(pidx)) partsMap.set(pidx, { part_id: "", name: "", notes: "", rows: new Map() });
      partsMap.get(pidx).name = value;
    } else if (mPartNotes) {
      const pidx = mPartNotes[1];
      if (!partsMap.has(pidx)) partsMap.set(pidx, { part_id: "", name: "", notes: "", rows: new Map() });
      partsMap.get(pidx).notes = value;
    } else if (mRow) {
      const pidx = mRow[1];
      const ridx = mRow[2];
      const field = mRow[3];

      if (!partsMap.has(pidx)) partsMap.set(pidx, { part_id: "", name: "", notes: "", rows: new Map() });
      const partObj = partsMap.get(pidx);

      if (!partObj.rows.has(ridx)) partObj.rows.set(ridx, { row_number: null, instruction: "" });
      const rowObj = partObj.rows.get(ridx);

      if (field === "row_number") rowObj.row_number = value ? parseInt(value, 10) : null;
      if (field === "instruction") rowObj.instruction = value;
    }
  }

  for (const [pIdx, pObj] of [...partsMap.entries()].sort((a,b)=>parseInt(a[0])-parseInt(b[0]))) {
    const rows = [...pObj.rows.entries()]
      .sort((a,b)=>parseInt(a[0])-parseInt(b[0]))
      .map(([_, row]) => row)
      .filter(r => r.row_number || (r.instruction && r.instruction.trim().length));

    pattern.parts.push({
      part_id: pObj.part_id || crypto.randomUUID(),
      name: pObj.name,
      notes: pObj.notes,
      rows
    });
  }

  // Bild
  if (removeImageFlag) {
    pattern.image = null;
    pattern.imageMeta = null;
  } else if (currentImageBlob) {
    pattern.image = currentImageBlob;
    pattern.imageMeta = currentImageMeta || null;
  } else if (existing?.image) {
    pattern.image = existing.image;
    pattern.imageMeta = existing.imageMeta || null;
  }

  await idbPut("patterns", pattern);

  window.location.href = `pattern.html?id=${encodeURIComponent(pattern.id)}`;
});