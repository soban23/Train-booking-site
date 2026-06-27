const express = require("express");
const router = express.Router();

const {
  get_stations,
  get_stations_by_id,
} = require("../controllers/stationController");

router.get("/", get_stations);
router.get("/:id", get_stations_by_id);

module.exports = router;
