import pool from "../config/db.js";

export async function saveBooking(userId, propertyId,
    checkInDate) {
    try {
        const res = await pool.query("insert into bookings (user_id, property_id,check_in_date) values($1,$2,$3) RETURNING *", [userId, propertyId, checkInDate])

        return res.rows[0]
    }
    catch (err) {
        console.error("Booking failed", err.code)

        throw err;
    }
}