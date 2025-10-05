#!/usr/bin/env node

/**
 * Duplicate React Bundle Verifier
 * 
 * Scans the production build to detect multiple React instances that could cause
 * "dispatcher is null" errors. Runs automatically after `npm run build`.
 * 
 * Exit codes:
 * - 0: Success (single React instance)
 * - 1: Failure (multiple React instances detected)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

// React signatures to detect in bundle
const REACT_SIGNATURES = [
  '__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED',
  'ReactCurrentDispatcher',
];

// Suspicious patterns that indicate bundling issues
const SUSPICIOUS_PATTERNS = [
  /react@\d+\.\d+\.\d+/g,
  /node_modules\/react\//g,
  /node_modules\/react-dom\//g,
  /__webpack_require__.*react/g,
];

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function scanDirectory(dir, results = []) {
  if (!fs.existsSync(dir)) {
    return results;
  }

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      scanDirectory(filePath, results);
    } else if (file.endsWith('.js') || file.endsWith('.mjs')) {
      results.push(filePath);
    }
  }

  return results;
}

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const findings = {
    hasReactSignatures: false,
    signatureCount: 0,
    signatures: [],
    suspiciousPatterns: [],
    fileSize: content.length,
  };

  // Check for React signatures
  for (const signature of REACT_SIGNATURES) {
    const regex = new RegExp(signature.replace('(', '\\('), 'g');
    const matches = content.match(regex);
    if (matches) {
      findings.hasReactSignatures = true;
      findings.signatureCount += matches.length;
      findings.signatures.push({
        signature,
        count: matches.length,
      });
    }
  }

  // Check for suspicious patterns
  for (const pattern of SUSPICIOUS_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      findings.suspiciousPatterns.push({
        pattern: pattern.toString(),
        count: matches.length,
        samples: matches.slice(0, 3), // First 3 matches
      });
    }
  }

  return findings;
}

function main() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);
  log('   React Bundle Verification', colors.cyan + colors.bold);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', colors.cyan);

  const distDir = path.resolve(__dirname, '../dist');
  
  if (!fs.existsSync(distDir)) {
    log('❌ Error: dist/ directory not found. Run `npm run build` first.', colors.red);
    process.exit(1);
  }

  log('📦 Scanning bundle files...', colors.blue);
  const jsFiles = scanDirectory(distDir);
  log(`   Found ${jsFiles.length} JavaScript files\n`, colors.blue);

  const reactFiles = [];
  let totalSignatures = 0;
  let hasSuspiciousPatterns = false;

  for (const file of jsFiles) {
    const relativePath = path.relative(distDir, file);
    const findings = analyzeFile(file);

    if (findings.hasReactSignatures) {
      reactFiles.push({
        path: relativePath,
        findings,
      });
      totalSignatures += findings.signatureCount;
    }

    if (findings.suspiciousPatterns.length > 0) {
      hasSuspiciousPatterns = true;
    }
  }

  // Analysis Results
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);
  log('   Analysis Results', colors.cyan + colors.bold);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', colors.cyan);

  log(`Files with React signatures: ${reactFiles.length}`, colors.blue);
  log(`Total React signatures found: ${totalSignatures}\n`, colors.blue);

  if (reactFiles.length === 0) {
    log('⚠️  Warning: No React signatures found. This is unusual.', colors.yellow);
    log('   The bundle may be corrupted or incomplete.\n', colors.yellow);
    process.exit(1);
  }

  // Detailed report for each file
  if (reactFiles.length > 0) {
    log('📄 Files containing React:', colors.magenta);
    reactFiles.forEach((item, index) => {
      log(`\n   ${index + 1}. ${item.path}`, colors.magenta);
      log(`      Size: ${(item.findings.fileSize / 1024).toFixed(2)} KB`, colors.blue);
      log(`      Signatures: ${item.findings.signatureCount}`, colors.blue);
      
      if (item.findings.signatures.length > 0) {
        log(`      Details:`, colors.blue);
        item.findings.signatures.forEach(sig => {
          log(`         - ${sig.signature}: ${sig.count}x`, colors.blue);
        });
      }

      if (item.findings.suspiciousPatterns.length > 0) {
        log(`      ⚠️  Suspicious patterns:`, colors.yellow);
        item.findings.suspiciousPatterns.forEach(pattern => {
          log(`         - ${pattern.pattern}: ${pattern.count}x`, colors.yellow);
          pattern.samples.forEach(sample => {
            log(`           → ${sample}`, colors.yellow);
          });
        });
      }
    });
    log('');
  }

  // Final verdict
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);
  log('   Verdict', colors.cyan + colors.bold);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', colors.cyan);

  // Check for duplicate React runtime instances (ignore hook names in app code)
  const runtimeReactFiles = reactFiles.filter(f =>
    f.findings.signatures.some(s => s.signature === 'ReactCurrentDispatcher' || s.signature === '__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED')
  );
  const hasMultipleReactFiles = runtimeReactFiles.length > 1;
  const hasHighSignatureCount = totalSignatures > 100; // Threshold for "too many"
  
  if (hasMultipleReactFiles) {
    log('❌ FAILURE: Multiple React runtime instances detected!', colors.red + colors.bold);
    log(`   Found React runtime in ${runtimeReactFiles.length} different files.`, colors.red);
    log(`   This WILL cause "dispatcher is null" errors.\n`, colors.red);
    log('🔧 Recommended fixes:', colors.yellow);
    log('   1. Clear all caches: rm -rf node_modules/.vite node_modules/.cache', colors.yellow);
    log('   2. Reinstall dependencies: npm ci', colors.yellow);
    log('   3. Rebuild: npm run build', colors.yellow);
    log('   4. Check vite.config.ts for proper dedupe configuration\n', colors.yellow);
    process.exit(1);
  }

  if (hasSuspiciousPatterns) {
    log('⚠️  WARNING: Suspicious bundling patterns detected', colors.yellow + colors.bold);
    log('   The bundle may contain unnecessary React references.', colors.yellow);
    log('   Review the patterns above and consider cache clearing.\n', colors.yellow);
  }

  if (hasHighSignatureCount && reactFiles.length === 1) {
    log('⚠️  WARNING: Unusually high signature count', colors.yellow + colors.bold);
    log(`   Found ${totalSignatures} React signatures in a single file.`, colors.yellow);
    log('   This might indicate bundling inefficiency.\n', colors.yellow);
  }

  if (!hasMultipleReactFiles && !hasSuspiciousPatterns) {
    log('✅ SUCCESS: Single React instance confirmed', colors.green + colors.bold);
    log('   Bundle is safe for deployment.\n', colors.green);
  } else if (!hasMultipleReactFiles) {
    log('⚠️  PASSED WITH WARNINGS', colors.yellow + colors.bold);
    log('   Single React instance found, but review warnings above.\n', colors.yellow);
  }

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', colors.cyan);

  // Exit with appropriate code
  process.exit(hasMultipleReactFiles ? 1 : 0);
}

main();
