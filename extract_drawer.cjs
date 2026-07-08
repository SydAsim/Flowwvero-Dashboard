const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

for (let i = 1219; i <= 1443; i++) {
  console.log(`L${i+1}: ${lines[i]}`);
}
