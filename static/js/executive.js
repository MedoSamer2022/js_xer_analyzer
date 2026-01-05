// ============================================
// executive.js — Scorecard & S-Curve
// Features: Health Check + Cumulative Cost Curve
// ============================================

(function(){
    // Configuration for Health Scorecard Limits
    const THRESHOLDS = {
        MISSING_LOGIC: 0.05, // Max 5% allowed
        HIGH_FLOAT: 0.44,    // Max 44% allowed
        NEG_FLOAT: 0.00,     // 0% allowed (Fail if any exist)
        HIGH_DUR: 0.05,      // Max 5% allowed
        INVALID_DATES: 0.00  // 0% allowed
    };

    let sCurveChartInstance = null;

    document.addEventListener('DOMContentLoaded', () => {
        const analyzeBtn = document.getElementById('analyze-btn');
        if(analyzeBtn){
            analyzeBtn.addEventListener('click', () => {
                // Wait for main.js to finish parsing and analyzing
                // We use a small timeout to allow the event loop to clear
                setTimeout(generateExecutiveReport, 800); 
            });
        }
    });

    function generateExecutiveReport() {
        // Safety Check
        if (typeof projects === 'undefined' || !projects.current || !projects.current.tasks) {
            console.warn("Executive Report: Project data not ready yet.");
            return;
        }
        
        const proj = projects.current;
        const tasks = [...proj.tasks.values()];
        const totalT = proj.tasks.size || 1;

        // --- 1. Calculate Scorecard Metrics ---
        
        // Missing Logic (Open Ends)
        const openPred = tasks.filter(t => !t.predecessors.length).length;
        const openSucc = tasks.filter(t => !t.successors.length).length;
        const missingLogicCount = openPred + openSucc;

        // High Float (> 44 days)
        const highFloatCount = tasks.filter(t => t.totalFloat > 44).length;

        // Negative Float (Any task < 0)
        const negFloatCount = tasks.filter(t => t.totalFloat < 0).length;

        // High Duration (> 44 days, excluding LOE)
        const highDurCount = tasks.filter(t => !t.isLOE && t.origDur > 44).length;

        // Invalid Dates (Using main.js warnings if available, else 0)
        let invalidDateCount = 0;
        if(typeof dateWarnings !== 'undefined' && dateWarnings.expected) {
            invalidDateCount = dateWarnings.expected.data.length + 
                               dateWarnings.start.data.length + 
                               dateWarnings.finish.data.length;
        }

        const metrics = [
            { name: "Missing Logic", val: missingLogicCount, pct: missingLogicCount/totalT, limit: THRESHOLDS.MISSING_LOGIC },
            { name: "High Float (>44d)", val: highFloatCount, pct: highFloatCount/totalT, limit: THRESHOLDS.HIGH_FLOAT },
            { name: "Negative Float", val: negFloatCount, pct: negFloatCount/totalT, limit: THRESHOLDS.NEG_FLOAT },
            { name: "High Duration (>44d)", val: highDurCount, pct: highDurCount/totalT, limit: THRESHOLDS.HIGH_DUR },
            { name: "Invalid Dates", val: invalidDateCount, pct: invalidDateCount/totalT, limit: THRESHOLDS.INVALID_DATES }
        ];

        renderScorecard(metrics);

        // --- 2. Calculate S-Curve Data ---
        
        if(!proj.months) return; // Exit if months map isn't built

        // Sort months chronologically
        const sortedKeys = Object.keys(proj.months).sort((a,b) => {
             const [ma, ya] = a.split('-'); const [mb, yb] = b.split('-');
             const d1 = new Date(`${ma} 1, ${ya}`);
             const d2 = new Date(`${mb} 1, ${yb}`);
             return d1 - d2;
        });

        let cumPlanned = 0;
        let cumActual = 0;
        const labels = [];
        const dataPlanned = [];
        const dataActual = [];

        sortedKeys.forEach(key => {
            const m = proj.months[key];
            labels.push(key);

            // Approximate monthly cost based on activity density
            // (Strictly speaking this requires resource loading per day, but this is a solid heuristic)
            const monthlyPlanned = (m.earlyActivity + m.lateActivity)/2 * proj.budgetCost / 100;
            const monthlyActual = m.actualActivity * proj.budgetCost / 100;

            cumPlanned += monthlyPlanned;
            cumActual += monthlyActual;

            dataPlanned.push(cumPlanned);

            // Stop plotting actuals after the Data Date
            const [monStr, yearStr] = key.split('-');
            const mDate = new Date(`${monStr} 28, ${yearStr}`); // End of month approx
            
            // Only push actuals if the month is before or equal to data date
            if(proj.last_recalc_date && mDate <= proj.last_recalc_date) {
                dataActual.push(cumActual);
            }
        });

        renderSCurve(labels, dataPlanned, dataActual);
    }

    function renderScorecard(metrics) {
        const tbody = document.getElementById("health-scorecard-body");
        if(!tbody) return;
        tbody.innerHTML = "";

        metrics.forEach(m => {
            const isPass = m.pct <= m.limit;
            // Handle strict 0 limit
            const isPassStrict = m.limit === 0 ? m.val === 0 : isPass;

            const badge = isPassStrict
                ? `<span style="background:#f6ffed; color:#389e0d; border:1px solid #b7eb8f; padding:4px 10px; border-radius:4px; font-weight:bold;">PASSED</span>` 
                : `<span style="background:#fff1f0; color:#cf1322; border:1px solid #ffa39e; padding:4px 10px; border-radius:4px; font-weight:bold;">FAILED</span>`;
            
            const row = `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px; font-weight:500;">${m.name}</td>
                <td style="padding:10px; text-align:center;">${(m.pct*100).toFixed(1)}%</td>
                <td style="padding:10px; text-align:center; color:#888;">&le; ${(m.limit*100).toFixed(1)}%</td>
                <td style="padding:10px; text-align:center;">${badge}</td>
            </tr>`;
            tbody.innerHTML += row;
        });
    }

    function renderSCurve(labels, planned, actual) {
        const canvas = document.getElementById("sCurveChart");
        if(!canvas) return;

        // Destroy previous chart instance to avoid memory leaks/overlap
        if(sCurveChartInstance) {
            sCurveChartInstance.destroy();
        }
        // Fallback destruction via Chart.js registry
        const existingChart = Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();

        sCurveChartInstance = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Planned Cost (Cum)',
                        data: planned,
                        borderColor: 'rgba(54, 162, 235, 1)',
                        backgroundColor: 'rgba(54, 162, 235, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0
                    },
                    {
                        label: 'Actual Cost (Cum)',
                        data: actual,
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { 
                        beginAtZero: true,
                        ticks: { 
                            callback: function(value) { 
                                if(value >= 1000000) return '$' + (value/1000000).toFixed(1) + 'M';
                                if(value >= 1000) return '$' + (value/1000).toFixed(0) + 'k';
                                return '$' + value; 
                            } 
                        }
                    }
                },
                plugins: {
                    tooltip: { 
                        callbacks: { 
                            label: function(c) { 
                                let val = c.raw;
                                return c.dataset.label + ': $' + val.toLocaleString(undefined, {maximumFractionDigits:0}); 
                            } 
                        } 
                    }
                }
            }
        });
    }

})();