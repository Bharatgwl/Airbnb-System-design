import pool from "./config/db.js";
import { findUserById } from "./repositories/userRepository.js";
import { findPropertyById } from "./repositories/propertyRepository.js";

try {
    console.log("Existing user:", await findUserById(101));
    console.log("Unknown user:", await findUserById(999));
    console.log("Property:", await findPropertyById(501));
} catch (error) {
    console.error("Lookup test failed:", error.code);
    process.exitCode = 1;
} finally {
    await pool.end();
}