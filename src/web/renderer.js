// Canvas Map Renderer for Realmbound Wilds

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

export class MapRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // View state
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    
    // Selected / Hovered cell
    this.selectedCell = null;
    this.hoveredCell = null;
    
    // Render modes: 'terrain', 'factions', 'wildlife', 'temperature'
    this.viewMode = 'terrain';
    
    this.world = null;
    this.tileSize = 24; // Base size of map square
    
    this.setupEvents();
  }

  setWorld(world) {
    this.world = world;
    this.resize();
    this.resetView();
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

  // Convert screen coordinates to cell coordinates
  screenToCell(screenX, screenY) {
    if (!this.world) return null;
    const mapX = (screenX - this.panX) / this.zoom;
    const mapY = (screenY - this.panY) / this.zoom;
    
    const cx = Math.floor(mapX / this.tileSize);
    const cy = Math.floor(mapY / this.tileSize);
    
    if (cx >= 0 && cx < this.world.width && cy >= 0 && cy < this.world.height) {
      return this.world.grid[cy][cx];
    }
    return null;
  }

  setupEvents() {
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    this.canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX - this.panX;
      startY = e.clientY - this.panY;
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      if (isDragging) {
        this.panX = e.clientX - startX;
        this.panY = e.clientY - startY;
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
      isDragging = false;
    });

    this.canvas.addEventListener('click', (e) => {
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

    // Mouse wheel zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Calculate mouse pos in map space before zoom
      const mapX = (mouseX - this.panX) / this.zoom;
      const mapY = (mouseY - this.panY) / this.zoom;
      
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      this.zoom = Math.max(0.2, Math.min(5.0, this.zoom * zoomFactor));
      
      // Adjust pan to zoom towards mouse cursor
      this.panX = mouseX - mapX * this.zoom;
      this.panY = mouseY - mapY * this.zoom;
      
      this.draw();
    });
  }

  // Draw the entire map viewport
  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (!this.world) return;

    this.ctx.save();
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.zoom, this.zoom);

    // 1. Draw Grid Cells
    const ts = this.tileSize;
    for (let y = 0; y < this.world.height; y++) {
      for (let x = 0; x < this.world.width; x++) {
        const cell = this.world.grid[y][x];
        this.drawCell(cell, x * ts, y * ts, ts);
      }
    }

    // 2. Draw Borders and Extras (separately to overlay correctly)
    for (let y = 0; y < this.world.height; y++) {
      for (let x = 0; x < this.world.width; x++) {
        const cell = this.world.grid[y][x];
        this.drawCellOverlay(cell, x * ts, y * ts, ts);
      }
    }

    // 3. Draw Selections
    if (this.selectedCell) {
      this.ctx.strokeStyle = '#dfb15b';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(this.selectedCell.x * ts, this.selectedCell.y * ts, ts, ts);
      
      // Outer focus bracket
      this.ctx.strokeStyle = 'rgba(223, 177, 91, 0.4)';
      this.ctx.strokeRect(this.selectedCell.x * ts - 2, this.selectedCell.y * ts - 2, ts + 4, ts + 4);
    }

    if (this.hoveredCell && this.hoveredCell !== this.selectedCell) {
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(this.hoveredCell.x * ts, this.hoveredCell.y * ts, ts, ts);
    }

    this.ctx.restore();
  }

  // Helper to color cell based on active view mode
  drawCell(cell, cx, cy, ts) {
    let color = BIOME_COLORS.ocean;

    if (this.viewMode === 'terrain') {
      color = BIOME_COLORS[cell.biome] || BIOME_COLORS.ocean;
    } else if (this.viewMode === 'factions') {
      if (cell.settlement) {
        const faction = this.world.factions.find(f => f.name === cell.settlement.faction);
        color = faction ? faction.color : '#e6e8eb';
      } else {
        // Find nearest faction settlement to color influence subtly
        let minDistance = 999;
        let bestFaction = null;
        this.world.factions.forEach(f => {
          f.settlements.forEach(s => {
            const dist = Math.hypot(cell.x - s.x, cell.y - s.y);
            if (dist < minDistance && dist < 8) {
              minDistance = dist;
              bestFaction = f;
            }
          });
        });

        if (bestFaction && cell.biome !== 'ocean') {
          // Soft tint of faction color
          const hex = bestFaction.color;
          color = this.hexToRgba(hex, 0.15 + (1 - minDistance / 8) * 0.2);
        } else {
          color = '#111216';
        }
      }
    } else if (this.viewMode === 'wildlife') {
      if (cell.wildlife.length > 0) {
        let count = cell.wildlife.reduce((sum, w) => sum + w.count, 0);
        const intensity = Math.min(255, Math.floor((count / 40) * 150) + 50);
        color = `rgb(16, ${intensity}, 80)`;
      } else {
        color = '#111216';
      }
    } else if (this.viewMode === 'temperature') {
      // Hot = red, cold = blue
      const temp = cell.temperature;
      const r = Math.floor(temp * 220);
      const b = Math.floor((1 - temp) * 220);
      color = `rgb(${r}, 40, ${b})`;
    }

    this.ctx.fillStyle = color;
    this.ctx.fillRect(cx, cy, ts, ts);

    // Subtle Grid borders
    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    this.ctx.lineWidth = 0.5;
    this.ctx.strokeRect(cx, cy, ts, ts);
  }

  // Draw details overlay (Forest trees, cities, beasts, fire)
  drawCellOverlay(cell, cx, cy, ts) {
    const ctx = this.ctx;

    // Draw Wildfire
    if (cell.fireTicksLeft > 0) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
      ctx.fillRect(cx, cy, ts, ts);
      
      ctx.font = '10px sans-serif';
      ctx.fillText('🔥', cx + 4, cy + ts - 6);
      return;
    }

    // Draw Forest details (little trees in forest cell)
    if (this.viewMode === 'terrain' && cell.biome === 'forest') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.font = '8px sans-serif';
      ctx.fillText('▲', cx + 4, cy + 12);
      ctx.fillText('▲', cx + 12, cy + 18);
    }

    // Draw Mountain height lines
    if (this.viewMode === 'terrain' && cell.biome === 'mountain') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + ts/2, cy + 4);
      ctx.lineTo(cx + 4, cy + ts - 4);
      ctx.moveTo(cx + ts/2, cy + 4);
      ctx.lineTo(cx + ts - 4, cy + ts - 4);
      ctx.stroke();
    }

    // Draw Ruin markers
    if (cell.ruin) {
      ctx.fillStyle = '#dfb15b';
      ctx.font = '10px sans-serif';
      ctx.fillText('🏛️', cx + 6, cy + ts - 6);
    }

    // Draw Resource markers
    if (cell.resources.length > 0 && !cell.settlement) {
      let symbol = '';
      if (cell.resources.includes('starmetal')) symbol = '☄️';
      else if (cell.resources.includes('gold')) symbol = '🪙';
      else if (cell.resources.includes('iron')) symbol = '⚒️';
      else if (cell.resources.includes('timber')) symbol = '🪵';
      
      if (symbol) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '8px sans-serif';
        ctx.fillText(symbol, cx + ts - 10, cy + 9);
      }
    }

    // Draw Settlement/Factions
    if (cell.settlement) {
      const isCapital = cell.settlement.type === 'capital';
      
      // Draw shield/castle
      ctx.fillStyle = '#ffffff';
      ctx.font = isCapital ? '13px sans-serif' : '10px sans-serif';
      ctx.fillText(isCapital ? '🏰' : '🏠', cx + (isCapital ? 4 : 6), cy + ts - (isCapital ? 4 : 6));
    }

    // Draw Legendary Beast
    const beast = cell.wildlife.find(w => w.species === 'legendary_beast');
    if (beast) {
      ctx.fillStyle = '#ef4444';
      ctx.font = '12px sans-serif';
      ctx.fillText('🐉', cx + 5, cy + ts - 5);
    }
  }

  // Hex conversion helper
  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
export { BIOME_LABELS };
