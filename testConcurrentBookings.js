import assert from "node:assert/strict";
import pool from "./config/db.js";

const propertyId = 501;
const checkInDate = "2026-12-13";

try {
    const results = await Promise.all(
        [101, 102].map(async (userId) => {
            const response = await fetch("http://localhost:8000/bookings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: userId,
                    property_id: propertyId,
                    check_in_date: checkInDate,
                }),
            });

            return {
                userId,
                status: response.status,
                body: await response.json(),
            };
        })
    );

    console.log(results);

    const statuses = results.map(result => result.status).sort();
    assert.deepEqual(statuses, [201, 409]);

    const saved = await pool.query(
        `SELECT booking_id, user_id
         FROM bookings
         WHERE property_id = $1 AND check_in_date = $2`,
        [propertyId, checkInDate]
    );

    assert.equal(saved.rowCount, 1);

    const winner = results.find(result => result.status === 201);
    assert.equal(saved.rows[0].user_id, winner.userId);

    console.log("PASS: One booking saved for the successful guest.");
} catch (error) {
    console.error("Test failed:", error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}