const fs = require('fs');
const { execSync } = require('child_process');

try {
    const baseRaw = execSync('git show remotes/origin/devin/1777263781-security-fixes:backend/seeds.json').toString('utf8');
    const base = JSON.parse(baseRaw);
    const enrichedProducts = JSON.parse(fs.readFileSync('backend/seeds.json', 'utf8'));

    if (base.products) {
        console.log(`Replacing ${base.products.length} base products with ${enrichedProducts.length} enriched products.`);
        base.products = enrichedProducts;
    } else {
        console.log('Base does not have products key. Adding products key.');
        base.products = enrichedProducts;
    }

    fs.writeFileSync('backend/seeds.json', JSON.stringify(base, null, 2));
    console.log('Merged seeds.json successfully!');
} catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
}
