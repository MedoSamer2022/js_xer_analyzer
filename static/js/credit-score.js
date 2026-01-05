// ============================================
// credit-score.js — Gamified Schedule Health
// ============================================
    const CreditScore = (function() {
    function init() {
        const analyzeBtn = document.getElementById('analyze-btn');
        if (analyzeBtn) analyzeBtn.addEventListener('click', () => setTimeout(calculateScore, 1500));
        // Also calc on button click in case analysis happened before load
        const btn = document.getElementById('score-btn');
        if(btn) btn.addEventListener('click', calculateScore);
    }

    function calculateScore() {
        if (!projects.current) return;
        const p = projects.current;
        const tasks = [...p.tasks.values()];
        const total = tasks.length || 1;

        let score = 100;
        let deductions = [];

        // Metrics
        const missingLogic = tasks.filter(t => (!t.predecessors.length || !t.successors.length) && !t.isLOE && !t.completed).length;
        if ((missingLogic / total) > 0.05) { score -= 15; deductions.push({name:"Missing Logic", val:"-15", color:"red"}); }
        
        const highFloat = tasks.filter(t => t.totalFloat > 44).length;
        if ((highFloat / total) > 0.40) { score -= 15; deductions.push({name:"High Float", val:"-15", color:"red"}); }

        const negFloat = tasks.filter(t => t.totalFloat < 0).length;
        if (negFloat > 0) { score -= 30; deductions.push({name:"Negative Float", val:"-30", color:"red"}); }

        const constraints = tasks.filter(t => t.primeConstraint && t.primeConstraint !== 'As Late as Possible').length;
        if ((constraints / total) > 0.05) { score -= 15; deductions.push({name:"Constraints", val:"-15", color:"orange"}); }

        const lags = p.rels.filter(r => r.lag > 0).length;
        if ((lags / p.rels.length) > 0.10) { score -= 10; deductions.push({name:"Lags", val:"-10", color:"orange"}); }

        if (score < 0) score = 0;

        // Render
        const valEl = document.getElementById('score-val');
        const textEl = document.getElementById('score-text');
        if(valEl) valEl.innerText = score;
        
        let color = '#22c55e'; 
        let txt = "Excellent";
        if (score < 90) { txt = "Good"; color = '#3b82f6'; }
        if (score < 75) { txt = "Fair"; color = '#f59e0b'; }
        if (score < 60) { txt = "High Risk"; color = '#ef4444'; }
        if(textEl) textEl.innerText = txt;

        const ctx = document.getElementById('creditScoreChart');
        if(ctx) {
            if(window.scoreChart) window.scoreChart.destroy();
            window.scoreChart = new Chart(ctx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: ['Score', 'Deficit'],
                    datasets: [{ data: [score, 100 - score], backgroundColor: [color, '#e2e8f0'], borderWidth: 0, circumference: 180, rotation: 270 }]
                },
                options: { aspectRatio: 1.5, cutout: '85%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
            });
        }

        const badges = document.getElementById('score-breakdown');
        if(badges) {
            badges.innerHTML = deductions.length === 0 
                ? `<div style="padding:10px 20px; background:#dcfce7; color:#166534; border-radius:20px;">✨ Clean Schedule!</div>`
                : deductions.map(d => `<div style="padding:8px 15px; border:1px solid ${d.color}; color:${d.color}; border-radius:8px;">${d.name}: ${d.val}</div>`).join('');
        }
    }
    document.addEventListener('DOMContentLoaded', init);
    return { init, calculateScore };
})();