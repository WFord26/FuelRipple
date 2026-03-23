import axios from 'axios';

async function extractMetrosFromCSV() {
  try {
    const response = await axios.get(
      'https://raw.githubusercontent.com/lykmapipo/US-Gas-Prices/main/data/metro-daily-averages/2026-03-22.csv'
    );
    
    const lines = response.data.split('\n');
    const metros = new Map<string, string>(); // metro -> state abbr
    
    // Skip header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Simple CSV parsing - handle quoted fields
      const parts: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          parts.push(current.replace(/^"|"$/g, '').trim());
          current = '';
        } else {
          current += char;
        }
      }
      if (current) {
        parts.push(current.replace(/^"|"$/g, '').trim());
      }
      
      // CSV format: State-Name,State-Abbreviation,Metro-Name,...
      if (parts.length >= 3) {
        const stateName = parts[0];
        const stateAbbr = parts[1];
        const metroName = parts[2];
        
        if (stateAbbr && metroName) {
          const key = `${metroName}, ${stateAbbr}`;
          metros.set(key, stateAbbr);
        }
      }
    }
    
    console.log(`Found ${metros.size} unique metros`);
    
    // Output as TypeScript array
    const metroPairs = Array.from(metros.entries()).sort();
    console.log('\n// Metro list from AAA CSV:');
    console.log('const metros = [');
    metroPairs.forEach(([metro, _]) => {
      console.log(`  '${metro}',`);
    });
    console.log('];');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

extractMetrosFromCSV();
