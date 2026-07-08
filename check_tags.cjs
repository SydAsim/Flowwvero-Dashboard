const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

// Track div depth with a stack
let stack = [];
let depth = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Count opens
  const divOpens = (line.match(/<div[\s>\/]/g) || []).length;
  const fragOpens = (line.match(/<>/g) || []).length;
  const mainOpens = (line.match(/<main[\s>]/g) || []).length;
  
  // Count closes  
  const divCloses = (line.match(/<\/div>/g) || []).length;
  const fragCloses = (line.match(/<\/>/g) || []).length;
  const mainCloses = (line.match(/<\/main>/g) || []).length;
  
  // Self-closing divs don't count
  const selfClosing = (line.match(/<div[^>]*\/>/g) || []).length;
  const actualDivOpens = divOpens - selfClosing;
  
  for (let j = 0; j < actualDivOpens; j++) stack.push({ type: 'div', line: i + 1 });
  for (let j = 0; j < fragOpens; j++) stack.push({ type: 'frag', line: i + 1 });
  for (let j = 0; j < mainOpens; j++) stack.push({ type: 'main', line: i + 1 });
  
  for (let j = 0; j < divCloses; j++) {
    if (stack.length > 0) stack.pop();
    else console.log(`EXTRA </div> at line ${i+1}`);
  }
  for (let j = 0; j < fragCloses; j++) {
    if (stack.length > 0) stack.pop();
    else console.log(`EXTRA </> at line ${i+1}`);
  }
  for (let j = 0; j < mainCloses; j++) {
    if (stack.length > 0) stack.pop();
    else console.log(`EXTRA </main> at line ${i+1}`);
  }
}

console.log(`\nRemaining unclosed tags (${stack.length}):`);
stack.forEach(item => {
  console.log(`  ${item.type} opened at line ${item.line}: ${lines[item.line-1].trim().substring(0, 100)}`);
});
