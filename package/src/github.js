const path = require('node:path');
const os = require("node:os")
const setup = require('./setup.js');
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const getos = require("getos")


const githubApiEndpoint = "https://api.github.com/orgs/tailed-community/repos";


async function listRepos() {
    const response = await fetch(githubApiEndpoint);
    if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
    }

    const data = (await response.json())
    return data.map((repo) => ({
        name: repo.name,
        html_url: repo.html_url,
    }));
}



const repo = async (repo) => {

    if (!repo) {
        const rl = setup.createInterface();

        const repos = await listRepos();

        repos.forEach((repo) => {
            console.log(`
            ${repo.name}: ${repo.html_url}`);
        });

        repo = await setup.askQuestion(rl, `
        Which project do you want to initialize? `);

        rl.close();
    }

    return repo;
}



const clone = (repoName, destination) => {
    const command = `git clone https://github.com/tailed-community/${repoName}.git ${destination || './' + repoName}`;
    setup.executeCommand(command);
}



const isInstalled = () => {
    const cmd = "gh --version"
    let isInstalled = setup.executeCommand(cmd, { throwOnError: false, logOnError: false })
    return isInstalled
}



const install = async () => {
    const rl = setup.createInterface();
    try {
        while (true) {
            const response = (await setup.askQuestion(rl, `
            Do you want to install GitHub CLI now? (yes/no): `))
                .trim()
                .toLowerCase();

            if (response === "yes" || response === "y") {
                return installCliOnOS();
            }

            if (response === "no" || response === "n") {
                console.error(` 
            GitHub CLI is required.
    
            Install:
            https://cli.github.com/
            `);
                return false;
            }

            console.error(`
            Please answer yes or no.
            `);
        }
    } finally {
        rl.close();
    }
}



const login = async () => {
    const cmd = "gh auth status"
    let isLogin = setup.executeCommand(cmd, { throwOnError: false, logOnError: false })
    if (!isLogin) {
        const command = "gh auth login"
        setup.executeCommand(command)
    }
}



const fork = async (repo) => {
    console.log(`
            ✅ Forking repo...`)
    const cmd = `gh repo fork tailed-community/${repo} --clone`
    return await setup.executeCommand(cmd)
}



module.exports = {
    repo,
    clone,
    isInstalled,
    install,
    login,
    fork
}

