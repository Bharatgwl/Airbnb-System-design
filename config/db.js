import PG from "pg";
import "dotenv/config"
const pool = new PG.Pool();
export default pool;
