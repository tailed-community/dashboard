const docker = require("./docker.js")
const github = require("./github.js")
const data = require("./data")
const file = require("./file.js")
const setup = require("./setup.js")
const store = require("./firestore.js")
const path = require("node:path")

async function init({ project = "dashboard", signal } = {}) {

    const value = project
    const dockerAvailable = docker.isAvailable();
    const isGhInstalled = github.isInstalled();
    const isFirebaseAvailable = await store.isInstall();
    const dir = path.join(process.cwd(), value)

    if (!dockerAvailable) {
        console.error("Docker is not available. Please install and start Docker to use this tool.");
        process.exit(1);
    }

    if (!isFirebaseAvailable) {
        await store.install()
        await store.login();
    }

    if (!isGhInstalled) {
        await github.install();
    }

    switch (value) {
        case "dashboard":
            console.log(`
            ✅ Initializing dashboard project...\n`);

            /*** Docker Section  ***/
            await docker.composeUp("compose");

            /*** Github Cli Section ***/
            await github.fork("dashboard")

            /*** Setup Section  ***/
            await setup.executeCommand("npm install", { cwd: dir });
            await setup.executeCommand("npm install", { cwd: path.join(dir, "functions") });

            /*** Env Section  ***/
            file.env();

            /*** Start project Section  ***/
            // store.startEmulator({ cwd: dir });
            setup.openTerminal("firebase emulators:start --project demo-tailed1", { cwd: dir });
            setup.openTerminal("npm run dev", { cwd: path.join(dir, "functions") })


            /*** Wait for emulator to be ready ***/
            await setup.waitForPort(8081, "127.0.0.1", { signal });
            await data.seed();

            console.log(`
            ✅ Go to ${dir} and execute npm run dev,
            then open a new terminal and *cd* into the functions directory
            execute npm run dev to start the api`)
            console.log(`\n
            ✅ Project have been installed successfully!\n\n`)

            break;
        default:
            break;
    }
}

async function test() {
    const dir = path.join(process.cwd(), "dashboard")
    console.log(`
            ✅ Testing new features
        `)


    await setup.executeCommand("cd " + dir);


}

module.exports = {
    init,
    test
}
