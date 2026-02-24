import { currentUser } from "@clerk/nextjs/server";
import { connectDB } from "./mongodb";
import { User } from "@/models";
import { toPlain } from "./db";

export const checkUser = async () => {
  let user = null;
  try {
    user = await currentUser();
  } catch (error) {
    // If Clerk isn't available/misconfigured, don't crash the whole app shell.
    console.log(error?.message ?? error);
    return null;
  }

  if (!user) return null;

  try {
    await connectDB();

    const loggedInUser = await User.findOne({
      clerkUserId: user.id,
    });

    if (loggedInUser) return toPlain(loggedInUser);

    const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();

    const newUser = await User.create({
      clerkUserId: user.id,
      name: name || undefined,
      imageUrl: user.imageUrl,
      email: user.emailAddresses?.[0]?.emailAddress,
    });

    return toPlain(newUser);
  } catch (error) {
    console.log(error?.message ?? error);
  }
};
