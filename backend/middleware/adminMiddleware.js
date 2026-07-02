const jwt = require("jsonwebtoken");
require("dotenv").config();

const sendError = (res, status, message) => {
  return res.status(status).json({ error: message });
};

const verifyAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return sendError(res, 403, "No token provided.");
  }

  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      return sendError(res, 401, "Invalid token.");
    }

    if (decoded.role !== "admin") {
      return sendError(res, 403, "Admin access only.");
    }

    req.admin_id = decoded.admin_id;
    next();
  });
};

module.exports = { verifyAdmin };
