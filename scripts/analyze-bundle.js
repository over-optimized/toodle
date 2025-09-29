#!/usr/bin/env node

import { execSync } from 'child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join, basename } from 'path'

console.log('🔍 Analyzing bundle size...\n')

// Build the project
console.log('📦 Building project...')
try {
  execSync('pnpm build', { stdio: 'inherit' })
} catch (error) {
  console.error('❌ Build failed')
  process.exit(1)
}

// Analyze dist folder
const distPath = './dist'
if (!existsSync(distPath)) {
  console.error('❌ Dist folder not found')
  process.exit(1)
}

// Get file sizes
function getFileSizes(dirPath, baseDir = dirPath) {
  const files = []
  const items = readdirSync(dirPath)

  for (const item of items) {
    const fullPath = join(dirPath, item)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      files.push(...getFileSizes(fullPath, baseDir))
    } else {
      const relativePath = fullPath.replace(baseDir + '/', '')
      const sizeKB = (stat.size / 1024).toFixed(2)
      files.push({ path: relativePath, size: stat.size, sizeKB })
    }
  }

  return files
}

const files = getFileSizes(distPath)

// Sort by size (largest first)
files.sort((a, b) => b.size - a.size)

// Group by type
const byType = {
  js: files.filter(f => f.path.endsWith('.js')),
  css: files.filter(f => f.path.endsWith('.css')),
  html: files.filter(f => f.path.endsWith('.html')),
  assets: files.filter(f => !f.path.endsWith('.js') && !f.path.endsWith('.css') && !f.path.endsWith('.html'))
}

console.log('\n📊 Bundle Analysis Results\n')

// Total size
const totalSize = files.reduce((sum, file) => sum + file.size, 0)
const totalSizeKB = (totalSize / 1024).toFixed(2)
const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2)

console.log(`📦 Total bundle size: ${totalSizeKB} KB (${totalSizeMB} MB)`)

// JavaScript files
if (byType.js.length > 0) {
  console.log('\n🟡 JavaScript files:')
  byType.js.forEach(file => {
    const sizeStatus = file.size > 500 * 1024 ? '🔴' : file.size > 250 * 1024 ? '🟡' : '🟢'
    console.log(`  ${sizeStatus} ${file.path} - ${file.sizeKB} KB`)
  })

  const jsTotal = byType.js.reduce((sum, file) => sum + file.size, 0)
  console.log(`  📊 Total JS: ${(jsTotal / 1024).toFixed(2)} KB`)
}

// CSS files
if (byType.css.length > 0) {
  console.log('\n🔵 CSS files:')
  byType.css.forEach(file => {
    const sizeStatus = file.size > 100 * 1024 ? '🔴' : file.size > 50 * 1024 ? '🟡' : '🟢'
    console.log(`  ${sizeStatus} ${file.path} - ${file.sizeKB} KB`)
  })

  const cssTotal = byType.css.reduce((sum, file) => sum + file.size, 0)
  console.log(`  📊 Total CSS: ${(cssTotal / 1024).toFixed(2)} KB`)
}

// Performance recommendations
console.log('\n💡 Performance Recommendations:')

const largeJSFiles = byType.js.filter(f => f.size > 500 * 1024)
if (largeJSFiles.length > 0) {
  console.log('⚠️  Large JavaScript files detected (>500KB):')
  largeJSFiles.forEach(file => {
    console.log(`   • Consider code splitting for: ${file.path}`)
  })
}

const totalJSSize = byType.js.reduce((sum, file) => sum + file.size, 0)
if (totalJSSize > 1024 * 1024) { // 1MB
  console.log('⚠️  Total JavaScript size is large (>1MB)')
  console.log('   • Consider lazy loading components')
  console.log('   • Review dependencies for tree-shaking opportunities')
}

const totalCSSSize = byType.css.reduce((sum, file) => sum + file.size, 0)
if (totalCSSSize > 100 * 1024) { // 100KB
  console.log('⚠️  CSS bundle is large (>100KB)')
  console.log('   • Consider CSS purging')
  console.log('   • Review unused Tailwind classes')
}

if (totalSize < 1024 * 1024) { // Under 1MB
  console.log('✅ Bundle size is within recommended limits')
}

console.log('\n🎯 Build completed successfully!')
console.log('📈 Open dist/stats.html to view detailed bundle analysis')