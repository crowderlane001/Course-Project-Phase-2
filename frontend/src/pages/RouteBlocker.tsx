import { Button } from "@/components/ui/button";
import LoginButton from "@/components/user-defined/login-button";
import {
    Lock
} from "lucide-react";

function RouteBlocker() {
    return (
        <div>
            <span className="flex flex-row"><h1>You need to be signed in to look at this page.</h1><Lock size="3rem" /></span>
            <LoginButton>
                <Button variant="link" className="bg-transparent text-lg pt-10 px-0 focus:outline-none hover:outline-none">Sign in with company credentials today.</Button>
            </LoginButton>
        </div>
    )
}

export default RouteBlocker;