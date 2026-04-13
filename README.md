# Auth System — Setup & Run Guide

## Prerequisites
- XAMPP (MySQL running on port 3306)
- Node.js 18+

---

## 1. Database Setup

1. Start XAMPP and ensure MySQL is running
2. Open phpMyAdmin → SQL tab
3. Paste and run the contents of `database/schema.sql`

This creates the `auth_system` database with a seeded admin account:
- Phone: `0000000000`
- Password: `admin123`

---

## 2. Backend Setup

```bash
cd backend
 .env.example .envcp
# Edit .env if your MySQL password is not empty
npm install
npm run dev
```

Server runs at: http://localhost:5000

---

## 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

App runs at: http://localhost:5173

---

## API Endpoints

| Method | Endpoint                        | Auth     | Description              |
|--------|---------------------------------|----------|--------------------------|
| POST   | /api/auth/signup                | None     | Register (customer)      |
| POST   | /api/auth/login                 | None     | Login                    |
| GET    | /api/auth/me                    | Bearer   | Get current user         |
| POST   | /api/auth/refresh               | None     | Refresh access token     |
| GET    | /api/admin/stats                | Admin    | Get user stats           |
| GET    | /api/admin/users                | Admin    | List all users           |
| PATCH  | /api/admin/users/:id/status     | Admin    | Update user status       |

---

## Roles & Flow

- **Admin** — logs in directly (seeded), manages user approvals
- **Staff** — created/approved by admin
- **Customer** — self-registers, waits for admin approval before login
