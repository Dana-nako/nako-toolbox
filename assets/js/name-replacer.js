import { safeGet, safeSet, loadJson, saveJson, copyText } from './common.js';

'use strict';

const KEYS = {
  template: 'nakoPromptReplacer.template.v1',
  characters: 'nakoPromptReplacer.characters.v4',
  selected: 'nakoPromptReplacer.selected.v2'
};

const templateEl = document.getElementById('template');
const characterListEl = document.getElementById('characterList');
const emptyCharsEl = document.getElementById('emptyChars');
const outputsEl = document.getElementById('outputs');
const emptyEl = document.getElementById('empty');
const statusEl = document.getElementById('status');
const manualCopyEl = document.getElementById('manualCopy');
const manualCopyTextEl = document.getElementById('manualCopyText');
const exportBox = document.getElementById('exportBox');
const importBox = document.getElementById('importBox');
const newLabelEl = document.getElementById('newLabel');
const toggleTemplateSizeBtn = document.getElementById('toggleTemplateSize');
const deleteCharacterListEl = document.getElementById('deleteCharacterList');
const emptyDeleteCharsEl = document.getElementById('emptyDeleteChars');
const deleteSelectionStatusEl = document.getElementById('deleteSelectionStatus');
const deleteSelectedCharactersBtn = document.getElementById('deleteSelectedCharacters');

function uid() {
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[char]);
}

function migrateCharacter(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const variants = Array.isArray(raw.variants)
    ? raw.variants.map(value => String(value).trim()).filter(Boolean)
    : [];

  const name = String(
    raw.name ??
    raw.selectedVariant ??
    raw.baseLabel ??
    raw.label ??
    variants[0] ??
    ''
  ).trim();

  if (!name) return null;

  return {
    id: String(raw.id || uid()),
    name
  };
}

let characters = loadJson(KEYS.characters, []);
if (!Array.isArray(characters)) characters = [];
characters = characters.map(migrateCharacter).filter(Boolean);

let selectedIds = new Set(loadJson(KEYS.selected, []));
let deleteIds = new Set();
let lastOutputs = [];
let templateExpanded = false;

function show(message, bad = false) {
  statusEl.textContent = message;
  statusEl.style.color = bad ? '#ffb3b3' : 'var(--ok)';
}

function saveTemplate() {
  safeSet(KEYS.template, templateEl.value);
}

function saveCharacters() {
  saveJson(KEYS.characters, characters);
  saveJson(KEYS.selected, [...selectedIds]);
}

function normalizeSelections() {
  const validIds = new Set(characters.map(character => character.id));
  selectedIds = new Set([...selectedIds].filter(id => validIds.has(id)));
  deleteIds = new Set([...deleteIds].filter(id => validIds.has(id)));
}

function renderDeleteCharacters() {
  normalizeSelections();

  emptyDeleteCharsEl.style.display = characters.length ? 'none' : 'block';

  deleteCharacterListEl.innerHTML = characters.map(character => {
    const checked = deleteIds.has(character.id) ? 'checked' : '';
    return `
      <label class="delete-character-option">
        <input type="checkbox" data-delete-id="${escapeHtml(character.id)}" ${checked}>
        <span>${escapeHtml(character.name)}</span>
      </label>
    `;
  }).join('');

  deleteCharacterListEl.querySelectorAll('[data-delete-id]').forEach(input => {
    input.addEventListener('change', () => {
      if (input.checked) {
        deleteIds.add(input.dataset.deleteId);
      } else {
        deleteIds.delete(input.dataset.deleteId);
      }
      renderDeleteCharacters();
    });
  });

  const count = deleteIds.size;
  deleteSelectionStatusEl.textContent = count
    ? `${count}件を削除対象に選択中。`
    : '削除対象は未選択。';
  deleteSelectedCharactersBtn.disabled = count === 0;
}

function renderCharacters() {
  normalizeSelections();

  emptyCharsEl.style.display = characters.length ? 'none' : 'block';

  characterListEl.innerHTML = characters.map(character => {
    const checked = selectedIds.has(character.id) ? 'checked' : '';
    return `
      <label class="char">
        <input type="checkbox" data-id="${escapeHtml(character.id)}" ${checked}>
        <span class="fixed-name">${escapeHtml(character.name)}</span>
      </label>
    `;
  }).join('');

  characterListEl.querySelectorAll('[data-id]').forEach(input => {
    input.addEventListener('change', () => {
      if (input.checked) {
        selectedIds.add(input.dataset.id);
      } else {
        selectedIds.delete(input.dataset.id);
      }
      saveCharacters();
    });
  });

  renderDeleteCharacters();
}

function renderOutputs() {
  emptyEl.style.display = lastOutputs.length ? 'none' : 'block';

  outputsEl.innerHTML = lastOutputs.map((output, index) => `
    <article class="output-item">
      <div class="output-head">
        <strong>${escapeHtml(output.name)}用</strong>
        <button type="button" class="btn-compact" data-copy="${index}">コピー</button>
      </div>
      <pre class="output-text">${escapeHtml(output.text)}</pre>
    </article>
  `).join('');

  outputsEl.querySelectorAll('[data-copy]').forEach(button => {
    button.addEventListener('click', async () => {
      const output = lastOutputs[Number(button.dataset.copy)];
      const visibleText = button
        .closest('.output-item')
        ?.querySelector('.output-text')
        ?.textContent ?? output.text;

      if (await copyText(
        visibleText,
        manualCopyEl,
        manualCopyTextEl,
        show
      )) {
        show(`${output.name}用をコピーした。`);
      }
    });
  });
}

function replaceName(text, name) {
  return String(text).split('{NAME}').join(name);
}

function insertAtCursor(element, text) {
  const scrollY = window.scrollY;
  const start = element.selectionStart ?? element.value.length;
  const end = element.selectionEnd ?? element.value.length;

  element.value =
    element.value.slice(0, start) +
    text +
    element.value.slice(end);

  const position = start + text.length;
  element.focus({ preventScroll: true });
  element.setSelectionRange(position, position);
  saveTemplate();

  requestAnimationFrame(() => {
    window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
  });
}

function getTemplateCollapsedHeight() {
  const value = parseFloat(getComputedStyle(templateEl).minHeight);
  return Number.isFinite(value) ? value : 220;
}

function getTemplateExpandedHeight() {
  const maxHeight = Math.floor(window.innerHeight * 0.75);
  const collapsedHeight = getTemplateCollapsedHeight();
  const contentHeight = Math.max(
    templateEl.scrollHeight + 2,
    collapsedHeight
  );
  return Math.min(contentHeight, maxHeight);
}

function applyTemplateHeight() {
  if (window.matchMedia('(min-width: 768px)').matches) {
    templateEl.style.height = '';
    templateEl.classList.remove('is-expanded');
    toggleTemplateSizeBtn.setAttribute('aria-expanded', 'false');
    toggleTemplateSizeBtn.textContent = '入力欄を広げる';
    return;
  }

  const targetHeight = templateExpanded
    ? getTemplateExpandedHeight()
    : getTemplateCollapsedHeight();

  templateEl.style.height = `${targetHeight}px`;
  templateEl.classList.toggle('is-expanded', templateExpanded);
  toggleTemplateSizeBtn.setAttribute(
    'aria-expanded',
    String(templateExpanded)
  );
  toggleTemplateSizeBtn.textContent = templateExpanded
    ? '元に戻す'
    : '入力欄を広げる';
}

function generate() {
  const template = templateEl.value;

  if (!template.trim()) {
    show('元テキストが空だ。', true);
    return;
  }

  if (!characters.length) {
    show('キャラがまだない。追加か復元を先にやれ。', true);
    return;
  }

  const selectedCharacters = characters.filter(character =>
    selectedIds.has(character.id)
  );

  if (!selectedCharacters.length) {
    show('生成するキャラを選べ。', true);
    return;
  }

  lastOutputs = selectedCharacters.map(character => ({
    name: character.name,
    text: replaceName(template, character.name)
  }));

  renderOutputs();
  show(`${lastOutputs.length}件生成した。`);
}

function deleteSelectedCharacters() {
  const targets = characters.filter(character =>
    deleteIds.has(character.id)
  );

  if (!targets.length) {
    show('削除するキャラを選べ。', true);
    return;
  }

  const preview = targets
    .map(character => `「${character.name}」`)
    .join('、');

  if (!confirm(`${preview} の${targets.length}件を削除する。いい？`)) {
    return;
  }

  const targetIds = new Set(targets.map(character => character.id));

  characters = characters.filter(character =>
    !targetIds.has(character.id)
  );

  targetIds.forEach(id => selectedIds.delete(id));
  deleteIds.clear();
  lastOutputs = [];

  saveCharacters();
  renderCharacters();
  renderOutputs();
  show(`${targets.length}件のキャラを削除した。`);
}

function buildBackup() {
  const data = {
    tool: 'name-replacer',
    version: 4,
    template: templateEl.value,
    characters,
    selected: [...selectedIds]
  };

  exportBox.value = JSON.stringify(data, null, 2);
  return exportBox.value;
}

function importSettings() {
  try {
    const data = JSON.parse(importBox.value);
    const incoming = Array.isArray(data.characters)
      ? data.characters
      : Array.isArray(data)
        ? data
        : [];

    characters = incoming.map(migrateCharacter).filter(Boolean);

    selectedIds = new Set(
      Array.isArray(data.selected)
        ? data.selected
        : characters.map(character => character.id)
    );

    deleteIds.clear();

    if (typeof data.template === 'string') {
      templateEl.value = data.template;
    }

    saveTemplate();
    saveCharacters();
    lastOutputs = [];
    renderCharacters();
    renderOutputs();
    show('設定を復元した。');
  } catch {
    show('復元できない。バックアップ用テキストが壊れている。', true);
  }
}

document.getElementById('insertName').addEventListener('click', () => {
  insertAtCursor(templateEl, '{NAME}');
});

document.getElementById('clearTemplate').addEventListener('click', () => {
  if (!templateEl.value) {
    show('入力欄はすでに空だ。');
    return;
  }

  if (!confirm('元テキストをすべて消す。いい？')) return;

  templateEl.value = '';
  saveTemplate();

  if (templateExpanded) applyTemplateHeight();
  show('入力欄を空にした。');
});

document.getElementById('selectAll').addEventListener('click', () => {
  selectedIds = new Set(characters.map(character => character.id));
  saveCharacters();
  renderCharacters();
  show('全員選択した。');
});

document.getElementById('clearSelection').addEventListener('click', () => {
  selectedIds.clear();
  saveCharacters();
  renderCharacters();
  show('選択を解除した。');
});

document.getElementById('generate').addEventListener('click', generate);

document.getElementById('addCharacter').addEventListener('click', () => {
  const name = newLabelEl.value.trim();

  if (!name) {
    show('名前が空だ。', true);
    return;
  }

  const character = { id: uid(), name };
  characters.push(character);
  selectedIds.add(character.id);
  newLabelEl.value = '';

  saveCharacters();
  renderCharacters();
  show(`${name}を追加した。`);
});

document.getElementById('selectAllForDelete').addEventListener('click', () => {
  deleteIds = new Set(characters.map(character => character.id));
  renderDeleteCharacters();
});

document.getElementById('clearDeleteSelection').addEventListener('click', () => {
  deleteIds.clear();
  renderDeleteCharacters();
});

deleteSelectedCharactersBtn.addEventListener(
  'click',
  deleteSelectedCharacters
);

document.getElementById('copyAll').addEventListener('click', async () => {
  if (!lastOutputs.length) {
    show('コピーする出力がまだない。', true);
    return;
  }

  const allText = lastOutputs
    .map(output => `▼ ${output.name}用\n${output.text}`)
    .join('\n\n---\n\n');

  if (await copyText(
    allText,
    manualCopyEl,
    manualCopyTextEl,
    show
  )) {
    show('全部コピーした。');
  }
});

document.getElementById('exportSettings').addEventListener('click', () => {
  buildBackup();
  show('設定バックアップを作った。');
});

document.getElementById('copyExportSettings').addEventListener(
  'click',
  async () => {
    const text = buildBackup();
    if (await copyText(
      text,
      manualCopyEl,
      manualCopyTextEl,
      show
    )) {
      show('設定バックアップをコピーした。');
    }
  }
);

document.getElementById('importSettings').addEventListener(
  'click',
  importSettings
);

templateEl.addEventListener('input', () => {
  saveTemplate();
  if (templateExpanded) applyTemplateHeight();
});

toggleTemplateSizeBtn.addEventListener('click', () => {
  if (document.activeElement === templateEl) templateEl.blur();
  templateExpanded = !templateExpanded;
  applyTemplateHeight();
});

window.addEventListener('resize', applyTemplateHeight);

templateEl.value = safeGet(KEYS.template, '') || '';

saveCharacters();
renderCharacters();
renderOutputs();
applyTemplateHeight();
