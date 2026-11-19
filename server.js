import pool from "./config/db.js";
import express from "express";
import "dotenv/config";
import bookingRoutes from "./routes/bookingRoutes.js"


const PORT = 8000;
const app = express();
app.use(express.json())

app.use("/", bookingRoutes);

app.get("/health", (req, res) => {
    res.json({
        status: "ok"
    })
})


try {
    await pool.query("SELECT 1");
    console.log("connected to database");
    // console.log(rs)

    app.listen(PORT, () => {
        console.log(`server is listening on port ${PORT}`)
    })
} catch (error) {
    console.error("error connecting database" + error.message);
    await pool.end()
    process.exitCode = 1

}