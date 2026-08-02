import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { ensureDefaultAdmin } = await import("../src/lib/users");
  await ensureDefaultAdmin();
  console.log("Default administrator account ensured.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
