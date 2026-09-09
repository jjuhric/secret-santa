const fs = require('fs');
const html = fs.readFileSync('dom_dump.html', 'utf8');

const buttonRegex = /<button[^>]*>([\s\S]*?)<\/button>/gi;
let match;
while ((match = buttonRegex.exec(html)) !== null) {
  let content = match[1].replace(/<[^>]*>/g, '').trim();
  if (content) {
    console.log('Button:', content);
  }
}
