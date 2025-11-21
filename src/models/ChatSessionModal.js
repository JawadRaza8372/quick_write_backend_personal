const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
	role: { type: String, enum: ["user", "assistant"], required: true },
	content: { type: String, required: true },
	createdAt: { type: Date, default: Date.now },
});

const chatSessionSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			unique: true,
			required: true,
		},
		messages: [messageSchema],
	},
	{ timestamps: true }
);

module.exports = mongoose.model("ChatSession", chatSessionSchema);
