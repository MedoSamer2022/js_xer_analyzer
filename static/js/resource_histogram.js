// ===============================================
// resource_histogram.js — Fixed Variable Name
// ===============================================

const ResourceHistogram = (function() {
    let chartInstance = null;
    let resourceMap = new Map(); 
    let lastChartData = null; 

    function init() {
        // 1. Sidebar Button
        const menuList = document.querySelector('#menu ul');
        if (menuList && !document.getElementById('res-hist-btn')) {
            const li = document.createElement('li');
            li.innerHTML = `<div id="res-hist-btn" onclick="menuClickHandle(event, 'res-hist-view')" class="btn">📊 Resource Histogram</div>`;
            const wbsBtn = document.getElementById('wbs-mgr-btn'); 
            if (wbsBtn && wbsBtn.parentNode.nextSibling) menuList.insertBefore(li, wbsBtn.parentNode.nextSibling);
            else menuList.appendChild(li);
        }

        // 2. Build Interface
        const content = document.getElementById('content');
        if (content && !document.getElementById('res-hist-view')) {
            const section = document.createElement('section');
            section.id = 'res-hist-view';
            section.className = 'cat hidden width-100'; 
            section.innerHTML = `
                <div class="card border-rad-8px box-shadow width-100">
                    <header style="display:flex; justify-content:space-between; align-items:center; padding-bottom:15px; border-bottom:1px solid #eee;">
                        <h3>📊 Resource Allocation Histogram</h3>
                        
                        <div style="display:flex; gap:10px; align-items:center;">
                            <select id="res-selector" style="padding:6px; border-radius:4px; border:1px solid #ccc; max-width:250px;">
                                <option value="">Select a Resource...</option>
                            </select>

                            <select id="res-interval" style="padding:6px; border-radius:4px; border:1px solid #ccc;">
                                <option value="month">Monthly</option>
                                <option value="week">Weekly</option>
                            </select>

                            <button id="res-calc-btn" class="btn-xs" style="background:#3b82f6; color:white;">🔄 Chart</button>
                            
                            <button id="res-ppt-btn" class="btn-xs" style="background:#e11d48; color:white;">📊 Export PPT (Graph)</button>
                            <button id="res-excel-btn" class="btn-xs" style="background:#10b981; color:white;">📗 Excel (Data)</button>
                        </div>
                    </header>
                    
                    <div class="pad-10px">
                        <div style="height:60vh; width:100%; position:relative;">
                            <canvas id="resourceChart"></canvas>
                        </div>
                        <div id="res-stats" style="margin-top:15px; display:flex; gap:20px; justify-content:center; font-size:0.9em; color:#64748b;"></div>
                    </div>
                </div>
            `;
            content.appendChild(section);

            document.getElementById('res-calc-btn').addEventListener('click', generateChart);
            document.getElementById('res-selector').addEventListener('change', generateChart);
            document.getElementById('res-interval').addEventListener('change', generateChart);
            
            document.getElementById('res-excel-btn').addEventListener('click', exportExcel);
            document.getElementById('res-ppt-btn').addEventListener('click', exportPPT); 

            const analyzeBtn = document.getElementById('analyze-btn');
            if(analyzeBtn) analyzeBtn.addEventListener('click', () => setTimeout(populateResources, 2500));
        }
    }

    // =========================================================
    // 1. DATA PROCESSING
    // =========================================================
    function populateResources() {
        if (!projects.current || !projects.current.tasks) return;

        resourceMap.clear();
        const tasks = [...projects.current.tasks.values()];

        tasks.forEach(t => {
            if (t.resources && t.resources.length > 0) {
                t.resources.forEach(r => {
                    const rName = r.rsrc_name || r.resource_code || "Unknown";
                    const units = r.target_qty || r.rem_qty || 0; 
                    
                    if (units > 0 && t.start && t.finish) {
                        if (!resourceMap.has(rName)) resourceMap.set(rName, { name: rName, data: [] });
                        resourceMap.get(rName).data.push({
                            start: new Date(t.start),
                            finish: new Date(t.finish),
                            units: units,
                            duration: (t.finish - t.start) / (1000 * 60 * 60 * 24)
                        });
                    }
                });
            }
        });

        const select = document.getElementById('res-selector');
        select.innerHTML = '<option value="">Select a Resource...</option>';
        const sortedKeys = Array.from(resourceMap.keys()).sort();
        
        const allOpt = document.createElement('option');
        allOpt.value = "ALL";
        allOpt.text = "ALL RESOURCES (Aggregated)";
        select.appendChild(allOpt);

        sortedKeys.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.innerText = name;
            select.appendChild(opt);
        });
    }

    // =========================================================
    // 2. CHART GENERATION
    // =========================================================
    function generateChart() {
        const rName = document.getElementById('res-selector').value;
        const interval = document.getElementById('res-interval').value;
        const ctx = document.getElementById('resourceChart').getContext('2d');

        if (!rName) return;

        // Filter Data
        let allocationList = [];
        if (rName === "ALL") {
            resourceMap.forEach(res => allocationList.push(...res.data));
        } else {
            const res = resourceMap.get(rName);
            if(res) allocationList = res.data;
        }

        if (allocationList.length === 0) {
            alert("No allocation data found for this resource.");
            return;
        }

        // Create Time Buckets
        const timeMap = new Map();
        let minDate = new Date(8640000000000000);
        let maxDate = new Date(-8640000000000000);

        allocationList.forEach(alloc => {
            if (alloc.start < minDate) minDate = alloc.start;
            if (alloc.finish > maxDate) maxDate = alloc.finish;

            const dailyRate = alloc.units / (alloc.duration || 1); 
            
            let curr = new Date(alloc.start);
            while (curr <= alloc.finish) {
                const key = getDateKey(curr, interval);
                timeMap.set(key, (timeMap.get(key) || 0) + dailyRate);
                curr.setDate(curr.getDate() + 1);
            }
        });

        const labels = Array.from(timeMap.keys()).sort();
        // FIXED: Renamed variable to 'values' to match export logic
        const values = labels.map(k => Math.round(timeMap.get(k)));
        const cumValues = calculateCumulative(values);

        // Save for Export
        lastChartData = {
            resource: rName,
            interval: interval,
            labels: labels,
            values: values,      // This was the error cause previously
            cumValues: cumValues // This matches the export function now
        };

        // Draw Chart
        if (chartInstance) chartInstance.destroy();

        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: `${rName === "ALL" ? "Total Resource" : rName} Units`,
                    data: values,
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1,
                    order: 2
                }, {
                    label: 'Cumulative',
                    data: cumValues,
                    type: 'line',
                    borderColor: '#ef4444',
                    borderWidth: 2,
                    pointRadius: 2,
                    yAxisID: 'y1',
                    order: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Units / Manhours' } },
                    y1: { position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Cumulative' } }
                }
            }
        });

        // Stats Footer
        const total = values.reduce((a,b)=>a+b, 0);
        const peak = Math.max(...values);
        document.getElementById('res-stats').innerHTML = `
            <span><b>Total:</b> ${total.toLocaleString()}</span>
            <span><b>Peak:</b> ${peak.toLocaleString()}</span>
            <span><b>Range:</b> ${formatDate(minDate)} to ${formatDate(maxDate)}</span>
        `;
    }

    // =========================================================
    // 3. EXPORT TO PPT (Graph + Table)
    // =========================================================
    function exportPPT() {
        if (!lastChartData) return alert("Generate chart first.");
        
        // 1. Capture Canvas as Image
        const canvas = document.getElementById('resourceChart');
        const imgData = canvas.toDataURL('image/png');

        // 2. Init PPT
        let pptx = new PptxGenJS();
        let slide = pptx.addSlide();

        // 3. Add Content
        slide.addText(`Resource Histogram: ${lastChartData.resource}`, { x:0.5, y:0.5, fontSize:18, bold:true, color:'363636' });
        slide.addImage({ data: imgData, x:0.5, y:1.0, w:9.0, h:4.5 });

        // 4. Add Summary Table below chart
        const rows = [['Period', 'Units', 'Cumulative']];
        // Add only first 10 rows to fit slide, or logic could be added for multiple slides
        for(let i=0; i < Math.min(10, lastChartData.labels.length); i++) {
            rows.push([lastChartData.labels[i], lastChartData.values[i], lastChartData.cumValues[i]]);
        }
        
        slide.addTable(rows, { x:0.5, y:5.8, w:9.0, fontSize:10, border:{color:'CCCCCC'} });

        pptx.writeFile({ fileName: `Resource_Graph_${lastChartData.resource}.pptx` });
    }

    // =========================================================
    // 4. EXPORT TO EXCEL (Data Only)
    // =========================================================
    function exportExcel() {
        if (!lastChartData) return alert("Generate chart first.");
        if (typeof XLSX === 'undefined') return alert("Excel Library missing.");
        
        const rows = [['Period', 'Units', 'Cumulative']];
        
        for(let i=0; i<lastChartData.labels.length; i++) {
            rows.push([lastChartData.labels[i], lastChartData.values[i], lastChartData.cumValues[i]]);
        }
        
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Resource Data");
        XLSX.writeFile(wb, `Resource_Data_${lastChartData.resource}.xlsx`);
    }

    // --- Helpers ---
    function getDateKey(date, interval) {
        const y = date.getFullYear();
        if (interval === 'month') {
            const m = String(date.getMonth() + 1).padStart(2, '0');
            return `${y}-${m}`;
        } else {
            const firstJan = new Date(date.getFullYear(), 0, 1);
            const week = Math.ceil((((date - firstJan) / 86400000) + firstJan.getDay() + 1) / 7);
            return `${y}-W${String(week).padStart(2, '0')}`;
        }
    }

    function calculateCumulative(arr) {
        let sum = 0;
        return arr.map(v => sum += v);
    }

    function formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    document.addEventListener('DOMContentLoaded', init);
    return { init };
})();