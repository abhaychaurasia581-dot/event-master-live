const fs = require('fs');
const path = require('path');

const targetPages = [
  'Dashboard/AdminDashboard.jsx',
  'Dashboard/CreateEvent.jsx',
  'Dashboard/Dashboard.jsx',
  'Dashboard/Settings.jsx',
  'Events/EventList.jsx',
  'Auth/TwoFactorChallenge.jsx'
];

const basePath = path.join('C:', 'Users', 'abhay', 'OneDrive', 'Desktop', 'EM', 'client', 'src', 'pages');

targetPages.forEach(page => {
  const fullPath = path.join(basePath, page);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Check if BackButton is already imported
    if (!content.includes('BackButton')) {
      // Import BackButton
      const importStatement = "import BackButton from '../../components/common/BackButton';\n";
      content = importStatement + content;

      // Find the first return statement of the component and insert BackButton inside the root div
      // This is a naive regex but works for our standard components where return starts with return ( <div...
      content = content.replace(/return\s*\(\s*(<div[^>]*>)/i, 'return (\n    <>\n      $1\n        <BackButton />');
      // and close the fragment at the end of the file or just append it before the last </div>
      // Actually wrapping the root in fragment is safer
      content = content.replace(/(\)\s*;\s*};?\s*export default)/, '    </>\n  $1');
      
      fs.writeFileSync(fullPath, content);
      console.log('Updated: ' + page);
    }
  } else {
    console.log('Not found: ' + page);
  }
});
