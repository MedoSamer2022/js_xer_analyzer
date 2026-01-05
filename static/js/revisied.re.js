function calculateRevisedRelationships() {
    // 1. Check if we have both projects
    if (!projects.current || !projects.previous) return;

    const currentrels = projects.current.relationships || [];
    const previousrels = projects.previous.relationships || [];
    
    let revisedCount = 0;

    // 2. Loop through Current Relationships to find matches
    currentrels.forEach(curr => {
        // Find matching relationship in previous (Same Pred, Same Succ)
        const prev = previousrels.find(p => 
            p.pred_task_id === curr.pred_task_id && 
            p.succ_task_id === curr.succ_task_id
        );

        if (prev) {
            // 3. Check if Type or Lag has changed
            // Note: Adjust property names (e.g. 'type', 'lag') based on your actual parser structure
            if (curr.type !== prev.type || curr.lag !== prev.lag) {
                revisedCount++;
            }
        }
    });

    // 4. Update the Dashboard Number
    const el = document.getElementById('rl-revised');
    if(el) el.textContent = revisedCount;
}