const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { sql, getPool } = require("../config/connectdb");
require("dotenv").config();

const secretKey = process.env.SECRET_KEY;

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

// Login User Controller
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return sendError(res, 400, "Email and password are required.");
  }

  if (!isValidEmail(email)) {
    return sendError(res, 400, "Please enter a valid email.");
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("email", sql.VarChar, email)
      .query("SELECT * FROM passengers WHERE email = @email");

    if (result.recordset.length === 0) {
      return sendError(res, 400, "User not found.");
    }

    const user = result.recordset[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return sendError(res, 400, "Invalid password.");
    }

    const token = jwt.sign(
      { passenger_id: user.passenger_id },
      secretKey,
      { expiresIn: "1h" }
    );

    return res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// Register User Controller
const registerUser = async (req, res) => {
  const { name, email, password, contact_number } = req.body;

  if (!email || !password || !name || !contact_number) {
    return sendError(res, 400, "All fields are required.");
  }

  if (!isValidEmail(email)) {
    return sendError(res, 400, "Please enter a valid email.");
  }

  if (!isValidPassword(password)) {
    return sendError(res, 400, "Password must be at least 6 characters.");
  }

  if (!isValidContactNumber(contact_number)) {
    return sendError(res, 400, "Please enter a valid contact number.");
  }

  try {
    const pool = await getPool();
    const checkEmail = await pool.request()
      .input("email", sql.VarChar, email)
      .query("SELECT passenger_id FROM passengers WHERE email = @email");

    if (checkEmail.recordset.length > 0) {
      return sendError(res, 409, "User already exists.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.request()
      .input("name", sql.VarChar, name)
      .input("email", sql.VarChar, email)
      .input("password", sql.VarChar, hashedPassword)
      .input("contact_number", sql.VarChar, contact_number)
      .query(`
        INSERT INTO passengers (name, email, password, contact_number)
        VALUES (@name, @email, @password, @contact_number)
      `);

    return res.status(201).json({ message: "User registered successfully." });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = { loginUser, registerUser };
