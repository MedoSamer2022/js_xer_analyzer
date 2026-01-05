
// ==============================
// main.js (Fixed Chart Sizing + Full Logic Preserved)
// ==============================

let tables = { current: {}, previous: {} }
let projects = {}

// Config (toggle features / silence console warnings)
const CONFIG = {
  silenceMissingIdWarnings: true,
  features: {
    headerKPIs: true,
    spi: true,
    lookAhead: true,
    resourceHistograms: true,
    trends: true,
    codesChanges: true,
    charts: true,
    warnings: true,
    advancedChecks: true
  },
  allowedMissingIds: new Set([]),
}

// Float thresholds & lag thresholds
const FLOAT = { critical: 0, nearCritical: 20, high: 50, lagWarn: 10 }

// ---------------- DOM safety helpers ----------------
const missingWarned = new Set()
function shouldWarnForId(id){
  if (CONFIG.silenceMissingIdWarnings) return false
  if (CONFIG.allowedMissingIds.has(id)) return false
  if (missingWarned.has(id)) return false
  return true
}
function getOrWarn(id){
  const el = document.getElementById(id)
  if(!el && shouldWarnForId(id)){
    console.warn(`[XER Analyzer] Missing element with id="${id}". Check your HTML.`)
    missingWarned.add(id)
  }
  return el
}
function safeSetText(id, value){ const el = getOrWarn(id); if(el) el.textContent = value }
function safeSetWidth(id, value){ const el = getOrWarn(id); if(el) el.style.width = value }
function removeElements(id){
  const sec = getOrWarn(id)
  if(!sec) return
  while(sec.firstChild) sec.removeChild(sec.firstChild)
}
function updateSection(id, el){
  removeElements(id)
  const sec = getOrWarn(id)
  if(sec) sec.append(el)
}

// ---------------- Chart helpers (Fixed) ----------------
const chartCache = new Map()

function buildChartOnce(id, configBuilder){
  const canvas = document.getElementById(id)
  if(!canvas) return

  // Wait if parent is hidden or zero size
  const parent = canvas.closest('.card') || canvas.parentElement
  if(parent && (window.getComputedStyle(parent).display === 'none' || parent.offsetHeight === 0)){
     setTimeout(()=>buildChartOnce(id, configBuilder), 500); return;
  }

  if(chartCache.has(id)){
    try{ chartCache.get(id).destroy() }catch(e){}
    chartCache.delete(id)
  }

  const cfg = configBuilder() || {}
  cfg.options = cfg.options || {}
  cfg.options.responsive = true
  cfg.options.maintainAspectRatio = false // Critical for correct sizing
  cfg.options.animation = cfg.options.animation || { duration: 300 }
  
  // Ensure plugins exist
  cfg.options.plugins = cfg.options.plugins || {}
  // Default tooltip settings if not provided
  if(!cfg.options.plugins.tooltip) cfg.options.plugins.tooltip = { enabled: true }

  const chart = new Chart(canvas, cfg)
  chartCache.set(id, chart)
}

function resizeVisibleCharts(){
  chartCache.forEach((chart, id)=>{
    const canvas = document.getElementById(id)
    if(canvas && canvas.offsetWidth && canvas.offsetHeight){
      try{ chart.resize() }catch(e){}
    }
  })
}

// Preserve original menuClickHandle to inject chart resize
const _origMenuClickHandle = function(e, id){
  document.querySelectorAll('.cat').forEach(el=>el.style.display='none')
  document.querySelectorAll('.active-btn').forEach(el=>el.classList.remove('active-btn'))
  const target = getOrWarn(id)
  if(target) target.style.display = 'flex'
  if(e && e.currentTarget) e.currentTarget.classList.add('active-btn')
}
function menuClickHandle(e, id){
  _origMenuClickHandle(e, id)
  setTimeout(resizeVisibleCharts, 150)
}

// ---------------- EV / PV / SPI ----------------
function sumEarnedValueFromResources(proj){
  if(Array.isArray(proj.resources) && proj.resources.length && typeof proj.resources[0].earnedValue !== 'undefined'){
    return proj.resources.reduce((acc,r)=>acc + (Number(r.earnedValue)||0), 0)
  }
  return (proj.physPercentComp || 0) * (proj.budgetCost || 0)
}
function plannedValueFromSchedule(proj){ return (proj.schedPercentComp || 0) * (proj.budgetCost || 0) }
function computeSPI(proj){
  const EV = sumEarnedValueFromResources(proj)
  const PV = plannedValueFromSchedule(proj)
  return { EV, PV, SPI: PV>0 ? (EV/PV) : null }
}

// ---------------- Look-Ahead ----------------
function getLookAhead(proj, days=14){
  const base = proj.last_recalc_date instanceof Date ? proj.last_recalc_date : proj.start
  const to = new Date(base.getTime() + days*24*3600*1000)
  const tasks = [...proj.tasks.values()]
  const starts = tasks.filter(t=>t.notStarted && t.start instanceof Date && t.start.getTime()>=base.getTime() && t.start.getTime()<=to.getTime())
  const finishes = tasks.filter(t=>!t.completed && t.finish instanceof Date && t.finish.getTime()>=base.getTime() && t.finish.getTime()<=to.getTime())
  const criticalStarts = starts.filter(t=>t.totalFloat <= FLOAT.critical)
  const nearCriticalStarts = starts.filter(t=>t.totalFloat > FLOAT.critical && t.totalFloat <= FLOAT.nearCritical)
  return { base, to, starts, finishes, criticalStarts, nearCriticalStarts }
}
function renderLookAhead(proj){
  if(!CONFIG.features.lookAhead) return
  const windows = [7,14,28].map(d=>({days:d, data:getLookAhead(proj, d)}))
  windows.forEach(w=>{
    safeSetText(`lookahead-${w.days}-starts`, w.data.starts.length.toLocaleString())
    safeSetText(`lookahead-${w.days}-finishes`, w.data.finishes.length.toLocaleString())
    safeSetText(`lookahead-${w.days}-critical-starts`, w.data.criticalStarts.length.toLocaleString())
    safeSetText(`lookahead-${w.days}-nearcritical-starts`, w.data.nearCriticalStarts.length.toLocaleString())
  })
  buildChartOnce('lookaheadStartsChart', ()=>({
    type:'bar',
    data:{
      labels: windows.map(w=>`${w.days}d`),
      datasets:[{ label:'Starts', data: windows.map(w=>w.data.starts.length), backgroundColor:'rgba(113,194,92,0.5)', borderColor:'rgba(113,194,92,1)', borderWidth:1, maxBarThickness:42 }]
    },
    options:{ scales:{ y:{ beginAtZero:true } } }
  }))
}

// ---------------- Resource Histograms ----------------
function buildResourceBuckets(resources, measure='target_qty'){
  const labelFn = r => r.role_name || r.resource_code || r.rsrc_name || String(r.rsrc_id || 'Unknown')
  const mFn = r => Number(r[measure]) || 0
  const buckets = new Map()
  ;(resources||[]).forEach(r=>{ const k = labelFn(r); buckets.set(k, (buckets.get(k)||0) + mFn(r)) })
  return buckets
}
function renderResourceHistogram(proj){
  if(!CONFIG.features.resourceHistograms) return
  const bucketsQty = buildResourceBuckets(proj.resources, 'target_qty')
  const bucketsCost = buildResourceBuckets(proj.resources, 'target_cost')
  
  // Sort top 10 to keep charts readable
  const sortedQty = [...bucketsQty.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10)
  const sortedCost = [...bucketsCost.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10)

  buildChartOnce('resourceQtyHistogramChart', ()=>({
    type:'bar',
    data:{ labels: sortedQty.map(i=>i[0]), datasets:[{ label:'Units', data: sortedQty.map(i=>i[1]), backgroundColor:'rgba(54,162,235,0.5)', borderColor:'rgba(54,162,235,1)', borderWidth:1 }] },
    options:{ indexAxis:'y', scales:{ x:{ beginAtZero:true } } }
  }))

  buildChartOnce('resourceCostHistogramChart', ()=>({
    type:'bar',
    data:{ labels: sortedCost.map(i=>i[0]), datasets:[{ label:'Cost', data: sortedCost.map(i=>i[1]), backgroundColor:'rgba(255,206,86,0.5)', borderColor:'rgba(255,206,86,1)', borderWidth:1 }] },
    options:{ indexAxis:'y', scales:{ x:{ beginAtZero:true } } }
  }))
}

// ---------------- Trend snapshots ----------------
const TREND_LS_KEY = 'xer_trend_snapshots_v1'
const trendStore = { snapshots: [] }

function loadTrendStore(){
  try{
    const raw = localStorage.getItem(TREND_LS_KEY)
    if(raw) trendStore.snapshots = JSON.parse(raw).snapshots || []
  }catch(e){ if(!CONFIG.silenceMissingIdWarnings) console.warn('Trend load failed:', e) }
}
function saveTrendStore(){
  try{ localStorage.setItem(TREND_LS_KEY, JSON.stringify(trendStore)) }catch(e){}
}
function addSnapshot(proj){
  if(!CONFIG.features.trends) return
  const dataDate = proj.last_recalc_date instanceof Date ? proj.last_recalc_date.toISOString().slice(0,10) : null
  const last = trendStore.snapshots.filter(s=>s.projId===proj.proj_id).slice(-1)[0]
  const isSameDataDate = last && last.dataDate === dataDate
  if(!isSameDataDate){
    trendStore.snapshots.push({
      ts: Date.now(), projId: proj.proj_id, dataDate,
      sched: proj.schedPercentComp || 0, phys: proj.physPercentComp || 0,
      spi: proj.spi, ev: proj.earnedValue, pv: proj.plannedValue, actualCost: proj.actualCost
    })
    saveTrendStore()
  }
}
function renderTrends(proj){
  if(!CONFIG.features.trends) return
  const data = trendStore.snapshots.filter(s=>s.projId === proj.proj_id)
  if(!data.length) return
  const labels = data.map(s=>s.dataDate || new Date(s.ts).toLocaleDateString())

  buildChartOnce('trendScheduleChart', ()=>({
    type:'line',
    data:{
      labels,
      datasets:[
        { label:'Sched %', data: data.map(s=>s.sched*100), borderColor:'rgba(54,162,235,1)', backgroundColor:'rgba(54,162,235,0.2)', tension:0.2 },
        { label:'Phys %', data: data.map(s=>s.phys*100), borderColor:'rgba(113,194,92,1)', backgroundColor:'rgba(113,194,92,0.2)', tension:0.2 }
      ]
    }, options:{ scales:{ y:{ beginAtZero:true, max:100 } } }
  }))

  buildChartOnce('trendSPIChart', ()=>({
    type:'line',
    data:{
      labels,
      datasets:[ { label:'SPI', data: data.map(s=>s.spi), borderColor:'rgba(255,99,132,1)', tension:0.2 } ]
    }
  }))

  buildChartOnce('trendCostChart', ()=>({
    type:'line',
    data:{
      labels,
      datasets:[
        { label:'Actual', data: data.map(s=>s.actualCost), borderColor:'rgba(255,206,86,1)', tension:0.2 },
        { label:'EV', data: data.map(s=>s.ev), borderColor:'rgba(113,194,92,1)', tension:0.2 },
        { label:'PV', data: data.map(s=>s.pv), borderColor:'rgba(54,162,235,1)', tension:0.2 }
      ]
    }
  }))
}

// ---------------- Activity Codes Comparison ----------------
function buildCodesByTaskP6(tablesObj, proj){
  const map = new Map()
  if(!tablesObj) return map
  const taskById = proj.tasksById || new Map()
  const actvCodeRows = tablesObj.ACTVCODE ? Object.values(tablesObj.ACTVCODE) : []
  const actvTypeRows = tablesObj.ACTVTYPE ? Object.values(tablesObj.ACTVTYPE) : []
  const taskActvRows = tablesObj.TASKACTV ? Object.values(tablesObj.TASKACTV) : []

  const codeById = new Map()
  actvCodeRows.forEach(r=>{
    const codeId = r.actv_code_id ?? r.actvcode_id ?? r.id
    const typeId = r.actvtype_id ?? r.type_id
    const val = r.actv_code_name ?? r.actv_code ?? r.short_name ?? r.actv_short_name ?? String(codeId)
    if(codeId!=null) codeById.set(codeId, { val, typeId })
  })
  const typeById = new Map()
  actvTypeRows.forEach(t=>{
    const id = t.actvtype_id ?? t.id
    const name = t.actvtype_name ?? t.name ?? t.short_name ?? 'Code'
    if(id!=null) typeById.set(id, name)
  })

  // Use TASKACTV or fallback
  const rowsToProcess = taskActvRows.length ? taskActvRows : actvCodeRows
  rowsToProcess.forEach(link=>{
    const taskId = link.task_id ?? link.taskId
    const codeId = link.actv_code_id ?? link.actvcode_id ?? link.id // handle fallback logic
    if(!taskId) return
    const task = taskById.get(taskId)
    if(!task) return
    
    // If using fallback (ACTVCODE direct), codeId is the row ID, need to find mapping
    let codeVal, typeName
    if(taskActvRows.length){
        // Standard P6 XER structure
        const code = codeById.get(codeId)
        if(!code) return
        typeName = typeById.get(code.typeId) ?? 'Code'
        codeVal = code.val
    } else {
        // Flat/Older structure where Code Row has TaskID
        const typeId = link.actvtype_id ?? link.type_id
        typeName = typeById.get(typeId) ?? 'Code'
        codeVal = link.actv_code_name ?? link.actv_code ?? String(codeId)
    }
    
    const key = task.task_code
    if(!map.has(key)) map.set(key, new Set())
    map.get(key).add(`${typeName}:${codeVal}`)
  })
  return map
}

function diffCodes(currMap, prevMap){
  const added=[], removed=[], changed=[]
  const allTasks = new Set([...currMap.keys(), ...prevMap.keys()])
  allTasks.forEach(taskCode=>{
    const curr = currMap.get(taskCode) || new Set()
    const prev = prevMap.get(taskCode) || new Set()
    const add = [...curr].filter(v=>!prev.has(v))
    const rem = [...prev].filter(v=>!curr.has(v))
    if(add.length && !rem.length) added.push({ taskCode, codes:add })
    else if(rem.length && !add.length) removed.push({ taskCode, codes:rem })
    else if(add.length || rem.length) changed.push({ taskCode, added:add, removed:rem })
  })
  return { added, removed, changed }
}

function renderCodeDiff(codeDiff){
  safeSetText("codes-added", codeDiff.added.length.toLocaleString())
  safeSetText("codes-removed", codeDiff.removed.length.toLocaleString())
  safeSetText("codes-changed", codeDiff.changed.length.toLocaleString())

  function makeTable(title, headers, rows){
    const wrapper = document.createElement("div")
    wrapper.classList.add("card","border-rad-8px","box-shadow")
    wrapper.innerHTML = `<h3 class="pad-bm-05em">${title} <button class="btn-xs float-right" onclick="downloadTableAsCSV(this.closest('.card').querySelector('table'), 'codes.csv')">⬇ CSV</button></h3>`
    const tableDiv = document.createElement("div"); tableDiv.classList.add("pad-10px"); wrapper.append(tableDiv)
    const tbl = document.createElement("table"); tbl.style.width = '100%'
    const header = tbl.insertRow()
    headers.forEach(t=>{ const th = document.createElement('th'); th.innerText = t; th.style.textAlign='left'; header.append(th) })
    rows.forEach(r=>{
      const tr = tbl.insertRow()
      r.forEach(val=>{ const td = tr.insertCell(); td.innerText = val })
    })
    tableDiv.append(tbl)
    return wrapper
  }

  const sections = [
      { id: 'codes-added', title: 'Added', headers:['Task','Codes'], rows: codeDiff.added.map(r=>[r.taskCode, r.codes.join(', ')]) },
      { id: 'codes-removed', title: 'Removed', headers:['Task','Codes'], rows: codeDiff.removed.map(r=>[r.taskCode, r.codes.join(', ')]) },
      { id: 'codes-changed', title: 'Changed', headers:['Task','Added','Removed'], rows: codeDiff.changed.map(r=>[r.taskCode, r.added.join(', '), r.removed.join(', ')]) }
  ]

  sections.forEach(s => {
      removeElements(`${s.id}-sec`)
      if(s.rows.length){
          updateSection(`${s.id}-sec`, makeTable(s.title, s.headers, s.rows))
          const btn = getOrWarn(`${s.id}-btn`)
          if(btn) btn.addEventListener('click', e=>menuClickHandle(e, `${s.id}-sec`))
      }
  })
}

// ---------------- Analyze Project ----------------
const analyzeProject = proj => {
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const monthKey = d => `${monthNames[d.getMonth()]}-${d.getFullYear()}`
  const initMonth = (p, key)=>{ if(!p.months[key]) p.months[key] = { actualActivity:0, earlyActivity:0, lateActivity:0 } }

  const tasks = [...proj.tasks.values()]
  proj.months = {}

  const lateEnd = (proj.lateEnd instanceof Date) ? proj.lateEnd : proj.scd_end_date
  const endDate = proj.scd_end_date.getTime() > lateEnd.getTime() ? proj.scd_end_date : lateEnd
  
  for(let y=proj.start.getFullYear(); y<=endDate.getFullYear(); y++){
    let m = (y===proj.start.getFullYear()) ? proj.start.getMonth() : 0
    let last = (y===endDate.getFullYear()) ? endDate.getMonth() : 11
    for(; m<=last; m++) initMonth(proj, `${monthNames[m]}-${y}`)
  }

  const pctPerTask = tasks.length ? (1 / tasks.length) / 2 * 100 : 0

  tasks.forEach(task=>{
    if(!(task.start instanceof Date) || !(task.finish instanceof Date)) return
    const sKey = monthKey(task.start), fKey = monthKey(task.finish)
    initMonth(proj, sKey); initMonth(proj, fKey)

    if(task.notStarted){
      proj.months[sKey].earlyActivity += pctPerTask
      proj.months[fKey].earlyActivity += pctPerTask
      if(task.late_start_date instanceof Date) {
          const lKey = monthKey(task.late_start_date)
          initMonth(proj, lKey); proj.months[lKey].lateActivity += pctPerTask
      }
    }
    if(task.inProgress || task.completed){
      proj.months[sKey].actualActivity += pctPerTask
      proj.months[fKey].actualActivity += pctPerTask
    }
  })

  // Grouping
  proj.notStarted = tasks.filter(t=>t.notStarted)
  proj.inProgress = tasks.filter(t=>t.inProgress)
  proj.completed  = tasks.filter(t=>t.completed)
  
  proj.taskDependent = tasks.filter(t=>t.taskType === 'Task Dependent')
  proj.milestones    = tasks.filter(t=>t.isMilestone)
  proj.loes          = tasks.filter(t=>t.isLOE)
  proj.rsrcDependent = tasks.filter(t=>t.taskType === 'Resource Dependent')

  proj.longestPath = tasks.filter(t=>t.longestPath)
  proj.critical     = tasks.filter(t=>t.totalFloat <= FLOAT.critical)
  proj.nearCritical = tasks.filter(t=>t.totalFloat > FLOAT.critical && t.totalFloat <= FLOAT.nearCritical)
  proj.normalFloat  = tasks.filter(t=>t.totalFloat > FLOAT.nearCritical && t.totalFloat < FLOAT.high)
  proj.highFloat    = tasks.filter(t=>t.totalFloat >= FLOAT.high)

  proj.fsLogic = proj.rels.filter(r=>r.link==='FS')
  proj.ffLogic = proj.rels.filter(r=>r.link==='FF')
  proj.ssLogic = proj.rels.filter(r=>r.link==='SS')
  proj.sfLogic = proj.rels.filter(r=>r.link==='SF')

  // Schedule %
  proj.scheduleDuration    = (proj.scd_end_date.getTime() - proj.start.getTime()) / (1000*3600*24)
  proj.remScheduleDuration = (proj.scd_end_date.getTime() - proj.last_recalc_date.getTime()) / (1000*3600*24)

  proj.origDurSum = tasks.reduce((od,t)=>od+t.origDur,0)
  proj.remDurSum  = tasks.reduce((rd,t)=>rd+t.remDur,0)

  const x = (proj.inProgress.length/2 + proj.completed.length) / proj.tasks.size
  const y = (1 - proj.remDurSum / proj.origDurSum)
  proj.physPercentComp   = (x+y)/2
  proj.schedPercentComp  = 1 - proj.remScheduleDuration / proj.scheduleDuration

  // Cost/Units
  proj.budgetCost      = budgetedCost(proj)
  proj.actualCost      = actualCost(proj)
  proj.thisPeriodCost  = thisPeriodCost(proj)
  proj.remainingCost   = remainingCost(proj)
  proj.budgetQty       = budgetedQty(proj)
  proj.actualQty       = actualQty(proj)
  proj.thisPeriodQty   = thisPeriodQty(proj)
  proj.remainingQty    = remainingQty(proj)

  // Advanced checks
  proj.negativeFloat          = tasks.filter(t=>!t.completed && t.totalFloat<0)
  proj.zeroFreeFloat          = tasks.filter(t=>!t.completed && t.freeFloat===0)
  proj.highLagRelations       = proj.rels.filter(r=>Math.abs(r.lag)>=FLOAT.lagWarn)
  proj.leads                  = proj.rels.filter(r=>r.lag<0)

  proj.redundantLogic = []
  proj.rels.forEach(rel=>{
    const keyFS = `${rel.predTask.task_code}|${rel.succTask.task_code}|FS`
    const keySS = `${rel.predTask.task_code}|${rel.succTask.task_code}|SS`
    const keyFF = `${rel.predTask.task_code}|${rel.succTask.task_code}|FF`
    if(rel.link!=='FS' && proj.relsById.has(keyFS)) proj.redundantLogic.push([proj.relsById.get(keyFS), rel])
    if(rel.link==='SS' && proj.relsById.has(keyFF)) proj.redundantLogic.push([rel, proj.relsById.get(keyFF)])
  })

  const mandatoryTypes = ['Mandatory Start','Mandatory Finish']
  proj.constraintConflicts = tasks.filter(t=>{
    const prim = t.primeConstraint
    if(!prim || mandatoryTypes.indexOf(prim)===-1) return false
    return t.predecessors.some(p=>p.lag<=0) || t.successors.some(s=>s.lag<=0)
  })

  proj.criticalIntegrityIssues = tasks.filter(t=>{
    if(!t.longestPath) return false
    return t.predecessors.length===0 || t.successors.length===0 || t.primeConstraint==='As Late as Possible'
  })

// OLD CODE:
  // proj.getSortedMonthKeys = () => Object.keys(proj.months).filter(k => /^[A-Z][a-z]{2}-\d{4}$/.test(k)).sort(...)

 // --- REPLACE WITH THIS ---
  proj.getSortedMonthKeys = () => Object.keys(proj.months).filter(k => {
      return k && k !== "undefined-NaN" && /^[A-Z][a-z]{2}-\d{4}$/.test(k);
  }).sort((a,b)=>{
      const [ma, ya] = a.split('-'); const [mb, yb] = b.split('-');
      return new Date(`${ma} 1, ${ya}`) - new Date(`${mb} 1, ${yb}`)
  });

  // EV/PV/SPI
  const { EV, PV, SPI } = computeSPI(proj)
  proj.earnedValue = EV
  proj.plannedValue = PV
  proj.spi = SPI

  return proj
}

// ---------------- Update Card ----------------
function updateProjCard(name, value){
  const proj = analyzeProject(tables[name].PROJECT[value])
  projects[name] = proj

  if(CONFIG.features.headerKPIs){
    safeSetText(`${name}-project-id`, proj.proj_short_name)
    safeSetText(`${name}-project-name`, proj.name)
    safeSetText(`${name}-project-version`, tables[name].version)
    safeSetText(`${name}-project-created`, tables[name].dateCreated)
    safeSetText(`${name}-project-user`, tables[name].createdBy)

    safeSetText(`${name}-start`, formatDate(proj.start))
    safeSetText(`${name}-data-date`, formatDate(proj.last_recalc_date))
    safeSetText(`${name}-end`, formatDate(proj.scd_end_date))
    safeSetText(`${name}-mfb`, proj.plan_end_date ? formatDate(proj.plan_end_date) : "None")

    safeSetText(`${name}-budget`, formatCost(proj.budgetCost))
    safeSetText(`${name}-actual-cost`, formatCost(proj.actualCost))
    safeSetText(`${name}-this-period`, formatCost(proj.thisPeriodCost))
    safeSetText(`${name}-remaining-cost`, formatCost(proj.remainingCost))

    safeSetText(`${name}-qty`, formatNumber(proj.budgetQty))
    safeSetText(`${name}-actual-qty`, formatNumber(proj.actualQty))
    safeSetText(`${name}-this-period-qty`, formatNumber(proj.thisPeriodQty))
    safeSetText(`${name}-remaining-qty`, formatNumber(proj.remainingQty))

    safeSetText(`${name}-tasks`, proj.tasks.size.toLocaleString())
    safeSetText(`${name}-not-started`, proj.notStarted.length.toLocaleString())
    safeSetText(`${name}-in-progress`, proj.inProgress.length.toLocaleString())
    safeSetText(`${name}-complete`, proj.completed.length.toLocaleString())

    safeSetText(`${name}-longest-path`, proj.longestPath.length.toLocaleString())
    safeSetText(`${name}-critical`, proj.critical.length.toLocaleString())
    safeSetText(`${name}-near-critical`, proj.nearCritical.length.toLocaleString())
    safeSetText(`${name}-normal-tf`, proj.normalFloat.length.toLocaleString())
    safeSetText(`${name}-high-tf`, proj.highFloat.length.toLocaleString())

    safeSetText(`${name}-task-dependent`, proj.taskDependent.length.toLocaleString())
    safeSetText(`${name}-milestones`, proj.milestones.length.toLocaleString())
    safeSetText(`${name}-loe`, proj.loes.length.toLocaleString())
    safeSetText(`${name}-rsrc-dependent`, proj.rsrcDependent.length.toLocaleString())

    safeSetText(`${name}-rels`, proj.rels.length.toLocaleString())
    safeSetText(`${name}-fs`, proj.fsLogic.length.toLocaleString())
    safeSetText(`${name}-ss`, proj.ssLogic.length.toLocaleString())
    safeSetText(`${name}-ff`, proj.ffLogic.length.toLocaleString())
    safeSetText(`${name}-sf`, proj.sfLogic.length.toLocaleString())

    safeSetText(`${name}-schedule-per`, formatPercent(proj.schedPercentComp))
    safeSetText(`${name}-physical-per`, formatPercent(proj.physPercentComp))
    if(proj.budgetCost){
      safeSetText(`${name}-cost-per`, formatPercent(proj.actualCost / proj.budgetCost))
    }else{
      safeSetText(`${name}-cost-per`, "N/A")
    }
  }

  if(CONFIG.features.spi){
    safeSetText(`${name}-spi`, proj.spi==null ? "N/A" : proj.spi.toFixed(2))
  }

  // Helper for Generated Tables
  function createTable(title, align, labels, vals){
    const div = document.createElement("div")
    div.classList.add("card","border-rad-8px","box-shadow")
    div.innerHTML = `<h3 class="pad-bm-05em">${title} <button class="btn-xs float-right" onclick="downloadTableAsCSV(this.closest('.card').querySelector('table'), 'export.csv')">⬇ CSV</button></h3>`
    const tableDiv = document.createElement("div"); tableDiv.classList.add("pad-10px")
    const table = document.createElement("table")
    table.style.width = '100%' 
    let row = table.insertRow()
    labels.forEach((val,i)=>{
      const th = document.createElement("th"); th.innerText = val; th.style.textAlign = align[i]; row.append(th)
    })
    vals.forEach(task=>{
      row = table.insertRow()
      task.forEach((val,i)=>{ const td = document.createElement("td"); td.innerText = val; td.style.textAlign = align[i]; row.append(td) })
    })
    tableDiv.append(table); div.append(tableDiv)
    return div
  }
  function activateButton(btn, sec){
    const b = getOrWarn(btn)
    if(!b) return
    b.classList.remove("inactive-btn"); b.classList.add("show-data")
    b.addEventListener("click", e=>menuClickHandle(e, sec))
  }
  function updateElements(obj){
    if(!CONFIG.features.warnings) return
    Object.values(obj).forEach(update=>{
      safeSetText(update.id, update.data.length.toLocaleString())
      removeElements(`${update.id}-sec`)
      if(update.data.length){
        updateSection(`${update.id}-sec`, createTable(update.title, update.align, update.columns, update.getRows()))
        activateButton(`${update.id}-btn`, `${update.id}-sec`)
      }
    })
  }
  const changeCount = obj => Object.values(obj).reduce((total, change)=>total + change.data.length, 0)

  // ---------- Current Project Charts & Warnings ----------
  if(name === "current"){
    const currTasks = [...projects.current.tasks.values()].sort(sortById)
    const currResources = projects.current.resources

    const calTable = getOrWarn('calendar-tbl')
    if(calTable && tables.current.CALENDAR){
      calTable.innerHTML = `<tr><th class="text-left">Calendar</th><th class="text-center">Sun</th><th class="text-center">Mon</th><th class="text-center">Tue</th><th class="text-center">Wed</th><th class="text-center">Thu</th><th class="text-center">Fri</th><th class="text-center">Sat</th><th class="text-center">Activities</th><th class="text-center">Exceptions</th></tr>`
      Object.values(tables.current.CALENDAR).forEach(cal=>{
        const row = calTable.insertRow()
        const tdName = document.createElement("td"); tdName.innerText = cal.clndr_name; row.append(tdName)
        cal.week.forEach(day=>{ const td = document.createElement("td"); td.innerText = day.hours; td.style.textAlign='center'; row.append(td) })
      })
    }

    const titleEl = getOrWarn('title')
    if(titleEl) titleEl.innerText = `XER Analyzer - ${projects.current.proj_short_name}`

    safeSetWidth("sched-progress", `${formatPercent(projects.current.schedPercentComp)}`)
    safeSetWidth("phys-progress",  `${formatPercent(projects.current.physPercentComp)}`)
    safeSetWidth("cost-progress", projects.current.budgetCost ? `${formatPercent(projects.current.actualCost / projects.current.budgetCost)}` : '0%')

    // Percents in overview
    const total = projects.current.tasks.size || 1
    safeSetText("current-not-started-per",   formatPercent(projects.current.notStarted.length/total))
    safeSetText("current-in-progress-per",   formatPercent(projects.current.inProgress.length/total))
    safeSetText("current-complete-per",      formatPercent(projects.current.completed.length/total))
    safeSetText("current-task-dependent-per",formatPercent(projects.current.taskDependent.length/total))
    safeSetText("current-milestones-per",    formatPercent(projects.current.milestones.length/total))
    safeSetText("current-loe-per",           formatPercent(projects.current.loes.length/total))
    safeSetText("current-rsrc-dependent-per",formatPercent(projects.current.rsrcDependent.length/total))
    safeSetText("current-longest-path-per",  formatPercent(projects.current.longestPath.length/total))
    safeSetText("current-critical-per",      formatPercent(projects.current.critical.length/total))
    safeSetText("current-near-critical-per", formatPercent(projects.current.nearCritical.length/total))
    safeSetText("current-normal-tf-per",     formatPercent(projects.current.normalFloat.length/total))
    safeSetText("current-high-tf-per",       formatPercent(projects.current.highFloat.length/total))
    
    const totRels = projects.current.rels.length || 1
    safeSetText("current-fs-per", formatPercent(projects.current.fsLogic.length/totRels))
    safeSetText("current-ss-per", formatPercent(projects.current.ssLogic.length/totRels))
    safeSetText("current-ff-per", formatPercent(projects.current.ffLogic.length/totRels))
    safeSetText("current-sf-per", formatPercent(projects.current.sfLogic.length/totRels))

    // --- CHART FIX: Wrapping in DIVs ---
    if(CONFIG.features.charts){
      const monthKeys = projects.current.getSortedMonthKeys()
      const monthsMap = projects.current.months

      buildChartOnce('activityProgressChart', ()=>({
        type:'bar',
        data:{
          labels: monthKeys,
          datasets:[
            { label:'Actual', data: monthKeys.map(k=>monthsMap[k].actualActivity), backgroundColor:'rgba(54,162,235,0.5)', borderColor:'rgba(54,162,235,1)', borderWidth:1 },
            { label:'Planned Early', data: monthKeys.map(k=>monthsMap[k].earlyActivity), backgroundColor:'rgba(113,194,92,0.5)', borderColor:'rgba(113,194,92,1)', borderWidth:1 },
            { label:'Planned Late', data: monthKeys.map(k=>monthsMap[k].lateActivity), backgroundColor:'rgba(255,99,132,0.5)', borderColor:'rgba(255,99,132,1)', borderWidth:1 }
          ]
        },
        options:{ scales:{ x:{ ticks:{ autoSkip:true } }, y:{ beginAtZero:true } } }
      }))

      // Doughnut Options with Legend Hidden
      const donutOpts = { cutout:'55%', plugins: { legend: { display: false } } }

      // 1. Status Chart Wrapper
      const statusParent = document.getElementById('activityStatusChart').parentElement;
      if(statusParent.tagName === 'TD') statusParent.innerHTML = '<div class="chart-wrapper"><canvas id="activityStatusChart"></canvas></div>';
      buildChartOnce('activityStatusChart', ()=>({
        type:'doughnut',
        data:{
          labels:['Not Started','In Progress','Complete'],
          datasets:[{ data:[ projects.current.notStarted.length, projects.current.inProgress.length, projects.current.completed.length ], backgroundColor:['#ff6384','#4bc0c0','#36a2eb'], borderWidth:2, borderColor:'#fff' }]
        }, options: donutOpts
      }))

      // 2. Type Chart Wrapper
      const typeParent = document.getElementById('activityTypeChart').parentElement;
      if(typeParent.tagName === 'TD') typeParent.innerHTML = '<div class="chart-wrapper"><canvas id="activityTypeChart"></canvas></div>';
      buildChartOnce('activityTypeChart', ()=>({
        type:'doughnut',
        data:{
          labels:['Task','Milestone','LOE','Resource'],
          datasets:[{ data:[ projects.current.taskDependent.length, projects.current.milestones.length, projects.current.loes.length, projects.current.rsrcDependent.length ], backgroundColor:['#ff6384','#4bc0c0','#36a2eb','#ffcd56'], borderWidth:2, borderColor:'#fff' }]
        }, options: donutOpts
      }))

      // 3. Float Chart Wrapper
      const floatParent = document.getElementById('activityFloatChart').parentElement;
      if(floatParent.tagName === 'TD') floatParent.innerHTML = '<div class="chart-wrapper"><canvas id="activityFloatChart"></canvas></div>';
      buildChartOnce('activityFloatChart', ()=>({
        type:'doughnut',
        data:{
          labels:['Critical','Near-Crit','Normal','High'],
          datasets:[{ data:[ projects.current.critical.length, projects.current.nearCritical.length, projects.current.normalFloat.length, projects.current.highFloat.length ], backgroundColor:['#ff6384','#ffcd56','#36a2eb','#4bc0c0'], borderWidth:2, borderColor:'#fff' }]
        }, options: donutOpts
      }))

      // 4. Relations Chart Wrapper
      const relParent = document.getElementById('relationshipChart').parentElement;
      if(relParent.tagName === 'TD') relParent.innerHTML = '<div class="chart-wrapper"><canvas id="relationshipChart"></canvas></div>';
      buildChartOnce('relationshipChart', ()=>({
        type:'doughnut',
        data:{
          labels:['FS','SS','FF','SF'],
          datasets:[{ data:[ projects.current.fsLogic.length, projects.current.ssLogic.length, projects.current.ffLogic.length, projects.current.sfLogic.length ], backgroundColor:['#4bc0c0','#36a2eb','#ffcd56','#ff6384'], borderWidth:2, borderColor:'#fff' }]
        }, options: donutOpts
      }))

      // Histograms (Regular bars, no wrapper needed if container is fine)
      const floatBins = [0,0,0,0,0,0];
      currTasks.forEach(t=>{ if(t.totalFloat<0) floatBins[0]++; else if(t.totalFloat===0) floatBins[1]++; else if(t.totalFloat<=5) floatBins[2]++; else if(t.totalFloat<=10) floatBins[3]++; else if(t.totalFloat<=20) floatBins[4]++; else floatBins[5]++; })
      buildChartOnce('floatDistributionChart', ()=>({ type:'bar', data:{ labels:['<0','0','1-5','6-10','11-20','>20'], datasets:[{ label:'Count', data:floatBins, backgroundColor:'#36a2eb' }] } }))

      const lagBins = [0,0,0,0,0,0];
      projects.current.rels.forEach(r=>{ if(r.lag<0) lagBins[0]++; else if(r.lag===0) lagBins[1]++; else if(r.lag<=3) lagBins[2]++; else if(r.lag<=7) lagBins[3]++; else if(r.lag<=14) lagBins[4]++; else lagBins[5]++; })
      buildChartOnce('lagDistributionChart', ()=>({ type:'bar', data:{ labels:['Lead','0','1-3','4-7','8-14','>15'], datasets:[{ label:'Count', data:lagBins, backgroundColor:'#ffcd56' }] } }))
    }

    renderLookAhead(projects.current)
    renderResourceHistogram(projects.current)
    addSnapshot(projects.current)
    renderTrends(projects.current)

    // Warnings Logic
    openEnds.predecessor.data = currTasks.filter(t=>!t.predecessors.length)
    openEnds.successor.data   = currTasks.filter(t=>!t.successors.length)
    openEnds.start.data       = currTasks.filter(t=>t.predecessors.length && !t.predecessors.some(p=>p.link==='SS'||p.link==='FS'))
    openEnds.finish.data      = currTasks.filter(t=>t.successors.length && !t.successors.some(s=>s.link==='FF'||s.link==='FS'))
    projects.current.fsLogic.forEach(rel=>{
      const ffID = `${rel.predTask.task_code}|${rel.succTask.task_code}|FF`
      const ssID = `${rel.predTask.task_code}|${rel.succTask.task_code}|SS`
      if(projects.current.relsById.has(ffID)) openEnds.duplicate.data.push([rel, projects.current.relsById.get(ffID)])
      if(projects.current.relsById.has(ssID)) openEnds.duplicate.data.push([rel, projects.current.relsById.get(ssID)])
    })
    safeSetText("open", changeCount(openEnds).toLocaleString())
    updateElements(openEnds)

    const dd = projects.current.last_recalc_date.getTime()
    dateWarnings.start.data    = currTasks.filter(t=>!t.notStarted && t.start instanceof Date && t.start.getTime() >= dd)
    dateWarnings.finish.data   = currTasks.filter(t=>t.completed && t.finish instanceof Date && t.finish.getTime() >= dd)
    
    // --- START OF NEW CODE ---
    // 1. Setup the Data and Columns
    dateWarnings.expected.data = currTasks.filter(t => !t.completed && t.expect_end_date);
    dateWarnings.expected.columns = ["Task ID", "Task Name", "Exp Finish", "Rem Dur"];
    dateWarnings.expected.align = ["left", "left", "center", "center"];
    dateWarnings.expected.getRows = function() {
        return this.data.map(t => [
            t.task_code,
            t.task_name,
            formatDate(t.expect_end_date), 
            t.remDur
        ]);
    };
    // --- END OF NEW CODE ---

    // ---------------------------------------------------------
    // FIXED: Suspended & Resume Section with Filters
    // ---------------------------------------------------------

    // 1. Setup Data and Columns (ID, Name, Suspend Date, Resume Date)
    dateWarnings.suspend.data = currTasks.filter(t => t.suspend_date);
    dateWarnings.suspend.columns = ["Task ID", "Task Name", "Suspend Date", "Resume Date"];
    dateWarnings.suspend.align = ["left", "left", "center", "center"];
    
    dateWarnings.suspend.getRows = function() {
        return this.data.map(t => [
            t.task_code,
            t.task_name,
            formatDate(t.suspend_date),
            t.resume_date ? formatDate(t.resume_date) : "-"
        ]);
    };

    // 2. Refresh the UI for these sections
    // Note: We update both here to ensure the counts ("inv") are correct
    safeSetText("inv", changeCount(dateWarnings).toLocaleString())
    updateElements(dateWarnings)

    // 3. INJECT FILTERS FOR SUSPENDED TABLE
    const suspSectionId = `${dateWarnings.suspend.id}-sec`; 
    const suspSec = document.getElementById(suspSectionId);

    if (suspSec && suspSec.querySelector("table") && !document.getElementById("filt-susp-id")) {
        const filterDiv = document.createElement("div");
        filterDiv.style.cssText = "display: flex; gap: 10px; padding: 10px; background: #f4f4f4; border-bottom: 1px solid #ddd;";
        
        filterDiv.innerHTML = `
            <input type="text" id="filt-susp-id" placeholder="Filter ID..." onkeyup="filterSuspendTable('${suspSectionId}')" style="flex:1; padding:4px;">
            <input type="text" id="filt-susp-name" placeholder="Filter Name..." onkeyup="filterSuspendTable('${suspSectionId}')" style="flex:2; padding:4px;">
            <input type="text" id="filt-susp-sdate" placeholder="Suspend Date..." onkeyup="filterSuspendTable('${suspSectionId}')" style="flex:1; padding:4px;">
            <input type="text" id="filt-susp-rdate" placeholder="Resume Date..." onkeyup="filterSuspendTable('${suspSectionId}')" style="flex:1; padding:4px;">
        `;
        
        const tableContainer = suspSec.querySelector(".pad-10px") || suspSec.firstChild;
        if(tableContainer) {
            const card = suspSec.querySelector(".card");
            if(card) card.insertBefore(filterDiv, card.querySelector(".pad-10px"));
            else suspSec.insertBefore(filterDiv, suspSec.firstChild);
        }
    }

    // --- INJECT FILTERS (Paste this right after updateElements) ---
    const sectionId = `${dateWarnings.expected.id}-sec`; 
    const expSec = document.getElementById(sectionId);

    if (expSec && expSec.querySelector("table") && !document.getElementById("filt-exp-id")) {
        const filterDiv = document.createElement("div");
        filterDiv.style.cssText = "display: flex; gap: 10px; padding: 10px; background: #f4f4f4; border-bottom: 1px solid #ddd;";
        
        filterDiv.innerHTML = `
            <input type="text" id="filt-exp-id" placeholder="Filter ID..." onkeyup="filterExpectedFinishTable('${sectionId}')" style="flex:1; padding:4px;">
            <input type="text" id="filt-exp-name" placeholder="Filter Name..." onkeyup="filterExpectedFinishTable('${sectionId}')" style="flex:2; padding:4px;">
            <input type="text" id="filt-exp-date" placeholder="Filter Date..." onkeyup="filterExpectedFinishTable('${sectionId}')" style="flex:1; padding:4px;">
            <input type="text" id="filt-exp-rem" placeholder="Rem..." onkeyup="filterExpectedFinishTable('${sectionId}')" style="flex:0.5; padding:4px;">
        `;
        
        const tableContainer = expSec.querySelector(".pad-10px") || expSec.firstChild;
        if(tableContainer) {
            const card = expSec.querySelector(".card");
            if(card) card.insertBefore(filterDiv, card.querySelector(".pad-10px"));
            else expSec.insertBefore(filterDiv, expSec.firstChild);
        }
    }

    costWarnings.budget.data = currResources.filter(r=>r.target_cost !== r.atCompletionCost)
    costWarnings.earned.data = currResources.filter(r=>r.actualCost !== r.earnedValue)
    costWarnings.regress.data= currResources.filter(r=>(r.target_cost>0 && r.act_this_per_cost<0) || (r.target_cost<0 && r.act_this_per_cost>0))
    safeSetText("cost", changeCount(costWarnings).toLocaleString())
    updateElements(costWarnings)

    durWarnings.long.data  = currTasks.filter(t=>!t.isLOE && t.origDur>20) // Simplified
    durWarnings.short.data = currTasks.filter(t=>!t.isLOE && t.origDur===1)
    durWarnings.zero.data  = currTasks.filter(t=>!t.isMilestone && t.origDur===0)
    durWarnings.rdzero.data= currTasks.filter(t=>!t.isMilestone && !t.completed && t.origDur>0 && t.remDur===0)
    durWarnings.odrd.data  = currTasks.filter(t=>t.notStarted && t.origDur!==t.remDur)
    safeSetText("dur", changeCount(durWarnings).toLocaleString())
    updateElements(durWarnings)

    if(CONFIG.features.advancedChecks){
      advChecks.negFloat.data           = projects.current.negativeFloat
      advChecks.freeFloat.data          = projects.current.zeroFreeFloat
      advChecks.lags.data               = projects.current.highLagRelations.concat(projects.current.leads)
      advChecks.redundant.data          = projects.current.redundantLogic
      advChecks.constraintConflict.data = projects.current.constraintConflicts
      advChecks.criticalIntegrity.data  = projects.current.criticalIntegrityIssues
      safeSetText("adv", changeCount(advChecks).toLocaleString())
      updateElements(advChecks)
    }
  }

  // ---------- Previous Project Logic (Comparison) ----------
  if(name === "previous"){
	  logicChanges.revised.data = projects.current.rels.filter(r => 
    prevHasLogic(r) && r.lag !== getPrevLogic(r).lag
)
    const currTasks = [...projects.current.tasks.values()]
    const prevTasks = [...projects.previous.tasks.values()]
    const currResources = projects.current.resources
    const prevResources = projects.previous.resources
    
    // Helper to find task/res
    const hasTask = (t, p) => p.tasksByCode.has(t.task_code)
    const getTask = (t, p) => p.tasksByCode.get(t.task_code)
    const hasRes = (r, p) => { 
        if(!hasTask(r.task, p)) return false
        const pt = getTask(r.task, p)
        return pt.resources.some(pr => pr.target_cost===r.target_cost && pr.target_qty===r.target_qty)
    }

    updates.started.data = currTasks.filter(t=>t.inProgress && hasTask(t, projects.previous) && getTask(t, projects.previous).notStarted)
    updates.finished.data= currTasks.filter(t=>t.completed && hasTask(t, projects.previous) && getTask(t, projects.previous).inProgress)
    updates.startFinish.data = currTasks.filter(t=>t.completed && hasTask(t, projects.previous) && getTask(t, projects.previous).notStarted)
    updates.percent.data  = currTasks.filter(t=>hasTask(t, projects.previous) && t.physPercentComp > getTask(t, projects.previous).physPercentComp)
    updates.duration.data = currTasks.filter(t=>t.remDur!==t.origDur && hasTask(t, projects.previous) && t.remDur < getTask(t, projects.previous).remDur)
    updates.cost.data     = currTasks.filter(t=>hasTask(t, projects.previous) && actualCost(t) !== actualCost(getTask(t, projects.previous)))
    updates.regress.data  = currTasks.filter(t=>hasTask(t, projects.previous) && t.physPercentComp < getTask(t, projects.previous).physPercentComp)
    safeSetText("ud", Object.values(updates).reduce((tot,c)=>tot+c.data.length,0).toLocaleString())
    updateElements(updates)

    taskChanges.added.data    = currTasks.filter(t=>!hasTask(t, projects.previous))
    taskChanges.deleted.data  = prevTasks.filter(t=>!projects.current.tasksByCode.has(t.task_code))
    taskChanges.name.data     = currTasks.filter(t=>hasTask(t, projects.previous) && t.task_name !== getTask(t, projects.previous).task_name)
    taskChanges.duration.data = currTasks.filter(t=>hasTask(t, projects.previous) && t.origDur !== getTask(t, projects.previous).origDur)
    taskChanges.start.data    = currTasks.filter(t=>hasTask(t, projects.previous) && !t.notStarted && !getTask(t, projects.previous).notStarted && t.start.getTime() !== getTask(t, projects.previous).start.getTime())
    taskChanges.finish.data   = currTasks.filter(t=>hasTask(t, projects.previous) && t.completed && getTask(t, projects.previous).completed && t.finish.getTime() !== getTask(t, projects.previous).finish.getTime())
    safeSetText("tk", Object.values(taskChanges).reduce((tot,c)=>tot+c.data.length,0).toLocaleString())
    updateElements(taskChanges)

    logicChanges.added.data   = projects.current.rels.filter(r=>!prevHasLogic(r))
    logicChanges.deleted.data = projects.previous.rels.filter(r=>!projects.current.relsById.has(r.logicId))
    safeSetText("rl", Object.values(logicChanges).reduce((tot,c)=>tot+c.data.length,0).toLocaleString())
    updateElements(logicChanges)

    resourceChanges.added.data = currResources.filter(r=>!prevHasRes(r))
    resourceChanges.deleted.data = prevResources.filter(r=>!currHasRes(r))
    safeSetText("rs", Object.values(resourceChanges).reduce((tot,c)=>tot+c.data.length,0).toLocaleString())
    updateElements(resourceChanges)

    if(CONFIG.features.codesChanges){
      const currCodesByTask = buildCodesByTaskP6(tables.current,  projects.current)
      const prevCodesByTask = buildCodesByTaskP6(tables.previous, projects.previous)
      const codeDiff = diffCodes(currCodesByTask, prevCodesByTask)
      renderCodeDiff(codeDiff)
    }
  }
}

// ---------------- Init ----------------
const fileSelectors = document.querySelectorAll(".xer")
const analyzeButton = document.getElementById("analyze-btn")
const compCheck = document.getElementById("compare-checkbox")
function isEmptyObj(obj){ return Object.keys(obj).length===0 }

document.addEventListener('DOMContentLoaded', ()=>{
  loadTrendStore()

  if(analyzeButton){
    analyzeButton.addEventListener("click", (e)=>{
      const currSelector = document.getElementById("current-project-selector")
      const prevSelector = document.getElementById("previous-project-selector")
      
      updateProjCard("current", currSelector ? currSelector.value : undefined)
      if(compCheck && compCheck.checked && prevSelector){
        updateProjCard("previous", prevSelector.value)
      }

      const menu = getOrWarn("menu"); if(menu) menu.classList.remove("hidden")
      const upload = getOrWarn("upload"); if(upload) upload.classList.add("hidden")
      menuClickHandle(e, 'general')
      const dashBtn = getOrWarn("dashboard-btn"); if(dashBtn) dashBtn.classList.add("active-btn")
      
      if(typeof FilterManager !== 'undefined') FilterManager.init();
    })
  }

  const checkIfReady = ()=>{
    if(!compCheck || !analyzeButton) return false
    if(!compCheck.checked && !isEmptyObj(tables.current)) return true
    if(compCheck.checked && !isEmptyObj(tables.current) && !isEmptyObj(tables.previous)) return true
    return false
  }

  for(let i=0; i<fileSelectors.length; i++){
    fileSelectors[i].addEventListener("change", (e)=>{
      const reader = new FileReader()
      const projSelector = document.getElementById(`${e.target.name}-project-selector`)
      reader.onload = r=>{
        tables[e.target.name] = parseFile(r.target.result, e.target.files[0].name)
        if(projSelector){
          updateProjList(tables[e.target.name].PROJECT, projSelector)
          if(Object.keys(tables[e.target.name].PROJECT).length > 1) projSelector.classList.remove("hidden")
          else projSelector.classList.add("hidden")
        }
        if(analyzeButton) analyzeButton.disabled = !checkIfReady()
      }
      reader.readAsText(e.target.files[0], "cp1252")
    })
  }

  if(compCheck){
    compCheck.addEventListener("change", ()=>{
      const baseEls = document.querySelectorAll(".base")
      if(compCheck.checked){
        baseEls.forEach(el=>el.classList.remove("hidden"))
      }else{
        tables.previous = {}
        const selector = document.getElementById("previous-project-selector")
        if(selector){
          selector.value = ""; for(let i=selector.options.length-1; i>=0; i--) selector.remove(i)
        }
        baseEls.forEach(el=>el.classList.add("hidden"))
      }
      if(analyzeButton) analyzeButton.disabled = !checkIfReady()
    })
  }
})

function updateProjList(projs, selector){
  for(let i=selector.options.length-1; i>=0; i--) selector.remove(i)
  for(const pid in projs){
    const opt = document.createElement("option")
    opt.textContent = `${projs[pid].proj_short_name} - ${projs[pid].name}`
    opt.value = projs[pid].proj_id
    selector.appendChild(opt)
  }
}
// ==========================================
// NEW: Filter Function for Expected Finish Table
// ==========================================
// ==========================================
// Filter Function for Expected Finish Table
// ==========================================
function filterExpectedFinishTable(sectionId) {
    // Default to 'expected-sec' if no ID provided (backward compatibility)
    if (!sectionId) sectionId = "expected-sec";

    // 1. Get input values
    const idElem = document.getElementById("filt-exp-id");
    const nameElem = document.getElementById("filt-exp-name");
    const dateElem = document.getElementById("filt-exp-date");
    const remElem = document.getElementById("filt-exp-rem");

    if (!idElem || !nameElem || !dateElem || !remElem) return;

    const idFilter = idElem.value.toUpperCase();
    const nameFilter = nameElem.value.toUpperCase();
    const dateFilter = dateElem.value.toUpperCase();
    const remFilter = remElem.value.toUpperCase();

    // 2. Get the table
    const container = document.getElementById(sectionId); 
    if (!container) return;
    const table = container.querySelector("table");
    if (!table) return;

    const trs = table.getElementsByTagName("tr");

    // 3. Loop through rows (start at i=1 to skip header)
    for (let i = 1; i < trs.length; i++) {
        const tds = trs[i].getElementsByTagName("td");
        if (tds.length < 4) continue; 

        // Column mapping: [0] ID, [1] Name, [2] Date, [3] Rem Dur
        const idTxt   = tds[0].textContent || "";
        const nameTxt = tds[1].textContent || "";
        const dateTxt = tds[2].textContent || "";
        const remTxt  = tds[3].textContent || "";

        const matchesId   = idTxt.toUpperCase().indexOf(idFilter) > -1;
        const matchesName = nameTxt.toUpperCase().indexOf(nameFilter) > -1;
        const matchesDate = dateTxt.toUpperCase().indexOf(dateFilter) > -1;
        const matchesRem  = remTxt.toUpperCase().indexOf(remFilter) > -1;

        if (matchesId && matchesName && matchesDate && matchesRem) {
            trs[i].style.display = "";
        } else {
            trs[i].style.display = "none";
        }
    }
}
// ==========================================
// Filter Function for Suspended/Resume Table
// ==========================================
function filterSuspendTable(sectionId) {
    if (!sectionId) sectionId = "suspend-sec"; // Fallback

    const idElem = document.getElementById("filt-susp-id");
    const nameElem = document.getElementById("filt-susp-name");
    const sDateElem = document.getElementById("filt-susp-sdate");
    const rDateElem = document.getElementById("filt-susp-rdate");

    if (!idElem || !nameElem || !sDateElem || !rDateElem) return;

    const idFilter = idElem.value.toUpperCase();
    const nameFilter = nameElem.value.toUpperCase();
    const sDateFilter = sDateElem.value.toUpperCase();
    const rDateFilter = rDateElem.value.toUpperCase();

    const container = document.getElementById(sectionId); 
    if (!container) return;
    const table = container.querySelector("table");
    if (!table) return;

    const trs = table.getElementsByTagName("tr");

    for (let i = 1; i < trs.length; i++) {
        const tds = trs[i].getElementsByTagName("td");
        if (tds.length < 4) continue; 

        // Column mapping: [0] ID, [1] Name, [2] Suspend Date, [3] Resume Date
        const idTxt   = tds[0].textContent || "";
        const nameTxt = tds[1].textContent || "";
        const sDateTxt = tds[2].textContent || "";
        const rDateTxt = tds[3].textContent || "";

        const matchesId    = idTxt.toUpperCase().indexOf(idFilter) > -1;
        const matchesName  = nameTxt.toUpperCase().indexOf(nameFilter) > -1;
        const matchesSDate = sDateTxt.toUpperCase().indexOf(sDateFilter) > -1;
        const matchesRDate = rDateTxt.toUpperCase().indexOf(rDateFilter) > -1;

        if (matchesId && matchesName && matchesSDate && matchesRDate) {
            trs[i].style.display = "";
        } else {
            trs[i].style.display = "none";
        }
    }
}
