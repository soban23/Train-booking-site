CREATE TABLE passengers (
  passenger_id INT IDENTITY(1,1) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NULL,
  contact_number VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE admins (
  admin_id INT IDENTITY(1,1) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE trains (
  train_id INT IDENTITY(1,1) PRIMARY KEY,
  train_name VARCHAR(100) NOT NULL,
  fc_capacity INT NOT NULL,
  economy_capacity INT NOT NULL,
  status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE stations (
  station_id INT IDENTITY(1,1) PRIMARY KEY,
  station_name VARCHAR(100) NOT NULL,
  city VARCHAR(100) NULL
);

CREATE TABLE train_routes (
  route_id INT IDENTITY(1,1) PRIMARY KEY,
  train_id INT NOT NULL,
  source_station_id INT NOT NULL,
  destination_station_id INT NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  FOREIGN KEY (train_id) REFERENCES trains(train_id),
  FOREIGN KEY (source_station_id) REFERENCES stations(station_id),
  FOREIGN KEY (destination_station_id) REFERENCES stations(station_id)
);

CREATE TABLE train_schedules (
  schedule_id INT IDENTITY(1,1) PRIMARY KEY,
  train_id INT NOT NULL,
  station_id INT NOT NULL,
  arrival_time DATETIME NULL,
  departure_time DATETIME NULL,
  FOREIGN KEY (train_id) REFERENCES trains(train_id),
  FOREIGN KEY (station_id) REFERENCES stations(station_id)
);

CREATE TABLE ticket_pricing (
  pricing_id INT IDENTITY(1,1) PRIMARY KEY,
  route_id INT NOT NULL,
  class VARCHAR(20) NOT NULL,
  fixed_price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (route_id) REFERENCES train_routes(route_id)
);

CREATE TABLE tickets (
  ticket_id INT IDENTITY(1,1) PRIMARY KEY,
  passenger_id INT NOT NULL,
  train_id INT NOT NULL,
  route_id INT NOT NULL,
  class VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'booked',
  travel_date DATE NOT NULL,
  seat_number VARCHAR(20) NOT NULL,
  created_at DATETIME DEFAULT GETDATE(),
  FOREIGN KEY (passenger_id) REFERENCES passengers(passenger_id),
  FOREIGN KEY (train_id) REFERENCES trains(train_id),
  FOREIGN KEY (route_id) REFERENCES train_routes(route_id)
);

CREATE TABLE payments (
  payment_id INT IDENTITY(1,1) PRIMARY KEY,
  ticket_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  payment_status VARCHAR(20) DEFAULT 'pending',
  refund_amount DECIMAL(10,2) DEFAULT 0,
  refund_reason VARCHAR(255) NULL,
  refunded_at DATETIME NULL,
  created_at DATETIME DEFAULT GETDATE(),
  FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id)
);
