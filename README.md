# Savings Circle Telegram Bot

A Telegram bot that automates and manages Savings Circles (جمعيات). Participants join a monthly circle, select one or more payout slots (stocks), pay monthly, and receive their turn based on their assigned month. The bot fully manages onboarding, subscription, notifications, payments, and turn tracking.

⸻

## Features

1. Onboarding
 • Users start with /start.
 • Bot requests phone number using Telegram’s secure contact button.
 • After verification, bot shows available commands.

2. Subscription System (/subscribe)
 • View available months and remaining stock counts.
 • Choose a month → choose number of stocks.
 • Option to pick a Random Month with available slots.
 • Users may buy multiple stocks and edit them until the circle starts.

3. Payment System (/pay)
 • Daily reminders begin on the 25th of the previous month.
 • Example: January turn → reminders start December 25.
 • Reminders stop once the user pays or uploads proof.

4. Turn Tracking (/myturn)

User can see:
 • All their payout months.
 • Expected amount for each month.
 • How long until their next turn.
 • Total amount they will receive in the circle.

5. Admin Tools
 • Create circle (months, stocks, monthly amount).
 • Start (lock) the circle.
 • View user subscriptions and payment reports.

⸻

## How the Circle Works

 1. Admin creates the circle with a list of months and stock capacity.
 2. Users subscribe and pick their desired months.
 3. Admin starts the circle → subscriptions lock.
 4. Every month:
 • Users receive reminders starting on the 25th.
 • Users pay using /pay.
 • The month completes and shifts to the next.

⸻

## Cron Jobs

Daily Reminder Cron

Runs daily at 09:00:
 • Sends reminders to users whose payment is due.
 • Stops once payment is confirmed.

Monthly Rotation Cron

Runs on the 1st of each month:
 • Resets payment status.
 • Archives payment history.
 • Begins next reminder cycle.

⸻

## Tech Stack

 • Telegram Bot API (grammY)
 • SQLite as simple embedded DB
 • Node.js runtime
 • Cron Jobs handled locally or via external scheduler
 • Docker for containerized deployment

⸻

## Commands Summary

User Commands
 • /start – begin registration
 • /subscribe – pick months and stocks
 • /myturn – see payout schedule
 • /pay – mark monthly payment

Admin Commands
 • /create_circle
 • /start_circle

⸻

## Project Goals

 • Automate traditional savings circles.
 • Provide visibility, reminders, and transparency.
 • Reduce manual communication and tracking.
 • Make payouts predictable and organized.
