import {
  HashRouter as Router,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import "./App.css";
import Home from "./pages/Home";
import { Shell } from "./components/user-defined/shell";
import Packages from "./pages/Packages";
import React, { useEffect, useState } from "react";
import { useUserManager } from "./hooks/use-usermanager";
import RouteBlocker from "./pages/RouteBlocker";
import PackageDetails from "./pages/PackageDetails";
import NotFound from "./pages/404";
import Cookies from "js-cookie";
import User from "./models/user-model";
import SearchResults from "./pages/SearchResults";
import { Toaster } from "./components/ui/toaster";
import { toast } from "./hooks/use-toast";


function initialize(setUser: (user: User | null) => void, _setLoggedOut: (loggedOut: boolean) => void) {
  console.log("Initializing...");
  const cookie = Cookies.get("user");
  console.log("Cookie: ", cookie);
  if (!(cookie == null || cookie === "null" || cookie === "undefined")) {
    const user: User = JSON.parse(cookie);
    setUser(user);

    // const packagesApi = new API("https://med4k766h1.execute-api.us-east-1.amazonaws.com/dev");
    // packagesApi.post("/package/byRegEx", {"RegEx": ".*"})
    //   .catch((error) => {
    //     console.error("Error fetching data: ", error);
    //     Cookies.remove("user", { path: '/' });
    //     setUser(null);
    //     setLoggedOut(true);
    //   });
  }
}

function App() {
  const { user, setUser } = useUserManager();
  const [loggedOut, setLoggedOut] = useState<boolean>(false);

  useEffect(() => { }, [user, loggedOut]);
  useEffect(() => {
    initialize(setUser, setLoggedOut);
  }, []);

  if (loggedOut) {
    toast({ title: "Logged out", description: "You have been logged out. Please log in again." });
  }

  return (
    <Router>
      <Toaster />
      <AppContent />
    </Router>
  );
}

function AppContent() {
  const location = useLocation();
  const { user } = useUserManager();
  const homeRef = React.createRef<HTMLDivElement>();
  const packagesRef = React.createRef<HTMLDivElement>();
  const membersRef = React.createRef<HTMLDivElement>();
  const analyticsRef = React.createRef<HTMLDivElement>();

  const getNodeRef = (pathname: string) => {
    switch (pathname) {
      case "/":
        return homeRef;
      case "/packages":
        return packagesRef;
      case "/members":
        return membersRef;
      case "/analytics":
        return analyticsRef;
      default:
        return homeRef;
    }
  };

  return (
    <Shell>
      <div ref={getNodeRef(location.pathname)}>
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/packages" element={<Packages />} />
          <Route path="/packages/:id" element={user ? <PackageDetails /> : <RouteBlocker />} />
          <Route path="/packages/results/:id" element={user ? <PackageDetails isResult /> : <RouteBlocker />} />
          <Route path="/search/:query" element={user ? <SearchResults /> : <RouteBlocker />} />
          <Route path="/search/:query/results/:id" element={user ? <PackageDetails isResult /> : <RouteBlocker />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Shell>
  );
}

export default App;