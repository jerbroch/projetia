import { config } from "dotenv";
import { configureDatabaseEnv } from "./database-url";

config({ path: ".env.local" });
config({ path: ".env" });

configureDatabaseEnv();
