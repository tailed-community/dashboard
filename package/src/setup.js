const readline = require("readline");
const { execSync } = require("child_process");

const executeCommand = (command, options = {}) => {

    const { throwOnError = true, ...execOptions } = options;

    try {
        execSync(command, { stdio: "inherit", ...execOptions });
        return true;
    } catch (err) {
        console.error(`Error executing command: ${command}`);
        console.error(err);
        if (throwOnError) {
            throw err;
        }
        return false;
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