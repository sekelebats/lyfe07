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

/* ─── Title Map — VERBOSE LOG biar ketahuan salahnya di mana ─── */
async function getTitleMap() {
  const map = {};
  const files = await glob('content/gallery/*.{yml,yaml}', { nodir: true });

  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`📂 Membaca ${files.length} file YAML di content/gallery/`);
  console.log(`═══════════════════════════════════════════════\n`);

  if (files.length === 0) {
    console.log(`⚠️  Tidak ada file YAML. Kemungkinan:`);
    console.log(`   - path di .pages.yml bukan "content/gallery"`);
    console.log(`   - belum ada entry yang disimpan lewat Pages CMS`);
    console.log(`   - Pages CMS simpan di folder lain\n`);
    return map;
  }

  for (const f of files) {
    try {
      const data = yaml.load(await fs.readFile(f, 'utf8'));
      const fname = path.basename(f);

      if (!data || typeof data !== 'object') {
        console.log(`  ⚠️  ${fname}: file kosong / bukan object`);
        continue;
      }

      if (!data.title) {
        console.log(`  ⚠️  ${fname}: TIDAK ADA field "title"`);
        console.log(`     Field yang ada: ${Object.keys(data).join(', ')}`);
        continue;
      }

      // Cari field gambar dengan nama apapun yang umum
      let imgs = null;
      let fieldName = null;
      for (const key of ['photos', 'images', 'image', 'foto', 'gambar', 'files', 'media']) {
        if (data[key] !== undefined && data[key] !== null) {
          fieldName = key;
          imgs = Array.isArray(data[key]) ? data[key] : [data[key]];
          break;
        }
      }

      if (!imgs) {
        console.log(`  ⚠️  ${fname}: title ada ("${data.title}") tapi field gambar TIDAK ADA`);
        console.log(`     Field yang ada: ${Object.keys(data).join(', ')}`);
        continue;
      }

      console.log(`  📄 ${fname}`);
      console.log(`     title: "${data.title}"`);
      console.log(`     field gambar: "${fieldName}" (${imgs.length} item)`);

      for (const item of imgs) {
        let p = null;
        if (typeof item === 'string') {
          p = item;
        } else if (item && typeof item === 'object') {
          p = item.path || item.src || item.url || item.image || item.file;
        }

        if (!p) {
          console.log(`     ⚠️  Item bukan string/object path: ${JSON.stringify(item).slice(0, 120)}`);
          continue;
        }

        // Simpan dengan berbagai format key untuk robust matching
        const clean = String(p).replace(/^\//, '');
        map[clean] = data.title;                              // images/xxx.png
        map[path.basename(clean)] = data.title;               // xxx.png
        map[clean.replace(/^images\//, '')] = data.title;     // xxx.png (tanpa prefix)
        console.log(`     ✓ ${clean} → "${data.title}"`);
      }
    } catch (e) {
      console.warn(`  ❌ ${path.basename(f)}: ${e.message}`);
    }
  }

  console.log(`\n🗂️  Total: ${Object.keys(map).length} entri caption ter-map\n`);
  return map;
}

/* ─── Processing ─── */
async function processImage(file, titleMap) {
  const base = path.basename(file, path.extname(file));

  // Coba berbagai format key
  const title =
    titleMap[file] ||
    titleMap[path.basename(file)] ||
    titleMap[file.replace(/^images\//, '')] ||
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
      await sharp(file)
        .resize({ width: size, withoutEnlargement: true })
        .toFormat(fmt.ext, fmt.opts)
        .toFile(outPath);
      const stat = await fs.stat(outPath);
      variants.push({ size, format: fmt.ext, url: `/images/${slug}/${size}.${fmt.ext}`, bytes: stat.size });
    }
  }

  await sharp(file)
    .resize({ width: Math.min(1280, meta.width), withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toFile(path.join(outDir, 'fallback.jpg'));

  return {
    slug,
    name: title,
    fallback: `/images/${slug}/fallback.jpg`,
    width: meta.width,
    height: meta.height,
    variants,
  };
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

const fmtSize = (b) =>
  b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : b > 1024 ? (b / 1024).toFixed(0) + ' KB' : b + ' B';

function cardHtml(img) {
  const avifSrcset = buildSrcset(img.variants, 'avif');
  const webpSrcset = buildSrcset(img.variants, 'webp');
  const pictureHtml = buildPicture(img);

  const thumb = img.variants.find(v => v.size === 480 && v.format === 'avif')
             || img.variants.find(v => v.format === 'avif')
             || img.variants.find(v => v.format === 'webp')
             || { url: img.fallback };

  const sizePills = (format) =>
    SIZES
      .map(s => img.variants.find(v => v.size === s && v.format === format))
      .filter(Boolean)
      .map(v => `<button class="copy-btn inline-flex items-center rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent" data-copy="${esc(v.url)}">${v.size}w</button>`)
      .join('');

  return `
  <article class="card group mb-6 break-inside-avoid overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:border-primary/40 hover:shadow-lg">
    <div class="relative overflow-hidden bg-muted">
      <img src="${thumb.url}" alt="${esc(img.name)}" loading="lazy" decoding="async" width="${img.width}" height="${img.height}" class="block h-auto w-full transition-opacity duration-300 group-hover:opacity-95">
    </div>
    <div class="flex flex-col gap-3 p-5">
      <div class="flex flex-col gap-1.5">
        <h3 class="truncate text-sm font-semibold" title="${esc(img.name)}">${esc(img.name)}</h3>
        <p class="text-xs text-muted-foreground">${img.width} × ${img.height} · ${img.variants.length} varian</p>
      </div>
      <div class="flex flex-col gap-2.5">
        <button class="copy-btn inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90" data-copy="${esc(pictureHtml)}">
          ${icons.copy}
          <span>Copy &lt;picture&gt;</span>
        </button>
        <div class="grid grid-cols-2 gap-2">
          <button class="copy-btn inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent" data-copy="${esc(avifSrcset)}">AVIF srcset</button>
          <button class="copy-btn inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent" data-copy="${esc(webpSrcset)}">WebP srcset</button>
        </div>
        <details class="group text-xs text-muted-foreground">
          <summary class="flex cursor-pointer items-center justify-between rounded-md px-1 py-1 hover:text-foreground">
            <span>Ukuran individual</span>
            <span class="transition-transform group-open:rotate-180">${icons.chevronDown}</span>
          </summary>
          <div class="mt-3 flex flex-col gap-3">
            <div>
              <div class="mb-1.5 text-[10px] uppercase tracking-wider font-semibold">AVIF</div>
              <div class="flex flex-wrap gap-1.5">${sizePills('avif')}</div>
            </div>
            <div>
              <div class="mb-1.5 text-[10px] uppercase tracking-wider font-semibold">WebP</div>
              <div class="flex flex-wrap gap-1.5">${sizePills('webp')}</div>
            </div>
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
      <p class="mt-1 text-sm">Upload lewat Pages CMS atau taruh di <code class="rounded bg-muted px-1.5 py-0.5 text-xs">images/</code></p>
    </div>` : `
    <div class="columns-1 gap-6 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5" id="grid">
      ${cards}
    </div>`;

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FZH Assets · Image Library</title>
<style>
  /* Critical fallback — kalau /app.css 404, design dasar tetap ada */
  body{margin:0;background:#fff;color:#18181b;font-family:system-ui,-apple-system,sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased}
  header{padding:16px 20px;border-bottom:1px solid #e4e4e7;background:rgba(255,255,255,.9);position:sticky;top:0;backdrop-filter:blur(8px);z-index:40}
  main{max-width:1280px;margin:0 auto;padding:28px 20px}
  @media(min-width:640px){main{padding:32px 24px}}
  @media(min-width:768px){main{padding:40px 24px}}
  .card{background:#fff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;margin-bottom:24px}
  .copy-btn{cursor:pointer;border-radius:6px;border:1px solid #e4e4e7;background:#f4f4f5;padding:8px 12px;font:inherit;font-size:13px;font-weight:500}
  .copy-btn.primary{background:#4f46e5;color:#fff;border-color:#4f46e5}
  img{max-width:100%;height:auto;display:block}
</style>
<link rel="stylesheet" href="/app.css">
</head>
<body>
<header class="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
  <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6 py-4 sm:px-8">
    <a href="/" class="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
      <span class="text-primary">${icons.images}</span>
      <span>FZH <span class="text-primary">Assets</span></span>
    </a>
    <div class="hidden items-center gap-3 text-xs text-muted-foreground md:flex">
      <span><b class="text-foreground">${images.length}</b> gambar</span>
      <span class="text-border">·</span>
      <span><b class="text-foreground">${fmtSize(totalSize)}</b> varian</span>
    </div>
    <div class="relative ml-auto w-full max-w-sm sm:w-auto sm:flex-1 sm:max-w-md">
      <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">${icons.search}</span>
      <input type="search" id="search" placeholder="Cari nama gambar..." autocomplete="off" class="w-full rounded-md border border-border bg-secondary px-3 py-2.5 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:outline-none focus:ring-1 focus:ring-primary">
    </div>
  </div>
</header>
<main class="mx-auto max-w-7xl px-6 py-7 sm:px-8 sm:py-8 md:py-10">
  ${bodyContent}
</main>
<div class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 translate-y-20 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground opacity-0 shadow-lg shadow-primary/25 transition-all duration-300" id="toast"></div>
<script>
(function(){
  const toast = document.getElementById('toast');
  let t;
  const showToast = (msg) => {
    toast.textContent = msg || '✓ Copied!';
    toast.classList.remove('translate-y-20', 'opacity-0');
    clearTimeout(t);
    t = setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 1500);
  };
  const copy = async (text, el) => {
    try {
      await navigator.clipboard.writeText(text);
      if (el) {
        const orig = el.innerHTML;
        el.innerHTML = '<span>✓ Copied!</span>';
        el.classList.add('copied');
        setTimeout(() => { el.innerHTML = orig; el.classList.remove('copied'); }, 1200);
      }
      showToast();
    } catch(e) { showToast('❌ Gagal copy'); }
  };
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); copy(btn.dataset.copy, btn); });
  });
  const search = document.getElementById('search');
  if (search) {
    search.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      document.querySelectorAll('.card').forEach(card => {
        const name = card.querySelector('h3').textContent.toLowerCase();
        card.style.display = name.includes(q) ? '' : 'none';
      });
    });
  }
})();
</script>
</body>
</html>`;

  await fs.writeFile(path.join(PUBLIC_DIR, 'index.html'), html);
}

async function copyFont() {
  await fs.mkdir(path.join(PUBLIC_DIR, 'fonts'), { recursive: true });
  try {
    await fs.copyFile(FONT_SRC, FONT_DEST);
  } catch {
    console.warn('⚠️  Inter font tidak ditemukan, fallback ke system font');
  }
}

async function main() {
  await fs.mkdir(PUBLIC_DIR, { recursive: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await copyFont();

  const titleMap = await getTitleMap();
  const files = await glob(`${INPUT_DIR}/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}`, { nodir: true });

  if (files.length === 0) {
    console.log('⚠️  Tidak ada gambar di folder images/');
    await generateGallery([]);
    return;
  }

  console.log(`📦 Memproses ${files.length} gambar...\n`);
  const images = [];
  for (const file of files) {
    console.log(`  → ${path.basename(file)}`);
    images.push(await processImage(file, titleMap));
  }
  await generateGallery(images);
  await fs.writeFile(path.join(PUBLIC_DIR, 'manifest.json'), JSON.stringify(images, null, 2));
  console.log(`\n✅ Selesai: ${images.length} gambar diproses`);
}

main().catch(err => { console.error(err); process.exit(1); });