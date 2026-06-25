import { MapRenderer, BIOME_LABELS } from './renderer.js';

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
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      if (world.grid[y][x].settlement) {
        totalPop += world.grid[y][x].settlement.size;
      }
    }
  }
  globalPopEl.innerText = totalPop.toLocaleString();

  // Factions list
  factionListEl.innerHTML = '';
  if (world.factions.length === 0) {
    factionListEl.innerHTML = '<div class="placeholder-text">No factions have formed yet.</div>';
  } else {
    // Sort factions by power descending
    const sortedFactions = [...world.factions].sort((a, b) => b.power - a.power);
    sortedFactions.forEach(faction => {
      const activeSettlements = faction.settlements.filter(s => {
        const cell = world.grid[s.y][s.x];
        return cell.settlement && cell.settlement.faction === faction.name;
      });

      const factionItem = document.createElement('div');
      factionItem.className = 'faction-item';
      factionItem.innerHTML = `
        <div class="faction-header">
          <span class="faction-name">
            <span class="faction-color-dot" style="background-color: ${faction.color}"></span>
            ${faction.name}
          </span>
          <span class="faction-power">Power: ${faction.power}</span>
        </div>
        <div class="faction-stats">
          <span>Settlements: ${activeSettlements.length}</span>
          <span>Status: ${JSON.stringify(faction.status) === '{}' ? 'Isolation' : 'Active'}</span>
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
    // Sync selected cell with the fresh coordinates from database
    const refreshedCell = world.grid[renderer.selectedCell.y][renderer.selectedCell.x];
    inspectCell(refreshedCell);
  }
}

// Sidebar Detail Inspector
function inspectCell(cell) {
  if (!cell) {
    inspectorContent.innerHTML = `<div class="placeholder-text">Click any tile on the map to inspect its terrain, wildlife, settlements, and history.</div>`;
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
    <div class="inspector-section">
      <span class="inspector-subtitle">Coordinates</span>
      <span class="inspector-val">[${cell.x}, ${cell.y}]</span>
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

// Setup Timeline Slider & Sparklines
function setupTimeline() {
  if (historyLog.length === 0) return;

  const minYear = historyLog[0].year;
  const maxYear = historyLog[historyLog.length - 1].year;

  timelineSlider.min = minYear;
  timelineSlider.max = maxYear;
  timelineSlider.value = maxYear;
  timelineSlider.disabled = false;
  sliderYearVal.innerText = `Year ${maxYear}`;

  // Build sparkline chart
  statsSparkline.innerHTML = '';
  const maxPop = Math.max(...historyLog.map(h => h.stats.population), 10);
  
  historyLog.forEach((hist, idx) => {
    const bar = document.createElement('div');
    bar.className = `sparkline-bar ${idx === historyLog.length - 1 ? 'active' : ''}`;
    // height between 10% and 100%
    const h = 10 + (hist.stats.population / maxPop) * 90;
    bar.style.height = `${h}%`;
    bar.title = `Year ${hist.year} | World Pop: ${hist.stats.population.toLocaleString()}`;
    
    // Allow clicking the sparkline bar to travel to that year
    bar.addEventListener('click', () => {
      timelineSlider.value = hist.year;
      onTimelineTravel(hist.year);
    });

    statsSparkline.appendChild(bar);
  });
}

// Time-travel action
async function onTimelineTravel(year) {
  sliderYearVal.innerText = `Year ${year}`;

  // Highlight corresponding sparkline bar
  const bars = statsSparkline.querySelectorAll('.sparkline-bar');
  const index = historyLog.findIndex(h => h.year === parseInt(year, 10));
  bars.forEach((bar, idx) => {
    if (idx === index) bar.classList.add('active');
    else bar.classList.remove('active');
  });

  // If traveling back in time, we fetch the world representation at that specific git commit
  // or we display a static message since grid states are not preserved in the light history log,
  // OR we can reconstruct a simple/compact version of the world state for statistics and show historical events!
  // Wait, if it is the current year, load the current world. If it's a past year, show the stats.
  if (currentWorld && year === currentWorld.year) {
    updateUI(currentWorld);
    renderer.setWorld(currentWorld);
  } else {
    // Fetch historical events for display in chronicle
    const histState = historyLog[index];
    if (histState) {
      currentYearEl.innerText = `Year ${histState.year} (Historical)`;
      
      const tempOffset = histState.globalTempOffset;
      const tempSign = tempOffset >= 0 ? '+' : '';
      climateOffsetEl.innerText = `${tempSign}${Math.round(tempOffset * 100)}% Dev`;
      
      globalPopEl.innerText = histState.stats.population.toLocaleString();

      // Show faction power breakdown at that time
      factionListEl.innerHTML = '';
      Object.entries(histState.factions).forEach(([name, power]) => {
        const factionItem = document.createElement('div');
        factionItem.className = 'faction-item';
        factionItem.innerHTML = `
          <div class="faction-header">
            <span class="faction-name">${name}</span>
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
    }
  }
}

// Initialize Application
async function init() {
  setupExpeditionLink();
  
  const canvas = document.getElementById('world-map');
  renderer = new MapRenderer(canvas);

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
    });
  });

  // Map Navigation zoom binds
  document.getElementById('zoom-in').addEventListener('click', () => renderer.zoomIn());
  document.getElementById('zoom-out').addEventListener('click', () => renderer.zoomOut());
  document.getElementById('reset-view').addEventListener('click', () => renderer.resetView());

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
