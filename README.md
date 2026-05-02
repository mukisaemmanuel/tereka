# Tereka - Personal Finance Management System

A Flask-based web application for tracking personal finances, managing budgets, and generating financial reports.

## Features

- **User Authentication** - Secure registration and login with bcrypt password hashing
- **Transaction Tracking** - Log income and expenses with categories, descriptions, and dates
- **Budget Management** - Set monthly spending limits per category with visual progress indicators
- **Financial Dashboard** - View monthly income, expenses, net balance, and recent transactions
- **Reports** - Generate detailed monthly financial breakdowns including:
  - Spending by category
  - Biggest expense identification
  - Daily average spending
  - Budget exceedance warnings
- **Transaction History** - Filter transactions by month with full searchable tables

## Tech Stack

- **Backend**: Python, Flask
- **Database**: MySQL (via XAMPP)
- **Templates**: Jinja2
- **Password Hashing**: bcrypt

## Prerequisites

- Python 3.8+
- XAMPP (for MySQL)
- pip (Python package manager)

## Installation

1. **Install Python dependencies**

   If using a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install flask mysql-connector-python bcrypt
   ```

   Or install system-wide:
   ```bash
   pip install flask mysql-connector-python bcrypt
   ```

2. **Set up MySQL database**

   - Start XAMPP and ensure MySQL is running
   - Import the schema:
     ```bash
     /opt/lampp/bin/mysql -u root < schema.sql
     ```
   - This creates the `terakac` database with all required tables and seed categories

3. **Configure database connection** (if needed)

   Edit `database.py` to match your MySQL credentials (default: root user, no password):
   ```python
   connection = mysql.connector.connect(
       host="localhost",
       user="root",
       password="",
       database="terakac"
   )
   ```

5. **Set Flask secret key**

   In production, change the `app.secret_key` value in `app.py` to a secure random string:
   ```python
   app.secret_key = "your-production-secret-key"
   ```

## Running the Application

```bash
python3 app.py
```

The application will start at **http://127.0.0.1:5000**

The Flask development server will auto-reload on code changes.

## Usage

1. **Register** - Create a new account at `/register`
2. **Log in** - Access your dashboard at `/login`
3. **Add Transactions** - Log income/expenses at `/add-transaction`
4. **Set Budgets** - Define monthly spending limits at `/budgets`
5. **View Reports** - Check financial health at `/report`
6. **Transaction History** - Browse all entries at `/transactions`

## Project Structure

```
tereka/
├── app.py           # Main Flask application and routes
├── database.py      # MySQL database operations
├── reports.py       # Monthly report generation logic
├── schema.sql       # Database schema and seed data
├── templates/       # HTML templates (Jinja2)
│   ├── base.html
│   ├── dashboard.html
│   ├── login.html
│   ├── register.html
│   ├── add_transaction.html
│   ├── transactions.html
│   ├── budgets.html
│   └── report.html
└── static/
    └── style.css    # Application styles
```

## Default Categories

- Food
- Transport
- Airtime
- Utilities
- Rent
- Savings
- Other

## Database Schema

### Tables

- **users** - User accounts (id, username, email, password)
- **categories** - Predefined expense/income categories
- **transactions** - All financial entries with type, amount, category, date
- **budgets** - Monthly spending limits per user per category

## Notes

- The current setup uses XAMPP's MySQL on Linux (`/opt/lampp/bin/mysql`)
- Default MySQL credentials: user=`root`, password=`` (empty)
- For production deployment, use a production WSGI server (Gunicorn, uWSGI) and proper MySQL credentials
- All passwords are hashed with bcrypt before storage

## Security

- SQL injection protection via parameterized queries
- Password hashing with bcrypt
- Session management via Flask sessions
- Login required decorator protects all sensitive routes

## Development

The application is built with clean separation:
- Database logic isolated in `database.py`
- Report generation in `reports.py`
- Routes organized by feature in `app.py`
- HTML templates extend a base layout for consistency

## License

MIT
# tereka
