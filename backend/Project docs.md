# Train Booking Backend Project Docs

This backend is made with Node.js, Express, SQL Server, JWT, and bcrypt.

## Environment Variables

Create a `.env` file in the backend folder.

```env
SERVER_NAME=
DB_NAME=
SQL_PORT=
SECRET_KEY=
PORT=4000
```

## Database Files

Two SQL files are included:

```txt
database.sql
seed.sql
```

Run `database.sql` first to create the tables, then run `seed.sql` to add sample stations, trains, routes, schedules, and ticket prices.

## API Groups

```txt
/api/auth
/api/passengers
/api/trains
/api/stations
/api/routes
/api/tickets
/api/payments
```

## Auth APIs

### Register

```txt
POST /api/auth/register
```

Body:

```json
{
  "name": "Ali",
  "email": "ali@gmail.com",
  "password": "123456",
  "contact_number": "03001234567"
}
```

Rules:
- email must be valid
- password must be at least 6 characters
- contact number must be valid
- email must be unique

### Login

```txt
POST /api/auth/login
```

Body:

```json
{
  "email": "ali@gmail.com",
  "password": "123456"
}
```

Returns a JWT token.

## Passenger APIs

These APIs need this header:

```txt
Authorization: Bearer YOUR_TOKEN
```

### Get My Profile

```txt
GET /api/passengers
```

### Update My Profile

```txt
PUT /api/passengers
```

Body:

```json
{
  "name": "Ali Khan",
  "email": "ali@gmail.com",
  "contact_number": "03001234567"
}
```

### Change Password

```txt
PATCH /api/passengers/password
```

Body:

```json
{
  "old_password": "123456",
  "new_password": "newpass123"
}
```

### Delete My Account

```txt
DELETE /api/passengers
```

## Train APIs

### Get Trains

```txt
GET /api/trains
```

Search and pagination:

```txt
GET /api/trains?search=green&page=1&limit=10
```

Paginated list response:

```json
{
  "page": 1,
  "limit": 10,
  "total": 3,
  "totalPages": 1,
  "data": []
}
```

### Get Train By Id

```txt
GET /api/trains/:id
```

### Check Train Availability

```txt
GET /api/trains/:id/availability?route_id=1&travel_date=2026-07-01
```

This checks seats before booking.

Example response:

```json
{
  "train_id": 1,
  "train_name": "Green Line Express",
  "route_id": 1,
  "travel_date": "2026-07-01",
  "first": {
    "total": 20,
    "booked": 2,
    "available": 18
  },
  "economy": {
    "total": 100,
    "booked": 10,
    "available": 90
  }
}
```

## Station APIs

### Get Stations

```txt
GET /api/stations
```

Search and pagination:

```txt
GET /api/stations?search=lahore&page=1&limit=10
```

### Get Station By Id

```txt
GET /api/stations/:id
```

## Route APIs

### Get Routes

```txt
GET /api/routes
```

Search and pagination:

```txt
GET /api/routes?source=lahore&destination=karachi&page=1&limit=10
```

### Get Route Details

```txt
GET /api/routes/:id
```

### Get Train Schedule

```txt
GET /api/routes/schedules/:id
```

Here `id` is the train id.

## Ticket APIs

These APIs need JWT token.

### Book Ticket

```txt
POST /api/tickets
```

Body:

```json
{
  "train_id": 1,
  "route_id": 1,
  "class_name": "economy",
  "payment_method": "cash",
  "travel_date": "2026-07-01"
}
```

Rules:
- `class_name` can be `economy` or `first`
- `payment_method` can be `cash` or `card`
- `travel_date` is required
- train must belong to the selected route
- seat capacity must be available for the selected travel date
- backend assigns a simple seat number like `E-1` or `F-1`
- booking uses a transaction

Response:

```json
{
  "message": "Ticket booked successfully.",
  "ticket_id": 1,
  "seat_number": "E-1",
  "travel_date": "2026-07-01"
}
```

### Get My Tickets

```txt
GET /api/tickets
```

Filter and pagination:

```txt
GET /api/tickets?status=booked&payment_status=pending&page=1&limit=10
```

### Get One Ticket

```txt
GET /api/tickets/:id
```

### Cancel Ticket

```txt
PATCH /api/tickets/:ticket_id/cancel
```

Rules:
- passenger can only cancel their own ticket
- already cancelled ticket is not cancelled again
- ticket cannot be cancelled after the train departure time for that travel date
- train total capacity is not changed because availability is calculated by travel date
- payment is kept for history instead of being deleted
- if payment was completed, payment status becomes `refunded`
- refund amount, refund reason, and refund time are saved

## Payment APIs

These APIs need JWT token.

### Confirm Payment

```txt
PATCH /api/payments/tickets/:ticket_id/confirm
```

Rules:
- passenger can only confirm their own ticket payment
- cancelled ticket payment cannot be confirmed
- pending payment becomes completed

### Get Paid Tickets

```txt
GET /api/payments/paid?page=1&limit=10
```

### Get Cancelled Tickets

```txt
GET /api/payments/cancelled?page=1&limit=10
```

### Get Payment Details

```txt
GET /api/payments/:payment_id
```

## Status Values

Ticket statuses:

```txt
booked
cancelled
```

Payment statuses:

```txt
pending
completed
cancelled
refunded
```

Refund fields stored in payments:

```txt
refund_amount
refund_reason
refunded_at
```

## Notes

- Passenger password is never returned in profile APIs.
- SQL queries use input parameters instead of directly putting user input into query strings.
- Ticket booking and cancellation use transactions so the database does not get half-updated.
- Cancelled/refunded payment records are kept so booking history stays available.
- List APIs use the same paginated response format: `page`, `limit`, `total`, `totalPages`, and `data`.
