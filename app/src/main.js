// Neon Palms Cover Studio — wires the editor: photos, layouts, grades, lettering,
// undo/redo, live preview and PNG export in all three post sizes.
// State is plain data (photos are Image objects kept beside it); history stores
// snapshots of the serialisable part so undo/redo never touches the photo list.
import { drawCover, panelAt, panelRects, SIZES, LAYOUTS, GRADES } from './cover.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const statusEl = $('status');

const SAMPLE_PHOTOS = [
  { name: 'Pier dusk', src: 'samples/pier.jpg' },
  { name: 'Boulevard', src: 'samples/boulevard.jpg' },
];

/** A fresh state: four panels over two photos, hero layout, neon grade. */
function freshState() {
  return {
    size: 'square',
    layout: 'hero3',
    grade: 'neon',
    gradeStrength: 0.85,
    grain: true,
    vignette: true,
    title: 'NEON PALMS',
    subtitle: 'Vice City nights',
    tagline: 'A STORY IN EVERY FRAME',
    titleColor: '#ffffff',
    titleStyle: 'solid',
    titleScale: 1,
    photos: [],
    panels: [
      { photo: 0, zoom: 1, px: 0.5, py: 0.42 },
      { photo: 1, zoom: 1.15, px: 0.5, py: 0.5 },
      { photo: 0, zoom: 1.35, px: 0.28, py: 0.5 },
      { photo: 1, zoom: 1.3, px: 0.72, py: 0.45 },
    ],
  };
}

let state = freshState();
let selected = 0;
let history = [];
let future = [];

function snapshot() {
  const { photos, ...rest } = state;
  return JSON.parse(JSON.stringify(rest));
}

function restore(snap) {
  const photos = state.photos;
  state = { ...JSON.parse(JSON.stringify(snap)), photos };
  selected = Math.min(selected, (state.panels?.length ?? 1) - 1);
  syncControls();
  redraw();
}

function commit() {
  history.push(snapshot());
  if (history.length > 60) history.shift();
  future = [];
  updateUndoButtons();
}

function undo() {
  if (!history.length) return;
  future.push(snapshot());
  restore(history.pop());
  updateUndoButtons();
}

function redo() {
  if (!future.length) return;
  history.push(snapshot());
  restore(future.pop());
  updateUndoButtons();
}

function updateUndoButtons() {
  $('undo').disabled = !history.length;
  $('redo').disabled = !future.length;
}

/** Panels for the current layout, keeping the old ones where they still fit. */
function panelsFor(layout) {
  const n = LAYOUTS[layout].panels;
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(state.panels[i] ?? { photo: i % Math.max(1, state.photos.length), zoom: 1, px: 0.5, py: 0.5 });
  }
  return out;
}

function redraw() {
  // The cover shot shows the art alone: no selection outline in shot-cover mode.
  const select = document.body.classList.contains('shot-cover') ? -1 : selected;
  drawCover(canvas, state, { select });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function setStatus(text) {
  statusEl.textContent = text;
}

/** Rebuilds the photo thumbnails and the panel's photo picker from state. */
function syncPhotoList() {
  const list = $('photoList');
  list.innerHTML = '';
  state.photos.forEach((img, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    b.title = img.dataset.name || `Photo ${i + 1}`;
    const t = document.createElement('img');
    t.src = img.src;
    t.alt = b.title;
    b.appendChild(t);
    const n = document.createElement('span');
    n.textContent = `${i + 1}`;
    b.appendChild(n);
    b.addEventListener('click', () => {
      commit();
      state.panels[selected] = { ...state.panels[selected], photo: i };
      syncPanelControls();
      redraw();
    });
    list.appendChild(b);
  });
  const pick = $('panelPhoto');
  pick.innerHTML = '';
  state.photos.forEach((img, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = `Photo ${i + 1} — ${img.dataset.name || 'uploaded'}`;
    pick.appendChild(o);
  });
  pick.value = String(state.panels[selected]?.photo ?? 0);
}

function syncPanelControls() {
  const p = state.panels[selected] ?? { photo: 0, zoom: 1, px: 0.5, py: 0.5 };
  $('panelPhoto').value = String(p.photo ?? 0);
  $('zoom').value = String(p.zoom ?? 1);
  $('panX').value = String((p.px ?? 0.5) * 100);
  $('panY').value = String((p.py ?? 0.5) * 100);
  $('panelLabel').textContent = `Panel ${selected + 1} of ${state.panels.length}`;
}

function syncControls() {
  for (const [key, group] of [['layout', 'layout'], ['grade', 'grade'], ['size', 'size']]) {
    document.querySelectorAll(`[data-group="${group}"]`).forEach((b) => {
      b.classList.toggle('active', b.dataset.value === state[key]);
    });
  }
  $('title').value = state.title;
  $('subtitle').value = state.subtitle;
  $('tagline').value = state.tagline;
  $('gradeStrength').value = String(state.gradeStrength);
  $('titleScale').value = String(state.titleScale);
  $('grain').checked = state.grain;
  $('vignette').checked = state.vignette;
  document.querySelectorAll('[data-title-color]').forEach((b) => {
    b.classList.toggle('active', b.dataset.titleColor === state.titleColor);
  });
  document.querySelectorAll('[data-title-style]').forEach((b) => {
    b.classList.toggle('active', b.dataset.titleStyle === state.titleStyle);
  });
  syncPhotoList();
  syncPanelControls();
}

function bindGroup(group, key, after) {
  document.querySelectorAll(`[data-group="${group}"]`).forEach((b) => {
    b.addEventListener('click', () => {
      if (state[key] === b.dataset.value) return;
      commit();
      state[key] = b.dataset.value;
      if (key === 'layout') {
        state.panels = panelsFor(b.dataset.value);
        selected = 0;
      }
      if (after) after();
      syncControls();
      redraw();
    });
  });
}

bindGroup('layout', 'layout');
bindGroup('grade', 'grade');
bindGroup('size', 'size');

$('panelPhoto').addEventListener('change', (e) => {
  commit();
  state.panels[selected] = { ...state.panels[selected], photo: Number(e.target.value) };
  redraw();
});

function bindPanelSlider(id, apply) {
  const el = $(id);
  el.addEventListener('input', () => {
    apply(Number(el.value));
    redraw();
  });
  el.addEventListener('change', () => commit());
}
bindPanelSlider('zoom', (v) => { state.panels[selected].zoom = v / 100; });
bindPanelSlider('panX', (v) => { state.panels[selected].px = v / 100; });
bindPanelSlider('panY', (v) => { state.panels[selected].py = v / 100; });

$('fillAll').addEventListener('click', () => {
  commit();
  const p = state.panels[selected];
  state.panels = state.panels.map((q, i) => ({ ...q, photo: p.photo, zoom: i === selected ? q.zoom : 1.15, px: 0.5, py: 0.5 }));
  redraw();
  setStatus('All panels now use the same photo, each with its own crop.');
});

bindPanelSlider('gradeStrength', (v) => { state.gradeStrength = v / 100; });
bindPanelSlider('titleScale', (v) => { state.titleScale = v / 100; });

for (const id of ['title', 'subtitle', 'tagline']) {
  $(id).addEventListener('input', (e) => {
    state[id] = e.target.value;
    redraw();
  });
  $(id).addEventListener('change', () => commit());
}

document.querySelectorAll('[data-title-color]').forEach((b) => {
  b.addEventListener('click', () => {
    commit();
    state.titleColor = b.dataset.titleColor;
    syncControls();
    redraw();
  });
});
document.querySelectorAll('[data-title-style]').forEach((b) => {
  b.addEventListener('click', () => {
    commit();
    state.titleStyle = b.dataset.titleStyle;
    syncControls();
    redraw();
  });
});

$('grain').addEventListener('change', (e) => { commit(); state.grain = e.target.checked; redraw(); });
$('vignette').addEventListener('change', (e) => { commit(); state.vignette = e.target.checked; redraw(); });

$('undo').addEventListener('click', undo);
$('redo').addEventListener('click', redo);
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
});

// Click a panel to select it; drag it to pan the photo, wheel to zoom it.
let drag = null;
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width / r.width),
    y: (e.clientY - r.top) * (canvas.height / r.height),
  };
}
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const i = panelAt(state.layout, canvas.width, canvas.height, p.x, p.y);
  if (i < 0) return;
  selected = i;
  syncPanelControls();
  redraw();
  const panel = state.panels[i];
  drag = { x: p.x, y: p.y, px: panel.px, py: panel.py, moved: false };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const panel = state.panels[selected];
  const rect = panelRects(state.layout, canvas.width, canvas.height)[selected];
  const dx = (p.x - drag.x) / rect.w, dy = (p.y - drag.y) / rect.h;
  if (Math.abs(dx) + Math.abs(dy) > 0.004) drag.moved = true;
  panel.px = Math.min(1.2, Math.max(-0.2, drag.px - dx));
  panel.py = Math.min(1.2, Math.max(-0.2, drag.py - dy));
  syncPanelControls();
  redraw();
});
canvas.addEventListener('pointerup', () => {
  if (drag?.moved) commit();
  drag = null;
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[selected];
  panel.zoom = Math.min(3, Math.max(0.6, panel.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
  syncPanelControls();
  redraw();
}, { passive: false });

$('addPhotos').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    if (!file.type.startsWith('image/')) continue;
    const img = await loadImage(URL.createObjectURL(file));
    img.dataset.name = file.name.replace(/\.[^.]+$/, '');
    commit();
    state.photos.push(img);
    syncPhotoList();
  }
  redraw();
  e.target.value = '';
});

/** Renders `size` at full export resolution and downloads it as a PNG. */
async function exportSize(key) {
  const size = SIZES[key];
  const prev = state.size;
  state.size = key;
  drawCover(canvas, state, { select: -1 });
  const name = `neon-palms-${size.w}x${size.h}.png`;
  await new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      resolve();
    }, 'image/png');
  });
  state.size = prev;
  redraw();
  return name;
}

$('exportOne').addEventListener('click', async () => {
  const name = await exportSize(state.size);
  setStatus(`Saved ${name}`);
});
$('exportAll').addEventListener('click', async () => {
  const names = [];
  for (const key of Object.keys(SIZES)) names.push(await exportSize(key));
  setStatus(`Saved ${names.join(', ')}`);
});

/** Loads the starter samples as the first two photos, then starts the editor. */
async function init() {
  await document.fonts.load('80px Anton');
  await document.fonts.load('40px Pacifico');
  for (const s of SAMPLE_PHOTOS) {
    const img = await loadImage(s.src);
    img.dataset.name = s.name;
    state.photos.push(img);
  }
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot) {
    await runShot(shot, new URLSearchParams(location.search), async (sample, shotState) => {
      const img = await loadImage(sample);
      img.dataset.name = 'Sample';
      state.photos = [img, ...state.photos.slice(1)];
      Object.assign(state, shotState);
      state.panels = panelsFor(state.layout);
      state.panels[0] = { photo: 0, zoom: 1.05, px: 0.5, py: 0.42 };
      syncControls();
      redraw();
    });
  } else {
    syncControls();
    redraw();
  }
  updateUndoButtons();
}

init().catch((err) => setStatus(`Could not start: ${err.message}`));
