/**
 * go-workflow V2 - Enterprise Release Automation
 * 
 * Main library exports for programmatic usage
 */

// Core exports
export { TaskEngine, createTaskEngine } from './core/task-engine.js'
export { GitStore, createGitStore } from './core/git-store.js'

// Workflow exports
export { createReleaseWorkflow } from './workflows/release.js'

// Type exports
export type {
  WorkflowContext,
  WorkflowStep,
  TaskHelpers,
  TaskEngineOptions,
  ReleaseOptions,
  FeatureOptions,
  CommitInfo,
  BranchOptions,
  PullRequestOptions,
  WorkflowConfig,
  CloudflareDeployment,
  NpmDeployment,
  CustomDeployment,
  WorkflowError,
  GitError,
  ConfigError,
  DeploymentError
} from './types/index.js'

/**
 * Quick release function for simple usage
 */
export async function quickRelease(options: import('./types/index.js').ReleaseOptions = {}) {
  const { createTaskEngine } = await import('./core/task-engine.js')
  const { createReleaseWorkflow } = await import('./workflows/release.js')

  const steps = createReleaseWorkflow(options)
  const engine = createTaskEngine({
    showTimer: true
  })

  return engine.execute(steps)
}

/**
 * Create a new workflow builder
 */
export function createWorkflow(name: string) {
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
    }
  }
}