import fs from 'fs';
import path from 'path';
import { createNewWorld, advanceSimulation, getCell } from './engine.js';

const DATA_DIR = path.resolve('public/data');
const WORLD_FILE = path.join(DATA_DIR, 'world.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history_log.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getSummary(world) {
  let deer = 0, wolf = 0, elk = 0, bear = 0, beasts = 0;
  let population = 0;

  // Compile stats across all registered modified cells
  Object.keys(world.modifiedCells).forEach(key => {
    const cell = world.modifiedCells[key];
    if (cell.settlement) {
      population += cell.settlement.size;
    }
    cell.wildlife.forEach(w => {
      if (w.species === 'deer') deer += w.count;
      if (w.species === 'wolf') wolf += w.count;
      if (w.species === 'elk') elk += w.count;
      if (w.species === 'bear') bear += w.count;
      if (w.species === 'legendary_beast') beasts += w.count;
    });
  });

  const factionPowers = {};
  world.factions.forEach(f => {
    factionPowers[f.name] = f.power;
  });

  // Compress active map overlays for historical time-travel replaying
  const compressedCells = [];
  Object.keys(world.modifiedCells).forEach(key => {
    const cell = world.modifiedCells[key];
    compressedCells.push({
      r: cell.realm,
      x: cell.x,
      y: cell.y,
      f: cell.settlement ? cell.settlement.faction : null,
      t: cell.settlement ? cell.settlement.type : null,
      s: cell.settlement ? cell.settlement.size : 0,
      ruin: cell.ruin ? { name: cell.ruin.name, portalTarget: cell.ruin.portalTarget } : null,
      fire: cell.fireTicksLeft > 0
    });
  });

  return {
    year: world.year,
    globalTempOffset: world.globalTempOffset,
    stats: { deer, wolf, elk, bear, beasts, population },
    factions: factionPowers,
    events: [...world.chronicle.slice(-10)], // Grab recent events
    discoveredCenters: world.discoveredCenters,
    mapState: {
      modifiedCells: compressedCells,
      tradeRoutes: (world.tradeRoutes || []).map(tr => ({
        from: tr.from,
        to: tr.to,
        f1: tr.f1,
        f2: tr.f2
      }))
    }
  };
}

async function run() {
  let world;
  let history = [];

  // Load existing world
  if (fs.existsSync(WORLD_FILE)) {
    console.log('Loading existing world state...');
    try {
      const rawData = fs.readFileSync(WORLD_FILE, 'utf8');
      world = JSON.parse(rawData);

      // Database Migration Layer: convert older format grids to infinite dimensions
      if (world && (!world.modifiedCells || world.grid)) {
        console.warn('Old world database format detected. Migrating to infinite realms database...');
        const migrated = {
          seed: world.seed || 'realmbound',
          year: world.year,
          factions: world.factions,
          modifiedCells: {},
          discoveredCenters: world.discoveredCenters || [],
          chronicle: world.chronicle || [],
          tradeRoutes: world.tradeRoutes || [],
          globalTempOffset: world.globalTempOffset || 0.0
        };

        if (world.grid) {
          for (let y = 0; y < world.grid.length; y++) {
            for (let x = 0; x < world.grid[y].length; x++) {
              const cell = world.grid[y][x];
              const isModified = cell.settlement || cell.ruin || cell.fireTicksLeft > 0 || cell.history.length > 0;
              if (isModified) {
                const key = `overworld:${x},${y}`;
                migrated.modifiedCells[key] = {
                  x, y, realm: 'overworld',
                  biome: cell.biome, elevation: cell.elevation, temperature: cell.temperature,
                  settlement: cell.settlement, fireTicksLeft: cell.fireTicksLeft,
                  resources: cell.resources || [], ruin: cell.ruin,
                  wildlife: cell.wildlife || [], vegetation: cell.vegetation || 0.5,
                  history: cell.history || []
                };
              }
            }
          }
        }

        // Add discovery circles around migrated capitals/settlements
        migrated.factions.forEach(f => {
          f.settlements.forEach(s => {
            s.realm = s.realm || 'overworld';
            if (!migrated.discoveredCenters.some(dc => dc.realm === s.realm && dc.x === s.x && dc.y === s.y)) {
              migrated.discoveredCenters.push({
                realm: s.realm,
                x: s.x,
                y: s.y,
                radius: 6
              });
            }
          });
          if (f.capital) {
            f.capital.realm = f.capital.realm || 'overworld';
          }
        });

        world = migrated;
      }
    } catch (e) {
      console.error('Failed to parse world state, generating a new one.', e);
    }
  }

  if (!world) {
    console.log('Initializing a brand new world...');
    const seed = Date.now().toString();
    world = createNewWorld(seed);
  } else {
    console.log(`Advancing simulation for Year ${world.year}...`);
    advanceSimulation(world);
  }

  // Load existing history log
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      const rawHistory = fs.readFileSync(HISTORY_FILE, 'utf8');
      history = JSON.parse(rawHistory);
    } catch (e) {
      console.warn('Failed to parse history log, starting fresh history.');
    }
  }

  // Append new history summary
  const summary = getSummary(world);
  history.push(summary);
  if (history.length > 200) {
    history.shift();
  }

  // Save files
  fs.writeFileSync(WORLD_FILE, JSON.stringify(world, null, 2), 'utf8');
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');

  console.log(`Tick complete! World is now in Year ${world.year}.`);
}

run().catch(err => {
  console.error('Error running simulation tick:', err);
  process.exit(1);
});
