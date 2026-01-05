const TreeMap = (function() {
    function init() {
        const analyzeBtn = document.getElementById('analyze-btn');
        if (analyzeBtn) analyzeBtn.addEventListener('click', () => setTimeout(populateCodes, 1500));
        const btn = document.getElementById('treemap-btn');
        if(btn) btn.addEventListener('click', () => setTimeout(populateCodes, 100));
        
        const sel = document.getElementById('treemap-code-select');
        if(sel) {
            sel.addEventListener('change', drawMap);
            sel.addEventListener('click', () => { if(sel.options.length <= 1) populateCodes(); }); 
        }
    }

    function populateCodes() {
        if (!tables.current || !tables.current.ACTVTYPE) return;
        const select = document.getElementById('treemap-code-select');
        if(!select || select.options.length > 1) return; 

        select.innerHTML = '<option value="">Select Activity Code...</option>';
        Object.values(tables.current.ACTVTYPE).forEach(type => {
            const opt = document.createElement('option');
            opt.value = type.actvtype_id;
            opt.innerText = type.actv_short_name;
            select.appendChild(opt);
        });
    }

    function drawMap() {
        const typeId = document.getElementById('treemap-code-select').value;
        const container = document.getElementById('treemap-container');
        if(!container) return;
        container.innerHTML = '';
        if(!typeId) return;

        const groups = {}; let totalVal = 0; const codeMap = new Map();
        
        if(tables.current.ACTVCODE) {
            Object.values(tables.current.ACTVCODE).forEach(c => {
                if(String(c.actvtype_id) === String(typeId)) codeMap.set(String(c.actv_code_id), c.short_name);
            });
        }

        if(tables.current.TASKACTV) {
            Object.values(tables.current.TASKACTV).forEach(link => {
                const codeName = codeMap.get(String(link.actv_code_id));
                if(codeName) {
                    const task = [...projects.current.tasks.values()].find(t => t.task_id == link.task_id);
                    if(task) {
                        if(!groups[codeName]) groups[codeName] = { value:0, count:0, delayed:0 };
                        let metric = task.budgetCost || 1; 
                        groups[codeName].value += metric;
                        groups[codeName].count++;
                        if(task.totalFloat < 0) groups[codeName].delayed++;
                        totalVal += metric;
                    }
                }
            });
        }

        if(totalVal === 0) totalVal = 1;
        const sortedKeys = Object.keys(groups).sort((a,b) => groups[b].value - groups[a].value);

        sortedKeys.forEach(key => {
            const g = groups[key];
            const pct = (g.value / totalVal) * 100;
            const delayPct = (g.delayed / g.count);
            let color = delayPct > 0.2 ? '#ef4444' : (delayPct > 0.05 ? '#f59e0b' : '#10b981');

            const box = document.createElement('div');
            box.style.cssText = `flex-grow: ${Math.floor(pct*100)}; width: ${Math.max(pct, 15)}%; min-width: 120px; height: 120px; background-color: ${color}; color: white; padding: 10px; border-radius: 6px; overflow: hidden; cursor: pointer; margin-bottom: 5px;`;
            box.title = `${key}\nActivities: ${g.count}`;
            box.innerHTML = `<div style="font-weight:bold;">${key}</div><div style="font-size:0.85em;">${g.count} Acts</div>`;
            container.appendChild(box);
        });
    }
    document.addEventListener('DOMContentLoaded', init);
    return { init };
})();