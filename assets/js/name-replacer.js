import { safeGet, safeSet, loadJson, saveJson, copyText } from './common.js';

'use strict';

(() => {
    const KEYS = { template:'nakoPromptReplacer.template.v1', characters:'nakoPromptReplacer.characters.v4', selected:'nakoPromptReplacer.selected.v2' };
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
    let characters = loadJson(KEYS.characters, []); if (!Array.isArray(characters)) characters = [];
    characters = characters.map(normChar).filter(c => c.baseLabel || c.variants.length);
    let selectedIds = new Set(loadJson(KEYS.selected, []));
    let deleteIds = new Set();
    let lastOutputs = [];

    function esc(value){return String(value).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
    function uid(){return 'id_'+Date.now()+'_'+Math.random().toString(16).slice(2);}
    function normChar(c){const raw=Array.isArray(c&&c.variants)?c.variants:[];const base=String((c&&(c.baseLabel||c.label||c.name))||raw[0]||'').trim();const vars=raw.map(v=>String(v).trim()).filter(Boolean);const finalVars=vars.length?[...new Set(vars)]:(base?[base]:[]);const selected=String((c&&c.selectedVariant)||finalVars[0]||base||'').trim();return{id:String((c&&c.id)||uid()),baseLabel:base||finalVars[0]||'名称未設定',variants:finalVars.length?finalVars:[base||'名称未設定'],selectedVariant:finalVars.includes(selected)?selected:(finalVars[0]||base||'名称未設定')}}
    function currentName(c){return c.selectedVariant||(c.variants&&c.variants[0])||c.baseLabel;}
    function outputLabel(c){const n=currentName(c);return n===c.baseLabel?c.baseLabel:`${c.baseLabel} / ${n}`;}
    function show(message,bad=false){statusEl.textContent=message;statusEl.style.color=bad?'#ffb3b3':'var(--ok)';}
    function saveTemplate(){safeSet(KEYS.template,templateEl.value);}
    function saveChars(){saveJson(KEYS.characters,characters);saveJson(KEYS.selected,[...selectedIds]);}
    function renderDeleteCharacters(){
      const validIds = new Set(characters.map(c=>c.id));
      deleteIds = new Set([...deleteIds].filter(id=>validIds.has(id)));
      emptyDeleteCharsEl.style.display = characters.length ? 'none' : 'block';
      deleteCharacterListEl.innerHTML = characters.map(c=>{
        const checked = deleteIds.has(c.id) ? 'checked' : '';
        return `<label class="delete-character-option"><input type="checkbox" data-delete-id="${esc(c.id)}" ${checked}/><span>${esc(outputLabel(c))}</span></label>`;
      }).join('');
      deleteCharacterListEl.querySelectorAll('[data-delete-id]').forEach(input=>{
        input.addEventListener('change',()=>{
          input.checked ? deleteIds.add(input.dataset.deleteId) : deleteIds.delete(input.dataset.deleteId);
          renderDeleteCharacters();
        });
      });
      const count = deleteIds.size;
      deleteSelectionStatusEl.textContent = count ? `${count}件を削除対象に選択中。` : '削除対象は未選択。';
      deleteSelectedCharactersBtn.disabled = count === 0;
    }

    function renderChars(){
      emptyCharsEl.style.display=characters.length?'none':'block';
      characterListEl.innerHTML=characters.map(c=>{
        const checked=selectedIds.has(c.id)?'checked':'';
        const main=c.variants.length>1
          ? `<select class="variant-select" data-variant-id="${esc(c.id)}">${c.variants.map(v=>`<option value="${esc(v)}" ${v===currentName(c)?'selected':''}>${esc(v)}</option>`).join('')}</select>`
          : `<span class="fixed-name">${esc(currentName(c))}</span>`;
        return `<label class="char"><input type="checkbox" data-id="${esc(c.id)}" ${checked}/><span>${main}</span></label>`;
      }).join('');
      characterListEl.querySelectorAll('input[type="checkbox"]').forEach(i=>i.addEventListener('change',()=>{
        i.checked ? selectedIds.add(i.dataset.id) : selectedIds.delete(i.dataset.id);
        saveChars();
      }));
      characterListEl.querySelectorAll('[data-variant-id]').forEach(s=>s.addEventListener('change',()=>{
        const c=characters.find(x=>x.id===s.dataset.variantId);
        if(!c)return;
        c.selectedVariant=s.value;
        saveChars();
        renderDeleteCharacters();
        show(`${c.baseLabel}の呼び名を「${s.value}」にした。`);
      }));
      renderDeleteCharacters();
    }

    function deleteSelectedCharacters(){
      const targets = characters.filter(c=>deleteIds.has(c.id));
      if(!targets.length)return show('削除するキャラを選べ。',true);
      const names = targets.map(c=>currentName(c));
      const preview = names.map(name=>`「${name}」`).join('、');
      if(!confirm(`${preview} の${targets.length}件を削除する。いい？`))return;
      const targetIds = new Set(targets.map(c=>c.id));
      characters = characters.filter(c=>!targetIds.has(c.id));
      targetIds.forEach(id=>selectedIds.delete(id));
      deleteIds.clear();
      lastOutputs=[];
      saveChars();
      renderChars();
      renderOutputs();
      show(`${targets.length}件のキャラを削除した。`);
    }

    function replaceName(t,c){const n=currentName(c);return String(t).split('{NAME}').join(n);}
    function renderOutputs(){emptyEl.style.display=lastOutputs.length?'none':'block';outputsEl.innerHTML=lastOutputs.map((o,i)=>`<article class="output-item"><div class="output-head"><strong>${esc(o.label)}用</strong><button type="button" class="btn-compact" data-copy="${i}">コピー</button></div><pre class="output-text">${esc(o.text)}</pre></article>`).join('');outputsEl.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',async()=>{const o=lastOutputs[Number(b.dataset.copy)];const visible=b.closest('.output-item')?.querySelector('.output-text')?.textContent??o.text;if(await copyText(visible,manualCopyEl,manualCopyTextEl,show))show(`${o.label}用をコピーした。`);}));}
    function insertAtCursor(el,text){const y=window.scrollY;const start=el.selectionStart??el.value.length,end=el.selectionEnd??el.value.length;el.value=el.value.slice(0,start)+text+el.value.slice(end);const pos=start+text.length;el.focus({preventScroll:true});el.setSelectionRange(pos,pos);saveTemplate();requestAnimationFrame(()=>window.scrollTo({top:y,left:0,behavior:'auto'}));}
    let templateExpanded = false;
    function getTemplateCollapsedHeight(){
      const value = parseFloat(getComputedStyle(templateEl).minHeight);
      return Number.isFinite(value) ? value : 220;
    }
    function getTemplateExpandedHeight(){
      const maxHeight = Math.floor(window.innerHeight * 0.75);
      const collapsedHeight = getTemplateCollapsedHeight();
      const contentHeight = Math.max(templateEl.scrollHeight + 2, collapsedHeight);
      return Math.min(contentHeight, maxHeight);
    }
    function applyTemplateHeight(){
      if(window.matchMedia('(min-width: 768px)').matches){
        templateEl.style.height = '';
        templateEl.classList.remove('is-expanded');
        toggleTemplateSizeBtn.setAttribute('aria-expanded','false');
        toggleTemplateSizeBtn.textContent = '入力欄を広げる';
        return;
      }
      const targetHeight = templateExpanded ? getTemplateExpandedHeight() : getTemplateCollapsedHeight();
      templateEl.style.height = `${targetHeight}px`;
      templateEl.classList.toggle('is-expanded', templateExpanded);
      toggleTemplateSizeBtn.setAttribute('aria-expanded', String(templateExpanded));
      toggleTemplateSizeBtn.textContent = templateExpanded ? '元に戻す' : '入力欄を広げる';
    }

    function generate(){const t=templateEl.value;if(!t.trim())return show('元テキストが空だ。',true);if(!characters.length)return show('キャラがまだない。追加か復元を先にやれ。',true);const selected=characters.filter(c=>selectedIds.has(c.id));if(!selected.length)return show('生成するキャラを選べ。',true);lastOutputs=selected.map(c=>({label:outputLabel(c),text:replaceName(t,c)}));renderOutputs();show(`${lastOutputs.length}件生成した。`);}
    function buildBackup(){const data={tool:'name-replacer',version:3,template:templateEl.value,characters,selected:[...selectedIds]};exportBox.value=JSON.stringify(data,null,2);return exportBox.value;}function exportSettings(){buildBackup();show('設定バックアップを作った。');}async function copyExportSettings(){const text=buildBackup();if(await copyText(text,manualCopyEl,manualCopyTextEl,show))show('設定バックアップをコピーした。');}
    function importSettings(){try{const data=JSON.parse(importBox.value);const incoming=Array.isArray(data.characters)?data.characters:(Array.isArray(data)?data:[]);characters=incoming.map(normChar);selectedIds=new Set(Array.isArray(data.selected)?data.selected:characters.map(c=>c.id));deleteIds.clear();if(typeof data.template==='string')templateEl.value=data.template;saveTemplate();saveChars();lastOutputs=[];renderChars();renderOutputs();show('設定を復元した。');}catch{show('復元できない。バックアップ用テキストが壊れている。',true);}}

    document.getElementById('insertName').addEventListener('click',()=>insertAtCursor(templateEl,'{NAME}'));
    document.getElementById('clearTemplate').addEventListener('click',()=>{
      if(!templateEl.value){
        show('入力欄はすでに空だ。');
        return;
      }
      if(!confirm('元テキストをすべて消す。いい？')) return;
      templateEl.value='';
      saveTemplate();
      if(templateExpanded) applyTemplateHeight();
      show('入力欄を空にした。');
    });
    document.getElementById('selectAll').addEventListener('click',()=>{selectedIds=new Set(characters.map(c=>c.id));saveChars();renderChars();show('全員選択した。');});
    document.getElementById('clearSelection').addEventListener('click',()=>{selectedIds=new Set();saveChars();renderChars();show('選択を解除した。');});
    document.getElementById('generate').addEventListener('click',generate);
    document.getElementById('addCharacter').addEventListener('click',()=>{const label=newLabelEl.value.trim();if(!label)return show('名前が空だ。',true);const c=normChar({id:uid(),baseLabel:label,variants:[label],selectedVariant:label});characters.push(c);selectedIds.add(c.id);newLabelEl.value='';saveChars();renderChars();show(`${label}を追加した。`);});
    document.getElementById('selectAllForDelete').addEventListener('click',()=>{deleteIds=new Set(characters.map(c=>c.id));renderDeleteCharacters();});
    document.getElementById('clearDeleteSelection').addEventListener('click',()=>{deleteIds.clear();renderDeleteCharacters();});
    deleteSelectedCharactersBtn.addEventListener('click',deleteSelectedCharacters);
    document.getElementById('copyAll').addEventListener('click',async()=>{if(!lastOutputs.length)return show('コピーする出力がまだない。',true);const all=lastOutputs.map(o=>`▼ ${o.label}用\n${o.text}`).join('\n\n---\n\n');if(await copyText(all,manualCopyEl,manualCopyTextEl,show))show('全部コピーした。');});
    document.getElementById('exportSettings').addEventListener('click',exportSettings);
    document.getElementById('copyExportSettings').addEventListener('click',copyExportSettings);
    document.getElementById('importSettings').addEventListener('click',importSettings);
    templateEl.addEventListener('input',()=>{
      saveTemplate();
      if(templateExpanded) applyTemplateHeight();
    });
    toggleTemplateSizeBtn.addEventListener('click',()=>{
      if(document.activeElement === templateEl) templateEl.blur();
      templateExpanded = !templateExpanded;
      applyTemplateHeight();
    });
    window.addEventListener('resize',applyTemplateHeight);
    templateEl.value=safeGet(KEYS.template,'')||'';saveChars();renderChars();renderOutputs();applyTemplateHeight();
