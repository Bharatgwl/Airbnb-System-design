import pool from "../config/db.js";

export async function findPropertyById(propertyId) {
    try {
        const res = await pool.query("SELECT * FROM properties where property_id=($1)", [propertyId])
        return res.rows[0] ?? null
    } catch (error) {
        console.error("Property lookup failed:", error.code);
        throw error

    }
}