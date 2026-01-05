// ===============================================
// wbs_manager.js — WBS Export (Fixed XER Costs)
// ===============================================

const WBSManager = (function() {
    let currentMaxLevel = 0;

    // --- 1. CONFIGURATION ---
    const DEFAULT_PALETTE = [
        "#1e293b", "#2563eb", "#0891b2", "#059669", "#ca8a04", 
        "#ea580c", "#dc2626", "#7c3aed", "#db2777", "#4b5563", "#0f172a"
    ];

    // --- HELPER: CALCULATE COSTS FROM RESOURCES & EXPENSES ---
    function calcCost(t, type) {
        let total = 0;
        
        // 1. Sum Resources (TASKRSRC)
        // Fields: target_cost (Budget), act_reg_cost + act_ot_cost (Actual), remain_cost (Remaining)
        if (t.resources && t.resources.length > 0) {
            t.resources.forEach(r => {
                if (type === 'budget') total += parseFloat(r.target_cost || 0);
                if (type === 'actual') total += parseFloat(r.act_reg_cost || 0) + parseFloat(r.act_ot_cost || 0);
                if (type === 'remain') total += parseFloat(r.remain_cost || 0);
            });
        }

        // 2. Sum Expenses (PROJCOST)
        // Fields: target_cost (Budget), act_cost (Actual), remain_cost (Remaining)
        const exps = t.expenses || t.projcosts || [];
        if (exps.length > 0) {
            exps.forEach(e => {
                if (type === 'budget') total += parseFloat(e.target_cost || 0);
                if (type === 'actual') total += parseFloat(e.act_cost || 0);
                if (type === 'remain') total += parseFloat(e.remain_cost || 0);
            });
        }

        return total;
    }

    const AVAILABLE_COLUMNS = [
        // -- General --
        { id: 'status', label: 'Activity Status', width: 12, get: t => getStatus(t) },
        { id: 'type',   label: 'Activity Type',   width: 15, get: t => t.taskType || "" },
        { id: 'cal',    label: 'Calendar',        width: 15, get: t => t.calendar ? t.calendar.clndr_name : "" },
        
        // -- Duration & % --
        { id: 'orig',    label: 'Original Dur', width: 10, get: t => t.origDur },
        { id: 'rem',     label: 'Remaining Dur',width: 10, get: t => t.remDur },
        { id: 'phys',    label: 'Physical %',   width: 10, get: t => (t.physPercentComp * 100).toFixed(0) + '%' },
        { id: 'dur_pct', label: 'Duration %',   width: 10, get: t => calcDurPct(t) },
        
        // -- Dates --
        { id: 'start',      label: 'Start Date',       width: 12, get: t => formatDate(t.start) },
        { id: 'finish',     label: 'Finish Date',      width: 12, get: t => formatDate(t.finish) },
        { id: 'bl_start',   label: 'BL Start',         width: 12, get: t => formatDate(t.target_start_date) },
        { id: 'bl_finish',  label: 'BL Finish',        width: 12, get: t => formatDate(t.target_end_date) },
        { id: 'act_start',  label: 'Actual Start',     width: 12, get: t => formatDate(t.act_start_date) },
        { id: 'act_finish', label: 'Actual Finish',    width: 12, get: t => formatDate(t.act_end_date) },

        // -- Costs (UPDATED TO USE CALCULATOR) --
        { id: 'cost_b',  label: 'Budget Cost',   width: 15, get: t => formatMoney(calcCost(t, 'budget')) },
        { id: 'cost_a',  label: 'Actual Cost',   width: 15, get: t => formatMoney(calcCost(t, 'actual')) },
        { id: 'cost_r',  label: 'Remaining Cost',width: 15, get: t => formatMoney(calcCost(t, 'remain')) },
        { id: 'cost_v',  label: 'Variance',      width: 15, get: t => formatMoney(calcCost(t, 'budget') - calcCost(t, 'actual')) },

        // -- Float --
        { id: 'float',   label: 'Total Float', width: 10, get: t => t.totalFloat },
        
        // -- Resources --
        { id: 'rsrc_id',   label: 'Resource IDs',    width: 25, get: t => getResourceList(t, 'id') },
        { id: 'rsrc_name', label: 'Resource Names',  width: 30, get: t => getResourceList(t, 'name') },
        
        { id: 'notes', label: 'Notes/Desc', width: 30, get: t => cleanText(t.task_notes) }
    ];

    function init() {
        // Sidebar Button
        const menuList = document.querySelector('#menu ul');
        if (menuList && !document.getElementById('wbs-mgr-btn')) {
            const li = document.createElement('li');
            li.innerHTML = `<div id="wbs-mgr-btn" onclick="menuClickHandle(event, 'wbs-mgr-view')" class="btn">🎨 WBS & Export</div>`;
            const wbsBtn = document.getElementById('wbs-btn');
            if (wbsBtn && wbsBtn.parentNode.nextSibling) menuList.insertBefore(li, wbsBtn.parentNode.nextSibling);
            else menuList.appendChild(li);
        }

        // Build Interface
        const content = document.getElementById('content');
        if (content && !document.getElementById('wbs-mgr-view')) {
            const section = document.createElement('section');
            section.id = 'wbs-mgr-view';
            section.className = 'cat hidden width-100'; 
            section.innerHTML = `
                <div class="card border-rad-8px box-shadow width-100">
                    <header style="padding-bottom:15px; border-bottom:1px solid #eee;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                            <h3>🎨 WBS Color Manager & Excel Export</h3>
                            
                            <div style="display:flex; gap:10px; align-items:center;">
                                <label style="font-size:0.9em; font-weight:bold; color:#475569; display:flex; align-items:center; gap:5px; cursor:pointer; background:#f1f5f9; padding:5px 10px; border-radius:4px;">
                                    <input type="checkbox" id="mgr-grouping" checked> Include Activities
                                </label>

                                <select id="mgr-wbs-filter" style="padding:4px; border-radius:4px; border:1px solid #ccc; max-width:200px;">
                                    <option value="ROOT">All WBS Levels</option>
                                </select>

                                <div style="position:relative;">
                                    <button id="mgr-cols-btn" class="btn-xs" style="background:#64748b; color:white;">📑 Columns ▼</button>
                                    <div id="mgr-cols-dropdown" style="display:none; position:absolute; top:35px; right:0; background:white; border:1px solid #ccc; padding:10px; border-radius:6px; box-shadow:0 10px 15px rgba(0,0,0,0.1); z-index:1000; min-width:250px; max-height:400px; overflow-y:auto;">
                                        <div style="font-size:0.8em; color:#888; margin-bottom:5px; border-bottom:1px solid #eee; padding-bottom:5px;">Check columns to export:</div>
                                        ${generateColumnCheckboxes()}
                                        <div style="margin-top:10px; border-top:1px solid #eee; padding-top:5px; text-align:right;">
                                            <button class="btn-xs" onclick="document.getElementById('mgr-cols-dropdown').style.display='none'">Close</button>
                                        </div>
                                    </div>
                                </div>

                                <button id="mgr-scan-btn" class="btn-xs" style="background:#3b82f6; color:white;">🔍 Scan</button>
                                <button id="mgr-export-btn" class="btn-xs" style="background:#10b981; color:white;">📊 Download Excel</button>
                            </div>
                        </div>

                        <div id="mgr-color-container" style="background:#f8fafc; padding:20px; border-radius:8px; border:1px solid #e2e8f0;">
                            <div style="color:#64748b; font-style:italic; text-align:center;">Click 'Scan' to populate WBS list and colors...</div>
                        </div>
                    </header>
                    <div class="pad-10px">
                        <div style="text-align:center; color:#64748b; margin-top:20px;">
                            Export specific WBS branches or the entire project with full formatting.
                        </div>
                    </div>
                </div>
            `;
            content.appendChild(section);

            // Bind Events
            document.getElementById('mgr-scan-btn').addEventListener('click', scanLevels);
            document.getElementById('mgr-export-btn').addEventListener('click', generateStyledExcel);
            
            // Toggle Column Dropdown
            const colBtn = document.getElementById('mgr-cols-btn');
            const colMenu = document.getElementById('mgr-cols-dropdown');
            colBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                colMenu.style.display = colMenu.style.display === 'block' ? 'none' : 'block';
            });
            colMenu.addEventListener('click', (e) => e.stopPropagation());
            document.addEventListener('click', (e) => {
                if (!colBtn.contains(e.target) && !colMenu.contains(e.target)) {
                    colMenu.style.display = 'none';
                }
            });

            // Update button text when filter changes
            document.getElementById('mgr-wbs-filter').addEventListener('change', function() {
                const btn = document.getElementById('mgr-export-btn');
                if(this.value === "ROOT") btn.innerHTML = "📊 Download Excel";
                else {
                    const txt = this.options[this.selectedIndex].text;
                    const shortName = txt.substring(0, 15) + (txt.length>15?"...":"");
                    btn.innerHTML = `📊 Export '${shortName}'`;
                }
            });
        }
    }

    // --- Helpers ---
    function safeLabel(str) { return String(str || "").replace(/\[/g, '(').replace(/\]/g, ')'); }
    function cleanText(str) { return String(str || "").replace(/[\r\n]+/g, " "); }
    
    function formatDate(date) {
        if (!date || !(date instanceof Date)) return "";
        const d = String(date.getDate()).padStart(2, '0');
        const m = date.toLocaleString('default', { month: 'short' });
        const y = String(date.getFullYear()).slice(-2);
        return `${d}-${m}-${y}`;
    }

    function formatMoney(val) {
        if (val === undefined || val === null || isNaN(val)) return "";
        return Number(val).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    }

    function getStatus(t) {
        if (t.completed) return "Completed";
        if (t.inProgress) return "In Progress";
        return "Not Started";
    }

    function calcDurPct(t) {
        if (!t.origDur || t.origDur === 0) return t.completed ? "100%" : "0%";
        const pct = ((t.origDur - t.remDur) / t.origDur) * 100;
        return pct.toFixed(0) + '%';
    }

    function getResourceList(t, field) {
        if (!t.resources || t.resources.length === 0) return "";
        return t.resources.map(r => {
            if (field === 'id') return r.resource_code || r.rsrc_short_name || "";
            if (field === 'name') return r.rsrc_name || "";
            if (field === 'role') return r.role_name || "";
            return "";
        }).filter(x => x).join("; ");
    }

    function generateColumnCheckboxes() {
        return AVAILABLE_COLUMNS.map((col, idx) => `
            <label style="display:block; margin-bottom:8px; cursor:pointer;">
                <input type="checkbox" class="mgr-col-chk" value="${col.id}" ${idx < 6 ? 'checked' : ''}> 
                <span style="margin-left:5px;">${col.label}</span>
            </label>
        `).join('');
    }

    function resolveWbsId(t) {
        if (t.wbs_id) return String(t.wbs_id);
        if (t.wbsID) return String(t.wbsID);
        if (t.wbs) {
            if (t.wbs.wbs_id) return String(t.wbs.wbs_id);
            if (t.wbs.wbsID) return String(t.wbs.wbsID);
            if (t.wbs.id) return String(t.wbs.id);
        }
        return null;
    }

    // =========================================================
    // 1. SCAN LOGIC (Populate Dropdown + Colors)
    // =========================================================
    function scanLevels() {
        if (!projects.current) return alert("No project data found.");
        
        const sourceWbsMap = projects.current.wbs || new Map();
        const container = document.getElementById('mgr-color-container');
        const dropdown = document.getElementById('mgr-wbs-filter');
        
        container.innerHTML = ""; 
        dropdown.innerHTML = '<option value="ROOT">All WBS Levels</option>'; // Reset dropdown

        const hierarchy = new Map();
        const rootId = "ROOT";
        hierarchy.set(rootId, { id: rootId, parentId: null, level: 0, name: projects.current.proj_short_name });

        // Populate Hierarchy
        if (sourceWbsMap.size > 0) {
            sourceWbsMap.forEach(w => {
                const wId = String(w.wbs_id || w.wbsID);
                const pId = w.parent_wbs_id ? String(w.parent_wbs_id) : rootId;
                const name = w.wbs_short_name || w.wbs_name || "WBS";
                hierarchy.set(wId, { id: wId, parentId: pId, level: -1, name: name });
            });
        } else {
            // Fallback
            projects.current.tasks.forEach(t => {
                const wId = resolveWbsId(t);
                if (wId) {
                    const pId = (t.wbs && t.wbs.parent_wbs_id) ? String(t.wbs.parent_wbs_id) : rootId;
                    const name = (t.wbs && t.wbs.wbs_short_name) ? t.wbs.wbs_short_name : "WBS";
                    if(!hierarchy.has(wId)) hierarchy.set(wId, { id: wId, parentId: pId, level: -1, name: name });
                }
            });
        }

        // Calculate Levels
        function calculateLevel(id) {
            const node = hierarchy.get(id);
            if (!node) return 0; 
            if (node.level !== -1) return node.level;
            if (node.visiting) return 0; 
            node.visiting = true;
            const parentLevel = calculateLevel(node.parentId);
            node.level = parentLevel + 1;
            node.visiting = false;
            return node.level;
        }

        let maxDepth = 0;
        const sortedNodes = []; // For dropdown

        hierarchy.forEach(node => {
            const lvl = calculateLevel(node.id);
            if (lvl > maxDepth) maxDepth = lvl;
            if (node.id !== rootId) sortedNodes.push(node);
        });
        currentMaxLevel = maxDepth;

        // Populate Dropdown (Alphabetical sort)
        sortedNodes.sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric: true}));
        sortedNodes.forEach(n => {
            const opt = document.createElement("option");
            opt.value = n.id;
            opt.textContent = `${n.name} (L${n.level})`;
            dropdown.appendChild(opt);
        });

        // Generate Color Controls
        const grid = document.createElement('div');
        grid.style.cssText = "display:grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap:10px;";

        for (let i = 1; i <= maxDepth; i++) {
            const colorIdx = i % DEFAULT_PALETTE.length;
            const defColor = DEFAULT_PALETTE[colorIdx] || "#333333";
            const div = document.createElement('div');
            div.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:5px; padding:8px; background:white; border:1px solid #ddd; border-radius:6px;";
            div.innerHTML = `
                <span style="font-weight:bold; color:#333; font-size:0.8em;">Lvl ${i}</span>
                <input type="color" id="wbs-lvl-${i}" value="${defColor}" style="width:100%; height:25px; border:none; cursor:pointer;">
            `;
            grid.appendChild(div);
        }
        container.appendChild(grid);
    }

    // =========================================================
    // 2. EXCEL EXPORT (Filtered)
    // =========================================================
    function generateStyledExcel() {
        if (!projects.current) return alert("No data.");
        if (typeof XLSX === 'undefined') return alert("Excel Library missing.");

        const showTasks = document.getElementById('mgr-grouping').checked;
        const filterId = document.getElementById('mgr-wbs-filter').value;
        const rootId = "ROOT";
        
        // --- 1. Get Selected Columns ---
        const activeColumns = [];
        document.querySelectorAll('.mgr-col-chk:checked').forEach(chk => {
            const colDef = AVAILABLE_COLUMNS.find(c => c.id === chk.value);
            if (colDef) activeColumns.push(colDef);
        });

        // --- 2. Rebuild Tree ---
        const treeMap = new Map();
        
        treeMap.set(rootId, { 
            id: rootId, code: projects.current.proj_short_name, name: projects.current.name, 
            level: 0, children: [], tasks: [] 
        });

        const sourceWbs = projects.current.wbs || new Map();
        sourceWbs.forEach(w => {
            const wId = String(w.wbs_id || w.wbsID);
            if(!treeMap.has(wId)) {
                treeMap.set(wId, {
                    id: wId, code: w.wbs_short_name, name: w.wbs_name,
                    parentId: w.parent_wbs_id ? String(w.parent_wbs_id) : rootId, 
                    level: -1, children: [], tasks: []
                });
            }
        });

        treeMap.forEach(node => {
            if (node.id === rootId) return;
            let parent = treeMap.get(node.parentId);
            if (!parent) { parent = treeMap.get(rootId); node.parentId = rootId; }
            parent.children.push(node);
        });

        function setTreeLevels(node, lvl) {
            node.level = lvl;
            node.children.forEach(c => setTreeLevels(c, lvl+1));
        }
        setTreeLevels(treeMap.get(rootId), 0);

        const tasks = [...projects.current.tasks.values()];
        tasks.forEach(t => {
            const wId = resolveWbsId(t);
            if (wId && treeMap.has(wId)) treeMap.get(wId).tasks.push(t);
        });

        // --- 3. Colors ---
        const levelColors = {};
        levelColors[0] = "DDDDDD"; 
        for(let i=1; i<=currentMaxLevel; i++) {
            const el = document.getElementById(`wbs-lvl-${i}`);
            levelColors[i] = el ? el.value.replace('#', '') : "FFFFFF";
        }

        // --- 4. Build Excel Data ---
        const excelRows = [];
        const rowProps = []; 

        const headerRow = [
            { v: "ID / Code", s: { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "333333" } } } },
            { v: "Description", s: { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "333333" } } } }
        ];
        activeColumns.forEach(col => {
            headerRow.push({ v: col.label, s: { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "333333" } } } });
        });
        excelRows.push(headerRow);
        rowProps.push({ level: 0 });

        function traverse(node, currentFilterId) {
            // FILTER LOGIC:
            let shouldProcess = (currentFilterId === "ROOT") || (node.id === currentFilterId) || (node.isChildOfFilter);
            
            if (node.id === currentFilterId) node.isChildOfFilter = true; // Mark self
            
            // Mark children if parent was the filter match
            if (shouldProcess) {
                node.children.forEach(c => c.isChildOfFilter = true);
            }

            if (shouldProcess) {
                const color = levelColors[node.level] || "FFFFFF";
                const isDark = parseInt(color.substring(0,2), 16) < 100;
                const fontColor = isDark ? "FFFFFF" : "000000";
                const bgStyle = { fill: { fgColor: { rgb: color } } };

                const wbsRow = [
                    { v: node.code, s: { ...bgStyle, font: { color: { rgb: fontColor }, bold: true } } },
                    { v: node.name, s: { ...bgStyle, alignment: { indent: node.level }, font: { color: { rgb: fontColor }, bold: true } } }
                ];
                activeColumns.forEach(() => wbsRow.push({ v: "", s: bgStyle }));
                
                excelRows.push(wbsRow);
                rowProps.push({ level: node.level, hidden: false });

                if (showTasks && node.tasks.length > 0) {
                    node.tasks.sort((a,b) => a.task_code.localeCompare(b.task_code));
                    node.tasks.forEach(t => {
                        const taskRow = [
                            { v: t.task_code, s: { font: { color: { rgb: "555555" } } } },
                            { v: safeLabel(t.task_name), s: { alignment: { indent: node.level + 1 } } }
                        ];
                        activeColumns.forEach(col => {
                            let rawVal = col.get(t);
                            if (rawVal === undefined || rawVal === null) rawVal = "";
                            taskRow.push({ v: rawVal, s: {} });
                        });
                        excelRows.push(taskRow);
                        rowProps.push({ level: node.level + 1, hidden: false });
                    });
                }
            }

            // Recurse regardless, but only "shouldProcess" nodes get added to array
            node.children.sort((a,b) => a.code.localeCompare(b.code));
            node.children.forEach(c => {
                // Pass down the flag if we are already inside the filter branch
                if (shouldProcess) c.isChildOfFilter = true;
                traverse(c, currentFilterId);
            });
        }

        traverse(treeMap.get(rootId), filterId);

        // --- 5. Write ---
        const ws = XLSX.utils.aoa_to_sheet([]);
        ws['!ref'] = XLSX.utils.encode_range({ s: {c:0, r:0}, e: {c: headerRow.length - 1, r: excelRows.length} });
        
        const colWidths = [{wch: 25}, {wch: 70}];
        activeColumns.forEach(col => colWidths.push({wch: col.width}));
        ws['!cols'] = colWidths;
        ws['!rows'] = rowProps;

        for(let R=0; R<excelRows.length; ++R) {
            for(let C=0; C<excelRows[R].length; ++C) {
                const ref = XLSX.utils.encode_cell({c:C, r:R});
                ws[ref] = excelRows[R][C];
            }
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "WBS Report");
        XLSX.writeFile(wb, `WBS_Export_${projects.current.proj_short_name}.xlsx`);
    }

    document.addEventListener('DOMContentLoaded', init);
    return { init };
})();