const express = require("express");
const http = require("http");
require("./src/db/connecton");
const cors = require("cors");
const socketIo = require("socket.io");
const allowedOrigins = ["http://localhost:4000"];
const bodyParser = require("body-parser");
const { openAiClient } = require("./src/config/groqClient");
const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
	cors: {
		origin: allowedOrigins,
		methods: ["GET", "POST", "PUT", "UPDATE", "DELETE", "PATCH"],
		credentials: true,
	},
});
app.use(express.static(path.join(__dirname, "public")));
app.use(
	cors({
		origin: function (origin, callback) {
			if (!origin) return callback(null, true);
			if (allowedOrigins.includes(origin)) {
				return callback(null, true);
			} else {
				return callback(new Error("Not allowed by CORS"));
			}
		},
	})
);
const authRoutes = require("./src/ApiRoutes/AuthRoute")(io);
const paymentRoutes = require("./src/ApiRoutes/PaymentRoute")(io);
const deleteLogRoutes = require("./src/ApiRoutes/DeleteLogRoute")(io);
app.use(bodyParser.json({ limit: "80mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "80mb" }));

// Routes
app.use("/auth", authRoutes);
app.use("/delete-log", deleteLogRoutes);
app.use("/subscription", paymentRoutes);
app.get("/", (req, res) => {
	res.status(200).send("server is live. :) ");
});
io.on("connection", (socket) => {
	console.log("A user connected");

	// Join a specific room
	socket.on("joinRoom", (roomId) => {
		socket.join(roomId);
		console.log(`User joined room: ${roomId}`);
	});
	socket.on("leaveRoom", (roomId) => {
		socket.leave(roomId);
		console.log(`User leave room: ${roomId}`);
	});
	// Listen for sending messages
	socket.on("sendMessage", async (message) => {
		try {
			if (message?.chatRoomId) {
				const messageChatRoomId = message?.chatRoomId;
				const messageContent = message?.content;
				const userMsg = {
					_id: new mongoose.Types.ObjectId(),
					role: "user",
					content: messageContent,
					createdAt: Date.now(),
				};
				// 2️⃣ Get previous history from client or empty array
				const chatHistory = Array.isArray(message?.history)
					? [...message.history]
					: [];

				// 3️⃣ Add the new user message to history
				chatHistory.push(userMsg);
				const messagesForAI = chatHistory.map((m) => ({
					role: m.role,
					content: m.content,
				}));

				// 2️⃣ Get AI reply
				const completion = await openAiClient.chat.completions.create({
					model: "gpt-4o-mini",
					messages: messagesForAI,
				});

				const aiReply = completion.choices[0].message.content;
				const aiMsg = {
					_id: new mongoose.Types.ObjectId(),
					role: "assistant",
					content: aiReply,
					createdAt: Date.now(),
				};
				chatHistory.push(aiMsg);

				// 3️⃣ Emit AI reply to frontend
				io.to(messageChatRoomId).emit("newMessage", chatHistory);
			}
		} catch (err) {
			console.error("Error sending message:", err);
		}
	});

	// Handle disconnection
	socket.on("disconnect", () => {
		console.log("User disconnected");
	});
});
// Start the server
const port = process.env.PORT || 4000;
server.listen(port, () => {
	console.log(`Server started at http://localhost:${port}`);
});
