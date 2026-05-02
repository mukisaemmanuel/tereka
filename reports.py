"""
reports.py — Monthly report generation for Tereka
==================================================
"""

import database as db


def generate_monthly_report(user_id, year, month):
    """
    Build a complete monthly financial report for a user.

    Returns a dict with these keys:
        - year: the year (int)
        - month: the month (int)
        - income: total income for the month (float)
        - expense: total expenses for the month (float)
        - net: income minus expense (float)
        - spending_by_category: list of {category, total} dicts
        - biggest_expense: {category, description, amount, date} or None
        - daily_average: average spend per active day (float)
        - exceeded_budgets: list of {category, monthly_limit, spent} dicts

    This function calls multiple database functions and
    combines the results into one report object.
    """
    # Step 1: Get total income and expenses for the month
    totals = db.get_monthly_totals(user_id, year, month)
    income = totals["income"]
    expense = totals["expense"]
    net = income - expense  # Positive means surplus, negative means deficit

    # Step 2: Get spending broken down by category (expenses only)
    spending_by_category = db.get_spending_by_category(user_id, year, month)

    # Step 3: Find the single biggest expense transaction
    biggest_expense = db.get_biggest_expense(user_id, year, month)

    # Step 4: Calculate daily average spend
    # We divide total expenses by the number of days that had spending
    # If there were no expenses, average is 0
    day_count = db.get_expense_day_count(user_id, year, month)
    daily_average = expense / day_count if day_count > 0 else 0

    # Step 5: Check which budget categories have been exceeded
    exceeded_budgets = db.get_exceeded_budgets(user_id, year, month)

    # Assemble everything into one report dict
    report = {
        "year": year,
        "month": month,
        "income": income,
        "expense": expense,
        "net": net,
        "spending_by_category": spending_by_category,
        "biggest_expense": biggest_expense,
        "daily_average": daily_average,
        "exceeded_budgets": exceeded_budgets,
    }

    return report
