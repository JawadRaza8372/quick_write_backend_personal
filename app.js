const express = require("express");
const http = require("http");
require("./src/db/connecton");
const cors = require("cors");
const socketIo = require("socket.io");
const allowedOrigins = ["http://localhost:4000"];
const bodyParser = require("body-parser");
const chatRoutes = require("./src/ApiRoutes/ChatRoute");
const ChatSessionModal = require("./src/models/ChatSessionModal");
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

app.use(bodyParser.json({ limit: "80mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "80mb" }));

// Routes
app.use("/auth", authRoutes);
app.use("/ai-chat", chatRoutes);
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
				let session = await ChatSessionModal.findById(messageChatRoomId);
				// 2. Create message manually (so we have _id before save)
				const userMsg = {
					_id: new mongoose.Types.ObjectId(),
					role: "user",
					content: message.content,
					createdAt: Date.now(),
				};

				// 3. Save user message
				session.messages.push(userMsg);

				io.to(messageChatRoomId).emit("newMessage", userMsg);
				const chatMessages = [...session.messages, userMsg].map((m) => ({
					role: m.role,
					content: m.content,
				}));

				// 5. Get AI reply from Groq
				const completion = await openAiClient.chat.completions.create({
					model: "gpt-4o-mini",
					messages: chatMessages,
				});

				const aiReply = completion.choices[0].message.content;
				const aiMsg = {
					_id: new mongoose.Types.ObjectId(),
					role: "assistant",
					content: aiReply,
					createdAt: Date.now(),
				};

				// 6️⃣ Emit AI message to frontend
				io.to(messageChatRoomId).emit("newMessage", aiMsg);

				// 7️⃣ Save both messages in one DB call
				await ChatSessionModal.findByIdAndUpdate(
					messageChatRoomId,
					{ $push: { messages: { $each: [userMsg, aiMsg] } } },
					{ upsert: true }
				);
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
