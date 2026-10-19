import { expect, test } from '@playwright/test';

const indexableRoutes = [
  '/',
  '/features',
  '/compatibility',
  '/private-voice-tracking',
  '/privacy',
  '/about',
  '/guides',
  '/guides/how-to-use-a-teleprompter',
  '/guides/teleprompter-for-youtube',
  '/guides/teleprompter-for-video-recording',
  '/guides/teleprompter-camera-distance-and-font-size',
  '/guides/teleprompter-for-presentations',
  '/guides/teleprompter-for-zoom',
  '/guides/manual-vs-voice-activated-teleprompter',
  '/guides/teleprompter-speed',
  '/guides/what-is-a-teleprompter',
  '/guides/how-to-read-a-teleprompter-naturally',
  '/guides/how-to-maintain-eye-contact',
  '/guides/how-to-format-a-teleprompter-script',
  '/guides/voice-activated-teleprompters',
  '/tools',
  '/tools/teleprompter-speed-calculator',
  '/tools/words-to-minutes',
];

test('all indexable pages expose complete unique metadata', async ({ page }) => {
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const path of indexableRoutes) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    const title = await page.title();
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(title, path).toBeTruthy();
    expect(description, path).toBeTruthy();
    expect(titles.has(title), `duplicate title: ${title}`).toBe(false);
    expect(descriptions.has(description ?? ''), `duplicate description: ${description}`).toBe(
      false,
    );
    titles.add(title);
    descriptions.add(description ?? '');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      new RegExp(`^https://www\\.teleprompter\\.wtf/`),
    );
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
  }
});

test('homepage ships interactive mobile QR connect panel', async ({ page }) => {
  await page.goto('/');
  const qrCard = page.locator('.mobile-qr-inline-card');
  await expect(qrCard).toHaveCount(1);
});

test('JSON-LD blocks parse as valid JSON', async ({ page }) => {
  for (const path of [
    '/',
    '/compatibility',
    '/private-voice-tracking',
    '/guides/how-to-use-a-teleprompter',
  ]) {
    await page.goto(path);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocks.length, path).toBeGreaterThan(0);
    for (const block of blocks) expect(() => JSON.parse(block)).not.toThrow();
  }
});

test('robots, sitemap, llms, health, and custom 404 are served', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain('https://www.teleprompter.wtf/sitemap-index.xml');

  const sitemap = await request.get('/sitemap-index.xml');
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain('https://www.teleprompter.wtf/');

  const llms = await request.get('/llms.txt');
  expect(llms.status()).toBe(200);
  const llmsText = await llms.text();
  expect(llmsText).toContain('Private Precision');
  expect(llmsText).toContain('https://www.teleprompter.wtf/compatibility');
  expect(llmsText).toContain('https://www.teleprompter.wtf/guides');

  const health = await request.get('/health');
  expect(health.status()).toBe(200);
  expect((await health.text()).trim()).toBe('ok');
  // Production Nginx adds these; static `serve` used in local Playwright may not.
  const cacheControl = health.headers()['cache-control'] ?? '';
  const robotsTag = health.headers()['x-robots-tag'] ?? '';
  if (cacheControl) expect(cacheControl).toMatch(/no-store/i);
  if (robotsTag) expect(robotsTag).toMatch(/noindex/i);

  const healthTxt = await request.get('/health.txt');
  expect(healthTxt.status()).toBe(200);
  expect((await healthTxt.text()).trim()).toBe('ok');

  const missing = await request.get('/this-route-does-not-exist');
  expect(missing.status()).toBe(404);
});

test('crawlable internal links on representative pages resolve', async ({ page, request }) => {
  const links = new Set<string>();
  for (const path of ['/', '/guides', '/compatibility', '/private-voice-tracking']) {
    await page.goto(path);
    for (const href of await page
      .locator('a[href^="/"]')
      .evaluateAll((anchors) =>
        anchors.map((anchor) => (anchor as HTMLAnchorElement).getAttribute('href') ?? ''),
      )) {
      links.add(href.split('#')[0] ?? href);
    }
  }
  for (const href of links) {
    if (!href) continue;
    expect((await request.get(href)).status(), href).toBeLessThan(400);
  }
});
