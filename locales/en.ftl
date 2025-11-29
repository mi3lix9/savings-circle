# Commands
commands-start = Begin registration and see welcome message
commands-subscribe = Pick months and stocks for the current circle
commands-myturn = See your payout schedule
commands-create-circle = Create a new savings circle
commands-start-circle = Lock the current circle to start subscriptions
commands-admin = Open admin panel

# Errors
errors-missing-user-info = I couldn't get your user information.
errors-missing-telegram-profile = I need your Telegram profile to get started.
errors-only-admins = Only admins can run this command.
errors-only-admins-start-circle = Only admins can start the circle.
errors-only-admins-create = Only admins can create a circle.
errors-only-admins-access = Only admins can access this command.
errors-no-open-circle = No open circle found. Use /create_circle first.
errors-no-active-circle = There is no active savings circle right now. Please try again later.
errors-circle-still-open = Circle "{ $circleName }" is still open. Lock it with /start_circle before creating a new one.
errors-circle-creation-failed = Something went wrong while creating the circle. Please try again.
errors-month-not-found = Issue with { $monthName }: Month not found.
errors-not-enough-stocks = Issue with { $monthName }: Not enough stocks. You requested { $stockCount }, but only { $available } are available.
errors-invalid-user = Invalid user
errors-user-not-found = User not found
errors-invalid-circle = Invalid circle
errors-circle-not-found = Circle not found

# Onboarding
onboarding-welcome = Welcome! To get started, I need your contact information. Please tap the button below to share your phone number.
onboarding-share-phone = 📱 Share My Phone Number
onboarding-name-confirmation = I have your name as <b>{ $firstName } { $lastName }</b>. Is this correct?
onboarding-name-correct = Yes, that's correct
onboarding-name-edit = No, edit name
onboarding-enter-full-name = Please enter your full name (e.g. John Doe):
onboarding-thank-you = Thank you, { $firstName }! Your information has been saved.

# Subscribe
subscribe-circle-name = <b>{ $circleName }</b>
subscribe-stock-cost = Stock Cost: { $amount } SAR

subscribe-cart-title = 🛒 <b>Your Selections:</b>
subscribe-cart-item = { $index }. 🗓️ { $monthName } • 🎟️ { $stockCount } { $stockCount ->
  [1] stock
  *[other] stocks
}
subscribe-total-pay-monthly = <b>Total Pay Monthly:</b> { $amount } SAR
subscribe-total-receive = <b>Total Receive:</b> { $amount } SAR

subscribe-month-detail = 🗓️ <b>Month:</b> { $monthName }
subscribe-stocks-detail = 🔢 <b>Stocks:</b> { $stockCount }
subscribe-pay-monthly = 💸 <b>Pay Monthly:</b> { $amount } SAR
subscribe-receive-monthly = 💰 <b>Receive Monthly:</b> { $amount } SAR
subscribe-adjust-stocks = <i>Adjust stocks and add to your cart.</i>
subscribe-select-month = Select a month to add to your subscription.

subscribe-month-label = { $monthName } · { $remaining }
subscribe-month-in-cart = { $monthName } · { $stockCount }
subscribe-no-months-available = ⚠️ No months available.

subscribe-checkout = ✅ Confirm
subscribe-clear-cart = 🧹 Clear
subscribe-cancel = ✖️ Cancel
subscribe-back = ◀️ Back
subscribe-add-to-cart = ➕ Save

subscribe-cancelled = Subscription cancelled.
subscribe-success-title = ✅ <b>Subscribed Successfully!</b>
subscribe-success-item = • <b>{ $monthName }</b>: { $stockCount } stocks

# Circle Creation
circle-starting-wizard = Starting circle creation wizard...
circle-what-name = Let's create a new circle. What should the circle be called?
circle-name-empty = Circle name cannot be empty.
circle-monthly-amount = Enter the monthly contribution amount (numbers only).
circle-monthly-amount-invalid = Please enter a positive number for the monthly amount.
circle-duration = How many months should this circle run? (Enter a number between 1 and 24)
circle-duration-invalid = Please enter a number between 1 and 24 for the duration.
circle-stocks-per-month = How many stocks should be available per month?
circle-stocks-per-month-invalid = Please enter a positive number for stocks per month.
circle-start-month = What month should the circle start? (Enter a number from 1-12, where 1=January, 12=December)
circle-start-month-invalid = Please enter a number between 1 and 12 for the start month.
circle-start-year = What year should the circle start? (Enter a year, e.g., { $year })
circle-start-year-invalid = Please enter a valid year ({ $year } or later).

circle-created = Circle "{ $circleName }" created!

circle-payment-details = 📊 Payment Details:
circle-monthly-contribution = • Monthly contribution per participant: { $amount } SAR
circle-total-collected = • Total collected per month: { $totalPerMonth } SAR
circle-total-payout = • Total payout for circle: { $totalPayout } SAR

circle-months-title = 📅 Months ({ $duration } months):
circle-month-summary = { $index }. { $monthName } — { $stockCount } stock(s)

circle-use-start-circle = Use /start_circle once subscriptions should be locked.
circle-locked = Circle "{ $circleName }" is now locked. Subscriptions are closed for { $monthCount } month(s).

# Admin
admin-panel-title = 🔧 Admin Panel
admin-view-users = 👥 View All Users
admin-view-stocks = 📊 View Stocks
admin-statistics = 📈 Statistics

admin-stats-title = 📈 Admin Statistics
admin-total-users = 👥 Total Users: { $count }
admin-total-stocks = 📊 Total Stocks: { $count }
admin-total-circles = 🔄 Total Circles: { $count }
admin-active-circles = ✅ Active Circles: { $count }
admin-locked-circles = 🔒 Locked Circles: { $count }

admin-back = 🔙 Back
admin-back-to-users = 🔙 Back to Users
admin-back-to-circles = 🔙 Back to Circles

admin-user-label = 👤 { $userName } • 🎟️ { $stockCount } • 🔁 { $turnCount }
admin-too-many-users = Too many users to display. Showing first 20.
admin-more-users = ... and { $count } more users

admin-user-details-title = 👤 User Details
admin-telegram-id = 🆔 Telegram ID: { $id }
admin-phone = 📱 Phone: { $phone }
admin-registered = 📅 Registered: { $date }
admin-is-admin = 👑 Admin: { $status }
admin-not-provided = Not provided
admin-yes = Yes
admin-no = No

admin-summary-title = 📊 Summary:
admin-total-stocks = • Total Stocks: { $count }
admin-total-payout = • Total Payout: { $amount } SAR
admin-next-turn = • Next Turn: { $monthName } ⏳ { $monthsUntil } { $monthsUntil ->
  [1] month
  *[other] months
} away
admin-circles-count = • Circles: { $count }

admin-circles-turns = 🔄 Circles & Turns:
admin-circle-name = 📌 { $circleName }
admin-circle-stocks-payout =    Stocks: { $stockCount }, Payout: { $payout } SAR
admin-turns =    Turns:
admin-turn-paid =    ✅ { $monthName } • 🎟️ { $stockCount } { $stockCount ->
      [1] stock
      *[other] stocks
    }
admin-turn-unpaid =    ❌ { $monthName } • 🎟️ { $stockCount } { $stockCount ->
      [1] stock
      *[other] stocks
    }

admin-stocks-title = 📊 Stocks: { $circleName }
admin-summary-label = 📈 Summary:
admin-total-months = • Total Months: { $count }
admin-total-stocks-summary = • Total Stocks: { $count }
admin-filled = • Filled: { $count }
admin-empty = • Empty: { $count }
admin-fill-rate = • Fill Rate: { $percentage }%

admin-monthly-breakdown = 📅 Monthly Breakdown:
admin-month-stats = 🗓️ { $monthName }
admin-month-totals =   🎯 Total: { $total } • ✅ Filled: { $filled } • ⚪ Empty: { $empty }
admin-month-fill =   Fill: { $percentage }%
admin-month-users =   Users:
admin-month-user =     👤 { $userName } • 🎟️ { $stockCount } { $stockCount ->
      [1] stock
      *[other] stocks
    }

admin-circle-status-locked = 🔒
admin-circle-status-active = ✅

admin-month-filled-info = 🧮 { $monthName } • { $filled }/{ $total } filled

# MyTurn
myturn-title = 📅 <b>Your Payout Schedule</b>
myturn-monthly-payout = 💰 <b>Monthly Payout:</b> { $amount } SAR
myturn-month-item =
    🗓️ <b>{ $monthName }</b>
    💵 { $amount } SAR • 🎟️ { $stockCount } { $stockCount ->
        [1] stock
        *[other] stocks
    }
    📍 { $status }
myturn-months-until = ⏳ { $months } { $months ->
  [1] month
  *[other] months
} to go
myturn-already-gone = ✅ Already received
myturn-current = 📅 This month
myturn-no-turns = You don't have any subscriptions in locked circles yet.

# Common
common-stock = stock
common-stocks = stocks
common-month = month
common-months = months
common-sar = SAR

# Payment
payment-upload-proof = Please upload a screenshot or document as proof of your payment.
payment-invalid-file = I couldn't understand that file. Please send a photo or document, or use /cancel to stop.
payment-cancelled = Payment process cancelled.
payment-select-months = Select the month(s) this payment should be applied to.
payment-confirm = ✅ Confirm
payment-cancel = ✖️ Cancel
payment-no-stocks = You don't have any stocks in the active circle.
payment-all-paid = You have already submitted proof for all your months in this circle.
payment-success = ✅ Your payment proof has been saved. Thank you!

# Scheduler
payment-reminder = 🔔 Reminder: Payment for { $monthName } in circle "{ $circleName }" is due. Please use /pay to submit your proof.
