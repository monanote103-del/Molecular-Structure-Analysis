const $ = (sel) => document.querySelector(sel);

const state = {
  molBlock: null,
  pdbBlock: null,
  isPeptide: false,
  viewer: null,
  spinning: false,
};

function setStatus(msg, kind = "") {
  const el = $("#status");
  el.textContent = msg;
  el.className = "status" + (kind ? " " + kind : "");
}

function activeTab() {
  return document.querySelector(".tab.active").dataset.tab;
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.tab === name),
  );
  document.querySelectorAll(".tab-panel").forEach((p) =>
    p.classList.toggle("active", p.dataset.panel === name),
  );
}

document.querySelectorAll(".tab").forEach((t) => {
  t.addEventListener("click", () => switchTab(t.dataset.tab));
});

document.querySelectorAll(".ex").forEach((b) => {
  b.addEventListener("click", () => {
    $("#smiles-input").value = b.dataset.smiles;
    switchTab("smiles");
  });
});

document.body.addEventListener("click", (e) => {
  const btn = e.target.closest(".aa-btn");
  if (btn) appendAA(btn.dataset.aa);
});

function updateSeqMeta() {
  const seq = $("#peptide-input").value.replace(/[^A-Za-z]/g, "").toUpperCase();
  $("#peptide-length").textContent = `${seq.length} residue${seq.length === 1 ? "" : "s"}`;
}

function appendAA(code) {
  const input = $("#peptide-input");
  input.value = (input.value + code).toUpperCase();
  updateSeqMeta();
  input.focus();
}

$("#peptide-input")?.addEventListener("input", (e) => {
  e.target.value = e.target.value.toUpperCase();
  updateSeqMeta();
});

$("#peptide-backspace")?.addEventListener("click", () => {
  const input = $("#peptide-input");
  input.value = input.value.slice(0, -1);
  updateSeqMeta();
});

$("#peptide-clear")?.addEventListener("click", () => {
  $("#peptide-input").value = "";
  updateSeqMeta();
});

document.querySelectorAll(".ex-pep").forEach((b) => {
  b.addEventListener("click", () => {
    $("#peptide-input").value = b.dataset.seq;
    updateSeqMeta();
  });
});

function initViewer() {
  if (state.viewer) return state.viewer;
  state.viewer = $3Dmol.createViewer("viewer", { backgroundColor: "black" });
  return state.viewer;
}

function applyStyle() {
  const v = state.viewer;
  if (!v) return;
  const style = $("#style-select").value;
  v.setStyle({}, {});
  if (style === "stick") v.setStyle({}, { stick: { radius: 0.15 } });
  else if (style === "ball") v.setStyle({}, { stick: { radius: 0.12 }, sphere: { scale: 0.28 } });
  else if (style === "sphere") v.setStyle({}, { sphere: { scale: 1.0 } });
  else if (style === "line") v.setStyle({}, { line: { linewidth: 2 } });
  if ($("#show-labels").checked) {
    v.removeAllLabels();
    v.getModel().selectedAtoms({}).forEach((a) => {
      v.addLabel(a.elem, {
        position: { x: a.x, y: a.y, z: a.z },
        fontSize: 10,
        backgroundOpacity: 0,
        fontColor: "white",
      });
    });
  } else {
    v.removeAllLabels();
  }
  v.render();
}

function showMolecule(data) {
  state.molBlock = data.mol_block;
  state.pdbBlock = data.pdb_block || null;
  state.isPeptide = !!data.pdb_block;
  const v = initViewer();
  v.removeAllModels();
  v.removeAllLabels();
  if (state.isPeptide) {
    v.addModel(state.pdbBlock, "pdb");
  } else {
    v.addModel(state.molBlock, "mol");
  }
  applyStyle();
  v.zoomTo();
  v.render();
  const dl = $("#download-btn");
  dl.disabled = false;
  dl.textContent = state.isPeptide ? "Download .pdb" : "Download .mol";
}

function fillInfo(data) {
  $("#info-name").textContent = data.name || "—";
  $("#info-formula").textContent = data.formula;
  $("#info-mw").textContent = data.mol_weight + " g/mol";
  $("#info-atoms").textContent = data.num_atoms;
  $("#info-heavy").textContent = data.num_heavy_atoms;
  $("#info-rings").textContent = data.num_rings;
  $("#info-smiles").textContent = data.smiles;
  const seqRow = $("#info-seq-row");
  if (data.sequence) {
    seqRow.hidden = false;
    $("#info-seq").textContent = `${data.sequence} (${data.residues} residues)`;
  } else {
    seqRow.hidden = true;
  }
}

async function build() {
  const tab = activeTab();
  let url, body;
  if (tab === "smiles") {
    const smiles = $("#smiles-input").value.trim();
    if (!smiles) return setStatus("Enter a SMILES.", "error");
    url = "/api/from-smiles";
    body = { smiles };
  } else if (tab === "name") {
    const name = $("#name-input").value.trim();
    if (!name) return setStatus("Enter a compound name.", "error");
    url = "/api/from-name";
    body = { name };
  } else if (tab === "mol") {
    const mol_block = $("#mol-input").value;
    if (!mol_block.trim()) return setStatus("Paste a MOL/SDF block.", "error");
    url = "/api/from-mol";
    body = { mol_block };
  } else {
    const sequence = $("#peptide-input").value.trim();
    if (!sequence) return setStatus("Add at least one amino acid.", "error");
    url = "/api/from-peptide";
    body = { sequence };
  }

  setStatus("Building…");
  $("#build-btn").disabled = true;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`);
    showMolecule(data);
    fillInfo(data);
    setStatus("Built " + data.formula, "ok");
  } catch (e) {
    setStatus("Error: " + e.message, "error");
  } finally {
    $("#build-btn").disabled = false;
  }
}

$("#build-btn").addEventListener("click", build);

document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") build();
});

$("#style-select").addEventListener("change", applyStyle);
$("#show-labels").addEventListener("change", applyStyle);

$("#spin").addEventListener("change", (e) => {
  if (!state.viewer) return;
  if (e.target.checked) state.viewer.spin("y");
  else state.viewer.spin(false);
});

$("#download-btn").addEventListener("click", () => {
  const usePdb = state.isPeptide && state.pdbBlock;
  const content = usePdb ? state.pdbBlock : state.molBlock;
  if (!content) return;
  const blob = new Blob([content], {
    type: usePdb ? "chemical/x-pdb" : "chemical/x-mdl-molfile",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = usePdb ? "peptide.pdb" : "molecule.mol";
  a.click();
  URL.revokeObjectURL(url);
});


initViewer();
