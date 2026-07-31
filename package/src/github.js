const path = require('node:path');
const setup = require('./setup.js');
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const getos = require("getos")


const githubApiEndpoint = "https://api.github.com/orgs/tailed-community/repos";


const isInstalled = () => {
    const cmd = "gh --version"
    let isInstalled = setup.executeCommand(cmd, { throwOnError: false, logOnError: false })
    return isInstalled
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
    isInstalled,
    login,
    fork
}

