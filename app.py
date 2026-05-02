"""
app.py — Main Flask application for Tereka
============================================
This is the entry point of the app. It defines:
- Flask app configuration
- Session secret key
- All URL routes (login, register, dashboard, etc.)
- A login-required decorator to protect routes
- Flash messages for user feedback

Database logic is in database.py, report logic in reports.py.
"""

from flask import (
    Flask, render_template, request,
    redirect, url_for, session, flash
)
import bcrypt
from functools import wraps
from datetime import datetime
import database as db
import reports

# ============================================================
# APP SETUP
# Create the Flask app and set a secret key for sessions.
# The secret key is used to sign session cookies so they
# can't be tampered with. In production, use a long random string.
# ============================================================
app = Flask(__name__)
app.secret_key = "tereka-secret-key-change-in-production"


# ============================================================
# LOGIN REQUIRED DECORATOR
# This decorator wraps any route that needs a logged-in user.
# If the session doesn't have a 'user_id', redirect to /login.
# Usage: @login_required above a route function.
# ============================================================
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check if user_id exists in the session
        if "user_id" not in session:
            flash("Please log in to access this page.", "error")
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated_function


# ============================================================
# TEMPLATE FILTER — currency format
# This lets us use {{ amount|currency }} in Jinja2 templates
# to format numbers as currency with 2 decimal places.
# ============================================================
@app.template_filter("currency")
def currency_format(value):
    """Format a number as currency with 2 decimal places."""
    try:
        return f"{float(value):,.2f}"
    except (ValueError, TypeError):
        return "0.00"


# ============================================================
# ROUTE: Home page
# Redirects to dashboard if logged in, otherwise to login.
# ============================================================
@app.route("/")
def index():
    if "user_id" in session:
        return redirect(url_for("dashboard"))
    return redirect(url_for("login"))


# ============================================================
# ROUTE: Register
# Shows a form on GET. On POST, validates input and creates
# a new user account with a bcrypt-hashed password.
# ============================================================
@app.route("/register", methods=["GET", "POST"])
def register():
    # If already logged in, go to dashboard
    if "user_id" in session:
        return redirect(url_for("dashboard"))

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        email = request.form.get("email", "").strip()
        password = request.form.get("password", "")
        confirm = request.form.get("confirm_password", "")

        # Validate that all fields are filled in
        if not username or not email or not password or not confirm:
            flash("All fields are required.", "error")
            return render_template("register.html")

        # Validate that passwords match
        if password != confirm:
            flash("Passwords do not match.", "error")
            return render_template("register.html")

        # Validate password length (at least 6 characters)
        if len(password) < 6:
            flash("Password must be at least 6 characters.", "error")
            return render_template("register.html")

        # Hash the password with bcrypt before storing
        # bcrypt requires bytes, so we encode the password first
        hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())

        # Try to register the user in the database
        # register_user returns False if email already exists
        if db.register_user(username, email, hashed.decode("utf-8")):
            flash("Account created! Please log in.", "success")
            return redirect(url_for("login"))
        else:
            flash("Email already registered.", "error")
            return render_template("register.html")

    # GET request — just show the form
    return render_template("register.html")


# ============================================================
# ROUTE: Login
# Shows a form on GET. On POST, checks credentials against
# the database. If valid, stores user_id and username in session.
# ============================================================
@app.route("/login", methods=["GET", "POST"])
def login():
    # If already logged in, go to dashboard
    if "user_id" in session:
        return redirect(url_for("dashboard"))

    if request.method == "POST":
        email = request.form.get("email", "").strip()
        password = request.form.get("password", "")

        # Look up the user by email
        user = db.get_user_by_email(email)

        if user is None:
            flash("Invalid email or password.", "error")
            return render_template("login.html")

        # Verify the password against the stored bcrypt hash
        # encode both to bytes for bcrypt.checkpw
        if bcrypt.checkpw(password.encode("utf-8"), user["password"].encode("utf-8")):
            # Password matches — store user info in session
            session["user_id"] = user["id"]
            session["username"] = user["username"]
            flash("Welcome back!", "success")
            return redirect(url_for("dashboard"))
        else:
            flash("Invalid email or password.", "error")
            return render_template("login.html")

    # GET request — just show the form
    return render_template("login.html")


# ============================================================
# ROUTE: Logout
# Clears all session data and redirects to login.
# ============================================================
@app.route("/logout")
def logout():
    session.clear()
    flash("You have been logged out.", "success")
    return redirect(url_for("login"))


# ============================================================
# ROUTE: Dashboard
# Protected page showing financial summary:
# - Total income this month
# - Total expenses this month
# - Net balance
# - 5 most recent transactions
# - Warning if any budget is exceeded
# ============================================================
@app.route("/dashboard")
@login_required
def dashboard():
    user_id = session["user_id"]
    now = datetime.now()
    year = now.year
    month = now.month

    # Get income and expense totals for the current month
    totals = db.get_monthly_totals(user_id, year, month)
    income = totals["income"]
    expense = totals["expense"]
    net = income - expense

    # Get the 5 most recent transactions
    recent = db.get_recent_transactions(user_id, limit=5)

    # Check if any budgets are exceeded this month
    exceeded = db.get_exceeded_budgets(user_id, year, month)

    return render_template(
        "dashboard.html",
        income=income,
        expense=expense,
        net=net,
        recent=recent,
        exceeded=exceeded,
        month_name=now.strftime("%B"),
        year=year
    )


# ============================================================
# ROUTE: Add Transaction
# Protected form to log a new income or expense.
# On POST, validates and saves the transaction.
# ============================================================
@app.route("/add-transaction", methods=["GET", "POST"])
@login_required
def add_transaction():
    if request.method == "POST":
        user_id = session["user_id"]
        trans_type = request.form.get("type", "")
        amount = request.form.get("amount", "")
        category = request.form.get("category", "")
        description = request.form.get("description", "").strip()
        date = request.form.get("date", "")

        # Validate required fields
        if not trans_type or not amount or not category or not date:
            flash("Please fill in all required fields.", "error")
            categories = db.get_all_categories()
            return render_template("add_transaction.html", categories=categories)

        # Validate that type is either income or expense
        if trans_type not in ("income", "expense"):
            flash("Invalid transaction type.", "error")
            categories = db.get_all_categories()
            return render_template("add_transaction.html", categories=categories)

        # Validate that amount is a positive number
        try:
            amount = float(amount)
            if amount <= 0:
                raise ValueError
        except (ValueError, TypeError):
            flash("Amount must be a positive number.", "error")
            categories = db.get_all_categories()
            return render_template("add_transaction.html", categories=categories)

        # Save the transaction to the database
        if db.add_transaction(user_id, trans_type, amount, category, description, date):
            flash("Transaction added successfully!", "success")
            return redirect(url_for("dashboard"))
        else:
            flash("Failed to add transaction. Please try again.", "error")

    # GET request — show the form with category dropdown
    categories = db.get_all_categories()
    return render_template("add_transaction.html", categories=categories)


# ============================================================
# ROUTE: Transactions
# Protected page showing all transactions in a table.
# Supports filtering by month via query parameter ?month=YYYY-MM
# ============================================================
@app.route("/transactions")
@login_required
def transactions():
    user_id = session["user_id"]
    month_filter = request.args.get("month", "")

    # If a month filter is provided (format: YYYY-MM), parse it
    if month_filter:
        try:
            parts = month_filter.split("-")
            year = int(parts[0])
            month = int(parts[1])
            transactions_list = db.get_transactions_for_month(user_id, year, month)
        except (ValueError, IndexError):
            # Invalid filter format — show all transactions
            transactions_list = db.get_all_transactions(user_id)
    else:
        # No filter — show all transactions
        transactions_list = db.get_all_transactions(user_id)

    return render_template(
        "transactions.html",
        transactions=transactions_list,
        month_filter=month_filter
    )


# ============================================================
# ROUTE: Budgets
# Protected page to view and set monthly spending limits.
# On POST, saves or updates a budget for a category.
# ============================================================
@app.route("/budgets", methods=["GET", "POST"])
@login_required
def budgets():
    user_id = session["user_id"]
    now = datetime.now()
    year = now.year
    month = now.month

    if request.method == "POST":
        category = request.form.get("category", "")
        monthly_limit = request.form.get("monthly_limit", "")

        # Validate inputs
        if not category or not monthly_limit:
            flash("Please fill in all fields.", "error")
        else:
            try:
                monthly_limit = float(monthly_limit)
                if monthly_limit < 0:
                    raise ValueError
            except (ValueError, TypeError):
                flash("Monthly limit must be a positive number.", "error")
                categories = db.get_all_categories()
                budget_data = db.get_budget_with_spending(user_id, year, month)
                return render_template("budgets.html", categories=categories, budget_data=budget_data)

            # Save the budget
            if db.set_budget(user_id, category, monthly_limit):
                flash("Budget saved!", "success")
            else:
                flash("Failed to save budget.", "error")

        return redirect(url_for("budgets"))

    # GET request — show current budgets with spending progress
    categories = db.get_all_categories()
    budget_data = db.get_budget_with_spending(user_id, year, month)
    return render_template("budgets.html", categories=categories, budget_data=budget_data)


# ============================================================
# ROUTE: Monthly Report
# Protected page showing a full financial breakdown
# for a selected month. Defaults to the current month.
# Accepts ?month=YYYY-MM query parameter.
# ============================================================
@app.route("/report")
@login_required
def report():
    user_id = session["user_id"]
    month_filter = request.args.get("month", "")

    # Parse the month filter, defaulting to current month
    now = datetime.now()
    if month_filter:
        try:
            parts = month_filter.split("-")
            year = int(parts[0])
            month = int(parts[1])
        except (ValueError, IndexError):
            year = now.year
            month = now.month
    else:
        year = now.year
        month = now.month

    # Generate the full report using reports.py
    report_data = reports.generate_monthly_report(user_id, year, month)

    # Convert month number to name for display
    month_name = datetime(year, month, 1).strftime("%B")

    return render_template(
        "report.html",
        report=report_data,
        month_name=month_name,
        month_filter=month_filter
    )


# ============================================================
# RUN THE APP
# Start the Flask development server on port 5000.
# debug=True gives auto-reload and better error messages.
# Only run this if the file is executed directly.
# ============================================================
if __name__ == "__main__":
    app.run(debug=True, port=5000)
