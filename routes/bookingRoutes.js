import { Router } from "express";
import { createBooking } from "../services/bookingServices.js";
const router = Router()

router.post('/bookings', async (req, res) => {
    const { user_id, property_id, check_in_date } = req.body ?? {};
    try {
        const booking = await createBooking(user_id, property_id, check_in_date)
        return res.status(201).json({ booking });
    } catch (error) {
        if (error.code === "INVALID_INPUT") {
            return res.status(400).json({ error: error.message });
        }

        if (
            error.code === "USER_NOT_FOUND" ||
            error.code === "PROPERTY_NOT_FOUND"
        ) {
            return res.status(404).json({ error: error.message });
        }

        if (error.code === "23505") {
            return res.status(409).json({
                error: "This night is already booked",
            });
        }

        console.error("Booking request failed:", error.code);

        return res.status(500).json({
            error: "Could not create booking",
        });
    }
})
export default router;