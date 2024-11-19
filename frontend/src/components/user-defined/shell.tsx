import { NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  LineChart,
  Menu,
  Package,
  Package2,
  Search,
  Users,
} from "lucide-react";

import { useUserManager } from "@/hooks/use-usermanager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

import Logo from "./logo";
import LoginButton from "./login-button";
import LogOutButton from "./log-out";
import React from "react";

interface ShellProps {
  children: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
  const { user } = useUserManager();
  const [input, setInput] = React.useState("");
  const nav = useNavigate();

  const handleSearch = () => {
    nav(`/search/${input}`);
  }

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[200px_1fr]">
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2" style={{ maxWidth: '200px !important' }}>
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Logo />
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-3">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-2 py-2 transition-all ${isActive ? 'text-primary bg-muted' : 'text-muted-foreground hover:text-primary'
                  }`
                }
              >
                <Home className="h-6 w-6" />
                Home
              </NavLink>
              <NavLink
                to="/packages"
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-2 py-2 transition-all ${isActive ? 'tertiary bg-muted' : 'text-muted-foreground hover:text-primary'
                  }`
                }
              >
                <Package className="h-6 w-6" />
                Packages
              </NavLink>
              <NavLink
                to="/members"
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-2 py-2 transition-all ${isActive ? 'text-primary bg-muted' : 'text-muted-foreground hover:text-primary'
                  }`
                }
              >
                <Users className="h-6 w-6" />
                Members List
              </NavLink>
              <NavLink
                to="/analytics"
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-2 py-2 transition-all ${isActive ? 'text-primary bg-muted' : 'text-muted-foreground hover:text-primary'
                  }`
                }
              >
                <LineChart className="h-6 w-6" />
                Analytics
              </NavLink>
            </nav>
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="md:hidden p-0 m-0"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col justify-between">
              <nav className="grid gap-2 text-lg font-medium">

                <Package2 className="h-6 w-6" />
                <span className="sr-only">Acme Inc</span>

                <SheetTrigger asChild>
                  <NavLink
                    to="/"
                    className={({ isActive }) =>
                      `mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 ${isActive ? 'text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground'
                      }`
                    }
                  >
                    <Home className="h-5 w-5" />
                    Home
                  </NavLink>
                </SheetTrigger>
                <SheetTrigger asChild>
                  <NavLink
                    to="/packages"
                    className={({ isActive }) =>
                      `mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 ${isActive ? 'text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground'
                      }`
                    }
                  >
                    <Package className="h-5 w-5" />
                    Packages
                  </NavLink>
                </SheetTrigger>
                <SheetTrigger asChild>
                  <NavLink
                    to="/members"
                    className={({ isActive }) =>
                      `mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 ${isActive ? 'text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground'
                      }`
                    }
                  >
                    <Users className="h-5 w-5" />
                    Members List
                  </NavLink>
                </SheetTrigger>
                <SheetTrigger asChild>
                  <NavLink
                    to="/analytics"
                    className={({ isActive }) =>
                      `mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 ${isActive ? 'text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground'
                      }`
                    }
                  >
                    <LineChart className="h-5 w-5" />
                    Analytics
                  </NavLink>
                </SheetTrigger>
              </nav>
              <div className="h-16 w-full drop-shadow-lg rounded-md">
                {user ? <LogOutButton /> :
                  <LoginButton>
                    <Button className="primary-bg w-full h-16">Login</Button>
                  </LoginButton>}
              </div>
            </SheetContent>
          </Sheet>
          <div className="w-full flex-1">
            <form>
              <div className="relative flex flex-row gap-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  type="search"
                  placeholder="Search products..."
                  className="w-full appearance-none bg-background pl-8 shadow-none md:w-2/3 lg:w-1/3"
                />
                {input && <Button variant="outline" onClick={() => handleSearch()}>Search</Button>}
              </div>
            </form>
          </div>
          <div className="flex flex-row gap-5 mobile:hidden">
            {user ? <LogOutButton /> :
              <LoginButton>
                <Button className="primary-bg">Login</Button>
              </LoginButton>}
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 relative w-[100%] items-center">
          <div className="w-[100%] max-w-[900px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}