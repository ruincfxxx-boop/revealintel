// ===== Dashboard Logic =====

document.addEventListener('DOMContentLoaded', () => {
  const headerKeyDisplay = document.getElementById('header-key-display');
  const navKeyDisplay = document.getElementById('nav-key-display');
  
  const lookupForm = document.getElementById('lookup-form');
  const lookupInput = document.getElementById('lookup-input');
  const lookupBtn = document.getElementById('lookup-btn');
  const lookupResults = document.getElementById('lookup-results');
  
  const graphResults = document.getElementById('graph-results');
  const viewListBtn = document.getElementById('view-list-btn');
  const viewGraphBtn = document.getElementById('view-graph-btn');
  
  let currentView = 'list';
  let network = null;
  let globalNodes = null;
  let globalEdges = null;
  let addedResultIndices = new Set();
  let currentSearchData = null;
  let currentSearchQuery = null;

  // Load Active Key
  const activeKey = localStorage.getItem('reveal_active_key');
  
  if (activeKey) {
    // Hide the key completely for screensharing, only show the username
    const username = localStorage.getItem('reveal_username') || 
                     sessionStorage.getItem('reveal_username') || 
                     activeKey.split('-')[0];
    
    if (headerKeyDisplay) headerKeyDisplay.textContent = username;
    if (navKeyDisplay) navKeyDisplay.textContent = username;
  } else {
    if (headerKeyDisplay) headerKeyDisplay.textContent = "No Active Subscription";
    if (navKeyDisplay) navKeyDisplay.textContent = "Guest";
  }

  // User Dropdown Menu
  const userDropdownBtn = document.getElementById('dash-user-dropdown');
  const userMenu = document.getElementById('dash-user-menu');
  const signOutBtn = document.getElementById('sign-out-btn');

  if (userDropdownBtn && userMenu) {
    userDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userMenu.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!userMenu.contains(e.target)) {
        userMenu.classList.remove('active');
      }
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('reveal_active_key');
      localStorage.removeItem('rawintel_active_key');
      window.location.href = '/';
    });
  }

  // Light Mode Toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('light-mode');
    });
  }

  // View Toggles
  if (viewListBtn && viewGraphBtn) {
    viewListBtn.addEventListener('click', () => {
      currentView = 'list';
      viewListBtn.classList.add('active');
      viewGraphBtn.classList.remove('active');
      lookupResults.style.display = 'block';
      graphResults.style.display = 'none';
    });
    viewGraphBtn.addEventListener('click', () => {
      currentView = 'graph';
      viewGraphBtn.classList.add('active');
      viewListBtn.classList.remove('active');
      lookupResults.style.display = 'none';
      graphResults.style.display = 'block';
      if (network) {
        setTimeout(() => {
          network.redraw();
          network.fit();
        }, 50);
      }
    });
  }
  // Simulated Lookup Functionality
  if (lookupForm) {
    lookupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const query = lookupInput.value.trim();
      if (!query) return;

      if (!activeKey) {
        lookupResults.style.display = 'block';
        lookupResults.style.color = '#ef4444';
        lookupResults.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        lookupResults.innerHTML = `<strong>Error:</strong> Valid API Key required for lookups. Please generate a key in the Admin Panel or purchase a plan.`;
        return;
      }

      // Loading state
      lookupBtn.textContent = 'Searching...';
      lookupBtn.style.opacity = '0.7';
      lookupBtn.disabled = true;
      
      lookupResults.style.display = 'block';
      lookupResults.style.color = '#fff';
      lookupResults.style.borderColor = 'rgba(255,255,255,0.05)';
      lookupResults.innerHTML = `Querying 250+ data sources for <strong>${query}</strong>...`;

      // Real API Fetch
      fetch(`/api/search?q=${encodeURIComponent(query)}&key=${encodeURIComponent(activeKey)}`)
        .then(res => res.json())
        .then(data => {
          lookupBtn.textContent = 'Search →';
          lookupBtn.style.opacity = '1';
          lookupBtn.disabled = false;

          if (data.error) {
            lookupResults.innerHTML = `<div style="color: #ef4444;">${data.error}</div>`;
            return;
          }

          if (!data.results || data.results.length === 0) {
            lookupResults.innerHTML = `<div style="color: rgba(255,255,255,0.5);">No records found for ${query}.</div>`;
            return;
          }

          let html = `<div style="margin-bottom:12px; color: #4ade80;">✓ ${data.results.length} Match(es) Found</div>`;
          
          data.results.forEach((r, idx) => {
            html += `
              <div style="background:rgba(255,255,255,0.02); padding:10px; margin-bottom:8px; border:1px solid rgba(255,255,255,0.05); border-radius:4px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                  <span style="color:rgba(255,255,255,0.4); font-size:11px; text-transform:uppercase;">Source: ${r.file}</span>
                  <button class="add-to-graph-btn" data-idx="${idx}" style="background:transparent; border:1px solid rgba(255,255,255,0.2); color:#ddd; border-radius:4px; font-size:10px; padding:2px 8px; cursor:pointer; transition:all 0.2s;">Add to Graph View</button>
                </div>
                <div style="color:#60a5fa; word-break:break-all;">
                  ${r.match}
                </div>
              </div>
            `;
          });
          lookupResults.innerHTML = html;
          currentSearchData = data.results;
          currentSearchQuery = query;
          addedResultIndices.clear();
          
          initGraph(query);
          
          document.querySelectorAll('.add-to-graph-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
              const idx = parseInt(e.target.dataset.idx);
              addResultToGraph(idx);
              e.target.textContent = 'Added ✓';
              e.target.style.color = '#4ade80';
              e.target.style.borderColor = 'rgba(74,222,128,0.3)';
              e.target.disabled = true;
            });
          });
        })
        .catch(err => {
          lookupBtn.textContent = 'Search →';
          lookupBtn.style.opacity = '1';
          lookupBtn.disabled = false;
          lookupResults.innerHTML = `<div style="color: #ef4444;">Connection error. Please try again.</div>`;
        });
    });
  }

  // --- Graph Visualization Logic ---
  
  const ctxMenu = document.getElementById('node-context-menu');
  let selectedNodeId = null;

  function initGraph(query) {
    if (!window.vis) return;
    
    globalNodes = new vis.DataSet([]);
    globalEdges = new vis.DataSet([]);
    
    // Central Node (The Search Query)
    globalNodes.add({
      id: 'center',
      label: query,
      shape: 'dot',
      size: 25,
      color: { 
        background: '#1e3a8a', 
        border: '#60a5fa',
        highlight: { background: '#2563eb', border: '#93c5fd' },
        hover: { background: '#2563eb', border: '#93c5fd' }
      },
      font: { color: '#fff', face: 'var(--font-mono)', size: 16, bold: true },
      borderWidth: 3,
      shadow: { enabled: true, color: 'rgba(96, 165, 250, 0.8)', size: 25, x: 0, y: 0 }
    });

    const data = { nodes: globalNodes, edges: globalEdges };
    const options = {
      physics: {
        forceAtlas2Based: { 
          gravitationalConstant: -100, 
          centralGravity: 0.005, 
          springLength: 200, 
          springConstant: 0.05,
          damping: 0.8
        },
        maxVelocity: 30,
        solver: 'forceAtlas2Based',
        timestep: 0.35,
        stabilization: { iterations: 150 }
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        zoomView: true,
        dragView: true,
        hoverConnectedEdges: true
      },
      edges: {
        smooth: { type: 'cubicBezier', forceDirection: 'none', roundness: 0.6 },
        color: { 
          color: 'rgba(255,255,255,0.1)', 
          highlight: 'rgba(96, 165, 250, 0.8)', 
          hover: 'rgba(96, 165, 250, 0.5)' 
        },
        width: 1.5,
        selectionWidth: 2.5,
        hoverWidth: 2.5
      }
    };

    if (network) {
      network.destroy();
    }
    network = new vis.Network(graphResults, data, options);

    network.on("oncontext", function (params) {
      params.event.preventDefault();
      const nodeId = this.getNodeAt(params.pointer.DOM);
      if (nodeId) {
        selectedNodeId = nodeId;
        ctxMenu.style.display = 'block';
        ctxMenu.style.left = params.pointer.DOM.x + 'px';
        ctxMenu.style.top = params.pointer.DOM.y + 'px';
      } else {
        ctxMenu.style.display = 'none';
        selectedNodeId = null;
      }
    });

    network.on("click", function () {
      ctxMenu.style.display = 'none';
      selectedNodeId = null;
    });
    
    network.on("doubleClick", function (params) {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const clickedNode = globalNodes.get(nodeId);
        
        // Extract the raw value (e.g., strip "IP: " or "Discord: ")
        let searchTarget = clickedNode.label;
        if (searchTarget.includes(': ')) {
          searchTarget = searchTarget.split(': ').slice(1).join(': ').trim();
        } else if (searchTarget.startsWith('SRC: ')) {
          return; // Don't search database names
        }
        
        if (searchTarget && searchTarget.length > 3) {
          fetchRecursiveSearch(searchTarget, nodeId);
        }
      }
    });
    
    bindContextMenu();
  }
  
  function fetchRecursiveSearch(query, sourceNodeId) {
    if (!activeKey) return;
    
    // Give visual feedback that it's searching
    const originalColor = globalNodes.get(sourceNodeId).color;
    globalNodes.update({ id: sourceNodeId, color: { background: '#f59e0b', border: '#fbbf24' } });
    
    fetch(`/api/search?q=${encodeURIComponent(query)}&key=${encodeURIComponent(activeKey)}`)
      .then(res => res.json())
      .then(data => {
        // Reset color
        globalNodes.update({ id: sourceNodeId, color: originalColor });
        
        if (!data.results || data.results.length === 0) return;
        
        data.results.forEach((r, idx) => {
          const dbNodeId = 'rec_db_' + Date.now() + '_' + idx;
          globalNodes.add({
            id: dbNodeId,
            label: "SRC: " + r.file,
            shape: 'box',
            color: { background: 'rgba(239, 68, 68, 0.1)', border: '#ef4444', hover: { background: 'rgba(239, 68, 68, 0.2)', border: '#f87171' } },
            font: { color: '#fca5a5', size: 11, face: 'var(--font-mono)' },
            borderWidth: 2,
            margin: { top: 8, bottom: 8, left: 12, right: 12 },
            shadow: { enabled: true, color: 'rgba(239, 68, 68, 0.4)', size: 15, x: 0, y: 0 }
          });
          globalEdges.add({ from: sourceNodeId, to: dbNodeId });
          
          const rawLines = r.match.split('<br>').map(l => l.trim()).filter(l => l.length > 0);
          rawLines.forEach((line, lIdx) => {
            const detailNodeId = 'rec_val_' + Date.now() + '_' + idx + '_' + lIdx;
            
            let bgColor = 'rgba(20, 20, 20, 0.9)';
            let borderColor = 'rgba(255,255,255,0.1)';
            let fontColor = '#93c5fd';
            
            const lowerLine = line.toLowerCase();
            if (lowerLine.includes('ip:') || lowerLine.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/)) {
              bgColor = 'rgba(16, 185, 129, 0.1)'; borderColor = '#34d399'; fontColor = '#6ee7b7';
            } else if (lowerLine.includes('email:') || lowerLine.includes('@')) {
              bgColor = 'rgba(245, 158, 11, 0.1)'; borderColor = '#fbbf24'; fontColor = '#fcd34d';
            } else if (lowerLine.includes('discord:')) {
              bgColor = 'rgba(59, 130, 246, 0.1)'; borderColor = '#60a5fa'; fontColor = '#93c5fd';
            }
            
            globalNodes.add({
              id: detailNodeId,
              label: line,
              shape: 'box',
              color: { background: bgColor, border: borderColor, hover: { background: bgColor, border: '#fff' } },
              font: { color: fontColor, size: 12, face: 'var(--font-mono)', align: 'left' },
              borderWidth: 1,
              margin: { top: 10, bottom: 10, left: 14, right: 14 },
              shadow: { enabled: true, color: 'rgba(0, 0, 0, 0.9)', size: 15, x: 0, y: 4 }
            });
            globalEdges.add({ from: dbNodeId, to: detailNodeId });
          });
        });
      })
      .catch(() => {
        globalNodes.update({ id: sourceNodeId, color: originalColor });
      });
  }

  function addResultToGraph(i) {
    if (!globalNodes || !globalEdges || !currentSearchData) return;
    if (addedResultIndices.has(i)) return; 
    addedResultIndices.add(i);
    
    const res = currentSearchData[i];
    const dbNodeId = 'db_' + i;
    
    globalNodes.add({
      id: dbNodeId,
      label: "SRC: " + res.file,
      shape: 'box',
      color: { 
        background: 'rgba(239, 68, 68, 0.1)', 
        border: '#ef4444',
        highlight: { background: 'rgba(239, 68, 68, 0.2)', border: '#f87171' },
        hover: { background: 'rgba(239, 68, 68, 0.2)', border: '#f87171' }
      },
      font: { color: '#fca5a5', size: 11, face: 'var(--font-mono)' },
      borderWidth: 2,
      margin: { top: 8, bottom: 8, left: 12, right: 12 },
      shadow: { enabled: true, color: 'rgba(239, 68, 68, 0.4)', size: 15, x: 0, y: 0 }
    });
    globalEdges.add({ from: 'center', to: dbNodeId });
    
    // Parse the HTML match block into lines
    const rawLines = res.match.split('<br>').map(l => l.trim()).filter(l => l.length > 0);
    
    rawLines.forEach((line, lIdx) => {
      const detailNodeId = 'val_' + i + '_' + lIdx;
      
      let bgColor = 'rgba(20, 20, 20, 0.9)';
      let borderColor = 'rgba(255,255,255,0.1)';
      let fontColor = '#93c5fd';
      
      const lowerLine = line.toLowerCase();
      if (lowerLine.includes('ip:') || lowerLine.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/)) {
        bgColor = 'rgba(16, 185, 129, 0.1)'; borderColor = '#34d399'; fontColor = '#6ee7b7';
      } else if (lowerLine.includes('email:') || lowerLine.includes('@')) {
        bgColor = 'rgba(245, 158, 11, 0.1)'; borderColor = '#fbbf24'; fontColor = '#fcd34d';
      } else if (lowerLine.includes('discord:')) {
        bgColor = 'rgba(59, 130, 246, 0.1)'; borderColor = '#60a5fa'; fontColor = '#93c5fd';
      }
      
      globalNodes.add({
        id: detailNodeId,
        label: line,
        shape: 'box',
        color: { 
          background: bgColor, 
          border: borderColor,
          highlight: { background: bgColor, border: '#fff' },
          hover: { background: bgColor, border: '#fff' }
        },
        font: { color: fontColor, size: 12, face: 'var(--font-mono)', align: 'left' },
        borderWidth: 1,
        margin: { top: 10, bottom: 10, left: 14, right: 14 },
        shadow: { enabled: true, color: 'rgba(0, 0, 0, 0.9)', size: 15, x: 0, y: 4 }
      });
      globalEdges.add({ from: dbNodeId, to: detailNodeId });
    });
  }

  let ctxBound = false;
  function bindContextMenu() {
    if (ctxBound) return;
    ctxBound = true;
    
    // Context Menu Actions
    document.getElementById('ctx-copy').onclick = () => {
      if(selectedNodeId) {
        const n = globalNodes.get(selectedNodeId);
        navigator.clipboard.writeText(n.label);
      }
      ctxMenu.style.display = 'none';
    };
    
    document.getElementById('ctx-duplicate').onclick = () => {
      if(selectedNodeId) {
        const n = globalNodes.get(selectedNodeId);
        const newId = 'dup_' + Date.now();
        globalNodes.add({ ...n, id: newId, x: (n.x||0) + 50, y: (n.y||0) + 50 });
      }
      ctxMenu.style.display = 'none';
    };
    
    document.getElementById('ctx-unlink').onclick = () => {
      if(selectedNodeId) {
        const connectedEdges = network.getConnectedEdges(selectedNodeId);
        globalEdges.remove(connectedEdges);
      }
      ctxMenu.style.display = 'none';
    };
    
    document.getElementById('ctx-delete').onclick = () => {
      if(selectedNodeId) {
        globalNodes.remove(selectedNodeId);
      }
      ctxMenu.style.display = 'none';
    };
    
    document.getElementById('ctx-close').onclick = () => {
      ctxMenu.style.display = 'none';
    };
  }
});
