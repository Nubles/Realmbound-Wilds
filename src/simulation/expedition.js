import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve('public/data');
const WORLD_FILE = path.join(DATA_DIR, 'world.json');
const OUTCOME_FILE = path.join(DATA_DIR, 'expedition_outcome.md');

// Simple deterministic/seeded random to keep outcome consistent if rerun (optional, standard Math.random is fine here too)
const random = Math.random;

// Parse issue body formatted as markdown from GitHub issue form
function parseIssueBody(body) {
  const result = {
    x: null,
    y: null,
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
      // Get the next non-empty line as value
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
      }
    }
  }

  return result;
}

function generateOutcome(world, params) {
  const { x, y, action, playerName, customName } = params;

  if (x === null || y === null || isNaN(x) || isNaN(y) || x < 0 || x >= world.width || y < 0 || y >= world.height) {
    return `### ❌ Expedition Failed
Hey @${playerName}, the coordinates you provided **[${x}, ${y}]** are outside the bounds of the map (0-${world.width - 1}, 0-${world.height - 1}). Please submit a new expedition with valid coordinates!`;
  }

  const cell = world.grid[y][x];
  let outcomeTitle = `### 🗺️ Expedition to [${x}, ${y}] by **${playerName}**`;
  let outcomeBody = '';

  // Add event to local cell history
  const addCellHistory = (msg) => {
    cell.history.push(`[Year ${world.year}] ${msg}`);
    if (cell.history.length > 20) cell.history.shift();
  };

  if (action.includes('explore')) {
    // Reveal coordinate info, search for ruins or artifacts
    let findMsg = '';
    const roll = random();

    if (cell.biome === 'ocean') {
      findMsg = `You sailed into deep ocean. The water is calm but you find nothing but endless blue.`;
    } else if (cell.ruin) {
      findMsg = `You discovered the **${cell.ruin.name}**! Description: *${cell.ruin.description}*. Inside, you recovered ancient relics.`;
    } else if (cell.resources.length > 0) {
      findMsg = `You surveyed the land and discovered a rich pocket of **${cell.resources.join(', ')}**!`;
    } else {
      if (roll < 0.3) {
        findMsg = `You found an overgrown shrine dedicated to ancient gods. Praying there restores your stamina.`;
      } else if (roll < 0.6) {
        findMsg = `You found a skeleton of a previous traveler. Clutched in their hand is a map revealing nearby resource deposits.`;
      } else {
        findMsg = `You explored the quiet wildlands. The soil is fertile and ideal for establishing a home.`;
      }
    }

    outcomeBody = `**Biome:** ${cell.biome.toUpperCase()}  
**Elevation:** ${Math.round(cell.elevation * 100)}%  
**Climate Temp:** ${Math.round(cell.temperature * 100)}%  

**Discovery Log:**  
${findMsg}`;

    addCellHistory(`Explored by player ${playerName}. Result: ${findMsg}`);
    world.chronicle.push(`[Year ${world.year}] Player ${playerName} explored [${x}, ${y}], discovering: ${findMsg}`);

  } else if (action.includes('settle') || action.includes('establish')) {
    // Establish a settlement
    if (cell.biome === 'ocean') {
      outcomeBody = `❌ Cannot build a settlement in the ocean! Please choose a land coordinate.`;
    } else if (cell.settlement) {
      outcomeBody = `❌ There is already a settlement here: **${cell.settlement.name}** (belonging to ${cell.settlement.faction}). You cannot settle here!`;
    } else {
      const sName = customName || `${playerName}'s Outpost`;
      cell.settlement = {
        name: sName,
        faction: 'Players',
        size: 80,
        type: 'hamlet',
        resources: [...cell.resources]
      };

      // Register or update Player faction
      let pFaction = world.factions.find(f => f.name === 'Players');
      if (!pFaction) {
        pFaction = {
          name: 'Players',
          color: '#ef4444', // Red for players
          capital: { x, y },
          settlements: [],
          status: {},
          power: 80
        };
        // Set peace relations with others
        world.factions.forEach(f => {
          if (f.name !== 'Players') {
            f.status['Players'] = 'peace';
            pFaction.status[f.name] = 'peace';
          }
        });
        world.factions.push(pFaction);
      }

      pFaction.settlements.push({ x, y });
      
      outcomeBody = `🎉 **Success!** You have established the outpost **${sName}** at [${x}, ${y}]!  
It has been added to the Player Faction database. It will grow over time as the simulation advances.`;
      
      addCellHistory(`Settlement ${sName} established by ${playerName}.`);
      world.chronicle.push(`[Year ${world.year}] Player ${playerName} established a new settlement: ${sName} at [${x}, ${y}].`);
    }

  } else if (action.includes('hunt')) {
    // Hunt wildlife
    let prey = cell.wildlife.find(w => w.species === 'deer' || w.species === 'elk');
    let predator = cell.wildlife.find(w => w.species === 'wolf' || w.species === 'bear');
    let beast = cell.wildlife.find(w => w.species === 'legendary_beast');

    if (beast) {
      const roll = random();
      if (roll > 0.4) {
        // Success
        outcomeBody = `🗡️ **Epic Victory!** You hunted and slew the legendary beast **${beast.name}** at [${x}, ${y}]!  
The locals sing ballads of your bravery. You have acquired rare hides and trophies.`;
        cell.wildlife = cell.wildlife.filter(w => w !== beast);
        // Put trophy resource in cell
        if (!cell.resources.includes('trophy')) cell.resources.push('trophy');
        
        addCellHistory(`Legendary beast ${beast.name} slain by ${playerName}.`);
        world.chronicle.push(`[Year ${world.year}] Heroic Hunt: Player ${playerName} slew the legendary beast ${beast.name} at [${x}, ${y}]!`);
      } else {
        // Defeat
        outcomeBody = `🩸 **Defeat!** You challenged the legendary beast **${beast.name}** at [${x}, ${y}], but it proved too powerful. You barely escaped with your life.`;
        addCellHistory(`Challenged ${beast.name} but was defeated.`);
      }
    } else if (prey && prey.count > 0) {
      const huntCount = Math.min(prey.count, Math.floor(random() * 10) + 5);
      prey.count -= huntCount;
      if (prey.count <= 0) {
        cell.wildlife = cell.wildlife.filter(w => w !== prey);
      }
      outcomeBody = `🏹 **Successful Hunt!** You successfully hunted **${huntCount} ${prey.species}** at [${x}, ${y}].  
You gathered fresh meat and furs.`;
      
      addCellHistory(`Hunted ${huntCount} ${prey.species} by ${playerName}.`);
    } else if (predator && predator.count > 0) {
      const huntCount = Math.min(predator.count, Math.floor(random() * 2) + 1);
      predator.count -= huntCount;
      if (predator.count <= 0) {
        cell.wildlife = cell.wildlife.filter(w => w !== predator);
      }
      outcomeBody = `🏹 **Successful Hunt!** You successfully hunted **${huntCount} ${predator.species}** at [${x}, ${y}].  
You have made the area safer for local settlers.`;
      
      addCellHistory(`Hunted ${huntCount} ${predator.species} by ${playerName}.`);
    } else {
      outcomeBody = `💨 **No Wildlife Found!** There are no animals here to hunt. You spend the day walking through empty fields.`;
    }
  } else {
    outcomeBody = `❓ **Unknown command:** "${action}". Supported commands: Explore, Settle, Hunt.`;
  }

  return `${outcomeTitle}

${outcomeBody}

---
*Realmbound Wilds Simulation - Year ${world.year}*`;
}

async function run() {
  const issueBody = process.env.ISSUE_BODY || '';
  const parsed = parseIssueBody(issueBody);

  if (!fs.existsSync(WORLD_FILE)) {
    console.error('No world file found. Please run simulate tick first.');
    fs.writeFileSync(OUTCOME_FILE, `### ❌ System Error\nWorld database is currently offline. Please try again later.`, 'utf8');
    process.exit(1);
  }

  const rawData = fs.readFileSync(WORLD_FILE, 'utf8');
  const world = JSON.parse(rawData);

  const outcome = generateOutcome(world, parsed);

  // Write changes
  fs.writeFileSync(WORLD_FILE, JSON.stringify(world, null, 2), 'utf8');
  fs.writeFileSync(OUTCOME_FILE, outcome, 'utf8');

  console.log('Expedition processing complete.');
}

run().catch(err => {
  console.error('Error in expedition runner:', err);
  process.exit(1);
});
