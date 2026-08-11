#!/usr/bin/env node
// Prints "<STATE>|<URL>" for the deployment matching a commit SHA and
// target (e.g. "production" or "preview"). STATE is "NONE" if Vercel
// hasn't recorded a deployment for that commit/target yet.
//
// Usage: node vercel-status.js <commitSha> <target>
const { execSync } = require("child_process");

const [, , sha, target] = process.argv;
if (!sha || !target) {
  console.error("Usage: vercel-status.js <commitSha> <target>");
  process.exit(2);
}

const raw = execSync(`npx --yes vercel ls -m githubCommitSha=${sha} --json`, {
  encoding: "utf8",
});
const jsonStart = raw.indexOf("{");
const data = JSON.parse(raw.slice(jsonStart));
const match = data.deployments.find((d) => d.target === target);

if (!match) {
  console.log("NONE|");
} else {
  console.log(`${match.state}|https://${match.url}`);
}
