import * as core from '@actions/core';
import * as github from '@actions/github';
import Octokit = require('@octokit/rest');

const delay = ms => new Promise(res => setTimeout(res, ms));

async function run() {
  const context = github.context;
  const githubToken = core.getInput('GITHUB_TOKEN');
  const baseBranch = core.getInput('BASE_BRANCH');
  let headBranch = core.getInput('HEAD_BRANCH');
  let prTitle = core.getInput('PULL_REQUEST_TITLE');
  const tryAutoMerge = core.getInput('AUTO_MERGE') === 'true';
  const mergeAccessToken = core.getInput('MERGE_ACCESS_TOKEN');

  if (!headBranch && headBranch.length === 0) {
    let branchName = github.context.ref;
    if (branchName.indexOf('/refs/heads/') > -1) {
      branchName = branchName.slice('/refs/heads/'.length);
    }

    headBranch = branchName;
  }

  try {
    if (!prTitle || prTitle.length === 0) {
      prTitle = `[Bot] Automatic PR from ${headBranch} => ${baseBranch}`;
    }

    const octokit = new github.GitHub(githubToken);

    core.debug(`loading "${headBranch}"`);
    const headBranchMetadata = await octokit.repos.getBranch({
      owner: context.repo.owner,
      repo: context.repo.repo,
      branch: headBranch
    });

    core.debug(`loading "${baseBranch}"`);
    const baseBranchMetadata = await octokit.repos.getBranch({
      owner: context.repo.owner,
      repo: context.repo.repo,
      branch: baseBranch
    });

    if (headBranchMetadata.data.commit.sha === baseBranchMetadata.data.commit.sha) {
      core.info('source and target branches are in sync, skipping PR.');
      return;
    }

    const existingPulls = await octokit.pulls.list({
      owner: context.repo.owner,
      repo: context.repo.repo,
      state: 'open',
      base: baseBranch,
      head: `${context.repo.owner}:${headBranch}`
    });

    core.debug(JSON.stringify(existingPulls));

    if (existingPulls.data.length > 0) {
      const existingPull = existingPulls.data.find(x => x.head.ref === headBranch && x.base.ref === baseBranch);
      if (!!existingPull) {
        core.info(`Found an existing open pull request ${existingPull.html_url}, cancelling.`);
        return;
      }
    }

    const pr: (Octokit.RequestOptions & Octokit.PullsCreateParams) = {
      base: baseBranch,
      body: 'Automatic PR',
      head: headBranch,
      owner: context.repo.owner,
      repo: context.repo.repo,
      title: prTitle
    };

    const createdPr = await octokit.pulls.create(pr);

    core.info(`Created a new PR: ${createdPr.data.html_url}`);

    if (!!tryAutoMerge) {
      // Allow for the temporary merge process to complete
      await delay(5000);

      // Go ahead and approve the PR
      const client = !!mergeAccessToken ? new github.GitHub(mergeAccessToken) : octokit;
      if (client !== octokit) {
        core.info('attempting to automatically approve the PR.');
        await client.pulls.createReview({
          owner: context.repo.owner,
          repo: context.repo.repo,
          pull_number: createdPr.data.number,
          event: 'APPROVE',
          body: 'Automatically approved'
        });
      }

      // Check for conflicts by looking at the PR.mergeable
      let invokeMerge = false;
      let expectedSha = '';
      for (let i = 0; i < 10; i++) {
        const createPrMetadata = await octokit.pulls.get({
          owner: context.repo.owner,
          repo: context.repo.repo,
          pull_number: createdPr.data.number
        });

        invokeMerge = !!createPrMetadata.data.mergeable;

        if (!invokeMerge) {
          await delay(2500);
        } else {
          expectedSha = createPrMetadata.data.head.sha;
          break;
        }
      }

      // Determine if there are any required status checks
      // - https://developer.github.com/v3/repos/statuses/#get-the-combined-status-for-a-specific-ref
      // - https://developer.github.com/v3/repos/branches/#list-required-status-checks-contexts-of-protected-branch

      if (!!invokeMerge) {
        const client = !!mergeAccessToken ? new github.GitHub(mergeAccessToken) : octokit;

        try {
          if (client !== octokit) {
            await client.pulls.createReview({
              owner: context.repo.owner,
              repo: context.repo.repo,
              pull_number: createdPr.data.number,
              event: 'APPROVE',
              body: 'Automatically approved'
            });
          }

          await client.pulls.merge({
            owner: context.repo.owner,
            repo: context.repo.repo,
            pull_number: createdPr.data.number,
            sha: expectedSha,
            merge_method: 'merge',
            commit_title: `Automatic merge ${headBranch} => ${baseBranch}`,
            commit_message: `Automatic merge`
          });
        } catch (error) {
          core.warning('Encountered an error while trying to automatically approve and/or merge.');
          core.debug(JSON.stringify(error));
          core.info(error.message);
        }
      }
    }

  } catch (error) {
    core.debug(JSON.stringify(error));
    const messageString = error.message as string;
    if (!!messageString) {
      if (messageString.indexOf('pull request already exists') >= 0) {
        core.info('Found an existing open pull request, cancelling.');
        return;
      }

      if (messageString.indexOf('No commits between') >= 0) {
        core.info(`${baseBranch} already has all commits in ${headBranch}`);
        return;
      }
    }


    core.setFailed(error.message);
  }
}

run();