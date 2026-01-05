const budgetedCost = obj => obj?.resources?.reduce((a, r) => a + r.target_cost, 0.0) ?? 0.0;
const actualCost = obj => obj?.resources?.reduce((a, r) => a + r.act_reg_cost + r.act_ot_cost, 0.0) ?? 0.0;
const thisPeriodCost = obj => obj?.resources?.reduce((a, r) => a + r.act_this_per_cost, 0.0) ?? 0.0;
const remainingCost = obj => obj?.resources?.reduce((a, r) => a + r.remain_cost, 0.0) ?? 0.0;

const budgetedQty = obj => obj?.resources?.reduce((a, r) => a + r.target_qty, 0.0) ?? 0.0;
const actualQty = obj => obj?.resources?.reduce((a, r) => a + r.act_reg_qty + r.act_ot_qty, 0.0) ?? 0.0;
const thisPeriodQty = obj => obj?.resources?.reduce((a, r) => a + r.act_this_per_qty, 0.0) ?? 0.0;
const remainingQty = obj => obj?.resources?.reduce((a, r) => a + r.remain_qty, 0.0) ?? 0.0;

const formatDate = dt => {
    if (dt instanceof Date && !isNaN(dt)) {
        const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${dt.getDate()}-${M[dt.getMonth()]}-${dt.getFullYear()}`;
    }
    return '';
}

function excelDateToJSDate(date) {
    let tempDate = new Date((date - 25568)*86400*1000);
    return new Date(tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate(), 0, 0, 0);
}

const formatNumber = (num, min = 0, sign = 'never') => {
    const returnString = Intl.NumberFormat('en-US', {
        minimumFractionDigits: min,
        maximumFractionDigits: 2,
        signDisplay: 'never',
    }).format(num);
    return num < 0 ? `(${returnString})` : returnString;
}

const formatVariance = (num) => {
    if (isNaN(num)) {return "N/A"}
    let sign = num === 0 ? "auto" : "always";
    return Intl.NumberFormat('en-US', {
        maximumFractionDigits: 1,
        signDisplay: sign,
    }).format(num)
}

const formatCost = cost => formatNumber(cost, 2)

const formatPercent = (value, sign="auto") => {
    const returnString = Intl.NumberFormat('en-US', {
        style: 'percent',
        maximumFractionDigits: 1,
        signDisplay: sign,
    }).format(value)
    return returnString
}

const dateVariance = (date1, date2) => {
    if (!(date1 instanceof Date) || !(date2 instanceof Date) || isNaN(date1.getTime()) || isNaN(date2.getTime())) {
        return NaN
    }
    return (date1.getTime() - date2.getTime()) / (1000 * 3600 * 24)
}

function sortByStart(a, b){
    return (a.start.getTime() > b.start.getTime()) ? 1 : (a.start.getTime() === b.start.getTime()) ? ((a.finish.getTime() > b.finish.getTime()) ? 1 : -1) : -1
}

function sortByFinish(a, b){
    return (a.finish.getTime() > b.finish.getTime()) ? 1 : (a.finish.getTime() === b.finish.getTime()) ? ((a.start.getTime() > b.start.getTime()) ? 1 : -1) : -1
}

const sortById = (a, b) => (a.task_code > b.task_code) ? 1 : -1

const isWorkDay = (date, calendar) => {
    return calendar.week[date.getDay()].hours > 0
}

// --- Data Access Helpers (Moved from main.js) ---
const hasTask = (task, proj) => proj.tasksByCode.has(task.task_code)
const getTask = (task, proj) => proj.tasksByCode.get(task.task_code)
const getPrevLogic = rel => projects.previous.relsById.get(rel.logicId)
const prevHasLogic = rel => projects.previous.relsById.has(rel.logicId)

function getPrevRes(res){
  if(tables.previous.hasOwnProperty('RSRC') && res.hasOwnProperty('resId')){
    return projects.previous.resById.get(res.resId)
  }
  if(hasTask(res.task, projects.previous)){
    const prevResources = getTask(res.task, projects.previous).resources
    for(const r of prevResources){
      if(r.target_cost === res.target_cost && r.target_qty === res.target_qty){
        return r
      }
    }
  }
  return undefined
}

function prevHasRes(res){
  if(tables.previous.hasOwnProperty('RSRC') && res.hasOwnProperty('resId')){
    return projects.previous.resById.has(res.resId)
  }
  if(hasTask(res.task, projects.previous)){
    for(const r of getTask(res.task, projects.previous).resources){
      if(r.target_cost === res.target_cost && r.target_qty === res.target_qty){
        return true
      }
    }
  }
  return false
}

function currHasRes(res){
  if(tables.current.hasOwnProperty('RSRC') && res.hasOwnProperty('resId')){
    return projects.current.resById.has(res.resId)
  }
  if(hasTask(res.task, projects.current)){
    if(res.task.resources.length === 1 && getTask(res.task, projects.current).resources.length === 1){
      return true
    }
    for(let i=0;i<getTask(res.task, projects.current).resources.length;i++){
      const cr = getTask(res.task, projects.current).resources[i]
      if(cr.target_cost === res.target_cost && cr.target_qty === res.target_qty){
        return true
      }
    }
  }
  return false
}
// ... existing code ...

// === NEW: Export HTML Table to CSV ===
const downloadTableAsCSV = (tableEl, filename) => {
    let csv = [];
    const rows = tableEl.querySelectorAll("tr");
    
    for (let i = 0; i < rows.length; i++) {
        let row = [], cols = rows[i].querySelectorAll("td, th");
        for (let j = 0; j < cols.length; j++) 
            row.push('"' + cols[j].innerText.replace(/"/g, '""') + '"'); // Escape quotes
        csv.push(row.join(","));        
    }

    const csvFile = new Blob([csv.join("\n")], {type: "text/csv"});
    const downloadLink = document.createElement("a");
    downloadLink.download = filename;
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}