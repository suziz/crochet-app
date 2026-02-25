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
  const collapseId = `part-body-${partIdx}`;
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.partIndex = partIdx;
  card.dataset.partId = partId;

card.innerHTML = `
  <div class="card-header d-flex align-items-center gap-2">

    <!-- Klickbar titel-yta -->
    <div class="d-flex align-items-center gap-2 flex-grow-1 part-toggle"
         role="button"
         data-toggle-part="${collapseId}"
         title="Fäll ihop/ut">

      <i class="bi bi-diagram-3"></i>

      <span class="fw-semibold">
        ${escapeAttr(partNameValue || "Ny del")}
      </span>

      <i class="bi bi-chevron-down text-body-secondary"></i>
    </div>

    <!-- DINA KNAPPAR (utanför toggle-ytan) -->
    <button type="button" class="btn btn-outline-primary btn-sm addRowBtn">
      <i class="bi bi-plus-circle"></i>
    </button>

    <button type="button" class="btn btn-outline-secondary btn-sm"
            data-bs-toggle="collapse"
            data-bs-target="#paste-${partIdx}">
      <i class="bi bi-clipboard-plus"></i>
    </button>

    <button type="button"
            class="btn btn-outline-danger btn-sm removePartBtn">
      <i class="bi bi-trash"></i>
    </button>

    <!-- part_id -->
    <input type="hidden"
           name="parts[${partIdx}][part_id]"
           value="${escapeAttr(partId)}">
  </div>

  <div id="${collapseId}" class="card-body d-none">

    <div class="mb-3">
      <label class="form-label">Delens namn</label>
      <input type="text"
             class="form-control"
             name="parts[${partIdx}][name]"
             value="${escapeAttr(partNameValue || "")}"
             required>
    </div>

    <div class="mb-3">
      <label class="form-label">Anteckningar</label>
      <textarea class="form-control"
                name="parts[${partIdx}][notes]"
                rows="2"></textarea>
    </div>

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

    <div class="mb-3">
      <label class="form-label">Inledande beskrivning (valfri)</label>
      <textarea class="form-control" name="parts[${partIdx}][introText]" rows="2"
        placeholder="Börja med färg (08)"></textarea>
    </div>

    <div class="vstack gap-2 rowsContainer"></div>

    <div class="mt-3">
      <label class="form-label">Avslutande beskrivning (valfri)</label>
      <textarea class="form-control" name="parts[${partIdx}][outroText]" rows="2"
        placeholder="Avsluta arbetet och lämna en lagom lång garnände för montering...."></textarea>
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
addPart("");

const firstBody = partsContainer.querySelector(".card-body");
if (firstBody) {
  firstBody.classList.remove("d-none");
}


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
// Normalisera inklistrad text till en rad per "Varv …" / "Row …"
// och försök bryta PDF-klumpar där ett nytt varv börjar mitt i raden.
function normalizeRowsText(text, { smartSplit = true } = {}) {
  if (!text) return "";
  // ersätt icke-brytande mellanslag och normalisera bara flera mellanslag
  let t = text.replace(/\u00A0/g, " ").replace(/[ \t]{2,}/g, " ");

  if (smartSplit) {
    // Bryt bara före "Varv/Row/Rnd X" när det följs av ett skiljetecken
    // t.ex. "Varv 3:", "Varv 8-10:", "Row 2." osv.
    t = t.replace(
      /\s+((?:Varv|V|R|Row|Round|Rnd)\s*\d+(?:\s*[-–]\s*\d+)?\s*[:.)-])/gi,
      "\n$1"
    );
    // om du även har engelska versioner utan "Varv", behåll ev. fler regler här
  }

  t = t
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean)
    .join("\n");

  return t;
}

// Känner igen: "Varv 1: …", "V1-3 …", "Row 2–5: …", "Rnd 4. …"
const rowRe = /^(?:varv|v|r|row|round|rnd)\s*(\d+)\s*(?:[-–]\s*(\d+))?\s*[:.)-]?\s*(.*)$/i;

// Extra: rader som bara börjar med ett nummer, t.ex. "1: 6 fm"
// eller "1) 6 fm", "1 - 6 fm"
const numberRowRe = /^(\d+)\s*[:.)-]\s*(.*)$/;

// Returnerar [{row_number, instruction}, ...]
function parseRowsText(
  text,
  {
    expandRanges = true,
    autoNumberLoose = true,
    startAt = 1,
    smartSplit = true
  } = {}
) {
  const t = normalizeRowsText(text, { smartSplit });
  const lines = t.split("\n");

  const out = [];
  let next = startAt;

  let lastRow = null;

  // 1) allt före första varvet
  const introLines = [];

  // 2) “lösa rader” efter senaste varv – vi vet inte än om de är
  //    fortsättning på varvet eller outroText (avgörs om ett nytt varv kommer)
  let tailBuffer = [];

  let seenAnyRow = false;

  function flushTailBufferToLastRow() {
    if (!tailBuffer.length || !lastRow) return;
    const extra = tailBuffer.join(" ").trim();
    if (extra) {
      lastRow.instruction = lastRow.instruction
        ? `${lastRow.instruction} ${extra}`
        : extra;
    }
    tailBuffer = [];
  }

  for (const line of lines) {
    // matcha "Varv/Row/Rnd ..."
    let m = line.match(rowRe);
    if (m) {
      // vi hittade ett nytt varv -> då var ev tailBuffer fortsättning på föregående varv
      if (seenAnyRow) flushTailBufferToLastRow();
      seenAnyRow = true;

      const start = parseInt(m[1], 10);
      const end = m[2] ? parseInt(m[2], 10) : null;
      const instr = (m[3] || "").trim();

      if (expandRanges && end && end >= start) {
        for (let n = start; n <= end; n++) {
          const row = { row_number: n, instruction: instr };
          out.push(row);
          lastRow = row;
        }
        next = end + 1;
      } else {
        const row = { row_number: start, instruction: instr };
        out.push(row);
        lastRow = row;
        next = Math.max(next, start + 1);
      }
      continue;
    }

    // matcha "1: text"
    m = line.match(numberRowRe);
    if (m) {
      if (seenAnyRow) flushTailBufferToLastRow();
      seenAnyRow = true;

      const n = parseInt(m[1], 10);
      const instr = (m[2] || "").trim();

      const row = { row_number: n, instruction: instr };
      out.push(row);
      lastRow = row;
      next = Math.max(next, n + 1);
      continue;
    }

    // övriga rader
    if (!line) continue;

    if (!seenAnyRow) {
      // före första varv => intro
      introLines.push(line);
      continue;
    }

    // efter att vi sett varv: lägg i buffer (kan bli fortsättning eller outro)
    if (autoNumberLoose) {
      if (lastRow) {
        tailBuffer.push(line);
      } else {
        // fallback om något skulle vara konstigt
        const row = { row_number: next++, instruction: line };
        out.push(row);
        lastRow = row;
      }
    }
  }

  // Om vi har tailBuffer kvar i slutet => det är avslutande text
  const outroText = tailBuffer.join("\n").trim();

  return {
    introText: introLines.join("\n").trim(),
    rows: out,
    outroText
  };
}

// --- Delegation för knappar i del-korten ---
partsContainer?.addEventListener("click", (e) => {
  const toggle = e.target.closest("[data-toggle-part]");
  if (toggle) {
    const id = toggle.getAttribute("data-toggle-part");
    const body = document.getElementById(id);
    if (body) body.classList.toggle("d-none");
    return;
  }
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

    const introField = card.querySelector(`textarea[name="parts[${partIdx}][introText]"]`);
    const outroField = card.querySelector(`textarea[name="parts[${partIdx}][outroText]"]`);

    if (replaceBtn) {
      rowsContainer.innerHTML = "";
      if (introField) introField.value = parsed.introText || "";
      if (outroField) outroField.value = parsed.outroText || "";
    }
    if (appendBtn) {
      if (parsed.outroText && outroField) {
        outroField.value = (outroField.value ? (outroField.value.trim() + "\n") : "") + parsed.outroText;
      }

      // Om någon klistrar in text som börjar med lösa rader men du redan har varv:
      // då är det ofta fortsättning på senaste varvet i listan.
      if (parsed.introText) {
        const lastInstrInput = rowsContainer.querySelector(
          'input[name$="[instruction]"]:last-of-type'
        );
        if (lastInstrInput) {
          lastInstrInput.value = (lastInstrInput.value ? (lastInstrInput.value + " ") : "") + parsed.introText.replace(/\n/g, " ");
        }
      }
    }

    let nextIdx = replaceBtn ? 1 : getMaxRowIdx(rowsContainer) + 1;

    if ((parsed.rows?.length || 0) === 0) {
      if (replaceBtn && rowsContainer.children.length === 0) {
        rowsContainer.appendChild(createRow(partIdx, nextIdx++, "", startAt));
      }
      return;
    }

    for (const r of (parsed.rows || [])) {
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

    const intro = card.querySelector(`textarea[name="parts[${partIndex}][introText]"]`);
    if (intro) intro.value = part.introText || "";

    const outro = card.querySelector(`textarea[name="parts[${partIndex}][outroText]"]`);
    if (outro) outro.value = part.outroText || "";

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

  if (!partsContainer.children.length) addPart("");
  // Öppna första delen automatiskt
  const firstBody = partsContainer.querySelector(".card-body");
  if (firstBody) {
    firstBody.classList.remove("d-none");
  }

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
    const mPartIntro = key.match(/^parts\[(\d+)\]\[introText\]$/);
    const mPartOutro = key.match(/^parts\[(\d+)\]\[outroText\]$/);

    if (mPartId) {
      const pidx = mPartId[1];
      if (!partsMap.has(pidx)) partsMap.set(pidx, { part_id: "", name: "", notes: "", introText: "", outroText: "", rows: new Map() });
      partsMap.get(pidx).part_id = value;
    } else if (mPartName) {
      const pidx = mPartName[1];
      if (!partsMap.has(pidx)) partsMap.set(pidx, { part_id: "", name: "", notes: "", introText: "", outroText: "", rows: new Map() });
      partsMap.get(pidx).name = value;
    } else if (mPartNotes) {
      const pidx = mPartNotes[1];
      if (!partsMap.has(pidx)) partsMap.set(pidx, { part_id: "", name: "", notes: "", introText: "", outroText: "", rows: new Map() });
      partsMap.get(pidx).notes = value;
    } else if (mRow) {
      const pidx = mRow[1];
      const ridx = mRow[2];
      const field = mRow[3];

      if (!partsMap.has(pidx)) partsMap.set(pidx, { part_id: "", name: "", notes: "", introText: "", outroText: "", rows: new Map() });
      const partObj = partsMap.get(pidx);

      if (!partObj.rows.has(ridx)) partObj.rows.set(ridx, { row_number: null, instruction: "" });
      const rowObj = partObj.rows.get(ridx);

      if (field === "row_number") rowObj.row_number = value ? parseInt(value, 10) : null;
      if (field === "instruction") rowObj.instruction = value;
    }
    else if (mPartIntro) {
      const pidx = mPartIntro[1];
      if (!partsMap.has(pidx)) partsMap.set(pidx, { part_id:"", name:"", notes:"", introText:"", outroText:"", rows:new Map() });
      partsMap.get(pidx).introText = value;
    } else if (mPartOutro) {
      const pidx = mPartOutro[1];
      if (!partsMap.has(pidx)) partsMap.set(pidx, { part_id:"", name:"", notes:"", introText:"", outroText:"", rows:new Map() });
      partsMap.get(pidx).outroText = value;
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
      introText: pObj.introText || "",
      outroText: pObj.outroText || "",
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