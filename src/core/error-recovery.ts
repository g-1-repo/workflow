/**
 * Automated Error Recovery System - Intelligent workflow error fixing
 */

import type { WorkflowContext, WorkflowStep } from '../types/index.js'
import chalk from 'chalk'
import { execa } from 'execa'
import { ErrorFormatter } from './error-formatter.js'
import { createTaskEngine } from './task-engine.js'

export interface ErrorAnalysis {
  type: 'linting' | 'typescript' | 'build' | 'authentication' | 'dependency' | 'unknown'
  severity: 'critical' | 'warning' | 'minor'
  fixable: boolean
  description: string
  suggestedFixes: string[]
}

export class ErrorRecoveryService {
  private static instance: ErrorRecoveryService

  private constructor() {}

  static getInstance(): ErrorRecoveryService {
    if (!ErrorRecoveryService.instance) {
      ErrorRecoveryService.instance = new ErrorRecoveryService()
    }
    return ErrorRecoveryService.instance
  }

  /**
   * Analyze error and determine if it can be automatically fixed
   */
  async analyzeError(error: Error, _context?: any): Promise<ErrorAnalysis> {
    const errorMessage = error.message.toLowerCase()
    const errorStack = error.stack?.toLowerCase() || ''

    // Linting errors
    if (errorMessage.includes('eslint') || errorMessage.includes('lint')
      || errorStack.includes('eslint') || errorMessage.includes('style')) {
      return {
        type: 'linting',
        severity: 'warning',
        fixable: true,
        description: 'ESLint or style-related errors detected',
        suggestedFixes: [
          'Run lint:fix to automatically fix issues',
          'Apply common lint pattern fixes',
          'Add eslint-disable comments for unfixable issues',
        ],
      }
    }

    // TypeScript errors
    if (errorMessage.includes('typescript') || errorMessage.includes('tsc')
      || errorMessage.includes('type') || errorStack.includes('typescript')) {
      return {
        type: 'typescript',
        severity: 'critical',
        fixable: false,
        description: 'TypeScript compilation errors',
        suggestedFixes: [
          'Fix type annotations',
          'Add missing imports',
          'Update tsconfig.json if needed',
        ],
      }
    }

    // Build errors
    if (errorMessage.includes('build') || errorMessage.includes('compile')
      || errorMessage.includes('bundl')) {
      return {
        type: 'build',
        severity: 'critical',
        fixable: true,
        description: 'Build or compilation errors',
        suggestedFixes: [
          'Clean and rebuild project',
          'Update dependencies',
          'Fix import paths',
        ],
      }
    }

    // Authentication errors
    if (errorMessage.includes('401') || errorMessage.includes('authentication')
      || errorMessage.includes('unauthorized') || errorMessage.includes('token')) {
      return {
        type: 'authentication',
        severity: 'critical',
        fixable: false,
        description: 'Authentication or authorization errors',
        suggestedFixes: [
          'Check npm token',
          'Re-authenticate with npm login',
          'Verify repository permissions',
        ],
      }
    }

    // Dependency errors
    if (errorMessage.includes('module') || errorMessage.includes('package')
      || errorMessage.includes('dependency') || errorMessage.includes('import')) {
      return {
        type: 'dependency',
        severity: 'warning',
        fixable: true,
        description: 'Missing or incompatible dependencies',
        suggestedFixes: [
          'Install missing dependencies',
          'Update package versions',
          'Clear node_modules and reinstall',
        ],
      }
    }

    return {
      type: 'unknown',
      severity: 'critical',
      fixable: false,
      description: 'Unknown error type',
      suggestedFixes: [
        'Check error logs manually',
        'Search for similar issues online',
        'Contact support if needed',
      ],
    }
  }

  /**
   * Create automated recovery workflow based on error analysis
   */
  async createRecoveryWorkflow(analysis: ErrorAnalysis, _originalError: Error): Promise<WorkflowStep[]> {
    const steps: WorkflowStep[] = []

    // Always start with error analysis display
    steps.push({
      title: 'Error Analysis',
      task: async (ctx, helpers) => {
        helpers.setOutput('Analyzing error for automated recovery...')

        const errorBox = ErrorFormatter.createErrorBox(
          'AUTOMATED ERROR RECOVERY',
          `Error Type: ${analysis.type} | Severity: ${analysis.severity} | Fixable: ${analysis.fixable ? 'Yes' : 'No'}`,
          analysis.suggestedFixes,
        )

        console.error(errorBox)
        helpers.setTitle(`Error Analysis - ✅ ${analysis.type} error detected`)
      },
    })

    // Add type-specific recovery steps
    switch (analysis.type) {
      case 'linting':
        steps.push(...await this.createLintingRecoverySteps())
        break

      case 'build':
        steps.push(...await this.createBuildRecoverySteps())
        break

      case 'dependency':
        steps.push(...await this.createDependencyRecoverySteps())
        break

      case 'typescript':
        steps.push({
          title: 'TypeScript Error Advisory',
          task: async (ctx, helpers) => {
            helpers.setOutput('TypeScript errors require manual intervention')
            console.error(chalk.yellow('⚠️  TypeScript errors cannot be automatically fixed'))
            console.error(chalk.gray('Please review and fix type errors manually'))
            helpers.setTitle('TypeScript Error Advisory - ✅ Manual intervention required')
          },
        })
        break

      case 'authentication':
        steps.push({
          title: 'Authentication Error Advisory',
          task: async (ctx, helpers) => {
            helpers.setOutput('Authentication errors require manual setup')
            console.error(chalk.yellow('⚠️  Authentication errors require manual intervention'))
            console.error(chalk.gray('Please check your npm token or run: npm login'))
            helpers.setTitle('Authentication Error Advisory - ✅ Manual intervention required')
          },
        })
        break

      default:
        steps.push({
          title: 'Unknown Error Advisory',
          task: async (ctx, helpers) => {
            helpers.setOutput('Unknown error requires manual investigation')
            console.error(chalk.yellow('⚠️  Unknown error type - manual investigation needed'))
            helpers.setTitle('Unknown Error Advisory - ✅ Manual intervention required')
          },
        })
    }

    // Always add a verification step
    steps.push({
      title: 'Recovery Verification',
      task: async (ctx, helpers) => {
        helpers.setOutput('Checking if error has been resolved...')

        if (analysis.fixable) {
          // Try to run basic quality checks
          try {
            await execa('bun', ['run', 'lint'], { stdio: 'pipe' })
            helpers.setOutput('Lint check passed')
          }
          catch {
            helpers.setOutput('Lint issues may still exist')
          }

          try {
            await execa('bun', ['run', 'typecheck'], { stdio: 'pipe' })
            helpers.setOutput('TypeScript check passed')
          }
          catch {
            helpers.setOutput('TypeScript issues may still exist')
          }
        }

        helpers.setTitle('Recovery Verification - ✅ Completed')

        // Show next steps
        console.error(`\\n${chalk.cyan.bold('RECOVERY COMPLETE')}`)
        console.error(chalk.gray('Consider running the original workflow again to verify fixes'))
      },
    })

    return steps
  }

  /**
   * Execute automated recovery workflow
   */
  async executeRecovery(error: Error, context?: WorkflowContext): Promise<void> {
    try {
      console.error(`\\n${chalk.cyan('═'.repeat(68))}`)
      console.error(chalk.cyan.bold('           AUTOMATED ERROR RECOVERY INITIATED           '))
      console.error(`${chalk.cyan('═'.repeat(68))}\\n`)

      const analysis = await this.analyzeError(error, context)
      const recoverySteps = await this.createRecoveryWorkflow(analysis, error)

      const taskEngine = createTaskEngine({
        concurrent: false,
        exitOnError: false, // Continue recovery even if some steps fail
        showTimer: true,
      })

      await taskEngine.execute(recoverySteps, context || {})
    }
    catch (recoveryError) {
      console.error(ErrorFormatter.formatError(recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError)), 'critical').message)
      console.error(chalk.red('\\nAutomated recovery failed. Manual intervention required.'))
    }
  }

  private async createLintingRecoverySteps(): Promise<WorkflowStep[]> {
    return [
      {
        title: 'Run lint:fix',
        task: async (ctx, helpers) => {
          helpers.setOutput('Running automatic lint fixes...')

          try {
            await execa('bun', ['run', 'lint:fix'], { stdio: 'pipe' })
            helpers.setTitle('Run lint:fix - ✅ Auto-fixes applied')
          }
          catch {
            try {
              await execa('npm', ['run', 'lint:fix'], { stdio: 'pipe' })
              helpers.setTitle('Run lint:fix - ✅ Auto-fixes applied (npm)')
            }
            catch {
              helpers.setTitle('Run lint:fix - ⚠️ No lint:fix script available')
            }
          }
        },
      },
      {
        title: 'Verify linting',
        task: async (ctx, helpers) => {
          helpers.setOutput('Checking if linting issues are resolved...')

          try {
            await execa('bun', ['run', 'lint'], { stdio: 'pipe' })
            helpers.setTitle('Verify linting - ✅ All issues resolved')
          }
          catch {
            helpers.setOutput('Some linting issues remain')
            helpers.setTitle('Verify linting - ⚠️ Manual fixes may be needed')
          }
        },
      },
      {
        title: 'Commit lint fixes',
        task: async (ctx, helpers) => {
          helpers.setOutput('Committing automated lint fixes...')

          try {
            // Check if there are changes to commit
            const statusResult = await execa('git', ['status', '--porcelain'], { stdio: 'pipe' })
            if (statusResult.stdout.trim()) {
              await execa('git', ['add', '.'], { stdio: 'pipe' })
              await execa('git', ['commit', '-m', 'fix: automated lint error fixes'], { stdio: 'pipe' })
              helpers.setTitle('Commit lint fixes - ✅ Changes committed')
            }
            else {
              helpers.setTitle('Commit lint fixes - ✅ No changes to commit')
            }
          }
          catch {
            helpers.setTitle('Commit lint fixes - ⚠️ Could not commit changes')
          }
        },
      },
    ]
  }

  private async createBuildRecoverySteps(): Promise<WorkflowStep[]> {
    return [
      {
        title: 'Clean build directory',
        task: async (ctx, helpers) => {
          helpers.setOutput('Cleaning build artifacts...')

          try {
            await execa('bun', ['run', 'clean'], { stdio: 'pipe' })
            helpers.setTitle('Clean build directory - ✅ Build artifacts cleaned')
          }
          catch {
            helpers.setTitle('Clean build directory - ⚠️ No clean script available')
          }
        },
      },
      {
        title: 'Reinstall dependencies',
        task: async (ctx, helpers) => {
          helpers.setOutput('Reinstalling dependencies...')

          try {
            // Remove node_modules and lock files
            await execa('rm', ['-rf', 'node_modules'], { stdio: 'pipe' })

            // Reinstall
            await execa('bun', ['install'], { stdio: 'pipe' })
            helpers.setTitle('Reinstall dependencies - ✅ Dependencies reinstalled')
          }
          catch {
            helpers.setTitle('Reinstall dependencies - ⚠️ Could not reinstall dependencies')
          }
        },
      },
      {
        title: 'Rebuild project',
        task: async (ctx, helpers) => {
          helpers.setOutput('Rebuilding project...')

          try {
            await execa('bun', ['run', 'build'], { stdio: 'pipe' })
            helpers.setTitle('Rebuild project - ✅ Build completed')
          }
          catch {
            helpers.setTitle('Rebuild project - ⚠️ Build still failing')
          }
        },
      },
    ]
  }

  private async createDependencyRecoverySteps(): Promise<WorkflowStep[]> {
    return [
      {
        title: 'Update dependencies',
        task: async (ctx, helpers) => {
          helpers.setOutput('Updating dependencies to latest versions...')

          try {
            await execa('bun', ['update'], { stdio: 'pipe' })
            helpers.setTitle('Update dependencies - ✅ Dependencies updated')
          }
          catch {
            helpers.setTitle('Update dependencies - ⚠️ Could not update dependencies')
          }
        },
      },
      {
        title: 'Install missing dependencies',
        task: async (ctx, helpers) => {
          helpers.setOutput('Installing any missing dependencies...')

          try {
            await execa('bun', ['install'], { stdio: 'pipe' })
            helpers.setTitle('Install missing dependencies - ✅ Installation completed')
          }
          catch {
            helpers.setTitle('Install missing dependencies - ⚠️ Installation failed')
          }
        },
      },
    ]
  }
}
