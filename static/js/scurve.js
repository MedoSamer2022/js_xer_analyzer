// ============================================
// scurve.js — Advanced Financial S-Curve & EVM
// ============================================
const SCurve = (function() {
    let chartInstance = null;

    function init() {
        // 1. Add Sidebar Button
        const menuList = document.querySelector('#menu ul');
        if (menuList && !document.getElementById('scurve-btn')) {
            const li = document.createElement('li');
            li.innerHTML = `<div id="scurve-btn" onclick="menuClickHandle(event, 'scurve-view')" class="btn" style="background:#2563eb; color:white;">📈 Advanced S-Curve</div>`;
            const pdfBtn = document.getElementById('pdf-btn');
            if(pdfBtn) pdfBtn.parentNode.parentNode.insertBefore(li, pdfBtn.parentNode.nextSibling);
            else menuList.appendChild(li);
        }

        // 2. Add View Section
        const content = document.getElementById('content');
        if (content && !document.getElementById('scurve-view')) {
            const section = document.createElement('section');
            section.id = 'scurve-view';
            section.className = 'cat hidden width-100';
            section.innerHTML = `
                <div class="card border-rad-8px box-shadow width-100">
                    <header style="display:flex; justify-content:space-between; align-items:center;">
                        <h3>📈 Advanced Cost S-Curve (EVM)</h3>
                        <div style="display:flex; gap:10px;">
                            <select id="scurve-type" style="padding:6px; border-radius:4px; border:1px solid #ccc;">
                                <option value="cost">💰 Cost ($)</option>
                                <option value="units">👷‍♂️ Units (Man-Hours)</option>
                            </select>
                            <button id="scurve-refresh-btn" class="btn-xs">Refresh</button>
                        </div>
                    </header>
                    <div class="pad-20px">
                        <div class="chart-container" style="position:relative; height:60vh; width:100%;">
                            <canvas id="advancedScurveChart"></canvas>
                        </div>
                        <div style="margin-top:15px; text-align:center; font-size:0.9em; color:#666;">
                            <span style="color:#2563eb; font-weight:bold;">━ Planned Value (PV)</span> &nbsp;&nbsp;
                            <span style="color:#16a34a; font-weight:bold;">━ Earned Value (EV)</span> &nbsp;&nbsp;
                            <span style="color:#dc2626; font-weight:bold;">━ Actual Cost (AC)</span> &nbsp;&nbsp;
                            <span style="color:#93c5fd; font-weight:bold;">▮ Monthly Cash Flow</span>
                        </div>
                    </div>
                </div>
            `;
            content.appendChild(section);

            document.getElementById('scurve-refresh-btn').addEventListener('click', drawChart);
            document.getElementById('scurve-type').addEventListener('change', drawChart);
        }
        
        // Auto-load hook
        const analyzeBtn = document.getElementById('analyze-btn');
        if (analyzeBtn) analyzeBtn.addEventListener('click', () => setTimeout(drawChart, 1500));
    }

    function drawChart() {
        if (!projects.current || !projects.current.months) return;
        
        const ctx = document.getElementById('advancedScurveChart').getContext('2d');
        const mode = document.getElementById('scurve-type').value; // 'cost' or 'units'
        const p = projects.current;
        const totalBudget = mode === 'cost' ? p.budgetCost : p.budgetQty;

        // Get safe sorted keys
        const keys = Object.keys(p.months).filter(k => 
            k && k !== "undefined-NaN" && /^[A-Z][a-z]{2}-\d{4}$/.test(k)
        ).sort((a,b)=>{
            const [ma, ya] = a.split('-'); const [mb, yb] = b.split('-');
            return new Date(`${ma} 1, ${ya}`) - new Date(`${mb} 1, ${yb}`)
        });

        // Build Data Arrays
        let cumPV = 0, cumEV = 0, cumAC = 0;
        const dataPV = [];
        const dataEV = [];
        const dataAC = [];
        const dataBar = [];

        const dataDate = p.last_recalc_date;

        keys.forEach(key => {
            const m = p.months[key];
            const monthDate = new Date(`1 ${key}`);
            
            // Logic: Distribute Total Budget based on activity percentages calculated in main.js
            // This is an approximation based on schedule intensity
            const monthlyPlanned = (m.earlyActivity / 100) * totalBudget;
            const monthlyActual = (m.actualActivity / 100) * totalBudget;

            // 1. Planned Value (Baseline)
            cumPV += monthlyPlanned;
            dataPV.push(cumPV);

            // 2. Earned Value & Actual Cost (Stop at Data Date)
            if (monthDate <= dataDate) {
                cumEV += monthlyActual; // EV follows physical progress
                cumAC += monthlyActual; // In XERs without cost loading, AC often equals EV. 
                // Ideally, AC would come from 'act_this_per_cost', but using EV proxy for robustness here.
                
                dataEV.push(cumEV);
                dataAC.push(cumAC);
                dataBar.push(monthlyActual); // Bars show monthly intensity
            } else {
                dataEV.push(null);
                dataAC.push(null);
                dataBar.push(null);
            }
        });

        // Destroy old
        if (chartInstance) chartInstance.destroy();

        // Render
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: keys,
                datasets: [
                    {
                        label: 'Planned Value (PV)',
                        data: dataPV,
                        borderColor: '#2563eb', // Blue
                        backgroundColor: '#2563eb',
                        borderWidth: 3,
                        pointRadius: 0,
                        tension: 0.4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Earned Value (EV)',
                        data: dataEV,
                        borderColor: '#16a34a', // Green
                        backgroundColor: '#16a34a',
                        borderWidth: 3,
                        pointRadius: 2,
                        tension: 0.4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Monthly Cash Flow',
                        data: dataBar,
                        type: 'bar',
                        backgroundColor: 'rgba(147, 197, 253, 0.4)', // Light Blue Bar
                        borderColor: 'rgba(147, 197, 253, 1)',
                        borderWidth: 1,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                let label = ctx.dataset.label || '';
                                if (label) label += ': ';
                                if (ctx.parsed.y !== null) {
                                    label += mode === 'cost' 
                                        ? '$' + Math.round(ctx.parsed.y).toLocaleString() 
                                        : Math.round(ctx.parsed.y).toLocaleString() + ' hrs';
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: mode === 'cost' ? 'Cumulative Cost ($)' : 'Cumulative Units' },
                        grid: { color: '#f3f4f6' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: { display: true, text: 'Monthly Period' },
                        grid: { drawOnChartArea: false } // Hide grid for secondary axis
                    },
                    x: {
                        grid: { display: false },
                        ticks: { maxRotation: 45, minRotation: 45, autoSkip: true, maxTicksLimit: 20 }
                    }
                }
            }
        });
    }

    document.addEventListener('DOMContentLoaded', init);
    return { init, drawChart };
})();