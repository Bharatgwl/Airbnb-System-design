import pool from "../config/db.js";

export async function findUserById(userId) {
    try {
        const res = await pool.query("SELECT * FROM users where user_id=($1)", [userId])
        return res.rows[0] ?? null
    } catch (error) {
        console.error("user lookup failed:", error.code);
        throw error

    }
}