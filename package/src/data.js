const admin = require("firebase-admin")
const fs = require("fs")
const path = require("path")

const config = {
    NODE_DEV: "development",
    FB_API_KEY: "dev.community.tailed.ca",
    FB_PROJECT_ID: "tailed-community-dev",
    FB_STORAGE_BUCKET: "tailed-community-dev-bucket",
    FB_TENANT_ID: "tailed-community-dev-app",
    EMAIL_SERVER: "127.0.0.1:1025"
}


if(!admin.apps.length) {
    admin.initializeApp(config) 
}

const db = admin.firestore();


async function seed() {
    const seedPath = path.join(__dirname, "seeds", "firestore.seed.json")

    const data = JSON.parse(
        fs.readFileSync(seedPath, "utf-8")
    )

    for (const collection of Object.keys(data)) {
        for(const doc of data[collection]) {
           const {id, ...rest} = doc;
           await db.collection(collection).doc(id).set(rest)
        }
    }

    console.log("\n\n✅ Data seeded into Firestore emulator\n\n")
}

 module.exports = {
    seed
 }
