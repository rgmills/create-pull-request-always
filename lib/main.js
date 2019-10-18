"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
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
            const existingPulls = yield octokit.pulls.list({
                owner: context.repo.owner,
                repo: context.repo.repo,
                state: 'open',
                base: pullRequestBranch,
                head: `${context.repo.owner}:${sourceBranch}`
            });
            core.debug(JSON.stringify(existingPulls));
            if (existingPulls.data.length > 0) {
                core.debug('Found an existing open pull request, cancelling.');
                return;
            }
            const pr = {
                base: pullRequestBranch,
                body: 'Automatic PR',
                head: sourceBranch,
                owner: context.repo.owner,
                repo: context.repo.repo,
                title: prTitle
            };
            const createdPr = yield octokit.pulls.create(pr);
            core.info(`Created a new PR: ${createdPr.data.html_url}`);
        }
        catch (error) {
            core.debug(JSON.stringify(error));
            if (error.message.indexOf('pull request already exists') >= 0) {
                core.info('Found an existing open pull request, cancelling.');
                return;
            }
            core.setFailed(error.message);
        }
    });
}
run();
