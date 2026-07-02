const express = require("express");
const router = express.Router();

const {
  confirm_Payment,
  get_Payment_Details,
  get_passenger_paid_tickets,
  get_passenger_cancelled_tickets,
} = require("../controllers/paymentController");

const { verifyToken } = require("../middleware/authMiddleware");

router.get("/paid", verifyToken, get_passenger_paid_tickets);
router.get("/cancelled", verifyToken, get_passenger_cancelled_tickets);
router.patch("/tickets/:ticket_id/confirm", verifyToken, confirm_Payment);
router.get("/:payment_id", verifyToken, get_Payment_Details);

module.exports = router;
