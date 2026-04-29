const path = require('path');
const setup = require('./setup.js');
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

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


const getProject = async (project) => {

    if (!project) {
        const rl = setup.createInterface();

        const repos = await listRepos();
        repos.forEach((repo) => {
            console.log(`${repo.name}: ${repo.html_url}`);
        });

        project = await setup.askQuestion(rl, "Which project do you want to initialize? ");
        
        rl.close();
    }

    return project;
}

const cloneRepo = (repoName, destination) => {
    const command = `git clone https://github.com/tailed-community/${repoName}.git ${destination || './' + repoName}`;
    setup.executeCommand(command);
}


module.exports = {
    getProject,
    cloneRepo
}
