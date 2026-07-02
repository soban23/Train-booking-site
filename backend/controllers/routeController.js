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

// schedules/routes
const get_routes = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT * FROM train_routes");
    return res.json(result.recordset);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const get_routes_namely = async (req, res) => {
  const { source, destination } = req.query;
  const { page, limit, offset } = getPagination(req.query);

  try {
    const pool = await getPool();
    const countResult = await pool.request()
      .input("source", sql.VarChar, `%${source || ""}%`)
      .input("destination", sql.VarChar, `%${destination || ""}%`)
      .query(`
        SELECT COUNT(*) AS total
        FROM train_routes tr
        JOIN stations s1 ON tr.source_station_id = s1.station_id
        JOIN stations s2 ON tr.destination_station_id = s2.station_id
        WHERE (@source = '%%' OR s1.station_name LIKE @source)
        AND (@destination = '%%' OR s2.station_name LIKE @destination)
      `);

    const request = pool.request()
      .input("source", sql.VarChar, `%${source || ""}%`)
      .input("destination", sql.VarChar, `%${destination || ""}%`)
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, limit);

    const result = await request.query(`
      SELECT
        tr.route_id,
        t.train_name,
        s1.station_name AS source,
        s2.station_name AS destination,
        s1.station_id AS source_id,
        s2.station_id AS destination_id
      FROM train_routes tr
      JOIN trains t ON tr.train_id = t.train_id
      JOIN stations s1 ON tr.source_station_id = s1.station_id
      JOIN stations s2 ON tr.destination_station_id = s2.station_id
      WHERE (@source = '%%' OR s1.station_name LIKE @source)
      AND (@destination = '%%' OR s2.station_name LIKE @destination)
      ORDER BY tr.route_id
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

const get_routes_by_id = async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return sendError(res, 400, "Invalid route id.");
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("id", sql.Int, id)
      .query("SELECT * FROM train_routes WHERE route_id = @id");

    return res.json(result.recordset);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const get_routes_details = async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return sendError(res, 400, "Invalid route id.");
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("id", sql.Int, id)
      .query(`
        SELECT *
        FROM train_routes tr
        JOIN train_schedules ts ON tr.train_id = ts.train_id
        JOIN trains t ON tr.train_id = t.train_id
        WHERE tr.route_id = @id AND station_id = destination_station_id
      `);

    return res.json(result.recordset);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const get_schedules_by_trainid = async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return sendError(res, 400, "Invalid train id.");
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("id", sql.Int, id)
      .query("SELECT * FROM train_schedules WHERE train_id = @id");

    return res.json(result.recordset);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  get_routes,
  get_routes_namely,
  get_routes_by_id,
  get_routes_details,
  get_schedules_by_trainid,
};
