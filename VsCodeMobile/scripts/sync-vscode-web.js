#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VSCODE_DIR = path.join(__dirname, '../../');
const MOBILE_DIR = __dirname.replace('/scripts', '');
const ASSETS_DIR = path.join(MOBILE_DIR, 'assets/vscode-web');

function syncDirectory(src, dest, excludes = []) {
	if (!fs.existsSync(src)) {
		console.error(`Error: Source directory not found: ${src}`);
		process.exit(1);
	}

	if (!fs.existsSync(dest)) {
		fs.mkdirSync(dest, { recursive: true });
	}

	try {
		const excludeFlags = excludes.map(ex => `--exclude='${ex}'`).join(' ');
		execSync(`rsync -av --delete ${excludeFlags} "${src}/" "${dest}/"`, {
			stdio: 'inherit',
			cwd: VSCODE_DIR
		});
	} catch (error) {
		console.warn('rsync not available, using fallback method...');
		copyRecursiveSync(src, dest, excludes);
	}
}

function copyRecursiveSync(src, dest, excludes = []) {
	const exists = fs.existsSync(src);
	const stats = exists && fs.statSync(src);
	const isDirectory = exists && stats.isDirectory();

	if (isDirectory) {
		const relativePath = path.relative(src, src);
		if (excludes.some(ex => relativePath.includes(ex))) {
			return;
		}

		if (!fs.existsSync(dest)) {
			fs.mkdirSync(dest, { recursive: true });
		}
		fs.readdirSync(src).forEach(childItemName => {
			copyRecursiveSync(
				path.join(src, childItemName),
				path.join(dest, childItemName),
				excludes
			);
		});
	} else {
		fs.copyFileSync(src, dest);
	}
}

const outDir = path.join(VSCODE_DIR, 'out');
if (!fs.existsSync(outDir)) {
	console.error('Error: VS Code out directory not found.');
	console.error('Please run "npm run compile-web" in the VS Code directory first.');
	process.exit(1);
}

if (!fs.existsSync(ASSETS_DIR)) {
	fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

syncDirectory(
	path.join(VSCODE_DIR, 'out'),
	path.join(ASSETS_DIR, 'out'),
	['*.map', 'test/**']
);

syncDirectory(
	path.join(VSCODE_DIR, 'extensions'),
	path.join(ASSETS_DIR, 'extensions'),
	['node_modules/**', '**/node_modules/**', '*.map']
);

console.log('Sync complete.');
