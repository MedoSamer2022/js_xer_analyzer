// ============================================
// gantt.js — Interactive Gantt Timeline (Fixed & Closed)
// ============================================
(function() {
    const GANTT_CONTAINER_ID = 'gantt-section';

    function init() {
        const dashboard = document.getElementById('general');
        if (!dashboard || document.getElementById(GANTT_CONTAINER_ID)) return;

        const container = document.createElement('div');
        container.id = GANTT_CONTAINER_ID;
        container.className = 'card border-rad-8px box-shadow width-100 margin-top-20px';
        
        // Fixed height viewport with scroll
        container.innerHTML = `
            <header><h3>📅 Critical Path Timeline</h3></header>
            <div class="pad-10px" style="height: 500px; overflow-y: auto; overflow-x: auto; position:relative;">
                <canvas id="ganttCanvas"></canvas>
            </div>
        `;

        // Insert after first row of cards
        const refNode = dashboard.children.length > 1 ? dashboard.children[1] : null;
        dashboard.insertBefore(container, refNode);

        const analyzeBtn = document.getElementById('analyze-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', waitForDataAndDraw);
        }
    }

    function waitForDataAndDraw() {
        // Poll for data readiness
        const checkInterval = setInterval(() => {
            if (typeof projects !== 'undefined' && projects.current && projects.current.tasks) {
                clearInterval(checkInterval);
                drawGantt();
            }
        }, 200);
    }

    function drawGantt() {
        const canvas = document.getElementById('ganttCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        // Sort tasks by Start Date
        const tasks = (projects.current.longestPath || []).sort((a,b) => (a.start||0) - (b.start||0));

        // --- Dimensions ---
        const ROW_HEIGHT = 40; 
        const HEADER_HEIGHT = 50;
        const TEXT_AREA_WIDTH = 400; // Wider for names

        // Calculate Total Height needed
        const totalHeight = Math.max(500, (tasks.length * ROW_HEIGHT) + HEADER_HEIGHT + 20);
        
        // Resize Canvas to fit content
        const containerWidth = document.getElementById(GANTT_CONTAINER_ID).offsetWidth;
        canvas.width = Math.max(containerWidth - 40, 800);
        canvas.height = totalHeight;

        if (tasks.length === 0) {
            ctx.clearRect(0,0,canvas.width,canvas.height);
            ctx.font = "16px Arial";
            ctx.fillStyle = "#666";
            ctx.fillText("No critical path found.", 20, 50);
            return;
        }

        // Calculate Time Scale
        const startTimes = tasks.map(t => t.start ? t.start.getTime() : Infinity);
        const finishTimes = tasks.map(t => t.finish ? t.finish.getTime() : -Infinity);
        const minDate = new Date(Math.min(...startTimes));
        const maxDate = new Date(Math.max(...finishTimes));
        
        minDate.setDate(minDate.getDate() - 7);
        maxDate.setDate(maxDate.getDate() + 14);

        const totalDuration = maxDate - minDate;
        const timeWidth = canvas.width - TEXT_AREA_WIDTH;
        const pxPerMs = timeWidth / (totalDuration || 1);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw Header Background
        ctx.fillStyle = "#f1f5f9";
        ctx.fillRect(0, 0, canvas.width, HEADER_HEIGHT);
        ctx.fillStyle = "#333";
        ctx.font = "bold 14px Arial";
        ctx.fillText("Activity Name", 10, 30);

        // Draw Time Grid
        ctx.font = "12px Arial";
        let d = new Date(minDate);
        d.setDate(1); 
        
        while (d <= maxDate) {
            const x = TEXT_AREA_WIDTH + (d - minDate) * pxPerMs;
            if (x >= TEXT_AREA_WIDTH && x < canvas.width) {
                ctx.strokeStyle = "#e2e8f0";
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
                ctx.fillStyle = "#475569";
                ctx.fillText(d.toLocaleString('default', { month: 'short', year:'2-digit' }), x + 5, 30);
            }
            d.setMonth(d.getMonth() + 1);
        }

        // Draw Tasks
        tasks.forEach((t, i) => {
            const y = HEADER_HEIGHT + (i * ROW_HEIGHT) + 10;
            const xStart = TEXT_AREA_WIDTH + ((t.start||minDate) - minDate) * pxPerMs;
            const width = Math.max(((t.finish||t.start) - t.start) * pxPerMs, 5);

            // Zebra Rows
            if (i % 2 === 0) {
                ctx.fillStyle = "rgba(240, 248, 255, 0.5)";
                ctx.fillRect(0, y - 25, canvas.width, ROW_HEIGHT);
            }

            // Text
            ctx.fillStyle = "#1e293b";
            ctx.font = "13px Arial";
            let name = t.task_name || "Unnamed";
            if (name.length > 50) name = name.substring(0, 48) + "...";
            ctx.fillText(name, 10, y);

            // Bar
            ctx.fillStyle = t.completed ? "#3b82f6" : (t.inProgress ? "#22c55e" : "#ef4444");
            ctx.fillRect(xStart, y - 12, width, 18);
            
            // Progress Overlay
            if (t.inProgress && t.physPercentComp) {
                ctx.fillStyle = "rgba(255,255,255,0.4)";
                ctx.fillRect(xStart, y - 12, width * t.physPercentComp, 18);
            }
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();