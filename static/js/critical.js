// ==========================================
// ADD THIS TO THE END OF main.js
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('critical-btn');
    if (btn) {
        btn.addEventListener('click', (e) => {
            // 1. Switch View
            menuClickHandle(e, 'critical-view');

            // 2. check if project exists
            if (!projects.current || !projects.current.critical) return;

            // 3. Render Table
            renderCriticalPathTable();
        });
    }
});

function renderCriticalPathTable() {
    const container = document.getElementById('critical-path-container');
    if (!container) return;
    container.innerHTML = ''; // Clear previous

    const tasks = projects.current.critical; // Already filtered in analyzeProject()

    // Create Card
    const card = document.createElement('div');
    card.className = 'card border-rad-8px box-shadow';

    // Header with Export Button
    card.innerHTML = `
        <h3 class="pad-bm-05em">
            Critical Path Activities (${tasks.length.toLocaleString()})
            <button class="btn-xs float-right" onclick="downloadTableAsCSV(this.closest('.card').querySelector('table'), 'Critical_Path.csv')">
                <i class="fa-solid fa-download"></i> CSV
            </button>
        </h3>
        <div class="pad-10px">
            <table class="width-100" id="crit-table">
                <thead>
                    <tr>
                        <th class="text-left">Activity ID</th>
                        <th class="text-left">Activity Name</th>
                        <th class="text-center">OD</th>
                        <th class="text-center">Start</th>
                        <th class="text-center">Finish</th>
                        <th class="text-center">Total Float</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
    `;

    const tbody = card.querySelector('tbody');

    // Populate Rows
    tasks.forEach(t => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="text-left no-wrap"><b>${t.task_code}</b></td>
            <td class="text-left">${t.task_name}</td>
            <td class="text-center">${t.origDur}</td>
            <td class="text-center no-wrap">${formatDate(t.start)}</td>
            <td class="text-center no-wrap">${formatDate(t.finish)}</td>
            <td class="text-center" style="color:red; font-weight:bold;">${t.totalFloat}</td>
        `;
        tbody.appendChild(row);
    });

    container.appendChild(card);
}