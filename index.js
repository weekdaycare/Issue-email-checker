import * as core from '@actions/core';
import * as github from '@actions/github';
import fs from 'fs/promises';
import path from 'path';

async function run() {
  try {
    const token = core.getInput('github_token', { required: true });
    const issueNumber = parseInt(core.getInput('issue_number', { required: true }));
    const issueState = core.getInput('issue_state') || 'all'; // 可选参数，默认值为 'all'
    const octokit = github.getOctokit(token);
    const { owner, repo } = github.context.repo;

    // 邮箱正则
    const emailRegex = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g;

    // 1. 获取当前 issue 内容和标签
    const { data: issue } = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    const body = issue.body || '';
    const labels = issue.labels.map(l => l.name);

    // 2. 检查是否包含邮箱
    const emailsInCurrent = body.match(emailRegex) || [];

    async function addLabel(label) {
      if (!labels.includes(label)) {
        await octokit.rest.issues.addLabels({
          owner,
          repo,
          issue_number: issueNumber,
          labels: [label],
        });
        core.info(`Added label '${label}' to issue #${issueNumber}`);
      }
    }

    async function removeLabel(label) {
      if (labels.includes(label)) {
        await octokit.rest.issues.removeLabel({
          owner,
          repo,
          issue_number: issueNumber,
          name: label,
        });
        core.info(`Removed label '${label}' from issue #${issueNumber}`);
      }
    }

    if (emailsInCurrent.length > 0) {
      await addLabel('subscribe');
    } else {
      await removeLabel('subscribe');
    }

    // 3. 遍历所有 issue，收集邮箱
    const allEmailsMap = {}; // issue_number => [emails]

    // 分页获取所有 issue，根据用户选择的状态
    const perPage = 100;
    let page = 1;
    while (true) {
      const { data: issues } = await octokit.rest.issues.listForRepo({
        owner,
        repo,
        state: issueState, // 根据传参抓取指定状态的 issue
        per_page: perPage,
        page,
      });

      if (issues.length === 0) break;

      for (const i of issues) {
        if (!i.body) continue;
        const found = i.body.match(emailRegex);
        if (found && found.length > 0) {
          allEmailsMap[i.number] = Array.from(new Set(found)); // 去重
        }
      }

      if (issues.length < perPage) break;
      page++;
    }

    core.info(`Collected emails from ${Object.keys(allEmailsMap).length} issues.`);

    // 4. 写入 JSON 文件到指定路径
    const jsonContent = JSON.stringify(allEmailsMap, null, 2);
    const filePath = path.join(process.cwd(), 'v2/subscribe.json'); // 输出路径
    await fs.mkdir(path.dirname(filePath), { recursive: true }); // 确保目录存在
    await fs.writeFile(filePath, jsonContent);
    core.info(`Wrote subscribe.json file to /v2.`);

    // 5. 推送到 output 分支
    const exec = require('child_process').execSync;

    // 切换到 output 分支，若不存在则创建
    try {
      exec('git fetch origin output', { stdio: 'inherit' });
      exec('git checkout output', { stdio: 'inherit' });
    } catch {
      core.info('output branch does not exist, creating...');
      exec('git checkout --orphan output', { stdio: 'inherit' });
      exec('git rm -rf .', { stdio: 'inherit' });
    }

    // 复制文件到仓库根目录
    exec('git config user.name "github-actions[bot]"');
    exec('git config user.email "github-actions[bot]@users.noreply.github.com"');
    exec('git add v2/subscribe.json');
    exec('git commit -m "Update subscribe.json [skip ci]"');
    exec('git push origin output --force');

    core.info('Pushed subscribe.json to output branch.');

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
