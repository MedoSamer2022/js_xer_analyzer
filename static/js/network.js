// ============================================
// network.js — Interactive Logic Tracer (PERT)
// ============================================
const NetworkDiagram = (function() {
    let network = null;
    let currentId = null;

    function init() {
        const menuList = document.querySelector('#menu ul');
        
        // 1. Add Sidebar Button
        if (menuList && !document.getElementById('network-btn')) {
            const li = document.createElement('li');
            li.innerHTML = `<div id="network-btn" onclick="menuClickHandle(event, 'network-view')" class="btn">🕸️ Network Logic</div>`;
            const dashBtn = document.getElementById('dashboard-btn');
            if(dashBtn && dashBtn.parentNode.nextSibling) {
                menuList.insertBefore(li, dashBtn.parentNode.nextSibling);
            } else {
                menuList.appendChild(li);
            }
        }

        // 2. Add View Section
        const content = document.getElementById('content');
        if (content && !document.getElementById('network-view')) {
            const section = document.createElement('section');
            section.id = 'network-view';
            section.className = 'cat hidden max-width-960';
            section.innerHTML = `
                <div class="card border-rad-8px box-shadow width-100">
                    <header style="display:flex; justify-content:space-between; align-items:center; padding-right:10px;">
                        <h3>🕸️ Network Logic Tracer</h3>
                        
                        <div style="display:flex; gap:10px; align-items:center;">
                            <select id="net-activity-list" style="padding:6px; border-radius:4px; border:1px solid #ccc; max-width:250px;">
                                <option value="">Select an Activity...</option>
                            </select>

                            <span style="color:#ccc;">|</span>

                            <input type="text" id="net-search" placeholder="Or type ID..." style="padding:5px; border-radius:4px; border:1px solid #ccc; width:100px;">
                            <button id="net-go-btn" class="btn-xs">Go</button>
                        </div>
                    </header>
                    <div class="pad-10px">
                        <div id="mynetwork" style="width:100%; height:500px; border:1px solid #eee; background:#fafafa;"></div>
                        <div style="margin-top:10px; font-size:0.9em; color:#666; text-align:center;">
                            <span style="color:#ef4444; font-weight:bold;">■ Critical</span> &nbsp; 
                            <span style="color:#3b82f6; font-weight:bold;">■ Completed</span> &nbsp; 
                            <span style="color:#22c55e; font-weight:bold;">■ In Progress</span> &nbsp; 
                            (Click a node to center)
                        </div>
                    </div>
                </div>
            `;
            content.appendChild(section);

            // Event Listeners
            document.getElementById('net-go-btn').addEventListener('click', () => drawActivity(document.getElementById('net-search').value));
            document.getElementById('net-search').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') drawActivity(e.target.value);
            });
            
            // Trigger drawing when dropdown changes
            document.getElementById('net-activity-list').addEventListener('change', function() {
                if (this.value) drawActivity(this.value);
            });
        }

        // 3. Listen for Analyze to populate the list
        const analyzeBtn = document.getElementById('analyze-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', waitForDataAndPopulate);
        }
    }

    function waitForDataAndPopulate() {
        const checkInterval = setInterval(() => {
            if (typeof projects !== 'undefined' && projects.current && projects.current.tasks) {
                clearInterval(checkInterval);
                populateActivityList();
            }
        }, 500);
    }

    function populateActivityList() {
        const select = document.getElementById('net-activity-list');
        if (!select || !projects.current) return;

        // Clear existing options (except first)
        select.innerHTML = '<option value="">Select an Activity...</option>';

        // Get tasks and sort by ID
        const tasks = [...projects.current.tasks.values()].sort((a,b) => a.task_code.localeCompare(b.task_code));

        // Create document fragment for speed
        const frag = document.createDocumentFragment();

        tasks.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.task_code;
            // Format: "A1000 - Pour Concrete..."
            const text = `${t.task_code} - ${t.task_name}`;
            opt.innerText = text.length > 50 ? text.substring(0,50) + "..." : text;
            frag.appendChild(opt);
        });

        select.appendChild(frag);
    }

    function drawActivity(taskCode) {
        if (!projects.current || !projects.current.tasksByCode) {
            alert("Please analyze a project first.");
            return;
        }

        // Handle case insensitive search
        let task = projects.current.tasksByCode.get(taskCode);
        if(!task) {
            // Try finding by iteration if direct get fails (for user typo tolerance)
            task = [...projects.current.tasks.values()].find(t => t.task_code.toLowerCase() === taskCode.toLowerCase());
        }

        if (!task) {
            alert("Activity ID not found: " + taskCode);
            return;
        }
        
        currentId = task.task_code;
        document.getElementById('net-search').value = task.task_code;
        
        // Sync Dropdown if it wasn't the trigger
        const dropdown = document.getElementById('net-activity-list');
        if(dropdown.value !== task.task_code) {
            dropdown.value = task.task_code;
        }

        // --- Vis.js Data Construction ---
        const nodes = [];
        const edges = [];
        const processed = new Set();

        // 1. Central Node
        addNode(task, 0); 

        // 2. Predecessors (Level -1)
        task.predecessors.forEach(rel => {
            if(rel.predTask) {
                addNode(rel.predTask, -1);
                edges.push({ from: rel.predTask.task_code, to: task.task_code, label: `${rel.link}\nLag: ${rel.lag}`, arrows: "to", color: "#94a3b8", font: {size: 10, align: 'horizontal'} });
            }
        });

        // 3. Successors (Level 1)
        task.successors.forEach(rel => {
            if(rel.succTask) {
                addNode(rel.succTask, 1);
                edges.push({ from: task.task_code, to: rel.succTask.task_code, label: `${rel.link}\nLag: ${rel.lag}`, arrows: "to", color: "#94a3b8", font: {size: 10, align: 'horizontal'} });
            }
        });

        function addNode(t, level) {
            if(processed.has(t.task_code)) return;
            processed.add(t.task_code);

            let color = "#e2e8f0"; // Default
            if(t.completed) color = "#bfdbfe"; // Blue
            else if(t.totalFloat <= 0) color = "#fecaca"; // Red
            else if(t.inProgress) color = "#bbf7d0"; // Green

            // Highlight Center Node
            const isCenter = level === 0;
            const borderWidth = isCenter ? 3 : 1;
            
            // Format Label
            const label = `<b>${t.task_code}</b>\n${truncate(t.task_name, 25)}\nDur: ${t.origDur}d | TF: ${t.totalFloat}d`;

            nodes.push({
                id: t.task_code,
                label: label,
                level: level,
                color: { background: color, border: "#64748b" },
                shape: "box",
                font: { multi: true, size: 14, face: 'Arial' },
                borderWidth: borderWidth,
                shadow: isCenter
            });
        }

        const container = document.getElementById('mynetwork');
        const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
        const options = {
            layout: {
                hierarchical: {
                    direction: "LR", 
                    levelSeparation: 280, 
                    nodeSpacing: 120,
                    treeSpacing: 130
                }
            },
            physics: false,
            interaction: { hover: true, dragNodes: true },
            edges: { smooth: { type: 'cubicBezier', forceDirection: 'horizontal', roundness: 0.4 } }
        };

        network = new vis.Network(container, data, options);

        network.on("click", function (params) {
            if (params.nodes.length > 0) {
                const clickedId = params.nodes[0];
                if (clickedId !== currentId) {
                    drawActivity(clickedId);
                }
            }
        });
    }

    function truncate(str, n) {
        return (str.length > n) ? str.substr(0, n-1) + '...' : str;
    }

    window.drawNetworkActivity = drawActivity;
    document.addEventListener('DOMContentLoaded', init);
    return { init, drawActivity, populateActivityList };
})();