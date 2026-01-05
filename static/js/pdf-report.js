// ============================================
// pdf-report.js — Primavera Style Lookahead PDF
// ============================================
const PDFReport = (function() {
    
    function init() {
        // 1. Add Button to Sidebar
        const menuList = document.querySelector('#menu ul');
        if (menuList && !document.getElementById('pdf-btn')) {
            const li = document.createElement('li');
            li.innerHTML = `<div id="pdf-btn" class="btn" style="background:#dc2626; color:white;">🖨️ PDF Lookahead Report</div>`;
            const emailBtn = document.getElementById('email-btn');
            if(emailBtn) emailBtn.parentNode.parentNode.insertBefore(li, emailBtn.parentNode.nextSibling);
            else menuList.appendChild(li);

            document.getElementById('pdf-btn').addEventListener('click', generatePDF);
        }
    }

    function generatePDF() {
        if (!projects.current) {
            alert("Please analyze a project first.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape'); // Landscape like P6
        const p = projects.current;
        const dd = p.last_recalc_date;

        // --- 1. Filter Data (3 Week Lookahead) ---
        const lookAheadDate = new Date(dd);
        lookAheadDate.setDate(lookAheadDate.getDate() + 21); // 21 Days

        let tasks = [...p.tasks.values()].filter(t => {
            if (t.completed) return false; 
            // Include if In Progress OR Starts within range
            return t.inProgress || (t.start && t.start >= dd && t.start <= lookAheadDate);
        });

        // Sort by Start Date then Total Float
        tasks.sort((a,b) => (a.start - b.start) || (a.totalFloat - b.totalFloat));

        // Format Data for Table
        const fmt = d => d ? d.toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'2-digit'}) : "";
        
        const tableBody = tasks.map(t => [
            t.task_code,
            t.task_name,
            t.status,
            t.remDur,
            fmt(t.start),
            fmt(t.finish),
            t.totalFloat,
            (t.resources && t.resources.length) ? t.resources.map(r=>r.rsrc_id).join(", ").substring(0,30) : "" 
        ]);

        // --- 2. Draw Primavera Header Function ---
        const drawHeader = (data) => {
            // Box dimensions
            const pageWidth = doc.internal.pageSize.width;
            doc.setDrawColor(0);
            doc.setLineWidth(0.1);
            
            // Top Header Box
            doc.rect(14, 10, pageWidth - 28, 24); 
            
            // Vertical Dividers
            doc.line(pageWidth / 2 - 40, 10, pageWidth / 2 - 40, 34); // Left Split
            doc.line(pageWidth / 2 + 40, 10, pageWidth / 2 + 40, 34); // Right Split

            // Left: Project Info
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(p.proj_short_name || "PROJ-ID", 18, 18);
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.text(p.name || "Project Name", 18, 24);

            // Center: Report Title
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text("3-WEEK LOOKAHEAD REPORT", pageWidth / 2, 20, { align: "center" });
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.text(`Filter: Active & Starts [${fmt(dd)} - ${fmt(lookAheadDate)}]`, pageWidth / 2, 28, { align: "center" });

            // Right: Meta Data
            doc.setFontSize(8);
            doc.text(`Data Date:`, pageWidth / 2 + 45, 16);
            doc.text(fmt(dd), pageWidth - 20, 16, { align: "right" });

            doc.text(`Print Date:`, pageWidth / 2 + 45, 21);
            doc.text(new Date().toLocaleDateString('en-GB'), pageWidth - 20, 21, { align: "right" });

            doc.text(`Page:`, pageWidth / 2 + 45, 26);
            doc.text(`${data.pageCount}`, pageWidth - 20, 26, { align: "right" });
            
            doc.text(`Checked By: ________________`, pageWidth / 2 + 45, 31);
        };

        // --- 3. Generate Table ---
        doc.autoTable({
            head: [['Activity ID', 'Activity Name', 'Status', 'Rem Dur', 'Start', 'Finish', 'Total Float', 'Resources']],
            body: tableBody,
            startY: 38,
            theme: 'plain', // Minimalist P6 look
            styles: { 
                fontSize: 8, 
                cellPadding: 2, 
                lineColor: [200, 200, 200], 
                lineWidth: 0.1 
            },
            headStyles: { 
                fillColor: [240, 240, 240], // Light Grey Header
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                halign: 'center'
            },
            columnStyles: {
                0: { cellWidth: 25 }, // ID
                1: { cellWidth: 'auto' }, // Name
                2: { cellWidth: 20, halign: 'center' }, // Status
                3: { cellWidth: 15, halign: 'center' }, // RD
                4: { cellWidth: 22, halign: 'center' }, // Start
                5: { cellWidth: 22, halign: 'center' }, // Finish
                6: { cellWidth: 15, halign: 'center', fontStyle: 'bold' }, // TF
                7: { cellWidth: 40 } // Resources
            },
            didParseCell: function(data) {
                // Conditional Formatting mimics P6
                if (data.section === 'body' && data.column.index === 6) { // Float Column
                    const val = parseInt(data.cell.raw);
                    if (val <= 0) data.cell.styles.textColor = [255, 0, 0]; // Red text for critical
                }
            },
            didDrawPage: drawHeader, // Hook to draw header on every page
            margin: { top: 38 }
        });

        // Save
        const filename = `LookAhead_${p.proj_short_name}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);
    }

    document.addEventListener('DOMContentLoaded', init);
    return { init, generatePDF };
})();