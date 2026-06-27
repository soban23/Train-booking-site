const jwt = require("jsonwebtoken");
require("dotenv").config();

const secretKey = process.env.SECRET_KEY;

const sendError = (res, status, message) => {
  return res.status(status).json({ error: message });
};

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return sendError(res, 403, "No token provided.");
  }

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      return sendError(res, 401, "Invalid token.");
    }

    req.passenger_id = decoded.passenger_id;
    next();
  });
};

module.exports = { verifyToken };
