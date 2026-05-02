

import mysql.connector
from mysql.connector import Error



def get_connection():
    """Create and return a new MySQL database connection."""
    try:
        connection = mysql.connector.connect(
            host="localhost",
            user="root",
            password="",         
            database="tereka"
        )
        return connection
    except Error as e:
        print(f"Database connection error: {e}")
        return None


# ============================================================
# USER OPERATIONS
# ============================================================

def register_user(username, email, hashed_password):
    """
    Insert a new user into the database.
    Returns True on success, False if the email already exists.
    The password should already be bcrypt-hashed before calling this.
    """
    conn = get_connection()
    if conn is None:
        return False
    try:
        cursor = conn.cursor()
        # Check if email is already taken
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cursor.fetchone() is not None:
            return False  # Email already registered

        # Insert the new user with hashed password
        cursor.execute(
            "INSERT INTO users (username, email, password) VALUES (%s, %s, %s)",
            (username, email, hashed_password)
        )
        conn.commit()
        return True
    except Error as e:
        print(f"Registration error: {e}")
        return False
    finally:
        cursor.close()
        conn.close()


def get_user_by_email(email):
    """
    Fetch a user row by their email address.
    Returns a dict with id, username, email, password if found,
    or None if no user matches.
    Used during login to verify credentials.
    """
    conn = get_connection()
    if conn is None:
        return None
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, username, email, password FROM users WHERE email = %s",
            (email,)
        )
        user = cursor.fetchone()
        return user
    except Error as e:
        print(f"Login lookup error: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def get_user_by_id(user_id):
    """
    Fetch a user row by their ID.
    Returns a dict with id, username, email if found, or None.
    Used to display the username in the navbar.
    """
    conn = get_connection()
    if conn is None:
        return None
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, username, email FROM users WHERE id = %s",
            (user_id,)
        )
        return cursor.fetchone()
    except Error as e:
        print(f"User lookup error: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


# ============================================================
# CATEGORY OPERATIONS
# ============================================================

def get_all_categories():
    """
    Return all category names from the categories table.
    Used to populate dropdown menus in forms.
    """
    conn = get_connection()
    if conn is None:
        return []
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, name FROM categories ORDER BY name")
        return cursor.fetchall()
    except Error as e:
        print(f"Category fetch error: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


# ============================================================
# TRANSACTION OPERATIONS
# ============================================================

def add_transaction(user_id, trans_type, amount, category, description, date):
    """
    Insert a new transaction for the given user.
    trans_type is 'income' or 'expense'.
    amount is a positive decimal number.
    """
    conn = get_connection()
    if conn is None:
        return False
    try:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO transactions (user_id, type, amount, category, description, date)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (user_id, trans_type, amount, category, description, date)
        )
        conn.commit()
        return True
    except Error as e:
        print(f"Add transaction error: {e}")
        return False
    finally:
        cursor.close()
        conn.close()


def get_recent_transactions(user_id, limit=5):
    """
    Fetch the most recent transactions for a user.
    Used on the dashboard to show the last 5 entries.
    Ordered by date descending, then by created_at descending.
    """
    conn = get_connection()
    if conn is None:
        return []
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """SELECT id, type, amount, category, description, date
               FROM transactions
               WHERE user_id = %s
               ORDER BY date DESC, created_at DESC
               LIMIT %s""",
            (user_id, limit)
        )
        return cursor.fetchall()
    except Error as e:
        print(f"Recent transactions error: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def get_transactions_for_month(user_id, year, month):
    """
    Fetch all transactions for a specific month and year.
    Used on the transactions page with month filtering.
    month is 1-12, year is e.g. 2026.
    """
    conn = get_connection()
    if conn is None:
        return []
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """SELECT id, type, amount, category, description, date
               FROM transactions
               WHERE user_id = %s AND YEAR(date) = %s AND MONTH(date) = %s
               ORDER BY date DESC, created_at DESC""",
            (user_id, year, month)
        )
        return cursor.fetchall()
    except Error as e:
        print(f"Monthly transactions error: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def get_all_transactions(user_id):
    """
    Fetch all transactions for a user, newest first.
    Used as a fallback when no month filter is applied.
    """
    conn = get_connection()
    if conn is None:
        return []
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """SELECT id, type, amount, category, description, date
               FROM transactions
               WHERE user_id = %s
               ORDER BY date DESC, created_at DESC""",
            (user_id,)
        )
        return cursor.fetchall()
    except Error as e:
        print(f"All transactions error: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def get_monthly_totals(user_id, year, month):
    """
    Calculate total income and total expenses for a given month.
    Returns a dict with 'income' and 'expense' keys.
    Used on the dashboard and in reports.
    """
    conn = get_connection()
    if conn is None:
        return {"income": 0, "expense": 0}
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """SELECT type, SUM(amount) as total
               FROM transactions
               WHERE user_id = %s AND YEAR(date) = %s AND MONTH(date) = %s
               GROUP BY type""",
            (user_id, year, month)
        )
        rows = cursor.fetchall()
        # Build result dict — default to 0 if no rows for a type
        result = {"income": 0, "expense": 0}
        for row in rows:
            result[row["type"]] = float(row["total"]) if row["total"] else 0
        return result
    except Error as e:
        print(f"Monthly totals error: {e}")
        return {"income": 0, "expense": 0}
    finally:
        cursor.close()
        conn.close()


def get_spending_by_category(user_id, year, month):
    """
    Calculate total spending per category for a given month.
    Only counts expenses (not income).
    Returns list of dicts: [{category: 'Food', total: 150.00}, ...]
    Used in reports and budget checks.
    """
    conn = get_connection()
    if conn is None:
        return []
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """SELECT category, SUM(amount) as total
               FROM transactions
               WHERE user_id = %s AND type = 'expense'
                 AND YEAR(date) = %s AND MONTH(date) = %s
               GROUP BY category
               ORDER BY total DESC""",
            (user_id, year, month)
        )
        # Convert Decimal totals to float for easier template use
        rows = cursor.fetchall()
        for row in rows:
            row["total"] = float(row["total"]) if row["total"] else 0
        return rows
    except Error as e:
        print(f"Spending by category error: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def get_biggest_expense(user_id, year, month):
    """
    Find the single largest expense transaction in a given month.
    Returns a dict with category, description, amount, date,
    or None if there are no expenses.
    """
    conn = get_connection()
    if conn is None:
        return None
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """SELECT category, description, amount, date
               FROM transactions
               WHERE user_id = %s AND type = 'expense'
                 AND YEAR(date) = %s AND MONTH(date) = %s
               ORDER BY amount DESC
               LIMIT 1""",
            (user_id, year, month)
        )
        row = cursor.fetchone()
        if row:
            row["amount"] = float(row["amount"])
        return row
    except Error as e:
        print(f"Biggest expense error: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def get_expense_day_count(user_id, year, month):
    """
    Count the number of distinct days that have at least one expense.
    Used to calculate the daily average spend:
    total_expenses / number_of_days_with_spending
    """
    conn = get_connection()
    if conn is None:
        return 0
    try:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT COUNT(DISTINCT date) as day_count
               FROM transactions
               WHERE user_id = %s AND type = 'expense'
                 AND YEAR(date) = %s AND MONTH(date) = %s""",
            (user_id, year, month)
        )
        result = cursor.fetchone()
        return result[0] if result else 0
    except Error as e:
        print(f"Expense day count error: {e}")
        return 0
    finally:
        cursor.close()
        conn.close()


# ============================================================
# BUDGET OPERATIONS
# ============================================================

def get_budgets(user_id):
    """
    Fetch all budget entries for a user.
    Returns list of dicts: [{id, category, monthly_limit}, ...]
    """
    conn = get_connection()
    if conn is None:
        return []
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, category, monthly_limit FROM budgets WHERE user_id = %s ORDER BY category",
            (user_id,)
        )
        return cursor.fetchall()
    except Error as e:
        print(f"Get budgets error: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def set_budget(user_id, category, monthly_limit):
    """
    Create or update a budget for a category.
    Uses INSERT ... ON DUPLICATE KEY UPDATE so if a budget
    already exists for this user+category, it updates the limit.
    """
    conn = get_connection()
    if conn is None:
        return False
    try:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO budgets (user_id, category, monthly_limit)
               VALUES (%s, %s, %s)
               ON DUPLICATE KEY UPDATE monthly_limit = %s""",
            (user_id, category, monthly_limit, monthly_limit)
        )
        conn.commit()
        return True
    except Error as e:
        print(f"Set budget error: {e}")
        return False
    finally:
        cursor.close()
        conn.close()


def get_exceeded_budgets(user_id, year, month):
    """
    Find all budget categories where spending this month
    has exceeded the monthly limit.
    Returns list of dicts: [{category, monthly_limit, spent}, ...]
    Used to show warning banners on the dashboard.
    """
    conn = get_connection()
    if conn is None:
        return []
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """SELECT b.category, b.monthly_limit,
                      COALESCE(SUM(t.amount), 0) as spent
               FROM budgets b
               LEFT JOIN transactions t
                 ON b.user_id = t.user_id
                 AND b.category = t.category
                 AND t.type = 'expense'
                 AND YEAR(t.date) = %s
                 AND MONTH(t.date) = %s
               WHERE b.user_id = %s
               GROUP BY b.category, b.monthly_limit
               HAVING spent > b.monthly_limit""",
            (year, month, user_id)
        )
        rows = cursor.fetchall()
        for row in rows:
            row["monthly_limit"] = float(row["monthly_limit"])
            row["spent"] = float(row["spent"])
        return rows
    except Error as e:
        print(f"Exceeded budgets error: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def get_budget_with_spending(user_id, year, month):
    """
    For each budget category, return the limit and how much
    has been spent so far this month.
    Returns list of dicts: [{category, monthly_limit, spent}, ...]
    Used on the budgets page to show progress bars.
    """
    conn = get_connection()
    if conn is None:
        return []
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """SELECT b.category, b.monthly_limit,
                      COALESCE(SUM(t.amount), 0) as spent
               FROM budgets b
               LEFT JOIN transactions t
                 ON b.user_id = t.user_id
                 AND b.category = t.category
                 AND t.type = 'expense'
                 AND YEAR(t.date) = %s
                 AND MONTH(t.date) = %s
               WHERE b.user_id = %s
               GROUP BY b.category, b.monthly_limit
               ORDER BY b.category""",
            (year, month, user_id)
        )
        rows = cursor.fetchall()
        for row in rows:
            row["monthly_limit"] = float(row["monthly_limit"])
            row["spent"] = float(row["spent"])
        return rows
    except Error as e:
        print(f"Budget with spending error: {e}")
        return []
    finally:
        cursor.close()
        conn.close()
