const { sql, getPool } = require("../config/connectdb");

const sendError = (res, status, message) => {
  return res.status(status).json({ error: message });
};

const isValidId = (id) => {
  return Number.isInteger(Number(id)) && Number(id) > 0;
};

const getPagination = (query) => {
  const page = Number(query.page) > 0 ? Number(query.page) : 1;
  const limit = Number(query.limit) > 0 ? Number(query.limit) : 10;
  const finalLimit = limit > 50 ? 50 : limit;
  const offset = (page - 1) * finalLimit;

  return { page, limit: finalLimit, offset };
};

const getPaginationResult = (page, limit, total, data) => {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    data,
  };
};

// stations
const get_stations = async (req, res) => {
  const { search } = req.query;
  const { page, limit, offset } = getPagination(req.query);

  try {
    const pool = await getPool();
    const countResult = await pool.request()
      .input("search", sql.VarChar, `%${search || ""}%`)
      .query(`
        SELECT COUNT(*) AS total
        FROM stations
        WHERE (@search = '%%' OR station_name LIKE @search)
      `);

    const result = await pool.request()
      .input("search", sql.VarChar, `%${search || ""}%`)
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, limit)
      .query(`
        SELECT *
        FROM stations
        WHERE (@search = '%%' OR station_name LIKE @search)
        ORDER BY station_id
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `);

    return res.json(getPaginationResult(
      page,
      limit,
      countResult.recordset[0].total,
      result.recordset
    ));
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const get_stations_by_id = async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return sendError(res, 400, "Invalid station id.");
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("id", sql.Int, id)
      .query("SELECT * FROM stations WHERE station_id = @id");

    return res.json(result.recordset);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = { get_stations, get_stations_by_id };
