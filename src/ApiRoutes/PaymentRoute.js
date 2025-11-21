const router = require("express").Router();
const Stripe = require("stripe");
const PaymentModal = require("../models/PaymentModal");
const {
	authenticateJWT,
	getCurrentPlanExpiry,
} = require("../config/JwtHelpers");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
	apiVersion: "2025-09-30.clover",
});
const User = require("../models/UserModal");
const PLAN_PRICES = {
	premium: 9500, // $95
	pro: 799, // $7.99
};
module.exports = (io) => {
	router.post("/create-payment-intent", authenticateJWT, async (req, res) => {
		try {
			console.log("route hit");
			const userId = req?.user?.id;
			const { planName } = req?.body;
			const normalizedPlan = planName.toLowerCase().trim();
			console.log("data", planName, userId);

			const amount = PLAN_PRICES[normalizedPlan];

			if (!amount) {
				return res.status(400).json({
					message: "Invalid plan name. Valid plans are: premium, pro.",
				});
			}
			console.log("data", planName, amount);

			const paymentIntent = await stripe.paymentIntents.create({
				amount,
				currency: process.env.STRIPE_CURRENCY,
				payment_method_types: ["card"],
				metadata: { userId, planName: normalizedPlan },
			});

			console.log("cleint secret sended");

			return res.status(200).json({
				paymentIntent,
			});
		} catch (error) {
			console.error(error);
			return res.status(500).json({
				message: error?.message ? error.message : "Internal server error.",
			});
		}
	});
	router.get("/payments", authenticateJWT, async (req, res) => {
		const userId = req?.user?.id;
		const allPayments = await PaymentModal.find({ userId: userId });
		return res.status(200).json({
			payments: allPayments
				? allPayments?.map((dat) => {
						const { _id, __v, ...rest } = dat?._doc;
						return { id: _id, ...rest };
				  })
				: [],
		});
	});
	router.post("/payment-success", authenticateJWT, async (req, res) => {
		try {
			const userId = req?.user?.id;
			const { paymentIntentId } = req?.body;

			// ✅ Verify Payment on Stripe (optional but recommended)
			const paymentIntent = await stripe.paymentIntents.retrieve(
				paymentIntentId,
				{
					expand: ["payment_method"],
				}
			);
			if (paymentIntent.status !== "succeeded") {
				return res.status(400).json({ message: "Payment not completed" });
			}

			// ✅ Read plan name from metadata (this is what you need)
			const activePlan = paymentIntent.metadata?.planName;
			const paymentMethodType = paymentIntent?.payment_method?.type;
			if (!activePlan) {
				return res.status(400).json({
					message: "Plan information missing in payment metadata.",
				});
			}

			const expiryDate = getCurrentPlanExpiry(activePlan);

			await User.findByIdAndUpdate(
				userId,
				{
					activePlan,
					expiresAt: expiryDate,
				},
				{ new: true }
			);
			await PaymentModal.create({
				userId,
				paymentIntentId,
				amount: paymentIntent.amount / 100, // convert from cents to USD
				currency: paymentIntent.currency,
				status: paymentIntent.status,
				planName: activePlan,
				paymentMethod: paymentMethodType,
				receiptUrl: paymentIntent.charges?.data?.[0]?.receipt_url ?? null,
			});
			io.emit("userProfileUpdated", userId);
			io.emit("userPaymentUpdated", userId);
			return res.status(200).json({
				message: `${activePlan} plan activated successfully.`,
			});
		} catch (error) {
			console.error(error);
			return res.status(500).json({
				message: error?.message ? error.message : "Internal server error.",
			});
		}
	});
	return router;
};
