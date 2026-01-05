// ============================================
// forensic.js — Forensic Delay Analyzer (Fixed)
// ============================================
const ForensicLab = (function() {
    
    function init() {
        // 1. Add Sidebar Button
        const menuList = document.querySelector('#menu ul');
        if (menuList && !document.getElementById('forensic-btn')) {
            const li = document.createElement('li');
            li.innerHTML = `<div id="forensic-btn" onclick="menuClickHandle(event, 'forensic-view')" class="btn" style="background:#b45309; color:white;">🐢 Forensic Delay Lab</div>`;
            const scurveBtn = document.getElementById('scurve-btn');
            if(scurveBtn) scurveBtn.parentNode.parentNode.insertBefore(li, scurveBtn.parentNode.nextSibling);
            else menuList.appendChild(li);
        }

        // 2. Add View Section
        const content = document.getElementById('content');
        if (content && !document.getElementById('forensic-view')) {
            const section = document.createElement('section');
            section.id = 'forensic-view';
            section.className = 'cat hidden width-100';
            section.innerHTML = `
                <div class="card border-rad-8px box-shadow width-100">
                    <header><h3>🐢 Forensic Delay Analyzer (Comparison)</h3></header>
                    <div class="pad-20px">
                        <div id="forensic-warning" style="display:none; background:#fee2e2; color:#b91c1c; padding:15px; border-radius:6px; margin-bottom:20px;">
                            ⚠ <b>Comparison Data Missing:</b> Please upload a "Previous XER" (or Baseline) and check the Comparison box.
                        </div>

                        <div id="forensic-content" style="opacity:0.3; transition:opacity 0.3s;">
                            <div class="flex" style="gap:20px; margin-bottom:20px;">
                                <div class="card pad-10px box-shadow width-100" style="border-left:4px solid #ef4444;">
                                    <div style="color:#666; font-size:0.9em;">Project Slip</div>
                                    <div id="fd-slip" style="font-size:1.4em; font-weight:bold;">-</div>
                                </div>
                                <div class="card pad-10px box-shadow width-100" style="border-left:4px solid #f59e0b;">
                                    <div style="color:#666; font-size:0.9em;">Durations Extended</div>
                                    <div id="fd-dur" style="font-size:1.4em; font-weight:bold;">-</div>
                                </div>
                                <div class="card pad-10px box-shadow width-100" style="border-left:4px solid #3b82f6;">
                                    <div style="color:#666; font-size:0.9em;">Logic Added/Changed</div>
                                    <div id="fd-logic" style="font-size:1.4em; font-weight:bold;">-</div>
                                </div>
                            </div>

                            <h4>🔴 Top Delay Drivers (Activities that pushed the date)</h4>
                            <div style="overflow-x:auto;">
                                <table id="forensic-table" style="width:100%; border-collapse:collapse; font-size:0.9em;">
                                    <thead>
                                        <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; text-align:left;">
                                            <th style="padding:10px;">ID</th>
                                            <th style="padding:10px;">Name</th>
                                            <th style="padding:10px;">Baseline Finish</th>
                                            <th style="padding:10px;">Current Finish</th>
                                            <th style="padding:10px;">Variance</th>
                                            <th style="padding:10px;">Root Cause</th>
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
        }
        
        // Auto-run on Analyze if possible
        const analyzeBtn = document.getElementById('analyze-btn');
        if (analyzeBtn) analyzeBtn.addEventListener('click', () => setTimeout(runForensics, 2000));
    }

    function runForensics() {
        const warning = document.getElementById('forensic-warning');
        const content = document.getElementById('forensic-content');
        
        // Check if Comparison Data Exists
        if (!projects || !projects.current || !projects.previous) {
            if(warning) warning.style.display = 'block';
            if(content) content.style.opacity = '0.3';
            return;
        }

        if(warning) warning.style.display = 'none';
        if(content) content.style.opacity = '1';

        const curr = projects.current;
        const prev = projects.previous;
        const fmt = d => (d && !isNaN(d)) ? d.toLocaleDateString('en-GB') : "-";

        // --- 1. GLOBAL SLIP ---
        // P6 uses 'early_end_date' for the schedule finish
        // We find the latest date in both schedules to approximate project finish
        // (Or ideally use the Finish milestone)
        let currProjFin = new Date(Math.max(...Array.from(curr.tasks.values()).map(t => new Date(t.early_end_date || 0))));
        let prevProjFin = new Date(Math.max(...Array.from(prev.tasks.values()).map(t => new Date(t.early_end_date || 0))));
        
        const slip = Math.round((currProjFin - prevProjFin) / (1000*3600*24));
        const slipEl = document.getElementById('fd-slip');
        if(slipEl) {
            slipEl.innerText = `${slip > 0 ? '+' : ''}${slip} Days`;
            slipEl.style.color = slip > 0 ? '#dc2626' : (slip < 0 ? '#16a34a' : '#333');
        }

        // --- 2. ANALYZE TASKS ---
        const delays = [];
        let durCount = 0;
        let logicCount = 0; 

        // Use a Map for fast lookup of Previous tasks
        const prevMap = new Map();
        prev.tasks.forEach(t => prevMap.set(t.task_code, t));

        curr.tasks.forEach(t => {
            const pTask = prevMap.get(t.task_code);
            if (!pTask) return; // New task (or mapped incorrectly)

            // --- DATE PARSING (CRITICAL FIX) ---
            // The XER stores dates as strings in 'early_end_date'
            const tFinish = t.early_end_date ? new Date(t.early_end_date) : null;
            const pFinish = pTask.early_end_date ? new Date(pTask.early_end_date) : null;
            const tStart  = t.early_start_date ? new Date(t.early_start_date) : null;
            const pStart  = pTask.early_start_date ? new Date(pTask.early_start_date) : null;

            if (!tFinish || !pFinish) return;

            // Calculate Variance
            const variance = Math.round((tFinish - pFinish) / (1000*3600*24));

            // Logic: Only flag delays > 0 days, exclude Completed tasks if desired
            // Using 'status_code' from XER: 'TK_Complete' means finished.
            if (variance > 0 && t.status_code !== 'TK_Complete') {
                
                // Determine Root Cause
                const reasons = [];
                
                // 1. Duration Increase?
                // XER field: 'orig_drtn_hr_cnt' (hours). Divide by 8 for days (approx)
                const currDur = parseFloat(t.orig_drtn_hr_cnt || 0);
                const prevDur = parseFloat(pTask.orig_drtn_hr_cnt || 0);
                
                if (currDur > prevDur) {
                    const diffDays = Math.round((currDur - prevDur) / 8);
                    reasons.push(`Dur Extended (+${diffDays}d)`);
                    durCount++;
                }
                
                // 2. Start Slip? (Predecessor Delay)
                if (tStart && pStart && tStart > pStart) {
                    const startVar = Math.round((tStart - pStart) / (1000*3600*24));
                    if(startVar > 0 && reasons.length === 0) {
                        reasons.push(`Start Delayed (-${startVar}d)`);
                    }
                }

                // 3. Constraint Added?
                // XER field: 'prime_clndr_id' or specific constraint flags?
                // Simplified check: if float dropped significantly without duration change
                
                delays.push({
                    id: t.task_code,
                    name: t.task_name,
                    baseFin: pFinish,
                    currFin: tFinish,
                    var: variance,
                    cause: reasons.join(", ") || "Logic/Lag Push"
                });
            }
        });

        // Update Counts
        const durEl = document.getElementById('fd-dur');
        if(durEl) durEl.innerText = durCount;
        
        const logEl = document.getElementById('fd-logic');
        if(logEl) logEl.innerText = "N/A"; // Placeholder

        // Sort by biggest variance descending
        delays.sort((a,b) => b.var - a.var);

        // Render Table (Top 50)
        const tbody = document.querySelector('#forensic-table tbody');
        if(!tbody) return;
        
        tbody.innerHTML = ''; // Clear rows

        delays.slice(0, 50).forEach(d => {
            const row = tbody.insertRow();
            row.style.borderBottom = "1px solid #eee";
            row.innerHTML = `
                <td style="padding:10px; font-weight:bold;">${d.id}</td>
                <td style="padding:10px;">${d.name.substring(0,50)}</td>
                <td style="padding:10px;">${fmt(d.baseFin)}</td>
                <td style="padding:10px;">${fmt(d.currFin)}</td>
                <td style="padding:10px; color:red; font-weight:bold;">+${d.var}d</td>
                <td style="padding:10px; font-style:italic; color:#555;">${d.cause}</td>
            `;
        });
    }

    // Public API
    return {
        init: init,
        run: runForensics
    };

})();

document.addEventListener('DOMContentLoaded', ForensicLab.init);
// --- 3. CALCULATE LOGIC CHANGES ---
function runForensics() {
        const warning = document.getElementById('forensic-warning');
        const content = document.getElementById('forensic-content');
        
        // Check if Comparison Data Exists
        if (!projects || !projects.current || !projects.previous) {
            if(warning) warning.style.display = 'block';
            if(content) content.style.opacity = '0.3';
            return;
        }

        if(warning) warning.style.display = 'none';
        if(content) content.style.opacity = '1';

        const curr = projects.current;
        const prev = projects.previous;
        const fmt = d => (d && !isNaN(d)) ? d.toLocaleDateString('en-GB') : "-";

        // --- 1. GLOBAL SLIP ---
        let currProjFin = new Date(Math.max(...Array.from(curr.tasks.values()).map(t => new Date(t.early_end_date || 0))));
        let prevProjFin = new Date(Math.max(...Array.from(prev.tasks.values()).map(t => new Date(t.early_end_date || 0))));
        
        const slip = Math.round((currProjFin - prevProjFin) / (1000*3600*24));
        const slipEl = document.getElementById('fd-slip');
        if(slipEl) {
            slipEl.innerText = `${slip > 0 ? '+' : ''}${slip} Days`;
            slipEl.style.color = slip > 0 ? '#dc2626' : (slip < 0 ? '#16a34a' : '#333');
        }

        // --- 2. PREPARE DATA FOR COMPARISON ---
        const delays = [];
        let durCount = 0;
        let logicCount = 0; 

        const prevMap = new Map();
        prev.tasks.forEach(t => prevMap.set(t.task_code, t));

        // --- 3. CALCULATE LOGIC CHANGES (New Code) ---
        // Helper to build a unique key for every relationship: "PredCode|SuccCode|Type"
        // We assume 'tables.current.TASKPRED' exists if parsed globally, 
        // OR we iterate tasks if relationships are attached to them.
        
        // Strategy: Build a map of ALL Baseline Relationships first
        const baseLogicMap = new Map(); // Key: "Pred|Succ|Type", Value: Lag
        
        prev.tasks.forEach(pTask => {
            // Check if predecessors are stored in a specific array (depends on parse.js)
            // Usually XER parsers link them. Let's try standard 'predecessors' array if available
            // If not, we rely on the global TASKPRED table if available in 'tables.previous'
            
            // Fallback: If parse.js puts predecessors in 'task.preds' or similar
            const preds = pTask.predecessors || []; 
            preds.forEach(rel => {
                const predCode = rel.pred_task_code || (prev.tasks.get(rel.pred_task_id)?.task_code);
                if(predCode) {
                    const key = `${predCode}|${pTask.task_code}|${rel.pred_type}`;
                    baseLogicMap.set(key, parseFloat(rel.lag_hr_cnt || 0));
                }
            });
        });

        // Now iterate Current Relationships and check against Baseline
        curr.tasks.forEach(cTask => {
            const preds = cTask.predecessors || [];
            preds.forEach(rel => {
                const predCode = rel.pred_task_code || (curr.tasks.get(rel.pred_task_id)?.task_code);
                if(predCode) {
                    const key = `${predCode}|${cTask.task_code}|${rel.pred_type}`;
                    const currLag = parseFloat(rel.lag_hr_cnt || 0);

                    if (!baseLogicMap.has(key)) {
                        // Relationship is NEW
                        logicCount++;
                    } else {
                        // Relationship exists, check for LAG change
                        const baseLag = baseLogicMap.get(key);
                        if (Math.abs(currLag - baseLag) > 0.1) { // Tolerance for float math
                            logicCount++;
                        }
                    }
                }
            });
        });

        // Update the Logic Metric on Screen
        const logEl = document.getElementById('fd-logic');
        if(logEl) {
            logEl.innerText = logicCount;
            // Highlight if significant changes found
            logEl.style.color = logicCount > 0 ? '#2563eb' : '#333'; 
        }

        // --- 4. ANALYZE DELAYS (Existing Logic) ---
        curr.tasks.forEach(t => {
            const pTask = prevMap.get(t.task_code);
            if (!pTask) return; 

            const tFinish = t.early_end_date ? new Date(t.early_end_date) : null;
            const pFinish = pTask.early_end_date ? new Date(pTask.early_end_date) : null;
            
            if (!tFinish || !pFinish) return;

            const variance = Math.round((tFinish - pFinish) / (1000*3600*24));

            if (variance > 0 && t.status_code !== 'TK_Complete') {
                const reasons = [];
                
                // Duration Check
                const currDur = parseFloat(t.orig_drtn_hr_cnt || 0);
                const prevDur = parseFloat(pTask.orig_drtn_hr_cnt || 0);
                if (currDur > prevDur) {
                    const diffDays = Math.round((currDur - prevDur) / 8);
                    reasons.push(`Dur Extended (+${diffDays}d)`);
                    durCount++;
                }
                
                // Logic/Lag Check (Simplified for the table column)
                // If duration didn't change but date slipped, it's likely logic or predecessors
                if (reasons.length === 0) {
                    reasons.push("Logic / Predecessor Delay");
                }

                delays.push({
                    id: t.task_code,
                    name: t.task_name,
                    baseFin: pFinish,
                    currFin: tFinish,
                    var: variance,
                    cause: reasons.join(", ")
                });
            }
        });

        // Update Duration Count
        const durEl = document.getElementById('fd-dur');
        if(durEl) durEl.innerText = durCount;

        // Sort and Render Table
        delays.sort((a,b) => b.var - a.var);
        const tbody = document.querySelector('#forensic-table tbody');
        if(tbody) {
            tbody.innerHTML = ''; 
            delays.slice(0, 50).forEach(d => {
                const row = tbody.insertRow();
                row.style.borderBottom = "1px solid #eee";
                row.innerHTML = `
                    <td style="padding:10px; font-weight:bold;">${d.id}</td>
                    <td style="padding:10px;">${d.name.substring(0,50)}</td>
                    <td style="padding:10px;">${fmt(d.baseFin)}</td>
                    <td style="padding:10px;">${fmt(d.currFin)}</td>
                    <td style="padding:10px; color:red; font-weight:bold;">+${d.var}d</td>
                    <td style="padding:10px; font-style:italic; color:#555;">${d.cause}</td>
                `;
            });
        }
    }