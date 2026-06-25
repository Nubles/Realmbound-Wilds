import { MapRenderer, BIOME_LABELS } from './renderer.js';
import { generateCell, getCell } from '../simulation/engine.js';

let currentWorld = null;
let historyLog = [];
let renderer = null;

// DOM Elements
const currentYearEl = document.getElementById('current-year');
const climateOffsetEl = document.getElementById('climate-offset');
const globalPopEl = document.getElementById('global-pop');
const factionListEl = document.getElementById('faction-list');
const chronicleBoxEl = document.getElementById('chronicle-box');
const timelineSlider = document.getElementById('timeline-slider');
const sliderYearVal = document.getElementById('slider-year-val');
const statsSparkline = document.getElementById('stats-sparkline');
const inspectorContent = document.getElementById('inspector-content');
const expeditionLink = document.getElementById('expedition-link');

// Set up the Issue expedition link based on the Github Pages host
function setupExpeditionLink() {
  let owner = 'Nubles';
  let repo = 'Realmbound-Wilds';

  // If running on github pages (e.g. owner.github.io/repo)
  if (window.location.hostname.includes('github.io')) {
    owner = window.location.hostname.split('.')[0];
    const pathParts = window.location.pathname.split('/').filter(p => p);
    if (pathParts.length > 0) {
      repo = pathParts[0];
    }
  }

  if (expeditionLink) {
    expeditionLink.href = `https://github.com/${owner}/${repo}/issues/new?template=expedition.yml`;
  }
}

// Fetch World Data
async function loadWorldData() {
  try {
    const response = await fetch('./data/world.json');
    if (!response.ok) throw new Error('Could not fetch world state');
    currentWorld = await response.json();
    return currentWorld;
  } catch (err) {
    console.error('Error loading world state:', err);
    // Display error message
    showErrorState();
    return null;
  }
}

// Fetch History Log
async function loadHistoryLog() {
  try {
    const response = await fetch('./data/history_log.json');
    if (response.ok) {
      historyLog = await response.json();
      setupTimeline();
    }
  } catch (err) {
    console.warn('History log not found, timeline disabled:', err);
  }
}

function showErrorState() {
  if (inspectorContent) {
    inspectorContent.innerHTML = `
      <div class="ruin-box" style="border-color: #ef4444; background: rgba(239, 68, 68, 0.05);">
        <p class="ruin-name" style="color: #ef4444;">Simulation Database Offline</p>
        <p>No world database found. Run a simulation tick in the actions or command line to initialize the world.</p>
      </div>`;
  }
}

// Populate UI components with the world state
function updateUI(world) {
  if (!world) return;

  // Header stats
  currentYearEl.innerText = `Year ${world.year}`;
  
  const tempOffset = world.globalTempOffset;
  const tempSign = tempOffset >= 0 ? '+' : '';
  climateOffsetEl.innerText = `${tempSign}${Math.round(tempOffset * 100)}% Dev`;
  climateOffsetEl.style.color = tempOffset >= 0 ? '#ef4444' : '#60a5fa';

  let totalPop = 0;
  const resourceCounts = {};
  Object.keys(world.modifiedCells).forEach(key => {
    const cell = world.modifiedCells[key];
    if (cell.settlement) {
      totalPop += cell.settlement.size;
    }
    if (cell.resources && cell.resources.length > 0) {
      cell.resources.forEach(r => {
        resourceCounts[r] = (resourceCounts[r] || 0) + 1;
      });
    }
  });
  globalPopEl.innerText = totalPop.toLocaleString();

  // Populate global resources element
  const globalResEl = document.getElementById('global-resources');
  if (globalResEl) {
    const resList = Object.keys(resourceCounts);
    if (resList.length === 0) {
      globalResEl.innerText = 'None Detected';
    } else {
      globalResEl.innerText = resList.map(r => `${r} (${resourceCounts[r]})`).join(', ');
      globalResEl.title = resList.map(r => `${r}: ${resourceCounts[r]} sectors`).join('\n');
    }
  }

  // Factions list
  factionListEl.innerHTML = '';
  if (world.factions.length === 0) {
    factionListEl.innerHTML = '<div class="placeholder-text">No factions have formed yet.</div>';
  } else {
    // Sort factions by power descending
    const sortedFactions = [...world.factions].sort((a, b) => b.power - a.power);
    sortedFactions.forEach(faction => {
      const activeSettlements = faction.settlements.filter(s => {
        const cell = getCell(world, s.realm || 'overworld', s.x, s.y);
        return cell.settlement && cell.settlement.faction === faction.name;
      });

      const factionItem = document.createElement('div');
      factionItem.className = 'faction-item';
      
      const techNames = faction.technologies && faction.technologies.length > 0 ? faction.technologies.join(', ') : 'None';
      const woodCount = faction.resources ? (faction.resources.timber || faction.resources.wood || 0) : 0;
      const goldCount = faction.resources ? (faction.resources.gold || 0) : 0;
      const ironCount = faction.resources ? (faction.resources.iron || 0) : 0;

      factionItem.innerHTML = `
        <div class="faction-header">
          <span class="faction-name">
            <span class="faction-color-dot" style="background-color: ${faction.color}"></span>
            ${faction.name}
          </span>
          <span class="faction-power">Power: ${faction.power}</span>
        </div>
        <div class="faction-stats">
          <span>Cities: ${activeSettlements.length}</span>
          <span>Stockpile: 💰${goldCount} 🪵${woodCount} 🪙${ironCount}</span>
        </div>
        <div style="font-size: 0.72rem; color: var(--gold); margin-top: 2px; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;" title="Unlocked: ${techNames}">
          🎓 Tech: ${techNames}
        </div>
      `;
      factionListEl.appendChild(factionItem);
    });
  }

  // Chronicle list
  chronicleBoxEl.innerHTML = '';
  if (world.chronicle.length === 0) {
    chronicleBoxEl.innerHTML = '<div class="placeholder-text">The scrolls are currently blank.</div>';
  } else {
    // Show chronicle logs in reverse (latest first)
    const reversedChronicle = [...world.chronicle].reverse();
    reversedChronicle.forEach(log => {
      const entry = document.createElement('div');
      entry.className = 'chronicle-entry';
      entry.innerText = log;
      chronicleBoxEl.appendChild(entry);
    });
  }

  // Update selection/inspect details if a cell is selected
  if (renderer && renderer.selectedCell) {
    let refreshedCell;
    if (renderer.historicalState) {
      refreshedCell = renderer.getReconstructedCell(renderer.selectedCell.x, renderer.selectedCell.y);
    } else {
      refreshedCell = getCell(world, renderer.selectedCell.realm || 'overworld', renderer.selectedCell.x, renderer.selectedCell.y);
    }
    inspectCell(refreshedCell);
  }
}

// Sidebar Detail Inspector
function inspectCell(cell) {
  if (!cell) {
    inspectorContent.innerHTML = `<div class="placeholder-text">Click any tile on the map to inspect its terrain, wildlife, settlements, and history.</div>`;
    return;
  }

  // Handle undiscovered Fog of War tiles
  if (cell.undiscovered) {
    inspectorContent.innerHTML = `
      <div class="inspector-section">
        <span class="inspector-subtitle">Coordinates</span>
        <span class="inspector-val">[${cell.x}, ${cell.y}]</span>
      </div>
      <div class="ruin-box" style="border-color: rgba(255, 255, 255, 0.15); background: rgba(0, 0, 0, 0.4); margin-top: 10px;">
        <p class="ruin-name" style="color: var(--text-secondary);">🌫️ Undiscovered Territory</p>
        <p style="font-size: 0.8rem; line-height: 1.4; color: var(--text-secondary);">This sector of <strong>${cell.realm.toUpperCase()}</strong> has not been discovered yet. Faction borders or a player expedition must target these coordinates to reveal the fog of war!</p>
      </div>
    `;
    return;
  }

  let wildlifeDesc = 'None';
  if (cell.wildlife && cell.wildlife.length > 0) {
    wildlifeDesc = cell.wildlife.map(w => {
      if (w.species === 'legendary_beast') return `🐲 **${w.name}** (1)`;
      const icon = w.species === 'deer' ? '🦌' : (w.species === 'elk' ? '🦌' : (w.species === 'wolf' ? '🐺' : '🐻'));
      return `${icon} ${w.species} (${w.count})`;
    }).join(', ');
  }

  let resourcesDesc = 'None';
  if (cell.resources && cell.resources.length > 0) {
    resourcesDesc = cell.resources.map(r => `<span class="resource-tag">${r}</span>`).join(' ');
  }

  let settlementHtml = '';
  if (cell.settlement) {
    settlementHtml = `
      <div class="inspector-section">
        <span class="inspector-subtitle">🏘️ Settlement</span>
        <span class="inspector-val" style="font-size: 1.1rem; color: var(--gold);">${cell.settlement.name}</span>
        <span class="inspector-val">Faction: ${cell.settlement.faction}</span>
        <span class="inspector-val">Population: ${cell.settlement.size.toLocaleString()} (${cell.settlement.type})</span>
      </div>
    `;
  }

  let ruinHtml = '';
  if (cell.ruin) {
    if (cell.ruin.portalTarget) {
      // Draw interactive portal teleportation link
      ruinHtml = `
        <div class="inspector-section">
          <div class="ruin-box" style="border-color: #8b5cf6; background: rgba(139, 92, 246, 0.05);">
            <p class="ruin-name" style="color: #a78bfa;">🌀 Dimensional Portal</p>
            <p style="font-size: 0.8rem; line-height: 1.3;">${cell.ruin.description}</p>
            <button onclick="window.teleportTo('${cell.ruin.portalTarget.realm}', ${cell.ruin.portalTarget.x}, ${cell.ruin.portalTarget.y})" class="btn btn-primary" style="margin-top: 8px; padding: 4px 10px; font-size: 0.8rem; font-family: var(--font-sans);">Enter Portal</button>
          </div>
        </div>
      `;
    } else {
      ruinHtml = `
        <div class="inspector-section">
          <div class="ruin-box">
            <p class="ruin-name">🏛️ ${cell.ruin.name}</p>
            <p style="font-size: 0.8rem; line-height: 1.3;">${cell.ruin.description}</p>
            <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 6px;">Discovered/Created: Year ${cell.ruin.age}</p>
          </div>
        </div>
      `;
    }
  }

  let localHistoryHtml = '';
  if (cell.history && cell.history.length > 0) {
    localHistoryHtml = `
      <div class="inspector-section">
        <span class="inspector-subtitle">🗒️ Local Chronicle</span>
        <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem; color: var(--text-secondary);">
          ${cell.history.map(h => `<div>${h}</div>`).join('')}
        </div>
      </div>
    `;
  }

  let wildfireHtml = '';
  if (cell.fireTicksLeft > 0) {
    wildfireHtml = `
      <div class="ruin-box" style="border-color: #ef4444; background: rgba(239, 68, 68, 0.05); margin-bottom: 10px;">
        <p class="ruin-name" style="color: #ef4444;">🔥 Wildfire Active</p>
        <p>This cell is burning. Forests and structures are taking heavy damage! (${cell.fireTicksLeft} years remaining)</p>
      </div>
    `;
  }

  inspectorContent.innerHTML = `
    <div class="inspector-section" style="display: flex; flex-direction: row; justify-content: space-between; align-items: center;">
      <div>
        <span class="inspector-subtitle">Coordinates</span>
        <span class="inspector-val">[${cell.x}, ${cell.y}]</span>
      </div>
      <button onclick="window.zoomToCell(${cell.x}, ${cell.y})" class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.75rem; border-color: var(--gold-glow); display: inline-flex; align-items: center; gap: 4px;" title="Zoom in to see detailed micro-structures">🔍 Detailed View</button>
    </div>
    
    <div class="inspector-section">
      <span class="inspector-subtitle">Terrain Biome</span>
      <span class="inspector-val" style="color: var(--gold);">${BIOME_LABELS[cell.biome] || cell.biome}</span>
      <div style="font-size: 0.8rem; color: var(--text-secondary); display: flex; justify-content: space-between;">
        <span>Elevation: ${Math.round(cell.elevation * 100)}%</span>
        <span>Temp: ${Math.round(cell.temperature * 100)}%</span>
      </div>
    </div>

    ${wildfireHtml}
    ${settlementHtml}
    ${ruinHtml}

    <div class="inspector-section">
      <span class="inspector-subtitle">Flora & Fauna</span>
      <div>Vegetation density: ${Math.round(cell.vegetation * 100)}%</div>
      <div>Wildlife: ${wildlifeDesc}</div>
    </div>

    <div class="inspector-section">
      <span class="inspector-subtitle">Resources</span>
      <div>${resourcesDesc}</div>
    </div>

    ${localHistoryHtml}
  `;
}

// Setup Timeline Slider & Sparklines (SVG Chart)
function setupTimeline() {
  if (historyLog.length === 0) return;

  const minYear = historyLog[0].year;
  const maxYear = historyLog[historyLog.length - 1].year;

  timelineSlider.min = minYear;
  timelineSlider.max = maxYear;
  timelineSlider.value = maxYear;
  timelineSlider.disabled = false;
  sliderYearVal.innerText = `Year ${maxYear}`;

  // Build SVG multi-line charts
  statsSparkline.innerHTML = '';
  
  let svgContent = `<svg viewBox="0 0 500 48" width="100%" height="100%" preserveAspectRatio="none" style="overflow: visible; display: block;">`;
  
  const factionNames = ["Valoria", "Oakhaven", "Ironclad", "Sunspire", "Players"];
  const factionColors = ["#3b82f6", "#10b981", "#6b7280", "#f59e0b", "#ef4444"];
  
  // Plot each faction power line
  factionNames.forEach((facName, facIdx) => {
    const points = [];
    let maxVal = 100;
    
    historyLog.forEach(hist => {
      const pVal = hist.factions[facName] || 0;
      if (pVal > maxVal) maxVal = pVal;
    });
    
    historyLog.forEach((hist, index) => {
      const x = (index / (historyLog.length - 1)) * 500;
      const pVal = hist.factions[facName] || 0;
      const y = 48 - (pVal / maxVal) * 40 - 2; // scale y
      points.push(`${x},${y}`);
    });
    
    if (points.length > 1) {
      svgContent += `<polyline fill="none" stroke="${factionColors[facIdx]}" stroke-width="1.5" points="${points.join(' ')}" style="vector-effect: non-scaling-stroke; stroke-linecap: round;" />`;
    }
  });

  // Plot world population line
  const popPoints = [];
  const maxPop = Math.max(...historyLog.map(h => h.stats.population), 100);
  historyLog.forEach((hist, index) => {
    const x = (index / (historyLog.length - 1)) * 500;
    const y = 48 - (hist.stats.population / maxPop) * 38 - 3;
    popPoints.push(`${x},${y}`);
  });
  if (popPoints.length > 1) {
    svgContent += `<polyline fill="none" stroke="#dfb15b" stroke-dasharray="3,3" stroke-width="1.5" points="${popPoints.join(' ')}" style="vector-effect: non-scaling-stroke;" />`;
  }

  svgContent += `</svg>`;
  statsSparkline.innerHTML = svgContent;
}

// Time-travel action
async function onTimelineTravel(year) {
  sliderYearVal.innerText = `Year ${year}`;

  const index = historyLog.findIndex(h => h.year === parseInt(year, 10));
  if (index === -1) return;

  // If traveling back in time, we load the compressed grid snapshot
  if (currentWorld && parseInt(year, 10) === currentWorld.year) {
    updateUI(currentWorld);
    renderer.setWorld(currentWorld);
  } else {
    const histState = historyLog[index];
    if (histState) {
      currentYearEl.innerText = `Year ${histState.year} (Historical)`;
      
      const tempOffset = histState.globalTempOffset;
      const tempSign = tempOffset >= 0 ? '+' : '';
      climateOffsetEl.innerText = `${tempSign}${Math.round(tempOffset * 100)}% Dev`;
      climateOffsetEl.style.color = tempOffset >= 0 ? '#ef4444' : '#60a5fa';
      
      globalPopEl.innerText = histState.stats.population.toLocaleString();

      // Show faction power breakdown at that time
      factionListEl.innerHTML = '';
      
      const factionNames = ["Valoria", "Oakhaven", "Ironclad", "Sunspire", "Players"];
      const factionColors = ["#3b82f6", "#10b981", "#6b7280", "#f59e0b", "#ef4444"];
      
      factionNames.forEach((name, facIdx) => {
        const power = histState.factions[name] || 0;
        const color = factionColors[facIdx];
        
        const factionItem = document.createElement('div');
        factionItem.className = 'faction-item';
        factionItem.innerHTML = `
          <div class="faction-header">
            <span class="faction-name">
              <span class="faction-color-dot" style="background-color: ${color}"></span>
              ${name}
            </span>
            <span class="faction-power">Power: ${power}</span>
          </div>
        `;
        factionListEl.appendChild(factionItem);
      });

      // Show event logs at that time
      chronicleBoxEl.innerHTML = '';
      [...histState.events].reverse().forEach(evt => {
        const entry = document.createElement('div');
        entry.className = 'chronicle-entry';
        entry.innerText = evt;
        chronicleBoxEl.appendChild(entry);
      });

      // Trigger map updates with historical state
      renderer.setHistoricalState(histState);
    }
  }
}

// Initialize Application
async function init() {
  setupExpeditionLink();
  
  const canvas = document.getElementById('world-map');
  renderer = new MapRenderer(canvas);

  // Keyboard navigation listeners (WASD / Arrows to pan, +/- to zoom)
  window.addEventListener('keydown', (e) => {
    const step = 25 / renderer.zoom;
    let keyHandled = false;
    
    switch (e.key.toLowerCase()) {
      case 'w':
      case 'arrowup':
        renderer.targetPanY += step;
        keyHandled = true;
        break;
      case 's':
      case 'arrowdown':
        renderer.targetPanY -= step;
        keyHandled = true;
        break;
      case 'a':
      case 'arrowleft':
        renderer.targetPanX += step;
        keyHandled = true;
        break;
      case 'd':
      case 'arrowright':
        renderer.targetPanX -= step;
        keyHandled = true;
        break;
      case '+':
      case '=':
        renderer.zoomIn();
        keyHandled = true;
        break;
      case '-':
      case '_':
        renderer.zoomOut();
        keyHandled = true;
        break;
    }
    
    if (keyHandled) {
      e.preventDefault();
    }
  });

  // Modal Help / Chronicle Guide Toggle
  const helpBtn = document.getElementById('help-btn');
  const helpModal = document.getElementById('help-modal');
  const closeHelpBtn = document.getElementById('close-help-btn');

  if (helpBtn && helpModal && closeHelpBtn) {
    helpBtn.addEventListener('click', () => {
      helpModal.classList.remove('hidden');
      if (window.synth) window.synth.playClick();
    });
    closeHelpBtn.addEventListener('click', () => {
      helpModal.classList.add('hidden');
      if (window.synth) window.synth.playClick();
    });
    // Close modal if user clicks outside content card
    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) {
        helpModal.classList.add('hidden');
      }
    });
  }

  // Sound Mute Toggle
  const soundToggle = document.getElementById('sound-toggle');
  if (soundToggle) {
    soundToggle.addEventListener('click', () => {
      if (window.synth) {
        window.synth.muted = !window.synth.muted;
        soundToggle.innerText = window.synth.muted ? '🔇' : '🔊';
        if (!window.synth.muted) {
          window.synth.playClick();
        }
      }
    });
  }

  // Bind active Realm dropdown
  const realmSelector = document.getElementById('realm-selector');
  realmSelector.addEventListener('change', (e) => {
    renderer.setRealm(e.target.value);
    if (window.synth) {
      window.synth.playPortalTravel();
    }
  });

  // Global zoom to micro-detail helper
  window.zoomToCell = (x, y) => {
    renderer.targetZoom = 3.0;
    renderer.targetPanX = renderer.canvas.width / 2 - x * renderer.tileSize * 3.0 - (renderer.tileSize * 3.0) / 2;
    renderer.targetPanY = renderer.canvas.height / 2 - y * renderer.tileSize * 3.0 - (renderer.tileSize * 3.0) / 2;
    
    if (window.synth) {
      window.synth.playClick();
    }
  };

  // Global portal travel teleportation function
  window.teleportTo = (realm, x, y) => {
    realmSelector.value = realm;
    renderer.setRealm(realm);
    
    if (window.synth) {
      window.synth.playPortalTravel();
    }
    
    // Pan camera to target coordinates smoothly using targetPan parameters
    renderer.targetPanX = renderer.canvas.width / 2 - x * renderer.tileSize * renderer.targetZoom;
    renderer.targetPanY = renderer.canvas.height / 2 - y * renderer.tileSize * renderer.targetZoom;
    
    // Auto inspect
    const key = `${realm}:${x},${y}`;
    let cell;
    if (renderer.historicalState) {
      cell = renderer.getReconstructedCell(x, y);
    } else if (currentWorld) {
      if (currentWorld.modifiedCells[key]) cell = currentWorld.modifiedCells[key];
      else cell = generateCell(x, y, realm, currentWorld.seed);
    }
    
    renderer.selectedCell = cell;
    inspectCell(cell);
  };

  // Set callback for cell inspection
  renderer.onSelectCell = (cell) => {
    inspectCell(cell);
  };

  // View Mode toggles
  const toggleButtons = document.querySelectorAll('.toggle-btn');
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const mode = btn.id.replace('view-', '');
      renderer.setViewMode(mode);
      if (window.synth) window.synth.playClick();
    });
  });

  // Map Navigation zoom binds
  document.getElementById('zoom-in').addEventListener('click', () => {
    renderer.zoomIn();
    if (window.synth) window.synth.playClick();
  });
  document.getElementById('zoom-out').addEventListener('click', () => {
    renderer.zoomOut();
    if (window.synth) window.synth.playClick();
  });
  document.getElementById('reset-view').addEventListener('click', () => {
    renderer.resetView();
    if (window.synth) window.synth.playClick();
  });

  // Slider change binds
  timelineSlider.addEventListener('input', (e) => {
    onTimelineTravel(e.target.value);
  });

  // Load latest world state
  const world = await loadWorldData();
  if (world) {
    renderer.setWorld(world);
    updateUI(world);
    
    // Load historical sparklines
    await loadHistoryLog();
  }

  // Handle window resizing
  window.addEventListener('resize', () => renderer.resize());
}

document.addEventListener('DOMContentLoaded', init);
