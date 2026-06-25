// Custom Map Canvas Renderer with Animations & Physics for Realmbound Wilds

// Biome color scheme
const BIOME_COLORS = {
  ocean: '#0c1524',
  coast: '#1b324d',
  lake: '#244e76',
  plains: '#455e3c',
  forest: '#264228',
  mountain: '#4a4d53',
  desert: '#8a7959',
  tundra: '#5a6b6c'
};

const BIOME_LABELS = {
  ocean: 'Ocean',
  coast: 'Coast',
  lake: 'Lake',
  plains: 'Plains',
  forest: 'Dense Forest',
  mountain: 'Mountain Range',
  desert: 'Desert Wasteland',
  tundra: 'Tundra'
};

const FACTION_COLORS = ["#3b82f6", "#10b981", "#6b7280", "#f59e0b", "#8b5cf6", "#ec4899"];

export class MapRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // View state
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    
    // Selection state
    this.selectedCell = null;
    this.hoveredCell = null;
    
    // Render modes: 'terrain', 'factions', 'wildlife', 'temperature'
    this.viewMode = 'terrain';
    
    this.world = null;
    this.historicalState = null; // Stored if looking at history
    this.tileSize = 26; 
    
    // Animation elements
    this.animationFrameId = null;
    this.animTime = 0;
    this.particles = [];
    
    // Kinetic physics state
    this.vx = 0;
    this.vy = 0;
    this.isDragging = false;
    
    this.setupEvents();
    this.startAnimationLoop();
  }

  setWorld(world) {
    this.world = world;
    this.historicalState = null;
    this.resize();
    this.resetView();
  }

  setHistoricalState(state) {
    this.historicalState = state;
    this.draw();
  }

  setViewMode(mode) {
    this.viewMode = mode;
    this.draw();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.draw();
  }

  resetView() {
    if (!this.world) return;
    const mapW = this.world.width * this.tileSize;
    const mapH = this.world.height * this.tileSize;
    
    this.zoom = Math.min(this.canvas.width / mapW, this.canvas.height / mapH) * 0.95;
    this.zoom = Math.max(0.5, Math.min(2.5, this.zoom));
    
    this.panX = (this.canvas.width - mapW * this.zoom) / 2;
    this.panY = (this.canvas.height - mapH * this.zoom) / 2;
    this.vx = 0;
    this.vy = 0;
    this.draw();
  }

  zoomIn() {
    this.zoom = Math.min(4.0, this.zoom * 1.2);
    this.draw();
  }

  zoomOut() {
    this.zoom = Math.max(0.2, this.zoom / 1.2);
    this.draw();
  }

  screenToCell(screenX, screenY) {
    if (!this.world) return null;
    const mapX = (screenX - this.panX) / this.zoom;
    const mapY = (screenY - this.panY) / this.zoom;
    
    const cx = Math.floor(mapX / this.tileSize);
    const cy = Math.floor(mapY / this.tileSize);
    
    if (cx >= 0 && cx < this.world.width && cy >= 0 && cy < this.world.height) {
      if (this.historicalState) {
        // Return a mock cell reconstructed from historical mapState
        return this.getReconstructedCell(cx, cy);
      }
      return this.world.grid[cy][cx];
    }
    return null;
  }

  // Decompresses cell data on the fly for history inspection
  getReconstructedCell(cx, cy) {
    if (!this.historicalState) return null;
    const idx = (cy * this.world.width + cx) * 2;
    const gridStr = this.historicalState.mapState.grid;
    const bCode = gridStr[idx];
    const fCode = gridStr[idx + 1];

    const codesToBiome = { O: 'ocean', C: 'coast', L: 'lake', P: 'plains', F: 'forest', M: 'mountain', D: 'desert', T: 'tundra' };
    const biome = codesToBiome[bCode] || 'ocean';

    // Faction owner
    let settlement = null;
    if (fCode !== '.') {
      let factionName = 'Players';
      if (fCode !== 'P') {
        const fIdx = parseInt(fCode, 10);
        if (this.world.factions[fIdx]) factionName = this.world.factions[fIdx].name;
      }
      settlement = {
        name: factionName === 'Players' ? 'Player Settlement' : `${factionName} Outpost`,
        faction: factionName,
        size: this.historicalState.factions[factionName] || 100,
        type: 'village'
      };
    }

    // Check special overlays
    const key = `${cy},${cx}`;
    const spec = this.historicalState.mapState.specials[key];
    let fireTicksLeft = 0;
    let ruin = null;
    let wildlife = [];

    if (spec) {
      if (spec === 'fire') fireTicksLeft = 1;
      else if (spec.type === 'ruin') ruin = { name: spec.name, description: 'Ruins of a past empire.' };
      else if (spec === 'beast') wildlife.push({ species: 'legendary_beast', name: 'Legendary Beast', count: 1 });
    }

    return {
      x: cx,
      y: cy,
      biome,
      elevation: 0.5,
      temperature: 0.5,
      settlement,
      fireTicksLeft,
      ruin,
      wildlife,
      vegetation: biome === 'forest' ? 0.8 : 0.2,
      resources: [],
      history: [`Observed in the archives of Year ${this.historicalState.year}.`]
    };
  }

  setupEvents() {
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;

    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      startX = e.clientX - this.panX;
      startY = e.clientY - this.panY;
      lastX = e.clientX;
      lastY = e.clientY;
      this.vx = 0;
      this.vy = 0;
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      if (this.isDragging) {
        this.panX = e.clientX - startX;
        this.panY = e.clientY - startY;
        
        // Track dragging velocity for physics
        this.vx = e.clientX - lastX;
        this.vy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        
        this.draw();
      } else {
        const cell = this.screenToCell(clientX, clientY);
        if (cell !== this.hoveredCell) {
          this.hoveredCell = cell;
          this.draw();
        }
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('click', (e) => {
      // Don't select if they were dragging
      if (Math.hypot(this.vx, this.vy) > 3) return;

      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      
      const cell = this.screenToCell(clickX, clickY);
      this.selectedCell = cell;
      this.draw();
      
      if (this.onSelectCell) {
        this.onSelectCell(cell);
      }
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const mapX = (mouseX - this.panX) / this.zoom;
      const mapY = (mouseY - this.panY) / this.zoom;
      
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      this.zoom = Math.max(0.2, Math.min(5.0, this.zoom * zoomFactor));
      
      this.panX = mouseX - mapX * this.zoom;
      this.panY = mouseY - mapY * this.zoom;
      
      this.draw();
    });
  }

  startAnimationLoop() {
    const loop = () => {
      this.animTime += 0.05;
      
      // Update kinetic velocity panning
      if (!this.isDragging && (Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1)) {
        this.panX += this.vx;
        this.panY += this.vy;
        this.vx *= 0.85; // Decelerate
        this.vy *= 0.85;
        this.draw();
      }

      // Update particles
      this.updateParticles();
      
      // We only redraw regularly if there are active embers, waves, or animations
      this.draw();
      
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  updateParticles() {
    // Generate new embers on fire tiles
    if (this.world) {
      for (let y = 0; y < this.world.height; y++) {
        for (let x = 0; x < this.world.width; x++) {
          const cell = this.world.grid[y][x];
          
          let isOnFire = cell.fireTicksLeft > 0;
          if (this.historicalState) {
            const key = `${y},${x}`;
            isOnFire = this.historicalState.mapState.specials[key] === 'fire';
          }

          if (isOnFire && Math.random() < 0.15) {
            this.particles.push({
              x: x * this.tileSize + Math.random() * this.tileSize,
              y: y * this.tileSize + this.tileSize,
              vx: Math.random() * 0.4 - 0.2,
              vy: -Math.random() * 0.6 - 0.4,
              life: 1.0,
              size: Math.random() * 2 + 1,
              color: `rgba(${200 + Math.floor(Math.random() * 55)}, ${80 + Math.floor(Math.random() * 50)}, 0, `
            });
          }
        }
      }
    }

    // Move particles
    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
    });

    this.particles = this.particles.filter(p => p.life > 0);
  }

  // Draw the entire map viewport
  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (!this.world) return;

    this.ctx.save();
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.zoom, this.zoom);

    const ts = this.tileSize;

    // Draw Grid Cells
    for (let y = 0; y < this.world.height; y++) {
      for (let x = 0; x < this.world.width; x++) {
        this.drawCell(x, y, x * ts, y * ts, ts);
      }
    }

    // Draw Trade Routes
    this.drawTradeRoutes(ts);

    // Draw Overlays and procedural details
    for (let y = 0; y < this.world.height; y++) {
      for (let x = 0; x < this.world.width; x++) {
        this.drawCellOverlay(x, y, x * ts, y * ts, ts);
      }
    }

    // Draw selection highlights
    if (this.selectedCell) {
      this.ctx.strokeStyle = '#dfb15b';
      this.ctx.lineWidth = 2.5;
      this.ctx.strokeRect(this.selectedCell.x * ts, this.selectedCell.y * ts, ts, ts);
    }

    if (this.hoveredCell && this.hoveredCell !== this.selectedCell) {
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(this.hoveredCell.x * ts, this.hoveredCell.y * ts, ts, ts);
    }

    // Draw Particles
    this.particles.forEach(p => {
      this.ctx.fillStyle = p.color + p.life + ')';
      this.ctx.fillRect(p.x, p.y, p.size, p.size);
    });

    this.ctx.restore();
  }

  // Helper to color grid cell
  drawCell(x, y, cx, cy, ts) {
    let cell = this.world.grid[y][x];
    let biome = cell.biome;
    let factionIdx = -1;

    // Reconstruct grid status if rendering time-travel archives
    if (this.historicalState) {
      const idx = (y * this.world.width + x) * 2;
      const bCode = this.historicalState.mapState.grid[idx];
      const fCode = this.historicalState.mapState.grid[idx + 1];
      
      const codesToBiome = { O: 'ocean', C: 'coast', L: 'lake', P: 'plains', F: 'forest', M: 'mountain', D: 'desert', T: 'tundra' };
      biome = codesToBiome[bCode] || 'ocean';

      if (fCode !== '.') {
        factionIdx = fCode === 'P' ? 4 : parseInt(fCode, 10);
      }
    } else {
      if (cell.settlement) {
        factionIdx = this.world.factions.findIndex(f => f.name === cell.settlement.faction);
        if (factionIdx === -1 && cell.settlement.faction === 'Players') factionIdx = 4;
      } else {
        // Soft border index matching
        let minDistance = 999;
        this.world.factions.forEach((f, fIdx) => {
          f.settlements.forEach(s => {
            const dist = Math.hypot(x - s.x, y - s.y);
            if (dist < minDistance && dist < 8) {
              minDistance = dist;
              factionIdx = fIdx;
            }
          });
        });
        if (minDistance >= 8) factionIdx = -1;
      }
    }

    let color = BIOME_COLORS[biome] || BIOME_COLORS.ocean;

    // Ocean ripple logic
    if (biome === 'ocean' || biome === 'coast') {
      const ripple = Math.sin(this.animTime + (x * 0.2) + (y * 0.1)) * 3;
      if (ripple > 1.5) {
        color = biome === 'ocean' ? '#0f1b2d' : '#213a57';
      }
    }

    if (this.viewMode === 'factions') {
      if (factionIdx !== -1) {
        const hex = FACTION_COLORS[factionIdx] || '#ffffff';
        color = this.hexToRgba(hex, 0.35);
      } else {
        color = '#111216';
      }
    } else if (this.viewMode === 'wildlife') {
      let count = 0;
      if (this.historicalState) {
        const key = `${y},${x}`;
        if (this.historicalState.mapState.specials[key] === 'beast') count = 25;
      } else {
        count = cell.wildlife.reduce((sum, w) => sum + w.count, 0);
      }
      
      if (count > 0) {
        const intensity = Math.min(255, Math.floor((count / 40) * 150) + 50);
        color = `rgb(16, ${intensity}, 80)`;
      } else {
        color = '#111216';
      }
    } else if (this.viewMode === 'temperature') {
      const temp = cell.temperature;
      const r = Math.floor(temp * 220);
      const b = Math.floor((1 - temp) * 220);
      color = `rgb(${r}, 40, ${b})`;
    }

    this.ctx.fillStyle = color;
    this.ctx.fillRect(cx, cy, ts, ts);

    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
    this.ctx.lineWidth = 0.5;
    this.ctx.strokeRect(cx, cy, ts, ts);
  }

  // Overlay structures (smoke, castles, paths, ruins)
  drawCellOverlay(x, y, cx, cy, ts) {
    const ctx = this.ctx;
    let cell = this.world.grid[y][x];

    let hasSettlement = cell.settlement !== null;
    let factionIdx = -1;
    let settlementType = cell.settlement ? cell.settlement.type : '';
    let ruinName = cell.ruin ? cell.ruin.name : '';
    let isFire = cell.fireTicksLeft > 0;
    let hasBeast = cell.wildlife.some(w => w.species === 'legendary_beast');

    // Load historical references if timeline is active
    if (this.historicalState) {
      const idx = (y * this.world.width + x) * 2;
      const fCode = this.historicalState.mapState.grid[idx + 1];
      if (fCode !== '.') {
        hasSettlement = true;
        factionIdx = fCode === 'P' ? 4 : parseInt(fCode, 10);
        settlementType = 'village';
      } else {
        hasSettlement = false;
      }

      const key = `${y},${x}`;
      const spec = this.historicalState.mapState.specials[key];
      isFire = spec === 'fire';
      ruinName = (spec && spec.type === 'ruin') ? spec.name : '';
      hasBeast = spec === 'beast';
    } else {
      if (cell.settlement) {
        factionIdx = this.world.factions.findIndex(f => f.name === cell.settlement.faction);
        if (factionIdx === -1 && cell.settlement.faction === 'Players') factionIdx = 4;
      }
    }

    // 1. Draw Forest details
    if (this.viewMode === 'terrain' && !hasSettlement && !isFire) {
      if ((!this.historicalState && cell.biome === 'forest') || (this.historicalState && this.historicalState.mapState.grid[(y * this.world.width + x) * 2] === 'F')) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.font = '8px sans-serif';
        ctx.fillText('▲', cx + 4, cy + 12);
        ctx.fillText('▲', cx + 12, cy + 18);
      }
    }

    // 2. Draw Ruins (Procedurally: Stone Archway)
    if (ruinName) {
      ctx.strokeStyle = '#dfb15b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      // Draw arch
      ctx.arc(cx + ts/2, cy + ts - 4, 6, Math.PI, 0, false);
      ctx.stroke();
      // Draw pillars
      ctx.fillStyle = '#dfb15b';
      ctx.fillRect(cx + ts/2 - 7, cy + ts - 7, 2, 4);
      ctx.fillRect(cx + ts/2 + 5, cy + ts - 7, 2, 4);
      return;
    }

    // 3. Draw Settlement (Castle or House)
    if (hasSettlement) {
      const fColor = FACTION_COLORS[factionIdx] || '#ef4444';
      ctx.fillStyle = fColor;
      
      const isCapital = settlementType === 'capital';
      
      if (isCapital) {
        // Draw elegant castle towers
        ctx.fillRect(cx + 4, cy + ts - 14, 4, 10);
        ctx.fillRect(cx + ts - 8, cy + ts - 14, 4, 10);
        ctx.fillRect(cx + 8, cy + ts - 10, ts - 16, 6);
        // Flags
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + 6, cy + ts - 14);
        ctx.lineTo(cx + 6, cy + ts - 18);
        ctx.lineTo(cx + 10, cy + ts - 16);
        ctx.lineTo(cx + 6, cy + ts - 14);
        ctx.stroke();
      } else {
        // Draw simple hamlet house
        ctx.beginPath();
        ctx.moveTo(cx + ts/2, cy + 5);
        ctx.lineTo(cx + 4, cy + 12);
        ctx.lineTo(cx + ts - 4, cy + 12);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(cx + 6, cy + 12, ts - 12, ts - 17);
      }
    }

    // 4. Draw Legendary Beast
    if (hasBeast) {
      ctx.fillStyle = '#ef4444';
      ctx.font = '13px sans-serif';
      ctx.fillText('🐉', cx + 4, cy + ts - 5);
    }
  }

  // Draw Trade Routes connecting settlements
  drawTradeRoutes(ts) {
    const routes = this.historicalState ? this.historicalState.mapState.tradeRoutes : (this.world.tradeRoutes || []);
    if (routes.length === 0) return;

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(223, 177, 91, 0.45)';
    this.ctx.lineWidth = 1.5;
    this.ctx.setLineDash([4, 4]);
    this.ctx.lineDashOffset = -this.animTime * 5;

    routes.forEach(route => {
      this.ctx.beginPath();
      this.ctx.moveTo(route.from.x * ts + ts/2, route.from.y * ts + ts/2);
      this.ctx.lineTo(route.to.x * ts + ts/2, route.to.y * ts + ts/2);
      this.ctx.stroke();

      // Render a tiny animated caravan dot moving along trade paths
      const p = (this.animTime * 0.15) % 1.0;
      const cx = route.from.x * ts + ts/2 + (route.to.x - route.from.x) * ts * p;
      const cy = route.from.y * ts + ts/2 + (route.to.y - route.from.y) * ts * p;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.ctx.restore();
  }

  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
export { BIOME_LABELS };
