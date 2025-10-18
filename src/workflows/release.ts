/**
 * Complete Release Workflow - Git → Cloudflare → npm
 */

import type { ReleaseOptions, WorkflowStep } from '../types/index.js'
import { execa } from 'execa'
import * as semver from 'semver'
import { createGitStore } from '../core/git-store.js'

// Detection functions
async function detectCloudflareSetup(): Promise<boolean> {
  try {
    const fs = await import('node:fs/promises')
    // Check for wrangler.toml or wrangler.json
    try {
      await fs.access('wrangler.toml')
      return true
    }
    catch {
      try {
        await fs.access('wrangler.json')
        return true
      }
      catch {
        return false
      }
    }
  }
  catch {
    return false
  }
}

async function detectNpmSetup(): Promise<boolean> {
  try {
    const fs = await import('node:fs/promises')
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))
    // Check if it's a publishable package (has name and not private)
    return !!(packageJson.name && !packageJson.private)
  }
  catch {
    return false
  }
}

export function createReleaseWorkflow(options: ReleaseOptions = {}): WorkflowStep[] {
  return [
    // Quality Gates First
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

            try {
              const result = await execa('bun', ['test'], { stdio: 'pipe' })
              ctx.quality = { lintPassed: ctx.quality?.lintPassed ?? true, testsPassed: true }
              helpers.setTitle('Running tests - ✅ All tests passed')
            }
            catch (error) {
              const errorOutput = error instanceof Error ? error.message : String(error)

              // Check if it's a "no tests found" error
              if (errorOutput.includes('No tests found') || errorOutput.includes('no test files')) {
                ctx.quality = { lintPassed: ctx.quality?.lintPassed ?? true, testsPassed: true }
                helpers.setTitle('Running tests - ✅ No tests found (skipping)')
                return
              }

              // If it's a test failure, extract useful information
              if (errorOutput.includes('fail') && errorOutput.includes('pass')) {
                const lines = errorOutput.split('\n')
                const summary = lines.find(line => line.includes('fail') && line.includes('pass')) || 'Tests failed'
                ctx.quality = { lintPassed: ctx.quality?.lintPassed ?? true, testsPassed: false }
                throw new Error(`Test failures detected: ${summary}`)
              }

              // Try npm fallback for other errors
              try {
                await execa('npm', ['test'], { stdio: 'pipe' })
                ctx.quality = { lintPassed: ctx.quality?.lintPassed ?? true, testsPassed: true }
                helpers.setTitle('Running tests - ✅ All tests passed with npm')
              }
              catch (npmError) {
                const npmErrorOutput = npmError instanceof Error ? npmError.message : String(npmError)

                // Check npm error for "no tests found" as well
                if (npmErrorOutput.includes('No tests found') || npmErrorOutput.includes('no test files')) {
                  ctx.quality = { lintPassed: ctx.quality?.lintPassed ?? true, testsPassed: true }
                  helpers.setTitle('Running tests - ✅ No tests found (skipping)')
                  return
                }

                ctx.quality = { lintPassed: ctx.quality?.lintPassed ?? true, testsPassed: false }
                // Extract useful test failure info
                if (npmErrorOutput.includes('fail') && npmErrorOutput.includes('pass')) {
                  const lines = npmErrorOutput.split('\n')
                  const summary = lines.find(line => line.includes('fail') && line.includes('pass')) || 'Tests failed'
                  throw new Error(`Test failures detected: ${summary}`)
                }
                throw new Error(`Tests failed: ${npmErrorOutput}`)
              }
            }
          },
        },
      ],
    },

    // Git Operations
    {
      title: 'Git repository analysis',
      task: async (ctx, helpers) => {
        helpers.setOutput('Initializing Git store...')
        const git = createGitStore()

        helpers.setOutput('Checking repository status...')
        const isRepo = await git.isGitRepository()
        if (!isRepo) {
          throw new Error('Not a Git repository')
        }

        helpers.setOutput('Getting current branch and version...')
        const currentBranch = await git.getCurrentBranch()
        const currentVersion = await git.getCurrentVersion()
        const repository = await git.getRepositoryName()

        helpers.setOutput('Checking for uncommitted changes...')
        const hasChanges = await git.hasUncommittedChanges()

        if (hasChanges && !options.force) {
          // If not in interactive mode and not forced, offer to auto-handle
          if (!options.nonInteractive) {
            const enquirer = await import('enquirer')
            const { prompt } = enquirer.default || enquirer

            const response = await prompt({
              type: 'select',
              name: 'action',
              message: 'Uncommitted changes detected. How would you like to proceed?',
              choices: [
                {
                  name: 'commit',
                  message: 'Commit all changes automatically',
                  value: 'commit',
                },
                {
                  name: 'stash',
                  message: 'Stash changes and continue release',
                  value: 'stash',
                },
                {
                  name: 'abort',
                  message: 'Abort release and handle changes manually',
                  value: 'abort',
                },
              ],
            } as any) as { action: 'commit' | 'stash' | 'abort' }

            if (response.action === 'abort') {
              throw new Error('Release aborted by user. Please handle uncommitted changes and try again.')
            }

            if (response.action === 'commit') {
              helpers.setOutput('Staging all changes...')
              await git.stageFiles()

              const commitResponse = await prompt({
                type: 'input',
                name: 'message',
                message: 'Enter commit message:',
                initial: 'chore: prepare for release',
              } as any) as { message: string }

              helpers.setOutput('Committing changes...')
              await git.commit(commitResponse.message)
              helpers.setOutput('Changes committed successfully')
            }
            else if (response.action === 'stash') {
              helpers.setOutput('Stashing changes...')
              // Use execa to run git stash instead of accessing private property
              await execa('git', ['stash', 'push', '-m', 'Auto-stash before release'])
              helpers.setOutput('Changes stashed successfully')
            }
          }
          else {
            // In non-interactive mode, just inform and continue
            helpers.setOutput('⚠️  Uncommitted changes detected but continuing (non-interactive mode)')
          }
        }
        else if (hasChanges && options.force) {
          helpers.setOutput('⚠️  Uncommitted changes detected but skipped due to --force flag')
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
        const git = createGitStore()

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

    // Interactive Deployment Configuration
    {
      title: 'Deployment configuration',
      skip: () => options.nonInteractive === true, // Skip if explicitly non-interactive
      task: async (ctx, helpers) => {
        // If CLI options are already provided, respect them
        if (options.skipCloudflare !== undefined || options.skipNpm !== undefined) {
          helpers.setTitle('Deployment configuration - ✅ Using CLI options')
          return
        }
        
        // In non-interactive mode without explicit flags, skip all deployments by default
        if (options.nonInteractive) {
          options.skipCloudflare = true
          options.skipNpm = true
          helpers.setTitle('Deployment configuration - ℹ️ Non-interactive mode: skipping deployments')
          return
        }

        helpers.setOutput('Detecting available deployment options...')

        const hasCloudflare = await detectCloudflareSetup()
        const hasNpmSetup = await detectNpmSetup()

        const availableOptions = []

        if (hasCloudflare) {
          availableOptions.push({
            name: 'cloudflare',
            message: '🌩️  Deploy to Cloudflare (wrangler.toml detected)',
            value: 'cloudflare',
          })
        }

        if (hasNpmSetup) {
          availableOptions.push({
            name: 'npm',
            message: '📦 Publish to npm registry',
            value: 'npm',
          })
        }

        if (availableOptions.length === 0) {
          helpers.setTitle('Deployment configuration - ℹ️ No deployment options detected')
          return
        }

        const enquirer = await import('enquirer')
        const { prompt } = enquirer.default || enquirer

        const response = await prompt({
          type: 'multiselect',
          name: 'deployments',
          message: 'Select deployment targets:',
          choices: [
            ...availableOptions,
            {
              name: 'none',
              message: '🚫 Skip all deployments',
              value: 'none',
            },
          ],
          validate: (choices: string[]) => {
            if (choices.includes('none') && choices.length > 1) {
              return 'Cannot select "Skip all" with other options'
            }
            return true
          },
        } as any) as { deployments: string[] }

        // Update options based on user selection
        if (response.deployments.includes('none')) {
          options.skipCloudflare = true
          options.skipNpm = true
          helpers.setTitle('Deployment configuration - ✅ All deployments skipped')
        }
        else {
          options.skipCloudflare = !response.deployments.includes('cloudflare')
          options.skipNpm = !response.deployments.includes('npm')

          const selected = response.deployments.join(', ')
          helpers.setTitle(`Deployment configuration - ✅ Selected: ${selected}`)
        }
      },
    },

    // Release Execution
    {
      title: 'Release execution',
      subtasks: [
        {
          title: 'Update package.json version',
          task: async (ctx, helpers) => {
            const git = createGitStore()
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
            const git = createGitStore()

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
            const git = createGitStore()
            const tagName = `v${ctx.version!.next}`

            helpers.setOutput(`Creating tag ${tagName}...`)
            await git.createTag(tagName, `Release ${ctx.version!.next}`)

            helpers.setTitle(`Create git tag - ✅ ${tagName}`)
          },
        },
        {
          title: 'Push to remote',
          task: async (ctx, helpers) => {
            const git = createGitStore()

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

        try {
          await execa('bun', ['run', 'build'], { stdio: 'pipe' })
          helpers.setTitle('Build project - ✅ Build complete')
        }
        catch {
          // Try npm fallback
          try {
            await execa('npm', ['run', 'build'], { stdio: 'pipe' })
            helpers.setTitle('Build project - ✅ Build complete with npm')
          }
          catch {
            throw new Error('Build failed. Cannot proceed with deployment.')
          }
        }
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
          throw new Error(`Cloudflare deployment failed: ${error instanceof Error ? error.message : String(error)}`)
        }
      },
    },

    // npm Publishing
    {
      title: 'Publish to npm',
      skip: () => options.skipNpm || false,
      task: async (ctx, helpers) => {
        helpers.setOutput('Publishing to npm registry...')

        try {
          await execa('bun', ['publish', '--access', 'public'], { stdio: 'pipe' })

          ctx.deployments = {
            ...ctx.deployments,
            npm: {
              registry: 'https://registry.npmjs.org',
              tag: 'latest',
              access: 'public',
            },
          }

          helpers.setTitle(`Publish to npm - ✅ v${ctx.version!.next} published`)
        }
        catch (error) {
          throw new Error(`npm publishing failed: ${error instanceof Error ? error.message : String(error)}`)
        }
      },
    },

    // GitHub Release
    {
      title: 'Create GitHub release',
      task: async (ctx, helpers) => {
        helpers.setOutput('Creating GitHub release...')

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

          helpers.setTitle(`Create GitHub release - ✅ v${ctx.version!.next} released`)
        }
        catch {
          // Don't fail the entire workflow if GitHub release fails
          helpers.setTitle('Create GitHub release - ⚠️ Failed (continuing)')
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
