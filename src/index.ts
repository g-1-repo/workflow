/**
 * G1 Workflow V2 - Enterprise Release Automation
 *
 * Main library exports for programmatic usage
 */

export { ErrorFormatter } from './core/error-formatter.js'
export type { FormattedError } from './core/error-formatter.js'
export { ErrorRecoveryService } from './core/error-recovery.js'
export type { ErrorAnalysis } from './core/error-recovery.js'
// Core exports
export { createTaskEngine, TaskEngine } from './core/task-engine.js'
// Type exports
export type {
  BranchOptions,
  CloudflareDeployment,
  CommitInfo,
  ConfigError,
  CustomDeployment,
  DeploymentError,
  FeatureOptions,
  GitError,
  NpmDeployment,
  PullRequestOptions,
  ReleaseOptions,
  TaskEngineOptions,
  TaskHelpers,
  WorkflowConfig,
  WorkflowContext,
  WorkflowError,
  WorkflowStep,
} from './types/index.js'

// Workflow exports
export { createReleaseWorkflow, deployToCloudflare, detectCloudflareSetup, hasNpmPublishingWorkflow, watchGitHubActions } from './workflows/release.js'

// Re-export consolidated Git operations from @g-1/util
export { createGitOperations as createGitStore, GitOperations as GitStore } from '@g-1/util/node'

/**
 * Quick release function for simple usage
 */
export async function quickRelease(options: import('./types/index.js').ReleaseOptions = {}) {
  const { createTaskEngine } = await import('./core/task-engine.js')
  const { createReleaseWorkflow } = await import('./workflows/release.js')

  const steps = await createReleaseWorkflow(options)
  const engine = createTaskEngine({
    showTimer: true,
  })

  return engine.execute(steps)
}

/**
 * Create a new workflow builder
 */
export function createWorkflow(_name: string) {
  const steps: import('./types/index.js').WorkflowStep[] = []

  return {
    step(title: string, task: import('./types/index.js').WorkflowStep['task']) {
      steps.push({ title, task })
      return this
    },

    group(title: string, subtasks: import('./types/index.js').WorkflowStep[]) {
      steps.push({ title, subtasks })
      return this
    },

    build() {
      return steps
    },
  }
}
