import fs from 'fs';
import path from 'path';
import { getCell, saveCell } from './engine.js';

const DATA_DIR = path.resolve('public/data');
const WORLD_FILE = path.join(DATA_DIR, 'world.json');
const OUTCOME_FILE = path.join(DATA_DIR, 'expedition_outcome.md');

const random = Math.random;

// Parse issue body formatted as markdown from GitHub issue form
function parseIssueBody(body) {
  const result = {
    x: null,
    y: null,
    realm: 'overworld',
    action: '',
    playerName: 'Unknown Adventurer',
    customName: ''
  };

  if (!body) return result;

  const lines = body.split('\n').map(line => line.trim());
  let currentHeader = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('###')) {
      currentHeader = line.replace('###', '').trim().toLowerCase();
      continue;
    }

    if (line && currentHeader) {
      if (currentHeader.includes('coordinate')) {
        const coords = line.split(/[\s,]+/);
        if (coords.length >= 2) {
          result.x = parseInt(coords[0], 10);
          result.y = parseInt(coords[1], 10);
        }
      } else if (currentHeader.includes('action') || currentHeader.includes('command')) {
        result.action = line.toLowerCase();
      } else if (currentHeader.includes('player name')) {
        result.playerName = line;
      } else if (currentHeader.includes('settlement name') || currentHeader.includes('custom name') || currentHeader.includes('name of settlement')) {
        result.customName = line;
      } else if (currentHeader.includes('realm') || currentHeader.includes('dimension')) {
        const val = line.toLowerCase();
        if (val.includes('underworld')) result.realm = 'underworld';
        else if (val.includes('aether')) result.realm = 'aether';
        else if (val.includes('space')) result.realm = 'space';
        else result.realm = 'overworld';
      }
    }
  }

  return result;
}

function generateOutcome(world, params) {
  const { x, y, realm, action, playerName, customName } = params;

  // Let's enforce coordinate limits to prevent infinite spam overflow
  if (x === null || y === null || isNaN(x) || isNaN(y) || x < -10000 || x > 10000 || y < -10000 || y > 10000) {
    return `### ❌ Expedition Failed
Hey @${playerName}, the coordinates you provided **[${x}, ${y}]** are outside the allowed infinite boundary limits (-10000 to 10000). Please submit a new expedition!`;
  }

  // Fetch cell state dynamically
  const cell = getCell(world, realm, x, y);
  
  let outcomeTitle = `### 🗺️ Expedition to **${realm.toUpperCase()}** [${x}, ${y}] by **${playerName}**`;
  let outcomeBody = '';

  const addCellHistory = (msg) => {
    cell.history.push(`[Year ${world.year}] ${msg}`);
    if (cell.history.length > 20) cell.history.shift();
  };

  // Add target coordinate to the global discovery registry to clear Fog of War
  world.discoveredCenters.push({
    realm,
    x,
    y,
    radius: 6 // reveal surrounding zone
  });

  if (action.includes('explore')) {
    let findMsg = '';
    const roll = random();

    if (cell.biome.includes('void')) {
      findMsg = `You encountered dark vacuum void space. Empty but completely silent.`;
    } else if (cell.ruin) {
      findMsg = `You discovered the **${cell.ruin.name}**! Description: *${cell.ruin.description}*.`;
    } else if (cell.resources.length > 0) {
      findMsg = `You surveyed the coordinates and discovered a rich vein of **${cell.resources.join(', ')}**!`;
    } else {
      if (roll < 0.3) {
        findMsg = `You discovered a cache containing structural resources left behind by past explorers.`;
      } else if (roll < 0.6) {
        findMsg = `You surveyed the surrounding valleys. The terrain is fertile and ideal for colonization.`;
      } else {
        findMsg = `You mapped the wilderness. Base biomes identified as: ${cell.biome.toUpperCase()}.`;
      }
    }

    outcomeBody = `**Realm:** ${realm.toUpperCase()}  
**Biome:** ${cell.biome.toUpperCase()}  
**Elevation:** ${Math.round(cell.elevation * 100)}%  
**Climate Temp:** ${Math.round(cell.temperature * 100)}%  

**Explorer's Survey:**  
${findMsg}`;

    addCellHistory(`Explored by ${playerName}.`);
    world.chronicle.push(`[Year ${world.year}] Player ${playerName} explored ${realm} coordinates [${x}, ${y}]: ${findMsg}`);

  } else if (action.includes('settle') || action.includes('establish')) {
    if (cell.biome.includes('void')) {
      outcomeBody = `❌ Cannot build a settlement in empty void space! Please choose a solid land coordinate.`;
    } else if (cell.settlement) {
      outcomeBody = `❌ There is already a settlement here: **${cell.settlement.name}** (faction: ${cell.settlement.faction}).`;
    } else {
      const sName = customName || `${playerName}'s Outpost`;
      cell.settlement = {
        name: sName,
        faction: 'Players',
        size: 90,
        type: 'village',
        resources: [...cell.resources]
      };

      // Faction registration
      let pFaction = world.factions.find(f => f.name === 'Players');
      if (!pFaction) {
        pFaction = {
          name: 'Players',
          color: '#ef4444',
          capital: { realm, x, y },
          settlements: [],
          status: {},
          power: 90
        };
        world.factions.forEach(f => {
          if (f.name !== 'Players') {
            f.status['Players'] = 'peace';
            pFaction.status[f.name] = 'peace';
          }
        });
        world.factions.push(pFaction);
      }

      pFaction.settlements.push({ realm, x, y });
      
      outcomeBody = `🎉 **Success!** You have established the outpost **${sName}** in **${realm.toUpperCase()}** at [${x}, ${y}]!  
The region is now permanently mapped and added to the Player Faction database.`;
      
      addCellHistory(`Outpost ${sName} founded by ${playerName}.`);
      world.chronicle.push(`[Year ${world.year}] Player ${playerName} founded settlement: ${sName} on ${realm} at [${x}, ${y}].`);
    }

  } else if (action.includes('hunt')) {
    let prey = cell.wildlife.find(w => w.species.includes('deer') || w.species.includes('elk') || w.species.includes('pegasus'));
    let beast = cell.wildlife.find(w => w.species === 'legendary_beast');

    if (beast) {
      const roll = random();
      if (roll > 0.45) {
        outcomeBody = `🗡️ **Epic Victory!** You hunted and slew the legendary beast **${beast.name}** in ${realm} at [${x}, ${y}]!`;
        cell.wildlife = cell.wildlife.filter(w => w !== beast);
        if (!cell.resources.includes('trophy')) cell.resources.push('trophy');
        addCellHistory(`Legendary beast ${beast.name} slain by ${playerName}.`);
        world.chronicle.push(`[Year ${world.year}] Slain: Player ${playerName} defeated the beast ${beast.name} in ${realm} at [${x}, ${y}]!`);
      } else {
        outcomeBody = `🩸 **Defeat!** You challenged **${beast.name}** in ${realm} at [${x}, ${y}], but it overpowered your party.`;
        addCellHistory(`Challenged ${beast.name} but was defeated.`);
      }
    } else if (prey && prey.count > 0) {
      const huntCount = Math.min(prey.count, Math.floor(random() * 8) + 2);
      prey.count -= huntCount;
      if (prey.count <= 0) {
        cell.wildlife = cell.wildlife.filter(w => w !== prey);
      }
      outcomeBody = `🏹 **Successful Hunt!** You successfully hunted **${huntCount} ${prey.species}** in ${realm} at [${x}, ${y}].`;
      addCellHistory(`Hunted ${huntCount} ${prey.species} by ${playerName}.`);
    } else {
      outcomeBody = `💨 **No Wildlife Found!** There are no animals here to hunt.`;
    }
  } else {
    outcomeBody = `❓ **Unknown command:** "${action}". Supported commands: Explore, Settle, Hunt.`;
  }

  saveCell(world, cell);

  return `${outcomeTitle}

${outcomeBody}

---
*Realmbound Wilds Simulation - Year ${world.year}*`;
}

async function run() {
  const issueBody = process.env.ISSUE_BODY || '';
  const parsed = parseIssueBody(issueBody);

  if (!fs.existsSync(WORLD_FILE)) {
    console.error('No world file found.');
    fs.writeFileSync(OUTCOME_FILE, `### ❌ System Error\nWorld database is currently offline.`, 'utf8');
    process.exit(1);
  }

  const rawData = fs.readFileSync(WORLD_FILE, 'utf8');
  const world = JSON.parse(rawData);

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

    Object.assign(world, migrated);
    delete world.grid;
  }

  const outcome = generateOutcome(world, parsed);

  // Save changes
  fs.writeFileSync(WORLD_FILE, JSON.stringify(world, null, 2), 'utf8');
  fs.writeFileSync(OUTCOME_FILE, outcome, 'utf8');

  console.log('Expedition processing complete.');
}

run().catch(err => {
  console.error('Error in expedition runner:', err);
  process.exit(1);
});
