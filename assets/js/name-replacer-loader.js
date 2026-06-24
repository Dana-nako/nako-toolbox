import { safeGet, safeSet, loadJson, saveJson, copyText } from './common.js';

'use strict';

async function bootNameReplacer() {
  const scriptUrl = new URL('./name-replacer.js?v=15', import.meta.url);
  const response = await fetch(scriptUrl, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`name-replacer.js: ${response.status}`);
  }

  let source = await response.text();
  source = source.replace(/^import[^\n]+\n/, '');
  source = source.replace(/^\s*'use strict';\s*/, '');

  if (!source.trimEnd().endsWith('})();')) {
    source = `${source.trimEnd()}\n})();`;
  }

  const run = new Function(
    'safeGet',
    'safeSet',
    'loadJson',
    'saveJson',
    'copyText',
    source
  );

  run(safeGet, safeSet, loadJson, saveJson, copyText);
}

bootNameReplacer().catch(error => {
  console.error(error);
  const status = document.getElementById('status');

  if (status) {
    status.textContent = '起動に失敗した。ページを再読み込みして。';
    status.style.color = '#ffb3b3';
  }
});
