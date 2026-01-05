// ============================================
// montecarlo.js — Risk Simulation (Lite)
// ============================================
const MonteCarlo = (function() {
    function init() {
        // 1. Add Sidebar Button
        const menuList = document.querySelector('#menu ul');
        if (menuList && !document.getElementById('risk-btn')) {
            const li = document.createElement('li');
            li.innerHTML = `<div id="risk-btn" onclick="menuClickHandle(event, 'risk-view')" class="btn" style="background:#7c3aed; color:white;">🎲 Risk Simulation (Beta)</div>`;
            const wbsBtn = document.getElementById('wbs-btn');
            if(wbsBtn) wbsBtn.parentNode.parentNode.insertBefore(li, wbsBtn.parentNode.nextSibling);
            else menuList.appendChild(li);
        }

        // 2. Add View Section
        const content = document.getElementById('content');
        if (content && !document.getElementById('risk-view')) {
            const section = document.createElement('section');
            section.id = 'risk-view';
            section.className = 'cat hidden max-width-960';
            section.innerHTML = `
                <div class="card border-rad-8px box-shadow width-100">
                    <header>
                        <h3>🎲 Monte Carlo Schedule Risk Analysis (Lite)</h3>
                        <div class="float-right">
                            <button id="run-sim-btn" class="btn-xs" style="background:#7c3aed; color:white;">Run 1,000 Iterations</button>
                        </div>
                    </header>
                    <div class="pad-20px">
                        <p style="color:#666; font-style:italic; margin-bottom:20px;">
                            This simulation runs 1,000 scenarios on your <b>Remaining Critical Path</b>. 
                            It applies a variance of <b>-10% (Best Case)</b> to <b>+25% (Worst Case)</b> on remaining durations.
                        </p>

                        <div class="flex" style="gap:20px; flex-wrap:wrap; justify-content:center; margin-bottom:30px;">
                            <div class="card pad-10px box-shadow" style="text-align:center; min-width:150px; border-top:4px solid #3b82f6;">
                                <div style="font-size:0.9em; color:#666;">Current Finish</div>
                                <div id="mc-current" style="font-size:1.2em; font-weight:bold;">-</div>
                            </div>
                            <div class="card pad-10px box-shadow" style="text-align:center; min-width:150px; border-top:4px solid #f59e0b;">
                                <div style="font-size:0.9em; color:#666;">P50 (Likely)</div>
                                <div id="mc-p50" style="font-size:1.2em; font-weight:bold; color:#f59e0b;">-</div>
                            </div>
                            <div class="card pad-10px box-shadow" style="text-align:center; min-width:150px; border-top:4px solid #ef4444;">
                                <div style="font-size:0.9em; color:#666;">P80 (Confidence)</div>
                                <div id="mc-p80" style="font-size:1.2em; font-weight:bold; color:#ef4444;">-</div>
                            </div>
                        </div>

                        <div class="chart-container" style="height:350px;">
                            <canvas id="monteCarloChart"></canvas>
                        </div>
                    </div>
                </div>
            `;
            content.appendChild(section);
            document.getElementById('run-sim-btn').addEventListener('click', runSimulation);
        }
    }

    function runSimulation() {
        if (!projects.current || !projects.current.longestPath) {
            alert("Please analyze a project first.");
            return;
        }

        const iterations = 1000;
        const results = [];
        const criticalPath = projects.current.longestPath.filter(t => !t.completed);
        const dataDate = projects.current.last_recalc_date;

        if(criticalPath.length === 0) {
            alert("No remaining critical path activities found to simulate.");
            return;
        }

        // --- SIMULATION ENGINE ---
        for (let i = 0; i < iterations; i++) {
            let pathDuration = 0;
            
            criticalPath.forEach(t => {
                // Monte Carlo Logic: 
                // Randomly vary remaining duration between 90% (Best) and 125% (Worst)
                // Using a triangular-like distribution bias
                const rand = Math.random();
                let variance;
                if(rand < 0.3) variance = 0.9 + (Math.random() * 0.1); // 0.9 - 1.0 (30% chance)
                else variance = 1.0 + (Math.random() * 0.25);          // 1.0 - 1.25 (70% chance)
                
                pathDuration += (t.remDur * variance);
            });

            // Calculate new finish date
            const simEndDate = new Date(dataDate);
            simEndDate.setDate(simEndDate.getDate() + pathDuration);
            results.push(simEndDate);
        }

        // Sort results to find Percentiles
        results.sort((a, b) => a - b);
        
        const p50 = results[Math.floor(iterations * 0.50)];
        const p80 = results[Math.floor(iterations * 0.80)];
        const currentFinish = projects.current.scd_end_date;

        // --- UPDATE UI ---
        document.getElementById('mc-current').innerText = formatDate(currentFinish);
        document.getElementById('mc-p50').innerText = formatDate(p50);
        document.getElementById('mc-p80').innerText = formatDate(p80);

        drawHistogram(results);
    }

    function drawHistogram(dates) {
        const ctx = document.getElementById('monteCarloChart').getContext('2d');
        
        // Group dates by week for the histogram buckets
        const bucketMap = new Map();
        dates.forEach(d => {
            const key = d.toLocaleDateString('en-GB', { month:'short', year:'2-digit', day:'numeric' }); // Group by day for precision
            bucketMap.set(key, (bucketMap.get(key) || 0) + 1);
        });

        const labels = Array.from(bucketMap.keys());
        const data = Array.from(bucketMap.values());

        // Destroy old chart if exists
        if (window.mcChart instanceof Chart) window.mcChart.destroy();

        window.mcChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Frequency (Probability)',
                    data: data,
                    backgroundColor: 'rgba(124, 58, 237, 0.5)',
                    borderColor: 'rgba(124, 58, 237, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display:true, text:'Likelihood' } }
                },
                plugins: {
                    annotation: {
                        annotations: {
                            line1: {
                                type: 'line',
                                xMin: formatDate(dates[Math.floor(dates.length*0.8)]),
                                xMax: formatDate(dates[Math.floor(dates.length*0.8)]),
                                borderColor: 'red',
                                borderWidth: 2,
                                label: { content: 'P80', enabled: true }
                            }
                        }
                    }
                }
            }
        });
    }

    const formatDate = d => d.toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'});

    document.addEventListener('DOMContentLoaded', init);
    return { init, runSimulation };
})();