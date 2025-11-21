const router = require("express").Router();
const User = require("../models/UserModal");
const axios = require("axios");
const ChatSessionModal = require("../models/ChatSessionModal");
const bcrypt = require("bcrypt");
const { sendPasswordResetEmail } = require("../config/sendEmail");
const {
	generateAccessToken,
	generateRefreshToken,
	authenticateJWT,
	getCurrentPlanExpiry,
} = require("../config/JwtHelpers");
const jwt = require("jsonwebtoken");
module.exports = (io) => {
	function generateRandom4DigitNumber() {
		return Math.floor(100000 + Math.random() * 900000);
	}
	router.get("/google", (req, res) => {
		const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&response_type=code&scope=email%20profile`;
		res.redirect(googleAuthUrl);
	});
	router.get("/google/callback", async (req, res) => {
		const code = req?.query?.code;

		if (!code) {
			return res
				.status(400)
				.json({ message: "Authorization code is required." });
		}
		try {
			// Exchange code for tokens
			const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					code,
					client_id: process.env.GOOGLE_CLIENT_ID,
					client_secret: process.env.GOOGLE_CLIENT_SECRET,
					redirect_uri: process.env.GOOGLE_REDIRECT_URI,
					grant_type: "authorization_code",
				}),
			});

			const tokens = await tokenResponse.json();
			console.log("check tokens", tokens);
			if (!tokens.access_token) {
				return res
					.status(400)
					.json({ message: "Failed to get access token from Google." });
			}

			// Get user info from Google
			const userInfoRes = await fetch(
				"https://www.googleapis.com/oauth2/v2/userinfo",
				{
					headers: { Authorization: `Bearer ${tokens.access_token}` },
				}
			);

			const googleUser = await userInfoRes.json();
			console.log("checking user data", googleUser);
			if (!googleUser?.email) {
				return res
					.status(400)
					.json({ message: "Failed to get user info from Google." });
			}
			console.log("checking if user exists");
			// Check if user exists
			let user = await User.findOne({
				$or: [{ email: googleUser?.email }, { providerId: googleUser?.id }],
			});

			if (user) {
				if (user?.authProvider !== "google") {
					return res.status(400).json({
						message: `This email is already registered using ${user?.authProvider.toUpperCase()} login. Please use that method instead.`,
					});
				} else {
					console.log("user exists, proceeding to login");
				}
			} else {
				const expiryDate = getCurrentPlanExpiry("free");
				user = new User({
					username: googleUser?.email.split("@")[0] + Date.now(),
					email: googleUser.email,
					password: null,
					authProvider: "google",
					providerId: googleUser?.id,
					expiresAt: expiryDate,
				});
				await user.save();
				console.log("user data saved");
			}
			const fetchChatRoom = await ChatSessionModal.findOne({
				userId: user._id,
			});
			const { _id, __v, password, providerId, ...rest } = user?._doc;

			const userObj = {
				tokens: {
					accessToken: generateAccessToken({
						id: _id.toString(),
					}),
					refreshToken: generateRefreshToken({
						id: _id.toString(),
					}),
				},
				chatRoomId: fetchChatRoom?._id,
				...rest,
			};
			console.log("user object created");

			const frontendUrl = `com.quickwrite://login-success?user=${encodeURIComponent(
				JSON.stringify(userObj)
			)}`;
			console.log("sedning redirect");

			return res.redirect(frontendUrl);
		} catch (err) {
			return res.status(500).json({
				message: err?.message ? err.message : "Internal server error.",
			});
		}
	});
	router.get("/facebook", (req, res) => {
		const fbAuthUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${process.env.FACEBOOK_CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}&scope=email,public_profile`;
		res.redirect(fbAuthUrl);
	});
	router.get("/facebook/callback", async (req, res) => {
		const code = req?.query?.code;

		if (!code) {
			return res
				.status(400)
				.json({ message: "Authorization code is required." });
		}
		try {
			const tokenResponse = await axios.get(
				`https://graph.facebook.com/v20.0/oauth/access_token`,
				{
					params: {
						client_id: process.env.FACEBOOK_CLIENT_ID,
						client_secret: process.env.FACEBOOK_CLIENT_SECRET,
						redirect_uri: process.env.REDIRECT_URI,
						code,
					},
				}
			);

			const accessToken = tokenResponse?.data?.access_token;
			console.log("check tokens", accessToken);
			if (!accessToken) {
				return res.status(400).json({
					message: "Failed to get access token from Facebook.",
				});
			}

			// Get user info from Facebook

			const userInfoRes = await axios.get(
				`https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`
			);
			const formattedData = userInfoRes?.data;
			console.log("checking user data", formattedData);
			if (!formattedData?.email) {
				return res
					.status(400)
					.json({ message: "Failed to get user info from Facebook." });
			}
			console.log("checking if user exists");
			// Check if user exists
			let user = await User.findOne({
				$or: [
					{ email: formattedData?.email },
					{ providerId: formattedData?.id },
				],
			});
			if (user) {
				if (user?.authProvider !== "facebook") {
					return res.status(400).json({
						message: `This email is already registered using ${user?.authProvider.toUpperCase()} login. Please use that method instead.`,
					});
				} else {
					console.log("user exists, proceeding to login");
				}
			} else {
				const expiryDate = getCurrentPlanExpiry("free");
				user = new User({
					username: formattedData?.email.split("@")[0] + Date.now(),
					email: formattedData.email,
					password: null,
					authProvider: "facebook",
					providerId: formattedData?.id,
					expiresAt: expiryDate,
				});
				await user.save();
				console.log("user data saved");
			}
			const fetchChatRoom = await ChatSessionModal.findOne({
				userId: user._id,
			});
			const { _id, __v, password, providerId, ...rest } = user?._doc;

			const userObj = {
				tokens: {
					accessToken: generateAccessToken({
						id: _id.toString(),
					}),
					refreshToken: generateRefreshToken({
						id: _id.toString(),
					}),
				},
				chatRoomId: fetchChatRoom?._id,
				...rest,
			};
			console.log("user object created");

			const frontendUrl = `com.quickwrite://login-success?user=${encodeURIComponent(
				JSON.stringify(userObj)
			)}`;
			console.log("sedning redirect");

			return res.redirect(frontendUrl);
		} catch (err) {
			return res.status(500).json({
				message: err?.message ? err.message : "Internal server error.",
			});
		}
	});
	router.post("/signup", async (req, res) => {
		try {
			const { username, email, password } = req?.body;

			if (!email || !password || !username) {
				return res
					.status(400)
					.json({ message: "Username, Email and password are required." });
			}
			const expiryDate = getCurrentPlanExpiry("free");
			const user = new User({
				username,
				email,
				password,
				authProvider: "local",
				expiresAt: expiryDate,
			});
			await user.save();
			return res.status(201).json({ message: "User registered successfully" });
		} catch (err) {
			if (err.name === "ValidationError") {
				res.status(400).json({ message: err.message });
			} else {
				res.status(500).json({ message: err.message });
			}
		}
	});
	router.post("/login", async (req, res) => {
		const { email, userpassword } = req?.body;

		if (!email || !userpassword) {
			return res
				.status(400)
				.json({ message: "Email and password are required." });
		}

		try {
			const user = await User.findOne({ email });
			if (!user) {
				return res
					.status(400)
					.json({ message: "No account associated with this email." });
			}

			const isMatch = await bcrypt.compare(userpassword, user.password);
			if (!isMatch) {
				return res.status(400).json({ message: "Incorrect password." });
			}
			const fetchChatRoom = await ChatSessionModal.findOne({
				userId: user._id,
			});
			const { _id, password, providerId, __v, ...rest } = user?._doc;

			return res.status(201).json({
				user: {
					tokens: {
						accessToken: generateAccessToken({
							id: _id.toString(),
						}),
						refreshToken: generateRefreshToken({
							id: _id.toString(),
						}),
					},
					chatRoomId: fetchChatRoom?._id,
					...rest,
				},
			});
		} catch (err) {
			return res.status(500).json({
				message: err?.message ? err?.message : "Internal server error.",
			});
		}
	});
	router.post("/renew-token", async (req, res) => {
		const { refreshToken } = req?.body;

		if (!refreshToken) {
			return res.status(400).json({ message: "Refresh token is required" });
		}

		try {
			const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
			const newAccessToken = generateAccessToken({
				id: decoded?.id,
			});
			const newRefreshToken = generateRefreshToken({
				id: decoded?.id,
			});

			return res.status(200).json({
				accessToken: newAccessToken,
				refreshToken: newRefreshToken,
			});
		} catch (error) {
			return res.status(403).json({
				message: error?.message || "Invalid or expired refresh token",
				error: error?.message || "Invalid or expired refresh token",
			});
		}
	});

	router.get("/userProfile", authenticateJWT, async (req, res) => {
		try {
			const { id } = req?.user;

			const user = await User.findById(id);
			if (!user) {
				return res
					.status(400)
					.json({ message: "No account associated with this email." });
			}

			const { _id, password, providerId, ...rest } = user?._doc;
			const fetchChatRoom = await ChatSessionModal.findOne({
				userId: user._id,
			});
			return res.status(201).json({
				user: {
					tokens: {
						accessToken: generateAccessToken({
							id: _id.toString(),
						}),
						refreshToken: generateRefreshToken({
							id: _id.toString(),
						}),
					},
					chatRoomId: fetchChatRoom?._id,
					...rest,
				},
			});
		} catch (err) {
			return res.status(500).json({
				message: err?.message ? err?.message : "Internal server error.",
			});
		}
	});
	router.put("/edit-profile", authenticateJWT, async (req, res) => {
		try {
			const { id } = req?.user;
			const { username } = req?.body;
			await User.findByIdAndUpdate(id, {
				username,
			});
			const user = await User.findById(id);

			if (!user) {
				return res.status(400).json({ message: "account not found" });
			}
			const { _id, password, providerId, ...rest } = user?._doc;
			io.emit("userProfileUpdated", id);
			return res.status(201).json({
				user: {
					...rest,
				},
			});
		} catch (err) {
			return res.status(500).json({ message: err.message });
		}
	});
	router.post("/forgot-password", async (req, res) => {
		try {
			const { email } = req?.body;
			const user = await User.findOne({ email });

			if (!user) {
				return res
					.status(400)
					.json({ message: "No user found with that email." });
			}
			if (user.authProvider !== "local") {
				return res.status(400).json({
					message:
						"Forgot password is not available for social login accounts.",
				});
			}
			const randomCode = generateRandom4DigitNumber();
			await sendPasswordResetEmail(email, "Account Recovery OTP", randomCode);
			return res
				.status(201)
				.json({ message: "Password reset email sent.", code: randomCode });
		} catch (err) {
			res.status(500).json({
				message: err.message,
			});
		}
	});
	router.post("/verify-otp", async (req, res) => {
		try {
			const { email, enteredOtp, dbOtp } = req?.body;

			if (enteredOtp?.length <= 0) {
				return res.status(400).json({ message: "Otp is required" });
			}
			if (`${enteredOtp}` !== `${dbOtp}`) {
				return res.status(400).json({ message: "Wrong Otp." });
			}
			const user = await User.findOne({ email: email });

			if (!user) {
				return res.status(400).json({ message: "account not found" });
			}
			return res.status(201).json({
				message: "Otp confirmed.",
				tokens: {
					accessToken: generateAccessToken({
						id: user?._id.toString(),
					}),
				},
			});
		} catch (err) {
			res.status(500).json({ message: err.message });
		}
	});
	router.post("/reset-password", authenticateJWT, async (req, res) => {
		try {
			const { id } = req?.user;
			const { newPassword } = req?.body;
			const user = await User.findById(id);

			if (!user) {
				return res.status(400).json({ message: "account not found" });
			}
			if (user.authProvider !== "local") {
				return res.status(400).json({
					message:
						"Forgot password is not available for social login accounts.",
				});
			}
			user.password = newPassword;
			await user.save();

			res.status(201).json({ message: "Password has been reset." });
		} catch (err) {
			res.status(500).json({ message: err.message });
		}
	});
	router.delete("/deleteUserAccount", authenticateJWT, async (req, res) => {
		try {
			const { id } = req?.user;
			const userRes = await User.findById(id);
			if (!userRes) {
				return res.status(404).json({
					message: "Account not found.",
				});
			}
			await ChatSessionModal.findOneAndDelete({ userId: id });
			await User.findByIdAndDelete(id);
			return res.status(200).json({ message: "Account deleted successfully." });
		} catch (err) {
			return res.status(500).json({ message: err.message });
		}
	});
	return router;
};
