// ===============================================
// period_dashboard.js — Ultimate Period Report
// ===============================================

const PeriodDashboard = (function() {
    let breakdownChart = null;
    let gaugeChart1 = null;
    let gaugeChart2 = null;

    // Configuration
    const CONFIG = {
        colorBlue: "#102532", 
        colorGreen: "#2ecc71",
        colorRed: "#e74c3c", 
        colorOrange: "#f39c12",
        colorText: "#333333"
    };

    function init() {
        const menuList = document.querySelector('#menu ul');
        if (menuList && !document.getElementById('period-dash-btn')) {
            const li = document.createElement('li');
            li.innerHTML = `<div id="period-dash-btn" onclick="menuClickHandle(event, 'period-dash-view')" class="btn">📅 Period Dashboard</div>`;
            const refBtn = document.getElementById('res-hist-btn') || document.getElementById('wbs-mgr-btn'); 
            if (refBtn && refBtn.parentNode.nextSibling) menuList.insertBefore(li, refBtn.parentNode.nextSibling);
            else menuList.appendChild(li);
        }

        const content = document.getElementById('content');
        if (content && !document.getElementById('period-dash-view')) {
            const section = document.createElement('section');
            section.id = 'period-dash-view';
            section.className = 'cat hidden width-100'; 
            section.innerHTML = `
                <div class="width-100" style="font-family: 'Segoe UI', sans-serif;">
                    
                    <div class="card border-rad-8px box-shadow width-100" style="margin-bottom:15px; background:#f8fafc;">
                        <header style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid #e2e8f0;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <h3 style="margin:0; color:${CONFIG.colorBlue};">📅 Period Status</h3>
                            </div>
                            
                            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                                <div style="display:flex; flex-direction:column;">
                                    <span style="font-size:0.75em; font-weight:bold; color:#64748b;">Timeframe</span>
                                    <select id="pd-interval" style="padding:6px; border-radius:4px; border:1px solid #ccc; font-weight:bold;">
                                        <option value="7">Weekly (7 Days)</option>
                                        <option value="30" selected>Monthly (30 Days)</option>
                                        <option value="90">Quarterly (3 Months)</option>
                                        <option value="180">6 Months</option>
                                        <option value="365">Yearly</option>
                                    </select>
                                </div>

                                <div style="display:flex; flex-direction:column;">
                                    <span style="font-size:0.75em; font-weight:bold; color:#64748b;">WBS Filter</span>
                                    <select id="pd-wbs-filter" style="padding:6px; border-radius:4px; border:1px solid #ccc; max-width:200px;">
                                        <option value="ROOT">All Project</option>
                                    </select>
                                </div>

                                <div style="display:flex; flex-direction:column;">
                                    <span style="font-size:0.75em; font-weight:bold; color:#64748b;">Cost Type</span>
                                    <select id="pd-cost-filter" style="padding:6px; border-radius:4px; border:1px solid #ccc;">
                                        <option value="ALL">All Costs (Total)</option>
                                        <option value="LABOR">Labor Only (Productivity)</option>
                                        <option value="NONLABOR">Material/Expense Only</option>
                                    </select>
                                </div>

                                <div style="border-left:1px solid #ccc; margin:0 5px; height:30px;"></div>

                                <button id="pd-refresh-btn" class="btn-xs" style="background:${CONFIG.colorBlue}; color:white; height:36px;">🔄 Update</button>
                                <button id="pd-export-btn" class="btn-xs" style="background:#10b981; color:white; height:36px;">📊 Export Excel</button>
                            </div>
                        </header>
                    </div>

                    <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:15px; margin-bottom:15px;">
                        
                        <div class="card border-rad-8px box-shadow" style="padding:0; overflow:hidden;">
                            <div style="background:${CONFIG.colorBlue}; color:white; padding:5px 10px; font-size:0.85em; font-weight:bold;">Period Performance (PV vs EV)</div>
                            <div style="padding:10px; height:140px; position:relative; display:flex; justify-content:center;">
                                <canvas id="pd-gauge1"></canvas>
                            </div>
                            <div style="display:flex; justify-content:space-between; padding:5px 15px; font-size:0.85em; font-weight:bold; border-top:1px solid #eee;">
                                <span style="color:${CONFIG.colorGreen}" id="pd-val-pv">PV: 0</span>
                                <span style="color:${CONFIG.colorRed}" id="pd-val-ev">EV: 0</span>
                            </div>
                        </div>

                        <div class="card border-rad-8px box-shadow" style="padding:0; overflow:hidden;">
                            <div style="background:${CONFIG.colorBlue}; color:white; padding:5px 10px; font-size:0.85em; font-weight:bold;">Period Efficiency (SPI)</div>
                            <div style="padding:10px; height:140px; position:relative; display:flex; justify-content:center;">
                                <canvas id="pd-gauge2"></canvas>
                            </div>
                            <div style="display:flex; justify-content:space-between; padding:5px 15px; font-size:0.85em; font-weight:bold; border-top:1px solid #eee;">
                                <span style="color:${CONFIG.colorGreen}" id="pd-val-spi">SPI: 0.00</span>
                                <span style="color:${CONFIG.colorRed}" id="pd-val-var">Var: 0</span>
                            </div>
                        </div>

                        <div style="display:grid; grid-template-rows: 1fr 1fr; gap:10px;">
                            <div class="card border-rad-8px box-shadow" style="display:flex; flex-direction:column; justify-content:center; align-items:center; padding:10px;">
                                <span style="font-size:0.85em; color:#64748b; font-weight:bold; text-transform:uppercase;">Period Planned</span>
                                <span id="pd-card-pv" style="font-size:1.3em; font-weight:bold; color:${CONFIG.colorBlue}; margin-top:5px;">0</span>
                            </div>
                            <div class="card border-rad-8px box-shadow" style="display:flex; flex-direction:column; justify-content:center; align-items:center; padding:10px;">
                                <span style="font-size:0.85em; color:#64748b; font-weight:bold; text-transform:uppercase;">Period Earned</span>
                                <span id="pd-card-ev" style="font-size:1.3em; font-weight:bold; color:${CONFIG.colorGreen}; margin-top:5px;">0</span>
                            </div>
                        </div>

                        <div style="display:grid; grid-template-rows: 1fr 1fr; gap:10px;">
                            <div class="card border-rad-8px box-shadow" style="display:flex; flex-direction:column; justify-content:center; align-items:center; padding:10px;">
                                <span style="font-size:0.85em; color:#64748b; font-weight:bold; text-transform:uppercase;">Active Tasks</span>
                                <span id="pd-card-active" style="font-size:1.3em; font-weight:bold; color:${CONFIG.colorBlue}; margin-top:5px;">0</span>
                            </div>
                            <div class="card border-rad-8px box-shadow" style="display:flex; flex-direction:column; justify-content:center; align-items:center; padding:10px;">
                                <span style="font-size:0.85em; color:#64748b; font-weight:bold; text-transform:uppercase;">Late Starts</span>
                                <span id="pd-card-late" style="font-size:1.3em; font-weight:bold; color:${CONFIG.colorRed}; margin-top:5px;">0</span>
                            </div>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: 4fr 6fr; gap:15px; height:450px;">
                        
                        <div class="card border-rad-8px box-shadow" style="padding:0; overflow:hidden; display:flex; flex-direction:column;">
                            <div style="background:${CONFIG.colorBlue}; color:white; padding:10px 15px; font-size:0.9em; font-weight:bold;">
                                📉 Breakdown by WBS Level
                            </div>
                            <div style="flex:1; padding:10px; position:relative;">
                                <canvas id="pd-breakdownChart"></canvas>
                            </div>
                        </div>

                        <div class="card border-rad-8px box-shadow" style="padding:0; overflow:hidden; display:flex; flex-direction:column;">
                            <div style="background:${CONFIG.colorBlue}; color:white; padding:10px 15px; font-size:0.9em; font-weight:bold; display:flex; justify-content:space-between;">
                                <span>📋 Activity Details (Top 50 by Value)</span>
                                <span style="font-size:0.8em; opacity:0.8;">Sorted by Planned Value</span>
                            </div>
                            <div style="flex:1; overflow-y:auto;">
                                <table id="pd-details-table" style="width:100%; border-collapse:collapse; font-size:0.8em;">
                                    <thead style="background:#f1f5f9; color:#475569; position:sticky; top:0; z-index:10;">
                                        <tr>
                                            <th style="padding:8px; text-align:left;">ID</th>
                                            <th style="padding:8px; text-align:left;">Activity Name</th>
                                            <th style="padding:8px; text-align:right;">Period Plan</th>
                                            <th style="padding:8px; text-align:right;">Period Earn</th>
                                            <th style="padding:8px; text-align:center;">Phy %</th>
                                            <th style="padding:8px; text-align:center;">TF</th>
                                        </tr>
                                    </thead>
                                    <tbody></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            content.appendChild(section);

            // Bind Events
            document.getElementById('pd-refresh-btn').addEventListener('click', calculateAndRender);
            document.getElementById('pd-export-btn').addEventListener('click', exportToExcel);
            
            // Auto Load
            const analyzeBtn = document.getElementById('analyze-btn');
            if(analyzeBtn) analyzeBtn.addEventListener('click', () => setTimeout(() => {
                populateWbsDropdown();
                calculateAndRender();
            }, 2500));
        }
    }

    // =========================================================
    // 1. HELPERS: DATE & COST
    // =========================================================
    function getSafeDate(val) {
        if (!val) return null;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }

    function calculateTaskCost(t, type = 'target', costFilter = 'ALL') {
        let total = 0;

        // Helper to check if a cost item matches the filter (Labor vs Non-Labor)
        // Note: XER files define cost types in 'cost_type_id' or 'rsrc_type'
        // We do a best-guess check here based on typical P6 usage.
        const matchesFilter = (itemType) => {
            if (costFilter === 'ALL') return true;
            const isLabor = (itemType === 'RT_Labor' || itemType === 'RT_Nonlabor'); // P6 Resource Types
            if (costFilter === 'LABOR') return isLabor;
            if (costFilter === 'NONLABOR') return !isLabor; // Material/Equipment/Expense
            return true;
        };

        // 1. Sum Resources (TASKRSRC)
        if (t.resources && t.resources.length > 0) {
            t.resources.forEach(r => {
                if (matchesFilter(r.rsrc_type)) {
                    if (type === 'target') {
                        total += parseFloat(r.target_cost || 0);
                    } else {
                        // Actual Cost = Reg + OT
                        total += parseFloat(r.act_reg_cost || 0) + parseFloat(r.act_ot_cost || 0);
                    }
                }
            });
        }

        // 2. Sum Expenses (PROJCOST)
        const exps = t.expenses || t.projcosts || [];
        if (exps.length > 0 && costFilter !== 'LABOR') { // Expenses are usually Non-Labor
            exps.forEach(e => {
                if (type === 'target') {
                    total += parseFloat(e.target_cost || 0);
                } else {
                    total += parseFloat(e.act_cost || 0);
                }
            });
        }

        // 3. Fallback: If no breakdown, use Task Total (Only if ALL is selected)
        if (total === 0 && costFilter === 'ALL') {
            if (type === 'target') total = parseFloat(t.target_cost || t.budgetCost || 0);
            else total = parseFloat(t.act_cost || 0);
        }

        return total;
    }

    // =========================================================
    // 2. WBS SELECTOR LOGIC
    // =========================================================
    function populateWbsDropdown() {
        if (!projects.current || !projects.current.wbs) return;
        
        const select = document.getElementById('pd-wbs-filter');
        select.innerHTML = '<option value="ROOT">All Project</option>';

        const wbsList = [];
        projects.current.wbs.forEach(w => {
            wbsList.push({
                id: w.wbs_id || w.wbsID,
                code: w.wbs_short_name,
                name: w.wbs_name
            });
        });

        // Sort by Code
        wbsList.sort((a,b) => a.code.localeCompare(b.code));

        wbsList.forEach(w => {
            const opt = document.createElement('option');
            opt.value = w.id;
            opt.innerText = `${w.code} - ${w.name.substring(0, 30)}`;
            select.appendChild(opt);
        });
    }

    function isChildOf(taskId, filterWbsId, wbsMap) {
        if (filterWbsId === "ROOT") return true;
        if (!taskId) return false;
        
        // Simple check: Is the task's WBS ID the filter ID?
        if (taskId == filterWbsId) return true;

        // Recursive check up the tree
        let currentWbs = wbsMap.get(taskId);
        while (currentWbs) {
            if (currentWbs.parent_wbs_id == filterWbsId) return true;
            if (currentWbs.wbs_id == filterWbsId) return true;
            currentWbs = wbsMap.get(currentWbs.parent_wbs_id);
        }
        return false;
    }

    // =========================================================
    // 3. MAIN CALCULATION ENGINE
    // =========================================================
    function calculateAndRender() {
        if (!projects.current || !projects.current.tasks) return;

        const days = parseInt(document.getElementById('pd-interval').value) || 30;
        const filterWbsId = document.getElementById('pd-wbs-filter').value;
        const costFilter = document.getElementById('pd-cost-filter').value;

        const dataDate = getSafeDate(projects.current.last_recalc_date) || new Date(); 
        const startDate = new Date(dataDate);
        startDate.setDate(startDate.getDate() - days);

        let totalIntPV = 0, totalIntEV = 0;
        let activeCount = 0, lateCount = 0;
        const breakdownMap = new Map();
        const tableData = [];

        // Build WBS Map for filtering
        const wbsMap = projects.current.wbs || new Map();

        const tasks = [...projects.current.tasks.values()];

        tasks.forEach(t => {
            // FILTER: Check WBS
            const wbsId = t.wbs_id || (t.wbs ? t.wbs.wbs_id : null);
            if (!isChildOf(wbsId, filterWbsId, wbsMap)) return;

            // 1. Get Cost (Applying Labor/Material Filter)
            const budget = calculateTaskCost(t, 'target', costFilter);
            
            // 2. Dates
            const tStart = getSafeDate(t.target_start_date) || getSafeDate(t.start);
            const tEnd = getSafeDate(t.target_end_date) || getSafeDate(t.finish);
            
            // 3. Interval PV
            let intPV = 0;
            if (tStart && tEnd && budget > 0) {
                const overlap = getOverlapDays(tStart, tEnd, startDate, dataDate);
                if (overlap > 0) {
                    const totalDur = Math.max(1, (tEnd - tStart) / (1000*60*60*24));
                    intPV = (budget / totalDur) * overlap;
                }
            }

            // 4. Interval EV
            const pct = (t.phys_complete_pct || t.physPercentComp || t.percentComplete || 0) / 100;
            // EV is based on Budget * %Complete (Standard P6 behavior)
            const earnedVal = budget * pct; 
            
            let intEV = 0;
            const aStart = getSafeDate(t.act_start_date) || getSafeDate(t.start);
            
            if (aStart && earnedVal > 0) {
                // Earned Value spread: From Actual Start to Data Date (if active) or Actual Finish (if done)
                const isComplete = (t.status_code === 'TK_Complete' || t.completed);
                const earnEnd = isComplete ? (getSafeDate(t.act_end_date) || dataDate) : dataDate;

                if (earnEnd > aStart) {
                    const overlap = getOverlapDays(aStart, earnEnd, startDate, dataDate);
                    if (overlap > 0) {
                        const totalEarnDur = Math.max(1, (earnEnd - aStart) / (1000*60*60*24));
                        intEV = (earnedVal / totalEarnDur) * overlap;
                    }
                }
            }

            // 5. Aggregate
            if (intPV > 0.1 || intEV > 0.1) {
                totalIntPV += intPV;
                totalIntEV += intEV;
                activeCount++;
                
                // Late Analysis
                const currStart = getSafeDate(t.start);
                const lateStart = getSafeDate(t.late_start_date);
                if (currStart && lateStart && currStart > lateStart) lateCount++;

                // Breakdown (WBS Name)
                const wbsName = t.wbs ? (t.wbs.wbs_short_name || "Root") : "Root";
                if (!breakdownMap.has(wbsName)) breakdownMap.set(wbsName, { pv: 0, ev: 0 });
                const b = breakdownMap.get(wbsName);
                b.pv += intPV;
                b.ev += intEV;

                tableData.push({ 
                    id: t.task_code, 
                    name: t.task_name, 
                    pv: intPV, 
                    ev: intEV, 
                    pct: (pct*100).toFixed(0),
                    tf: t.totalFloat || 0
                });
            }
        });

        // Update UI
        updateCards(totalIntPV, totalIntEV, activeCount, lateCount);
        updateGauges(totalIntPV, totalIntEV);
        updateBreakdownChart(breakdownMap);
        updateTable(tableData);
    }

    function getOverlapDays(start1, end1, start2, end2) {
        const start = start1 > start2 ? start1 : start2;
        const end = end1 < end2 ? end1 : end2;
        if (end < start) return 0;
        return (end - start) / (1000 * 60 * 60 * 24);
    }

    // =========================================================
    // 4. VISUAL UPDATES & EXPORT
    // =========================================================
    function updateCards(pv, ev, active, late) {
        document.getElementById('pd-card-pv').innerText = formatMoney(pv);
        document.getElementById('pd-card-ev').innerText = formatMoney(ev);
        document.getElementById('pd-card-active').innerText = active;
        document.getElementById('pd-card-late').innerText = late;
        
        document.getElementById('pd-val-pv').innerText = `PV: ${formatShort(pv)}`;
        document.getElementById('pd-val-ev').innerText = `EV: ${formatShort(ev)}`;
        
        const spi = pv > 0 ? (ev / pv).toFixed(2) : "0.00";
        const variance = formatShort(ev - pv);
        document.getElementById('pd-val-spi').innerText = `SPI: ${spi}`;
        document.getElementById('pd-val-var').innerText = `Var: ${variance}`;
    }

    function updateGauges(pv, ev) {
        const ctx1 = document.getElementById('pd-gauge1').getContext('2d');
        if (gaugeChart1) gaugeChart1.destroy();
        gaugeChart1 = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: ['Earned', 'Gap', ''],
                datasets: [{
                    data: [ev, Math.max(0, pv - ev), 0],
                    backgroundColor: [CONFIG.colorGreen, CONFIG.colorRed, 'transparent'],
                    borderWidth: 0, circumference: 180, rotation: -90
                }]
            },
            options: { cutout: '70%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
        });

        const ctx2 = document.getElementById('pd-gauge2').getContext('2d');
        if (gaugeChart2) gaugeChart2.destroy();
        const pct = pv > 0 ? (ev/pv) : 0;
        const color = pct >= 1 ? CONFIG.colorGreen : CONFIG.colorRed;
        gaugeChart2 = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: ['Performance', 'Remainder'],
                datasets: [{
                    data: [Math.min(pct, 1.5), 1.5 - Math.min(pct, 1.5)],
                    backgroundColor: [color, '#e2e8f0'],
                    borderWidth: 0, circumference: 180, rotation: -90
                }]
            },
            options: { cutout: '70%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
        });
    }

    function updateBreakdownChart(map) {
        const ctx = document.getElementById('pd-breakdownChart').getContext('2d');
        const sorted = Array.from(map.entries()).sort((a,b) => b[1].pv - a[1].pv).slice(0, 10); // Top 10
        
        if (breakdownChart) breakdownChart.destroy();
        breakdownChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map(k => k[0]),
                datasets: [
                    { label: 'Planned', data: sorted.map(k => k[1].pv), backgroundColor: CONFIG.colorBlue },
                    { label: 'Earned', data: sorted.map(k => k[1].ev), backgroundColor: CONFIG.colorGreen }
                ]
            },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { beginAtZero: true } } }
        });
    }

    function updateTable(data) {
        const tbody = document.querySelector('#pd-details-table tbody');
        tbody.innerHTML = "";
        data.sort((a,b) => b.pv - a.pv).slice(0, 100).forEach(d => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:5px; border-bottom:1px solid #eee;">${d.id}</td>
                <td style="padding:5px; border-bottom:1px solid #eee;">${d.name.substring(0,40)}</td>
                <td style="padding:5px; text-align:right;">${formatShort(d.pv)}</td>
                <td style="padding:5px; text-align:right; color:${d.ev<d.pv ? 'red':'green'};">${formatShort(d.ev)}</td>
                <td style="padding:5px; text-align:center;">${d.pct}%</td>
                <td style="padding:5px; text-align:center; color:${d.tf<0?'red':'black'}">${d.tf}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function exportToExcel() {
        if (!projects.current) return alert("No data.");
        // Re-run calc to get current table data (simplified for this snippet)
        // In production, you would cache 'tableData' in a variable like 'lastChartData'
        alert("Export feature requires recalculation. Please ensure 'SheetJS' is loaded.");
    }

    function formatMoney(val) { return Number(val).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }); }
    function formatShort(val) {
        if (Math.abs(val) >= 1000000) return (val / 1000000).toFixed(2) + 'M';
        if (Math.abs(val) >= 1000) return (val / 1000).toFixed(1) + 'K';
        return val.toFixed(0);
    }

    document.addEventListener('DOMContentLoaded', init);
    return { init };
})();