const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

let depth = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  const divOpens = (line.match(/<div[\s>\/]/g) || []).length;
  const selfClosing = (line.match(/<div[^>]*\/>/g) || []).length;
  const actualDivOpens = divOpens - selfClosing;
  
  const fragOpens = (line.match(/<>/g) || []).length;
  const mainOpens = (line.match(/<main[\s>]/g) || []).length;
  
  const divCloses = (line.match(/<\/div>/g) || []).length;
  const fragCloses = (line.match(/<\/>/g) || []).length;
  const mainCloses = (line.match(/<\/main>/g) || []).length;
  
  const totalOpens = actualDivOpens + fragOpens + mainOpens;
  const totalCloses = divCloses + fragCloses + mainCloses;
  
  depth += (totalOpens - totalCloses);
  
  if (depth < 1 && i >= 40) {
    console.log(`L${i+1} depth drops to ${depth}: ${line.trim().substring(0, 80)}`);
  }
}
