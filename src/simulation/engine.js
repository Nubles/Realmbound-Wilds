// Core simulation engine for Realmbound Wilds

// Simple pseudo-random helper to make world generation and ticks deterministic if seeded,
// or just standard random with state tracking.
export function seedRandom(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

let random = Math.random;

export function setSeed(seed) {
  random = seedRandom(seed);
}

// 2D simplex/perlin-like noise approximation using layered sine/cosine waves for procedural generation
function getNoise(x, y, octaves = 4) {
  let value = 0;
  let amplitude = 1.0;
  let frequency = 0.05;
  let maxVal = 0;
  for (let i = 0; i < octaves; i++) {
    value += (Math.sin(x * frequency + y * 0.02) * Math.cos(y * frequency - x * 0.01) + 1) * 0.5 * amplitude;
    maxVal += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return value / maxVal;
}

const FACTION_NAMES = ["Valoria", "Oakhaven", "Ironclad", "Sunspire", "Grimwallow", "Aethelgard"];
const FACTION_COLORS = ["#3b82f6", "#10b981", "#6b7280", "#f59e0b", "#8b5cf6", "#ec4899"];

const CELL_BIOMES = {
  OCEAN: 'ocean',
  LAKE: 'lake',
  COAST: 'coast',
  PLAINS: 'plains',
  FOREST: 'forest',
  MOUNTAIN: 'mountain',
  DESERT: 'desert',
  TUNDRA: 'tundra'
};

// Initialize a new world state
export function createNewWorld(width = 50, height = 50, seed = "realmbound") {
  setSeed(seed);
  const grid = [];
  const factionCount = 4;
  const factions = [];

  // Generate map terrain
  for (let y = 0; y < height; y++) {
    grid[y] = [];
    for (let x = 0; x < width; x++) {
      // Create noise-based variables
      const elevNoise = getNoise(x, y, 4);
      const moistNoise = getNoise(x + 100, y + 100, 3);
      
      // Altitude & Base Biome classification
      let elevation = elevNoise;
      let moisture = moistNoise;
      
      // Calculate temperature based on latitude (colder at top/bottom, warmer at center)
      const latFactor = 1 - Math.abs(y - height / 2) / (height / 2);
      let temperature = latFactor * 0.7 + (1 - elevation) * 0.3 + (random() * 0.08 - 0.04);
      temperature = Math.max(0, Math.min(1, temperature));

      let biome = CELL_BIOMES.PLAINS;
      if (elevation < 0.28) {
        biome = CELL_BIOMES.OCEAN;
      } else if (elevation < 0.32) {
        biome = CELL_BIOMES.COAST;
      } else if (elevation > 0.72) {
        biome = CELL_BIOMES.MOUNTAIN;
      } else if (temperature < 0.22) {
        biome = CELL_BIOMES.TUNDRA;
      } else if (moisture < 0.25) {
        if (temperature > 0.5) biome = CELL_BIOMES.DESERT;
        else biome = CELL_BIOMES.PLAINS;
      } else if (moisture > 0.58 && elevation < 0.6) {
        biome = CELL_BIOMES.FOREST;
      }

      // Wildlife population
      const wildlife = [];
      if (biome !== CELL_BIOMES.OCEAN && biome !== CELL_BIOMES.MOUNTAIN) {
        const hasPrey = random() < 0.6;
        const hasPredator = hasPrey && random() < 0.3;
        
        if (biome === CELL_BIOMES.FOREST || biome === CELL_BIOMES.PLAINS) {
          if (hasPrey) wildlife.push({ species: 'deer', count: Math.floor(random() * 30) + 10 });
          if (hasPredator) wildlife.push({ species: 'wolf', count: Math.floor(random() * 5) + 2 });
        } else if (biome === CELL_BIOMES.TUNDRA) {
          if (hasPrey) wildlife.push({ species: 'elk', count: Math.floor(random() * 20) + 5 });
          if (hasPredator) wildlife.push({ species: 'bear', count: Math.floor(random() * 2) + 1 });
        }
      }

      // Resources
      const resources = [];
      if (biome !== CELL_BIOMES.OCEAN) {
        if (elevation > 0.55 && random() < 0.4) resources.push('iron');
        if (elevation > 0.65 && random() < 0.15) resources.push('gold');
        if (biome === CELL_BIOMES.FOREST && random() < 0.5) resources.push('timber');
        if (biome === CELL_BIOMES.COAST && random() < 0.3) resources.push('fish');
        if (wildlife.length > 0 && random() < 0.25) resources.push('game');
      }

      grid[y][x] = {
        x,
        y,
        elevation,
        moisture,
        temperature,
        biome,
        wildlife,
        vegetation: (biome === CELL_BIOMES.FOREST) ? 0.8 : (biome === CELL_BIOMES.PLAINS ? 0.4 : 0.1),
        fireTicksLeft: 0,
        settlement: null,
        resources,
        ruin: null,
        history: []
      };
    }
  }

  // Create starting Factions
  const chronicle = ["The world is forged from the primal wildlands."];
  for (let i = 0; i < factionCount; i++) {
    const name = FACTION_NAMES[i];
    const color = FACTION_COLORS[i];
    
    // Find a suitable land coordinate for capital
    let cx, cy, found = false;
    for (let attempts = 0; attempts < 100; attempts++) {
      cx = Math.floor(random() * (width - 10)) + 5;
      cy = Math.floor(random() * (height - 10)) + 5;
      const cell = grid[cy][cx];
      if (cell.biome !== CELL_BIOMES.OCEAN && cell.biome !== CELL_BIOMES.MOUNTAIN && !cell.settlement) {
        found = true;
        break;
      }
    }

    if (found) {
      const capitalName = `${name} Prime`;
      grid[cy][cx].settlement = {
        name: capitalName,
        faction: name,
        size: 100,
        type: 'capital',
        resources: [...grid[cy][cx].resources]
      };
      
      factions.push({
        name,
        color,
        capital: { x: cx, y: cy },
        settlements: [{ x: cx, y: cy }],
        status: {}, // Relations: { [factionName]: 'peace' | 'war' }
        power: 100
      });
      chronicle.push(`The faction of ${name} is established. Capital founded at [${cx}, ${cy}] named ${capitalName}.`);
    }
  }

  // Initialize Faction Relations
  for (let i = 0; i < factions.length; i++) {
    for (let j = 0; j < factions.length; j++) {
      if (i !== j) {
        factions[i].status[factions[j].name] = 'peace';
      }
    }
  }

  return {
    width,
    height,
    year: 1,
    grid,
    factions,
    chronicle,
    globalTempOffset: 0.0,
    rareEventActive: null
  };
}

// Get neighboring coordinates
function getNeighbors(x, y, width, height) {
  const neighbors = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        neighbors.push({ x: nx, y: ny });
      }
    }
  }
  return neighbors;
}

// Advance the simulation by one year/tick
export function advanceSimulation(world) {
  world.year += 1;
  const logPrefix = `[Year ${world.year}]`;
  
  // 1. Climate shifts
  world.globalTempOffset += (random() * 0.04 - 0.02);
  world.globalTempOffset = Math.max(-0.2, Math.min(0.2, world.globalTempOffset));

  // 2. Cell Updates (Forests, fires, animals)
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const cell = world.grid[y][x];

      // Climate drift locally
      cell.temperature = Math.max(0, Math.min(1, cell.temperature + world.globalTempOffset * 0.1));

      // Forest Fires
      if (cell.fireTicksLeft > 0) {
        cell.fireTicksLeft--;
        cell.vegetation = Math.max(0, cell.vegetation - 0.4);
        
        // Damage settlements
        if (cell.settlement) {
          cell.settlement.size = Math.floor(cell.settlement.size * 0.5);
          if (cell.settlement.size < 10) {
            world.chronicle.push(`${logPrefix} The settlement of ${cell.settlement.name} was devoured by a raging forest fire at [${x}, ${y}].`);
            cell.ruin = {
              name: `Ruins of ${cell.settlement.name}`,
              description: "A settlement reduced to ash by a prehistoric wildfire.",
              age: world.year
            };
            // Remove from faction
            const faction = world.factions.find(f => f.name === cell.settlement.faction);
            if (faction) {
              faction.settlements = faction.settlements.filter(s => s.x !== x || s.y !== y);
            }
            cell.settlement = null;
          }
        }

        // Spread fire
        if (cell.vegetation > 0.1) {
          const neighbors = getNeighbors(x, y, world.width, world.height);
          neighbors.forEach(n => {
            const nc = world.grid[n.y][n.x];
            if (nc.fireTicksLeft === 0 && nc.vegetation > 0.4 && random() < 0.25) {
              nc.fireTicksLeft = Math.floor(random() * 3) + 2;
            }
          });
        }
      } else {
        // Vegetation Growth
        if (cell.biome === CELL_BIOMES.FOREST) {
          cell.vegetation = Math.min(1.0, cell.vegetation + 0.05);
        } else if (cell.biome === CELL_BIOMES.PLAINS) {
          cell.vegetation = Math.min(0.6, cell.vegetation + 0.03);
        } else if (cell.biome !== CELL_BIOMES.OCEAN && cell.biome !== CELL_BIOMES.MOUNTAIN) {
          cell.vegetation = Math.min(0.2, cell.vegetation + 0.01);
        }

        // Random wildfire spark
        if (cell.vegetation > 0.6 && random() < 0.003 && cell.biome === CELL_BIOMES.FOREST) {
          cell.fireTicksLeft = Math.floor(random() * 3) + 2;
          world.chronicle.push(`${logPrefix} Wildfire erupted in the dense forest at [${x}, ${y}].`);
        }
      }

      // Wildlife Sim (Predator-Prey)
      if (cell.wildlife.length > 0) {
        let prey = cell.wildlife.find(w => w.species === 'deer' || w.species === 'elk');
        let predator = cell.wildlife.find(w => w.species === 'wolf' || w.species === 'bear');

        if (prey) {
          // Reproduction based on vegetation food source
          const birthRate = cell.vegetation * 0.4;
          const eatenRate = predator ? (predator.count * 0.08) : 0.0;
          prey.count += Math.floor(prey.count * (birthRate - eatenRate - 0.05));
          
          if (prey.count <= 0) {
            cell.wildlife = cell.wildlife.filter(w => w !== prey);
            prey = null;
          }
        }

        if (predator) {
          // Predator population depends on prey availability
          if (prey) {
            predator.count += Math.floor(predator.count * (prey.count * 0.005 - 0.1));
          } else {
            predator.count -= Math.floor(predator.count * 0.3); // Starve
          }
          if (predator.count <= 0) {
            cell.wildlife = cell.wildlife.filter(w => w !== predator);
            predator = null;
          }
        }

        // Migration logic: Overpopulated cell moves to neighbors
        if (prey && prey.count > 50) {
          const neighbors = getNeighbors(x, y, world.width, world.height);
          const targets = neighbors.filter(n => {
            const nc = world.grid[n.y][n.x];
            return nc.biome !== CELL_BIOMES.OCEAN && nc.biome !== CELL_BIOMES.MOUNTAIN;
          });
          if (targets.length > 0) {
            const t = targets[Math.floor(random() * targets.length)];
            const targetCell = world.grid[t.y][t.x];
            let targetPrey = targetCell.wildlife.find(w => w.species === prey.species);
            const migrateCount = Math.floor(prey.count * 0.3);
            prey.count -= migrateCount;
            if (targetPrey) {
              targetPrey.count += migrateCount;
            } else {
              targetCell.wildlife.push({ species: prey.species, count: migrateCount });
            }
          }
        }
      } else {
        // Spontaneous wildlife arrival
        if (cell.biome === CELL_BIOMES.FOREST && cell.vegetation > 0.5 && random() < 0.05) {
          cell.wildlife.push({ species: 'deer', count: Math.floor(random() * 10) + 5 });
        }
      }
    }
  }

  // 3. Factions and Settlements Simulation
  world.factions.forEach(faction => {
    // Collect resources, build power, grow populations
    let factionPower = 0;
    faction.settlements.forEach(sCoord => {
      const cell = world.grid[sCoord.y][sCoord.x];
      const settlement = cell.settlement;
      if (!settlement) return;

      // Settlement growth based on food sources (timber, iron helps infrastructure)
      let growthFactor = 0.08;
      if (cell.resources.includes('game') || cell.resources.includes('fish')) growthFactor += 0.04;
      if (cell.resources.includes('timber')) growthFactor += 0.02;
      
      settlement.size += Math.floor(settlement.size * growthFactor);
      factionPower += settlement.size;

      // Update type
      if (settlement.size > 2000) settlement.type = 'city';
      else if (settlement.size > 800) settlement.type = 'town';
      else if (settlement.size > 300) settlement.type = 'village';
      else settlement.type = 'hamlet';

      // Settlement expansion / Colonization
      if (settlement.size > 500 && random() < 0.08 && faction.settlements.length < 6) {
        const neighbors = getNeighbors(sCoord.x, sCoord.y, world.width, world.height);
        const candidates = neighbors.filter(n => {
          const nc = world.grid[n.y][n.x];
          return nc.biome !== CELL_BIOMES.OCEAN && nc.biome !== CELL_BIOMES.MOUNTAIN && !nc.settlement;
        });

        if (candidates.length > 0) {
          const spawnCoord = candidates[Math.floor(random() * candidates.length)];
          const newCell = world.grid[spawnCoord.y][spawnCoord.x];
          
          const names = ["Oakhaven", "Evergreen", "Stonefort", "Goldcliff", "Deepwater", "Crossroads", "Riverbend", "Ironkeep", "Windward"];
          const newName = `${names[Math.floor(random() * names.length)]} of ${faction.name}`;
          
          newCell.settlement = {
            name: newName,
            faction: faction.name,
            size: 50,
            type: 'hamlet',
            resources: [...newCell.resources]
          };
          faction.settlements.push({ x: spawnCoord.x, y: spawnCoord.y });
          world.chronicle.push(`${logPrefix} ${faction.name} expanded borders! Established settlement: ${newName} at [${spawnCoord.x}, ${spawnCoord.y}].`);
        }
      }
    });

    faction.power = factionPower;
  });

  // 4. Diplomatic Actions / Wars
  for (let i = 0; i < world.factions.length; i++) {
    const f1 = world.factions[i];
    for (let j = i + 1; j < world.factions.length; j++) {
      const f2 = world.factions[j];
      
      const currentStatus = f1.status[f2.name] || 'peace';

      if (currentStatus === 'peace') {
        // High difference in power or close proximity can trigger war
        const dist = Math.hypot(f1.capital.x - f2.capital.x, f1.capital.y - f2.capital.y);
        const powerDiff = Math.abs(f1.power - f2.power);
        
        if (dist < 20 && random() < 0.03) {
          f1.status[f2.name] = 'war';
          f2.status[f1.name] = 'war';
          world.chronicle.push(`${logPrefix} Factions declare war! Conflict has erupted between ${f1.name} and ${f2.name} over regional dominance.`);
        }
      } else if (currentStatus === 'war') {
        // Battle resolution: choose random settlements near each other
        let battleSettlement = null;
        let attacker = null;
        let defender = null;

        f1.settlements.forEach(s1 => {
          f2.settlements.forEach(s2 => {
            const dist = Math.hypot(s1.x - s2.x, s1.y - s2.y);
            if (dist < 10 && random() < 0.4) {
              // We have a combat candidate
              if (f1.power > f2.power) {
                attacker = f1; defender = f2; battleSettlement = s2;
              } else {
                attacker = f2; defender = f1; battleSettlement = s1;
              }
            }
          });
        });

        if (battleSettlement && attacker && defender) {
          const cell = world.grid[battleSettlement.y][battleSettlement.x];
          const settlement = cell.settlement;
          if (settlement) {
            // Damage settlement, maybe change faction or destroy it
            settlement.size = Math.floor(settlement.size * 0.4);
            if (settlement.size < 30) {
              // Destroyed!
              world.chronicle.push(`${logPrefix} War Outcome: Settlement ${settlement.name} was razed to the ground during a siege by ${attacker.name}.`);
              cell.ruin = {
                name: `Smoldering ruins of ${settlement.name}`,
                description: `Destroyed in the great war between ${f1.name} and ${f2.name}.`,
                age: world.year
              };
              defender.settlements = defender.settlements.filter(s => s.x !== battleSettlement.x || s.y !== battleSettlement.y);
              cell.settlement = null;
            } else {
              // Captured!
              world.chronicle.push(`${logPrefix} War Outcome: ${attacker.name} captured the settlement ${settlement.name} from ${defender.name}.`);
              settlement.faction = attacker.name;
              defender.settlements = defender.settlements.filter(s => s.x !== battleSettlement.x || s.y !== battleSettlement.y);
              attacker.settlements.push({ x: battleSettlement.x, y: battleSettlement.y });
            }
          }
        }

        // Chance to sign peace treaty
        if (random() < 0.15) {
          f1.status[f2.name] = 'peace';
          f2.status[f1.name] = 'peace';
          world.chronicle.push(`${logPrefix} Peace treaty signed: ${f1.name} and ${f2.name} have declared an armistice.`);
        }
      }
    }
  }

  // 5. Rare Events
  if (random() < 0.05) {
    const rx = Math.floor(random() * world.width);
    const ry = Math.floor(random() * world.height);
    const cell = world.grid[ry][rx];
    const eventType = random();

    if (eventType < 0.25 && cell.biome !== CELL_BIOMES.OCEAN) {
      // Meteor impact
      cell.biome = CELL_BIOMES.LAKE;
      cell.elevation = 0.1;
      cell.settlement = null;
      cell.ruin = {
        name: "Meteorite Crater",
        description: "A deep impact crater filled with glowing water and rich starmetal deposits.",
        age: world.year
      };
      if (!cell.resources.includes('starmetal')) {
        cell.resources.push('starmetal');
      }
      world.chronicle.push(`${logPrefix} RARE EVENT: A burning star crashed from the heavens at [${rx}, ${ry}], forming a stellar crater!`);
    } else if (eventType < 0.5 && cell.biome !== CELL_BIOMES.OCEAN) {
      // Volcano eruption
      cell.biome = CELL_BIOMES.MOUNTAIN;
      cell.elevation = 0.95;
      cell.settlement = null;
      cell.ruin = {
        name: "Sleeping Volcano",
        description: "An active tectonic vent created during the Great Upheaval.",
        age: world.year
      };
      // Cause fires around it
      const neighbors = getNeighbors(rx, ry, world.width, world.height);
      neighbors.forEach(n => {
        const nc = world.grid[n.y][n.x];
        nc.fireTicksLeft = 5;
      });
      world.chronicle.push(`${logPrefix} RARE EVENT: An active volcano erupted at [${rx}, ${ry}], filling the region with ash and magma!`);
    } else if (eventType < 0.75) {
      // Plague
      world.factions.forEach(f => {
        f.settlements.forEach(s => {
          const c = world.grid[s.y][s.x];
          if (c.settlement) {
            c.settlement.size = Math.floor(c.settlement.size * 0.6);
          }
        });
      });
      world.chronicle.push(`${logPrefix} RARE EVENT: A devastating plague swept across the civilized kingdoms, decimating populations.`);
    } else {
      // Legendary Beast arises
      const beastNames = ["Ignis the Fire Drake", "Gargantua the Behemoth", "Aethelgard Voidwalker", "Tiamat the Hydra"];
      const chosenBeast = beastNames[Math.floor(random() * beastNames.length)];
      cell.wildlife.push({ species: 'legendary_beast', name: chosenBeast, count: 1 });
      world.chronicle.push(`${logPrefix} RARE EVENT: Legends speak of a massive beast, ${chosenBeast}, sighted near [${rx}, ${ry}].`);
    }
  }

  // Cap chronicle size to prevent file bloat
  if (world.chronicle.length > 500) {
    world.chronicle = world.chronicle.slice(world.chronicle.length - 500);
  }
}
