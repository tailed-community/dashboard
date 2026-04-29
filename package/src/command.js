const docker = require("./docker.js")
const github = require("./github.js")
const data = require("./data")
const file = require("./file.js")
const setup = require("./setup.js")
const path = require("path")

async function init({ project = "dashboard" }) {

    const value = await github.getProject(project);
    const dockerAvailable = docker.isAvailable();
    const dir = path.join(process.cwd(), value)

    if (!dockerAvailable) {
        console.error("Docker is not available. Please install and start Docker to use this tool.");
        process.exit(1);
    }

    switch (value) {
        case "dashboard":
            console.log("\n\n✅ Initializing dashboard project...\n\n");
            //await docker.run("docker run -it google/cloud-sdk gcloud version") if needed put this in the docker compose file
            await docker.composeUp("compose");
            await data.seed();
            await github.cloneRepo("dashboard");
            await file.env();
            await setup.executeCommand(`npm install ${dir} && npm install ${dir}/functions`);

            console.log(`\n\n✅ Go to ${dir} and execute npm run dev,\nthen open a new terminal and *cd* into the functions directory\nexecute npm run dev to start the api`)
            console.log("\n\n✅ Project have been installed successfully!\n\n")
            break;
        default:
            break;
    }
}

module.exports = {
    init
}