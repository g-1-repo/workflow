/**
 * Complete Release Workflow - Git → Cloudflare → GitHub Release (triggers npm via Actions)
 */

import type { ReleaseOptions, WorkflowStep } from '../types/index.js'
import process from 'node:process'
import { createGitOperations } from '@g-1/util/node'
import chalk from 'chalk'
import { execa } from 'execa'
import * as semver from 'semver'

// Detection functions (detectCloudflareSetup moved to exports below)

export async function hasNpmPublishingWorkflow(repositoryName: string): Promise<boolean> {
  try {
    // First check if .github/workflows directory exists locally
    const fs = await import('node:fs/promises')
    const workflowsPath = '.github/workflows'

    try {
      const files = await fs.readdir(workflowsPath)
      const workflowFiles = files.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))

      // Check each workflow file for npm publishing patterns
      for (const file of workflowFiles) {
        const content = await fs.readFile(`${workflowsPath}/${file}`, 'utf-8')
        const hasNpmPublish = content.toLowerCase().includes('npm publish')
          || content.toLowerCase().includes('registry.npmjs.org')
          || content.toLowerCase().includes('npmjs_token')
          || content.toLowerCase().includes('npm_token')

        if (hasNpmPublish) {
          return true
        }
      }
    }
    catch {
      // Local .github/workflows doesn't exist, try GitHub API
    }

    // Fallback: Use GitHub CLI to check workflows in the repo
    try {
      const result = await execa('gh', [
        'workflow',
        'list',
        '--repo',
        repositoryName,
        '--json',
        'name',
      ], { stdio: 'pipe' })

      const workflows = JSON.parse(result.stdout)
      return workflows.some((workflow: any) => {
        const name = workflow.name?.toLowerCase() || ''
        return (name.includes('publish') && name.includes('npm'))
          || name === 'publish to npm'
          || name === 'npm publish'
          || name === 'publish npm'
          || name === 'npm'
      })
    }
    catch {
      // If GitHub CLI fails, assume no publishing workflows
      return false
    }
  }
  catch {
    return false
  }
}

export async function detectCloudflareSetup(): Promise<boolean> {
  try {
    const fs = await import('node:fs/promises')
    // Check for wrangler.toml, wrangler.json, or wrangler.jsonc
    const wranglerFiles = ['wrangler.toml', 'wrangler.json', 'wrangler.jsonc']

    for (const file of wranglerFiles) {
      try {
        await fs.access(file)
        return true
      }
      catch {
        // Continue to next file
      }
    }

    return false
  }
  catch {
    return false
  }
}

export async function createReleaseWorkflow(options: ReleaseOptions = {}): Promise<WorkflowStep[]> {
  // Skip Cloudflare deployment during main workflow - will prompt after completion
  if (options.skipCloudflare === undefined) {
    options.skipCloudflare = true
  }

  // Handle uncommitted changes upfront (before workflow starts)
  if (!options.force) {
    const git = createGitOperations()
    const hasChanges = await git.hasUncommittedChanges()

    if (hasChanges) {
      const changedFiles = await git.getChangedFiles()
      const changesList = changedFiles.map(file => `    ${file}`).join('\n')

      process.stdout.write('\n')
      process.stdout.write('╔═══════════════════════════════════════════════════════╗\n')
      process.stdout.write('║                  UNCOMMITTED CHANGES                  ║\n')
      process.stdout.write('╚═══════════════════════════════════════════════════════╝\n')
      process.stdout.write('\n')
      process.stdout.write('\x1B[1m\x1B[33mThe following files have uncommitted changes:\x1B[0m\n')
      process.stdout.write(`\n${changesList}\n\n`)
      process.stdout.write('\x1B[2m────────────────────────────────────────────────────────────────\x1B[0m\n')
      process.stdout.write('\x1B[1mHow would you like to proceed?\x1B[0m\n')
      process.stdout.write('\n')

      if (!options.nonInteractive) {
        const enquirer = await import('enquirer')
        const response = await enquirer.default.prompt({
          type: 'select',
          name: 'action',
          message: '  Choose an action:',
          choices: [
            { name: 'commit', message: 'Commit all changes now', value: 'commit' },
            { name: 'stash', message: 'Stash changes for later', value: 'stash' },
            { name: 'force', message: 'Continue anyway (--force)', value: 'force' },
          ],
          prefix: '  ',
        }) as { action: 'commit' | 'stash' | 'force' }

        process.stdout.write('\n')

        if (response.action === 'commit') {
          process.stdout.write('\x1B[1m\x1B[36m→ Commit Configuration\x1B[0m\n')
          process.stdout.write('  Enter a commit message for these changes\n')
          process.stdout.write('\n')

          // Get commit message
          const commitResponse = await enquirer.default.prompt({
            type: 'input',
            name: 'message',
            message: '  Commit message:',
            initial: 'chore: commit changes before release',
            prefix: '  ',
          }) as { message: string }

          // Commit changes
          process.stdout.write('\n\x1B[2mCommitting changes...\x1B[0m\n')
          await git.stageFiles(changedFiles)
          await git.commit(commitResponse.message)
          process.stdout.write('\x1B[32m✅ Changes committed successfully\x1B[0m\n')
        }
        else if (response.action === 'stash') {
          process.stdout.write('\x1B[2mStashing changes...\x1B[0m\n')
          await execa('git', ['stash', 'push', '-m', 'Pre-release stash'], { stdio: 'pipe' })
          process.stdout.write('\x1B[32m✅ Changes stashed successfully\x1B[0m\n')
        }
        else if (response.action === 'force') {
          options.force = true
          process.stdout.write('\x1B[33m⚠️  Continuing with uncommitted changes\x1B[0m\n')
        }

        process.stdout.write('\n')
      }
      else {
        // Non-interactive mode - just show error and exit
        process.stdout.write('❌ Cannot proceed with uncommitted changes in non-interactive mode\n')
        process.stdout.write('Use --force flag to override or commit/stash changes first\n')
        process.exit(1)
      }
    }
  }

  // Set defaults for non-interactive mode
  if (options.nonInteractive && options.skipCloudflare === undefined) {
    options.skipCloudflare = true
  }

  return [
    // Quality Gates
    {
      title: 'Quality Gates',
      subtasks: [
        {
          title: 'Auto-fix linting issues',
          skip: () => options.skipLint || false,
          task: async (ctx, helpers) => {
            helpers.setOutput('Running lint with auto-fix...')

            try {
              await execa('bun', ['run', 'lint:fix'], { stdio: 'pipe' })
              helpers.setTitle('Auto-fix linting issues - ✅ Fixed')
            }
            catch {
              // Try npm fallback
              try {
                await execa('npm', ['run', 'lint:fix'], { stdio: 'pipe' })
                helpers.setTitle('Auto-fix linting issues - ✅ Fixed with npm')
              }
              catch {
                // Try direct eslint
                try {
                  await execa('bunx', ['eslint', '.', '--fix'], { stdio: 'pipe' })
                  helpers.setTitle('Auto-fix linting issues - ✅ Fixed with bunx')
                }
                catch {
                  helpers.setTitle('Auto-fix linting issues - ⚠️ No lint command found')
                }
              }
            }
          },
        },
        {
          title: 'Type checking',
          task: async (ctx, helpers) => {
            helpers.setOutput('Running TypeScript type checking...')

            try {
              await execa('bun', ['run', 'typecheck'], { stdio: 'pipe' })
              helpers.setTitle('Type checking - ✅ Passed')
            }
            catch {
              try {
                await execa('npm', ['run', 'typecheck'], { stdio: 'pipe' })
                helpers.setTitle('Type checking - ✅ Passed with npm')
              }
              catch {
                try {
                  await execa('bunx', ['tsc', '--noEmit'], { stdio: 'pipe' })
                  helpers.setTitle('Type checking - ✅ Passed with bunx')
                }
                catch {
                  throw new Error('TypeScript errors found. Please fix before releasing.')
                }
              }
            }
          },
        },
        {
          title: 'Running tests',
          skip: () => options.skipTests || false,
          task: async (ctx, helpers) => {
            helpers.setOutput('Executing test suite...')

            // Define test command priority order
            const testCommands: Array<[string, string[]]> = [
              ['bun', ['run', 'test:ci']], // CI test command (preferred)
              ['bun', ['run', 'test']], // Standard test command
              ['bun', ['test']], // Direct bun test
              ['npm', ['run', 'test:ci']], // npm CI fallback
              ['npm', ['run', 'test']], // npm standard fallback
              ['npm', ['test']], // npm direct fallback
            ]

            let lastError: any = null

            for (const [command, args] of testCommands) {
              try {
                helpers.setOutput(`Trying ${command} ${args.join(' ')}...`)
                const _result = await execa(command, args, { stdio: 'pipe' })
                ctx.quality = { lintPassed: ctx.quality?.lintPassed ?? true, testsPassed: true }
                helpers.setTitle(`Running tests - ✅ All tests passed (${command})`)
                return // Success! Exit early
              }
              catch (error) {
                const errorOutput = error instanceof Error ? error.message : String(error)

                // Check if it's a "no tests found" or "script not found" error
                if (errorOutput.includes('No tests found')
                  || errorOutput.includes('no test files')
                  || errorOutput.includes('script not found')
                  || errorOutput.includes('Missing script')) {
                  // Try next command
                  lastError = error
                  continue
                }

                // If it's a real test failure (not a missing script), stop trying
                if (errorOutput.includes('fail') || errorOutput.includes('Test')) {
                  const lines = errorOutput.split('\n')
                  const summary = lines.find(line => line.includes('fail')) || 'Tests failed'
                  ctx.quality = { lintPassed: ctx.quality?.lintPassed ?? true, testsPassed: false }
                  throw new Error(`Test failures detected: ${summary}`)
                }

                // Store error and try next command
                lastError = error
              }
            }

            // If we get here, all commands failed - check if it's because no tests exist
            const lastErrorOutput = lastError instanceof Error ? lastError.message : String(lastError)
            if (lastErrorOutput.includes('No tests found')
              || lastErrorOutput.includes('no test files')
              || lastErrorOutput.includes('script not found')
              || lastErrorOutput.includes('Missing script')) {
              ctx.quality = { lintPassed: ctx.quality?.lintPassed ?? true, testsPassed: true }
              helpers.setTitle('Running tests - ✅ No tests found (skipping)')
              return
            }

            // Real test failure
            ctx.quality = { lintPassed: ctx.quality?.lintPassed ?? true, testsPassed: false }
            throw new Error(`Tests failed: ${lastErrorOutput}`)
          },
        },
      ],
    },

    // Git Operations
    {
      title: 'Git repository analysis',
      task: async (ctx, helpers) => {
        helpers.setOutput('Initializing Git operations...')
        const git = createGitOperations()

        helpers.setOutput('Checking repository status...')
        const isRepo = await git.isGitRepository()
        if (!isRepo) {
          throw new Error('Not a Git repository')
        }

        helpers.setOutput('Getting current branch and version...')
        const currentBranch = await git.getCurrentBranch()
        const currentVersion = await git.getCurrentVersion()
        const repository = await git.getRepositoryName()

        // Uncommitted changes are now handled upfront before workflow starts
        const hasChanges = await git.hasUncommittedChanges()
        if (hasChanges && options.force) {
          helpers.setOutput('⚠️  Uncommitted changes detected but continuing due to --force flag')
        }

        // Store git info in context
        ctx.git = {
          branch: currentBranch,
          hasChanges,
          commits: [],
          remote: 'origin',
          repository,
        }

        ctx.version = {
          current: currentVersion,
          next: '', // Will be calculated next
          type: options.type || 'patch',
          strategy: 'semantic',
        }

        helpers.setTitle(`Git repository analysis - ✅ ${repository} on ${currentBranch}`)
      },
    },

    // Version Analysis
    {
      title: 'Version calculation',
      task: async (ctx, helpers) => {
        const git = createGitOperations()

        helpers.setOutput('Analyzing commits since last release...')
        const commits = await git.getCommitsSinceTag()
        ctx.git!.commits = commits

        let versionBump = options.type || 'patch'

        if (!options.type) {
          helpers.setOutput('Determining semantic version bump...')

          // Analyze commits for version bump
          const hasBreaking = commits.some(c => c.breaking)
          const hasFeatures = commits.some(c => c.type === 'feat')

          if (hasBreaking) {
            versionBump = 'major'
          }
          else if (hasFeatures) {
            versionBump = 'minor'
          }
          else {
            versionBump = 'patch'
          }
        }

        const nextVersion = semver.inc(ctx.version!.current, versionBump)
        if (!nextVersion) {
          throw new Error(`Failed to calculate next version from ${ctx.version!.current}`)
        }

        ctx.version!.next = nextVersion
        ctx.version!.type = versionBump

        helpers.setTitle(`Version calculation - ✅ ${ctx.version!.current} → ${nextVersion} (${versionBump})`)
      },
    },

    // Deployment Summary
    {
      title: 'Deployment configuration',
      task: async (ctx, helpers) => {
        const deployments = []

        if (!options.skipCloudflare)
          deployments.push('Cloudflare')

        const summary = deployments.length > 0
          ? `Will deploy to: ${deployments.join(', ')}`
          : 'Cloudflare deployment skipped'

        helpers.setTitle(`Deployment configuration - ✅ ${summary} | npm: GitHub Actions`)
      },
    },

    // Release Execution
    {
      title: 'Release execution',
      subtasks: [
        {
          title: 'Update package.json version',
          task: async (ctx, helpers) => {
            const git = createGitOperations()
            helpers.setOutput(`Setting version to ${ctx.version!.next}...`)

            await git.updatePackageVersion(ctx.version!.next)
            helpers.setTitle(`Update package.json version - ✅ ${ctx.version!.next}`)
          },
        },
        {
          title: 'Generate changelog',
          task: async (ctx, helpers) => {
            helpers.setOutput('Generating changelog entry...')

            // Simple changelog generation - can be enhanced
            const fs = await import('node:fs/promises')
            const changelogPath = 'CHANGELOG.md'

            const changelogEntry = generateChangelogEntry(
              ctx.version!.next,
              ctx.git!.commits,
            )

            try {
              const existingChangelog = await fs.readFile(changelogPath, 'utf-8')
              const updatedChangelog = insertChangelogEntry(existingChangelog, changelogEntry)
              await fs.writeFile(changelogPath, updatedChangelog)
            }
            catch {
              // Create new changelog
              const newChangelog = `# Changelog\n\n${changelogEntry}`
              await fs.writeFile(changelogPath, newChangelog)
            }

            helpers.setTitle('Generate changelog - ✅ CHANGELOG.md updated')
          },
        },
        {
          title: 'Commit release changes',
          task: async (ctx, helpers) => {
            const git = createGitOperations()

            helpers.setOutput('Staging files...')
            await git.stageFiles(['package.json', 'CHANGELOG.md'])

            helpers.setOutput('Creating release commit...')
            const commitMessage = `chore: release v${ctx.version!.next}`
            await git.commit(commitMessage)

            helpers.setTitle(`Commit release changes - ✅ ${commitMessage}`)
          },
        },
        {
          title: 'Create git tag',
          task: async (ctx, helpers) => {
            const git = createGitOperations()
            const tagName = `v${ctx.version!.next}`

            helpers.setOutput(`Creating tag ${tagName}...`)
            await git.createTag(tagName, `Release ${ctx.version!.next}`)

            helpers.setTitle(`Create git tag - ✅ ${tagName}`)
          },
        },
        {
          title: 'Push to remote',
          task: async (ctx, helpers) => {
            const git = createGitOperations()

            helpers.setOutput('Pushing commits...')
            await git.push()

            helpers.setOutput('Pushing tags...')
            await git.pushTags()

            helpers.setTitle('Push to remote - ✅ Complete')
          },
        },
      ],
    },

    // Build for deployment
    {
      title: 'Build project',
      task: async (ctx, helpers) => {
        helpers.setOutput('Building project for deployment...')

        const buildCommands: Array<[string, string[]]> = [
          ['bun', ['run', 'build']],
          ['npm', ['run', 'build']],
        ]

        let lastError: any = null

        for (const [command, args] of buildCommands) {
          try {
            helpers.setOutput(`Trying ${command} ${args.join(' ')}...`)
            await execa(command, args, { stdio: 'pipe' })
            helpers.setTitle(`Build project - ✅ Build complete (${command})`)
            return // Success! Exit early
          }
          catch (error) {
            const errorOutput = error instanceof Error ? error.message : String(error)

            // Check if it's a missing script error
            if (errorOutput.includes('script not found')
              || errorOutput.includes('Missing script')
              || errorOutput.includes('npm ERR! missing script')
              || errorOutput.includes('Script not found')) {
              lastError = error
              continue
            }

            // Real build error - don't continue
            throw new Error(`Build failed: ${errorOutput}`)
          }
        }

        // If we get here, build script wasn't found - that's okay for some projects
        if (lastError) {
          const lastErrorOutput = lastError instanceof Error ? lastError.message : String(lastError)
          if (lastErrorOutput.includes('script not found')
            || lastErrorOutput.includes('Missing script')
            || lastErrorOutput.includes('npm ERR! missing script')
            || lastErrorOutput.includes('Script not found')) {
            helpers.setTitle('Build project - ✅ No build script found (skipping)')
            return
          }
        }

        throw new Error('Build failed. Cannot proceed with deployment.')
      },
    },

    // Cloudflare Deployment
    {
      title: 'Deploy to Cloudflare',
      skip: () => options.skipCloudflare || false,
      task: async (ctx, helpers) => {
        helpers.setOutput('Deploying to Cloudflare...')

        try {
          const result = await execa('npx', ['wrangler', 'deploy'], { stdio: 'pipe' })

          // Extract deployment URL from output
          const output = result.stdout
          const urlMatch = output.match(/https?:\/\/\S+/)
          const deploymentUrl = urlMatch?.[0] || 'Deployed successfully'

          ctx.deployments = {
            ...ctx.deployments,
            cloudflare: {
              environment: 'production',
            },
          }

          helpers.setTitle(`Deploy to Cloudflare - ✅ ${deploymentUrl}`)
        }
        catch (error) {
          // Don't fail the entire workflow if Cloudflare deployment fails
          const errorMessage = error instanceof Error ? error.message : String(error)
          if (errorMessage.includes('Missing entry-point')) {
            helpers.setTitle('Deploy to Cloudflare - ⚠️ Failed: No wrangler config (continuing)')
          }
          else if (errorMessage.includes('not authenticated')) {
            helpers.setTitle('Deploy to Cloudflare - ⚠️ Failed: Not authenticated (continuing)')
          }
          else {
            helpers.setTitle('Deploy to Cloudflare - ⚠️ Failed (continuing)')
          }
        }
      },
    },

    // GitHub Release (triggers npm publishing via GitHub Actions)
    {
      title: 'Create GitHub release',
      task: async (ctx, helpers) => {
        helpers.setOutput('Creating GitHub release (triggers npm publishing)...')

        try {
          const releaseNotes = generateReleaseNotes(ctx.git!.commits, ctx.version!.next)

          await execa('gh', [
            'release',
            'create',
            `v${ctx.version!.next}`,
            '--title',
            `Release v${ctx.version!.next}`,
            '--notes',
            releaseNotes,
          ], { stdio: 'pipe' })

          helpers.setOutput('GitHub Actions will automatically publish to npm if package.json is detected')
          helpers.setTitle(`Create GitHub release - ✅ v${ctx.version!.next} → npm via Actions`)
        }
        catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          if (errorMessage.includes('gh: command not found')) {
            helpers.setTitle('Create GitHub release - ⚠️ Failed: GitHub CLI not installed')
            helpers.setOutput('❌ Install: https://cli.github.com/')
          }
          else if (errorMessage.includes('not authenticated') || errorMessage.includes('401')) {
            helpers.setTitle('Create GitHub release - ⚠️ Failed: Not authenticated')
            helpers.setOutput('❌ Run: gh auth login')
          }
          else {
            helpers.setTitle('Create GitHub release - ⚠️ Failed (continuing)')
            helpers.setOutput(`Error: ${errorMessage.slice(0, 60)}...`)
          }
        }
      },
    },
  ]
}

// =============================================================================
// Helper Functions
// =============================================================================

function generateChangelogEntry(version: string, commits: any[]): string {
  const date = new Date().toISOString().split('T')[0]
  let entry = `## [${version}] - ${date}\n\n`

  const features = commits.filter(c => c.type === 'feat')
  const fixes = commits.filter(c => c.type === 'fix')
  const others = commits.filter(c => !['feat', 'fix'].includes(c.type))

  if (features.length > 0) {
    entry += '### Features\n\n'
    features.forEach((commit) => {
      entry += `- ${commit.message.replace(/^feat(\([^)]+\))?: /, '')}\n`
    })
    entry += '\n'
  }

  if (fixes.length > 0) {
    entry += '### Bug Fixes\n\n'
    fixes.forEach((commit) => {
      entry += `- ${commit.message.replace(/^fix(\([^)]+\))?: /, '')}\n`
    })
    entry += '\n'
  }

  if (others.length > 0) {
    entry += '### Other Changes\n\n'
    others.forEach((commit) => {
      entry += `- ${commit.message}\n`
    })
    entry += '\n'
  }

  return entry
}

function insertChangelogEntry(existingChangelog: string, newEntry: string): string {
  const lines = existingChangelog.split('\n')
  const headerIndex = lines.findIndex(line => line.startsWith('# '))

  if (headerIndex === -1) {
    return `# Changelog\n\n${newEntry}\n${existingChangelog}`
  }

  // Insert after header
  lines.splice(headerIndex + 2, 0, newEntry)
  return lines.join('\n')
}

function generateReleaseNotes(commits: any[], version: string): string {
  const features = commits.filter(c => c.type === 'feat')
  const fixes = commits.filter(c => c.type === 'fix')

  let notes = `Release v${version}\n\n`

  if (features.length > 0) {
    notes += '## ✨ New Features\n'
    features.forEach((commit) => {
      notes += `- ${commit.message.replace(/^feat(\([^)]+\))?: /, '')}\n`
    })
    notes += '\n'
  }

  if (fixes.length > 0) {
    notes += '## 🐛 Bug Fixes\n'
    fixes.forEach((commit) => {
      notes += `- ${commit.message.replace(/^fix(\([^)]+\))?: /, '')}\n`
    })
    notes += '\n'
  }

  if (commits.length > features.length + fixes.length) {
    const others = commits.length - features.length - fixes.length
    notes += `## 📦 Other Changes\n${others} other commits included in this release.\n\n`
  }

  return notes
}

// =============================================================================
// GitHub Actions Monitoring
// =============================================================================

export async function watchGitHubActions(repositoryName: string, tagName: string): Promise<void> {
  try {
    process.stdout.write('\n')
    process.stdout.write('╔════════════════════════════════════════════════════════════════╗\n')
    process.stdout.write('║                    GITHUB ACTIONS MONITOR                      ║\n')
    process.stdout.write('╚════════════════════════════════════════════════════════════════╝\n')
    process.stdout.write('\n')
    process.stdout.write(`Watching for publishing workflow triggered by ${chalk.cyan(tagName)}...\n`)
    process.stdout.write('\n')

    let foundPublishingWorkflow = false
    const maxAttempts = 30 // Wait up to 30 seconds for workflow to start
    let attempts = 0

    // Wait for publishing workflow to start
    while (!foundPublishingWorkflow && attempts < maxAttempts) {
      try {
        const result = await execa('gh', [
          'run',
          'list',
          '--repo',
          repositoryName,
          '--event',
          'release',
          '--limit',
          '5',
          '--json',
          'status,name,workflowName,createdAt,number,databaseId',
        ], { stdio: 'pipe' })

        const runs = JSON.parse(result.stdout)
        const recentPublishRun = runs.find((run: any) => {
          const isPublishWorkflow = run.workflowName?.toLowerCase().includes('publish')
            || run.workflowName?.toLowerCase().includes('npm')

          if (!isPublishWorkflow)
            return false

          // Check if this run was created recently (within last 5 minutes)
          const runCreatedAt = new Date(run.createdAt)
          const now = new Date()
          const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

          return runCreatedAt >= fiveMinutesAgo
        })

        if (recentPublishRun) {
          foundPublishingWorkflow = true
          process.stdout.write(`✓ Found publishing workflow: ${chalk.green(recentPublishRun.workflowName)}\n`)
          process.stdout.write(`  Run #: ${chalk.gray(recentPublishRun.number)}\n`)
          process.stdout.write(`  Created: ${chalk.gray(new Date(recentPublishRun.createdAt).toLocaleTimeString())}\n`)
          process.stdout.write('\n')

          // If workflow is already completed, show results immediately
          if (recentPublishRun.status === 'completed') {
            process.stdout.write(`✓ Status: ${chalk.green('Completed')} (already finished)\n`)
            await showCompletedWorkflowResults(repositoryName, recentPublishRun.databaseId)
          }
          else {
            // Monitor the running workflow
            await monitorWorkflowRun(repositoryName, recentPublishRun.databaseId)
          }
          return
        }

        process.stdout.write(`⧖ Waiting for publishing workflow to start... (${attempts + 1}/${maxAttempts})\r`)
        await new Promise(resolve => setTimeout(resolve, 1000))
        attempts++
      }
      catch (error) {
        process.stdout.write(`\nError checking workflows: ${error instanceof Error ? error.message : String(error)}\n`)
        break
      }
    }

    if (!foundPublishingWorkflow) {
      process.stdout.write(`\nNo publishing workflow found within ${maxAttempts} seconds\n`)
      process.stdout.write('This might mean:\n')
      process.stdout.write('  - No GitHub Actions configured for npm publishing\n')
      process.stdout.write('  - Publishing workflow uses a different trigger\n')
      process.stdout.write('  - Workflow is still starting (check GitHub manually)\n')
      process.stdout.write('\n')
    }
  }
  catch (error) {
    process.stdout.write(`\nFailed to monitor GitHub Actions: ${error instanceof Error ? error.message : String(error)}\n`)
    if (error instanceof Error && error.message.includes('gh: command not found')) {
      process.stdout.write('Install GitHub CLI: https://cli.github.com/\n')
    }
  }
}

async function monitorWorkflowRun(repositoryName: string, runNumber: string | number): Promise<void> {
  let isCompleted = false
  let lastStatus = ''

  while (!isCompleted) {
    try {
      const result = await execa('gh', [
        'run',
        'view',
        String(runNumber),
        '--repo',
        repositoryName,
        '--json',
        'status,conclusion,jobs',
      ], { stdio: 'pipe' })

      const runData = JSON.parse(result.stdout)

      if (runData.status !== lastStatus) {
        lastStatus = runData.status

        if (runData.status === 'in_progress') {
          process.stdout.write(`⧖ Publishing workflow is running...\n`)

          // Show job progress
          if (runData.jobs && runData.jobs.length > 0) {
            for (const job of runData.jobs) {
              const statusIcon = job.conclusion === 'success'
                ? '✓'
                : job.conclusion === 'failure'
                  ? '✗'
                  : job.status === 'in_progress' ? '⧖' : '-'
              process.stdout.write(`  ${statusIcon} ${job.name}\n`)
            }
          }
        }
        else if (runData.status === 'completed') {
          isCompleted = true

          if (runData.conclusion === 'success') {
            process.stdout.write('\n')
            process.stdout.write(`✓ ${chalk.green.bold('Publishing workflow completed successfully!')}\n`)

            // Check if npm package is available
            process.stdout.write('⧖ Verifying npm package availability...\n')
            await checkNpmPackage(repositoryName)
          }
          else {
            process.stdout.write('\n')
            process.stdout.write(`✗ ${chalk.red.bold('Publishing workflow failed')}\n`)
            process.stdout.write(`View details: https://github.com/${repositoryName}/actions/runs/${runNumber}\n`)
          }
        }
      }

      if (!isCompleted) {
        await new Promise(resolve => setTimeout(resolve, 3000)) // Check every 3 seconds
      }
    }
    catch (error) {
      process.stdout.write(`\nError monitoring workflow: ${error instanceof Error ? error.message : String(error)}\n`)
      break
    }
  }
}

async function showCompletedWorkflowResults(repositoryName: string, runId: string | number): Promise<void> {
  try {
    const result = await execa('gh', [
      'run',
      'view',
      String(runId),
      '--repo',
      repositoryName,
      '--json',
      'conclusion,jobs',
    ], { stdio: 'pipe' })

    const runData = JSON.parse(result.stdout)

    if (runData.conclusion === 'success') {
      process.stdout.write('\n')
      process.stdout.write(`✓ ${chalk.green.bold('Publishing workflow completed successfully!')}\n`)

      // Show job results
      if (runData.jobs && runData.jobs.length > 0) {
        for (const job of runData.jobs) {
          const statusIcon = job.conclusion === 'success' ? '✓' : '✗'
          process.stdout.write(`  ${statusIcon} ${job.name}\n`)
        }
      }

      // Check if npm package is available
      process.stdout.write('\n⧖ Verifying npm package availability...\n')
      await checkNpmPackage(repositoryName)
    }
    else {
      process.stdout.write('\n')
      process.stdout.write(`✗ ${chalk.red.bold('Publishing workflow failed')}\n`)
      process.stdout.write(`View details: https://github.com/${repositoryName}/actions/runs/${runId}\n`)
    }
  }
  catch (error) {
    process.stdout.write(`\nError getting workflow results: ${error instanceof Error ? error.message : String(error)}\n`)
  }
}

async function checkNpmPackage(repositoryName: string): Promise<void> {
  try {
    // Extract package name from repository (assume @org/repo format)
    const packageName = repositoryName.includes('/')
      ? `@${repositoryName.replace('/', '/')}`
      : repositoryName

    const result = await execa('npm', ['view', packageName, 'version'], { stdio: 'pipe' })
    const version = result.stdout.trim()

    process.stdout.write(`✓ Package ${chalk.cyan(packageName)}@${chalk.green(version)} is now available on npm!\n`)
    process.stdout.write('\n')
    process.stdout.write(`Install with: ${chalk.gray(`npm install ${packageName}`)}\n`)
  }
  catch {
    process.stdout.write('Could not verify npm package (this is normal for non-npm packages)\n')
  }

  process.stdout.write('\n')
}

// =============================================================================
// Cloudflare Deployment
// =============================================================================

export async function deployToCloudflare(): Promise<void> {
  try {
    process.stdout.write('\n')
    process.stdout.write(chalk.cyan('╔════════════════════════════════════════════════════════════════╗\n'))
    process.stdout.write(chalk.cyan('║                    CLOUDFLARE DEPLOYMENT                       ║\n'))
    process.stdout.write(chalk.cyan('╚════════════════════════════════════════════════════════════════╝\n'))
    process.stdout.write('\n')
    process.stdout.write('🚀 Deploying to Cloudflare Workers...\n')

    await execa('npx', ['wrangler', 'deploy'], { stdio: 'inherit' })

    process.stdout.write('\n')
    process.stdout.write(`🎉 ${chalk.green.bold('Cloudflare deployment completed successfully!')}\n`)
    process.stdout.write('\n')
  }
  catch (error) {
    process.stdout.write('\n')
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (errorMessage.includes('Missing entry-point')) {
      process.stdout.write(`❌ ${chalk.red.bold('Deployment failed: No wrangler config found')}\n`)
      process.stdout.write('📝 Check your wrangler.toml or wrangler.json configuration\n')
    }
    else if (errorMessage.includes('not authenticated')) {
      process.stdout.write(`❌ ${chalk.red.bold('Deployment failed: Not authenticated')}\n`)
      process.stdout.write('📝 Run: npx wrangler login\n')
    }
    else if (errorMessage.includes('wrangler: command not found')) {
      process.stdout.write(`❌ ${chalk.red.bold('Deployment failed: Wrangler not installed')}\n`)
      process.stdout.write('📝 Install: npm install -g wrangler\n')
    }
    else {
      process.stdout.write(`❌ ${chalk.red.bold('Deployment failed')}\n`)
      process.stdout.write(`⚠️  Error: ${errorMessage.slice(0, 100)}...\n`)
    }
    process.stdout.write('\n')
  }
}
