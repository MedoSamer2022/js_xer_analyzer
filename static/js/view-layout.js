/*!
 * ViewLayout v2.4 (Fixes Crushed Columns)
 */
(function (window, document) {
  'use strict';

  var DEFAULTS = {
    containerSelector: '.cat, .split-grid',
    itemSelector: '.card',
    dragHandleSelector: 'h3',
    storageNamespace: 'xer_view_v2',
    injectGlobalButtons: true,
    autoInit: true,
    newSectionParentSelector: '#content',
    newSectionClass: 'cat custom-board',
    newSectionTitle: 'Custom Section'
  };

  var STATE = {
    opts: copy(DEFAULTS),
    draggingEl: null,
    dragPlaceholder: null,
    observer: null
  };

  function copy(obj) { var o = {}; for (var k in obj) if (has(obj,k)) o[k] = obj[k]; return o; }
  function has(o,k){ return Object.prototype.hasOwnProperty.call(o,k); }
  function q(sel,root){ return (root||document).querySelector(sel); }
  function qa(sel,root){ return (root||document).querySelectorAll(sel); }

  function matches(el, selector){
    if(!el) return false;
    var p = Element.prototype;
    var f = p.matches || p.msMatchesSelector || p.webkitMatchesSelector;
    return f ? f.call(el, selector) : false;
  }
  function closest(el, selector){
    while(el){ if(matches(el, selector)) return el; el = el.parentElement; }
    return null;
  }

  function pageKey(){ return document.title || 'page'; }
  function keyForSection(sec){
    var id = sec.id || sec.getAttribute('data-view-id') || 'section';
    return STATE.opts.storageNamespace + ':' + pageKey() + ':' + id;
  }

  function ensureItemId(card){
    var id = card.getAttribute('data-view-id');
    if(!id){
      var h = card.querySelector(STATE.opts.dragHandleSelector);
      var base = (h && h.textContent ? h.textContent.trim() : 'card')
        .toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9\-]/g,'');
      id = base + '-' + Date.now() + '-' + Math.floor(Math.random()*10000);
      card.setAttribute('data-view-id', id);
    }
    return id;
  }

  function ensurePlaceholder(){
    if(STATE.dragPlaceholder) return STATE.dragPlaceholder;
    var ph = document.createElement('div');
    ph.className = 'vm-placeholder';
    STATE.dragPlaceholder = ph;
    return ph;
  }
  function removePlaceholder(){
    if(STATE.dragPlaceholder && STATE.dragPlaceholder.parentNode){
      STATE.dragPlaceholder.parentNode.removeChild(STATE.dragPlaceholder);
    }
  }

  // ----- Resizers -----
  function addResizers(card){
    if(card.__vmResized) return;
    card.__vmResized = true;
    if(!card.style.position) card.style.position = 'relative';
    addResizer(card, 's'); addResizer(card, 'e'); addResizer(card, 'se');
  }

  function addResizer(card, type){
    var cls = (type==='s') ? 'vm-resizer-s' : (type==='e' ? 'vm-resizer-e' : 'vm-resizer-se');
    if(card.querySelector('.'+cls)) return;

    var grip = document.createElement('div');
    grip.className = cls;
    card.appendChild(grip);

    var startX=0, startY=0, startW=0, startH=0, dragging=false;

    function onMove(e){
      if(!dragging) return;
      var cx = e.touches ? e.touches[0].clientX : e.clientX;
      var cy = e.touches ? e.touches[0].clientY : e.clientY;
      var dx = cx - startX;
      var dy = cy - startY;

      if(type==='e' || type==='se'){
        var newW = Math.max(300, startW + dx); // Force min width 300
        card.style.width = newW + 'px';
        card.style.flex = '0 0 auto';
      }
      if(type==='s' || type==='se'){
        var newH = Math.max(180, startH + dy);
        card.style.height = newH + 'px';
      }
    }
    function onUp(){
      dragging=false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if(typeof window.resizeVisibleCharts === 'function'){ try { window.resizeVisibleCharts(); } catch(_){} }
    }
    function onDown(e){
      e.preventDefault(); 
      dragging=true;
      startX = e.touches ? e.touches[0].clientX : e.clientX;
      startY = e.touches ? e.touches[0].clientY : e.clientY;
      startW = parseInt(window.getComputedStyle(card).width,  10) || card.offsetWidth;
      startH = parseInt(window.getComputedStyle(card).height, 10) || card.offsetHeight;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }
    grip.addEventListener('mousedown', onDown);
    grip.addEventListener('dblclick', function(){
      if(type==='e'){ card.style.width=''; card.style.flex=''; }
      else if(type==='s'){ card.style.height=''; }
      else { card.style.width=''; card.style.height=''; card.style.flex=''; }
      if(typeof window.resizeVisibleCharts === 'function'){ try { window.resizeVisibleCharts(); } catch(_){} }
    });
  }

  // ----- Drag Logic -----
  function makeDraggable(card){
    card.setAttribute('draggable', 'false');
    var handle = card.querySelector(STATE.opts.dragHandleSelector);
    if(!handle) return;

    handle.style.cursor = 'grab';
    handle.style.userSelect = 'none'; 
    handle.addEventListener('mousedown', function(e){ if(e.button === 0) card.setAttribute('draggable', 'true'); });
    
    function disableDrag(){ if(!STATE.draggingEl) card.setAttribute('draggable', 'false'); }
    handle.addEventListener('mouseup', disableDrag);
    handle.addEventListener('mouseleave', disableDrag);

    card.addEventListener('dragstart', function(e){
      if(card.getAttribute('draggable') !== 'true'){ e.preventDefault(); return; }
      STATE.draggingEl = card;
      ensureItemId(card);
      card.classList.add('vm-dragging');
      if(e.dataTransfer){ e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'drag'); } catch(_){} }
      ensurePlaceholder();
    });

    card.addEventListener('dragend', function(){
      card.classList.remove('vm-dragging');
      card.setAttribute('draggable', 'false');
      STATE.draggingEl = null;
      removePlaceholder();
    });
  }

  function bindContainerDnD(sec){
    if(sec.__vmBound) return;
    sec.__vmBound = true;
    sec.addEventListener('dragover', function(e){
      if(!STATE.draggingEl) return;
      e.preventDefault();
      var activeContainer = closest(e.target, STATE.opts.containerSelector) || sec;
      var overCard = closest(e.target, STATE.opts.itemSelector);
      var ph = ensurePlaceholder();

      if(overCard && overCard.parentElement === activeContainer){
        var r = overCard.getBoundingClientRect();
        var before = (e.clientY - r.top) < r.height/2;
        if(before){ if(ph !== overCard.previousSibling) activeContainer.insertBefore(ph, overCard); }
        else{ if(ph !== overCard.nextSibling) activeContainer.insertBefore(ph, overCard.nextSibling); }
      }else{ if(ph.parentElement !== activeContainer) activeContainer.appendChild(ph); }
    });

    sec.addEventListener('drop', function(e){
      if(!STATE.draggingEl) return;
      e.preventDefault();
      var activeContainer = closest(e.target, STATE.opts.containerSelector) || sec;
      var ph = ensurePlaceholder();
      if(ph.parentElement === activeContainer) activeContainer.insertBefore(STATE.draggingEl, ph);
      else activeContainer.appendChild(STATE.draggingEl);
      removePlaceholder();
      if(typeof window.resizeVisibleCharts === 'function') setTimeout(function(){ window.resizeVisibleCharts(); }, 50);
    });
  }

  // ----- Save/Load -----
  function saveSection(sec){
    var key = keyForSection(sec);
    var model = [];
    var cards = qa(STATE.opts.itemSelector, sec);
    for(var i=0;i<cards.length;i++){
      var c = cards[i];
      var id = ensureItemId(c);
      var h = parseInt(window.getComputedStyle(c).height, 10);
      var w = parseInt(window.getComputedStyle(c).width,  10);
      model.push({ id: id, height: isNaN(h)?null:h, width: isNaN(w)?null:w });
    }
    try { localStorage.setItem(key, JSON.stringify(model)); } catch(_){}
  }

  function loadSection(sec){
    var key = keyForSection(sec), model=null;
    try { model = JSON.parse(localStorage.getItem(key)||'null'); } catch(_){}
    if(!model || !model.length) return;

    var live = {};
    var cards = qa(STATE.opts.itemSelector, sec);
    for(var i=0;i<cards.length;i++) live[ensureItemId(cards[i])] = cards[i];

    var anchor=null;
    for(var j=0;j<model.length;j++){
      var row = model[j];
      var card = live[row.id];
      if(!card) continue;
      
      // CRITICAL FIX: Ensure width is at least 320px to prevent "crushed" columns
      if(row.width && isFinite(row.width)){ 
          var safeWidth = Math.max(row.width, 320); 
          card.style.width=safeWidth+'px'; 
          card.style.flex='0 0 auto'; 
      }
      
      if(row.height && isFinite(row.height)){ card.style.height=row.height+'px'; }
      if(!anchor){ sec.insertBefore(card, sec.firstChild); anchor=card; }
      else{ sec.insertBefore(card, anchor.nextSibling); anchor=card; }
    }
  }

  function resetSection(sec){
    try { localStorage.removeItem(keyForSection(sec)); } catch(_){}
    var cards = qa(STATE.opts.itemSelector, sec);
    for(var i=0;i<cards.length;i++){
      cards[i].style.width = ''; cards[i].style.height= ''; cards[i].style.flex = '';
    }
  }

  function decorateSection(sec){
    bindContainerDnD(sec);
    var cards = qa(STATE.opts.itemSelector, sec);
    for(var i=0;i<cards.length;i++){
      ensureItemId(cards[i]); makeDraggable(cards[i]); addResizers(cards[i]);
    }
    loadSection(sec);
  }

  function startObserver(){
    if(STATE.observer) return;
    STATE.observer = new MutationObserver(function(muts){
      for(var i=0;i<muts.length;i++){
        var added = muts[i].addedNodes || [];
        for(var j=0;j<added.length;j++){
          var node = added[j];
          if(!(node instanceof HTMLElement)) continue;
          if(matches(node, STATE.opts.containerSelector)) decorateSection(node);
          else {
             if(matches(node, STATE.opts.itemSelector)){
                var p = closest(node, STATE.opts.containerSelector);
                if(p) { ensureItemId(node); makeDraggable(node); addResizers(node); }
             }
          }
        }
      }
    });
    STATE.observer.observe(document.body, { childList:true, subtree:true });
  }

  function injectToolbar(){
    if(!STATE.opts.injectGlobalButtons) return;
    if(q('.vm-toolbar')) return;
    var bar = document.createElement('div');
    bar.className = 'vm-toolbar';
    bar.innerHTML =
      '<button class="vm-btn" id="vm-save">Save View</button>' +
      '<button class="vm-btn vm-danger" id="vm-reset">Reset View</button>';
    document.body.appendChild(bar);

    q('#vm-save').addEventListener('click', function(){ var secs = qa(STATE.opts.containerSelector); for(var i=0;i<secs.length;i++) saveSection(secs[i]); });
    q('#vm-reset').addEventListener('click', function(){ 
        var secs = qa(STATE.opts.containerSelector); 
        for(var i=0;i<secs.length;i++) resetSection(secs[i]); 
        // Force refresh to clear cached crushed sizes
        setTimeout(function(){ window.location.reload(); }, 100);
    });
  }

  var API = {
    init: function(options){
      if(options) for(var k in options) if(has(options,k)) STATE.opts[k]=options[k];
      var secs = qa(STATE.opts.containerSelector);
      for(var i=0;i<secs.length;i++) decorateSection(secs[i]);
      startObserver();
      injectToolbar();
      window.addEventListener('mouseup', function(){ if(typeof window.resizeVisibleCharts === 'function') try{ window.resizeVisibleCharts(); }catch(_){} });
    }
  };
  window.ViewLayout = API;
  if(DEFAULTS.autoInit) document.addEventListener('DOMContentLoaded', function(){ API.init(); });

})(window, document);