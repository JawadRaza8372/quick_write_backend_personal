const router = require("express").Router();
const ChatSession = require("../models/ChatSessionModal");
const { authenticateJWT } = require("../config/JwtHelpers");
router.get("/chat/:id", authenticateJWT, async (req, res) => {
	try {
		const { id } = req?.params;

		const session = await ChatSession.findById(id);
		return res.status(200).json({ messages: session?.messages ?? [] });
	} catch (err) {
		console.error(err);
		return res
			.status(500)
			.json({ message: err?.message ?? "Error clearing chat messages" });
	}
});
router.delete("/chat/:id", authenticateJWT, async (req, res) => {
	try {
		const { id } = req?.params;
		const session = await ChatSession.findById(id);
		if (!session) {
			return res.status(404).json({ message: "Chat session not found." });
		}
		session.messages = [];
		await session.save();
		return res.status(200).json({ message: "Chat messages cleared." });
	} catch (err) {
		console.error(err);
		return res
			.status(500)
			.json({ message: err?.message ?? "Error clearing chat messages" });
	}
});

module.exports = router;
