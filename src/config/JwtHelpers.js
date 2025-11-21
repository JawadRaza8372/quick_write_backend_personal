const jwt = require("jsonwebtoken");
require("dotenv").config();
console.log(process.env.API_STATUS, typeof process.env.API_STATUS);
const generateAccessToken = (payload) => {
	return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "15m" }); // Access token expires in 15 minutes
};

const generateRefreshToken = (payload) => {
	return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: "1d" }); // Refresh token expires in 7 days
};
const authenticateJWT = (req, res, next) => {
	const authHeader = req.headers.authorization;

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return res
			.status(401)
			.json({ message: "Access token is missing or invalid" });
	}

	const token = authHeader.split(" ")[1];

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		req.user = decoded; // Attach decoded token payload to request object
		next();
	} catch (error) {
		return res.status(401).json({ message: "Token is invalid or expired" });
	}
};
const getCurrentPlanExpiry = (planName) => {
	let expiryDuration;
	if (planName === "pro" && process.env.API_STATUS === "production") {
		expiryDuration = 30 * 24 * 60 * 60 * 1000; // 1 month
	} else if (
		planName === "premium" &&
		process.env.API_STATUS === "production"
	) {
		expiryDuration = 365 * 24 * 60 * 60 * 1000; // 1 year
	} else if (planName === "free" && process.env.API_STATUS === "production") {
		expiryDuration = 7 * 24 * 60 * 60 * 1000; // 7days
	} else if (planName === "pro" && process.env.API_STATUS === "testing") {
		expiryDuration = 2 * 60 * 60 * 1000; // 2hours
	} else if (planName === "premium" && process.env.API_STATUS === "testing") {
		expiryDuration = 4 * 60 * 60 * 1000; // 4hours
	} else if (planName === "free" && process.env.API_STATUS === "testing") {
		expiryDuration = 0.5 * 60 * 60 * 1000; // half hour
	} else {
		throw new Error("Unknown plan type.");
	}
	const expreDate = new Date(Date.now() + expiryDuration);
	return expreDate;
};
module.exports = {
	generateAccessToken,
	generateRefreshToken,
	authenticateJWT,
	getCurrentPlanExpiry,
};
