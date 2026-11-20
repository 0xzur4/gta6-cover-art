// Fixed scenes for screenshots: ?shot=editor shows the full editor with a sample
// photo loaded; ?shot=cover shows the cover alone, edge to edge, for the cover shot.
// Query keys: photo (pier|boulevard), caption, subtitle, layout, grade, size.
// window.__shotReady is set once the cover is painted with fonts loaded.
export async function runShot(shot, query, apply) {
  const photo = query.get('photo') ?? 'pier';
  const state = {
    title: query.get('caption') ?? 'Neon Palms',
    subtitle: query.get('subtitle') ?? 'Vice City nights',
    layout: query.get('layout') ?? 'hero3',
    grade: query.get('grade') ?? 'neon',
    size: query.get('size') ?? 'wide',
  };
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await apply(`samples/${photo}.jpg`, state);
  await document.fonts.load('80px Anton');
  await document.fonts.load('40px Pacifico');
  await document.fonts.ready;
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
