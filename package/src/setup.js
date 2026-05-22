const readline = require("node:readline");
const { execSync, spawn } = require("node:child_process");
const net = require("node:net")

const activeChildren = new Set();

const trackChild = (child) => {
    activeChildren.add(child);
    child.once("exit", () => activeChildren.delete(child));
    child.once("error", () => activeChildren.delete(child));
    return child;
}


const exportEmulatorData = (options = {}) => {
    const {
        cwd = process.cwd(),
        exportDir = ".data",
        projectId = "demo-tailed1",
        quiet = false,
    } = options;

    const result = executeCommand(
        `firebase emulators:export ${exportDir} --force --project ${projectId}`,
        { cwd }
    );

    return result;
}


const executeCommand = (command, options = {}) => {
    const {
        throwOnError = false,
        logOnError = false,
        ...execOptions
    } = options;

    try {

        const result = execSync(command, {
            encoding: "utf-8",
            stdio: "pipe",
            ...execOptions
        });

        return result;

    } catch (err) {

        if (logOnError) {

            console.error(`\nError executing command:\n${command}\n`);

            if (err.stdout) {
                console.error("STDOUT:");
                console.error(err.stdout.toString());
            }

            if (err.stderr) {
                console.error("STDERR:");
                console.error(err.stderr.toString());
            }

            console.error(err.message);
        }

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


const runManagedProcess = (command, options = {}) => {
    const child = spawn(command, {
        cwd: options.cwd || process.cwd(),
        shell: true,
        stdio: ["inherit", "pipe", "pipe"],
    });

    child.outputBuffer = "";

    const onOutput = (stream) => (data) => {
        const text = data.toString();
        child.outputBuffer = `${child.outputBuffer}${text}`.slice(-20000);
        stream.write(data);
        child.emit("managed-output", text);
    };

    child.stdout?.on("data", onOutput(process.stdout));
    child.stderr?.on("data", onOutput(process.stderr));

    return trackChild(child);
};


const waitForProcessOutput = (child, pattern, options = {}) => {
    const signal = options.signal;

    return new Promise((resolve, reject) => {
        let settled = false;

        const matches = (text) => {
            if (pattern instanceof RegExp) {
                return pattern.test(text);
            }

            return text.includes(pattern);
        };

        const cleanup = () => {
            child.removeListener("managed-output", onOutput);
            child.removeListener("exit", onExit);
            child.removeListener("error", onError);
            signal?.removeEventListener("abort", onAbort);
        };

        const settle = (callback, value) => {
            if (settled) {
                return;
            }

            settled = true;
            cleanup();
            callback(value);
        };

        const onOutput = () => {
            if (matches(child.outputBuffer || "")) {
                settle(resolve);
            }
        };

        const onAbort = () => settle(resolve);
        const onError = (err) => settle(reject, err);
        const onExit = (code, signalName) => {
            const reason = signalName
                ? `signal ${signalName}`
                : `exit code ${code}`;
            settle(reject, new Error(`Process stopped before expected output with ${reason}.`));
        };

        if (matches(child.outputBuffer || "")) {
            resolve();
            return;
        }

        if (signal?.aborted) {
            resolve();
            return;
        }

        child.on("managed-output", onOutput);
        child.once("exit", onExit);
        child.once("error", onError);
        signal?.addEventListener("abort", onAbort, { once: true });
    });
};


function waitForPort(port, host = "127.0.0.1", options = {}) {
    const signal = options.signal;

    return new Promise((resolve, reject) => {
        let timer = null;
        let socket = null;
        let settled = false;

        const cleanup = () => {
            settled = true;
            if (timer) {
                clearTimeout(timer);
            }
            if (socket) {
                socket.destroy();
            }
            signal?.removeEventListener("abort", abort);
        }

        const abort = () => {
            cleanup();
            reject(new Error(`Stopped while waiting for ${host}:${port}`));
        }

        if (signal?.aborted) {
            abort();
            return;
        }

        signal?.addEventListener("abort", abort, { once: true });

        const check = () => {
            if (settled) {
                return;
            }

            socket = net.createConnection(port, host)

            socket.once("connect", () => {
                cleanup();
                resolve()
            })

            socket.once("error", () => {
                socket.destroy();
                timer = setTimeout(check, 500);
                timer.unref?.();
            })
        }

        check()
    })
}

module.exports = {
    executeCommand,
    createInterface,
    askQuestion,
    runManagedProcess,
    waitForProcessOutput,
    waitForPort,
    exportEmulatorData,
}
