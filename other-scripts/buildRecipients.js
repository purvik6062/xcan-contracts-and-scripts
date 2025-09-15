/* eslint-disable no-console */
// Build recipients.json from data.json by extracting `userAddress`
// Usage: node buildRecipients.js [inputJsonPath] [outputJsonPath]

const fs = require('fs');
const path = require('path');
const { isAddress } = require('ethers');

function readJson(filePath) {
    const absolute = path.resolve(filePath);
    if (!fs.existsSync(absolute)) {
        throw new Error(`Input file not found: ${absolute}`);
    }
    const content = fs.readFileSync(absolute, 'utf8');
    try {
        return JSON.parse(content);
    } catch (e) {
        throw new Error(`Invalid JSON in ${absolute}: ${e.message}`);
    }
}

function writeJson(filePath, data) {
    const absolute = path.resolve(filePath);
    fs.writeFileSync(absolute, JSON.stringify(data, null, 2));
}

function extractAddresses(records) {
    if (!Array.isArray(records)) {
        throw new Error('Expected input JSON to be an array of objects');
    }
    const seen = new Set();
    const result = [];
    for (const item of records) {
        if (!item || typeof item !== 'object') continue;
        const addr = item.userAddress || item.address || item.wallet || null;
        if (!addr || typeof addr !== 'string') continue;
        const trimmed = addr.trim();
        if (!isAddress(trimmed)) continue;
        const checksum = trimmed;
        if (seen.has(checksum.toLowerCase())) continue;
        seen.add(checksum.toLowerCase());
        result.push(checksum);
    }
    return result;
}

async function main() {
    // Defaults to current working directory files
    const inputPath = process.argv[2] || 'data.json';
    const outputPath = process.argv[3] || 'recipients.json';

    console.log(`Reading: ${inputPath}`);
    const records = readJson(inputPath);
    const recipients = extractAddresses(records);
    if (recipients.length === 0) {
        throw new Error('No valid addresses found. Ensure objects contain `userAddress`.');
    }
    console.log(`Found ${recipients.length} unique valid addresses.`);

    console.log(`Writing: ${outputPath}`);
    writeJson(outputPath, recipients);
    console.log('Done.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});


