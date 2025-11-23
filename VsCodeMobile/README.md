# VS Code Mobile

A React Native application that runs Visual Studio Code Web inside a WebView, enabling full VS Code functionality on iOS and Android devices through Expo.

## Overview

This project embeds VS Code Web as a self-contained application within a React Native mobile app. VS Code Web assets are bundled and served through Metro bundler, allowing the editor to run entirely offline without requiring a remote server connection.

## Architecture

The application consists of three main components:

1. **React Native Shell**: Expo-based React Native app that provides the mobile container
2. **WebView Integration**: Uses `react-native-webview` to render VS Code Web
3. **Metro Bundler Middleware**: Custom middleware that serves VS Code Web assets and handles CSS-to-JS module conversion for ES module imports

VS Code Web assets are stored in `assets/vscode-web/` and include:
- Compiled JavaScript and CSS from `out/`
- Built-in extensions from `extensions/`
- Entry point HTML file that initializes VS Code Web using ES modules

## Prerequisites

- Node.js 18 or higher
- VS Code source code repository (parent directory)
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (for iOS development) or Android Emulator (for Android development)
- Expo Go app installed on physical device (for testing)

## Setup

### Initial Setup

1. Ensure VS Code source is built:
   ```bash
   cd /path/to/vscode
   npm install
   npm run compile-web
   ```

2. Install dependencies:
   ```bash
   cd VsCodeMobile
   npm install
   ```

3. Sync VS Code Web assets:
   ```bash
   npm run sync-vscode
   ```

4. Start the development server:
   ```bash
   npm start
   ```

### Building VS Code Web

After making changes to VS Code source code:

```bash
cd /path/to/vscode
npm run compile-web
cd VsCodeMobile
npm run sync-vscode
```

Or use the combined command:

```bash
npm run build-vscode
```

## Development

### Running the Application

- **Web**: `npm run web` or press `w` in Expo CLI
- **iOS**: `npm run ios` or press `i` in Expo CLI
- **Android**: `npm run android` or press `a` in Expo CLI

### Making UI Changes

To modify VS Code Web UI for mobile compatibility:

1. Edit files in the VS Code source directory:
   - Layout: `src/vs/workbench/browser/layout.ts`
   - Workbench structure: `src/vs/workbench/browser/workbench.ts`
   - UI components: `src/vs/workbench/browser/parts/`
   - CSS files: `src/vs/workbench/**/media/*.css`

2. Build and sync:
   ```bash
   npm run build-vscode
   ```

3. Restart Metro bundler and refresh the app

### Mobile-Specific Modifications

Key areas for mobile optimization:

- **Touch Targets**: Modify `src/vs/base/browser/ui/button/button.ts` to enforce minimum 44px touch targets
- **Responsive Layout**: Add breakpoints in `src/vs/workbench/browser/layout.ts`
- **Mobile CSS**: Add `@media (max-width: 768px)` rules to component CSS files
- **Part Visibility**: Conditionally hide/show parts in `src/vs/workbench/browser/workbench.ts`

## Project Structure

```
VsCodeMobile/
├── app/                    # Expo Router app directory
│   ├── index.tsx          # Main entry point with WebView
│   └── _layout.tsx        # Root layout configuration
├── assets/
│   └── vscode-web/        # VS Code Web build artifacts
│       ├── out/           # Compiled JavaScript and CSS
│       ├── extensions/     # Built-in extensions
│       └── index.html     # VS Code Web entry point
├── scripts/
│   ├── sync-vscode-web.js # Asset synchronization script
│   └── sync-vscode-web.sh # Bash version of sync script
├── metro.config.js        # Metro bundler configuration
└── package.json           # Project dependencies and scripts
```

## Key Components

### Metro Configuration

The `metro.config.js` file contains custom middleware that:

- Serves VS Code Web assets from `assets/vscode-web/`
- Converts CSS files to JavaScript modules when imported as ES modules
- Rewrites relative URLs in CSS to absolute paths for proper asset loading
- Handles CORS headers for cross-origin requests

### WebView Integration

The main app component (`app/index.tsx`) loads VS Code Web through a WebView:

- Detects platform (web, iOS, Android) and adjusts URL accordingly
- Uses Metro bundler URL for asset serving
- Handles loading states and errors

### Asset Synchronization

The sync scripts (`scripts/sync-vscode-web.js`) copy VS Code Web build artifacts:

- Copies `out/` directory (compiled code)
- Copies `extensions/` directory (built-in extensions)
- Excludes unnecessary files (source maps, test files, node_modules)

## Scripts

- `npm start` - Start Expo development server
- `npm run sync-vscode` - Sync VS Code Web assets from parent directory
- `npm run build-vscode` - Build VS Code Web and sync assets in one command
- `npm run ios` - Start iOS development build
- `npm run android` - Start Android development build
- `npm run web` - Start web development build

## Troubleshooting

### VS Code Web Not Loading

1. Verify assets are synced: Check that `assets/vscode-web/out/` exists
2. Check Metro logs for file not found errors
3. Ensure VS Code was built: Run `npm run compile-web` in parent directory
4. Restart Metro bundler completely

### CSS Import Errors

If you see "text/css is not valid js mime type" errors:

1. Verify Metro config is loaded (check Metro startup logs)
2. Clear Metro cache: `npx expo start -c`
3. Check that CSS files are being converted (look for "[Metro] Converting CSS" logs)

### Icons Not Displaying

1. Verify codicon font is loading: Check network tab for `codicon.ttf` requests
2. Check CSS URL rewriting: Font paths should be absolute
3. Verify font file exists: `assets/vscode-web/out/vs/base/browser/ui/codicons/codicon/codicon.ttf`

### Build Errors

1. Ensure VS Code dependencies are installed in parent directory
2. Check TypeScript compilation errors in VS Code build
3. Verify Node.js version compatibility

## Technical Details

### CSS Module Conversion

VS Code Web uses ES module imports for CSS files (e.g., `import './file.css'`). The Metro middleware intercepts these requests and converts CSS files to JavaScript modules that inject styles into the document.

### Asset Path Resolution

Relative URLs in CSS files are rewritten to absolute paths based on the CSS file's location, ensuring fonts and images load correctly when CSS is injected as a style tag.

### Platform Detection

The app detects the platform and adjusts the Metro bundler URL:
- Web: Uses `window.location.hostname`
- Mobile: Uses Expo's debugger host from `expo-constants`

## License

This project uses VS Code source code, which is licensed under the MIT License. See the parent VS Code repository for license details.
