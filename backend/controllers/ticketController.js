const { sql, getPool } = require("../config/connectdb");

const sendError = (res, status, message) => {
  return res.status(status).json({ error: message });
};

const isValidId = (id) => {
  return Number.isInteger(Number(id)) && Number(id) > 0;
};

const getCapacityColumn = (className) => {
  if (className === "first") {
    return "fc_capacity";
  }

  if (className === "economy") {
    return "economy_capacity";
  }

  return null;
};

const isValidPaymentMethod = (paymentMethod) => {
  return ["cash", "card"].includes(paymentMethod);
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

const isValidTravelDate = (travelDate) => {
  if (!travelDate) {
    return false;
  }

  const date = new Date(travelDate);
  return !Number.isNaN(date.getTime());
};

const isPastTravelDate = (travelDate) => {
  const date = new Date(travelDate);
  const today = new Date();

  date.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return date < today;
};

const isJourneyDeparturePassed = (travelDate, departureTime) => {
  if (!travelDate || !departureTime) {
    return false;
  }

  const date = new Date(travelDate);
  const time = new Date(departureTime);

  if (Number.isNaN(date.getTime()) || Number.isNaN(time.getTime())) {
    return false;
  }

  const journeyDateTime = new Date(date);
  journeyDateTime.setHours(time.getHours(), time.getMinutes(), 0, 0);

  return journeyDateTime <= new Date();
};

const TICKET_STATUS = {
  BOOKED: "booked",
  CANCELLED: "cancelled",
};

const PAYMENT_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
};

const book_tickets = async (req, res) => {
  const { train_id, class_name, payment_method, route_id, travel_date } = req.body;
  const passenger_id = req.passenger_id;
  const capacityColumn = getCapacityColumn(class_name);

  if (!passenger_id || !train_id || !class_name || !payment_method || !route_id || !travel_date) {
    return sendError(res, 400, "All fields are required.");
  }

  if (!isValidId(train_id) || !isValidId(route_id)) {
    return sendError(res, 400, "Invalid train or route id.");
  }

  if (!capacityColumn) {
    return sendError(res, 400, "Invalid class type.");
  }

  if (!isValidPaymentMethod(payment_method)) {
    return sendError(res, 400, "Invalid payment method.");
  }

  if (!isValidTravelDate(travel_date)) {
    return sendError(res, 400, "Please enter a valid travel date.");
  }

  if (isPastTravelDate(travel_date)) {
    return sendError(res, 400, "Travel date cannot be in the past.");
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  let transactionStarted = false;

  try {
    await transaction.begin();
    transactionStarted = true;

    const routeCheck = await new sql.Request(transaction)
      .input("route_id", sql.Int, route_id)
      .input("train_id", sql.Int, train_id)
      .query(`
        SELECT route_id
        FROM train_routes
        WHERE route_id = @route_id AND train_id = @train_id
      `);

    if (routeCheck.recordset.length === 0) {
      await transaction.rollback();
      return sendError(res, 400, "This train is not assigned to this route.");
    }

    const priceResult = await new sql.Request(transaction)
      .input("route_id", sql.Int, route_id)
      .input("class_name", sql.VarChar, class_name)
      .query(`
        SELECT fixed_price
        FROM ticket_pricing
        WHERE route_id = @route_id AND class = @class_name
      `);

    if (priceResult.recordset.length === 0) {
      await transaction.rollback();
      return sendError(res, 404, "Ticket price not found.");
    }

    const capacityResult = await new sql.Request(transaction)
      .input("train_id", sql.Int, train_id)
      .input("route_id", sql.Int, route_id)
      .input("class_name", sql.VarChar, class_name)
      .input("travel_date", sql.Date, travel_date)
      .input("cancelled_status", sql.VarChar, TICKET_STATUS.CANCELLED)
      .query(`
        SELECT
          t.${capacityColumn} AS total_capacity,
          COUNT(tk.ticket_id) AS booked_seats
        FROM trains t
        LEFT JOIN tickets tk
          ON t.train_id = tk.train_id
          AND tk.route_id = @route_id
          AND tk.class = @class_name
          AND tk.travel_date = @travel_date
          AND tk.status <> @cancelled_status
        WHERE t.train_id = @train_id
        GROUP BY t.${capacityColumn}
      `);

    if (
      capacityResult.recordset.length === 0 ||
      capacityResult.recordset[0].booked_seats >= capacityResult.recordset[0].total_capacity
    ) {
      await transaction.rollback();
      return sendError(res, 400, "No seats available.");
    }

    const seatResult = await new sql.Request(transaction)
      .input("train_id", sql.Int, train_id)
      .input("route_id", sql.Int, route_id)
      .input("class_name", sql.VarChar, class_name)
      .input("travel_date", sql.Date, travel_date)
      .query(`
        SELECT ISNULL(MAX(CAST(SUBSTRING(seat_number, 3, LEN(seat_number)) AS INT)), 0) AS lastSeat
        FROM tickets
        WHERE train_id = @train_id
        AND route_id = @route_id
        AND class = @class_name
        AND travel_date = @travel_date
      `);

    const seatPrefix = class_name === "first" ? "F" : "E";
    const seat_number = `${seatPrefix}-${seatResult.recordset[0].lastSeat + 1}`;

    const ticketResult = await new sql.Request(transaction)
      .input("passenger_id", sql.Int, passenger_id)
      .input("train_id", sql.Int, train_id)
      .input("route_id", sql.Int, route_id)
      .input("class_name", sql.VarChar, class_name)
      .input("travel_date", sql.Date, travel_date)
      .input("seat_number", sql.VarChar, seat_number)
      .input("status", sql.VarChar, TICKET_STATUS.BOOKED)
      .query(`
        INSERT INTO tickets (passenger_id, train_id, status, route_id, class, travel_date, seat_number)
        OUTPUT INSERTED.ticket_id
        VALUES (@passenger_id, @train_id, @status, @route_id, @class_name, @travel_date, @seat_number)
      `);

    const ticket_id = ticketResult.recordset[0].ticket_id;
    const ticketPrice = priceResult.recordset[0].fixed_price;

    await new sql.Request(transaction)
      .input("ticket_id", sql.Int, ticket_id)
      .input("ticketPrice", sql.Decimal(10, 2), ticketPrice)
      .input("payment_method", sql.VarChar, payment_method)
      .input("payment_status", sql.VarChar, PAYMENT_STATUS.PENDING)
      .query(`
        INSERT INTO payments (ticket_id, amount, payment_method, payment_status)
        VALUES (@ticket_id, @ticketPrice, @payment_method, @payment_status)
      `);

    await transaction.commit();
    return res.status(201).json({
      message: "Ticket booked successfully.",
      ticket_id,
      seat_number,
      travel_date,
    });
  } catch (error) {
    if (transactionStarted) {
      await transaction.rollback();
    }
    return sendError(res, 500, error.message);
  }
};

const ticketid_info = async (req, res) => {
  const { id } = req.params;
  const passenger_id = req.passenger_id;

  if (!isValidId(id)) {
    return sendError(res, 400, "Invalid ticket id.");
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("id", sql.Int, id)
      .input("passenger_id", sql.Int, passenger_id)
      .query(`
        SELECT
          t.ticket_id,
          t.class,
          t.status,
          t.travel_date,
          t.seat_number,
          p.name AS passenger_name,
          tr.train_name,
          t.route_id,
          s1.station_name AS source_station,
          s2.station_name AS destination_station,
          pay.amount,
          pay.payment_status
        FROM tickets t
        JOIN passengers p ON t.passenger_id = p.passenger_id
        JOIN trains tr ON t.train_id = tr.train_id
        JOIN train_routes r ON t.route_id = r.route_id
        JOIN stations s1 ON r.source_station_id = s1.station_id
        JOIN stations s2 ON r.destination_station_id = s2.station_id
        LEFT JOIN payments pay ON t.ticket_id = pay.ticket_id
        WHERE t.ticket_id = @id AND t.passenger_id = @passenger_id
      `);

    return res.json(result.recordset);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const get_passenger_tickets = async (req, res) => {
  const passenger_id = req.passenger_id;
  const { status, payment_status } = req.query;
  const { page, limit, offset } = getPagination(req.query);

  try {
    const pool = await getPool();
    const countResult = await pool.request()
      .input("passenger_id", sql.Int, passenger_id)
      .input("status", sql.VarChar, status || "")
      .input("payment_status", sql.VarChar, payment_status || "")
      .query(`
        SELECT COUNT(*) AS total
        FROM tickets t
        LEFT JOIN payments pay ON t.ticket_id = pay.ticket_id
        WHERE t.passenger_id = @passenger_id
        AND (@status = '' OR t.status = @status)
        AND (@payment_status = '' OR pay.payment_status = @payment_status)
      `);

    const result = await pool.request()
      .input("passenger_id", sql.Int, passenger_id)
      .input("status", sql.VarChar, status || "")
      .input("payment_status", sql.VarChar, payment_status || "")
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
        WHERE t.passenger_id = @passenger_id
        AND (@status = '' OR t.status = @status)
        AND (@payment_status = '' OR pay.payment_status = @payment_status)
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

const cancel_Ticket = async (req, res) => {
  const { ticket_id } = req.params;
  const passenger_id = req.passenger_id;

  if (!isValidId(ticket_id)) {
    return sendError(res, 400, "Invalid ticket id.");
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  let transactionStarted = false;

  try {
    await transaction.begin();
    transactionStarted = true;

    const ticketResult = await new sql.Request(transaction)
      .input("ticket_id", sql.Int, ticket_id)
      .input("passenger_id", sql.Int, passenger_id)
      .query(`
        SELECT
          t.train_id,
          t.class,
          t.status,
          t.travel_date,
          ts.departure_time
        FROM tickets t
        JOIN train_routes r ON t.route_id = r.route_id
        LEFT JOIN train_schedules ts
          ON t.train_id = ts.train_id
          AND ts.station_id = r.source_station_id
        WHERE t.ticket_id = @ticket_id AND t.passenger_id = @passenger_id
      `);

    if (ticketResult.recordset.length === 0) {
      await transaction.rollback();
      return sendError(res, 404, "Ticket not found.");
    }

    const ticket = ticketResult.recordset[0];
    const capacityColumn = getCapacityColumn(ticket.class);

    if (ticket.status === TICKET_STATUS.CANCELLED) {
      await transaction.rollback();
      return res.status(200).json({ message: "Ticket already cancelled." });
    }

    if (isJourneyDeparturePassed(ticket.travel_date, ticket.departure_time)) {
      await transaction.rollback();
      return sendError(res, 400, "Ticket cannot be cancelled after departure time.");
    }

    if (!capacityColumn) {
      await transaction.rollback();
      return sendError(res, 400, "Invalid class type.");
    }

    await new sql.Request(transaction)
      .input("ticket_id", sql.Int, ticket_id)
      .input("payment_status_cancelled", sql.VarChar, PAYMENT_STATUS.CANCELLED)
      .input("payment_status_refunded", sql.VarChar, PAYMENT_STATUS.REFUNDED)
      .input("payment_status_completed", sql.VarChar, PAYMENT_STATUS.COMPLETED)
      .query(`
        UPDATE payments
        SET payment_status =
          CASE
            WHEN payment_status = @payment_status_completed THEN @payment_status_refunded
            ELSE @payment_status_cancelled
          END,
          refund_amount =
          CASE
            WHEN payment_status = @payment_status_completed THEN amount
            ELSE 0
          END,
          refund_reason = 'Passenger cancelled ticket',
          refunded_at = GETDATE()
        WHERE ticket_id = @ticket_id
      `);

    await new sql.Request(transaction)
      .input("ticket_id", sql.Int, ticket_id)
      .input("ticket_status", sql.VarChar, TICKET_STATUS.CANCELLED)
      .query(`
        UPDATE tickets
        SET status = @ticket_status
        WHERE ticket_id = @ticket_id
      `);

    await transaction.commit();
    return res.status(200).json({ message: "Ticket cancelled successfully." });
  } catch (error) {
    if (transactionStarted) {
      await transaction.rollback();
    }
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  book_tickets,
  ticketid_info,
  get_passenger_tickets,
  cancel_Ticket,
};
