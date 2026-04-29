#!/usr/bin/env node
const readline = require("readline");
const yargs = require("yargs")
const {hideBin} = require("yargs/helpers")
const command = require("./src/command.js")

const main = async () => {

    const argv = yargs(hideBin(process.argv))
        .scriptName("tailed")
        .usage("$0 <command> [options]")
        // Init project 
        .command("init [project]", "Initialize project", (y) => y
            .positional("project", {type: "string", default: "dashboard"})        
            .option("force", {type: "boolean", default: false}))
        // Update seed data 
        // we will need to ensure how the seed command will work its an ongoing conversation with the tail'ed managers
        // .command("seed <project>", "Update mocking data from the community database", (y) => y
        //     .positional("project", {type: "string", default: "dashboard"}))
        //     .option("force", {type: "boolean", default: false})
        .demandCommand(1,"Pick a command")
        .help()
        .version()
        .alias("help", "h")
        .alias("version", "v")
        .alias("force", "f")
        .alias("init", "i")
        .alias("project", "p")
        .showHelpOnFail(true)
        .parse()


    switch (argv._[0]) {
        case "init":
            await command.init({
                project: argv.project
            });
            break;
        
    }
}

main().catch((err) => {
    console.error("Failed to initialize project:", err);
    process.exit(1);
});