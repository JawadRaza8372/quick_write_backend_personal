const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Schema = mongoose.Schema;
const userSchema = new Schema(
	{
		username: { type: String, required: true, minlength: 2 },
		email: { type: String, required: true, unique: true },
		activePlan: {
			type: String,
			default: "free",
			enum: ["free", "pro", "premium"],
		},
		expiresAt: { type: Date, required: true },
		password: String,
		//auth fields
		providerId: { type: String, default: "" },
		authProvider: {
			type: String,
			enum: ["local", "google", "facebook"],
			default: "local",
		},
		//new fields
		lastLoggedIn: {
			type: Date,
			default: Date.now,
		},
		chatHistoryDuration: {
			type: String,
			default: "30days",
			enum: ["0day", "30days"],
		},
		// Stripe fields for subscriptions
		stripeCustomerId: { type: String, default: "" },
		stripeSubscriptionId: { type: String, default: "" },
		paymentMethodId: { type: String, default: "" },
		cardBrand: { type: String, default: "" },
		cardLast4: { type: String, default: "" },
	},
	{ timestamps: true }
);

// Pre-save hook to hash password
userSchema.pre("save", async function (next) {
	if (this.isModified("password") && this.authProvider === "local") {
		this.password = await bcrypt.hash(this.password, 10);
	}
	next();
});
const User = mongoose.model("User", userSchema);
module.exports = User;
