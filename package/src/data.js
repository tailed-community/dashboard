const admin = require("firebase-admin")
const fs = require("node:fs")
const path = require("node:path")

const DEFAULT_PROJECT_ID = "demo-tailed1"
const DEFAULT_EMULATOR_HOST = "127.0.0.1:8081"
const BATCH_LIMIT = 450

function getDb({ projectId = DEFAULT_PROJECT_ID, emulatorHost = DEFAULT_EMULATOR_HOST } = {}) {
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || emulatorHost
    process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || projectId
    process.env.FIREBASE_CONFIG = process.env.FIREBASE_CONFIG || JSON.stringify({ projectId })

    if (!admin.apps.length) {
        admin.initializeApp({ projectId })
    }

    return admin.firestore()
}

function isTimestamp(value) {
    return value
        && typeof value === "object"
        && typeof value._seconds === "number"
        && typeof value._nanoseconds === "number"
}

function reviveFirestoreData(value) {
    if (Array.isArray(value)) {
        return value.map(reviveFirestoreData)
    }

    if (isTimestamp(value)) {
        return new admin.firestore.Timestamp(value._seconds, value._nanoseconds)
    }

    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, reviveFirestoreData(item)])
        )
    }

    return value
}

async function commitBatch(batch, count) {
    if (count === 0) {
        return
    }

    await batch.commit()
}

async function seed(options = {}) {
    const {
        projectId = DEFAULT_PROJECT_ID,
        emulatorHost = DEFAULT_EMULATOR_HOST,
        seedPath = path.join(__dirname, "seeds", "firestore.seed.json"),
    } = options

    const db = getDb({ projectId, emulatorHost })
    const data = JSON.parse(fs.readFileSync(seedPath, "utf-8"))

    let batch = db.batch()
    let pendingWrites = 0
    let totalWrites = 0

    for (const collection of Object.keys(data)) {
        for (const doc of data[collection]) {
            const { id, ...rest } = doc

            if (!id) {
                throw new Error(`Missing document id in seed collection: ${collection}`)
            }

            const ref = db.collection(collection).doc(id)
            batch.set(ref, reviveFirestoreData(rest), { merge: true })
            pendingWrites++
            totalWrites++

            if (pendingWrites >= BATCH_LIMIT) {
                await commitBatch(batch, pendingWrites)
                batch = db.batch()
                pendingWrites = 0
            }
        }
    }

    await commitBatch(batch, pendingWrites)

    console.log(`
            ✅ Data seeded into Firestore emulator (${totalWrites} documents)
        `)
}

module.exports = {
    seed
}
