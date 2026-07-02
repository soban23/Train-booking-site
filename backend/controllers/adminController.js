const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { sql, getPool } = require("../config/connectdb");
require("dotenv").config();

const sendError = (res, status, message) => {
  return res.status(status).json({ error: message });
};

const isValidId = (id) => {
  return Number.isInteger(Number(id)) && Number(id) > 0;
};

const isValidStatus = (status) => {
  return ["active", "inactive", "maintenance"].includes(status);
};

const isValidClass = (className) => {
  return ["economy", "first"].includes(className);
};

const getPagination = (query) => {
  const page = Number(query.page) > 0 ? Number(query.page) : 1;
  const limit = Number(query.limit) > 0 ? Number(query.limit) : 10;
  const finalLimit = limit > 50 ? 50 : limit;
  const offset = (page - 1) * finalLimit;

  return { page, limit: finalLimit, offset };
};

const getPaginationResult = (page, limit, total, data) => {
  return { page, limit, total, totalPages: Math.ceil(total / limit), data };
};

const adminLogin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return sendError(res, 400, "Email and password are required.");
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("email", sql.VarChar, email)
      .query("SELECT * FROM admins WHERE email = @email AND status = 'active'");

    if (result.recordset.length === 0) {
      return sendError(res, 400, "Admin not found.");
    }

    const admin = result.recordset[0];
    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      return sendError(res, 400, "Invalid password.");
    }

    const token = jwt.sign(
      { admin_id: admin.admin_id, role: "admin" },
      process.env.SECRET_KEY,
      { expiresIn: "2h" }
    );

    return res.json({ message: "Admin login successful.", token });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM passengers) AS total_passengers,
        (SELECT COUNT(*) FROM trains) AS total_trains,
        (SELECT COUNT(*) FROM stations) AS total_stations,
        (SELECT COUNT(*) FROM train_routes) AS total_routes,
        (SELECT COUNT(*) FROM tickets) AS total_tickets,
        (SELECT COUNT(*) FROM tickets WHERE status = 'cancelled') AS cancelled_tickets,
        (SELECT COUNT(*) FROM payments WHERE payment_status = 'pending') AS pending_payments,
        (SELECT ISNULL(SUM(amount), 0) FROM payments WHERE payment_status = 'completed') AS total_revenue
    `);

    return res.json(result.recordset[0]);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const addTrain = async (req, res) => {
  const { train_name, fc_capacity, economy_capacity, status } = req.body;

  if (!train_name || !fc_capacity || !economy_capacity) {
    return sendError(res, 400, "Train name and capacities are required.");
  }

  if (Number(fc_capacity) <= 0 || Number(economy_capacity) <= 0) {
    return sendError(res, 400, "Capacity must be greater than zero.");
  }

  if (status && !isValidStatus(status)) {
    return sendError(res, 400, "Invalid train status.");
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("train_name", sql.VarChar, train_name)
      .input("fc_capacity", sql.Int, fc_capacity)
      .input("economy_capacity", sql.Int, economy_capacity)
      .input("status", sql.VarChar, status || "active")
      .query(`
        INSERT INTO trains (train_name, fc_capacity, economy_capacity, status)
        OUTPUT INSERTED.train_id
        VALUES (@train_name, @fc_capacity, @economy_capacity, @status)
      `);

    return res.status(201).json({ message: "Train added successfully.", train_id: result.recordset[0].train_id });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const updateTrain = async (req, res) => {
  const { id } = req.params;
  const { train_name, fc_capacity, economy_capacity, status } = req.body;

  if (!isValidId(id)) {
    return sendError(res, 400, "Invalid train id.");
  }

  if (!train_name || !fc_capacity || !economy_capacity || !status) {
    return sendError(res, 400, "All train fields are required.");
  }

  if (!isValidStatus(status)) {
    return sendError(res, 400, "Invalid train status.");
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("id", sql.Int, id)
      .input("train_name", sql.VarChar, train_name)
      .input("fc_capacity", sql.Int, fc_capacity)
      .input("economy_capacity", sql.Int, economy_capacity)
      .input("status", sql.VarChar, status)
      .query(`
        UPDATE trains
        SET train_name = @train_name,
            fc_capacity = @fc_capacity,
            economy_capacity = @economy_capacity,
            status = @status
        WHERE train_id = @id
      `);

    if (result.rowsAffected[0] === 0) {
      return sendError(res, 404, "Train not found.");
    }

    return res.json({ message: "Train updated successfully." });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const deleteTrain = async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return sendError(res, 400, "Invalid train id.");
  }

  try {
    const pool = await getPool();
    const ticketCheck = await pool.request()
      .input("id", sql.Int, id)
      .query("SELECT TOP 1 ticket_id FROM tickets WHERE train_id = @id");

    const routeCheck = await pool.request()
      .input("id", sql.Int, id)
      .query("SELECT TOP 1 route_id FROM train_routes WHERE train_id = @id");

    const scheduleCheck = await pool.request()
      .input("id", sql.Int, id)
      .query("SELECT TOP 1 schedule_id FROM train_schedules WHERE train_id = @id");

    if (
      ticketCheck.recordset.length > 0 ||
      routeCheck.recordset.length > 0 ||
      scheduleCheck.recordset.length > 0
    ) {
      await pool.request()
        .input("id", sql.Int, id)
        .query("UPDATE trains SET status = 'inactive' WHERE train_id = @id");

      return res.json({ message: "Train is used in the system, so it was marked inactive." });
    }

    await pool.request()
      .input("id", sql.Int, id)
      .query("DELETE FROM trains WHERE train_id = @id");

    return res.json({ message: "Train deleted successfully." });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const addStation = async (req, res) => {
  const { station_name, city } = req.body;

  if (!station_name) {
    return sendError(res, 400, "Station name is required.");
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("station_name", sql.VarChar, station_name)
      .input("city", sql.VarChar, city || null)
      .query(`
        INSERT INTO stations (station_name, city)
        OUTPUT INSERTED.station_id
        VALUES (@station_name, @city)
      `);

    return res.status(201).json({ message: "Station added successfully.", station_id: result.recordset[0].station_id });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const updateStation = async (req, res) => {
  const { id } = req.params;
  const { station_name, city } = req.body;

  if (!isValidId(id)) {
    return sendError(res, 400, "Invalid station id.");
  }

  if (!station_name) {
    return sendError(res, 400, "Station name is required.");
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("id", sql.Int, id)
      .input("station_name", sql.VarChar, station_name)
      .input("city", sql.VarChar, city || null)
      .query("UPDATE stations SET station_name = @station_name, city = @city WHERE station_id = @id");

    if (result.rowsAffected[0] === 0) {
      return sendError(res, 404, "Station not found.");
    }

    return res.json({ message: "Station updated successfully." });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const deleteStation = async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return sendError(res, 400, "Invalid station id.");
  }

  try {
    const pool = await getPool();
    const routeCheck = await pool.request()
      .input("id", sql.Int, id)
      .query(`
        SELECT TOP 1 route_id
        FROM train_routes
        WHERE source_station_id = @id OR destination_station_id = @id
      `);

    if (routeCheck.recordset.length > 0) {
      return sendError(res, 400, "Station is used in routes and cannot be deleted.");
    }

    await pool.request()
      .input("id", sql.Int, id)
      .query("DELETE FROM stations WHERE station_id = @id");

    return res.json({ message: "Station deleted successfully." });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const createRoute = async (req, res) => {
  const { train_id, source_station_id, destination_station_id, status } = req.body;

  if (!isValidId(train_id) || !isValidId(source_station_id) || !isValidId(destination_station_id)) {
    return sendError(res, 400, "Valid train and station ids are required.");
  }

  if (Number(source_station_id) === Number(destination_station_id)) {
    return sendError(res, 400, "Source and destination cannot be same.");
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("train_id", sql.Int, train_id)
      .input("source_station_id", sql.Int, source_station_id)
      .input("destination_station_id", sql.Int, destination_station_id)
      .input("status", sql.VarChar, status || "active")
      .query(`
        INSERT INTO train_routes (train_id, source_station_id, destination_station_id, status)
        OUTPUT INSERTED.route_id
        VALUES (@train_id, @source_station_id, @destination_station_id, @status)
      `);

    return res.status(201).json({ message: "Route created successfully.", route_id: result.recordset[0].route_id });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const addTrainToRoute = async (req, res) => {
  const { route_id } = req.params;
  const { train_id } = req.body;

  if (!isValidId(route_id) || !isValidId(train_id)) {
    return sendError(res, 400, "Valid route and train ids are required.");
  }

  try {
    const pool = await getPool();
    const oldRoute = await pool.request()
      .input("route_id", sql.Int, route_id)
      .query("SELECT * FROM train_routes WHERE route_id = @route_id");

    if (oldRoute.recordset.length === 0) {
      return sendError(res, 404, "Route not found.");
    }

    const route = oldRoute.recordset[0];
    const result = await pool.request()
      .input("train_id", sql.Int, train_id)
      .input("source_station_id", sql.Int, route.source_station_id)
      .input("destination_station_id", sql.Int, route.destination_station_id)
      .query(`
        INSERT INTO train_routes (train_id, source_station_id, destination_station_id, status)
        OUTPUT INSERTED.route_id
        VALUES (@train_id, @source_station_id, @destination_station_id, 'active')
      `);

    return res.status(201).json({
      message: "Train added to existing route successfully.",
      route_id: result.recordset[0].route_id,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const updateRoute = async (req, res) => {
  const { id } = req.params;
  const { train_id, source_station_id, destination_station_id, status } = req.body;

  if (!isValidId(id) || !isValidId(train_id) || !isValidId(source_station_id) || !isValidId(destination_station_id)) {
    return sendError(res, 400, "Valid route, train, and station ids are required.");
  }

  if (Number(source_station_id) === Number(destination_station_id)) {
    return sendError(res, 400, "Source and destination cannot be same.");
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("id", sql.Int, id)
      .input("train_id", sql.Int, train_id)
      .input("source_station_id", sql.Int, source_station_id)
      .input("destination_station_id", sql.Int, destination_station_id)
      .input("status", sql.VarChar, status || "active")
      .query(`
        UPDATE train_routes
        SET train_id = @train_id,
            source_station_id = @source_station_id,
            destination_station_id = @destination_station_id,
            status = @status
        WHERE route_id = @id
      `);

    if (result.rowsAffected[0] === 0) {
      return sendError(res, 404, "Route not found.");
    }

    return res.json({ message: "Route updated successfully." });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const deleteRoute = async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return sendError(res, 400, "Invalid route id.");
  }

  try {
    const pool = await getPool();
    const ticketCheck = await pool.request()
      .input("id", sql.Int, id)
      .query("SELECT TOP 1 ticket_id FROM tickets WHERE route_id = @id");

    if (ticketCheck.recordset.length > 0) {
      await pool.request()
        .input("id", sql.Int, id)
        .query("UPDATE train_routes SET status = 'inactive' WHERE route_id = @id");

      return res.json({ message: "Route has bookings, so it was marked inactive." });
    }

    await pool.request()
      .input("id", sql.Int, id)
      .query("DELETE FROM ticket_pricing WHERE route_id = @id");

    await pool.request()
      .input("id", sql.Int, id)
      .query("DELETE FROM train_routes WHERE route_id = @id");

    return res.json({ message: "Route deleted successfully." });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const addSchedule = async (req, res) => {
  const { train_id, station_id, arrival_time, departure_time } = req.body;

  if (!isValidId(train_id) || !isValidId(station_id)) {
    return sendError(res, 400, "Valid train and station ids are required.");
  }

  if (!arrival_time && !departure_time) {
    return sendError(res, 400, "Arrival or departure time is required.");
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("train_id", sql.Int, train_id)
      .input("station_id", sql.Int, station_id)
      .input("arrival_time", sql.DateTime, arrival_time || null)
      .input("departure_time", sql.DateTime, departure_time || null)
      .query(`
        INSERT INTO train_schedules (train_id, station_id, arrival_time, departure_time)
        OUTPUT INSERTED.schedule_id
        VALUES (@train_id, @station_id, @arrival_time, @departure_time)
      `);

    return res.status(201).json({ message: "Schedule added successfully.", schedule_id: result.recordset[0].schedule_id });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const updateSchedule = async (req, res) => {
  const { id } = req.params;
  const { train_id, station_id, arrival_time, departure_time } = req.body;

  if (!isValidId(id) || !isValidId(train_id) || !isValidId(station_id)) {
    return sendError(res, 400, "Valid ids are required.");
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("id", sql.Int, id)
      .input("train_id", sql.Int, train_id)
      .input("station_id", sql.Int, station_id)
      .input("arrival_time", sql.DateTime, arrival_time || null)
      .input("departure_time", sql.DateTime, departure_time || null)
      .query(`
        UPDATE train_schedules
        SET train_id = @train_id,
            station_id = @station_id,
            arrival_time = @arrival_time,
            departure_time = @departure_time
        WHERE schedule_id = @id
      `);

    if (result.rowsAffected[0] === 0) {
      return sendError(res, 404, "Schedule not found.");
    }

    return res.json({ message: "Schedule updated successfully." });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const deleteSchedule = async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return sendError(res, 400, "Invalid schedule id.");
  }

  try {
    const pool = await getPool();
    await pool.request()
      .input("id", sql.Int, id)
      .query("DELETE FROM train_schedules WHERE schedule_id = @id");

    return res.json({ message: "Schedule deleted successfully." });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const addOrUpdatePrice = async (req, res) => {
  const { route_id, class_name, fixed_price } = req.body;

  if (!isValidId(route_id) || !isValidClass(class_name) || Number(fixed_price) <= 0) {
    return sendError(res, 400, "Valid route, class, and price are required.");
  }

  try {
    const pool = await getPool();
    const oldPrice = await pool.request()
      .input("route_id", sql.Int, route_id)
      .input("class_name", sql.VarChar, class_name)
      .query("SELECT pricing_id FROM ticket_pricing WHERE route_id = @route_id AND class = @class_name");

    if (oldPrice.recordset.length > 0) {
      await pool.request()
        .input("route_id", sql.Int, route_id)
        .input("class_name", sql.VarChar, class_name)
        .input("fixed_price", sql.Decimal(10, 2), fixed_price)
        .query("UPDATE ticket_pricing SET fixed_price = @fixed_price WHERE route_id = @route_id AND class = @class_name");

      return res.json({ message: "Ticket price updated successfully." });
    }

    const result = await pool.request()
      .input("route_id", sql.Int, route_id)
      .input("class_name", sql.VarChar, class_name)
      .input("fixed_price", sql.Decimal(10, 2), fixed_price)
      .query(`
        INSERT INTO ticket_pricing (route_id, class, fixed_price)
        OUTPUT INSERTED.pricing_id
        VALUES (@route_id, @class_name, @fixed_price)
      `);

    return res.status(201).json({ message: "Ticket price added successfully.", pricing_id: result.recordset[0].pricing_id });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const getAllBookings = async (req, res) => {
  const { passenger_id, train_id, route_id, status, travel_date } = req.query;
  const { page, limit, offset } = getPagination(req.query);

  try {
    const pool = await getPool();
    const request = pool.request()
      .input("passenger_id", sql.Int, passenger_id || 0)
      .input("train_id", sql.Int, train_id || 0)
      .input("route_id", sql.Int, route_id || 0)
      .input("status", sql.VarChar, status || "")
      .input("travel_date", sql.VarChar, travel_date || "")
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, limit);

    const result = await request.query(`
      SELECT
        t.ticket_id, t.passenger_id, p.name AS passenger_name,
        t.train_id, tr.train_name, t.route_id, t.class, t.status,
        t.travel_date, t.seat_number, pay.payment_status, pay.amount
      FROM tickets t
      JOIN passengers p ON t.passenger_id = p.passenger_id
      JOIN trains tr ON t.train_id = tr.train_id
      LEFT JOIN payments pay ON t.ticket_id = pay.ticket_id
      WHERE (@passenger_id = 0 OR t.passenger_id = @passenger_id)
      AND (@train_id = 0 OR t.train_id = @train_id)
      AND (@route_id = 0 OR t.route_id = @route_id)
      AND (@status = '' OR t.status = @status)
      AND (@travel_date = '' OR CONVERT(VARCHAR, t.travel_date, 23) = @travel_date)
      ORDER BY t.ticket_id DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    const countResult = await pool.request()
      .input("passenger_id", sql.Int, passenger_id || 0)
      .input("train_id", sql.Int, train_id || 0)
      .input("route_id", sql.Int, route_id || 0)
      .input("status", sql.VarChar, status || "")
      .input("travel_date", sql.VarChar, travel_date || "")
      .query(`
        SELECT COUNT(*) AS total
        FROM tickets t
        WHERE (@passenger_id = 0 OR t.passenger_id = @passenger_id)
        AND (@train_id = 0 OR t.train_id = @train_id)
        AND (@route_id = 0 OR t.route_id = @route_id)
        AND (@status = '' OR t.status = @status)
        AND (@travel_date = '' OR CONVERT(VARCHAR, t.travel_date, 23) = @travel_date)
      `);

    return res.json(getPaginationResult(page, limit, countResult.recordset[0].total, result.recordset));
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const getAllPayments = async (req, res) => {
  const { payment_status } = req.query;
  const { page, limit, offset } = getPagination(req.query);

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("payment_status", sql.VarChar, payment_status || "")
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, limit)
      .query(`
        SELECT p.*, t.passenger_id, t.train_id, t.route_id, t.travel_date, t.seat_number
        FROM payments p
        JOIN tickets t ON p.ticket_id = t.ticket_id
        WHERE (@payment_status = '' OR p.payment_status = @payment_status)
        ORDER BY p.payment_id DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `);

    const countResult = await pool.request()
      .input("payment_status", sql.VarChar, payment_status || "")
      .query("SELECT COUNT(*) AS total FROM payments WHERE (@payment_status = '' OR payment_status = @payment_status)");

    return res.json(getPaginationResult(page, limit, countResult.recordset[0].total, result.recordset));
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const confirmPaymentByAdmin = async (req, res) => {
  const { ticket_id } = req.params;

  if (!isValidId(ticket_id)) {
    return sendError(res, 400, "Invalid ticket id.");
  }

  try {
    const pool = await getPool();
    await pool.request()
      .input("ticket_id", sql.Int, ticket_id)
      .query("UPDATE payments SET payment_status = 'completed' WHERE ticket_id = @ticket_id AND payment_status = 'pending'");

    return res.json({ message: "Payment confirmed successfully." });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const refundPaymentByAdmin = async (req, res) => {
  const { ticket_id } = req.params;
  const { refund_reason } = req.body;

  if (!isValidId(ticket_id)) {
    return sendError(res, 400, "Invalid ticket id.");
  }

  try {
    const pool = await getPool();
    await pool.request()
      .input("ticket_id", sql.Int, ticket_id)
      .input("refund_reason", sql.VarChar, refund_reason || "Refund by admin")
      .query(`
        UPDATE payments
        SET payment_status = 'refunded',
            refund_amount = amount,
            refund_reason = @refund_reason,
            refunded_at = GETDATE()
        WHERE ticket_id = @ticket_id AND payment_status = 'completed'
      `);

    return res.json({ message: "Payment refunded successfully." });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const cancelTicketByAdmin = async (req, res) => {
  const { ticket_id } = req.params;
  const { reason } = req.body;

  if (!isValidId(ticket_id)) {
    return sendError(res, 400, "Invalid ticket id.");
  }

  try {
    const pool = await getPool();
    const ticketCheck = await pool.request()
      .input("ticket_id", sql.Int, ticket_id)
      .query("SELECT status FROM tickets WHERE ticket_id = @ticket_id");

    if (ticketCheck.recordset.length === 0) {
      return sendError(res, 404, "Ticket not found.");
    }

    if (ticketCheck.recordset[0].status === "cancelled") {
      return res.json({ message: "Ticket is already cancelled." });
    }

    await pool.request()
      .input("ticket_id", sql.Int, ticket_id)
      .query("UPDATE tickets SET status = 'cancelled' WHERE ticket_id = @ticket_id");

    await pool.request()
      .input("ticket_id", sql.Int, ticket_id)
      .input("reason", sql.VarChar, reason || "Ticket cancelled by admin")
      .query(`
        UPDATE payments
        SET payment_status =
          CASE
            WHEN payment_status = 'completed' THEN 'refunded'
            ELSE 'cancelled'
          END,
          refund_amount =
          CASE
            WHEN payment_status = 'completed' THEN amount
            ELSE 0
          END,
          refund_reason = @reason,
          refunded_at = GETDATE()
        WHERE ticket_id = @ticket_id
      `);

    return res.json({ message: "Ticket cancelled by admin successfully." });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const getPassengers = async (req, res) => {
  const { search, status } = req.query;
  const { page, limit, offset } = getPagination(req.query);

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("search", sql.VarChar, `%${search || ""}%`)
      .input("status", sql.VarChar, status || "")
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, limit)
      .query(`
        SELECT passenger_id, name, email, contact_number, status
        FROM passengers
        WHERE (@search = '%%' OR name LIKE @search OR email LIKE @search)
        AND (@status = '' OR status = @status)
        ORDER BY passenger_id DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `);

    const countResult = await pool.request()
      .input("search", sql.VarChar, `%${search || ""}%`)
      .input("status", sql.VarChar, status || "")
      .query(`
        SELECT COUNT(*) AS total
        FROM passengers
        WHERE (@search = '%%' OR name LIKE @search OR email LIKE @search)
        AND (@status = '' OR status = @status)
      `);

    return res.json(getPaginationResult(page, limit, countResult.recordset[0].total, result.recordset));
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const getPassengerById = async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return sendError(res, 400, "Invalid passenger id.");
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("id", sql.Int, id)
      .query(`
        SELECT passenger_id, name, email, contact_number, status
        FROM passengers
        WHERE passenger_id = @id
      `);

    if (result.recordset.length === 0) {
      return sendError(res, 404, "Passenger not found.");
    }

    return res.json(result.recordset[0]);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const updatePassengerStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!isValidId(id) || !["active", "inactive"].includes(status)) {
    return sendError(res, 400, "Valid passenger id and status are required.");
  }

  try {
    const pool = await getPool();
    await pool.request()
      .input("id", sql.Int, id)
      .input("status", sql.VarChar, status)
      .query("UPDATE passengers SET status = @status WHERE passenger_id = @id");

    return res.json({ message: "Passenger status updated successfully." });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  adminLogin,
  getDashboardStats,
  addTrain,
  updateTrain,
  deleteTrain,
  addStation,
  updateStation,
  deleteStation,
  createRoute,
  addTrainToRoute,
  updateRoute,
  deleteRoute,
  addSchedule,
  updateSchedule,
  deleteSchedule,
  addOrUpdatePrice,
  getAllBookings,
  getAllPayments,
  confirmPaymentByAdmin,
  refundPaymentByAdmin,
  cancelTicketByAdmin,
  getPassengers,
  getPassengerById,
  updatePassengerStatus,
};
