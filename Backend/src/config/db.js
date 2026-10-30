import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("[db] MONGODB_URI is not set -- check your Backend/.env file");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log(`[db] connected to MongoDB (${mongoose.connection.name})`);
  } catch (err) {
    console.error("[db] connection failed:", err.message);
    process.exit(1);
  }
}
