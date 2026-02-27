import { registerPWA } from "./pwa.js";
registerPWA();
import { exportAll, importAllFromFile } from "./backup.js";
import { idbGetAll, idbDelete } from "./db.js";
import { escapeHtml, qs } from "./utils.js";

const list = qs("#patternsList");
const empty = qs("#emptyState");

const exportBtn = qs("#exportBtn");
const importFile = qs("#importFile");

exportBtn?.addEventListener("click", async () => {
  try {
    exportBtn.disabled = true;
    await exportAll();
  } finally {
    exportBtn.disabled = false;
  }
});

importFile?.addEventListener("change", async () => {
  const file = importFile.files?.[0];
  if (!file) return;

  try {
    const res = await importAllFromFile(file);
    alert(`Import klar!\nMönster: ${res.patternsImported}\nProgress: ${res.progressImported}`);
    await renderList();
  } catch (err) {
    alert(`Import misslyckades: ${err.message || err}`);
  } finally {
    importFile.value = "";
  }
});

async function renderList() {
  list.innerHTML = "";

  let patterns = await idbGetAll("patterns");

  // sortera senaste först
  patterns.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  if (!patterns.length) {
    empty?.classList.remove("d-none");
    return;
  }

  empty?.classList.add("d-none");

  for (const p of patterns) {
    const li = document.createElement("li");
    li.className = "list-group-item";

    const row = document.createElement("div");
    row.className = "pattern-row";

    // Thumbnail (om bild finns)
    if (p.image) {
      const thumb = document.createElement("img");
      thumb.className = "pattern-thumb";
      const url = URL.createObjectURL(p.image);
      thumb.src = url;

      thumb.addEventListener("load", () => {
        URL.revokeObjectURL(url);
      }, { once: true });

      row.appendChild(thumb);
    }

    // Titel
    const title = document.createElement("div");
    title.className = "pattern-title";
    title.innerHTML = `<i class="bi bi-journal-text me-2"></i>${escapeHtml(p.name || "Namnlöst mönster")}`;

    title.addEventListener("click", () => {
      window.location.href = `pattern.html?id=${encodeURIComponent(p.id)}`;
    });

    // Redigera
    const editBtn = document.createElement("a");
    editBtn.className = "btn btn-outline-secondary btn-sm";
    editBtn.innerHTML = `<i class="bi bi-pencil"></i>`;
    editBtn.title = "Redigera";
    editBtn.href = `create.html?edit=${encodeURIComponent(p.id)}`;

    // Ta bort
    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-outline-danger btn-sm";
    delBtn.innerHTML = `<i class="bi bi-trash"></i>`;
    delBtn.title = "Ta bort";

    delBtn.addEventListener("click", async (e) => {
      e.stopPropagation();

      const ok = confirm(`Ta bort "${p.name || "Namnlöst mönster"}"?`);
      if (!ok) return;

      await idbDelete("patterns", p.id);
      await idbDelete("progress", p.id); // rensa progress också

      await renderList();
    });

    row.appendChild(title);
    row.appendChild(editBtn);
    row.appendChild(delBtn);

    li.appendChild(row);
    list.appendChild(li);
  }
}

renderList();