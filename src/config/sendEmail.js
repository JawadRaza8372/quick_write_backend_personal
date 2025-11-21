const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendPasswordResetEmail = async (email, subject, token) => {
	const mailOptions = {
		from: "info@quickwriteai.ai",
		to: email,
		subject,
		html: `
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 0; background-color: #f8f8f8;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background: #ffffff; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.05); overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #8C40FF; padding: 20px; text-align: center; color: #ffffff;">
              <h2 style="margin: 0; font-family: Arial, sans-serif;">Quick Write Ai</h2>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 30px; text-align: center; font-family: Arial, sans-serif;">
              <p style="font-size: 16px; color: #333;">Greetings!</p>
              <p style="font-size: 16px; color: #555;">Use the OTP below to recover your account.</p>
              <p style="font-size: 32px; color: #8C40FF; font-weight: bold; margin: 30px 0;">${token}</p>
              <p style="font-size: 14px; color: #999;">If you didn’t request this, you can safely ignore this email.</p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #fefefe; border-top:1px solid #f2f2f2; text-align: center; padding: 15px; font-size: 12px; color: #777; font-family: Arial, sans-serif;">
              © 2025 Quick Write Ai. All rights reserved.
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
`,
	};

	return await sgMail.send(mailOptions);
};
module.exports = {
	sendPasswordResetEmail,
};
