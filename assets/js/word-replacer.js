import { safeGet, safeSet, copyText } from './common.js';

'use strict';

(() => {
    const KEY='nakoWordReplacer.v1';
    const source=document.getElementById('wordSource'),toggleSourceSizeBtn=document.getElementById('toggleWordSourceSize'),rulesEl=document.getElementById('wordRules'),emptyRules=document.getElementById('wordEmptyRules'),deleteRuleListEl=document.getElementById('deleteRuleList'),emptyDeleteRulesEl=document.getElementById('emptyDeleteRules'),deleteRuleSelectionStatusEl=document.getElementById('deleteRuleSelectionStatus'),deleteSelectedRulesBtn=document.getElementById('deleteSelectedRules'),output=document.getElementById('wordOutput'),copyStatus=document.getElementById('wordCopyStatus'),fallback=document.getElementById('wordFallback'),fallbackText=document.getElementById('wordFallbackText'),exportBox=document.getElementById('wordExportBox'),importBox=document.getElementById('wordImportBox');
    let state=(()=>{try{const raw=safeGet(KEY);return raw?JSON.parse(raw):null;}catch{return null;}})()||{source:'',rules:[],lastOutput:''};if(!Array.isArray(state.rules))state.rules=[];
    function ruleUid(){return 'rule_'+Date.now()+'_'+Math.random().toString(16).slice(2);}
    state.rules=state.rules.map(rule=>({...rule,id:String(rule.id||ruleUid())}));
    let deleteRuleIds=new Set();
    function show(msg,bad=false){copyStatus.textContent=msg;copyStatus.style.color=bad?'#ffb3b3':'var(--ok)';}
    function save(){state.source=source.value;state.lastOutput=output.classList.contains('empty')?'':output.textContent;safeSet(KEY,JSON.stringify(state));}
    function escRegExp(v){return String(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
    function ruleLabel(rule,index){
      const from=String(rule.from||'').trim();
      const to=String(rule.to||'').trim();
      if(from||to)return `${from||'未入力'} → ${to||'未入力'}`;
      return `ルール ${index+1}`;
    }
    function renderDeleteRules(){
      const validIds=new Set(state.rules.map(rule=>rule.id));
      deleteRuleIds=new Set([...deleteRuleIds].filter(id=>validIds.has(id)));
      emptyDeleteRulesEl.style.display=state.rules.length?'none':'block';
      deleteRuleListEl.innerHTML='';

      state.rules.forEach((rule,index)=>{
        const label=document.createElement('label');
        label.className='delete-rule-option';

        const input=document.createElement('input');
        input.type='checkbox';
        input.checked=deleteRuleIds.has(rule.id);
        input.addEventListener('change',()=>{
          input.checked?deleteRuleIds.add(rule.id):deleteRuleIds.delete(rule.id);
          renderDeleteRules();
        });

        const name=document.createElement('span');
        name.textContent=ruleLabel(rule,index);

        label.append(input,name);
        deleteRuleListEl.append(label);
      });

      const count=deleteRuleIds.size;
      deleteRuleSelectionStatusEl.textContent=count?`${count}件を削除対象に選択中。`:'削除対象は未選択。';
      deleteSelectedRulesBtn.disabled=count===0;
    }
    function renderRules(){
      rulesEl.innerHTML='';
      emptyRules.style.display=state.rules.length?'none':'block';
      state.rules.forEach(rule=>{
        const row=document.createElement('div');
        row.className='rule';
        const check=document.createElement('input');
        check.type='checkbox';
        check.className='check';
        check.checked=rule.enabled!==false;
        check.addEventListener('change',()=>{rule.enabled=check.checked;save();});
        const from=document.createElement('input');
        from.className='from';
        from.placeholder='変換前';
        from.value=rule.from||'';
        from.addEventListener('input',()=>{rule.from=from.value;save();renderDeleteRules();});
        const arrow=document.createElement('div');
        arrow.className='arrow';
        arrow.textContent='→';
        const to=document.createElement('input');
        to.className='to';
        to.placeholder='変換後';
        to.value=rule.to||'';
        to.addEventListener('input',()=>{rule.to=to.value;save();renderDeleteRules();});
        row.append(check,from,arrow,to);
        rulesEl.append(row);
      });
      renderDeleteRules();
    }
    function deleteSelectedRules(){
      const targets=state.rules.filter(rule=>deleteRuleIds.has(rule.id));
      if(!targets.length)return show('削除するルールを選べ。',true);
      const labels=targets.map(rule=>`「${ruleLabel(rule,state.rules.indexOf(rule))}」`).join('、');
      if(!confirm(`${labels} の${targets.length}件を削除する。いい？`))return;
      const targetIds=new Set(targets.map(rule=>rule.id));
      state.rules=state.rules.filter(rule=>!targetIds.has(rule.id));
      deleteRuleIds.clear();
      renderRules();
      save();
      show(`${targets.length}件のルールを削除した。`);
    }
    function convertText(text,rules){const active=rules.filter(r=>r.enabled!==false&&r.from).map((r,i)=>({...r,i})).sort((a,b)=>b.from.length-a.from.length||a.i-b.i);if(!active.length||!text)return text;const map=new Map(active.map(r=>[r.from,r.to??'']));const pattern=active.map(r=>escRegExp(r.from)).join('|');return text.replace(new RegExp(pattern,'g'),m=>map.get(m));}
    let sourceExpanded = false;
    function getSourceCollapsedHeight(){
      const value = parseFloat(getComputedStyle(source).minHeight);
      return Number.isFinite(value) ? value : 220;
    }
    function getSourceExpandedHeight(){
      const maxHeight = Math.floor(window.innerHeight * 0.75);
      const collapsedHeight = getSourceCollapsedHeight();
      const contentHeight = Math.max(source.scrollHeight + 2, collapsedHeight);
      return Math.min(contentHeight, maxHeight);
    }
    function applySourceHeight(){
      if(window.matchMedia('(min-width: 768px)').matches){
        source.style.height = '';
        source.classList.remove('is-expanded');
        toggleSourceSizeBtn.setAttribute('aria-expanded','false');
        toggleSourceSizeBtn.textContent = '入力欄を広げる';
        return;
      }
      const targetHeight = sourceExpanded ? getSourceExpandedHeight() : getSourceCollapsedHeight();
      source.style.height = `${targetHeight}px`;
      source.classList.toggle('is-expanded', sourceExpanded);
      toggleSourceSizeBtn.setAttribute('aria-expanded', String(sourceExpanded));
      toggleSourceSizeBtn.textContent = sourceExpanded ? '元に戻す' : '入力欄を広げる';
    }

    function runConvert(){const result=convertText(source.value,state.rules);output.textContent=result||'出力が空だ。元テキストを入れろ。';output.classList.toggle('empty',!result);fallback.style.display='none';show('変換した。');save();}
    function buildBackup(){const data={tool:'word-replacer',version:3,source:source.value,rules:state.rules};exportBox.value=JSON.stringify(data,null,2);return exportBox.value;}function exportSettings(){buildBackup();show('設定バックアップを作った。');}async function copyExportSettings(){const text=buildBackup();if(await copyText(text,fallback,fallbackText,show))show('設定バックアップをコピーした。');}
    function importSettings(){try{const data=JSON.parse(importBox.value);const incoming=Array.isArray(data.rules)?data.rules:(Array.isArray(data)?data:[]);state.rules=incoming.map(r=>({id:String(r.id||ruleUid()),enabled:r.enabled!==false,from:String(r.from??''),to:String(r.to??'')}));deleteRuleIds.clear();if(typeof data.source==='string')source.value=data.source;renderRules();save();show('設定を復元した。');}catch{show('復元できない。バックアップ用テキストが壊れている。',true);}}
    document.getElementById('wordAddRule').addEventListener('click',()=>{state.rules.push({id:ruleUid(),enabled:true,from:'',to:''});renderRules();save();});
    document.getElementById('wordEnableAll').addEventListener('click',()=>{state.rules.forEach(r=>r.enabled=true);renderRules();save();});
    document.getElementById('wordDisableAll').addEventListener('click',()=>{state.rules.forEach(r=>r.enabled=false);renderRules();save();});
    document.getElementById('selectAllRulesForDelete').addEventListener('click',()=>{deleteRuleIds=new Set(state.rules.map(rule=>rule.id));renderDeleteRules();});
    document.getElementById('clearRuleDeleteSelection').addEventListener('click',()=>{deleteRuleIds.clear();renderDeleteRules();});
    deleteSelectedRulesBtn.addEventListener('click',deleteSelectedRules);
    document.getElementById('wordClearInput').addEventListener('click',()=>{
      if(!source.value){
        show('入力欄はすでに空だ。');
        return;
      }
      if(!confirm('元テキストをすべて消す。いい？')) return;
      source.value='';
      save();
      if(sourceExpanded) applySourceHeight();
      show('入力欄を空にした。');
    });
    document.getElementById('wordConvert').addEventListener('click',runConvert);
    document.getElementById('wordCopyOutput').addEventListener('click',async()=>{const text=output.classList.contains('empty')?'':output.textContent;if(!text)return show('コピーする出力がまだない。',true);if(await copyText(text,fallback,fallbackText,show))show('コピーした。');});
    document.getElementById('wordExportSettings').addEventListener('click',exportSettings);
    document.getElementById('wordCopyExportSettings').addEventListener('click',copyExportSettings);
    document.getElementById('wordImportSettings').addEventListener('click',importSettings);
    source.addEventListener('input',()=>{
      save();
      if(sourceExpanded) applySourceHeight();
    });
    toggleSourceSizeBtn.addEventListener('click',()=>{
      if(document.activeElement === source) source.blur();
      sourceExpanded = !sourceExpanded;
      applySourceHeight();
    });
    window.addEventListener('resize',applySourceHeight);
    source.value=state.source||'';if(state.lastOutput){output.textContent=state.lastOutput;output.classList.remove('empty');}renderRules();save();applySourceHeight();
  })();
