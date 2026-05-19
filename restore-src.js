import fs from 'fs';
import path from 'path';

const srcFile = path.resolve('index.src.html');
const destFile = path.resolve('index.html');

try {
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, destFile);
    console.log('Successfully restored index.html from index.src.html');
  } else {
    console.error('Error: index.src.html does not exist!');
  }
} catch (err) {
  console.error('Failed to restore index.html:', err);
}
