import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import sendEmail from "../utils/SendEmail.js";

console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASS length:", process.env.EMAIL_PASS?.length);

const runTest = async () => {
  try {
    await sendEmail({
      to: "your_personal_email@gmail.com",
      subject: "HealthHive Test Email",
      html: "<h2>Email system working ✅</h2>",
    });

    console.log("✅ Test email sent");
  } catch (err) {
    console.error("❌ Test email failed:", err.message);
  }
};

runTest();
