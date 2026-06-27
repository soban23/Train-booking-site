const express = require("express");
const router = express.Router();

const {
  get_passengers_by_id,
  update_passengers,
  delete_passenger,
  change_password,
} = require("../controllers/passengerController");

const { verifyToken } = require("../middleware/authMiddleware");

router.get("/", verifyToken, get_passengers_by_id);
router.put("/", verifyToken, update_passengers);
router.delete("/", verifyToken, delete_passenger);
router.patch("/password", verifyToken, change_password);

module.exports = router;
