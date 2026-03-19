import * as core from '@actions/core';
import * as github from '@actions/github';

async function run(): Promise<void> {
  try {
    const token = core.getInput('github-token', { required: true });
    const staleDays = parseInt(core.getInput('stale-days'));
    const dryRun = core.getInput('dry-run') === 'true';
    const createIssue = core.getInput('create-issue') === 'true';
    const excludePatterns = core.getInput('exclude-patterns')
      .split('\n').map(p => p.trim()).filter(p => p.length > 0);

    const octokit = github.getOctokit(token);
    const { owner, repo } = github.context.repo;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - staleDays);

    core.info(`Scanning for branches stale > ${staleDays} days (before ${cutoffDate.toISOString()})`);

    // Get all branches
    const branches: any[] = [];
    let page = 1;
    while (true) {
      const { data } = await octokit.rest.repos.listBranches({ owner, repo, per_page: 100, page });
      if (data.length === 0) break;
      branches.push(...data);
      page++;
    }

    const staleBranches: { name: string; lastCommitDate: string; author: string; behind: number }[] = [];
    const defaultBranch = (await octokit.rest.repos.get({ owner, repo })).data.default_branch;

    for (const branch of branches) {
      // Skip excluded patterns
      const shouldExclude = excludePatterns.some(pattern => {
        if (pattern.endsWith('/*')) {
          return branch.name.startsWith(pattern.slice(0, -2));
        }
        return branch.name === pattern;
      });
      if (shouldExclude || branch.name === defaultBranch) continue;

      // Get last commit
      const { data: commit } = await octokit.rest.repos.getCommit({ owner, repo, ref: branch.commit.sha });
      const commitDate = new Date(commit.commit.committer?.date || commit.commit.author?.date || '');
      
      if (commitDate < cutoffDate) {
        // Check how far behind default
        let behind = 0;
        try {
          const { data: comparison } = await octokit.rest.repos.compareCommits({
            owner, repo, base: branch.name, head: defaultBranch
          });
          behind = comparison.ahead_by;
        } catch { /* ignore */ }

        staleBranches.push({
          name: branch.name,
          lastCommitDate: commitDate.toISOString().split('T')[0],
          author: commit.commit.author?.name || 'unknown',
          behind,
        });
      }
    }

    core.info(`Found ${staleBranches.length} stale branches out of ${branches.length} total`);

    if (staleBranches.length === 0) {
      core.info('No stale branches found!');
      await core.summary.addHeading('Branch Cleanup Report', 2)
        .addRaw('✅ No stale branches found. Repository is clean!')
        .write();
      return;
    }

    // Sort by date (oldest first)
    staleBranches.sort((a, b) => a.lastCommitDate.localeCompare(b.lastCommitDate));

    // Build report
    const reportLines = staleBranches.map(b => 
      `| \`${b.name}\` | ${b.lastCommitDate} | ${b.author} | ${b.behind} commits behind |`
    );
    
    const report = `## 🧹 Stale Branch Report\n\nFound **${staleBranches.length}** branches with no commits in ${staleDays}+ days.\n\n| Branch | Last Commit | Author | Status |\n|--------|------------|--------|--------|\n${reportLines.join('\n')}\n\n${dryRun ? '⚠️ **Dry run mode** — no branches were deleted. Set \`dry-run: false\` to enable auto-cleanup.' : ''}`;

    // Create issue if requested
    if (createIssue && staleBranches.length > 0) {
      await octokit.rest.issues.create({
        owner, repo,
        title: `🧹 ${staleBranches.length} stale branches detected`,
        body: report,
        labels: ['maintenance', 'cleanup'],
      });
      core.info('Created cleanup issue');
    }

    // Delete if not dry run
    if (!dryRun) {
      let deleted = 0;
      for (const branch of staleBranches) {
        try {
          await octokit.rest.git.deleteRef({ owner, repo, ref: `heads/${branch.name}` });
          core.info(`Deleted: ${branch.name}`);
          deleted++;
        } catch (e) {
          core.warning(`Failed to delete ${branch.name}: ${e}`);
        }
      }
      core.info(`Deleted ${deleted}/${staleBranches.length} stale branches`);
    }

    // Write summary
    await core.summary
      .addHeading('Branch Cleanup Report', 2)
      .addTable([
        [{ data: 'Branch', header: true }, { data: 'Last Commit', header: true }, { data: 'Author', header: true }],
        ...staleBranches.slice(0, 20).map(b => [b.name, b.lastCommitDate, b.author]),
      ])
      .addRaw(staleBranches.length > 20 ? `\n...and ${staleBranches.length - 20} more` : '')
      .write();

    // Set outputs
    core.setOutput('stale-count', staleBranches.length.toString());
    core.setOutput('branch-names', staleBranches.map(b => b.name).join(','));

  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}

run();
