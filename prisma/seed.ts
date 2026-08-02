async function main() {
  console.log("Database seeding skipped (mock auth mode).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
