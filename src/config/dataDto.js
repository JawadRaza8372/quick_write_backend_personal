const { generateAccessToken, generateRefreshToken } = require("./JwtHelpers");

const userFormattedDataDto = (user) => {
	const {
		_id,
		password,
		providerId,
		lastLoggedIn,
		stripeCustomerId,
		stripeSubscriptionId,
		paymentMethodId,
		cardBrand,
		cardLast4,
		__v,
		...rest
	} = user;
	return {
		tokens: {
			accessToken: generateAccessToken({
				id: _id.toString(),
			}),
			refreshToken: generateRefreshToken({
				id: _id.toString(),
			}),
		},
		...rest,
	};
};
const userFormattedDataDtoSimple = (user) => {
	const {
		_id,
		password,
		providerId,
		lastLoggedIn,
		stripeCustomerId,
		stripeSubscriptionId,
		paymentMethodId,
		cardBrand,
		cardLast4,
		__v,
		...rest
	} = user;
	return {
		...rest,
	};
};
module.exports = {
	userFormattedDataDto,
	userFormattedDataDtoSimple,
};
