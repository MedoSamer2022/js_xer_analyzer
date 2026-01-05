// ============================================
// emailer.js — Automated 3-Week Lookahead Email
// ============================================
const Emailer = (function() {
    function init() {
        // 1. Add Sidebar Button
        const menuList = document.querySelector('#menu ul');
        if (menuList && !document.getElementById('email-btn')) {
            const li = document.createElement('li');
            li.innerHTML = `<div id="email-btn" onclick="menuClickHandle(event, 'email-view')" class="btn" style="background:#059669; color:white;">📧 Auto-Emailer</div>`;
            const riskBtn = document.getElementById('risk-btn');
            if(riskBtn) riskBtn.parentNode.parentNode.insertBefore(li, riskBtn.parentNode.nextSibling);
            else menuList.appendChild(li);
        }

        // 2. Add View Section
        const content = document.getElementById('content');
        if (content && !document.getElementById('email-view')) {
            const section = document.createElement('section');
            section.id = 'email-view';
            section.className = 'cat hidden max-width-960';
            section.innerHTML = `
                <div class="card border-rad-8px box-shadow width-100">
                    <header><h3>📧 Weekly Status Email Generator</h3></header>
                    <div class="pad-20px">
                        <label><b>Email Subject:</b></label>
                        <input type="text" id="email-subject" class="width-100" style="padding:8px; margin-bottom:15px; border:1px solid #ccc; border-radius:4px;">
                        
                        <label><b>Message Body (Preview):</b></label>
                        <textarea id="email-body" style="width:100%; height:300px; padding:10px; border:1px solid #ccc; border-radius:4px; font-family:monospace; line-height:1.4;"></textarea>
                        
                        <div style="margin-top:15px; display:flex; gap:10px;">
                            <button id="copy-email-btn" class="btn" style="background:#059669; color:white;">📋 Copy to Clipboard</button>
                            <a id="open-outlook-btn" href="#" class="btn" style="background:#2563eb; color:white; text-decoration:none;">🚀 Open in Outlook/Mail</a>
                        </div>
                    </div>
                </div>
            `;
            content.appendChild(section);

            // Bind Events
            document.getElementById('copy-email-btn').addEventListener('click', copyToClipboard);
        }
        
        // Auto-Generate when analyzing
        const analyzeBtn = document.getElementById('analyze-btn');
        if (analyzeBtn) analyzeBtn.addEventListener('click', () => setTimeout(generateDraft, 1800));
    }

    function generateDraft() {
        if (!projects.current) return;
        const p = projects.current;
        const dd = p.last_recalc_date;
        
        // Calculate Next 3 Weeks
        const lookAheadDate = new Date(dd);
        lookAheadDate.setDate(lookAheadDate.getDate() + 21);
        
        const fmt = d => d.toLocaleDateString('en-GB', {day:'2-digit',month:'short'});

        // Filter Tasks (Active or Starting in next 21 days)
        const tasks = [...p.tasks.values()].filter(t => {
            if (t.completed) return false;
            // Include if In Progress OR Start is within range
            return t.inProgress || (t.start >= dd && t.start <= lookAheadDate);
        }).sort((a,b) => a.start - b.start);

        // Separate Critical from Normal
        const crit = tasks.filter(t => t.totalFloat <= 0);
        const normal = tasks.filter(t => t.totalFloat > 0);

        // --- Build Email ---
        const subject = `3-Week Lookahead Report: ${p.proj_short_name} (${fmt(dd)} to ${fmt(lookAheadDate)})`;
        
        let body = `Dear Team,\n\nHere is the Look-Ahead schedule for the upcoming 3 weeks (${fmt(dd)} - ${fmt(lookAheadDate)}).\n\n`;
        
        body += `🔴 CRITICAL ACTIVITIES (Priority Attention Required):\n`;
        body += `---------------------------------------------------\n`;
        if(crit.length === 0) body += "No critical activities planned for this period.\n";
        crit.forEach(t => {
            body += `[${t.task_code}] ${t.task_name}\n   Start: ${fmt(t.start)} | Finish: ${fmt(t.finish)} | Resp: ${getResp(t)}\n\n`;
        });

        body += `\n🔵 UPCOMING ACTIVITIES (Plan Resources):\n`;
        body += `---------------------------------------------------\n`;
        if(normal.length === 0) body += "No other activities planned.\n";
        normal.slice(0, 15).forEach(t => { // Limit to top 15 to avoid spam
            body += `[${t.task_code}] ${t.task_name}\n   Start: ${fmt(t.start)} | Finish: ${fmt(t.finish)}\n\n`;
        });
        if(normal.length > 15) body += `...and ${normal.length - 15} more activities.\n`;

        body += `\nProject SPI: ${(p.spi||0).toFixed(2)}\n`;
        body += `Generated by Magdy's XER Analyzer.`;

        // Update UI
        document.getElementById('email-subject').value = subject;
        document.getElementById('email-body').value = body;
        
        // Update Mailto Link
        const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        document.getElementById('open-outlook-btn').href = mailto;
    }

    function getResp(t) {
        // Try to find a Responsibility Code or Primary Resource
        // This is a placeholder; usually relies on specific activity codes
        if(t.resources && t.resources.length > 0) return t.resources[0].rsrc_id;
        return "Site Team";
    }

    function copyToClipboard() {
        const body = document.getElementById('email-body');
        body.select();
        document.execCommand("copy"); // Fallback for older browsers
        
        // Modern API
        if (navigator.clipboard) {
            navigator.clipboard.writeText(body.value).then(() => alert("Email draft copied to clipboard!"));
        } else {
            alert("Email draft copied!");
        }
    }

    document.addEventListener('DOMContentLoaded', init);
    return { init, generateDraft };
})();