/**
 * Enterprise Task Engine - Native listr2 integration
 */

import type { ListrContext, ListrTask } from 'listr2'
import type {
  TaskEngineOptions,
  WorkflowContext,
  WorkflowStep,
} from '../types/index.js'
import chalk from 'chalk'
import { Listr } from 'listr2'
import { ErrorFormatter } from './error-formatter.js'
import { ErrorRecoveryService } from './error-recovery.js'

export class TaskEngine {
  constructor(private options: TaskEngineOptions = {}) {}

  /**
   * Execute workflow with native listr2 - This is the main entry point
   */
  async execute(steps: WorkflowStep[], context: WorkflowContext = {}): Promise<WorkflowContext> {
    const tasks: ListrTask[] = steps.map(step => this.createListrTask(step))

    const listr = new Listr(tasks, {
      concurrent: this.options.concurrent ?? false,
      exitOnError: this.options.exitOnError ?? true,
      rendererOptions: {
        collapseSubtasks: false,
        suffixSkips: true,
        showErrorMessage: true,
        showTimer: this.options.showTimer ?? true,
        clearOutput: this.options.clearOutput ?? false,
        // Enhanced error styling
        formatOutput: 'wrap',
        removeEmptyLines: false,
        indentation: 2,
        // Custom icons and colors for better error visibility
        icon: {
          COMPLETED: '✓',
          FAILED: '✗', // Red X for failures
          PAUSED: '⏸',
          ROLLING_BACK: '↶',
          SKIPPED: '↷',
          STARTED: '⧖',
        },
      },
      ctx: context as ListrContext,
    })

    try {
      const result = await listr.run()
      return result as WorkflowContext
    }
    catch (error) {
      if (error instanceof Error) {
        // Enhanced error formatting with red styling
        const formattedError = ErrorFormatter.formatPublishingFailure(error.message)
        console.error(formattedError)

        // Create detailed error box for critical workflow failures
        const errorBox = ErrorFormatter.createErrorBox(
          'WORKFLOW EXECUTION FAILED',
          error.message,
          [
            'Check the error details above',
            'Run with --verbose for more information',
            'Consider running automated error recovery',
          ],
        )
        console.error(errorBox)

        // Trigger automated error recovery if enabled
        if (this.options.autoRecovery !== false) {
          console.error(chalk.cyan('\n🔧 Starting automated error recovery...'))
          const recoveryService = ErrorRecoveryService.getInstance()
          await recoveryService.executeRecovery(error, context as WorkflowContext)
        }

        // Throw enhanced error for upstream handling
        const enhancedError = new Error(error.message)
        enhancedError.name = 'WorkflowExecutionError'
        throw enhancedError
      }
      throw error
    }
  }

  /**
   * Convert WorkflowStep to native listr2 ListrTask
   */
  private createListrTask(step: WorkflowStep): ListrTask {
    return {
      title: step.title,
      enabled: typeof step.enabled === 'function'
        ? ctx => (step.enabled as (ctx: WorkflowContext) => boolean)(ctx as WorkflowContext)
        : step.enabled,
      skip: typeof step.skip === 'function'
        ? async (ctx) => {
          const result = await (step.skip as (ctx: WorkflowContext) => boolean | string | Promise<boolean | string>)(ctx as WorkflowContext)
          return result
        }
        : step.skip,
      retry: step.retry,
      task: async (ctx, task) => {
        // Handle subtasks (groups)
        if (step.subtasks) {
          return task.newListr(
            step.subtasks.map(subtask => this.createListrTask(subtask)),
            {
              concurrent: step.concurrent ?? false,
              rendererOptions: {
                collapseSubtasks: false,
              },
            },
          )
        }

        // Execute main task with helpers
        if (step.task) {
          return await step.task(ctx as WorkflowContext, {
            setOutput: (output: string) => {
              task.output = output
            },
            setTitle: (title: string) => {
              task.title = title
            },
            setProgress: (current: number, total?: number) => {
              task.output = total ? `${current}/${total}` : `${current}%`
            },
          })
        }
      },
    }
  }
}

/**
 * Factory function
 */
export function createTaskEngine(options?: TaskEngineOptions): TaskEngine {
  return new TaskEngine(options)
}
