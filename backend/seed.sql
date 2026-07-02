INSERT INTO stations (station_name, city)
VALUES
('Lahore Junction', 'Lahore'),
('Karachi Cantt', 'Karachi'),
('Rawalpindi Station', 'Rawalpindi'),
('Multan Cantt', 'Multan');

INSERT INTO admins (name, email, password, status)
VALUES
('Main Admin', 'admin@train.com', '$2b$10$tT7ZeRPJ2WFEnShrISIhv.ceNxETdpHuU.LeOHdras.ujDSz7Qgw6', 'active');

INSERT INTO trains (train_name, fc_capacity, economy_capacity, status)
VALUES
('Green Line Express', 20, 100, 'active'),
('Business Express', 15, 80, 'active'),
('Tezgam Express', 10, 90, 'active');

INSERT INTO train_routes (train_id, source_station_id, destination_station_id, status)
VALUES
(1, 1, 2, 'active'),
(2, 1, 3, 'active'),
(3, 4, 2, 'active');

INSERT INTO train_schedules (train_id, station_id, arrival_time, departure_time)
VALUES
(1, 1, NULL, '2026-01-01 08:00:00'),
(1, 2, '2026-01-01 20:00:00', NULL),
(2, 1, NULL, '2026-01-01 09:30:00'),
(2, 3, '2026-01-01 15:30:00', NULL),
(3, 4, NULL, '2026-01-01 07:00:00'),
(3, 2, '2026-01-01 18:00:00', NULL);

INSERT INTO ticket_pricing (route_id, class, fixed_price)
VALUES
(1, 'economy', 2500),
(1, 'first', 5000),
(2, 'economy', 1800),
(2, 'first', 3500),
(3, 'economy', 2200),
(3, 'first', 4300);
