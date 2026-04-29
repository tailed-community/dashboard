const readline = require("readline");
const { execSync } = require("child_process");

const executeCommand = (command, options = {}) => {
    try {
        execSync(command, { stdio: "inherit", ...options });
        return true;
    } catch (err) {
        console.error(`Error executing command: ${command}`);
        console.error(err);
        return false;
        process.exit(1);
    }
};

const createInterface = () => {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
};

const askQuestion = (rl, question) => {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
};


module.exports = {
    executeCommand,
    createInterface,
    askQuestion
}