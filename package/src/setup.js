const readline = require("readline");
const { execSync, spawn } = require("child_process");
const net = require("node:net")
const os = require("node:os")
var getos = require("getos")

const activeChildren = new Set();

const trackChild = (child) => {
    activeChildren.add(child);
    child.once("exit", () => activeChildren.delete(child));
    child.once("error", () => activeChildren.delete(child));
    return child;
}

const stopChild = (child) => {
    if (!child || child.killed) {
        return;
    }

    if (os.platform() === "win32" && child.pid) {
        try {
            spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
                stdio: "ignore",
                windowsHide: true,
            });
            return;
        } catch {
            // Fall through to the normal kill path.
        }
    }

    child.kill("SIGTERM");
}

const stopActiveChildren = () => {
    for (const child of activeChildren) {
        stopChild(child);
    }
    activeChildren.clear();
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

const getLinuxDistro = () => {
    return new Promise((resolve, reject) => {
        getos((error, osInfo) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(osInfo?.dist?.toLowerCase() || "");
        });
    });
}

const openTerminal = (command, options = {}) => {
  const cwd = typeof options === "string"
    ? options
    : options.cwd || process.cwd();
  const platform = os.platform();
  let child;

  if (platform === "win32") {
    child = spawn(
      "cmd.exe",
      ["/d", "/c", "start", "", "/D", cwd, "cmd.exe", "/c", command],
      { detached: true, stdio: "ignore" }
    );
    child.unref();
    return trackChild(child);
  }

  if (platform === "darwin") {
    const script = `
      tell application "Terminal"
        activate
        do script "cd '${cwd.replace(/'/g, "'\\''")}' && ${command}"
      end tell
    `;

    child = spawn("osascript", ["-e", script], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return trackChild(child);
  }

  child = spawn(
    "sh",
    [
      "-c",
      `x-terminal-emulator -e sh -c 'cd "${cwd}" && ${command}; exec sh'`,
    ],
    { detached: true, stdio: "ignore" }
  );
  child.unref();
  return trackChild(child);
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
    getLinuxDistro,
    openTerminal,
    waitForPort,
    stopActiveChildren
}
