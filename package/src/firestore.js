const setup = require('../src/setup')
const path = require("node:path")


const isInstall = async () => {
    const cmd = "firebase --version"
    return await setup.executeCommand(cmd)
}

const install = async () => {
    const cmd = "npm install -g firebase-tools"
    await setup.executeCommand(cmd)
}

const login = async () => {
    const cmd = "firebase login:ci"
    await setup.executeCommand(cmd)
}

const init = async () => {
    const cmd = "firebase init"
    await setup.executeCommand(cmd)
}

const startEmulator = async ({ cwd = dir } = {}) => {

    const cmd = "firebase emulators:start --project demo-tailed1"
    return await setup.executeCommand(cmd, {
        cwd: cwd,
        stdio: "inherit",
    });
}



module.exports = {
    isInstall,
    install,
    login,
    init,
    startEmulator,
}
