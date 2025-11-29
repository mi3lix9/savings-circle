# Commands
commands-start = ابدأ التسجيل وشاهد رسالة الترحيب
commands-subscribe = اختر الأشهر والأسهم لدائرة الادخار الحالية
commands-create-circle = إنشاء دائرة ادخار جديدة
commands-start-circle = قفل الدائرة الحالية لبدء الاشتراكات
commands-admin = فتح لوحة الإدارة

# Errors
errors-missing-user-info = لم أتمكن من الحصول على معلومات المستخدم الخاصة بك.
errors-missing-telegram-profile = أحتاج إلى ملفك الشخصي في Telegram للبدء.
errors-only-admins = فقط المديرون يمكنهم تشغيل هذا الأمر.
errors-only-admins-start-circle = فقط المديرون يمكنهم بدء الدائرة.
errors-only-admins-create = فقط المديرون يمكنهم إنشاء دائرة.
errors-only-admins-access = فقط المديرون يمكنهم الوصول إلى هذا الأمر.
errors-no-open-circle = لم يتم العثور على دائرة مفتوحة. استخدم /create_circle أولاً.
errors-no-active-circle = لا توجد دائرة ادخار نشطة في الوقت الحالي. يرجى المحاولة مرة أخرى لاحقاً.
errors-circle-still-open = الدائرة "{ $circleName }" لا تزال مفتوحة. قفلها باستخدام /start_circle قبل إنشاء دائرة جديدة.
errors-circle-creation-failed = حدث خطأ أثناء إنشاء الدائرة. يرجى المحاولة مرة أخرى.
errors-month-not-found = مشكلة في { $monthName }: لم يتم العثور على الشهر.
errors-not-enough-stocks = مشكلة في { $monthName }: لا توجد أسهم كافية. طلبت { $stockCount }، لكن المتاح فقط { $available }.
errors-invalid-user = مستخدم غير صالح
errors-user-not-found = لم يتم العثور على المستخدم
errors-invalid-circle = دائرة غير صالحة
errors-circle-not-found = لم يتم العثور على الدائرة

# Onboarding
onboarding-welcome = مرحباً! للبدء، أحتاج إلى معلومات الاتصال الخاصة بك. يرجى الضغط على الزر أدناه لمشاركة رقم هاتفك.
onboarding-share-phone = 📱 مشاركة رقم هاتفي
onboarding-name-confirmation = لدي اسمك كـ <b>{ $firstName } { $lastName }</b>. هل هذا صحيح؟
onboarding-name-correct = نعم، هذا صحيح
onboarding-name-edit = لا، تعديل الاسم
onboarding-enter-full-name = يرجى إدخال اسمك الكامل (مثال: أحمد محمد):
onboarding-thank-you = شكراً لك، { $firstName }! تم حفظ معلوماتك.

# Subscribe
subscribe-circle-name = <b>{ $circleName }</b>
subscribe-stock-cost = تكلفة السهم: { $amount } ريال

subscribe-cart-title = 🛒 <b>اختياراتك:</b>
subscribe-cart-item = { $index }. { $monthName }: { $stockCount } سهم(أسهم)
subscribe-total-pay-monthly = <b>إجمالي الدفع الشهري:</b> { $amount } ريال
subscribe-total-receive = <b>إجمالي الاستلام:</b> { $amount } ريال

subscribe-month-detail = 📅 <b>الشهر:</b> { $monthName }
subscribe-stocks-detail = 🔢 <b>الأسهم:</b> { $stockCount }
subscribe-pay-monthly = 💸 <b>الدفع الشهري:</b> { $amount } ريال
subscribe-receive-monthly = 💰 <b>الاستلام الشهري:</b> { $amount } ريال
subscribe-adjust-stocks = <i>اضبط الأسهم وأضفها إلى سلة التسوق.</i>
subscribe-select-month = اختر شهراً لإضافته إلى اشتراكك.

subscribe-month-label = { $monthName } ({ $remaining })
subscribe-month-in-cart = { $monthName } (في السلة: { $stockCount })
subscribe-no-months-available = ⚠️ لا توجد أشهر متاحة.

subscribe-checkout = ✅ الدفع / التأكيد
subscribe-clear-cart = 🗑 مسح السلة
subscribe-cancel = ❌ إلغاء
subscribe-back = 🔙 رجوع
subscribe-add-to-cart = 📥 إضافة إلى السلة

subscribe-cancelled = تم إلغاء الاشتراك.
subscribe-success-title = ✅ <b>تم الاشتراك بنجاح!</b>
subscribe-success-item = • <b>{ $monthName }</b>: { $stockCount } سهم(أسهم)

# Circle Creation
circle-starting-wizard = بدء معالج إنشاء الدائرة...
circle-what-name = لننشئ دائرة جديدة. ماذا يجب أن تسمى الدائرة؟
circle-name-empty = لا يمكن أن يكون اسم الدائرة فارغاً.
circle-monthly-amount = أدخل مبلغ المساهمة الشهرية (أرقام فقط).
circle-monthly-amount-invalid = يرجى إدخال رقم موجب لمبلغ المساهمة الشهرية.
circle-duration = كم شهراً يجب أن تدوم هذه الدائرة؟ (أدخل رقماً بين 1 و 24)
circle-duration-invalid = يرجى إدخال رقماً بين 1 و 24 للمدة.
circle-stocks-per-month = كم سهم يجب أن يكون متاحاً لكل شهر؟
circle-stocks-per-month-invalid = يرجى إدخال رقم موجب لعدد الأسهم لكل شهر.
circle-start-month = في أي شهر يجب أن تبدأ الدائرة؟ (أدخل رقماً من 1-12، حيث 1=يناير، 12=ديسمبر)
circle-start-month-invalid = يرجى إدخال رقماً بين 1 و 12 لشهر البداية.
circle-start-year = في أي عام يجب أن تبدأ الدائرة؟ (أدخل عاماً، مثال: { $year })
circle-start-year-invalid = يرجى إدخال عام صالح ({ $year } أو لاحق).

circle-created = تم إنشاء الدائرة "{ $circleName }"!

circle-payment-details = 📊 تفاصيل الدفع:
circle-monthly-contribution = • المساهمة الشهرية لكل مشارك: { $amount } ريال
circle-total-collected = • إجمالي المجموع شهرياً: { $totalPerMonth } ريال
circle-total-payout = • إجمالي الدفع للدائرة: { $totalPayout } ريال

circle-months-title = 📅 الأشهر ({ $duration } أشهر):
circle-month-summary = { $index }. { $monthName } — { $stockCount } سهم(أسهم)

circle-use-start-circle = استخدم /start_circle بمجرد أن يجب قفل الاشتراكات.
circle-locked = تم قفل الدائرة "{ $circleName }" الآن. تم إغلاق الاشتراكات لمدة { $monthCount } شهر(أشهر).

# Admin
admin-panel-title = 🔧 لوحة الإدارة
admin-view-users = 👥 عرض جميع المستخدمين
admin-view-stocks = 📊 عرض الأسهم
admin-statistics = 📈 الإحصائيات

admin-stats-title = 📈 إحصائيات الإدارة
admin-total-users = 👥 إجمالي المستخدمين: { $count }
admin-total-stocks = 📊 إجمالي الأسهم: { $count }
admin-total-circles = 🔄 إجمالي الدوائر: { $count }
admin-active-circles = ✅ الدوائر النشطة: { $count }
admin-locked-circles = 🔒 الدوائر المقفلة: { $count }

admin-back = 🔙 رجوع
admin-back-to-users = 🔙 رجوع إلى المستخدمين
admin-back-to-circles = 🔙 رجوع إلى الدوائر

admin-user-label = 👤 { $userName } ({ $stockCount } أسهم، { $turnCount } أدوار)
admin-too-many-users = عدد كبير جداً من المستخدمين للعرض. عرض أول 20.
admin-more-users = ... و { $count } مستخدمين آخرين

admin-user-details-title = 👤 تفاصيل المستخدم
admin-telegram-id = 🆔 معرف Telegram: { $id }
admin-phone = 📱 الهاتف: { $phone }
admin-registered = 📅 مسجل: { $date }
admin-is-admin = 👑 مدير: { $status }
admin-not-provided = غير متوفر
admin-yes = نعم
admin-no = لا

admin-summary-title = 📊 الملخص:
admin-total-stocks = • إجمالي الأسهم: { $count }
admin-total-payout = • إجمالي الدفع: { $amount } ريال
admin-next-turn = • الدور التالي: { $monthName } (خلال { $monthsUntil } شهر/أشهر)
admin-circles-count = • الدوائر: { $count }

admin-circles-turns = 🔄 الدوائر والأدوار:
admin-circle-name = 📌 { $circleName }
admin-circle-stocks-payout =    الأسهم: { $stockCount }، الدفع: { $payout } ريال
admin-turns =    الأدوار:
admin-turn-paid =    ✅ { $monthName }: { $stockCount } سهم(أسهم)
admin-turn-unpaid =    ❌ { $monthName }: { $stockCount } سهم(أسهم)

admin-stocks-title = 📊 الأسهم: { $circleName }
admin-summary-label = 📈 الملخص:
admin-total-months = • إجمالي الأشهر: { $count }
admin-total-stocks-summary = • إجمالي الأسهم: { $count }
admin-filled = • المملوء: { $count }
admin-empty = • الفارغ: { $count }
admin-fill-rate = • معدل الملء: { $percentage }%

admin-monthly-breakdown = 📅 التفصيل الشهري:
admin-month-stats = { $monthName }
admin-month-totals =   الإجمالي: { $total }، المملوء: { $filled }، الفارغ: { $empty }
admin-month-fill =   الملء: { $percentage }%
admin-month-users =   المستخدمون:
admin-month-user =     👤 { $userName }: { $stockCount } سهم(أسهم)

admin-circle-status-locked = 🔒
admin-circle-status-active = ✅

admin-month-filled-info = { $monthName }: { $filled }/{ $total } مملوء

# Common
common-stock = سهم
common-stocks = أسهم
common-month = شهر
common-months = أشهر
common-sar = ريال

