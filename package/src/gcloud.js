const setup = require("./setup")
const os = require("node:os")

const isInstall = () => {
    const cmd = "gcloud version";
    return setup.executeCommand(cmd)
}


const install = () => {
    const rl = setup.createInterface();
    try {
        while (true) {
            const response = (await setup.askQuestion(rl, `
                Do you want to install Gcloud CLI now? (yes/no): `))
                .trim()
                .toLowerCase();

            if (response === "yes" || response === "y") {
                return installCliOnOS();
            }

            if (response === "no" || response === "n") {
                console.error(` 
                Gcloud CLI is required.
        
                Install:
                https://docs.cloud.google.com/sdk/docs/install-sdk#rpm
                `);
                return false;
            }

            console.error(`
                Please answer yes or no.
            `);
        }
    } finally {
        rl.close();
    }
}



module.exports = {
    isInstall,
    install
}



const installCliOnOs = () => {
    const distro = await setup.getLinuxDistro()
    let cmd

    const macOs = [
        "curl -O https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-darwin-x86_64.tar.gz",
        "tar -xf google-cloud-cli-darwin-x86_64.tar.gz",
        "./google-cloud-sdk/install.sh"
    ]

    const debianBase = [
        "sudo apt-get update",
        "sudo apt-get install ca-certificates gnupg curl",
        "curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg",
        'echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list',
        "sudo apt-get update && sudo apt-get install google-cloud-cli"
    ]

    const redhatBase = [
        `sudo tee -a /etc/yum.repos.d/google-cloud-sdk.repo << EOM
[google-cloud-cli]
name=Google Cloud CLI
baseurl=https://packages.cloud.google.com/yum/repos/cloud-sdk-el9-x86_64
enabled=1
gpgcheck=1
repo_gpgcheck=0
gpgkey=https://packages.cloud.google.com/yum/doc/rpm-package-key.gpg
EOM`,
        "sudo dnf install libxcrypt-compat.x86_64",
        "sudo dnf install google-cloud-cli"
    ]

    switch (os) {
        case "win32":
            cmd = "(New-Object Net.WebClient).DownloadFile('https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe', '$env:Temp\GoogleCloudSDKInstaller.exe') & $env:Temp\GoogleCloudSDKInstaller.exe";
            setup.executeCommand(cmd, { logOnError: true })
            break;

        case "darwin":
            macOs.forEach(cmd => {
                setup.executeCommand(cmd)
            });
            break;

        case "linux":
            switch (distro) {
                case "ubuntu":
                case "debian":
                    debianBase.forEach(cmd => {
                        setup.executeCommand(cmd)
                    });
                    return
                    break;

                case "fedora":
                case "centos":
                case "red hat":
                    redhatBase.forEach(cmd => {
                        setup.executeCommand(cmd)
                    });
                    return
                    break;
                default:
                    console.log(`
                        Distro is currently not available to install please review gcloud documentation to install the Cli -> https://docs.cloud.google.com/sdk/docs/install-sdk#linux
                        `)
                    return
                    break;
            }
        default:
            console.log(`
            OS not found`)
            break;
    }
}