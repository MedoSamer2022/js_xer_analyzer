// ============================================
// export.js — Advanced Excel Report & Recovery Plan
// ============================================
const ExcelExport = (function() {

    function init() {
        const menuList = document.querySelector('#menu ul');
        if (!menuList) return;

        // 1. Standard Full Export Button
        if (!document.getElementById('export-btn')) {
            const li = document.createElement('li');
            li.innerHTML = `<div id="export-btn" class="btn" style="background:#107c41; color:white;">⬇ Export Full Data</div>`;
            insertAfterDashboard(li, menuList);
            document.getElementById('export-btn').addEventListener('click', generateReport);
        }

        // 2. NEW: Recovery Plan Export Button
        if (!document.getElementById('recovery-btn')) {
            const li = document.createElement('li');
            li.innerHTML = `<div id="recovery-btn" class="btn" style="background:#b91c1c; color:white; margin-top:5px;">📉 Export Recovery Plan (Beta)</div>`;
            insertAfterDashboard(li, menuList);
            document.getElementById('recovery-btn').addEventListener('click', generateRecoveryPlan);
        }
    }

    // Helper to place buttons correctly in the menu
    function insertAfterDashboard(li, menuList) {
        const dashboardBtn = document.getElementById('dashboard-btn');
        if (dashboardBtn && dashboardBtn.parentNode) {
            dashboardBtn.parentNode.parentNode.insertBefore(li, dashboardBtn.parentNode.nextSibling);
        } else {
            menuList.appendChild(li);
        }
    }

    // --- STANDARD FULL REPORT (Same as before) ---
    function generateReport() {
        if (!checkProject()) return;
        const proj = projects.current;
        const wb = XLSX.utils.book_new();
        const timestamp = new Date().toISOString().split('T')[0];

        // Executive Summary
        const summaryData = [
            ["PROJECT EXECUTIVE SUMMARY"],
            ["Generated On", new Date().toLocaleString()],
            ["Project", proj.name],
            ["Data Date", formatDate(proj.last_recalc_date)],
            ["Finish Date", formatDate(proj.scd_end_date)],
            ["SPI", (proj.spi || 0).toFixed(2)]
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Executive Summary");

        // Full Register
        const allTasksRows = [...proj.tasks.values()].map(t => mapTaskToRow(t));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allTasksRows), "Activity Register");

        XLSX.writeFile(wb, `Full_Report_${proj.proj_short_name}_${timestamp}.xlsx`);
    }

    // --- NEW: RECOVERY PLAN GENERATOR ---
    function generateRecoveryPlan() {
        if (!checkProject()) return;
        const proj = projects.current;
        const wb = XLSX.utils.book_new();
        const timestamp = new Date().toISOString().split('T')[0];

        // Filter: Get Critical Path + High Negative Float
        // We also sort by Total Float (ascending) so the most critical items are at the top
        const criticalTasks = [...proj.tasks.values()]
            .filter(t => t.totalFloat <= 10 && t.status !== 'Completed') // Critical + Near Critical (10 days buffer)
            .sort((a,b) => a.totalFloat - b.totalFloat);

        if (criticalTasks.length === 0) {
            alert("Good news! No critical or near-critical activities found to recover.");
            return;
        }

        // Map to a specific "Worksheet" format
        const recoveryRows = criticalTasks.map(t => ({
            "Activity ID": t.task_code,
            "Activity Name": t.task_name,
            "WBS": t.wbs ? t.wbs.wbs_name : "",
            "Total Float": t.totalFloat,
            "Original Duration": t.origDur,
            "Remaining Duration": t.remDur,
            "Start Date": formatDate(t.start),
            "Finish Date": formatDate(t.finish),
            // --- BLANK COLUMNS FOR USER INPUT ---
            "Proposed Action": "",         // e.g. "Add Crew", "Overlap"
            "Revised Duration": "",        // e.g. 5
            "Revised Logic": "",           // e.g. "SS+2 instead of FS"
            "Cost Impact": "",             // e.g. "$5000"
            "Responsibility": ""           // e.g. "Subcontractor A"
        }));

        const ws = XLSX.utils.json_to_sheet(recoveryRows);

        // Auto-width for columns (Visual polish)
        const wscols = [
            {wch:12}, {wch:40}, {wch:20}, {wch:10}, {wch:10}, {wch:10}, {wch:12}, {wch:12}, 
            {wch:25}, {wch:15}, {wch:25}, {wch:15}, {wch:20} // Widths for new columns
        ];
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, "Recovery Worksheet");
        XLSX.writeFile(wb, `Recovery_Plan_${proj.proj_short_name}_${timestamp}.xlsx`);
    }

    // --- Helpers ---
    function checkProject() {
        if (typeof projects === 'undefined' || !projects.current) {
            alert("Please analyze a file first.");
            return false;
        }
        return true;
    }

    function formatDate(d) {
        if (!d || !(d instanceof Date)) return "";
        return d.toLocaleDateString('en-GB');
    }

    function mapTaskToRow(t) {
        return {
            "Activity ID": t.task_code,
            "Activity Name": t.task_name,
            "Status": t.status,
            "% Complete": (t.physPercentComp || 0) * 100,
            "Remaining Duration": t.remDur,
            "Start": formatDate(t.start),
            "Finish": formatDate(t.finish),
            "Total Float": t.totalFloat,
            "Total Cost": (t.resources || []).reduce((sum, r) => sum + r.target_cost, 0)
        };
    }

    document.addEventListener('DOMContentLoaded', init);
    return { init, generateReport, generateRecoveryPlan };
})();