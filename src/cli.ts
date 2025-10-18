#!/usr/bin/env node

/**
 * go-workflow CLI - Enterprise release automation
 */

import type { ReleaseOptions } from './types/index.js'
import process from 'node:process'
import chalk from 'chalk'
import { program } from 'commander'
import { createTaskEngine } from './core/task-engine.js'
import { createReleaseWorkflow } from './workflows/release.js'
// Version from package.json
const version = '2.0.1'

program
  .name('go-workflow')
  .description('🚀 Enterprise release automation and workflow orchestration')
  .version(version)

// Release command
program
  .command('release')
  .description('🚀 Execute complete release workflow: quality gates → git → cloudflare → npm')
  .option('-t, --type <type>', 'Version bump type', /^(patch|minor|major)$/)
  .option('--skip-tests', 'Skip running tests')
  .option('--skip-lint', 'Skip linting')
  .option('--skip-cloudflare', 'Skip Cloudflare deployment')
  .option('--skip-npm', 'Skip npm publishing')
  .option('--dry-run', 'Show what would be done without executing')
  .option('--verbose', 'Show detailed output')
  .action(async (options: ReleaseOptions) => {
    try {
      console.log()
      console.log(chalk.cyan.bold('🚀 Go-Workflow V2 - Enterprise Release Automation'))
      console.log(chalk.gray(`Version ${version}\n`))

      if (options.dryRun) {
        console.log(chalk.yellow('🔍 DRY RUN MODE - No changes will be made\n'))
      }

      // Create workflow steps
      const steps = createReleaseWorkflow(options)

      // Create task engine with listr2
      const taskEngine = createTaskEngine({
        showTimer: true,
        clearOutput: false,
      })

      // Execute workflow
      const context = await taskEngine.execute(steps)

      // Success summary
      console.log()
      console.log(chalk.green.bold('🎉 Release completed successfully!'))

      if (context.version) {
        console.log(chalk.gray(`📦 Version: ${context.version.current} → ${context.version.next}`))
      }

      if (context.git) {
        console.log(chalk.gray(`📂 Repository: ${context.git.repository}`))
      }

      if (context.deployments?.cloudflare) {
        console.log(chalk.gray('☁️  Cloudflare: Deployed'))
      }

      if (context.deployments?.npm) {
        console.log(chalk.gray('📦 npm: Published'))
      }

      console.log()
    }
    catch (error) {
      console.log()
      console.log(chalk.red.bold('❌ Release failed'))
      console.log()

      if (error instanceof Error) {
        // Show the detailed error message
        console.log(chalk.red('🚑 Error Details:'))
        console.log(chalk.red(`  ${error.message}`))
        console.log()

        // Provide helpful suggestions based on error type
        if (error.message.includes('Tests failed')) {
          console.log(chalk.yellow('💡 Suggestion:'))
          console.log(chalk.yellow('  • Add test files to your project, or'))
          console.log(chalk.yellow('  • Skip tests with: bun run release --skip-tests'))
        }
        else if (error.message.includes('Uncommitted changes')) {
          console.log(chalk.yellow('💡 Suggestion:'))
          console.log(chalk.yellow('  • Commit your changes with: git add . && git commit -m "your message"'))
          console.log(chalk.yellow('  • Or stash them with: git stash'))
        }
        else if (error.message.includes('TypeScript errors')) {
          console.log(chalk.yellow('💡 Suggestion:'))
          console.log(chalk.yellow('  • Fix TypeScript errors with: bun run typecheck'))
          console.log(chalk.yellow('  • Or skip type checking with: bun run release --skip-lint'))
        }
        console.log()

        if (options.verbose && error.stack) {
          console.log(chalk.gray('Stack trace:'))
          console.log(chalk.gray(error.stack))
        }
      }

      process.exit(1)
    }
  })

// Feature branch command (placeholder for future)
program
  .command('feature')
  .description('🌟 Create and manage feature branches with AI-powered suggestions')
  .argument('[name]', 'Feature name (optional - will suggest if not provided)')
  .option('-t, --type <type>', 'Branch type', /^(feature|bugfix|hotfix)$/, 'feature')
  .option('--base <branch>', 'Base branch', 'main')
  .option('--auto-merge', 'Enable auto-merge when PR is approved')
  .action(async (_name, _options) => {
    console.log(chalk.yellow('🚧 Feature workflow coming soon in V2!'))
    console.log(chalk.gray('This will include:'))
    console.log(chalk.gray('• AI-powered branch name suggestions'))
    console.log(chalk.gray('• Automated PR creation'))
    console.log(chalk.gray('• Auto-merge and cleanup'))
  })

// Status command
program
  .command('status')
  .description('📊 Show project and workflow status')
  .action(async () => {
    console.log(chalk.cyan.bold('📊 Go-Workflow Status'))
    console.log(chalk.green(`✅ V2 Core: Task Engine with listr2`))
    console.log(chalk.green(`✅ V2 Release: Complete Git → Cloudflare → npm pipeline`))
    console.log(chalk.yellow(`🚧 V2 Feature: Branch management (coming soon)`))
    console.log(chalk.yellow(`🚧 V2 Config: Smart configuration system (coming soon)`))
    console.log(chalk.gray(`📦 Version: ${version}`))
  })

// Error handling
program.exitOverride()

try {
  program.parse()
}
catch (error) {
  if (error instanceof Error && error.message.includes('outputHelp')) {
    // User asked for help, don't show error
    process.exit(0)
  }

  console.log(chalk.red.bold('❌ Command failed'))
  if (error instanceof Error) {
    console.log(chalk.red(error.message))
  }
  process.exit(1)
}
