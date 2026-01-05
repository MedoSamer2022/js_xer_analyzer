// ===============================================
// dashboard_ppt.js - Final Sizing & Layout (v2)
// ===============================================

function generateDashboardPPT(project) {
    if (!project) {
        alert("No project data available to generate report.");
        return;
    }

    // 1. Init PptxGenJS
    let pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9"; // Standard 10 x 5.625 inches
    pptx.author = "XER Analyzer";
    pptx.company = "Project Dashboard";
    pptx.subject = project.name;
    pptx.title = "Project Status Report";

    // --- STYLE CONSTANTS ---
    const COLORS = {
        DARK_HEADER: "102532", // Dark Slate Blue
        TEAL_ACCENT: "1ABC9C", // Bright Teal
        RED_ACCENT:  "E74C3C",
        TEXT_GREY:   "4A4A4A",
        WHITE:       "FFFFFF",
        BG_GREY:     "F1F1F1",
        CHART_BLUE:  "36A2EB",
        CHART_GREEN: "71C25C",
        CHART_RED:   "FF6384"
    };

    // --- DATA PREPARATION ---
    const getSortedMonthKeys = () => {
        if (!project.months) return [];
        return Object.keys(project.months).filter(k => /^[A-Z][a-z]{2}-\d{4}$/.test(k)).sort((a,b)=>{
            const [ma, ya] = a.split('-'); const [mb, yb] = b.split('-');
            return new Date(`${ma} 1, ${ya}`) - new Date(`${mb} 1, ${yb}`);
        });
    };

    const monthKeys = getSortedMonthKeys();
    let cumPlanned = 0, cumEarned = 0;
    const chartLabels = [];
    const chartDataPV = [];
    const chartDataEV = [];

    monthKeys.forEach(key => {
        const m = project.months[key];
        const monthlyPV = (m.earlyActivity / 100) * project.budgetCost; 
        const monthlyEV = (m.actualActivity / 100) * project.budgetCost;
        cumPlanned += monthlyPV;
        cumEarned += monthlyEV;
        chartLabels.push(key);
        chartDataPV.push(Math.round(cumPlanned));
        chartDataEV.push(Math.round(cumEarned));
    });

    // --- DRAWING HELPERS ---
    
    // Standard Metric Card
    function addMetricCard(slide, title, value, x, y, w, h) {
        // Border Box
        slide.addShape(pptx.shapes.RECTANGLE, { x:x, y:y, w:w, h:h, fill:{color:COLORS.WHITE}, line:{color:COLORS.TEAL_ACCENT, width:1.5} });
        // Header Bar
        slide.addShape(pptx.shapes.RECTANGLE, { x:x, y:y, w:w, h:0.35, fill:{color:COLORS.DARK_HEADER} });
        slide.addText(title, { x:x+0.1, y:y, w:w-0.1, h:0.35, color:COLORS.WHITE, fontSize:9, bold:true, align:"left", valign:"middle" });
        // Value
        slide.addText(String(value), { x:x, y:y+0.4, w:w, h:h-0.45, fontSize:18, bold:true, color:COLORS.TEXT_GREY, align:"center", valign:"middle" });
    }

    // Split Duration Card (Special case for "Total Duration" box)
    function addDurationCard(slide, total, remaining, x, y, w, h) {
        // Outer Border
        slide.addShape(pptx.shapes.RECTANGLE, { x:x, y:y, w:w, h:h, fill:{color:COLORS.WHITE}, line:{color:COLORS.TEAL_ACCENT, width:1.5} });
        
        // Top Half (Total)
        slide.addShape(pptx.shapes.RECTANGLE, { x:x+0.1, y:y+0.1, w:w-0.2, h:0.25, fill:{color:COLORS.DARK_HEADER} });
        slide.addText("TOTAL DURATION", { x:x, y:y+0.1, w:w, h:0.25, color:COLORS.WHITE, fontSize:7, bold:true, align:"center", valign:"middle" });
        slide.addText(total + " d", { x:x, y:y+0.35, w:w, h:0.4, fontSize:12, bold:true, align:"center", valign:"middle" });

        // Divider
        slide.addShape(pptx.shapes.LINE, { x:x+0.1, y:y+0.8, w:w-0.2, h:0, line:{color:"CCCCCC", width:1} });

        // Bottom Half (Remaining)
        slide.addShape(pptx.shapes.RECTANGLE, { x:x+0.1, y:y+0.9, w:w-0.2, h:0.25, fill:{color:COLORS.DARK_HEADER} });
        slide.addText("REMAINING DAYS", { x:x, y:y+0.9, w:w, h:0.25, color:COLORS.WHITE, fontSize:7, bold:true, align:"center", valign:"middle" });
        slide.addText(remaining + " d", { x:x, y:y+1.15, w:w, h:0.4, fontSize:12, bold:true, align:"center", valign:"middle" });
    }

    // Main Slide Header
    function addSlideHeader(slide, title) {
        slide.addShape(pptx.shapes.RECTANGLE, { x:0, y:0, w:"100%", h:0.6, fill:{color:COLORS.TEAL_ACCENT} });
        slide.addText(title, { x:0.2, y:0, w:5.0, h:0.6, fontSize:18, color:COLORS.WHITE, bold:true, valign:"middle" });
        // Project Info Right
        const dateStr = project.last_recalc_date ? formatDate(project.last_recalc_date) : "-";
        slide.addText(`${project.proj_short_name} | Data Date: ${dateStr}`, { x:5.0, y:0, w:4.8, h:0.6, fontSize:10, color:COLORS.WHITE, align:"right", valign:"middle" });
    }

    // ===============================================
    // SLIDE 1: EXECUTIVE OVERVIEW
    // ===============================================
    let slide1 = pptx.addSlide();
    addSlideHeader(slide1, "Executive Overview");

    // 1. DATE TABLE (Left Sidebar) - Fixed Coordinates
    const startStr = project.start ? formatDate(project.start) : "-";
    const finishStr = project.scd_end_date ? formatDate(project.scd_end_date) : "-";
    const dateStr = project.last_recalc_date ? formatDate(project.last_recalc_date) : "-";

    const dateTblOpts = { fill: COLORS.DARK_HEADER, color:COLORS.WHITE, fontSize:8, bold:true, align:'center', valign:'middle' };
    const dateValOpts = { color: COLORS.TEXT_GREY, fontSize:10, align:'center', valign:'middle' };
    const dateTblAcc = { fill: COLORS.TEAL_ACCENT, color:COLORS.WHITE, fontSize:8, bold:true, align:'center', valign:'middle' };
    const dateTblRed = { fill: COLORS.RED_ACCENT, color:COLORS.WHITE, fontSize:8, bold:true, align:'center', valign:'middle' };

    slide1.addTable([
        [{ text: "PROJECT START", options: dateTblOpts }],
        [{ text: startStr, options: dateValOpts }],
        [{ text: "DATA DATE", options: dateTblAcc }],
        [{ text: dateStr, options: dateValOpts }],
        [{ text: "BL FINISH DATE", options: dateTblOpts }],
        [{ text: "-", options: dateValOpts }], // Placeholder if no BL
        [{ text: "FORECAST FINISH DATE", options: dateTblRed }],
        [{ text: finishStr, options: dateValOpts }]
    ], { x:0.2, y:0.8, w:1.8, h:2.1, border:{pt:1, color:COLORS.TEAL_ACCENT}, rowH:0.25 });

    // 2. TOP CARDS ROW (Aligning right of the date table)
    // Width available: 10 - 2.2 = 7.8.  5 Cards -> ~1.5 width each.
    
    // Float
    const floatVal = project.critical.length > 0 ? project.critical[0].totalFloat : 0;
    addMetricCard(slide1, "Total Float", String(floatVal), 2.2, 0.8, 1.8, 1.8); // [cite: 106, 107]
    
    // Variance
    let finVar = 0;
    if (project.plan_end_date && project.scd_end_date) {
        finVar = Math.round((project.scd_end_date - project.plan_end_date) / (1000*60*60*24));
    }
    addMetricCard(slide1, "Finish Variance", String(finVar), 4.1, 0.8, 1.8, 1.8); // [cite: 108, 109]

    // Duration Stack
    const dur = project.scheduleDuration ? Math.round(project.scheduleDuration) : 0;
    const remDur = project.remScheduleDuration ? Math.round(project.remScheduleDuration) : 0;
    addDurationCard(slide1, dur, remDur, 6.0, 0.8, 1.8, 1.8); // [cite: 110-113]

    // Timeline & SPI
    const schedPer = Math.round(project.schedPercentComp * 100) + "%";
    const spi = project.spi ? project.spi.toFixed(2) : "0.00";
    addMetricCard(slide1, "Timeline", schedPer, 7.9, 0.8, 1.8, 1.8); // [cite: 114, 115]
    addMetricCard(slide1, "Cum. SPI", spi, 9.8, 0.8, 1.8, 1.8); // [cite: 116, 117] (Adjusted to fit page width)

    // 3. MIDDLE ROW (Charts)
    const midY = 2.8;
    const midH = 2.4;
    
    // Left Chart Box
    slide1.addShape(pptx.shapes.RECTANGLE, { x:0.2, y:midY, w:3.7, h:midH, fill:COLORS.WHITE, line:{color:COLORS.DARK_HEADER, width:1} });
    slide1.addShape(pptx.shapes.RECTANGLE, { x:0.2, y:midY, w:3.7, h:0.3, fill:COLORS.DARK_HEADER });
    slide1.addText("Cumulative PV Vs EV", { x:0.3, y:midY, w:3.5, h:0.3, color:COLORS.WHITE, fontSize:9, bold:true, valign:"middle" }); // [cite: 118]
    if(chartLabels.length > 0) {
        slide1.addChart(pptx.charts.AREA, [{ name:"PV", labels:chartLabels, values:chartDataPV }, { name:"EV", labels:chartLabels, values:chartDataEV }],
        { x:0.3, y:midY+0.4, w:3.5, h:midH-0.5, showLegend:true, legendPos:'b', showTitle:false });
    }

    // Center BAC Card
    const bacVal = formatCost(project.budgetCost); // [cite: 119, 120]
    addMetricCard(slide1, "Budgeted Total Cost (BAC)", bacVal, 4.1, midY, 3.7, midH);

    // Right Chart Box
    slide1.addShape(pptx.shapes.RECTANGLE, { x:8.0, y:midY, w:3.7, h:midH, fill:COLORS.WHITE, line:{color:COLORS.DARK_HEADER, width:1} });
    slide1.addShape(pptx.shapes.RECTANGLE, { x:8.0, y:midY, w:3.7, h:0.3, fill:COLORS.DARK_HEADER });
    slide1.addText("Cum. PV% Vs EV%", { x:8.1, y:midY, w:3.5, h:0.3, color:COLORS.WHITE, fontSize:9, bold:true, valign:"middle" }); // [cite: 121]

    // 4. BOTTOM ROW
    const botY = 5.4;
    slide1.addShape(pptx.shapes.RECTANGLE, { x:0.2, y:botY, w:11.5, h:2.0, fill:COLORS.WHITE }); // Background strip
    slide1.addShape(pptx.shapes.RECTANGLE, { x:0.2, y:botY, w:11.5, h:0.3, fill:"5D6D7E" }); // Grey Header
    slide1.addText("Progress Curve (Cost)", { x:0.3, y:botY, w:5.0, h:0.3, color:COLORS.WHITE, fontSize:9, bold:true, valign:"middle" }); // [cite: 122]
    // (Optional: Add S-Curve Line chart here if desired, using same data as PV vs EV)


    // ===============================================
    // SLIDE 2: WEEKLY STATUS (Grid Layout)
    // ===============================================
    let slide2 = pptx.addSlide();
    addSlideHeader(slide2, "Weekly Status");

    const wCardW = 2.4;
    const wCardH = 1.3;
    const rightColX = 4.4; // Starting X for the metrics column
    
    // --- RIGHT SIDE: METRIC CARDS (2 Rows of 3) ---
    // Row 1
    const wPV = project.thisPeriodQty * 100 || 0; // Using Qty as proxy if Cost is 0
    const wEV = project.thisPeriodCost || 0;
    const wSPI = wPV > 0 ? (wEV/wPV).toFixed(2) : "0.00";
    const actCnt = project.inProgress ? project.inProgress.length : 0;
    const latStart = 0; // Placeholder

    addMetricCard(slide2, "Period Planned", formatCost(wPV), rightColX, 0.8, wCardW, wCardH); // [cite: 125, 126]
    addMetricCard(slide2, "Interval SPI", wSPI, rightColX + 2.5, 0.8, wCardW, wCardH); // [cite: 127, 128]
    addMetricCard(slide2, "Active Count", String(actCnt), rightColX + 5.0, 0.8, wCardW, wCardH); // [cite: 129, 130]

    // Row 2
    addMetricCard(slide2, "Period EV", formatCost(wEV), rightColX, 2.2, wCardW, wCardH); // [cite: 131, 132]
    addMetricCard(slide2, "Variance", formatCost(wEV - wPV), rightColX + 2.5, 2.2, wCardW, wCardH); // [cite: 133, 134]
    addMetricCard(slide2, "Late Start", String(latStart), rightColX + 5.0, 2.2, wCardW, wCardH); // [cite: 135, 136]

    // --- LEFT SIDE: CHARTS ---
    // 1. Interval Chart (Top Left)
    slide2.addShape(pptx.shapes.RECTANGLE, { x:0.2, y:0.8, w:4.0, h:2.7, fill:COLORS.WHITE, line:{color:COLORS.DARK_HEADER, width:1} });
    slide2.addShape(pptx.shapes.RECTANGLE, { x:0.2, y:0.8, w:4.0, h:0.3, fill:COLORS.DARK_HEADER });
    slide2.addText("Interval PV Vs EV", { x:0.3, y:0.8, w:3.5, h:0.3, color:COLORS.WHITE, fontSize:9, bold:true, valign:"middle" }); // [cite: 137]

    // 2. Breakdown Chart (Bottom Left)
    slide2.addShape(pptx.shapes.RECTANGLE, { x:0.2, y:3.7, w:4.0, h:3.6, fill:COLORS.WHITE, line:{color:COLORS.TEAL_ACCENT, width:1} }); // Teal border [cite: 5]
    slide2.addShape(pptx.shapes.RECTANGLE, { x:0.2, y:3.7, w:4.0, h:0.3, fill:COLORS.DARK_HEADER });
    slide2.addText("Breakdown By:", { x:0.3, y:3.7, w:3.5, h:0.3, color:COLORS.WHITE, fontSize:9, bold:true, valign:"middle" }); // [cite: 138]

    // --- BOTTOM RIGHT: TABLE ---
    // Header
    slide2.addShape(pptx.shapes.RECTANGLE, { x:rightColX, y:3.7, w:7.4, h:0.3, fill:COLORS.DARK_HEADER });
    slide2.addText("Details", { x:rightColX+0.1, y:3.7, w:2.0, h:0.3, color:COLORS.WHITE, fontSize:9, bold:true, valign:"middle" });

    // Table Data
    let tableData = [[
        {text:"ID", options:{fill:COLORS.DARK_HEADER, color:COLORS.WHITE, bold:true, fontSize:8}}, // [cite: 139]
        {text:"Activity Name", options:{fill:COLORS.DARK_HEADER, color:COLORS.WHITE, bold:true, fontSize:8}}, // [cite: 140]
        {text:"Rem Dur", options:{fill:COLORS.DARK_HEADER, color:COLORS.WHITE, bold:true, fontSize:8}}, // [cite: 141]
        {text:"Total Float", options:{fill:COLORS.DARK_HEADER, color:COLORS.WHITE, bold:true, fontSize:8}} // [cite: 142]
    ]];

    // Populate with actual data (Top 10 active tasks)
    let tasks = project.inProgress ? project.inProgress.slice(0, 10) : [];
    tasks.forEach(t => {
        tableData.push([ t.task_code, t.task_name.substring(0,30), String(t.remDur), String(t.totalFloat) ]);
    });

    slide2.addTable(tableData, { x:rightColX, y:4.0, w:7.4, rowH:0.25, fontSize:8, border:{color:"CCCCCC"} });


    // ===============================================
    // SLIDE 3: TREND ANALYSIS
    // ===============================================
    let slide3 = pptx.addSlide();
    addSlideHeader(slide3, "Trend Analysis"); // [cite: 183]

    // SPI Trend [cite: 185]
    slide3.addShape(pptx.shapes.RECTANGLE, { x:0.2, y:0.8, w:11.5, h:3.0, fill:COLORS.WHITE, line:{color:COLORS.TEAL_ACCENT, width:1} });
    slide3.addShape(pptx.shapes.RECTANGLE, { x:0.2, y:0.8, w:11.5, h:0.3, fill:COLORS.TEAL_ACCENT });
    slide3.addText("SPI Trend", { x:0.3, y:0.8, w:5.0, h:0.3, color:COLORS.WHITE, fontSize:9, bold:true, valign:"middle" });

    // Sched % Trend [cite: 186]
    slide3.addShape(pptx.shapes.RECTANGLE, { x:0.2, y:4.0, w:11.5, h:3.0, fill:COLORS.WHITE, line:{color:COLORS.TEAL_ACCENT, width:1} });
    slide3.addShape(pptx.shapes.RECTANGLE, { x:0.2, y:4.0, w:11.5, h:0.3, fill:COLORS.TEAL_ACCENT });
    slide3.addText("Schedule % Complete Trend", { x:0.3, y:4.0, w:5.0, h:0.3, color:COLORS.WHITE, fontSize:9, bold:true, valign:"middle" });


    // ===============================================
    // SLIDE 4: LOOK AHEAD (Clean Layout)
    // ===============================================
    let slide4 = pptx.addSlide();
    addSlideHeader(slide4, "Look Ahead Schedule"); // [cite: 187]

    // 4 Top Cards
    addMetricCard(slide4, "Look Ahead PV (30d)", "$0", 0.2, 0.8, 2.7, 1.5); // [cite: 189, 190]
    addMetricCard(slide4, "Activities Starting", "0", 3.1, 0.8, 2.7, 1.5); // [cite: 191, 192]
    addMetricCard(slide4, "Critical Starts", "0", 6.0, 0.8, 2.7, 1.5); // [cite: 193, 194]
    addMetricCard(slide4, "Next Milestone", "None", 8.9, 0.8, 2.7, 1.5); // [cite: 195, 196]

    // Large Bottom Table [cite: 197]
    slide4.addShape(pptx.shapes.RECTANGLE, { x:0.2, y:2.8, w:11.5, h:0.3, fill:COLORS.DARK_HEADER });
    slide4.addText("Look Ahead List (Next 30 Days)", { x:0.3, y:2.8, w:5.0, h:0.3, color:COLORS.WHITE, fontSize:9, bold:true, valign:"middle" });

    // Look Ahead Data Logic
    const laDataDate = project.last_recalc_date;
    const laEndDate = new Date(laDataDate); laEndDate.setDate(laEndDate.getDate() + 30);
    const laTasks = [...project.tasks.values()].filter(t => !t.completed && t.start >= laDataDate && t.start <= laEndDate).slice(0,15);

    let laTable = [[
        {text:"ID", options:{fill:COLORS.DARK_HEADER, color:COLORS.WHITE, bold:true}}, // [cite: 198]
        {text:"Activity Name", options:{fill:COLORS.DARK_HEADER, color:COLORS.WHITE, bold:true}}, // [cite: 199]
        {text:"Start Date", options:{fill:COLORS.DARK_HEADER, color:COLORS.WHITE, bold:true}}, // [cite: 200]
        {text:"Finish Date", options:{fill:COLORS.DARK_HEADER, color:COLORS.WHITE, bold:true}}, // [cite: 201]
        {text:"TF", options:{fill:COLORS.DARK_HEADER, color:COLORS.WHITE, bold:true}} // [cite: 202]
    ]];

    laTasks.forEach(t => {
        laTable.push([ t.task_code, t.task_name, formatDate(t.start), formatDate(t.finish), String(t.totalFloat) ]);
    });
    
    // Draw the table
    if (laTasks.length > 0) {
        slide4.addTable(laTable, { x:0.2, y:3.1, w:11.5, rowH:0.3, fontSize:8, border:{color:"CCCCCC"} });
    } else {
        slide4.addText("No activities starting in the next 30 days.", { x:0.2, y:3.5, w:11.5, align:"center", color:COLORS.TEXT_GREY });
    }

    // Save
    pptx.writeFile({ fileName: `Dashboard_${project.proj_short_name}.pptx` });
}

function formatCost(val) {
    if (!val) return "$0";
    return "$" + Math.round(val).toLocaleString();
}
function formatDate(date) {
    if (!date || !(date instanceof Date)) return "-";
    const d = date.getDate().toString().padStart(2,'0');
    const m = date.toLocaleString('default', { month: 'short' });
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
}