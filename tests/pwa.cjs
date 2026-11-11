const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = {'.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.webmanifest':'application/manifest+json', '.png':'image/png'};
let version = 1;
const server = http.createServer(async (req, res) => {
  try {
    let pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname.startsWith('/Daya/')) pathname = pathname.slice(5);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.resolve(root, '.' + decodeURIComponent(pathname));
    if (!file.startsWith(root + path.sep)) throw new Error('Invalid path');
    let content = await fs.readFile(file);
    if (file.endsWith('/sw.js')) content = Buffer.from(content.toString().replace('v1`', `v${version}\``));
    res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'});
    res.end(content);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});
(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({executablePath:'/usr/bin/chromium', headless:true, args:['--no-sandbox']});
    for (const base of ['/', '/Daya/']) {
      version = 1;
      const context = await browser.newContext({viewport:{width:390,height:844}});
      let posts = 0;
      let rows = [];
      await context.route('https://*.supabase.co/**', async route => {
        const req = route.request();
        if (req.method() === 'POST') posts++;
        await route.fulfill({status:200, headers:{'access-control-allow-origin':'*'}, json:rows});
      });
      let page = await context.newPage();
      await page.goto(origin + base);
      await page.getByText('目前還沒有報修紀錄，歡迎填寫第一筆。').waitFor();
      await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, {once:true}));
      });
      const manifest = await page.evaluate(async () => {
        const url = document.querySelector('link[rel=manifest]').href;
        return {url, value:await (await fetch(url)).json()};
      });
      assert.equal(new URL(manifest.value.start_url, manifest.url).pathname, base);
      assert.equal(new URL(manifest.value.scope, manifest.url).pathname, base);
      assert.equal(manifest.value.display, 'standalone');
      for (const icon of manifest.value.icons) {
        const actual = await page.evaluate(async url => {
          const blob = await (await fetch(url)).blob();
          const img = await createImageBitmap(blob);
          return `${img.width}x${img.height}`;
        }, new URL(icon.src, manifest.url).href);
        assert.equal(actual, icon.sizes);
      }
      const cdp = await context.newCDPSession(page);
      const errors = await cdp.send('Page.getInstallabilityErrors');
      // Isolated test contexts cannot install apps; reject every other eligibility error.
      assert.deepEqual(errors.installabilityErrors.filter(e => e.errorId !== 'in-incognito'), [], JSON.stringify(errors));
      await cdp.detach();
      // Exercise the optional browser-provided install prompt without installing on the host.
      await page.evaluate(() => {
        const event = new Event('beforeinstallprompt', {cancelable:true});
        event.prompt = async () => { window.testInstallPrompted = true; };
        event.userChoice = Promise.resolve({outcome:'dismissed'});
        window.dispatchEvent(event);
      });
      await page.getByRole('button',{name:'安裝報修登記',exact:true}).click();
      assert.equal(await page.evaluate(() => window.testInstallPrompted), true);
      rows = [{id:'00000000-0000-0000-0000-000000000001', reporter_name:'虛構同仁', location:'虛構測試地點', category:'設備', urgency:'高', description:'不應存入離線快取的虛構報修', status:'待處理', created_at:'2026-11-11T08:00:00Z'}];
      await page.getByRole('button',{name:'重新整理',exact:true}).click();
      await page.getByText('虛構測試地點',{exact:true}).waitFor();
      await page.locator('[name=reporter_name]').fill('虛構同仁');
      await page.locator('[name=location]').fill('虛構辦公室');
      await page.locator('[name=category]').selectOption('設備');
      await page.locator('[name=description]').fill('離線測試草稿');
      await context.setOffline(true);
      await page.getByText(/目前離線：可填寫表單/).waitFor();
      assert.equal(await page.locator('#submit-button').isDisabled(), true);
      assert.equal(await page.locator('#refresh-button').isDisabled(), true);
      assert.equal(await page.locator('[name=description]').inputValue(), '離線測試草稿');
      await page.getByText('目前離線，下方為本頁先前載入的紀錄，可能不是最新。').waitFor();
      assert.equal(await page.locator('.request-card').count(), 1);
      // Even a programmatically submitted event must not enqueue or POST offline.
      await page.locator('form').evaluate(f => f.dispatchEvent(new Event('submit',{cancelable:true})));
      assert.equal(posts, 0);
      await page.reload();
      await page.getByText('目前離線，連線後才能讀取報修清單。').waitFor();
      assert.equal(await page.locator('.request-card').count(), 0);
      assert.equal(await page.locator('[name=description]').inputValue(), '');
      assert.equal(await page.locator('#submit-button').isDisabled(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (base === '/Daya/') await page.screenshot({path:path.join(root,'docs/pwa-offline-mobile.png'),fullPage:true});
      // Direct index.html and a launch query must also work without the network.
      await page.goto(origin + base + 'index.html?source=installed');
      await page.getByText('目前離線，連線後才能讀取報修清單。').waitFor();
      await context.setOffline(false);
      await page.getByText('虛構測試地點',{exact:true}).waitFor();
      assert.equal(await page.locator('#submit-button').isEnabled(), true);
      assert.equal(posts, 0); // reconnect never auto-submits
      const cacheURLs = await page.evaluate(async () => {
        const result=[];
        for (const name of await caches.keys()) {
          const cache = await caches.open(name);
          for (const req of await cache.keys()) result.push(req.url);
        }
        return result;
      });
      assert.ok(cacheURLs.length >= 10);
      assert.ok(cacheURLs.every(url => url.startsWith(origin + base) && !url.includes('supabase.co')));
      assert.equal(await page.evaluate(() => localStorage.length), 0);
      assert.deepEqual(await page.evaluate(async () => (await indexedDB.databases()).map(db=>db.name)), []);
      // A new release waits rather than destroying an open form; activation clears
      // only its own old shell, leaving unrelated applications' caches intact.
      await page.evaluate(async () => { await caches.open('unrelated-app'); });
      version = 2;
      await page.evaluate(async () => { const r=await navigator.serviceWorker.ready; await r.update(); });
      await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting));
      assert.ok((await page.evaluate(() => caches.keys())).some(name => name.endsWith(':v1')));
      await page.close();
      page = await context.newPage();
      await page.goto(origin + base);
      await page.waitForFunction(async () => {
        const names=await caches.keys();
        return names.some(name => name.endsWith(':v2')) && !names.some(name => name.endsWith(':v1'));
      });
      assert.ok((await page.evaluate(() => caches.keys())).includes('unrelated-app'));
      await context.setOffline(true);
      await page.reload();
      await page.getByText('目前離線，連線後才能讀取報修清單。').waitFor();
      await context.close();
      console.log(`PASS ${base}: installability, icons, offline reload, no offline POST, reconnect, data boundaries, update lifecycle`);
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode=1; });
