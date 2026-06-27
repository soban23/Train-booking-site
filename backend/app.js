const cors = require("cors");
const express = require("express");
const { getPool } = require("./config/connectdb");
const authRoutes = require("./routes/authRoutes");
const passengerRoutes = require("./routes/passengerRoutes");
const trainRoutes = require("./routes/trainRoutes");
const stationRoutes = require("./routes/stationRoutes");
const routeRoutes = require("./routes/routeRoutes");
const ticketRoutes = require("./routes/ticketRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();
const serverPort = process.env.PORT || 4000;

app.use(express.json());
app.use(cors());

app.use("/api/auth", authRoutes);
app.use("/api/passengers", passengerRoutes);
app.use("/api/trains", trainRoutes);
app.use("/api/stations", stationRoutes);
app.use("/api/routes", routeRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/payments", paymentRoutes);

app.get("/", (req, res) => {
  return res.json({ message: "Backend is running" });
});

app.listen(serverPort, async () => {
  try {
    await getPool();
    console.log("Connected to database successfully!");
  } catch (error) {
    console.error("Database connection failed:", error.message);
  }

  console.log(`Server is running at: http://localhost:${serverPort}`);
});
