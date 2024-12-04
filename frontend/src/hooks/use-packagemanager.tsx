import { useEffect, useState } from 'react';
import { packageManager } from '@/state/package-manager';

export const usePackageManager = () => {
    const [packages, setPackages] = useState(packageManager.getPackages());

    useEffect(() => {
        const unsubscribe = packageManager.subscribe(setPackages);

        return () => unsubscribe();
    }, []);

    return {
        packages,
        setPackages: packageManager.setPackages.bind(packageManager),
        setPackage: packageManager.setPackage.bind(packageManager),
        getPackage: packageManager.getPackage.bind(packageManager)
    };
}