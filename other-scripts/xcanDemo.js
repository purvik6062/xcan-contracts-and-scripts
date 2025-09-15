/* eslint-disable no-console */
// Demo script to interact with the deployed XCAN ERC-721
// Usage:
//  node xcanDemo.js single <to> <uri>
//  node xcanDemo.js self <uri>
//  node xcanDemo.js open-public <true|false>
//  node xcanDemo.js batch-same <recipients.json> <uri> [chunkSize]
//  node xcanDemo.js batch-uris <recipients.json> <uris.json> [chunkSize]
//
// Required envs: ARBITRUM_SEPOLIA_RPC_URL, ARBITRUM_SEPOLIA_PRIVATE_KEY
// Optional env: XCAN_ADDRESS (defaults to the address provided by you)

require('dotenv').config();
const { JsonRpcProvider, Wallet, Contract } = require('ethers');
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

function readJsonArray(filePath, what) {
    const absolute = path.resolve(filePath);
    if (!fs.existsSync(absolute)) {
        throw new Error(`${what} file not found: ${absolute}`);
    }
    const raw = fs.readFileSync(absolute, 'utf8');
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) {
        throw new Error(`${what} JSON must be a non-empty array`);
    }
    return arr;
}

// Minimal ABI for XCAN
const XCAN_ABI = [
    'function mintOne(address to, string uri) external returns (uint256 tokenId)',
    'function mintBatchSameURI(address[] recipients, string uri) external returns (uint256[] tokenIds)',
    'function mintBatchWithURIs(address[] recipients, string[] uris) external returns (uint256[] tokenIds)',
    'function mintSelf(string uri) external returns (uint256 tokenId)',
    'function setPublicMintOpen(bool open) external',
    'function publicMintOpen() view returns (bool)'
];

async function getClient() {
    assertEnv();
    const rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC_URL;
    const privateKey = process.env.ARBITRUM_SEPOLIA_PRIVATE_KEY;
    const provider = new JsonRpcProvider(rpcUrl);
    const wallet = new Wallet(privateKey, provider);

    // const defaultAddress = '0x9fb4dBFeF1E3CA45E95a67ADF6AaCcf18791A4BB';
    const defaultAddress = '0x8f5bAaFf70Bc6202537271e65ea86Bfc433b898c';
    const xcanAddress = process.env.XCAN_ADDRESS || defaultAddress;
    const xcan = new Contract(xcanAddress, XCAN_ABI, wallet);
    return { wallet, xcan };
}

async function mintSingle(to, uri) {
    const { wallet, xcan } = await getClient();
    console.log(`Sender: ${wallet.address}`);
    console.log(`XCAN: ${xcan.target}`);
    console.log(`Minting 1 token to ${to}...`);
    const tx = await xcan.mintOne(to, uri);
    console.log(`Submitted tx: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Confirmed in block ${receipt.blockNumber}`);
}

async function mintSelf(uri) {
    const { wallet, xcan } = await getClient();
    console.log(`Sender: ${wallet.address}`);
    console.log(`XCAN: ${xcan.target}`);
    const isOpen = await xcan.publicMintOpen();
    console.log(`publicMintOpen: ${isOpen}`);
    if (!isOpen) {
        console.log('Public mint is closed. Ask the owner to open it with: node xcanDemo.js open-public true');
    }
    console.log('Minting to self...');
    const tx = await xcan.mintSelf(uri);
    console.log(`Submitted tx: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Confirmed in block ${receipt.blockNumber}`);
}

async function setPublicMint(open) {
    const { wallet, xcan } = await getClient();
    console.log(`Sender: ${wallet.address}`);
    console.log(`XCAN: ${xcan.target}`);
    console.log(`Setting publicMintOpen = ${open}`);
    const tx = await xcan.setPublicMintOpen(open);
    console.log(`Submitted tx: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Confirmed in block ${receipt.blockNumber}`);
}

async function mintBatchSame(recipientsPath, uri, chunkSize) {
    const { wallet, xcan } = await getClient();
    const recipients = readJsonArray(recipientsPath, 'recipients');
    const size = Number(chunkSize || 50);

    console.log(`Sender: ${wallet.address}`);
    console.log(`XCAN: ${xcan.target}`);
    console.log(`Total recipients: ${recipients.length}`);
    console.log(`Chunk size: ${size}`);

    let sent = 0;
    for (let i = 0; i < recipients.length; i += size) {
        const slice = recipients.slice(i, i + size);
        console.log(`\nMinting batch ${i / size + 1} (${slice.length})...`);
        const tx = await xcan.mintBatchSameURI(slice, uri);
        console.log(`Submitted tx: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`Confirmed in block ${receipt.blockNumber}`);
        sent += slice.length;
        console.log(`Progress: ${sent}/${recipients.length}`);
    }
}

async function mintBatchWithUris(recipientsPath, urisPath, chunkSize) {
    const { wallet, xcan } = await getClient();
    const recipients = readJsonArray(recipientsPath, 'recipients');
    const uris = readJsonArray(urisPath, 'uris');
    if (recipients.length !== uris.length) {
        throw new Error(`Length mismatch: recipients=${recipients.length} uris=${uris.length}`);
    }
    const size = Number(chunkSize || 25); // smaller by default due to calldata size

    console.log(`Sender: ${wallet.address}`);
    console.log(`XCAN: ${xcan.target}`);
    console.log(`Total items: ${recipients.length}`);
    console.log(`Chunk size: ${size}`);

    let sent = 0;
    for (let i = 0; i < recipients.length; i += size) {
        const rSlice = recipients.slice(i, i + size);
        const uSlice = uris.slice(i, i + size);
        console.log(`\nMinting batch ${i / size + 1} (${rSlice.length})...`);
        const tx = await xcan.mintBatchWithURIs(rSlice, uSlice);
        console.log(`Submitted tx: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`Confirmed in block ${receipt.blockNumber}`);
        sent += rSlice.length;
        console.log(`Progress: ${sent}/${recipients.length}`);
    }
}

async function main() {
    const [mode, a, b, c] = process.argv.slice(2);
    if (!mode) {
        console.log('Usage:');
        console.log('  node xcanDemo.js single <to> <uri>');
        console.log('  node xcanDemo.js self <uri>');
        console.log('  node xcanDemo.js open-public <true|false>');
        console.log('  node xcanDemo.js batch-same <recipients.json> <uri> [chunkSize]');
        console.log('  node xcanDemo.js batch-uris <recipients.json> <uris.json> [chunkSize]');
        process.exit(1);
    }

    if (mode === 'single') {
        if (!a || !b) throw new Error('single requires <to> <uri>');
        await mintSingle(a, b);
    } else if (mode === 'self') {
        if (!a) throw new Error('self requires <uri>');
        await mintSelf(a);
    } else if (mode === 'open-public') {
        if (a !== 'true' && a !== 'false') throw new Error('open-public requires <true|false>');
        await setPublicMint(a === 'true');
    } else if (mode === 'batch-same') {
        if (!a || !b) throw new Error('batch-same requires <recipients.json> <uri>');
        await mintBatchSame(a, b, c);
    } else if (mode === 'batch-uris') {
        if (!a || !b) throw new Error('batch-uris requires <recipients.json> <uris.json>');
        await mintBatchWithUris(a, b, c);
    } else {
        throw new Error(`Unknown mode: ${mode}`);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});


