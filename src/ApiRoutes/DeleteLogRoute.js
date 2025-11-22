const { authenticateJWT } = require("../config/JwtHelpers");
const DeleteLogModal = require("../models/DeleteLogModal");
module.exports = (io) => {
	router.post("/addDeleteLog", authenticateJWT, async (req, res) => {
		try {
			const userId = req?.user?.id;
			if (!userId) {
				return res.status(400).json({ message: "User ID is required" });
			}

			await DeleteLogModal.create({
				userId,
				message: "SessionCleared",
			});
			io.emit("userDeleteLogsUpdated", userId);
			return res.status(200).json({ message: "Delete log saved" });
		} catch (err) {
			return res.status(500).json({ message: err.message });
		}
	});
	router.get("/getUserDeleteLogs", authenticateJWT, async (req, res) => {
		try {
			const userId = req?.user?.id;
			if (!userId) {
				return res.status(400).json({ message: "User ID is required" });
			}
			const logs = await DeleteLogModal.find({ userId })
				.select("_id userId message createdAt")
				.sort({ createdAt: -1 })
				.lean(); // latest first

			return res.status(200).json({
				message: "User delete logs fetched successfully",
				logs,
			});
		} catch (err) {
			return res.status(500).json({ message: err.message });
		}
	});
	return router;
};
