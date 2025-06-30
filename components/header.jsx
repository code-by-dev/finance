

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button"; // ✅ shadcn/ui button
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { PenBox, LayoutDashboard } from "lucide-react";


const Header = () => {

  return (
    <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
      {/* Logo */}
      <Link href="/">
        <Image
          src="/logo.png"
          alt="Welth Logo"
          width={200}
          height={60}
          className="h-12 w-auto object-contain"
        />
      </Link>

      {/* Action Buttons */}
      <div className="flex items-center space-x-4">
        <SignedIn>
          <Link href="/dashboard">
            <Button variant="outline">
              <LayoutDashboard size={18} />
              <span className="hidden md:inline ml-2">Dashboard</span>
            </Button>
          </Link>

          <Link href="/transaction/create">
            <Button>
              <PenBox size={18} />
              <span className="hidden md:inline ml-2">Add Transaction</span>
            </Button>
          </Link>
        </SignedIn>

        <SignedOut>
          <SignInButton forceRedirectUrl="/dashboard">
            <Button variant="outline">Login</Button>
          </SignInButton>
        </SignedOut>

        <SignedIn>
          <UserButton
            appearance={{
              elements: {
                avatarBox: "w-10 h-10",
              },
            }}
          />
        </SignedIn>
      </div>
    </nav>
  );
};

export default Header;
