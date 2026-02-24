import { registerPWA } from "./pwa.js";
registerPWA();
import { idbGet, idbPut, idbDelete } from "./db.js";
import { escapeHtml, escapeAttr, cssSafe, qs } from "./utils.js";

const content = qs("#content");
const notFound = qs("#notFound");
const resetBtn = qs("#resetBtn");

let currentPattern = null;
let currentProgress = null;

function getIdFromUrl() {
  return new URLSearchParams(window.location.search).get("id");
}

function progressDefault(patternId) {
  return { patternId, checked: {}, updatedAt: Date.now() };
}

async function loadProgress(patternId) {
  const p = await idbGet("progress", patternId);
  return p || progressDefault(patternId);
}

async function saveProgress(progress) {
  progress.updatedAt = Date.now();
  await idbPut("progress", progress);
}

/**
 * Beskrivning: Rubriker i versaler -> sektioner.
 * Items läggs i två kolumner där vänster fylls först.
 */
function renderDescriptionColumns(root, description) {
  const lines = description
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);

  const sections = [];
  let current = { title: "Allmänt", items: [] };

  const isTitle = (line) => {
    if (line.length < 2) return false;
    const hasLetter = /[A-Za-zÅÄÖåäö]/.test(line);
    return hasLetter && line === line.toUpperCase();
  };

  for (const line of lines) {
    if (isTitle(line)) {
      if (current.items.length) sections.push(current);
      current = { title: line, items: [] };
    } else {
      current.items.push(line);
    }
  }
  if (current.items.length || sections.length === 0) sections.push(current);

  for (const sec of sections) {
    const secWrap = document.createElement("div");
    secWrap.className = "desc-section mb-3 p-3 rounded bg-body-tertiary border";

    const titleEl = document.createElement("div");
    titleEl.className = "section-title";
    titleEl.textContent = sec.title;
    secWrap.appendChild(titleEl);

    const row = document.createElement("div");
    row.className = "row desc-items text-body-secondary";

    const leftCol = document.createElement("div");
    leftCol.className = "col-12 col-md-6";
    const rightCol = document.createElement("div");
    rightCol.className = "col-12 col-md-6";

    const n = sec.items.length;
    const leftCount = Math.ceil(n / 2);
    const leftItems = sec.items.slice(0, leftCount);
    const rightItems = sec.items.slice(leftCount);

    const makeList = (items) => {
      const ul = document.createElement("ul");
      ul.style.listStyle = "none";
      ul.style.paddingLeft = "0";
      ul.style.margin = "0";

      for (const item of items) {
        const li = document.createElement("li");
        li.style.marginBottom = "0.25rem";

        // valfri fetmarkering av "2 nystan" etc.
        const m = item.match(/^(\d+(?:[.,]\d+)?\s*(?:nystan|st|styck|par|mm)?\b)(.*)$/i);
        if (m) {
          const strong = document.createElement("strong");
          strong.textContent = m[1];
          li.appendChild(strong);

          const rest = (m[2] || "").trim();
          if (rest) li.appendChild(document.createTextNode(" " + rest));
        } else {
          li.textContent = item;
        }

        ul.appendChild(li);
      }
      return ul;
    };

    leftCol.appendChild(makeList(leftItems));
    rightCol.appendChild(makeList(rightItems));

    row.appendChild(leftCol);
    row.appendChild(rightCol);
    secWrap.appendChild(row);
    root.appendChild(secWrap);
  }
}

function ensureProgressBucket(partKey) {
  if (!currentProgress.checked[partKey]) currentProgress.checked[partKey] = {};
}

function renderPattern(p) {
  currentPattern = p;

  document.title = p.name ? `${p.name} - Mönster` : "Mönster";

  // Bild (Blob -> ObjectURL)
  let imgUrl = null;
  if (p.image) imgUrl = URL.createObjectURL(p.image);

  content.innerHTML = `
    <div class="mb-3">
      <div class="d-flex justify-content-between align-items-start gap-2">
        <h1 class="h3 mb-2">${escapeHtml(p.name || "Namnlöst mönster")}</h1>

        <a class="btn btn-outline-secondary btn-sm"
           href="create_form.html?edit=${encodeURIComponent(p.id)}">
          <i class="bi bi-pencil me-1"></i> Redigera
        </a>
      </div>

      ${imgUrl ? `
        <img src="${escapeAttr(imgUrl)}" class="img-fluid rounded border mb-2" alt="Bild för mönster">
      ` : ""}
    </div>
  `;

  // Släpp objectURL efter load
  if (imgUrl) {
    const img = content.querySelector("img");
    img?.addEventListener("load", () => URL.revokeObjectURL(imgUrl), { once: true });
  }

  // Beskrivning
  if (p.description) {
    renderDescriptionColumns(content, p.description);
  }

  // Delar
  for (const part of (p.parts || [])) {
    const partName = part.name || "Del";

    // ✅ part_id som nyckel för progress (fallback till namn för äldre data)
    const partKey = part.part_id || partName;
    ensureProgressBucket(partKey);

    const card = document.createElement("div");
    card.className = "card part-card";

    const rowsHtml = (part.rows || [])
      .slice()
      .sort((a, b) => (a.row_number ?? 0) - (b.row_number ?? 0))
      .map(row => {
        const rn = row.row_number ?? "";
        const instr = row.instruction || "";
        const rnKey = String(rn);

        const checked = !!currentProgress.checked[partKey][rnKey];
        const idAttr = `cb-${cssSafe(p.id)}-${cssSafe(partKey)}-${cssSafe(rnKey)}`;

        return `
          <div class="row-item py-2 border-top">
            <div class="form-check">
              <input class="form-check-input row-check" type="checkbox"
                     id="${idAttr}"
                     data-part="${escapeAttr(partKey)}"
                     data-row="${escapeAttr(rnKey)}"
                     ${checked ? "checked" : ""}>
            </div>
            <label class="row-text ${checked ? "strike" : ""}" for="${idAttr}">
              <div>
                <span class="fw-semibold">Varv ${escapeHtml(rnKey)}:</span>
                <span>${escapeHtml(instr)}</span>
              </div>
            </label>
          </div>
        `;
      })
      .join("");

    card.innerHTML = `
      <div class="card-header">
        <div class="fw-semibold"><i class="bi bi-diagram-3 me-2"></i>${escapeHtml(partName)}</div>
        ${part.notes ? `<div class="small text-body-secondary mt-1 preserve-lines">${escapeHtml(part.notes)}</div>` : ""}
      </div>
      <div class="card-body px-3 py-2">
        ${rowsHtml || `<div class="p-3 text-body-secondary">Inga varv i denna del.</div>`}
      </div>
    `;

    content.appendChild(card);
  }
}

content.addEventListener("change", async (e) => {
  const cb = e.target.closest(".row-check");
  if (!cb || !currentPattern || !currentProgress) return;

  const partKey = cb.dataset.part;
  const rowNo = cb.dataset.row;

  ensureProgressBucket(partKey);
  currentProgress.checked[partKey][rowNo] = cb.checked;

  await saveProgress(currentProgress);

  // uppdatera strike direkt
  const label = cb.closest(".row-item")?.querySelector("label.row-text");
  if (label) label.classList.toggle("strike", cb.checked);
});

resetBtn?.addEventListener("click", async () => {
  if (!currentPattern) return;
  const ok = confirm("Rensa all progress för detta mönster?");
  if (!ok) return;

  await idbDelete("progress", currentPattern.id);
  currentProgress = progressDefault(currentPattern.id);

  // rendera om
  renderPattern(currentPattern);
});

async function main() {
    console.log("origin:", location.origin);
console.log("url:", location.href);
  const id = getIdFromUrl();
  console.log("pattern id från url:", id);
  

  if (!id) {
    notFound.classList.remove("d-none");
    resetBtn.disabled = true;
    return;
  }

  const pattern = await idbGet("patterns", id);
  console.log("pattern från IndexedDB:", pattern);
  if (!pattern) {
    notFound.classList.remove("d-none");
    resetBtn.disabled = true;
    return;
  }

  currentProgress = await loadProgress(pattern.id);
  renderPattern(pattern);
}

main();