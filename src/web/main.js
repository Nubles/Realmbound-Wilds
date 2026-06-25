import { MapRenderer, BIOME_LABELS } from './renderer.js';
import { generateCell, getCell } from '../simulation/engine.js';

let currentWorld = null;
let historyLog = [];
let renderer = null;
let chronicleFilter = 'all';
let chronicleSearchQuery = '';
let playerResearchPoints = 40;

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
  
  const currentSeasonEl = document.getElementById('current-season');
  if (currentSeasonEl) {
    const seasonEmojis = { Spring: '🌸', Summer: '☀️', Autumn: '🍂', Winter: '❄\uFE0F' };
    const season = world.season || 'Spring';
    currentSeasonEl.innerText = `${seasonEmojis[season] || '🌸'} ${season}`;
  }

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
    const reversedChronicle = [...world.chronicle].reverse();
    const filtered = reversedChronicle.filter(log => {
      if (chronicleSearchQuery && !log.toLowerCase().includes(chronicleSearchQuery.toLowerCase())) {
        return false;
      }
      if (chronicleFilter === 'war') return log.includes('[War]') || log.includes('slain') || log.includes('declared war') || log.includes('SIEGE') || log.includes('RAMPAGE');
      if (chronicleFilter === 'trade') return log.includes('TRADE') || log.includes('MARKET') || log.includes('Trade') || log.includes('trade');
      if (chronicleFilter === 'tech') return log.includes('RESEARCH') || log.includes('UPGRADE') || log.includes('unlocked technology') || log.includes('Research');
      if (chronicleFilter === 'disaster') return log.includes('Disaster') || log.includes('IMPACT') || log.includes('STRIKE') || log.includes('SIGHTING') || log.includes('Crisis') || log.includes('METEOR');
      return true;
    });

    if (filtered.length === 0) {
      chronicleBoxEl.innerHTML = '<div class="placeholder-text">No matching chronicles found.</div>';
    } else {
      filtered.forEach(log => {
        const entry = document.createElement('div');
        entry.className = 'chronicle-entry';
        entry.innerText = log;
        chronicleBoxEl.appendChild(entry);
      });
    }
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
    const isPlayerFaction = cell.settlement.faction === 'Players' || cell.settlement.faction === 'Valoria';
    
    let plagueStatusText = '';
    if (cell.settlement.plagued) {
      plagueStatusText = `<div style="color: #22c55e; font-weight: bold; font-size: 0.8rem; margin-top: 4px;">🤢 Outbreak: Plague Active!</div>`;
    }
    
    let structureList = [];
    if (cell.settlement.apothecary) structureList.push('🏥 Apothecary');
    if (cell.settlement.wonderBlueprint) {
      const bp = cell.settlement.wonderBlueprint;
      structureList.push(`🏛️ Wonder (${bp.progress}% Built)`);
    }
    const structuresDesc = structureList.length > 0 ? `<div style="font-size: 0.8rem; color: var(--gold); margin-top: 4px;">Structures: ${structureList.join(', ')}</div>` : '';

    let buildControlsHtml = '';
    if (isPlayerFaction && !renderer.historicalState) {
      const factionObj = currentWorld.factions.find(f => f.name === cell.settlement.faction);
      const gold = factionObj ? (factionObj.resources.gold || 0) : 0;
      const wood = factionObj ? (factionObj.resources.wood || factionObj.resources.timber || 0) : 0;
      const iron = factionObj ? (factionObj.resources.iron || 0) : 0;

      buildControlsHtml = `
        <div style="margin-top: 8px; border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 8px; display: flex; flex-direction: column; gap: 6px;">
          <div style="font-size: 0.72rem; color: var(--text-secondary);">Build Infrastructure:</div>
          <div style="display: flex; gap: 6px;">
            <button onclick="window.buildApothecary('${cell.realm}', ${cell.x}, ${cell.y})" class="btn btn-secondary" style="padding: 3px 6px; font-size: 0.7rem;" ${cell.settlement.apothecary ? 'disabled' : ''}>🏥 Apothecary (💰30, 🪵10)</button>
            <button onclick="window.buildWonderBlueprint('${cell.realm}', ${cell.x}, ${cell.y})" class="btn btn-secondary" style="padding: 3px 6px; font-size: 0.7rem;" ${cell.settlement.wonderBlueprint ? 'disabled' : ''}>🏛️ Wonder BP (💰100, 🪵50, 🪙10)</button>
          </div>
        </div>
      `;
    }

    settlementHtml = `
      <div class="inspector-section">
        <span class="inspector-subtitle">🏘️ Settlement</span>
        <span class="inspector-val" style="font-size: 1.1rem; color: var(--gold);">${cell.settlement.name}</span>
        <span class="inspector-val">Faction: ${cell.settlement.faction}</span>
        <span class="inspector-val">Population: ${cell.settlement.size.toLocaleString()} (${cell.settlement.type})</span>
        ${plagueStatusText}
        ${structuresDesc}
        ${buildControlsHtml}
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

    <div class="inspector-section">
      <span class="inspector-subtitle">👤 Local Citizens (${cell.realm.toUpperCase()})</span>
      <div id="local-citizens-list" style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px;">
        <!-- Citizens will be populated dynamically from renderer -->
      </div>
    </div>

    ${localHistoryHtml}
  `;

  // Dynamically populate local citizens present at these coordinates
  const listEl = document.getElementById('local-citizens-list');
  if (listEl && window.renderer && window.renderer.entities) {
    const present = window.renderer.entities.filter(ent => {
      if (ent.type !== 'citizen' && ent.type !== 'leader') return false;
      // Convert canvas coordinate space back to chunk units
      const cx = Math.floor(ent.x / window.renderer.tileSize);
      const cy = Math.floor(ent.y / window.renderer.tileSize);
      return cx === cell.x && cy === cell.y;
    });

    if (present.length === 0) {
      listEl.innerHTML = '<div style="font-style: italic; color: var(--text-secondary); font-size: 0.8rem;">No citizens present in this sector.</div>';
    } else {
      listEl.innerHTML = '';
      present.forEach(p => {
        const item = document.createElement('div');
        item.style.background = 'rgba(255, 255, 255, 0.03)';
        item.style.border = '1px solid rgba(255, 255, 255, 0.05)';
        item.style.borderRadius = '6px';
        item.style.padding = '6px 8px';
        item.style.fontSize = '0.78rem';
        
        const cargoList = Object.keys(p.cargo || {}).map(k => `${k}(${p.cargo[k]})`).join(', ');
        
        const milestonesHtml = p.history && p.history.length > 0
          ? `<details style="margin-top: 6px; font-size: 0.7rem; color: var(--text-secondary); cursor: pointer;"><summary>🗒️ View Life Diary</summary><div style="display: flex; flex-direction: column; gap: 2px; margin-top: 4px; padding-left: 6px; border-left: 1px solid rgba(255,255,255,0.1);">${p.history.map(h => `<div>• ${h}</div>`).join('')}</div></details>`
          : '';
          
        const controlsHtml = p.type === 'citizen' ? `
          <div style="margin-top: 6px; display: flex; align-items: center; justify-content: space-between; gap: 6px; border-top: 1px dashed rgba(255,255,255,0.05); padding-top: 6px;">
            <select onchange="window.reassignRole('${p.id}', this.value)" style="background: #111; color: var(--gold); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; font-size: 0.7rem; padding: 2px 4px; cursor: pointer;">
              <option value="Gatherer" ${p.role === 'Gatherer' ? 'selected' : ''}>Gatherer</option>
              <option value="Miner" ${p.role === 'Miner' ? 'selected' : ''}>Miner</option>
              <option value="Builder" ${p.role === 'Builder' ? 'selected' : ''}>Builder</option>
              <option value="Scout" ${p.role === 'Scout' ? 'selected' : ''}>Scout</option>
              <option value="Soldier" ${p.role === 'Soldier' ? 'selected' : ''}>Soldier</option>
            </select>
            <button onclick="window.orderMove('${p.id}')" style="background: rgba(255, 255, 255, 0.05); color: var(--gold); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; font-size: 0.7rem; padding: 2px 6px; cursor: pointer;" title="Direct citizen to walk to selected coordinates">📍 Move Here</button>
          </div>
        ` : '';

        const plagueBadge = p.plagued ? `<span style="background: #22c55e; color: #fff; padding: 1px 4px; border-radius: 3px; font-size: 0.65rem; margin-left: 6px;">🤢 Sick</span>` : '';
        const eqEmoji = p.equipped === 'Sword' ? '⚔️' : (p.equipped === 'Pickaxe' ? '⛏️' : (p.equipped === 'Axe' ? '🪓' : ''));
        const equippedLabel = p.equipped ? `<span style="color: var(--gold); margin-left: 6px;">${eqEmoji} ${p.equipped}</span>` : '';

        item.innerHTML = `
          <div style="display: flex; justify-content: space-between; font-weight: 600;">
            <span style="color: var(--gold);">${p.emoji} ${p.name} ${plagueBadge}</span>
            <span style="font-size: 0.72rem; color: var(--text-secondary);">${p.role}</span>
          </div>
          <div style="margin-top: 4px; font-size: 0.72rem; color: var(--text-secondary); display: flex; justify-content: space-between;">
            <span>HP: <strong>${p.health || 100}</strong></span>
            <span>Age: <strong>${p.age || 18}</strong> (Gen ${p.generation || 1})</span>
          </div>
          <div style="margin-top: 4px; display: flex; justify-content: space-between;">
            <span>Task: <strong>${p.task || 'Patrolling'}</strong> ${equippedLabel}</span>
            <span style="color: ${p.hunger >= 50 ? '#ef4444' : 'var(--text-secondary)'}">Hunger: ${p.hunger}%</span>
          </div>
          ${cargoList ? `<div style="margin-top: 4px; font-size: 0.72rem; color: #60a5fa; border-top: 1px dashed rgba(255,255,255,0.05); padding-top: 4px;">🎒 Cargo: ${cargoList}</div>` : ''}
          ${milestonesHtml}
          ${controlsHtml}
        `;
        listEl.appendChild(item);
      });
    }
  }
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
      
      const currentSeasonEl = document.getElementById('current-season');
      if (currentSeasonEl) {
        const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
        const season = seasons[histState.year % 4] || 'Spring';
        const seasonEmojis = { Spring: '🌸', Summer: '☀️', Autumn: '🍂', Winter: '❄\uFE0F' };
        currentSeasonEl.innerText = `${seasonEmojis[season] || '🌸'} ${season} (Hist)`;
      }
      
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

  // Music Mute Toggle
  const musicToggle = document.getElementById('music-toggle');
  if (musicToggle) {
    musicToggle.addEventListener('click', () => {
      if (window.synth) {
        window.synth.musicMuted = !window.synth.musicMuted;
        musicToggle.innerText = window.synth.musicMuted ? '🔇' : '🎵';
        if (!window.synth.musicMuted) {
          window.synth.startAmbientMusic(renderer ? renderer.activeRealm : 'overworld');
        } else {
          window.synth.stopAmbientMusic();
        }
      }
    });
  }

  // Tech Tree Modal Toggle
  const techBtn = document.getElementById('tech-btn');
  const techModal = document.getElementById('tech-modal');
  const closeTechBtn = document.getElementById('close-tech-btn');

  if (techBtn && techModal && closeTechBtn) {
    techBtn.addEventListener('click', () => {
      techModal.classList.remove('hidden');
      window.renderTechTree();
      if (window.synth) window.synth.playClick();
    });
    closeTechBtn.addEventListener('click', () => {
      techModal.classList.add('hidden');
      if (window.synth) window.synth.playClick();
    });
    techModal.addEventListener('click', (e) => {
      if (e.target === techModal) {
        techModal.classList.add('hidden');
      }
    });
  }

  // Diplomacy Modal Toggle
  const diplomacyBtn = document.getElementById('diplomacy-btn');
  const diplomacyModal = document.getElementById('diplomacy-modal');
  const closeDiplomacyBtn = document.getElementById('close-diplomacy-btn');

  if (diplomacyBtn && diplomacyModal && closeDiplomacyBtn) {
    diplomacyBtn.addEventListener('click', () => {
      diplomacyModal.classList.remove('hidden');
      window.renderDiplomacyRelations();
      if (window.synth) window.synth.playClick();
    });
    closeDiplomacyBtn.addEventListener('click', () => {
      diplomacyModal.classList.add('hidden');
      if (window.synth) window.synth.playClick();
    });
    diplomacyModal.addEventListener('click', (e) => {
      if (e.target === diplomacyModal) {
        diplomacyModal.classList.add('hidden');
      }
    });
  }

  // Chronicle search and category filters
  const searchInput = document.getElementById('chronicle-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      chronicleSearchQuery = e.target.value;
      if (currentWorld) updateUI(currentWorld);
    });
  }

  const tabs = document.querySelectorAll('.filter-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      chronicleFilter = tab.getAttribute('data-filter');
      if (currentWorld) updateUI(currentWorld);
      if (window.synth) window.synth.playClick();
    });
  });

  // Local research accumulation loop (2 points every 5 seconds)
  setInterval(() => {
    if (currentWorld) {
      playerResearchPoints += 2;
      const tModal = document.getElementById('tech-modal');
      if (tModal && !tModal.classList.contains('hidden')) {
        window.renderTechTree();
      }
    }
  }, 5000);

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

window.reassignRole = function(citizenId, newRole) {
  if (window.renderer && window.renderer.entities) {
    const citizen = window.renderer.entities.find(e => e.id === citizenId);
    if (citizen) {
      citizen.role = newRole;
      citizen.task = "Assigned as " + newRole;
      if (!citizen.history) citizen.history = [];
      citizen.history.push(`Reassigned role to ${newRole} in Year ${window.renderer.world.year}`);
      
      if (window.renderer.selectedCell) {
        inspectCell(window.renderer.selectedCell);
      }
      if (window.synth) window.synth.playClick();
    }
  }
};

window.orderMove = function(citizenId) {
  if (window.renderer && window.renderer.entities && window.renderer.selectedCell) {
    const citizen = window.renderer.entities.find(e => e.id === citizenId);
    if (citizen) {
      const ts = window.renderer.tileSize;
      const cell = window.renderer.selectedCell;
      citizen.targetX = cell.x * ts + ts/2;
      citizen.targetY = cell.y * ts + ts/2;
      citizen.activityState = 'GATHERING';
      citizen.task = "Moving to ordered coordinates";
      if (!citizen.history) citizen.history = [];
      citizen.history.push(`Ordered to move to [${cell.x}, ${cell.y}] in Year ${window.renderer.world.year}`);
      
      if (window.renderer.selectedCell) {
        inspectCell(window.renderer.selectedCell);
      }
      if (window.synth) window.synth.playClick();
    }
  }
};

const CORE_TECHS = [
  { id: 'stone_tools', name: 'Basic Flint Tooling', cost: 10, requires: [], desc: 'Allows basic tool building' },
  { id: 'stone_shelter', name: 'Primitive Shelters', cost: 20, requires: [], desc: 'Reduces freezing hazards' },
  { id: 'sailing_boats', name: 'Sailing & Watercraft', cost: 40, requires: ['stone_tools'], desc: 'Unlocks water travel' },
  { id: 'carriage_vehicles', name: 'Carriage Vehicles', cost: 50, requires: ['stone_shelter'], desc: 'Increases citizen speed and cargo slots' },
  { id: 'steam_engine', name: 'Steam Engines', cost: 100, requires: ['carriage_vehicles'], desc: 'Drastically boosts citizen transport' },
  { id: 'sky_ships', name: 'Aetherial Sky Sailing', cost: 120, requires: ['sailing_boats'], desc: 'Allows exploration of Aether sky islands' },
  { id: 'starflight', name: 'Cosmic Spaceflight', cost: 200, requires: ['steam_engine', 'sky_ships'], desc: 'Unlocks orbit travel and spaceports' }
];

window.renderTechTree = function() {
  const container = document.getElementById('tech-tree-container');
  if (!container || !currentWorld) return;
  
  const playerFaction = currentWorld.factions.find(f => f.name === 'Players' || f.name === 'Valoria');
  if (!playerFaction) return;
  if (!playerFaction.technologies) playerFaction.technologies = [];
  
  container.innerHTML = `
    <div style="font-weight: 600; color: var(--gold); font-size: 0.85rem; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">Research Points Available: 🎓${playerResearchPoints}</div>
  `;
  
  CORE_TECHS.forEach(tech => {
    const isUnlocked = playerFaction.technologies.includes(tech.id);
    const meetsRequirements = tech.requires.every(reqId => playerFaction.technologies.includes(reqId));
    const canAfford = playerResearchPoints >= tech.cost;
    
    let btnHtml = '';
    if (isUnlocked) {
      btnHtml = `<span style="color: #10b981; font-weight: bold; font-size: 0.72rem;">✓ Unlocked</span>`;
    } else if (!meetsRequirements) {
      btnHtml = `<span style="color: var(--text-secondary); font-size: 0.72rem;">Requires: ${tech.requires.join(', ')}</span>`;
    } else if (!canAfford) {
      btnHtml = `<button class="btn btn-secondary" style="padding: 2px 8px; font-size: 0.7rem; border-color: rgba(255,255,255,0.08);" disabled>Cost: 🎓${tech.cost}</button>`;
    } else {
      btnHtml = `<button onclick="window.unlockTech('${tech.id}', ${tech.cost})" class="btn btn-primary" style="padding: 2px 8px; font-size: 0.7rem; border-color: var(--gold-glow);">Research (🎓${tech.cost})</button>`;
    }
    
    const item = document.createElement('div');
    item.style.background = 'rgba(255, 255, 255, 0.03)';
    item.style.border = '1px solid rgba(255, 255, 255, 0.06)';
    item.style.borderRadius = '6px';
    item.style.padding = '8px 10px';
    item.style.display = 'flex';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';
    
    item.innerHTML = `
      <div>
        <div style="font-weight: bold; font-size: 0.8rem; color: var(--gold);">${tech.name}</div>
        <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 2px;">${tech.desc}</div>
      </div>
      <div>${btnHtml}</div>
    `;
    container.appendChild(item);
  });
};

window.unlockTech = function(techId, cost) {
  if (currentWorld) {
    const playerFaction = currentWorld.factions.find(f => f.name === 'Players' || f.name === 'Valoria');
    if (playerFaction && playerResearchPoints >= cost) {
      playerResearchPoints -= cost;
      if (!playerFaction.technologies) playerFaction.technologies = [];
      playerFaction.technologies.push(techId);
      
      currentWorld.chronicle.push(`[Research] Player faction successfully unlocked tech: [${techId.toUpperCase()}]!`);
      
      if (window.synth) window.synth.playBell();
      window.renderTechTree();
      updateUI(currentWorld);
    }
  }
};

window.buildApothecary = function(realm, x, y) {
  if (currentWorld) {
    const key = `${realm}:${x},${y}`;
    const cell = currentWorld.modifiedCells[key];
    if (cell && cell.settlement) {
      const faction = currentWorld.factions.find(f => f.name === cell.settlement.faction);
      if (faction && (faction.resources.gold || 0) >= 30 && (faction.resources.wood || faction.resources.timber || 0) >= 10) {
        faction.resources.gold -= 30;
        if (faction.resources.wood) faction.resources.wood -= 10;
        else if (faction.resources.timber) faction.resources.timber -= 10;
        cell.settlement.apothecary = true;
        currentWorld.chronicle.push(`[Construction] Established Apothecary structure in ${cell.settlement.name} at [${x}, ${y}] to treat sick citizens.`);
        if (window.synth) window.synth.playClick();
        updateUI(currentWorld);
      } else {
        alert("Insufficient resources! Requires 30 gold and 10 wood.");
      }
    }
  }
};

window.buildWonderBlueprint = function(realm, x, y) {
  if (currentWorld) {
    const key = `${realm}:${x},${y}`;
    const cell = currentWorld.modifiedCells[key];
    if (cell && cell.settlement) {
      const faction = currentWorld.factions.find(f => f.name === cell.settlement.faction);
      if (faction && (faction.resources.gold || 0) >= 100 && (faction.resources.wood || faction.resources.timber || 0) >= 50 && (faction.resources.iron || 0) >= 10) {
        faction.resources.gold -= 100;
        if (faction.resources.wood) faction.resources.wood -= 50;
        else if (faction.resources.timber) faction.resources.timber -= 50;
        faction.resources.iron -= 10;
        
        cell.settlement.wonderBlueprint = { progress: 0 };
        currentWorld.chronicle.push(`[Construction] Placed Megastructure Wonder blueprint at ${cell.settlement.name} [${x}, ${y}]! Assignment: Builders must deliver materials.`);
        if (window.synth) window.synth.playClick();
        updateUI(currentWorld);
      } else {
        alert("Insufficient resources! Requires 100 gold, 50 wood, and 10 iron.");
      }
    }
  }
};

window.renderDiplomacyRelations = function() {
  const container = document.getElementById('diplomacy-container');
  if (!container || !currentWorld) return;

  const playerFactionName = 'Players';
  const playerFaction = currentWorld.factions.find(f => f.name === playerFactionName) || currentWorld.factions.find(f => f.name === 'Valoria');
  if (!playerFaction) return;

  container.innerHTML = '';
  
  currentWorld.factions.forEach(fac => {
    if (fac.name === playerFaction.name) return;

    const currentStatus = playerFaction.status[fac.name] || 'peace';
    const statusColor = currentStatus === 'alliance' ? '#10b981' : (currentStatus === 'war' ? '#ef4444' : '#eab308');

    const item = document.createElement('div');
    item.style.background = 'rgba(255, 255, 255, 0.03)';
    item.style.border = '1px solid rgba(255, 255, 255, 0.06)';
    item.style.borderRadius = '6px';
    item.style.padding = '10px';
    item.style.display = 'flex';
    item.style.flexDirection = 'column';
    item.style.gap = '8px';

    item.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: bold; color: ${fac.color}; font-size: 0.95rem;">
          <span class="faction-color-dot" style="background-color: ${fac.color}; display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px;"></span>
          ${fac.name} (Power: ${fac.power || 0})
        </span>
        <span style="color: ${statusColor}; font-weight: bold; font-size: 0.8rem; text-transform: uppercase;">${currentStatus}</span>
      </div>
      <div style="display: flex; gap: 6px; justify-content: flex-end; margin-top: 4px;">
        <button onclick="window.changeDiplomacy('${fac.name}', 'war')" class="btn btn-secondary" style="padding: 2px 8px; font-size: 0.72rem; border-color: rgba(239, 68, 68, 0.2); color: #ef4444;" ${currentStatus === 'war' ? 'disabled' : ''}>⚔️ Declare War</button>
        <button onclick="window.changeDiplomacy('${fac.name}', 'peace')" class="btn btn-secondary" style="padding: 2px 8px; font-size: 0.72rem; border-color: rgba(234, 179, 8, 0.2); color: #eab308;" ${currentStatus === 'peace' ? 'disabled' : ''}>🕊️ Offer Peace</button>
        <button onclick="window.changeDiplomacy('${fac.name}', 'alliance')" class="btn btn-secondary" style="padding: 2px 8px; font-size: 0.72rem; border-color: rgba(16, 185, 129, 0.2); color: #10b981;" ${currentStatus === 'alliance' ? 'disabled' : ''}>🤝 Alliance</button>
      </div>
    `;
    container.appendChild(item);
  });
};

window.changeDiplomacy = function(targetFactionName, newStatus) {
  if (currentWorld) {
    const playerFaction = currentWorld.factions.find(f => f.name === 'Players') || currentWorld.factions.find(f => f.name === 'Valoria');
    const targetFaction = currentWorld.factions.find(f => f.name === targetFactionName);

    if (playerFaction && targetFaction) {
      playerFaction.status[targetFactionName] = newStatus;
      targetFaction.status[playerFaction.name] = newStatus;

      const logPrefix = `[Year ${currentWorld.year}]`;
      if (newStatus === 'war') {
        currentWorld.chronicle.push(`${logPrefix} WAR DECLARED: Player faction declared war on ${targetFactionName}!`);
        if (window.synth) window.synth.playSwirl();
      } else if (newStatus === 'alliance') {
        currentWorld.chronicle.push(`${logPrefix} ALLIANCE FORGED: Player faction formed a holy alliance with ${targetFactionName}!`);
        if (window.synth) window.synth.playAlliance();
      } else {
        currentWorld.chronicle.push(`${logPrefix} PEACE TREATY: Player faction agreed to peace terms with ${targetFactionName}.`);
        if (window.synth) window.synth.playBell();
      }

      window.renderDiplomacyRelations();
      updateUI(currentWorld);
    }
  }
};

document.addEventListener('DOMContentLoaded', init);
