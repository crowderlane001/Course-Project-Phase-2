//This file contains the landing page for the application.

import { Package2 } from "lucide-react";
import React from "react";
import { Button } from "../ui/button";
import LoginButton from "./login-button";
import { useUserManager } from "@/hooks/use-usermanager";

const Landing: React.FC = () => {
  const { user } = useUserManager();

  return (
    <div className="inline-flex flex-col primary-bg gap-16 max-h-200 max-w-screen p-4 text-2xl font-extrabold rounded">
      <h1><span className="w-full">A better package registry for Acme. <Package2 className="h-20 w-20 black" /></span></h1>
      <p>
        With each package vetted for Acme Inc. projects, you'll never have to
        worry about a package working with your codebase again.
      </p>
      {user ? (
        <div></div>
      ) : (
        <LoginButton>
          <Button variant="link" className="text-lg px-0 bg-transparent focus:outline-none hover:outline-none">Sign in with company credentials today.</Button>
        </LoginButton >
      )}

    </div>
  );
};

export default Landing;
