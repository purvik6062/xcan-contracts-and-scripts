/* eslint-disable no-console */
// Imports data from data.json into MongoDB collection inorbit_modules.minted-nft
// Default mapping (extensible):
//   data.userAddress -> doc.userAddress
//   data.socialGithub -> doc.githubUsername

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const { MongoClient, ServerApiVersion } = require('mongodb');

const DEFAULT_DB_NAME = 'inorbit_modules';
const DEFAULT_COLLECTION = 'minted-nft';

function parseArgs(argv) {
    const args = { file: 'data.json', dryRun: false, db: DEFAULT_DB_NAME, coll: DEFAULT_COLLECTION, limit: undefined };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--file' || a === '-f') args.file = argv[++i];
        else if (a === '--dry-run' || a === '--dry') args.dryRun = true;
        else if (a === '--db') args.db = argv[++i];
        else if (a === '--collection' || a === '--coll') args.coll = argv[++i];
        else if (a === '--limit') args.limit = Number(argv[++i]);
        else if (a === '--help' || a === '-h') args.help = true;
        else {
            console.warn(`Unknown arg: ${a}`);
        }
    }
    return args;
}

function printHelp() {
    console.log('Usage:');
    console.log('  node addData.js [--file data.json] [--db inorbit_modules] [--collection minted-nft] [--dry-run] [--limit N]');
}

function readJsonArray(filePath) {
    const absolute = path.resolve(__dirname, filePath);
    if (!fs.existsSync(absolute)) {
        throw new Error(`Input file not found: ${absolute}`);
    }
    const raw = fs.readFileSync(absolute, 'utf8');
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) {
        throw new Error('Input JSON must be an array');
    }
    return arr;
}

// Field mapping for extensibility
// Add new mappings here to insert more fields later without changing core logic
const FIELD_MAPPINGS = [
    { source: 'userAddress', target: 'userAddress' },
    { source: 'socialGithub', target: 'githubUsername' }
];

function normalizeValue(key, value) {
    if (value === undefined || value === null) return value;
    if (key === 'userAddress' || key === 'githubUsername') {
        return String(value).trim().toLowerCase();
    }
    return value;
}

function buildDocumentFromItem(item) {
    const doc = {};
    for (const m of FIELD_MAPPINGS) {
        const value = item[m.source];
        if (value !== undefined && value !== null) {
            doc[m.target] = normalizeValue(m.target, value);
        }
    }
    return doc;
}

async function main() {
    const args = parseArgs(process.argv);
    if (args.help) {
        printHelp();
        process.exit(0);
    }

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        throw new Error('Missing MONGODB_URI in logic-script/.env');
    }

    const input = readJsonArray(args.file);
    const items = typeof args.limit === 'number' && !Number.isNaN(args.limit)
        ? input.slice(0, args.limit)
        : input;

    const client = new MongoClient(mongoUri, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true } });

    console.log(`Records to process: ${items.length}`);
    console.log(`Database: ${args.db}, Collection: ${args.coll}`);
    if (args.dryRun) console.log('Dry run: ON (no writes will be performed)');

    try {
        await client.connect();
        const db = client.db(args.db);
        const coll = db.collection(args.coll);
        const ciOpts = { collation: { locale: 'en', strength: 2 } }; // case-insensitive

        let inserted = 0;
        let skipped = 0;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const doc = buildDocumentFromItem(item);

            if (!doc.userAddress && !doc.githubUsername) {
                console.warn(`Skipping index ${i}: neither userAddress nor githubUsername present in input`);
                skipped++;
                continue;
            }

            // De-dup logic:
            // 1) Attempt to find existing doc by either identifier (address OR github), case-normalized
            // 2) If both identifiers already match -> skip
            // 3) If one identifier matches and the other is missing/different -> update existing (merge) instead of insert
            let existing = null;
            if (doc.userAddress && doc.githubUsername) {
                existing = await coll.findOne({ $or: [{ userAddress: doc.userAddress }, { githubUsername: doc.githubUsername }] }, ciOpts);
            } else if (doc.userAddress) {
                existing = await coll.findOne({ userAddress: doc.userAddress }, ciOpts);
            } else if (doc.githubUsername) {
                existing = await coll.findOne({ githubUsername: doc.githubUsername }, ciOpts);
            }

            if (existing) {
                const needsUpdate = (
                    (doc.userAddress && existing.userAddress !== doc.userAddress) ||
                    (doc.githubUsername && existing.githubUsername !== doc.githubUsername)
                );
                if (!needsUpdate) {
                    console.log(`Skip (${i + 1}/${items.length}): already exists for ${JSON.stringify({ userAddress: doc.userAddress, githubUsername: doc.githubUsername })}`);
                    skipped++;
                    continue;
                }
                if (args.dryRun) {
                    console.log(`Dry update (${i + 1}/${items.length}): _id=${existing._id} set`, doc);
                    skipped++;
                    continue;
                }
                await coll.updateOne({ _id: existing._id }, { $set: doc }, ciOpts);
                console.log(`Updated (${i + 1}/${items.length}): _id=${existing._id} set`, doc);
                skipped++;
                continue;
            }

            if (args.dryRun) {
                console.log(`Dry insert (${i + 1}/${items.length}):`, doc);
                inserted++;
                continue;
            }

            // Insert minimal doc; future fields can be merged into doc via FIELD_MAPPINGS
            const toInsert = { ...doc };
            await coll.insertOne(toInsert);
            console.log(`Inserted (${i + 1}/${items.length}):`, toInsert);
            inserted++;
        }

        console.log('\nDone.');
        console.log(`Inserted: ${inserted}`);
        console.log(`Skipped: ${skipped}`);
    } finally {
        await client.close().catch(() => { });
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});


