import * as core from '@actions/core';
import * as github from '@actions/github';
import Octokit = require('@octokit/rest');

async function run() {
  try {
    const context = github.context;
    const githubToken = core.getInput('GITHUB_TOKEN');
    const pullRequestBranch = core.getInput('PULL_REQUEST_BRANCH');
    const sourceBranch = core.getInput('SOURCE_BRANCH');
    let prTitle = core.getInput('PULL_REQUEST_TITLE');

    if (!prTitle) {
      prTitle = `[Bot] Automatic PR from ${sourceBranch} => ${pullRequestBranch}`;
    }

    const octokit = new github.GitHub(githubToken);

    const existingPulls = await octokit.pulls.list({
      owner: context.repo.owner,
      repo: context.repo.repo,
      state: 'open',
      base: pullRequestBranch,
      head: `${context.repo.owner}:${sourceBranch}`
    });

    if (existingPulls.data.length > 0) {
      core.debug('Found an existing open pull request, cancelling.');
      return;
    }

    const pr: (Octokit.RequestOptions & Octokit.PullsCreateParams) = {
      base: pullRequestBranch,
      body: 'Automatic PR',
      head: sourceBranch,
      owner: context.repo.owner,
      repo: context.repo.repo,
      title: prTitle
    };

    const createdPr = await octokit.pulls.create(pr);

    core.info(`Created a new PR: ${createdPr.data.html_url}`);

  } catch (error) {
    if ((error.message as string).indexOf('pull request already exists') >= 0) {
      core.info('Found an existing open pull request, cancelling.');
      return;
    }
    core.setFailed(error.message);
  }
}

run();