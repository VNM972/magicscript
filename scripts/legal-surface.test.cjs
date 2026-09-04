const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicRoot = path.resolve(__dirname, '..', 'sites', 'magicscript-v2', 'public');
const readPublic = (name) => fs.readFileSync(path.join(publicRoot, name), 'utf8');

test('homepage exposes the three legal documents', () => {
  const homepage = readPublic('index.html');
  for (const link of [
    'mentions-legales.html',
    'politique-confidentialite.html',
    'cgv.html',
  ]) {
    assert.match(homepage, new RegExp('href="' + link + '"'));
    assert.ok(fs.existsSync(path.join(publicRoot, link)), link + ' is missing');
  }
});

test('legal pages share the site stylesheet and identify their purpose', () => {
  const expectations = {
    'mentions-legales.html': 'Mentions légales',
    'politique-confidentialite.html': 'Politique de confidentialité',
    'cgv.html': 'Conditions générales de vente',
  };

  for (const [file, title] of Object.entries(expectations)) {
    const html = readPublic(file);
    assert.match(html, /<html lang="fr">/);
    assert.match(html, /href="\/styles\.css"/);
    assert.match(html, new RegExp('<title>Magic Script — ' + title + '</title>'));
    assert.match(html, /href="\/index\.html"/);
  }
});

test('current public surface has no remote Google font or public analytics script', () => {
  const css = readPublic('styles.css');
  const homepage = readPublic('index.html');
  assert.doesNotMatch(css, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.doesNotMatch(homepage, /googletagmanager|google-analytics|plausible|matomo/i);
});

test('homepage exposes only connected public actions in the current scope', () => {
  const homepage = readPublic('index.html');
  assert.match(homepage, /<form class="contact-form" data-contact-form>/);
  assert.doesNotMatch(homepage, /href="mailto:commercial@magicscript\.fr\?subject=/);
  assert.match(homepage, /href="https:\/\/snemm-2609319c\.magicscript-demos-a185c139\.pages\.dev\/"/);
  assert.match(homepage, /Site de référence à revalider/);
  assert.doesNotMatch(homepage, /href="#"/);
});

test('all local HTML links resolve within the public folder', () => {
  const htmlFiles = fs.readdirSync(publicRoot).filter((name) => name.endsWith('.html'));
  for (const file of htmlFiles) {
    const html = readPublic(file);
    for (const [, target] of html.matchAll(/href="([^"]+)"/g)) {
      if (target.startsWith('#') || /^(?:mailto:|https?:)/i.test(target)) continue;
      const relativeTarget = target.replace(/^\/+/, '').split(/[?#]/, 1)[0];
      const resolved = path.resolve(publicRoot, relativeTarget);
      assert.ok(resolved === publicRoot || resolved.startsWith(publicRoot + path.sep), `${file} escapes public folder`);
      assert.ok(fs.existsSync(resolved), `${file} -> ${target} is missing`);
    }
  }
});

test('privacy page documents the only browser storage used by personalization', () => {
  const privacy = readPublic('politique-confidentialite.html');
  assert.match(privacy, /localStorage|stockage local/i);
  assert.match(privacy, /première visite/i);
  assert.match(privacy, /prospection commerciale/i);
});
