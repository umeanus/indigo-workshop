import { readFile, readdir, mkdir, writeFile, copyFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFile(path.join(root, p), 'utf8');
const meta = JSON.parse(await read('package.json'));
const modules = ['core','recipes','textile','cloth','items','ties','cloth-gpu','tie-plan','studio','editor','material','audio','ritual','gallery','export','home','discovery','bootstrap'];
let js = (await Promise.all(modules.map((n) => read(`src/js/${n}.js`)))).join('\n\n');

let body = await read('src/body.html');
body = body.replace('<!-- HOME_PAGE -->', await read('src/home.html'))
  .replace('<!-- RECIPE_PAGE -->', await read('src/recipe.html'))
  .replace('<!-- DISCOVERY_PAGE -->', await read('src/discovery.html'));
const staticAssets = [
  ['intro/indigo-materials.webp', 'intro/indigo-materials.webp', '__INTRO_ART_BLUE__'],
  ['intro/tie-dye-cotton.webp', 'intro/tie-dye-cotton.webp', '__INTRO_ART_TIE__'],
  ['intro/wax-resist-cotton.webp', 'intro/wax-resist-cotton.webp', '__INTRO_ART_WAX__'],
  ['ui/workshop-hero-v10.webp', 'ui/workshop-hero-v10.webp', '__UI_HERO__'],
  ['ui/handkerchief-v10.webp', 'ui/handkerchief-v10.webp', '__UI_HANDKERCHIEF__'],
  ['ui/cotton-paper-v10.webp', 'ui/cotton-paper-v10.webp', '__UI_TEXTURE__'],
];
for (const [source, output, token] of staticAssets) {
  if (token && token.startsWith('__INTRO_')) body = body.replaceAll(token, `./assets/${output}`);
}

let css = (await Promise.all(['base','workbench','recipes','discovery','brand','studio','intro-deck'].map((n) => read(`src/styles/${n}.css`)))).join('\n');
for (const [source, output, token] of staticAssets) {
  if (!token) continue;
  const url = `./assets/${output}`;
  body = body.replaceAll(token, url);
  js = js.replaceAll(token, url);
  css = css.replaceAll(token, url);
}

let symbols = '';
for (const file of (await readdir(path.join(root, 'src/assets/icons'))).filter((f) => f.endsWith('.svg')).sort()) {
  const svg = await read(`src/assets/icons/${file}`);
  symbols += svg.replace(/<svg[^>]*>/, `<symbol id="ph-${file.replace('.svg', '')}" viewBox="0 0 256 256">`).replace('</svg>', '</symbol>');
}
body = body.replace('<!-- PHOSPHOR_ICONS -->', symbols);
const html = `<!DOCTYPE html>\n<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"><meta name="theme-color" content="#173d8f"><meta name="description" content="蓝染工坊，从一方素棉布开始，体验蜡染留白、整布捏揉折扎、浸染与晾晒。"><meta name="application-name" content="蓝染工坊"><meta name="application-version" content="${meta.version}"><title>蓝染工坊 · 草木手作</title>\n<!-- 蓝染工坊 ${meta.version} | Source project: src/ + scripts/build.mjs | Built artifact: do not edit directly. -->\n<link rel="stylesheet" href="./style.css"></head><body>${body}<script src="./application.js"></script></body></html>`;

const outputs = ['dist', '.'];
for (const folder of outputs) {
  const out = path.join(root, folder);
  await unlink(path.join(out, 'assets', 'ghuzheng-fantasie.mp3')).catch(() => {});
  await mkdir(out, { recursive: true });
  await mkdir(path.join(out, 'assets', 'intro'), { recursive: true });
  await mkdir(path.join(out, 'assets', 'ui'), { recursive: true });
  await writeFile(path.join(out, 'index.html'), html);
  await writeFile(path.join(out, 'style.css'), css);
  await writeFile(path.join(out, 'application.js'), `'use strict';\n(()=>{\n${js}\n})();`);
  for (const [source, output] of staticAssets) {
    const from = path.join(root, 'src/assets', source);
    const to = path.join(out, 'assets', output);
    if (source.startsWith('intro/')) {
      const image = await loadImage(from);
      const scale = Math.min(1, 720 / Math.max(image.width, image.height));
      const canvas = createCanvas(Math.round(image.width * scale), Math.round(image.height * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      await writeFile(to, canvas.toBuffer('image/webp', 78));
    } else {
      await copyFile(from, to);
    }
  }
}
console.log(`Built 蓝染工坊 ${meta.version}: offline HTML, CSS, JS and ${staticAssets.length} local assets`);
