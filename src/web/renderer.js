// Infinite procedural Map Canvas Renderer with Fog of War for Realmbound Wilds
import { generateCell, REALMS } from '../simulation/engine.js';

export const BIOME_LABELS = {
  ocean: 'Ocean',
  coast: 'Coast',
  lake: 'Lake',
  plains: 'Plains',
  forest: 'Dense Forest',
  mountain: 'Mountain Range',
  desert: 'Desert Wasteland',
  tundra: 'Tundra',
  deep_lake: 'Deep Cavern Lake',
  solid_rock: 'Solid Cave Rock',
  magma_vent: 'Volcanic Magma Vent',
  mushroom_forest: 'Spore Mushroom Forest',
  crystal_cave: 'Subterranean Crystal Cave',
  cavern: 'Cavernous Wilderness',
  void: 'Aetherial Sky Void',
  storm_peaks: 'Aetherial Storm Peaks',
  starlight_woods: 'Starlight Sky Woods',
  cloud_fields: 'Fluffy Cloud Fields',
  sky_island: 'Floating Sky Island',
  void_space: 'Empty Void Space',
  comet_tail: 'Glowing Comet Tail',
  nebula: 'Cosmic Nebula Cloud',
  asteroid_belt: 'Rocky Asteroid Belt'
};

// Biome color schemes for different realms
const REALM_BIOME_COLORS = {
  overworld: {
    ocean: '#0c1524', coast: '#1b324d', lake: '#244e76', plains: '#455e3c',
    forest: '#264228', mountain: '#4a4d53', desert: '#8a7959', tundra: '#5a6b6c'
  },
  underworld: {
    deep_lake: '#0c0f1d', solid_rock: '#1e1c22', magma_vent: '#b91c1c',
    mushroom_forest: '#18382c', crystal_cave: '#4c2e6b', cavern: '#2d2b33'
  },
  aether: {
    void: '#0b0c16', storm_peaks: '#4d5162', starlight_woods: '#1d3e56',
    cloud_fields: '#65779c', sky_island: '#3a6b7e'
  },
  space: {
    void_space: '#020205', comet_tail: '#29435c', nebula: '#3f1f51', asteroid_belt: '#1b1d22'
  }
};

const FOW_COLORS = {
  overworld: '#0b0c10',
  underworld: '#030305',
  aether: '#101424',
  space: '#010103'
};

const FACTION_COLORS = ["#3b82f6", "#10b981", "#6b7280", "#f59e0b", "#8b5cf6", "#ec4899"];

export class MapRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Viewport Zoom & Pan
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    
    this.selectedCell = null;
    this.hoveredCell = null;
    
    this.viewMode = 'terrain'; // 'terrain' | 'factions' | 'wildlife' | 'temperature'
    this.activeRealm = REALMS.OVERWORLD; // Current rendering dimension
    
    this.world = null;
    this.historicalState = null;
    this.tileSize = 28;
    
    // Kinetic physics
    this.vx = 0;
    this.vy = 0;
    this.isDragging = false;
    
    this.animTime = 0;
    this.particles = [];
    
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

  setRealm(realm) {
    this.activeRealm = realm;
    this.selectedCell = null;
    this.hoveredCell = null;
    this.draw();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.draw();
  }

  resetView() {
    this.zoom = 1.0;
    this.panX = this.canvas.width / 2;
    this.panY = this.canvas.height / 2;
    this.vx = 0;
    this.vy = 0;
    this.draw();
  }

  zoomIn() {
    this.zoom = Math.min(3.5, this.zoom * 1.25);
    this.draw();
  }

  zoomOut() {
    this.zoom = Math.max(0.15, this.zoom / 1.25);
    this.draw();
  }

  // Check if coordinate is discovered under current Fog of War centers
  isCoordinateDiscovered(x, y) {
    const centers = this.historicalState ? this.historicalState.discoveredCenters : (this.world ? this.world.discoveredCenters : []);
    if (!centers) return false;
    
    for (let i = 0; i < centers.length; i++) {
      const c = centers[i];
      if (c.realm === this.activeRealm) {
        const d = Math.hypot(x - c.x, y - c.y);
        if (d <= c.radius) return true;
      }
    }
    return false;
  }

  // Get active cell from coordinates
  screenToCell(screenX, screenY) {
    if (!this.world) return null;
    const mapX = (screenX - this.panX) / this.zoom;
    const mapY = (screenY - this.panY) / this.zoom;
    
    const cx = Math.floor(mapX / this.tileSize);
    const cy = Math.floor(mapY / this.tileSize);
    
    // Check if discovered. Undiscovered tiles cannot be clicked/inspected
    if (!this.isCoordinateDiscovered(cx, cy)) {
      return { x: cx, y: cy, undiscovered: true, realm: this.activeRealm };
    }

    if (this.historicalState) {
      return this.getReconstructedCell(cx, cy);
    }

    // Live mode coordinate resolution
    const key = `${this.activeRealm}:${cx},${cy}`;
    if (this.world.modifiedCells[key]) {
      return this.world.modifiedCells[key];
    }
    return generateCell(cx, cy, this.activeRealm, this.world.seed);
  }

  // Reconstruct dynamic cell state from historical logs
  getReconstructedCell(cx, cy) {
    const baseCell = generateCell(cx, cy, this.activeRealm, this.world.seed);
    const cells = this.historicalState.mapState.modifiedCells || [];
    const keyCell = cells.find(c => c.r === this.activeRealm && c.x === cx && c.y === cy);

    if (keyCell) {
      baseCell.settlement = keyCell.f ? {
        name: keyCell.f === 'Players' ? 'Player Settlement' : `${keyCell.f} Outpost`,
        faction: keyCell.f,
        size: keyCell.s,
        type: keyCell.t
      } : null;
      baseCell.ruin = keyCell.ruin ? { name: keyCell.ruin.name, portalTarget: keyCell.ruin.portalTarget } : null;
      baseCell.fireTicksLeft = keyCell.fire ? 1 : 0;
      baseCell.history = [`Observed in the archives of Year ${this.historicalState.year}.`];
    }

    return baseCell;
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
      
      const zoomFactor = e.deltaY < 0 ? 1.18 : 0.82;
      this.zoom = Math.max(0.1, Math.min(6.0, this.zoom * zoomFactor));
      
      this.panX = mouseX - mapX * this.zoom;
      this.panY = mouseY - mapY * this.zoom;
      
      this.draw();
    });
  }

  startAnimationLoop() {
    const loop = () => {
      this.animTime += 0.04;
      
      if (!this.isDragging && (Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1)) {
        this.panX += this.vx;
        this.panY += this.vy;
        this.vx *= 0.88;
        this.vy *= 0.88;
        this.draw();
      }

      this.updateParticles();
      this.draw();
      
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  updateParticles() {
    // Generate active wildfire ember particles
    if (this.world) {
      const ts = this.tileSize;
      
      // We gather visible cells to check for fires
      const startX = Math.floor(-this.panX / (this.zoom * ts)) - 1;
      const endX = Math.ceil((this.canvas.width - this.panX) / (this.zoom * ts)) + 1;
      const startY = Math.floor(-this.panY / (this.zoom * ts)) - 1;
      const endY = Math.ceil((this.canvas.height - this.panY) / (this.zoom * ts)) + 1;

      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          if (!this.isCoordinateDiscovered(x, y)) continue;

          let onFire = false;
          if (this.historicalState) {
            const cells = this.historicalState.mapState.modifiedCells || [];
            onFire = cells.some(c => c.r === this.activeRealm && c.x === x && c.y === y && c.fire);
          } else {
            const key = `${this.activeRealm}:${x},${y}`;
            const cell = this.world.modifiedCells[key];
            onFire = cell && cell.fireTicksLeft > 0;
          }

          if (onFire && Math.random() < 0.15) {
            this.particles.push({
              x: x * ts + Math.random() * ts,
              y: y * ts + ts,
              vx: Math.random() * 0.4 - 0.2,
              vy: -Math.random() * 0.7 - 0.5,
              life: 1.0,
              size: Math.random() * 2.5 + 1,
              color: `rgba(${220 + Math.floor(Math.random() * 35)}, ${100 + Math.floor(Math.random() * 40)}, 0, `
            });
          }
        }
      }
    }

    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.035;
    });
    this.particles = this.particles.filter(p => p.life > 0);
  }

  // Draw visible grid
  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.world) return;

    this.ctx.save();
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.zoom, this.zoom);

    const ts = this.tileSize;

    // Calculate currently visible viewport coordinate range
    const startX = Math.floor(-this.panX / (this.zoom * ts)) - 1;
    const endX = Math.ceil((this.canvas.width - this.panX) / (this.zoom * ts)) + 1;
    const startY = Math.floor(-this.panY / (this.zoom * ts)) - 1;
    const endY = Math.ceil((this.canvas.height - this.panY) / (this.zoom * ts)) + 1;

    // 1. Draw biomes / bases
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        this.drawCell(x, y, x * ts, y * ts, ts);
      }
    }

    // 2. Draw Trade routes if on Overworld
    if (this.activeRealm === REALMS.OVERWORLD) {
      this.drawTradeRoutes(ts);
    }

    // 3. Draw structures, portals, overlays
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        this.drawCellOverlay(x, y, x * ts, y * ts, ts);
      }
    }

    // 4. Draw focus brackets
    if (this.selectedCell && !this.selectedCell.undiscovered) {
      this.ctx.strokeStyle = '#dfb15b';
      this.ctx.lineWidth = 2.5;
      this.ctx.strokeRect(this.selectedCell.x * ts, this.selectedCell.y * ts, ts, ts);
    }

    if (this.hoveredCell && this.hoveredCell !== this.selectedCell && !this.hoveredCell.undiscovered) {
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(this.hoveredCell.x * ts, this.hoveredCell.y * ts, ts, ts);
    }

    // 5. Draw fires
    this.particles.forEach(p => {
      this.ctx.fillStyle = p.color + p.life + ')';
      this.ctx.fillRect(p.x, p.y, p.size, p.size);
    });

    this.ctx.restore();
  }

  // Draw procedural biome cell
  drawCell(x, y, cx, cy, ts) {
    if (!this.isCoordinateDiscovered(x, y)) {
      // Undiscovered cell: cover with Realm-specific Fog of War
      const fowColor = FOW_COLORS[this.activeRealm] || '#050505';
      this.ctx.fillStyle = fowColor;
      this.ctx.fillRect(cx, cy, ts, ts);
      return;
    }

    const baseCell = generateCell(x, y, this.activeRealm, this.world.seed);
    let biome = baseCell.biome;
    let factionIdx = -1;

    // Load overlays from dynamic cell registry
    if (this.historicalState) {
      const cells = this.historicalState.mapState.modifiedCells || [];
      const keyCell = cells.find(c => c.r === this.activeRealm && c.x === x && c.y === y);
      if (keyCell && keyCell.f) {
        factionIdx = keyCell.f === 'Players' ? 4 : this.world.factions.findIndex(f => f.name === keyCell.f);
      }
    } else {
      const key = `${this.activeRealm}:${x},${y}`;
      const cell = this.world.modifiedCells[key];
      if (cell && cell.settlement) {
        factionIdx = this.world.factions.findIndex(f => f.name === cell.settlement.faction);
        if (factionIdx === -1 && cell.settlement.faction === 'Players') factionIdx = 4;
      }
    }

    let color = (REALM_BIOME_COLORS[this.activeRealm] && REALM_BIOME_COLORS[this.activeRealm][biome]) || '#111115';

    // Ocean waves ripple
    if (biome === 'ocean' || biome === 'coast' || biome === 'void_space' || biome === 'void') {
      const ripple = Math.sin(this.animTime + (x * 0.15) + (y * 0.08)) * 3;
      if (ripple > 1.8) {
        color = biome === 'ocean' ? '#111b2d' : (biome === 'coast' ? '#203957' : '#07070b');
      }
    }

    if (this.viewMode === 'factions') {
      if (factionIdx !== -1) {
        const hex = FACTION_COLORS[factionIdx] || '#ef4444';
        color = this.hexToRgba(hex, 0.4);
      } else {
        color = '#111216';
      }
    } else if (this.viewMode === 'wildlife') {
      let count = baseCell.wildlife.reduce((sum, w) => sum + w.count, 0);
      if (count > 0) {
        const intensity = Math.min(255, Math.floor((count / 40) * 150) + 50);
        color = `rgb(16, ${intensity}, 80)`;
      } else {
        color = '#111216';
      }
    } else if (this.viewMode === 'temperature') {
      const temp = baseCell.temperature;
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

  // Draw overlay structures (castles, portals, fires)
  drawCellOverlay(x, y, cx, cy, ts) {
    if (!this.isCoordinateDiscovered(x, y)) return;

    const ctx = this.ctx;
    
    // Fetch state
    let hasSettlement = false;
    let factionIdx = -1;
    let type = '';
    let ruin = null;
    let isFire = false;
    let hasBeast = false;

    if (this.historicalState) {
      const cells = this.historicalState.mapState.modifiedCells || [];
      const keyCell = cells.find(c => c.r === this.activeRealm && c.x === x && c.y === y);
      if (keyCell) {
        hasSettlement = keyCell.f !== null;
        if (hasSettlement) {
          factionIdx = keyCell.f === 'Players' ? 4 : this.world.factions.findIndex(f => f.name === keyCell.f);
          type = keyCell.t;
        }
        ruin = keyCell.ruin;
        isFire = keyCell.fire;
      }
    } else {
      const key = `${this.activeRealm}:${x},${y}`;
      const cell = this.world.modifiedCells[key];
      if (cell) {
        hasSettlement = cell.settlement !== null;
        if (hasSettlement) {
          factionIdx = this.world.factions.findIndex(f => f.name === cell.settlement.faction);
          if (factionIdx === -1 && cell.settlement.faction === 'Players') factionIdx = 4;
          type = cell.settlement.type;
        }
        ruin = cell.ruin;
        isFire = cell.fireTicksLeft > 0;
        hasBeast = cell.wildlife.some(w => w.species === 'legendary_beast');
      }
    }

    // 1. Draw wildfire overlay
    if (isFire) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.65)';
      ctx.fillRect(cx, cy, ts, ts);
      ctx.font = '10px sans-serif';
      ctx.fillText('🔥', cx + 4, cy + ts - 6);
      return;
    }

    // 2. Draw Portal Ruin Vortex
    if (ruin && ruin.portalTarget) {
      // Swirling portal color animation
      ctx.fillStyle = this.activeRealm === 'overworld' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)';
      ctx.fillRect(cx, cy, ts, ts);

      ctx.save();
      ctx.translate(cx + ts/2, cy + ts/2);
      ctx.rotate(this.animTime * 1.5);
      
      // Draw swirling portal oval
      ctx.strokeStyle = this.activeRealm === 'overworld' ? '#8b5cf6' : '#10b981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2, -2, 4, 4); // Core spark
      ctx.restore();
      return;
    }

    // 3. Draw standard ruins
    if (ruin) {
      ctx.strokeStyle = '#dfb15b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx + ts/2, cy + ts - 4, 6, Math.PI, 0, false);
      ctx.stroke();
      ctx.fillStyle = '#dfb15b';
      ctx.fillRect(cx + ts/2 - 7, cy + ts - 7, 2, 4);
      ctx.fillRect(cx + ts/2 + 5, cy + ts - 7, 2, 4);
      return;
    }

    // 4. Draw Settlement buildings
    if (hasSettlement) {
      const fColor = FACTION_COLORS[factionIdx] || '#ef4444';
      ctx.fillStyle = fColor;
      const isCapital = type === 'capital';

      if (isCapital) {
        ctx.fillRect(cx + 4, cy + ts - 15, 5, 11);
        ctx.fillRect(cx + ts - 9, cy + ts - 15, 5, 11);
        ctx.fillRect(cx + 9, cy + ts - 11, ts - 18, 7);
      } else {
        ctx.beginPath();
        ctx.moveTo(cx + ts/2, cy + 5);
        ctx.lineTo(cx + 4, cy + 13);
        ctx.lineTo(cx + ts - 4, cy + 13);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(cx + 6, cy + 13, ts - 12, ts - 18);
      }
    }

    // 5. Draw legendary beast
    if (hasBeast) {
      ctx.fillStyle = '#ef4444';
      ctx.font = '13px sans-serif';
      ctx.fillText('🐉', cx + 4, cy + ts - 5);
    }
  }

  // Draw Trade lines
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
