import { saveBooking } from "../repositories/bookingRepository.js";
import { findUserById } from "../repositories/userRepository.js";
import { findPropertyById } from "../repositories/propertyRepository.js";

function bookingError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

export async function createBooking(userId, propertyId, checkInDate) {
    // IDs check karo.
    if (
        !Number.isInteger(userId) || userId <= 0 || userId > 2147483647 ||
        !Number.isInteger(propertyId) || propertyId <= 0 || propertyId > 2147483647
    ) {
        throw bookingError("INVALID_INPUT", "Provide valid positive integer IDs");
    }

    // Date ka format check karo.
    if (
        typeof checkInDate !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(checkInDate)
    ) {
        throw bookingError("INVALID_INPUT", "Date must use YYYY-MM-DD format");
    }

    // February 30 jaisi invalid dates reject karo.
    const parsedDate = new Date(`${checkInDate}T00:00:00.000Z`);

    if (
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== checkInDate
    ) {
        throw bookingError("INVALID_INPUT", "Provide a valid calendar date");
    }

    const user = await findUserById(userId);

    if (user === null) {
        throw bookingError("USER_NOT_FOUND", "User not found");
    }

    const property = await findPropertyById(propertyId);

    if (property === null) {
        throw bookingError("PROPERTY_NOT_FOUND", "Property not found");
    }

    // Property ke timezone mein aaj ki date nikalo.
    const dateParts = new Intl.DateTimeFormat("en-US", {
        timeZone: property.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());

    const year = dateParts.find(part => part.type === "year").value;
    const month = dateParts.find(part => part.type === "month").value;
    const day = dateParts.find(part => part.type === "day").value;
    const today = `${year}-${month}-${day}`;

    if (checkInDate <= today) {
        throw bookingError("INVALID_INPUT", "Bookings are allowed from tomorrow");
    }

    return saveBooking(userId, propertyId, checkInDate);
}