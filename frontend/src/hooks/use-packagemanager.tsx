import { useEffect, useState } from 'react';
import { packageManager } from '@/state/package-manager';

export const usePackageManager = () => {
    const [packages, setPackages] = useState(packageManager.getPackages());

    useEffect(() => {
        const unsubscribe = packageManager.subscribe(setPackages);

        return () => unsubscribe();
    }, []);

    return { packages, setPackages: packageManager.setPackages, setPackage: packageManager.setPackage, getPackage: packageManager.getPackage };
}