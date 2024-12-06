import {
  HashRouter as Router,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import "./App.css";
import Home from "./pages/Home";
import { Shell } from "./components/user-defined/shell";
import { TransitionGroup, CSSTransition } from "react-transition-group";
import Packages from "./pages/Packages";
import React, { useEffect } from "react";
import { useUserManager } from "./hooks/use-usermanager";
import RouteBlocker from "./pages/RouteBlocker";
import PackageDetails from "./pages/PackageDetails";
import NotFound from "./pages/404";
import Cookies from "js-cookie";
import User from "./models/user-model";
import SearchResults from "./pages/SearchResults";
import API from "./api/api";
import { Toaster } from "./components/ui/toaster";


function initialize(setUser: (user: User | null) => void) {
  console.log("Initializing...");
  const cookie = Cookies.get("user");
  if (cookie) {
    const user: User = JSON.parse(cookie);
    setUser(user);

    const packagesApi = new API("https://med4k766h1.execute-api.us-east-1.amazonaws.com/dev");
    packagesApi.post("/packages", [{ Name: "*" }])
    .catch((error) => {
      console.error("Error fetching data: ", error);
      Cookies.remove("user");
      setUser(null);
    });
  }

  
}

function App() {
  const { setUser } = useUserManager();
  useEffect(() => {
    initialize(setUser);
  }, []);

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
      <TransitionGroup>
        <CSSTransition
          key={location.pathname}
          nodeRef={getNodeRef(location.pathname)}
          timeout={300}
          classNames="page"
          unmountOnExit
        >
          <div ref={getNodeRef(location.pathname)}>
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/packages" element={user ? <Packages /> : <RouteBlocker />} />
              <Route path="/packages/:id" element={user ? <PackageDetails /> : <RouteBlocker />} />
              <Route path="/packages/results/:id" element={user ? <PackageDetails isResult /> : <RouteBlocker />} />
              <Route path="/search/:query" element={user ? <SearchResults /> : <RouteBlocker />} />
              <Route path="/search/:query/results/:id" element={user ? <PackageDetails isResult /> : <RouteBlocker />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </CSSTransition>
      </TransitionGroup>
    </Shell>
  );
}

export default App;