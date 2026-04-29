const fs = require("fs");
const path = require("path");
const setup = require('./setup.js');

const isAvailable = () => {
    try {

        var isInstalled = setup.executeCommand("docker --version", { stdio: "ignore" });
        var isRunning = setup.executeCommand("docker info", { stdio: "ignore" });
        return isInstalled && isRunning;
    } catch (error) {
        console.error("Docker is not installed or not running. Please ensure docker is installed and running")
    }
}


const composeUp = async (file) => {
    const composeFile = file.endsWith(".yml") || file.endsWith(".yaml")
        ? file
        : `${file}.yml`;
    const composePath = path.resolve(__dirname, "docker", composeFile);

    if (!fs.existsSync(composePath)) {
        console.error(`Compose file not found: ${composePath}`);
        return false;
    }

    var command = `docker compose -f "${composePath}" up -d`;
    return setup.executeCommand(command);
}

const run = async (cmd) => {
    return setup.executeCommand(cmd)
}

const pull = async (img, version) => {
    if (version != null) {
        return setup.executeCommand(`docker pull ${img}/${version}`)
    } else {
        return setup.executeCommand(`docker pull ${img}/latest`)
    }
}

module.exports = {
    isAvailable,
    composeUp,
    run,
    pull
};
