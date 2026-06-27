const sql = require("mssql/msnodesqlv8");
require("dotenv").config();

const dbConfig = {
  server: process.env.SERVER_NAME,
  database: process.env.DB_NAME,
  port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined,
  driver: "msnodesqlv8",
  options: {
    trustedConnection: true,
    trustServerCertificate: true,
  },
};

let pool;

const getPool = async () => {
  if (pool) {
    return pool;
  }

  pool = await sql.connect(dbConfig);
  return pool;
};

module.exports = { sql, getPool };
