// ============================================
// dcma.js — DCMA 14-Point Assessment
// ============================================
(function() {
    function init() {
        const analyzeBtn = document.getElementById('analyze-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', waitForDataAndRun);
        }
    }

    function waitForDataAndRun() {
        const checkInterval = setInterval(() => {
            if (typeof projects !== 'undefined' && projects.current && projects.current.tasks) {
                clearInterval(checkInterval);
                runDCMA();
            }
        }, 200);
    }

    function runDCMA() {
        const proj = projects.current;
        const tasks = [...proj.tasks.values()];
        const total = tasks.length || 1;
        const unfinished = tasks.filter(t => !t.completed).length || 1;

        // --- Metric Calculations ---
        const missingLogic = tasks.filter(t => (!t.predecessors.length || !t.successors.length) && !t.isLOE && !t.completed).length;
        const leads = proj.rels.filter(r => r.lag < 0).length;
        const lags = proj.rels.filter(r => r.lag > 0).length;
        const fsCount = proj.rels.filter(r => r.link === 'FS').length;
        const relTotal = proj.rels.length || 1;
        const hardConstr = tasks.filter(t => ['Mandatory Start','Mandatory Finish'].includes(t.primeConstraint)).length;
        const highFloat = tasks.filter(t => t.totalFloat > 44 && !t.completed).length;
        const negFloat = tasks.filter(t => t.totalFloat < 0).length;
        const highDur = tasks.filter(t => t.origDur > 44 && !t.isLOE).length;
        const invalidDates = tasks.filter(t => (t.notStarted && t.start < proj.last_recalc_date) || (t.inProgress && t.finish > proj.last_recalc_date)).length;
        const noRes = tasks.filter(t => !t.isMilestone && !t.isLOE && (!t.resources || !t.resources.length)).length;
        const missed = tasks.filter(t => t.completed && t.target_end_date && t.finish > t.target_end_date).length;
        
        // --- Render ---
        const report = [
            { name: "Missing Logic", val: missingLogic, limit: 0.05, total: total },
            { name: "Leads (Negative Lag)", val: leads, limit: 0.0, total: relTotal },
            { name: "Lags (Positive Lag)", val: lags, limit: 0.05, total: relTotal },
            { name: "Relationship Types (FS)", val: fsCount, limit: 0.90, total: relTotal, invert: true }, // Special case: Higher is better
            { name: "Hard Constraints", val: hardConstr, limit: 0.05, total: total },
            { name: "High Float (>44d)", val: highFloat, limit: 0.44, total: unfinished },
            { name: "Negative Float", val: negFloat, limit: 0.0, total: unfinished },
            { name: "High Duration (>44d)", val: highDur, limit: 0.05, total: total },
            { name: "Invalid Dates", val: invalidDates, limit: 0.0, total: total },
            { name: "Missing Resources", val: noRes, limit: 0.0, total: total },
            { name: "Missed Tasks", val: missed, limit: 0.05, total: total }
        ];

        renderTable(report);
    }

    function renderTable(data) {
        const container = document.getElementById('dcma-container');
        if (!container) return;

        let html = `<table style="width:100%; border-collapse:collapse; font-size:0.9em;">
            <tr style="background:#f1f5f9; border-bottom:2px solid #ccc;"><th style="padding:10px;">Check Name</th><th style="text-align:center;">Result</th><th style="text-align:center;">Status</th></tr>`;

        data.forEach(item => {
            const pct = item.val / item.total;
            // Logic: if 'invert' is true, we want pct >= limit (e.g. 90% FS). Otherwise we want pct <= limit.
            const pass = item.invert ? (pct >= item.limit) : (pct <= item.limit);
            
            const color = pass ? '#16a34a' : '#dc2626';
            const bg = pass ? '#dcfce7' : '#fee2e2';
            const status = pass ? 'PASS' : 'FAIL';

            html += `<tr style="border-bottom:1px solid #eee;">
                <td style="padding:8px; font-weight:500;">${item.name}</td>
                <td style="padding:8px; text-align:center;">${item.val} <span style="color:#888;">(${(pct*100).toFixed(1)}%)</span></td>
                <td style="padding:8px; text-align:center;"><span style="color:${color}; background:${bg}; padding:3px 8px; border-radius:4px; font-weight:bold;">${status}</span></td>
            </tr>`;
        });
        html += `</table>`;
        container.innerHTML = html;
    }

    document.addEventListener('DOMContentLoaded', init);
})();