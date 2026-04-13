import mongoose from "mongoose";
import User from "../models/User.js";
import Posts from "../models/Posts.js";     // renamed to match your model
import Questions from "../models/Questions.js"; // renamed to match your model

const { ObjectId } = mongoose.Types;

const PASSWORD_HASH =
  "$2b$10$CwTycUXWue0Thq9StjUM0uJ8dZJ9v1w5T4LZ6bH0N1pK0J6Z1Z0O6"; // password = 123

async function seed() {
  await mongoose.connect("mongodb+srv://as6569884:YfxJzWFGsmsa3PHJ@cluster0.6va35cp.mongodb.net/test", {
//   useNewUrlParser: true,
//   useUnifiedTopology: true
});

  console.log("🔥 Connected to DB");

  /* ================= USERS ================= */
  const users = [
    {
      _id: new ObjectId("696e1301a7c012a014f34001"),
      name: "P1",
      email: "as6569884+p1@gmail.com",
      password: PASSWORD_HASH,
      role: "pharmacist",
      avatar: "/default-avatar.png",
      isEmailVerified: true,
      isRoleVerified: true
    },
    {
      _id: new ObjectId("696e1301a7c012a014f34002"),
      name: "S1",
      email: "as6569884+s1@gmail.com",
      password: PASSWORD_HASH,
      role: "student",
      avatar: "/default-avatar.png",
      isEmailVerified: true,
      isRoleVerified: true
    },
    {
      _id: new ObjectId("696e1301a7c012a014f34003"),
      name: "D1",
      email: "as6569884+d1@gmail.com",
      password: PASSWORD_HASH,
      role: "doctor",
      avatar: "/default-avatar.png",
      isEmailVerified: true,
      isRoleVerified: true
    },
    {
      _id: new ObjectId("696e1301a7c012a014f34004"),
      name: "U1",
      email: "as6569884+u1@gmail.com",
      password: PASSWORD_HASH,
      role: "student",
      avatar: "/default-avatar.png",
      isEmailVerified: true,
      isRoleVerified: true
    },
    {
      _id: new ObjectId("696e1301a7c012a014f34005"),
      name: "Guest",
      role: "guest",
      avatar: "/default-avatar.png"
    }
  ];

  await User.deleteMany({});
  await User.insertMany(users);

  console.log("✅ Users seeded");

  /* ================= POSTS ================= */
  const posts = Array.from({ length: 5 }).map((_, i) => ({
    _id: new ObjectId(`6972184ffd5d5bb8d9ea51${40 + i}`),
    title: `Post ${i + 1}`,
    description: `This is post number ${i + 1}`,
    postedBy: users[i % 4]._id,
    postedByName: users[i % 4].name,
    visibility: "public",
    type: "post",
    likes: 0,
    dislikes: 0,
    shares: 0,
    flags: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  }));

  await Posts.deleteMany({});
  await Posts.insertMany(posts);

  console.log("✅ Posts seeded");

  /* ================= QUESTIONS ================= */
  const questions = Array.from({ length: 5 }).map((_, i) => ({
    _id: new ObjectId(`69724f05fd5d5bb8d9ea52${30 + i}`),
    title: `Question ${i + 1}`,
    description: `This is question number ${i + 1}`,
    postedBy: users[(i + 1) % 4]._id,
    postedByName: users[(i + 1) % 4].name,
    method: "user",
    type: "question",
    likes: 0,
    dislikes: 0,
    shares: 0,
    flags: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  }));

  await Questions.deleteMany({});
  await Questions.insertMany(questions);

  console.log("✅ Questions seeded");

  console.log("🎉 DATABASE SEEDED SUCCESSFULLY");
  process.exit(0);
}

seed().catch(err => {
  console.error("❌ Seed failed", err);
  process.exit(1);
});
