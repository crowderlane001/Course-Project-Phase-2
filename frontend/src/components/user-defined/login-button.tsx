//This file contains the login button component.

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { LoginForm } from "@/components/user-defined/login-form";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '../ui/drawer';

interface LoginButtonProps {
    children: React.ReactNode;
}

function LoginButton({ children }: LoginButtonProps) {
    return (
        <><div className='mobile:hidden'>
            <Dialog>
                <DialogTrigger asChild>{children}</DialogTrigger>
                <DialogContent>
                    <DialogTitle>Login</DialogTitle>
                    <DialogHeader>
                        <DialogDescription>
                            Enter your credentials to login.
                        </DialogDescription>
                    </DialogHeader>
                    <LoginForm />
                </DialogContent>
            </Dialog>
        </div>
            <div className="mobile:block md:hidden">
                <Drawer>
                    <DrawerTrigger asChild>{children}</DrawerTrigger>
                    <DrawerContent className='p-5 pb-28 flex flex-col items-center'>
                        <DrawerTitle className='flex text-4xl pt-20 flex-row justify-center'>
                            Login
                        </DrawerTitle>
                        <LoginForm />
                    </DrawerContent>
                </Drawer>
            </div>
        </>
    );
}

export default LoginButton;