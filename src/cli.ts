#!/usr/bin/env node

/**
 * G1 Workflow CLI - Enterprise release automation
 */

import type { ReleaseOptions } from './types/index.js'
import process from 'node:process'
import chalk from 'chalk'
import { program } from 'commander'
import { createTaskEngine } from './core/task-engine.js'
import { createReleaseWorkflow, deployToCloudflare, detectCloudflareSetup, hasNpmPublishingWorkflow, watchGitHubActions } from './workflows/release.js'

// Load version from package.json
function getVersion(): string {
  try {
    // eslint-disable-next-line ts/no-require-imports
    const fs = require('node:fs')
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
    return packageJson.version || 'unknown'
  }
  catch {
    return 'unknown'
  }
}

const version = getVersion()

program
  .name('workflow')
  .description('🚀 Enterprise release automation and workflow orchestration')
  .version(version)

// Release command
program
  .command('release')
  .description('🚀 Execute complete release workflow: quality gates → git → cloudflare → GitHub release')
  .option('-t, --type <type>', 'Version bump type', /^(patch|minor|major)$/)
  .option('--skip-tests', 'Skip running tests')
  .option('--skip-lint', 'Skip linting')
  .option('--skip-cloudflare', 'Skip Cloudflare deployment')
  .option('--non-interactive', 'Run in non-interactive mode (skip prompts)')
  .option('--dry-run', 'Show what would be done without executing')
  .option('--verbose', 'Show detailed output')
  .option('--force', 'Skip uncommitted changes check (use with caution)')
  .action(async (options: ReleaseOptions) => {
    try {
      console.log()
      console.log(chalk.cyan('╔══════════════════════════════════════════════════════════╗'))
      console.log(chalk.cyan('║               G1 WORKFLOW V2 - RELEASE AUTOMATION        ║'))
      console.log(chalk.cyan('╚══════════════════════════════════════════════════════════╝'))
      console.log(chalk.gray(`                       Version ${version}\n`))

      if (options.dryRun) {
        console.log(chalk.yellow.bold('┌──────────────────────────────────────────────────────────────┐'))
        console.log(chalk.yellow.bold('│                     DRY RUN MODE ENABLED                     │'))
        console.log(chalk.yellow.bold('│                   No changes will be made                    │'))
        console.log(chalk.yellow.bold('└──────────────────────────────────────────────────────────────┘'))
        console.log()
      }

      // Create workflow steps (now async for interactive prompts)
      const steps = await createReleaseWorkflow(options)

      // Create task engine with listr2
      const taskEngine = createTaskEngine({
        showTimer: true,
        clearOutput: false,
      })

      // Execute workflow
      const context = await taskEngine.execute(steps)

      // Success summary
      console.log()
      console.log(chalk.green('╔═════════════════════════════════════════════════════════════════════╗'))
      console.log(chalk.green('║                   RELEASE COMPLETED SUCCESSFULLY!                   ║'))
      console.log(chalk.green('╚═════════════════════════════════════════════════════════════════════╝'))
      console.log()

      console.log(chalk.bold('Release Summary'))
      console.log(chalk.dim('─'.repeat(50)))

      if (context.version) {
        console.log(chalk.cyan(`  Version:     ${chalk.white(context.version.current)} → ${chalk.white.bold(context.version.next)}`))
      }

      if (context.git) {
        console.log(chalk.cyan(`  Repository:  ${chalk.white(context.git.repository)}`))
      }

      if (context.deployments?.cloudflare) {
        console.log(chalk.cyan(`  Cloudflare:  ${chalk.green('✓ Deployed')}`))
      }

      console.log(chalk.dim('─'.repeat(50)))
      console.log()

      // GitHub Actions monitoring prompt (skip in dry-run mode)
      if (!options.dryRun && !options.nonInteractive && context.git?.repository && context.version?.next) {
        // Check if this repository has npm publishing workflows
        const hasPublishing = await hasNpmPublishingWorkflow(context.git.repository)

        if (hasPublishing) {
          const enquirer = await import('enquirer')
          const response = await enquirer.default.prompt({
            type: 'confirm',
            name: 'watchActions',
            message: '🔍 Watch GitHub Actions for npm publishing?',
            initial: true,
            prefix: '  ',
          }) as { watchActions: boolean }

          if (response.watchActions) {
            const tagName = `v${context.version.next}`
            await watchGitHubActions(context.git.repository, tagName)
          }
        }
        else {
          console.log(chalk.dim('  📝 No npm publishing workflows detected - skipping monitoring prompt'))
        }
      }

      // Cloudflare deployment prompt (skip in dry-run mode)
      if (!options.dryRun && !options.nonInteractive) {
        // Check if this repository has Cloudflare setup
        const hasCloudflare = await detectCloudflareSetup()

        if (hasCloudflare) {
          const enquirer = await import('enquirer')
          const response = await enquirer.default.prompt({
            type: 'confirm',
            name: 'deployToCloudflare',
            message: '🚀 Deploy to Cloudflare Workers?',
            initial: true,
            prefix: '  ',
          }) as { deployToCloudflare: boolean }

          if (response.deployToCloudflare) {
            await deployToCloudflare()
          }
        }
      }
    }
    catch (error) {
      console.log()
      console.log(chalk.red('╔══════════════════════════════════════════════════════════════════╗'))
      console.log(chalk.red('║                          RELEASE FAILED                          ║'))
      console.log(chalk.red('╚══════════════════════════════════════════════════════════════════╝'))
      console.log()

      if (error instanceof Error) {
        // Show the detailed error message
        console.log(chalk.red.bold('Error Details'))
        console.log(chalk.red.dim('─'.repeat(30)))
        console.log(chalk.red(`  ${error.message}`))
        console.log()

        // Provide helpful suggestions based on error type
        if (error.message.includes('Tests failed')) {
          console.log(chalk.yellow.bold('Suggested Solutions'))
          console.log(chalk.yellow.dim('─'.repeat(30)))
          console.log(chalk.yellow('  • Add test files to your project, or'))
          console.log(chalk.yellow(`  • Skip tests with: ${chalk.white.bold('workflow release --skip-tests')}`))
        }
        else if (error.message.includes('Uncommitted changes')) {
          console.log(chalk.yellow.bold('Suggested Solutions'))
          console.log(chalk.yellow.dim('─'.repeat(30)))
          console.log(chalk.yellow(`  • Commit your changes with: ${chalk.white.bold('git add . && git commit -m "your message"')}`))
          console.log(chalk.yellow(`  • Or stash them with: ${chalk.white.bold('git stash')}`))
        }
        else if (error.message.includes('TypeScript errors')) {
          console.log(chalk.yellow.bold('Suggested Solutions'))
          console.log(chalk.yellow.dim('─'.repeat(30)))
          console.log(chalk.yellow(`  • Fix TypeScript errors with: ${chalk.white.bold('bun run typecheck')}`))
          console.log(chalk.yellow(`  • Or skip type checking with: ${chalk.white.bold('workflow release --skip-lint')}`))
        }
        console.log()

        if (options.verbose && error.stack) {
          console.log(chalk.gray.bold('Stack Trace'))
          console.log(chalk.gray.dim('─'.repeat(30)))
          console.log(chalk.gray(error.stack))
          console.log()
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

// Test error recovery command
program
  .command('test-error-recovery')
  .description('🧪 Test automated error recovery system with sample errors')
  .option('--direct', 'Test error recovery directly without triggering a workflow')
  .action(async (options) => {
    try {
      const { testErrorRecovery, testErrorRecoveryDirectly } = await import('./test-error-recovery.js')

      if (options.direct) {
        await testErrorRecoveryDirectly()
      }
      else {
        await testErrorRecovery()
      }
    }
    catch (error) {
      console.log(chalk.red('❌ Error recovery test failed'))
      if (error instanceof Error) {
        console.log(chalk.red(error.message))
      }
      process.exit(1)
    }
  })

// Status command
program
  .command('status')
  .description('📊 Show project and workflow status')
  .action(async () => {
    console.log(chalk.cyan.bold('📊 G1 Workflow Status'))
    console.log(chalk.green(`✅ V2 Core: Task Engine with listr2`))
    console.log(chalk.green(`✅ V2 Release: Complete Git → Cloudflare → npm pipeline`))
    console.log(chalk.green(`✅ V2 Error Recovery: Automated error fixing system`))
    console.log(chalk.yellow(`🚧 V2 Feature: Branch management (coming soon)`))
    console.log(chalk.yellow(`🚧 V2 Config: Smart configuration system (coming soon)`))
    console.log(chalk.gray(`📦 Version: ${version}`))
    console.log()
    console.log(chalk.cyan.bold('🧪 Test Commands'))
    console.log(chalk.gray(`  workflow test-error-recovery     Test error recovery with sample workflow`))
    console.log(chalk.gray(`  workflow test-error-recovery --direct    Test error recovery directly`))
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
