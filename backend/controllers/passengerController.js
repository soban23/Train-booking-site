const bcrypt = require("bcrypt");
const { sql, getPool } = require("../config/connectdb");

const sendError = (res, status, message) => {
  return res.status(status).json({ error: message });
};

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isValidPassword = (password) => {
  return typeof password === "string" && password.length >= 6;
};

const isValidContactNumber = (contactNumber) => {
  return /^[0-9+\-\s]{7,15}$/.test(contactNumber);
};

// not using after adding register, kept for simple testing
const create_passenger = async (req, res) => {
  const { name, email, contact_number } = req.body;
  const status = "active";

  if (!name || !contact_number || !email) {
    return sendError(res, 400, "All fields are required.");
  }

  if (!isValidEmail(email)) {
    return sendError(res, 400, "Please enter a valid email.");
  }

  if (!isValidContactNumber(contact_number)) {
    return sendError(res, 400, "Please enter a valid contact number.");
  }

  try {
    const pool = await getPool();
    await pool.request()
      .input("name", sql.VarChar, name)
      .input("email", sql.VarChar, email)
      .input("contact_number", sql.VarChar, contact_number)
      .input("status", sql.VarChar, status)
      .query(`
        INSERT INTO passengers (name, email, contact_number, status)
        VALUES (@name, @email, @contact_number, @status)
      `);

    return res.status(201).json({ message: "Passenger created successfully." });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const get_passengers = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT passenger_id, name, email, contact_number
      FROM passengers
    `);

    return res.json(result.recordset);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const get_passengers_by_id = async (req, res) => {
  const id = req.passenger_id;

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("id", sql.Int, id)
      .query(`
        SELECT passenger_id, name, email, contact_number
        FROM passengers
        WHERE passenger_id = @id
      `);

    return res.json(result.recordset);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const update_passengers = async (req, res) => {
  const id = req.passenger_id;
  const { name, email, contact_number } = req.body;

  if (!name || !contact_number || !email) {
    return sendError(res, 400, "All fields are required.");
  }

  if (!isValidEmail(email)) {
    return sendError(res, 400, "Please enter a valid email.");
  }

  if (!isValidContactNumber(contact_number)) {
    return sendError(res, 400, "Please enter a valid contact number.");
  }

  try {
    const pool = await getPool();
    const checkEmail = await pool.request()
      .input("email", sql.VarChar, email)
      .input("id", sql.Int, id)
      .query(`
        SELECT passenger_id
        FROM passengers
        WHERE email = @email AND passenger_id <> @id
      `);

    if (checkEmail.recordset.length > 0) {
      return sendError(res, 409, "Email already exists.");
    }

    const result = await pool.request()
      .input("id", sql.Int, id)
      .input("name", sql.VarChar, name)
      .input("email", sql.VarChar, email)
      .input("contact_number", sql.VarChar, contact_number)
      .query(`
        UPDATE passengers
        SET name = @name, email = @email, contact_number = @contact_number
        WHERE passenger_id = @id
      `);

    if (result.rowsAffected[0] === 0) {
      return sendError(res, 404, "Passenger not found.");
    }

    return res.status(200).json({ message: "Passenger updated successfully." });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const delete_passenger = async (req, res) => {
  const id = req.passenger_id;

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("id", sql.Int, id)
      .query("DELETE FROM passengers WHERE passenger_id = @id");

    if (result.rowsAffected[0] === 0) {
      return sendError(res, 404, "Passenger not found.");
    }

    return res.status(200).json({ message: "Passenger deleted successfully." });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const change_password = async (req, res) => {
  const id = req.passenger_id;
  const { old_password, new_password } = req.body;

  if (!old_password || !new_password) {
    return sendError(res, 400, "Old password and new password are required.");
  }

  if (!isValidPassword(new_password)) {
    return sendError(res, 400, "New password must be at least 6 characters.");
  }

  try {
    const pool = await getPool();
    const passengerResult = await pool.request()
      .input("id", sql.Int, id)
      .query("SELECT password FROM passengers WHERE passenger_id = @id");

    if (passengerResult.recordset.length === 0) {
      return sendError(res, 404, "Passenger not found.");
    }

    const passenger = passengerResult.recordset[0];
    const isPasswordValid = await bcrypt.compare(old_password, passenger.password);

    if (!isPasswordValid) {
      return sendError(res, 400, "Old password is incorrect.");
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    await pool.request()
      .input("id", sql.Int, id)
      .input("password", sql.VarChar, hashedPassword)
      .query("UPDATE passengers SET password = @password WHERE passenger_id = @id");

    return res.status(200).json({ message: "Password changed successfully." });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  create_passenger,
  get_passengers,
  get_passengers_by_id,
  update_passengers,
  delete_passenger,
  change_password,
};
