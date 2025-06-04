const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const path = require('path');

const EMAIL_REGEX = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g;

async function run() {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error('GITHUB_TOKEN is not set');
    const issueState = core.getInput('issue_state') || 'open';

    const octokit = github.getOctokit(token);
    const context = github.context;
    const repo = context.repo;

    // 1. 检查当前 issue 是否有邮箱，加/去 subscribe 标签
    if (context.payload.issue) {
      const issue = context.payload.issue;
      const body = issue.body || '';
      const hasEmail = EMAIL_REGEX.test(body);
      const labels = issue.labels.map(l => (typeof l === 'string' ? l : l.name));
      if (hasEmail && !labels.includes('subscribe')) {
        await octokit.rest.issues.addLabels({
          ...repo,
          issue_number: issue.number,
          labels: ['subscribe'],
        });
        core.info(`Added 'subscribe' label to issue #${issue.number}`);
      } else if (!hasEmail && labels.includes('subscribe')) {
        await octokit.rest.issues.removeLabel({
          ...repo,
          issue_number: issue.number,
          name: 'subscribe',
        });
        core.info(`Removed 'subscribe' label from issue #${issue.number}`);
      }
    }

    // 2. 遍历所有 issue，提取邮箱
    let emails = new Set();
    let page = 1;
    while (true) {
      const issues = await octokit.rest.issues.listForRepo({
        ...repo,
        state: issueState,
        per_page: 100,
        page,
      });
      if (issues.data.length === 0) break;
      for (const issue of issues.data) {
        if (issue.pull_request) continue; // 跳过 PR
        const body = issue.body || '';
        const found = body.match(EMAIL_REGEX);
        if (found) found.forEach(e => emails.add(e));
      }
      page++;
    }
    emails = Array.from(emails);

    // 3. 写入 /v2/subscribe.json
    fs.mkdirSync('v2', { recursive: true });
    const outPath = path.join('v2', 'subscribe.json');
    fs.writeFileSync(outPath, JSON.stringify(emails, null, 2));

    // 4. 推送到 output 分支
    // 拉取 output 分支
    const execSync = require('child_process').execSync;
    execSync('git config user.name "github-actions[bot]"');
    execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
    execSync('git fetch origin output:output || git checkout --orphan output');
    execSync('git checkout output');
    fs.mkdirSync('v2', { recursive: true });
    fs.copyFileSync(outPath, outPath);
    execSync('git add v2/subscribe.json');
    execSync('git commit -m "Update subscribe.json" || echo "No changes to commit"');
    execSync('git push origin output');

    core.info(`Emails extracted: ${emails.length}`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
