const mongoose = require("mongoose");
const DeleteLogSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		message: {
			type: String,
			default: "SessionCleared",
			enum: ["SessionCleared"],
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.model("DeleteLog", DeleteLogSchema);
