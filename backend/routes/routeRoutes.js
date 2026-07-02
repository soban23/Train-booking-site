const express = require("express");
const router = express.Router();

const {
  get_routes_namely,
  get_routes_details,
  get_schedules_by_trainid,
} = require("../controllers/routeController");

router.get("/", get_routes_namely);
router.get("/schedules/:id", get_schedules_by_trainid);
router.get("/:id", get_routes_details);

module.exports = router;
