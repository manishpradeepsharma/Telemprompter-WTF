import { execFileSync } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const failures = [];
const publicContentRoots = [
  'src/pages',
  'src/content',
  'README.md',
  'CONTRIBUTING.md',
  'docs',
  'public/llms.txt',
];
const forbidden = [
  ['em dash', /—/],
  ['Lorem Ipsum', /lorem ipsum/i],
  ['unresolved placeholder', /xxxxxxxxx/i],
  ['generic filler', /in today['’]s fast-paced digital world/i],
  ['generic filler', /unlock your potential/i],
  ['generic filler', /take your .+ to the next level/i],
];

async function filesAt(path) {
  const full = resolve(root, path);
  const details = await stat(full);
  if (details.isFile()) return [full];
  const entries = await readdir(full, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => filesAt(join(path, entry.name))));
  return nested.flat();
}

for (const path of publicContentRoots) {
  for (const file of await filesAt(path)) {
    if (!['.astro', '.ts', '.tsx', '.md', '.txt'].includes(extname(file))) continue;
    const value = await readFile(file, 'utf8');
    for (const [label, pattern] of forbidden) {
      if (pattern.test(value)) failures.push(`${relative(root, file)}: ${label}`);
    }
  }
}

execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });

const htmlFiles = (await filesAt('dist')).filter(
  (file) => extname(file) === '.html' && !file.endsWith('/404.html'),
);
const titles = new Map();
const descriptions = new Map();
const hrefs = [];
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const page = relative(resolve(root, 'dist'), file);
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1]?.trim();
  const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1]?.trim();
  if (!title) failures.push(`${page}: missing title`);
  if (!description) failures.push(`${page}: missing meta description`);
  if (
    !/<link rel="canonical" href="https:\/\/(teleprompter\.sharmacomputers\.net|www\.teleprompter\.wtf)\//.test(
      html,
    )
  ) {
    failures.push(`${page}: missing canonical`);
  }
  if (!/<h1(?:\s|>)/.test(html)) failures.push(`${page}: missing H1`);
  if (/<meta name="robots" content="noindex/i.test(html))
    failures.push(`${page}: accidental noindex`);
  if (title) {
    if (titles.has(title)) failures.push(`${page}: duplicate title with ${titles.get(title)}`);
    titles.set(title, page);
  }
  if (description) {
    if (descriptions.has(description))
      failures.push(`${page}: duplicate description with ${descriptions.get(description)}`);
    descriptions.set(description, page);
  }
  for (const match of html.matchAll(/href="(\/[^"]*)"/g))
    hrefs.push([page, match[1].split('#')[0]]);
  for (const match of html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)) {
    try {
      JSON.parse(match[1]);
    } catch {
      failures.push(`${page}: invalid JSON-LD`);
    }
  }
}

for (const [page, href] of hrefs) {
  if (!href || href.startsWith('/_astro/')) continue;
  const direct = href === '/' ? 'dist/index.html' : `dist${href}`;
  const target = href === '/' ? direct : `dist${href}.html`;
  const alternate = href === '/' ? direct : `dist${href}/index.html`;
  try {
    await stat(resolve(root, direct));
  } catch {
    try {
      await stat(resolve(root, target));
    } catch {
      try {
        await stat(resolve(root, alternate));
      } catch {
        failures.push(`${page}: broken internal link ${href}`);
      }
    }
  }
}

if (failures.length) {
  console.error(`Content lint failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
  process.exit(1);
}
console.log(`Content lint passed for ${htmlFiles.length} indexable HTML pages.`);
