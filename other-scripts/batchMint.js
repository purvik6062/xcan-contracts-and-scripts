/* eslint-disable no-console */
// Batch mint to many addresses using the deployed BatchMinter contract
// Env required: ARBITRUM_SEPOLIA_RPC_URL, ARBITRUM_SEPOLIA_PRIVATE_KEY, URI

require('dotenv').config();
const { JsonRpcProvider, Wallet, Contract } = require('ethers');
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

const REQUIRED_ENVS = ['ARBITRUM_SEPOLIA_RPC_URL', 'ARBITRUM_SEPOLIA_PRIVATE_KEY'];

function assertEnv() {
    for (const key of REQUIRED_ENVS) {
        if (!process.env[key] || String(process.env[key]).trim() === '') {
            throw new Error(`Missing required env: ${key}`);
        }
    }
}

function readRecipients(filePath) {
    const absolute = path.resolve(filePath);
    if (!fs.existsSync(absolute)) {
        throw new Error(`Recipients file not found: ${absolute}`);
    }
    const raw = fs.readFileSync(absolute, 'utf8');
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) {
        throw new Error('Recipients JSON must be a non-empty array of addresses');
    }
    return arr;
}

// Minimal ABI for BatchMinter
const BATCH_MINTER_ABI = [
    'function mintBatchSameURI(address[] recipients, string uri) external returns (uint256[] tokenIds)'
];

async function main() {
    assertEnv();

    const rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC_URL;
    const privateKey = process.env.ARBITRUM_SEPOLIA_PRIVATE_KEY;
    const batchMinterAddress = "0xf142023900f172EA1D2163fBfeEe9AfF5adD0f40";
    const uri = "ipfs://QmP4qxFaQzW8cvWVSwzBAJUYA1TyF9xHVPsy7WYYKap2AC";
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
        throw new Error('Missing required env: MONGODB_URI');
    }

    const recipientsFile = process.argv[2] || 'recipients.json';
    const chunkSizeArg = process.argv[3];
    // const chunkSize = chunkSizeArg ? Number(chunkSizeArg) : 50;
    const chunkSize = 250;

    const recipients = readRecipients(recipientsFile);

    const provider = new JsonRpcProvider(rpcUrl);
    const wallet = new Wallet(privateKey, provider);
    const minter = new Contract(batchMinterAddress, BATCH_MINTER_ABI, wallet);

    console.log(`Using sender: ${wallet.address}`);
    console.log(`BatchMinter: ${batchMinterAddress}`);
    console.log(`Total recipients: ${recipients.length}`);
    console.log(`Chunk size: ${chunkSize}`);

    // Static metadata for level 0 "First Blood"
    const STATIC_LEVEL = {
        level: 0,
        levelKey: 'first-blood',
        levelName: 'First Blood',
        metadataUrl: 'https://gateway.pinata.cloud/ipfs/QmP4qxFaQzW8cvWVSwzBAJUYA1TyF9xHVPsy7WYYKap2AC',
        imageUrl: 'https://gateway.pinata.cloud/ipfs/QmNruJWZFoSBg6n3B5F3ZKHTGMVpiWEj5eTr5ckvWjFvvV',
        network: 'arbitrum-sepolia'
    };

    const client = new MongoClient(MONGODB_URI, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true } });
    await client.connect();
    const db = client.db('inorbit_modules');
    const coll = db.collection('minted-nft');

    try {
        let sent = 0;
        for (let i = 0; i < recipients.length; i += chunkSize) {
            const slice = recipients.slice(i, i + chunkSize);
            const lowers = slice.map((a) => String(a).trim().toLowerCase());
            const already = await coll.find({ userAddress: { $in: lowers }, 'mintedLevels.levelKey': 'first-blood' }, { projection: { userAddress: 1 } }).toArray();
            const skipSet = new Set(already.map((d) => d.userAddress));
            const toMint = slice.filter((a) => !skipSet.has(String(a).trim().toLowerCase()));
            const skippedCount = slice.length - toMint.length;

            console.log(`\nBatch ${i / chunkSize + 1}: ${slice.length} recipients, ${skippedCount} already have first-blood, ${toMint.length} to mint.`);
            if (toMint.length === 0) {
                console.log('Nothing to mint in this batch. Skipping transaction.');
                continue;
            }

            const tx = await minter.mintBatchSameURI(toMint, uri);
            console.log(`Submitted tx: ${tx.hash}`);
            const receipt = await tx.wait();
            console.log(`Confirmed in block ${receipt.blockNumber}`);

            const block = await provider.getBlock(receipt.blockNumber);
            const mintedAt = new Date(block.timestamp * 1000);

            // For each newly minted recipient in this batch, update DB
            for (const addr of toMint) {
                const userAddress = String(addr).trim().toLowerCase();
                const existing = await coll.findOne({ userAddress });
                const hasLevel = Array.isArray(existing?.mintedLevels) && existing.mintedLevels.some((l) => l && l.levelKey === 'first-blood');

                const levelEntry = {
                    level: STATIC_LEVEL.level,
                    levelKey: STATIC_LEVEL.levelKey,
                    levelName: STATIC_LEVEL.levelName,
                    transactionHash: receipt.hash,
                    metadataUrl: STATIC_LEVEL.metadataUrl,
                    imageUrl: STATIC_LEVEL.imageUrl,
                    mintedAt,
                    network: STATIC_LEVEL.network
                };

                const update = {
                    $set: { lastMintedAt: mintedAt },
                    $push: hasLevel ? undefined : { mintedLevels: levelEntry },
                    $setOnInsert: { userAddress }
                };
                if (!hasLevel) {
                    update.$inc = { totalMinted: 1 };
                }

                // Clean undefined operators to avoid driver complaints
                if (update.$push === undefined) delete update.$push;

                await coll.updateOne(
                    { userAddress },
                    update,
                    { upsert: true }
                );
            }

            sent += toMint.length;
            console.log(`Progress (newly minted): ${sent}/${recipients.length}`);
        }
    } finally {
        await client.close().catch(() => { });
    }

    console.log('\nAll done.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});


