const github = require("./github.js")
const data = require("./data")
const file = require("./file.js")
const setup = require("./setup.js")
const store = require("./firestore.js")
const path = require("node:path")
const fs = require("node:fs")

async function init({ project = "dashboard", signal } = {}) {

    const value = project
    const isGhInstalled = github.isInstalled();
    const isFirebaseAvailable = await store.isInstall();
    const dir = path.join(process.cwd(), value)
    const emulatorCommand = hasExportData
        ? "firebase emulators:start --project demo-tailed1 --import .data --export-on-exit .data"
        : "firebase emulators:start --project demo-tailed1 --export-on-exit .data"


    if (!isFirebaseAvailable) {
        await store.install()
        await store.login();
    }

    if (!isGhInstalled) {
        console.log(`
 ❌ Github CLI is not installed. Please install it to use this tool.\n`);
        process.exit(1);
    }

    console.log(`
✅ Initializing dashboard project...\n`);


    /*** Github Cli Section ***/
    await github.login();
    await github.fork("dashboard")

    /*** Setup Section  ***/
    await setup.executeCommand("npm install", { cwd: dir });
    await setup.executeCommand("npm install", { cwd: path.join(dir, "functions") });

    /*** Env Section  ***/
    file.env();

    /*** Start project Section  ***/
    setup.runManagedProcess(emulatorCommand, { cwd: dir });
    setup.runManagedProcess("npm run dev", { cwd: path.join(dir, "functions") })


    /*** Wait for emulator to be ready ***/
    await setup.waitForPort(8081, "127.0.0.1", { signal });
    await data.seed();

    console.log(`
✅ Go to ${dir} and execute npm run tailed,
to start the project. You can also execute npx tailed start 
from the root of the project, to start it directly from there.`)

    console.log(`\n
✅ Project have been installed successfully!\n\n`)

}


async function start({ signal } = {}) {

    const dir = process.cwd()
    const exportDir = path.join(dir, ".data")
    const hasExportData = fs.existsSync(exportDir)
    const emulatorCommand = hasExportData
        ? "firebase emulators:start --project demo-tailed1 --import .data --export-on-exit .data"
        : "firebase emulators:start --project demo-tailed1 --export-on-exit .data"

    /*** Start project Section  ***/
    const emulator = setup.runManagedProcess(emulatorCommand, { cwd: dir });
    setup.runManagedProcess("npm run dev", { cwd: path.join(dir, "functions") })

    console.log(`
🦊 Starting dashboard project...
🔥 Waiting for the emulator and API to be ready...
        `);

    await Promise.all([
        setup.waitForProcessOutput(emulator, "All emulators ready!", { signal }),
        setup.waitForPort(3001, "127.0.0.1", { signal }),
    ]);


    if(!hasExportData) {
        await data.seed();
    }


    console.log(`
💻 Project started successfully!
            
⚠️  The Emulator is handling requests.  
You can interact with it via the current terminal.
You can also use the Firebase Emulator UI at http://localhost:4000, 
to monitor and manage the emulated services. The auth link will be
available at http://localhost:4000/auth, where you can view and
manage your emulated users. The link will also be available in the new terminal.

🔥 Emulator UI: http://localhost:4000
🦊 Web UI: http://localhost:5174
🌐 API: http://localhost:3001
        `);

}


async function test() {
    console.log(`Running tests...`);
    console.log("Currently no cmd tests available for the dashboard project,\nCreate your command and add it to this function.");
}


module.exports = {
    init,
    test,
    start
}
