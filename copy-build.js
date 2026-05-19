import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist');
const rootDir = path.resolve('.');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

try {
  if (fs.existsSync(distDir)) {
    // Copy all files and folders from dist/ to root/
    fs.readdirSync(distDir).forEach((item) => {
      const srcPath = path.join(distDir, item);
      const destPath = path.join(rootDir, item);
      copyRecursiveSync(srcPath, destPath);
    });
    console.log('Successfully copied build from dist/ to root directory!');
  } else {
    console.error('Error: dist/ directory does not exist!');
  }
} catch (err) {
  console.error('Failed to copy build:', err);
}
