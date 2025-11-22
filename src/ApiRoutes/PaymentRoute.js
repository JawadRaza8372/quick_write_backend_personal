const router = require("express").Router();
const Stripe = require("stripe");
const PaymentModal = require("../models/PaymentModal");
const { authenticateJWT } = require("../config/JwtHelpers");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
	apiVersion: "2025-09-30.clover",
});
const User = require("../models/UserModal");
// Define Stripe Price IDs for your plans
const PLAN_PRICES = {
	test: {
		priceId: process.env.STRIPE_TEST_PRICE_ID ?? "price_1NxxxxxTest",
	},
	pro: {
		priceId: process.env.STRIPE_PRO_PRICE_ID ?? "price_1NxxxxxPro",
	},
	premium: {
		priceId: process.env.STRIPE_PREMIUM_PRICE_ID ?? "price_1NxxxxxPremium",
	},
};
module.exports = (io) => {
	// -----------------------
	// 1️⃣ Create Setup Intent (attach card)
	// -----------------------
	router.post(
		"/create-subscription-setup-intent",
		authenticateJWT,
		async (req, res) => {
			try {
				const user = await User.findById(req.user.id);
				if (!user.stripeCustomerId) {
					const customer = await stripe.customers.create({
						email: user.email,
						metadata: { userId: user._id.toString() },
					});
					user.stripeCustomerId = customer.id;
					await user.save();
				}

				const setupIntent = await stripe.setupIntents.create({
					customer: user.stripeCustomerId,
					payment_method_types: ["card"],
				});

				res.status(200).json({ clientSecret: setupIntent.client_secret });
			} catch (err) {
				res.status(500).json({ message: err.message });
			}
		}
	);

	// -----------------------
	// 2️⃣ Create Subscription
	// -----------------------
	router.post("/create-subscription", authenticateJWT, async (req, res) => {
		try {
			const { planName, paymentMethodId } = req.body;
			const normalizedPlan = planName.toLowerCase().trim();
			if (!PLAN_PRICES[normalizedPlan])
				return res.status(400).json({ message: "Invalid plan" });

			const user = await User.findById(req.user.id);

			// Attach payment method
			await stripe.paymentMethods.attach(paymentMethodId, {
				customer: user.stripeCustomerId,
			});
			await stripe.customers.update(user.stripeCustomerId, {
				invoice_settings: { default_payment_method: paymentMethodId },
			});

			// Create subscription
			const subscription = await stripe.subscriptions.create({
				customer: user.stripeCustomerId,
				items: [{ price: PLAN_PRICES[normalizedPlan].priceId }],
				expand: ["latest_invoice.payment_intent"],
			});

			const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

			// Update user record
			user.activePlan = normalizedPlan;
			user.stripeSubscriptionId = subscription.id;
			user.paymentMethodId = paymentMethodId;
			user.cardBrand = pm.card.brand;
			user.cardLast4 = pm.card.last4;
			user.expiresAt = new Date(subscription.current_period_end * 1000);
			await user.save();

			// Save first payment if exists
			const paymentIntent = subscription.latest_invoice.payment_intent;
			if (paymentIntent) {
				await PaymentModal.create({
					userId: user._id,
					subscriptionId: subscription.id,
					invoiceId: subscription.latest_invoice.id,
					paymentIntentId: paymentIntent.id,
					amount: paymentIntent.amount / 100,
					currency: paymentIntent.currency,
					paymentMethod: paymentIntent.payment_method_types[0],
					cardBrand: pm.card.brand,
					cardLast4: pm.card.last4,
					status: paymentIntent.status,
					planName: normalizedPlan,
					receiptUrl: paymentIntent.charges?.data?.[0]?.receipt_url ?? null,
				});
			}

			io.emit("userProfileUpdated", user._id);
			io.emit("userPaymentUpdated", user._id);

			res.status(200).json({
				message: `${normalizedPlan} subscription started successfully.`,
			});
		} catch (err) {
			res.status(500).json({ message: err.message });
		}
	});

	// -----------------------
	// 3️⃣ Cancel Subscription
	// -----------------------
	router.post("/cancel-subscription", authenticateJWT, async (req, res) => {
		try {
			const user = await User.findById(req.user.id);
			if (!user.stripeSubscriptionId)
				return res
					.status(400)
					.json({ message: "No active subscription found" });

			// Cancel subscription at period end
			const canceledSubscription = await stripe.subscriptions.update(
				user.stripeSubscriptionId,
				{ cancel_at_period_end: true }
			);

			// Update user record with cancel info but do not change activePlan
			user.stripeSubscriptionId = canceledSubscription.id;
			user.expiresAt = new Date(canceledSubscription.current_period_end * 1000);
			await user.save();

			res.status(200).json({
				message:
					"Subscription canceled. Access will remain until the period ends.",
				expiresAt: user.expiresAt,
			});
		} catch (err) {
			res.status(500).json({ message: err.message });
		}
	});

	// -----------------------
	// 4️⃣ Get Subscription Summary
	// -----------------------
	router.get("/payments", authenticateJWT, async (req, res) => {
		try {
			const user = await User.findById(req.user.id);

			if (!user.stripeSubscriptionId)
				return res.status(400).json({ message: "No subscription found" });

			const payments = await PaymentModal.find({
				userId: user._id,
				subscriptionId: user.stripeSubscriptionId,
				status: "succeeded",
			});

			return res.status(200).json({
				cardBrand: user.cardBrand ?? "",
				cardLast4: user.cardLast4 ?? "",
				pricePaid: payments?.length > 0 ? payments?.[0]?.amount : 0,
				completedPayments: payments,
			});
		} catch (err) {
			res.status(500).json({ message: err.message });
		}
	});
	//webhook
	router.post(
		"/stripe-webhook",
		bodyParser.raw({ type: "application/json" }),
		async (req, res) => {
			const sig = req.headers["stripe-signature"];
			let event;

			try {
				event = stripe.webhooks.constructEvent(
					req.body,
					sig,
					process.env.STRIPE_WEBHOOK_SECRET
				);
			} catch (err) {
				return res.status(400).send(`Webhook Error: ${err.message}`);
			}

			try {
				switch (event.type) {
					case "invoice.payment_succeeded": {
						const invoice = event.data.object;
						const subscriptionId = invoice.subscription;
						const customerId = invoice.customer;

						const user = await User.findOne({ stripeCustomerId: customerId });
						if (!user) break;

						const priceId = invoice.lines.data[0].price.id;
						const planName = Object.keys(PLAN_PRICES).find(
							(key) => PLAN_PRICES[key].priceId === priceId
						);

						if (!planName) break;

						const paymentIntent = await stripe.paymentIntents.retrieve(
							invoice.payment_intent
						);

						await PaymentModal.create({
							userId: user._id,
							subscriptionId,
							invoiceId: invoice.id,
							paymentIntentId: paymentIntent.id,
							amount: paymentIntent.amount / 100,
							currency: paymentIntent.currency,
							paymentMethod: paymentIntent.payment_method_types[0],
							cardBrand:
								paymentIntent.charges?.data?.[0]?.payment_method_details?.card
									?.brand ?? "",
							cardLast4:
								paymentIntent.charges?.data?.[0]?.payment_method_details?.card
									?.last4 ?? "",
							status: paymentIntent.status,
							planName,
							receiptUrl: paymentIntent.charges?.data?.[0]?.receipt_url ?? null,
						});

						if (user.stripeSubscriptionId === subscriptionId) {
							user.activePlan = planName;
							user.expiresAt = new Date(
								invoice.lines.data[0].period?.end * 1000 ||
									invoice.period_end * 1000
							);
							user.cardBrand =
								paymentIntent.charges?.data?.[0]?.payment_method_details?.card
									?.brand ?? "";
							user.cardLast4 =
								paymentIntent.charges?.data?.[0]?.payment_method_details?.card
									?.last4 ?? "";
							await user.save();
						}
						break;
					}

					case "customer.subscription.updated": {
						const subscription = event.data.object;
						const user = await User.findOne({
							stripeCustomerId: subscription.customer,
						});
						if (!user) break;

						const priceId = subscription.items.data[0].price.id;
						const planName = Object.keys(PLAN_PRICES).find(
							(key) => PLAN_PRICES[key].priceId === priceId
						);

						if (planName) {
							user.activePlan = planName;
							user.expiresAt = new Date(subscription.current_period_end * 1000);
							await user.save();
						}
						break;
					}

					case "invoice.payment_failed": {
						const invoice = event.data.object;
						const user = await User.findOne({
							stripeCustomerId: invoice.customer,
						});
						if (!user) break;
						// Optional: notify user about failed payment
						console.log(
							`Payment failed for user ${user._id}, invoice ${invoice.id}`
						);
						break;
					}
				}
			} catch (err) {
				console.error("Webhook processing error:", err);
			}

			res.json({ received: true });
		}
	);
	return router;
};
