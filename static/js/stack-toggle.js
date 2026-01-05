
// stack-toggle.js — toggles .stack-view on grids/sections and remembers choice
(function(){
  var STORAGE_NS = 'xer_view_v5';
  var STACK_KEY = STORAGE_NS + ':__stack__:' + (document.title || 'page');

  function applyStackMode(on) {
    var targets = document.querySelectorAll('.split-grid, .cat');
    for (var i = 0; i < targets.length; i++) {
      if (on) targets[i].classList.add('stack-view');
      else    targets[i].classList.remove('stack-view');
    }
    try { localStorage.setItem(STACK_KEY, on ? '1' : '0'); } catch(_){}
    if (typeof window.resizeVisibleCharts === 'function') {
      setTimeout(function(){ window.resizeVisibleCharts(); }, 100);
    }
  }

  function initStackFromStorage(){
    var saved = null;
    try { saved = localStorage.getItem(STACK_KEY); } catch(_){}
    applyStackMode(saved === '1');
  }

  document.addEventListener('DOMContentLoaded', function(){
    initStackFromStorage();

    // If your toolbar exists, add a button there dynamically
    var bar = document.querySelector('.vm-toolbar');
    if (bar && !document.getElementById('vm-stack-toggle')) {
      var btn = document.createElement('button');
      btn.className = 'vm-btn';
      btn.id = 'vm-stack-toggle';
      btn.textContent = 'Stack View';
      btn.addEventListener('click', function(){
        var any = Array.from(document.querySelectorAll('.split-grid, .cat'))
                       .some(function(t){ return t.classList.contains('stack-view'); });
        applyStackMode(!any);
      });
      bar.appendChild(btn);
    }
  });
})();
