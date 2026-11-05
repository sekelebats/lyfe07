import sharp from 'sharp';
import { glob } from 'glob';
import yaml from 'js-yaml';
import fs from 'node:fs/promises';
import path from 'node:path';

const SIZES = [320, 480, 640, 768, 1024, 1280, 1920];
const FORMATS = [
  { ext: 'avif', opts: { quality: 55, effort: 4 } },
  { ext: 'webp', opts: { quality: 75, effort: 4 } },
];
const INPUT_DIR = 'images';
const PUBLIC_DIR = 'public';
const OUTPUT_DIR = path.join(PUBLIC_DIR, 'images');
const FONT_SRC = 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2';
const FONT_DEST = path.join(PUBLIC_DIR, 'fonts/inter.woff2');

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const icons = {
  images: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M18 22H4a2 2 0 0 1-2-2V6"/><path d="m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18"/><circle cx="12" cy="8" r="2"/><rect width="16" height="16" x="6" y="2" rx="2"/></svg>`,
  search: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  copy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
  chevronDown: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="m6 9 6 6 6-6"/></svg>`,
  imageOff: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-12 h-12"><line x1="2" x2="22" y1="2" y2="22"/><path d="M10.41 10.41a2 2 0 1 1-2.83-2.83"/><line x1="13.5" x2="6" y1="13.5" y2="21"/><line x1="18" x2="21" y1="12" y2="15"/><path d="M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.052-.22 1.41-.59"/><path d="M21 15V5a2 2 0 0 0-2-2H9"/></svg>`,
};

/* ─── Scan SEMUA file YAML + dump debug ─── */
async function getTitleMap() {
  const map = {};
  const debug = { yamlFiles: [], mapKeys: [], imageFiles: [] };

  // Scan recursive
  const yamlFiles = await glob('content/**/*.{yml,yaml,json}', { nodir: true });
  const imageFiles = await glob(`${INPUT_DIR}/**/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}`, { nodir: true });

  debug.yamlFilesCount = yamlFiles.length;
  debug.imageFilesCount = imageFiles.length;
  debug.imageFiles = imageFiles;

  for (const f of yamlFiles) {
    try {
      const raw = await fs.readFile(f, 'utf8');
      const data = f.endsWith('.json') ? JSON.parse(raw) : yaml.load(raw);

      debug.yamlFiles.push({ file: f, raw: raw.slice(0, 800), parsed: data });

      if (!data || typeof data !== 'object') continue;

      // Title: HANYA field ini. JANGAN pakai `name` (itu hash random dari Pages CMS).
      const title = data.title || data.caption || data.judul || data.alt;
      if (!title || typeof title !== 'string' || !title.trim()) continue;

      // Walk semua value, ambil yang mirip path gambar
      const paths = [];
      (function walk(obj) {
        if (!obj) return;
        if (typeof obj === 'string') {
          if (/\.(jpe?g|png|webp|avif|gif|svg)$/i.test(obj.trim())) paths.push(obj.trim());
          return;
        }
        if (Array.isArray(obj)) { obj.forEach(walk); return; }
        if (typeof obj === 'object') { Object.values(obj).forEach(walk); }
      })(data);

      for (const p of paths) {
        let clean = String(p).replace(/^\//, '').trim();
        try { clean = decodeURIComponent(clean); } catch {}
        const basename = path.basename(clean);

        map[clean] = title;
        map[basename] = title;
        map[`images/${basename}`] = title;
        map[clean.replace(/^images\//, '')] = title;
      }
    } catch (e) {
      debug.yamlFiles.push({ file: f, error: e.message });
    }
  }

  debug.mapKeys = Object.keys(map).map(k => ({ key: k, title: map[k] }));

  await fs.writeFile(path.join(PUBLIC_DIR, 'debug.json'), JSON.stringify(debug, null, 2));

  console.log(`\n🔍 DEBUG → /debug.json`);
  console.log(`   YAML files: ${yamlFiles.length}`);
  console.log(`   Image files: ${imageFiles.length}`);
  console.log(`   Caption entries: ${Object.keys(map).length}`);
  console.log(`\n📋 Sample map keys:`);
  Object.keys(map).slice(0, 10).forEach(k => console.log(`   "${k}" → "${map[k]}"`));

  return map;
}

async function processImage(file, titleMap) {
  const base = path.basename(file, path.extname(file));

  const title =
    titleMap[file] ||
    titleMap[path.basename(file)] ||
    titleMap[file.replace(/^images\//, '')] ||
    titleMap[`images/${path.basename(file)}`] ||
    base;

  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const outDir = path.join(OUTPUT_DIR, slug);
  await fs.mkdir(outDir, { recursive: true });

  const meta = await sharp(file).metadata();
  const variants = [];

  for (const size of SIZES) {
    if (size > meta.width) continue;
    for (const fmt of FORMATS) {
      const outPath = path.join(outDir, `${size}.${fmt.ext}`);
      await sharp(file).resize({ width: size, withoutEnlargement: true }).toFormat(fmt.ext, fmt.opts).toFile(outPath);
      const stat = await fs.stat(outPath);
      variants.push({ size, format: fmt.ext, url: `/images/${slug}/${size}.${fmt.ext}`, bytes: stat.size });
    }
  }

  await sharp(file).resize({ width: Math.min(1280, meta.width), withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(path.join(outDir, 'fallback.jpg'));

  return { slug, name: title, fallback: `/images/${slug}/fallback.jpg`, width: meta.width, height: meta.height, variants };
}

const buildSrcset = (variants, format) =>
  variants.filter(v => v.format === format).map(v => `${v.url} ${v.size}w`).join(', ');

const buildPicture = (img) => {
  const avif = buildSrcset(img.variants, 'avif');
  const webp = buildSrcset(img.variants, 'webp');
  const sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 800px';
  return `<picture>
  <source type="image/avif" srcset="${avif}" sizes="${sizes}">
  <source type="image/webp" srcset="${webp}" sizes="${sizes}">
  <img src="${img.fallback}" alt="${esc(img.name)}" loading="lazy" decoding="async" width="${img.width}" height="${img.height}">
</picture>`;
};

const fmtSize = (b) => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : b > 1024 ? (b / 1024).toFixed(0) + ' KB' : b + ' B';

function cardHtml(img) {
  const avifSrcset = buildSrcset(img.variants, 'avif');
  const webpSrcset = buildSrcset(img.variants, 'webp');
  const pictureHtml = buildPicture(img);

  const thumb = img.variants.find(v => v.size === 480 && v.format === 'avif')
             || img.variants.find(v => v.format === 'avif')
             || img.variants.find(v => v.format === 'webp')
             || { url: img.fallback };

  const sizePills = (format) =>
    SIZES.map(s => img.variants.find(v => v.size === s && v.format === format)).filter(Boolean)
      .map(v => `<button class="copy-btn inline-flex items-center rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent" data-copy="${esc(v.url)}">${v.size}w</button>`).join('');

  return `
  <article class="card group mb-6 break-inside-avoid overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:border-foreground/20 hover:shadow-lg">
    <div class="relative overflow-hidden bg-muted">
      <img src="${thumb.url}" alt="${esc(img.name)}" loading="lazy" decoding="async" width="${img.width}" height="${img.height}" class="block h-auto w-full transition-opacity duration-300 group-hover:opacity-95">
    </div>
    <div class="flex flex-col gap-3 p-5">
      <div class="flex flex-col gap-1.5">
        <h3 class="truncate text-sm font-semibold" title="${esc(img.name)}">${esc(img.name)}</h3>
        <p class="text-xs text-muted-foreground">${img.width} × ${img.height} · ${img.variants.length} varian</p>
      </div>
      <div class="flex flex-col gap-2.5">
        <button class="copy-btn inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90" data-copy="${esc(pictureHtml)}">${icons.copy}<span>Copy &lt;picture&gt;</span></button>
        <div class="grid grid-cols-2 gap-2">
          <button class="copy-btn inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent" data-copy="${esc(avifSrcset)}">AVIF srcset</button>
          <button class="copy-btn inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent" data-copy="${esc(webpSrcset)}">WebP srcset</button>
        </div>
        <details class="group text-xs text-muted-foreground">
          <summary class="flex cursor-pointer items-center justify-between rounded-md px-1 py-1 hover:text-foreground"><span>Ukuran individual</span><span class="transition-transform group-open:rotate-180">${icons.chevronDown}</span></summary>
          <div class="mt-3 flex flex-col gap-3">
            <div><div class="mb-1.5 text-[10px] uppercase tracking-wider font-semibold">AVIF</div><div class="flex flex-wrap gap-1.5">${sizePills('avif')}</div></div>
            <div><div class="mb-1.5 text-[10px] uppercase tracking-wider font-semibold">WebP</div><div class="flex flex-wrap gap-1.5">${sizePills('webp')}</div></div>
          </div>
        </details>
      </div>
    </div>
  </article>`;
}

async function generateGallery(images) {
  const cards = images.map(cardHtml).join('\n');
  const totalSize = images.reduce((sum, img) => sum + img.variants.reduce((s, v) => s + v.bytes, 0), 0);

  const bodyContent = images.length === 0 ? `
    <div class="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
      <div class="mb-4 opacity-40">${icons.imageOff}</div>
      <h2 class="text-lg font-semibold text-foreground">Belum ada gambar</h2>
    </div>` : `
    <div class="columns-1 gap-6 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5" id="grid">${cards}</div>`;

  const html = `<!DOCTYPE html>
<html lang="id"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FZH Assets · Image Library</title>
<link rel="stylesheet" href="/app.css">
</head><body>
<header class="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
  <div class="mx-auto flex max-w-7xl items-center gap-3 px-5 py-4 sm:px-6">
    <a href="/" class="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-foreground">
      <span class="text-primary">${icons.images}</span><span>FZH <span class="text-primary">Assets</span></span>
    </a>
    <div class="ml-auto flex items-center gap-2 sm:flex-1 sm:justify-end">
      <div class="hidden items-center gap-3 text-xs text-muted-foreground md:flex">
        <span><b class="text-foreground">${images.length}</b> gambar</span><span class="text-border">·</span><span><b class="text-foreground">${fmtSize(totalSize)}</b> varian</span>
      </div>
      <div class="relative sm:w-full sm:max-w-md">
        <button type="button" id="searchToggle" class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-secondary text-muted-foreground transition-colors hover:bg-accent sm:hidden" aria-label="Cari">${icons.search}</button>
        <div id="searchWrap" class="absolute right-0 top-full z-50 mt-2 hidden w-72 rounded-md border border-border bg-background p-1 shadow-lg sm:static sm:mt-0 sm:block sm:w-full sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
          <div class="relative">
            <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">${icons.search}</span>
            <input type="search" id="search" placeholder="Cari..." autocomplete="off" class="w-full rounded-md border border-border bg-secondary px-3 py-2.5 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:bg-background focus:outline-none focus:ring-1 focus:ring-foreground">
          </div>
        </div>
      </div>
    </div>
  </div>
</header>
<main class="mx-auto max-w-7xl px-5 py-7 sm:px-6 sm:py-8 md:py-10">${bodyContent}</main>
<div class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 translate-y-20 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground opacity-0 shadow-lg transition-all duration-300" id="toast"></div>
<script>
(function(){
  var toggle=document.getElementById('searchToggle'),wrap=document.getElementById('searchWrap');
  if(toggle&&wrap){toggle.addEventListener('click',function(e){e.stopPropagation();wrap.classList.toggle('hidden')});document.addEventListener('click',function(e){if(window.innerWidth<640&&wrap&&!wrap.classList.contains('hidden')&&!wrap.contains(e.target)&&e.target!==toggle)wrap.classList.add('hidden')})}
  var toast=document.getElementById('toast'),t;
  function showToast(msg){toast.textContent=msg||'✓ Copied!';toast.classList.remove('translate-y-20','opacity-0');clearTimeout(t);t=setTimeout(function(){toast.classList.add('translate-y-20','opacity-0')},1500)}
  function copy(text,el){navigator.clipboard.writeText(text).then(function(){if(el){var o=el.innerHTML;el.innerHTML='<span>✓ Copied!</span>';el.classList.add('copied');setTimeout(function(){el.innerHTML=o;el.classList.remove('copied')},1200)}showToast()}).catch(function(){showToast('❌ Gagal')})}
  document.querySelectorAll('.copy-btn').forEach(function(b){b.addEventListener('click',function(e){e.stopPropagation();copy(b.dataset.copy,b)})});
  var s=document.getElementById('search');
  if(s){s.addEventListener('input',function(e){var q=e.target.value.trim().toLowerCase();document.querySelectorAll('.card').forEach(function(c){var n=c.querySelector('h3').textContent.toLowerCase();c.style.display=n.indexOf(q)!==-1?'':'none'})})}
})();
</script>
</body></html>`;

  await fs.writeFile(path.join(PUBLIC_DIR, 'index.html'), html);
}

async function copyFont() {
  await fs.mkdir(path.join(PUBLIC_DIR, 'fonts'), { recursive: true });
  try { await fs.copyFile(FONT_SRC, FONT_DEST); } catch { console.warn('⚠️ Font missing'); }
}

async function main() {
  await fs.mkdir(PUBLIC_DIR, { recursive: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await copyFont();

  const titleMap = await getTitleMap();
  const files = await glob(`${INPUT_DIR}/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}`, { nodir: true });

  if (files.length === 0) {
    console.log('⚠️ No images');
    await generateGallery([]);
    return;
  }

  const images = [];
  for (const file of files) {
    const caption = titleMap[file] || titleMap[path.basename(file)] || '—';
    console.log(`  → ${path.basename(file)} → "${caption}"`);
    images.push(await processImage(file, titleMap));
  }
  await generateGallery(images);
  await fs.writeFile(path.join(PUBLIC_DIR, 'manifest.json'), JSON.stringify(images, null, 2));
  console.log(`\n✅ ${images.length} gambar processed\n`);
}

main().catch(err => { console.error(err); process.exit(1); });