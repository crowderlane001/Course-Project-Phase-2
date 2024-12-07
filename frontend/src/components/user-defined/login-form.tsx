"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useUserManager } from "@/hooks/use-usermanager";
import User from "@/models/user-model";
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import Cookies from "js-cookie";
import zxcvbn from "zxcvbn";
import API from "@/api/api";
import { useEffect, useState } from "react";
import { Progress } from "../ui/progress";
import Spinner from "./spinner";
import { toast } from "@/hooks/use-toast";

const FormSchema = z.object({
    username: z.string().min(2, {
        message: "Username must be at least 2 characters.",
    }),
    password: z.string().min(8, {
        message: "Password must be at least 8 characters.",
    }),
})

export function LoginForm() {
    const { setUser } = useUserManager();
    const [passwordStrength, setPasswordStrength] = useState<number>(0);
    const [isPassword, setIsPassword] = useState<boolean>(false);
    const [isError, setIsError] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
        defaultValues: {
            username: "",
            password: "",
        },
    })


    const getToken = async (username: string, password: string): Promise<string> => {
        const api = new API("https://med4k766h1.execute-api.us-east-1.amazonaws.com/dev");

        let isAdmin: boolean = false;
        const adminRegexOnUsername = /admin_/i;

        if (adminRegexOnUsername.test(username)) {
            isAdmin = true;
        }

        const data = {
            "User": {
                "name": username,
                "isAdmin": isAdmin,
            },
            "Secret": {
                "password": password,
            }
        }

        try {
            const response = await api.put("/authenticate", data);
            return response;
        } catch (error) {
            setIsError(true);
            return "";
        }
    }

    const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const password = event.target.value;
        if(password.length > 0) {
            setIsPassword(true);
        }
        const result: zxcvbn.ZXCVBNResult = zxcvbn(password);
        console.log(result);
        setPasswordStrength(result.score);
        form.setValue("password", password);
    }


    async function onSubmit(data: z.infer<typeof FormSchema>) {
        setIsLoading(true);
        const { username, password } = data;
        try {
        const token: string = await getToken(username, password);
        console.log(token);
        if (token === "" || token === undefined || token === null) {
            setIsLoading(false);
            toast({ title: "Failure", description: "Could not log in, try again." });
            return;
        }
        const user = new User({ token: token, username });

        setUser(user);
        Cookies.set("user", JSON.stringify(user), {
            expires: 1,
            path: "/",
            secure: true,
            sameSite: "strict",
        });
        } catch (error) {
            toast({ title: "Failure", description: "Could not log in, try again." });
        }
        setIsLoading(false);
    }

    useEffect(() => {}, [isLoading]);

    const passwordMap: string[] = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];

    const colorMap: string[] = ["red", "orange", "yellow", "green", "darkgreen"];

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="w-2/3 space-y-6">
                <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                                <Input className="text-base" placeholder="Enter username" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}

                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                                <Input
                                    className="text-base"
                                    type="password"
                                    placeholder="Enter password"
                                    onChange={(e) => {
                                        field.onChange(e);
                                        handlePasswordChange(e);
                                    }}
                                    value={field.value}
                                    name={field.name}
                                    ref={field.ref}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                {
                    isPassword ? 
                    <div>
                        <p>Password strength: {passwordMap[passwordStrength]}</p>
                        <Progress value={((passwordStrength + 1) / 5) * 100} max={4} barColor={colorMap[passwordStrength]} className="bg-gray-400"/>
                    </div> : null
                }
                {isLoading ? <Spinner /> : <Button type="submit" disabled={passwordStrength < 4}>Submit</Button>}
            </form>
        </Form>
    )
}
