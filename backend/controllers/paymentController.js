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

const PAYMENT_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
};

const TICKET_STATUS = {
  BOOKED: "booked",
  CANCELLED: "cancelled",
};

const confirm_Payment = async (req, res) => {
  const passenger_id = req.passenger_id;
  const { ticket_id } = req.params;

  if (!isValidId(ticket_id)) {
    return sendError(res, 400, "Invalid ticket id.");
  }

  try {
    const pool = await getPool();
    const paymentResult = await pool.request()
      .input("ticket_id", sql.Int, ticket_id)
      .input("passenger_id", sql.Int, passenger_id)
      .query(`
        SELECT p.payment_status, t.status AS ticket_status
        FROM payments p
        JOIN tickets t ON p.ticket_id = t.ticket_id
        WHERE p.ticket_id = @ticket_id AND t.passenger_id = @passenger_id
      `);

    if (paymentResult.recordset.length === 0) {
      return sendError(res, 404, "No payment record found for this ticket.");
    }

    const payment = paymentResult.recordset[0];

    if (payment.ticket_status === TICKET_STATUS.CANCELLED) {
      return sendError(res, 400, "Cannot confirm payment for a cancelled ticket.");
    }

    if (payment.payment_status !== PAYMENT_STATUS.PENDING) {
      return res.status(200).json({ message: "Ticket already paid or cancelled." });
    }

    await pool.request()
      .input("ticket_id", sql.Int, ticket_id)
      .input("passenger_id", sql.Int, passenger_id)
      .input("payment_status", sql.VarChar, PAYMENT_STATUS.COMPLETED)
      .query(`
        UPDATE p
        SET p.payment_status = @payment_status
        FROM payments p
        JOIN tickets t ON p.ticket_id = t.ticket_id
        WHERE p.ticket_id = @ticket_id AND t.passenger_id = @passenger_id
      `);

    return res.status(200).json({ message: "Payment confirmed successfully." });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const get_Payment_Details = async (req, res) => {
  const { payment_id } = req.params;
  const passenger_id = req.passenger_id;

  if (!isValidId(payment_id)) {
    return sendError(res, 400, "Invalid payment id.");
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("payment_id", sql.Int, payment_id)
      .input("passenger_id", sql.Int, passenger_id)
      .query(`
        SELECT
          p.payment_id,
          p.ticket_id,
          p.amount,
          p.payment_method,
          p.payment_status,
          p.refund_amount,
          p.refund_reason,
          p.refunded_at,
          t.passenger_id,
          t.train_id,
          t.travel_date,
          t.seat_number,
          tr.train_name,
          r.route_id,
          s1.station_name AS source_station,
          s2.station_name AS destination_station
        FROM payments p
        JOIN tickets t ON p.ticket_id = t.ticket_id
        JOIN trains tr ON t.train_id = tr.train_id
        JOIN train_routes r ON t.route_id = r.route_id
        JOIN stations s1 ON r.source_station_id = s1.station_id
        JOIN stations s2 ON r.destination_station_id = s2.station_id
        WHERE p.payment_id = @payment_id AND t.passenger_id = @passenger_id
      `);

    if (result.recordset.length === 0) {
      return sendError(res, 404, "Payment details not found.");
    }

    return res.json(result.recordset);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const get_passenger_paid_tickets = async (req, res) => {
  const passenger_id = req.passenger_id;
  const { page, limit, offset } = getPagination(req.query);

  try {
    const pool = await getPool();
    const countResult = await pool.request()
      .input("passenger_id", sql.Int, passenger_id)
      .input("payment_status", sql.VarChar, PAYMENT_STATUS.COMPLETED)
      .query(`
        SELECT COUNT(*) AS total
        FROM tickets t
        LEFT JOIN payments pay ON t.ticket_id = pay.ticket_id
        WHERE t.passenger_id = @passenger_id AND pay.payment_status = @payment_status
      `);

    const result = await pool.request()
      .input("passenger_id", sql.Int, passenger_id)
      .input("payment_status", sql.VarChar, PAYMENT_STATUS.COMPLETED)
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, limit)
      .query(`
        SELECT
          t.ticket_id,
          tr.train_name,
          t.route_id,
          t.class,
          t.status,
          t.travel_date,
          t.seat_number,
          s1.station_name AS source_station,
          s2.station_name AS destination_station,
          pay.payment_status,
          pay.amount
        FROM tickets t
        JOIN trains tr ON t.train_id = tr.train_id
        JOIN train_routes r ON t.route_id = r.route_id
        JOIN stations s1 ON r.source_station_id = s1.station_id
        JOIN stations s2 ON r.destination_station_id = s2.station_id
        LEFT JOIN payments pay ON t.ticket_id = pay.ticket_id
        WHERE t.passenger_id = @passenger_id AND pay.payment_status = @payment_status
        ORDER BY t.ticket_id DESC
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

const get_passenger_cancelled_tickets = async (req, res) => {
  const passenger_id = req.passenger_id;
  const { page, limit, offset } = getPagination(req.query);

  try {
    const pool = await getPool();
    const countResult = await pool.request()
      .input("passenger_id", sql.Int, passenger_id)
      .input("ticket_status", sql.VarChar, TICKET_STATUS.CANCELLED)
      .query(`
        SELECT COUNT(*) AS total
        FROM tickets t
        WHERE t.passenger_id = @passenger_id AND t.status = @ticket_status
      `);

    const result = await pool.request()
      .input("passenger_id", sql.Int, passenger_id)
      .input("ticket_status", sql.VarChar, TICKET_STATUS.CANCELLED)
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, limit)
      .query(`
        SELECT
          t.ticket_id,
          tr.train_name,
          t.route_id,
          t.class,
          t.status,
          t.travel_date,
          t.seat_number,
          s1.station_name AS source_station,
          s2.station_name AS destination_station,
          pay.payment_status,
          pay.amount,
          pay.refund_amount,
          pay.refund_reason,
          pay.refunded_at
        FROM tickets t
        JOIN trains tr ON t.train_id = tr.train_id
        JOIN train_routes r ON t.route_id = r.route_id
        JOIN stations s1 ON r.source_station_id = s1.station_id
        JOIN stations s2 ON r.destination_station_id = s2.station_id
        LEFT JOIN payments pay ON t.ticket_id = pay.ticket_id
        WHERE t.passenger_id = @passenger_id AND t.status = @ticket_status
        ORDER BY t.ticket_id DESC
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

module.exports = {
  confirm_Payment,
  get_Payment_Details,
  get_passenger_paid_tickets,
  get_passenger_cancelled_tickets,
};
