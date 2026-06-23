'use strict';

export function safeGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : raw;
  } catch {
    return fallback;
  }
}

export function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function loadJson(key, fallback) {
  try {
    const raw = safeGet(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key, value) {
  return safeSet(key, JSON.stringify(value));
}

export async function copyText(text, fallbackEl, fallbackTextEl, statusFn) {
  const finalText = String(text ?? '');
  fallbackEl.style.display = 'none';
  fallbackTextEl.value = finalText;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(finalText);
      return true;
    } catch {}
  }

  const temp = document.createElement('textarea');
  temp.value = finalText;
  temp.setAttribute('readonly', '');
  temp.style.position = 'fixed';
  temp.style.top = '0';
  temp.style.left = '0';
  temp.style.opacity = '0.01';
  document.body.appendChild(temp);

  let ok = false;
  try {
    temp.focus();
    temp.select();
    temp.setSelectionRange(0, temp.value.length);
    ok = document.execCommand('copy');
  } catch {}

  document.body.removeChild(temp);
  if (ok) return true;

  fallbackEl.style.display = 'block';
  fallbackTextEl.focus();
  fallbackTextEl.select();
  statusFn('自動コピーが弾かれた。下の欄をコピーして。', true);
  return false;
}
