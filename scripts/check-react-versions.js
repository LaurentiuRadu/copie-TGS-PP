#!/usr/bin/env node

/**
 * React Version Checker
 * 
 * Verifies that only a single version of React and ReactDOM exists
 * in the dependency tree. Run this before deployment or when adding
 * new packages.
 * 
 * Usage:
 *   node scripts/check-react-versions.js
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function checkPackage(packageName) {
  log(`\n🔍 Checking ${packageName}...`, colors.cyan);
  
  try {
    const output = execSync(`npm ls ${packageName}`, { 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Parse output to find versions
    const versionMatches = output.match(/\d+\.\d+\.\d+/g);
    const uniqueVersions = [...new Set(versionMatches)];
    
    log(`Found ${uniqueVersions.length} version(s):`, colors.blue);
    uniqueVersions.forEach(version => {
      log(`  - ${packageName}@${version}`, colors.reset);
    });
    
    if (uniqueVersions.length === 1) {
      log(`✅ Single version confirmed: ${uniqueVersions[0]}`, colors.green);
      return { success: true, versions: uniqueVersions };
    } else {
      log(`❌ Multiple versions detected! This will cause issues.`, colors.red);
      log(`\nFull dependency tree:`, colors.yellow);
      console.log(output);
      return { success: false, versions: uniqueVersions };
    }
  } catch (error) {
    // npm ls returns non-zero exit code if there are issues
    const output = error.stdout || error.message;
    
    // Still try to parse versions from error output
    const versionMatches = output.match(/\d+\.\d+\.\d+/g);
    if (versionMatches) {
      const uniqueVersions = [...new Set(versionMatches)];
      
      log(`⚠️ Issues detected in dependency tree`, colors.yellow);
      log(`Found ${uniqueVersions.length} version(s):`, colors.blue);
      uniqueVersions.forEach(version => {
        log(`  - ${packageName}@${version}`, colors.reset);
      });
      
      if (uniqueVersions.length > 1) {
        log(`❌ Multiple versions detected!`, colors.red);
        log(`\nFull output:`, colors.yellow);
        console.log(output);
        return { success: false, versions: uniqueVersions };
      }
    }
    
    log(`❌ Error checking ${packageName}:`, colors.red);
    console.log(output);
    return { success: false, versions: [] };
  }
}

function main() {
  log('═══════════════════════════════════════════════', colors.magenta);
  log('   React Version Checker', colors.magenta);
  log('═══════════════════════════════════════════════', colors.magenta);
  
  const reactCheck = checkPackage('react');
  const reactDomCheck = checkPackage('react-dom');
  
  log('\n═══════════════════════════════════════════════', colors.magenta);
  log('   Final Verdict', colors.magenta);
  log('═══════════════════════════════════════════════', colors.magenta);
  
  if (reactCheck.success && reactDomCheck.success) {
    log('\n✅ SUCCESS: All React packages have single versions!', colors.green);
    log('\nYour project is safe from React instance conflicts.', colors.green);
    log('\nVersions found:', colors.blue);
    log(`  - react@${reactCheck.versions[0]}`, colors.reset);
    log(`  - react-dom@${reactDomCheck.versions[0]}`, colors.reset);
    process.exit(0);
  } else {
    log('\n❌ FAILURE: Multiple React versions detected!', colors.red);
    log('\nThis will cause "Invalid hook call" errors.', colors.red);
    log('\n🔧 How to fix:', colors.yellow);
    log('1. Add to package.json:', colors.yellow);
    log('   "overrides": {', colors.reset);
    log('     "react": "18.3.1",', colors.reset);
    log('     "react-dom": "18.3.1"', colors.reset);
    log('   }', colors.reset);
    log('2. Run: npm install', colors.yellow);
    log('3. Run this script again to verify', colors.yellow);
    log('\n📚 See docs/REACT_INSTANCE_GUIDE.md for more details', colors.cyan);
    process.exit(1);
  }
}

main();
