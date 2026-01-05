// ============================================
// search.js — Popup Activity Inspector
// Features: Driving Logic + Network Diagram Launcher
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById("task-search-input");
    const searchBtn   = document.getElementById("task-search-btn");

    if (!searchBtn || !searchInput) {
        return; // Elements might not exist if sidebar is hidden
    }

    // Allow pressing "Enter" key to search
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") searchBtn.click();
    });

    searchBtn.addEventListener("click", () => {
        // 1. Check Data
        if (typeof projects === 'undefined' || !projects.current || !projects.current.tasksByCode) {
            alert("⚠️ Please Upload an XER file and click the 'Analyze' button first.");
            return;
        }

        const rawCode = searchInput.value.trim();
        if (!rawCode) return;

        // 2. Find Task (Case insensitive)
        let task = projects.current.tasksByCode.get(rawCode);
        if (!task) task = projects.current.tasksByCode.get(rawCode.toUpperCase());

        // 3. Create Modal Overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        // Close on click outside
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) document.body.removeChild(overlay);
        });

        // 4. Generate Content
        let contentHtml = '';
        
        if (!task) {
            // Not Found View
            contentHtml = `
            <div class="card border-rad-8px box-shadow modal-content" style="background:#fff1f0; border-left: 5px solid #ff4d4f;">
                <div class="pad-10px">
                    <div style="display:flex; justify-content:space-between;">
                        <h3 style="color:#cf1322; margin:0;">❌ Activity Not Found</h3>
                        <button class="btn-xs" style="background:#ff4d4f; border:none;" id="close-modal-btn">✖</button>
                    </div>
                    <p style="margin-top:10px;">Could not find Activity ID: <strong>"${rawCode}"</strong></p>
                </div>
            </div>`;
        } else {
            // Found View
            const floatColor = task.totalFloat <= 0 ? '#ff4d4f' : '#389e0d'; 
            const safeDate = (d) => (typeof formatDate === 'function') ? formatDate(d) : new Date(d).toLocaleDateString();

            contentHtml = `
            <div class="card border-rad-8px box-shadow modal-content" style="background:white;">
                <div style="background:var(--blue); color:white; padding:12px; border-radius:8px 8px 0 0; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0;">Inspector: ${task.task_code}</h3>
                    
                    <div>
                        <button class="btn-xs" style="background:#fff; color:var(--blue); font-weight:bold; margin-right:10px; border:none;" id="view-network-btn">
                           ☊ Trace Logic
                        </button>
                        <button class="btn-xs" style="background:rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.5);" id="close-modal-btn">✖ Close</button>
                    </div>
                </div>
                
                <div class="pad-10px">
                    <table style="width:100%; border-collapse: collapse; margin-bottom:15px;">
                        <tr style="border-bottom:1px solid #eee"><td style="padding:8px; color:#666; width:100px;">Name:</td><td colspan="3" style="font-weight:bold; font-size:1.1em;">${task.task_name}</td></tr>
                        <tr style="border-bottom:1px solid #eee"><td style="padding:8px; color:#666;">Status:</td><td>${task.status}</td><td style="padding:8px; color:#666;">Type:</td><td>${task.taskType}</td></tr>
                        <tr style="border-bottom:1px solid #eee"><td style="padding:8px; color:#666;">Start:</td><td>${safeDate(task.start)}</td><td style="padding:8px; color:#666;">Finish:</td><td>${safeDate(task.finish)}</td></tr>
                        <tr style="border-bottom:1px solid #eee"><td style="padding:8px; color:#666;">Total Float:</td><td style="font-weight:bold; color:${floatColor}">${task.totalFloat} d</td><td style="padding:8px; color:#666;">Free Float:</td><td>${task.freeFloat} d</td></tr>
                        <tr style="border-bottom:1px solid #eee"><td style="padding:8px; color:#666;">Orig Dur:</td><td>${task.origDur} d</td><td style="padding:8px; color:#666;">Rem Dur:</td><td>${task.remDur} d</td></tr>
                        <tr><td style="padding:8px; color:#666;">Constraint:</td><td>${task.primeConstraint || 'None'}</td><td style="padding:8px; color:#666;">Date:</td><td>${safeDate(task.cstr_date)}</td></tr>
                    </table>

                    <h4 style="background:#f4f4f4; padding:8px; border-radius:4px; margin-bottom:10px;">Relationships (${task.predecessors.length + task.successors.length})</h4>
                    <div style="max-height:250px; overflow-y:auto; border:1px solid #eee; border-radius:4px;">
                        <table style="width:100%; font-size:0.9em; border-collapse: collapse;">
                            <thead style="background:#fafafa; position:sticky; top:0;">
                                <tr style="text-align:left; color:#666;">
                                    <th style="padding:8px;">Type</th>
                                    <th style="padding:8px;">ID</th>
                                    <th style="padding:8px;">Name</th>
                                    <th style="padding:8px;">Rel</th>
                                    <th style="padding:8px;">Lag</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${generateRelRows(task)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;
        }

        overlay.innerHTML = contentHtml;
        document.body.appendChild(overlay);

        // 5. Bind Buttons (Close & Trace Logic)
        setTimeout(() => {
            // Close Button
            const closeBtn = overlay.querySelector('#close-modal-btn');
            if(closeBtn) closeBtn.addEventListener('click', () => document.body.removeChild(overlay));

            // Trace Logic Button (New Feature)
            const netBtn = overlay.querySelector('#view-network-btn');
            if(netBtn) {
                netBtn.addEventListener('click', () => {
                    // Check if the Network script is loaded
                    if(typeof NetworkDiagram !== 'undefined'){
                        NetworkDiagram.open(task.task_code);
                    } else {
                        alert("Network Diagram script not loaded yet.");
                    }
                });
            }
        }, 0);
    });

    // Helper: Generate Relationship Rows with Driving Logic
    function generateRelRows(task) {
        let html = '';
        const renderRow = (type, rel, linked) => {
            const bg = type === 'Predecessor' ? '#e6f7ff' : '#f6ffed';
            
            // Driving Logic Calculation
            let isDriving = false;
            // FS Link check
            if(type === 'Predecessor' && rel.link === 'FS' && linked.finish && task.start){
                const diff = Math.abs(task.start.getTime() - linked.finish.getTime());
                if(diff < 86400000) isDriving = true; 
            }
            // SS Link check
            if(type === 'Predecessor' && rel.link === 'SS' && linked.start && task.start){
                const diff = Math.abs(task.start.getTime() - linked.start.getTime());
                if(diff < 86400000) isDriving = true; 
            }

            const driveBadge = isDriving 
                ? `<span style="color:white; background:#ff4d4f; padding:1px 4px; border-radius:3px; font-size:0.7em; margin-left:5px; font-weight:bold;">DRIVING</span>` 
                : ``;

            return `<tr style="border-bottom:1px solid #eee;">
                <td style="padding:6px;"><span style="background:${bg}; padding:2px 6px; border-radius:4px; font-size:0.85em;">${type}</span></td>
                <td style="padding:6px; font-weight:bold;">
                    ${linked.task_code}
                    ${driveBadge}
                </td>
                <td style="padding:6px; color:#555;">${linked.task_name.substring(0, 30)}${linked.task_name.length > 30 ? '...' : ''}</td>
                <td style="padding:6px;">${rel.link}</td>
                <td style="padding:6px;">${rel.lag}</td>
            </tr>`;
        };

        task.predecessors.forEach(p => html += renderRow('Predecessor', p, p.predTask));
        task.successors.forEach(s => html += renderRow('Successor', s, s.succTask));
        
        if (!html) html = `<tr><td colspan="5" style="text-align:center; padding:15px; color:#999;">No relationships found.</td></tr>`;
        return html;
    }
});