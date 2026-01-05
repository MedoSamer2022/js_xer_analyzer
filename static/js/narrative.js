// ============================================
// narrative.js — Auto-Generated Executive Summary
// ============================================
(function() {
    const NARRATIVE_ID = 'narrative-section';

    function init() {
        const dashboard = document.getElementById('general');
        if (!dashboard || document.getElementById(NARRATIVE_ID)) return;

        // 1. Create Container
        const container = document.createElement('div');
        container.id = NARRATIVE_ID;
        container.className = 'card border-rad-8px box-shadow width-100 margin-top-20px';
        container.innerHTML = `
            <header><h3>🧠 Executive Narrative (AI Generated)</h3></header>
            <div class="pad-20px" style="font-family: 'Georgia', serif; line-height: 1.6; color: #333; font-size: 1.05rem;">
                <div id="narrative-text"><i>Please run analysis to generate the report...</i></div>
            </div>
        `;
        
        // 2. Insert at the VERY TOP
        dashboard.insertBefore(container, dashboard.firstChild);

        // 3. Listen for Analyze
        const analyzeBtn = document.getElementById('analyze-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', waitForDataAndWrite);
        }
    }

    function waitForDataAndWrite() {
        const checkInterval = setInterval(() => {
            if (typeof projects !== 'undefined' && projects.current && projects.current.tasks) {
                clearInterval(checkInterval);
                generateNarrative();
            }
        }, 200);
    }

    function generateNarrative() {
        const p = projects.current;
        const fmt = d => d instanceof Date ? d.toLocaleDateString('en-GB') : "N/A";
        
        // --- Narrative Logic ---
        let html = `<p><strong>Executive Summary:</strong> The project <em>"${p.name}"</em> is currently tracking <b>${p.tasks.size.toLocaleString()}</b> activities against a Data Date of <b>${fmt(p.last_recalc_date)}</b>.</p>`;
        
        // Progress
        html += `<p><strong>Performance:</strong> The schedule is <b>${(p.schedPercentComp*100).toFixed(1)}%</b> complete by duration. `;
        const spi = p.spi || 0;
        if(spi > 1.0) html += `Performance is <span style="color:green; font-weight:bold;">ahead of plan</span> (SPI: ${spi.toFixed(2)}). `;
        else if(spi > 0.9) html += `Performance is <span style="color:#eab308; font-weight:bold;">on track</span> (SPI: ${spi.toFixed(2)}). `;
        else html += `Performance is <span style="color:red; font-weight:bold;">lagging</span> (SPI: ${spi.toFixed(2)}). Recovery actions may be required. `;
        html += `</p>`;

        // Critical Path
        const cpCount = p.critical ? p.critical.length : 0;
        const float = (p.critical && p.critical.length > 0) ? p.critical[0].totalFloat : 0;
        
        html += `<p><strong>Critical Path:</strong> There are <b>${cpCount}</b> critical activities. `;
        if(float < 0) {
            html += `The project is currently forecasting a delay of <b style="color:red;">${Math.abs(float)} days</b> (Negative Float).`;
        } else if(float === 0) {
            html += `The project is exactly on schedule (Zero Float).`;
        } else {
            html += `The project has a buffer of <b>${float} days</b>.`;
        }
        html += `</p>`;

        document.getElementById('narrative-text').innerHTML = html;
    }

    document.addEventListener('DOMContentLoaded', init);
})();