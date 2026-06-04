/* Cube Blast — LOBBY 2D resource editor addon (DEV ONLY, never shipped).
   Standalone (no Three.js). Edits lobby UI/background via data-edit-id, same schema as the in-game
   editor: {dx,dy,w,h,scale,rot,font,asset}. Stores under the "lobby" namespace. Export → single JSON
   (lobby section) for backend-free static deploy; build_lobby.py bakes that section. */
(function(){
  'use strict';
  function el(tag, cls, txt){ const e=document.createElement(tag); if(cls)e.className=cls; if(txt!=null)e.textContent=txt; return e; }

  // 편집 대상 트리(분해 단위). @로 시작=가상(배경 등 CSS 변수).
  const TREE = [
    {grp:'상단(코인/컬렉션/설정)', items:[
      {id:'lobby-top',      label:'상단바 전체'},
      {id:'lobby-coinbar',  label:'· 코인바 전체'},
      {id:'lobby-coin-icon',label:'·· 코인 아이콘', img:true},
      {id:'lobby-coinval',  label:'·· 코인 숫자', font:true},
      {id:'lobby-collbtn',  label:'· 컬렉션 버튼', img:true},
      {id:'lobby-gear',     label:'· 설정(기어)', img:true},
    ]},
    {grp:'플레이/진행', items:[
      {id:'lobby-play',     label:'플레이 버튼', img:true},
      {id:'lobby-progress', label:'디오라마 진행바', img:true},
    ]},
    {grp:'컬렉션 페이지', items:[
      {id:'lobby-coll-back', label:'뒤로 버튼', img:true},
      {id:'lobby-coll-title',label:'컬렉션 제목', font:true},
      {id:'lobby-coll-prev', label:'이전 화살표', img:true},
      {id:'lobby-coll-next', label:'다음 화살표', img:true},
      {id:'lobby-coll-name', label:'디오라마 이름', font:true},
      {id:'lobby-coll-count',label:'카운터', font:true},
    ]},
    {grp:'배경', items:[
      {id:'@lobby-bg', label:'로비 배경 이미지', img:true, bgvar:'--bg2'},
    ]},
  ];
  const META={}; TREE.forEach(g=>g.items.forEach(it=>META[it.id]=it));

  let cfg={}, sel=null, outline=null, bar=null, treeWrap=null, observer=null;
  const undo=[]; const UMAX=100;
  function obj(id){ return (cfg[id]=cfg[id]||{}); }
  function hasOv(o){ return o && (o.dx||o.dy||o.w||o.h||(o.scale&&o.scale!==1)||o.rot||o.font||o.asset); }
  function elById(id){ if(id&&id[0]==='@')return null; return document.querySelector('[data-edit-id="'+id+'"]'); }

  function applyOne(id){
    const o=obj(id), meta=META[id]||{};
    if(id[0]==='@'){ if(meta.bgvar&&o.asset) document.documentElement.style.setProperty(meta.bgvar,'url("'+o.asset+'")'); return; }
    document.querySelectorAll('[data-edit-id="'+id+'"]').forEach(e2=>{
      const p=[];
      if(o.dx||o.dy)p.push('translate('+(o.dx||0)+'px,'+(o.dy||0)+'px)');
      if(o.rot)p.push('rotate('+o.rot+'deg)');
      if(o.scale&&o.scale!==1)p.push('scale('+o.scale+')');
      e2.style.transform=p.length?p.join(' '):''; if(p.length)e2.style.transformOrigin='center center';
      e2.style.width=o.w?(o.w+'px'):''; e2.style.height=o.h?(o.h+'px'):'';
      if(o.font)e2.style.fontSize=o.font+'px';
      if(o.asset){ if(e2.tagName==='IMG')e2.src=o.asset; else { e2.style.backgroundImage='url("'+o.asset+'")'; if(!e2.style.backgroundSize)e2.style.backgroundSize='contain'; if(!e2.style.backgroundRepeat)e2.style.backgroundRepeat='no-repeat'; if(!e2.style.backgroundPosition)e2.style.backgroundPosition='center'; } }
    });
  }
  function applyAll(){ for(const id in cfg){ if(hasOv(cfg[id])) applyOne(id); } }
  function ensureObserver(){ if(observer)return; observer=new MutationObserver(ms=>{ let t=0; ms.forEach(m=>m.addedNodes.forEach(n=>{ if(n.nodeType!==1)return; if(n.getAttribute&&n.getAttribute('data-edit-id')){ const id=n.getAttribute('data-edit-id'); if(hasOv(obj(id))){applyOne(id);t=1;} } if(n.querySelectorAll)n.querySelectorAll('[data-edit-id]').forEach(k=>{ const id=k.getAttribute('data-edit-id'); if(hasOv(obj(id))){applyOne(id);t=1;} }); })); if(t)outlineUpdate(); }); observer.observe(document.body,{childList:true,subtree:true}); }

  function pushUndo(id){ const o=obj(id); undo.push({id, before:JSON.parse(JSON.stringify(o))}); if(undo.length>UMAX)undo.shift(); upUndoLbl(); }
  function doUndo(){ const u=undo.pop(); if(!u)return; upUndoLbl(); const o=obj(u.id); for(const k in o)delete o[k]; Object.assign(o,u.before); const e2=elById(u.id); if(e2){e2.style.transform='';e2.style.fontSize='';e2.style.width='';e2.style.height=''; if(!u.before.asset&&e2.tagName!=='IMG')e2.style.backgroundImage='';} applyOne(u.id); outlineUpdate(); buildBar(); }
  function upUndoLbl(){ const b=[...document.querySelectorAll('.ed-btn')].find(x=>/Undo/.test(x.textContent)); if(b)b.textContent='↶ Undo('+undo.length+')'; }

  function outlineUpdate(){
    if(!sel||!outline){ if(outline)outline.style.display='none'; return; }
    if(sel.id[0]==='@'){ outline.style.display='none'; return; }
    const e2=elById(sel.id); if(!e2){ outline.style.display='none'; return; }
    const r=e2.getBoundingClientRect();
    outline.style.display='block'; outline.style.left=r.left+'px'; outline.style.top=r.top+'px';
    outline.style.width=Math.max(10,r.width)+'px'; outline.style.height=Math.max(10,r.height)+'px';
    const o=obj(sel.id); outline.style.transform=o.rot?('rotate('+o.rot+'deg)'):'';
  }
  function ensureOutline(){
    if(outline)return;
    outline=el('div','ed-ui-outline');
    const hS=el('div','ed-ui-handle ed-h-scale'), hR=el('div','ed-ui-handle ed-h-rot');
    outline.appendChild(hS); outline.appendChild(hR);
    let mv=null,sc=null,rt=null;
    outline.addEventListener('pointerdown',e=>{ if(e.target!==outline||!sel)return; e.preventDefault();e.stopPropagation(); pushUndo(sel.id); const o=obj(sel.id); mv={x:e.clientX,y:e.clientY,dx0:o.dx||0,dy0:o.dy||0}; outline.setPointerCapture(e.pointerId); });
    outline.addEventListener('pointermove',e=>{ if(!mv||!sel)return; const o=obj(sel.id); o.dx=Math.round(mv.dx0+(e.clientX-mv.x)); o.dy=Math.round(mv.dy0+(e.clientY-mv.y)); applyOne(sel.id); outlineUpdate(); syncBar(); });
    outline.addEventListener('pointerup',()=>mv=null);
    hS.addEventListener('pointerdown',e=>{ if(!sel)return; e.preventDefault();e.stopPropagation(); pushUndo(sel.id); sc={y:e.clientY,s0:obj(sel.id).scale||1}; hS.setPointerCapture(e.pointerId); });
    hS.addEventListener('pointermove',e=>{ if(!sc||!sel)return; const o=obj(sel.id); o.scale=Math.max(0.2,Math.min(4,+(sc.s0+(e.clientY-sc.y)/120).toFixed(3))); applyOne(sel.id); outlineUpdate(); syncBar(); });
    hS.addEventListener('pointerup',()=>sc=null);
    hR.addEventListener('pointerdown',e=>{ if(!sel)return; e.preventDefault();e.stopPropagation(); pushUndo(sel.id); const e2=elById(sel.id); if(!e2)return; const r=e2.getBoundingClientRect(); rt={cx:r.left+r.width/2,cy:r.top+r.height/2,r0:obj(sel.id).rot||0,a0:Math.atan2(e.clientY-(r.top+r.height/2),e.clientX-(r.left+r.width/2))}; hR.setPointerCapture(e.pointerId); });
    hR.addEventListener('pointermove',e=>{ if(!rt||!sel)return; const o=obj(sel.id); const a=Math.atan2(e.clientY-rt.cy,e.clientX-rt.cx); let d=Math.round(rt.r0+(a-rt.a0)*180/Math.PI); o.rot=((d%360)+360)%360; if(o.rot>180)o.rot-=360; applyOne(sel.id); outlineUpdate(); syncBar(); });
    hR.addEventListener('pointerup',()=>rt=null);
    document.body.appendChild(outline);
  }
  // 컬렉션 페이지 요소(lobby-coll-*)는 #collView 가 숨겨져 있으면 편집 불가 → 선택 시 임시로 해당 뷰를 표시.
  function ensureViewFor(id){
    const coll=document.getElementById('collView'), home=document.getElementById('homeView');
    if(!coll||!home) return;
    const wantColl = /^lobby-coll-/.test(id);
    if(wantColl && !coll.classList.contains('active')){ home.classList.remove('active'); coll.classList.add('active'); }
    else if(!wantColl && coll.classList.contains('active') && id!=='@lobby-bg'){ coll.classList.remove('active'); home.classList.add('active'); }
  }
  function select(item){ sel=item; ensureViewFor(item.id); ensureOutline(); requestAnimationFrame(()=>outlineUpdate()); buildBar(); }
  function syncBar(){ if(!bar||!sel)return; const o=obj(sel.id); bar.querySelectorAll('input.ed-range,input.ed-num2').forEach(s=>{ const k=s.dataset.k; if(!k)return; s.value=(o[k]!=null?o[k]:(k==='scale'?1:0)); }); }
  function treeDots(){ if(!treeWrap)return; treeWrap.querySelectorAll('.ed-tree-item').forEach(b=>{ const d=b.querySelector('.ed-tree-dot'); if(d)d.classList.toggle('on',hasOv(obj(b.dataset.id))); }); }
  function buildTree(){ if(!treeWrap)treeWrap=el('div','ed-tree'); treeWrap.innerHTML='';
    TREE.forEach(g=>{ treeWrap.appendChild(el('div','ed-tree-grp',g.grp)); g.items.forEach(it=>{ const b=el('div','ed-tree-item',it.label); b.dataset.id=it.id; const dot=el('span','ed-tree-dot'); if(hasOv(obj(it.id)))dot.classList.add('on'); b.insertBefore(dot,b.firstChild); if(sel&&sel.id===it.id)b.classList.add('on'); b.onclick=()=>select(it); treeWrap.appendChild(b); }); }); }
  function buildBar(){
    if(!bar){ bar=el('div','ed-uibar'); document.body.appendChild(bar); }
    bar.innerHTML=''; bar.appendChild(el('div','ed-sec','로비 2D 리소스')); buildTree(); bar.appendChild(treeWrap);
    if(sel){
      const meta=META[sel.id]||{};
      bar.appendChild(el('div','ed-sec','▸ '+(meta.label||sel.id)));
      const mk=(lbl,key,min,max,step)=>{ const o=obj(sel.id); const r=el('div','ed-row'); r.appendChild(el('label','ed-lbl',lbl));
        const s=el('input','ed-range'); s.type='range'; s.min=min;s.max=max;s.step=step; s.dataset.k=key; s.value=(o[key]!=null?o[key]:(key==='scale'?1:0));
        const n=el('input','ed-num2'); n.type='number'; n.min=min;n.max=max;n.step=step; n.dataset.k=key; n.value=s.value;
        const ap=v=>{ obj(sel.id)[key]=+v; applyOne(sel.id); outlineUpdate(); s.value=v;n.value=v; treeDots(); };
        s.addEventListener('pointerdown',()=>pushUndo(sel.id)); s.addEventListener('input',()=>ap(s.value));
        n.addEventListener('focus',()=>pushUndo(sel.id)); n.addEventListener('input',()=>ap(n.value));
        r.appendChild(s);r.appendChild(n); bar.appendChild(r); };
      if(sel.id[0]!=='@'){ mk('좌우(X)','dx',-300,300,1); mk('상하(Y)','dy',-300,300,1); mk('크기','scale',0.2,4,0.01); mk('회전(°)','rot',-180,180,1); mk('폭(px)','w',0,400,1); mk('높이(px)','h',0,400,1); if(meta.font)mk('폰트(px)','font',8,64,1); }
      if(meta.img){
        const dz=el('div','ed-drop'); const o=obj(sel.id);
        dz.innerHTML=o.asset?'<img class="ed-drop-thumb" src="'+o.asset+'"><div class="ed-drop-x">이미지 교체됨 · 클릭/드롭 변경 · ✕제거</div>':'<div class="ed-drop-hint">📁 이미지 드래그&드롭<br>또는 클릭해서 파일 선택</div>';
        const fi=el('input'); fi.type='file'; fi.accept='image/*'; fi.style.display='none'; dz.appendChild(fi);
        const setImg=f=>{ if(!f)return; const rd=new FileReader(); rd.onload=()=>{ pushUndo(sel.id); obj(sel.id).asset=rd.result; applyOne(sel.id); buildBar(); treeDots(); flash('이미지 교체됨'); }; rd.readAsDataURL(f); };
        dz.onclick=e=>{ if(e.target.classList.contains('ed-drop-x')&&o.asset){ pushUndo(sel.id); const e2=elById(sel.id); delete obj(sel.id).asset; if(e2&&e2.tagName!=='IMG')e2.style.backgroundImage=''; applyOne(sel.id); buildBar(); treeDots(); return; } fi.click(); };
        dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('over');}); dz.addEventListener('dragleave',()=>dz.classList.remove('over'));
        dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('over'); if(e.dataTransfer.files[0])setImg(e.dataTransfer.files[0]);});
        fi.addEventListener('change',()=>{ if(fi.files[0])setImg(fi.files[0]); });
        bar.appendChild(dz);
      }
      const rb=el('span','ed-uibtn','↺ 이 요소 리셋'); rb.onclick=()=>{ pushUndo(sel.id); const e2=elById(sel.id); cfg[sel.id]={}; if(e2){e2.style.transform='';e2.style.fontSize='';e2.style.width='';e2.style.height='';e2.style.backgroundImage='';} if(sel.id[0]==='@'&&meta.bgvar)document.documentElement.style.removeProperty(meta.bgvar); outlineUpdate(); buildBar(); treeDots(); };
      bar.appendChild(rb);
      bar.appendChild(el('div','ed-tip','목록 선택 → 외곽 드래그=이동 · ◣크기 · ↻회전 · 숫자입력 · 이미지 드롭 교체'));
    }
  }

  function serialize(){ const out={}; for(const id in cfg){ if(hasOv(cfg[id]))out[id]=cfg[id]; } return {lobby:out}; }
  function exportJSON(){ const data=serialize(); const blob=new Blob([JSON.stringify(data,null,1)],{type:'application/json'}); const a=el('a'); a.href=URL.createObjectURL(blob); a.download='lobby_config.json'; document.body.appendChild(a);a.click();a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),5000); flash('Export ✓ lobby_config.json (asset 포함)'); }
  function importJSON(){ const fi=el('input'); fi.type='file'; fi.accept='application/json,.json'; fi.style.display='none'; fi.onchange=()=>{ const f=fi.files[0]; if(!f)return; const rd=new FileReader(); rd.onload=()=>{ try{ const d=JSON.parse(rd.result); cfg=(d.lobby||d)||{}; applyAll(); buildBar(); outlineUpdate(); flash('Import ✓'); }catch(e){ flash('Import 실패: '+e.message); } }; rd.readAsText(f); }; document.body.appendChild(fi);fi.click();fi.remove(); }
  async function save(){ try{ const r=await fetch('/api/save-lobby',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(serialize())}); const j=await r.json(); flash(j.ok?'저장됨 ✓':'저장 실패'); }catch(e){ flash('저장 오류(정적 모드면 Export 사용)'); } }

  let toastT=null;
  function flash(m){ let t=document.getElementById('ed-toast'); if(!t){t=el('div');t.id='ed-toast';document.body.appendChild(t);} t.textContent=m; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),1800); }

  function buildUI(){
    const b=el('div','ed-bar'); b.innerHTML='<b>LOBBY EDITOR</b>';
    const mk=(l,t,fn)=>{ const x=el('button','ed-btn',l); x.title=t; x.onclick=fn; b.appendChild(x); return x; };
    mk('↶ Undo','되돌리기',()=>doUndo());
    mk('💾 저장','로컬 서버에 저장',()=>save());
    mk('⬇ Export','전체 설정(이미지 포함) JSON 다운로드',()=>exportJSON());
    mk('⬆ Import','JSON 불러오기',()=>importJSON());
    document.body.appendChild(b);
    document.body.classList.add('ed-uimode');
    ensureObserver(); ensureOutline();
    if(window.__EDITOR_CONFIG&&window.__EDITOR_CONFIG.lobby) cfg=JSON.parse(JSON.stringify(window.__EDITOR_CONFIG.lobby));
    applyAll();
    sel=TREE[0].items[1]; buildBar(); outlineUpdate();
    flash('로비 리소스 편집 준비됨');
  }
  // 화면 요소 직접 클릭 → 선택(가장 깊은 data-edit-id)
  document.addEventListener('pointerdown',e=>{ if(outline&&outline.contains(e.target))return; if(bar&&bar.contains(e.target))return; if(e.target.closest&&e.target.closest('.ed-bar'))return; const hit=e.target.closest&&e.target.closest('[data-edit-id]'); if(hit&&META[hit.getAttribute('data-edit-id')]){ select(META[hit.getAttribute('data-edit-id')]); e.preventDefault();e.stopPropagation(); } },true);
  document.addEventListener('click',e=>{ const hit=e.target.closest&&e.target.closest('[data-edit-id]'); if(hit&&META[hit.getAttribute('data-edit-id')]){ e.stopPropagation();e.preventDefault(); } },true);
  window.addEventListener('resize',()=>outlineUpdate());
  window.addEventListener('keydown',e=>{ if(e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return; if((e.metaKey||e.ctrlKey)&&e.code==='KeyZ'){e.preventDefault();doUndo();} },true);

  if(document.readyState!=='loading') setTimeout(buildUI,200); else document.addEventListener('DOMContentLoaded',()=>setTimeout(buildUI,200));
  window.__LOBBY_ED={ select:(id)=>select(META[id]||TREE[0].items[0]), set:(id,k,v)=>{pushUndo(id);obj(id)[k]=v;applyOne(id);outlineUpdate();syncBar();treeDots();}, setAsset:(id,u)=>{pushUndo(id);obj(id).asset=u;applyOne(id);buildBar();}, get:(id)=>({...obj(id)}), serialize, exportJSON, importJSON };
})();
