// Test dymny E2E Etapu 1 (Playwright). Wymaga działającej aplikacji, świeżej bazy (pnpm db:setup) i SEED_ADMIN_PASSWORD=ZmienToHaslo123!.
// Uruchomienie: node e2e/smoke.cjs
const { chromium } = require('playwright');
const B = process.env.BASE_URL || 'http://localhost:3000';
const shots = process.env.SCREENSHOTS_DIR || 'docs/screenshots';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const step = (m) => console.log('✔', m);

  await page.goto(B + '/');
  await page.waitForURL('**/logowanie');
  await page.fill('#email', 'admin@firma.local');
  await page.fill('#password', 'zle-haslo');
  await page.click('button[type=submit]');
  await page.getByText('Nieprawidłowy e-mail lub hasło.').waitFor();
  step('błędne hasło odrzucone');
  await page.screenshot({ path: shots + '/01-logowanie.png' });
  await page.fill('#password', 'ZmienToHaslo123!');
  await page.click('button[type=submit]');
  await page.waitForURL(B + '/');
  await page.getByText('Dzień dobry, Administrator').waitFor();
  step('zalogowano jako admin');
  await page.screenshot({ path: shots + '/02-pulpit.png' });

  // nowy użytkownik – Obsługa Klienta
  await page.goto(B + '/admin/uzytkownicy/nowy');
  await page.fill('#name', 'Anna Kowalska');
  await page.fill('#email', 'anna@firma.local');
  await page.fill('#password', 'HasloAnny12345');
  await page.getByLabel(/Obsługa Klienta/).check();
  await page.getByRole('button', { name: 'Utwórz użytkownika' }).click();
  await page.getByText('Użytkownik został utworzony.').waitFor();
  step('utworzono użytkownika Obsługa Klienta');
  await page.screenshot({ path: shots + '/03-uzytkownik.png' });

  // konto marketplace z kluczami
  await page.goto(B + '/admin/kanaly');
  await page.selectOption('#marketplaceId', { label: 'Kaufland DE (DE, EUR)' });
  await page.fill('#name', 'Kaufland DE – sklep główny');
  await page.fill('#cred_clientKey', 'ck_test_1234567890');
  await page.fill('#cred_secretKey', 'sk_super_tajny_9876');
  await page.getByRole('button', { name: 'Dodaj konto' }).click();
  await page.waitForURL(/\/admin\/kanaly\/[0-9a-f-]{36}/);
  await page.getByText('Zapisano: ••••9876').waitFor();
  step('konto Kaufland zapisane, sekret zamaskowany');
  await page.goto(B + '/admin/kanaly');
  await page.getByText('Zaszyfrowane (klucz v1)').waitFor();
  await page.screenshot({ path: shots + '/04-kanaly.png' });

  // kolejka
  await page.goto(B + '/admin/system');
  await page.getByRole('button', { name: 'Wyślij zadanie testowe' }).click();
  await page.getByText('Zadanie testowe dodane do kolejki').waitFor();
  await page.waitForTimeout(4000);
  await page.reload();
  await page.getByText(/Wykonano zadanie/).first().waitFor();
  step('worker wykonał zadanie testowe');
  await page.screenshot({ path: shots + '/05-zadania.png' });

  await page.goto(B + '/admin/audyt');
  await page.locator('tbody').getByText('Dodanie konta marketplace').first().waitFor();
  const html = await page.content();
  if (html.includes('sk_super_tajny_9876')) throw new Error('SEKRET W LOGU AUDYTOWYM!');
  step('log audytowy bez sekretów');
  await page.screenshot({ path: shots + '/06-audyt.png' });

  // logowanie jako Obsługa Klienta – brak dostępu do kanałów
  await page.getByRole('button', { name: 'Wyloguj' }).click();
  await page.waitForURL('**/logowanie');
  await page.fill('#email', 'anna@firma.local');
  await page.fill('#password', 'HasloAnny12345');
  await page.click('button[type=submit]');
  await page.waitForURL(B + '/');
  const nav = await page.locator('nav').innerText();
  if (nav.includes('Kanały i klucze API') || nav.includes('Publikacja')) throw new Error('Obsługa klienta widzi zbyt wiele: ' + nav);
  await page.goto(B + '/admin/kanaly');
  await page.waitForURL(/brak-dostepu/);
  step('Obsługa Klienta: brak dostępu do kluczy API i publikacji');
  await page.screenshot({ path: shots + '/07-brak-dostepu.png' });

  if (errors.length) throw new Error('Błędy JS: ' + errors.join('; '));
  await browser.close();
  console.log('WSZYSTKO OK');
})().catch(e => { console.error('✘', e.message); process.exit(1); });
