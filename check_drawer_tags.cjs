const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

let depth = 0;
for (let i = 1220; i < 1444; i++) {
  const line = lines[i];
  
  const divOpens = (line.match(/<div[\s>\/]/g) || []).length;
  const selfClosing = (line.match(/<div[^>]*\/>/g) || []).length;
  const actualDivOpens = divOpens - selfClosing;
  const divCloses = (line.match(/<\/div>/g) || []).length;
  
  depth += (actualDivOpens - divCloses);
  
  if (actualDivOpens !== divCloses) {
    console.log(`L${i+1} depth=${depth} net=${actualDivOpens - divCloses}: ${line.trim().substring(0, 80)}`);
  }
}
console.log(`Final depth in drawer fragment: ${depth}`);
