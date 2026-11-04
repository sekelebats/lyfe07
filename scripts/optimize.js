import sharp from 'sharp';
import { glob } from 'glob';
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

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function processImage(file) {
  const base = path.basename(file, path.extname(file));
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

  // fallback jpg untuk browser jadul
  await sharp(file)
    .resize({ width: Math.min(1280, meta.width), withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toFile(path.join(outDir, 'fallback.jpg'));

  // simpan original untuk preview di gallery
  const ext = path.extname(file).toLowerCase();
  await fs.copyFile(file, path.join(outDir, `original${ext}`));

  return {
    slug, name: base,
    original: `/images/${slug}/original${ext}`,
    fallback: `/images/${slug}/fallback.jpg`,
    width: meta.width, height: meta.height,
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
  <img src="${img.fallback}" alt="${img.name}" loading="lazy" decoding="async" width="${img.width}" height="${img.height}">
</picture>`;
};

const deviceIcon = (size) => size <= 640 ? '📱' : size <= 1024 ? '📋' : '🖥️';

function cardHtml(img) {
  const avifSrcset = buildSrcset(img.variants, 'avif');
  const webpSrcset = buildSrcset(img.variants, 'webp');
  const pictureHtml = buildPicture(img);

  const sizeButtons = (format) =>
    SIZES
      .map(size => img.variants.find(v => v.size === size && v.format === format))
      .filter(Boolean)
      .map(v => `<button class="copy-btn" data-value="${esc(v.url)}">${deviceIcon(v.size)} ${v.size}w</button>`)
      .join('');

  return `
  <div class="card">
    <div class="preview">
      <img src="${img.original}" alt="${esc(img.name)}" loading="lazy">
    </div>
    <div class="info">
      <h2>${esc(img.name)}</h2>
      <p class="meta">${img.width}×${img.height} · ${img.variants.length} varian</p>

      <div class="btn-row">
        <button class="copy-btn primary" data-value="${esc(avifSrcset)}">📋 Copy AVIF srcset</button>
        <button class="copy-btn primary" data-value="${esc(webpSrcset)}">📋 Copy WebP srcset</button>
        <button class="copy-btn primary" data-value="${esc(pictureHtml)}">📋 Copy &lt;picture&gt; HTML</button>
      </div>

      <div class="group-label">AVIF per ukuran</div>
      <div class="btn-row">${sizeButtons('avif')}</div>

      <div class="group-label">WebP per ukuran</div>
      <div class="btn-row">${sizeButtons('webp')}</div>
    </div>
  </div>`;
}

async function generateGallery(images) {
  const cards = images.map(cardHtml).join('\n');
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Image Gallery · Copy URLs</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:24px;background:#0f172a;color:#e2e8f0}
  h1{margin-top:0}
  .sub{color:#94a3b8;margin-top:-8px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(520px,1fr));gap:24px;margin-top:24px}
  .card{background:#1e293b;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.3);display:flex;flex-direction:column}
  .preview{background:#0f172a;padding:16px;display:flex;align-items:center;justify-content:center;min-height:200px;max-height:340px;overflow:hidden}
  .preview img{max-width:100%;max-height:300px;object-fit:contain}
  .info{padding:16px}
  .info h2{margin:0 0 4px;font-size:18px;word-break:break-all}
  .meta{color:#94a3b8;font-size:13px;margin:0 0 12px}
  .group-label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin:14px 0 6px;font-weight:600}
  .btn-row{display:flex;flex-wrap:wrap;gap:6px}
  .copy-btn{background:#334155;color:#e2e8f0;border:1px solid #475569;padding:7px 11px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit;transition:all .15s}
  .copy-btn:hover{background:#475569}
  .copy-btn.primary{background:#1e40af;border-color:#2563eb}
  .copy-btn.primary:hover{background:#2563eb}
  .copy-btn.copied{background:#059669!important;border-color:#10b981!important}
  .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#059669;color:#fff;padding:12px 24px;border-radius:8px;opacity:0;transition:opacity .3s;pointer-events:none;font-weight:600;z-index:99}
  .toast.show{opacity:1}
</style>
</head>
<body>
<h1>🖼️ Image Gallery</h1>
<p class="sub">Klik tombol untuk copy URL / srcset / HTML. Tempel ke website lo.</p>
<div class="grid">${cards}</div>
<div class="toast" id="toast">✓ Copied!</div>
<script>
document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.value);
      const original = btn.textContent;
      btn.classList.add('copied');
      btn.textContent = '✓ Copied!';
      const toast = document.getElementById('toast');
      toast.classList.add('show');
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.textContent = original;
        toast.classList.remove('show');
      }, 1400);
    } catch (e) {
      alert('Gagal copy: ' + e.message);
    }
  });
});
</script>
</body>
</html>`;

  await fs.writeFile(path.join(PUBLIC_DIR, 'index.html'), html);
}

async function main() {
  await fs.mkdir(PUBLIC_DIR, { recursive: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const files = await glob(`${INPUT_DIR}/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}`, { nodir: true });

  if (files.length === 0) {
    console.log('⚠️  Tidak ada gambar di folder images/');
    return;
  }

  console.log(`📦 Memproses ${files.length} gambar...\n`);
  const images = [];
  for (const file of files) {
    console.log(`  → ${path.basename(file)}`);
    images.push(await processImage(file));
  }

  await generateGallery(images);
  await fs.writeFile(path.join(PUBLIC_DIR, 'manifest.json'), JSON.stringify(images, null, 2));

  console.log(`\n✅ Selesai: ${images.length} gambar diproses`);
  console.log(`🌐 Preview: npx serve public`);
}

main().catch(err => { console.error(err); process.exit(1); });