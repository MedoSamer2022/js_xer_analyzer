// ============================================
// multi-compare.js — Multi-Project Side-by-Side Comparison
// ============================================

(function() {
    let multiProjects = []; // Store parsed project objects

    // --- Configuration: Available Metrics to Compare ---
    const METRICS = {
        "dates": {
            title: "Key Dates",
            items: [
                { id: "data_date", label: "Data Date", get: p => formatDate(p.last_recalc_date) },
                { id: "start_date", label: "Start Date", get: p => formatDate(p.start) },
                { id: "finish_date", label: "Finish Date", get: p => formatDate(p.scd_end_date) },
                { id: "must_finish", label: "Must Finish By", get: p => p.plan_end_date ? formatDate(p.plan_end_date) : "-" }
            ]
        },
        "duration": {
            title: "Duration & Float",
            items: [
                { id: "orig_dur", label: "Original Duration", get: p => formatNumber(p.origDurSum) },
                { id: "rem_dur", label: "Remaining Duration", get: p => formatNumber(p.remDurSum) },
                { id: "critical_cnt", label: "Critical Activities", get: p => p.critical.length },
                { id: "longest_path", label: "Longest Path Qty", get: p => p.longestPath.length },
                { id: "neg_float", label: "Negative Float Qty", get: p => p.negativeFloat.length }
            ]
        },
        "cost": {
            title: "Cost & Units",
            items: [
                { id: "budget_cost", label: "Budgeted Cost", get: p => formatCost(p.budgetCost) },
                { id: "actual_cost", label: "Actual Cost", get: p => formatCost(p.actualCost) },
                { id: "remain_cost", label: "Remaining Cost", get: p => formatCost(p.remainingCost) },
                { id: "earned_value", label: "Earned Value", get: p => formatCost(p.earnedValue) },
                { id: "labor_units", label: "Labor Units", get: p => formatNumber(p.budgetQty) }
            ]
        },
        "performance": {
            title: "Performance",
            items: [
                { id: "sched_percent", label: "Schedule %", get: p => formatPercent(p.schedPercentComp) },
                { id: "phys_percent", label: "Physical %", get: p => formatPercent(p.physPercentComp) },
                { id: "spi", label: "SPI", get: p => p.spi ? p.spi.toFixed(2) : "-" },
                { id: "cpi", label: "CPI", get: p => (p.earnedValue && p.actualCost) ? (p.earnedValue / p.actualCost).toFixed(2) : "-" }
            ]
        },
        "counts": {
            title: "Activity Counts",
            items: [
                { id: "total_acts", label: "Total Activities", get: p => p.tasks.size },
                { id: "not_started", label: "Not Started", get: p => p.notStarted.length },
                { id: "in_progress", label: "In Progress", get: p => p.inProgress.length },
                { id: "completed", label: "Completed", get: p => p.completed.length }
            ]
        }
    };

    // --- Initialization ---
    document.addEventListener('DOMContentLoaded', () => {
        const input = document.getElementById("multi-file-input");
        const btn = document.getElementById("multi-compare-btn");
        
        if (input) input.addEventListener("change", handleMultiUpload);
        if (btn) btn.addEventListener("click", generateComparisonTable);

        renderMetricSelectors();
    });

    // --- Handle File Uploads ---
    function handleMultiUpload(e) {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const statusArea = document.getElementById("multi-upload-status");
        statusArea.innerHTML = "⏳ Parsing files... Please wait.";
        multiProjects = []; // Reset

        let loadedCount = 0;

        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    // 1. Parse XER (uses global parseFile from parse.js)
                    const rawData = parseFile(evt.target.result, file.name);
                    
                    // 2. Analyze Project (uses global analyzeProject from main.js)
                    // We take the first project found in the file
                    const pid = Object.keys(rawData.PROJECT)[0];
                    let projObj = rawData.PROJECT[pid];
                    
                    // Ensure the main analysis logic runs on it to get SPI, Float, etc.
                    if(typeof analyzeProject === 'function'){
                        projObj = analyzeProject(projObj);
                    }

                    projObj.fileName = file.name;
                    multiProjects.push(projObj);

                } catch (err) {
                    console.error("Error parsing " + file.name, err);
                }

                loadedCount++;
                if (loadedCount === files.length) {
                    finalizeLoading();
                }
            };
            reader.readAsText(file, "cp1252");
        });
    }

    function finalizeLoading() {
        // Sort projects by Data Date (Oldest to Newest) automatically
        multiProjects.sort((a, b) => {
            const da = a.last_recalc_date || new Date(0);
            const db = b.last_recalc_date || new Date(0);
            return da - db;
        });

        const statusArea = document.getElementById("multi-upload-status");
        statusArea.innerHTML = `✅ Successfully loaded ${multiProjects.length} projects. (Sorted by Data Date)`;
        const btn = document.getElementById("multi-compare-btn");
        if(btn) btn.disabled = false;
    }

    // --- Render Checkboxes for Metrics ---
    function renderMetricSelectors() {
        const container = document.getElementById("metric-selectors");
        if (!container) return;

        let html = "";
        for (const [key, category] of Object.entries(METRICS)) {
            html += `<div class="metric-group">
                <strong style="display:block; margin-bottom:5px; color:var(--blue);">${category.title}</strong>`;
            category.items.forEach(item => {
                // Pre-select common useful metrics
                const checked = ["data_date", "finish_date", "spi", "critical_cnt", "sched_percent"].includes(item.id) ? "checked" : "";
                html += `<label class="metric-label">
                    <input type="checkbox" class="metric-cb" value="${key}:${item.id}" ${checked}> ${item.label}
                </label>`;
            });
            html += `</div>`;
        }
        container.innerHTML = html;
    }

    // --- Generate the Table ---
    function generateComparisonTable() {
        const container = document.getElementById("multi-result-area");
        container.innerHTML = "";
        container.classList.remove("hidden");

        if (multiProjects.length === 0) {
            container.innerHTML = "<div class='pad-10px'>No projects loaded. Please upload XER files first.</div>";
            return;
        }

        // 1. Get Selected Metrics
        const checkboxes = document.querySelectorAll(".metric-cb:checked");
        const selectedMetrics = Array.from(checkboxes).map(cb => {
            const [cat, id] = cb.value.split(":");
            return METRICS[cat].items.find(x => x.id === id);
        });

        if (selectedMetrics.length === 0) {
            alert("Please select at least one metric to compare.");
            return;
        }

        // 2. Build Table HTML
        const table = document.createElement("table");
        table.className = "multi-table";
        table.style.width = "100%";

        // --- Header Row (Project Names) ---
        let thead = "<thead><tr><th style='text-align:left; background:#f4f4f4; padding:12px; border-bottom:2px solid #ddd;'>Metric</th>";
        multiProjects.forEach(p => {
            const dateStr = p.last_recalc_date ? formatDate(p.last_recalc_date) : "N/A";
            thead += `<th style='text-align:center; background:#e6f7ff; padding:10px; min-width:140px; border-bottom:2px solid #ddd;'>
                <div style="font-weight:bold;">${p.proj_short_name}</div>
                <div style="font-size:0.85em; color:#666; margin-top:4px;">${dateStr}</div>
                <div style="font-size:0.7em; color:#999;">${p.fileName.substring(0,20)}...</div>
            </th>`;
        });
        thead += "</tr></thead>";
        
        // --- Body Rows (Metrics) ---
        let tbody = "<tbody>";
        selectedMetrics.forEach(metric => {
            tbody += `<tr style="border-bottom:1px solid #eee;">`;
            tbody += `<td style="padding:10px; font-weight:bold; color:#444; background:#fafafa;">${metric.label}</td>`;
            
            multiProjects.forEach(p => {
                let val = metric.get(p);
                // Highlight SPI logic
                let style = "text-align:center; padding:10px;";
                if (metric.id === 'spi') {
                    if(val < 0.9) style += "color:#cf1322; font-weight:bold; background:#fff1f0;"; // Red
                    else if(val >= 1.0) style += "color:#389e0d; background:#f6ffed;"; // Green
                }
                tbody += `<td style="${style}">${val}</td>`;
            });
            tbody += `</tr>`;
        });
        tbody += "</tbody>";

        table.innerHTML = thead + tbody;

        // --- Wrapper Card ---
        const wrapper = document.createElement("div");
        wrapper.className = "card border-rad-8px box-shadow";
        wrapper.style.overflowX = "auto"; 
        
        // Export button reused from main.js logic
        const headerDiv = document.createElement("div");
        headerDiv.innerHTML = `<h3 class="pad-bm-05em">Comparison Result <button class="btn-xs float-right" onclick="downloadTableAsCSV(this.closest('.card').querySelector('table'), 'multi_compare.csv')">⬇ CSV</button></h3>`;
        
        wrapper.appendChild(headerDiv);
        const p = document.createElement("div"); 
        p.className="pad-10px";
        p.appendChild(table);
        wrapper.appendChild(p);

        container.appendChild(wrapper);
    }
})();