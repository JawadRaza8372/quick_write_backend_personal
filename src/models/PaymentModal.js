const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		paymentIntentId: {
			type: String,
			required: true,
			unique: true,
		},
		amount: {
			type: Number,
			required: true,
		},
		currency: {
			type: String,
			default: "usd",
		},
		paymentMethod: {
			type: String,
			dafault: "card",
		},
		status: {
			type: String,
			enum: [
				"succeeded",
				"processing",
				"requires_action",
				"requires_payment_method",
				"canceled",
			],
			required: true,
		},
		planName: {
			type: String,
			required: true,
		},
		receiptUrl: {
			type: String,
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
