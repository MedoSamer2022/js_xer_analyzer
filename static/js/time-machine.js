const TimeMachine = (function() {
    let ctx, canvas;
    let tasks = [];
    let isInitialized = false;
    
    function init() {
        const analyzeBtn = document.getElementById('analyze-btn');
        if (analyzeBtn) analyzeBtn.addEventListener('click', () => setTimeout(prepareData, 1000));

        const tmBtn = document.getElementById('tm-btn');
        if (tmBtn) {
            tmBtn.addEventListener('click', () => {
                setTimeout(() => { resizeCanvas(); drawFrame(); }, 50);
            });
        }

        const slider = document.getElementById('tm-slider');
        const playBtn = document.getElementById('tm-play');
        if(slider) slider.addEventListener('input', drawFrame);
        if(playBtn) playBtn.addEventListener('click', playAnimation);
        window.addEventListener('resize', resizeCanvas);
    }

    function prepareData() {
        if (!projects.current) return;
        tasks = [...projects.current.tasks.values()]
            .filter(t => t.start instanceof Date && !isNaN(t.start) && t.finish instanceof Date && !isNaN(t.finish))
            .sort((a,b) => a.start - b.start);
        isInitialized = true;
    }

    function resizeCanvas() {
        canvas = document.getElementById('tmCanvas');
        if(!canvas || !isInitialized) return;
        const parent = canvas.parentElement;
        if (parent.offsetWidth > 0) {
            canvas.width = parent.offsetWidth;
            canvas.height = Math.max(tasks.length * 25, 400); 
            ctx = canvas.getContext('2d');
            drawFrame();
        }
    }

    function playAnimation() {
        if(!isInitialized) return;
        const slider = document.getElementById('tm-slider');
        slider.value = 0;
        let val = 0;
        const btn = document.getElementById('tm-play');
        btn.disabled = true;
        
        const interval = setInterval(() => {
            val += 1;
            slider.value = val;
            drawFrame();
            if (val >= 100) { clearInterval(interval); btn.disabled = false; }
        }, 50); 
    }

    function drawFrame() {
        if(!projects.current || !ctx || !canvas) return;
        const sliderVal = document.getElementById('tm-slider').value;
        const p = projects.current;
        const totalDur = p.scd_end_date.getTime() - p.start.getTime();
        if(totalDur <= 0) return;

        const currentMs = p.start.getTime() + (totalDur * (sliderVal / 100));
        const currentDate = new Date(currentMs);
        document.getElementById('tm-date').innerText = currentDate.toLocaleDateString('en-GB');

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const rowH = 25; const textW = 250; const barArea = canvas.width - textW - 20; const pxPerMs = barArea / totalDur;

        tasks.forEach((t, i) => {
            const y = i * rowH + 5;
            ctx.fillStyle = "#334155";
            ctx.font = "11px Arial";
            ctx.fillText((t.task_name || "Unnamed").substring(0, 35), 5, y + 12);

            const startX = textW + (t.start.getTime() - p.start.getTime()) * pxPerMs;
            const width = (t.finish.getTime() - t.start.getTime()) * pxPerMs;
            let color = "#e2e8f0"; 
            if (t.finish.getTime() <= currentDate.getTime()) color = "#3b82f6"; 
            else if (t.start.getTime() <= currentDate.getTime()) color = "#22c55e"; 

            ctx.fillStyle = color;
            ctx.fillRect(startX, y, Math.max(width, 2), 15);
        });
        
        const lineX = textW + (currentDate.getTime() - p.start.getTime()) * pxPerMs;
        ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(lineX, 0); ctx.lineTo(lineX, canvas.height); ctx.stroke();
    }
    document.addEventListener('DOMContentLoaded', init);
    return { init };
})();