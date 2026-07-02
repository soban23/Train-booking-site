const express = require("express");
const router = express.Router();

const {
  book_tickets,
  ticketid_info,
  get_passenger_tickets,
  cancel_Ticket,
} = require("../controllers/ticketController");

const { verifyToken } = require("../middleware/authMiddleware");

router.post("/", verifyToken, book_tickets);
router.get("/", verifyToken, get_passenger_tickets);
router.get("/:id", verifyToken, ticketid_info);
router.patch("/:ticket_id/cancel", verifyToken, cancel_Ticket);

module.exports = router;
