const express = require("express");
const router = express.Router();
const { verifyAdmin } = require("../middleware/adminMiddleware");

const {
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
} = require("../controllers/adminController");

router.post("/login", adminLogin);

router.get("/dashboard", verifyAdmin, getDashboardStats);

router.post("/trains", verifyAdmin, addTrain);
router.put("/trains/:id", verifyAdmin, updateTrain);
router.delete("/trains/:id", verifyAdmin, deleteTrain);

router.post("/stations", verifyAdmin, addStation);
router.put("/stations/:id", verifyAdmin, updateStation);
router.delete("/stations/:id", verifyAdmin, deleteStation);

router.post("/routes", verifyAdmin, createRoute);
router.post("/routes/:route_id/trains", verifyAdmin, addTrainToRoute);
router.put("/routes/:id", verifyAdmin, updateRoute);
router.delete("/routes/:id", verifyAdmin, deleteRoute);

router.post("/schedules", verifyAdmin, addSchedule);
router.put("/schedules/:id", verifyAdmin, updateSchedule);
router.delete("/schedules/:id", verifyAdmin, deleteSchedule);

router.post("/prices", verifyAdmin, addOrUpdatePrice);
router.put("/prices", verifyAdmin, addOrUpdatePrice);

router.get("/bookings", verifyAdmin, getAllBookings);
router.patch("/bookings/:ticket_id/cancel", verifyAdmin, cancelTicketByAdmin);
router.get("/payments", verifyAdmin, getAllPayments);
router.patch("/payments/:ticket_id/confirm", verifyAdmin, confirmPaymentByAdmin);
router.patch("/payments/:ticket_id/refund", verifyAdmin, refundPaymentByAdmin);

router.get("/passengers", verifyAdmin, getPassengers);
router.get("/passengers/:id", verifyAdmin, getPassengerById);
router.patch("/passengers/:id/status", verifyAdmin, updatePassengerStatus);

module.exports = router;
