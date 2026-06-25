// Infinite procedural Map Canvas Renderer with Fog of War for Realmbound Wilds
import { generateCell, REALMS } from '../simulation/engine.js';

export class CosmicSynth {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }

  playClick() {
    this.init();
    if (this.muted || !this.ctx) return;
    
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(330, this.ctx.currentTime); // E4 pluck
    osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.15);
    
    gainNode.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
    
    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playPortalTravel() {
    this.init();
    if (this.muted || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.65);

    filter.type = 'bandpass';
    filter.Q.value = 4.0;
    filter.frequency.setValueAtTime(200, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1000, this.ctx.currentTime + 0.65);

    gainNode.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.7);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.72);
  }

  playBell() {
    this.init();
    if (this.muted || !this.ctx) return;

    const o1 = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    o1.type = 'sine';
    o1.frequency.value = 160;
    o2.type = 'triangle';
    o2.frequency.value = 161.5;

    gainNode.gain.setValueAtTime(0.22, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.1);

    o1.connect(gainNode);
    o2.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    o1.start();
    o2.start();
    o1.stop(this.ctx.currentTime + 1.2);
    o2.stop(this.ctx.currentTime + 1.2);
  }

  playAlliance() {
    this.init();
    if (this.muted || !this.ctx) return;

    const freqs = [330, 440, 554, 660];
    freqs.forEach(f => {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = f;

      gainNode.gain.setValueAtTime(0.06, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.7);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.85);
    });
  }
}

window.synth = new CosmicSynth();


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
    this.targetZoom = 1.0; // Added for smooth zoom interpolation
    this.panX = 0;
    this.targetPanX = 0; // Added for smooth pan interpolation
    this.panY = 0;
    this.targetPanY = 0; // Added for smooth pan interpolation
    
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
    this.atmosphericParticles = []; // Custom atmospheric elements per realm
    this.entities = []; // Animated citizens and wildlife entities roaming the map
    
    this.discoveryCache = new Set();
    this.setupEvents();
    this.startAnimationLoop();
  }

  rebuildDiscoveryCache() {
    this.discoveryCache.clear();
    const centers = this.historicalState ? this.historicalState.discoveredCenters : (this.world ? this.world.discoveredCenters : []);
    if (!centers) return;

    for (let i = 0; i < centers.length; i++) {
      const c = centers[i];
      if (c.realm === this.activeRealm) {
        const rad = Math.ceil(c.radius);
        // Precompute coordinates within circle distance
        for (let dy = -rad; dy <= rad; dy++) {
          for (let dx = -rad; dx <= rad; dx++) {
            if (dx*dx + dy*dy <= c.radius * c.radius) {
              this.discoveryCache.add(`${c.x + dx},${c.y + dy}`);
            }
          }
        }
      }
    }
  }

  setWorld(world) {
    this.world = world;
    this.historicalState = null;
    this.rebuildDiscoveryCache();
    this.resize();
    this.resetView();
    // Immediate zoom/pan without lerping initially
    this.zoom = this.targetZoom;
    this.panX = this.targetPanX;
    this.panY = this.targetPanY;
  }

  setHistoricalState(state) {
    this.historicalState = state;
    this.rebuildDiscoveryCache();
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
    this.atmosphericParticles = []; // Clear current atmospheric particles
    this.rebuildDiscoveryCache();
    this.draw();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.draw();
  }

  resetView() {
    this.targetZoom = 1.0;
    this.targetPanX = this.canvas.width / 2;
    this.targetPanY = this.canvas.height / 2;
    this.vx = 0;
    this.vy = 0;
  }

  zoomIn() {
    this.targetZoom = Math.min(3.5, this.targetZoom * 1.25);
  }

  zoomOut() {
    // Enforce reasonable zoom limit to avoid canvas scaling overhead
    this.targetZoom = Math.max(0.3, this.targetZoom / 1.25);
  }

  // Check if coordinate is discovered under current Fog of War centers
  isCoordinateDiscovered(x, y) {
    return this.discoveryCache.has(`${x},${y}`);
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
      startX = e.clientX - this.targetPanX;
      startY = e.clientY - this.targetPanY;
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
        this.targetPanX = e.clientX - startX;
        this.targetPanY = e.clientY - startY;
        
        this.vx = e.clientX - lastX;
        this.vy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
      } else {
        const cell = this.screenToCell(clientX, clientY);
        if (cell !== this.hoveredCell) {
          this.hoveredCell = cell;
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
      
      // Play a click sound profile when selecting cells
      if (window.synth && !cell.undiscovered) {
        window.synth.playClick();
      }
      
      if (this.onSelectCell) {
        this.onSelectCell(cell);
      }
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const mapX = (mouseX - this.targetPanX) / this.targetZoom;
      const mapY = (mouseY - this.targetPanY) / this.targetZoom;
      
      const zoomFactor = e.deltaY < 0 ? 1.18 : 0.82;
      this.targetZoom = Math.max(0.1, Math.min(6.0, this.targetZoom * zoomFactor));
      
      this.targetPanX = mouseX - mapX * this.targetZoom;
      this.targetPanY = mouseY - mapY * this.targetZoom;
    });
  }

  startAnimationLoop() {
    const loop = () => {
      this.animTime += 0.04;
      
      let changed = false;

      // Smooth zoom lerp
      if (Math.abs(this.zoom - this.targetZoom) > 0.001) {
        this.zoom += (this.targetZoom - this.zoom) * 0.15;
        changed = true;
      } else if (this.zoom !== this.targetZoom) {
        this.zoom = this.targetZoom;
        changed = true;
      }

      // Kinetic physics applied to targets
      if (!this.isDragging && (Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1)) {
        this.targetPanX += this.vx;
        this.targetPanY += this.vy;
        this.vx *= 0.88;
        this.vy *= 0.88;
      }

      // Smooth pan lerp
      if (Math.abs(this.panX - this.targetPanX) > 0.05) {
        this.panX += (this.targetPanX - this.panX) * 0.2;
        changed = true;
      } else if (this.panX !== this.targetPanX) {
        this.panX = this.targetPanX;
        changed = true;
      }

      if (Math.abs(this.panY - this.targetPanY) > 0.05) {
        this.panY += (this.targetPanY - this.panY) * 0.2;
        changed = true;
      } else if (this.panY !== this.targetPanY) {
        this.panY = this.targetPanY;
        changed = true;
      }

      this.updateParticles();
      // Always draw to make sure animated particles and waves render smoothly
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

      // Generate atmospheric particles in screen space to cover the viewport nicely
      const maxAtmosphere = 30;
      while (this.atmosphericParticles.length < maxAtmosphere) {
        this.atmosphericParticles.push({
          x: Math.random() * this.canvas.width,
          y: Math.random() * this.canvas.height,
          vx: this.activeRealm === 'overworld' ? Math.random() * 0.5 - 0.2 : (this.activeRealm === 'space' ? Math.random() * 0.15 - 0.07 : Math.random() * 0.4 - 0.1),
          vy: this.activeRealm === 'underworld' ? -Math.random() * 0.4 - 0.1 : (this.activeRealm === 'overworld' ? Math.random() * 0.3 + 0.2 : Math.random() * 0.15 - 0.05),
          size: Math.random() * 3 + 1,
          life: Math.random() * 0.5 + 0.5,
          angle: Math.random() * Math.PI * 2,
          spin: Math.random() * 0.02 - 0.01
        });
      }
    }

    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.035;
    });
    this.particles = this.particles.filter(p => p.life > 0);

    // Update atmospheric particles
    this.atmosphericParticles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.spin;
      
      // Wrap around canvas boundaries
      if (p.x < 0) p.x = this.canvas.width;
      if (p.x > this.canvas.width) p.x = 0;
      if (p.y < 0) p.y = this.canvas.height;
      if (p.y > this.canvas.height) p.y = 0;
    });

    // Generate and animate roaming entities
    if (this.world) {
      const ts = this.tileSize;
      
      // Seed initial entities if empty
      if (this.entities.length === 0) {
        // Roaming citizen traders between cities or nearby cells
        this.world.factions.forEach(faction => {
          faction.settlements.forEach(s => {
            if (s.realm !== this.activeRealm) return;
            // Create a trader entity
            this.entities.push({
              id: `${faction.name}-trader-${s.x}-${s.y}-${Math.random()}`,
              type: 'citizen',
              subType: 'trader',
              color: faction.color,
              x: s.x * ts + ts/2,
              y: s.y * ts + ts/2,
              targetX: s.x * ts + ts/2,
              targetY: s.y * ts + ts/2,
              homeX: s.x,
              homeY: s.y,
              speed: 0.35 + Math.random() * 0.25,
              emoji: '🚶'
            });
          });
        });

        // Add some random wild animals roaming in forest/plains biomes
        const maxAnimals = 15;
        let animalCount = 0;
        const centers = this.historicalState ? this.historicalState.discoveredCenters : (this.world.discoveredCenters || []);
        
        centers.forEach(c => {
          if (c.realm !== this.activeRealm || animalCount >= maxAnimals) return;
          const rad = Math.ceil(c.radius);
          for (let attempts = 0; attempts < 10; attempts++) {
            const rx = c.x + Math.floor(Math.random() * (rad * 2 + 1)) - rad;
            const ry = c.y + Math.floor(Math.random() * (rad * 2 + 1)) - rad;
            
            if (this.isCoordinateDiscovered(rx, ry)) {
              const cell = generateCell(rx, ry, this.activeRealm, this.world.seed);
              if (cell.biome !== 'ocean' && cell.biome !== 'mountain' && cell.biome !== 'void' && cell.biome !== 'void_space') {
                const isPegasus = this.activeRealm === 'aether';
                this.entities.push({
                  id: `animal-${rx}-${ry}-${Math.random()}`,
                  type: 'wildlife',
                  subType: isPegasus ? 'pegasus' : 'deer',
                  x: rx * ts + ts/2,
                  y: ry * ts + ts/2,
                  targetX: rx * ts + ts/2,
                  targetY: ry * ts + ts/2,
                  homeX: rx,
                  homeY: ry,
                  speed: 0.2 + Math.random() * 0.15,
                  emoji: isPegasus ? '🦄' : '🦌'
                });
                animalCount++;
                break;
              }
            }
          }
        });
      }

      // Update entity movement towards their targets
      this.entities.forEach(ent => {
        const dx = ent.targetX - ent.x;
        const dy = ent.targetY - ent.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 1.0) {
          // Choose a new nearby coordinate target to wander to
          const range = 3; // wandered chunk offset range
          const nextCx = ent.homeX + Math.floor(Math.random() * (range * 2 + 1)) - range;
          const nextCy = ent.homeY + Math.floor(Math.random() * (range * 2 + 1)) - range;

          if (this.isCoordinateDiscovered(nextCx, nextCy)) {
            const cell = generateCell(nextCx, nextCy, this.activeRealm, this.world.seed);
            if (cell.biome !== 'ocean' && cell.biome !== 'mountain' && cell.biome !== 'void' && cell.biome !== 'void_space') {
              ent.targetX = nextCx * ts + Math.random() * (ts - 6) + 3;
              ent.targetY = nextCy * ts + Math.random() * (ts - 6) + 3;
            }
          }
        } else {
          // Move towards target
          ent.x += (dx / dist) * ent.speed;
          ent.y += (dy / dist) * ent.speed;
        }
      });
    }
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

    // 5.5 Draw moving citizens and animals
    this.entities.forEach(ent => {
      // Reconstruct chunk coordinates
      const cx = Math.floor(ent.x / ts);
      const cy = Math.floor(ent.y / ts);
      if (!this.isCoordinateDiscovered(cx, cy)) return;

      this.ctx.save();
      if (ent.type === 'citizen') {
        // Draw colored dot with citizen/trader label when zoomed in
        this.ctx.fillStyle = ent.color;
        this.ctx.beginPath();
        this.ctx.arc(ent.x, ent.y, this.zoom >= 2.0 ? 3 : 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 0.5;
        this.ctx.stroke();

        if (this.zoom >= 2.5) {
          this.ctx.fillStyle = '#ffffff';
          this.ctx.font = '5px sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(ent.emoji, ent.x, ent.y - 4);
        }
      } else {
        // Wildlife animals roaming
        if (this.zoom >= 2.0) {
          this.ctx.fillStyle = '#ffffff';
          this.ctx.font = '8px sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(ent.emoji, ent.x, ent.y + 3);
        } else {
          this.ctx.fillStyle = ent.subType === 'pegasus' ? '#38bdf8' : '#a78bfa';
          this.ctx.beginPath();
          this.ctx.arc(ent.x, ent.y, 1.5, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
      this.ctx.restore();
    });

    this.ctx.restore();

    // 6. Draw Atmosphere overlay (screen-space weather elements)
    this.drawAtmosphere();

    // 7. Draw Minimap overlay
    this.drawMinimap();
  }

  drawAtmosphere() {
    this.ctx.save();
    this.atmosphericParticles.forEach(p => {
      if (this.activeRealm === 'overworld') {
        // Soft green drifting leaves
        this.ctx.fillStyle = `rgba(34, 197, 94, ${p.life * 0.45})`;
        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(p.angle);
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, p.size * 1.5, p.size * 0.8, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      } else if (this.activeRealm === 'underworld') {
        // Reddish cavern embers / steam
        this.ctx.fillStyle = `rgba(239, 68, 68, ${p.life * 0.35})`;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size * 0.8, 0, Math.PI * 2);
        this.ctx.fill();
      } else if (this.activeRealm === 'aether') {
        // Fluffy light blue sky clouds
        this.ctx.fillStyle = `rgba(255, 255, 255, ${p.life * 0.15})`;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
        this.ctx.arc(p.x + p.size * 2, p.y, p.size * 3, 0, Math.PI * 2);
        this.ctx.arc(p.x - p.size * 2, p.y, p.size * 3, 0, Math.PI * 2);
        this.ctx.fill();
      } else if (this.activeRealm === 'space') {
        // Drifting space stardust
        this.ctx.fillStyle = `rgba(255, 255, 255, ${p.life * 0.75})`;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
    });
    this.ctx.restore();
  }

  drawMinimap() {
    const size = 120;
    const padding = 15;
    const x = this.canvas.width - size - padding;
    const y = padding;

    const ctx = this.ctx;
    ctx.save();

    // Map frame background
    ctx.fillStyle = 'rgba(15, 17, 26, 0.85)';
    ctx.strokeStyle = '#dfb15b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 8);
    ctx.fill();
    ctx.stroke();

    // Radar grids
    ctx.strokeStyle = 'rgba(223, 177, 91, 0.2)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2.5, 0, Math.PI * 2);
    ctx.arc(x + size / 2, y + size / 2, size / 5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + size / 2, y);
    ctx.lineTo(x + size / 2, y + size);
    ctx.moveTo(x, y + size / 2);
    ctx.lineTo(x + size, y + size / 2);
    ctx.stroke();

    // Plot discovered centers inside the radar space
    const centers = this.historicalState ? this.historicalState.discoveredCenters : (this.world ? this.world.discoveredCenters : []);
    if (centers && centers.length > 0) {
      // Find bounding limits for centers to center the map viewport appropriately
      let minCx = Infinity, maxCx = -Infinity, minCy = Infinity, maxCy = -Infinity;
      const relevant = centers.filter(c => c.realm === this.activeRealm);
      
      if (relevant.length > 0) {
        relevant.forEach(c => {
          if (c.x < minCx) minCx = c.x;
          if (c.x > maxCx) maxCx = c.x;
          if (c.y < minCy) minCy = c.y;
          if (c.y > maxCy) maxCy = c.y;
        });

        const spanX = Math.max(1, maxCx - minCx);
        const spanY = Math.max(1, maxCy - minCy);
        const maxSpan = Math.max(spanX, spanY, 20);

        const midX = (minCx + maxCx) / 2;
        const midY = (minCy + maxCy) / 2;

        ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
        relevant.forEach(c => {
          // Map to local minimap coordinates
          const mapLocX = x + size/2 + ((c.x - midX) / maxSpan) * (size - 20);
          const mapLocY = y + size/2 + ((c.y - midY) / maxSpan) * (size - 20);
          const drawRadius = Math.max(2, (c.radius / maxSpan) * (size - 20));

          ctx.beginPath();
          ctx.arc(mapLocX, mapLocY, drawRadius, 0, Math.PI * 2);
          ctx.fill();
        });

        // Draw camera position indicator
        // Reconstruct map coordinates of the camera viewport center
        const camX = (this.canvas.width / 2 - this.panX) / (this.zoom * this.tileSize);
        const camY = (this.canvas.height / 2 - this.panY) / (this.zoom * this.tileSize);

        const camLocX = x + size/2 + ((camX - midX) / maxSpan) * (size - 20);
        const camLocY = y + size/2 + ((camY - midY) / maxSpan) * (size - 20);

        if (camLocX >= x + 2 && camLocX <= x + size - 2 && camLocY >= y + 2 && camLocY <= y + size - 2) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(camLocX, camLocY, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(camLocX, camLocY, 6, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    ctx.restore();
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

    // Draw micro detailed view overlay when zoomed in
    if (this.zoom >= 2.2) {
      this.ctx.save();
      
      // Draw grid line borders for individual tiles at high zoom
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      this.ctx.lineWidth = 0.5;
      this.ctx.strokeRect(cx, cy, ts, ts);

      // Micro environment symbols inside the chunk
      if (biome === 'forest' || biome === 'mushroom_forest' || biome === 'starlight_woods') {
        this.ctx.fillStyle = biome === 'mushroom_forest' ? '#10b981' : (biome === 'starlight_woods' ? '#38bdf8' : '#15803d');
        // Render three micro trees/mushrooms inside the tile
        this.ctx.font = `${ts / 3.5}px sans-serif`;
        this.ctx.fillText(biome === 'mushroom_forest' ? '🍄' : '🌲', cx + 2, cy + ts/2);
        this.ctx.fillText(biome === 'mushroom_forest' ? '🍄' : '🌲', cx + ts/2, cy + ts - 2);
        this.ctx.fillText(biome === 'mushroom_forest' ? '🍄' : '🌲', cx + ts - 8, cy + ts/2 + 2);
      } else if (biome === 'mountain' || biome === 'storm_peaks') {
        this.ctx.fillStyle = '#64748b';
        this.ctx.beginPath();
        this.ctx.moveTo(cx + ts/4, cy + ts - 2);
        this.ctx.lineTo(cx + ts/2, cy + ts/3);
        this.ctx.lineTo(cx + 3*ts/4, cy + ts - 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#94a3b8';
        this.ctx.beginPath();
        this.ctx.moveTo(cx + ts/2, cy + ts - 2);
        this.ctx.lineTo(cx + 3*ts/5, cy + ts/2);
        this.ctx.lineTo(cx + 4*ts/5, cy + ts - 2);
        this.ctx.fill();
      }

      // Render mini resource sparkles
      if (baseCell.resources && baseCell.resources.length > 0) {
        this.ctx.fillStyle = baseCell.resources.includes('gold') ? '#f59e0b' : (baseCell.resources.includes('stardust') || baseCell.resources.includes('starmetal') ? '#38bdf8' : '#94a3b8');
        this.ctx.font = `${ts / 4}px sans-serif`;
        this.ctx.fillText('✨', cx + ts - 8, cy + 8);
      }

      // Render micro population dots if settlement present
      let sSize = 0;
      if (this.historicalState) {
        const cells = this.historicalState.mapState.modifiedCells || [];
        const keyCell = cells.find(c => c.r === this.activeRealm && c.x === x && c.y === y);
        if (keyCell && keyCell.f) sSize = keyCell.s;
      } else {
        const key = `${this.activeRealm}:${x},${y}`;
        const cell = this.world.modifiedCells[key];
        if (cell && cell.settlement) sSize = cell.settlement.size;
      }

      if (sSize > 0) {
        const numDots = Math.min(6, Math.ceil(sSize / 150));
        this.ctx.fillStyle = '#ffffff';
        for (let idx = 0; idx < numDots; idx++) {
          const dx = cx + 4 + (idx % 3) * (ts / 4);
          const dy = cy + ts - 8 - Math.floor(idx / 3) * (ts / 4);
          this.ctx.beginPath();
          this.ctx.arc(dx, dy, 1.2, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }

      this.ctx.restore();
    } else {
      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
      this.ctx.lineWidth = 0.5;
      this.ctx.strokeRect(cx, cy, ts, ts);
    }
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
