const fs = require('fs');
const path = require('path');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const NC = '\x1b[0m';

console.log(`${YELLOW}=== Validating Build Output ===${NC}`);

const targetBrowser = process.env.BROWSER || 'chrome';
const distDir = path.resolve(__dirname, 'dist', targetBrowser);
const manifestPath = path.join(distDir, 'manifest.json');

let errors = 0;

function checkFile(filePath, description) {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(distDir, filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(
      `${RED}✗ Missing File:${NC} ${description} - Expected at: ${absolutePath}`,
    );
    errors++;
    return false;
  }
  console.log(`${GREEN}✓ Found:${NC} ${description}`);
  return true;
}

// 1. Verify dist folder exists
if (!fs.existsSync(distDir)) {
  console.error(
    `${RED}✗ Error:${NC} Output directory does not exist at ${distDir}`,
  );
  process.exit(1);
}

// 2. Verify manifest.json exists
if (!checkFile('manifest.json', 'manifest.json')) {
  console.error(
    `${RED}✗ Critical Error: manifest.json is missing. Cannot proceed with validation.${NC}`,
  );
  process.exit(1);
}

// 3. Read and parse manifest
let manifest;
try {
  const content = fs.readFileSync(manifestPath, 'utf-8');
  manifest = JSON.parse(content);
  console.log(`${GREEN}✓ Parsed:${NC} manifest.json is valid JSON`);
} catch (e) {
  console.error(
    `${RED}✗ Parse Error:${NC} Failed to parse manifest.json: ${e.message}`,
  );
  process.exit(1);
}

// 4. Verify Manifest Version
if (manifest.manifest_version !== 3) {
  console.error(
    `${RED}✗ Error:${NC} manifest_version must be 3 (found: ${manifest.manifest_version})`,
  );
  errors++;
} else {
  console.log(`${GREEN}✓ Version:${NC} manifest_version is 3`);
}

// 5. Verify Background Service Worker
if (manifest.background) {
  if (manifest.background.service_worker) {
    checkFile(
      manifest.background.service_worker,
      `Background service worker (${manifest.background.service_worker})`,
    );
  } else {
    console.error(
      `${RED}✗ Error:${NC} background property specified but service_worker is missing`,
    );
    errors++;
  }
}

// 6. Verify Content Scripts
if (manifest.content_scripts) {
  manifest.content_scripts.forEach((script, idx) => {
    if (script.js) {
      script.js.forEach((jsFile) => {
        checkFile(jsFile, `Content script [${idx}] (${jsFile})`);
      });
    }
  });
}

// 7. Verify Side Panel path
if (manifest.side_panel && manifest.side_panel.default_path) {
  checkFile(
    manifest.side_panel.default_path,
    `Side Panel default path (${manifest.side_panel.default_path})`,
  );
}

// 8. Verify Declarative Net Request rules
if (
  manifest.declarative_net_request &&
  manifest.declarative_net_request.rule_resources
) {
  manifest.declarative_net_request.rule_resources.forEach((rule, idx) => {
    if (rule.path) {
      checkFile(rule.path, `DNR ruleset [${idx}] (${rule.path})`);
    }
  });
}

// 9. Verify Wasm modules are present
checkFile(
  'wasm/pkg/wasm_unified_core_bg.wasm',
  'Wasm compiled binary (wasm/pkg/)',
);

if (errors > 0) {
  console.error(
    `\n${RED}✗ Validation Failed: ${errors} errors found in build output.${NC}`,
  );
  process.exit(1);
} else {
  console.log(
    `\n${GREEN}✓ Validation Successful! All extension assets and manifest paths are correct.${NC}`,
  );
  process.exit(0);
}
