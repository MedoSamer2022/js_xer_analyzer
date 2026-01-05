// ============================================
// wbs.js — Fixed WBS Visualizer (Crash Proof)
// ============================================
const WBSTree = (function() {
    let network = null;
    let wbsNodes = []; 

    function init() {
        // 1. Add Sidebar Button
        const menuList = document.querySelector('#menu ul');
        if (menuList && !document.getElementById('wbs-btn')) {
            const li = document.createElement('li');
            li.innerHTML = `<div id="wbs-btn" onclick="menuClickHandle(event, 'wbs-view')" class="btn">🌳 WBS Tree</div>`;
            const netBtn = document.getElementById('network-btn');
            if (netBtn && netBtn.parentNode.nextSibling) {
                menuList.insertBefore(li, netBtn.parentNode.nextSibling);
            } else {
                menuList.appendChild(li);
            }
        }

        // 2. Add View Section
        const content = document.getElementById('content');
        if (content && !document.getElementById('wbs-view')) {
            const section = document.createElement('section');
            section.id = 'wbs-view';
            section.className = 'cat hidden width-100'; 
            section.innerHTML = `
                <div class="card border-rad-8px box-shadow width-100">
                    <header style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                        <h3>🌳 Project WBS Hierarchy</h3>
                        
                        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                            <select id="wbs-list-selector" style="padding:6px; border-radius:4px; border:1px solid #ccc; max-width:250px;">
                                <option value="">Jump to WBS...</option>
                            </select>

                            <span style="color:#e2e8f0;">|</span>

                            <input type="text" id="wbs-search" placeholder="Search Name..." 
                                style="padding:6px; border-radius:4px; border:1px solid #ccc; width:120px;">
                            
                            <button id="wbs-search-btn" class="btn-xs" style="background:#2563eb; color:white;">Find</button>
                            <button id="wbs-fit-btn" class="btn-xs" style="background:#64748b; color:white;">Fit All</button>
                            <button id="wbs-draw-btn" class="btn-xs">Refresh</button>
                        </div>
                    </header>
                    
                    <div class="pad-10px">
                        <div id="wbs-loading" style="display:none; color:#2563eb; font-weight:bold; text-align:center; padding:10px;">
                            Building tree...
                        </div>
                        <div id="wbs-network" style="width:100%; height:75vh; border:1px solid #e2e8f0; background:#f8fafc; border-radius:8px;"></div>
                        <div style="margin-top:8px; font-size:0.85em; color:#64748b; text-align:center;">
                            <span style="display:inline-block; width:12px; height:12px; background:#1e293b; border-radius:2px;"></span> Root &nbsp;
                            <span style="display:inline-block; width:12px; height:12px; background:#2563eb; border-radius:2px;"></span> L1 &nbsp;
                            <span style="display:inline-block; width:12px; height:12px; background:#0891b2; border-radius:2px;"></span> L2 &nbsp;
                            <span style="display:inline-block; width:12px; height:12px; background:#059669; border-radius:2px;"></span> L3+
                        </div>
                    </div>
                </div>
            `;
            content.appendChild(section);

            // Bind Events
            document.getElementById('wbs-draw-btn').addEventListener('click', () => drawWBS(true));
            document.getElementById('wbs-fit-btn').addEventListener('click', () => network && network.fit({ animation: true }));
            document.getElementById('wbs-search-btn').addEventListener('click', searchWBS);
            document.getElementById('wbs-search').addEventListener('keypress', (e) => { if(e.key==='Enter') searchWBS(); });
            
            // Dropdown Change Event
            document.getElementById('wbs-list-selector').addEventListener('change', function() {
                if(this.value) focusNode(this.value);
            });
        }
        
        // Auto-load hook
        const analyzeBtn = document.getElementById('analyze-btn');
        if (analyzeBtn) analyzeBtn.addEventListener('click', () => setTimeout(() => drawWBS(false), 2000));
    }

    function drawWBS(force) {
        if (!projects.current || !projects.current.tasks) {
            if(force) alert("No project data found. Please analyze a file first.");
            return;
        }

        const loader = document.getElementById('wbs-loading');
        if(loader) loader.style.display = 'block';

        // Small delay to allow UI to show loader
        setTimeout(() => {
            buildAndRenderTree();
            if(loader) loader.style.display = 'none';
        }, 50);
    }

    // ===============================================
    // FIXED: Safe Label Sanitizer
    // Replaces [ and ] with ( ) to prevent crashes
    // ===============================================
// FIXED: Replaces [ ] ( ) with { } to prevent ALL Regex crashes
function safeLabel(str) {
    if (!str) return "";
    return String(str)
        .replace(/[\[\(]/g, '{')  // Replace [ and ( with {
        .replace(/[\]\)]/g, '}'); // Replace ] and ) with }
}

    function truncate(str, n) {
        if (!str) return "";
        return (str.length > n) ? str.substr(0, n-1) + '...' : str;
    }

    function buildAndRenderTree() {
        const wbsMap = new Map();
        const rootId = "ROOT";
        
        // 1. Define Root
        wbsMap.set(rootId, { 
            id: rootId, 
            label: `<b>${safeLabel(projects.current.proj_short_name || "PROJ")}</b>\n${truncate(safeLabel(projects.current.name), 40) || "Project"}`, 
            plainLabel: safeLabel(projects.current.name) || "Project Root",
            parentId: null
        });

        // 2. Harvest Nodes from Tasks
        const tasks = [...projects.current.tasks.values()];
        tasks.forEach(t => {
            if (t.wbs) {
                const wId = t.wbs.wbsID || t.wbs.wbs_id;
                // Only add if we haven't seen this WBS ID yet
                if (wId && !wbsMap.has(wId)) {
                    // Apply safeLabel to both Name and Code
                    const wName = safeLabel(t.wbs.wbs_name || "WBS"); 
                    const wCode = safeLabel(t.wbs.wbs_short_name || ""); 
                    
                    wbsMap.set(wId, {
                        id: wId,
                        label: `<b>${wCode}</b>\n${truncate(wName, 35)}`,
                        plainLabel: `${wCode} - ${wName}`, 
                        parentId: t.wbs.parent_wbs_id || rootId
                    });
                }
            }
        });

        // 3. Populate Dropdown List
        populateDropdown(wbsMap);

        // 4. Build Vis.js Data
        const nodes = [];
        const edges = [];

        wbsMap.forEach(node => {
            // Color Logic
            let bgColor = "#64748b"; 
            let fontColor = "#ffffff";

            if (node.id === rootId) { bgColor = "#1e293b"; }
            else {
                if (node.parentId === rootId) bgColor = "#2563eb"; // Blue (L1)
                else if (wbsMap.get(node.parentId)?.parentId === rootId) bgColor = "#0891b2"; // Cyan (L2)
                else bgColor = "#059669"; // Green (L3+)
            }

            nodes.push({
                id: node.id,
                label: node.label,
                title: node.plainLabel, 
                shape: "box",
                color: { background: bgColor, border: "#ffffff", highlight: { background: "#f59e0b", border: "#fff" } },
                font: { multi: true, color: fontColor, size: 14, face: 'Segoe UI' },
                margin: 12,
                borderWidth: 2,
                shadow: { enabled: true, color: 'rgba(0,0,0,0.2)', x: 2, y: 4, size: 5 }
            });

            if (node.parentId) {
                const safeParent = wbsMap.has(node.parentId) ? node.parentId : rootId;
                if (safeParent !== node.id) {
                    edges.push({ from: safeParent, to: node.id });
                }
            }
        });

        wbsNodes = nodes;

        // 5. Render
        const container = document.getElementById('wbs-network');
        // Safety check if container exists
        if (!container) return;

        const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
        
        const options = {
            layout: {
                hierarchical: {
                    direction: "UD",
                    sortMethod: "directed",
                    levelSeparation: 120,
                    nodeSpacing: 180,
                    treeSpacing: 220,
                    blockShifting: true,
                    edgeMinimization: true,
                    parentCentralization: true
                }
            },
            physics: false, // Performance setting
            interaction: {
                dragNodes: false,
                hover: true,
                navigationButtons: true,
                keyboard: true,
                zoomView: true // Enabled so you can zoom, but might cause warning. Set false to disable scroll zoom.
            },
            edges: {
                color: "#cbd5e1",
                width: 1.5,
                smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.5 }
            }
        };

        if (network) network.destroy();
        network = new vis.Network(container, data, options);
        
        network.once("stabilized", () => network.fit());
    }

    function populateDropdown(map) {
        const select = document.getElementById('wbs-list-selector');
        if(!select) return;

        select.innerHTML = '<option value="">Jump to WBS...</option>';
        
        // Convert map to array and sort alphabetically
        const sorted = Array.from(map.values()).sort((a,b) => a.plainLabel.localeCompare(b.plainLabel));

        const frag = document.createDocumentFragment();
        sorted.forEach(node => {
            if(node.id === "ROOT") return; // Skip root
            const opt = document.createElement('option');
            opt.value = node.id;
            opt.innerText = node.plainLabel.length > 50 ? node.plainLabel.substring(0,50)+"..." : node.plainLabel;
            frag.appendChild(opt);
        });
        select.appendChild(frag);
    }

    function searchWBS() {
        const query = document.getElementById('wbs-search').value.toLowerCase();
        if (!query || !network) return;

        // Search in plain label to avoid HTML tags
        const match = wbsNodes.find(n => (n.title && n.title.toLowerCase().includes(query)));
        
        if (match) focusNode(match.id);
        else alert("No WBS element found matching: " + query);
    }

    function focusNode(nodeId) {
        if(!network) return;
        network.selectNodes([nodeId]);
        network.focus(nodeId, { 
            scale: 1.0, 
            animation: { duration: 1000, easingFunction: "easeInOutQuad" } 
        });
    }

    document.addEventListener('DOMContentLoaded', init);
    return { init, drawWBS };
})();