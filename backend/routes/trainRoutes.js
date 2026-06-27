const express = require("express");
const router = express.Router();

const {
  get_trains,
  get_trains_by_id,
  get_train_availability,
} = require("../controllers/trainController");

router.get("/", get_trains);
router.get("/:id/availability", get_train_availability);
router.get("/:id", get_trains_by_id);

module.exports = router;
