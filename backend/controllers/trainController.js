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

// trains
const get_trains = async (req, res) => {
  const { search } = req.query;
  const { page, limit, offset } = getPagination(req.query);

  try {
    const pool = await getPool();
    const countResult = await pool.request()
      .input("search", sql.VarChar, `%${search || ""}%`)
      .query(`
        SELECT COUNT(*) AS total
        FROM trains
        WHERE (@search = '%%' OR train_name LIKE @search)
      `);

    const result = await pool.request()
      .input("search", sql.VarChar, `%${search || ""}%`)
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, limit)
      .query(`
        SELECT *
        FROM trains
        WHERE (@search = '%%' OR train_name LIKE @search)
        ORDER BY train_id
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

const get_trains_by_id = async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return sendError(res, 400, "Invalid train id.");
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("id", sql.Int, id)
      .query("SELECT * FROM trains WHERE train_id = @id");

    return res.json(result.recordset);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const get_train_availability = async (req, res) => {
  const { id } = req.params;
  const { route_id, travel_date } = req.query;

  if (!isValidId(id) || !isValidId(route_id)) {
    return sendError(res, 400, "Invalid train or route id.");
  }

  if (!travel_date || Number.isNaN(new Date(travel_date).getTime())) {
    return sendError(res, 400, "Please enter a valid travel date.");
  }

  try {
    const pool = await getPool();

    const routeResult = await pool.request()
      .input("train_id", sql.Int, id)
      .input("route_id", sql.Int, route_id)
      .query(`
        SELECT tr.route_id, t.train_id, t.train_name, t.fc_capacity, t.economy_capacity
        FROM train_routes tr
        JOIN trains t ON tr.train_id = t.train_id
        WHERE tr.route_id = @route_id AND tr.train_id = @train_id
      `);

    if (routeResult.recordset.length === 0) {
      return sendError(res, 404, "Train is not assigned to this route.");
    }

    const bookedResult = await pool.request()
      .input("train_id", sql.Int, id)
      .input("route_id", sql.Int, route_id)
      .input("travel_date", sql.Date, travel_date)
      .query(`
        SELECT
          SUM(CASE WHEN class = 'first' THEN 1 ELSE 0 END) AS booked_first,
          SUM(CASE WHEN class = 'economy' THEN 1 ELSE 0 END) AS booked_economy
        FROM tickets
        WHERE train_id = @train_id
        AND route_id = @route_id
        AND travel_date = @travel_date
        AND status <> 'cancelled'
      `);

    const train = routeResult.recordset[0];
    const booked = bookedResult.recordset[0];
    const bookedFirst = booked.booked_first || 0;
    const bookedEconomy = booked.booked_economy || 0;

    return res.json({
      train_id: train.train_id,
      train_name: train.train_name,
      route_id: train.route_id,
      travel_date,
      first: {
        total: train.fc_capacity,
        booked: bookedFirst,
        available: train.fc_capacity - bookedFirst,
      },
      economy: {
        total: train.economy_capacity,
        booked: bookedEconomy,
        available: train.economy_capacity - bookedEconomy,
      },
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = { get_trains, get_trains_by_id, get_train_availability };
