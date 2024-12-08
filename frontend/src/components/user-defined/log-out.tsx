import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuGroup } from "@/components/ui/dropdown-menu";
import { useUserManager } from "@/hooks/use-usermanager";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronsUpDown, TrashIcon } from "lucide-react";
import Cookies from "js-cookie";
import API from "@/api/api";
import { toast } from "@/hooks/use-toast";

function LogOutButton() {
    const { setUser, user } = useUserManager();

    const handleLogOut = () => {
        setUser(null);
        Cookies.remove("user");
    }

    const handleDeleteAllPackages = async () => {
        const api = new API("https://med4k766h1.execute-api.us-east-1.amazonaws.com/dev");

        const headers = {
            "Content-Type": "application/json",
            "X-Authorization": user?.token,
        }

        console.log(headers);

        try {
            const response = await api.delete("/reset", headers);
            if (response.statusCode === 200) {
                toast({ description: "All packages deleted", title: "Success" });
            }
        } catch (error) {
            toast({ description: "Error deleting all packages", title: "Error" });
        }

    }

    const spacer = <div className="w-2 h-1"></div>;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full mobile:h-16">
                    Hello, {user?.username}
                    {spacer}
                    {<><div className="mobile:hidden"><ChevronDown size="1rem" /></div>
                        <div><ChevronsUpDown className="md:hidden" size="1rem" /></div></>}
                </Button>

            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={handleLogOut}>
                        Log Out
                    </DropdownMenuItem>
                    {user?.isAdmin &&
                        <DropdownMenuItem className="text-red-800" onClick={handleDeleteAllPackages}>
                            <span><TrashIcon size={'1rem'} /></span> Delete all packages
                        </DropdownMenuItem>
                    }
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default LogOutButton;