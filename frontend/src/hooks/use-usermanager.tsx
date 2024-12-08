//This file contains code for the user manager.

import { useEffect, useState } from 'react';
import { userManager } from '@/state/user-manager';

export const useUserManager = () => {
    const [user, setUser] = useState(userManager.getUser());

    useEffect(() => {
        const unsubscribe = userManager.subscribe(setUser);

        return () => unsubscribe();
    }, []);

    return { user, setUser: userManager.setUser };
}