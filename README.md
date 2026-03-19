# 🧹 Stale Branch Cleaner

Automatically detect and clean up stale branches. Keep your repo tidy.

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-Stale%20Branch%20Cleaner-blue?logo=github)](https://github.com/marketplace/actions/stale-branch-cleaner)

## Quick Start

```yaml
name: Branch Cleanup
on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9am
  workflow_dispatch:

permissions:
  contents: write
  issues: write

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: ollieb89/stale-branch-cleaner@v1
        with:
          stale-days: '90'
          dry-run: 'true'
          create-issue: 'true'
```

## What It Does

1. Scans all branches in your repo
2. Identifies branches with no commits in X days
3. Creates a GitHub Issue with a cleanup report
4. Optionally auto-deletes stale branches

## Configuration

| Input | Default | Description |
|-------|---------|-------------|
| `stale-days` | `90` | Days since last commit to consider stale |
| `dry-run` | `true` | Report only (safe mode) |
| `create-issue` | `true` | Create issue with report |
| `exclude-patterns` | main, master, develop, release/*, hotfix/* | Branches to never touch |

## Outputs

| Output | Description |
|--------|-------------|
| `stale-count` | Number of stale branches found |
| `branch-names` | Comma-separated list of stale branch names |

## Part of the Toolkit

| Action | Purpose |
|--------|---------|
| [workflow-guardian](https://github.com/marketplace/actions/workflow-guardian) | Lint workflow files |
| [test-results-reporter](https://github.com/ollieb89/test-results-reporter) | Aggregate test results |
| [pr-size-labeler](https://github.com/ollieb89/pr-size-labeler) | Label PRs by size |
| **stale-branch-cleaner** | Clean up old branches |

## License
MIT
