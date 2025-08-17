// Legacy placeholder; no-op seeder. Kept to avoid broken imports in build.
async function main() {
    console.log('No seed data. Skipping.');
}

main().catch((err) => {
    console.error('Seed script error:', err);
    process.exit(1);
});