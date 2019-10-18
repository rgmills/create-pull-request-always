import * as core from '@actions/core';
import * as github from '@actions/github';
import Octokit = require('@octokit/rest');

async function run() {
  try {
    const context = github.context;
    const githubToken = core.getInput('GITHUB_TOKEN');
    const baseBranch = core.getInput('BASE_BRANCH');
    const headBranch = core.getInput('HEAD_BRANCH');
    let prTitle = core.getInput('PULL_REQUEST_TITLE');

    if (!prTitle || prTitle.length === 0) {
      prTitle = `[Bot] Automatic PR from ${headBranch} => ${baseBranch}`;
    }

    const octokit = new github.GitHub(githubToken);


    const headBranchMetadata = await octokit.repos.getBranch({
      owner: context.repo.owner,
      repo: context.repo.owner,
      branch: headBranch
    });

    const baseBranchMetadata = await octokit.repos.getBranch({
      owner: context.repo.owner,
      repo: context.repo.owner,
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

  } catch (error) {
    core.debug(JSON.stringify(error));
    if ((error.message as string).indexOf('pull request already exists') >= 0) {
      core.info('Found an existing open pull request, cancelling.');
      return;
    }
    core.setFailed(error.message);
  }
}

run();