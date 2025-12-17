# Composer AI Browser Extension

AI-Powered Email Assistant browser extension built with Plasmo Framework.

## Build Instructions

This document provides step-by-step instructions to build an exact copy of the Firefox extension from source code.

### Prerequisites

#### Operating System Requirements
- **macOS**: 10.15 (Catalina) or later
- **Linux**: Ubuntu 18.04 or later, or equivalent distribution
- **Windows**: Windows 10 or later

#### Required Software

1. **Node.js** (Version 18.0.0 or later, LTS recommended)
   - Download and install from: https://nodejs.org/
   - Verify installation:
     ```bash
     node --version
     ```
   - Should output: `v18.x.x` or higher

2. **npm** (Version 9.0.0 or later, comes with Node.js)
   - Verify installation:
     ```bash
     npm --version
     ```
   - Should output: `9.x.x` or higher

### Step-by-Step Build Instructions

1. **Navigate to the extension directory**
   ```bash
   cd extension
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```
   This will install all required packages listed in `package.json`, including:
   - Plasmo Framework (0.90.5)
   - React (18.3.1)
   - TypeScript (^5.9.2)
   - Tailwind CSS (3.4.17)
   - And other dependencies

3. **Build the Firefox extension**
   ```bash
   npm run build:firefox
   ```
   This command executes:
   - `plasmo build --target=firefox-mv2 --env=.env.firefox.production -- --zip`
   - Compiles TypeScript source files
   - Processes React components
   - Bundles and optimizes assets
   - Generates the Firefox extension package
   - Creates a ZIP file for submission

4. **Locate the built extension**
   - The production build will be in: `build/firefox-mv2-prod/`
   - The ZIP file for submission will be: `build/firefox-mv2-prod.zip`

### Build Script

The build process is automated via npm scripts defined in `package.json`:

- **`npm run build:firefox`**: Builds the Firefox extension for production
- **`npm run dev:firefox`**: Builds the Firefox extension for development

The production build script (`build:firefox`) executes all necessary technical steps:
1. TypeScript compilation (`tsc`)
2. React component bundling
3. CSS processing with PostCSS and Tailwind
4. Asset optimization
5. Manifest generation
6. ZIP packaging

### Source Code Structure

All source files are located in the `src/` directory:

- **`src/popup.tsx`**: Main popup interface component
- **`src/content.tsx`**: Content script for page interaction
- **`src/background/`**: Background service worker scripts
- **`src/components/`**: React UI components
- **`src/lib/`**: Utility libraries and API clients

Source files are written in TypeScript (.ts/.tsx) and are not pre-transpiled, concatenated, or minified in the source repository. The build process handles compilation and bundling.

### Configuration Files

- **`package.json`**: Project dependencies and build scripts
- **`tsconfig.json`**: TypeScript compiler configuration
- **`tailwind.config.js`**: Tailwind CSS configuration
- **`postcss.config.js`**: PostCSS configuration
- **`components.json`**: UI component configuration

### Environment Files

The build process uses environment-specific configuration files:
- `.env.firefox.production` (for production builds)
- `.env.firefox.development` (for development builds)

These files should be present in the extension root directory for the build to complete successfully.

#### Required Environment Variables

Create environment files in the extension root directory:

**For development builds** - Create `.env.firefox.development`:
```env
# API Configuration
PLASMO_PUBLIC_API_URL=http://localhost:4000

# Web Application URL
PLASMO_PUBLIC_WEB_URL=http://localhost:3000

# Authentication Service URL
PLASMO_PUBLIC_BETTER_AUTH_URL=http://localhost:4000/api/auth

# Extension ID (Firefox-specific, optional for development)
PLASMO_PUBLIC_CHROME_EXTENSION_ID=

# Host Permissions (automatically processed by Plasmo)
PLASMO_HOST_PERMISSIONS=*://*/

# Cookie Permissions (automatically processed by Plasmo)
PLASMO_COOKIES_PERMISSIONS=cookies
```

**For production builds** - Create `.env.firefox.production`:
```env
# API Configuration
PLASMO_PUBLIC_API_URL=http://localhost:4000

# Web Application URL
PLASMO_PUBLIC_WEB_URL=http://localhost:3000

# Authentication Service URL
PLASMO_PUBLIC_BETTER_AUTH_URL=http://localhost:4000/api/auth

# Extension ID (Firefox-specific, optional for development)
PLASMO_PUBLIC_CHROME_EXTENSION_ID=

# Host Permissions (automatically processed by Plasmo)
PLASMO_HOST_PERMISSIONS=*://*/

# Cookie Permissions (automatically processed by Plasmo)
PLASMO_COOKIES_PERMISSIONS=cookies
```

**Variable Descriptions:**

1. **`PLASMO_PUBLIC_API_URL`** (Required)
   - Base URL for the GraphQL API backend
   - Example: `http://localhost:4000`
   - Used in: `src/lib/apollo-client.ts`, `src/content.tsx`

2. **`PLASMO_PUBLIC_WEB_URL`** (Required)
   - Base URL for the web application
   - Example: `http://localhost:3000`
   - Used in: `src/popup.tsx`, `src/content.tsx`

3. **`PLASMO_PUBLIC_BETTER_AUTH_URL`** (Required)
   - Base URL for the Better Auth authentication service
   - Example: `http://localhost:4000/api/auth`
   - Used in: `src/lib/better-auth-client.ts`

4. **`PLASMO_PUBLIC_CHROME_EXTENSION_ID`** (Optional for Firefox)
   - Chrome extension ID (used for cross-browser compatibility)
   - Can be left empty for Firefox-only builds
   - Used in: `src/lib/better-auth-client.ts`

5. **`PLASMO_HOST_PERMISSIONS`** (Optional, auto-processed)
   - Host permissions for the extension
   - Typically: `https://mail.google.com/*`
   - Processed automatically by Plasmo during build

6. **`PLASMO_COOKIES_PERMISSIONS`** (Optional, auto-processed)
   - Cookie permissions for the extension
   - Can be left empty if not needed
   - Processed automatically by Plasmo during build

**Note**: Replace the example URLs with your actual development URLs. Both development and production environment files should use development URLs for the build process.

### Verification

After building, verify the extension structure:

1. Check that `build/firefox-mv2-prod/` contains:
   - `manifest.json`
   - Compiled JavaScript files
   - CSS files
   - HTML files
   - Static assets

2. The ZIP file `build/firefox-mv2-prod.zip` should be ready for Firefox Add-on submission.

### Troubleshooting

If you encounter issues:

1. **Clear node_modules and reinstall**:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Verify Node.js and npm versions**:
   ```bash
   node --version  # Should be v18.0.0 or higher
   npm --version   # Should be 9.0.0 or higher
   ```

3. **Check for environment files**: Ensure `.env.firefox.production` exists in the extension directory.

### Additional Information

- **Framework**: Plasmo Framework v0.90.5
- **Manifest Version**: Firefox Manifest V2
- **Extension ID**: `assistant@composer.ai` (defined in `package.json`)

For more information about the Plasmo Framework, visit: https://docs.plasmo.com/
