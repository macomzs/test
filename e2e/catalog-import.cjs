// Test E2E Etapu 2a: import 10 produktów z feedu XML, katalog, warianty, edycja produktu.
// Uruchomienie (aplikacja musi działać): FEED_URL=... node e2e/catalog-import.cjs
const { chromium } = require('playwright');
const B = process.env.BASE_URL || 'http://localhost:3000';
const shots = process.env.SCREENSHOTS_DIR || 'docs/screenshots';
const FEED = process.env.FEED_URL;
const EANS = (process.env.EANS || '').split(',').filter(Boolean);
(async () => {
  if (!FEED || EANS.length === 0) throw new Error('Ustaw FEED_URL i EANS (lista po przecinku)');
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const step = m => console.log('✔', m);

  await page.goto(B + '/logowanie');
  await page.fill('#email', 'admin@firma.local');
  await page.fill('#password', process.env.ADMIN_PASSWORD || 'ZmienToHaslo123!');
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await page.waitForURL(B + '/');

  await page.goto(B + '/katalog/import');
  await page.fill('#url', FEED);
  await page.getByRole('button', { name: /Pobierz podgląd|Odśwież podgląd/ }).click();
  await page.getByText(/w feedzie/).waitFor({ timeout: 90000 });
  step('podgląd feedu pobrany: ' + (await page.getByText(/w feedzie/).innerText()));
  await page.fill('#eanList', EANS.join('\n'));
  await page.getByRole('button', { name: 'Zaznacz z listy' }).click();
  await page.getByRole('button', { name: `Importuj zaznaczone (${EANS.length})` }).waitFor();
  step(`zaznaczono ${EANS.length} produktów`);
  await page.screenshot({ path: shots + '/08-import-podglad.png' });
  await page.getByRole('button', { name: `Importuj zaznaczone (${EANS.length})` }).click();
  await page.getByText(/Import zakończony/).waitFor({ timeout: 90000 });
  step(await page.getByText(/Import zakończony/).innerText());
  await page.screenshot({ path: shots + '/09-import-wynik.png' });

  await page.goto(B + '/katalog');
  await page.getByText('Kabina natryskowa Tomar 90', { exact: true }).waitFor();
  await page.getByText('↳ z brodzikiem slim').waitFor();
  step('katalog: produkt główny Tomar 90 z wariantami');
  await page.screenshot({ path: shots + '/10-katalog.png', fullPage: true });

  await page.getByText('Kabina natryskowa Tomar 90', { exact: true }).click();
  await page.getByText('Warianty (3)').waitFor();
  await page.getByRole('link', { name: 'bez brodzika' }).click();
  await page.locator('#variantLabel').waitFor();
  await page.fill('#sku', 'TOMAR-90-BB-' + Date.now().toString().slice(-5));
  await page.fill('#weightKg', '38,5');
  await page.getByRole('button', { name: 'Zapisz produkt' }).click();
  await page.getByText('Zapisano zmiany.').waitFor();
  step('edycja wariantu: SKU i waga zapisane');
  await page.screenshot({ path: shots + '/11-produkt-wariant.png', fullPage: true });

  // walidacja: zły EAN
  await page.fill('#ean', '5907548112973');
  await page.getByRole('button', { name: 'Zapisz produkt' }).click();
  await page.getByText(/jest niepoprawny/).waitFor();
  step('walidacja: niepoprawny EAN odrzucony');

  if (errors.length) throw new Error('Błędy JS: ' + errors.join('; '));
  await browser.close();
  console.log('WSZYSTKO OK');
})().catch(e => { console.error('✘', e.message); process.exit(1); });
