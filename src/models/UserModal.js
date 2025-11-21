const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Schema = mongoose.Schema;
const ChatSessionModal = require("./ChatSessionModal");
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
userSchema.post("save", async function (doc, next) {
	try {
		// Check if a chat session already exists (avoid duplicates)
		const existing = await ChatSessionModal.findOne({ userId: doc?._id });
		if (!existing) {
			await ChatSessionModal.create({
				userId: doc?._id,
				messages: [],
			});
			console.log("Chat session created for user:", doc?._id);
		}
		next();
	} catch (err) {
		console.error("Error creating chat session:", err);
		next(err);
	}
});
const User = mongoose.model("User", userSchema);
module.exports = User;
