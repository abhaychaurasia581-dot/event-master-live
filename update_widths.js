const fs = require('fs');
const path = require('path');

const pagesDir = path.join('C:', 'Users', 'abhay', 'OneDrive', 'Desktop', 'EM', 'client', 'src', 'pages');

const replaceInFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace various max-w constraints with w-full h-full
  const original = content;
  content = content.replace(/className="max-w-[a-z0-9]+ /g, 'className="w-full h-full flex-grow flex flex-col ');
  content = content.replace(/className="w-full py-8"/g, 'className="w-full h-full flex-grow flex flex-col py-8"');
  content = content.replace(/className="py-4 w-full"/g, 'className="w-full h-full flex-grow flex flex-col py-4"');
  content = content.replace(/className="py-8"/g, 'className="w-full h-full flex-grow flex flex-col py-8"'); // Wishlist
  
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log('Updated:', filePath);
  }
};

const walkSync = (dir) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkSync(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      replaceInFile(fullPath);
    }
  }
};

walkSync(pagesDir);
