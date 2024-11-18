import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuGroup } from "@/components/ui/dropdown-menu";
import { useUserManager } from "@/hooks/use-usermanager";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import Cookies from "js-cookie";

function LogOutButton() {
    const { setUser, user } = useUserManager();

    const handleLogOut = () => {
        setUser(null);
        Cookies.remove("user");
    }

    const spacer = <div className="w-2 h-1"></div>

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline">Hello, {user?.username}{spacer}{<ChevronDown size="1rem" />}</Button>

            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={handleLogOut}>
                        Log Out
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default LogOutButton;