const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		subscriptionId: { type: String, default: "" },
		invoiceId: { type: String, default: "" },
		paymentIntentId: { type: String, default: "" },
		amount: { type: Number, required: true },
		currency: { type: String, default: "usd" },
		paymentMethod: { type: String, default: "card" },
		cardBrand: { type: String, default: "" },
		cardLast4: { type: String, default: "" },
		status: {
			type: String,
			enum: [
				"succeeded",
				"processing",
				"requires_action",
				"requires_payment_method",
				"canceled",
				"pending",
			],
			required: true,
		},
		planName: { type: String, required: true },
		receiptUrl: { type: String, default: "" },
	},
	{ timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
