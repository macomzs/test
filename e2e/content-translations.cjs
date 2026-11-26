// Test E2E Etapów 3–4: wzorzec oferty → przypisanie → nadpisanie dla kanału → słownik →
// tłumaczenie AI (tryb testowy) → edytor porównawczy → akceptacja → wykrycie zmiany oryginału.
// Wymaga zaimportowanych produktów z testu catalog-import.cjs (Kabina natryskowa Tomar 90) i działającego workera.
const { chromium } = require('playwright');
const B = process.env.BASE_URL || 'http://localhost:3000';
const shots = process.env.SCREENSHOTS_DIR || 'docs/screenshots';
const TPL = 'Kabiny prysznicowe ' + Date.now().toString().slice(-4);
let page;
(async () => {
  const browser = await chromium.launch();
  page = await (await browser.newContext({ viewport: { width: 1400, height: 950 }, deviceScaleFactor: 2 })).newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const step = m => console.log('✔', m);

  await page.goto(B + '/logowanie');
  await page.fill('#email', 'admin@firma.local');
  await page.fill('#password', process.env.ADMIN_PASSWORD || 'ZmienToHaslo123!');
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await page.waitForURL(B + '/');

  // 1. Wzorzec
  await page.goto(B + '/wzorce');
  await page.fill('#name', TPL);
  await page.getByRole('button', { name: 'Utwórz wzorzec' }).click();
  await page.waitForURL(/\/wzorce\/[0-9a-f-]{36}/);
  await page.fill('#section_TITLE', '{{marka}} {{nazwa_bazowa}} – kabina prysznicowa {{wariant}}');
  await page.fill('#section_BENEFITS', 'Szkło hartowane 6 mm\nProfile z aluminium\nWaga: {{waga_kg}} kg');
  await page.fill('#section_DESCRIPTION', 'Kabina {{nazwa_bazowa}} marki {{marka}} z brodzikiem lub bez.\n\nMontaż zgodnie z instrukcją.');
  await page.fill('#section_SET_CONTENTS', 'Kabina {{nazwa_bazowa}}\nInstrukcja montażu');
  await page.fill('#section_SAFETY', 'Producent: {{marka}}. Szkło hartowane – nie uderzać ostrymi przedmiotami.');
  await page.getByRole('button', { name: 'Zapisz wzorzec' }).click();
  await page.getByText(/^Zapisano/).waitFor();
  const tplUrl = page.url();
  step('utworzono wzorzec z sekcjami i zmiennymi');

  // 2. Produkt główny: marka + wzorzec
  await page.goto(B + '/katalog?q=Tomar');
  await page.getByRole('link', { name: 'Kabina natryskowa Tomar 90', exact: true }).click();
  await page.locator('#brand').waitFor();
  const parentUrl = page.url();
  await page.fill('#brand', 'Novoterm');
  await page.getByRole('button', { name: 'Zapisz produkt' }).click();
  await page.getByText(/Zapisano zmiany|Brak zmian/).waitFor();
  await page.goto(parentUrl + '/oferta');
  await page.selectOption('#templateId', { label: TPL });
  await page.getByRole('button', { name: 'Zapisz wzorzec' }).click();
  await page.getByText('Przypisano wzorzec.').waitFor();
  step('wzorzec przypisany do produktu głównego (dziedziczą go warianty)');

  // 3. Wariant – podgląd i nadpisanie dla Kaufland DE
  await page.goto(parentUrl);
  await page.getByRole('link', { name: 'bez brodzika' }).click();
  await page.locator('#variantLabel').waitFor();
  const variantUrl = page.url();
  const variantId = variantUrl.split('/').pop();
  await page.goto(variantUrl + '/oferta');
  await page.getByText('Novoterm Kabina natryskowa Tomar 90 – kabina prysznicowa bez brodzika').first().waitFor();
  step('podgląd treści PL wariantu ze zmiennymi (marka odziedziczona)');
  await page.screenshot({ path: shots + '/12-tresc-oferty.png', fullPage: true });
  await page.getByRole('link', { name: /Kaufland DE/ }).click();
  await page.locator('#override_TITLE').waitFor();
  await page.fill('#override_TITLE', '{{marka}} {{nazwa_bazowa}} kabina prysznicowa 90x90 bez brodzika, szkło 6 mm');
  await page.getByRole('button', { name: /Zapisz nadpisania/ }).click();
  await page.getByText(/Zapisano nadpisania|Brak zmian/).waitFor();
  await page.getByText('nadpisane').first().waitFor();
  step('nadpisanie tytułu dla Kaufland DE');
  await page.screenshot({ path: shots + '/13-nadpisania-kanal.png', fullPage: true });

  // 4. Słownik
  await page.goto(B + '/tlumaczenia/slownik');
  const hasNovoterm = await page.locator('tbody').getByText('Novoterm', { exact: true }).count();
  if (!hasNovoterm) {
    await page.fill('#sourceTerm', 'Novoterm');
    await page.getByRole('button', { name: 'Dodaj do słownika' }).click();
    await page.getByText(/Dodano termin/).waitFor();
  }
  step('słownik: „Novoterm” bez tłumaczenia');

  // 5. Tłumaczenie AI (tryb testowy) DE + EN dla wariantu
  await page.goto(B + '/tlumaczenia?q=Tomar');
  await page.getByLabel('Zaznacz Kabina natryskowa Tomar 90 (bez brodzika)').check();
  await page.locator('label', { hasText: 'DE' }).locator('input').check();
  await page.locator('label', { hasText: 'EN' }).locator('input').check();
  await page.getByRole('button', { name: /Przetłumacz AI \(1 × 2\)/ }).click();
  await page.getByText(/Dodano do kolejki tłumaczeń: 2/).waitFor();
  await page.waitForFunction(() => !/W kolejce…|Tłumaczę…/.test(document.body.innerText), null, { timeout: 90000 });
  await page.getByText('Szkic AI').nth(1).waitFor();
  step('worker przetłumaczył DE i EN (status: Szkic AI)');
  await page.screenshot({ path: shots + '/14-tlumaczenia-macierz.png', fullPage: true });

  // 6. Edytor porównawczy → akceptacja
  await page.goto(`${B}/tlumaczenia/${variantId}/de`);
  await page.getByText('Oryginał (PL)').waitFor();
  const title = page.getByLabel('Tytuł (SEO) – Niemiecki');
  const val = await title.inputValue();
  if (!val.startsWith('[DE] Novoterm')) throw new Error('Nieoczekiwany tytuł: ' + val);
  await title.fill('Novoterm Duschkabine Tomar 90 ohne Duschwanne');
  await page.getByRole('button', { name: 'Zapisz poprawki' }).click();
  await page.getByText('Zapisano poprawki.').waitFor();
  await page.getByRole('button', { name: 'Wyślij do akceptacji' }).click();
  await page.getByText('Wysłano do akceptacji.').waitFor();
  await page.getByRole('button', { name: 'Zatwierdź' }).click();
  await page.getByText('Tłumaczenie zatwierdzone.').waitFor();
  step('edytor: poprawka, „Do akceptacji”, „Zatwierdzone”');
  await page.screenshot({ path: shots + '/15-edytor-tlumaczenia.png', fullPage: true });

  // 7. Zakres kanału (nadpisanie Kaufland DE) też jest do przetłumaczenia
  await page.getByRole('link', { name: /Nadpisania: Kaufland DE/ }).click();
  await page.getByText('Brak tłumaczenia').waitFor();
  step('osobny zakres tłumaczenia dla nadpisań Kaufland DE');

  // 8. Zmiana oryginału → nieaktualne
  await page.goto(variantUrl);
  await page.fill('#weightKg', String(40 + Math.floor(Math.random() * 9)) + ',5');
  await page.getByRole('button', { name: 'Zapisz produkt' }).click();
  await page.getByText('Zapisano zmiany.').waitFor();
  await page.goto(`${B}/tlumaczenia/${variantId}/de`);
  await page.getByText('nieaktualne').first().waitFor();
  await page.getByText('Polski oryginał tej sekcji zmienił się').first().waitFor();
  step('zmiana danych produktu oznacza tłumaczenie jako nieaktualne');

  await page.goto(tplUrl); // podgląd wzorca
  await page.getByText('Podgląd na produkcie').waitFor();

  if (errors.length) throw new Error('Błędy JS: ' + errors.join('; '));
  await browser.close();
  console.log('WSZYSTKO OK');
})().catch(async e => { console.error('✘', e.message); if (page) await page.screenshot({ path: '/tmp/e2e-blad.png', fullPage: true }).catch(() => {}); process.exit(1); });
