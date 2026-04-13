import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User";
// adjust path if needed

const MONGO_URI = "mongodb://localhost:5000/test"; // update your DB
const usersToCreate = 20;

const roles = ["pharmacist", "doctor", "student", "user"];

async function createUsers() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const users = [];

    for (let i = 1; i <= usersToCreate; i++) {
      const role = roles[Math.floor(Math.random() * roles.length)];
      const hashedPassword = await bcrypt.hash("123", 10);

      users.push({
        name: `User ${i}`,
        email: `as6569884+${i}@gmail.com`,
        password: hashedPassword,
        role,
        isEmailVerified: true,  // can login directly
        isRoleVerified: false,
        avatar: "/default-avatar.png",
        bio: "",
        // no shop field
      });
    }

    // Insert into DB
    await User.insertMany(users);
    console.log(`${usersToCreate} users created successfully!`);

    mongoose.disconnect();
  } catch (err) {
    console.error("Error creating users:", err);
  }
}

createUsers();
