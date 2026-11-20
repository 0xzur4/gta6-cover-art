// Renders the cover: a multi-panel photo layout, a colour grade, grain, vignette and
// bold caption lettering. Plain Canvas 2D only; the editor in main.js keeps the state
// and calls drawCover(canvas, state, opts) whenever it changes.

export const SIZES = {
  square: { w: 1080, h: 1080, label: 'Square 1080 x 1080' },
  portrait: { w: 1080, h: 1350, label: 'Portrait 1080 x 1350' },
  wide: { w: 1920, h: 1080, label: 'Wide 1920 x 1080' },
};

export const LAYOUTS = {
  grid4: { panels: 4, label: '2 x 2 grid' },
  hero3: { panels: 4, label: 'Hero + 3' },
  full: { panels: 1, label: 'Full bleed' },
  grid9: { panels: 9, label: '3 x 3 grid' },
};

export const GRADES = {
  sunset: { label: 'Sunset', filter: 'saturate(1.35) contrast(1.07) brightness(1.02)' },
  neon: { label: 'Neon', filter: 'saturate(1.5) contrast(1.12) brightness(1.0)' },
  vice: { label: 'Vice', filter: 'saturate(1.25) contrast(1.06) brightness(1.0)' },
  noir: { label: 'Noir', filter: 'grayscale(1) contrast(1.28) brightness(1.06)' },
};

// Gradient overlays a grade paints over each photo, as [stops, blend, alpha].
// Stops are [offset, color] along a diagonal from the top-left corner.
function gradeOverlays(grade) {
  if (grade === 'sunset') return [
    { stops: [[0, '#ffb347'], [0.55, '#ff5e62'], [1, '#c2187a']], blend: 'soft-light', alpha: 0.75 },
    { stops: [[0, 'rgba(255,120,40,0)'], [1, 'rgba(255,60,20,0.28)']], blend: 'overlay', alpha: 1 },
  ];
  if (grade === 'neon') return [
    { stops: [[0, '#ff2fb3'], [0.5, '#7a2bff'], [1, '#00e5ff']], blend: 'overlay', alpha: 0.55 },
    { stops: [[0, 'rgba(0,229,255,0.22)'], [1, 'rgba(255,47,179,0.22)']], blend: 'soft-light', alpha: 1 },
  ];
  if (grade === 'vice') return [
    { stops: [[0, '#8b2ff7'], [0.55, '#3d2b8f'], [1, '#12d6c8']], blend: 'soft-light', alpha: 0.8 },
    { stops: [[0, 'rgba(139,47,247,0.18)'], [1, 'rgba(18,214,200,0.18)']], blend: 'overlay', alpha: 1 },
  ];
  return [ // noir
    { stops: [[0, 'rgba(255,255,255,0.10)'], [1, 'rgba(0,0,0,0.25)']], blend: 'soft-light', alpha: 1 },
  ];
}

/** Panel rectangles for a layout inside a W x H cover. Gutters are thin dark seams. */
export function panelRects(layout, w, h) {
  const g = Math.max(4, Math.round(Math.min(w, h) * 0.008)); // gutter
  if (layout === 'full') return [{ x: 0, y: 0, w, h }];
  if (layout === 'grid4') {
    const cw = (w - g) / 2, ch = (h - g) / 2;
    return [
      { x: 0, y: 0, w: cw, h: ch }, { x: cw + g, y: 0, w: cw, h: ch },
      { x: 0, y: ch + g, w: cw, h: ch }, { x: cw + g, y: ch + g, w: cw, h: ch },
    ];
  }
  if (layout === 'hero3') {
    const heroW = Math.round(w * 0.62), sideW = w - heroW - g, sh = (h - 2 * g) / 3;
    return [
      { x: 0, y: 0, w: heroW, h },
      { x: heroW + g, y: 0, w: sideW, h: sh },
      { x: heroW + g, y: sh + g, w: sideW, h: sh },
      { x: heroW + g, y: 2 * (sh + g), w: sideW, h: sh },
    ];
  }
  // grid9
  const cw = (w - 2 * g) / 3, ch = (h - 2 * g) / 3, out = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    out.push({ x: c * (cw + g), y: r * (ch + g), w: cw, h: ch });
  }
  return out;
}

/** Which panel (index) holds point (x, y) in cover pixels, or -1. */
export function panelAt(layout, w, h, x, y) {
  const rects = panelRects(layout, w, h);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
  }
  return -1;
}

let grainPattern = null;
function getGrain(ctx) {
  if (grainPattern) return grainPattern;
  const n = document.createElement('canvas');
  n.width = 140; n.height = 140;
  const c = n.getContext('2d');
  const img = c.createImageData(140, 140);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 118 + Math.floor(Math.random() * 40);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  grainPattern = ctx.createPattern(n, 'repeat');
  return grainPattern;
}

/** Where a photo lands inside a panel rect: cover-fit with the panel's zoom and
 *  pan, clamped so the photo always covers the whole panel (no dark strips). */
function photoPlacement(photo, rect, panel) {
  const base = Math.max(rect.w / photo.naturalWidth, rect.h / photo.naturalHeight);
  const scale = base * (panel.zoom || 1);
  const pw = photo.naturalWidth * scale, ph = photo.naturalHeight * scale;
  let cx = rect.x + rect.w / 2 - (panel.px ?? 0.5) * pw;
  let cy = rect.y + rect.h / 2 - (panel.py ?? 0.5) * ph;
  if (pw >= rect.w) cx = Math.min(rect.x, Math.max(rect.x + rect.w - pw, cx));
  else cx = rect.x + (rect.w - pw) / 2;
  if (ph >= rect.h) cy = Math.min(rect.y, Math.max(rect.y + rect.h - ph, cy));
  else cy = rect.y + (rect.h - ph) / 2;
  return { cx, cy, pw, ph };
}

/** Draws one photo into a panel rect, cover-fit, with the panel's zoom and pan. */
function drawPanelPhoto(ctx, photo, rect, panel, grade) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (photo) {
    const { cx, cy, pw, ph } = photoPlacement(photo, rect, panel);
    ctx.filter = GRADES[grade]?.filter ?? 'none';
    ctx.drawImage(photo, cx, cy, pw, ph);
    ctx.filter = 'none';
  } else {
    ctx.fillStyle = '#241a33';
    ctx.fillRect(x, y, w, h);
  }
  // Grade overlays, clipped to the panel.
  for (const o of gradeOverlays(grade)) {
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    for (const [off, col] of o.stops) grad.addColorStop(off, col);
    ctx.globalCompositeOperation = o.blend;
    ctx.globalAlpha = o.alpha;
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Bold title, neon script subtitle and tagline along the foot of the cover. */
function drawLettering(ctx, w, h, state) {
  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim();
  const tagline = (state.tagline || '').trim();
  if (!title && !subtitle && !tagline) return;

  // Dark scrim so the words read over any photo.
  const scrimH = h * (title ? 0.3 : 0.16);
  const scrim = ctx.createLinearGradient(0, h - scrimH, 0, h);
  scrim.addColorStop(0, 'rgba(8,4,16,0)');
  scrim.addColorStop(1, 'rgba(8,4,16,0.82)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h - scrimH, w, h * 0.3);

  const pad = w * 0.045;
  const maxW = w - pad * 2;
  const scale = state.titleScale ?? 1;
  if (title) {
    let size = Math.round(h * 0.105 * scale);
    ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
    while (ctx.measureText(title).width > maxW && size > 24) {
      size -= 2;
      ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
    }
    const ty = h - h * 0.055;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    if (state.titleStyle === 'outline') {
      ctx.lineWidth = Math.max(2, size * 0.09);
      ctx.strokeStyle = state.titleColor || '#ffffff';
      ctx.strokeText(title, pad, ty);
    } else {
      if (state.titleStyle === 'neon') {
        ctx.shadowColor = '#ff2fb3';
        ctx.shadowBlur = size * 0.45;
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = size * 0.16;
      }
      ctx.lineWidth = Math.max(2, size * 0.07);
      ctx.strokeStyle = 'rgba(10,4,18,0.9)';
      ctx.strokeText(title, pad, ty);
      ctx.fillStyle = state.titleColor || '#ffffff';
      ctx.fillText(title, pad, ty);
      ctx.shadowBlur = 0;
    }
    if (subtitle) {
      const ss = Math.round(size * 0.52);
      ctx.font = `${ss}px Pacifico, cursive`;
      ctx.fillStyle = '#ffd166';
      ctx.shadowColor = '#ff2fb3';
      ctx.shadowBlur = ss * 0.5;
      ctx.fillText(subtitle, pad + size * 0.06, ty - size * 1.02);
      ctx.shadowBlur = 0;
    }
  } else if (subtitle) {
    const ss = Math.round(h * 0.05 * scale);
    ctx.font = `${ss}px Pacifico, cursive`;
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = '#ff2fb3';
    ctx.shadowBlur = ss * 0.5;
    ctx.textAlign = 'left';
    ctx.fillText(subtitle, pad, h - h * 0.06);
    ctx.shadowBlur = 0;
  }
  if (tagline) {
    const ts = Math.max(13, Math.round(h * 0.016));
    ctx.font = `600 ${ts}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'left';
    // Letter-spaced small caps, drawn manually.
    let tx = pad;
    const ty = h - h * 0.018;
    for (const ch of tagline.toUpperCase()) {
      ctx.fillText(ch, tx, ty);
      tx += ctx.measureText(ch).width + ts * 0.28;
    }
  }
}

/**
 * Draws the whole cover onto `canvas` from `state`.
 * state: { size, layout, grade, gradeStrength, grain, vignette, title, subtitle,
 *   tagline, titleColor, titleStyle, titleScale, photos: [Image], panels: [{photo, zoom, px, py}] }
 * opts: { select: panel index to outline in the preview, or -1 }
 */
export function drawCover(canvas, state, opts = {}) {
  const size = SIZES[state.size] ?? SIZES.square;
  const w = size.w, h = size.h;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0d0a14';
  ctx.fillRect(0, 0, w, h);
  const rects = panelRects(state.layout, w, h);
  const strength = state.gradeStrength ?? 0.85;
  const panels = state.panels ?? [];
  rects.forEach((rect, i) => {
    const panel = panels[i] ?? { photo: 0, zoom: 1, px: 0.5, py: 0.5 };
    const photo = (state.photos ?? [])[panel.photo] ?? null;
    // Grade strength: draw the photo twice — graded, then the raw photo on top
    // at (1 - strength) so 0 keeps the photo untouched.
    ctx.save();
    ctx.globalAlpha = 1;
    drawPanelPhoto(ctx, photo, rect, panel, state.grade);
    if (strength < 1 && photo) {
      ctx.globalAlpha = 1 - strength;
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
      ctx.clip();
      const { cx, cy, pw, ph } = photoPlacement(photo, rect, panel);
      ctx.drawImage(photo, cx, cy, pw, ph);
    }
    ctx.restore();
  });
  // Selection outline, preview only.
  if (opts.select != null && opts.select >= 0 && rects[opts.select]) {
    const r = rects[opts.select];
    ctx.save();
    ctx.lineWidth = Math.max(3, w * 0.004);
    ctx.strokeStyle = '#00e5ff';
    ctx.setLineDash([w * 0.02, w * 0.012]);
    ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
    ctx.restore();
  }
  if (state.grain) {
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = getGrain(ctx);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  if (state.vignette) {
    const v = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
  drawLettering(ctx, w, h, state);
}
